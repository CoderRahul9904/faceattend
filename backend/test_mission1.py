import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set environment variables for testing
os.environ["SECRET_KEY"] = "test_secret_key_12345"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"

from database import Base, get_db
from main import app
import models

# Use a separate test database
TEST_DATABASE_URL = "sqlite:///./test_faceattend.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override get_db dependency
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def setup_module(module):
    # Create all tables in the test database
    Base.metadata.create_all(bind=engine)

def teardown_module(module):
    # Drop all tables in the test database
    Base.metadata.drop_all(bind=engine)
    # Dispose the engine to release file locks on SQLite test DB
    engine.dispose()
    # Delete test db file if exists
    if os.path.exists("test_faceattend.db"):
        try:
            os.remove("test_faceattend.db")
        except Exception:
            pass

def test_register_teacher_success():
    payload = {
        "name": "Teacher Jane",
        "email": "teacher@test.com",
        "password": "securepassword123",
        "role": "teacher"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Teacher Jane"
    assert data["email"] == "teacher@test.com"
    assert data["role"] == "teacher"
    assert data["student_id"] is None
    assert "id" in data

def test_register_student_success():
    payload = {
        "name": "Student Bob",
        "email": "student@test.com",
        "password": "studentpassword123",
        "role": "student",
        "student_id": "STU001"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Student Bob"
    assert data["email"] == "student@test.com"
    assert data["role"] == "student"
    assert data["student_id"] == "STU001"

def test_register_student_missing_id():
    payload = {
        "name": "Student NoId",
        "email": "noid@test.com",
        "password": "password123",
        "role": "student"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 400
    assert "Student ID is required" in response.json()["detail"]

def test_register_duplicate_email():
    payload = {
        "name": "Teacher Duplicate",
        "email": "teacher@test.com", # already registered in first test
        "password": "anotherpassword",
        "role": "teacher"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 400
    assert "Email already registered" in response.json()["detail"]

def test_login_success():
    payload = {
        "email": "teacher@test.com",
        "password": "securepassword123"
    }
    response = client.post("/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "teacher"
    assert data["email"] == "teacher@test.com"
    assert data["name"] == "Teacher Jane"

def test_login_failure():
    payload = {
        "email": "teacher@test.com",
        "password": "wrongpassword"
    }
    response = client.post("/auth/login", json=payload)
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]

if __name__ == "__main__":
    import sys
    # Run the tests programmatically
    sys.exit(pytest.main(["-v", __file__]))
