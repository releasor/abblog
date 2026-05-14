param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('feature', 'bugfix', 'refactor')]
  [string]$Pipeline,
  [Parameter(Mandatory = $true)]
  [string]$RunScript,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ScriptArgs
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$stateName = if ($Pipeline -eq 'feature') { 'features' } elseif ($Pipeline -eq 'bugfix') { 'bugfix' } else { 'refactor' }
$defaultList = if ($Pipeline -eq 'feature') { '.prizmkit/plans/feature-list.json' } elseif ($Pipeline -eq 'bugfix') { '.prizmkit/plans/bug-fix-list.json' } else { '.prizmkit/plans/refactor-list.json' }
$stateDir = Join-Path $projectRoot ".prizmkit/state/$stateName"
$pidFile = Join-Path $stateDir '.pipeline.pid'
$logFile = Join-Path $stateDir 'pipeline-daemon.log'

function Get-PipelinePid {
  if (-not (Test-Path $pidFile)) { return $null }
  $raw = (Get-Content -LiteralPath $pidFile -Raw).Trim()
  if (-not $raw) { return $null }
  return [int]$raw
}

function Test-PipelineRunning {
  $pidValue = Get-PipelinePid
  if (-not $pidValue) { return $false }
  return [bool](Get-Process -Id $pidValue -ErrorAction SilentlyContinue)
}

function Start-Pipeline {
  param([string[]]$ArgsList)
  New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
  if (Test-PipelineRunning) {
    Write-Error "PrizmKit: $Pipeline pipeline is already running (PID: $(Get-PipelinePid))."
    exit 1
  }

  $list = if ($ArgsList.Count -gt 0 -and -not $ArgsList[0].StartsWith('--')) { $ArgsList[0] } else { $defaultList }
  if (-not (Test-Path $list)) {
    Write-Error "PrizmKit: list file not found: $list"
    exit 2
  }

  $runPath = Join-Path $scriptDir $RunScript
  $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runPath, 'run') + $ArgsList
  $launcher = Join-Path $stateDir '.pipeline-launch.ps1'
  $quotedArgs = ($arguments | ForEach-Object { "'$($_ -replace "'", "''")'" }) -join ', '
  Set-Content -LiteralPath $launcher -Value "& powershell.exe @($quotedArgs) *>> '$($logFile -replace "'", "''")'"
  $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $launcher) -PassThru -WindowStyle Hidden
  Set-Content -LiteralPath $pidFile -Value $process.Id
  Write-Output "{`"success`": true, `"pid`": $($process.Id), `"log_file`": `"$logFile`"}"
}

function Stop-Pipeline {
  $pidValue = Get-PipelinePid
  if (-not $pidValue) {
    Write-Output "PrizmKit: no $Pipeline pipeline PID found."
    exit 0
  }
  $proc = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-Process -Id $pidValue -Force
    Write-Output "PrizmKit: stopped $Pipeline pipeline (PID: $pidValue)."
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

$command = if ($ScriptArgs.Count -gt 0) { $ScriptArgs[0] } else { 'status' }
$rest = if ($ScriptArgs.Count -gt 1) { $ScriptArgs[1..($ScriptArgs.Count - 1)] } else { @() }

switch ($command) {
  'start' { Start-Pipeline $rest }
  'restart' { Stop-Pipeline; Start-Pipeline $rest }
  'stop' { Stop-Pipeline }
  'status' {
    if (Test-PipelineRunning) {
      Write-Output "PrizmKit: $Pipeline pipeline running (PID: $(Get-PipelinePid))."
      exit 0
    }
    Write-Output "PrizmKit: $Pipeline pipeline is not running."
    exit 1
  }
  'logs' {
    $lines = 80
    $follow = $false
    for ($i = 0; $i -lt $rest.Count; $i++) {
      if ($rest[$i] -eq '--follow') { $follow = $true }
      elseif ($rest[$i] -eq '--lines' -and $i + 1 -lt $rest.Count) { $lines = [int]$rest[$i + 1]; $i++ }
    }
    if (-not (Test-Path $logFile)) {
      Write-Error "PrizmKit: log file not found: $logFile"
      exit 1
    }
    if ($follow) { Get-Content -LiteralPath $logFile -Tail $lines -Wait } else { Get-Content -LiteralPath $logFile -Tail $lines }
  }
  default {
    Write-Error "PrizmKit: unknown daemon command: $command"
    exit 1
  }
}
