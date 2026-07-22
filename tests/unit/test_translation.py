import pytest
from engine.translation import translation_engine

def test_language_detection():
    # Test common language detection
    assert translation_engine.detect_language("Hello how are you doing today?") == "en"
    assert translation_engine.detect_language("Hola como estas hoy?") == "es"
    assert translation_engine.detect_language("Bonjour comment ça va?") == "fr"

def test_translation_basic():
    # GoogleTranslator is mocked in conftest.py to return f"[Translated: {text}]"
    res = translation_engine.translate("Hello", "en", "es")
    assert res == "[Translated: Hello]"
    
    # Translating same source/target should bypass translator and return original
    res_same = translation_engine.translate("Hello", "en", "en")
    assert res_same == "Hello"

def test_translation_with_dictionary_overrides():
    dict_id = "test-dict-1"
    # Load test entries
    translation_engine.load_dictionary(dict_id, [
        {"source_term": "plaintiff", "target_term": "Demandante"}
    ])
    
    # Translate text containing the override term
    res = translation_engine.translate("The plaintiff filed a lawsuit", "en", "es", dictionary_id=dict_id)
    assert "Demandante" in res
    
    # Cleanup dictionary
    translation_engine.unload_dictionary(dict_id)
