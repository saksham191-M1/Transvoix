import os
import pytest
import aiosqlite
from engine.database import get_db, init_db

@pytest.mark.asyncio
async def test_database_initialization(init_test_db):
    """Verify that tables are created on database initialization."""
    # Since init_test_db runs and creates the tables, we can just query them
    async for db in get_db():
        # Check users table
        async with db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'") as cursor:
            row = await cursor.fetchone()
            assert row is not None
            assert row[0] == "users"
            
        # Check sessions table
        async with db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'") as cursor:
            row = await cursor.fetchone()
            assert row is not None
            assert row[0] == "sessions"
            
        # Check recordings table
        async with db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='recordings'") as cursor:
            row = await cursor.fetchone()
            assert row is not None
            assert row[0] == "recordings"
        break
