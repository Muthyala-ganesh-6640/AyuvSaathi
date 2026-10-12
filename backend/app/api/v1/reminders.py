from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from backend.app.core.database import get_db
from backend.app.models.entities import (
    User, Patient, MedicationSchedule, MedicationReminder, MedicationAdherenceLog, PrescriptionItem
)
from backend.app.schemas.schemas import (
    ScheduleCreate, ScheduleResponse, AdherenceLogCreate, AdherenceLogResponse
)
from backend.app.api.deps import get_current_user, verify_patient_access, record_audit

router = APIRouter(prefix="/reminders", tags=["Medicine Alarm & Reminders"])

@router.get("/schedules", response_model=List[ScheduleResponse])
def list_schedules(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(patient_id, current_user, db, required_level="read")
    return db.query(MedicationSchedule).filter(
        MedicationSchedule.patient_id == patient_id
    ).order_by(MedicationSchedule.created_at.desc()).all()

@router.post("/schedules", response_model=ScheduleResponse)
def create_schedule(
    sched_in: ScheduleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    patient = verify_patient_access(sched_in.patient_id, current_user, db, required_level="write")

    sched = MedicationSchedule(
        patient_id=patient.id,
        prescription_item_id=sched_in.prescription_item_id,
        medicine_name=sched_in.medicine_name,
        dosage=sched_in.dosage,
        times_per_day=sched_in.times_per_day,
        schedule_times=sched_in.schedule_times,
        timezone=sched_in.timezone or "Asia/Kolkata",
        start_date=sched_in.start_date,
        end_date=sched_in.end_date,
        is_active=True
    )
    db.add(sched)
    db.flush()

    # Pre-generate reminder slots for today
    for t in sched.schedule_times:
        reminder = MedicationReminder(
            schedule_id=sched.id,
            scheduled_time=t,
            reminder_text=f"Time to take {sched.medicine_name} ({sched.dosage}). Follow your confirmed prescription instructions.",
            status="scheduled"
        )
        db.add(reminder)

    db.commit()
    db.refresh(sched)
    record_audit(db, action="MEDICATION_SCHEDULE_CREATED", resource_type="medication_schedule", resource_id=sched.id, user_id=current_user.id, patient_id=patient.id)
    return sched

@router.get("/today")
def get_today_reminders(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(patient_id, current_user, db, required_level="read")
    schedules = db.query(MedicationSchedule).filter(
        MedicationSchedule.patient_id == patient_id,
        MedicationSchedule.is_active == True
    ).all()

    today_str = datetime.now().strftime("%Y-%m-%d")
    today_items = []
    for s in schedules:
        for t in s.schedule_times:
            # Check if logged today
            logged = db.query(MedicationAdherenceLog).filter(
                MedicationAdherenceLog.schedule_id == s.id,
                MedicationAdherenceLog.scheduled_time == t,
                MedicationAdherenceLog.logged_at >= datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
            ).first()

            today_items.append({
                "schedule_id": s.id,
                "medicine_name": s.medicine_name,
                "dosage": s.dosage,
                "scheduled_time": t,
                "status": logged.action if logged else "pending",
                "logged_at": logged.logged_at if logged else None
            })

    # Sort by time
    today_items.sort(key=lambda x: x["scheduled_time"])
    return {
        "date": today_str,
        "items": today_items,
        "total": len(today_items),
        "completed": len([i for i in today_items if i["status"] == "taken"])
    }

@router.post("/log-action", response_model=AdherenceLogResponse)
def log_reminder_action(
    log_in: AdherenceLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(log_in.patient_id, current_user, db, required_level="write")

    log = MedicationAdherenceLog(
        schedule_id=log_in.schedule_id,
        patient_id=log_in.patient_id,
        action=log_in.action.lower(),  # 'taken', 'snoozed', 'skipped', 'missed'
        scheduled_time=log_in.scheduled_time,
        notes=log_in.notes
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    record_audit(db, action=f"MEDICATION_ACTION_{log.action.upper()}", resource_type="medication_adherence_log", resource_id=log.id, user_id=current_user.id, patient_id=log_in.patient_id)
    return log

@router.get("/adherence-summary")
def get_adherence_summary(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(patient_id, current_user, db, required_level="read")
    logs = db.query(MedicationAdherenceLog).filter(MedicationAdherenceLog.patient_id == patient_id).all()

    total = len(logs)
    taken = len([l for l in logs if l.action == "taken"])
    skipped = len([l for l in logs if l.action == "skipped"])
    snoozed = len([l for l in logs if l.action == "snoozed"])
    missed = len([l for l in logs if l.action == "missed"])

    rate = round((taken / total * 100.0), 1) if total > 0 else 100.0

    return {
        "patient_id": patient_id,
        "total_logged": total,
        "taken": taken,
        "skipped": skipped,
        "snoozed": snoozed,
        "missed": missed,
        "adherence_percentage": rate
    }
