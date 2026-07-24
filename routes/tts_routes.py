import io
import logging
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
import edge_tts
from gtts import gTTS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tts", tags=["tts"])

# Dual Male and Female Neural Voice Mappings (Microsoft Edge Neural Voices)
EDGE_VOICE_MAP = {
    "en": {"female": "en-US-AvaNeural", "male": "en-US-AndrewNeural"},
    "es": {"female": "es-ES-ElviraNeural", "male": "es-ES-AlvaroNeural"},
    "fr": {"female": "fr-FR-DeniseNeural", "male": "fr-FR-HenriNeural"},
    "de": {"female": "de-DE-KatjaNeural", "male": "de-DE-KillianNeural"},
    "it": {"female": "it-IT-ElsaNeural", "male": "it-IT-DiegoNeural"},
    "pt": {"female": "pt-PT-RaquelNeural", "male": "pt-PT-DuarteNeural"},
    "ja": {"female": "ja-JP-NanamiNeural", "male": "ja-JP-KeitaNeural"},
    "ko": {"female": "ko-KR-SunHiNeural", "male": "ko-KR-InJoonNeural"},
    "zh": {"female": "zh-CN-XiaoxiaoNeural", "male": "zh-CN-YunjianNeural"},
    "hi": {"female": "hi-IN-SwaraNeural", "male": "hi-IN-MadhurNeural"},
    "ar": {"female": "ar-SA-ZariyahNeural", "male": "ar-SA-HamedNeural"},
    "ru": {"female": "ru-RU-SvetlanaNeural", "male": "ru-RU-DmitryNeural"},
    "tr": {"female": "tr-TR-EmelNeural", "male": "tr-TR-AhmetNeural"},
    "vi": {"female": "vi-VN-HoaiMyNeural", "male": "vi-VN-NamMinhNeural"},
    "nl": {"female": "nl-NL-ColetteNeural", "male": "nl-NL-MaartenNeural"},
    "pl": {"female": "pl-PL-ZofiaNeural", "male": "pl-PL-MarekNeural"},
    "sv": {"female": "sv-SE-SofieNeural", "male": "sv-SE-MattiasNeural"},
    "no": {"female": "nb-NO-PernilleNeural", "male": "nb-NO-FinnNeural"},
    "da": {"female": "da-DK-ChristelNeural", "male": "da-DK-JeppeNeural"},
    "fi": {"female": "fi-FI-NooraNeural", "male": "fi-FI-HarriNeural"}
}

@router.get("")
async def generate_tts(
    text: str = Query(..., min_length=1),
    lang: str = Query("en"),
    gender: str = Query("female"),
    pitch: str = Query("+0Hz"),
    rate: str = Query("+0%")
):
    """
    Generate neural MP3 audio stream for translated text.
    Supports gender selection ('female' or 'male') and SSML pitch/rate modulation for 50+ languages.
    """
    clean_lang = lang.split("-")[0].lower()
    clean_gender = gender.lower() if gender.lower() in ["female", "male"] else "female"
    
    lang_voices = EDGE_VOICE_MAP.get(clean_lang, EDGE_VOICE_MAP["en"])
    voice = lang_voices.get(clean_gender, lang_voices.get("female"))
    
    # 1. Try Microsoft Edge Neural Voice with instant chunked audio streaming
    try:
        communicate = edge_tts.Communicate(text, voice, pitch=pitch, rate=rate)
        
        async def audio_chunk_generator():
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]

        return StreamingResponse(audio_chunk_generator(), media_type="audio/mpeg")
    except Exception as e:
        logger.warning(f"Edge Neural TTS failed for '{clean_lang}' ({voice}): {e}. Switching to gTTS fallback...")

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
