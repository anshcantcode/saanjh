# Saanjh FastAPI backend

This backend keeps Groq and Voicebox configuration on the server, persists only data submitted by the client, and starts with an empty SQLite database. It does not create a companion, mood, journal entry, session, message, memory, transcript, or synthetic fallback response on its own.

## Run locally

From `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `GROQ_API_KEY` in `.env`. Keep `VOICEBOX_URL=http://127.0.0.1:17493` when FastAPI and Voicebox run on this computer. Then start the API:

```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- OpenAPI UI: `http://127.0.0.1:8000/docs`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`
- Combined health: `http://127.0.0.1:8000/api/health`

`/api/health` returns HTTP 200 with `status: "ok"` only when SQLite, Groq, and Voicebox are all reachable. Otherwise it returns `status: "degraded"` with per-service details. This makes a missing optional development service observable without making the API process itself appear dead.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_PATH` | SQLite path. Relative paths resolve under `backend`. |
| `CORS_ORIGINS` | Comma-separated browser origins or `*` for local development. |
| `GROQ_API_KEY` | Required server secret for chat and Groq health. Never send this from Expo. |
| `GROQ_MODEL` | Server-selected Groq model. Defaults to `llama-3.1-8b-instant`. |
| `GROQ_BASE_URL` | Groq REST base. Defaults to the official OpenAI-compatible endpoint. |
| `GROQ_TIMEOUT_SECONDS` | Groq request deadline. |
| `GROQ_HISTORY_LIMIT` | Maximum number of stored messages sent as context. |
| `VOICEBOX_URL` | Voicebox origin, normally `http://127.0.0.1:17493`. Never sent to clients. |
| `VOICEBOX_ENGINE` | Default engine when `/api/voicebox/generate` omits `engine`. |
| `VOICEBOX_TIMEOUT_SECONDS` | Voicebox request deadline. Defaults to 300 seconds because the first synthesis may load a large model into GPU memory. |
| `VOICEBOX_MAX_UPLOAD_MB` | Hard in-memory limit for proxied audio uploads. |
| `VOICEBOX_MAX_AUDIO_MB` | Hard limit for generated audio proxied to a client. |

For a deployed API, set explicit HTTPS origins rather than `CORS_ORIGINS=*`, place it behind authentication/TLS, and encrypt sensitive application data at rest. This prototype intentionally uses local SQLite and does not claim production-grade encryption.

## JSON conventions

Application request and response fields use `snake_case`, matching the generated OpenAPI document. IDs are either client-supplied safe identifiers or server-generated UUID hex strings. Dates are ISO-8601 timestamps. List endpoints return `[]` until the client stores data; `GET /api/companion` returns `null` until the singleton companion is created.

Validation rejects unknown fields. A companion cannot be stored unless both `consent_acknowledged` and `ai_disclosure_acknowledged` are true. `consent_note` is required for `consented` and `memorial` voices. The stored disclosure text is fixed to:

> This is an AI-generated companion voice, not the real person.

### Companion

| Method | Path | Contract |
| --- | --- | --- |
| GET | `/api/companion` | Current companion object or `null`. |
| POST | `/api/companion` | Create the singleton companion; `409` if one exists. |
| GET | `/api/companion/{id}` | Fetch by ID. |
| PUT/PATCH | `/api/companion` | Update supplied fields on the current companion while retaining its ID. |
| PUT/PATCH | `/api/companion/{id}` | Update supplied fields by ID. |
| DELETE | `/api/companion` | Delete the linked Voicebox profile first, then the companion and its sessions/messages. |
| DELETE | `/api/companion/{id}` | Remote-first deletion by ID. |

Minimum create body:

```json
{
  "name": "A user-provided name",
  "relationship": "friend",
  "voice_status": "self",
  "consent_acknowledged": true,
  "ai_disclosure_acknowledged": true
}
```

Optional stored fields are `id`, `custom_relationship`, `consent_at`, `consent_note`, `voice_sample_uri`, `voice_sample_name`, `sample_transcript`, `voicebox_profile_id`, `avatar_uri`, `traits`, `memories`, `address_as`, `helpful_when`, and `avoid`. PUT and PATCH validate the merged record, so clients can send only changed fields.

### Moods and journal

