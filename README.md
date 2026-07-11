# Saanjh web and Android prototype

Saanjh is now a responsive web app with a real FastAPI backend. The browser never calls Groq or Voicebox directly: it talks to one local API, while secrets, voice-engine access, consent metadata, conversations, moods, and journal entries stay on the backend.

The app starts genuinely empty. It does not seed a companion, sample memories, chat messages, moods, sessions, or journal entries. Every personal item shown in the interface comes from user input or a live service response.

## Primary project

- `web/` — React, TypeScript, and Vite frontend.
- `backend/` — FastAPI, SQLite, server-side Groq, and a Voicebox gateway.
- `assets/` — original generated botanical artwork used by the earlier Expo prototype.
- `docs/EXPO_PROTOTYPE.md` — preserved documentation for the previous mobile-first build.

The root Expo source remains available as a future mobile client, but the web app is now the primary development target.

## 1. Configure and run the backend

Voicebox should be running on this computer at `http://127.0.0.1:17493`. Its desktop Settings screen may show an old or mistyped port; Saanjh uses the current Voicebox default, `17493`.

From `backend/`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Open `backend/.env` and add:

```dotenv
GROQ_API_KEY=gsk_your_real_key_here
VOICEBOX_URL=http://127.0.0.1:17493
```

Then start the API:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Useful endpoints:

- API health: `http://127.0.0.1:8000/api/health`
- Interactive API documentation: `http://127.0.0.1:8000/docs`

Voicebox can be healthy while Groq is shown as unconfigured. Chat becomes live after `GROQ_API_KEY` is saved and the backend is restarted.

## 2. Run the web app

In another terminal, from the repository root:

```powershell
npm --prefix web install
npm start
```

Vite normally opens `http://127.0.0.1:5173`. If that port is already occupied, it selects the next available port and prints it in the terminal.

For a production build:

```powershell
npm run build
```

The frontend defaults to `http://127.0.0.1:8000`. Set `VITE_API_URL` at build time when the backend is hosted elsewhere.

## What works

- Consent-first companion setup for self, living-person consent, or memorial use.
- Browser microphone recording and real audio upload with the actual media MIME type.
- Voicebox profile creation, sample upload, transcription, generation-status polling, and backend-streamed audio.
- Groq chat using the server-side key and a safety-focused companion prompt.
- Turn-based voice sessions: record, transcribe, respond, synthesize, and play.
- Real moods, journals, session history, and approved memories in SQLite.
- Remote-first cloned-profile deletion so local metadata is retained if Voicebox cleanup fails.
- AI and memorial disclosures throughout the experience.
- Mobile and desktop layouts, ambient motion, and reduced-motion support.
- Tap-to-play recovery when the browser blocks automatic generated-audio playback.

## Asset loading

The eight interface artworks are served from `web/public/assets` as optimized WebP files. Their combined size is about 1.2 MB, down from roughly 20.5 MB of source PNGs. Run this after replacing any source artwork copied into the web folder:

```powershell
npm --prefix web run assets:optimize
```

## Prototype boundaries

- There is no login yet; this is a local, single-user prototype.
- SQLite and Voicebox storage are not claimed to be production-encrypted.
- A public deployment needs authentication, HTTPS, rate limits, restricted CORS, and protected Voicebox access.
- Saanjh is an AI companion, not a clinician or a real person. It must not encourage dependency or claim to communicate as a deceased person.

## Android app

The native Expo client uses the same FastAPI gateway as the web app. Groq and Voicebox credentials stay in `backend/.env`; they are never placed in the APK. Set only the public, non-secret gateway address before starting or building:

```powershell
$env:EXPO_PUBLIC_API_URL='https://your-saanjh-api.example'
npm run expo:android
```

Useful Android commands:

```powershell
npm run typecheck:expo
npm run config:expo
npm run android:build:preview
npm run android:build:production
```

- `preview` produces an installable APK for private testing.
- `production` produces an Android App Bundle for Play distribution.
- The Android application ID is `com.saanjh.companion`.

For emulator-only local development, `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000` reaches a backend running on the host computer. A physical phone on another network requires a deployed HTTPS gateway. Voicebox must remain private behind FastAPI; never expose port `17493` directly.

Before placing the gateway on the public internet, add authentication, rate limiting, restricted CORS, encrypted transport/storage, and user ownership. The current no-login backend is intentionally a single-user prototype and is not safe to expose as-is.
