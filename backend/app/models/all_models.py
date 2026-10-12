import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, 
    Float, Enum, JSON, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.core.database import Base

# 1. users
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    preferred_language = Column(String(10), default="en") # 'en' or 'te'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    patients = relationship("Patient", back_populates="creator")
    audit_logs = relationship("AuditLog", back_populates="user")
    consents = relationship("PatientConsent", back_populates="user")

# 2. roles
class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False) # 'patient', 'clinician', 'admin'
    description = Column(String(255), nullable=True)

# 3. user_roles
class UserRole(Base):
    __tablename__ = "user_roles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    
    user = relationship("User", back_populates="roles")
    role = relationship("Role")

# 4. patients
class Patient(Base):
    __tablename__ = "patients"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    abha_id = Column(String(50), unique=True, nullable=True) # Mock ABHA
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(String(20), nullable=True)
    gender = Column(String(20), nullable=True)
    blood_group = Column(String(10), nullable=True)
    phone = Column(String(50), nullable=True)
    emergency_contact = Column(String(255), nullable=True)
    allergies = Column(Text, nullable=True)
    chronic_conditions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    creator = relationship("User", back_populates="patients")
    permissions = relationship("PatientAccessPermission", back_populates="patient", cascade="all, delete-orphan")
    documents = relationship("MedicalDocument", back_populates="patient", cascade="all, delete-orphan")
    lab_results = relationship("LabResult", back_populates="patient", cascade="all, delete-orphan")
    prescriptions = relationship("Prescription", back_populates="patient", cascade="all, delete-orphan")
    treatment_plans = relationship("TreatmentPlan", back_populates="patient", cascade="all, delete-orphan")
    measurements = relationship("PatientMeasurement", back_populates="patient", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="patient", cascade="all, delete-orphan")
    assessments = relationship("AIAssessment", back_populates="patient", cascade="all, delete-orphan")
    medication_schedules = relationship("MedicationSchedule", back_populates="patient", cascade="all, delete-orphan")
    follow_ups = relationship("FollowUpEvent", back_populates="patient", cascade="all, delete-orphan")

# 5. patient_access_permissions
class PatientAccessPermission(Base):
    __tablename__ = "patient_access_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    permission_level = Column(String(50), default="view") # 'view', 'edit', 'admin'
    granted_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    patient = relationship("Patient", back_populates="permissions")
    user = relationship("User")

# 6. patient_consents
class PatientConsent(Base):
    __tablename__ = "patient_consents"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    consent_type = Column(String(100), nullable=False) # 'ai_analysis', 'data_sharing', 'research'
    is_granted = Column(Boolean, default=True)
    granted_at = Column(DateTime, default=datetime.datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)
    
    user = relationship("User", back_populates="consents")

# 7. medical_documents
class MedicalDocument(Base):
    __tablename__ = "medical_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    document_type = Column(String(50), nullable=False, index=True) # 'lab_report', 'prescription', 'discharge_summary', 'consultation_note'
    title = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False) # 'application/pdf', 'image/png', etc.
    file_size = Column(Integer, nullable=False)
    extracted_text = Column(Text, nullable=True)
    ocr_status = Column(String(50), default="pending") # 'pending', 'processing', 'completed', 'failed'
    verification_status = Column(String(50), default="unverified") # 'unverified', 'verified', 'rejected'
    document_date = Column(String(50), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    patient = relationship("Patient", back_populates="documents")
    extracted_records = relationship("ExtractedRecord", back_populates="document", cascade="all, delete-orphan")
    lab_results = relationship("LabResult", back_populates="document")
    prescriptions = relationship("Prescription", back_populates="document")

# 8. extracted_records
class ExtractedRecord(Base):
    __tablename__ = "extracted_records"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("medical_documents.id", ondelete="CASCADE"), nullable=False)
    record_type = Column(String(50), nullable=False) # 'lab_item', 'medication_item', 'summary'
    field_name = Column(String(100), nullable=False)
    raw_value = Column(String(255), nullable=True)
    structured_data = Column(JSON, nullable=True)
    confidence = Column(String(50), default="high") # 'high', 'moderate', 'low', 'uncertain'
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    document = relationship("MedicalDocument", back_populates="extracted_records")

