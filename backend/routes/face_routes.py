from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import os

from database import get_db
import models
import auth
import face_utils

router = APIRouter(prefix="/face", tags=["face"])

@router.post("/upload")
async def upload_face_photos(
    files: list[UploadFile] = File(...),
    current_user: models.User = Depends(auth.require_role(["student"])),
    db: Session = Depends(get_db)
):
    if len(files) != 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Exactly 5 images are required for registration. Received {len(files)}."
        )
        
    image_bytes_list = []
    for file in files:
        content = await file.read()
        image_bytes_list.append(content)
        
    try:
        avg_encoding = face_utils.encode_faces(image_bytes_list)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
        
    # Save the encoding directly in the database as a binary blob
    face_utils.save_encoding(db, current_user.id, avg_encoding, len(files))
    
    return {"status": "success", "message": "Face registration successful"}

@router.get("/status")
def get_face_status(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    existing_encoding = db.query(models.FaceEncoding).filter(models.FaceEncoding.user_id == current_user.id).first()
    return {"registered": existing_encoding is not None}
