from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


AI_DISCLOSURE = "This is an AI-generated companion voice, not the real person."
RecordId = Annotated[str, Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._:-]+$")]


class APIModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class Relationship(str, Enum):
    friend = "friend"
    parent = "parent"
    partner = "partner"
    sibling = "sibling"
    mentor = "mentor"
    other = "other"


class VoiceStatus(str, Enum):
    self = "self"
    consented = "consented"
    memorial = "memorial"


class MoodContext(str, Enum):
    check_in = "check-in"
    before_session = "before-session"
    after_session = "after-session"


class SessionKind(str, Enum):
    text = "text"
    voice = "voice"


class SessionStatus(str, Enum):
    active = "active"
    completed = "completed"
    cancelled = "cancelled"
    failed = "failed"


class MessageRole(str, Enum):
    user = "user"
    assistant = "assistant"


class MessageModality(str, Enum):
    text = "text"
    voice = "voice"


def _clean_text_list(values: list[str]) -> list[str]:
    cleaned = [value.strip() for value in values if value.strip()]
    if len(cleaned) != len(set(cleaned)):
        raise ValueError("List values must be unique.")
    return cleaned


class CompanionValues(APIModel):
    name: str = Field(min_length=1, max_length=120)
    relationship: Relationship
    custom_relationship: str | None = Field(default=None, max_length=120)
    voice_status: VoiceStatus
    consent_acknowledged: bool
    consent_at: datetime | None = None
    consent_note: str | None = Field(default=None, max_length=2000)
    ai_disclosure_acknowledged: bool
    disclosure_text: Literal[AI_DISCLOSURE] = AI_DISCLOSURE
    voice_sample_uri: str | None = Field(default=None, max_length=2000)
    voice_sample_name: str | None = Field(default=None, max_length=255)
    sample_transcript: str | None = Field(default=None, max_length=10000)
    voicebox_profile_id: str | None = Field(default=None, max_length=255)
    avatar_uri: str | None = Field(default=None, max_length=2000)
    traits: list[str] = Field(default_factory=list, max_length=30)
    memories: list[str] = Field(default_factory=list, max_length=100)
    address_as: str | None = Field(default=None, max_length=120)
    helpful_when: str | None = Field(default=None, max_length=4000)
    avoid: str | None = Field(default=None, max_length=4000)

    @field_validator("traits", "memories")
    @classmethod
    def clean_lists(cls, value: list[str]) -> list[str]:
        return _clean_text_list(value)

    @model_validator(mode="after")
    def validate_consent(self) -> "CompanionValues":
        if not self.consent_acknowledged:
            raise ValueError("consentAcknowledged must be true before a companion can be stored.")
        if not self.ai_disclosure_acknowledged:
            raise ValueError("aiDisclosureAcknowledged must be true before a companion can be stored.")
        if self.relationship is Relationship.other and not self.custom_relationship:
            raise ValueError("customRelationship is required when relationship is other.")
        if self.voice_status in {VoiceStatus.consented, VoiceStatus.memorial} and not self.consent_note:
            raise ValueError("consentNote is required for consented and memorial voices.")
        return self


class CompanionCreate(CompanionValues):
    id: RecordId | None = None


