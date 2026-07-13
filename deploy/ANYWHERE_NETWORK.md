# Anywhere-network, phone-local-first deployment

This is the safe prototype boundary:

```text
Android phone
  local: companion settings, messages, moods, journals, downloaded audio
  HTTPS + Bearer token
        |
Cloudflare Tunnel (outbound connector; no router port-forward)
        |
FastAPI on 127.0.0.1:8000
  transient: current chat request and bounded client-supplied history
  server secrets: Groq key and Voicebox address
        |
Voicebox on 127.0.0.1:17493 (never public)
  remote minimum: cloned voice profile/sample and generated-audio jobs
```

The phone can keep personal application data local by using `POST /api/v1/local/chat` and storing the returned reply itself. FastAPI does not read or write SQLite for this route. Groq necessarily receives the supplied prompt and bounded history to generate the reply. Voice cloning also necessarily leaves a profile/sample in Voicebox; the phone should store only its returned `profile_id` and explicitly delete the profile when the companion is deleted.

The older `/api/chat`, `/api/companion`, `/api/sessions`, `/api/moods`, and `/api/journal` routes remain database-backed for the web prototype. The Android app should not call those routes in local-first mode.

## 1. Protect the gateway

Generate a long random value and put it only in `backend/.env`:

```dotenv
SAANJH_API_TOKEN=<AT-LEAST-32-RANDOM-CHARACTERS>
CORS_ORIGINS=https://your-web-origin.example
VOICEBOX_URL=http://127.0.0.1:17493
```

Every `/api/*` request must then include the bearer header below. The interactive API documentation and OpenAPI JSON are also protected when the token is enabled.

```http
Authorization: Bearer <THE-SAME-TOKEN>
```

`OPTIONS` remains open for CORS preflight. `/livez` is an intentionally minimal unauthenticated process probe; it reveals no Groq, database, or Voicebox status. `/api/health` is protected.

For a private prototype, enter the token once during a device-pairing/setup step and store it with Android SecureStore. Do not compile it into an `EXPO_PUBLIC_*` value: those values are readable from the APK. Even a shared token in SecureStore is not multi-user authentication and can be recovered from a compromised device. Before public distribution, replace it with per-device registration and short-lived/revocable credentials.

## 2. Run the origin

The simplest Windows setup keeps both processes on this PC:

1. Start Voicebox and verify `http://127.0.0.1:17493/health` locally.
2. From the repository root, start FastAPI on loopback with `npm run api`.
3. Verify `http://127.0.0.1:8000/livez` locally.
4. Keep the PC awake, connected, and running both services.

### Keep FastAPI running automatically on Windows

For the PC-hosted prototype, install the included current-user scheduled task once:

```powershell
npm run api:service:install
```

The task starts when this Windows user signs in, supervises FastAPI, checks `/livez`, and restarts an unresponsive process. It always binds to `127.0.0.1:8000`; it never publishes Voicebox or opens a firewall port. It also refuses installation until `backend/.env` contains a private `SAANJH_API_TOKEN` of at least 32 characters.

Useful controls:

```powershell
npm run api:service:status
npm run api:service:stop
npm run api:service:start
npm run api:service:uninstall
```

The status command deliberately reports FastAPI liveness, Groq health, and Voicebox health separately. Logs are stored under `logs/saanjh-api`; API stdout/stderr are rotated on restart and the supervisor log rotates after 5 MB. The uninstall command removes only the scheduled task and managed process, leaving configuration, data, and logs intact.

This uses a sign-in trigger rather than a machine-startup service because Voicebox is a desktop application in the signed-in user's session. A boot-time FastAPI process would still be unable to synthesize until Voicebox starts in that user session. Configure Voicebox itself to start with Windows and keep its local server running. The PC must remain awake; Windows sleep suspends both services.

`npm run api` deliberately listens only on loopback; that is the safest origin for a public tunnel. For short-lived development on a trusted private Wi-Fi network, `npm run api:lan` listens on all interfaces. Use the PC's private LAN address in the app and allow port 8000 through Windows Firewall only on the Private profile. Do not use the LAN mode as internet hosting and do not port-forward it from the router.

For reboot-safe Windows startup, install both current-user logon tasks from an elevated PowerShell window:

```powershell
npm run api:service:install
npm run voicebox:autostart:install
```

`Saanjh-API` supervises FastAPI with health checks and restart-on-failure. `Saanjh-Voicebox` starts the installed Voicebox desktop/CUDA backend after sign-in. Both keep FastAPI and Voicebox bound to loopback; the public tunnel must expose only port 8000. The hosting PC must remain powered on, awake, connected, and signed in.

