from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from backend.app.core.database import get_db
from backend.app.models.entities import User, Patient, MedicalDocument, LabResult, ExtractedRecord
from backend.app.schemas.schemas import LabResultCreate, LabResultUpdate, LabResultResponse
from backend.app.services.ocr_service import OCRService
from backend.app.api.deps import get_current_user, verify_patient_access, record_audit

router = APIRouter(prefix="/labs", tags=["Lab Report Intelligence"])

@router.get("/", response_model=List[LabResultResponse])
def list_lab_results(
    patient_id: str,
    test_name: Optional[str] = None,
    abnormal_only: Optional[bool] = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(patient_id, current_user, db, required_level="read")
    q = db.query(LabResult).filter(LabResult.patient_id == patient_id)
    if test_name:
        q = q.filter(LabResult.test_name.ilike(f"%{test_name}%"))
    if abnormal_only:
        q = q.filter(LabResult.is_abnormal == True)
    return q.order_by(LabResult.test_date.desc(), LabResult.created_at.desc()).all()

@router.post("/extract-from-document/{document_id}")
def extract_labs_from_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    verify_patient_access(doc.patient_id, current_user, db, required_level="read")

    # Parse text from document
    text = doc.original_text or ""
    if not text:
        text = OCRService.extract_text(doc.file_path, doc.mime_type)
        doc.original_text = text
        doc.ocr_status = "completed"
        db.commit()

    extracted = OCRService.parse_lab_parameters(text)
    return {
        "document_id": doc.id,
        "patient_id": doc.patient_id,
        "extracted_count": len(extracted),
        "results": extracted,
        "verification_gate_required": True,
        "guidance": "Please review extracted test names, values, and reference ranges before confirming into permanent health records."
    }

@router.post("/confirm-batch", response_model=List[LabResultResponse])
def confirm_batch_labs(
    items: List[LabResultCreate],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No lab items provided for confirmation")

    patient_id = items[0].patient_id
    verify_patient_access(patient_id, current_user, db, required_level="write")

    created = []
    for item in items:
        # Calculate numeric value if not set
        num_val = item.numeric_value
        if num_val is None:
            try:
                num_val = float(item.measured_value.replace(",", ""))
            except ValueError:
                num_val = None

        lab = LabResult(
            patient_id=patient_id,
            document_id=item.document_id,
            test_name=item.test_name,
            measured_value=item.measured_value,
            numeric_value=num_val,
            unit=item.unit,
            reference_range=item.reference_range,
            is_abnormal=item.is_abnormal,
            abnormal_flag=item.abnormal_flag or ("HIGH" if item.is_abnormal else "NORMAL"),
            test_date=item.test_date,
            lab_name=item.lab_name,
            verification_status="verified",
            notes=item.notes
        )
        db.add(lab)
        created.append(lab)

    db.commit()
    for l in created:
        db.refresh(l)

    record_audit(db, action="LAB_RESULTS_CONFIRMED", resource_type="lab_result", resource_id=patient_id, user_id=current_user.id, patient_id=patient_id, details={"count": len(created)})
    return created

@router.post("/", response_model=LabResultResponse)
def create_lab_result(
    lab_in: LabResultCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(lab_in.patient_id, current_user, db, required_level="write")

    num_val = lab_in.numeric_value
    if num_val is None:
        try:
            num_val = float(lab_in.measured_value.replace(",", ""))
        except ValueError:
            num_val = None

    lab = LabResult(
        patient_id=lab_in.patient_id,
        document_id=lab_in.document_id,
        test_name=lab_in.test_name,
        measured_value=lab_in.measured_value,
        numeric_value=num_val,
        unit=lab_in.unit,
        reference_range=lab_in.reference_range,
        is_abnormal=lab_in.is_abnormal,
        abnormal_flag=lab_in.abnormal_flag,
        test_date=lab_in.test_date,
        lab_name=lab_in.lab_name,
        verification_status="verified",
        notes=lab_in.notes
    )
    db.add(lab)
    db.commit()
    db.refresh(lab)
    record_audit(db, action="LAB_RESULT_CREATE", resource_type="lab_result", resource_id=lab.id, user_id=current_user.id, patient_id=lab.patient_id)
    return lab

@router.put("/{id}", response_model=LabResultResponse)
def update_lab_result(
    id: str,
    lab_in: LabResultUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    lab = db.query(LabResult).filter(LabResult.id == id).first()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab result not found")
    verify_patient_access(lab.patient_id, current_user, db, required_level="write")

    if lab_in.test_name is not None:
        lab.test_name = lab_in.test_name
    if lab_in.measured_value is not None:
        lab.measured_value = lab_in.measured_value
        try:
            lab.numeric_value = float(lab_in.measured_value.replace(",", ""))
        except ValueError:
            pass
    if lab_in.unit is not None:
        lab.unit = lab_in.unit
    if lab_in.reference_range is not None:
        lab.reference_range = lab_in.reference_range
    if lab_in.is_abnormal is not None:
        lab.is_abnormal = lab_in.is_abnormal
    if lab_in.abnormal_flag is not None:
        lab.abnormal_flag = lab_in.abnormal_flag
    if lab_in.verification_status is not None:
        lab.verification_status = lab_in.verification_status
    if lab_in.notes is not None:
        lab.notes = lab_in.notes

    db.commit()
    db.refresh(lab)
    record_audit(db, action="LAB_RESULT_UPDATE", resource_type="lab_result", resource_id=lab.id, user_id=current_user.id, patient_id=lab.patient_id)
    return lab
