import os
import secrets
import warnings
from typing import List

class Settings:
    PROJECT_NAME: str = "AyuvSaathi"
    PROJECT_TAGLINE: str = "Your Lifelong Health Companion"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # MySQL Database Configuration
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "mysql+pymysql://root:root123@localhost:3306/ayuvsaathi?charset=utf8mb4"
    )
    
    # JWT & Auth
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").strip().lower()
    SECRET_KEY: str = os.getenv("SECRET_KEY", "").strip()
    if not SECRET_KEY:
        if ENVIRONMENT in {"production", "prod"}:
            raise RuntimeError("SECRET_KEY must be configured in production.")
        SECRET_KEY = secrets.token_urlsafe(48)
        warnings.warn(
            "SECRET_KEY is not configured; using a temporary development key. "
            "Set SECRET_KEY to keep sessions valid across restarts.",
            RuntimeWarning,
            stacklevel=2,
        )
    if ENVIRONMENT in {"production", "prod"} and len(SECRET_KEY) < 32:
        raise RuntimeError("SECRET_KEY must be at least 32 characters in production.")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    _default_cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    _configured_cors_origins = os.getenv("BACKEND_CORS_ORIGINS", "").strip()
    BACKEND_CORS_ORIGINS: List[str] = (
        [origin.strip().rstrip("/") for origin in _configured_cors_origins.split(",") if origin.strip()]
        if _configured_cors_origins
        else _default_cors_origins
    )
    if not BACKEND_CORS_ORIGINS or "*" in BACKEND_CORS_ORIGINS:
        raise ValueError("BACKEND_CORS_ORIGINS must contain explicit origins; wildcard origins are not allowed.")
    
    # Upload storage
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", os.path.join(os.getcwd(), "uploads"))
    MAX_UPLOAD_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB
    
    # External Cloud & GPT AI Configuration
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "openai").lower()
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", os.getenv("AI_API_KEY", ""))
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    AI_MODEL: str = os.getenv("AI_MODEL", "gpt-4o-mini")
    AI_BASE_URL: str = os.getenv("AI_BASE_URL", "")
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")

settings = Settings()
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
