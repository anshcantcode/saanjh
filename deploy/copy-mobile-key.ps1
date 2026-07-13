$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendEnv = Join-Path $repoRoot 'backend\.env'
if (-not (Test-Path -LiteralPath $backendEnv)) {
  throw 'backend/.env is missing.'
}

$tokenLine = Get-Content -LiteralPath $backendEnv |
  Where-Object { $_ -match '^\s*SAANJH_API_TOKEN\s*=' } |
  Select-Object -Last 1
$token = if ($tokenLine) { ($tokenLine -replace '^\s*SAANJH_API_TOKEN\s*=\s*', '').Trim().Trim('"').Trim("'") } else { '' }
if ($token.Length -lt 32) {
  throw 'SAANJH_API_TOKEN is missing or too short.'
}

Set-Clipboard -Value $token
Write-Host 'The private Saanjh connection key is now on your clipboard. It was not printed.'
