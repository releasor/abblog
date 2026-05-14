if ($args.Count -eq 0 -or $args[0] -in @('run', 'resume')) {
  & "$PSScriptRoot/native-runner.ps1" -Pipeline bugfix @args
} else {
  & "$PSScriptRoot/native-pipeline.ps1" -Pipeline bugfix -ScriptName 'run-bugfix.sh' @args
}
exit $LASTEXITCODE
