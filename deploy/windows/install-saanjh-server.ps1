[CmdletBinding()]
param(
  [switch]$DoNotStart
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Saanjh.Server.Common.ps1')

$layout = Get-SaanjhLayout
Initialize-SaanjhDirectories -Layout $layout
Assert-SaanjhServerPrerequisites -Layout $layout -RequirePrivateToken

$runScript = Join-Path $PSScriptRoot 'run-saanjh-server.ps1'
$powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$actionArguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$runScript`""

$action = New-ScheduledTaskAction -Execute $powerShell -Argument $actionArguments -WorkingDirectory $layout.RepoRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settingsParameters = @{
  AllowStartIfOnBatteries = $true
  DontStopIfGoingOnBatteries = $true
  StartWhenAvailable = $true
  RestartCount = 3
  RestartInterval = New-TimeSpan -Minutes 1
  ExecutionTimeLimit = [TimeSpan]::Zero
  MultipleInstances = 'IgnoreNew'
}
$settings = New-ScheduledTaskSettingsSet @settingsParameters

$taskParameters = @{
  Action = $action
  Trigger = $trigger
  Principal = $principal
  Settings = $settings
  Description = 'Keeps the local-only Saanjh FastAPI gateway running for the current Windows user.'
}
$task = New-ScheduledTask @taskParameters
Register-ScheduledTask -TaskName $script:SaanjhTaskName -InputObject $task -Force | Out-Null

Write-Host "Installed scheduled task '$script:SaanjhTaskName' for $identity."
Write-Host 'It starts at sign-in and binds FastAPI only to 127.0.0.1:8000.'
Write-Host "Logs: $($layout.LogDirectory)"

if (-not $DoNotStart) {
  Start-ScheduledTask -TaskName $script:SaanjhTaskName
  & (Join-Path $PSScriptRoot 'status-saanjh-server.ps1') -WaitSeconds 50 -NoFail
}
