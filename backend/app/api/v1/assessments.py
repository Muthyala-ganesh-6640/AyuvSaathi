from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.app.core.database import get_db
from backend.app.models.entities import User, Patient, LabResult, Prescription, AIAssessment
from backend.app.schemas.schemas import AssessmentRequest, AssessmentResponse
from backend.app.services.ai_service import AIService
from backend.app.api.deps import get_current_user, verify_patient_access, record_audit

router = APIRouter(prefix="/assessments", tags=["AI Diagnosis Support"])

@router.get("/", response_model=List[AssessmentResponse])
def list_assessments(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(patient_id, current_user, db, required_level="read")
    return db.query(AIAssessment).filter(AIAssessment.patient_id == patient_id).order_by(AIAssessment.created_at.desc()).all()

@router.post("/", response_model=AssessmentResponse)
def create_assessment(
    req: AssessmentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    patient = verify_patient_access(req.patient_id, current_user, db, required_level="write")

    # Fetch patient's verified lab records
    verified_labs_raw = db.query(LabResult).filter(
        LabResult.patient_id == req.patient_id,
        LabResult.verification_status == "verified"
    ).all()
    verified_labs = [
        {
            "test_name": l.test_name,
            "measured_value": l.measured_value,
            "unit": l.unit,
            "reference_range": l.reference_range,
            "is_abnormal": l.is_abnormal,
            "abnormal_flag": l.abnormal_flag
        }
        for l in verified_labs_raw
    ]

    # Fetch active prescriptions
    prescriptions = db.query(Prescription).filter(
        Prescription.patient_id == req.patient_id
    ).all()
    active_meds = []
    for p in prescriptions:
        for it in p.items:
            active_meds.append(f"{it.medicine_name} {it.dosage}")

    # Generate cautious clinical assessment
    res = AIService.generate_clinical_assessment(
        patient_name=patient.full_name,
        symptoms=req.symptoms,
        duration=req.duration,
        verified_labs=verified_labs,
        active_meds=active_meds
    )

    assessment = AIAssessment(
        patient_id=patient.id,
        reported_concerns=res["reported_concerns"],
        relevant_findings=res["relevant_findings"],
        clinical_discussion_topics=res["clinical_discussion_topics"],
        missing_info_uncertainties=res["missing_info_uncertainties"],
        doctor_questions=res["doctor_questions"],
        urgency_level=res["urgency_level"],
        disclaimer=res["disclaimer"],
        source_references=res["source_references"]
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    record_audit(db, action="AI_ASSESSMENT_GENERATED", resource_type="ai_assessment", resource_id=assessment.id, user_id=current_user.id, patient_id=patient.id)
    return assessment
