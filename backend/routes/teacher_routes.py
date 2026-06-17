from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from datetime import datetime, timezone, date as date_type
from typing import Optional

from database import get_db
import models
import schemas
import auth
import face_utils

router = APIRouter(tags=["teacher"])

# Subject Routes

@router.post("/subjects/", response_model=schemas.SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    subject_in: schemas.SubjectCreate,
    current_user: models.User = Depends(auth.require_role(["teacher"])),
    db: Session = Depends(get_db)
):
    # Check if subject code already exists
    existing = db.query(models.Subject).filter(models.Subject.code == subject_in.code.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject code already exists"
        )
        
    new_subject = models.Subject(
        name=subject_in.name.strip(),
        code=subject_in.code.strip(),
        teacher_id=current_user.id
    )
    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)
    return new_subject

@router.get("/subjects/", response_model=list[schemas.SubjectResponse])
def list_subjects(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # If the user is a teacher, show their subjects. If student, show all subjects.
    if current_user.role == "teacher":
        return db.query(models.Subject).filter(models.Subject.teacher_id == current_user.id).all()
    return db.query(models.Subject).all()

# Session Routes

@router.post("/sessions/start")
def start_session(
    session_start: schemas.SessionStart,
    current_user: models.User = Depends(auth.require_role(["teacher"])),
    db: Session = Depends(get_db)
):
    # Verify subject exists and belongs to the teacher
    subject = db.query(models.Subject).filter(
        models.Subject.id == session_start.subject_id,
        models.Subject.teacher_id == current_user.id
    ).first()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found or does not belong to you"
        )
        
    # Check if there is already an active session for this teacher
    active_session = db.query(models.Session).filter(
        models.Session.teacher_id == current_user.id,
        models.Session.status == "active"
    ).first()
    if active_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An active session already exists for this teacher"
        )
        
    new_session = models.Session(
        subject_id=session_start.subject_id,
        teacher_id=current_user.id,
        date=datetime.now(timezone.utc).date(),
        start_time=datetime.now(timezone.utc),
        scan_interval_seconds=session_start.scan_interval_seconds,
        status="active"
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return {"session_id": new_session.id}

@router.post("/sessions/stop")
def stop_session(
    session_stop: schemas.SessionStop,
    current_user: models.User = Depends(auth.require_role(["teacher"])),
    db: Session = Depends(get_db)
):
    # Find active session
    session = db.query(models.Session).filter(
        models.Session.id == session_stop.session_id,
        models.Session.teacher_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
        
    if session.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session has already been stopped"
        )
        
    session.end_time = datetime.now(timezone.utc)
    session.status = "completed"
    db.commit()
    
    # Trigger final attendance computation
    face_utils.compute_attendance(session.id, db)
    
    return {"status": "success", "message": "Session stopped and attendance computed"}

@router.get("/sessions/active", response_model=Optional[schemas.SessionResponse])
def get_active_session(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Find any active session. If current user is teacher, check theirs, else check globally active
    query = db.query(models.Session).filter(models.Session.status == "active")
    if current_user.role == "teacher":
        query = query.filter(models.Session.teacher_id == current_user.id)
        
    session = query.first()
    if not session:
        return None
        
    return schemas.SessionResponse(
        id=session.id,
        subject_id=session.subject_id,
        teacher_id=session.teacher_id,
        date=session.date,
        start_time=session.start_time,
        end_time=session.end_time,
        scan_interval_seconds=session.scan_interval_seconds,
        status=session.status,
        subject_name=session.subject.name
    )

@router.get("/sessions/", response_model=list[schemas.SessionResponse])
def list_sessions(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # If teacher, list all their sessions. If student, list all sessions
    query = db.query(models.Session)
    if current_user.role == "teacher":
        query = query.filter(models.Session.teacher_id == current_user.id)
        
    sessions = query.order_by(models.Session.start_time.desc()).all()
    
    # Map to schemas including subject name
    response_list = []
    for s in sessions:
        response_list.append(
            schemas.SessionResponse(
                id=s.id,
                subject_id=s.subject_id,
                teacher_id=s.teacher_id,
                date=s.date,
                start_time=s.start_time,
                end_time=s.end_time,
                scan_interval_seconds=s.scan_interval_seconds,
                status=s.status,
                subject_name=s.subject.name
            )
        )
    return response_list

# Live Scan Endpoint

@router.post("/sessions/{session_id}/scan")
async def scan_session_frame(
    session_id: int,
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.require_role(["teacher"])),
    db: Session = Depends(get_db)
):
    # Verify session exists
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
        
    # Verify owner
    if session.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the teacher who owns the session can trigger a scan"
        )
        
    # Verify session status is active
    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is not active"
        )
        
    # Read the image frame bytes
    try:
        frame_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read frame: {str(e)}"
        )
        
    # Load all face encodings
    known_encodings = face_utils.load_all_encodings(db)
    
    # Find matches
    matches = face_utils.find_matches(frame_bytes, known_encodings)
    matches_dict = {user_id: confidence for user_id, confidence in matches}
    
    # Determine scan number (scan_number = last_scan_number + 1)
    last_scan = db.query(models.Scan).filter(
        models.Scan.session_id == session_id
    ).order_by(models.Scan.scan_number.desc()).first()
    scan_number = (last_scan.scan_number + 1) if last_scan else 1
    
    # Create Scan record
    new_scan = models.Scan(
        session_id=session_id,
        scan_number=scan_number,
        scanned_at=datetime.now(timezone.utc)
    )
    db.add(new_scan)
    db.flush()  # Populates new_scan.id
    
    # Create ScanResult records for every registered student
    students = db.query(models.User).filter(models.User.role == "student").all()
    results_list = []
    
    for student in students:
        detected = student.id in matches_dict
        confidence = matches_dict[student.id] if detected else 0.0
        
        scan_result = models.ScanResult(
            scan_id=new_scan.id,
            student_id=student.id,
            detected=detected,
            confidence=confidence
        )
        db.add(scan_result)
        
        results_list.append({
            "student_id": student.student_id,
            "student_name": student.name,
            "detected": detected,
            "confidence": confidence
        })
        
    db.commit()
    return results_list
