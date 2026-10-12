from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

from backend.app.core.database import get_db
from backend.app.models.entities import User, Patient, PatientConsent
from backend.app.schemas.schemas import ConsentCreate, ConsentResponse
from backend.app.api.deps import get_current_user, verify_patient_access, record_audit

router = APIRouter(prefix="/consent", tags=["Patient Consent & Privacy"])

@router.get("/", response_model=List[ConsentResponse])
def get_consents(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(patient_id, current_user, db, required_level="read")
    return db.query(PatientConsent).filter(PatientConsent.patient_id == patient_id).all()

@router.post("/", response_model=ConsentResponse)
def grant_or_update_consent(
    consent_in: ConsentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(consent_in.patient_id, current_user, db, required_level="write")

    existing = db.query(PatientConsent).filter(
        PatientConsent.patient_id == consent_in.patient_id,
        PatientConsent.purpose == consent_in.purpose
    ).first()

    if existing:
        existing.consent_given = consent_in.consent_given
        existing.ai_processing_allowed = consent_in.ai_processing_allowed
        if not consent_in.consent_given:
            existing.revoked_at = datetime.now(timezone.utc)
        else:
            existing.revoked_at = None
        db.commit()
        db.refresh(existing)
        target = existing
    else:
        new_c = PatientConsent(
            patient_id=consent_in.patient_id,
            purpose=consent_in.purpose,
            consent_given=consent_in.consent_given,
            ai_processing_allowed=consent_in.ai_processing_allowed
        )
        db.add(new_c)
        db.commit()
        db.refresh(new_c)
        target = new_c

    record_audit(db, action="CONSENT_UPDATED", resource_type="patient_consent", resource_id=target.id, user_id=current_user.id, patient_id=consent_in.patient_id)
    return target
