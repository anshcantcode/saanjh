from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime
import re
import sqlite3
from typing import Annotated, Any, TypeVar

from fastapi import FastAPI, File, Form, HTTPException, Path, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from . import database as db
from .config import get_settings
from .schemas import (
    AI_DISCLOSURE,
    ChatRequest,
    ChatTurnOut,
    CompanionCreate,
    CompanionOut,
    CompanionPatch,
    CompanionValues,
    ErrorEnvelope,
    HealthOut,
    JournalCreate,
    JournalOut,
    MessageCreate,
    MessageModality,
    MessageOut,
    MessageRole,
    MessagePatch,
    MoodCreate,
    MoodOut,
    RecordId,
    ServiceHealth,
    SessionCreate,
    SessionKind,
    SessionOut,
    SessionPatch,
    SessionStatus,
    VoiceStatus,
    VoiceboxGenerateRequest,
    VoiceboxProfileCreate,
)
from .upstreams import (
    UpstreamServiceError,
    groq_chat,
    groq_health,
    open_voicebox_audio,
    voicebox_delete_profile,
    voicebox_json,
    voicebox_multipart,
)


settings = get_settings()
ModelT = TypeVar("ModelT", bound=BaseModel)
DISTRESS_PATTERN = re.compile(
    r"\b(kill myself|suicid(?:e|al)|end my life|take my life|want to die|"
    r"don['’]?t want to (?:live|be alive)|hurt myself|harm myself|self[- ]harm|"
    r"not worth living|immediate danger|someone is hurting me)\b",
    re.IGNORECASE,
)
SAFETY_GUIDANCE = (
    "Saanjh cannot provide emergency help. If you may act on these thoughts or are in immediate danger, "
    "call your local emergency number or go to the nearest emergency department now. Move near another "
    "person and contact someone you trust who can stay with you."
)
VOICEBOX_ENGINE_MODELS = {
    "qwen": "qwen-tts-1.7B",
    "qwen_custom_voice": "qwen-custom-voice-1.7B",
    "chatterbox": "chatterbox-tts",
    "chatterbox_turbo": "chatterbox-turbo",
    "luxtts": "luxtts",
    "tada": "tada-1b",
    "kokoro": "kokoro",
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_database()
    yield


app = FastAPI(
    title="Saanjh API",
    version="1.0.0",
    description=(
        "Private persistence plus server-side Groq and Voicebox access for Saanjh. "
        "The database starts empty and no endpoint returns seeded companion, mood, journal, or session data."
    ),
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials="*" not in settings.cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Accept", "Authorization", "Content-Type"],
)


@app.exception_handler(UpstreamServiceError)
async def upstream_error_handler(_, exc: UpstreamServiceError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "service": exc.service,
                "code": exc.code,
                "message": exc.message,
                "upstream_status": exc.upstream_status,
            }
        },
    )


@app.exception_handler(sqlite3.IntegrityError)
async def integrity_error_handler(_, __: sqlite3.IntegrityError) -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content={
            "error": {
                "service": "database",
                "code": "conflict",
                "message": "The record conflicts with existing data or references a missing parent record.",
                "upstream_status": None,
            }
        },
    )


