import pytest
from fastapi.testclient import TestClient
from main import app
from engine.database import get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    """Ensure database is initialized for each API route test."""
    import os
    import asyncio
    from engine.database import init_db
    test_db = "data/test_transvoix.db"
    if os.path.exists(test_db):
        try:
            os.remove(test_db)
        except OSError:
            pass
    asyncio.run(init_db())
    yield
    if os.path.exists(test_db):
        try:
            os.remove(test_db)
        except OSError:
            pass

def test_get_languages():
    response = client.get("/api/languages")
    assert response.status_code == 200
    langs = response.json()
    assert len(langs) > 0
    # Verify English is in the response
    codes = [l["code"] for l in langs]
    assert "en" in codes

def test_user_registration_and_login():
    # 1. Register a test user
    reg_payload = {
        "email": "testuser@example.com",
        "password": "Password123!",
        "display_name": "Test User",
        "native_language": "en"
    }
    reg_response = client.post("/api/auth/register", json=reg_payload)
    assert reg_response.status_code == 201
    assert reg_response.json()["email"] == "testuser@example.com"

    # 2. Try registering duplicate email (should fail)
    duplicate_res = client.post("/api/auth/register", json=reg_payload)
    assert duplicate_res.status_code == 400

    # 3. Login with credentials
    login_payload = {
        "email": "testuser@example.com",
        "password": "Password123!"
    }
    login_response = client.post("/api/auth/login", json=login_payload)
    assert login_response.status_code == 200
    tokens = login_response.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens

def test_session_lifecycle():
    # 1. Create a session room
    session_payload = {
        "title": "Weekly Dev Sync",
        "max_participants": 10
    }
    create_res = client.post("/api/sessions", json=session_payload)
    assert create_res.status_code == 201
    session_data = create_res.json()
    assert "session_id" in session_data
    assert "room_code" in session_data
    assert session_data["title"] == "Weekly Dev Sync"

    # 2. Get session details by its code
    code = session_data["room_code"]
    get_res = client.get(f"/api/sessions/{code}")
    assert get_res.status_code == 200
    assert get_res.json()["session_id"] == session_data["session_id"]
