from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, status, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from engine.recording_manager import recording_manager

router = APIRouter(prefix="/api/recordings", tags=["recordings"])

class RecordingSave(BaseModel):
    session_id: str
    user_id: str
    title: str
    duration_seconds: int
    transcript_entries: List[Dict[str, Any]]

@router.post("", status_code=status.HTTP_201_CREATED)
async def save_session_recording(data: RecordingSave):
    try:
        recording_id = await recording_manager.save_recording(
            session_id=data.session_id,
            user_id=data.user_id,
            title=data.title,
            duration_seconds=data.duration_seconds,
            transcript_entries=data.transcript_entries
        )
        return {"id": recording_id, "message": "Recording saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
async def list_user_recordings(user_id: str):
    return await recording_manager.get_recordings(user_id)

@router.get("/{rec_id}")
async def get_recording_detail(rec_id: str, user_id: str):
    rec = await recording_manager.get_recording(rec_id, user_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    return rec

@router.get("/{rec_id}/export")
async def export_recording(rec_id: str, user_id: str, format: str = Query("srt")):
    rec = await recording_manager.get_recording(rec_id, user_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
        
    if format == "srt":
        srt_content = recording_manager.export_srt(rec["transcript"])
        return PlainTextResponse(content=srt_content, media_type="text/srt")
    elif format == "txt":
        txt_lines = []
        for entry in rec["transcript"]:
            txt_lines.append(f"{entry.get('speaker', 'Unknown')}: {entry.get('text', '')}")
        return PlainTextResponse(content="\n".join(txt_lines), media_type="text/plain")
    else:
        raise HTTPException(status_code=400, detail="Invalid export format. Choose srt or txt.")
