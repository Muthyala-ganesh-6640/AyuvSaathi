import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, Enum, JSON, Table, Index
)
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

def gen_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

# 3. user_roles association table
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", String(36), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)

# 1. users
class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    preferred_language = Column(String(10), default="en", nullable=False)  # 'en', 'te', 'hi'
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    roles = relationship("Role", secondary=user_roles, back_populates="users")
    patient_profile = relationship("Patient", back_populates="user", uselist=False)
    audit_logs = relationship("AuditLog", back_populates="user")

# 2. roles
class Role(Base):
    __tablename__ = "roles"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(50), unique=True, nullable=False)  # 'patient', 'doctor', 'caregiver', 'admin'
    description = Column(String(255), nullable=True)

    users = relationship("User", secondary=user_roles, back_populates="roles")

# 4. patients
class Patient(Base):
    __tablename__ = "patients"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, unique=True, index=True)
    full_name = Column(String(255), nullable=False)
    date_of_birth = Column(String(20), nullable=True)
    gender = Column(String(20), nullable=True)
    blood_group = Column(String(10), nullable=True)
    abha_id = Column(String(50), nullable=True, index=True)  # Demo ABHA mock ID e.g. 91-1234-5678-9012
    phone = Column(String(20), nullable=True)
    emergency_contact = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="patient_profile")
    documents = relationship("MedicalDocument", back_populates="patient", cascade="all, delete-orphan")
    lab_results = relationship("LabResult", back_populates="patient", cascade="all, delete-orphan")
    prescriptions = relationship("Prescription", back_populates="patient", cascade="all, delete-orphan")
    treatment_plans = relationship("TreatmentPlan", back_populates="patient", cascade="all, delete-orphan")
    measurements = relationship("PatientMeasurement", back_populates="patient", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="patient", cascade="all, delete-orphan")
    ai_assessments = relationship("AIAssessment", back_populates="patient", cascade="all, delete-orphan")
    schedules = relationship("MedicationSchedule", back_populates="patient", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")
    consents = relationship("PatientConsent", back_populates="patient", cascade="all, delete-orphan")
    permissions = relationship("PatientAccessPermission", back_populates="patient", cascade="all, delete-orphan")

# 5. patient_access_permissions
class PatientAccessPermission(Base):
    __tablename__ = "patient_access_permissions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_level = Column(String(50), default="read", nullable=False)  # 'read', 'write', 'admin'
    granted_at = Column(DateTime, default=utc_now, nullable=False)
    expires_at = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="permissions")

# 6. patient_consents
class PatientConsent(Base):
    __tablename__ = "patient_consents"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    purpose = Column(String(255), nullable=False)
    consent_given = Column(Boolean, default=True, nullable=False)
    ai_processing_allowed = Column(Boolean, default=True, nullable=False)
    consent_date = Column(DateTime, default=utc_now, nullable=False)
    revoked_at = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="consents")

# 7. medical_documents
class MedicalDocument(Base):
    __tablename__ = "medical_documents"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False, index=True)  # 'lab_report', 'prescription', 'discharge_summary', 'imaging', 'other'
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)
    upload_status = Column(String(50), default="uploaded", nullable=False)
    ocr_status = Column(String(50), default="pending", nullable=False)  # 'pending', 'processing', 'completed', 'failed'
    original_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)

    patient = relationship("Patient", back_populates="documents")
    extracted_records = relationship("ExtractedRecord", back_populates="document", cascade="all, delete-orphan")
    lab_results = relationship("LabResult", back_populates="document")
    prescriptions = relationship("Prescription", back_populates="document")

