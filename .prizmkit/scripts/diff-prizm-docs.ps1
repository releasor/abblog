$root = '.prizm-docs'
if (-not (Test-Path $root)) {
  exit 0
}

$changes = @(git diff --name-only 2>$null | Where-Object { $_ -match '^\.prizm-docs/' })
$stagedChanges = @(git diff --cached --name-only 2>$null | Where-Object { $_ -match '^\.prizm-docs/' })
$allChanges = @($changes + $stagedChanges | Select-Object -Unique)

foreach ($change in $allChanges) {
  Write-Output $change
}

exit 0
