from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from backend.app.core.database import get_db
from backend.app.models.entities import User, AuditLog
from backend.app.api.deps import get_current_user, verify_patient_access

router = APIRouter(prefix="/audit", tags=["Security & Audit Logs"])

@router.get("/")
def get_audit_trail(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(patient_id, current_user, db, required_level="read")
    logs = db.query(AuditLog).filter(
        AuditLog.patient_id == patient_id
    ).order_by(AuditLog.created_at.desc()).limit(100).all()

    return [
        {
            "id": l.id,
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "details": l.details,
            "created_at": l.created_at
        }
        for l in logs
    ]
