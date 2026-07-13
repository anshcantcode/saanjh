$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendEnv = Join-Path $repoRoot 'backend\.env'

if (-not (Test-Path -LiteralPath $backendEnv)) {
  throw 'backend/.env is missing. Copy backend/.env.example and configure the server first.'
}

# Refuse to publish an unauthenticated API. The value is inspected only for
# presence/length and is never written to the terminal or passed to cloudflared.
$tokenLine = Get-Content -LiteralPath $backendEnv |
  Where-Object { $_ -match '^\s*SAANJH_API_TOKEN\s*=' } |
  Select-Object -Last 1
$token = if ($tokenLine) { ($tokenLine -replace '^\s*SAANJH_API_TOKEN\s*=\s*', '').Trim().Trim('"').Trim("'") } else { '' }

if ($token.Length -lt 32) {
  throw 'Set SAANJH_API_TOKEN to at least 32 random characters in backend/.env before opening a public tunnel.'
}

try {
  $live = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/livez' -TimeoutSec 5
} catch {
  throw 'FastAPI is not reachable on http://127.0.0.1:8000. Start it with npm run api first.'
}

if ($live.status -ne 'ok') {
  throw 'FastAPI responded, but its public liveness probe is not healthy.'
}

$cloudflaredCommand = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($cloudflaredCommand) {
  $cloudflaredPath = $cloudflaredCommand.Source
} else {
  $installedPath = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
  if (Test-Path -LiteralPath $installedPath) {
    $cloudflaredPath = $installedPath
  } else {
    throw 'cloudflared is not installed or available on PATH.'
  }
}

Write-Host 'Starting an authenticated temporary tunnel to FastAPI only.'
Write-Host 'Copy the generated https://*.trycloudflare.com address into Saanjh settings.'
Write-Host 'This address changes whenever the tunnel restarts; use a named tunnel for a stable release address.'

& $cloudflaredPath tunnel --url http://127.0.0.1:8000 --no-autoupdate
exit $LASTEXITCODE
