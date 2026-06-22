import os
import pickle
import io
import logging
import numpy as np
from PIL import Image
from sqlalchemy.orm import Session
import models

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Backend selection: insightface → face_recognition → Mock (last resort)
# insightface uses ONNX models — no C++ compilation required
# ---------------------------------------------------------------------------

FACE_BACKEND = None  # "insightface" | "face_recognition" | "mock"
_insight_app = None  # lazy-initialised insightface FaceAnalysis

def _init_insightface():
    """Lazily initialise insightface FaceAnalysis on first use."""
    global _insight_app
    if _insight_app is not None:
        return _insight_app
    try:
        from insightface.app import FaceAnalysis
        app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
        app.prepare(ctx_id=0, det_size=(320, 320))
        _insight_app = app
        logger.info("insightface FaceAnalysis initialised (buffalo_sc, CPU)")
        return _insight_app
    except Exception as e:
        logger.warning(f"insightface init failed: {e}")
        return None

import sys
if "pytest" in sys.modules or "PYTEST_CURRENT_TEST" in os.environ:
    FACE_BACKEND = "mock"
    logger.info("Face backend forced to: mock (pytest environment detected)")
else:
    try:
        import insightface  # noqa: F401 — just verify importable
        FACE_BACKEND = "insightface"
        logger.info("Face backend: insightface (ONNX)")
    except ImportError:
        try:
            import face_recognition  # noqa: F401
            FACE_BACKEND = "face_recognition"
            logger.info("Face backend: face_recognition (dlib)")
        except ImportError:
            FACE_BACKEND = "mock"
            logger.warning(
                "⚠  No real face recognition library found. "
                "Face matching will NOT work correctly. "
                "Install insightface: pip install insightface onnxruntime opencv-python"
            )

# ---------------------------------------------------------------------------
# Helpers used by all backends
# ---------------------------------------------------------------------------

def _pil_to_bgr(image_bytes: bytes) -> np.ndarray:
    """Load image bytes → BGR numpy array (insightface expects BGR)."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    rgb = np.array(image)
    return rgb[:, :, ::-1].copy()  # RGB → BGR

def _pil_to_rgb(image_bytes: bytes) -> np.ndarray:
    """Load image bytes → RGB numpy array."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return np.array(image)

