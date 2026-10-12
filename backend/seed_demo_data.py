import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.core.database import SessionLocal, engine, Base
from backend.app.core.security import get_password_hash
from backend.app.models.entities import (
    User, Role, user_roles, Patient, PatientConsent, MedicalDocument,
    ExtractedRecord, LabResult, Prescription, PrescriptionItem,
    TreatmentPlan, TreatmentPlanEvent, PatientMeasurement,
    Conversation, ConversationMessage, ConversationSummary,
    AIAssessment, MedicationSchedule, MedicationReminder,
    MedicationAdherenceLog, Appointment, AuditLog
)

def seed():
    patient_password = os.environ.get("DEMO_PATIENT_PASSWORD")
    doctor_password = os.environ.get("DEMO_DOCTOR_PASSWORD")
    if not patient_password or not doctor_password:
        raise RuntimeError(
            "Set DEMO_PATIENT_PASSWORD and DEMO_DOCTOR_PASSWORD before seeding demo users."
        )
    if len(patient_password) < 12 or len(doctor_password) < 12:
        raise RuntimeError("Demo seed passwords must each contain at least 12 characters.")

    db = SessionLocal()
    print("Clearing and seeding MySQL database ayuvsaathi with realistic synthetic demo data...")

    # Drop and recreate all tables for a fresh clean demo state
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # 1. Roles
    role_patient = Role(name="patient", description="Patient / Individual profile")
    role_doctor = Role(name="doctor", description="Certified Healthcare Practitioner")
    role_admin = Role(name="admin", description="System Administrator")
    db.add_all([role_patient, role_doctor, role_admin])
    db.flush()

    # 2. Users
    user_ramesh = User(
        email="ramesh@ayuvsaathi.in",
        password_hash=get_password_hash(patient_password),
        full_name="Ramesh Kumar",
        preferred_language="te"
    )
    user_ramesh.roles.append(role_patient)

    user_sunita = User(
        email="sunita@ayuvsaathi.in",
        password_hash=get_password_hash(patient_password),
        full_name="Sunita Rao",
        preferred_language="en"
    )
    user_sunita.roles.append(role_patient)

    user_doctor = User(
        email="doctor@ayuvsaathi.in",
        password_hash=get_password_hash(doctor_password),
        full_name="Dr. K. Srinivas Rao, MD",
        preferred_language="en"
    )
    user_doctor.roles.append(role_doctor)

    db.add_all([user_ramesh, user_sunita, user_doctor])
    db.flush()

    # 3. Patient Profiles
    p1 = Patient(
        user_id=user_ramesh.id,
        full_name="Ramesh Kumar",
        date_of_birth="1970-05-14",
        gender="Male",
        blood_group="B+",
        abha_id="91-4521-8932-2026",
        phone="+91 98490 12345",
        emergency_contact="Lakshmi Kumar (Wife) +91 98490 54321",
        address="Flat 402, Sri Sai Residency, Madhapur, Hyderabad, Telangana 500081"
    )

    p2 = Patient(
        user_id=user_sunita.id,
        full_name="Sunita Rao",
        date_of_birth="1978-08-22",
        gender="Female",
        blood_group="O+",
        abha_id="91-7812-3490-2026",
        phone="+91 99887 65432",
        emergency_contact="Venkatesh Rao (Spouse) +91 99887 11223",
        address="House 12-4-89, Benz Circle, Vijayawada, Andhra Pradesh 520010"
    )

    db.add_all([p1, p2])
    db.flush()

    # 4. Consents
    for p in [p1, p2]:
        c1 = PatientConsent(
            patient_id=p.id,
            purpose="AI medical record extraction and clinical decision support",
            consent_given=True,
            ai_processing_allowed=True
        )
        c2 = PatientConsent(
            patient_id=p.id,
            purpose="Care coordination and health summary sharing",
            consent_given=True,
            ai_processing_allowed=True
        )
        db.add_all([c1, c2])

    # 5. Documents for Ramesh Kumar
    doc1 = MedicalDocument(
        patient_id=p1.id,
        category="lab_report",
        file_name="Vijaya_Comprehensive_Metabolic_CBC_Report_Oct2026.pdf",
        file_path="uploads/demo_ramesh_metabolic.pdf",
        mime_type="application/pdf",
        file_size=245000,
        upload_status="uploaded",
        ocr_status="completed",
        original_text="Vijaya Diagnostic Centre. Patient: Ramesh Kumar, Age: 56. Fasting Blood Sugar: 142 mg/dL (Ref: 70-99). HbA1c: 7.8% (Ref: 4.0-5.6). Total Cholesterol: 215 mg/dL (Ref: 125-200). Serum Creatinine: 1.0 mg/dL (Ref: 0.6-1.2). Hemoglobin: 13.8 g/dL (Ref: 12.0-17.5)."
    )

    doc2 = MedicalDocument(
        patient_id=p1.id,
        category="prescription",
        file_name="Apollo_CardioMetabolic_Prescription_DrRao.pdf",
        file_path="uploads/demo_ramesh_prescription.pdf",
        mime_type="application/pdf",
        file_size=180000,
        upload_status="uploaded",
        ocr_status="completed",
        original_text="Apollo Hospitals Jubilee Hills. Dr. K. S. Rao, MD. Rx for Ramesh Kumar. 1. Metformin 500 mg - 1-0-1 after food (Twice daily). 2. Telmisartan 40 mg - 1-0-0 morning (Once daily). 3. Atorvastatin 10 mg - 0-0-1 bedtime (Once daily night)."
    )

    db.add_all([doc1, doc2])
    db.flush()

    # 6. Lab Results for Ramesh Kumar (CBC, Glucose, Lipids)
    labs_p1 = [
        LabResult(
            patient_id=p1.id,
            document_id=doc1.id,
            test_name="Fasting Blood Sugar",
            measured_value="142",
            numeric_value=142.0,
            unit="mg/dL",
            reference_range="70 - 99 mg/dL",
            is_abnormal=True,
            abnormal_flag="HIGH",
            test_date="2026-10-05",
            lab_name="Vijaya Diagnostic Centre",
            verification_status="verified",
            confidence="high",
            notes="Elevated fasting glycemia. Discuss with diabetologist."
        ),
        LabResult(
            patient_id=p1.id,
            document_id=doc1.id,
            test_name="HbA1c (Glycated Hemoglobin)",
            measured_value="7.8",
            numeric_value=7.8,
            unit="%",
            reference_range="4.0 - 5.6 %",
            is_abnormal=True,
            abnormal_flag="HIGH",
            test_date="2026-10-05",
            lab_name="Vijaya Diagnostic Centre",
            verification_status="verified",
            confidence="high",
            notes="Indicates suboptimal glycemic control over past 3 months."
        ),
        LabResult(
            patient_id=p1.id,
            document_id=doc1.id,
            test_name="Total Cholesterol",
            measured_value="215",
            numeric_value=215.0,
            unit="mg/dL",
            reference_range="125 - 200 mg/dL",
            is_abnormal=True,
            abnormal_flag="HIGH",
            test_date="2026-10-05",
            lab_name="Vijaya Diagnostic Centre",
            verification_status="verified",
            confidence="high",
            notes="Mild hypercholesterolemia. Dietary moderation advised."
        ),
        LabResult(
            patient_id=p1.id,
            document_id=doc1.id,
            test_name="Serum Creatinine",
            measured_value="1.0",
            numeric_value=1.0,
            unit="mg/dL",
            reference_range="0.6 - 1.2 mg/dL",
            is_abnormal=False,
            abnormal_flag="NORMAL",
            test_date="2026-10-05",
            lab_name="Vijaya Diagnostic Centre",
            verification_status="verified",
            confidence="high",
            notes="Renal function within standard limits."
        ),
        LabResult(
            patient_id=p1.id,
            document_id=doc1.id,
            test_name="Hemoglobin",
            measured_value="13.8",
            numeric_value=13.8,
            unit="g/dL",
            reference_range="12.0 - 17.5 g/dL",
            is_abnormal=False,
            abnormal_flag="NORMAL",
            test_date="2026-10-05",
            lab_name="Vijaya Diagnostic Centre",
            verification_status="verified",
            confidence="high",
            notes="Adequate red blood cell indices."
        ),
        # Historical FBS for trend comparison
        LabResult(
            patient_id=p1.id,
            document_id=None,
            test_name="Fasting Blood Sugar",
            measured_value="165",
            numeric_value=165.0,
            unit="mg/dL",
            reference_range="70 - 99 mg/dL",
            is_abnormal=True,
            abnormal_flag="HIGH",
            test_date="2026-07-15",
            lab_name="Vijaya Diagnostic Centre",
            verification_status="verified",
            confidence="high"
        ),
        LabResult(
            patient_id=p1.id,
            document_id=None,
            test_name="Fasting Blood Sugar",
            measured_value="152",
            numeric_value=152.0,
            unit="mg/dL",
            reference_range="70 - 99 mg/dL",
            is_abnormal=True,
            abnormal_flag="HIGH",
            test_date="2026-08-20",
            lab_name="Vijaya Diagnostic Centre",
            verification_status="verified",
            confidence="high"
        ),
    ]
    db.add_all(labs_p1)
    db.flush()

    # 7. Prescriptions for Ramesh Kumar
    presc1 = Prescription(
        patient_id=p1.id,
        document_id=doc2.id,
        prescriber_name="Dr. K. Srinivas Rao, MD, DM",
        clinic_name="Apollo Hospitals Jubilee Hills",
        prescription_date="2026-10-06",
        diagnosis_notes="Type 2 Diabetes Mellitus with Essential Hypertension & Dyslipidemia",
        verification_status="verified"
    )
    db.add(presc1)
    db.flush()

    pi1 = PrescriptionItem(
        prescription_id=presc1.id,
        medicine_name="Metformin",
        dosage="500 mg",
        route="oral",
        frequency="Twice daily after food (1-0-1)",
        duration="90 days",
        instructions="Take with or immediately after meals to minimize gastrointestinal discomfort.",
        start_date="2026-10-06",
        end_date="2027-01-04",
        is_verified=True
    )
    pi2 = PrescriptionItem(
        prescription_id=presc1.id,
        medicine_name="Telmisartan",
        dosage="40 mg",
        route="oral",
        frequency="Once daily in the morning (1-0-0)",
        duration="90 days",
        instructions="Take in the morning with a glass of water.",
        start_date="2026-10-06",
        end_date="2027-01-04",
        is_verified=True
    )
    pi3 = PrescriptionItem(
        prescription_id=presc1.id,
        medicine_name="Atorvastatin",
        dosage="10 mg",
        route="oral",
        frequency="Once daily at bedtime (0-0-1)",
        duration="90 days",
        instructions="Take at night before sleep.",
        start_date="2026-10-06",
        end_date="2027-01-04",
        is_verified=True
    )
    db.add_all([pi1, pi2, pi3])
    db.flush()

    # 8. Medication Schedules for Ramesh Kumar
    sched1 = MedicationSchedule(
        patient_id=p1.id,
        prescription_item_id=pi1.id,
        medicine_name="Metformin",
        dosage="500 mg",
        times_per_day=2,
        schedule_times=["08:30", "20:30"],
        timezone="Asia/Kolkata",
        start_date="2026-10-06",
        end_date="2027-01-04",
        is_active=True
    )
    sched2 = MedicationSchedule(
        patient_id=p1.id,
        prescription_item_id=pi2.id,
        medicine_name="Telmisartan",
        dosage="40 mg",
        times_per_day=1,
        schedule_times=["08:00"],
        timezone="Asia/Kolkata",
        start_date="2026-10-06",
        end_date="2027-01-04",
        is_active=True
    )
    sched3 = MedicationSchedule(
        patient_id=p1.id,
        prescription_item_id=pi3.id,
        medicine_name="Atorvastatin",
        dosage="10 mg",
        times_per_day=1,
        schedule_times=["21:30"],
        timezone="Asia/Kolkata",
        start_date="2026-10-06",
        end_date="2027-01-04",
        is_active=True
    )
    db.add_all([sched1, sched2, sched3])
    db.flush()

    # 9. Adherence Logs
    now_utc = datetime.now(timezone.utc)
    for i in range(7):
        log_date = now_utc - timedelta(days=i)
        db.add(MedicationAdherenceLog(
            schedule_id=sched1.id,
            patient_id=p1.id,
            action="taken",
            scheduled_time="08:30",
            logged_at=log_date.replace(hour=8, minute=35),
            notes="Taken after breakfast"
        ))
        db.add(MedicationAdherenceLog(
            schedule_id=sched2.id,
            patient_id=p1.id,
            action="taken",
            scheduled_time="08:00",
            logged_at=log_date.replace(hour=8, minute=5),
            notes="Taken on time"
        ))

    # 10. Treatment Plan
    plan1 = TreatmentPlan(
        patient_id=p1.id,
        title="Comprehensive Glycemic & Cardiovascular Risk Reduction Protocol",
        indication_diagnosis="Type 2 Diabetes Mellitus with Essential Hypertension",
        treatment_instructions=(
            "1. Pharmacotherapy: Strict compliance with Metformin 500mg BD, Telmisartan 40mg OD, Atorvastatin 10mg OD.\n"
            "2. Diet: Low glycemic index meals, limit refined carbohydrates, restrict dietary sodium to < 2g/day.\n"
            "3. Activity: 30 minutes brisk walking 5 days/week.\n"
            "4. Monitoring: Home blood glucose fasting twice weekly; Home BP monitoring once weekly."
        ),
        clinician_name="Dr. K. Srinivas Rao, MD, DM (Cardiology/Endocrinology)",
        start_date="2026-10-06",
        end_date="2027-01-06",
        follow_up_date="2026-11-06",
        status="active",
        approval_status="clinician_confirmed"
    )
    db.add(plan1)
    db.flush()

    evt1 = TreatmentPlanEvent(
        treatment_plan_id=plan1.id,
        event_type="created",
        description="Care protocol instituted by Dr. K. S. Rao following metabolic lab review.",
        created_by="Dr. K. Srinivas Rao, MD"
    )
    db.add(evt1)

    # 11. Patient Measurements (Vitals)
    vitals_p1 = [
        PatientMeasurement(patient_id=p1.id, measurement_type="blood_pressure_systolic", value=136.0, unit="mmHg", measured_at=now_utc - timedelta(days=1), notes="Morning resting BP"),
        PatientMeasurement(patient_id=p1.id, measurement_type="blood_pressure_diastolic", value=86.0, unit="mmHg", measured_at=now_utc - timedelta(days=1), notes="Morning resting BP"),
        PatientMeasurement(patient_id=p1.id, measurement_type="heart_rate", value=74.0, unit="bpm", measured_at=now_utc - timedelta(days=1)),
        PatientMeasurement(patient_id=p1.id, measurement_type="glucose_fasting", value=138.0, unit="mg/dL", measured_at=now_utc, notes="Self-monitored home glucometer"),
        PatientMeasurement(patient_id=p1.id, measurement_type="weight", value=74.5, unit="kg", measured_at=now_utc - timedelta(days=3)),
    ]
    db.add_all(vitals_p1)

    # 12. Telugu Health Conversation & Summary for Ramesh Kumar
    conv1 = Conversation(
        patient_id=p1.id,
        user_id=user_ramesh.id,
        title="రక్తంలో చక్కెర & బిపి సందేహాలు (Blood Sugar & BP Queries)",
        language="te"
    )
    db.add(conv1)
    db.flush()

    msg1 = ConversationMessage(
        conversation_id=conv1.id,
        role="user",
        content="నా ఫాస్టింగ్ షుగర్ 142 వచ్చింది మరియు కొలెస్ట్రాల్ 215 ఉంది. నేను ఎలాంటి జాగ్రత్తలు తీసుకోవాలి?"
    )
    msg2 = ConversationMessage(
        conversation_id=conv1.id,
        role="assistant",
        content=(
            "నమస్కారం రమేష్ గారు! మీ ధృవీకరించిన నివేదికల ప్రకారం:\n"
            "• ఫాస్టింగ్ బ్లడ్ షుగర్ 142 mg/dL సాధారణ పరిమితి (70-99 mg/dL) కంటే ఎక్కువగా ఉంది.\n"
            "• మీ డాక్టర్ సూచించిన మెట్‌ఫార్మిన్ (Metformin 500mg) మందులను భోజనం తర్వాత క్రమం తప్పకుండా వేసుకోండి.\n"
            "• ఆహారంలో పిండి పదార్థాలు (వరి అన్నం, తీపి పదార్థాలు) తగ్గించి, పీచు పదార్థాలు మరియు కూరగాయలు పెంచండి.\n"
            "• నవంబర్ 6 న డాక్టర్ కె. ఎస్. రావు గారితో తదుపరి అపాయింట్‌మెంట్ ఉంది, అప్పటివరకు ప్రతి వారం ఇంట్లో షుగర్ స్థాయిని పరీక్షించుకోండి."
        ),
        source_references=["Vijaya Comprehensive Report 05-Oct-2026", "Apollo Rx Dr. Rao"]
    )
    db.add_all([msg1, msg2])
    db.flush()

    sum1 = ConversationSummary(
        conversation_id=conv1.id,
        patient_id=p1.id,
        main_concern="రక్తంలో చక్కెర (142 mg/dL) మరియు కొలెస్ట్రాల్ (215 mg/dL) నిర్వహణపై సందేహాలు",
        reported_symptoms=["Mild evening fatigue", "Thirst"],
        reported_dates_duration="గత 2 వారాల నుండి",
        relevant_record_refs=["Vijaya Lab Report Oct 2026", "Apollo Prescription"],
        questions_raised=[
            "డాక్టర్ రావు గారితో తదుపరి సంప్రదింపులో మోతాదు సర్దుబాటు చేయాలా?",
            "జీవనశైలి మరియు వ్యాయామ మార్పుల ప్రభావం ఎంతకాలంలో కనిపిస్తుంది?"
        ],
        follow_up_topics=[
            "రోజువారీ నడక (30 నిమిషాలు)",
            "వారపు బ్లడ్ షుగర్ రికార్డింగ్ డైరీ నిర్వహణ"
        ],
        uncertainties="క్లినికల్ శారీరక పరీక్ష అవసరం; ఈ మార్గదర్శకం సమాచారం కోసం మాత్రమే.",
        user_approved=True,
        approved_at=now_utc
    )
    db.add(sum1)

    # 13. AI Assessment for Ramesh Kumar
    assess1 = AIAssessment(
        patient_id=p1.id,
        reported_concerns="Patient reported concerns regarding persistent elevated morning blood glucose and mild lethargy.",
        relevant_findings=[
            "Fasting Blood Sugar: 142 mg/dL is HIGH (Standard Ref: 70 - 99 mg/dL)",
            "HbA1c: 7.8% is HIGH (Standard Ref: 4.0 - 5.6 %)",
            "Total Cholesterol: 215 mg/dL is HIGH (Standard Ref: 125 - 200 mg/dL)",
            "Active Medications: Metformin 500 mg BD, Telmisartan 40 mg OD, Atorvastatin 10 mg OD"
        ],
        clinical_discussion_topics=[
            "Assess glycemic response to current oral hypoglycemic regimen (Metformin 500mg BD).",
            "Consider evaluation of dietary adherence and postprandial glucose excursions.",
            "Schedule follow-up lipid profile and microalbuminuria check."
        ],
        missing_info_uncertainties="Comprehensive foot examination, fundoscopy (retinal evaluation), and recent post-prandial lab checks are pending.",
        doctor_questions=[
            "Should my Metformin dosage be titrated given the current HbA1c of 7.8%?",
            "What specific dietary modifications will help bring fasting glucose below 110 mg/dL?",
            "How often should I undergo kidney function and retinal screening?"
        ],
        urgency_level="routine",
        disclaimer=(
            "SAFETY NOTICE: AyuvSaathi provides health informatics and organizational support. "
            "This assessment is NOT a medical diagnosis and cannot prescribe or alter medication. "
            "Always consult Dr. K. Srinivas Rao or your treating physician for medical decisions."
        ),
        source_references=["Vijaya Lab Report Oct 2026", "Apollo Prescription"]
    )
    db.add(assess1)

    # 14. Appointments
    apt1 = Appointment(
        patient_id=p1.id,
        title="Follow-up Diabetology & Cardio Consultation",
        doctor_name="Dr. K. Srinivas Rao, MD",
        facility_name="Apollo Hospitals Jubilee Hills",
        appointment_date="2026-11-06 10:30 AM",
        appointment_type="In-Person Review",
        status="scheduled",
        notes="Bring home glucometer readings log and latest lab reports."
    )
    db.add(apt1)

    # Commit all records
    db.commit()
    print("MySQL database ayuvsaathi successfully populated with realistic synthetic Indian clinical demo records for Ramesh Kumar & Sunita Rao!")
    db.close()

if __name__ == "__main__":
    seed()
