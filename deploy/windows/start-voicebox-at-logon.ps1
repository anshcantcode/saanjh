[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$voiceboxExe = 'C:\Program Files\Voicebox\voicebox.exe'

if (-not (Test-Path -LiteralPath $voiceboxExe)) {
  throw "Voicebox is not installed at $voiceboxExe"
}

$running = Get-Process -Name 'voicebox' -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -eq $voiceboxExe } |
  Select-Object -First 1

if (-not $running) {
  Start-Process -FilePath $voiceboxExe -WindowStyle Hidden
}

# Give the desktop app time to start its private CUDA backend, then report only
# health status. Port 17493 remains local and is never exposed by the gateway.
$deadline = [DateTime]::UtcNow.AddSeconds(45)
do {
  try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:17493/health' -TimeoutSec 3
    if ($health.status -eq 'healthy') { exit 0 }
  } catch {
    # Continue until the bounded startup deadline.
  }
  Start-Sleep -Seconds 2
} while ([DateTime]::UtcNow -lt $deadline)

throw 'Voicebox started, but its private backend did not become healthy within 45 seconds.'