def _cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine distance in [0, 2]. Lower = more similar."""
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 1.0
    return float(1.0 - np.dot(a, b) / (na * nb))

# ---------------------------------------------------------------------------
# encode_faces — returns one averaged embedding for a list of images
# ---------------------------------------------------------------------------

def encode_faces(image_bytes_list: list[bytes]) -> np.ndarray:
    """
    Accepts up to 5 image byte strings.
    Detects the face in each image and returns the averaged embedding.
    Raises ValueError if no face is detected in any image.
    """
    if FACE_BACKEND == "insightface":
        return _encode_faces_insightface(image_bytes_list)
    elif FACE_BACKEND == "face_recognition":
        return _encode_faces_fr(image_bytes_list)
    else:
        return _encode_faces_mock(image_bytes_list)

def _encode_faces_insightface(image_bytes_list: list[bytes]) -> np.ndarray:
    app = _init_insightface()
    if app is None:
        raise RuntimeError("insightface could not be initialised")
    embeddings = []
    for img_bytes in image_bytes_list:
        try:
            bgr = _pil_to_bgr(img_bytes)
            faces = app.get(bgr)
            if faces:
                embeddings.append(faces[0].embedding)
        except Exception as e:
            logger.debug(f"insightface encode error (skipping frame): {e}")
            continue
    if not embeddings:
        raise ValueError("No faces detected in any of the uploaded images")
    avg = np.mean(embeddings, axis=0)
    # L2-normalise so cosine distance is equivalent to Euclidean distance
    norm = np.linalg.norm(avg)
    return avg / norm if norm > 0 else avg

def _encode_faces_fr(image_bytes_list: list[bytes]) -> np.ndarray:
    import face_recognition
    encodings = []
    for img_bytes in image_bytes_list:
        try:
            rgb = _pil_to_rgb(img_bytes)
            encs = face_recognition.face_encodings(rgb)
            if encs:
                encodings.append(encs[0])
        except Exception:
            continue
    if not encodings:
        raise ValueError("No faces detected in any of the uploaded images")
    return np.mean(encodings, axis=0)

def _encode_faces_mock(image_bytes_list: list[bytes]) -> np.ndarray:
    """Mock encoding — produces deterministic-per-pixel vector (not real FR)."""
    import hashlib
    encodings = []
    for img_bytes in image_bytes_list:
        try:
            rgb = _pil_to_rgb(img_bytes)
            hasher = hashlib.md5(rgb.tobytes())
            seed = int(hasher.hexdigest(), 16) % (2**32)
            rng = np.random.default_rng(seed)
            vec = rng.normal(size=128)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            encodings.append(vec)
        except Exception:
            continue
    if not encodings:
        raise ValueError("No faces detected in any of the uploaded images")
    return np.mean(encodings, axis=0)

# ---------------------------------------------------------------------------
# find_matches — detect faces in frame and compare against stored encodings
# ---------------------------------------------------------------------------

def find_matches(frame_bytes: bytes, known_encodings_dict: dict[int, np.ndarray]) -> list[tuple[int, float]]:
    """
    Detects faces in a frame and compares against registered encodings.
    Returns: list of (user_id, confidence) for detected matches.
    """
    if not known_encodings_dict:
        return []

    if FACE_BACKEND == "insightface":
        return _find_matches_insightface(frame_bytes, known_encodings_dict)
    elif FACE_BACKEND == "face_recognition":
        return _find_matches_fr(frame_bytes, known_encodings_dict)
    else:
        return _find_matches_mock(frame_bytes, known_encodings_dict)

def _find_matches_insightface(frame_bytes: bytes, known_encodings_dict: dict[int, np.ndarray]) -> list[tuple[int, float]]:
    app = _init_insightface()
    if app is None:
        return []
    try:
        bgr = _pil_to_bgr(frame_bytes)
        faces = app.get(bgr)
    except Exception as e:
        logger.debug(f"insightface detect error: {e}")
        return []

    if not faces:
        return []

    COSINE_THRESHOLD = 0.5  # cosine distance ≤ 0.5 → same person
    known_ids = list(known_encodings_dict.keys())
    known_embs = np.array(list(known_encodings_dict.values()))

    best_matches: dict[int, float] = {}
    for face in faces:
        emb = face.embedding
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        for idx, uid in enumerate(known_ids):
            dist = _cosine_distance(emb, known_embs[idx])
            if dist <= COSINE_THRESHOLD:
                confidence = float(1.0 - dist)
                if uid not in best_matches or confidence > best_matches[uid]:
                    best_matches[uid] = confidence

    return list(best_matches.items())

def _find_matches_fr(frame_bytes: bytes, known_encodings_dict: dict[int, np.ndarray]) -> list[tuple[int, float]]:
    import face_recognition
    try:
        rgb = _pil_to_rgb(frame_bytes)
    except Exception:
        return []
    face_encs = face_recognition.face_encodings(rgb)
    if not face_encs:
        return []
    known_ids = list(known_encodings_dict.keys())
    known_embs = list(known_encodings_dict.values())
    best_matches: dict[int, float] = {}
    for face_enc in face_encs:
        distances = face_recognition.face_distance(known_embs, face_enc)
        for idx, dist in enumerate(distances):
            if dist <= 0.5:
                uid = known_ids[idx]
                confidence = float(1.0 - dist)
                if uid not in best_matches or confidence > best_matches[uid]:
                    best_matches[uid] = confidence
    return list(best_matches.items())

def _find_matches_mock(frame_bytes: bytes, known_encodings_dict: dict[int, np.ndarray]) -> list[tuple[int, float]]:
    """Mock matching — always returns no match (mock encodings are random-per-frame)."""
    logger.warning("Mock face backend: find_matches always returns empty (install insightface for real detection)")
    return []

FACE_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_data")

def save_encoding(db: Session, user_id: int, encoding: np.ndarray, photo_count: int = 5) -> None:
    """
    Saves the encoding numpy array directly in the database as a binary blob.
    """
    from datetime import datetime, timezone
    encoding_bytes = pickle.dumps(encoding)
    
    # Check if encoding already exists for this student
    existing_encoding = db.query(models.FaceEncoding).filter(models.FaceEncoding.user_id == user_id).first()
    
    if existing_encoding:
        existing_encoding.encoding_data = encoding_bytes
        existing_encoding.photo_count = photo_count
        existing_encoding.created_at = datetime.now(timezone.utc)
    else:
        new_encoding = models.FaceEncoding(
            user_id=user_id,
            encoding_data=encoding_bytes,
            photo_count=photo_count,
            created_at=datetime.now(timezone.utc)
        )
        db.add(new_encoding)
    db.commit()

def load_all_encodings(db: Session) -> dict[int, np.ndarray]:
    """
    Loads all registered encodings from the database
    Returns dict: { user_id (int): encoding (np.ndarray) }
    """
    db_encodings = db.query(models.FaceEncoding).all()
    known_encodings = {}
    
    for db_enc in db_encodings:
        if db_enc.encoding_data:
            try:
                encoding = pickle.loads(db_enc.encoding_data)
                known_encodings[db_enc.user_id] = encoding
            except Exception:
                continue
    return known_encodings

def compute_attendance(session_id: int, db: Session):
    """
    Computes final attendance for a session and writes to attendance table.
    - Loads all scans for session ordered by scan_number.
    - Loads all registered students.
    - For each student:
      - Retrieves scan_results (detected=True/False) ordered by scan.scan_number.
      - Checks consecutive miss rule: if any 2 consecutive scans are missed -> ABSENT.
      - Checks late rule: if first 2 consecutive scans are missed -> ABSENT.
      - If no scans were run during the session -> ABSENT.
      - Otherwise -> PRESENT.
    - Saves result to attendance table.
    """
    from datetime import datetime, timezone
    
    # 1. Fetch all scans for session ordered by scan_number
    scans = db.query(models.Scan).filter(models.Scan.session_id == session_id).order_by(models.Scan.scan_number).all()
    num_scans = len(scans)
    
    # 2. Fetch all registered students
    students = db.query(models.User).filter(models.User.role == "student").all()
    
    for student in students:
        if num_scans == 0:
            status_str = "absent"
        else:
            # Fetch scan results for this student in this session
            results = (
                db.query(models.ScanResult)
                .join(models.Scan, models.ScanResult.scan_id == models.Scan.id)
                .filter(
                    models.ScanResult.student_id == student.id,
                    models.Scan.session_id == session_id
                )
                .order_by(models.Scan.scan_number)
                .all()
            )
            
            # Map detected results by scan_number
            detected_map = {res.scan.scan_number: res.detected for res in results}
            
            scans_detected = []
            for scan in scans:
                scans_detected.append(detected_map.get(scan.scan_number, False))
                
            if num_scans == 1:
                status_str = "present" if scans_detected[0] else "absent"
            else:
                # Late rule: missed first 2 scans -> ABSENT
                if not scans_detected[0] and not scans_detected[1]:
                    status_str = "absent"
                else:
                    # Consecutive miss rule: any 2 consecutive missed scans -> ABSENT
                    is_absent = False
                    for i in range(num_scans - 1):
                        if not scans_detected[i] and not scans_detected[i + 1]:
                            is_absent = True
                            break
                    status_str = "absent" if is_absent else "present"
                    
        # Write to attendance table (idempotent update)
        existing_attendance = (
            db.query(models.Attendance)
            .filter(
                models.Attendance.session_id == session_id,
                models.Attendance.student_id == student.id
            )
            .first()
        )
        
        if existing_attendance:
            existing_attendance.status = status_str
            existing_attendance.computed_at = datetime.now(timezone.utc)
        else:
            new_attendance = models.Attendance(
                session_id=session_id,
                student_id=student.id,
                status=status_str,
                computed_at=datetime.now(timezone.utc)
            )
            db.add(new_attendance)
            
    db.commit()
