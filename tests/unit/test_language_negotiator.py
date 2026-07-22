import pytest
from engine.language_negotiator import language_negotiator, ParticipantLanguageProfile

def test_participant_registration():
    session_id = "session-123"
    part_id = "user-abc"
    profile = ParticipantLanguageProfile(
        participant_id=part_id,
        native_lang="en",
        spoken_lang="en",
        listening_lang="es"
    )
    
    language_negotiator.register_participant(session_id, part_id, profile)
    
    retrieved = language_negotiator.get_profile(session_id, part_id)
    assert retrieved is not None
    assert retrieved.spoken_lang == "en"
    assert retrieved.listening_lang == "es"
    
    # Cleanup
    language_negotiator.remove_participant(session_id, part_id)
    assert language_negotiator.get_profile(session_id, part_id) is None

def test_route_negotiation_matrix():
    session_id = "session-456"
    
    # Register 3 participants
    # User A: Speaks English, wants to hear Spanish
    profile_a = ParticipantLanguageProfile(participant_id="a", native_lang="en", spoken_lang="en", listening_lang="es")
    # User B: Speaks Spanish, wants to hear English
    profile_b = ParticipantLanguageProfile(participant_id="b", native_lang="es", spoken_lang="es", listening_lang="en")
    # User C: Speaks English, wants to hear English
    profile_c = ParticipantLanguageProfile(participant_id="c", native_lang="en", spoken_lang="en", listening_lang="en")
    
    language_negotiator.register_participant(session_id, "a", profile_a)
    language_negotiator.register_participant(session_id, "b", profile_b)
    language_negotiator.register_participant(session_id, "c", profile_c)
    
    # 1. User A speaks (English)
    routes = language_negotiator.negotiate_routes(session_id, "a")
    assert routes["b"] == "en"  # User B hears English (or translates from English, depending on logic)
    # Wait, in the negotiate_routes implementation:
    # "target_lang = profile.listening_lang. If source_lang != target_lang: routes[part_id] = target_lang else: routes[part_id] = source_lang"
    # Let's verify routes mapping:
    # User A spoken_lang is "en".
    # For User B (listening_lang is "en"): target_lang is "en". source_lang == target_lang, so routes["b"] == "en".
    # For User C (listening_lang is "en"): target_lang is "en". source_lang == target_lang, so routes["c"] == "en".
    assert routes["b"] == "en"
    assert routes["c"] == "en"
    
    # Check unique targets
    targets = language_negotiator.get_required_translations(session_id, "a")
    # User B listening_lang is "en" (same as A's spoken), User C is "en" (same).
    # Unique translation targets required: empty set since everyone listens in English!
    assert len(targets) == 0

    # 2. Change User B's listening language to Japanese
    language_negotiator.update_listening_language(session_id, "b", "ja")
    targets_updated = language_negotiator.get_required_translations(session_id, "a")
    assert "ja" in targets_updated
    
    # Cleanup
    language_negotiator.remove_participant(session_id, "a")
    language_negotiator.remove_participant(session_id, "b")
    language_negotiator.remove_participant(session_id, "c")
