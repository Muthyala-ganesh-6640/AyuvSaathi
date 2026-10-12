from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# ----------------- AUTH & USER -----------------
class UserCreate(BaseModel):
    email: str
    password: str = Field(..., min_length=6)
    full_name: str
    preferred_language: Optional[str] = "en"
    role: Optional[str] = "patient"

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    full_name: str
    is_active: bool
    preferred_language: str
    roles: List[str] = []
    patient_id: Optional[str] = None
    created_at: datetime

# ----------------- PATIENT -----------------
class PatientCreate(BaseModel):
    full_name: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    abha_id: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    address: Optional[str] = None

class PatientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: Optional[str] = None
    full_name: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    abha_id: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime

# ----------------- CONSENT -----------------
class ConsentCreate(BaseModel):
    patient_id: str
    purpose: str = "AI medical record extraction and decision support"
    consent_given: bool = True
    ai_processing_allowed: bool = True

class ConsentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: str
    purpose: str
    consent_given: bool
    ai_processing_allowed: bool
    consent_date: datetime
    revoked_at: Optional[datetime] = None

# ----------------- DOCUMENT -----------------
class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: str
    category: str
    file_name: str
    mime_type: str
    file_size: int
    upload_status: str
    ocr_status: str
    created_at: datetime

# ----------------- LAB RESULTS -----------------
class LabItemExtract(BaseModel):
    test_name: str
    measured_value: str
    numeric_value: Optional[float] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    is_abnormal: bool = False
    abnormal_flag: Optional[str] = "NORMAL"
    notes: Optional[str] = None

class LabResultCreate(BaseModel):
    patient_id: str
    document_id: Optional[str] = None
    test_name: str
    measured_value: str
    numeric_value: Optional[float] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    is_abnormal: bool = False
    abnormal_flag: Optional[str] = "NORMAL"
    test_date: Optional[str] = None
    lab_name: Optional[str] = None
    verification_status: str = "verified"
    notes: Optional[str] = None

class LabResultUpdate(BaseModel):
    test_name: Optional[str] = None
    measured_value: Optional[str] = None
    numeric_value: Optional[float] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    is_abnormal: Optional[bool] = None
    abnormal_flag: Optional[str] = None
    verification_status: Optional[str] = None
    notes: Optional[str] = None

class LabResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    document_id: Optional[str] = None
    patient_id: str
    test_name: str
    measured_value: str
    numeric_value: Optional[float] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    is_abnormal: bool
    abnormal_flag: Optional[str] = None
    test_date: Optional[str] = None
    lab_name: Optional[str] = None
    verification_status: str
    confidence: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

# ----------------- PRESCRIPTION -----------------
class PrescriptionItemCreate(BaseModel):
    medicine_name: str
    dosage: str
    route: Optional[str] = "oral"
    frequency: str
    duration: Optional[str] = None
    instructions: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_verified: bool = False

class PrescriptionCreate(BaseModel):
    patient_id: str
    document_id: Optional[str] = None
    prescriber_name: Optional[str] = None
    clinic_name: Optional[str] = None
    prescription_date: Optional[str] = None
    diagnosis_notes: Optional[str] = None
    items: List[PrescriptionItemCreate] = []

class PrescriptionItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    prescription_id: str
    medicine_name: str
    dosage: str
    route: Optional[str] = None
    frequency: str
    duration: Optional[str] = None
    instructions: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_verified: bool

class PrescriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    document_id: Optional[str] = None
    patient_id: str
    prescriber_name: Optional[str] = None
    clinic_name: Optional[str] = None
    prescription_date: Optional[str] = None
    diagnosis_notes: Optional[str] = None
    verification_status: str
    created_at: datetime
    items: List[PrescriptionItemResponse] = []

# ----------------- TREATMENT PLAN -----------------
class TreatmentPlanCreate(BaseModel):
    patient_id: str
    title: str
    indication_diagnosis: Optional[str] = None
    treatment_instructions: str
    clinician_name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    status: str = "active"

class TreatmentPlanUpdate(BaseModel):
    title: Optional[str] = None
    indication_diagnosis: Optional[str] = None
    treatment_instructions: Optional[str] = None
    clinician_name: Optional[str] = None
    status: Optional[str] = None
    follow_up_date: Optional[str] = None
    event_note: Optional[str] = None

class TreatmentPlanEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    treatment_plan_id: str
    event_type: str
    description: str
    created_by: str
    created_at: datetime

class TreatmentPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: str
    title: str
    indication_diagnosis: Optional[str] = None
    treatment_instructions: str
    clinician_name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    status: str
    approval_status: str
    created_at: datetime
    updated_at: datetime
    events: List[TreatmentPlanEventResponse] = []

# ----------------- MEASUREMENTS -----------------
class MeasurementCreate(BaseModel):
    patient_id: str
    measurement_type: str
    value: float
    unit: str
    notes: Optional[str] = None

class MeasurementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: str
    measurement_type: str
    value: float
    unit: str
    measured_at: datetime
    notes: Optional[str] = None

# ----------------- CONVERSATIONS & CHATBOT -----------------
class MessageCreate(BaseModel):
    content: str
    language: Optional[str] = "en"

class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: str
    title: str
    language: str
    created_at: datetime

class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    role: str
    content: str
    source_references: Optional[List[str]] = None
    created_at: datetime

class SummaryDraftResponse(BaseModel):
    main_concern: str
    reported_symptoms: List[str]
    reported_dates_duration: Optional[str] = None
    relevant_record_refs: List[str]
    questions_raised: List[str]
    follow_up_topics: List[str]
    uncertainties: str

class SummaryApproveRequest(BaseModel):
    conversation_id: str
    patient_id: str
    main_concern: str
    reported_symptoms: List[str]
    reported_dates_duration: Optional[str] = None
    relevant_record_refs: List[str] = []
    questions_raised: List[str] = []
    follow_up_topics: List[str] = []
    uncertainties: Optional[str] = None

# ----------------- AI DIAGNOSIS SUPPORT -----------------
class AssessmentRequest(BaseModel):
    patient_id: str
    symptoms: str
    duration: Optional[str] = None

class AssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: str
    reported_concerns: str
    relevant_findings: List[str]
    clinical_discussion_topics: List[str]
    missing_info_uncertainties: str
    doctor_questions: List[str]
    urgency_level: str
    disclaimer: str
    source_references: List[str]
    created_at: datetime

# ----------------- MEDICATION REMINDERS & ADHERENCE -----------------
class ScheduleCreate(BaseModel):
    patient_id: str
    medicine_name: str
    dosage: str
    times_per_day: int = 1
    schedule_times: List[str]
    timezone: str = "Asia/Kolkata"
    start_date: str
    end_date: Optional[str] = None
    prescription_item_id: Optional[str] = None

class ScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: str
    prescription_item_id: Optional[str] = None
    medicine_name: str
    dosage: str
    times_per_day: int
    schedule_times: List[str]
    timezone: str
    start_date: str
    end_date: Optional[str] = None
    is_active: bool
    created_at: datetime

class AdherenceLogCreate(BaseModel):
    schedule_id: str
    patient_id: str
    action: str  # 'taken', 'snoozed', 'skipped', 'missed'
    scheduled_time: str
    notes: Optional[str] = None

class AdherenceLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    schedule_id: str
    patient_id: str
    action: str
    scheduled_time: str
    logged_at: datetime
    notes: Optional[str] = None

# ----------------- NEARBY HOSPITALS -----------------
class HospitalSearchRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    city: Optional[str] = None
    pin_code: Optional[str] = None
    category: Optional[str] = "all"  # 'hospitals', 'clinics', 'pharmacies', 'diagnostics'
    radius_km: Optional[float] = 10.0

class HospitalFacility(BaseModel):
    id: str
    name: str
    facility_type: str
    address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    distance_km: Optional[float] = None
    phone: Optional[str] = None
    emergency_services: bool = False
    source: str = "OpenStreetMap Overpass"
    directions_url: str

class HospitalSearchResponse(BaseModel):
    query_location: str
    total_found: int
    facilities: List[HospitalFacility]
    emergency_helplines: Dict[str, str] = {
        "National Emergency": "112",
        "Ambulance / Medical": "108",
        "Disaster Management": "1078",
        "Women Helpline": "1091",
        "Tele-MANAS Mental Health": "14416"
    }
