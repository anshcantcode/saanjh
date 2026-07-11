from __future__ import annotations

from dataclasses import dataclass
from typing import Any, AsyncIterator, Mapping, Sequence
from urllib.parse import quote, urlparse

import httpx

from .config import get_settings


@dataclass
class UpstreamServiceError(Exception):
    service: str
    code: str
    message: str
    status_code: int = 502
    upstream_status: int | None = None

    def __str__(self) -> str:
        return self.message


def _message(payload: Any) -> str | None:
    if isinstance(payload, str) and payload.strip():
        return payload.strip()[:500]
    if isinstance(payload, Sequence) and not isinstance(payload, (str, bytes, bytearray)):
        messages = [message for item in payload if (message := _message(item))]
        return " • ".join(messages)[:500] if messages else None
    if not isinstance(payload, dict):
        return None
    validation_message = payload.get("msg")
    if isinstance(validation_message, str) and validation_message.strip():
        location = payload.get("loc")
        if isinstance(location, Sequence) and not isinstance(location, (str, bytes, bytearray)):
            path = ".".join(str(part) for part in location if part != "body")
            return f"{path}: {validation_message.strip()}"[:500] if path else validation_message.strip()[:500]
        return validation_message.strip()[:500]
    for key in ("message", "detail", "error", "reason"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()[:500]
        nested = _message(value)
        if nested:
            return nested
    return None


def _json(response: httpx.Response, service: str) -> Any:
    if not response.content:
        return {}
    try:
        return response.json()
    except ValueError as exc:
        raise UpstreamServiceError(
            service=service,
            code="invalid_response",
            message=f"{service} returned a non-JSON response.",
            upstream_status=response.status_code,
        ) from exc


async def _request_json(
    *,
    service: str,
    method: str,
    url: str,
    timeout: float,
    headers: Mapping[str, str] | None = None,
    json_body: Mapping[str, Any] | None = None,
) -> Any:
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False, trust_env=False) as client:
            response = await client.request(method, url, headers=headers, json=json_body)
    except httpx.TimeoutException as exc:
        raise UpstreamServiceError(
            service=service,
            code="timeout",
            message=f"{service} did not respond within {timeout:g} seconds.",
            status_code=504,
        ) from exc
    except httpx.RequestError as exc:
        raise UpstreamServiceError(
            service=service,
            code="unreachable",
            message=f"Could not reach {service}. Check its configured URL and network access.",
        ) from exc

    payload = _json(response, service)
    if not response.is_success:
        if response.status_code in {401, 403}:
            code = "authentication_failed"
        elif response.status_code == 404:
            code = "not_found"
        elif response.status_code == 429:
            code = "rate_limited"
        else:
            code = "upstream_http_error"
        raise UpstreamServiceError(
            service=service,
            code=code,
            message=_message(payload) or f"{service} returned HTTP {response.status_code}.",
            status_code=502 if response.status_code < 500 else 503,
            upstream_status=response.status_code,
        )
    return payload


def _voicebox_url(path: str) -> str:
    settings = get_settings()
    if not settings.voicebox_url:
        raise UpstreamServiceError(
            service="Voicebox",
            code="not_configured",
            message="VOICEBOX_URL is not configured on the backend.",
            status_code=503,
        )
    parsed = urlparse(settings.voicebox_url)
    if parsed.port == 17943:
        raise UpstreamServiceError(
            service="Voicebox",
            code="wrong_port",
            message="VOICEBOX_URL uses port 17943; Voicebox normally listens on port 17493.",
            status_code=503,
        )
    return f"{settings.voicebox_url}/{path.lstrip('/')}"


async def voicebox_json(method: str, path: str, body: Mapping[str, Any] | None = None) -> Any:
    settings = get_settings()
    return await _request_json(
        service="Voicebox",
        method=method,
        url=_voicebox_url(path),
        timeout=settings.voicebox_timeout_seconds,
        headers={"Accept": "application/json"},
        json_body=body,
    )


async def voicebox_multipart(
    path: str,
    *,
    filename: str,
    content: bytes,
    content_type: str,
    fields: Mapping[str, str] | None = None,
) -> Any:
    settings = get_settings()
    try:
        async with httpx.AsyncClient(
            timeout=settings.voicebox_timeout_seconds,
            follow_redirects=False,
            trust_env=False,
        ) as client:
            response = await client.post(
                _voicebox_url(path),
                headers={"Accept": "application/json"},
                data=dict(fields or {}),
                files={"file": (filename, content, content_type)},
            )
    except httpx.TimeoutException as exc:
        raise UpstreamServiceError(
            service="Voicebox",
            code="timeout",
            message=f"Voicebox did not respond within {settings.voicebox_timeout_seconds:g} seconds.",
            status_code=504,
        ) from exc
    except httpx.RequestError as exc:
        raise UpstreamServiceError(
            service="Voicebox",
            code="unreachable",
            message="Could not reach Voicebox. Check VOICEBOX_URL and network access.",
        ) from exc

    payload = _json(response, "Voicebox")
    if not response.is_success:
        raise UpstreamServiceError(
            service="Voicebox",
            code="upstream_http_error",
            message=_message(payload) or f"Voicebox returned HTTP {response.status_code}.",
            status_code=502 if response.status_code < 500 else 503,
            upstream_status=response.status_code,
        )
    return payload