| Method | Path | Contract |
| --- | --- | --- |
| GET | `/api/moods?limit=100&offset=0` | Newest-first mood list. |
| POST | `/api/moods` | Store `{mood, score?, note?, tags?, context?, session_id?, created_at?, id?}`. |
| GET | `/api/moods/{id}` | Fetch one stored mood. |
| DELETE | `/api/moods/{id}` | Delete one stored mood. |
| GET | `/api/journal?limit=100&offset=0` | Newest-first journal list. |
| POST | `/api/journal` | Store `{body, title?, session_id?, created_at?, id?}`. |
| GET | `/api/journal/{id}` | Fetch one stored journal entry. |
| DELETE | `/api/journal/{id}` | Delete one stored journal entry. |

If `session_id` is supplied on mood or journal creation, it must identify a stored session. The API never invents text, tags, titles, mood labels, or scores.

### Sessions and messages

| Method | Path | Contract |
| --- | --- | --- |
| GET | `/api/sessions?companion_id=...&limit=100&offset=0` | Newest-first stored sessions, optionally filtered. |
| POST | `/api/sessions` | Store `{companion_id, kind, status?, intention?, started_at?, ended_at?, error_message?, id?}`. |
| GET | `/api/sessions/{id}` | Fetch one session. |
| PATCH | `/api/sessions/{id}` | Update `status`, `intention`, `ended_at`, and/or `error_message`. |
| GET | `/api/sessions/{id}/messages` | Oldest-first stored message list. |
| POST | `/api/sessions/{id}/messages` | Store `{role, content, modality?, audio_uri?, voicebox_generation_id?, created_at?, id?}`. |
| PATCH | `/api/sessions/{id}/messages/{message_id}` | Update message content or generated-audio metadata. |

Allowed values are `kind: text|voice`, `status: active|completed|cancelled|failed`, `role: user|assistant`, and `modality: text|voice`.

### Server-side Groq chat

`POST /api/chat` accepts:

```json
{
  "companion_id": "stored-companion-id",
  "session_id": "optional-active-session-id",
  "message": "The real user message",
  "modality": "text"
}
```

If `session_id` is omitted, the API creates and returns a new active session. It persists the submitted user message, builds the system prompt only from the stored companion/consent/style/memory fields, calls Groq with `GROQ_API_KEY` and `GROQ_MODEL`, then persists the actual Groq response. The response is:

```json
{
  "session_id": "...",
  "user_message": { "id": "...", "session_id": "...", "role": "user", "content": "...", "modality": "text", "created_at": "...", "updated_at": "..." },
  "assistant_message": { "id": "...", "session_id": "...", "role": "assistant", "content": "...", "modality": "text", "created_at": "...", "updated_at": "..." },
  "model": "llama-3.1-8b-instant"
}
```

If Groq fails, the real user message remains stored and no assistant message or fallback reply is fabricated. Fetch the session messages to retry or recover.

### Voicebox proxy

All Voicebox requests use the server-only `VOICEBOX_URL`:

| Method | Path | Upstream contract |
| --- | --- | --- |
| GET | `/api/voicebox/health` | `GET /health` |
| GET | `/api/voicebox/profiles` | `GET /profiles` |
| POST | `/api/voicebox/profiles` | `POST /profiles` with `{name, description?, language, voice_type, default_engine?}` |
| DELETE | `/api/voicebox/profiles/{id}` | `DELETE /profiles/{id}` for rollback and explicit cleanup. |
| POST | `/api/voicebox/profiles/{id}/samples` | Multipart `file` plus required `reference_text`. |
| POST | `/api/voicebox/transcribe` | Multipart `file`, optional `language` and `model`. |
| POST | `/api/voicebox/generate` | `{profile_id, text, language, engine?}`; `personality` is forced off server-side so Voicebox cannot rewrite the safety-reviewed reply. |
| GET | `/api/voicebox/history/{generation_id}` | Poll `GET /history/{generation_id}` and expose a backend audio URL when complete. |
| GET | `/api/voicebox/audio/{generation_id}` | Streams `GET /audio/{generation_id}` without revealing the Voicebox URL. |

Uploads are bounded, filenames are stripped of directory components, non-audio content types are rejected, redirects are not followed, upstream cookies/filenames are not forwarded, and audio responses use `Cache-Control: no-store` plus `X-Content-Type-Options: nosniff`.

## Errors

Validation errors use FastAPI's standard HTTP 422 shape. Missing stored records return 404. Conflicts return 409. Groq/Voicebox errors return a stable envelope:

```json
{
  "error": {
    "service": "Voicebox",
    "code": "unreachable",
    "message": "Could not reach Voicebox. Check its configured URL and network access.",
    "upstream_status": null
  }
}
```

Timeouts use 504, unconfigured services use 503, invalid upstream responses use 502, oversized media uses 413, and missing generated audio uses 404.
