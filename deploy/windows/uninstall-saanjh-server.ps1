[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Saanjh.Server.Common.ps1')

& (Join-Path $PSScriptRoot 'stop-saanjh-server.ps1')

$task = Get-ScheduledTask -TaskName $script:SaanjhTaskName -ErrorAction SilentlyContinue
if ($task) {
  Unregister-ScheduledTask -TaskName $script:SaanjhTaskName -Confirm:$false
  Write-Host "Removed scheduled task '$script:SaanjhTaskName'."
} else {
  Write-Host "Scheduled task '$script:SaanjhTaskName' was not installed."
}

Write-Host 'Backend data, configuration, and logs were left in place.'
