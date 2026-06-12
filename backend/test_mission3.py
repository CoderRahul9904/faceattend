import os
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

TEST_DATABASE_URL = "sqlite:///./test_faceattend.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def setup_module(module):
    Base.metadata.create_all(bind=engine)

def teardown_module(module):
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists("test_faceattend.db"):
        try:
            os.remove("test_faceattend.db")
        except Exception:
            pass

def test_subject_and_session_flow():
    # 1. Register teacher
    t_reg = {
        "name": "Teacher Tom",
        "email": "tom@test.com",
        "password": "tompassword",
        "role": "teacher"
    }
    client.post("/auth/register", json=t_reg)
    
    # Login teacher
    t_login = {"email": "tom@test.com", "password": "tompassword"}
    token = client.post("/auth/login", json=t_login).json()["access_token"]
    t_headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Register three students
    s1 = {"name": "S1 Present", "email": "s1@test.com", "password": "pass", "role": "student", "student_id": "STU_1"}
    s2 = {"name": "S2 Consecutive", "email": "s2@test.com", "password": "pass", "role": "student", "student_id": "STU_2"}
    s3 = {"name": "S3 Late", "email": "s3@test.com", "password": "pass", "role": "student", "student_id": "STU_3"}
    
    s1_id = client.post("/auth/register", json=s1).json()["id"]
    s2_id = client.post("/auth/register", json=s2).json()["id"]
    s3_id = client.post("/auth/register", json=s3).json()["id"]
    
    # 3. Create Subject
    subj_payload = {"name": "Algorithms", "code": "CS202"}
    subj_resp = client.post("/subjects/", json=subj_payload, headers=t_headers)
    assert subj_resp.status_code == 201
    subj_id = subj_resp.json()["id"]
    
    # List subjects
    list_subj = client.get("/subjects/", headers=t_headers)
    assert list_subj.status_code == 200
    assert len(list_subj.json()) >= 1
    
    # 4. Start Session
    sess_payload = {"subject_id": subj_id, "scan_interval_seconds": 15}
    sess_resp = client.post("/sessions/start", json=sess_payload, headers=t_headers)
    assert sess_resp.status_code == 200
    sess_id = sess_resp.json()["session_id"]
    
    # Check active session
    active_resp = client.get("/sessions/active", headers=t_headers)
    assert active_resp.status_code == 200
    assert active_resp.json()["id"] == sess_id
    assert active_resp.json()["subject_name"] == "Algorithms"
    
    # 5. Populate Mock Scans and Scan Results (4 scans)
    # We will write directly to DB using a local test session to simulate MISSION 4 behavior
    db = TestingSessionLocal()
    try:
        scans = []
        for i in range(1, 5):
            scan = models.Scan(session_id=sess_id, scan_number=i, scanned_at=datetime.now(timezone.utc))
            db.add(scan)
            db.flush() # populated scan.id
            scans.append(scan)
            
        # Student 1 detections: [True, False, True, False] -> PRESENT
        # Student 2 detections: [True, False, False, True] -> ABSENT (consecutive miss scans 2 & 3)
        # Student 3 detections: [False, False, True, True] -> ABSENT (late rule scans 1 & 2)
        
        detections = {
            s1_id: [True, False, True, False],
            s2_id: [True, False, False, True],
            s3_id: [False, False, True, True]
        }
        
        for scan_idx, scan in enumerate(scans):
            for stu_id, d_list in detections.items():
                result = models.ScanResult(
                    scan_id=scan.id,
                    student_id=stu_id,
                    detected=d_list[scan_idx],
                    confidence=0.95 if d_list[scan_idx] else 0.0
                )
                db.add(result)
        db.commit()
    finally:
        db.close()
        
    # 6. Stop Session (triggers attendance calculation)
    stop_resp = client.post("/sessions/stop", json={"session_id": sess_id}, headers=t_headers)
    assert stop_resp.status_code == 200
    assert stop_resp.json()["status"] == "success"
    
    # Verify active session is now null
    active_resp_after = client.get("/sessions/active", headers=t_headers)
    assert active_resp_after.status_code == 200
    assert active_resp_after.json() is None
    
    # List past sessions
    past_sess = client.get("/sessions/", headers=t_headers)
    assert past_sess.status_code == 200
    assert len(past_sess.json()) >= 1
    assert past_sess.json()[0]["status"] == "completed"
    
    # 7. Query Attendance table state
    db = TestingSessionLocal()
    try:
        att_s1 = db.query(models.Attendance).filter(
            models.Attendance.session_id == sess_id,
            models.Attendance.student_id == s1_id
        ).first()
        
        att_s2 = db.query(models.Attendance).filter(
            models.Attendance.session_id == sess_id,
            models.Attendance.student_id == s2_id
        ).first()
        
        att_s3 = db.query(models.Attendance).filter(
            models.Attendance.session_id == sess_id,
            models.Attendance.student_id == s3_id
        ).first()
        
        assert att_s1 is not None
        assert att_s1.status == "present"
        
        assert att_s2 is not None
        assert att_s2.status == "absent"
        
        assert att_s3 is not None
        assert att_s3.status == "absent"
    finally:
        db.close()

if __name__ == "__main__":
    import sys
    sys.exit(pytest.main(["-v", __file__]))
