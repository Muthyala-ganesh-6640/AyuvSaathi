from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.app.core.database import get_db
from backend.app.models.entities import User, Patient, PatientAccessPermission
from backend.app.schemas.schemas import PatientCreate, PatientResponse
from backend.app.api.deps import get_current_user, verify_patient_access, record_audit

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.get("/", response_model=List[PatientResponse])
def list_patients(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Return user's own patient profile plus any patients they have permissions for
    user_roles = [r.name for r in current_user.roles]
    if "admin" in user_roles or "doctor" in user_roles:
        return db.query(Patient).all()

    patients = []
    if current_user.patient_profile:
        patients.append(current_user.patient_profile)

    # Add shared patients
    perms = db.query(PatientAccessPermission).filter(PatientAccessPermission.user_id == current_user.id).all()
    for p in perms:
        if p.patient and p.patient not in patients:
            patients.append(p.patient)

    return patients

@router.get("/{id}", response_model=PatientResponse)
def get_patient(id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = verify_patient_access(id, current_user, db, required_level="read")
    record_audit(db, action="PATIENT_VIEW", resource_type="patient", resource_id=id, user_id=current_user.id, patient_id=id)
    return patient

@router.put("/{id}", response_model=PatientResponse)
def update_patient(id: str, patient_in: PatientCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = verify_patient_access(id, current_user, db, required_level="write")
    patient.full_name = patient_in.full_name
    patient.date_of_birth = patient_in.date_of_birth
    patient.gender = patient_in.gender
    patient.blood_group = patient_in.blood_group
    patient.phone = patient_in.phone
    patient.emergency_contact = patient_in.emergency_contact
    patient.address = patient_in.address
    db.commit()
    db.refresh(patient)
    record_audit(db, action="PATIENT_UPDATE", resource_type="patient", resource_id=id, user_id=current_user.id, patient_id=id)
    return patient
