# TransVoix API Documentation

> **Version:** 1.0.0  
> **Base URL:** `https://api.transvoix.io/v1`  
> **Protocol:** HTTPS (REST) + WSS (WebSocket)  
> **Content-Type:** `application/json`

---

## Table of Contents

- [Authentication](#authentication)
- [REST API Endpoints](#rest-api-endpoints)
  - [Auth Endpoints](#auth-endpoints)
  - [Translation Endpoints](#translation-endpoints)
  - [Session Endpoints](#session-endpoints)
  - [User Endpoints](#user-endpoints)
  - [Recording Endpoints](#recording-endpoints)
  - [Analytics Endpoints](#analytics-endpoints)
- [WebSocket API](#websocket-api)
  - [Connection Lifecycle](#connection-lifecycle)
  - [Message Types](#message-types)
  - [Error Codes](#websocket-error-codes)
  - [Heartbeat Protocol](#heartbeat-protocol)
  - [Reconnection Protocol](#reconnection-protocol)
- [SDK Usage Examples](#sdk-usage-examples)
  - [Python SDK](#python-sdk)
  - [JavaScript SDK](#javascript-sdk)
  - [cURL Examples](#curl-examples)
  - [WebSocket Client (JavaScript)](#websocket-client-javascript)
- [Error Response Format](#error-response-format)
- [Error Codes Reference](#error-codes-reference)
- [Rate Limiting](#rate-limiting)

---

## Authentication

TransVoix uses **JWT Bearer Token** authentication. Unless an endpoint is marked as **Public**, all requests must include the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Token Lifecycle

| Token | Lifetime | Purpose |
|-------|----------|---------|
| Access Token | 15 minutes | API request authentication |
| Refresh Token | 7 days | Obtain new access tokens |
| API Key | No expiry (revocable) | Server-to-server integration |

### API Key Authentication

For translation and detection endpoints, you may alternatively use an API key:

```
X-API-Key: tvx_live_abc123...
```

### Auth Levels

| Level | Description |
|-------|-------------|
| **Public** | No authentication required |
| **Bearer** | Valid JWT access token required |
| **Bearer/API Key** | Either JWT or API key accepted |
| **Bearer/Guest** | JWT or guest session token accepted |
| **Admin** | JWT with `role: admin` claim required |

---

## REST API Endpoints

### Auth Endpoints

---

#### `POST /api/auth/register`

> **Auth:** Public

Register a new user account.

**Request Body:**

```json
{
  "email": "string (required, valid email)",
  "password": "string (required, min 8 chars, must contain uppercase, lowercase, digit)",
  "display_name": "string (required, 2-50 chars)",
  "native_language": "string (optional, ISO 639-1 code, default: 'en')",
  "target_languages": ["string (optional, array of ISO 639-1 codes)"]
}
```

**Response — `201 Created`:**

```json
{
  "user": {
    "id": "string (uuid)",
    "email": "string",
    "display_name": "string",
    "native_language": "string",
    "target_languages": ["string"],
    "role": "string (free|premium|business|admin)",
    "created_at": "string (ISO 8601)"
  },
  "tokens": {
    "access_token": "string (JWT)",
    "refresh_token": "string",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid email format, weak password, etc. |
| 409 | `EMAIL_EXISTS` | Email already registered |
| 429 | `RATE_LIMITED` | Too many registration attempts |
| 500 | `INTERNAL_ERROR` | Server error |

**Example:**

```bash
curl -X POST https://api.transvoix.io/v1/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecureP@ss1",
    "display_name": "Alice Chen",
    "native_language": "en",
    "target_languages": ["es", "fr"]
  }'
```

---

#### `POST /api/auth/login`

> **Auth:** Public

Authenticate and obtain JWT tokens.

**Request Body:**

```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response — `200 OK`:**

```json
{
  "user": {
    "id": "string (uuid)",
    "email": "string",
    "display_name": "string",
    "native_language": "string",
    "target_languages": ["string"],
    "role": "string",
    "last_login": "string (ISO 8601)"
  },
  "tokens": {
    "access_token": "string (JWT)",
    "refresh_token": "string",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Missing required fields |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 403 | `ACCOUNT_LOCKED` | Account temporarily locked after too many failed attempts |
| 429 | `RATE_LIMITED` | Too many login attempts |
| 500 | `INTERNAL_ERROR` | Server error |

**Example:**

```bash
curl -X POST https://api.transvoix.io/v1/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecureP@ss1"
  }'
```

---

#### `POST /api/auth/refresh`

> **Auth:** Public

Refresh an expired access token using a valid refresh token.

**Request Body:**

```json
{
  "refresh_token": "string (required)"
}
```

**Response — `200 OK`:**

```json
{
  "tokens": {
    "access_token": "string (JWT)",
    "refresh_token": "string",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Missing refresh token |
| 401 | `TOKEN_EXPIRED` | Refresh token has expired |
| 401 | `TOKEN_REVOKED` | Refresh token has been revoked |
| 500 | `INTERNAL_ERROR` | Server error |

---

#### `POST /api/auth/oauth/google`

> **Auth:** Public

Authenticate via Google OAuth 2.0.

**Request Body:**

```json
{
  "id_token": "string (required, Google OAuth ID token)",
  "native_language": "string (optional, ISO 639-1, used on first login)"
}
```

**Response — `200 OK`:**

```json
{
  "user": {
    "id": "string (uuid)",
    "email": "string",
    "display_name": "string",
    "avatar_url": "string (from Google profile)",
    "native_language": "string",
    "target_languages": ["string"],
    "role": "string",
    "oauth_provider": "google",
    "is_new_user": false
  },
  "tokens": {
    "access_token": "string (JWT)",
    "refresh_token": "string",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_OAUTH_TOKEN` | Invalid or expired Google token |
| 500 | `OAUTH_PROVIDER_ERROR` | Failed to communicate with Google |
| 500 | `INTERNAL_ERROR` | Server error |

---

#### `POST /api/auth/oauth/github`

> **Auth:** Public

Authenticate via GitHub OAuth.

**Request Body:**

```json
{
  "code": "string (required, GitHub OAuth authorization code)",
  "native_language": "string (optional, ISO 639-1, used on first login)"
}
```

**Response — `200 OK`:**

Same structure as Google OAuth response with `"oauth_provider": "github"`.

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_OAUTH_TOKEN` | Invalid or expired GitHub code |
| 500 | `OAUTH_PROVIDER_ERROR` | Failed to communicate with GitHub |
| 500 | `INTERNAL_ERROR` | Server error |

---

#### `GET /api/auth/me`

> **Auth:** Bearer

Get the currently authenticated user's profile.

**Response — `200 OK`:**

```json
{
  "user": {
    "id": "string (uuid)",
    "email": "string",
    "display_name": "string",
    "avatar_url": "string | null",
    "native_language": "string",
    "target_languages": ["string"],
    "role": "string",
    "oauth_provider": "string | null",
    "created_at": "string (ISO 8601)",
    "last_login": "string (ISO 8601)",
    "plan": {
      "name": "string (free|premium|business|enterprise)",
      "translation_minutes_used": "number",
      "translation_minutes_limit": "number | null",
      "requests_today": "number"
    }
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 401 | `TOKEN_EXPIRED` | Access token has expired |
| 401 | `INVALID_TOKEN` | Malformed or invalid token |
| 500 | `INTERNAL_ERROR` | Server error |

---

#### `POST /api/auth/logout`

> **Auth:** Bearer

Logout and revoke all active tokens.

**Request Body:**

```json
{
  "refresh_token": "string (optional, revoke specific token)"
}
```

**Response — `200 OK`:**

```json
{
  "message": "Successfully logged out"
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 401 | `INVALID_TOKEN` | Invalid access token |
| 500 | `INTERNAL_ERROR` | Server error |

---

### Translation Endpoints

---

#### `POST /api/translate`

> **Auth:** Bearer / API Key

Translate text from one language to another.

**Request Body:**

```json
{
  "text": "string (required, max 5000 chars)",
  "source_language": "string (optional, ISO 639-1, auto-detected if omitted)",
  "target_language": "string (required, ISO 639-1)",
  "context": "string (optional, preceding text for context-aware translation)",
  "formality": "string (optional, 'formal' | 'informal' | 'auto', default: 'auto')",
  "dictionary_id": "string (optional, uuid, custom dictionary to apply)",
  "preserve_formatting": "boolean (optional, default: true)"
}
```

**Response — `200 OK`:**

```json
{
  "translation": {
    "text": "string",
    "source_language": "string (ISO 639-1, detected or provided)",
    "target_language": "string (ISO 639-1)",
    "confidence": "number (0.0-1.0)",
    "alternatives": [
      {
        "text": "string",
        "confidence": "number"
      }
    ],
    "detected_language": "string | null (if source_language was auto-detected)",
    "dictionary_applied": "boolean",
    "tokens_used": "number"
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Missing or invalid fields |
| 400 | `TEXT_TOO_LONG` | Text exceeds 5000 character limit |
| 400 | `UNSUPPORTED_LANGUAGE` | Language code not supported |
| 401 | `INVALID_TOKEN` | Authentication failed |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 429 | `QUOTA_EXCEEDED` | Daily translation minutes exhausted |
| 500 | `TRANSLATION_FAILED` | Translation service unavailable |
| 500 | `INTERNAL_ERROR` | Server error |

**Rate Limiting:**  
See [Rate Limiting](#rate-limiting) section. Translation requests count toward both request rate and translation minute quotas.

**Example:**

```bash
curl -X POST https://api.transvoix.io/v1/api/translate \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, how are you today?",
    "target_language": "es",
    "formality": "informal"
  }'
```

**Example Response:**

```json
{
  "translation": {
    "text": "Hola, ¿cómo estás hoy?",
    "source_language": "en",
    "target_language": "es",
    "confidence": 0.97,
    "alternatives": [
      { "text": "Hola, ¿qué tal hoy?", "confidence": 0.89 }
    ],
    "detected_language": "en",
    "dictionary_applied": false,
    "tokens_used": 12
  }
}
```

---

#### `POST /api/detect`

> **Auth:** Bearer / API Key

Detect the language of input text.

**Request Body:**

```json
{
  "text": "string (required, min 3 chars, max 5000 chars)"
}
```

**Response — `200 OK`:**

```json
{
  "detection": {
    "language": "string (ISO 639-1)",
    "confidence": "number (0.0-1.0)",
    "alternatives": [
      {
        "language": "string",
        "confidence": "number"
      }
    ],
    "is_mixed": "boolean",
    "script": "string (e.g., 'Latin', 'Cyrillic', 'Han')"
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Text too short or missing |
| 400 | `TEXT_TOO_LONG` | Text exceeds 5000 character limit |
| 401 | `INVALID_TOKEN` | Authentication failed |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 500 | `DETECTION_FAILED` | Detection service error |
| 500 | `INTERNAL_ERROR` | Server error |

**Example:**

```bash
curl -X POST https://api.transvoix.io/v1/api/detect \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{"text": "Bonjour le monde"}'
```

**Example Response:**

```json
{
  "detection": {
    "language": "fr",
    "confidence": 0.99,
    "alternatives": [
      { "language": "it", "confidence": 0.02 }
    ],
    "is_mixed": false,
    "script": "Latin"
  }
}
```

---

#### `GET /api/languages`

> **Auth:** Public

List all supported languages with metadata.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `speech` | boolean | false | Filter to speech-enabled languages only |
| `tts` | boolean | false | Filter to TTS-enabled languages only |

**Response — `200 OK`:**

```json
{
  "languages": [
    {
      "code": "string (ISO 639-1)",
      "name": "string (English name)",
      "native_name": "string",
      "script": "string",
      "direction": "string ('ltr' | 'rtl')",
      "speech_recognition": "boolean",
      "text_to_speech": "boolean",
      "formality_support": "boolean"
    }
  ],
  "total": "number"
}
```

**Example:**

```bash
curl https://api.transvoix.io/v1/api/languages?speech=true
```

---

#### `POST /api/translate/batch`

> **Auth:** Bearer / API Key

Translate multiple texts in a single request. Maximum 50 items per batch.

**Request Body:**

```json
{
  "items": [
    {
      "text": "string (required)",
      "source_language": "string (optional)",
      "target_language": "string (required)"
    }
  ],
  "dictionary_id": "string (optional, uuid)",
  "formality": "string (optional)"
}
```

**Response — `200 OK`:**

```json
{
  "translations": [
    {
      "index": "number",
      "text": "string",
      "source_language": "string",
      "target_language": "string",
      "confidence": "number",
      "status": "string ('success' | 'error')",
      "error": "string | null"
    }
  ],
  "summary": {
    "total": "number",
    "successful": "number",
    "failed": "number",
    "tokens_used": "number"
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid batch format |
| 400 | `BATCH_TOO_LARGE` | More than 50 items in batch |
| 401 | `INVALID_TOKEN` | Authentication failed |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 429 | `QUOTA_EXCEEDED` | Daily quota exhausted |
| 500 | `TRANSLATION_FAILED` | Translation service error |

**Example:**

```bash
curl -X POST https://api.transvoix.io/v1/api/translate/batch \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"text": "Hello", "target_language": "es"},
      {"text": "Goodbye", "target_language": "fr"},
      {"text": "Thank you", "target_language": "ja"}
    ]
  }'
```

---

### Session Endpoints

---

#### `POST /api/sessions`

> **Auth:** Bearer

Create a new real-time translation session (room).

**Request Body:**

```json
{
  "name": "string (optional, max 100 chars)",
  "type": "string (required, 'one-to-one' | 'group' | 'broadcast')",
  "max_participants": "number (optional, default: 10, max: 100)",
  "settings": {
    "auto_record": "boolean (optional, default: false)",
    "allow_guests": "boolean (optional, default: false)",
    "default_source_language": "string (optional, ISO 639-1)",
    "target_languages": ["string (optional, ISO 639-1 codes)"],
    "formality": "string (optional, 'formal' | 'informal' | 'auto')",
    "profanity_filter": "boolean (optional, default: true)"
  },
  "expires_in": "number (optional, seconds until session expires, default: 3600)"
}
```

**Response — `201 Created`:**

```json
{
  "session": {
    "id": "string (uuid)",
    "name": "string",
    "type": "string",
    "code": "string (6-char join code)",
    "invite_url": "string (shareable URL)",
    "host_id": "string (uuid)",
    "max_participants": "number",
    "settings": {
      "auto_record": "boolean",
      "allow_guests": "boolean",
      "default_source_language": "string | null",
      "target_languages": ["string"],
      "formality": "string",
      "profanity_filter": "boolean"
    },
    "status": "string ('active' | 'ended')",
    "created_at": "string (ISO 8601)",
    "expires_at": "string (ISO 8601)"
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid session configuration |
| 401 | `INVALID_TOKEN` | Authentication failed |
| 403 | `SESSION_LIMIT_REACHED` | Maximum concurrent sessions exceeded |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Server error |

**Example:**

```bash
curl -X POST https://api.transvoix.io/v1/api/sessions \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Team Standup - Multilingual",
    "type": "group",
    "max_participants": 15,
    "settings": {
      "auto_record": true,
      "allow_guests": true,
      "target_languages": ["en", "es", "ja", "zh"]
    }
  }'
```

---

#### `GET /api/sessions/{id}`

> **Auth:** Bearer

Get session details by ID.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Session ID |

**Response — `200 OK`:**

```json
{
  "session": {
    "id": "string (uuid)",
    "name": "string",
    "type": "string",
    "code": "string",
    "host_id": "string (uuid)",
    "max_participants": "number",
    "current_participants": "number",
    "settings": { "..." : "..." },
    "status": "string ('active' | 'ended')",
    "created_at": "string (ISO 8601)",
    "expires_at": "string (ISO 8601)",
    "recording_id": "string | null (uuid)"
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 401 | `INVALID_TOKEN` | Authentication failed |
| 403 | `ACCESS_DENIED` | Not a participant of this session |
| 404 | `SESSION_NOT_FOUND` | Session does not exist |
| 500 | `INTERNAL_ERROR` | Server error |

---

#### `POST /api/sessions/{id}/join`

> **Auth:** Bearer / Guest

Join an existing session.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Session ID |

**Request Body:**

```json
{
  "display_name": "string (required for guests, ignored for authenticated users)",
  "language": "string (required, ISO 639-1, participant's language)",
  "code": "string (optional, 6-char join code, required if session requires it)"
}
```

**Response — `200 OK`:**

```json
{
  "participant": {
    "id": "string (uuid)",
    "user_id": "string | null (uuid, null for guests)",
    "display_name": "string",
    "language": "string",
    "role": "string ('host' | 'participant' | 'guest')",
    "joined_at": "string (ISO 8601)"
  },
  "session": {
    "id": "string (uuid)",
    "name": "string",
    "websocket_url": "string (ws:// or wss:// connection URL)"
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_JOIN_CODE` | Wrong join code |
| 400 | `VALIDATION_ERROR` | Missing required fields |
| 403 | `GUESTS_NOT_ALLOWED` | Session does not allow guests |
| 404 | `SESSION_NOT_FOUND` | Session does not exist |
| 409 | `SESSION_FULL` | Maximum participants reached |
| 410 | `SESSION_ENDED` | Session has ended |
| 500 | `INTERNAL_ERROR` | Server error |

---

#### `DELETE /api/sessions/{id}`

> **Auth:** Bearer (host only)

End an active session. Only the session host can end a session.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Session ID |

**Response — `200 OK`:**

```json
{
  "message": "Session ended successfully",
  "session_id": "string (uuid)",
  "recording_id": "string | null (uuid, if recording was active)",
  "duration_seconds": "number",
  "total_messages": "number"
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 401 | `INVALID_TOKEN` | Authentication failed |
| 403 | `ACCESS_DENIED` | Only the host can end the session |
| 404 | `SESSION_NOT_FOUND` | Session does not exist |
| 410 | `SESSION_ENDED` | Session already ended |
| 500 | `INTERNAL_ERROR` | Server error |

---

#### `GET /api/sessions/{id}/participants`

> **Auth:** Bearer

List all participants in a session.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Session ID |

**Response — `200 OK`:**

```json
{
  "participants": [
    {
      "id": "string (uuid)",
      "user_id": "string | null (uuid)",
      "display_name": "string",
      "language": "string (ISO 639-1)",
      "role": "string ('host' | 'participant' | 'guest')",
      "status": "string ('connected' | 'disconnected')",
      "joined_at": "string (ISO 8601)",
      "last_active": "string (ISO 8601)"
    }
  ],
  "total": "number",
  "connected": "number"
}
```

---

#### `GET /api/sessions/{id}/transcript`

> **Auth:** Bearer

Retrieve the transcript of a session's conversation.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Session ID |

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `language` | string | — | Filter transcript to a specific target language |
| `offset` | number | 0 | Pagination offset |
| `limit` | number | 100 | Number of entries (max 500) |

**Response — `200 OK`:**

```json
{
  "transcript": [
    {
      "id": "string (uuid)",
      "participant_id": "string (uuid)",
      "display_name": "string",
      "original_text": "string",
      "original_language": "string",
      "translations": {
        "es": "string",
        "fr": "string"
      },
      "timestamp": "string (ISO 8601)"
    }
  ],
  "pagination": {
    "offset": "number",
    "limit": "number",
    "total": "number",
    "has_more": "boolean"
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 401 | `INVALID_TOKEN` | Authentication failed |
| 403 | `ACCESS_DENIED` | Not a participant of this session |
| 404 | `SESSION_NOT_FOUND` | Session does not exist |
| 500 | `INTERNAL_ERROR` | Server error |

---

### User Endpoints

---

#### `GET /api/users/profile`

> **Auth:** Bearer

Get the current user's language profile and preferences.

**Response — `200 OK`:**

```json
{
  "profile": {
    "user_id": "string (uuid)",
    "native_language": "string (ISO 639-1)",
    "target_languages": ["string"],
    "proficiency_levels": {
      "es": "string ('beginner' | 'intermediate' | 'advanced' | 'native')",
      "fr": "string"
    },
    "preferred_formality": "string ('formal' | 'informal' | 'auto')",
    "speech_rate": "number (0.5-2.0, TTS speed multiplier)",
    "voice_preference": "string (voice ID)",
    "auto_detect_language": "boolean",
    "updated_at": "string (ISO 8601)"
  }
}
```

---

#### `PUT /api/users/profile`

> **Auth:** Bearer

Update the user's language profile.

**Request Body:**

```json
{
  "native_language": "string (optional, ISO 639-1)",
  "target_languages": ["string (optional)"],
  "proficiency_levels": { "string": "string (optional)" },
  "preferred_formality": "string (optional)",
  "speech_rate": "number (optional, 0.5-2.0)",
  "voice_preference": "string (optional)",
  "auto_detect_language": "boolean (optional)"
}
```

**Response — `200 OK`:**

```json
{
  "profile": { "...updated profile object..." }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid profile data |
| 401 | `INVALID_TOKEN` | Authentication failed |
| 500 | `INTERNAL_ERROR` | Server error |

---

#### `GET /api/users/preferences`

> **Auth:** Bearer

Get the adaptive learner's learned preferences for the current user. These preferences are built over time from usage patterns.

**Response — `200 OK`:**

```json
{
  "preferences": {
    "user_id": "string (uuid)",
    "frequent_pairs": [
      {
        "source": "string (ISO 639-1)",
        "target": "string (ISO 639-1)",
        "usage_count": "number"
      }
    ],
    "custom_corrections": [
      {
        "original": "string",
        "corrected": "string",
        "language_pair": "string (e.g., 'en→es')",
        "created_at": "string (ISO 8601)"
      }
    ],
    "style_preferences": {
      "formality_bias": "number (-1.0 to 1.0)",
      "verbosity": "string ('concise' | 'standard' | 'detailed')"
    },
    "total_translations": "number",
    "total_sessions": "number",
    "last_active": "string (ISO 8601)"
  }
}
```

---

#### `DELETE /api/users/preferences`

> **Auth:** Bearer

Reset all adaptive learning preferences. This action is irreversible.

**Response — `200 OK`:**

```json
{
  "message": "Preferences reset successfully"
}
```

---

#### `GET /api/users/dictionaries`

> **Auth:** Bearer

List all custom dictionaries owned by the current user.

**Response — `200 OK`:**

```json
{
  "dictionaries": [
    {
      "id": "string (uuid)",
      "name": "string",
      "description": "string",
      "source_language": "string (ISO 639-1)",
      "target_language": "string (ISO 639-1)",
      "entry_count": "number",
      "created_at": "string (ISO 8601)",
      "updated_at": "string (ISO 8601)"
    }
  ],
  "total": "number"
}
```

---

#### `POST /api/users/dictionaries`

> **Auth:** Bearer

Create a new custom dictionary.

**Request Body:**

```json
{
  "name": "string (required, max 100 chars)",
  "description": "string (optional, max 500 chars)",
  "source_language": "string (required, ISO 639-1)",
  "target_language": "string (required, ISO 639-1)",
  "entries": [
    {
      "source_term": "string (required)",
      "target_term": "string (required)",
      "context": "string (optional)",
      "case_sensitive": "boolean (optional, default: false)"
    }
  ]
}
```

**Response — `201 Created`:**

```json
{
  "dictionary": {
    "id": "string (uuid)",
    "name": "string",
    "description": "string",
    "source_language": "string",
    "target_language": "string",
    "entry_count": "number",
    "created_at": "string (ISO 8601)"
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid dictionary data |
| 401 | `INVALID_TOKEN` | Authentication failed |
| 403 | `DICTIONARY_LIMIT_REACHED` | Maximum dictionaries per user exceeded |
| 409 | `DICTIONARY_NAME_EXISTS` | Dictionary name already exists |
| 500 | `INTERNAL_ERROR` | Server error |

---

#### `PUT /api/users/dictionaries/{id}`

> **Auth:** Bearer

Update a custom dictionary's metadata.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Dictionary ID |

**Request Body:**

```json
{
  "name": "string (optional)",
  "description": "string (optional)"
}
```

**Response — `200 OK`:**

```json
{
  "dictionary": { "...updated dictionary object..." }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid data |
| 401 | `INVALID_TOKEN` | Authentication failed |
| 403 | `ACCESS_DENIED` | Not the owner of this dictionary |
| 404 | `DICTIONARY_NOT_FOUND` | Dictionary does not exist |
| 500 | `INTERNAL_ERROR` | Server error |

---

#### `DELETE /api/users/dictionaries/{id}`

> **Auth:** Bearer

Delete a custom dictionary and all its entries.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Dictionary ID |

**Response — `200 OK`:**

```json
{
  "message": "Dictionary deleted successfully"
}
```

---

#### `POST /api/users/dictionaries/{id}/entries`

> **Auth:** Bearer

Add a new entry to a custom dictionary.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Dictionary ID |

**Request Body:**

```json
{
  "source_term": "string (required)",
  "target_term": "string (required)",
  "context": "string (optional, max 200 chars)",
  "case_sensitive": "boolean (optional, default: false)"
}
```

**Response — `201 Created`:**

```json
{
  "entry": {
    "id": "string (uuid)",
    "dictionary_id": "string (uuid)",
    "source_term": "string",
    "target_term": "string",
    "context": "string | null",
    "case_sensitive": "boolean",
    "created_at": "string (ISO 8601)"
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid entry data |
| 401 | `INVALID_TOKEN` | Authentication failed |
| 403 | `ACCESS_DENIED` | Not the owner of this dictionary |
| 404 | `DICTIONARY_NOT_FOUND` | Dictionary does not exist |
| 409 | `ENTRY_EXISTS` | Source term already exists in this dictionary |
| 500 | `INTERNAL_ERROR` | Server error |

---

#### `DELETE /api/users/dictionaries/{id}/entries/{eid}`

> **Auth:** Bearer

Remove an entry from a custom dictionary.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Dictionary ID |
| `eid` | string (uuid) | Entry ID |

**Response — `200 OK`:**

```json
{
  "message": "Entry removed successfully"
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 401 | `INVALID_TOKEN` | Authentication failed |
| 403 | `ACCESS_DENIED` | Not the owner |
| 404 | `ENTRY_NOT_FOUND` | Entry does not exist |
| 500 | `INTERNAL_ERROR` | Server error |

---

### Recording Endpoints

---

#### `GET /api/recordings`

> **Auth:** Bearer

List all recordings belonging to the current user.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `offset` | number | 0 | Pagination offset |
| `limit` | number | 20 | Number of results (max 100) |
| `sort` | string | `created_at` | Sort field (`created_at`, `duration`, `name`) |
| `order` | string | `desc` | Sort order (`asc`, `desc`) |

**Response — `200 OK`:**

```json
{
  "recordings": [
    {
      "id": "string (uuid)",
      "session_id": "string (uuid)",
      "session_name": "string",
      "duration_seconds": "number",
      "participant_count": "number",
      "languages": ["string (ISO 639-1)"],
      "message_count": "number",
      "size_bytes": "number",
      "created_at": "string (ISO 8601)"
    }
  ],
  "pagination": {
    "offset": "number",
    "limit": "number",
    "total": "number",
    "has_more": "boolean"
  }
}
```

---

#### `GET /api/recordings/{id}`

> **Auth:** Bearer

Get a specific recording with full transcript.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Recording ID |

**Response — `200 OK`:**

```json
{
  "recording": {
    "id": "string (uuid)",
    "session_id": "string (uuid)",
    "session_name": "string",
    "duration_seconds": "number",
    "participants": [
      {
        "id": "string (uuid)",
        "display_name": "string",
        "language": "string"
      }
    ],
    "transcript": [
      {
        "id": "string (uuid)",
        "participant_id": "string (uuid)",
        "display_name": "string",
        "original_text": "string",
        "original_language": "string",
        "translations": { "string": "string" },
        "timestamp": "string (ISO 8601)"
      }
    ],
    "languages": ["string"],
    "message_count": "number",
    "created_at": "string (ISO 8601)"
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 401 | `INVALID_TOKEN` | Authentication failed |
| 403 | `ACCESS_DENIED` | Not the owner of this recording |
| 404 | `RECORDING_NOT_FOUND` | Recording does not exist |
| 500 | `INTERNAL_ERROR` | Server error |

---

#### `GET /api/recordings/{id}/export`

> **Auth:** Bearer

Export a recording in a specific format.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Recording ID |

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | string | `json` | Export format: `srt`, `vtt`, `txt`, `json`, `csv` |
| `language` | string | — | Filter to specific language |
| `include_original` | boolean | true | Include original text alongside translations |

**Response — `200 OK`:**

Response content type varies by format:
- `srt` → `text/plain` (SubRip subtitle format)
- `vtt` → `text/vtt` (WebVTT subtitle format)
- `txt` → `text/plain` (Plain text transcript)
- `json` → `application/json` (Structured JSON)
- `csv` → `text/csv` (Comma-separated values)

**Example (SRT format):**

```
1
00:00:01,000 --> 00:00:03,500
[Alice (en)] Hello, how are you?

2
00:00:01,000 --> 00:00:03,500
[Alice (en→es)] Hola, ¿cómo estás?

3
00:00:04,200 --> 00:00:07,800
[Carlos (es)] Muy bien, gracias. ¿Y tú?

4
00:00:04,200 --> 00:00:07,800
[Carlos (es→en)] Very well, thanks. And you?
```

---

#### `DELETE /api/recordings/{id}`

> **Auth:** Bearer

Delete a recording permanently.

**Response — `200 OK`:**

```json
{
  "message": "Recording deleted successfully"
}
```

---

### Analytics Endpoints

> **Auth:** All analytics endpoints require **Admin** role.

---

#### `GET /api/analytics/overview`

Dashboard overview statistics.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | string | `7d` | Time period: `1d`, `7d`, `30d`, `90d`, `1y` |

**Response — `200 OK`:**

```json
{
  "overview": {
    "period": "string",
    "total_users": "number",
    "active_users": "number",
    "new_users": "number",
    "total_sessions": "number",
    "active_sessions": "number",
    "total_translations": "number",
    "total_minutes_translated": "number",
    "average_session_duration_seconds": "number",
    "top_language_pairs": [
      {
        "source": "string",
        "target": "string",
        "count": "number"
      }
    ]
  }
}
```

---

#### `GET /api/analytics/languages`

Language usage breakdown.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | string | `30d` | Time period |
| `group_by` | string | `language` | Group by: `language`, `pair`, `direction` |

**Response — `200 OK`:**

```json
{
  "languages": [
    {
      "language": "string (ISO 639-1)",
      "name": "string",
      "total_translations": "number",
      "percentage": "number (0-100)",
      "trend": "string ('up' | 'down' | 'stable')",
      "avg_confidence": "number (0.0-1.0)"
    }
  ],
  "total_translations": "number"
}
```

---

#### `GET /api/analytics/latency`

Translation latency percentile metrics.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | string | `24h` | Time period |
| `language_pair` | string | — | Filter by language pair (e.g., `en-es`) |

**Response — `200 OK`:**

```json
{
  "latency": {
    "period": "string",
    "p50_ms": "number",
    "p75_ms": "number",
    "p90_ms": "number",
    "p95_ms": "number",
    "p99_ms": "number",
    "avg_ms": "number",
    "min_ms": "number",
    "max_ms": "number",
    "sample_count": "number",
    "by_language_pair": [
      {
        "pair": "string",
        "p50_ms": "number",
        "p95_ms": "number",
        "avg_ms": "number",
        "count": "number"
      }
    ]
  }
}
```

---

#### `GET /api/analytics/usage`

API usage statistics and billing-relevant metrics.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | string | `30d` | Time period |
| `group_by` | string | `day` | Granularity: `hour`, `day`, `week`, `month` |

**Response — `200 OK`:**

```json
{
  "usage": {
    "period": "string",
    "total_requests": "number",
    "total_tokens": "number",
    "total_characters": "number",
    "by_endpoint": [
      {
        "endpoint": "string",
        "method": "string",
        "count": "number",
        "avg_latency_ms": "number"
      }
    ],
    "by_plan": [
      {
        "plan": "string",
        "users": "number",
        "requests": "number",
        "characters": "number"
      }
    ],
    "timeseries": [
      {
        "timestamp": "string (ISO 8601)",
        "requests": "number",
        "errors": "number",
        "avg_latency_ms": "number"
      }
    ],
    "error_rate": "number (0.0-1.0)"
  }
}
```

**Error Responses (all analytics):**

| Status | Code | Description |
|--------|------|-------------|
| 401 | `INVALID_TOKEN` | Authentication failed |
| 403 | `ADMIN_REQUIRED` | Admin role required |
| 400 | `INVALID_PERIOD` | Invalid period parameter |
| 500 | `INTERNAL_ERROR` | Server error |

---

## WebSocket API

The WebSocket API enables real-time bidirectional communication for translation sessions.

### Connection URL

```
wss://api.transvoix.io/ws/session/{session_id}?token={jwt}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `session_id` | string (uuid) | The session to connect to |
| `token` | string (JWT) | Valid access token |

### Connection Lifecycle

```
┌─────────┐     ┌──────────────┐     ┌────────────┐     ┌──────────────┐
│ Connect  │────►│ Authenticate │────►│ Joined     │────►│ Communicating│
└─────────┘     └──────────────┘     └────────────┘     └──────────────┘
                       │                    │                    │
                       ▼                    ▼                    ▼
                ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
                │ Auth Failed  │    │ Kicked       │    │ Disconnected │
                │ (close 4001) │    │ (close 4003) │    │ (close 1000) │
                └──────────────┘    └──────────────┘    └──────────────┘
```

1. **Connect** — Client opens WebSocket connection with JWT in query string
2. **Authenticate** — Server validates JWT and sends `auth_success` message
3. **Joined** — Server broadcasts `participant_joined` to all participants
4. **Communicating** — Client sends/receives translation messages
5. **Leave** — Client sends `leave` or disconnects
6. **Disconnect** — Server broadcasts `participant_left`

### Message Types

All messages follow this envelope format:

```json
{
  "type": "string (message type)",
  "payload": { "..." : "..." },
  "timestamp": "string (ISO 8601)",
  "message_id": "string (uuid)"
}
```

#### Client → Server Messages

##### `translate`

Send text for real-time translation and broadcast to other participants.

```json
{
  "type": "translate",
  "payload": {
    "text": "string (required, the spoken/typed text)",
    "source_language": "string (optional, auto-detected if omitted)",
    "is_partial": "boolean (optional, true for interim speech recognition results)",
    "dictionary_id": "string (optional, uuid)"
  }
}
```

##### `typing`

Indicate that the user is currently typing (for UI feedback).

```json
{
  "type": "typing",
  "payload": {
    "is_typing": "boolean"
  }
}
```

##### `language_change`

Notify the session that the participant has switched their language.

```json
{
  "type": "language_change",
  "payload": {
    "language": "string (ISO 639-1, new language)"
  }
}
```

##### `reaction`

Send an emoji reaction.

```json
{
  "type": "reaction",
  "payload": {
    "emoji": "string (single emoji character)"
  }
}
```

##### `correction`

Submit a correction for a previous translation (feeds adaptive learner).

```json
{
  "type": "correction",
  "payload": {
    "message_id": "string (uuid, the original message)",
    "corrected_text": "string",
    "language": "string (ISO 639-1)"
  }
}
```

##### `leave`

Gracefully leave the session.

```json
{
  "type": "leave",
  "payload": {}
}
```

##### `pong`

Response to server ping for keepalive.

```json
{
  "type": "pong",
  "payload": {}
}
```

#### Server → Client Messages

##### `auth_success`

Sent immediately after successful authentication.

```json
{
  "type": "auth_success",
  "payload": {
    "participant_id": "string (uuid)",
    "session": {
      "id": "string (uuid)",
      "name": "string",
      "host_id": "string (uuid)",
      "settings": { "..." : "..." }
    },
    "participants": [
      {
        "id": "string (uuid)",
        "display_name": "string",
        "language": "string",
        "role": "string",
        "status": "string"
      }
    ]
  }
}
```

##### `translation`

Broadcast translated message to all participants.

```json
{
  "type": "translation",
  "payload": {
    "message_id": "string (uuid)",
    "participant_id": "string (uuid)",
    "display_name": "string",
    "original_text": "string",
    "original_language": "string (ISO 639-1)",
    "translations": {
      "es": "string",
      "fr": "string",
      "ja": "string"
    },
    "is_partial": "boolean",
    "confidence": "number (0.0-1.0)"
  }
}
```

##### `partial_translation`

Interim translation result from speech recognition (for live captions).

```json
{
  "type": "partial_translation",
  "payload": {
    "message_id": "string (uuid)",
    "participant_id": "string (uuid)",
    "original_text": "string (partial)",
    "original_language": "string",
    "translations": {
      "es": "string (partial)"
    }
  }
}
```

##### `participant_joined`

Broadcast when a new participant joins.

```json
{
  "type": "participant_joined",
  "payload": {
    "participant": {
      "id": "string (uuid)",
      "display_name": "string",
      "language": "string",
      "role": "string"
    },
    "participant_count": "number"
  }
}
```

##### `participant_left`

Broadcast when a participant leaves.

```json
{
  "type": "participant_left",
  "payload": {
    "participant_id": "string (uuid)",
    "display_name": "string",
    "reason": "string ('left' | 'disconnected' | 'kicked')",
    "participant_count": "number"
  }
}
```

##### `participant_typing`

Broadcast typing indicator.

```json
{
  "type": "participant_typing",
  "payload": {
    "participant_id": "string (uuid)",
    "display_name": "string",
    "is_typing": "boolean"
  }
}
```

##### `language_changed`

Broadcast when a participant changes their language.

```json
{
  "type": "language_changed",
  "payload": {
    "participant_id": "string (uuid)",
    "display_name": "string",
    "old_language": "string",
    "new_language": "string"
  }
}
```

##### `reaction_received`

Broadcast emoji reaction.

```json
{
  "type": "reaction_received",
  "payload": {
    "participant_id": "string (uuid)",
    "display_name": "string",
    "emoji": "string"
  }
}
```

##### `correction_applied`

Broadcast when a translation correction is accepted.

```json
{
  "type": "correction_applied",
  "payload": {
    "message_id": "string (uuid)",
    "corrected_by": "string (uuid)",
    "corrected_text": "string",
    "language": "string"
  }
}
```

##### `session_ended`

Sent to all participants when the host ends the session.

```json
{
  "type": "session_ended",
  "payload": {
    "reason": "string ('host_ended' | 'expired' | 'server_shutdown')",
    "recording_id": "string | null (uuid)"
  }
}
```

##### `error`

Sent when a client message cannot be processed.

```json
{
  "type": "error",
  "payload": {
    "code": "string (error code)",
    "message": "string (human-readable)",
    "related_message_id": "string | null (uuid)"
  }
}
```

##### `ping`

Server keepalive ping (sent every 30 seconds).

```json
{
  "type": "ping",
  "payload": {
    "server_time": "string (ISO 8601)"
  }
}
```

### WebSocket Error Codes

| Code | Name | Description |
|------|------|-------------|
| 4001 | `AUTH_FAILED` | JWT token invalid or expired |
| 4002 | `SESSION_NOT_FOUND` | Session does not exist |
| 4003 | `KICKED` | Participant removed by host |
| 4004 | `SESSION_FULL` | Maximum participants reached |
| 4005 | `SESSION_ENDED` | Session has been ended |
| 4006 | `RATE_LIMITED` | Too many messages per second |
| 4007 | `INVALID_MESSAGE` | Malformed message payload |
| 4008 | `TRANSLATION_ERROR` | Translation service failed |
| 4009 | `GUESTS_NOT_ALLOWED` | Session does not allow guests |
| 4010 | `DUPLICATE_CONNECTION` | User already connected from another client |

### WebSocket Close Codes

| Code | Meaning |
|------|---------|
| 1000 | Normal closure (client left) |
| 1001 | Going away (browser tab closed) |
| 1006 | Abnormal closure (connection lost) |
| 4001–4010 | Application-specific errors (see above) |

### Heartbeat Protocol

- The server sends a `ping` message every **30 seconds**
- The client must respond with a `pong` message within **10 seconds**
- If the server does not receive a `pong`, it considers the client disconnected after **3 missed pings** (90 seconds total timeout)
- The client should also implement its own timeout: if no message is received for **45 seconds**, initiate reconnection

### Reconnection Protocol

When a connection drops unexpectedly:

1. **Immediate retry** — Attempt reconnection immediately
2. **Exponential backoff** — If immediate retry fails: 1s → 2s → 4s → 8s → 16s → 30s (max)
3. **Jitter** — Add random jitter (0–500ms) to each retry delay
4. **Max attempts** — Give up after 10 consecutive failures
5. **Token refresh** — If reconnection fails with `4001 AUTH_FAILED`, refresh the JWT token first, then retry
6. **State recovery** — After reconnection, the server sends an `auth_success` message with current state (participant list, etc.). Missed messages during disconnection are **not replayed** — use the transcript API to fetch missed messages.

**Reconnection request header:**

```
X-Reconnect: true
X-Last-Message-Id: <uuid of last received message>
```

---

## SDK Usage Examples

### Python SDK

```python
from transvoix import TransVoixClient, TransVoixSession

# Initialize client
client = TransVoixClient(
    base_url="https://api.transvoix.io/v1",
    api_key="tvx_live_abc123..."
)

# --- Authentication ---
# Register a new user
user = client.auth.register(
    email="alice@example.com",
    password="SecureP@ss1",
    display_name="Alice Chen",
    native_language="en"
)

# Login
tokens = client.auth.login(
    email="alice@example.com",
    password="SecureP@ss1"
)
client.set_token(tokens.access_token)

# --- Translation ---
# Simple translation
result = client.translate(
    text="Hello, how are you?",
    target_language="es"
)
print(result.text)           # "Hola, ¿cómo estás?"
print(result.confidence)     # 0.97

# Language detection
detection = client.detect("Bonjour le monde")
print(detection.language)    # "fr"
print(detection.confidence)  # 0.99

# Batch translation
results = client.translate_batch([
    {"text": "Hello", "target_language": "es"},
    {"text": "Goodbye", "target_language": "fr"},
    {"text": "Thank you", "target_language": "ja"},
])
for r in results:
    print(f"{r.source_language} → {r.target_language}: {r.text}")

# --- Sessions ---
# Create a session
session = client.sessions.create(
    name="Team Meeting",
    type="group",
    settings={"allow_guests": True, "auto_record": True}
)
print(f"Join code: {session.code}")
print(f"Invite URL: {session.invite_url}")

# --- Real-time WebSocket ---
async def on_translation(message):
    print(f"[{message.display_name}] {message.original_text}")
    for lang, text in message.translations.items():
        print(f"  → [{lang}] {text}")

async def main():
    ws = await client.sessions.connect(
        session_id=session.id,
        language="en"
    )
    ws.on("translation", on_translation)

    # Send a message
    await ws.send_translation("Hello everyone!")

    # Listen for messages
    await ws.listen()

import asyncio
asyncio.run(main())

# --- Custom Dictionaries ---
dictionary = client.dictionaries.create(
    name="Medical Terms",
    source_language="en",
    target_language="es",
    entries=[
        {"source_term": "MRI", "target_term": "IRM"},
        {"source_term": "CT scan", "target_term": "tomografía computarizada"},
    ]
)

# Translate with custom dictionary
result = client.translate(
    text="The MRI results are ready",
    target_language="es",
    dictionary_id=dictionary.id
)
print(result.text)  # "Los resultados de la IRM están listos"

# --- Recordings ---
recordings = client.recordings.list()
for rec in recordings:
    print(f"{rec.session_name} — {rec.duration_seconds}s — {rec.message_count} messages")

# Export as SRT subtitles
srt_content = client.recordings.export(
    recording_id=recordings[0].id,
    format="srt",
    language="es"
)
with open("transcript_es.srt", "w") as f:
    f.write(srt_content)
```

### JavaScript SDK

```javascript
import { TransVoixClient } from '@transvoix/sdk';

// Initialize client
const client = new TransVoixClient({
  baseUrl: 'https://api.transvoix.io/v1',
  apiKey: 'tvx_live_abc123...'
});

// --- Authentication ---
const { user, tokens } = await client.auth.login({
  email: 'alice@example.com',
  password: 'SecureP@ss1'
});
client.setToken(tokens.accessToken);

// --- Translation ---
const result = await client.translate({
  text: 'Hello, how are you?',
  targetLanguage: 'es',
  formality: 'informal'
});
console.log(result.text);        // "Hola, ¿cómo estás?"
console.log(result.confidence);  // 0.97

// Language detection
const detection = await client.detect('Bonjour le monde');
console.log(detection.language);    // "fr"

// Batch translation
const results = await client.translateBatch([
  { text: 'Hello', targetLanguage: 'es' },
  { text: 'Goodbye', targetLanguage: 'fr' },
  { text: 'Thank you', targetLanguage: 'ja' }
]);

// --- Sessions ---
const session = await client.sessions.create({
  name: 'Team Standup',
  type: 'group',
  settings: { allowGuests: true, autoRecord: true }
});
console.log(`Join code: ${session.code}`);

// --- Real-time WebSocket ---
const ws = await client.sessions.connect(session.id, {
  language: 'en'
});

ws.on('translation', (message) => {
  console.log(`[${message.displayName}] ${message.originalText}`);
  Object.entries(message.translations).forEach(([lang, text]) => {
    console.log(`  → [${lang}] ${text}`);
  });
});

ws.on('participantJoined', (event) => {
  console.log(`${event.participant.displayName} joined (${event.participant.language})`);
});

ws.on('error', (error) => {
  console.error(`Error: ${error.code} — ${error.message}`);
});

// Send a translation
ws.sendTranslation('Hello everyone!');

// Clean up
ws.disconnect();

// --- Custom Dictionaries ---
const dictionary = await client.dictionaries.create({
  name: 'Tech Terms',
  sourceLanguage: 'en',
  targetLanguage: 'ja',
  entries: [
    { sourceTerm: 'API', targetTerm: 'API' },
    { sourceTerm: 'deployment', targetTerm: 'デプロイメント' }
  ]
});

// --- Recordings ---
const recordings = await client.recordings.list();
const srt = await client.recordings.export(recordings[0].id, {
  format: 'srt',
  language: 'es'
});
```

### cURL Examples

```bash
# ─── Authentication ───

# Register
curl -X POST https://api.transvoix.io/v1/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecureP@ss1",
    "display_name": "Alice Chen",
    "native_language": "en"
  }'

# Login
curl -X POST https://api.transvoix.io/v1/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecureP@ss1"}'

# Get current user
curl https://api.transvoix.io/v1/api/auth/me \
  -H "Authorization: Bearer eyJhbG..."

# Refresh token
curl -X POST https://api.transvoix.io/v1/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "rt_abc123..."}'

# ─── Translation ───

# Translate text (with Bearer token)
curl -X POST https://api.transvoix.io/v1/api/translate \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Good morning, welcome to the meeting.",
    "target_language": "ja",
    "formality": "formal"
  }'

# Translate text (with API key)
curl -X POST https://api.transvoix.io/v1/api/translate \
  -H "X-API-Key: tvx_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello world",
    "target_language": "de"
  }'

# Detect language
curl -X POST https://api.transvoix.io/v1/api/detect \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{"text": "これは日本語のテキストです"}'

# List supported languages
curl https://api.transvoix.io/v1/api/languages

# Batch translate
curl -X POST https://api.transvoix.io/v1/api/translate/batch \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"text": "Hello", "target_language": "es"},
      {"text": "World", "target_language": "fr"}
    ]
  }'

# ─── Sessions ───

# Create session
curl -X POST https://api.transvoix.io/v1/api/sessions \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Quick Chat",
    "type": "one-to-one",
    "settings": {"allow_guests": true}
  }'

# Join session
curl -X POST https://api.transvoix.io/v1/api/sessions/SESSION_ID/join \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{"language": "es"}'

# Get transcript
curl "https://api.transvoix.io/v1/api/sessions/SESSION_ID/transcript?limit=50" \
  -H "Authorization: Bearer eyJhbG..."

# End session
curl -X DELETE https://api.transvoix.io/v1/api/sessions/SESSION_ID \
  -H "Authorization: Bearer eyJhbG..."

# ─── Recordings ───

# List recordings
curl https://api.transvoix.io/v1/api/recordings \
  -H "Authorization: Bearer eyJhbG..."

# Export as SRT
curl "https://api.transvoix.io/v1/api/recordings/REC_ID/export?format=srt&language=es" \
  -H "Authorization: Bearer eyJhbG..." \
  -o transcript_es.srt

# ─── User Profile ───

# Get profile
curl https://api.transvoix.io/v1/api/users/profile \
  -H "Authorization: Bearer eyJhbG..."

# Update profile
curl -X PUT https://api.transvoix.io/v1/api/users/profile \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{
    "target_languages": ["es", "fr", "ja"],
    "preferred_formality": "formal",
    "speech_rate": 0.9
  }'

# ─── Dictionaries ───

# Create dictionary
curl -X POST https://api.transvoix.io/v1/api/users/dictionaries \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Legal Terms",
    "source_language": "en",
    "target_language": "es",
    "entries": [
      {"source_term": "plaintiff", "target_term": "demandante"},
      {"source_term": "defendant", "target_term": "demandado"}
    ]
  }'

# Add entry
curl -X POST https://api.transvoix.io/v1/api/users/dictionaries/DICT_ID/entries \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{"source_term": "breach", "target_term": "incumplimiento"}'

# ─── Analytics (Admin) ───

# Overview
curl https://api.transvoix.io/v1/api/analytics/overview?period=30d \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Language breakdown
curl https://api.transvoix.io/v1/api/analytics/languages?period=7d \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Latency metrics
curl https://api.transvoix.io/v1/api/analytics/latency?period=24h \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Usage stats
curl "https://api.transvoix.io/v1/api/analytics/usage?period=30d&group_by=day" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### WebSocket Client (JavaScript)

```javascript
class TransVoixWebSocket {
  constructor(sessionId, token, options = {}) {
    this.sessionId = sessionId;
    this.token = token;
    this.baseUrl = options.baseUrl || 'wss://api.transvoix.io';
    this.handlers = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.heartbeatTimeout = null;
    this.lastMessageId = null;
    this.isReconnecting = false;
  }

  connect() {
    const url = `${this.baseUrl}/ws/session/${this.sessionId}?token=${this.token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[TransVoix] Connected');
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.startHeartbeatMonitor();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.lastMessageId = message.message_id;
      this.resetHeartbeatMonitor();

      // Handle ping/pong
      if (message.type === 'ping') {
        this.send({ type: 'pong', payload: {} });
        return;
      }

      // Dispatch to registered handlers
      if (this.handlers[message.type]) {
        this.handlers[message.type].forEach(fn => fn(message.payload));
      }

      // Also dispatch to wildcard handlers
      if (this.handlers['*']) {
        this.handlers['*'].forEach(fn => fn(message));
      }
    };

    this.ws.onclose = (event) => {
      console.log(`[TransVoix] Disconnected: ${event.code} — ${event.reason}`);
      this.stopHeartbeatMonitor();

      if (event.code === 4001) {
        // Auth failed — need to refresh token
        this.emit('tokenExpired');
        return;
      }

      if (event.code >= 4003 && event.code <= 4005) {
        // Session-level errors — no reconnect
        this.emit('sessionClosed', { code: event.code, reason: event.reason });
        return;
      }

      // Attempt reconnection for unexpected disconnections
      if (!this.intentionalClose) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('[TransVoix] WebSocket error:', error);
      this.emit('error', error);
    };
  }

  on(type, handler) {
    if (!this.handlers[type]) this.handlers[type] = [];
    this.handlers[type].push(handler);
    return this; // chainable
  }

  off(type, handler) {
    if (this.handlers[type]) {
      this.handlers[type] = this.handlers[type].filter(h => h !== handler);
    }
    return this;
  }

  emit(type, data) {
    if (this.handlers[type]) {
      this.handlers[type].forEach(fn => fn(data));
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
        message_id: crypto.randomUUID()
      }));
    }
  }

  // Send text for translation
  sendTranslation(text, options = {}) {
    this.send({
      type: 'translate',
      payload: {
        text,
        source_language: options.sourceLanguage || null,
        is_partial: options.isPartial || false,
        dictionary_id: options.dictionaryId || null
      }
    });
  }

  // Send typing indicator
  sendTyping(isTyping) {
    this.send({
      type: 'typing',
      payload: { is_typing: isTyping }
    });
  }

  // Change language
  changeLanguage(language) {
    this.send({
      type: 'language_change',
      payload: { language }
    });
  }

  // Send reaction
  sendReaction(emoji) {
    this.send({
      type: 'reaction',
      payload: { emoji }
    });
  }

  // Submit correction
  submitCorrection(messageId, correctedText, language) {
    this.send({
      type: 'correction',
      payload: {
        message_id: messageId,
        corrected_text: correctedText,
        language
      }
    });
  }

  // Heartbeat monitoring
  startHeartbeatMonitor() {
    this.resetHeartbeatMonitor();
  }

  resetHeartbeatMonitor() {
    clearTimeout(this.heartbeatTimeout);
    this.heartbeatTimeout = setTimeout(() => {
      console.warn('[TransVoix] No heartbeat received — reconnecting');
      this.ws.close();
      this.attemptReconnect();
    }, 45000); // 45 seconds
  }

  stopHeartbeatMonitor() {
    clearTimeout(this.heartbeatTimeout);
  }

  // Reconnection with exponential backoff + jitter
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[TransVoix] Max reconnection attempts reached');
      this.emit('reconnectFailed');
      return;
    }

    this.isReconnecting = true;
    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    const jitter = Math.random() * 500;
    const delay = baseDelay + jitter;

    console.log(`[TransVoix] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts + 1})`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.emit('reconnecting', { attempt: this.reconnectAttempts });
      this.connect();
    }, delay);
  }

  // Graceful disconnect
  disconnect() {
    this.intentionalClose = true;
    this.send({ type: 'leave', payload: {} });
    this.stopHeartbeatMonitor();
    setTimeout(() => {
      if (this.ws) this.ws.close(1000, 'Client leaving');
    }, 100);
  }
}

// ─── Usage Example ───

const ws = new TransVoixWebSocket('session-uuid-here', 'jwt-token-here');

ws.on('auth_success', (payload) => {
  console.log(`Joined session: ${payload.session.name}`);
  console.log(`Participants: ${payload.participants.length}`);
});

ws.on('translation', (payload) => {
  console.log(`[${payload.display_name}] ${payload.original_text}`);
  Object.entries(payload.translations).forEach(([lang, text]) => {
    console.log(`  → [${lang}] ${text}`);
  });
});

ws.on('participant_joined', (payload) => {
  console.log(`${payload.participant.display_name} joined (${payload.participant.language})`);
});

ws.on('participant_left', (payload) => {
  console.log(`${payload.display_name} left (${payload.reason})`);
});

ws.on('session_ended', (payload) => {
  console.log(`Session ended: ${payload.reason}`);
});

ws.on('error', (payload) => {
  console.error(`Error: ${payload.code} — ${payload.message}`);
});

ws.on('tokenExpired', () => {
  // Refresh token and reconnect
  refreshToken().then((newToken) => {
    ws.token = newToken;
    ws.connect();
  });
});

ws.on('reconnectFailed', () => {
  alert('Connection lost. Please refresh the page.');
});

// Connect
ws.connect();

// Send messages
ws.sendTranslation('Hello everyone, let\'s get started!');
ws.sendReaction('👋');

// Disconnect when done
// ws.disconnect();
```

---

## Error Response Format

All API errors follow a consistent JSON structure:

```json
{
  "error": {
    "code": "string (machine-readable error code)",
    "message": "string (human-readable description)",
    "details": {
      "field": "string (optional, the field that caused the error)",
      "reason": "string (optional, additional context)",
      "retry_after": "number (optional, seconds until rate limit resets)"
    }
  }
}
```

**Example — Validation Error:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "field": "email",
      "reason": "Must be a valid email address"
    }
  }
}
```

**Example — Rate Limited:**

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "retry_after": 42,
      "limit": 100,
      "remaining": 0,
      "reset_at": "2024-01-15T10:30:42Z"
    }
  }
}
```

---

## Error Codes Reference

### Authentication & Authorization Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body failed validation |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `INVALID_TOKEN` | 401 | Malformed or invalid JWT |
| `TOKEN_EXPIRED` | 401 | JWT access token has expired |
| `TOKEN_REVOKED` | 401 | Token has been explicitly revoked |
| `INVALID_OAUTH_TOKEN` | 400 | Invalid OAuth provider token |
| `ACCESS_DENIED` | 403 | Insufficient permissions |
| `ADMIN_REQUIRED` | 403 | Admin role required |
| `ACCOUNT_LOCKED` | 403 | Account locked (too many failed login attempts) |
| `EMAIL_EXISTS` | 409 | Email already registered |

### Translation Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `TRANSLATION_FAILED` | 500 | Translation service unavailable or failed |
| `DETECTION_FAILED` | 500 | Language detection service failed |
| `UNSUPPORTED_LANGUAGE` | 400 | Language code not in supported list |
| `TEXT_TOO_LONG` | 400 | Text exceeds maximum character limit |
| `BATCH_TOO_LARGE` | 400 | Batch contains too many items |

### Session Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `SESSION_NOT_FOUND` | 404 | Session does not exist |
| `SESSION_ENDED` | 410 | Session has already ended |
| `SESSION_FULL` | 409 | Maximum participants reached |
| `SESSION_LIMIT_REACHED` | 403 | Max concurrent sessions for user's plan |
| `INVALID_JOIN_CODE` | 400 | Wrong session join code |
| `GUESTS_NOT_ALLOWED` | 403 | Session does not permit guest access |

### User & Dictionary Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `DICTIONARY_NOT_FOUND` | 404 | Dictionary does not exist |
| `DICTIONARY_NAME_EXISTS` | 409 | Dictionary name already in use |
| `DICTIONARY_LIMIT_REACHED` | 403 | Max dictionaries for user's plan |
| `ENTRY_EXISTS` | 409 | Source term already in dictionary |
| `ENTRY_NOT_FOUND` | 404 | Dictionary entry not found |

### Recording Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `RECORDING_NOT_FOUND` | 404 | Recording does not exist |
| `INVALID_EXPORT_FORMAT` | 400 | Unsupported export format |

### Rate Limiting & Quota Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `RATE_LIMITED` | 429 | Request rate limit exceeded |
| `QUOTA_EXCEEDED` | 429 | Daily translation quota exhausted |

### Analytics Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_PERIOD` | 400 | Invalid time period parameter |

### General Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `OAUTH_PROVIDER_ERROR` | 500 | OAuth provider communication failure |

---

## Rate Limiting

Rate limits are enforced per-user (or per-API key) using a sliding window algorithm. Rate limit status is returned in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1705312242
X-RateLimit-RetryAfter: 0
```

### Limits by Plan

| Plan | Requests/Minute | Translation Minutes/Day | Max Concurrent Sessions | Max Dictionaries | Batch Size |
|------|-----------------|------------------------|------------------------|------------------|------------|
| **Free** | 100 | 30 | 2 | 3 | 10 |
| **Premium** | 500 | Unlimited | 10 | 25 | 50 |
| **Business** | 2,000 | Unlimited | 50 | 100 | 50 |
| **Enterprise** | Custom | Custom | Custom | Custom | Custom |
| **API Key** | Based on plan | Based on plan | N/A | N/A | 50 |

### WebSocket Rate Limits

| Metric | Limit |
|--------|-------|
| Messages per second | 5 |
| Messages per minute | 120 |
| Max message size | 4 KB |
| Connection attempts per minute | 10 |

### Handling Rate Limits

When rate limited, the API returns `429 Too Many Requests`:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded",
    "details": {
      "retry_after": 12,
      "limit": 100,
      "remaining": 0,
      "reset_at": "2024-01-15T10:30:42Z"
    }
  }
}
```

**Best Practices:**
1. Monitor `X-RateLimit-Remaining` header proactively
2. Implement exponential backoff on `429` responses
3. Use the `retry_after` value from the error response
4. Use batch endpoints when translating multiple texts
5. Cache translation results where appropriate
6. Contact sales for Enterprise custom limits
