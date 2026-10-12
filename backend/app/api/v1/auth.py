from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta

from backend.app.core.database import get_db
from backend.app.core.security import get_password_hash, verify_password, create_access_token
from backend.app.models.entities import User, Role, Patient
from backend.app.schemas.schemas import UserCreate, UserLogin, Token, UserResponse
from backend.app.api.deps import get_current_user, record_audit

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=Token)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists"
        )

    # Fetch or create role
    role_name = user_in.role or "patient"
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        role = Role(name=role_name, description=f"System {role_name} role")
        db.add(role)
        db.flush()

    # Create User
    new_user = User(
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        preferred_language=user_in.preferred_language or "en"
    )
    new_user.roles.append(role)
    db.add(new_user)
    db.flush()

    # Create associated Patient profile
    patient = Patient(
        user_id=new_user.id,
        full_name=new_user.full_name,
        abha_id=f"91-{str(abs(hash(new_user.email)))[:4]}-{str(abs(hash(new_user.full_name)))[:4]}-2026"
    )
    db.add(patient)
    db.commit()
    db.refresh(new_user)
    db.refresh(patient)

    record_audit(db, action="USER_REGISTER", resource_type="user", resource_id=new_user.id, user_id=new_user.id, patient_id=patient.id)

    access_token = create_access_token(data={"sub": new_user.id, "email": new_user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "full_name": new_user.full_name,
            "preferred_language": new_user.preferred_language,
            "patient_id": patient.id,
            "roles": [r.name for r in new_user.roles]
        }
    }

@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_in.email).first()
    if not user or not verify_password(login_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    patient_id = user.patient_profile.id if user.patient_profile else None
    record_audit(db, action="USER_LOGIN", resource_type="user", resource_id=user.id, user_id=user.id, patient_id=patient_id)

    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "preferred_language": user.preferred_language,
            "patient_id": patient_id,
            "roles": [r.name for r in user.roles]
        }
    }

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    patient_id = current_user.patient_profile.id if current_user.patient_profile else None
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "preferred_language": current_user.preferred_language,
        "patient_id": patient_id,
        "roles": [r.name for r in current_user.roles],
        "created_at": current_user.created_at
    }
