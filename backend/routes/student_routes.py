from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from database import get_db
import models
import auth

router = APIRouter(tags=["student"])


@router.get("/attendance/student", response_model=List[Dict[str, Any]])
def get_student_attendance(
    current_user: models.User = Depends(auth.require_role(["student"])),
    db: Session = Depends(get_db),
):
    """
    Returns the logged-in student's attendance records grouped by subject.
    Each subject entry contains a list of sessions with date and status.

    Response shape:
    [
        {
            "subject_id": 1,
            "subject_name": "Data Structures",
            "subject_code": "CS301",
            "sessions": [
                {
                    "session_id": 5,
                    "date": "2026-06-12",
                    "status": "present"   # or "absent"
                }
            ]
        }
    ]
    """
    # Fetch all attendance records for this student, eagerly joining session + subject
    attendance_records = (
        db.query(models.Attendance)
        .join(models.Session, models.Attendance.session_id == models.Session.id)
        .join(models.Subject, models.Session.subject_id == models.Subject.id)
        .filter(models.Attendance.student_id == current_user.id)
        .order_by(models.Session.date.asc())
        .all()
    )

    # If no records exist yet, return empty list (not an error)
    if not attendance_records:
        return []

    # Group by subject
    subjects_map: Dict[int, Dict[str, Any]] = {}
    for att in attendance_records:
        session = att.session
        subject = session.subject
        subj_id = subject.id

        if subj_id not in subjects_map:
            subjects_map[subj_id] = {
                "subject_id": subj_id,
                "subject_name": subject.name,
                "subject_code": subject.code,
                "sessions": [],
            }

        subjects_map[subj_id]["sessions"].append(
            {
                "session_id": session.id,
                "date": str(session.date),  # ISO format: YYYY-MM-DD
                "status": att.status,
            }
        )

    return list(subjects_map.values())
