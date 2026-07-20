import os
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

class LocalWhisperSTT:
    def __init__(self, model_size: str = "tiny"):
        """
        Local OpenAI Whisper STT Engine.
        Uses faster-whisper to transcribe audio 100% locally with zero API keys.
        Default model_size: 'tiny' or 'base' for fast real-time CPU performance.
        """
        self.model_size = model_size
        self.model = None

    def load_model(self):
        if self.model is None:
            try:
                from faster_whisper import WhisperModel
                logger.info(f"Loading local open-source Whisper model ('{self.model_size}')...")
                self.model = WhisperModel(self.model_size, device="cpu", compute_type="int8")
                logger.info("Local Whisper model loaded successfully!")
            except Exception as e:
                logger.error(f"Failed to load local Whisper model: {e}")

    def transcribe_file(self, audio_file_path: str, language: Optional[str] = None) -> Tuple[str, str]:
        """
        Transcribe local audio file.
        Returns: (transcribed_text, detected_language)
        """
        self.load_model()
        if not self.model or not os.path.exists(audio_file_path):
            return ("", language or "en")

        try:
            segments, info = self.model.transcribe(audio_file_path, language=language, beam_size=5)
            full_text = " ".join([segment.text for segment in segments]).strip()
            return (full_text, info.language)
        except Exception as e:
            logger.error(f"Whisper local transcription error: {e}")
            return ("", language or "en")

# Global local whisper instance
whisper_stt = LocalWhisperSTT(model_size="tiny")
