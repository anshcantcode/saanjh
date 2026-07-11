from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


def _positive_float(name: str, default: float) -> float:
    raw = os.getenv(name, str(default)).strip()
    try:
        value = float(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a number.") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be greater than zero.")
    return value


def _positive_int(name: str, default: int) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer.") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be greater than zero.")
    return value


def _database_path() -> Path:
    raw = os.getenv("DATABASE_PATH", "./saanjh.db").strip()
    path = Path(raw).expanduser()
    return path if path.is_absolute() else (BACKEND_DIR / path).resolve()


def _origins() -> tuple[str, ...]:
    raw = os.getenv("CORS_ORIGINS", "*")
    values = tuple(value.strip().rstrip("/") for value in raw.split(",") if value.strip())
    return values or ("*",)


def _http_url(name: str, required: bool = False) -> str:
    value = os.getenv(name, "").strip().rstrip("/")
    if not value:
        if required:
            raise RuntimeError(f"{name} is required.")
        return ""
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise RuntimeError(f"{name} must be a complete http:// or https:// URL.")
    return value


@dataclass(frozen=True)
class Settings:
    database_path: Path
    cors_origins: tuple[str, ...]
    groq_api_key: str
    groq_model: str
    groq_base_url: str
    groq_timeout_seconds: float
    groq_history_limit: int
    voicebox_url: str
    voicebox_engine: str
    voicebox_timeout_seconds: float
    voicebox_max_upload_bytes: int
    voicebox_max_audio_bytes: int


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        database_path=_database_path(),
        cors_origins=_origins(),
        groq_api_key=os.getenv("GROQ_API_KEY", "").strip(),
        groq_model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip(),
        groq_base_url=_http_url("GROQ_BASE_URL") or "https://api.groq.com/openai/v1",
        groq_timeout_seconds=_positive_float("GROQ_TIMEOUT_SECONDS", 60),
        groq_history_limit=_positive_int("GROQ_HISTORY_LIMIT", 40),
        voicebox_url=_http_url("VOICEBOX_URL"),
        voicebox_engine=os.getenv("VOICEBOX_ENGINE", "").strip(),
        voicebox_timeout_seconds=_positive_float("VOICEBOX_TIMEOUT_SECONDS", 300),
        voicebox_max_upload_bytes=_positive_int("VOICEBOX_MAX_UPLOAD_MB", 50) * 1024 * 1024,
        voicebox_max_audio_bytes=_positive_int("VOICEBOX_MAX_AUDIO_MB", 100) * 1024 * 1024,
    )
