from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str  # "student" or "teacher"
    student_id: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str
    email: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

from datetime import date as date_type

class SubjectBase(BaseModel):
    name: str
    code: str

class SubjectCreate(SubjectBase):
    pass

class SubjectResponse(SubjectBase):
    id: int
    teacher_id: int

    class Config:
        from_attributes = True

class SessionStart(BaseModel):
    subject_id: int
    scan_interval_seconds: int = 15

class SessionStop(BaseModel):
    session_id: int

class SessionResponse(BaseModel):
    id: int
    subject_id: int
    teacher_id: int
    date: date_type
    start_time: datetime
    end_time: Optional[datetime] = None
    scan_interval_seconds: int
    status: str
    subject_name: Optional[str] = None

    class Config:
        from_attributes = True
