# TransVoix Testing Strategy

> **Version:** 1.0.0  
> **Framework:** pytest + pytest-asyncio  
> **Coverage Target:** 80%+ line coverage  
> **CI/CD:** GitHub Actions

---

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Pyramid](#test-pyramid)
- [1. Unit Tests](#1-unit-tests)
- [2. Integration Tests](#2-integration-tests)
- [3. API Tests](#3-api-tests)
- [4. WebSocket Tests](#4-websocket-tests)
- [5. Load Tests](#5-load-tests)
- [6. Security Tests](#6-security-tests)
- [7. Translation Accuracy Tests](#7-translation-accuracy-tests)
- [8. Voice/Audio Tests](#8-voiceaudio-tests)
- [9. Browser Compatibility Tests](#9-browser-compatibility-tests)
- [10. End-to-End Tests](#10-end-to-end-tests)
- [11. CI/CD Pipeline](#11-cicd-pipeline)
- [Test Directory Structure](#test-directory-structure)
- [Running Tests](#running-tests)

---

## Testing Philosophy

TransVoix testing follows these core principles:

1. **Test at the right level** — Prefer unit tests for logic, integration tests for wiring, E2E tests for critical user flows
2. **Deterministic tests** — Mock external services (deep-translator, speech APIs) for repeatability
3. **Fast feedback** — Unit tests must complete in < 30 seconds; full suite < 10 minutes
4. **Coverage as a floor, not a ceiling** — 80% coverage is the minimum; critical paths (auth, translation, WebSocket) require 95%+
5. **Test behavior, not implementation** — Focus on inputs, outputs, and side effects

---

## Test Pyramid

```
          ╱╲
         ╱  ╲        E2E Tests (5%)
        ╱    ╲       Full user flows, browser automation
       ╱──────╲
      ╱        ╲     Integration Tests (20%)
     ╱          ╲    API routes, WebSocket, DB, pipelines
    ╱────────────╲
   ╱              ╲   Unit Tests (75%)
  ╱                ╲  Engine modules, utilities, validators
 ╱──────────────────╲
```

| Level | Count (Target) | Execution Time | Run Frequency |
|-------|---------------|----------------|---------------|
| Unit | 300+ tests | < 30s | Every commit |
| Integration | 100+ tests | < 3 min | Every PR |
| API | 80+ tests | < 2 min | Every PR |
| WebSocket | 40+ tests | < 1 min | Every PR |
| Load | 10 scenarios | 5–15 min | Pre-release |
| Security | 30+ tests | < 2 min | Every PR |
| Translation Accuracy | 50+ tests | < 5 min | Weekly / pre-release |
| Voice/Audio | 20+ tests | Manual + automated | Pre-release |
| Browser Compatibility | Matrix | 10+ min | Pre-release |
| E2E | 15+ tests | < 5 min | Pre-release |

---

## 1. Unit Tests

### Module Coverage

Each engine module is tested in isolation with mocked dependencies.

#### 1.1 `translation.py` — Translation Engine

**Mock Strategy:** Mock `deep_translator.GoogleTranslator` to return deterministic results.

```python
# tests/unit/test_translation.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from engine.translation import TranslationEngine


@pytest.fixture
def translation_engine():
    engine = TranslationEngine()
    return engine


@pytest.fixture
def mock_translator():
    with patch("engine.translation.GoogleTranslator") as mock:
        instance = MagicMock()
        instance.translate.return_value = "Hola mundo"
        mock.return_value = instance
        yield mock


class TestTranslationEngine:
    """Unit tests for the TranslationEngine."""

    def test_translate_text_returns_correct_translation(
        self, translation_engine, mock_translator
    ):
        """Simple text translation returns expected output."""
        result = translation_engine.translate("Hello world", "en", "es")
        assert result.text == "Hola mundo"
        assert result.source_language == "en"
        assert result.target_language == "es"

    def test_translate_empty_text_raises_validation_error(self, translation_engine):
        """Empty input text raises ValueError."""
        with pytest.raises(ValueError, match="Text cannot be empty"):
            translation_engine.translate("", "en", "es")

    def test_translate_text_too_long_raises_error(self, translation_engine):
        """Text exceeding 5000 chars raises ValueError."""
        long_text = "a" * 5001
        with pytest.raises(ValueError, match="Text exceeds maximum length"):
            translation_engine.translate(long_text, "en", "es")

    def test_translate_unsupported_language_raises_error(self, translation_engine):
        """Unsupported target language raises ValueError."""
        with pytest.raises(ValueError, match="Unsupported language"):
            translation_engine.translate("Hello", "en", "xx")

    def test_translate_applies_custom_dictionary(
        self, translation_engine, mock_translator
    ):
        """Custom dictionary overrides are applied to translation output."""
        dictionary = {"MRI": "IRM", "CT scan": "tomografía computarizada"}
        result = translation_engine.translate(
            "Schedule an MRI", "en", "es", dictionary=dictionary
        )
        assert "IRM" in result.text

    def test_translate_preserves_formatting(
        self, translation_engine, mock_translator
    ):
        """HTML/markdown formatting is preserved in output."""
        mock_translator.return_value.translate.return_value = "<b>Hola</b>"
        result = translation_engine.translate(
            "<b>Hello</b>", "en", "es", preserve_formatting=True
        )
        assert "<b>" in result.text

    def test_translate_auto_detects_source_language(
        self, translation_engine, mock_translator
    ):
        """Source language is auto-detected when not provided."""
        result = translation_engine.translate("Bonjour", None, "en")
        assert result.detected_language is not None

    def test_translate_returns_confidence_score(
        self, translation_engine, mock_translator
    ):
        """Translation result includes a confidence score between 0 and 1."""
        result = translation_engine.translate("Hello", "en", "es")
        assert 0.0 <= result.confidence <= 1.0

    def test_translate_batch_processes_multiple_items(
        self, translation_engine, mock_translator
    ):
        """Batch translation processes all items and returns results."""
        items = [
            {"text": "Hello", "target_language": "es"},
            {"text": "Goodbye", "target_language": "fr"},
        ]
        results = translation_engine.translate_batch(items)
        assert len(results) == 2

    def test_translate_handles_service_failure_gracefully(
        self, translation_engine, mock_translator
    ):
        """Translation engine wraps external failures in TranslationError."""
        mock_translator.return_value.translate.side_effect = Exception("Service down")
        with pytest.raises(Exception, match="Translation service"):
            translation_engine.translate("Hello", "en", "es")
```

---

#### 1.2 `language_negotiator.py` — Language Negotiation

**Mock Strategy:** No external dependencies; pure logic tests.

```python
# tests/unit/test_language_negotiator.py
import pytest
from engine.language_negotiator import LanguageNegotiator


@pytest.fixture
def negotiator():
    return LanguageNegotiator()


class TestLanguageNegotiator:
    """Unit tests for the LanguageNegotiator."""

    def test_negotiate_selects_common_language(self, negotiator):
        """When participants share a language, it's selected as the bridge."""
        participants = [
            {"id": "1", "languages": ["en", "es"]},
            {"id": "2", "languages": ["es", "fr"]},
        ]
        result = negotiator.negotiate(participants)
        assert result.bridge_language == "es"

    def test_negotiate_falls_back_to_english(self, negotiator):
        """When no common language exists, English is the fallback bridge."""
        participants = [
            {"id": "1", "languages": ["zh"]},
            {"id": "2", "languages": ["ar"]},
        ]
        result = negotiator.negotiate(participants)
        assert result.bridge_language == "en"

    def test_negotiate_builds_translation_matrix(self, negotiator):
        """Generates correct pairwise translation mapping for all participants."""
        participants = [
            {"id": "1", "languages": ["en"]},
            {"id": "2", "languages": ["es"]},
            {"id": "3", "languages": ["ja"]},
        ]
        result = negotiator.negotiate(participants)
        assert len(result.translation_pairs) >= 3

    def test_negotiate_single_participant_no_translation(self, negotiator):
        """Single participant requires no translation pairs."""
        participants = [{"id": "1", "languages": ["en"]}]
        result = negotiator.negotiate(participants)
        assert len(result.translation_pairs) == 0

    def test_negotiate_handles_same_language_participants(self, negotiator):
        """Participants with the same language don't need translation between them."""
        participants = [
            {"id": "1", "languages": ["en"]},
            {"id": "2", "languages": ["en"]},
        ]
        result = negotiator.negotiate(participants)
        assert len(result.translation_pairs) == 0

    def test_negotiate_validates_language_codes(self, negotiator):
        """Invalid ISO 639-1 codes raise ValueError."""
        participants = [{"id": "1", "languages": ["xyz"]}]
        with pytest.raises(ValueError, match="Invalid language code"):
            negotiator.negotiate(participants)

    def test_negotiate_updates_on_participant_join(self, negotiator):
        """Recalculates pairs when a new participant joins."""
        initial = [{"id": "1", "languages": ["en"]}]
        result = negotiator.negotiate(initial)
        new_participant = {"id": "2", "languages": ["fr"]}
        result = negotiator.add_participant(result, new_participant)
        assert len(result.translation_pairs) >= 1
```

---

#### 1.3 `session_manager.py` — Session Management

**Mock Strategy:** Mock database calls; test session logic in isolation.

```python
# tests/unit/test_session_manager.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from engine.session_manager import SessionManager


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.create_session.return_value = {"id": "sess-001", "status": "active"}
    db.get_session.return_value = {"id": "sess-001", "status": "active", "max_participants": 10}
    return db


@pytest.fixture
def session_manager(mock_db):
    return SessionManager(db=mock_db)


class TestSessionManager:
    """Unit tests for the SessionManager."""

    @pytest.mark.asyncio
    async def test_create_session_returns_valid_session(self, session_manager):
        """Creating a session returns a session object with ID and join code."""
        session = await session_manager.create(
            host_id="user-001", name="Test Room", session_type="group"
        )
        assert session["id"] is not None
        assert session["status"] == "active"

    @pytest.mark.asyncio
    async def test_create_session_generates_unique_join_code(self, session_manager):
        """Each session gets a unique 6-character alphanumeric join code."""
        s1 = await session_manager.create(host_id="user-001", name="Room 1")
        s2 = await session_manager.create(host_id="user-001", name="Room 2")
        assert len(s1.get("code", "")) == 6
        assert s1["code"] != s2["code"]

    @pytest.mark.asyncio
    async def test_join_session_adds_participant(self, session_manager, mock_db):
        """Joining a session adds the participant to the participant list."""
        mock_db.get_participants.return_value = []
        result = await session_manager.join(
            session_id="sess-001", user_id="user-002", language="es"
        )
        assert result["role"] == "participant"

    @pytest.mark.asyncio
    async def test_join_full_session_raises_error(self, session_manager, mock_db):
        """Joining a full session raises SessionFullError."""
        mock_db.get_participants.return_value = [f"user-{i}" for i in range(10)]
        with pytest.raises(Exception, match="Session is full"):
            await session_manager.join(
                session_id="sess-001", user_id="user-011", language="en"
            )

    @pytest.mark.asyncio
    async def test_end_session_only_by_host(self, session_manager, mock_db):
        """Only the session host can end a session."""
        mock_db.get_session.return_value = {
            "id": "sess-001", "host_id": "user-001", "status": "active"
        }
        with pytest.raises(PermissionError, match="Only the host"):
            await session_manager.end(session_id="sess-001", user_id="user-002")

    @pytest.mark.asyncio
    async def test_end_session_marks_as_ended(self, session_manager, mock_db):
        """Ending a session sets status to 'ended'."""
        mock_db.get_session.return_value = {
            "id": "sess-001", "host_id": "user-001", "status": "active"
        }
        result = await session_manager.end(session_id="sess-001", user_id="user-001")
        mock_db.update_session.assert_called_once()

    @pytest.mark.asyncio
    async def test_join_ended_session_raises_error(self, session_manager, mock_db):
        """Cannot join a session that has already ended."""
        mock_db.get_session.return_value = {"id": "sess-001", "status": "ended"}
        with pytest.raises(Exception, match="Session has ended"):
            await session_manager.join(
                session_id="sess-001", user_id="user-002", language="en"
            )
```

---

#### 1.4 `adaptive_learner.py` — Adaptive Learning Engine

**Mock Strategy:** Mock database for preference storage; test learning algorithms in isolation.

```python
# tests/unit/test_adaptive_learner.py
import pytest
from unittest.mock import AsyncMock
from engine.adaptive_learner import AdaptiveLearner


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.get_preferences.return_value = {
        "frequent_pairs": [],
        "corrections": [],
        "formality_bias": 0.0,
    }
    return db


@pytest.fixture
def learner(mock_db):
    return AdaptiveLearner(db=mock_db)


class TestAdaptiveLearner:
    """Unit tests for the AdaptiveLearner."""

    @pytest.mark.asyncio
    async def test_record_translation_updates_pair_frequency(self, learner):
        """Recording a translation increments the frequency of the language pair."""
        await learner.record_translation("user-001", "en", "es")
        prefs = await learner.get_preferences("user-001")
        en_es = [p for p in prefs["frequent_pairs"] if p["source"] == "en" and p["target"] == "es"]
        assert len(en_es) > 0

    @pytest.mark.asyncio
    async def test_apply_correction_stores_override(self, learner):
        """User correction is stored and applied to future translations."""
        await learner.apply_correction(
            user_id="user-001",
            original="Hello",
            corrected="Hi there",
            language_pair="en→es",
        )
        corrections = await learner.get_corrections("user-001", "en→es")
        assert len(corrections) >= 1

    @pytest.mark.asyncio
    async def test_get_formality_bias_returns_learned_value(self, learner, mock_db):
        """Returns the formality bias learned from user's past translations."""
        mock_db.get_preferences.return_value = {"formality_bias": 0.7}
        bias = await learner.get_formality_bias("user-001")
        assert bias == 0.7

    @pytest.mark.asyncio
    async def test_reset_preferences_clears_all_data(self, learner, mock_db):
        """Resetting preferences removes all learned data."""
        await learner.reset_preferences("user-001")
        mock_db.delete_preferences.assert_called_once_with("user-001")

    @pytest.mark.asyncio
    async def test_suggest_language_pair_based_on_history(self, learner, mock_db):
        """Suggests the most frequently used language pair."""
        mock_db.get_preferences.return_value = {
            "frequent_pairs": [
                {"source": "en", "target": "es", "usage_count": 150},
                {"source": "en", "target": "fr", "usage_count": 30},
            ]
        }
        suggestion = await learner.suggest_pair("user-001")
        assert suggestion == ("en", "es")

    @pytest.mark.asyncio
    async def test_no_history_returns_default_suggestion(self, learner, mock_db):
        """With no history, returns None as suggestion."""
        mock_db.get_preferences.return_value = {"frequent_pairs": []}
        suggestion = await learner.suggest_pair("user-001")
        assert suggestion is None
```

---

#### 1.5 `security.py` — Security & Authentication

**Mock Strategy:** Mock JWT library and database; test token logic.

```python
# tests/unit/test_security.py
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from engine.security import SecurityManager, create_access_token, verify_token


@pytest.fixture
def security():
    return SecurityManager(secret_key="test-secret-key-do-not-use-in-prod")


class TestSecurity:
    """Unit tests for security and authentication."""

    def test_create_access_token_contains_user_id(self, security):
        """Access token payload contains the user ID claim."""
        token = security.create_access_token(user_id="user-001", role="free")
        payload = security.decode_token(token)
        assert payload["sub"] == "user-001"

    def test_create_access_token_has_expiration(self, security):
        """Access token has an expiration claim."""
        token = security.create_access_token(user_id="user-001", role="free")
        payload = security.decode_token(token)
        assert "exp" in payload

    def test_verify_expired_token_raises_error(self, security):
        """Expired tokens raise TokenExpiredError."""
        token = security.create_access_token(
            user_id="user-001", role="free", expires_delta=timedelta(seconds=-1)
        )
        with pytest.raises(Exception, match="Token has expired"):
            security.verify_token(token)

    def test_verify_tampered_token_raises_error(self, security):
        """Tampered tokens raise InvalidTokenError."""
        token = security.create_access_token(user_id="user-001", role="free")
        tampered = token[:-5] + "XXXXX"
        with pytest.raises(Exception, match="Invalid token"):
            security.verify_token(tampered)

    def test_hash_password_is_not_plaintext(self, security):
        """Hashed password is not the same as the plaintext input."""
        hashed = security.hash_password("MySecurePassword123")
        assert hashed != "MySecurePassword123"

    def test_verify_correct_password(self, security):
        """Correct password passes verification."""
        hashed = security.hash_password("MySecurePassword123")
        assert security.verify_password("MySecurePassword123", hashed) is True

    def test_verify_incorrect_password(self, security):
        """Incorrect password fails verification."""
        hashed = security.hash_password("MySecurePassword123")
        assert security.verify_password("WrongPassword", hashed) is False

    def test_validate_password_strength_rejects_weak(self, security):
        """Weak passwords (too short, no uppercase, etc.) are rejected."""
        assert security.validate_password_strength("short") is False
        assert security.validate_password_strength("nouppercase1") is False
        assert security.validate_password_strength("NOLOWERCASE1") is False
        assert security.validate_password_strength("NoDigitsHere") is False

    def test_validate_password_strength_accepts_strong(self, security):
        """Strong passwords pass validation."""
        assert security.validate_password_strength("SecureP@ss1") is True

    def test_create_refresh_token_is_unique(self, security):
        """Each refresh token is unique."""
        t1 = security.create_refresh_token()
        t2 = security.create_refresh_token()
        assert t1 != t2
```

---

#### 1.6 `analytics.py` — Analytics Engine

**Mock Strategy:** Mock database aggregation queries.

```python
# tests/unit/test_analytics.py
import pytest
from unittest.mock import AsyncMock
from engine.analytics import AnalyticsEngine


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.get_overview_stats.return_value = {
        "total_users": 1500,
        "active_users": 320,
        "total_translations": 45000,
    }
    return db


@pytest.fixture
def analytics(mock_db):
    return AnalyticsEngine(db=mock_db)


class TestAnalyticsEngine:
    """Unit tests for the AnalyticsEngine."""

    @pytest.mark.asyncio
    async def test_get_overview_returns_all_metrics(self, analytics):
        """Overview stats include all required fields."""
        result = await analytics.get_overview(period="7d")
        assert "total_users" in result
        assert "active_users" in result
        assert "total_translations" in result

    @pytest.mark.asyncio
    async def test_parse_period_string(self, analytics):
        """Period strings like '7d', '30d', '1y' are parsed correctly."""
        assert analytics._parse_period("1d").days == 1
        assert analytics._parse_period("7d").days == 7
        assert analytics._parse_period("30d").days == 30
        assert analytics._parse_period("1y").days == 365

    @pytest.mark.asyncio
    async def test_invalid_period_raises_error(self, analytics):
        """Invalid period string raises ValueError."""
        with pytest.raises(ValueError, match="Invalid period"):
            analytics._parse_period("xyz")

    @pytest.mark.asyncio
    async def test_language_breakdown_sums_to_100(self, analytics, mock_db):
        """Language percentages sum to approximately 100."""
        mock_db.get_language_stats.return_value = [
            {"language": "en", "count": 500, "percentage": 50.0},
            {"language": "es", "count": 300, "percentage": 30.0},
            {"language": "fr", "count": 200, "percentage": 20.0},
        ]
        result = await analytics.get_language_breakdown(period="30d")
        total = sum(r["percentage"] for r in result)
        assert abs(total - 100.0) < 0.1

    @pytest.mark.asyncio
    async def test_latency_percentiles_are_ordered(self, analytics, mock_db):
        """Latency percentiles are in ascending order: p50 ≤ p75 ≤ p90 ≤ p95 ≤ p99."""
        mock_db.get_latency_stats.return_value = {
            "p50_ms": 45, "p75_ms": 72, "p90_ms": 120,
            "p95_ms": 180, "p99_ms": 350,
        }
        result = await analytics.get_latency(period="24h")
        assert result["p50_ms"] <= result["p75_ms"] <= result["p90_ms"]
        assert result["p90_ms"] <= result["p95_ms"] <= result["p99_ms"]
```

---

#### 1.7 `database.py` — Database Layer

**Mock Strategy:** Use in-memory SQLite for testing.

```python
# tests/unit/test_database.py
import pytest
import sqlite3
from engine.database import Database


@pytest.fixture
async def db():
    """Create an in-memory SQLite database for testing."""
    database = Database(":memory:")
    await database.initialize()
    yield database
    await database.close()


class TestDatabase:
    """Unit tests for the Database layer."""

    @pytest.mark.asyncio
    async def test_create_user_returns_id(self, db):
        """Creating a user returns a valid UUID."""
        user_id = await db.create_user(
            email="test@example.com",
            password_hash="hashed_pw",
            display_name="Test User",
        )
        assert user_id is not None

    @pytest.mark.asyncio
    async def test_get_user_by_email(self, db):
        """User can be retrieved by email address."""
        await db.create_user(
            email="test@example.com", password_hash="hash", display_name="Test"
        )
        user = await db.get_user_by_email("test@example.com")
        assert user is not None
        assert user["email"] == "test@example.com"

    @pytest.mark.asyncio
    async def test_duplicate_email_raises_error(self, db):
        """Creating a user with an existing email raises IntegrityError."""
        await db.create_user(
            email="dup@example.com", password_hash="hash", display_name="User1"
        )
        with pytest.raises(Exception):
            await db.create_user(
                email="dup@example.com", password_hash="hash", display_name="User2"
            )

    @pytest.mark.asyncio
    async def test_create_and_retrieve_session(self, db):
        """Sessions can be created and retrieved by ID."""
        session_id = await db.create_session(
            host_id="user-001", name="Test", session_type="group"
        )
        session = await db.get_session(session_id)
        assert session["name"] == "Test"
        assert session["status"] == "active"

    @pytest.mark.asyncio
    async def test_store_and_retrieve_transcript(self, db):
        """Transcript entries are stored and retrieved in order."""
        session_id = await db.create_session(
            host_id="user-001", name="Test", session_type="group"
        )
        await db.add_transcript_entry(
            session_id=session_id,
            participant_id="user-001",
            text="Hello",
            language="en",
            translations={"es": "Hola"},
        )
        transcript = await db.get_transcript(session_id)
        assert len(transcript) == 1
        assert transcript[0]["text"] == "Hello"

    @pytest.mark.asyncio
    async def test_dictionary_crud_operations(self, db):
        """Dictionaries support full CRUD operations."""
        dict_id = await db.create_dictionary(
            user_id="user-001", name="Medical", source_lang="en", target_lang="es"
        )
        assert dict_id is not None

        dictionary = await db.get_dictionary(dict_id)
        assert dictionary["name"] == "Medical"

        await db.delete_dictionary(dict_id)
        result = await db.get_dictionary(dict_id)
        assert result is None
```

---

### Mock Strategies Summary

| External Dependency | Mock Approach |
|-------------------|---------------|
| `deep-translator` (GoogleTranslator) | `unittest.mock.patch` — return deterministic strings |
| SQLite Database | In-memory SQLite (`:memory:`) for unit tests |
| JWT (`python-jose`) | Real library with test-only secret key |
| WebSocket connections | `AsyncMock` for connection objects |
| `datetime.now()` | `freezegun` or `unittest.mock.patch` for time-sensitive tests |
| HTTP clients (OAuth) | `httpx.MockTransport` or `responses` library |
| File I/O (recordings) | `tmp_path` fixture (pytest built-in) |

---

## 2. Integration Tests

Integration tests verify that modules work together correctly with real (test) database and actual WebSocket connections.

### 2.1 API Route Testing

```python
# tests/integration/test_api_routes.py
import pytest
from fastapi.testclient import TestClient
from main import app
from engine.database import Database


@pytest.fixture
def client():
    """Create a test client with an in-memory database."""
    app.state.db = Database(":memory:")
    with TestClient(app) as client:
        yield client


@pytest.fixture
def auth_headers(client):
    """Register a user and return auth headers."""
    response = client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "SecureP@ss1",
        "display_name": "Test User",
    })
    token = response.json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestAPIRouteIntegration:
    """Integration tests for API routes with real database."""

    def test_register_login_flow(self, client):
        """Full register → login flow works end-to-end."""
        # Register
        reg = client.post("/api/auth/register", json={
            "email": "flow@example.com",
            "password": "SecureP@ss1",
            "display_name": "Flow User",
        })
        assert reg.status_code == 201

        # Login
        login = client.post("/api/auth/login", json={
            "email": "flow@example.com",
            "password": "SecureP@ss1",
        })
        assert login.status_code == 200
        assert "access_token" in login.json()["tokens"]

    def test_translate_requires_auth(self, client):
        """Translation endpoint returns 401 without auth."""
        response = client.post("/api/translate", json={
            "text": "Hello", "target_language": "es"
        })
        assert response.status_code == 401

    def test_translate_with_auth(self, client, auth_headers):
        """Translation succeeds with valid auth headers."""
        response = client.post("/api/translate", json={
            "text": "Hello", "target_language": "es"
        }, headers=auth_headers)
        assert response.status_code == 200
        assert "translation" in response.json()

    def test_session_lifecycle(self, client, auth_headers):
        """Create → get → end session lifecycle works."""
        # Create
        create = client.post("/api/sessions", json={
            "name": "Test Session",
            "type": "group",
        }, headers=auth_headers)
        assert create.status_code == 201
        session_id = create.json()["session"]["id"]

        # Get
        get = client.get(f"/api/sessions/{session_id}", headers=auth_headers)
        assert get.status_code == 200

        # End
        end = client.delete(f"/api/sessions/{session_id}", headers=auth_headers)
        assert end.status_code == 200

    def test_dictionary_lifecycle(self, client, auth_headers):
        """Full dictionary CRUD lifecycle works."""
        # Create
        create = client.post("/api/users/dictionaries", json={
            "name": "Test Dict",
            "source_language": "en",
            "target_language": "es",
            "entries": [{"source_term": "hello", "target_term": "hola"}],
        }, headers=auth_headers)
        assert create.status_code == 201
        dict_id = create.json()["dictionary"]["id"]

        # Add entry
        add = client.post(f"/api/users/dictionaries/{dict_id}/entries", json={
            "source_term": "world", "target_term": "mundo"
        }, headers=auth_headers)
        assert add.status_code == 201

        # Delete
        delete = client.delete(
            f"/api/users/dictionaries/{dict_id}", headers=auth_headers
        )
        assert delete.status_code == 200
```

### 2.2 WebSocket Integration Testing

```python
# tests/integration/test_websocket.py
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


@pytest.fixture
def session_and_token(client):
    """Create user, login, and create a session."""
    client.post("/api/auth/register", json={
        "email": "ws@example.com", "password": "SecureP@ss1",
        "display_name": "WS User",
    })
    login = client.post("/api/auth/login", json={
        "email": "ws@example.com", "password": "SecureP@ss1",
    })
    token = login.json()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    session = client.post("/api/sessions", json={
        "name": "WS Test", "type": "group",
    }, headers=headers)
    session_id = session.json()["session"]["id"]

    return session_id, token


class TestWebSocketIntegration:
    """Integration tests for WebSocket connections."""

    def test_websocket_connect_and_auth(self, client, session_and_token):
        """WebSocket connection authenticates successfully."""
        session_id, token = session_and_token
        with client.websocket_connect(
            f"/ws/session/{session_id}?token={token}"
        ) as ws:
            msg = ws.receive_json()
            assert msg["type"] == "auth_success"

    def test_websocket_send_and_receive_translation(self, client, session_and_token):
        """Sending a translate message returns a translation response."""
        session_id, token = session_and_token
        with client.websocket_connect(
            f"/ws/session/{session_id}?token={token}"
        ) as ws:
            ws.receive_json()  # auth_success
            ws.send_json({
                "type": "translate",
                "payload": {"text": "Hello", "source_language": "en"},
            })
            msg = ws.receive_json()
            assert msg["type"] == "translation"
            assert "translations" in msg["payload"]
```

### 2.3 Translation Pipeline End-to-End

```python
# tests/integration/test_translation_pipeline.py
import pytest
from engine.translation import TranslationEngine
from engine.language_negotiator import LanguageNegotiator
from engine.adaptive_learner import AdaptiveLearner
from engine.database import Database


@pytest.fixture
async def pipeline():
    """Set up the full translation pipeline with in-memory DB."""
    db = Database(":memory:")
    await db.initialize()
    return {
        "engine": TranslationEngine(),
        "negotiator": LanguageNegotiator(),
        "learner": AdaptiveLearner(db=db),
        "db": db,
    }


class TestTranslationPipeline:
    """End-to-end integration tests for the translation pipeline."""

    @pytest.mark.asyncio
    async def test_full_translation_with_learning(self, pipeline):
        """Translation is performed and preferences are updated."""
        engine = pipeline["engine"]
        learner = pipeline["learner"]

        result = engine.translate("Hello", "en", "es")
        assert result.text is not None

        await learner.record_translation("user-001", "en", "es")
        prefs = await learner.get_preferences("user-001")
        assert len(prefs["frequent_pairs"]) > 0

    @pytest.mark.asyncio
    async def test_dictionary_override_in_pipeline(self, pipeline):
        """Custom dictionary terms override default translations."""
        engine = pipeline["engine"]
        db = pipeline["db"]

        dict_id = await db.create_dictionary(
            user_id="user-001", name="Tech",
            source_lang="en", target_lang="es",
        )
        await db.add_dictionary_entry(
            dict_id, source_term="bug", target_term="defecto"
        )

        entries = await db.get_dictionary_entries(dict_id)
        result = engine.translate(
            "Found a bug", "en", "es",
            dictionary={e["source_term"]: e["target_term"] for e in entries}
        )
        assert "defecto" in result.text.lower()
```

---

## 3. API Tests

### 3.1 Complete Endpoint Coverage

```python
# tests/api/test_auth_endpoints.py
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


class TestAuthEndpoints:
    """Test every authentication endpoint."""

    def test_register_success(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "new@test.com", "password": "Pass1234",
            "display_name": "New User",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "user" in data
        assert "tokens" in data

    def test_register_duplicate_email(self, client):
        client.post("/api/auth/register", json={
            "email": "dup@test.com", "password": "Pass1234",
            "display_name": "User1",
        })
        resp = client.post("/api/auth/register", json={
            "email": "dup@test.com", "password": "Pass1234",
            "display_name": "User2",
        })
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "EMAIL_EXISTS"

    def test_register_weak_password(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "weak@test.com", "password": "123",
            "display_name": "Weak",
        })
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_register_invalid_email(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "not-an-email", "password": "Pass1234",
            "display_name": "Bad Email",
        })
        assert resp.status_code == 400

    def test_login_success(self, client):
        client.post("/api/auth/register", json={
            "email": "login@test.com", "password": "Pass1234",
            "display_name": "Login User",
        })
        resp = client.post("/api/auth/login", json={
            "email": "login@test.com", "password": "Pass1234",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()["tokens"]

    def test_login_wrong_password(self, client):
        client.post("/api/auth/register", json={
            "email": "wrong@test.com", "password": "Pass1234",
            "display_name": "Wrong PW",
        })
        resp = client.post("/api/auth/login", json={
            "email": "wrong@test.com", "password": "WrongPass1",
        })
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"

    def test_login_nonexistent_user(self, client):
        resp = client.post("/api/auth/login", json={
            "email": "ghost@test.com", "password": "Pass1234",
        })
        assert resp.status_code == 401

    def test_refresh_token(self, client):
        reg = client.post("/api/auth/register", json={
            "email": "refresh@test.com", "password": "Pass1234",
            "display_name": "Refresh",
        })
        refresh_token = reg.json()["tokens"]["refresh_token"]
        resp = client.post("/api/auth/refresh", json={
            "refresh_token": refresh_token,
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()["tokens"]

    def test_refresh_invalid_token(self, client):
        resp = client.post("/api/auth/refresh", json={
            "refresh_token": "invalid-token",
        })
        assert resp.status_code == 401

    def test_me_endpoint(self, client):
        reg = client.post("/api/auth/register", json={
            "email": "me@test.com", "password": "Pass1234",
            "display_name": "Me User",
        })
        token = reg.json()["tokens"]["access_token"]
        resp = client.get("/api/auth/me", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 200
        assert resp.json()["user"]["email"] == "me@test.com"

    def test_me_without_auth(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_logout(self, client):
        reg = client.post("/api/auth/register", json={
            "email": "logout@test.com", "password": "Pass1234",
            "display_name": "Logout",
        })
        token = reg.json()["tokens"]["access_token"]
        resp = client.post("/api/auth/logout", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 200
```

### 3.2 Authorization Tests

```python
# tests/api/test_authorization.py
import pytest
from fastapi.testclient import TestClient
from main import app


class TestAuthorization:
    """Test role-based access control."""

    def test_analytics_requires_admin(self, client, user_headers):
        """Non-admin users cannot access analytics."""
        resp = client.get("/api/analytics/overview", headers=user_headers)
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "ADMIN_REQUIRED"

    def test_analytics_admin_access(self, client, admin_headers):
        """Admin users can access analytics."""
        resp = client.get("/api/analytics/overview", headers=admin_headers)
        assert resp.status_code == 200

    def test_cannot_delete_others_dictionary(self, client):
        """Users cannot delete another user's dictionary."""
        # Create user1's dictionary
        reg1 = client.post("/api/auth/register", json={
            "email": "u1@test.com", "password": "Pass1234",
            "display_name": "User1",
        })
        token1 = reg1.json()["tokens"]["access_token"]
        headers1 = {"Authorization": f"Bearer {token1}"}
        dict_resp = client.post("/api/users/dictionaries", json={
            "name": "Private Dict",
            "source_language": "en", "target_language": "es",
        }, headers=headers1)
        dict_id = dict_resp.json()["dictionary"]["id"]

        # Try to delete as user2
        reg2 = client.post("/api/auth/register", json={
            "email": "u2@test.com", "password": "Pass1234",
            "display_name": "User2",
        })
        token2 = reg2.json()["tokens"]["access_token"]
        headers2 = {"Authorization": f"Bearer {token2}"}
        resp = client.delete(
            f"/api/users/dictionaries/{dict_id}", headers=headers2
        )
        assert resp.status_code == 403

    def test_cannot_end_session_as_non_host(self, client):
        """Non-host participants cannot end a session."""
        # Host creates session
        reg = client.post("/api/auth/register", json={
            "email": "host@test.com", "password": "Pass1234",
            "display_name": "Host",
        })
        host_token = reg.json()["tokens"]["access_token"]
        host_headers = {"Authorization": f"Bearer {host_token}"}
        session = client.post("/api/sessions", json={
            "name": "Auth Test", "type": "group",
            "settings": {"allow_guests": False},
        }, headers=host_headers)
        session_id = session.json()["session"]["id"]

        # Another user tries to delete
        reg2 = client.post("/api/auth/register", json={
            "email": "nothost@test.com", "password": "Pass1234",
            "display_name": "Not Host",
        })
        other_token = reg2.json()["tokens"]["access_token"]
        other_headers = {"Authorization": f"Bearer {other_token}"}
        resp = client.delete(
            f"/api/sessions/{session_id}", headers=other_headers
        )
        assert resp.status_code == 403
```

### 3.3 Input Validation Tests

```python
# tests/api/test_input_validation.py
class TestInputValidation:
    """Test input validation across all endpoints."""

    def test_translate_missing_target_language(self, client, auth_headers):
        resp = client.post("/api/translate", json={
            "text": "Hello"
        }, headers=auth_headers)
        assert resp.status_code == 400

    def test_translate_empty_text(self, client, auth_headers):
        resp = client.post("/api/translate", json={
            "text": "", "target_language": "es"
        }, headers=auth_headers)
        assert resp.status_code == 400

    def test_translate_text_exceeds_limit(self, client, auth_headers):
        resp = client.post("/api/translate", json={
            "text": "a" * 5001, "target_language": "es"
        }, headers=auth_headers)
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "TEXT_TOO_LONG"

    def test_batch_exceeds_50_items(self, client, auth_headers):
        items = [{"text": f"Item {i}", "target_language": "es"} for i in range(51)]
        resp = client.post("/api/translate/batch", json={
            "items": items
        }, headers=auth_headers)
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "BATCH_TOO_LARGE"

    def test_session_invalid_type(self, client, auth_headers):
        resp = client.post("/api/sessions", json={
            "name": "Bad", "type": "invalid_type"
        }, headers=auth_headers)
        assert resp.status_code == 400

    def test_dictionary_missing_languages(self, client, auth_headers):
        resp = client.post("/api/users/dictionaries", json={
            "name": "Incomplete"
        }, headers=auth_headers)
        assert resp.status_code == 400
```

---

## 4. WebSocket Tests

### 4.1 Connection Lifecycle

```python
# tests/websocket/test_ws_lifecycle.py
import pytest
from fastapi.testclient import TestClient
from main import app


class TestWebSocketLifecycle:
    """Test WebSocket connection lifecycle."""

    def test_connect_with_valid_token(self, client, session_id, token):
        """Valid token → auth_success message."""
        with client.websocket_connect(
            f"/ws/session/{session_id}?token={token}"
        ) as ws:
            msg = ws.receive_json()
            assert msg["type"] == "auth_success"
            assert "participants" in msg["payload"]

    def test_connect_with_invalid_token(self, client, session_id):
        """Invalid token → connection closed with 4001."""
        with pytest.raises(Exception):
            with client.websocket_connect(
                f"/ws/session/{session_id}?token=invalid"
            ) as ws:
                pass

    def test_connect_to_nonexistent_session(self, client, token):
        """Non-existent session → connection closed with 4002."""
        with pytest.raises(Exception):
            with client.websocket_connect(
                f"/ws/session/nonexistent?token={token}"
            ) as ws:
                pass

    def test_graceful_leave(self, client, session_id, token):
        """Sending 'leave' message gracefully disconnects."""
        with client.websocket_connect(
            f"/ws/session/{session_id}?token={token}"
        ) as ws:
            ws.receive_json()  # auth_success
            ws.send_json({"type": "leave", "payload": {}})
            # Connection should close cleanly

    def test_participant_joined_broadcast(self, client, session_id, token, token2):
        """When a second participant joins, the first receives participant_joined."""
        with client.websocket_connect(
            f"/ws/session/{session_id}?token={token}"
        ) as ws1:
            ws1.receive_json()  # auth_success
            with client.websocket_connect(
                f"/ws/session/{session_id}?token={token2}"
            ) as ws2:
                msg = ws1.receive_json()
                assert msg["type"] == "participant_joined"
```

### 4.2 Message Routing

```python
# tests/websocket/test_ws_messaging.py
class TestWebSocketMessaging:
    """Test WebSocket message routing."""

    def test_translation_broadcast_to_all(self, client, session_id, token, token2):
        """Translation messages are broadcast to all participants."""
        with client.websocket_connect(
            f"/ws/session/{session_id}?token={token}"
        ) as ws1:
            ws1.receive_json()
            with client.websocket_connect(
                f"/ws/session/{session_id}?token={token2}"
            ) as ws2:
                ws2.receive_json()
                ws1.receive_json()  # participant_joined

                ws1.send_json({
                    "type": "translate",
                    "payload": {"text": "Hello", "source_language": "en"},
                })

                # Both should receive the translation
                msg1 = ws1.receive_json()
                msg2 = ws2.receive_json()
                assert msg1["type"] == "translation"
                assert msg2["type"] == "translation"

    def test_typing_indicator_broadcast(self, client, session_id, token, token2):
        """Typing indicators are broadcast to other participants."""
        with client.websocket_connect(
            f"/ws/session/{session_id}?token={token}"
        ) as ws1:
            ws1.receive_json()
            with client.websocket_connect(
                f"/ws/session/{session_id}?token={token2}"
            ) as ws2:
                ws2.receive_json()
                ws1.receive_json()

                ws1.send_json({
                    "type": "typing",
                    "payload": {"is_typing": True},
                })
                msg = ws2.receive_json()
                assert msg["type"] == "participant_typing"

    def test_reaction_broadcast(self, client, session_id, token, token2):
        """Reactions are broadcast to all participants."""
        with client.websocket_connect(
            f"/ws/session/{session_id}?token={token}"
        ) as ws1:
            ws1.receive_json()
            with client.websocket_connect(
                f"/ws/session/{session_id}?token={token2}"
            ) as ws2:
                ws2.receive_json()
                ws1.receive_json()

                ws1.send_json({
                    "type": "reaction",
                    "payload": {"emoji": "👍"},
                })
                msg = ws2.receive_json()
                assert msg["type"] == "reaction_received"

    def test_invalid_message_type_returns_error(self, client, session_id, token):
        """Unknown message types return an error."""
        with client.websocket_connect(
            f"/ws/session/{session_id}?token={token}"
        ) as ws:
            ws.receive_json()
            ws.send_json({
                "type": "invalid_type",
                "payload": {},
            })
            msg = ws.receive_json()
            assert msg["type"] == "error"
            assert msg["payload"]["code"] == "INVALID_MESSAGE"
```

### 4.3 Multi-Participant Scenarios

```python
# tests/websocket/test_ws_multi_participant.py
class TestMultiParticipant:
    """Test multi-participant WebSocket scenarios."""

    def test_three_participants_all_receive_translation(
        self, client, session_id, tokens
    ):
        """With 3 participants, a message from one reaches the other two."""
        connections = []
        for token in tokens[:3]:
            ws = client.websocket_connect(
                f"/ws/session/{session_id}?token={token}"
            )
            ws.__enter__()
            ws.receive_json()  # auth_success
            connections.append(ws)

        # First user sends
        connections[0].send_json({
            "type": "translate",
            "payload": {"text": "Hello to all"},
        })

        # All three should receive
        for ws in connections:
            msg = ws.receive_json()
            assert msg["type"] in ("translation", "participant_joined")

        for ws in connections:
            ws.__exit__(None, None, None)

    def test_participant_leave_notifies_others(self, client, session_id, token, token2):
        """When a participant leaves, others receive participant_left."""
        with client.websocket_connect(
            f"/ws/session/{session_id}?token={token}"
        ) as ws1:
            ws1.receive_json()
            ws2 = client.websocket_connect(
                f"/ws/session/{session_id}?token={token2}"
            )
            ws2.__enter__()
            ws2.receive_json()
            ws1.receive_json()  # participant_joined

            ws2.send_json({"type": "leave", "payload": {}})
            ws2.__exit__(None, None, None)

            msg = ws1.receive_json()
            assert msg["type"] == "participant_left"
```

### 4.4 Error Scenarios

```python
# tests/websocket/test_ws_errors.py
class TestWebSocketErrors:
    """Test WebSocket error handling."""

    def test_malformed_json_returns_error(self, client, session_id, token):
        """Sending non-JSON data returns an error or disconnects."""
        with client.websocket_connect(
            f"/ws/session/{session_id}?token={token}"
        ) as ws:
            ws.receive_json()
            ws.send_text("not valid json")
            msg = ws.receive_json()
            assert msg["type"] == "error"

    def test_missing_payload_returns_error(self, client, session_id, token):
        """Messages without a payload field return an error."""
        with client.websocket_connect(
            f"/ws/session/{session_id}?token={token}"
        ) as ws:
            ws.receive_json()
            ws.send_json({"type": "translate"})  # no payload
            msg = ws.receive_json()
            assert msg["type"] == "error"

    def test_translate_empty_text_returns_error(self, client, session_id, token):
        """Empty translation text returns an error."""
        with client.websocket_connect(
            f"/ws/session/{session_id}?token={token}"
        ) as ws:
            ws.receive_json()
            ws.send_json({
                "type": "translate",
                "payload": {"text": ""},
            })
            msg = ws.receive_json()
            assert msg["type"] == "error"
```

---

## 5. Load Tests

### Tool: Locust

Load tests are implemented using [Locust](https://locust.io/) for HTTP and a custom WebSocket load testing harness.

### 5.1 Locust Configuration

```python
# tests/load/locustfile.py
from locust import HttpUser, task, between, events
import json
import websocket
import threading


class TransVoixUser(HttpUser):
    """Simulates a typical TransVoix user."""

    wait_time = between(1, 3)
    host = "https://api.transvoix.io/v1"

    def on_start(self):
        """Register and login on start."""
        import uuid
        email = f"loadtest-{uuid.uuid4().hex[:8]}@test.com"
        self.client.post("/api/auth/register", json={
            "email": email,
            "password": "LoadTest1234",
            "display_name": "Load Tester",
        })
        resp = self.client.post("/api/auth/login", json={
            "email": email,
            "password": "LoadTest1234",
        })
        self.token = resp.json()["tokens"]["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    @task(5)
    def translate_text(self):
        """Most common action: translate text."""
        self.client.post("/api/translate", json={
            "text": "Hello, how are you today?",
            "target_language": "es",
        }, headers=self.headers)

    @task(3)
    def detect_language(self):
        """Detect language of text."""
        self.client.post("/api/detect", json={
            "text": "Bonjour le monde, comment allez-vous?",
        }, headers=self.headers)

    @task(2)
    def list_languages(self):
        """List supported languages (public, cached)."""
        self.client.get("/api/languages")

    @task(1)
    def batch_translate(self):
        """Batch translation."""
        self.client.post("/api/translate/batch", json={
            "items": [
                {"text": "Hello", "target_language": "es"},
                {"text": "World", "target_language": "fr"},
                {"text": "Good morning", "target_language": "ja"},
            ],
        }, headers=self.headers)

    @task(1)
    def create_and_end_session(self):
        """Create a session and end it."""
        resp = self.client.post("/api/sessions", json={
            "name": "Load Test Session",
            "type": "one-to-one",
        }, headers=self.headers)
        if resp.status_code == 201:
            session_id = resp.json()["session"]["id"]
            self.client.delete(
                f"/api/sessions/{session_id}", headers=self.headers
            )

    @task(1)
    def get_profile(self):
        """Get user profile."""
        self.client.get("/api/users/profile", headers=self.headers)
```

### 5.2 Test Scenarios

| Scenario | Concurrent Users | Duration | Target Metrics |
|----------|-----------------|----------|----------------|
| **Smoke** | 10 | 2 min | p95 < 500ms, 0% errors |
| **Normal Load** | 100 | 10 min | p95 < 1s, < 0.1% errors |
| **Stress** | 1,000 | 15 min | p95 < 3s, < 1% errors |
| **Spike** | 100→1000→100 | 10 min | Recovery within 30s |
| **Soak** | 200 | 60 min | No memory leaks, stable latency |

### 5.3 Metrics to Capture

| Metric | Target |
|--------|--------|
| **p50 latency** | < 200ms |
| **p90 latency** | < 500ms |
| **p95 latency** | < 1000ms |
| **p99 latency** | < 3000ms |
| **Error rate** | < 0.1% at normal load |
| **Throughput** | > 500 req/s at 100 users |
| **WebSocket message latency** | < 300ms p95 |
| **Memory usage** | Stable over 60 min soak test |
| **CPU usage** | < 80% at normal load |

### 5.4 WebSocket Load Test

```python
# tests/load/ws_load_test.py
import asyncio
import websockets
import json
import time
import statistics


async def ws_load_test(
    url: str, token: str, session_id: str, num_clients: int = 50
):
    """Simulate multiple concurrent WebSocket clients."""
    latencies = []

    async def client_task(client_id):
        uri = f"{url}/ws/session/{session_id}?token={token}"
        async with websockets.connect(uri) as ws:
            # Wait for auth
            await ws.recv()

            for i in range(10):
                start = time.monotonic()
                await ws.send(json.dumps({
                    "type": "translate",
                    "payload": {
                        "text": f"Message {i} from client {client_id}",
                        "source_language": "en",
                    },
                }))
                response = await ws.recv()
                latency = (time.monotonic() - start) * 1000
                latencies.append(latency)
                await asyncio.sleep(0.5)

    tasks = [client_task(i) for i in range(num_clients)]
    await asyncio.gather(*tasks)

    # Report
    print(f"Clients: {num_clients}")
    print(f"Messages: {len(latencies)}")
    print(f"p50: {statistics.median(latencies):.1f}ms")
    print(f"p95: {sorted(latencies)[int(len(latencies)*0.95)]:.1f}ms")
    print(f"p99: {sorted(latencies)[int(len(latencies)*0.99)]:.1f}ms")
    print(f"Max: {max(latencies):.1f}ms")
```

### 5.5 Running Load Tests

```bash
# Smoke test (10 users, 2 minutes)
locust -f tests/load/locustfile.py --users 10 --spawn-rate 2 --run-time 2m --headless

# Normal load (100 users)
locust -f tests/load/locustfile.py --users 100 --spawn-rate 10 --run-time 10m --headless

# Stress test (1000 users)
locust -f tests/load/locustfile.py --users 1000 --spawn-rate 50 --run-time 15m --headless

# With web UI
locust -f tests/load/locustfile.py --web-host 0.0.0.0
```

---

## 6. Security Tests

### 6.1 JWT Token Security

```python
# tests/security/test_jwt_security.py
import pytest
import jwt
import time


class TestJWTSecurity:
    """Test JWT token validation and security."""

    def test_expired_token_rejected(self, client):
        """Expired JWT tokens are rejected with 401."""
        expired_token = jwt.encode(
            {"sub": "user-001", "exp": int(time.time()) - 3600},
            "secret", algorithm="HS256"
        )
        resp = client.get("/api/auth/me", headers={
            "Authorization": f"Bearer {expired_token}"
        })
        assert resp.status_code == 401

    def test_token_with_wrong_secret_rejected(self, client):
        """Tokens signed with wrong secret are rejected."""
        bad_token = jwt.encode(
            {"sub": "user-001", "exp": int(time.time()) + 3600},
            "wrong-secret", algorithm="HS256"
        )
        resp = client.get("/api/auth/me", headers={
            "Authorization": f"Bearer {bad_token}"
        })
        assert resp.status_code == 401

    def test_token_with_no_exp_rejected(self, client):
        """Tokens without expiration claim are rejected."""
        no_exp_token = jwt.encode(
            {"sub": "user-001"}, "secret", algorithm="HS256"
        )
        resp = client.get("/api/auth/me", headers={
            "Authorization": f"Bearer {no_exp_token}"
        })
        assert resp.status_code == 401

    def test_revoked_token_rejected(self, client, auth_headers, refresh_token):
        """Tokens are rejected after logout/revocation."""
        client.post("/api/auth/logout", headers=auth_headers)
        resp = client.get("/api/auth/me", headers=auth_headers)
        assert resp.status_code == 401

    def test_malformed_bearer_header(self, client):
        """Malformed Authorization header returns 401."""
        resp = client.get("/api/auth/me", headers={
            "Authorization": "NotBearer token"
        })
        assert resp.status_code == 401

    def test_empty_bearer_token(self, client):
        """Empty bearer token returns 401."""
        resp = client.get("/api/auth/me", headers={
            "Authorization": "Bearer "
        })
        assert resp.status_code == 401
```

### 6.2 SQL Injection Testing

```python
# tests/security/test_sql_injection.py
class TestSQLInjection:
    """Test SQL injection prevention."""

    SQL_PAYLOADS = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "1; SELECT * FROM users",
        "' UNION SELECT password FROM users --",
        "'; INSERT INTO users VALUES('hacker','hack'); --",
    ]

    def test_login_sql_injection(self, client):
        """SQL injection in login email/password is safely handled."""
        for payload in self.SQL_PAYLOADS:
            resp = client.post("/api/auth/login", json={
                "email": payload,
                "password": payload,
            })
            assert resp.status_code in (400, 401)  # Not 500

    def test_translate_sql_injection(self, client, auth_headers):
        """SQL injection in translation text is safely handled."""
        for payload in self.SQL_PAYLOADS:
            resp = client.post("/api/translate", json={
                "text": payload,
                "target_language": "es",
            }, headers=auth_headers)
            assert resp.status_code in (200, 400)  # Not 500

    def test_session_id_sql_injection(self, client, auth_headers):
        """SQL injection in URL path parameters is safely handled."""
        for payload in self.SQL_PAYLOADS:
            resp = client.get(
                f"/api/sessions/{payload}", headers=auth_headers
            )
            assert resp.status_code in (400, 404, 422)  # Not 500

    def test_dictionary_name_sql_injection(self, client, auth_headers):
        """SQL injection in dictionary names is safely handled."""
        for payload in self.SQL_PAYLOADS:
            resp = client.post("/api/users/dictionaries", json={
                "name": payload,
                "source_language": "en",
                "target_language": "es",
            }, headers=auth_headers)
            assert resp.status_code in (201, 400)  # Not 500
```

### 6.3 XSS Testing

```python
# tests/security/test_xss.py
class TestXSS:
    """Test cross-site scripting prevention."""

    XSS_PAYLOADS = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '"><script>alert(document.cookie)</script>',
        "javascript:alert(1)",
        '<svg onload=alert(1)>',
        '{{constructor.constructor("return this")().alert(1)}}',
    ]

    def test_translation_sanitizes_xss(self, client, auth_headers):
        """XSS payloads in translation input are sanitized in output."""
        for payload in self.XSS_PAYLOADS:
            resp = client.post("/api/translate", json={
                "text": payload,
                "target_language": "es",
            }, headers=auth_headers)
            if resp.status_code == 200:
                result = resp.json()["translation"]["text"]
                assert "<script>" not in result.lower()
                assert "onerror=" not in result.lower()
                assert "javascript:" not in result.lower()

    def test_display_name_sanitizes_xss(self, client):
        """XSS in display names is sanitized."""
        for payload in self.XSS_PAYLOADS:
            resp = client.post("/api/auth/register", json={
                "email": f"xss-{hash(payload) % 10000}@test.com",
                "password": "SecureP@ss1",
                "display_name": payload,
            })
            if resp.status_code == 201:
                name = resp.json()["user"]["display_name"]
                assert "<script>" not in name.lower()

    def test_session_name_sanitizes_xss(self, client, auth_headers):
        """XSS in session names is sanitized."""
        for payload in self.XSS_PAYLOADS:
            resp = client.post("/api/sessions", json={
                "name": payload, "type": "group",
            }, headers=auth_headers)
            if resp.status_code == 201:
                name = resp.json()["session"]["name"]
                assert "<script>" not in name.lower()
```

### 6.4 CSRF Testing

```python
# tests/security/test_csrf.py
class TestCSRF:
    """Test CSRF protection."""

    def test_cors_rejects_unknown_origin(self, client):
        """Requests from unknown origins are rejected by CORS."""
        resp = client.options("/api/translate", headers={
            "Origin": "https://evil-site.com",
            "Access-Control-Request-Method": "POST",
        })
        assert "evil-site.com" not in resp.headers.get(
            "Access-Control-Allow-Origin", ""
        )

    def test_state_changing_requires_auth(self, client):
        """All state-changing endpoints require authentication."""
        state_endpoints = [
            ("POST", "/api/translate"),
            ("POST", "/api/sessions"),
            ("POST", "/api/users/dictionaries"),
            ("PUT", "/api/users/profile"),
            ("DELETE", "/api/users/preferences"),
        ]
        for method, path in state_endpoints:
            resp = getattr(client, method.lower())(path, json={})
            assert resp.status_code == 401
```

### 6.5 Rate Limiting Enforcement

```python
# tests/security/test_rate_limiting.py
class TestRateLimiting:
    """Test rate limiting enforcement."""

    def test_exceeding_rate_limit_returns_429(self, client, auth_headers):
        """Exceeding rate limit returns 429 with retry-after."""
        for i in range(150):  # Free tier: 100/min
            resp = client.post("/api/translate", json={
                "text": f"Request {i}", "target_language": "es"
            }, headers=auth_headers)
            if resp.status_code == 429:
                assert "retry_after" in resp.json()["error"]["details"]
                return
        pytest.fail("Rate limit was not enforced within 150 requests")

    def test_rate_limit_headers_present(self, client, auth_headers):
        """Rate limit headers are included in responses."""
        resp = client.post("/api/translate", json={
            "text": "Hello", "target_language": "es"
        }, headers=auth_headers)
        assert "X-RateLimit-Limit" in resp.headers
        assert "X-RateLimit-Remaining" in resp.headers
        assert "X-RateLimit-Reset" in resp.headers

    def test_login_brute_force_protection(self, client):
        """Multiple failed logins trigger account lockout."""
        client.post("/api/auth/register", json={
            "email": "brute@test.com", "password": "Pass1234",
            "display_name": "Brute",
        })
        for i in range(10):
            client.post("/api/auth/login", json={
                "email": "brute@test.com", "password": "Wrong"
            })
        resp = client.post("/api/auth/login", json={
            "email": "brute@test.com", "password": "Pass1234"
        })
        assert resp.status_code in (403, 429)
```

### 6.6 Authentication Bypass & Privilege Escalation

```python
# tests/security/test_auth_bypass.py
class TestAuthBypass:
    """Test authentication bypass and privilege escalation attempts."""

    def test_cannot_modify_role_in_registration(self, client):
        """Users cannot set their own role during registration."""
        resp = client.post("/api/auth/register", json={
            "email": "admin_attempt@test.com",
            "password": "Pass1234",
            "display_name": "Sneaky",
            "role": "admin",
        })
        if resp.status_code == 201:
            assert resp.json()["user"]["role"] != "admin"

    def test_cannot_access_other_users_recordings(self, client):
        """Users cannot access recordings belonging to other users."""
        # Create user 1 with recordings
        reg1 = client.post("/api/auth/register", json={
            "email": "rec1@test.com", "password": "Pass1234",
            "display_name": "User1",
        })
        token1 = reg1.json()["tokens"]["access_token"]

        # Create user 2
        reg2 = client.post("/api/auth/register", json={
            "email": "rec2@test.com", "password": "Pass1234",
            "display_name": "User2",
        })
        token2 = reg2.json()["tokens"]["access_token"]

        # User 2 tries to access user 1's recordings
        recordings = client.get("/api/recordings", headers={
            "Authorization": f"Bearer {token1}"
        })
        if recordings.status_code == 200 and recordings.json()["recordings"]:
            rec_id = recordings.json()["recordings"][0]["id"]
            resp = client.get(f"/api/recordings/{rec_id}", headers={
                "Authorization": f"Bearer {token2}"
            })
            assert resp.status_code == 403

    def test_api_key_cannot_access_admin_endpoints(self, client):
        """API keys cannot access admin-only endpoints."""
        resp = client.get("/api/analytics/overview", headers={
            "X-API-Key": "tvx_live_testkey123"
        })
        assert resp.status_code in (401, 403)
```

---

## 7. Translation Accuracy Tests

### 7.1 BLEU Score Measurement

```python
# tests/accuracy/test_translation_quality.py
import pytest
from nltk.translate.bleu_score import sentence_bleu, SmoothingFunction
from engine.translation import TranslationEngine


LANGUAGE_PAIRS = [
    ("en", "es"),  # English → Spanish
    ("en", "fr"),  # English → French
    ("en", "de"),  # English → German
    ("en", "ja"),  # English → Japanese
    ("en", "zh"),  # English → Chinese
    ("en", "ko"),  # English → Korean
    ("en", "pt"),  # English → Portuguese
    ("en", "ar"),  # English → Arabic
    ("en", "hi"),  # English → Hindi
    ("en", "ru"),  # English → Russian
]

# Reference translations (human-verified)
TEST_SENTENCES = {
    ("en", "es"): [
        {
            "source": "The meeting has been postponed until next week.",
            "reference": "La reunión ha sido pospuesta hasta la próxima semana.",
        },
        {
            "source": "Please send me the updated report by Friday.",
            "reference": "Por favor envíame el informe actualizado para el viernes.",
        },
        {
            "source": "I look forward to working with you on this project.",
            "reference": "Espero trabajar contigo en este proyecto.",
        },
    ],
    # ... additional language pairs with reference translations
}


class TestTranslationQuality:
    """Measure translation accuracy using BLEU scores."""

    @pytest.fixture
    def engine(self):
        return TranslationEngine()

    @pytest.mark.parametrize("source_lang,target_lang", LANGUAGE_PAIRS)
    def test_bleu_score_above_threshold(self, engine, source_lang, target_lang):
        """BLEU score for each language pair should be above 0.3."""
        test_data = TEST_SENTENCES.get((source_lang, target_lang), [])
        if not test_data:
            pytest.skip(f"No test data for {source_lang}→{target_lang}")

        scores = []
        smoother = SmoothingFunction()
        for item in test_data:
            result = engine.translate(item["source"], source_lang, target_lang)
            reference = item["reference"].split()
            hypothesis = result.text.split()
            score = sentence_bleu(
                [reference], hypothesis,
                smoothing_function=smoother.method1
            )
            scores.append(score)

        avg_bleu = sum(scores) / len(scores)
        assert avg_bleu >= 0.3, (
            f"BLEU score {avg_bleu:.3f} below threshold for "
            f"{source_lang}→{target_lang}"
        )
```

### 7.2 Context Preservation

```python
# tests/accuracy/test_context_preservation.py
class TestContextPreservation:
    """Test that context is preserved across translations."""

    def test_pronoun_resolution_with_context(self, engine):
        """Pronouns are correctly resolved when context is provided."""
        context = "Maria went to the store."
        result = engine.translate(
            "She bought some apples.", "en", "es", context=context
        )
        # "She" should be translated as feminine "Ella"
        assert "Ella" in result.text or "ella" in result.text

    def test_formal_vs_informal_register(self, engine):
        """Formality setting affects translation output."""
        formal = engine.translate(
            "How are you?", "en", "es", formality="formal"
        )
        informal = engine.translate(
            "How are you?", "en", "es", formality="informal"
        )
        # Formal: "usted", Informal: "tú"
        assert formal.text != informal.text

    def test_technical_context_preservation(self, engine):
        """Technical terms maintain meaning in context."""
        result = engine.translate(
            "The server crashed due to a memory leak.", "en", "es"
        )
        # Technical terms should be preserved/translated appropriately
        assert result.text is not None
        assert len(result.text) > 0
```

### 7.3 Edge Cases

```python
# tests/accuracy/test_translation_edge_cases.py
class TestTranslationEdgeCases:
    """Test edge cases in translation."""

    def test_empty_input(self, engine):
        """Empty input raises appropriate error."""
        with pytest.raises(ValueError):
            engine.translate("", "en", "es")

    def test_whitespace_only_input(self, engine):
        """Whitespace-only input raises appropriate error."""
        with pytest.raises(ValueError):
            engine.translate("   \n\t  ", "en", "es")

    def test_very_long_text(self, engine):
        """Text at the maximum limit (5000 chars) is handled."""
        text = "Hello world. " * 400  # ~5200 chars
        result = engine.translate(text[:5000], "en", "es")
        assert result.text is not None

    def test_special_characters(self, engine):
        """Special characters (!@#$%^&*) are preserved."""
        result = engine.translate(
            "Email: user@example.com, Price: $99.99!", "en", "es"
        )
        assert "@" in result.text
        assert "$" in result.text or "99.99" in result.text

    def test_emoji_preservation(self, engine):
        """Emoji are preserved in translation output."""
        result = engine.translate(
            "I love this! 🎉❤️🌍", "en", "es"
        )
        assert "🎉" in result.text
        assert "❤️" in result.text

    def test_numbers_preserved(self, engine):
        """Numbers remain unchanged in translation."""
        result = engine.translate(
            "The population is 7,800,000,000.", "en", "es"
        )
        assert "7" in result.text and "800" in result.text

    def test_urls_preserved(self, engine):
        """URLs are not translated."""
        result = engine.translate(
            "Visit https://transvoix.io for more info.", "en", "es"
        )
        assert "https://transvoix.io" in result.text

    def test_code_switching(self, engine):
        """Mixed language input is handled gracefully."""
        result = engine.translate(
            "I went to the café and ordered a croissant", "en", "es"
        )
        assert result.text is not None

    def test_same_source_and_target(self, engine):
        """Same source and target language returns original text."""
        result = engine.translate("Hello world", "en", "en")
        assert result.text == "Hello world"

    def test_custom_dictionary_overrides(self, engine):
        """Custom dictionary entries override default translations."""
        dictionary = {"cloud": "nube informática"}
        result = engine.translate(
            "Deploy to the cloud", "en", "es", dictionary=dictionary
        )
        assert "nube informática" in result.text
```

---

## 8. Voice/Audio Tests

### 8.1 Browser Compatibility Matrix

| Feature | Chrome 90+ | Firefox 85+ | Safari 15+ | Edge 90+ | Chrome Android | Safari iOS |
|---------|-----------|-------------|-----------|---------|----------------|------------|
| Web Speech API (Recognition) | ✅ Native | ⚠️ Limited | ⚠️ Limited | ✅ Native | ✅ Native | ⚠️ Limited |
| Speech Synthesis (TTS) | ✅ Native | ✅ Native | ✅ Native | ✅ Native | ✅ Native | ✅ Native |
| MediaStream (Microphone) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AudioContext | ✅ | ✅ | ✅ (prefixed) | ✅ | ✅ | ✅ (prefixed) |
| Audio Visualization | ✅ | ✅ | ⚠️ Partial | ✅ | ✅ | ⚠️ Partial |

### 8.2 Automated Audio Tests

```python
# tests/audio/test_audio_features.py
import pytest


class TestMicrophonePermission:
    """Test microphone permission handling (via Playwright)."""

    @pytest.mark.browser
    async def test_microphone_permission_prompt(self, page):
        """App correctly prompts for microphone permission."""
        await page.goto("http://localhost:8000")
        # Grant permission
        await page.context.grant_permissions(["microphone"])
        mic_btn = page.locator("#mic-button")
        await mic_btn.click()
        # Check that recording indicator appears
        indicator = page.locator("#recording-indicator")
        await expect(indicator).to_be_visible()

    @pytest.mark.browser
    async def test_microphone_denied_shows_fallback(self, page):
        """When mic permission denied, text input fallback is shown."""
        await page.goto("http://localhost:8000")
        # Deny permission (default)
        mic_btn = page.locator("#mic-button")
        await mic_btn.click()
        fallback = page.locator("#text-input-fallback")
        await expect(fallback).to_be_visible()


class TestAudioVisualization:
    """Test audio waveform visualization."""

    @pytest.mark.browser
    async def test_waveform_renders_during_speech(self, page):
        """Audio visualization canvas renders during active speech."""
        await page.goto("http://localhost:8000")
        await page.context.grant_permissions(["microphone"])
        canvas = page.locator("#audio-visualizer")
        await expect(canvas).to_be_visible()

    @pytest.mark.browser
    async def test_waveform_stops_after_speech(self, page):
        """Audio visualization stops when speech recognition ends."""
        # Test that canvas goes flat when not recording
        pass


class TestSpeechRecognition:
    """Test speech recognition accuracy by language."""

    # Manual test checklist — automated where possible

    LANGUAGES_TO_TEST = [
        ("en-US", "Hello, how are you today?"),
        ("es-ES", "Hola, ¿cómo estás hoy?"),
        ("fr-FR", "Bonjour, comment allez-vous?"),
        ("de-DE", "Hallo, wie geht es Ihnen?"),
        ("ja-JP", "こんにちは、お元気ですか？"),
        ("zh-CN", "你好，你今天好吗？"),
        ("ko-KR", "안녕하세요, 오늘 어떠세요?"),
        ("pt-BR", "Olá, como você está?"),
        ("ar-SA", "مرحبا، كيف حالك؟"),
        ("hi-IN", "नमस्ते, आप कैसे हैं?"),
    ]

    @pytest.mark.parametrize("locale,expected_text", LANGUAGES_TO_TEST)
    @pytest.mark.manual
    def test_speech_recognition_accuracy(self, locale, expected_text):
        """
        MANUAL TEST: Speak the expected text and verify recognition output.
        
        Steps:
        1. Set browser language to {locale}
        2. Click microphone button
        3. Speak: "{expected_text}"
        4. Verify recognized text matches expected with > 80% accuracy
        """
        pass


class TestTTSVoiceQuality:
    """Text-to-Speech voice quality tests (manual assessment)."""

    @pytest.mark.manual
    def test_tts_naturalness_english(self):
        """
        MANUAL TEST: Assess TTS voice quality for English.
        
        Criteria (1-5 scale):
        - Naturalness: Does it sound human-like?
        - Intelligibility: Is every word clearly understandable?
        - Prosody: Is the intonation natural?
        - Speed: Is the speaking rate comfortable?
        
        Target: Average score ≥ 3.5/5
        """
        pass

    @pytest.mark.manual
    def test_tts_all_supported_languages(self):
        """
        MANUAL TEST: Verify TTS works for all supported languages.
        
        For each language:
        1. Translate a standard sentence
        2. Click the speaker icon
        3. Verify audio plays
        4. Rate quality (1-5)
        """
        pass


class TestLatencyMeasurement:
    """Measure voice pipeline latency."""

    @pytest.mark.browser
    async def test_speech_to_translation_latency(self, page):
        """
        Measure the time from speech input to translated output display.
        
        Target: < 2 seconds for short phrases (< 10 words)
        """
        await page.goto("http://localhost:8000")
        # Use page.evaluate to measure performance.now() timestamps
        # between speech recognition result and translation display
        pass
```

---

## 9. Browser Compatibility Tests

### 9.1 Test Matrix

| Test Area | Chrome 90+ | Firefox 85+ | Safari 15+ | Edge 90+ | Chrome Android | Safari iOS |
|-----------|-----------|-------------|-----------|---------|----------------|------------|
| **Page Load** | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Manual | ✅ Manual |
| **Login/Register** | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Manual | ✅ Manual |
| **Translation (Text)** | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Manual | ✅ Manual |
| **Translation (Voice)** | ✅ Auto | ⚠️ Fallback | ⚠️ Fallback | ✅ Auto | ✅ Manual | ⚠️ Manual |
| **WebSocket** | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Manual | ✅ Manual |
| **Audio Visualization** | ✅ Auto | ✅ Auto | ⚠️ Partial | ✅ Auto | ✅ Manual | ⚠️ Manual |
| **Recording/Export** | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Manual | ✅ Manual |
| **Responsive Layout** | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Manual | ✅ Manual |
| **Custom Dictionaries** | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Manual | ✅ Manual |
| **Dark Mode** | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Manual | ✅ Manual |

> ✅ Auto = Automated via Playwright  
> ⚠️ Fallback = Feature uses fallback mechanism; verify fallback works  
> ✅ Manual = Manual testing required on physical devices

### 9.2 Playwright Cross-Browser Tests

```python
# tests/browser/test_cross_browser.py
import pytest
from playwright.async_api import async_playwright


@pytest.fixture(params=["chromium", "firefox", "webkit"])
async def browser_page(request):
    """Parametrized fixture for cross-browser testing."""
    async with async_playwright() as p:
        browser_type = getattr(p, request.param)
        browser = await browser_type.launch()
        page = await browser.new_page()
        yield page, request.param
        await browser.close()


class TestCrossBrowser:
    """Cross-browser compatibility tests."""

    @pytest.mark.browser
    async def test_page_loads_without_errors(self, browser_page):
        """Page loads without JavaScript errors in all browsers."""
        page, browser = browser_page
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))

        await page.goto("http://localhost:8000")
        await page.wait_for_load_state("networkidle")

        assert len(errors) == 0, f"JS errors in {browser}: {errors}"

    @pytest.mark.browser
    async def test_login_form_works(self, browser_page):
        """Login form submits correctly in all browsers."""
        page, browser = browser_page
        await page.goto("http://localhost:8000/login")

        await page.fill("#email", "test@example.com")
        await page.fill("#password", "SecureP@ss1")
        await page.click("#login-button")

        await page.wait_for_url("**/dashboard**")

    @pytest.mark.browser
    async def test_responsive_layout_mobile(self, browser_page):
        """Layout adapts correctly to mobile viewport."""
        page, browser = browser_page
        await page.set_viewport_size({"width": 375, "height": 812})
        await page.goto("http://localhost:8000")

        # Check mobile menu is visible
        mobile_menu = page.locator("#mobile-menu-toggle")
        assert await mobile_menu.is_visible()

    @pytest.mark.browser
    async def test_websocket_connects(self, browser_page):
        """WebSocket connection establishes in all browsers."""
        page, browser = browser_page
        await page.goto("http://localhost:8000")

        # Check WebSocket connection indicator
        ws_status = page.locator("#connection-status")
        await page.wait_for_function(
            "document.querySelector('#connection-status').textContent === 'Connected'"
        )

    @pytest.mark.browser
    async def test_web_speech_fallback_firefox(self, browser_page):
        """Firefox falls back gracefully when Web Speech API is limited."""
        page, browser = browser_page
        if browser != "firefox":
            pytest.skip("Firefox-specific test")

        await page.goto("http://localhost:8000")
        # Verify text input mode is available as fallback
        text_input = page.locator("#text-input")
        assert await text_input.is_visible()

    @pytest.mark.browser
    async def test_safari_audio_context_prefix(self, browser_page):
        """Safari uses webkitAudioContext fallback correctly."""
        page, browser = browser_page
        if browser != "webkit":
            pytest.skip("Safari-specific test")

        result = await page.evaluate("""
            () => typeof (window.AudioContext || window.webkitAudioContext)
        """)
        assert result == "function"
```

### 9.3 Safari Limitations & Fallbacks

| Limitation | Fallback Strategy |
|-----------|-------------------|
| Web Speech API limited | Text input mode with on-screen keyboard |
| AudioContext requires prefix | Use `webkitAudioContext` with feature detection |
| Auto-play audio blocked | Require user gesture before TTS playback |
| WebSocket reconnection | Custom reconnection handler (Safari drops connections more frequently) |
| Clipboard API limited | Manual copy via selection + document.execCommand |

---

## 10. End-to-End Tests

### 10.1 Full Translation Flow

```python
# tests/e2e/test_full_flows.py
import pytest
from playwright.async_api import async_playwright


class TestEndToEndFlows:
    """Full end-to-end user journey tests."""

    @pytest.mark.e2e
    async def test_full_translation_flow(self):
        """
        Complete flow: Login → Create session → Join → Translate → Export.
        
        Steps:
        1. User A registers and logs in
        2. User A creates a translation session
        3. User B joins via invite code
        4. User A sends a message (English)
        5. User B receives translated message (Spanish)
        6. User B replies (Spanish)
        7. User A receives translated reply (English)
        8. User A ends the session
        9. User A exports the transcript as SRT
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch()

            # User A
            page_a = await browser.new_page()
            await page_a.goto("http://localhost:8000")

            # Register User A
            await page_a.click("#register-link")
            await page_a.fill("#email", "alice@test.com")
            await page_a.fill("#password", "SecureP@ss1")
            await page_a.fill("#display-name", "Alice")
            await page_a.click("#register-button")
            await page_a.wait_for_url("**/dashboard**")

            # Create session
            await page_a.click("#create-session")
            await page_a.fill("#session-name", "E2E Test")
            await page_a.click("#session-type-group")
            await page_a.click("#create-session-submit")
            join_code = await page_a.locator("#join-code").text_content()

            # User B
            page_b = await browser.new_page()
            await page_b.goto("http://localhost:8000")

            # Register User B
            await page_b.click("#register-link")
            await page_b.fill("#email", "bob@test.com")
            await page_b.fill("#password", "SecureP@ss1")
            await page_b.fill("#display-name", "Bob")
            await page_b.click("#register-button")
            await page_b.wait_for_url("**/dashboard**")

            # Join session
            await page_b.click("#join-session")
            await page_b.fill("#join-code-input", join_code)
            await page_b.select_option("#language-select", "es")
            await page_b.click("#join-session-submit")

            # User A sends message
            await page_a.fill("#message-input", "Hello, welcome to the meeting!")
            await page_a.click("#send-button")

            # User B should see translated message
            translated = page_b.locator(".message-translated").last
            await translated.wait_for()
            assert "reunión" in (await translated.text_content()).lower()

            # User A ends session
            await page_a.click("#end-session")
            await page_a.click("#confirm-end")

            # Export transcript
            await page_a.click("#export-transcript")
            await page_a.select_option("#export-format", "srt")
            download = await page_a.expect_download()
            await page_a.click("#download-export")

            await browser.close()

    @pytest.mark.e2e
    async def test_multi_participant_session(self):
        """
        Test 3 participants with different languages communicating.
        
        - Alice: English
        - Bob: Spanish  
        - Yuki: Japanese
        """
        pass  # Similar structure to above

    @pytest.mark.e2e
    async def test_language_switching_mid_conversation(self):
        """
        Test switching language mid-conversation.
        
        Steps:
        1. User starts speaking English
        2. User switches to French mid-session
        3. Verify new messages are translated from French
        4. Verify transcript shows language switch
        """
        pass

    @pytest.mark.e2e
    async def test_recording_and_export(self):
        """
        Test auto-recording and export in multiple formats.
        
        Steps:
        1. Create session with auto_record=true
        2. Send several messages
        3. End session
        4. Export as SRT, VTT, TXT, JSON, CSV
        5. Verify each format is valid
        """
        pass

    @pytest.mark.e2e
    async def test_user_preferences_persistence(self):
        """
        Test that user preferences persist across sessions.
        
        Steps:
        1. Login
        2. Set preferred formality to 'formal'
        3. Set speech rate to 0.8
        4. Add target languages
        5. Logout
        6. Login again
        7. Verify all preferences are preserved
        """
        pass

    @pytest.mark.e2e
    async def test_custom_dictionary_in_session(self):
        """
        Test that custom dictionary overrides work in real-time sessions.
        
        Steps:
        1. Create a custom dictionary with medical terms
        2. Create a session
        3. Send a message containing dictionary terms
        4. Verify custom translations are used
        """
        pass
```

---

## 11. CI/CD Pipeline

### 11.1 GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: TransVoix CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  PYTHON_VERSION: "3.11"
  NODE_VERSION: "18"

jobs:
  # ─── Stage 1: Lint ───
  lint:
    name: Lint & Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install dependencies
        run: |
          pip install ruff black mypy isort

      - name: Run ruff (linting)
        run: ruff check .

      - name: Run black (formatting)
        run: black --check .

      - name: Run isort (import sorting)
        run: isort --check-only .

      - name: Run mypy (type checking)
        run: mypy engine/ --ignore-missing-imports

  # ─── Stage 2: Unit Tests ───
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Run unit tests with coverage
        run: |
          pytest tests/unit/ \
            --cov=engine \
            --cov-report=xml \
            --cov-report=html \
            --cov-fail-under=80 \
            -v --tb=short

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: htmlcov/

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: coverage.xml

  # ─── Stage 3: Integration Tests ───
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Run integration tests
        run: |
          pytest tests/integration/ tests/api/ tests/websocket/ \
            -v --tb=short -x

  # ─── Stage 4: Security Tests ───
  security-tests:
    name: Security Tests
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
          pip install bandit safety

      - name: Run security tests
        run: pytest tests/security/ -v --tb=short

      - name: Run Bandit (static security analysis)
        run: bandit -r engine/ -ll -ii

      - name: Check dependencies for vulnerabilities
        run: safety check --full-report

  # ─── Stage 5: Build ───
  build:
    name: Build & Package
    runs-on: ubuntu-latest
    needs: [integration-tests, security-tests]
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Build Docker image
        run: |
          docker build -t transvoix:${{ github.sha }} .
          docker tag transvoix:${{ github.sha }} transvoix:latest

      - name: Run smoke tests against Docker
        run: |
          docker run -d -p 8000:8000 --name transvoix-test transvoix:latest
          sleep 5
          curl -f http://localhost:8000/api/languages || exit 1
          docker stop transvoix-test

      - name: Push to registry (main branch only)
        if: github.ref == 'refs/heads/main'
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
          docker push transvoix:${{ github.sha }}
          docker push transvoix:latest

  # ─── Stage 6: Deploy (main branch only) ───
  deploy:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging
        run: |
          echo "Deploying transvoix:${{ github.sha }} to staging..."
          # deployment commands here

      - name: Run smoke tests against staging
        run: |
          curl -f https://staging.transvoix.io/api/languages || exit 1

      - name: Run E2E tests against staging
        run: |
          pip install playwright pytest-playwright
          playwright install
          pytest tests/e2e/ --base-url=https://staging.transvoix.io -v

  # ─── Scheduled: Translation Accuracy ───
  accuracy-tests:
    name: Translation Accuracy
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
          pip install nltk
          python -c "import nltk; nltk.download('punkt')"

      - name: Run accuracy tests
        run: pytest tests/accuracy/ -v --tb=short

  # ─── Scheduled: Load Tests ───
  load-tests:
    name: Load Tests
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_dispatch'
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install locust

      - name: Run load tests (smoke)
        run: |
          locust -f tests/load/locustfile.py \
            --host=https://staging.transvoix.io/v1 \
            --users 10 --spawn-rate 2 \
            --run-time 2m --headless \
            --csv=load-results

      - name: Upload load test results
        uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: load-results*
```

### 11.2 Pipeline Stages Diagram

```
┌────────┐    ┌─────────────┐    ┌──────────────────┐    ┌───────┐    ┌────────┐
│  Lint  │───►│ Unit Tests  │───►│ Integration +    │───►│ Build │───►│ Deploy │
│        │    │ (coverage)  │    │ Security Tests   │    │       │    │        │
└────────┘    └─────────────┘    └──────────────────┘    └───────┘    └────────┘
                                                                         │
                                                                         ▼
                                                                  ┌──────────────┐
                                                                  │ E2E Smoke    │
                                                                  │ Tests        │
                                                                  └──────────────┘

Scheduled / On-demand:
┌────────────────────┐    ┌────────────────┐
│ Translation        │    │ Load Tests     │
│ Accuracy Tests     │    │ (Locust)       │
│ (Weekly)           │    │ (Pre-release)  │
└────────────────────┘    └────────────────┘
```

### 11.3 Coverage Reporting

```ini
# pytest.ini
[pytest]
testpaths = tests
asyncio_mode = auto
markers =
    unit: Unit tests
    integration: Integration tests
    api: API endpoint tests
    websocket: WebSocket tests
    security: Security tests
    accuracy: Translation accuracy tests
    browser: Browser-based tests (requires Playwright)
    e2e: End-to-end tests
    manual: Manual test cases
    load: Load/performance tests

# .coveragerc
[run]
source = engine
omit =
    tests/*
    */__pycache__/*

[report]
fail_under = 80
show_missing = true
exclude_lines =
    pragma: no cover
    def __repr__
    if __name__ == .__main__
    raise NotImplementedError
```

---

## Test Directory Structure

```
tests/
├── conftest.py                    # Shared fixtures (client, auth, db)
├── unit/
│   ├── test_translation.py        # Translation engine tests
│   ├── test_language_negotiator.py # Language negotiation tests
│   ├── test_session_manager.py     # Session management tests
│   ├── test_adaptive_learner.py    # Adaptive learning tests
│   ├── test_security.py            # Security & auth tests
│   ├── test_analytics.py           # Analytics engine tests
│   └── test_database.py            # Database layer tests
├── integration/
│   ├── test_api_routes.py          # API route integration
│   ├── test_websocket.py           # WebSocket integration
│   └── test_translation_pipeline.py # Full pipeline tests
├── api/
│   ├── test_auth_endpoints.py      # Auth API tests
│   ├── test_authorization.py       # RBAC tests
│   └── test_input_validation.py    # Input validation tests
├── websocket/
│   ├── test_ws_lifecycle.py        # Connection lifecycle
│   ├── test_ws_messaging.py        # Message routing
│   ├── test_ws_multi_participant.py # Multi-participant
│   └── test_ws_errors.py           # Error scenarios
├── security/
│   ├── test_jwt_security.py        # JWT validation
│   ├── test_sql_injection.py       # SQL injection prevention
│   ├── test_xss.py                 # XSS prevention
│   ├── test_csrf.py                # CSRF protection
│   ├── test_rate_limiting.py       # Rate limit enforcement
│   └── test_auth_bypass.py         # Auth bypass attempts
├── accuracy/
│   ├── test_translation_quality.py # BLEU scores
│   ├── test_context_preservation.py # Context tests
│   └── test_translation_edge_cases.py # Edge cases
├── audio/
│   └── test_audio_features.py      # Voice/audio tests
├── browser/
│   └── test_cross_browser.py       # Browser compatibility
├── e2e/
│   └── test_full_flows.py          # End-to-end flows
├── load/
│   ├── locustfile.py               # Locust load tests
│   └── ws_load_test.py             # WebSocket load tests
└── fixtures/
    ├── sample_audio/               # Sample audio files
    ├── reference_translations/     # BLEU reference data
    └── test_dictionaries/          # Test dictionary data
```

---

## Running Tests

```bash
# ─── Run all unit tests ───
pytest tests/unit/ -v

# ─── Run with coverage ───
pytest tests/unit/ --cov=engine --cov-report=html --cov-fail-under=80

# ─── Run specific test module ───
pytest tests/unit/test_translation.py -v

# ─── Run integration tests ───
pytest tests/integration/ -v

# ─── Run API tests ───
pytest tests/api/ -v

# ─── Run WebSocket tests ───
pytest tests/websocket/ -v

# ─── Run security tests ───
pytest tests/security/ -v

# ─── Run browser tests (requires Playwright) ───
playwright install
pytest tests/browser/ -v --browser chromium --browser firefox --browser webkit

# ─── Run E2E tests ───
pytest tests/e2e/ -v

# ─── Run load tests ───
locust -f tests/load/locustfile.py --headless --users 100 --spawn-rate 10 --run-time 10m

# ─── Run everything (except load & manual) ───
pytest tests/ -v --ignore=tests/load --ignore=tests/fixtures -m "not manual and not load"

# ─── Run tests with specific markers ───
pytest -m "unit" -v
pytest -m "security" -v
pytest -m "not manual" -v

# ─── Run tests in parallel ───
pip install pytest-xdist
pytest tests/unit/ -n auto -v
```
