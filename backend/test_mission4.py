import os
import io
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["SECRET_KEY"] = "test_secret_key_12345"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"

from database import Base, get_db
from main import app
import models
import face_utils

TEST_DATABASE_URL = "sqlite:///./test_faceattend_m4.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

client = TestClient(app)

# Track created users for mocking matches
student_mapping = {}

# Mock load_all_encodings
def mock_load_all_encodings(db):
    # Just return a dummy encoding dict for mapped students
    import numpy as np
    return {uid: np.zeros((128,)) for uid in student_mapping.keys()}

# Mock find_matches
def mock_find_matches(frame_bytes, known_encodings_dict):
    # Determine mock matches based on frame content bytes
    matches = []
    if frame_bytes == b"match_alice":
        # Alice is detected
        for uid, role in student_mapping.items():
            if role == "Alice Student":
                matches.append((uid, 0.85))
    elif frame_bytes == b"match_both":
        # Alice and Bob are detected
        for uid, role in student_mapping.items():
            if role == "Alice Student":
                matches.append((uid, 0.90))
            elif role == "Bob Student":
                matches.append((uid, 0.75))
    elif frame_bytes == b"no_face":
        # No one is detected
        pass
    return matches

@pytest.fixture(autouse=True)
def setup_and_teardown(monkeypatch):
    # Set the dependency override dynamically during test execution
    app.dependency_overrides[get_db] = override_get_db
    
    # Apply monkeypatch for face_utils functions
    monkeypatch.setattr(face_utils, "load_all_encodings", mock_load_all_encodings)
    monkeypatch.setattr(face_utils, "find_matches", mock_find_matches)
    
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists("test_faceattend_m4.db"):
        try:
            os.remove("test_faceattend_m4.db")
        except Exception:
            pass
    student_mapping.clear()
    
    # Clean up dependency overrides to avoid polluting other modules
    app.dependency_overrides.pop(get_db, None)

