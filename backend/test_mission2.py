import os
import io
import pytest
import pickle
import shutil
from PIL import Image
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["SECRET_KEY"] = "test_secret_key_12345"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"

from database import Base, get_db
from main import app
import face_utils

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

# Use a separate folder for test face data to avoid cluttering workspace
TEST_FACE_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_face_data")
face_utils.FACE_DATA_DIR = TEST_FACE_DATA_DIR

def create_dummy_image():
    # Create a 100x100 dummy image for testing
    img = Image.new('RGB', (100, 100), color='blue')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    return img_byte_arr.getvalue()

def setup_module(module):
    Base.metadata.create_all(bind=engine)
    if not os.path.exists(TEST_FACE_DATA_DIR):
        os.makedirs(TEST_FACE_DATA_DIR)

def teardown_module(module):
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists("test_faceattend.db"):
        try:
            os.remove("test_faceattend.db")
        except Exception:
            pass
    if os.path.exists(TEST_FACE_DATA_DIR):
        shutil.rmtree(TEST_FACE_DATA_DIR)

def test_face_registration_flow():
    # 1. Register student
    reg_payload = {
        "name": "Alice Student",
        "email": "alice@test.com",
        "password": "alicepassword",
        "role": "student",
        "student_id": "STU100"
    }
    reg_resp = client.post("/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201
    
    # 2. Login student
    login_payload = {
        "email": "alice@test.com",
        "password": "alicepassword"
    }
    login_resp = client.post("/auth/login", json=login_payload)
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Check initial status (should be false)
    status_resp = client.get("/face/status", headers=headers)
    assert status_resp.status_code == 200
    assert status_resp.json() == {"registered": False}
    
    # 3. Upload exactly 5 files
    img_data = create_dummy_image()
    files = [
        ("files", ("img1.jpg", img_data, "image/jpeg")),
        ("files", ("img2.jpg", img_data, "image/jpeg")),
        ("files", ("img3.jpg", img_data, "image/jpeg")),
        ("files", ("img4.jpg", img_data, "image/jpeg")),
        ("files", ("img5.jpg", img_data, "image/jpeg")),
    ]
    
    upload_resp = client.post("/face/upload", files=files, headers=headers)
    assert upload_resp.status_code == 200
    assert upload_resp.json()["status"] == "success"
    
    # 4. Verify status is now registered
    status_resp2 = client.get("/face/status", headers=headers)
    assert status_resp2.status_code == 200
    assert status_resp2.json() == {"registered": True}
    
    # 5. Verify the pickle file is created in directory
    expected_pkl = os.path.join(TEST_FACE_DATA_DIR, "STU100.pkl")
    assert os.path.exists(expected_pkl)
    
    # Check that pickle file contains a 128-dimensional array
    with open(expected_pkl, "rb") as f:
        encoding = pickle.load(f)
        assert isinstance(encoding, face_utils.np.ndarray)
        assert encoding.shape == (128,)

def test_face_registration_invalid_file_count():
    login_payload = {
        "email": "alice@test.com",
        "password": "alicepassword"
    }
    login_resp = client.post("/auth/login", json=login_payload)
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    img_data = create_dummy_image()
    # Upload only 4 files
    files = [
        ("files", ("img1.jpg", img_data, "image/jpeg")),
        ("files", ("img2.jpg", img_data, "image/jpeg")),
        ("files", ("img3.jpg", img_data, "image/jpeg")),
        ("files", ("img4.jpg", img_data, "image/jpeg")),
    ]
    
    upload_resp = client.post("/face/upload", files=files, headers=headers)
    assert upload_resp.status_code == 400
    assert "Exactly 5 images are required" in upload_resp.json()["detail"]

def test_face_registration_non_student_forbidden():
    # Register teacher
    reg_payload = {
        "name": "Teacher Charlie",
        "email": "charlie@test.com",
        "password": "charliepassword",
        "role": "teacher"
    }
    client.post("/auth/register", json=reg_payload)
    
    # Login teacher
    login_payload = {
        "email": "charlie@test.com",
        "password": "charliepassword"
    }
    login_resp = client.post("/auth/login", json=login_payload)
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    img_data = create_dummy_image()
    files = [
        ("files", ("img1.jpg", img_data, "image/jpeg")),
        ("files", ("img2.jpg", img_data, "image/jpeg")),
        ("files", ("img3.jpg", img_data, "image/jpeg")),
        ("files", ("img4.jpg", img_data, "image/jpeg")),
        ("files", ("img5.jpg", img_data, "image/jpeg")),
    ]
    
    upload_resp = client.post("/face/upload", files=files, headers=headers)
    assert upload_resp.status_code == 403
    assert "Operation not permitted" in upload_resp.json()["detail"]

if __name__ == "__main__":
    import sys
    sys.exit(pytest.main(["-v", __file__]))
