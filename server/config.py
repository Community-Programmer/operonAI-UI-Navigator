import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 720  # 30 days
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "ui_navigator")

GEMINI_MODEL = "gemini-2.5-flash"

# Model for the live voice agent (must support native audio for bidi-streaming)
LIVE_AGENT_MODEL = os.getenv(
    "LIVE_AGENT_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025"
)

# Google Cloud Storage bucket for session screenshots
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "")

# CORS origins allowed for the web dashboard
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "https://operonai.netlify.app"
]
