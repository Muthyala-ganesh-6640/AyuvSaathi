from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
import time

from backend.app.core.config import settings
from backend.app.core.database import engine

from backend.app.api.v1 import (
    auth, patients, documents, labs, prescriptions, treatment_plans,
    assessments, conversations, analytics, reminders, hospitals,
    consent, audit, fhir, timeline
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AyuvSaathi - Your Lifelong Health Companion. Integrated backend APIs for medical document intelligence, clinical decision support, unified timeline, reminders, analytics, and FHIR interoperability.",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Timing & Safety Middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(round(process_time, 4))
    response.headers["X-Powered-By"] = "AyuvSaathi Healthcare Informatics Engine"
    return response

# Include all V1 Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(patients.router, prefix=settings.API_V1_STR)
app.include_router(documents.router, prefix=settings.API_V1_STR)
app.include_router(labs.router, prefix=settings.API_V1_STR)
app.include_router(prescriptions.router, prefix=settings.API_V1_STR)
app.include_router(treatment_plans.router, prefix=settings.API_V1_STR)
app.include_router(assessments.router, prefix=settings.API_V1_STR)
app.include_router(conversations.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(reminders.router, prefix=settings.API_V1_STR)
app.include_router(hospitals.router, prefix=settings.API_V1_STR)
app.include_router(consent.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(fhir.router, prefix=settings.API_V1_STR)
app.include_router(timeline.router, prefix=settings.API_V1_STR)

@app.get("/api/health", tags=["Health"])
def health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable.") from exc

    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "tagline": settings.PROJECT_TAGLINE,
        "version": settings.VERSION,
        "database": "connected",
        "modules_active": [
            "1. Lab Report Intelligence",
            "2. Treatment Plan Management",
            "3. Unified Medical Records",
            "4. AI Diagnosis Support",
            "5. Patient Analytics Dashboard",
            "6. AI Health Chatbot & Summaries",
            "7. AI Prescription Analyzer",
            "8. Medicine Alarm & Reminders",
            "9. Nearby Hospitals & Clinics"
        ]
    }

@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Welcome to AyuvSaathi - Your Lifelong Health Companion API",
        "tagline": "Your Lifelong Health Companion",
        "docs": "/docs",
        "health": "/api/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