# 9. lab_results
class LabResult(Base):
    __tablename__ = "lab_results"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("medical_documents.id", ondelete="SET NULL"), nullable=True)
    test_name = Column(String(255), nullable=False, index=True)
    measured_value = Column(Float, nullable=True)
    value_text = Column(String(100), nullable=True)
    unit = Column(String(50), nullable=True)
    reference_range = Column(String(100), nullable=True)
    ref_low = Column(Float, nullable=True)
    ref_high = Column(Float, nullable=True)
    is_abnormal = Column(Boolean, default=False)
    abnormal_flag = Column(String(20), nullable=True) # 'HIGH', 'LOW', 'NORMAL', 'CRITICAL'
    test_date = Column(String(50), nullable=True)
    laboratory_name = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    verification_status = Column(String(50), default="verified") # 'verified', 'pending_review'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    patient = relationship("Patient", back_populates="lab_results")
    document = relationship("MedicalDocument", back_populates="lab_results")

# 10. prescriptions
class Prescription(Base):
    __tablename__ = "prescriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("medical_documents.id", ondelete="SET NULL"), nullable=True)
    prescriber_name = Column(String(255), nullable=True)
    clinic_or_hospital = Column(String(255), nullable=True)
    prescription_date = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    verification_status = Column(String(50), default="verified")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    patient = relationship("Patient", back_populates="prescriptions")
    document = relationship("MedicalDocument", back_populates="prescriptions")
    items = relationship("PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan")

# 11. prescription_items
class PrescriptionItem(Base):
    __tablename__ = "prescription_items"
    
    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False)
    medicine_name = Column(String(255), nullable=False)
    dose_text = Column(String(100), nullable=False) # e.g. "500mg"
    route = Column(String(50), default="oral") # 'oral', 'topical', etc.
    frequency = Column(String(100), nullable=False) # e.g. "Twice daily after food"
    duration = Column(String(100), nullable=True) # e.g. "5 days"
    start_date = Column(String(50), nullable=True)
    end_date = Column(String(50), nullable=True)
    confidence = Column(String(50), default="high")
    is_verified = Column(Boolean, default=True)
    
    prescription = relationship("Prescription", back_populates="items")
    schedules = relationship("MedicationSchedule", back_populates="prescription_item")

# 12. treatment_plans
class TreatmentPlan(Base):
    __tablename__ = "treatment_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    indication = Column(String(255), nullable=True)
    instructions = Column(Text, nullable=False)
    goals = Column(Text, nullable=True)
    clinician_name = Column(String(255), nullable=True)
    start_date = Column(String(50), nullable=True)
    end_date = Column(String(50), nullable=True)
    follow_up_date = Column(String(50), nullable=True)
    status = Column(String(50), default="active") # 'active', 'planned', 'completed', 'discontinued'
    approval_status = Column(String(50), default="clinician_approved")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    patient = relationship("Patient", back_populates="treatment_plans")
    events = relationship("TreatmentPlanEvent", back_populates="treatment_plan", cascade="all, delete-orphan")

