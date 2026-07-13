[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Saanjh.Server.Common.ps1')

$layout = Get-SaanjhLayout
Initialize-SaanjhDirectories -Layout $layout
Assert-SaanjhServerPrerequisites -Layout $layout

if (Test-Path -LiteralPath $layout.StopFile) {
  Remove-Item -LiteralPath $layout.StopFile -Force
}

$task = Get-ScheduledTask -TaskName $script:SaanjhTaskName -ErrorAction SilentlyContinue
if ($task) {
  Start-ScheduledTask -TaskName $script:SaanjhTaskName
} else {
  $runScript = Join-Path $PSScriptRoot 'run-saanjh-server.ps1'
  $powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $arguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$runScript`""
  Start-Process -FilePath $powerShell -ArgumentList $arguments -WorkingDirectory $layout.RepoRoot -WindowStyle Hidden
}

& (Join-Path $PSScriptRoot 'status-saanjh-server.ps1') -WaitSeconds 50 -NoFail
