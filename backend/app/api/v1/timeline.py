from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.core.database import get_db
from backend.app.models.entities import (
    User, Patient, MedicalDocument, LabResult, Prescription, TreatmentPlan, PatientMeasurement, ConversationSummary
)
from backend.app.api.deps import get_current_user, verify_patient_access

router = APIRouter(prefix="/timeline", tags=["Unified Medical Records Timeline"])

@router.get("/")
def get_unified_timeline(
    patient_id: str,
    category: Optional[str] = Query(None, description="Filter: all, lab, prescription, treatment, vital, conversation"),
    search: Optional[str] = Query(None, description="Keyword search"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_patient_access(patient_id, current_user, db, required_level="read")

    events = []

    # 1. Documents
    docs = db.query(MedicalDocument).filter(MedicalDocument.patient_id == patient_id).all()
    for d in docs:
        events.append({
            "id": f"doc-{d.id}",
            "type": "document",
            "category": d.category,
            "title": f"Document: {d.file_name}",
            "date": d.created_at.strftime("%Y-%m-%d"),
            "timestamp": d.created_at,
            "provenance": "source_document",
            "summary": f"Uploaded {d.category.replace('_', ' ').title()} ({round(d.file_size / 1024, 1)} KB)",
            "details": {"file_name": d.file_name, "mime": d.mime_type, "ocr_status": d.ocr_status},
            "document_id": d.id
        })

    # 2. Lab Results
    labs = db.query(LabResult).filter(LabResult.patient_id == patient_id).all()
    for l in labs:
        events.append({
            "id": f"lab-{l.id}",
            "type": "lab_result",
            "category": "laboratory",
            "title": f"Lab Test: {l.test_name}",
            "date": l.test_date or l.created_at.strftime("%Y-%m-%d"),
            "timestamp": l.created_at,
            "provenance": "clinician_confirmed" if l.verification_status == "verified" else "extracted_from_doc",
            "summary": f"{l.test_name}: {l.measured_value} {l.unit or ''} ({l.abnormal_flag or 'NORMAL'})",
            "details": {
                "test_name": l.test_name,
                "value": l.measured_value,
                "unit": l.unit,
                "range": l.reference_range,
                "is_abnormal": l.is_abnormal,
                "verification_status": l.verification_status
            },
            "document_id": l.document_id
        })

    # 3. Prescriptions
    prescs = db.query(Prescription).filter(Prescription.patient_id == patient_id).all()
    for p in prescs:
        med_summary = ", ".join([f"{it.medicine_name} ({it.dosage})" for it in p.items])
        events.append({
            "id": f"presc-{p.id}",
            "type": "prescription",
            "category": "prescription",
            "title": f"Prescription by {p.prescriber_name or 'Doctor'}",
            "date": p.prescription_date or p.created_at.strftime("%Y-%m-%d"),
            "timestamp": p.created_at,
            "provenance": "clinician_confirmed",
            "summary": f"Prescribed: {med_summary or 'Medication regimen'}",
            "details": {"prescriber": p.prescriber_name, "clinic": p.clinic_name, "items_count": len(p.items)},
            "document_id": p.document_id
        })

    # 4. Treatment Plans
    plans = db.query(TreatmentPlan).filter(TreatmentPlan.patient_id == patient_id).all()
    for pl in plans:
        events.append({
            "id": f"plan-{pl.id}",
            "type": "treatment_plan",
            "category": "treatment",
            "title": f"Care Plan: {pl.title}",
            "date": pl.start_date or pl.created_at.strftime("%Y-%m-%d"),
            "timestamp": pl.created_at,
            "provenance": "clinician_confirmed",
            "summary": f"Active Plan: {pl.indication_diagnosis or pl.title} (Status: {pl.status.title()})",
            "details": {"instructions": pl.treatment_instructions, "follow_up": pl.follow_up_date, "status": pl.status}
        })

    # 5. Measurements / Vitals
    vitals = db.query(PatientMeasurement).filter(PatientMeasurement.patient_id == patient_id).all()
    for v in vitals:
        events.append({
            "id": f"meas-{v.id}",
            "type": "vital",
            "category": "vital",
            "title": f"Measurement: {v.measurement_type.replace('_', ' ').title()}",
            "date": v.measured_at.strftime("%Y-%m-%d"),
            "timestamp": v.measured_at,
            "provenance": "patient_reported",
            "summary": f"{v.measurement_type.replace('_', ' ').title()}: {v.value} {v.unit}",
            "details": {"value": v.value, "unit": v.unit, "notes": v.notes}
        })

    # 6. Conversation Summaries
    summaries = db.query(ConversationSummary).filter(ConversationSummary.patient_id == patient_id).all()
    for s in summaries:
        events.append({
            "id": f"sum-{s.id}",
            "type": "conversation_summary",
            "category": "conversation",
            "title": f"Consultation Summary: {s.main_concern[:50]}",
            "date": s.created_at.strftime("%Y-%m-%d"),
            "timestamp": s.created_at,
            "provenance": "ai_generated_user_approved",
            "summary": f"Approved Summary: {s.main_concern}. Symptoms: {', '.join(s.reported_symptoms or [])}",
            "details": {"questions": s.questions_raised, "follow_up": s.follow_up_topics}
        })

    # Sort descending by timestamp / date
    events.sort(key=lambda x: str(x.get("date", "")), reverse=True)

    # Filter
    if category and category != "all":
        events = [e for e in events if e["category"] == category or e["type"] == category]

    if search:
        s_lower = search.lower()
        events = [e for e in events if s_lower in e["title"].lower() or s_lower in e["summary"].lower()]

    return {
        "patient_id": patient_id,
        "total_events": len(events),
        "events": events
    }
