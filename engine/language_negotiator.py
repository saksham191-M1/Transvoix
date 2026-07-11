from typing import Dict, List, Set, Optional
from pydantic import BaseModel

class ParticipantLanguageProfile(BaseModel):
    participant_id: str
    native_lang: str = "en"
    spoken_lang: str = "en"
    listening_lang: str = "en"
    auto_detect_enabled: bool = True
    confidence_score: float = 1.0

class LanguageNegotiator:
    def __init__(self):
        # Cache of active session profiles: {session_id: {participant_id: ParticipantLanguageProfile}}
        self.session_profiles: Dict[str, Dict[str, ParticipantLanguageProfile]] = {}

    def register_participant(self, session_id: str, participant_id: str, profile: ParticipantLanguageProfile):
        if session_id not in self.session_profiles:
            self.session_profiles[session_id] = {}
        self.session_profiles[session_id][participant_id] = profile

    def remove_participant(self, session_id: str, participant_id: str):
        if session_id in self.session_profiles and participant_id in self.session_profiles[session_id]:
            del self.session_profiles[session_id][participant_id]
            if not self.session_profiles[session_id]:
                del self.session_profiles[session_id]

    def get_profile(self, session_id: str, participant_id: str) -> Optional[ParticipantLanguageProfile]:
        return self.session_profiles.get(session_id, {}).get(participant_id)

    def update_spoken_language(self, session_id: str, participant_id: str, language: str, confidence: float = 1.0):
        profile = self.get_profile(session_id, participant_id)
        if profile:
            profile.spoken_lang = language
            profile.confidence_score = confidence

    def update_listening_language(self, session_id: str, participant_id: str, language: str):
        profile = self.get_profile(session_id, participant_id)
        if profile:
            profile.listening_lang = language

    def negotiate_routes(self, session_id: str, sender_id: str) -> Dict[str, str]:
        """
        Compute the translation routing matrix for a message sent by sender_id.
        Returns a dictionary mapping: participant_id -> target_language
        This determines which language each participant in the room should receive.
        """
        routes = {}
        profiles = self.session_profiles.get(session_id, {})
        sender_profile = profiles.get(sender_id)
        
        if not sender_profile:
            return routes

        source_lang = sender_profile.spoken_lang

        for part_id, profile in profiles.items():
            if part_id == sender_id:
                continue  # Sender doesn't need translation of their own speech
            
            target_lang = profile.listening_lang
            if source_lang != target_lang:
                routes[part_id] = target_lang
            else:
                # No translation needed, source is same as listening language
                routes[part_id] = source_lang
                
        return routes

    def get_required_translations(self, session_id: str, sender_id: str) -> Set[str]:
        """
        Determine the unique target languages required for a message from sender_id.
        Useful for translating a single message once and distributing it to multiple people.
        """
        profiles = self.session_profiles.get(session_id, {})
        sender_profile = profiles.get(sender_id)
        
        if not sender_profile:
            return set()

        source_lang = sender_profile.spoken_lang
        target_languages = set()

        for part_id, profile in profiles.items():
            if part_id == sender_id:
                continue
            if profile.listening_lang != source_lang:
                target_languages.add(profile.listening_lang)
                
        return target_languages

# Global Negotiator instance
language_negotiator = LanguageNegotiator()