def test_live_scan_endpoint_flows():
    # 1. Register teacher 1 and teacher 2
    t1_payload = {"name": "Teacher One", "email": "t1@test.com", "password": "pass", "role": "teacher"}
    t2_payload = {"name": "Teacher Two", "email": "t2@test.com", "password": "pass", "role": "teacher"}
    client.post("/auth/register", json=t1_payload)
    client.post("/auth/register", json=t2_payload)
    
    # Login teacher 1 and teacher 2
    t1_token = client.post("/auth/login", json={"email": "t1@test.com", "password": "pass"}).json()["access_token"]
    t2_token = client.post("/auth/login", json={"email": "t2@test.com", "password": "pass"}).json()["access_token"]
    t1_headers = {"Authorization": f"Bearer {t1_token}"}
    t2_headers = {"Authorization": f"Bearer {t2_token}"}
    
    # 2. Register students
    s1_payload = {"name": "Alice Student", "email": "alice@test.com", "password": "pass", "role": "student", "student_id": "STU_ALICE"}
    s2_payload = {"name": "Bob Student", "email": "bob@test.com", "password": "pass", "role": "student", "student_id": "STU_BOB"}
    s1_resp = client.post("/auth/register", json=s1_payload).json()
    s2_resp = client.post("/auth/register", json=s2_payload).json()
    
    alice_id = s1_resp["id"]
    bob_id = s2_resp["id"]
    student_mapping[alice_id] = "Alice Student"
    student_mapping[bob_id] = "Bob Student"
    
    # Login student 1 (Alice)
    s1_token = client.post("/auth/login", json={"email": "alice@test.com", "password": "pass"}).json()["access_token"]
    s1_headers = {"Authorization": f"Bearer {s1_token}"}
    
    # 3. Create Subject as Teacher 1
    subj_payload = {"name": "Mathematics", "code": "MATH101"}
    subj_resp = client.post("/subjects/", json=subj_payload, headers=t1_headers)
    assert subj_resp.status_code == 201
    subj_id = subj_resp.json()["id"]
    
    # 4. Start Session as Teacher 1
    sess_payload = {"subject_id": subj_id, "scan_interval_seconds": 15}
    sess_resp = client.post("/sessions/start", json=sess_payload, headers=t1_headers)
    assert sess_resp.status_code == 200
    sess_id = sess_resp.json()["session_id"]
    
    # --- TEST 1: Post to a valid active session returns correct scan results ---
    # Upload frame where Alice is detected
    file_payload = {"file": ("frame.jpg", b"match_alice", "image/jpeg")}
    scan_resp1 = client.post(f"/sessions/{sess_id}/scan", files=file_payload, headers=t1_headers)
    assert scan_resp1.status_code == 200
    
    results1 = scan_resp1.json()
    assert len(results1) == 2
    
    # Find Alice and Bob in results
    alice_res = next(r for r in results1 if r["student_id"] == "STU_ALICE")
    bob_res = next(r for r in results1 if r["student_id"] == "STU_BOB")
    
    assert alice_res["student_name"] == "Alice Student"
    assert alice_res["detected"] is True
    assert alice_res["confidence"] == 0.85
    
    assert bob_res["student_name"] == "Bob Student"
    assert bob_res["detected"] is False
    assert bob_res["confidence"] == 0.0
    
    # Verify DB state for Scan 1
    db = TestingSessionLocal()
    try:
        db_scans = db.query(models.Scan).filter(models.Scan.session_id == sess_id).all()
        assert len(db_scans) == 1
        assert db_scans[0].scan_number == 1
        
        db_results = db.query(models.ScanResult).filter(models.ScanResult.scan_id == db_scans[0].id).all()
        assert len(db_results) == 2
        
        db_alice_res = next(r for r in db_results if r.student_id == alice_id)
        db_bob_res = next(r for r in db_results if r.student_id == bob_id)
        
        assert db_alice_res.detected is True
        assert db_alice_res.confidence == 0.85
        assert db_bob_res.detected is False
        assert db_bob_res.confidence == 0.0
    finally:
        db.close()
        
    # --- TEST 2: Scan number increments correctly across multiple scan calls ---
    # Upload another frame where both are detected
    file_payload2 = {"file": ("frame.jpg", b"match_both", "image/jpeg")}
    scan_resp2 = client.post(f"/sessions/{sess_id}/scan", files=file_payload2, headers=t1_headers)
    assert scan_resp2.status_code == 200
    
    results2 = scan_resp2.json()
    alice_res2 = next(r for r in results2 if r["student_id"] == "STU_ALICE")
    bob_res2 = next(r for r in results2 if r["student_id"] == "STU_BOB")
    
    assert alice_res2["detected"] is True
    assert alice_res2["confidence"] == 0.90
    assert bob_res2["detected"] is True
    assert bob_res2["confidence"] == 0.75
    
    # Verify DB state has Scan 2
    db = TestingSessionLocal()
    try:
        db_scans = db.query(models.Scan).filter(models.Scan.session_id == sess_id).order_by(models.Scan.scan_number).all()
        assert len(db_scans) == 2
        assert db_scans[0].scan_number == 1
        assert db_scans[1].scan_number == 2
        
        db_results2 = db.query(models.ScanResult).filter(models.ScanResult.scan_id == db_scans[1].id).all()
        assert len(db_results2) == 2
        
        db_alice_res2 = next(r for r in db_results2 if r.student_id == alice_id)
        db_bob_res2 = next(r for r in db_results2 if r.student_id == bob_id)
        
        assert db_alice_res2.detected is True
        assert db_alice_res2.confidence == 0.90
        assert db_bob_res2.detected is True
        assert db_bob_res2.confidence == 0.75
    finally:
        db.close()
        
    # --- TEST 3: No-face-detected frame still creates a scan record with all detected=False ---
    file_payload3 = {"file": ("frame.jpg", b"no_face", "image/jpeg")}
    scan_resp3 = client.post(f"/sessions/{sess_id}/scan", files=file_payload3, headers=t1_headers)
    assert scan_resp3.status_code == 200
    
    results3 = scan_resp3.json()
    for res in results3:
        assert res["detected"] is False
        assert res["confidence"] == 0.0
        
    # Verify DB state has Scan 3
    db = TestingSessionLocal()
    try:
        db_scans = db.query(models.Scan).filter(models.Scan.session_id == sess_id).order_by(models.Scan.scan_number).all()
        assert len(db_scans) == 3
        assert db_scans[2].scan_number == 3
        
        db_results3 = db.query(models.ScanResult).filter(models.ScanResult.scan_id == db_scans[2].id).all()
        assert len(db_results3) == 2
        for r in db_results3:
            assert r.detected is False
            assert r.confidence == 0.0
    finally:
        db.close()
        
    # --- TEST 4: Access restrictions (non-owner or non-teacher rejected) ---
    # Teacher 2 trying to scan Teacher 1's session -> 403 Forbidden
    scan_resp_t2 = client.post(f"/sessions/{sess_id}/scan", files=file_payload, headers=t2_headers)
    assert scan_resp_t2.status_code == 403
    assert "Only the teacher who owns" in scan_resp_t2.json()["detail"]
    
    # Student trying to scan -> 403 Forbidden (from require_role)
    scan_resp_s1 = client.post(f"/sessions/{sess_id}/scan", files=file_payload, headers=s1_headers)
    assert scan_resp_s1.status_code == 403
    assert "Operation not permitted" in scan_resp_s1.json()["detail"]
    
    # No auth token -> 401 Unauthorized (from OAuth2PasswordBearer)
    scan_resp_no_auth = client.post(f"/sessions/{sess_id}/scan", files=file_payload)
    assert scan_resp_no_auth.status_code == 401
    
    # --- TEST 5: Posting to a non-active (completed) session is rejected ---
    # Stop the session
    stop_resp = client.post("/sessions/stop", json={"session_id": sess_id}, headers=t1_headers)
    assert stop_resp.status_code == 200
    
    # Scan session after stopping -> 400 Bad Request
    scan_resp_stopped = client.post(f"/sessions/{sess_id}/scan", files=file_payload, headers=t1_headers)
    assert scan_resp_stopped.status_code == 400
    assert "Session is not active" in scan_resp_stopped.json()["detail"]

if __name__ == "__main__":
    import sys
    sys.exit(pytest.main(["-v", __file__]))
