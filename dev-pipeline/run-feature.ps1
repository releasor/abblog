if ($args.Count -eq 0 -or $args[0] -in @('run', 'resume')) {
  & "$PSScriptRoot/native-runner.ps1" -Pipeline feature @args
} else {
  & "$PSScriptRoot/native-pipeline.ps1" -Pipeline feature -ScriptName 'run-feature.sh' @args
}
exit $LASTEXITCODE
