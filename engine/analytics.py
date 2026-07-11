import json
import uuid
from typing import Dict, Any, List
from engine.database import get_db

class AnalyticsEngine:
    async def log_event(self, event_type: str, user_id: str = None, session_id: str = None, data: Dict[str, Any] = None):
        """Log an event for analytics tracking."""
        event_id = str(uuid.uuid4())
        data_json = json.dumps(data) if data else "{}"
        
        async for db in get_db():
            await db.execute(
                "INSERT INTO analytics_events (id, event_type, user_id, session_id, data) VALUES (?, ?, ?, ?, ?)",
                (event_id, event_type, user_id, session_id, data_json)
            )
            await db.commit()
            break

    async def get_overview_stats(self) -> Dict[str, Any]:
        """Fetch general stats for the admin panel."""
        stats = {
            "total_users": 0,
            "active_sessions": 0,
            "total_translations": 0,
            "average_latency_ms": 120, # Baseline placeholder
        }
        
        async for db in get_db():
            # Total users
            async with db.execute("SELECT COUNT(*) FROM users") as cursor:
                row = await cursor.fetchone()
                stats["total_users"] = row[0] if row else 0
                
            # Active sessions
            async with db.execute("SELECT COUNT(*) FROM sessions WHERE is_active = 1") as cursor:
                row = await cursor.fetchone()
                stats["active_sessions"] = row[0] if row else 0
                
            # Translations count
            async with db.execute("SELECT COUNT(*) FROM analytics_events WHERE event_type = 'translation'") as cursor:
                row = await cursor.fetchone()
                stats["total_translations"] = row[0] if row else 0
            break
            
        return stats

    async def get_language_usage(self) -> List[Dict[str, Any]]:
        """Group usage stats by language code."""
        usage = []
        async for db in get_db():
            async with db.execute(
                """SELECT data, COUNT(*) as count FROM analytics_events 
                WHERE event_type = 'translation' GROUP BY data"""
            ) as cursor:
                rows = await cursor.fetchall()
                # Parse out target languages from data JSON
                lang_counts = {}
                for row in rows:
                    try:
                        event_data = json.loads(row[0])
                        tgt_lang = event_data.get("target_lang", "unknown")
                        lang_counts[tgt_lang] = lang_counts.get(tgt_lang, 0) + row[1]
                    except Exception:
                        pass
                
                for lang, count in lang_counts.items():
                    usage.append({"language": lang, "count": count})
            break
        return usage

# Global Analytics instance
analytics_engine = AnalyticsEngine()
