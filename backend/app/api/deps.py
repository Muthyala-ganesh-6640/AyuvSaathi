from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional
import json

from backend.app.core.database import get_db
from backend.app.core.security import decode_access_token
from backend.app.models.entities import User, Patient, PatientAccessPermission, AuditLog

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme),
    authorization: Optional[str] = Header(None)
) -> User:
    # Check header if oauth2_scheme didn't pick up
    jwt_token = token
    if not jwt_token and authorization and authorization.startswith("Bearer "):
        jwt_token = authorization.split(" ")[1]

    if not jwt_token:
        # Check if there is a demo user in local development, or raise 401
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(jwt_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user account")

    return user

def verify_patient_access(patient_id: str, current_user: User, db: Session, required_level: str = "read") -> Patient:
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")

    # If user owns the patient record
    if patient.user_id == current_user.id:
        return patient

    # Check user roles for admin or doctor
    user_roles = [r.name for r in current_user.roles]
    if "admin" in user_roles:
        return patient

    # Check explicit permissions table
    permission = db.query(PatientAccessPermission).filter(
        PatientAccessPermission.patient_id == patient_id,
        PatientAccessPermission.user_id == current_user.id
    ).first()

    if permission:
        if required_level == "write" and permission.permission_level not in ["write", "admin"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write permission denied for this patient")
        return patient

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: unauthorized to view this patient's records")

def record_audit(
    db: Session,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    user_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    details: Optional[dict] = None
):
    try:
        log = AuditLog(
            user_id=user_id,
            patient_id=patient_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {}
        )
        db.add(log)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Audit log error: {e}")
