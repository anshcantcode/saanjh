[CmdletBinding()]
param(
  [ValidateRange(0, 120)][int]$WaitSeconds = 0,
  [switch]$NoFail
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Saanjh.Server.Common.ps1')

$layout = Get-SaanjhLayout
Initialize-SaanjhDirectories -Layout $layout

$deadline = [DateTime]::UtcNow.AddSeconds($WaitSeconds)
while ($WaitSeconds -gt 0 -and -not (Test-SaanjhLiveness) -and [DateTime]::UtcNow -lt $deadline) {
  Start-Sleep -Seconds 2
}

$task = Get-ScheduledTask -TaskName $script:SaanjhTaskName -ErrorAction SilentlyContinue
$taskInfo = if ($task) { Get-ScheduledTaskInfo -TaskName $script:SaanjhTaskName } else { $null }
$process = Get-SaanjhManagedProcess -Layout $layout
$live = Test-SaanjhLiveness
$health = if ($live) { Get-SaanjhUpstreamHealth -Layout $layout } else { $null }

Write-Host 'Saanjh Windows server status'
Write-Host "  Scheduled startup : $(if ($task) { $task.State } else { 'not installed' })"
if ($taskInfo) {
  Write-Host "  Last task result  : $($taskInfo.LastTaskResult)"
}
Write-Host "  Managed process   : $(if ($process) { "PID $($process.Id)" } else { 'not detected' })"
Write-Host "  FastAPI liveness  : $(if ($live) { 'online' } else { 'offline' })"

if ($health) {
  Write-Host "  Overall health    : $($health.status)"
  Write-Host "  Groq              : $($health.groq.status)$(if ($health.groq.detail) { " - $($health.groq.detail)" })"
  Write-Host "  Voicebox          : $($health.voicebox.status)$(if ($health.voicebox.detail) { " - $($health.voicebox.detail)" })"
} elseif ($live) {
  Write-Host '  Upstream health   : unavailable (verify backend/.env token and api.err.log)'
}

Write-Host "  Logs              : $($layout.LogDirectory)"

if ($NoFail) {
  exit 0
}
if (-not $live) {
  exit 1
}
if (-not $health -or $health.status -ne 'ok') {
  exit 2
}
exit 0
