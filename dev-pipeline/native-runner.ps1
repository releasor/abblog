param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('feature', 'bugfix', 'refactor')]
  [string]$Pipeline,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ScriptArgs
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$scriptsDir = Join-Path $scriptDir 'scripts'

$config = @{
  feature = @{
    state = Join-Path $projectRoot '.prizmkit/state/features'
    list = '.prizmkit/plans/feature-list.json'
    init = 'init-pipeline.py'
    update = 'update-feature-status.py'
    prompt = 'generate-bootstrap-prompt.py'
    listArg = '--feature-list'
    itemArg = '--feature-id'
    itemField = 'feature_id'
    itemsRoot = 'features'
    sessionRoot = 'features'
    artifactRoot = 'specs'
    terminalDone = 'PIPELINE_COMPLETE'
    terminalBlocked = 'PIPELINE_BLOCKED'
  }
  bugfix = @{
    state = Join-Path $projectRoot '.prizmkit/state/bugfix'
    list = '.prizmkit/plans/bug-fix-list.json'
    init = 'init-bugfix-pipeline.py'
    update = 'update-bug-status.py'
    prompt = 'generate-bugfix-prompt.py'
    listArg = '--bug-list'
    itemArg = '--bug-id'
    itemField = 'bug_id'
    itemsRoot = 'bugs'
    sessionRoot = 'bugs'
    artifactRoot = 'bugfix'
    terminalDone = 'PIPELINE_COMPLETE'
    terminalBlocked = 'PIPELINE_BLOCKED'
  }
  refactor = @{
    state = Join-Path $projectRoot '.prizmkit/state/refactor'
    list = '.prizmkit/plans/refactor-list.json'
    init = 'init-refactor-pipeline.py'
    update = 'update-refactor-status.py'
    prompt = 'generate-refactor-prompt.py'
    listArg = '--refactor-list'
    itemArg = '--refactor-id'
    itemField = 'refactor_id'
    itemsRoot = 'refactors'
    sessionRoot = 'refactors'
    artifactRoot = 'refactor'
    terminalDone = 'PIPELINE_COMPLETE'
    terminalBlocked = 'PIPELINE_BLOCKED'
  }
}[$Pipeline]

function Write-Info { param([string]$Message) Write-Output "[INFO] $Message" }
function Write-Warn { param([string]$Message) Write-Warning $Message }
function Write-Ok { param([string]$Message) Write-Output "[OK] $Message" }

function Get-PythonCommand {
  $python = Get-Command python -ErrorAction SilentlyContinue
  if ($python) { return @($python.Source) }
  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) { return @($py.Source, '-3') }
  throw 'PrizmKit: python or py -3 is required.'
}

function Invoke-PythonJson {
  param([string]$Script, [string[]]$ArgsList)
  $py = Get-PythonCommand
  $pythonArgs = if ($py.Count -gt 1) { $py[1..($py.Count - 1)] } else { @() }
  $output = & $py[0] @pythonArgs $Script @ArgsList
  if ($LASTEXITCODE -ne 0) { throw "Python script failed: $Script" }
  return ($output -join "`n")
}

