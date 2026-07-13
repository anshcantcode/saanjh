# Troubleshooting

## Start with the three local checks

1. Voicebox desktop is running and `http://127.0.0.1:17493/health` responds on the backend PC.
2. FastAPI is running and `http://127.0.0.1:8000/livez` responds.
3. The app points to the HTTPS FastAPI address, not to Voicebox, `127.0.0.1`, or a stale temporary tunnel.

When a request fails, read the FastAPI terminal line beginning with `Saanjh upstream error`. It contains the real Voicebox/Groq cause behind the stable client error.

## `401 Unauthorized`

- Confirm `SAANJH_API_TOKEN` in `backend/.env` matches the app's saved private connection key.
- Restart FastAPI after changing the backend `.env`.
- For a private build with automatic bootstrap, set `SAANJH_API_ACCESS_TOKEN` only in an ignored local `.env` or EAS secret before building.
- Do not expect a newly changed token to work in an already-installed APK that compiled the old value.

## Voicebox is online but cloning or generation fails

The health endpoint proves reachability, not profile/sample validity. Check the structured backend error for:

- an invalid or too-short sample;
- an unsupported audio format or mismatched transcript;
- a missing/deleted Voicebox profile;
- a model that has not loaded;
- GPU memory pressure;
- an upstream 400 response.

Saanjh creates a hidden unique remote profile name, so two user-facing companions can share the same display name.

## “Audio prompt must be longer than 5 seconds”

Record or import at least six seconds of clear, single-speaker audio. Avoid music, heavy reverb, long silence, or another voice. The transcript must match the spoken words exactly.

The Android app rejects a known short recording before cloning; the backend performs an additional readiness check for imported media whose duration is not available to the picker.

## Transcription works but speech generation is slow

Voicebox may need to load a multi-gigabyte model on the first request. Keep Voicebox open, keep the backend PC awake, close other GPU-heavy applications, and use the configured `chatterbox_turbo` engine when available.

Saanjh shows the current stage and elapsed time and lets the user cancel a pending generation. A truthful stage indicator is used instead of a fabricated percentage because Voicebox does not expose reliable percent-complete progress.

## Phone cannot reach the backend

- A phone cannot use the backend PC's `127.0.0.1`.
- On a trusted local network, start FastAPI with `--host 0.0.0.0` and use the PC's private IP only for development.
- For another network, use a stable HTTPS tunnel or hosted gateway.
- Keep Voicebox private on loopback and expose only FastAPI.
- Temporary tunnel hostnames change after restart; do not compile them into release builds.

See [deploy/ANYWHERE_NETWORK.md](../deploy/ANYWHERE_NETWORK.md).

## Groq reports unconfigured

Set `GROQ_API_KEY` in `backend/.env` and restart FastAPI. The mobile app never reads this key.

## Web assets do not load

Run:

```powershell
npm --prefix web run assets:optimize
npm run build
```

The web app serves optimized WebP files from `web/public/assets`. The Android app bundles its own assets through Expo.
