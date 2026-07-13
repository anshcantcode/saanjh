Set-StrictMode -Version Latest

$script:SaanjhTaskName = 'Saanjh-API'
$script:SaanjhOrigin = 'http://127.0.0.1:8000'

function Get-SaanjhLayout {
  $repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
  $runtimeDirectory = Join-Path $repoRoot '.runtime\saanjh-api'
  $logDirectory = Join-Path $repoRoot 'logs\saanjh-api'

  [pscustomobject]@{
    RepoRoot = $repoRoot
    BackendDirectory = Join-Path $repoRoot 'backend'
    BackendEnv = Join-Path $repoRoot 'backend\.env'
    Python = Join-Path $repoRoot 'backend\.venv\Scripts\python.exe'
    RuntimeDirectory = $runtimeDirectory
    StateFile = Join-Path $runtimeDirectory 'process.json'
    StopFile = Join-Path $runtimeDirectory 'stop.requested'
    LogDirectory = $logDirectory
    OutputLog = Join-Path $logDirectory 'api.out.log'
    ErrorLog = Join-Path $logDirectory 'api.err.log'
    SupervisorLog = Join-Path $logDirectory 'supervisor.log'
  }
}

function Initialize-SaanjhDirectories {
  param([Parameter(Mandatory)]$Layout)

  New-Item -ItemType Directory -Path $Layout.RuntimeDirectory -Force | Out-Null
  New-Item -ItemType Directory -Path $Layout.LogDirectory -Force | Out-Null
}

function Get-SaanjhApiToken {
  param([Parameter(Mandatory)][string]$EnvPath)

  if (-not (Test-Path -LiteralPath $EnvPath)) {
    return ''
  }

  $line = Get-Content -LiteralPath $EnvPath |
    Where-Object { $_ -match '^\s*SAANJH_API_TOKEN\s*=' } |
    Select-Object -Last 1

  if (-not $line) {
    return ''
  }

  return ($line -replace '^\s*SAANJH_API_TOKEN\s*=\s*', '').Trim().Trim('"').Trim("'")
}

function Assert-SaanjhServerPrerequisites {
  param(
    [Parameter(Mandatory)]$Layout,
    [switch]$RequirePrivateToken
  )

  if (-not (Test-Path -LiteralPath $Layout.Python)) {
    throw "The backend Python environment is missing at $($Layout.Python). Create backend/.venv and install backend/requirements.txt first."
  }
  if (-not (Test-Path -LiteralPath $Layout.BackendEnv)) {
    throw 'backend/.env is missing. Copy backend/.env.example and configure it before installing the server task.'
  }

  if ($RequirePrivateToken) {
    $token = Get-SaanjhApiToken -EnvPath $Layout.BackendEnv
    if ($token.Length -lt 32) {
      throw 'SAANJH_API_TOKEN must contain at least 32 characters before the API can be paired with a public HTTPS tunnel.'
    }
  }
}

function Test-SaanjhLiveness {
  param([int]$TimeoutSeconds = 3)

  try {
    $response = Invoke-RestMethod -Uri "$script:SaanjhOrigin/livez" -TimeoutSec $TimeoutSeconds
    return $response.status -eq 'ok'
  } catch {
    return $false
  }
}

function Get-SaanjhUpstreamHealth {
  param(
    [Parameter(Mandatory)]$Layout,
    [int]$TimeoutSeconds = 15
  )

  $token = Get-SaanjhApiToken -EnvPath $Layout.BackendEnv
  $headers = @{}
  if ($token) {
    $headers.Authorization = "Bearer $token"
  }

  try {
    return Invoke-RestMethod -Uri "$script:SaanjhOrigin/api/health" -Headers $headers -TimeoutSec $TimeoutSeconds
  } catch {
    return $null
  }
}

function Rotate-SaanjhLog {
  param(
    [Parameter(Mandatory)][string]$Path,
    [int64]$MaximumBytes = 5MB,
    [int]$Backups = 3,
    [switch]$Always
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }
  if (-not $Always -and (Get-Item -LiteralPath $Path).Length -lt $MaximumBytes) {
    return
  }

  for ($index = $Backups - 1; $index -ge 1; $index--) {
    $source = "$Path.$index"
    $destination = "$Path.$($index + 1)"
    if (Test-Path -LiteralPath $source) {
      Move-Item -LiteralPath $source -Destination $destination -Force
    }
  }
  Move-Item -LiteralPath $Path -Destination "$Path.1" -Force
}

function Write-SaanjhSupervisorLog {
  param(
    [Parameter(Mandatory)]$Layout,
    [Parameter(Mandatory)][string]$Message
  )

  Rotate-SaanjhLog -Path $Layout.SupervisorLog
  $timestamp = [DateTime]::UtcNow.ToString('o')
  Add-Content -LiteralPath $Layout.SupervisorLog -Value "$timestamp $Message" -Encoding UTF8
}

function Get-SaanjhManagedProcess {
  param([Parameter(Mandatory)]$Layout)

  if (-not (Test-Path -LiteralPath $Layout.StateFile)) {
    return $null
  }

  try {
    $state = Get-Content -LiteralPath $Layout.StateFile -Raw | ConvertFrom-Json
    $process = Get-Process -Id ([int]$state.pid) -ErrorAction Stop
    if (-not $process.Path) {
      return $null
    }
    if (-not [string]::Equals(
      [System.IO.Path]::GetFullPath($process.Path),
      [System.IO.Path]::GetFullPath($Layout.Python),
      [System.StringComparison]::OrdinalIgnoreCase
    )) {
      return $null
    }

    $recordedStart = [DateTime]::Parse($state.startedUtc).ToUniversalTime()
    if ([Math]::Abs(($process.StartTime.ToUniversalTime() - $recordedStart).TotalSeconds) -gt 5) {
      return $null
    }
    return $process
  } catch {
    return $null
  }
}

function Remove-SaanjhStateFile {
  param([Parameter(Mandatory)]$Layout)

  if (Test-Path -LiteralPath $Layout.StateFile) {
    Remove-Item -LiteralPath $Layout.StateFile -Force
  }
}
