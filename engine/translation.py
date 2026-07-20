import logging
from typing import Optional, Dict, List
from functools import lru_cache
from deep_translator import GoogleTranslator
from langdetect import detect, LangDetectException
from config import SUPPORTED_LANGUAGES, settings

logger = logging.getLogger(__name__)

class TranslationEngine:
    def __init__(self):
        # Local cache for custom dictionary overrides per user/dictionary
        # Structure: {dictionary_id: {source_term: target_term}}
        self.dictionaries: Dict[str, Dict[str, str]] = {}

    def load_dictionary(self, dictionary_id: str, entries: List[Dict[str, str]]):
        """Load or update custom dictionary cache."""
        self.dictionaries[dictionary_id] = {
            item["source_term"].lower(): item["target_term"]
            for item in entries
        }

    def unload_dictionary(self, dictionary_id: str):
        """Unload dictionary from cache."""
        if dictionary_id in self.dictionaries:
            del self.dictionaries[dictionary_id]

    def _apply_dictionary(self, text: str, dictionary_id: Optional[str]) -> str:
        """Apply exact dictionary term replacements."""
        if not dictionary_id or dictionary_id not in self.dictionaries:
            return text
        
        words = text.split()
        dict_map = self.dictionaries[dictionary_id]
        
        # Replace matching terms (simple case-insensitive matching)
        for i, word in enumerate(words):
            clean_word = word.strip(".,!?;:()[]\"'")
            lower_word = clean_word.lower()
            if lower_word in dict_map:
                # Replace the clean part of the word and preserve punctuation
                replaced = word.replace(clean_word, dict_map[lower_word])
                words[i] = replaced
                
        return " ".join(words)

    @lru_cache(maxsize=2048)
    def _translate_cached(self, text: str, source: str, target: str) -> str:
        """
        Translate with priority chain:
        1. Grok AI (xAI) — best for slang, context, casual speech
        2. DeepL API     — excellent accuracy for formal language
        3. Google Translate — broad language support
        4. MyMemory      — final fallback
        """
        src_mapped = "zh-CN" if source == "zh" else source
        tgt_mapped = "zh-CN" if target == "zh" else target

        if src_mapped == tgt_mapped:
            return text

        src_clean = src_mapped.split("-")[0].lower()
        tgt_clean = tgt_mapped.split("-")[0].lower()

        # 1. Grok AI (xAI) — context-aware, slang-friendly translation
        if getattr(settings, "GROK_API_KEY", ""):
            try:
                from openai import OpenAI
                client = OpenAI(
                    api_key=settings.GROK_API_KEY,
                    base_url="https://api.x.ai/v1"
                )
                prompt = (
                    f"Translate the following text from {src_clean} to {tgt_clean}. "
                    f"Preserve tone, slang, and casual language naturally. "
                    f"Return ONLY the translated text, no explanations or quotes.\n\n"
                    f"{text}"
                )
                response = client.chat.completions.create(
                    model=settings.GROK_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=500,
                    temperature=0.3
                )
                result = response.choices[0].message.content.strip()
                logger.info(f"Grok translated ({src_clean} -> {tgt_clean}): '{text}' -> '{result}'")
                return result
            except Exception as grok_err:
                logger.warning(f"Grok translation failed ({src_clean} -> {tgt_clean}): {grok_err}. Trying DeepL...")

        # 2. DeepL API
        if getattr(settings, "DEEPL_API_KEY", ""):
            try:
                import deepl
                translator = deepl.Translator(settings.DEEPL_API_KEY)
                src_code = src_clean.upper()
                tgt_code = tgt_clean.upper()
                if tgt_code == "EN":
                    tgt_code = "EN-US"
                result = translator.translate_text(text, source_lang=src_code, target_lang=tgt_code)
                return result.text
            except Exception as deepl_err:
                logger.warning(f"DeepL failed ({src_clean} -> {tgt_clean}): {deepl_err}. Trying Google...")

        # 3. Google Translate
        try:
            translator = GoogleTranslator(source=src_mapped, target=tgt_mapped)
            return translator.translate(text)
        except Exception as google_err:
            logger.warning(f"Google failed ({src_mapped} -> {tgt_mapped}): {google_err}. Trying MyMemory...")

        # 4. MyMemory fallback
        try:
            from deep_translator import MyMemoryTranslator
            mymemory_map = {
                "en": "en-US", "es": "es-ES", "fr": "fr-FR", "de": "de-DE",
                "it": "it-IT", "pt": "pt-PT", "ja": "ja-JP", "ko": "ko-KR",
                "zh": "zh-CN", "hi": "hi-IN", "ar": "ar-SA", "ru": "ru-RU",
                "tr": "tr-TR", "vi": "vi-VN", "nl": "nl-NL", "pl": "pl-PL",
                "sv": "sv-SE", "no": "nb-NO", "da": "da-DK", "fi": "fi-FI"
            }
            src_mymemory = mymemory_map.get(src_clean, "en-US")
            tgt_mymemory = mymemory_map.get(tgt_clean, "en-US")
            translator = MyMemoryTranslator(source=src_mymemory, target=tgt_mymemory)
            return translator.translate(text)
        except Exception as mymemory_err:
            logger.error(f"All translation backends failed ({src_mapped} -> {tgt_mapped}): {mymemory_err}")
            return text

    def translate(self, text: str, source_lang: str, target_lang: str, dictionary_id: Optional[str] = None) -> str:
        """Translate text with custom dictionary override."""
        if not text.strip():
            return text
            
        # 1. Clean language codes (in case of regional codes like en-US, get first part)
        src = source_lang.split("-")[0].lower()
        tgt = target_lang.split("-")[0].lower()

        # If source is auto or empty, try detecting it
        if src == "auto" or not src:
            src = self.detect_language(text) or "en"
            
        if src == tgt:
            return text

        # 2. Check if language is supported, fallback to google's auto detection if source is unrecognized
        if src not in SUPPORTED_LANGUAGES:
            src = "auto"
        if tgt not in SUPPORTED_LANGUAGES:
            tgt = "en"

        # 3. Apply custom dictionary overrides before/after translation if dictionary provided
        # We run it first to check if we can prevent translating custom terms
        processed_text = self._apply_dictionary(text, dictionary_id)
        
        # 4. Perform translation
        translated = self._translate_cached(processed_text, src, tgt)
        
        # Apply dictionary again after translation to ensure terms are correctly mapped in output
        final_text = self._apply_dictionary(translated, dictionary_id)
        
        return final_text

    def detect_language(self, text: str) -> str:
        """Detect the language of the given text."""
        if not text or len(text.strip()) < 3:
            return "en"
        try:
            detected = detect(text)
            return detected.split("-")[0].lower()
        except LangDetectException:
            return "en"

# Global Translation Engine instance
translation_engine = TranslationEngine()
