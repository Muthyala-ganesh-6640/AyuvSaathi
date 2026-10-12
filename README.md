# AyuvSaathi (ఆయువ్ సాథీ)
### Your Lifelong Health Companion

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![MySQL 8](https://img.shields.io/badge/Database-MySQL%208-4479A1.svg?logo=mysql&logoColor=white)](https://www.mysql.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black.svg?logo=next.js&logoColor=white)](https://nextjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Trilingual](https://img.shields.io/badge/Languages-English%20%7C%20Telugu%20%7C%20Hindi-blue.svg)](#multilingual-architecture)
[![FHIR R4](https://img.shields.io/badge/Standard-FHIR%20R4%20Ready-orange.svg)](#fhir-interoperability)

**AyuvSaathi** ("Your Lifelong Health Companion") is an integrated, AI-powered personal healthcare and clinical decision-support platform designed to help individuals and families understand, organize, and manage their health journey across their lifespan.

Healthcare information is often fragmented across handwritten prescriptions, complex laboratory reports, hospital discharge summaries, diagnostic imaging, and verbal consultations. AyuvSaathi unifies these scattered records into a single, secure, patient-centric ecosystem with cautious, evidence-linked clinical intelligence, medication alarms, real nearby care discovery, and native bilingual English & Telugu support.

---

## 🌟 Nine Major Functional Modules

### 1. Lab Report Intelligence
- **Multi-Format Processing**: Upload PDF, PNG, or JPEG reports (up to 15MB).
- **OCR & Document Extraction**: Digital text extraction via PyMuPDF with OpenCV contrast enhancement and adaptive thresholding fallback.
- **Structured Test Detection**: Automatically isolates Test Name, Measured Value, Unit, Reference Range, and Abnormal Flags (HIGH/LOW/NORMAL).
- **Mandatory Verification Gate**: Extracted lab values require explicit user review and confirmation before joining permanent health history.
- **Clinical Accuracy**: Reference ranges are never fabricated. Missing ranges are transparently labeled as unavailable.
- **Historical Comparison Trends**: Longitudinal test tracking over time (FBS, HbA1c, Lipids, Creatinine).

### 2. Treatment Plan Management
- **Structured Care Plans**: Document clinician-prescribed treatment instructions, indications, and goals.
- **Milestone & Follow-up Tracking**: Monitor scheduled follow-up dates and status transitions (`active`, `completed`, `planned`, `discontinued`).
- **Complete Audit Trail**: Event logging for every plan change or patient-reported progress note.
- **Clinician Confirmation**: Clear distinction between clinician-authorized instructions and patient notes.

### 3. Unified Medical Records & Health Timeline
- **Chronological Timeline**: Unified view across Lab Reports, Prescriptions, Care Plans, Vitals/Measurements, and Consultations.
- **Source-Grounded Provenance Badges**: Every record explicitly distinguishes its source:
  - 🟢 `Clinician Confirmed`
  - 🔵 `Source Document (Extracted)`
  - 🟣 `AI Generated (User Approved)`
  - 🟠 `Patient Reported`
- **Instant Search & Category Filters**: Search by test, medicine, date, or category with secure file preview and download.

### 4. Cautious AI Diagnosis Support
- **Evidence-Linked Clinical Guidance**: Synthesizes user concerns strictly against confirmed lab results and active prescriptions.
- **Targeted Doctor Consultation Questions**: Generates 4+ targeted questions for the patient's next clinical visit.
- **Automated Emergency Red-Flag Triage**: Detects critical symptoms (acute chest pain, respiratory distress, stroke warning signs) and provides immediate emergency guidance with direct lines to **108 (Ambulance)** and **112 (National Emergency)** in India.
- **Prominent Medical Disclaimer**: Strictly educational; never prescribes or alters medication.

### 5. Patient Analytics Dashboard
- **Executive Metric Cards**: Total documents, pending reviews, active treatment plans, upcoming reminders, and adherence rate.
- **Longitudinal Trend Charts**: Dynamic charts showing metrics like Fasting Blood Sugar, HbA1c, and Cholesterol.
- **Vitals Tracking**: Blood pressure (Systolic/Diastolic), heart rate, glucose, weight, and SpO2.
- **Adherence Analytics**: Weekly dose compliance percentages based on real user actions.

### 6. AI Health Chatbot & Conversation Summaries
- **Bilingual Conversations**: Native Telugu (తెలుగు) and English health Q&A grounded in verified records.
- **Educational Explanations**: Explains medical terminology without changing clinical meaning.
- **Structured Summary Drafting**: Generates structured consultation drafts with main concern, symptoms, duration, and doctor questions.
- **User Approval Gate**: Summaries are only added to medical records after explicit patient verification and editing.

### 7. AI Prescription Analyzer
- **OCR Prescription Parsing**: Extracts Medicine Name, Prescribed Dosage, Route, Frequency, and Duration.
- **Handwriting Safety**: Ambiguous terms are flagged for review rather than guessed.
- **Duplicate & Interaction Checks**: Flags duplicate active substances.
- **One-Click Reminder Conversion**: Direct pathway from verified prescription to active medication alarms.

### 8. Medicine Alarm & Reminder System
- **Timezone-Aware Daily Reminders**: Supports Indian Standard Time (`Asia/Kolkata`) schedules.
- **Action Logging**: Log daily doses with **Taken**, **Snoozed**, or **Skipped** actions.
- **Today's Dose Schedule**: Chronological daily list with real-time progress counter.
- **Adherence History**: Tracks self-reported dose compliance over time.

### 9. Nearby Hospitals & Clinics Discovery
- **OpenStreetMap Overpass Live Integration**: Queries real facilities within a user-specified radius.
- **Location Flexibility**: Supports browser GPS coordinates, city name search, or postal PIN code.
- **Verified Offline Healthcare Directory**: Top multispecialty institutions across Hyderabad, Vijayawada, Visakhapatnam, and AP/Telangana.
- **Emergency Helplines Banner**: Immediate access to 112 (National Emergency), 108 (Medical/Ambulance), and 14416 (Tele-MANAS).

---

## 🏛 Technical Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │           AyuvSaathi Web Frontend            │
                  │   Next.js 15 App Router | React 19 | Vite    │
                  │   Tailwind CSS | Recharts | Lucide | i18n    │
                  └──────────────────────┬───────────────────────┘
                                         │ Reverse Proxy /api/v1
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │           FastAPI Backend Server             │
                  │        Python 3.10 | Pydantic V2             │
                  │      51 REST Endpoints | OpenAPI Docs        │
                  └──────┬───────────────┬────────────────┬──────┘
                         │               │                │
            ┌────────────┴───┐    ┌──────┴─────────┐    ┌─┴────────────────┐
            │   AI & OCR     │    │  FHIR R4 Layer │    │  OpenStreetMap   │
            │ PyMuPDF | CV2  │    │ Patient, Obs,  │    │ Overpass API &   │
            │ Tesseract | AI │    │ MedReq, Plan   │    │ Geocoding Engine │
            └────────────────┘    └────────────────┘    └──────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │             MySQL 8 Database                 │
                  │   SQLAlchemy 2 ORM | Alembic Migrations      │
                  │   23 Normalized Tables | Strict Foreign Keys │
                  └──────────────────────────────────────────────┘
```

---

## 🗄 MySQL Database Schema (23 Tables)

AyuvSaathi uses **MySQL 8** as its primary persistent source of truth:

1. `users`: Authentication credentials, bcrypt hashes, language preferences.
2. `roles`: Role definitions (`patient`, `doctor`, `caregiver`, `admin`).
3. `user_roles`: Many-to-many role association.
4. `patients`: Core patient demographics, ABHA identifiers, emergency contacts.
5. `patient_access_permissions`: Granular cross-patient authorization and doctor access.
6. `patient_consents`: Explicit consent tracking for AI processing and data sharing.
7. `medical_documents`: Document metadata, storage paths, file hashes, OCR status.
8. `extracted_records`: Raw OCR structured outputs and verification review logs.
9. `lab_results`: Normalized laboratory measurements with reference ranges & abnormal flags.
10. `prescriptions`: Prescriber, clinic, date, and verification status.
11. `prescription_items`: Individual medicine names, strengths, routes, frequencies, and durations.
12. `treatment_plans`: Authorized care instructions, indications, and follow-up schedules.
13. `treatment_plan_events`: Complete audit log of care plan updates and progress reports.
14. `patient_measurements`: Self-monitored vital signs (BP, Heart Rate, Glucose, SpO2).
15. `conversations`: Chat sessions with language selection.
16. `conversation_messages`: Multi-turn conversational memory with source references.
17. `conversation_summaries`: User-approved consultation summaries.
18. `ai_assessments`: Cautious clinical assessments with source records and doctor questions.
19. `medication_schedules`: Active medication alarm configurations and daily dose times.
20. `medication_reminders`: Individual scheduled reminder slots.
21. `medication_adherence_logs`: Patient-reported dose responses (`taken`, `skipped`, `snoozed`).
22. `appointments`: Clinical consultation and diagnostic follow-up calendar.
23. `audit_logs`: Immutable security audit trail recording all access and modifications.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ or 20+
- Python 3.10+
- MySQL Server 8.0 (running locally on port 3306)

### 1. Database Configuration
Ensure MySQL 8 is running and create the database:
```sql
CREATE DATABASE IF NOT EXISTS ayuvsaathi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend Setup
```bash
# Install Python dependencies
pip install fastapi uvicorn sqlalchemy pymysql alembic pymupdf pyjwt bcrypt python-dotenv httpx python-multipart cryptography pytest pytest-asyncio email-validator

# Configure a stable, private signing key before running in production.
# Keep this value secret and do not commit it.
# Linux/macOS:
export SECRET_KEY="replace-with-a-unique-random-value-at-least-32-characters-long"
export ENVIRONMENT="production"
# Windows PowerShell:
# $env:SECRET_KEY = "replace-with-a-unique-random-value-at-least-32-characters-long"
# $env:ENVIRONMENT = "production"

# Set local-only passwords before seeding the optional MySQL demo accounts.
# Do not commit these values or reuse real account passwords.
# Linux/macOS:
export DEMO_PATIENT_PASSWORD="choose-a-unique-password-at-least-12-characters"
export DEMO_DOCTOR_PASSWORD="choose-a-different-password-at-least-12-characters"
# Windows PowerShell:
# $env:DEMO_PATIENT_PASSWORD = "choose-a-unique-password-at-least-12-characters"
# $env:DEMO_DOCTOR_PASSWORD = "choose-a-different-password-at-least-12-characters"

# Run Alembic migrations to initialize schema
alembic upgrade head

# Seed synthetic Indian clinical demo records
python backend/seed_demo_data.py

# Run FastAPI backend server (Port 8000)
python backend/app/main.py
```
*The interactive API documentation is available at `http://localhost:8000/docs`.*

### 3. Frontend Setup
```bash
# Install Node dependencies
npm install

# Run frontend development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing Suite

### Running Backend Tests
Execute the comprehensive Pytest suite covering all 9 modules, security isolation, and FHIR export:
```bash
pytest backend/tests/test_backend.py -v
```
**Results:** `14 passed in 5.28s (100% pass rate)`

### Running Frontend Tests
```bash
npm test
```
**Results:** `15 passed in 1.99s (100% pass rate)`

---

## 🇮🇳 Multilingual Architecture

AyuvSaathi was built from day one for Indian healthcare diversity:
- **English (`en`)**: Comprehensive medical terminology and professional summaries.
- **Telugu (`te` - తెలుగు)**: Native UI translation, regional chatbot reasoning, and terminology explanations.
- **Hindi (`hi` - हिन्दी)**: Accessible interface for North Indian demographics.
- **Preservation of Clinical Integrity**: Changing languages never alters underlying laboratory numbers, units, or prescribed dosages.

---

## 🏥 FHIR R4 Interoperability

AyuvSaathi provides a dedicated FHIR R4 mapping layer:
- `GET /api/v1/fhir/Patient/{id}`: Maps patient demographics and ABHA mock identifier.
- `GET /api/v1/fhir/patient/{id}/bundle`: Exports a standard FHIR R4 Collection Bundle containing:
  - `Patient` resource
  - `Observation` resources (with LOINC / standard laboratory reference ranges)
  - `MedicationRequest` resources (dosage instructions and routes)
  - `CarePlan` resources (active clinical treatment plans)

---

## 🔒 Security & Privacy Features

- **Strict Access Control**: Granular patient record isolation preventing unauthorized access.
- **Zero Plaintext Passwords**: Bcrypt adaptive password hashing.
- **Secure File Handling**: Content-Type validation, size limit enforcement (15MB), and isolated storage.
- **Comprehensive Audit Trail**: Every sensitive record access and modification is logged in the `audit_logs` table.
- **Strict Clinical Disclaimers**: AI outputs are clearly identified as informational decision support and never replace certified medical doctors.

---

## 🏆 Hackathon Presentation & Demo Data

The optional MySQL seeder creates synthetic patient and doctor profiles. Configure
unique local-only `DEMO_PATIENT_PASSWORD` and `DEMO_DOCTOR_PASSWORD` values before
running it. The frontend's demo-data action adds clearly labeled synthetic records
to the signed-in user's local profile.

**Official Tagline: “Your Lifelong Health Companion”**
