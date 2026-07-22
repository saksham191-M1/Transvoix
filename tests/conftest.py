import os
import pytest
import asyncio
import aiosqlite
from unittest.mock import MagicMock

# Define a clean test database file path
TEST_DB_FILE = "data/test_transvoix.db"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(autouse=True)
def mock_db_path(monkeypatch):
    """Override database file path to point to the test database."""
    monkeypatch.setattr("engine.database.DB_FILE", TEST_DB_FILE)
    monkeypatch.setattr("config.settings.DB_PATH", TEST_DB_FILE)

@pytest.fixture(autouse=True)
def mock_translation_service(monkeypatch):
    """Mock GoogleTranslator translate to avoid external API calls during tests."""
    from deep_translator import GoogleTranslator
    
    def mock_translate(self, text):
        return f"[Translated: {text}]"
        
    monkeypatch.setattr(GoogleTranslator, "translate", mock_translate)

import pytest_asyncio

@pytest_asyncio.fixture
async def init_test_db():
    """Initializes the database schema and wipes it after test runs."""
    from engine.database import init_db
    # Remove old test database if it exists
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass
            
    await init_db()
    yield
    
    # Cleanup after test function completes
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass
