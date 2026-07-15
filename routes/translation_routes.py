from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from engine.translation import translation_engine
from config import SUPPORTED_LANGUAGES

router = APIRouter(prefix="/api", tags=["translation"])

class TranslationRequest(BaseModel):
    text: str
    source_language: Optional[str] = "auto"
    target_language: str
    dictionary_id: Optional[str] = None

class DetectionRequest(BaseModel):
    text: str

class BatchTranslationItem(BaseModel):
    text: str
    target_language: str
    source_language: Optional[str] = "auto"

class BatchTranslationRequest(BaseModel):
    items: List[BatchTranslationItem]

@router.post("/translate")
async def translate_text(req: TranslationRequest):
    try:
        translated = translation_engine.translate(
            text=req.text,
            source_lang=req.source_language,
            target_lang=req.target_language,
            dictionary_id=req.dictionary_id
        )
        detected = translation_engine.detect_language(req.text) if req.source_language == "auto" else req.source_language
        return {
            "translated_text": translated,
            "detected_language": detected,
            "confidence": 0.95
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/detect")
async def detect_language(req: DetectionRequest):
    try:
        detected = translation_engine.detect_language(req.text)
        return {
            "language": detected,
            "confidence": 0.95
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/languages")
async def get_supported_languages():
    # Return mapping of language code to info
    return [
        {"code": code, "name": info["name"], "flag": info["flag"]}
        for code, info in SUPPORTED_LANGUAGES.items()
    ]
