[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Saanjh.Server.Common.ps1')

$layout = Get-SaanjhLayout
Initialize-SaanjhDirectories -Layout $layout
New-Item -ItemType File -Path $layout.StopFile -Force | Out-Null

$task = Get-ScheduledTask -TaskName $script:SaanjhTaskName -ErrorAction SilentlyContinue
if ($task -and $task.State -ne 'Disabled') {
  Stop-ScheduledTask -TaskName $script:SaanjhTaskName -ErrorAction SilentlyContinue
}

$process = Get-SaanjhManagedProcess -Layout $layout
if ($process) {
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  Write-Host "Stopped managed API process $($process.Id)."
} else {
  Write-Host 'No managed API process was running.'
}

Remove-SaanjhStateFile -Layout $layout
Write-Host 'The stop marker will be cleared by the supervisor, or by the next explicit start.'
