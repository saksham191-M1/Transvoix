import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from engine.database import get_db
from engine.translation import translation_engine

router = APIRouter(prefix="/api/dictionaries", tags=["dictionaries"])

class DictionaryCreate(BaseModel):
    user_id: str
    name: str
    domain: Optional[str] = "general"
    source_language: str
    target_language: str

class EntryCreate(BaseModel):
    source_term: str
    target_term: str
    context: Optional[str] = None

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_dictionary(data: DictionaryCreate):
    async for db in get_db():
        dict_id = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO custom_dictionaries (id, user_id, name, domain, source_language, target_language)
            VALUES (?, ?, ?, ?, ?, ?)""",
            (dict_id, data.user_id, data.name, data.domain, data.source_language, data.target_language)
        )
        await db.commit()
        return {"id": dict_id, "name": data.name, "domain": data.domain}
    raise HTTPException(status_code=500, detail="Database connection failed")

@router.get("")
async def list_dictionaries(user_id: str):
    dicts = []
    async for db in get_db():
        async with db.execute(
            "SELECT id, name, domain, source_language, target_language FROM custom_dictionaries WHERE user_id = ?",
            (user_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            for row in rows:
                dicts.append({
                    "id": row[0],
                    "name": row[1],
                    "domain": row[2],
                    "source_language": row[3],
                    "target_language": row[4]
                })
        break
    return dicts

@router.post("/{dict_id}/entries", status_code=status.HTTP_201_CREATED)
async def add_entry(dict_id: str, entry: EntryCreate):
    async for db in get_db():
        entry_id = str(uuid.uuid4())
        try:
            await db.execute(
                "INSERT INTO dictionary_entries (id, dictionary_id, source_term, target_term, context) VALUES (?, ?, ?, ?, ?)",
                (entry_id, dict_id, entry.source_term, entry.target_term, entry.context)
            )
            await db.commit()
        except Exception:
            raise HTTPException(status_code=400, detail="Entry already exists in this dictionary")
            
        # Refresh the active translation engine cache
        async with db.execute(
            "SELECT source_term, target_term FROM dictionary_entries WHERE dictionary_id = ?",
            (dict_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            entries_list = [{"source_term": r[0], "target_term": r[1]} for r in rows]
            translation_engine.load_dictionary(dict_id, entries_list)
            
        return {"id": entry_id, "source_term": entry.source_term, "target_term": entry.target_term}
    raise HTTPException(status_code=500, detail="Database connection failed")

@router.get("/{dict_id}/entries")
async def get_entries(dict_id: str):
    entries = []
    async for db in get_db():
        async with db.execute(
            "SELECT id, source_term, target_term, context FROM dictionary_entries WHERE dictionary_id = ?",
            (dict_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            for row in rows:
                entries.append({
                    "id": row[0],
                    "source_term": row[1],
                    "target_term": row[2],
                    "context": row[3]
                })
        break
    return entries
