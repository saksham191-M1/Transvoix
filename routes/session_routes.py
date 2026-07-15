import uuid
import random
import string
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from engine.database import get_db

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

class SessionCreate(BaseModel):
    title: str
    max_participants: Optional[int] = 20
    dictionary_id: Optional[str] = None

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_session(session_data: SessionCreate):
    async for db in get_db():
        session_id = str(uuid.uuid4())
        # Generate clean 6-character uppercase room code
        room_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        
        # Verify room code uniqueness
        async with db.execute("SELECT id FROM sessions WHERE room_code = ?", (room_code,)) as cursor:
            row = await cursor.fetchone()
            if row:
                room_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
                
        settings_json = "{}"
        if session_data.dictionary_id:
            settings_json = f'{{"dictionary_id": "{session_data.dictionary_id}"}}'
            
        await db.execute(
            """INSERT INTO sessions (id, room_code, title, max_participants, is_active, settings)
            VALUES (?, ?, ?, ?, 1, ?)""",
            (session_id, room_code, session_data.title, session_data.max_participants, settings_json)
        )
        await db.commit()
        
        return {
            "session_id": session_id,
            "room_code": room_code,
            "title": session_data.title,
            "max_participants": session_data.max_participants
        }
    raise HTTPException(status_code=500, detail="Database connection failed")

@router.get("/{room_code}")
async def get_session_by_code(room_code: str):
    async for db in get_db():
        async with db.execute(
            "SELECT id, room_code, title, max_participants, is_active, settings FROM sessions WHERE room_code = ? AND is_active = 1",
            (room_code.upper(),)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Active session not found")
                
        return {
            "session_id": row[0],
            "room_code": row[1],
            "title": row[2],
            "max_participants": row[3],
            "settings": row[5]
        }
    raise HTTPException(status_code=500, detail="Database connection failed")
