from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.app.core.database import get_db
from backend.app.models.entities import User, TreatmentPlan, TreatmentPlanEvent
from backend.app.schemas.schemas import TreatmentPlanCreate, TreatmentPlanUpdate, TreatmentPlanResponse
from backend.app.api.deps import get_current_user, verify_patient_access, record_audit

router = APIRouter(prefix="/treatment-plans", tags=["Treatment Plan Management"])

@router.get("/", response_model=List[TreatmentPlanResponse])
def list_treatment_plans(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(patient_id, current_user, db, required_level="read")
    return db.query(TreatmentPlan).filter(TreatmentPlan.patient_id == patient_id).order_by(TreatmentPlan.created_at.desc()).all()

@router.get("/{id}", response_model=TreatmentPlanResponse)
def get_treatment_plan(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    plan = db.query(TreatmentPlan).filter(TreatmentPlan.id == id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Treatment plan not found")
    verify_patient_access(plan.patient_id, current_user, db, required_level="read")
    return plan

@router.post("/", response_model=TreatmentPlanResponse)
def create_treatment_plan(
    plan_in: TreatmentPlanCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(plan_in.patient_id, current_user, db, required_level="write")

    plan = TreatmentPlan(
        patient_id=plan_in.patient_id,
        title=plan_in.title,
        indication_diagnosis=plan_in.indication_diagnosis,
        treatment_instructions=plan_in.treatment_instructions,
        clinician_name=plan_in.clinician_name,
        start_date=plan_in.start_date,
        end_date=plan_in.end_date,
        follow_up_date=plan_in.follow_up_date,
        status=plan_in.status or "active",
        approval_status="clinician_confirmed"
    )
    db.add(plan)
    db.flush()

    event = TreatmentPlanEvent(
        treatment_plan_id=plan.id,
        event_type="created",
        description=f"Initial care plan established by {plan.clinician_name or 'physician'}: {plan.title}",
        created_by=current_user.full_name
    )
    db.add(event)
    db.commit()
    db.refresh(plan)

    record_audit(db, action="TREATMENT_PLAN_CREATED", resource_type="treatment_plan", resource_id=plan.id, user_id=current_user.id, patient_id=plan_in.patient_id)
    return plan

@router.put("/{id}", response_model=TreatmentPlanResponse)
def update_treatment_plan(
    id: str,
    update_in: TreatmentPlanUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    plan = db.query(TreatmentPlan).filter(TreatmentPlan.id == id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Treatment plan not found")
    verify_patient_access(plan.patient_id, current_user, db, required_level="write")

    changes = []
    if update_in.title is not None and update_in.title != plan.title:
        changes.append(f"Title changed to '{update_in.title}'")
        plan.title = update_in.title
    if update_in.status is not None and update_in.status != plan.status:
        changes.append(f"Status changed from '{plan.status}' to '{update_in.status}'")
        plan.status = update_in.status
    if update_in.treatment_instructions is not None:
        plan.treatment_instructions = update_in.treatment_instructions
    if update_in.follow_up_date is not None:
        plan.follow_up_date = update_in.follow_up_date
        changes.append(f"Follow-up date scheduled for {update_in.follow_up_date}")

    note_text = update_in.event_note or (", ".join(changes) if changes else "Treatment plan updated")
    event = TreatmentPlanEvent(
        treatment_plan_id=plan.id,
        event_type="modified",
        description=note_text,
        created_by=current_user.full_name
    )
    db.add(event)
    db.commit()
    db.refresh(plan)

    record_audit(db, action="TREATMENT_PLAN_UPDATED", resource_type="treatment_plan", resource_id=plan.id, user_id=current_user.id, patient_id=plan.patient_id)
    return plan
