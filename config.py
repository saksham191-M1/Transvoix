import os
import secrets
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "TransVoix"
    DEBUG: bool = True
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", secrets.token_hex(32))
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database & Storage
    DB_PATH: str = "data/transvoix.db"
    RECORDINGS_DIR: str = "data/recordings"
    
    # Translation
    DEFAULT_TRANSLATION_SERVICE: str = "google"  # google, mymemory, deepl, grok
    DEEPL_API_KEY: str = os.getenv("DEEPL_API_KEY", "")
    GROK_API_KEY: str = os.getenv("GROK_API_KEY", "")
    GROK_MODEL: str = os.getenv("GROK_MODEL", "grok-3-mini")
    CONFIDENCE_THRESHOLD: float = 0.5
    
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()

# Supported Languages (ISO 639-1 code -> Name, Flag emoji)
SUPPORTED_LANGUAGES = {
    "en": {"name": "English", "flag": "🇺🇸"},
    "es": {"name": "Spanish", "flag": "🇪🇸"},
    "fr": {"name": "French", "flag": "🇫🇷"},
    "de": {"name": "German", "flag": "🇩🇪"},
    "it": {"name": "Italian", "flag": "🇮🇹"},
    "pt": {"name": "Portuguese", "flag": "🇵🇹"},
    "ja": {"name": "Japanese", "flag": "🇯🇵"},
    "ko": {"name": "Korean", "flag": "🇰🇷"},
    "zh": {"name": "Chinese (Simplified)", "flag": "🇨🇳"},
    "hi": {"name": "Hindi", "flag": "🇮🇳"},
    "ar": {"name": "Arabic", "flag": "🇸🇦"},
    "ru": {"name": "Russian", "flag": "🇷🇺"},
    "tr": {"name": "Turkish", "flag": "🇹🇷"},
    "vi": {"name": "Vietnamese", "flag": "🇻🇳"},
    "nl": {"name": "Dutch", "flag": "🇳🇱"},
    "pl": {"name": "Polish", "flag": "🇵🇱"},
    "sv": {"name": "Swedish", "flag": "🇸🇪"},
    "no": {"name": "Norwegian", "flag": "🇳🇴"},
    "da": {"name": "Danish", "flag": "🇩🇰"},
    "fi": {"name": "Finnish", "flag": "🇫🇮"}
}

# Ensure data directories exist
os.makedirs(os.path.dirname(settings.DB_PATH), exist_ok=True)
os.makedirs(settings.RECORDINGS_DIR, exist_ok=True)
