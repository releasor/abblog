if ($args.Count -eq 0 -or $args[0] -in @('run', 'resume')) {
  & "$PSScriptRoot/native-runner.ps1" -Pipeline refactor @args
} else {
  & "$PSScriptRoot/native-pipeline.ps1" -Pipeline refactor -ScriptName 'run-refactor.sh' @args
}
exit $LASTEXITCODE