def _not_found(resource: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{resource} was not found.")


def _record(table: str, record_id: str, resource: str) -> dict[str, Any]:
    value = db.get_record(table, record_id)
    if value is None:
        raise _not_found(resource)
    return value


def _payload(model: BaseModel, *exclude: str) -> dict[str, Any]:
    return model.model_dump(mode="json", exclude=set(exclude))


def _replace_model(
    model_type: type[ModelT],
    current: dict[str, Any],
    changes: dict[str, Any],
) -> ModelT:
    names = set(model_type.model_fields)
    values = {name: current.get(name) for name in names if name in current}
    values.update(changes)
    return model_type.model_validate(values)


def _created_at(payload: dict[str, Any]) -> datetime | str | None:
    return payload.pop("created_at", None)


def _create_session(body: SessionCreate) -> SessionOut:
    _record("companions", body.companion_id, "Companion")
    payload = _payload(body, "id")
    payload["started_at"] = payload.get("started_at") or db.utc_now().isoformat()
    record = db.insert_record(
        "sessions",
        payload,
        record_id=body.id,
        extra={"companion_id": body.companion_id},
    )
    return SessionOut.model_validate(record)


def _create_message(session_id: str, body: MessageCreate) -> MessageOut:
    _record("sessions", session_id, "Session")
    payload = _payload(body, "id", "created_at")
    record = db.insert_record(
        "messages",
        payload,
        record_id=body.id,
        created_at=body.created_at,
        extra={"session_id": session_id},
    )
    return MessageOut.model_validate(record)


async def _service_health(coro: Any, *, include_model: bool = False) -> ServiceHealth:
    try:
        result = await coro
        model = result.get("model") if include_model and isinstance(result, dict) else None
        return ServiceHealth(status="ok", model=model)
    except UpstreamServiceError as exc:
        return ServiceHealth(status="unavailable", detail=exc.message)


async def _voicebox_service_health() -> ServiceHealth:
    try:
        health_result = await voicebox_json("GET", "/health")
    except UpstreamServiceError as exc:
        return ServiceHealth(status="unavailable", detail=exc.message)

    health_status = str(health_result.get("status") or "").lower() if isinstance(health_result, dict) else ""
    if health_status and health_status not in {"ok", "online", "healthy"}:
        return ServiceHealth(status="unavailable", detail=f"Voicebox reported {health_status}.")

    engine = settings.voicebox_engine or "qwen"
    expected_model = VOICEBOX_ENGINE_MODELS.get(engine)
    try:
        model_result = await voicebox_json("GET", "/models/status")
    except UpstreamServiceError:
        return ServiceHealth(
            status="ok",
            detail="Voicebox is reachable, but this version did not report synthesis-model readiness.",
            model=engine,
        )

    models = model_result.get("models") if isinstance(model_result, dict) else None
    selected = next(
        (
            item
            for item in models or []
            if isinstance(item, dict) and expected_model and item.get("model_name") == expected_model
        ),
        None,
    )
    if not isinstance(selected, dict):
        return ServiceHealth(
            status="ok",
            detail=f"Voicebox is reachable. The selected engine is {engine}.",
            model=engine,
        )

    display_name = str(selected.get("display_name") or selected.get("model_name") or engine)
    if not selected.get("downloaded"):
        return ServiceHealth(
            status="unavailable",
            detail=f"{display_name} is not downloaded in Voicebox.",
            model=engine,
        )
    if selected.get("loaded"):
        detail = f"{display_name} is loaded and ready for speech generation."
    else:
        detail = f"{display_name} is downloaded and will load on the first speech generation; the first reply may take longer."
    return ServiceHealth(status="ok", detail=detail, model=engine)


@app.get("/api/health", response_model=HealthOut, tags=["health"])
async def health() -> HealthOut:
    database = ServiceHealth(
        status="ok" if db.database_is_ready() else "unavailable",
        detail=None if db.database_is_ready() else "SQLite schema is not ready.",
    )
    groq = await _service_health(groq_health(), include_model=True)
    voicebox = await _voicebox_service_health()
    return HealthOut(
        status="ok" if all(item.status == "ok" for item in (database, groq, voicebox)) else "degraded",
        database=database,
        groq=groq,
        voicebox=voicebox,
    )


# Companion is intentionally singleton-shaped because the Expo client currently uses one active companion.
@app.get("/api/companion", response_model=CompanionOut | None, tags=["companion"])
def get_current_companion() -> CompanionOut | None:
    rows = db.list_records("companions", limit=1, offset=0)
    return CompanionOut.model_validate(rows[0]) if rows else None


@app.post("/api/companion", response_model=CompanionOut, status_code=201, tags=["companion"])
def create_companion(body: CompanionCreate) -> CompanionOut:
    if db.list_records("companions", limit=1, offset=0):
        raise HTTPException(status_code=409, detail="A companion already exists. Update or delete it first.")
    payload = _payload(body, "id")
    payload["consent_at"] = payload.get("consent_at") or db.utc_now().isoformat()
    record = db.insert_record("companions", payload, record_id=body.id)
    return CompanionOut.model_validate(record)


@app.get("/api/companion/{companion_id}", response_model=CompanionOut, tags=["companion"])
def get_companion(companion_id: RecordId) -> CompanionOut:
    return CompanionOut.model_validate(_record("companions", companion_id, "Companion"))


def _put_companion(companion_id: str, body: CompanionPatch) -> CompanionOut:
    current = _record("companions", companion_id, "Companion")
    changes = body.model_dump(mode="json", exclude_unset=True)
    validated = _replace_model(CompanionValues, current, changes)
    payload = _payload(validated)
    payload["consent_at"] = payload.get("consent_at") or current["consent_at"]
    record = db.update_record("companions", companion_id, payload)
    if record is None:
        raise _not_found("Companion")
    return CompanionOut.model_validate(record)


@app.put("/api/companion/{companion_id}", response_model=CompanionOut, tags=["companion"])
def put_companion(companion_id: RecordId, body: CompanionPatch) -> CompanionOut:
    return _put_companion(companion_id, body)


@app.patch("/api/companion/{companion_id}", response_model=CompanionOut, tags=["companion"])
def patch_companion(companion_id: RecordId, body: CompanionPatch) -> CompanionOut:
    return _put_companion(companion_id, body)


@app.put("/api/companion", response_model=CompanionOut, tags=["companion"])
def put_current_companion(body: CompanionPatch) -> CompanionOut:
    current = get_current_companion()
    if current is None:
        raise _not_found("Companion")
    return _put_companion(current.id, body)


@app.patch("/api/companion", response_model=CompanionOut, tags=["companion"])
def patch_current_companion(body: CompanionPatch) -> CompanionOut:
    return put_current_companion(body)


@app.delete("/api/companion/{companion_id}", status_code=204, tags=["companion"])
async def delete_companion(companion_id: RecordId) -> Response:
    current = _record("companions", companion_id, "Companion")
    remote_profile_id = current.get("voicebox_profile_id")
    if remote_profile_id:
        # Remote-first deletion prevents the local record from losing the only
        # identifier needed to remove cloned voice data.
        await voicebox_delete_profile(str(remote_profile_id))
    if not db.delete_record("companions", companion_id):
        raise _not_found("Companion")
    return Response(status_code=204)


@app.delete("/api/companion", status_code=204, tags=["companion"])
async def delete_current_companion() -> Response:
    current = get_current_companion()
    if current is None:
        raise _not_found("Companion")
    return await delete_companion(current.id)


@app.get("/api/moods", response_model=list[MoodOut], tags=["moods"])
def list_moods(
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[MoodOut]:
    return [MoodOut.model_validate(item) for item in db.list_records("moods", limit=limit, offset=offset)]


@app.post("/api/moods", response_model=MoodOut, status_code=201, tags=["moods"])
def create_mood(body: MoodCreate) -> MoodOut:
    if body.session_id:
        _record("sessions", body.session_id, "Session")
    payload = _payload(body, "id", "created_at")
    record = db.insert_record("moods", payload, record_id=body.id, created_at=body.created_at)
    return MoodOut.model_validate(record)


@app.get("/api/moods/{mood_id}", response_model=MoodOut, tags=["moods"])
def get_mood(mood_id: RecordId) -> MoodOut:
    return MoodOut.model_validate(_record("moods", mood_id, "Mood"))


@app.delete("/api/moods/{mood_id}", status_code=204, tags=["moods"])
def delete_mood(mood_id: RecordId) -> Response:
    if not db.delete_record("moods", mood_id):
        raise _not_found("Mood")
    return Response(status_code=204)


@app.get("/api/journal", response_model=list[JournalOut], tags=["journal"])
def list_journal(
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[JournalOut]:
    return [JournalOut.model_validate(item) for item in db.list_records("journal_entries", limit=limit, offset=offset)]


@app.post("/api/journal", response_model=JournalOut, status_code=201, tags=["journal"])
def create_journal_entry(body: JournalCreate) -> JournalOut:
    if body.session_id:
        _record("sessions", body.session_id, "Session")
    payload = _payload(body, "id", "created_at")
    record = db.insert_record("journal_entries", payload, record_id=body.id, created_at=body.created_at)
    return JournalOut.model_validate(record)


@app.get("/api/journal/{entry_id}", response_model=JournalOut, tags=["journal"])
def get_journal_entry(entry_id: RecordId) -> JournalOut:
    return JournalOut.model_validate(_record("journal_entries", entry_id, "Journal entry"))


@app.delete("/api/journal/{entry_id}", status_code=204, tags=["journal"])
def delete_journal_entry(entry_id: RecordId) -> Response:
    if not db.delete_record("journal_entries", entry_id):
        raise _not_found("Journal entry")
    return Response(status_code=204)


@app.get("/api/sessions", response_model=list[SessionOut], tags=["sessions"])
def list_sessions(
    companion_id: Annotated[RecordId | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[SessionOut]:
    where = {"companion_id": companion_id} if companion_id else None
    return [
        SessionOut.model_validate(item)
        for item in db.list_records("sessions", limit=limit, offset=offset, where=where)
    ]


@app.post("/api/sessions", response_model=SessionOut, status_code=201, tags=["sessions"])
def create_session(body: SessionCreate) -> SessionOut:
    return _create_session(body)


@app.get("/api/sessions/{session_id}", response_model=SessionOut, tags=["sessions"])
def get_session(session_id: RecordId) -> SessionOut:
    return SessionOut.model_validate(_record("sessions", session_id, "Session"))


@app.patch("/api/sessions/{session_id}", response_model=SessionOut, tags=["sessions"])
def patch_session(session_id: RecordId, body: SessionPatch) -> SessionOut:
    current = _record("sessions", session_id, "Session")
    changes = body.model_dump(mode="json", exclude_unset=True)
    validated = _replace_model(SessionCreate, current, changes)
    payload = _payload(validated, "id")
    record = db.update_record("sessions", session_id, payload)
    if record is None:
        raise _not_found("Session")
    return SessionOut.model_validate(record)


@app.get("/api/sessions/{session_id}/messages", response_model=list[MessageOut], tags=["sessions"])
def list_messages(
    session_id: RecordId,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[MessageOut]:
    _record("sessions", session_id, "Session")
    return [
        MessageOut.model_validate(item)
        for item in db.list_records(
            "messages",
            limit=limit,
            offset=offset,
            where={"session_id": session_id},
            ascending=True,
        )
    ]


@app.post("/api/sessions/{session_id}/messages", response_model=MessageOut, status_code=201, tags=["sessions"])
def create_message(session_id: RecordId, body: MessageCreate) -> MessageOut:
    return _create_message(session_id, body)


@app.patch("/api/sessions/{session_id}/messages/{message_id}", response_model=MessageOut, tags=["sessions"])
def patch_message(session_id: RecordId, message_id: RecordId, body: MessagePatch) -> MessageOut:
    current = _record("messages", message_id, "Message")
    if current["session_id"] != session_id:
        raise _not_found("Message")
    changes = body.model_dump(mode="json", exclude_unset=True)
    values = {key: current.get(key) for key in ("role", "content", "modality", "audio_uri", "voicebox_generation_id")}
    values.update(changes)
    validated = MessageCreate.model_validate(values)
    payload = _payload(validated, "id", "created_at")
    record = db.update_record("messages", message_id, payload)
    if record is None:
        raise _not_found("Message")
    return MessageOut.model_validate(record)


def _system_prompt(companion: CompanionOut) -> str:
    relationship = companion.custom_relationship if companion.relationship.value == "other" else companion.relationship.value
    traits = ", ".join(companion.traits) if companion.traits else "warm, calm, and concise"
    if companion.memories:
        memory_rule = "Only these user-approved memories may be referenced:\n" + "\n".join(
            f"- {memory}" for memory in companion.memories
        )
    else:
        memory_rule = "No user-approved memories are stored. Do not invent or imply shared memories."
    identity_rule = (
        f"This is an AI memorial voice inspired by {companion.name}. Never claim to be that person, alive, conscious, or communicating from beyond death."
        if companion.voice_status is VoiceStatus.memorial
        else f"This is an AI-generated companion associated with {companion.name}. Never claim to literally be that person."
    )
    return "\n".join(
        line
        for line in (
            "You are Saanjh, a clearly disclosed AI companion for emotional support and reflection.",
            AI_DISCLOSURE,
            identity_rule,
            f"The user stored the relationship as: {relationship}.",
            f"The user selected this communication style: {traits}.",
            f"Address the user as: {companion.address_as}." if companion.address_as else "",
            f"The user says support is helpful when: {companion.helpful_when}." if companion.helpful_when else "",
            f"The user asked to avoid: {companion.avoid}." if companion.avoid else "",
            memory_rule,
            "Never diagnose, impersonate a clinician, encourage dependency, or suggest withdrawing from real people.",
            "For imminent self-harm, abuse, or immediate danger, be direct and compassionate and encourage local emergency help or a trusted nearby person now.",
            "Keep replies natural, concise, and usually under 70 words. Ask at most one gentle question.",
        )
        if line
    )


@app.post(
    "/api/chat",
    response_model=ChatTurnOut,
    tags=["chat"],
    responses={502: {"model": ErrorEnvelope}, 503: {"model": ErrorEnvelope}, 504: {"model": ErrorEnvelope}},
)
async def chat(body: ChatRequest) -> ChatTurnOut:
    if DISTRESS_PATTERN.search(body.message):
        # Do not persist or send a crisis disclosure to Groq as an ordinary
        # companion turn. The client presents direct human-help guidance.
        raise HTTPException(status_code=422, detail=SAFETY_GUIDANCE)
    companion = CompanionOut.model_validate(_record("companions", body.companion_id, "Companion"))
    if body.session_id:
        session = SessionOut.model_validate(_record("sessions", body.session_id, "Session"))
        if session.companion_id != body.companion_id:
            raise HTTPException(status_code=409, detail="Session belongs to a different companion.")
        if session.status is not SessionStatus.active:
            raise HTTPException(status_code=409, detail="Messages can only be added to an active session.")
    else:
        session = _create_session(
            SessionCreate(
                companion_id=body.companion_id,
                kind=SessionKind.voice if body.modality is MessageModality.voice else SessionKind.text,
            )
        )

    user_message = _create_message(
        session.id,
        MessageCreate(role=MessageRole.user, content=body.message, modality=body.modality),
    )
    history = db.list_records(
        "messages",
        limit=settings.groq_history_limit,
        offset=0,
        where={"session_id": session.id},
        ascending=False,
    )
    history.reverse()
    reply = await groq_chat(
        _system_prompt(companion),
        [{"role": str(item["role"]), "content": str(item["content"])} for item in history],
    )
    assistant_message = _create_message(
        session.id,
        MessageCreate(role=MessageRole.assistant, content=reply, modality=body.modality),
    )
    return ChatTurnOut(
        session_id=session.id,
        user_message=user_message,
        assistant_message=assistant_message,
        model=settings.groq_model,
    )


@app.get(
    "/api/voicebox/health",
    tags=["voicebox"],
    responses={502: {"model": ErrorEnvelope}, 503: {"model": ErrorEnvelope}, 504: {"model": ErrorEnvelope}},
)
async def voicebox_health_proxy() -> Any:
    return await voicebox_json("GET", "/health")


@app.get(
    "/api/voicebox/profiles",
    tags=["voicebox"],
    responses={502: {"model": ErrorEnvelope}, 503: {"model": ErrorEnvelope}, 504: {"model": ErrorEnvelope}},
)
async def voicebox_profiles_proxy() -> Any:
    return await voicebox_json("GET", "/profiles")


@app.post(
    "/api/voicebox/profiles",
    tags=["voicebox"],
    responses={502: {"model": ErrorEnvelope}, 503: {"model": ErrorEnvelope}, 504: {"model": ErrorEnvelope}},
)
async def voicebox_create_profile_proxy(body: VoiceboxProfileCreate) -> Any:
    payload: dict[str, Any] = {
        "name": body.name,
        "language": body.language,
        "voice_type": body.voice_type,
    }
    if body.description is not None:
        payload["description"] = body.description
    if body.default_engine is not None:
        payload["default_engine"] = body.default_engine
    return await voicebox_json(
        "POST",
        "/profiles",
        payload,
    )


@app.delete(
    "/api/voicebox/profiles/{profile_id}",
    status_code=204,
    tags=["voicebox"],
    responses={502: {"model": ErrorEnvelope}, 503: {"model": ErrorEnvelope}, 504: {"model": ErrorEnvelope}},
)
async def voicebox_delete_profile_proxy(
    profile_id: Annotated[str, Path(min_length=1, max_length=255, pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")],
) -> Response:
    await voicebox_delete_profile(profile_id)
    return Response(status_code=204)


async def _bounded_audio_upload(file: UploadFile) -> tuple[str, bytes, str]:
    filename = (file.filename or "voice-sample").replace("\\", "/").split("/")[-1][:255]
    content_type = (file.content_type or "application/octet-stream").lower()
    if not (content_type.startswith("audio/") or content_type == "application/octet-stream"):
        await file.close()
        raise HTTPException(status_code=415, detail="The upload must be an audio file.")
    data = bytearray()
    try:
        while chunk := await file.read(1024 * 1024):
            data.extend(chunk)
            if len(data) > settings.voicebox_max_upload_bytes:
                raise HTTPException(status_code=413, detail="The audio upload exceeds the configured size limit.")
    finally:
        await file.close()
    if not data:
        raise HTTPException(status_code=422, detail="The uploaded audio file is empty.")
    return filename, bytes(data), content_type


@app.post(
    "/api/voicebox/profiles/{profile_id}/samples",
    tags=["voicebox"],
    responses={502: {"model": ErrorEnvelope}, 503: {"model": ErrorEnvelope}, 504: {"model": ErrorEnvelope}},
)
async def voicebox_sample_proxy(
    profile_id: Annotated[str, Path(min_length=1, max_length=255, pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")],
    file: Annotated[UploadFile, File(description="A real, consented voice sample")],
    reference_text: Annotated[str, Form(min_length=1, max_length=10000)],
) -> Any:
    filename, content, content_type = await _bounded_audio_upload(file)
    return await voicebox_multipart(
        f"/profiles/{profile_id}/samples",
        filename=filename,
        content=content,
        content_type=content_type,
        fields={"reference_text": reference_text},
    )


@app.post(
    "/api/voicebox/transcribe",
    tags=["voicebox"],
    responses={502: {"model": ErrorEnvelope}, 503: {"model": ErrorEnvelope}, 504: {"model": ErrorEnvelope}},
)
async def voicebox_transcribe_proxy(
    file: Annotated[UploadFile, File(description="Audio to transcribe")],
    language: Annotated[str | None, Form(min_length=2, max_length=20)] = None,
    model: Annotated[str | None, Form(min_length=1, max_length=120)] = None,
) -> Any:
    filename, content, content_type = await _bounded_audio_upload(file)
    fields = {}
    if language:
        fields["language"] = language
    if model:
        fields["model"] = model
    return await voicebox_multipart(
        "/transcribe",
        filename=filename,
        content=content,
        content_type=content_type,
        fields=fields,
    )


@app.post(
    "/api/voicebox/generate",
    tags=["voicebox"],
    responses={502: {"model": ErrorEnvelope}, 503: {"model": ErrorEnvelope}, 504: {"model": ErrorEnvelope}},
)
async def voicebox_generate_proxy(body: VoiceboxGenerateRequest) -> Any:
    engine = body.engine or settings.voicebox_engine
    payload: dict[str, Any] = {
        "text": body.text,
        "profile_id": body.profile_id,
        "language": body.language,
        # Never let Voicebox rewrite the safety-reviewed Groq response.
        "personality": False,
    }
    if engine:
        payload["engine"] = engine
    result = await voicebox_json("POST", "/generate", payload)
    if isinstance(result, dict):
        generation_id = result.get("id") or result.get("generation_id")
        status = str(result.get("status") or "").lower()
        if status in {"failed", "error", "cancelled"}:
            message = result.get("error") or result.get("detail") or "Voicebox could not generate this audio."
            raise UpstreamServiceError(
                service="Voicebox",
                code="generation_failed",
                message=str(message)[:500],
                status_code=502,
            )
        if generation_id and (status == "completed" or result.get("audio_path")):
            result["audio_url"] = f"/api/voicebox/audio/{generation_id}"
    return result


@app.get(
    "/api/voicebox/history/{generation_id}",
    tags=["voicebox"],
    responses={502: {"model": ErrorEnvelope}, 503: {"model": ErrorEnvelope}, 504: {"model": ErrorEnvelope}},
)
async def voicebox_generation_status_proxy(
    generation_id: Annotated[str, Path(min_length=1, max_length=255, pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")],
) -> Any:
    result = await voicebox_json("GET", f"/history/{generation_id}")
    if isinstance(result, dict):
        status = str(result.get("status") or "").lower()
        if status in {"failed", "error", "cancelled"}:
            message = result.get("error") or result.get("detail") or "Voicebox could not generate this audio."
            raise UpstreamServiceError(
                service="Voicebox",
                code="generation_failed",
                message=str(message)[:500],
                status_code=502,
            )
        if status == "completed" or result.get("audio_path"):
            result["audio_url"] = f"/api/voicebox/audio/{generation_id}"
    return result


@app.get(
    "/api/voicebox/audio/{generation_id}",
    response_class=StreamingResponse,
    tags=["voicebox"],
    responses={404: {"model": ErrorEnvelope}, 502: {"model": ErrorEnvelope}, 504: {"model": ErrorEnvelope}},
)
async def voicebox_audio_proxy(
    generation_id: Annotated[str, Path(min_length=1, max_length=255, pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")],
) -> StreamingResponse:
    audio = await open_voicebox_audio(generation_id)
    headers = {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    }
    if audio.content_length:
        headers["Content-Length"] = audio.content_length
    return StreamingResponse(audio.chunks(), media_type=audio.media_type, headers=headers)
