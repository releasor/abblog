param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ScriptArgs
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$scriptsDir = Join-Path $scriptDir 'scripts'
$stateDir = Join-Path $projectRoot '.prizmkit/state/recovery'
$detectScript = Join-Path $projectRoot 'core/skills/orchestration-skill/workflows/recovery-workflow/scripts/detect-recovery-state.py'
$promptScript = Join-Path $scriptsDir 'generate-recovery-prompt.py'

function Get-PythonCommand {
  $python = Get-Command python -ErrorAction SilentlyContinue
  if ($python) { return @($python.Source) }
  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) { return @($py.Source, '-3') }
  throw 'PrizmKit: python or py -3 is required.'
}

function Invoke-Python {
  param([string]$Script, [string[]]$ArgsList)
  $py = Get-PythonCommand
  $pythonArgs = if ($py.Count -gt 1) { $py[1..($py.Count - 1)] } else { @() }
  & $py[0] @pythonArgs $Script @ArgsList
  return $LASTEXITCODE
}

function Resolve-AiCli {
  if ($env:AI_CLI) { return $env:AI_CLI }
  if ($env:CODEBUDDY_CLI) { return $env:CODEBUDDY_CLI }
  if (Get-Command cbc -ErrorAction SilentlyContinue) { return 'cbc' }
  if (Get-Command claude -ErrorAction SilentlyContinue) { return 'claude' }
  throw 'PrizmKit: AI CLI not found. Install cbc or claude, or set AI_CLI.'
}

function Show-Help {
  Write-Output 'Usage: ./run-recovery.ps1 [run|detect|help] [--dry-run] [--yes] [--model <model>]'
}

function Invoke-Detection {
  Invoke-Python $detectScript @('--project-root', $projectRoot)
  return $LASTEXITCODE
}

function Invoke-RecoveryRun {
  param([string[]]$ArgsList)
  $dryRun = $false
  $model = if ($env:MODEL) { $env:MODEL } else { '' }
  for ($i = 0; $i -lt $ArgsList.Count; $i++) {
    if ($ArgsList[$i] -eq '--dry-run') { $dryRun = $true }
    elseif ($ArgsList[$i] -eq '--model' -and $i + 1 -lt $ArgsList.Count) { $model = $ArgsList[$i + 1]; $i++ }
  }

  New-Item -ItemType Directory -Force -Path (Join-Path $stateDir 'sessions') | Out-Null
  $sessionId = 'recovery-' + (Get-Date -Format 'yyyyMMddHHmmss')
  $sessionDir = Join-Path $stateDir "sessions/$sessionId"
  $logsDir = Join-Path $sessionDir 'logs'
  New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
  $detectionPath = Join-Path $sessionDir 'detection.json'
  $promptPath = Join-Path $sessionDir 'bootstrap-prompt.md'
  $logPath = Join-Path $logsDir 'session.log'

  $py = Get-PythonCommand
  $pythonArgs = if ($py.Count -gt 1) { $py[1..($py.Count - 1)] } else { @() }
  & $py[0] @pythonArgs $detectScript --project-root $projectRoot | Set-Content -LiteralPath $detectionPath
  if ($LASTEXITCODE -ne 0) { throw 'PrizmKit: recovery detection failed.' }

  & $py[0] @pythonArgs $promptScript --detection-json $detectionPath --output $promptPath --project-root $projectRoot --session-id $sessionId
  if ($LASTEXITCODE -ne 0) { throw 'PrizmKit: recovery prompt generation failed.' }

  Write-Output "PrizmKit: recovery prompt written to $promptPath"
  if ($dryRun) { return 0 }

  $cli = Resolve-AiCli
  $prompt = Get-Content -LiteralPath $promptPath -Raw
  $cliArgs = @()
  if ($cli -like '*claude*') { $cliArgs += @('-p', $prompt, '--dangerously-skip-permissions') } else { $cliArgs += @('--print', '-y') }
  if ($env:VERBOSE -eq '1') { $cliArgs += '--verbose' }
  if ($model) { $cliArgs += @('--model', $model) }

  if ($cli -like '*claude*') { & $cli @cliArgs *> $logPath } else { $prompt | & $cli @cliArgs *> $logPath }
  Write-Output "PrizmKit: recovery session log: $logPath"
  return $LASTEXITCODE
}

$command = if ($ScriptArgs.Count -gt 0) { $ScriptArgs[0] } else { 'run' }
$rest = if ($ScriptArgs.Count -gt 1) { $ScriptArgs[1..($ScriptArgs.Count - 1)] } else { @() }

switch ($command) {
  'run' { Invoke-RecoveryRun $rest; exit $LASTEXITCODE }
  'detect' { Invoke-Detection; exit $LASTEXITCODE }
  'help' { Show-Help; exit 0 }
  '--help' { Show-Help; exit 0 }
  '-h' { Show-Help; exit 0 }
  default { Write-Error "PrizmKit: unknown recovery command: $command"; exit 1 }
}
