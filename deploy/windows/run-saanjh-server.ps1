[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Saanjh.Server.Common.ps1')

$layout = Get-SaanjhLayout
Initialize-SaanjhDirectories -Layout $layout
Assert-SaanjhServerPrerequisites -Layout $layout

$mutex = New-Object System.Threading.Mutex($false, 'Local\SaanjhApiSupervisor')
$hasMutex = $false

try {
  try {
    $hasMutex = $mutex.WaitOne(0, $false)
  } catch [System.Threading.AbandonedMutexException] {
    $hasMutex = $true
  }
  if (-not $hasMutex) {
    Write-SaanjhSupervisorLog -Layout $layout -Message 'A supervisor is already running; the duplicate invocation is exiting.'
    exit 0
  }

  if (Test-Path -LiteralPath $layout.StopFile) {
    Remove-Item -LiteralPath $layout.StopFile -Force
  }
  Write-SaanjhSupervisorLog -Layout $layout -Message 'Supervisor started. Origin is fixed to 127.0.0.1:8000.'

  while (-not (Test-Path -LiteralPath $layout.StopFile)) {
    $managedProcess = Get-SaanjhManagedProcess -Layout $layout
    if ($managedProcess -and -not $managedProcess.HasExited) {
      Write-SaanjhSupervisorLog -Layout $layout -Message "Recovered ownership of API process $($managedProcess.Id)."
      $process = $managedProcess
    } elseif (Test-SaanjhLiveness) {
      Write-SaanjhSupervisorLog -Layout $layout -Message 'An API already owns port 8000. It will not be terminated or replaced.'
      while ((Test-SaanjhLiveness) -and -not (Test-Path -LiteralPath $layout.StopFile)) {
        Start-Sleep -Seconds 30
      }
      continue
    } else {
      Remove-SaanjhStateFile -Layout $layout
      Rotate-SaanjhLog -Path $layout.OutputLog -Always
      Rotate-SaanjhLog -Path $layout.ErrorLog -Always

      $arguments = @(
        '-m', 'uvicorn', 'app.main:app',
        '--host', '127.0.0.1',
        '--port', '8000',
        '--proxy-headers',
        '--forwarded-allow-ips', '127.0.0.1'
      )
      $startParameters = @{
        FilePath = $layout.Python
        ArgumentList = $arguments
        WorkingDirectory = $layout.BackendDirectory
        WindowStyle = 'Hidden'
        RedirectStandardOutput = $layout.OutputLog
        RedirectStandardError = $layout.ErrorLog
        PassThru = $true
      }
      $process = Start-Process @startParameters

      @{
        pid = $process.Id
        startedUtc = $process.StartTime.ToUniversalTime().ToString('o')
        pythonPath = $layout.Python
        repoRoot = $layout.RepoRoot
      } | ConvertTo-Json | Set-Content -LiteralPath $layout.StateFile -Encoding UTF8

      Write-SaanjhSupervisorLog -Layout $layout -Message "Started API process $($process.Id)."
    }

    $startupDeadline = [DateTime]::UtcNow.AddSeconds(45)
    while (-not $process.HasExited -and [DateTime]::UtcNow -lt $startupDeadline -and -not (Test-SaanjhLiveness)) {
      Start-Sleep -Seconds 2
      $process.Refresh()
    }

    if (-not $process.HasExited -and (Test-SaanjhLiveness)) {
      Write-SaanjhSupervisorLog -Layout $layout -Message "API process $($process.Id) passed its liveness check."
    } else {
      Write-SaanjhSupervisorLog -Layout $layout -Message "API process $($process.Id) did not become healthy. See api.err.log."
    }

    $failedChecks = 0
    while (-not $process.HasExited -and -not (Test-Path -LiteralPath $layout.StopFile)) {
      Start-Sleep -Seconds 15
      $process.Refresh()
      if ($process.HasExited) {
        break
      }

      if (Test-SaanjhLiveness) {
        $failedChecks = 0
      } else {
        $failedChecks++
        Write-SaanjhSupervisorLog -Layout $layout -Message "Liveness check failed ($failedChecks of 3) for API process $($process.Id)."
        if ($failedChecks -ge 3) {
          Write-SaanjhSupervisorLog -Layout $layout -Message "Stopping unresponsive API process $($process.Id); the supervisor will restart it."
          Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
          break
        }
      }
    }

    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      $process.WaitForExit(10000) | Out-Null
    }
    $process.Refresh()
    $exitDescription = if ($process.HasExited) { "exit code $($process.ExitCode)" } else { 'an unknown state' }
    Write-SaanjhSupervisorLog -Layout $layout -Message "API process $($process.Id) ended with $exitDescription."
    Remove-SaanjhStateFile -Layout $layout

    if (-not (Test-Path -LiteralPath $layout.StopFile)) {
      Start-Sleep -Seconds 5
    }
  }
} catch {
  Write-SaanjhSupervisorLog -Layout $layout -Message "Supervisor failed: $($_.Exception.Message)"
  throw
} finally {
  $managedProcess = Get-SaanjhManagedProcess -Layout $layout
  if ($managedProcess) {
    Stop-Process -Id $managedProcess.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-SaanjhStateFile -Layout $layout
  if (Test-Path -LiteralPath $layout.StopFile) {
    Remove-Item -LiteralPath $layout.StopFile -Force
  }
  if ($hasMutex) {
    $mutex.ReleaseMutex()
  }
  $mutex.Dispose()
  Write-SaanjhSupervisorLog -Layout $layout -Message 'Supervisor stopped.'
}
