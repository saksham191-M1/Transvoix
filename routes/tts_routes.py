import io
import logging
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
import edge_tts
from gtts import gTTS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tts", tags=["tts"])

# Voice mapping for edge-tts Neural voices
EDGE_VOICE_MAP = {
    "en": "en-US-AvaNeural",
    "es": "es-ES-ElviraNeural",
    "fr": "fr-FR-DeniseNeural",
    "de": "de-DE-KatjaNeural",
    "it": "it-IT-ElsaNeural",
    "pt": "pt-PT-RaquelNeural",
    "ja": "ja-JP-NanamiNeural",
    "ko": "ko-KR-SunHiNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "hi": "hi-IN-SwaraNeural",
    "ar": "ar-SA-ZariyahNeural",
    "ru": "ru-RU-SvetlanaNeural",
    "tr": "tr-TR-EmelNeural",
    "vi": "vi-VN-HoaiMyNeural",
    "nl": "nl-NL-ColetteNeural",
    "pl": "pl-PL-ZofiaNeural",
    "sv": "sv-SE-SofieNeural",
    "no": "nb-NO-PernilleNeural",
    "da": "da-DK-ChristelNeural",
    "fi": "fi-FI-NooraNeural"
}

@router.get("")
async def generate_tts(text: str = Query(..., min_length=1), lang: str = Query("en")):
    """
    Generate neural MP3 audio stream for translated text.
    Uses Microsoft Edge Neural voices with gTTS fallback.
    """
    clean_lang = lang.split("-")[0].lower()
    voice = EDGE_VOICE_MAP.get(clean_lang, "en-US-AvaNeural")
    
    # 1. Try Microsoft Edge Neural Voice (High quality, realistic)
    try:
        communicate = edge_tts.Communicate(text, voice)
        audio_data = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data.extend(chunk["data"])
                
        if len(audio_data) > 0:
            return Response(content=bytes(audio_data), media_type="audio/mpeg")
    except Exception as e:
        logger.warning(f"Edge Neural TTS failed for '{clean_lang}' ({e}). Switching to gTTS fallback...")

    # 2. Fallback to gTTS if Edge TTS fails
    try:
        mp3_fp = io.BytesIO()
        tts = gTTS(text=text, lang=clean_lang, slow=False)
        tts.write_to_fp(mp3_fp)
        mp3_fp.seek(0)
        return StreamingResponse(mp3_fp, media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"gTTS fallback error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")
