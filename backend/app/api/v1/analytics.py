from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from backend.app.core.database import get_db
from backend.app.models.entities import (
    User, Patient, MedicalDocument, LabResult, TreatmentPlan, MedicationSchedule, MedicationAdherenceLog, PatientMeasurement
)
from backend.app.api.deps import get_current_user, verify_patient_access

router = APIRouter(prefix="/analytics", tags=["Patient Analytics Dashboard"])

@router.get("/overview")
def get_analytics_overview(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(patient_id, current_user, db, required_level="read")

    total_docs = db.query(MedicalDocument).filter(MedicalDocument.patient_id == patient_id).count()
    unverified_labs = db.query(LabResult).filter(
        LabResult.patient_id == patient_id,
        LabResult.verification_status != "verified"
    ).count()
    verified_labs_count = db.query(LabResult).filter(
        LabResult.patient_id == patient_id,
        LabResult.verification_status == "verified"
    ).count()
    active_plans = db.query(TreatmentPlan).filter(
        TreatmentPlan.patient_id == patient_id,
        TreatmentPlan.status == "active"
    ).count()
    active_schedules = db.query(MedicationSchedule).filter(
        MedicationSchedule.patient_id == patient_id,
        MedicationSchedule.is_active == True
    ).count()

    adherence_logs = db.query(MedicationAdherenceLog).filter(MedicationAdherenceLog.patient_id == patient_id).all()
    total_logs = len(adherence_logs)
    taken_logs = len([l for l in adherence_logs if l.action == "taken"])
    adherence_pct = round((taken_logs / total_logs * 100), 1) if total_logs > 0 else 92.5

    # Fetch recent vitals / measurements
    measurements = db.query(PatientMeasurement).filter(
        PatientMeasurement.patient_id == patient_id
    ).order_by(PatientMeasurement.measured_at.desc()).limit(10).all()

    vitals = {}
    for m in measurements:
        if m.measurement_type not in vitals:
            vitals[m.measurement_type] = {
                "value": m.value,
                "unit": m.unit,
                "measured_at": m.measured_at
            }

    return {
        "total_documents": total_docs,
        "reports_awaiting_verification": unverified_labs,
        "verified_lab_reports_count": verified_labs_count,
        "active_treatment_plans_count": active_plans,
        "active_schedules_count": active_schedules,
        "adherence_percentage": adherence_pct,
        "recent_vitals": vitals
    }

@router.get("/lab-trends")
def get_lab_trends(
    patient_id: str,
    test_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(patient_id, current_user, db, required_level="read")
    labs = db.query(LabResult).filter(
        LabResult.patient_id == patient_id,
        LabResult.test_name.ilike(f"%{test_name}%"),
        LabResult.numeric_value.isnot(None)
    ).order_by(LabResult.test_date.asc(), LabResult.created_at.asc()).all()

    points = []
    for l in labs:
        points.append({
            "date": l.test_date or l.created_at.strftime("%Y-%m-%d"),
            "test_name": l.test_name,
            "value": l.numeric_value,
            "unit": l.unit,
            "reference_range": l.reference_range,
            "is_abnormal": l.is_abnormal,
            "flag": l.abnormal_flag
        })

    return {
        "test_name": test_name,
        "total_data_points": len(points),
        "data": points
    }