Alternatively, from `backend`, run `docker compose up --build -d`. The Compose file publishes only `127.0.0.1:8000`, persists the legacy SQLite database in a named volume, and reaches host Voicebox through `host.docker.internal`. It never publishes port `17493`.

## 3. Add HTTPS without opening a router port

### Stable endpoint option: Tailscale Funnel

Tailscale Funnel can provide a stable HTTPS hostname backed by a reverse proxy to `http://127.0.0.1:8000`. Keep the generated machine hostname in an ignored local `.env` or EAS environment; do not commit a personal server address to the repository.

Verify the public path with `/livez`, then use the private key for `/api/health`. To inspect or configure Funnel from an elevated PowerShell window:

```powershell
& 'C:\Program Files\Tailscale\tailscale.exe' funnel status
& 'C:\Program Files\Tailscale\tailscale.exe' funnel --bg --yes --https=443 http://127.0.0.1:8000
```

Set the hostname as `EXPO_PUBLIC_API_URL` in a private build environment or enter it in the app's connection setting. The checked-in build profiles deliberately contain no live hostname.

### Cloudflare alternative

If a Cloudflare-managed domain is added later, a named Cloudflare Tunnel is also suitable. Its only origin must be `http://127.0.0.1:8000`. The checked-in `cloudflared-config.example.yml` includes the required final `http_status:404` catch-all and deliberately has no Voicebox ingress.

For an authenticated temporary test, start the API and then run:

```powershell
npm run api
# In another terminal:
npm run api:tunnel:quick
```

The helper refuses to publish the API unless `backend/.env` contains a `SAANJH_API_TOKEN` of at least 32 characters and `/livez` is healthy. It never prints the token. Copy its generated `https://*.trycloudflare.com` address into the app's server setting and enter the same token in the app's secure connection setting. A quick-tunnel hostname changes whenever the process restarts, so it is only a connectivity test—not a release server.

To move the key to the phone without displaying it in a terminal, run `npm run api:copy-key`; this copies only the private connection key to the Windows clipboard. Paste it into **Private connection key** in Saanjh, then clear the clipboard after pairing the device.

For a locally managed Cloudflare tunnel, create the tunnel and DNS route, copy the example to Cloudflare's config directory, validate the ingress rules, and run it as a Windows service so it restarts with the PC. Current commands and service paths are documented by Cloudflare:

- https://developers.cloudflare.com/tunnel/advanced/local-management/create-local-tunnel/
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/as-a-service/windows/
- https://developers.cloudflare.com/tunnel/advanced/local-management/configuration-file/

Do not use a temporary quick-tunnel URL as a release default: its hostname changes. Save a stable HTTPS hostname in the app at runtime or provide it as `EXPO_PUBLIC_API_URL` when building. Never use `127.0.0.1`, `10.0.2.2`, or a LAN IP for an anywhere-network release.

Only a Cloudflare account owner can create the named tunnel, DNS record, and credentials JSON. Keep that JSON outside this repository, validate the ingress configuration, then install `cloudflared` as a Windows service. Rebuilding Saanjh is not required when a device changes its saved server address.

## 4. Android request contract

`POST https://api.example.com/api/v1/local/chat`:

```json
{
  "companion": {
    "name": "User-entered name",
    "relationship": "friend",
    "voice_status": "consented",
    "consent_acknowledged": true,
    "ai_disclosure_acknowledged": true,
    "traits": ["warm", "grounded"],
    "memories": [],
    "address_as": "bro"
  },
  "history": [
    {"role": "user", "content": "Earlier local message"},
    {"role": "assistant", "content": "Earlier local reply"}
  ],
  "message": "Current user message"
}
```

The response is only `{reply, model, disclosure_text}`. At most the configured `GROQ_HISTORY_LIMIT` most-recent history items are forwarded. Nothing from this route is inserted into Saanjh's database.

Voicebox profile, sample, transcription, generation, polling, and audio routes remain stateless gateway operations from FastAPI's perspective. Generated audio requests must also include the bearer token; the Android audio player therefore needs to support authenticated media headers or download the audio through an authenticated request before local playback.

## Remaining hosting decision

- **PC + tunnel:** fastest and cheapest prototype; unavailable whenever this PC, Voicebox, or the tunnel stops. Voice generation speed depends on this PC's GPU.
- **Always-on GPU host:** reliable from any network and usually faster after keeping the model warm; requires deploying a compatible Voicebox runtime, GPU budget, encrypted profile storage, monitoring, and real per-device/user authentication.

The current files prepare the first option safely. They do not create a Cloudflare account, domain, tunnel, DNS record, or hosted GPU.
