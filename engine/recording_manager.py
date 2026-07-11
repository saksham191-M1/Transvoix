import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from engine.database import get_db

class RecordingManager:
    async def save_recording(self, session_id: str, user_id: str, title: str, 
                             duration_seconds: int, transcript_entries: List[Dict[str, Any]]) -> str:
        """Save a session recording transcript and generate a basic summary."""
        recording_id = str(uuid.uuid4())
        
        # 1. Compile transcripts
        transcript_json = json.dumps(transcript_entries)
        
        # Create a simple translated version if target translations are in the entries
        translated_entries = []
        languages_used = set()
        
        for entry in transcript_entries:
            speaker = entry.get("speaker", "Unknown")
            text = entry.get("text", "")
            translation = entry.get("translation", text)
            lang = entry.get("language", "en")
            languages_used.add(lang)
            
            translated_entries.append({
                "speaker": speaker,
                "text": translation,
                "language": lang
            })
            
        translated_transcript_json = json.dumps(translated_entries)
        
        # 2. Generate a basic heuristic summary (extract questions, decisions)
        summary = self._generate_heuristic_summary(title, transcript_entries)
        
        # 3. Save to database
        async for db in get_db():
            await db.execute(
                """INSERT INTO recordings 
                (id, session_id, user_id, title, duration_seconds, transcript, translated_transcript, summary, languages_used) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    recording_id,
                    session_id,
                    user_id,
                    title,
                    duration_seconds,
                    transcript_json,
                    translated_transcript_json,
                    summary,
                    json.dumps(list(languages_used))
                )
            )
            await db.commit()
            break
            
        return recording_id

    def _generate_heuristic_summary(self, title: str, entries: List[Dict[str, Any]]) -> str:
        """Generate summary by extracting key parts of the meeting transcript."""
        decisions = []
        questions = []
        highlights = []
        
        for entry in entries:
            text = entry.get("text", "")
            speaker = entry.get("speaker", "Participant")
            
            lower_text = text.lower()
            if "?" in text:
                questions.append(f"{speaker}: \"{text}\"")
            elif any(kw in lower_text for kw in ["agree", "decided", "action item", "todo", "to-do", "will do"]):
                decisions.append(f"{speaker}: \"{text}\"")
            elif len(highlights) < 5 and len(text) > 40:
                highlights.append(f"{speaker}: \"{text}\"")
                
        summary_lines = [
            f"# Meeting Summary: {title}",
            f"Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n",
            "## Key Decisions & Action Items"
        ]
        
        if decisions:
            summary_lines.extend([f"- {d}" for d in decisions])
        else:
            summary_lines.append("- No explicit decisions or action items detected.")
            
        summary_lines.append("\n## Key Questions Raised")
        if questions:
            summary_lines.extend([f"- {q}" for q in questions])
        else:
            summary_lines.append("- No questions recorded.")
            
        summary_lines.append("\n## Key Conversation Highlights")
        if highlights:
            summary_lines.extend([f"- {h}" for h in highlights])
        else:
            summary_lines.append("- No major highlights recorded.")
            
        return "\n".join(summary_lines)

    async def get_recordings(self, user_id: str) -> List[Dict[str, Any]]:
        """Fetch all recordings belonging to a user."""
        recordings = []
        async for db in get_db():
            async with db.execute(
                "SELECT id, session_id, title, duration_seconds, languages_used, created_at FROM recordings WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,)
            ) as cursor:
                rows = await cursor.fetchall()
                for row in rows:
                    recordings.append({
                        "id": row[0],
                        "session_id": row[1],
                        "title": row[2],
                        "duration_seconds": row[3],
                        "languages_used": json.loads(row[4]) if row[4] else [],
                        "created_at": row[5]
                    })
            break
        return recordings

    async def get_recording(self, recording_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Fetch single recording detail."""
        async for db in get_db():
            async with db.execute(
                "SELECT id, session_id, title, duration_seconds, transcript, translated_transcript, summary, languages_used, created_at FROM recordings WHERE id = ? AND user_id = ?",
                (recording_id, user_id)
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    return {
                        "id": row[0],
                        "session_id": row[1],
                        "title": row[2],
                        "duration_seconds": row[3],
                        "transcript": json.loads(row[4]),
                        "translated_transcript": json.loads(row[5]),
                        "summary": row[6],
                        "languages_used": json.loads(row[7]) if row[7] else [],
                        "created_at": row[8]
                    }
            break
        return None

    def export_srt(self, transcript_entries: List[Dict[str, Any]]) -> str:
        """Export transcript entries as standard SRT subtitle format."""
        srt_lines = []
        
        for idx, entry in enumerate(transcript_entries):
            # Parse timing or mock one (e.g. 5 seconds per line starting from 0)
            start_sec = idx * 5
            end_sec = start_sec + 4
            
            def format_time(seconds):
                h = int(seconds // 3600)
                m = int((seconds % 3600) // 60)
                s = int(seconds % 60)
                ms = 0
                return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
                
            start_str = format_time(start_sec)
            end_str = format_time(end_sec)
            
            speaker = entry.get("speaker", "Speaker")
            text = entry.get("text", "")
            
            srt_lines.append(f"{idx + 1}")
            srt_lines.append(f"{start_str} --> {end_str}")
            srt_lines.append(f"{speaker}: {text}\n")
            
        return "\n".join(srt_lines)

# Global Recording Manager instance
recording_manager = RecordingManager()