# 13. treatment_plan_events
class TreatmentPlanEvent(Base):
    __tablename__ = "treatment_plan_events"
    
    id = Column(Integer, primary_key=True, index=True)
    treatment_plan_id = Column(Integer, ForeignKey("treatment_plans.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(100), nullable=False) # 'status_change', 'follow_up_scheduled', 'progress_reported'
    description = Column(Text, nullable=False)
    recorded_by = Column(String(100), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    treatment_plan = relationship("TreatmentPlan", back_populates="events")

# 14. patient_measurements
class PatientMeasurement(Base):
    __tablename__ = "patient_measurements"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    measurement_type = Column(String(50), nullable=False) # 'blood_pressure', 'blood_sugar', 'heart_rate', 'weight', 'spO2'
    value = Column(Float, nullable=False)
    secondary_value = Column(Float, nullable=True) # e.g. diastolic BP
    unit = Column(String(50), nullable=False)
    measured_at = Column(DateTime, default=datetime.datetime.utcnow)
    notes = Column(String(255), nullable=True)
    
    patient = relationship("Patient", back_populates="measurements")

# 15. conversations
class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), default="Health Consultation")
    language = Column(String(10), default="en") # 'en' or 'te'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    patient = relationship("Patient", back_populates="conversations")
    messages = relationship("ConversationMessage", back_populates="conversation", cascade="all, delete-orphan")
    summaries = relationship("ConversationSummary", back_populates="conversation", cascade="all, delete-orphan")

# 16. conversation_messages
class ConversationMessage(Base):
    __tablename__ = "conversation_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender = Column(String(20), nullable=False) # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    conversation = relationship("Conversation", back_populates="messages")

# 17. conversation_summaries
class ConversationSummary(Base):
    __tablename__ = "conversation_summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    main_concern = Column(String(255), nullable=False)
    symptoms = Column(Text, nullable=True)
    duration = Column(String(100), nullable=True)
    questions_for_doctor = Column(Text, nullable=True)
    follow_up_topics = Column(Text, nullable=True)
    uncertainties = Column(Text, nullable=True)
    user_approved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    conversation = relationship("Conversation", back_populates="summaries")

# 18. ai_assessments
class AIAssessment(Base):
    __tablename__ = "ai_assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    reported_symptoms = Column(Text, nullable=False)
    relevant_findings = Column(Text, nullable=True)
    topics_to_discuss = Column(Text, nullable=True)
    missing_information = Column(Text, nullable=True)
    questions_for_clinician = Column(Text, nullable=True)
    urgency_level = Column(String(50), default="routine") # 'routine', 'prompt_attention', 'emergency'
    safety_guidance = Column(Text, nullable=True)
    disclaimer = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    patient = relationship("Patient", back_populates="assessments")

# 19. medication_schedules
class MedicationSchedule(Base):
    __tablename__ = "medication_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    prescription_item_id = Column(Integer, ForeignKey("prescription_items.id", ondelete="SET NULL"), nullable=True)
    medicine_name = Column(String(255), nullable=False)
    dose_text = Column(String(100), nullable=False)
    frequency = Column(String(100), nullable=False)
    reminder_times = Column(JSON, nullable=False) # e.g. ["08:00", "20:00"]
    start_date = Column(String(50), nullable=True)
    end_date = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    patient = relationship("Patient", back_populates="medication_schedules")
    prescription_item = relationship("PrescriptionItem", back_populates="schedules")
    reminders = relationship("MedicationReminder", back_populates="schedule", cascade="all, delete-orphan")

# 20. medication_reminders
class MedicationReminder(Base):
    __tablename__ = "medication_reminders"
    
    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("medication_schedules.id", ondelete="CASCADE"), nullable=False)
    scheduled_time = Column(DateTime, nullable=False, index=True)
    status = Column(String(50), default="pending") # 'pending', 'taken', 'snoozed', 'skipped', 'missed'
    action_taken_at = Column(DateTime, nullable=True)
    notes = Column(String(255), nullable=True)
    
    schedule = relationship("MedicationSchedule", back_populates="reminders")
    adherence_logs = relationship("MedicationAdherenceLog", back_populates="reminder", cascade="all, delete-orphan")

# 21. medication_adherence_logs
class MedicationAdherenceLog(Base):
    __tablename__ = "medication_adherence_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    reminder_id = Column(Integer, ForeignKey("medication_reminders.id", ondelete="CASCADE"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False) # 'taken', 'skipped', 'snoozed'
    logged_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    reminder = relationship("MedicationReminder", back_populates="adherence_logs")

# 22. follow_up_events (appointments or follow up)
class FollowUpEvent(Base):
    __tablename__ = "follow_up_events"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    event_type = Column(String(50), default="doctor_visit") # 'doctor_visit', 'lab_test', 'medication_refill'
    event_date = Column(DateTime, nullable=False, index=True)
    location_or_clinic = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    patient = relationship("Patient", back_populates="follow_ups")

# 23. audit_logs
class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False) # e.g. 'LOGIN', 'DOCUMENT_UPLOAD', 'AI_ASSESSMENT', 'RECORD_VERIFY'
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(String(100), nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    
    user = relationship("User", back_populates="audit_logs")
