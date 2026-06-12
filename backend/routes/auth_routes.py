from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
import auth

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    # Normalize email
    email_normalized = user_in.email.strip().lower()
    
    # Check if role is valid
    if user_in.role not in ["student", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be either 'student' or 'teacher'"
        )
        
    # Check if email is already registered
    existing_user = db.query(models.User).filter(models.User.email == email_normalized).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
        
    # Process student_id based on role
    student_id = None
    if user_in.role == "student":
        if not user_in.student_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student ID is required for student role"
            )
        student_id = user_in.student_id.strip()
        # Check if student_id is already registered
        existing_student = db.query(models.User).filter(models.User.student_id == student_id).first()
        if existing_student:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student ID already registered"
            )
            
    # Create the user
    new_user = models.User(
        name=user_in.name.strip(),
        email=email_normalized,
        password_hash=auth.get_password_hash(user_in.password),
        role=user_in.role,
        student_id=student_id
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=schemas.Token)
def login(login_in: schemas.UserLogin, db: Session = Depends(get_db)):
    email_normalized = login_in.email.strip().lower()
    
    user = db.query(models.User).filter(models.User.email == email_normalized).first()
    if not user or not auth.verify_password(login_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Generate token
    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    
    return schemas.Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        name=user.name,
        email=user.email
    )
