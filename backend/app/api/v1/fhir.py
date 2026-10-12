from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.entities import User, Patient, LabResult, PrescriptionItem, TreatmentPlan
from backend.app.services.fhir_service import FHIRService
from backend.app.api.deps import get_current_user, verify_patient_access, record_audit

router = APIRouter(prefix="/fhir", tags=["FHIR Interoperability"])

@router.get("/Patient/{patient_id}")
def get_fhir_patient(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    patient = verify_patient_access(patient_id, current_user, db, required_level="read")
    return FHIRService.map_patient(patient)

@router.get("/patient/{patient_id}/bundle")
def get_fhir_patient_bundle(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    patient = verify_patient_access(patient_id, current_user, db, required_level="read")

    labs = db.query(LabResult).filter(LabResult.patient_id == patient_id).all()
    meds = db.query(PrescriptionItem).join(PrescriptionItem.prescription).filter(
        PrescriptionItem.prescription.has(patient_id=patient_id)
    ).all()
    plans = db.query(TreatmentPlan).filter(TreatmentPlan.patient_id == patient_id).all()

    bundle = FHIRService.generate_patient_bundle(patient, labs, meds, plans)
    record_audit(db, action="FHIR_BUNDLE_EXPORT", resource_type="fhir_bundle", resource_id=patient_id, user_id=current_user.id, patient_id=patient_id)
    return bundle
