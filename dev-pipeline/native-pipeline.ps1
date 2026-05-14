param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('feature', 'bugfix', 'refactor')]
  [string]$Pipeline,
  [Parameter(Mandatory = $true)]
  [string]$ScriptName,
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
    update = 'update-feature-status.py'
    init = 'init-pipeline.py'
    listArg = '--feature-list'
    itemArg = '--feature-id'
    label = 'feature'
  }
  bugfix = @{
    state = Join-Path $projectRoot '.prizmkit/state/bugfix'
    list = '.prizmkit/plans/bug-fix-list.json'
    update = 'update-bug-status.py'
    init = 'init-bugfix-pipeline.py'
    listArg = '--bug-list'
    itemArg = '--bug-id'
    label = 'bugfix'
  }
  refactor = @{
    state = Join-Path $projectRoot '.prizmkit/state/refactor'
    list = '.prizmkit/plans/refactor-list.json'
    update = 'update-refactor-status.py'
    init = 'init-refactor-pipeline.py'
    listArg = '--refactor-list'
    itemArg = '--refactor-id'
    label = 'refactor'
  }
}[$Pipeline]

function Invoke-PythonScript {
  param([string]$Script, [string[]]$ArgsList)
  $python = Get-Command python -ErrorAction SilentlyContinue
  if (-not $python) {
    $python = Get-Command py -ErrorAction SilentlyContinue
    if ($python) {
      & $python.Source -3 $Script @ArgsList
      return $LASTEXITCODE
    }
    Write-Error 'PrizmKit: python or py -3 is required.'
    return 1
  }
  & $python.Source $Script @ArgsList
  return $LASTEXITCODE
}

$command = if ($ScriptArgs.Count -gt 0) { $ScriptArgs[0] } else { 'run' }
$rest = if ($ScriptArgs.Count -gt 1) { $ScriptArgs[1..($ScriptArgs.Count - 1)] } else { @() }
$updateScript = Join-Path $scriptsDir $config.update
$initScript = Join-Path $scriptsDir $config.init

switch ($command) {
  'status' {
    if (-not (Test-Path (Join-Path $config.state 'pipeline.json'))) {
      Write-Error "No $($config.label) pipeline state found. Run './$ScriptName run' first."
      exit 1
    }
    $list = if ($rest.Count -gt 0) { $rest[0] } else { $config.list }
    Invoke-PythonScript $updateScript @($config.listArg, $list, '--state-dir', $config.state, '--action', 'status')
    exit $LASTEXITCODE
  }
  'reset' {
    if (Test-Path $config.state) {
      Remove-Item -LiteralPath $config.state -Recurse -Force
    }
    Write-Output "PrizmKit: $($config.label) state cleared. Run './$ScriptName run' to start fresh."
    exit 0
  }
  'unskip' {
    if (-not (Test-Path (Join-Path $config.state 'pipeline.json'))) {
      Write-Error "No $($config.label) pipeline state found. Run './$ScriptName run' first."
      exit 1
    }
    $list = $config.list
    $itemId = ''
    foreach ($arg in $rest) {
      if ($arg -match '^[FBRfbr]-\d+') { $itemId = $arg } else { $list = $arg }
    }
    $argsList = @($config.listArg, $list, '--state-dir', $config.state, '--action', 'unskip')
    if ($itemId) { $argsList += @($config.itemArg, $itemId) }
    Invoke-PythonScript $updateScript $argsList
    exit $LASTEXITCODE
  }
  'init' {
    $list = if ($rest.Count -gt 0) { $rest[0] } else { $config.list }
    New-Item -ItemType Directory -Force -Path $config.state | Out-Null
    Invoke-PythonScript $initScript @($config.listArg, $list, '--state-dir', $config.state)
    exit $LASTEXITCODE
  }
  default {
    Write-Error "PrizmKit: unsupported Windows pipeline command: $command"
    exit 1
  }
}
