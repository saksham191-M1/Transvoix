import json
import logging
import asyncio
from typing import Dict, List, Set, Any
from fastapi import WebSocket
from engine.language_negotiator import language_negotiator, ParticipantLanguageProfile
from engine.translation import translation_engine
from engine.adaptive_learner import adaptive_learner

logger = logging.getLogger(__name__)

class SessionManager:
    def __init__(self):
        # Map: session_id -> { participant_id -> WebSocket }
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # Map: session_id -> { participant_id -> display_name }
        self.participant_names: Dict[str, Dict[str, str]] = {}
        # Map: session_id -> dictionary_id (for custom dictionary overrides)
        self.session_dictionaries: Dict[str, str] = {}

    async def connect(self, session_id: str, participant_id: str, display_name: str, 
                      spoken_lang: str, listening_lang: str, websocket: WebSocket):
        await websocket.accept()
        
        if session_id not in self.active_connections:
            self.active_connections[session_id] = {}
            self.participant_names[session_id] = {}

        self.active_connections[session_id][participant_id] = websocket
        self.participant_names[session_id][participant_id] = display_name

        # Register language profile
        profile = ParticipantLanguageProfile(
            participant_id=participant_id,
            native_lang=spoken_lang,
            spoken_lang=spoken_lang,
            listening_lang=listening_lang
        )
        language_negotiator.register_participant(session_id, participant_id, profile)

        # Notify others
        join_event = {
            "type": "participant_joined",
            "payload": {
                "participant": {
                    "id": participant_id,
                    "display_name": display_name,
                    "language": spoken_lang
                },
                "participant_count": len(self.active_connections[session_id])
            }
        }
        await self.broadcast_raw(session_id, join_event, exclude_id=participant_id)
        
        # Send current participants info to the newly joined user
        current_participants = []
        for pid, name in self.participant_names[session_id].items():
            p_profile = language_negotiator.get_profile(session_id, pid)
            current_participants.append({
                "id": pid,
                "display_name": name,
                "language": p_profile.spoken_lang if p_profile else "en"
            })
            
        welcome_payload = {
            "type": "auth_success",
            "payload": {
                "participant_id": participant_id,
                "participants": current_participants,
                "session": {"id": session_id}
            }
        }
        await websocket.send_text(json.dumps(welcome_payload))

    async def disconnect(self, session_id: str, participant_id: str):
        if session_id in self.active_connections and participant_id in self.active_connections[session_id]:
            # Close connection if open
            websocket = self.active_connections[session_id][participant_id]
            try:
                await websocket.close()
            except Exception:
                pass
            
            del self.active_connections[session_id][participant_id]
            
            display_name = self.participant_names[session_id].get(participant_id, "Unknown")
            if participant_id in self.participant_names[session_id]:
                del self.participant_names[session_id][participant_id]
                
            language_negotiator.remove_participant(session_id, participant_id)

            # Broadcast leave
            leave_event = {
                "type": "participant_left",
                "payload": {
                    "participant_id": participant_id,
                    "display_name": display_name,
                    "reason": "left",
                    "participant_count": len(self.active_connections.get(session_id, {}))
                }
            }
            await self.broadcast_raw(session_id, leave_event)

            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
                del self.participant_names[session_id]
                if session_id in self.session_dictionaries:
                    del self.session_dictionaries[session_id]

    def set_session_dictionary(self, session_id: str, dictionary_id: str):
        """Set a custom dictionary for a session."""
        self.session_dictionaries[session_id] = dictionary_id

    async def broadcast_raw(self, session_id: str, message: dict, exclude_id: str = None):
        """Send message as-is to all sockets in session."""
        if session_id not in self.active_connections:
            return
            
        payload = json.dumps(message)
        for pid, websocket in self.active_connections[session_id].items():
            if exclude_id and pid == exclude_id:
                continue
            try:
                await websocket.send_text(payload)
            except Exception as e:
                logger.error(f"Error broadcasting to {pid}: {e}")

    async def handle_speech(self, session_id: str, sender_id: str, text: str, is_final: bool = True):
        """
        Handle incoming speech text from sender_id.
        Negotiate routes, perform translations, and stream customized payloads to each participant.
        """
        if session_id not in self.active_connections or sender_id not in self.active_connections[session_id]:
            return

        sender_name = self.participant_names[session_id].get(sender_id, "Unknown")
        sender_profile = language_negotiator.get_profile(session_id, sender_id)
        
        if not sender_profile:
            return

        source_lang = sender_profile.spoken_lang
        dictionary_id = self.session_dictionaries.get(session_id)

        # 1. Determine target languages needed
        target_langs = language_negotiator.get_required_translations(session_id, sender_id)
        
        # 2. Perform translation for each required target language once
        async def _translate_lang(lang):
            translated = await asyncio.to_thread(
                translation_engine.translate, text, source_lang, lang, dictionary_id
            )
            if not sender_id.startswith("guest_"):
                asyncio.create_task(adaptive_learner.record_translation_use(sender_id, source_lang, lang))
            return lang, translated

        if target_langs:
            results = await asyncio.gather(*[_translate_lang(lang) for lang in target_langs])
            translations = dict(results)
        else:
            translations = {}

        # 3. Deliver customized messages to each participant
        for pid, websocket in self.active_connections[session_id].items():
            # If the user is the sender, send them their original transcript
            if pid == sender_id:
                response = {
                    "type": "caption",
                    "payload": {
                        "speaker": sender_name,
                        "text": text,
                        "is_final": is_final
                    }
                }
            else:
                # Get the translated text for this participant's listening language
                receiver_profile = language_negotiator.get_profile(session_id, pid)
                listen_lang = receiver_profile.listening_lang if receiver_profile else "en"
                
                # If translation exists, send it, otherwise send original
                display_text = translations.get(listen_lang, text)
                
                if is_final:
                    response = {
                        "type": "translation",
                        "payload": {
                            "speaker": sender_name,
                            "original": text,
                            "translated": display_text,
                            "source_lang": source_lang,
                            "target_lang": listen_lang,
                            "confidence": sender_profile.confidence_score,
                            "emotion": "neutral",
                            "timestamp": ""
                        }
                    }
                else:
                    response = {
                        "type": "caption",
                        "payload": {
                            "speaker": sender_name,
                            "text": display_text,
                            "is_final": False
                        }
                    }
                    
            try:
                await websocket.send_text(json.dumps(response))
            except Exception as e:
                logger.error(f"Error sending payload to {pid}: {e}")

# Global Session Manager instance
session_manager = SessionManager()
