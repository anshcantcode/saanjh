# Historical Expo prototype notes

> **Archive notice:** This document describes an earlier client-only architecture and is kept for design/provenance context. It is not the current setup guide. The active Android app now uses the FastAPI gateway, Groq, Voicebox, local-first storage, and the commands documented in the root [README](../README.md).

Saanjh is an Expo prototype for a **clearly disclosed AI voice companion**. It can create a consent-gated companion profile, turn recorded speech into text, ask Groq for a safety-prompted reply, and render that reply through a locally hosted cloned voice.

> [!IMPORTANT]
> Saanjh is not a person, a recreation of a person, a therapist, a medical device, or an emergency service. It must remain visibly identified as AI. If someone may be in immediate danger, contact local emergency services and a trusted person nearby rather than relying on this prototype.

This repository contains the Expo client only. Voice synthesis and transcription come from [jamiepine/voicebox v0.5.0](https://github.com/jamiepine/voicebox/releases/tag/v0.5.0), and conversational replies use Groq's API at `https://api.groq.com/openai/v1`.

## Product and safety position

The product goal is a supportive tool, not a substitute for a relationship. The app therefore:

- identifies the companion and every voice session as AI-generated;
- never claims that a memorial companion is the deceased person or is communicating on their behalf;
- creates no demo companion, fake journal entry, fake memory, or canned voice response;
- saves only memories the user explicitly enters or approves;
- tells the language model not to seek exclusivity, dependency, romance, or withdrawal from real people;
- offers direct offline-help language when a small local distress phrase matcher is triggered; and
- fails visibly when Voicebox or Groq is unavailable instead of silently substituting generated demo data.

The phrase matcher and system prompt are guardrails, not reliable crisis detection. A production wellness product requires professional safety review, regional crisis resources, abuse testing, monitoring, and a server-side policy layer.

## Prototype features

- No login; first-run state is stored on the device.
- Create one companion with a name, relationship, support style, boundaries, and user-approved memories.
- Choose a self voice, a living adult's voice with explicit informed consent, or a deceased person's voice with recorded legal/ethical authority and an explicit AI memorial label.
- Record or import a reference sample, transcribe it, review its text, move it out of temporary storage, create a Voicebox profile, and attach the sample.
- Configure and test a Voicebox server, Groq API key, and Groq model inside the app.
- Text chat and turn-based voice sessions using real service responses.
- Optional before/after mood check-ins, journal entries, session intentions, aftercare, and a reduced-motion preference.
- Delete the linked Voicebox profile before local companion data, with a retry queue for interrupted profile creation.

## How a voice turn works

```text
User records and stops
  -> Voicebox transcribes the audio
  -> the configured chat model creates a safety-prompted reply
  -> Voicebox generates cloned speech
  -> Saanjh polls until the file is ready and plays it
```

This is deliberately **turn-based**, not a true full-duplex phone call. The prototype does not provide continuous streaming recognition, barge-in, interruption, simultaneous listening/playback, or low-latency WebRTC. Voicebox v0.5 prepares a generation before the app retrieves its audio; true duplex calling would need VAD, streaming ASR, a streaming policy/LLM layer, cancellable streaming TTS, and WebRTC or WebSocket transport.

## Requirements

- A current Node.js LTS release and npm.
- Expo Go compatible with Expo SDK 57, or an Android/iOS simulator.
- For Android emulation: Android Studio and a configured emulator.
- For an iOS simulator: macOS and Xcode. Windows cannot run the iOS Simulator; use Expo Go on a physical iPhone instead.
- A separate Voicebox v0.5 host. GPU acceleration is strongly recommended.
- A Groq API key. The app defaults to the production model `llama-3.1-8b-instant`; no key or credits are bundled.

The client uses [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), React Native 0.86, React 19.2.3, and TypeScript 6.0.

## Install and run Saanjh

```bash
npm install
npm run typecheck
npm start
```

`npm start` opens Expo's development server. Scan the QR code with Expo Go, or use one of the direct scripts:

```bash
npm run web
npm run android
npm run ios
```

- `npm run web` starts the Metro web build.
- `npm run android` opens a configured Android emulator or connected Android device.
- `npm run ios` opens the iOS Simulator and therefore requires macOS/Xcode.

For a physical phone, keep the phone and development computer on the same trusted Wi-Fi network. Grant microphone access only when the app asks to record a sample or a conversation turn.

## Install and run Voicebox v0.5 locally

Voicebox is a separate MIT-licensed project; it is not Meta FAIR's unreleased Voicebox model. The instructions below pin the tested API surface to `v0.5.0`.

Install Git, Python 3.11 or newer, and [`just`](https://github.com/casey/just). The full Voicebox developer setup also uses Bun and the platform prerequisites listed in the [Voicebox repository](https://github.com/jamiepine/voicebox).

```bash
git clone https://github.com/jamiepine/voicebox.git
cd voicebox
git checkout v0.5.0
just setup
```

For a loopback-only check on the same computer:

```bash
just dev-backend
```

For a physical phone, stop that loopback server and bind the FastAPI backend to the trusted LAN:

```powershell
# Windows PowerShell, from the Voicebox repository
.\backend\venv\Scripts\python.exe -m backend.main --host 0.0.0.0 --port 17493
```

```bash
# macOS/Linux, from the Voicebox repository
./backend/venv/bin/python -m backend.main --host 0.0.0.0 --port 17493
```

If the checkout created its virtual environment at a different path, activate that environment and run the same module command:

```bash
python -m backend.main --host 0.0.0.0 --port 17493
```

Voicebox creates its SQLite/data directories on first run. Speech and transcription models download from Hugging Face on first use, so the first request can be slow and can require several gigabytes of disk space. Choose or download a cloning-capable engine in Voicebox before testing Saanjh. `chatterbox_turbo` is a practical lower-latency English option; `chatterbox` supports multilingual use, including Hindi. Enter the exact installed engine identifier in Saanjh.

Check the server on its host:

```text
http://127.0.0.1:17493/health
http://127.0.0.1:17493/docs
```

## Connect a phone over a trusted LAN

1. Find the Voicebox computer's private IPv4 address (`ipconfig` on Windows or `ip addr`/`ifconfig` on macOS/Linux), for example `192.168.1.24`.
2. Keep the computer and phone on the same private Wi-Fi network. Guest Wi-Fi often blocks device-to-device traffic.
3. Allow inbound TCP port `17493` in the computer firewall for **private networks only**.
4. Open `http://192.168.1.24:17493/health` in the phone's browser.
5. In Saanjh's connection settings, enter `http://192.168.1.24:17493` as the Voicebox URL and the installed engine name.
6. Enter a Groq API key, keep or change the Groq model, then test both services.

Do not enter `0.0.0.0` in the app; that is only a server bind address. On a physical phone, `127.0.0.1` and `localhost` point to the phone, not the development computer. A same-computer web build or iOS Simulator can use `http://127.0.0.1:17493`; the standard Android emulator normally reaches the host at `http://10.0.2.2:17493`.

During `npm run web`, same-computer loopback requests are routed through a loopback-only Metro development proxy at `/voicebox-proxy`. This avoids Voicebox's restricted browser CORS origins without exposing the proxy to other LAN devices. Static web exports do not include that development proxy; use the native app or an authenticated reverse proxy for deployed web builds.

Voicebox v0.5 does **not** authenticate REST requests. Never port-forward port `17493`, expose it to the public internet, or use it over untrusted/public Wi-Fi. For anything beyond local development, place it behind a VPN or an authenticated HTTPS reverse proxy and restrict firewall access.

## Groq connection

Saanjh does not read service credentials from environment variables. These values are entered in the app and persisted locally:

- Voicebox base URL and engine;
- Groq model; and
- required Groq API key.

The Groq base URL is fixed to `https://api.groq.com/openai/v1`. Saanjh checks `GET /models`, confirms the selected model is available for the key, and sends replies through `POST /chat/completions`. Groq receives the current conversation, companion configuration, user-approved memories, and safety system prompt. Review Groq's retention and privacy terms before sending sensitive material.

## Exact Voicebox API scope

Saanjh uses only the following REST endpoints from Voicebox v0.5:

| Method and path | Purpose in Saanjh |
| --- | --- |
| `GET /health` | Test that the configured server is reachable. |
| `GET /profiles` | Read available Voicebox profiles. |
| `POST /profiles` | Create a cloned profile with `name`, `language`, and `voice_type`. |
| `POST /transcribe` | Transcribe a recorded/imported turn. Saanjh sends multipart field `file`; the v0.5 server's default transcription model is used. |
| `POST /profiles/{profileId}/samples` | Attach multipart `file` plus the user-reviewed `reference_text`. |
| `DELETE /profiles/{profileId}` | Delete the linked profile, its uploaded samples, and profile-linked generations when the user deletes the companion. |
| `POST /generate` | Submit `text`, `profile_id`, `engine`, and **`personality: false`**. |
| `GET /history/{generationId}` | Poll once per second for `completed` or `failed`, for up to 120 seconds. |
| `GET /audio/{generationId}` | Retrieve and play the completed generated audio. |

`personality: false` is intentional: Groq has already produced the safety-prompted final reply. Voicebox must synthesize that text rather than apply a second, uncontrolled personality rewrite.

The app does not use Voicebox's MCP server, `/speak`, model-management endpoints, status SSE endpoint, or admin APIs. **Delete companion and cloned profile** first attempts `DELETE /profiles/{id}`, then clears the local companion. If the Voicebox host is unavailable, Saanjh reports that remote deletion still needs attention. The separate **Reset all local data** action intentionally clears only this device, so delete the companion first when a remote profile exists.

## Consent rules

Only use a voice when all of the following are true:

- **Your own voice:** you understand that the sample will be used to synthesize new speech and can delete it later.
- **Living person:** the speaker is an adult able to consent, gave explicit informed and revocable permission for this specific app and purpose, and understands that generated speech may say words they never recorded.
- **Deceased person / memorial:** you have the legal right and ethical authority to use the recording, record that basis during setup, and keep every experience labelled as an “AI memorial voice inspired by …”. A living but unavailable person must use the living-person consent path; absence is not consent. The app must never imply survival, consciousness, a message from beyond death, or literal identity.

Never use Saanjh to clone a minor, a person unable to consent, a public figure, a stranger, or anyone who refused or revoked consent. Never use it for fraud, authentication, harassment, sexual content, political persuasion, evidence, or deceptive impersonation. Stop use and delete the app and Voicebox data if consent is withdrawn.

The current consent record is a local prototype acknowledgment, not identity verification, legal proof, or a complete revocation system. Production use needs auditable consent evidence, expiry/reconfirmation, server-side enforcement, and reliable deletion across every copy and backup.

## Privacy and known limitations

- `AsyncStorage` is **not encrypted**. The companion profile, consent metadata, mood entries, journal, session history, remote-cleanup queue, service URLs, model name, and chat API key are stored as local JSON under `@saanjh/app-data/v1`. On web, the saved reference sample/avatar are data URIs in the same local store and media over 10 MB is rejected; the native app is the recommended prototype target.
- Do not put a valuable production API key into this prototype or use it on a shared/untrusted device. A production app should keep provider credentials behind its own authenticated backend and store device secrets in secure keychain/keystore storage.
- The native app copies the chosen reference sample/avatar into its document storage so “connect later” survives cache cleanup. Voicebox also keeps uploaded samples, voice profiles, SQLite data, model cache, and generated audio on its host. Deleting a linked companion first deletes its remote profile; if that fails, local data and the remote ID are kept for retry.
- Conversation text and configured memories are sent to Groq, so that data leaves the local network.
- Voicebox has no built-in REST authentication. LAN HTTP traffic is not encrypted.
- The app has no bundled LLM/chat model and cannot converse until a valid Groq key is configured.
- Voicebox is speech infrastructure, not the companion's “brain,” and does not enforce consent or wellness policy.
- The voice session is turn-based and may take seconds or longer per response, especially during a first model download or on CPU.
- Distress matching is a small heuristic and can miss danger or trigger incorrectly. It is not a substitute for human review or emergency support.
- The prototype is not hardened for production privacy, legal compliance, abuse prevention, backups, multi-user isolation, accessibility certification, or clinical use.

## Troubleshooting

### The phone cannot reach Voicebox

- Open `/health` in the phone browser first.
- Confirm the port is `17493`, not `17943`.
- Replace `localhost` with the computer's private LAN IPv4 address.
- Confirm both devices are on the same non-guest Wi-Fi.
- In the Voicebox desktop settings, enable **Allow network access** and restart Voicebox. For a manual backend, bind it to `0.0.0.0`.
- Allow TCP `17493` through the private-network firewall only.
- Disable VPN/client-isolation temporarily for diagnosis; do not expose the server publicly.

### Voicebox health works, but cloning or generation fails

- Verify that the engine entered in Saanjh exists and is cloning-capable.
- Let Voicebox finish its first model download, then retry.
- Check the Voicebox terminal and `http://127.0.0.1:17493/docs` for the actual server error.
- Confirm the profile has a sample and the reviewed reference text matches the recording.
- Prefer a clean WAV or M4A sample with one speaker and little noise. Voicebox accepts common formats and caps sample uploads at 50 MB.
- If generation exceeds the app's 120-second wait, pre-load a smaller model or use GPU acceleration.

### `/transcribe` returns 422

Use Voicebox `v0.5.0`. Saanjh sends the multipart field as `file`, matching the v0.5 route used by this integration. Some older examples use `audio` and are not the contract for this client.

### The Groq connection test fails

- Create a key at `https://console.groq.com/keys` and paste the complete `gsk_…` value.
- Recheck the model identifier. The default is `llama-3.1-8b-instant`; Groq can retire models over time.
- Confirm this device has internet access and that a VPN/firewall is not blocking `api.groq.com`.
- A `401` means Groq rejected the key. A model-list error means the selected model is unavailable for that account.

### Microphone or playback does not work

- Grant microphone permission in system settings and restart the session.
- Stop other apps holding the microphone/audio route.
- On iOS, check the current output route and silent/Bluetooth state.
- Native permission/config changes may require rebuilding the native development app; Expo Go does not apply every project-level native setting.

### iOS will not launch from Windows

The iOS Simulator requires macOS/Xcode. Run `npm start` and scan the QR code with Expo Go on a physical iPhone instead.

## Generated asset provenance

The botanical, non-human artwork in `assets/` was generated specifically for this prototype with OpenAI image generation in July 2026:

- `assets/welcome-forest.png` — misty evergreen welcome artwork;
- `assets/home-forest-path.png` — morning forest-path dashboard hero;
- `assets/consent-botanical.png` — consent and protection illustration;
- `assets/mood-ripples.png` — reflective water mood-check-in artwork;
- `assets/journal-stilllife.png` — journal and tea reflection still life;
- `assets/session-forest-night.png` — moonlit active-session artwork;
- `assets/botanical-emblem.png` — Saanjh botanical emblem, app icon, and fallback avatar;
- `assets/paper-topography.png` — reusable handmade-paper and contour texture.

The artwork does not depict or clone a real person and contains no voice or biometric source material. The user-supplied reference screenshots informed the visual direction but are not bundled in the app. Interface icons remain crisp, accessible vectors from `lucide-react-native`; Playfair Display and Inter are loaded through Expo Google Fonts. Voicebox, downloaded speech models, fonts, and icons retain their own upstream licenses and are not generated assets.

No voice sample, cloned voice, Voicebox model weight, chat model, or chat API key is bundled with this repository.
