import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.models.entities import User, Patient, MedicalDocument, ExtractedRecord
from backend.app.schemas.schemas import DocumentResponse
from backend.app.services.ocr_service import OCRService
from backend.app.api.deps import get_current_user, verify_patient_access, record_audit

router = APIRouter(prefix="/documents", tags=["Medical Documents"])

ALLOWED_MIMES = {
    "application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"
}

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    patient_id: str = Form(...),
    category: str = Form("lab_report"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    patient = verify_patient_access(patient_id, current_user, db, required_level="write")

    mime = file.content_type or "application/octet-stream"
    if mime.lower() not in ALLOWED_MIMES and not file.filename.lower().endswith(('.pdf', '.jpg', '.jpeg', '.png')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format: {mime}. Please upload PDF, JPG, or PNG."
        )

    # Save to disk
    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}_{file.filename.replace(' ', '_')}"
    target_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(target_path)
    if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
        os.remove(target_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum permitted limit (15 MB)."
        )

    # Perform OCR / text extraction
    ocr_text = OCRService.extract_text(target_path, mime)
    ocr_status = "completed" if ocr_text else "extracted_empty"

    doc = MedicalDocument(
        id=file_id,
        patient_id=patient.id,
        category=category,
        file_name=file.filename,
        file_path=target_path,
        mime_type=mime,
        file_size=file_size,
        upload_status="uploaded",
        ocr_status=ocr_status,
        original_text=ocr_text
    )
    db.add(doc)
    db.flush()

    # Pre-extract structured fields if lab report or prescription
    raw_extracted = {}
    if category == "lab_report":
        raw_extracted["labs"] = OCRService.parse_lab_parameters(ocr_text)
    elif category == "prescription":
        raw_extracted["medicines"] = OCRService.parse_prescription_items(ocr_text)

    record = ExtractedRecord(
        document_id=doc.id,
        raw_json=raw_extracted,
        confidence_score=0.92 if ocr_text else 0.50,
        status="pending_review"
    )
    db.add(record)
    db.commit()
    db.refresh(doc)

    record_audit(db, action="DOCUMENT_UPLOAD", resource_type="medical_document", resource_id=doc.id, user_id=current_user.id, patient_id=patient.id)

    return doc

@router.get("/", response_model=List[DocumentResponse])
def list_documents(
    patient_id: str,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(patient_id, current_user, db, required_level="read")
    q = db.query(MedicalDocument).filter(MedicalDocument.patient_id == patient_id)
    if category:
        q = q.filter(MedicalDocument.category == category)
    return q.order_by(MedicalDocument.created_at.desc()).all()

@router.get("/{id}", response_model=DocumentResponse)
def get_document(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    verify_patient_access(doc.patient_id, current_user, db, required_level="read")
    return doc

@router.get("/{id}/download")
def download_document(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    verify_patient_access(doc.patient_id, current_user, db, required_level="read")

    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File content not found on server")

    record_audit(db, action="DOCUMENT_DOWNLOAD", resource_type="medical_document", resource_id=doc.id, user_id=current_user.id, patient_id=doc.patient_id)
    return FileResponse(doc.file_path, media_type=doc.mime_type, filename=doc.file_name)
