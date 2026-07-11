import os
import aiosqlite
from config import settings

DB_FILE = settings.DB_PATH

async def get_db():
    db = await aiosqlite.connect(DB_FILE)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        pass # Handle closing externally or context-managed

async def init_db():
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute("PRAGMA foreign_keys = ON;")
        
        # 1. users
        await db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            avatar_url TEXT,
            native_language TEXT DEFAULT 'en',
            preferred_language TEXT DEFAULT 'en',
            role TEXT DEFAULT 'user',
            auth_provider TEXT DEFAULT 'local',
            oauth_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            is_active INTEGER DEFAULT 1
        );
        """)
        
        # 2. sessions
        await db.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            room_code TEXT UNIQUE NOT NULL,
            creator_id TEXT,
            title TEXT NOT NULL,
            max_participants INTEGER DEFAULT 20,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ended_at TIMESTAMP,
            settings TEXT,
            FOREIGN KEY (creator_id) REFERENCES users (id) ON DELETE SET NULL
        );
        """)
        
        # 3. session_participants
        await db.execute("""
        CREATE TABLE IF NOT EXISTS session_participants (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            user_id TEXT,
            display_name TEXT NOT NULL,
            spoken_language TEXT NOT NULL,
            listening_language TEXT NOT NULL,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            left_at TIMESTAMP,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
        );
        """)
        
        # 4. language_profiles
        await db.execute("""
        CREATE TABLE IF NOT EXISTS language_profiles (
            id TEXT PRIMARY KEY,
            user_id TEXT UNIQUE NOT NULL,
            native_language TEXT DEFAULT 'en',
            preferred_listening_language TEXT DEFAULT 'en',
            spoken_languages TEXT, -- JSON Array
            understood_languages TEXT, -- JSON Array
            auto_detect_enabled INTEGER DEFAULT 1,
            confidence_threshold REAL DEFAULT 0.5,
            translation_preferences TEXT, -- JSON Map
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        """)
        
        # 5. custom_dictionaries
        await db.execute("""
        CREATE TABLE IF NOT EXISTS custom_dictionaries (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            domain TEXT DEFAULT 'general',
            source_language TEXT NOT NULL,
            target_language TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        """)
        
        # 6. dictionary_entries
        await db.execute("""
        CREATE TABLE IF NOT EXISTS dictionary_entries (
            id TEXT PRIMARY KEY,
            dictionary_id TEXT NOT NULL,
            source_term TEXT NOT NULL,
            target_term TEXT NOT NULL,
            context TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (dictionary_id) REFERENCES custom_dictionaries (id) ON DELETE CASCADE,
            UNIQUE(dictionary_id, source_term)
        );
        """)
        
        # 7. learned_preferences
        await db.execute("""
        CREATE TABLE IF NOT EXISTS learned_preferences (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            language_pair TEXT NOT NULL, -- e.g., 'ja->hi'
            frequency INTEGER DEFAULT 1,
            last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            auto_apply INTEGER DEFAULT 1,
            domain TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE(user_id, language_pair)
        );
        """)
        
        # 8. recordings
        await db.execute("""
        CREATE TABLE IF NOT EXISTS recordings (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            duration_seconds INTEGER DEFAULT 0,
            transcript TEXT NOT NULL, -- Full transcript JSON
            translated_transcript TEXT NOT NULL, -- Full translated transcript JSON
            summary TEXT,
            languages_used TEXT, -- JSON Array
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            file_path TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        """)
        
        # 9. analytics_events
        await db.execute("""
        CREATE TABLE IF NOT EXISTS analytics_events (
            id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            user_id TEXT,
            session_id TEXT,
            data TEXT, -- JSON Data
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        
        # 10. api_keys
        await db.execute("""
        CREATE TABLE IF NOT EXISTS api_keys (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            key_hash TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            permissions TEXT, -- JSON Array
            rate_limit INTEGER DEFAULT 100,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            last_used TIMESTAMP,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        """)
        
        # 11. refresh_tokens
        await db.execute("""
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_hash TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            revoked INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        """)
        
        await db.commit()
