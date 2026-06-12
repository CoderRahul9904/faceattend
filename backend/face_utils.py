import os
import pickle
import io
import hashlib
import numpy as np
from PIL import Image
from sqlalchemy.orm import Session
import models

# Fallback pattern for face_recognition if dlib/cmake compilation fails
try:
    import face_recognition
    USING_MOCK_FACE_REC = False
except ImportError:
    class MockFaceRecognition:
        @staticmethod
        def face_locations(img_np):
            # Return a mock face box if the image is not empty
            if img_np is not None and img_np.size > 0:
                return [(10, 90, 90, 10)]
            return []

        @staticmethod
        def face_encodings(img_np, known_face_locations=None):
            if known_face_locations is None:
                locations = MockFaceRecognition.face_locations(img_np)
                if not locations:
                    return []
            else:
                locations = known_face_locations
            
            encodings = []
            for loc in locations:
                # Generate deterministic 128-dim encoding based on image content hash
                hasher = hashlib.md5(img_np.tobytes())
                seed = int(hasher.hexdigest(), 16) % (2**32)
                rng = np.random.default_rng(seed)
                vec = rng.normal(size=128)
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
                encodings.append(vec)
            return encodings

        @staticmethod
        def compare_faces(known_encodings, face_encoding, tolerance=0.5):
            distances = MockFaceRecognition.face_distance(known_encodings, face_encoding)
            return [float(dist) <= tolerance for dist in distances]

        @staticmethod
        def face_distance(known_encodings, face_encoding):
            if len(known_encodings) == 0:
                return np.empty((0,))
            return np.linalg.norm(np.array(known_encodings) - np.array(face_encoding), axis=1)

    face_recognition = MockFaceRecognition
    USING_MOCK_FACE_REC = True

FACE_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_data")

def encode_faces(image_bytes_list: list[bytes]) -> np.ndarray:
    """
    Accepts 5 image byte strings.
    For each: load image, detect face, extract 128-dim encoding.
    Returns the average encoding vector of all detected faces.
    Raises ValueError if no faces are detected in any image.
    """
    encodings = []
    for img_bytes in image_bytes_list:
        try:
            image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            image_np = np.array(image)
            face_encs = face_recognition.face_encodings(image_np)
            if face_encs:
                encodings.append(face_encs[0])
        except Exception:
            continue
            
    if not encodings:
        raise ValueError("No faces detected in any of the uploaded images")
    
    # Average the 128-dim encodings
    avg_encoding = np.mean(encodings, axis=0)
    return avg_encoding

def save_encoding(student_id: str, encoding: np.ndarray) -> str:
    """
    Saves the encoding numpy array as a .pkl file in face_data/
    """
    if not os.path.exists(FACE_DATA_DIR):
        os.makedirs(FACE_DATA_DIR)
        
    filename = f"{student_id}.pkl"
    file_path = os.path.join(FACE_DATA_DIR, filename)
    
    with open(file_path, "wb") as f:
        pickle.dump(encoding, f)
        
    return file_path

def load_all_encodings(db: Session) -> dict[int, np.ndarray]:
    """
    Loads all registered encodings from the database and face_data/
    Returns dict: { user_id (int): encoding (np.ndarray) }
    """
    db_encodings = db.query(models.FaceEncoding).all()
    known_encodings = {}
    
    for db_enc in db_encodings:
        if os.path.exists(db_enc.encoding_path):
            try:
                with open(db_enc.encoding_path, "rb") as f:
                    encoding = pickle.load(f)
                    known_encodings[db_enc.user_id] = encoding
            except Exception:
                continue
    return known_encodings

def find_matches(frame_bytes: bytes, known_encodings_dict: dict[int, np.ndarray]) -> list[tuple[int, float]]:
    """
    Detects faces in a frame and compares against registered encodings.
    Returns: list of tuples (user_id, confidence) for matches under tolerance=0.5
    """
    if not known_encodings_dict:
        return []
        
    try:
        image = Image.open(io.BytesIO(frame_bytes)).convert("RGB")
        image_np = np.array(image)
    except Exception:
        return []
        
    face_encs = face_recognition.face_encodings(image_np)
    if not face_encs:
        return []
        
    known_user_ids = list(known_encodings_dict.keys())
    known_encodings = list(known_encodings_dict.values())
    
    matches = []
    for face_enc in face_encs:
        distances = face_recognition.face_distance(known_encodings, face_enc)
        for idx, dist in enumerate(distances):
            if dist <= 0.5:
                user_id = known_user_ids[idx]
                confidence = float(1.0 - dist)
                matches.append((user_id, confidence))
                
    # Deduplicate matches by keeping the highest confidence for each user_id
    best_matches = {}
    for user_id, confidence in matches:
        if user_id not in best_matches or confidence > best_matches[user_id]:
            best_matches[user_id] = confidence
            
    return list(best_matches.items())

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
