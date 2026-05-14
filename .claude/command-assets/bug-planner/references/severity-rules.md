# Severity Auto-Classification Rules

When extracting bugs, apply these rules to auto-suggest severity:

| Severity | Indicators | Examples |
|----------|------------|----------|
| **critical** | System crash, data loss, security breach, OOM, unrecoverable error | `Segmentation fault`, `OutOfMemoryError`, `SQL injection vulnerability`, `Database corrupted` |
| **high** | Core feature broken, authentication failure, data integrity issue, timeout | `Auth token invalid`, `Payment failed`, `Connection timeout`, `500 Internal Server Error` |
| **medium** | Feature partially broken, workaround exists, incorrect output | `CSV encoding issue`, `Pagination not working`, `Wrong date format`, `Missing validation` |
| **low** | Cosmetic issue, minor inconvenience, edge case | `UI misalignment`, `Typo in error message`, `Slow loading (non-critical page)`, `Non-breaking warning` |

## Special Cases

- Failed test → medium (unless test covers critical path, then high)
- User report with "cannot use app" → high
- User report with "annoying but works" → low

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

