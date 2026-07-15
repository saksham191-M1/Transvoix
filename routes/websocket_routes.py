import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from engine.session_manager import session_manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websockets"])

@router.websocket("/ws/session/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, participant_id: str, 
                             display_name: str, spoken_lang: str = "en", listening_lang: str = "en"):
    """
    WebSocket endpoint for real-time speech translation and routing.
    Query parameters:
    - participant_id: Unique string identifier for client
    - display_name: Nickname
    - spoken_lang: Sender's language code
    - listening_lang: Receiver's preferred language code
    """
    await session_manager.connect(
        session_id=session_id,
        participant_id=participant_id,
        display_name=display_name,
        spoken_lang=spoken_lang,
        listening_lang=listening_lang,
        websocket=websocket
    )
    
    try:
        while True:
            # Maintain active communication
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            payload = message.get("payload", {})
            
            if msg_type == "speech":
                text = payload.get("text", "")
                is_final = payload.get("is_final", True)
                await session_manager.handle_speech(
                    session_id=session_id,
                    sender_id=participant_id,
                    text=text,
                    is_final=is_final
                )
            elif msg_type == "language_change":
                new_spoken = payload.get("spoken_lang")
                new_listen = payload.get("listening_lang")
                
                from engine.language_negotiator import language_negotiator
                if new_spoken:
                    language_negotiator.update_spoken_language(session_id, participant_id, new_spoken)
                if new_listen:
                    language_negotiator.update_listening_language(session_id, participant_id, new_listen)
                    
                # Broadcast language update notification
                update_event = {
                    "type": "language_updated",
                    "payload": {
                        "participant_id": participant_id,
                        "spoken_lang": new_spoken or spoken_lang,
                        "listening_lang": new_listen or listening_lang
                    }
                }
                await session_manager.broadcast_raw(session_id, update_event)
                
    except WebSocketDisconnect:
        await session_manager.disconnect(session_id, participant_id)
    except Exception as e:
        logger.error(f"WebSocket error in session {session_id} for participant {participant_id}: {e}")
        await session_manager.disconnect(session_id, participant_id)