class CompanionPatch(APIModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    relationship: Relationship | None = None
    custom_relationship: str | None = Field(default=None, max_length=120)
    voice_status: VoiceStatus | None = None
    consent_acknowledged: bool | None = None
    consent_at: datetime | None = None
    consent_note: str | None = Field(default=None, max_length=2000)
    ai_disclosure_acknowledged: bool | None = None
    disclosure_text: Literal[AI_DISCLOSURE] | None = None
    voice_sample_uri: str | None = Field(default=None, max_length=2000)
    voice_sample_name: str | None = Field(default=None, max_length=255)
    sample_transcript: str | None = Field(default=None, max_length=10000)
    voicebox_profile_id: str | None = Field(default=None, max_length=255)
    avatar_uri: str | None = Field(default=None, max_length=2000)
    traits: list[str] | None = Field(default=None, max_length=30)
    memories: list[str] | None = Field(default=None, max_length=100)
    address_as: str | None = Field(default=None, max_length=120)
    helpful_when: str | None = Field(default=None, max_length=4000)
    avoid: str | None = Field(default=None, max_length=4000)

    @field_validator("traits", "memories")
    @classmethod
    def clean_lists(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else _clean_text_list(value)


class CompanionOut(CompanionValues):
    id: RecordId
    consent_at: datetime
    created_at: datetime
    updated_at: datetime


class MoodCreate(APIModel):
    id: RecordId | None = None
    mood: str = Field(min_length=1, max_length=120)
    score: int | None = Field(default=None, ge=1, le=5)
    note: str | None = Field(default=None, max_length=10000)
    tags: list[str] = Field(default_factory=list, max_length=30)
    context: MoodContext | None = None
    session_id: RecordId | None = None
    created_at: datetime | None = None

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, value: list[str]) -> list[str]:
        return _clean_text_list(value)


class MoodPatch(APIModel):
    mood: str | None = Field(default=None, min_length=1, max_length=120)
    score: int | None = Field(default=None, ge=1, le=5)
    note: str | None = Field(default=None, max_length=10000)
    tags: list[str] | None = Field(default=None, max_length=30)
    context: MoodContext | None = None
    session_id: RecordId | None = None

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else _clean_text_list(value)


class MoodOut(APIModel):
    id: RecordId
    mood: str
    score: int | None = Field(default=None, ge=1, le=5)
    note: str | None = None
    tags: list[str] = Field(default_factory=list)
    context: MoodContext | None = None
    session_id: RecordId | None = None
    created_at: datetime
    updated_at: datetime


class JournalCreate(APIModel):
    id: RecordId | None = None
    title: str | None = Field(default=None, max_length=300)
    body: str = Field(min_length=1, max_length=50000)
    session_id: RecordId | None = None
    created_at: datetime | None = None


class JournalPatch(APIModel):
    title: str | None = Field(default=None, max_length=300)
    body: str | None = Field(default=None, min_length=1, max_length=50000)
    session_id: RecordId | None = None


class JournalOut(APIModel):
    id: RecordId
    title: str | None = None
    body: str
    session_id: RecordId | None = None
    created_at: datetime
    updated_at: datetime


class SessionCreate(APIModel):
    id: RecordId | None = None
    companion_id: RecordId
    kind: SessionKind
    status: SessionStatus = SessionStatus.active
    intention: str | None = Field(default=None, max_length=4000)
    started_at: datetime | None = None
    ended_at: datetime | None = None
    error_message: str | None = Field(default=None, max_length=4000)


class SessionPatch(APIModel):
    status: SessionStatus | None = None
    intention: str | None = Field(default=None, max_length=4000)
    ended_at: datetime | None = None
    error_message: str | None = Field(default=None, max_length=4000)


class SessionOut(APIModel):
    id: RecordId
    companion_id: RecordId
    kind: SessionKind
    status: SessionStatus
    intention: str | None = None
    started_at: datetime
    ended_at: datetime | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class MessageCreate(APIModel):
    id: RecordId | None = None
    role: MessageRole
    content: str = Field(min_length=1, max_length=50000)
    modality: MessageModality = MessageModality.text
    audio_uri: str | None = Field(default=None, max_length=2000)
    voicebox_generation_id: str | None = Field(default=None, max_length=255)
    created_at: datetime | None = None


class MessagePatch(APIModel):
    content: str | None = Field(default=None, min_length=1, max_length=50000)
    modality: MessageModality | None = None
    audio_uri: str | None = Field(default=None, max_length=2000)
    voicebox_generation_id: str | None = Field(default=None, max_length=255)


class MessageOut(APIModel):
    id: RecordId
    session_id: RecordId
    role: MessageRole
    content: str
    modality: MessageModality
    audio_uri: str | None = None
    voicebox_generation_id: str | None = None
    created_at: datetime
    updated_at: datetime


class ChatRequest(APIModel):
    companion_id: RecordId
    session_id: RecordId | None = None
    message: str = Field(min_length=1, max_length=50000)
    modality: MessageModality = MessageModality.text


class ChatTurnOut(APIModel):
    session_id: RecordId
    user_message: MessageOut
    assistant_message: MessageOut
    model: str


class VoiceboxProfileCreate(APIModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    language: str = Field(default="en", min_length=2, max_length=20)
    voice_type: str = Field(default="cloned", min_length=1, max_length=50)
    default_engine: str | None = Field(default=None, max_length=120)


class VoiceboxGenerateRequest(APIModel):
    text: str = Field(min_length=1, max_length=10000)
    profile_id: str = Field(min_length=1, max_length=255)
    language: str = Field(default="en", min_length=2, max_length=20)
    engine: str | None = Field(default=None, max_length=120)


class ServiceHealth(APIModel):
    status: Literal["ok", "unavailable"]
    detail: str | None = None
    model: str | None = None


class HealthOut(APIModel):
    status: Literal["ok", "degraded"]
    database: ServiceHealth
    groq: ServiceHealth
    voicebox: ServiceHealth


class ErrorBody(APIModel):
    service: str
    code: str
    message: str
    upstream_status: int | None = None


class ErrorEnvelope(APIModel):
    error: ErrorBody
