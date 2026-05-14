param(
  [switch]$Staged
)

$files = @()
if ($Staged) {
  $files = @(git diff --cached --name-only 2>$null | Where-Object { $_ -match '\.prizm$' })
} else {
  if (Test-Path '.prizm-docs') {
    $files = @(Get-ChildItem -Path '.prizm-docs' -Filter '*.prizm' -Recurse | ForEach-Object { $_.FullName })
  }
}

if ($files.Count -eq 0) {
  exit 0
}

$errorsCount = 0
foreach ($file in $files) {
  if (-not (Test-Path $file)) {
    continue
  }

  $content = Get-Content -LiteralPath $file -Raw
  if ($content -match '(?m)^#{1,6} ') {
    Write-Error "ERROR: $file contains markdown headers (##). Use KEY: value format."
    $errorsCount++
  }

  if ($content -match '(?m)^```') {
    Write-Error "ERROR: $file contains code blocks. Use file_path:line_number reference."
    $errorsCount++
  }

  $size = (Get-Item -LiteralPath $file).Length
  $normalized = $file -replace '\\', '/'
  if ($normalized -like '*root.prizm') {
    $limit = 4096
  } elseif ((Split-Path -Parent $normalized) -eq '.prizm-docs') {
    $limit = 3072
  } else {
    $limit = 5120
  }

  if ($size -gt $limit) {
    Write-Error "ERROR: $file exceeds size limit (${size}B > ${limit}B)."
    $errorsCount++
  }
}

if ($errorsCount -gt 0) {
  Write-Error "PrizmKit: $errorsCount format error(s) in .prizm files. Fix before committing."
  exit 1
}

exit 0
