from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.core.database import get_db
from backend.app.models.entities import User, Prescription, PrescriptionItem, MedicalDocument
from backend.app.schemas.schemas import PrescriptionCreate, PrescriptionResponse
from backend.app.services.ocr_service import OCRService
from backend.app.api.deps import get_current_user, verify_patient_access, record_audit

router = APIRouter(prefix="/prescriptions", tags=["AI Prescription Analyzer"])

@router.get("/", response_model=List[PrescriptionResponse])
def list_prescriptions(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(patient_id, current_user, db, required_level="read")
    return db.query(Prescription).filter(Prescription.patient_id == patient_id).order_by(Prescription.created_at.desc()).all()

@router.post("/extract-from-document/{document_id}")
def extract_prescription_from_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    verify_patient_access(doc.patient_id, current_user, db, required_level="read")

    text = doc.original_text or ""
    if not text:
        text = OCRService.extract_text(doc.file_path, doc.mime_type)
        doc.original_text = text
        doc.ocr_status = "completed"
        db.commit()

    medicines = OCRService.parse_prescription_items(text)
    
    # Check for potential duplicates or interactions
    warnings = []
    med_names = [m["medicine_name"].lower() for m in medicines]
    if len(med_names) != len(set(med_names)):
        warnings.append("Potential duplicate active substance detected in prescription entries.")

    return {
        "document_id": doc.id,
        "patient_id": doc.patient_id,
        "extracted_medicines": medicines,
        "warnings": warnings,
        "verification_gate_required": True,
        "disclaimer": "AI extraction is an assistive reading tool. Please confirm medicine dosage with the original physical prescription or consulting doctor before initiating schedules."
    }

@router.post("/", response_model=PrescriptionResponse)
def create_prescription(
    presc_in: PrescriptionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(presc_in.patient_id, current_user, db, required_level="write")

    prescription = Prescription(
        patient_id=presc_in.patient_id,
        document_id=presc_in.document_id,
        prescriber_name=presc_in.prescriber_name,
        clinic_name=presc_in.clinic_name,
        prescription_date=presc_in.prescription_date,
        diagnosis_notes=presc_in.diagnosis_notes,
        verification_status="verified"
    )
    db.add(prescription)
    db.flush()

    for item in presc_in.items:
        pi = PrescriptionItem(
            prescription_id=prescription.id,
            medicine_name=item.medicine_name,
            dosage=item.dosage,
            route=item.route or "oral",
            frequency=item.frequency,
            duration=item.duration,
            instructions=item.instructions,
            start_date=item.start_date,
            end_date=item.end_date,
            is_verified=True
        )
        db.add(pi)

    db.commit()
    db.refresh(prescription)
    record_audit(db, action="PRESCRIPTION_CREATED", resource_type="prescription", resource_id=prescription.id, user_id=current_user.id, patient_id=presc_in.patient_id)
    return prescription

@router.put("/{id}/verify", response_model=PrescriptionResponse)
def verify_prescription(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prescription = db.query(Prescription).filter(Prescription.id == id).first()
    if not prescription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription not found")
    verify_patient_access(prescription.patient_id, current_user, db, required_level="write")

    prescription.verification_status = "verified"
    for item in prescription.items:
        item.is_verified = True

    db.commit()
    db.refresh(prescription)
    record_audit(db, action="PRESCRIPTION_VERIFIED", resource_type="prescription", resource_id=prescription.id, user_id=current_user.id, patient_id=prescription.patient_id)
    return prescription