function Invoke-PythonPlain {
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

function Invoke-AiSession {
  param([string]$Cli, [string]$PromptPath, [string]$LogPath, [string]$Model)
  $prompt = Get-Content -LiteralPath $PromptPath -Raw
  $cliArgs = @()
  if ($Cli -like '*claude*') {
    $cliArgs += @('-p', $prompt, '--dangerously-skip-permissions')
  } else {
    $cliArgs += @('--print', '-y')
  }
  if ($env:VERBOSE -eq '1') { $cliArgs += '--verbose' }
  if ($Model) { $cliArgs += @('--model', $Model) }

  if ($Cli -like '*claude*') {
    & $Cli @cliArgs *> $LogPath
  } else {
    $prompt | & $Cli @cliArgs *> $LogPath
  }
  return $LASTEXITCODE
}

function Initialize-PipelineState {
  param([string]$ListPath)
  New-Item -ItemType Directory -Force -Path $config.state | Out-Null
  $pipelineJson = Join-Path $config.state 'pipeline.json'
  if (Test-Path $pipelineJson) { return }
  Write-Info "Initializing $Pipeline pipeline state..."
  $initScript = Join-Path $scriptsDir $config.init
  $json = Invoke-PythonJson $initScript @($config.listArg, $ListPath, '--state-dir', $config.state)
  $result = $json | ConvertFrom-Json
  if ($result.valid -eq $false) { throw "Pipeline initialization failed: $json" }
}

function Get-NextItem {
  param([string]$ListPath, [int]$MaxRetries)
  $updateScript = Join-Path $scriptsDir $config.update
  $output = Invoke-PythonJson $updateScript @($config.listArg, $ListPath, '--state-dir', $config.state, '--max-retries', "$MaxRetries", '--action', 'get_next')
  return $output
}

function Invoke-PipelineItem {
  param([string]$ListPath, [object]$Item, [string]$Cli, [int]$MaxRetries)
  $itemId = [string]$Item.($config.itemField)
  if (-not $itemId) { throw "Next item missing $($config.itemField): $($Item | ConvertTo-Json -Compress)" }

  $runId = 'windows-' + (Get-Date -Format 'yyyyMMddHHmmss')
  $sessionId = "$itemId-" + (Get-Date -Format 'yyyyMMddHHmmss')
  $sessionDir = Join-Path $config.state "$($config.sessionRoot)/$itemId/sessions/$sessionId"
  $logsDir = Join-Path $sessionDir 'logs'
  New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
  $promptPath = Join-Path $sessionDir 'bootstrap-prompt.md'
  $logPath = Join-Path $logsDir 'session.log'

  $updateScript = Join-Path $scriptsDir $config.update
  Invoke-PythonPlain $updateScript @($config.listArg, $ListPath, '--state-dir', $config.state, $config.itemArg, $itemId, '--action', 'start') | Out-Null

  $retryCount = if ($null -ne $Item.retry_count) { [string]$Item.retry_count } else { '0' }
  $resumePhase = if ($null -ne $Item.resume_from_phase) { [string]$Item.resume_from_phase } else { 'null' }
  $promptScript = Join-Path $scriptsDir $config.prompt
  $promptArgs = @($config.listArg, $ListPath, $config.itemArg, $itemId, '--session-id', $sessionId, '--run-id', $runId, '--retry-count', $retryCount, '--resume-phase', $resumePhase, '--state-dir', $config.state, '--output', $promptPath)
  if ($env:PIPELINE_MODE) { $promptArgs += @('--mode', $env:PIPELINE_MODE) }
  if ($env:ENABLE_CRITIC) { $promptArgs += @('--critic', $env:ENABLE_CRITIC) }

  $promptJson = Invoke-PythonJson $promptScript $promptArgs
  $promptInfo = $promptJson | ConvertFrom-Json
  $model = if ($promptInfo.model) { [string]$promptInfo.model } elseif ($env:MODEL) { $env:MODEL } else { '' }

  Write-Info "Running $Pipeline item $itemId"
  Write-Info "Prompt: $promptPath"
  Write-Info "Log: $logPath"
  $exitCode = Invoke-AiSession $Cli $promptPath $logPath $model
  $sessionStatus = if ($exitCode -eq 0) { 'success' } else { 'crashed' }

  Invoke-PythonPlain $updateScript @($config.listArg, $ListPath, '--state-dir', $config.state, $config.itemArg, $itemId, '--session-status', $sessionStatus, '--session-id', $sessionId, '--max-retries', "$MaxRetries", '--action', 'update') | Out-Null
  if ($sessionStatus -eq 'success') { Write-Ok "$itemId completed" } else { Write-Warn "$itemId ended with $sessionStatus. See $logPath" }
  return $sessionStatus
}

$command = if ($ScriptArgs.Count -gt 0) { $ScriptArgs[0] } else { 'run' }
if ($command -ne 'run' -and $command -ne 'resume') { throw "native-runner.ps1 only handles run/resume, got: $command" }
$rest = if ($ScriptArgs.Count -gt 1) { $ScriptArgs[1..($ScriptArgs.Count - 1)] } else { @() }
$listPath = if ($rest.Count -gt 0 -and $rest[0] -notmatch '^[FBRfbr]-\d+') { $rest[0] } else { $config.list }
$singleId = if ($rest.Count -gt 0 -and $rest[0] -match '^[FBRfbr]-\d+') { $rest[0] } else { '' }
$maxRetries = if ($env:MAX_RETRIES) { [int]$env:MAX_RETRIES } else { 3 }
$stopOnFailure = $env:STOP_ON_FAILURE -eq '1'

if (-not (Test-Path $listPath)) { throw "List file not found: $listPath" }
Initialize-PipelineState $listPath
$cli = Resolve-AiCli
Write-Info "AI CLI: $cli"
Write-Info "Pipeline: $Pipeline"
Write-Info "List: $listPath"

if ($singleId) {
  $item = [pscustomobject]@{ }
  $item | Add-Member -NotePropertyName $config.itemField -NotePropertyValue $singleId
  Invoke-PipelineItem $listPath $item $cli $maxRetries | Out-Null
  exit 0
}

while ($true) {
  $next = Get-NextItem $listPath $maxRetries
  if ($next -eq $config.terminalDone) { Write-Ok "$Pipeline pipeline complete."; exit 0 }
  if ($next -eq $config.terminalBlocked) { Write-Warn "$Pipeline pipeline blocked."; exit 2 }
  $item = $next | ConvertFrom-Json
  $status = Invoke-PipelineItem $listPath $item $cli $maxRetries
  if ($status -ne 'success' -and $stopOnFailure) { exit 1 }
  Start-Sleep -Seconds 2
}