# 8. extracted_records
class ExtractedRecord(Base):
    __tablename__ = "extracted_records"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    document_id = Column(String(36), ForeignKey("medical_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    raw_json = Column(JSON, nullable=False)
    confidence_score = Column(Float, nullable=True)
    status = Column(String(50), default="pending_review", nullable=False)  # 'pending_review', 'verified', 'rejected'
    reviewed_by = Column(String(36), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    document = relationship("MedicalDocument", back_populates="extracted_records")

# 9. lab_results
class LabResult(Base):
    __tablename__ = "lab_results"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    document_id = Column(String(36), ForeignKey("medical_documents.id", ondelete="SET NULL"), nullable=True, index=True)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    test_name = Column(String(255), nullable=False, index=True)
    measured_value = Column(String(100), nullable=False)
    numeric_value = Column(Float, nullable=True)
    unit = Column(String(50), nullable=True)
    reference_range = Column(String(100), nullable=True)
    is_abnormal = Column(Boolean, default=False, nullable=False)
    abnormal_flag = Column(String(20), nullable=True)  # 'HIGH', 'LOW', 'NORMAL', 'CRITICAL'
    test_date = Column(String(50), nullable=True, index=True)
    lab_name = Column(String(255), nullable=True)
    verification_status = Column(String(50), default="unverified", nullable=False)  # 'unverified', 'verified', 'corrected'
    confidence = Column(String(50), default="high", nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    patient = relationship("Patient", back_populates="lab_results")
    document = relationship("MedicalDocument", back_populates="lab_results")

# 10. prescriptions
class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    document_id = Column(String(36), ForeignKey("medical_documents.id", ondelete="SET NULL"), nullable=True, index=True)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    prescriber_name = Column(String(255), nullable=True)
    clinic_name = Column(String(255), nullable=True)
    prescription_date = Column(String(50), nullable=True, index=True)
    diagnosis_notes = Column(Text, nullable=True)
    verification_status = Column(String(50), default="unverified", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    patient = relationship("Patient", back_populates="prescriptions")
    document = relationship("MedicalDocument", back_populates="prescriptions")
    items = relationship("PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan")

# 11. prescription_items
class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    prescription_id = Column(String(36), ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    medicine_name = Column(String(255), nullable=False, index=True)
    dosage = Column(String(100), nullable=False)
    route = Column(String(50), default="oral", nullable=True)
    frequency = Column(String(100), nullable=False)  # e.g., 'Once daily', '1-0-1', 'Twice daily after food'
    duration = Column(String(100), nullable=True)    # e.g., '30 days', '5 days'
    instructions = Column(Text, nullable=True)
    start_date = Column(String(50), nullable=True)
    end_date = Column(String(50), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)

    prescription = relationship("Prescription", back_populates="items")
    schedules = relationship("MedicationSchedule", back_populates="prescription_item")

# 12. treatment_plans
class TreatmentPlan(Base):
    __tablename__ = "treatment_plans"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    indication_diagnosis = Column(String(255), nullable=True)
    treatment_instructions = Column(Text, nullable=False)
    clinician_name = Column(String(255), nullable=True)
    start_date = Column(String(50), nullable=True)
    end_date = Column(String(50), nullable=True)
    follow_up_date = Column(String(50), nullable=True)
    status = Column(String(50), default="active", nullable=False)  # 'active', 'completed', 'planned', 'discontinued'
    approval_status = Column(String(50), default="clinician_confirmed", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    patient = relationship("Patient", back_populates="treatment_plans")
    events = relationship("TreatmentPlanEvent", back_populates="treatment_plan", cascade="all, delete-orphan")

# 13. treatment_plan_events
class TreatmentPlanEvent(Base):
    __tablename__ = "treatment_plan_events"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    treatment_plan_id = Column(String(36), ForeignKey("treatment_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)  # 'created', 'status_changed', 'progress_reported', 'modified'
    description = Column(Text, nullable=False)
    created_by = Column(String(100), default="patient", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    treatment_plan = relationship("TreatmentPlan", back_populates="events")

# 14. patient_measurements
class PatientMeasurement(Base):
    __tablename__ = "patient_measurements"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    measurement_type = Column(String(50), nullable=False, index=True)  # 'blood_pressure_sys', 'blood_pressure_dia', 'heart_rate', 'glucose_fasting', 'weight', 'spo2'
    value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)
    measured_at = Column(DateTime, default=utc_now, nullable=False, index=True)
    notes = Column(String(255), nullable=True)

    patient = relationship("Patient", back_populates="measurements")

# 15. conversations
class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), default="Health Consultation", nullable=False)
    language = Column(String(10), default="en", nullable=False)  # 'en', 'te', 'hi'
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    patient = relationship("Patient", back_populates="conversations")
    messages = relationship("ConversationMessage", back_populates="conversation", cascade="all, delete-orphan")
    summaries = relationship("ConversationSummary", back_populates="conversation", cascade="all, delete-orphan")

# 16. conversation_messages
class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    source_references = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")

# 17. conversation_summaries
class ConversationSummary(Base):
    __tablename__ = "conversation_summaries"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    main_concern = Column(String(255), nullable=False)
    reported_symptoms = Column(JSON, nullable=True)
    reported_dates_duration = Column(String(100), nullable=True)
    relevant_record_refs = Column(JSON, nullable=True)
    questions_raised = Column(JSON, nullable=True)
    follow_up_topics = Column(JSON, nullable=True)
    uncertainties = Column(Text, nullable=True)
    user_approved = Column(Boolean, default=False, nullable=False)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    conversation = relationship("Conversation", back_populates="summaries")

# 18. ai_assessments
class AIAssessment(Base):
    __tablename__ = "ai_assessments"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    reported_concerns = Column(Text, nullable=False)
    relevant_findings = Column(JSON, nullable=True)
    clinical_discussion_topics = Column(JSON, nullable=True)
    missing_info_uncertainties = Column(Text, nullable=True)
    doctor_questions = Column(JSON, nullable=True)
    urgency_level = Column(String(50), default="routine", nullable=False)  # 'routine', 'prompt_evaluation', 'emergency_alert'
    disclaimer = Column(Text, nullable=False)
    source_references = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    patient = relationship("Patient", back_populates="ai_assessments")

# 19. medication_schedules
class MedicationSchedule(Base):
    __tablename__ = "medication_schedules"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    prescription_item_id = Column(String(36), ForeignKey("prescription_items.id", ondelete="SET NULL"), nullable=True)
    medicine_name = Column(String(255), nullable=False, index=True)
    dosage = Column(String(100), nullable=False)
    times_per_day = Column(Integer, default=1, nullable=False)
    schedule_times = Column(JSON, nullable=False)  # ["08:00", "20:00"]
    timezone = Column(String(50), default="Asia/Kolkata", nullable=False)
    start_date = Column(String(50), nullable=False)
    end_date = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    patient = relationship("Patient", back_populates="schedules")
    prescription_item = relationship("PrescriptionItem", back_populates="schedules")
    reminders = relationship("MedicationReminder", back_populates="schedule", cascade="all, delete-orphan")
    adherence_logs = relationship("MedicationAdherenceLog", back_populates="schedule", cascade="all, delete-orphan")

# 20. medication_reminders
class MedicationReminder(Base):
    __tablename__ = "medication_reminders"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    schedule_id = Column(String(36), ForeignKey("medication_schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    scheduled_time = Column(String(50), nullable=False, index=True)
    reminder_text = Column(String(255), default="It's time for your scheduled medicine. Please follow your confirmed prescription instructions.", nullable=False)
    status = Column(String(50), default="scheduled", nullable=False)  # 'scheduled', 'sent', 'dismissed'
    sent_at = Column(DateTime, nullable=True)

    schedule = relationship("MedicationSchedule", back_populates="reminders")

# 21. medication_adherence_logs
class MedicationAdherenceLog(Base):
    __tablename__ = "medication_adherence_logs"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    schedule_id = Column(String(36), ForeignKey("medication_schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(20), nullable=False)  # 'taken', 'snoozed', 'skipped', 'missed'
    scheduled_time = Column(String(50), nullable=False)
    logged_at = Column(DateTime, default=utc_now, nullable=False, index=True)
    notes = Column(String(255), nullable=True)

    schedule = relationship("MedicationSchedule", back_populates="adherence_logs")

# 22. appointments
class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    doctor_name = Column(String(255), nullable=True)
    facility_name = Column(String(255), nullable=True)
    appointment_date = Column(String(50), nullable=False, index=True)
    appointment_type = Column(String(50), default="Follow-up Consultation", nullable=False)
    status = Column(String(50), default="scheduled", nullable=False)  # 'scheduled', 'completed', 'cancelled'
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    patient = relationship("Patient", back_populates="appointments")

# 23. audit_logs
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(String(36), nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)

    user = relationship("User", back_populates="audit_logs")
