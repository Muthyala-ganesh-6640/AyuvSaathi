import os

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.database import SessionLocal
from backend.app.models.entities import User, Patient, LabResult

client = TestClient(app)
DEMO_PATIENT_PASSWORD = os.environ.get("DEMO_PATIENT_PASSWORD", "")

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "AyuvSaathi" in data["app"]
    assert len(data["modules_active"]) == 9

def test_login_demo_user():
    response = client.post("/api/v1/auth/login", json={
        "email": "ramesh@ayuvsaathi.in",
        "password": DEMO_PATIENT_PASSWORD
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "ramesh@ayuvsaathi.in"
    assert data["user"]["full_name"] == "Ramesh Kumar"

def test_unauthorized_access():
    # Attempt to fetch without token
    response = client.get("/api/v1/patients/")
    assert response.status_code == 401

def test_patient_profile_and_isolation():
    # Login as Ramesh
    login_res = client.post("/api/v1/auth/login", json={
        "email": "ramesh@ayuvsaathi.in",
        "password": DEMO_PATIENT_PASSWORD
    })
    token = login_res.json()["access_token"]
    patient_id = login_res.json()["user"]["patient_id"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch Ramesh's profile
    res = client.get(f"/api/v1/patients/{patient_id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["full_name"] == "Ramesh Kumar"

def test_lab_results_and_verification_gate():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "ramesh@ayuvsaathi.in",
        "password": DEMO_PATIENT_PASSWORD
    })
    token = login_res.json()["access_token"]
    patient_id = login_res.json()["user"]["patient_id"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get(f"/api/v1/labs/?patient_id={patient_id}", headers=headers)
    assert res.status_code == 200
    labs = res.json()
    assert len(labs) >= 5

    # Check that high/low abnormal flags are preserved without modification
    fbs = next(l for l in labs if "Fasting Blood Sugar" in l["test_name"])
    assert fbs["abnormal_flag"] == "HIGH"
    assert fbs["verification_status"] == "verified"

def test_prescriptions_analyzer():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "ramesh@ayuvsaathi.in",
        "password": DEMO_PATIENT_PASSWORD
    })
    token = login_res.json()["access_token"]
    patient_id = login_res.json()["user"]["patient_id"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get(f"/api/v1/prescriptions/?patient_id={patient_id}", headers=headers)
    assert res.status_code == 200
    prescs = res.json()
    assert len(prescs) >= 1
    assert prescs[0]["prescriber_name"] == "Dr. K. Srinivas Rao, MD, DM"
    assert len(prescs[0]["items"]) == 3

def test_treatment_plan_management():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "ramesh@ayuvsaathi.in",
        "password": DEMO_PATIENT_PASSWORD
    })
    token = login_res.json()["access_token"]
    patient_id = login_res.json()["user"]["patient_id"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get(f"/api/v1/treatment-plans/?patient_id={patient_id}", headers=headers)
    assert res.status_code == 200
    plans = res.json()
    assert len(plans) >= 1
    assert "Comprehensive Glycemic" in plans[0]["title"]
    assert len(plans[0]["events"]) >= 1

def test_ai_diagnosis_support_cautious_response():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "ramesh@ayuvsaathi.in",
        "password": DEMO_PATIENT_PASSWORD
    })
    token = login_res.json()["access_token"]
    patient_id = login_res.json()["user"]["patient_id"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/v1/assessments/", json={
        "patient_id": patient_id,
        "symptoms": "Experiencing morning thirst and tiredness for 2 weeks",
        "duration": "2 weeks"
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "SAFETY NOTICE" in data["disclaimer"]
    assert len(data["doctor_questions"]) >= 2
    assert data["urgency_level"] in ["routine", "prompt_evaluation"]

def test_ai_emergency_triage():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "ramesh@ayuvsaathi.in",
        "password": DEMO_PATIENT_PASSWORD
    })
    token = login_res.json()["access_token"]
    patient_id = login_res.json()["user"]["patient_id"]
    headers = {"Authorization": f"Bearer {token}"}

    # Severe symptom trigger
    res = client.post("/api/v1/assessments/", json={
        "patient_id": patient_id,
        "symptoms": "Severe acute chest pain and shortness of breath radiating to left arm",
        "duration": "10 minutes"
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["urgency_level"] == "emergency_alert"
    assert "108" in data["disclaimer"] or "112" in data["disclaimer"]

def test_telugu_chatbot_and_summary():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "ramesh@ayuvsaathi.in",
        "password": DEMO_PATIENT_PASSWORD
    })
    token = login_res.json()["access_token"]
    patient_id = login_res.json()["user"]["patient_id"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create Telugu conversation
    conv_res = client.post(f"/api/v1/conversations/?patient_id={patient_id}&title=ఆరోగ్య ప్రశ్నలు&language=te", headers=headers)
    assert conv_res.status_code == 200
    conv_id = conv_res.json()["id"]

    # Send Telugu message
    msg_res = client.post(f"/api/v1/conversations/{conv_id}/messages", json={
        "content": "నాకు రక్తంలో చక్కెర (sugar) ఎక్కువగా ఉంటే ఎలాంటి జాగ్రత్తలు తీసుకోవాలి?",
        "language": "te"
    }, headers=headers)
    assert msg_res.status_code == 200
    data = msg_res.json()
    assert "నమస్కారం" in data["content"] or "చక్కెర" in data["content"]

def test_medication_reminder_and_adherence():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "ramesh@ayuvsaathi.in",
        "password": DEMO_PATIENT_PASSWORD
    })
    token = login_res.json()["access_token"]
    patient_id = login_res.json()["user"]["patient_id"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get today reminders
    today_res = client.get(f"/api/v1/reminders/today?patient_id={patient_id}", headers=headers)
    assert today_res.status_code == 200
    today_data = today_res.json()
    assert today_data["total"] >= 1

    # Get adherence summary
    adh_res = client.get(f"/api/v1/reminders/adherence-summary?patient_id={patient_id}", headers=headers)
    assert adh_res.status_code == 200
    assert adh_res.json()["adherence_percentage"] > 0

def test_nearby_hospitals_discovery():
    res = client.get("/api/v1/hospitals/search?city=Hyderabad&category=hospitals")
    assert res.status_code == 200
    data = res.json()
    assert data["total_found"] >= 1
    assert len(data["facilities"]) >= 1
    assert "108" in data["emergency_helplines"].values()

def test_fhir_bundle_export():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "ramesh@ayuvsaathi.in",
        "password": DEMO_PATIENT_PASSWORD
    })
    token = login_res.json()["access_token"]
    patient_id = login_res.json()["user"]["patient_id"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get(f"/api/v1/fhir/patient/{patient_id}/bundle", headers=headers)
    assert res.status_code == 200
    bundle = res.json()
    assert bundle["resourceType"] == "Bundle"
    assert bundle["total"] >= 5
    types = [e["resource"]["resourceType"] for e in bundle["entry"]]
    assert "Patient" in types
    assert "Observation" in types
    assert "MedicationRequest" in types
    assert "CarePlan" in types

def test_unified_timeline():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "ramesh@ayuvsaathi.in",
        "password": DEMO_PATIENT_PASSWORD
    })
    token = login_res.json()["access_token"]
    patient_id = login_res.json()["user"]["patient_id"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get(f"/api/v1/timeline/?patient_id={patient_id}", headers=headers)
    assert res.status_code == 200
    timeline = res.json()
    assert timeline["total_events"] >= 8
    event_types = {e["type"] for e in timeline["events"]}
    assert "lab_result" in event_types
    assert "prescription" in event_types
    assert "treatment_plan" in event_types
    assert "vital" in event_types