class VoiceboxAudioStream:
    def __init__(self, client: httpx.AsyncClient, response: httpx.Response, max_bytes: int) -> None:
        self.client = client
        self.response = response
        self.max_bytes = max_bytes

    @property
    def media_type(self) -> str:
        return self.response.headers.get("content-type", "application/octet-stream").split(";", 1)[0].strip()

    @property
    def content_length(self) -> str | None:
        return self.response.headers.get("content-length")

    async def chunks(self) -> AsyncIterator[bytes]:
        sent = 0
        try:
            async for chunk in self.response.aiter_bytes(64 * 1024):
                sent += len(chunk)
                if sent > self.max_bytes:
                    raise RuntimeError("Voicebox audio exceeded the configured response size limit.")
                yield chunk
        finally:
            await self.response.aclose()
            await self.client.aclose()

    async def close(self) -> None:
        await self.response.aclose()
        await self.client.aclose()


async def open_voicebox_audio(generation_id: str) -> VoiceboxAudioStream:
    settings = get_settings()
    client = httpx.AsyncClient(
        timeout=settings.voicebox_timeout_seconds,
        follow_redirects=False,
        trust_env=False,
    )
    try:
        request = client.build_request(
            "GET",
            _voicebox_url(f"/audio/{quote(generation_id, safe='')}"),
            headers={"Accept": "audio/*, application/octet-stream"},
        )
        response = await client.send(request, stream=True)
    except httpx.TimeoutException as exc:
        await client.aclose()
        raise UpstreamServiceError(
            service="Voicebox",
            code="timeout",
            message=f"Voicebox did not return audio within {settings.voicebox_timeout_seconds:g} seconds.",
            status_code=504,
        ) from exc
    except httpx.RequestError as exc:
        await client.aclose()
        raise UpstreamServiceError(
            service="Voicebox",
            code="unreachable",
            message="Could not reach Voicebox for generated audio.",
        ) from exc

    if not response.is_success:
        raw = bytearray()
        async for chunk in response.aiter_bytes():
            raw.extend(chunk)
            if len(raw) >= 64 * 1024:
                break
        await response.aclose()
        await client.aclose()
        text = bytes(raw).decode("utf-8", errors="replace")
        try:
            payload: Any = httpx.Response(200, content=text).json()
        except ValueError:
            payload = text
        raise UpstreamServiceError(
            service="Voicebox",
            code="audio_not_available" if response.status_code == 404 else "upstream_http_error",
            message=_message(payload) or f"Voicebox returned HTTP {response.status_code} for audio.",
            status_code=404 if response.status_code == 404 else 502,
            upstream_status=response.status_code,
        )

    media_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if not (media_type.startswith("audio/") or media_type == "application/octet-stream"):
        await response.aclose()
        await client.aclose()
        raise UpstreamServiceError(
            service="Voicebox",
            code="invalid_audio_response",
            message="Voicebox returned a non-audio response for the generated audio endpoint.",
        )

    content_length = response.headers.get("content-length")
    if content_length:
        try:
            too_large = int(content_length) > settings.voicebox_max_audio_bytes
        except ValueError:
            too_large = False
        if too_large:
            await response.aclose()
            await client.aclose()
            raise UpstreamServiceError(
                service="Voicebox",
                code="audio_too_large",
                message="Generated audio exceeds the configured proxy response limit.",
                status_code=413,
            )
    return VoiceboxAudioStream(client, response, settings.voicebox_max_audio_bytes)


async def voicebox_delete_profile(profile_id: str) -> Any:
    return await voicebox_json("DELETE", f"/profiles/{quote(profile_id, safe='')}")


def _groq_headers() -> dict[str, str]:
    settings = get_settings()
    if not settings.groq_api_key:
        raise UpstreamServiceError(
            service="Groq",
            code="not_configured",
            message="GROQ_API_KEY is not configured on the backend.",
            status_code=503,
        )
    if not settings.groq_model:
        raise UpstreamServiceError(
            service="Groq",
            code="model_not_configured",
            message="GROQ_MODEL is not configured on the backend.",
            status_code=503,
        )
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.groq_api_key}",
    }


async def groq_health() -> dict[str, Any]:
    settings = get_settings()
    payload = await _request_json(
        service="Groq",
        method="GET",
        url=f"{settings.groq_base_url}/models",
        timeout=settings.groq_timeout_seconds,
        headers=_groq_headers(),
    )
    models = payload.get("data") if isinstance(payload, dict) else None
    available = isinstance(models, list) and any(
        isinstance(item, dict) and item.get("id") == settings.groq_model for item in models
    )
    if not available:
        raise UpstreamServiceError(
            service="Groq",
            code="model_unavailable",
            message=f"Groq did not list the configured model '{settings.groq_model}' for this key.",
            status_code=503,
        )
    return {"status": "ok", "model": settings.groq_model}


async def groq_chat(system_prompt: str, messages: Sequence[Mapping[str, str]]) -> str:
    settings = get_settings()
    payload = await _request_json(
        service="Groq",
        method="POST",
        url=f"{settings.groq_base_url}/chat/completions",
        timeout=settings.groq_timeout_seconds,
        headers=_groq_headers(),
        json_body={
            "model": settings.groq_model,
            "temperature": 0.65,
            "max_completion_tokens": 220,
            "messages": [{"role": "system", "content": system_prompt}, *messages],
        },
    )
    try:
        content = payload["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError, AttributeError) as exc:
        raise UpstreamServiceError(
            service="Groq",
            code="invalid_response",
            message="Groq returned no assistant message.",
        ) from exc
    if not content:
        raise UpstreamServiceError(
            service="Groq",
            code="empty_response",
            message="Groq returned an empty assistant message.",
        )
    return content
