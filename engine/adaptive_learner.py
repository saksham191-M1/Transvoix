import uuid
from datetime import datetime
import aiosqlite
from engine.database import get_db

class AdaptiveLearner:
    async def record_translation_use(self, user_id: str, source_lang: str, target_lang: str):
        """Record translation usage for a user to learn preferences."""
        language_pair = f"{source_lang.lower()}->{target_lang.lower()}"
        
        async for db in get_db():
            # Check if this preference already exists
            async with db.execute(
                "SELECT id, frequency FROM learned_preferences WHERE user_id = ? AND language_pair = ?",
                (user_id, language_pair)
            ) as cursor:
                row = await cursor.fetchone()
                
            if row:
                pref_id, freq = row
                await db.execute(
                    "UPDATE learned_preferences SET frequency = ?, last_used = CURRENT_TIMESTAMP WHERE id = ?",
                    (freq + 1, pref_id)
                )
            else:
                pref_id = str(uuid.uuid4())
                await db.execute(
                    "INSERT INTO learned_preferences (id, user_id, language_pair, frequency, auto_apply) VALUES (?, ?, ?, ?, ?)",
                    (pref_id, user_id, language_pair, 1, 1)
                )
            await db.commit()
            break

    async def get_learned_preferences(self, user_id: str) -> list:
        """Retrieve all learned preferences for a user."""
        preferences = []
        async for db in get_db():
            async with db.execute(
                "SELECT language_pair, frequency, last_used, auto_apply FROM learned_preferences WHERE user_id = ? ORDER BY frequency DESC",
                (user_id,)
            ) as cursor:
                rows = await cursor.fetchall()
                for row in rows:
                    preferences.append({
                        "language_pair": row[0],
                        "frequency": row[1],
                        "last_used": row[2],
                        "auto_apply": bool(row[3])
                    })
            break
        return preferences

    async def infer_preferred_listening_language(self, user_id: str, default_lang: str = "en") -> str:
        """Infer the preferred listening language based on usage history."""
        async for db in get_db():
            # Find the most frequent target language in target_lang
            async with db.execute(
                "SELECT language_pair, frequency FROM learned_preferences WHERE user_id = ? AND auto_apply = 1 ORDER BY frequency DESC LIMIT 1",
                (user_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    pair = row[0]
                    # Format is 'source->target', extract target
                    if "->" in pair:
                        return pair.split("->")[1]
            break
        return default_lang

# Global Adaptive Learner instance
adaptive_learner = AdaptiveLearner()
