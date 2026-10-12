from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from backend.app.core.database import get_db
from backend.app.models.entities import (
    User, Patient, Conversation, ConversationMessage, ConversationSummary, LabResult, Prescription
)
from backend.app.schemas.schemas import (
    MessageCreate, ConversationResponse, ChatMessageResponse,
    SummaryDraftResponse, SummaryApproveRequest
)
from backend.app.services.ai_service import AIService
from backend.app.api.deps import get_current_user, verify_patient_access, record_audit

router = APIRouter(prefix="/conversations", tags=["AI Health Chatbot & Summaries"])

@router.get("/", response_model=List[ConversationResponse])
def list_conversations(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(patient_id, current_user, db, required_level="read")
    return db.query(Conversation).filter(Conversation.patient_id == patient_id).order_by(Conversation.updated_at.desc()).all()

@router.post("/", response_model=ConversationResponse)
def create_conversation(
    patient_id: str,
    title: Optional[str] = "Health Consultation",
    language: Optional[str] = "en",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    patient = verify_patient_access(patient_id, current_user, db, required_level="write")

    conv = Conversation(
        patient_id=patient.id,
        user_id=current_user.id,
        title=title or "Health Consultation",
        language=language or "en"
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    # Initial greeting in selected language
    greeting = (
        "నమస్కారం! నేను ఆయువ్ సాథీ AI సహాయకుడిని. మీ ధృవీకరించిన ల్యాబ్ నివేదికలు మరియు మందుల ఆధారంగా సహాయం చేయడానికి సిద్ధంగా ఉన్నాను. మీరు ఏమి తెలుసుకోవాలనుకుంటున్నారు?"
        if language == "te" else
        "Hello! I am your AyuvSaathi Health Assistant. I am here to help you understand your verified lab reports and medication schedules safely. How can I support you today?"
    )
    welcome_msg = ConversationMessage(
        conversation_id=conv.id,
        role="assistant",
        content=greeting,
        source_references=["AyuvSaathi Healthcare Platform"]
    )
    db.add(welcome_msg)
    db.commit()

    return conv

@router.get("/{id}/messages", response_model=List[ChatMessageResponse])
def get_messages(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(Conversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    verify_patient_access(conv.patient_id, current_user, db, required_level="read")
    return db.query(ConversationMessage).filter(ConversationMessage.conversation_id == id).order_by(ConversationMessage.created_at.asc()).all()

@router.post("/{id}/messages", response_model=ChatMessageResponse)
def send_message(
    id: str,
    msg_in: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(Conversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    patient = verify_patient_access(conv.patient_id, current_user, db, required_level="write")

    # Save user message
    user_msg = ConversationMessage(
        conversation_id=conv.id,
        role="user",
        content=msg_in.content
    )
    db.add(user_msg)
    db.flush()

    # Fetch patient's verified context
    verified_labs_raw = db.query(LabResult).filter(
        LabResult.patient_id == patient.id,
        LabResult.verification_status == "verified"
    ).all()
    verified_labs = [{"test_name": l.test_name, "measured_value": l.measured_value, "unit": l.unit, "is_abnormal": l.is_abnormal, "abnormal_flag": l.abnormal_flag} for l in verified_labs_raw]

    prescriptions = db.query(Prescription).filter(Prescription.patient_id == patient.id).all()
    active_meds = [f"{it.medicine_name} {it.dosage}" for p in prescriptions for it in p.items]

    # Call AI service with language
    lang = msg_in.language or conv.language or "en"
    ai_reply = AIService.answer_health_query(
        query=msg_in.content,
        language=lang,
        verified_labs=verified_labs,
        active_meds=active_meds
    )

    assistant_msg = ConversationMessage(
        conversation_id=conv.id,
        role="assistant",
        content=ai_reply["content"],
        source_references=ai_reply.get("source_references", [])
    )
    db.add(assistant_msg)
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(assistant_msg)

    return assistant_msg

@router.get("/{id}/summary-draft", response_model=SummaryDraftResponse)
def get_summary_draft(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(Conversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    verify_patient_access(conv.patient_id, current_user, db, required_level="read")

    messages = db.query(ConversationMessage).filter(ConversationMessage.conversation_id == id).order_by(ConversationMessage.created_at.asc()).all()
    msg_dicts = [{"role": m.role, "content": m.content} for m in messages]

    draft = AIService.generate_conversation_summary(conversation_title=conv.title, messages=msg_dicts)
    return draft

@router.post("/{id}/approve-summary")
def approve_summary(
    id: str,
    req: SummaryApproveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(Conversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    patient = verify_patient_access(conv.patient_id, current_user, db, required_level="write")

    summary = ConversationSummary(
        conversation_id=conv.id,
        patient_id=patient.id,
        main_concern=req.main_concern,
        reported_symptoms=req.reported_symptoms,
        reported_dates_duration=req.reported_dates_duration,
        relevant_record_refs=req.relevant_record_refs,
        questions_raised=req.questions_raised,
        follow_up_topics=req.follow_up_topics,
        uncertainties=req.uncertainties,
        user_approved=True,
        approved_at=datetime.now(timezone.utc)
    )
    db.add(summary)
    db.commit()
    db.refresh(summary)

    record_audit(db, action="CONVERSATION_SUMMARY_SAVED", resource_type="conversation_summary", resource_id=summary.id, user_id=current_user.id, patient_id=patient.id)
    return {"message": "Conversation summary successfully approved and saved to health records", "summary_id": summary.id}
