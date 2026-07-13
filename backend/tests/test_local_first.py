from __future__ import annotations

import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, patch


_temp_dir = tempfile.TemporaryDirectory()
os.environ["DATABASE_PATH"] = str(Path(_temp_dir.name) / "test.db")
os.environ["SAANJH_API_TOKEN"] = "test-token-with-more-than-thirty-two-characters"
os.environ["CORS_ORIGINS"] = "*"

from fastapi.testclient import TestClient  # noqa: E402

from app import database as db  # noqa: E402
from app import main  # noqa: E402
from app.upstreams import UpstreamServiceError  # noqa: E402


TOKEN = os.environ["SAANJH_API_TOKEN"]
AUTH = {"Authorization": f"Bearer {TOKEN}"}
BODY = {
    "companion": {
        "name": "A real user-entered name",
        "relationship": "friend",
        "voice_status": "self",
        "consent_acknowledged": True,
        "ai_disclosure_acknowledged": True,
        "traits": ["warm"],
        "memories": [],
    },
    "history": [{"role": "assistant", "content": "An earlier locally stored reply"}],
    "message": "The current message",
}


class LocalFirstApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client_context = TestClient(main.app)
        self.client = self.client_context.__enter__()

    def tearDown(self) -> None:
        self.client_context.__exit__(None, None, None)

    def test_liveness_is_minimal_and_api_requires_bearer(self) -> None:
        self.assertEqual(self.client.get("/livez").json(), {"status": "ok"})
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers["www-authenticate"], "Bearer")
        self.assertEqual(response.json()["error"]["code"], "authentication_required")
        self.assertEqual(self.client.get("/openapi.json").status_code, 401)

    def test_query_token_can_authorize_native_uploads(self) -> None:
        with patch.object(main, "voicebox_multipart", AsyncMock(return_value={"text": "hello"})):
            response = self.client.post(
                f"/api/voicebox/transcribe?access_token={TOKEN}",
                files={"file": ("sample.m4a", b"opaque-local-test-payload", "audio/mp4")},
            )
        self.assertEqual(response.status_code, 200, response.text)

    def test_cors_preflight_does_not_require_bearer(self) -> None:
        response = self.client.options(
            "/api/v1/local/chat",
            headers={
                "Origin": "https://example.test",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["access-control-allow-origin"], "*")

    def test_local_chat_calls_groq_without_persisting_records(self) -> None:
        before = {
            table: db.list_records(table, limit=100, offset=0)
            for table in ("companions", "sessions", "messages", "moods", "journal_entries")
        }
        groq = AsyncMock(return_value="A real upstream response")
        with patch.object(main, "groq_chat", groq):
            response = self.client.post("/api/v1/local/chat", headers=AUTH, json=BODY)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(response.json()["reply"], "A real upstream response")
        sent_messages = groq.await_args.args[1]
        self.assertEqual(sent_messages[-1], {"role": "user", "content": "The current message"})
        after = {
            table: db.list_records(table, limit=100, offset=0)
            for table in ("companions", "sessions", "messages", "moods", "journal_entries")
        }
        self.assertEqual(before, after)

    def test_distress_turn_is_not_sent_upstream(self) -> None:
        body = {**BODY, "message": "I want to kill myself"}
        groq = AsyncMock(return_value="must not be used")
        with patch.object(main, "groq_chat", groq):
            response = self.client.post("/api/v1/local/chat", headers=AUTH, json=body)
        self.assertEqual(response.status_code, 422)
        groq.assert_not_awaited()

    def test_native_profile_upload_forwards_fields_and_returns_profile(self) -> None:
        created = {"id": "profile-from-voicebox", "name": "User supplied name"}
        create = AsyncMock(return_value=created)
        attach = AsyncMock(return_value={"status": "attached"})
        readiness = AsyncMock(return_value={"id": "generation-check"})
        with (
            patch.object(main, "_create_voicebox_profile", create),
            patch.object(main, "voicebox_multipart", attach),
            patch.object(main, "voicebox_json", readiness),
        ):
            response = self.client.post(
                "/api/voicebox/profiles/with-sample",
                headers=AUTH,
                data={
                    "name": "User supplied name",
                    "language": "en",
                    "voice_type": "cloned",
                    "reference_text": "Words supplied by the user",
                },
                # Opaque bytes exercise multipart parsing only; no audio leaves the test process.
                files={"file": ("sample.m4a", b"opaque-local-test-payload", "audio/mp4")},
            )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["profile"]["id"], "profile-from-voicebox")
        create.assert_awaited_once()
        attach.assert_awaited_once()
        self.assertEqual(attach.await_args.args[0], "/profiles/profile-from-voicebox/samples")
        self.assertEqual(attach.await_args.kwargs["file_field"], "file")
        self.assertEqual(attach.await_args.kwargs["fields"], {"reference_text": "Words supplied by the user"})
        self.assertRegex(create.await_args.args[0].name, r"^User supplied name - Saanjh [0-9a-f]{10}$")

    def test_failed_sample_registration_rolls_back_new_profile(self) -> None:
        create = AsyncMock(return_value={"profile": {"profile_id": "partial-profile"}})
        attach = AsyncMock(
            side_effect=UpstreamServiceError(
                service="Voicebox",
                code="upstream_http_error",
                message="The sample was rejected.",
                status_code=502,
                upstream_status=422,
            )
        )
        cleanup = AsyncMock(return_value={})
        with (
            patch.object(main, "_create_voicebox_profile", create),
            patch.object(main, "voicebox_multipart", attach),
            patch.object(main, "voicebox_delete_profile", cleanup),
        ):
            response = self.client.post(
                "/api/voicebox/profiles/with-sample",
                headers=AUTH,
                data={
                    "name": "User supplied name",
                    "reference_text": "Words supplied by the user",
                },
                files={"file": ("sample.m4a", b"opaque-local-test-payload", "audio/mp4")},
            )
        self.assertEqual(response.status_code, 502, response.text)
        self.assertEqual(response.json()["error"]["message"], "Voicebox sample attachment failed: The sample was rejected.")
        cleanup.assert_awaited_once_with("partial-profile")

    def test_profile_upload_accepts_nested_voicebox_profile_id(self) -> None:
        create = AsyncMock(return_value={"data": {"voice_id": "nested-profile-id", "name": "User supplied name"}})
        attach = AsyncMock(return_value={"status": "attached"})
        readiness = AsyncMock(return_value={"id": "generation-check"})
        with (
            patch.object(main, "_create_voicebox_profile", create),
            patch.object(main, "voicebox_multipart", attach),
            patch.object(main, "voicebox_json", readiness),
        ):
            response = self.client.post(
                "/api/voicebox/profiles/with-sample",
                headers=AUTH,
                data={
                    "name": "User supplied name",
                    "reference_text": "Words supplied by the user",
                },
                files={"file": ("sample.m4a", b"opaque-local-test-payload", "audio/mp4")},
            )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(attach.await_args.args[0], "/profiles/nested-profile-id/samples")

    def test_sample_attachment_retries_voicebox_field_variants(self) -> None:
        create = AsyncMock(return_value={"id": "profile-from-voicebox"})
        attach = AsyncMock(
            side_effect=[
                UpstreamServiceError(
                    service="Voicebox",
                    code="upstream_http_error",
                    message="Missing audio field.",
                    status_code=502,
                    upstream_status=422,
                ),
                {"status": "attached"},
            ]
        )
        readiness = AsyncMock(return_value={"id": "generation-check"})
        with (
            patch.object(main, "_create_voicebox_profile", create),
            patch.object(main, "voicebox_multipart", attach),
            patch.object(main, "voicebox_json", readiness),
        ):
            response = self.client.post(
                "/api/voicebox/profiles/with-sample",
                headers=AUTH,
                data={
                    "name": "User supplied name",
                    "reference_text": "Words supplied by the user",
                },
                files={"file": ("sample.m4a", b"opaque-local-test-payload", "audio/mp4")},
            )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(attach.await_count, 2)
        self.assertEqual(attach.await_args_list[0].kwargs["file_field"], "file")
        self.assertEqual(attach.await_args_list[1].kwargs["file_field"], "audio")

    def test_profile_upload_rejects_short_prompt_during_setup_and_cleans_up(self) -> None:
        create = AsyncMock(return_value={"id": "profile-short"})
        attach = AsyncMock(return_value={"status": "attached"})
        readiness = AsyncMock(
            side_effect=UpstreamServiceError(
                service="Voicebox",
                code="generation_failed",
                message="Audio prompt must be longer than 5 seconds!",
                status_code=502,
            )
        )
        cleanup = AsyncMock(return_value={})
        with (
            patch.object(main, "_create_voicebox_profile", create),
            patch.object(main, "_attach_voicebox_sample", attach),
            patch.object(main, "voicebox_json", readiness),
            patch.object(main, "voicebox_delete_profile", cleanup),
        ):
            response = self.client.post(
                "/api/voicebox/profiles/with-sample",
                headers=AUTH,
                data={
                    "name": "User supplied name",
                    "reference_text": "too short",
                },
                files={"file": ("sample.m4a", b"opaque-local-test-payload", "audio/mp4")},
            )
        self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(response.json()["error"]["code"], "sample_too_short")
        cleanup.assert_awaited_once_with("profile-short")

    def test_generation_accepts_alternate_voicebox_job_shape(self) -> None:
        voicebox = AsyncMock(return_value={"job": {"task_id": "job-123", "state": "succeeded", "output_path": "voice.wav"}})
        with patch.object(main, "voicebox_json", voicebox):
            response = self.client.post(
                "/api/voicebox/generate",
                headers=AUTH,
                json={"text": "Hello there", "profile_id": "profile-123"},
            )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["job"]["generation_id"], "job-123")
        self.assertEqual(response.json()["job"]["audio_url"], "/api/voicebox/audio/job-123")


if __name__ == "__main__":
    unittest.main()
