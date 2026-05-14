# Operation: Status — Detailed Steps

Check freshness of all .prizm docs.

PRECONDITION: .prizm-docs/ exists with root.prizm.

STEPS:
1. Get last git modification time of root.prizm via `git log -1 --format="%ai" -- .prizm-docs/root.prizm`.
2. Count commits since that time via `git log --since="<timestamp>" --oneline | wc -l`.
3. For each L1/L2 doc, compare git modification time of the .prizm file (`git log -1 --format="%ai" -- <prizm-file>`) against latest git modification of source files in that module (`git log -1 --format="%ai" -- <module-path>/`).
4. Classify each doc as: FRESH (prizm file updated after latest source change), STALE (source changed more recently than prizm file), MISSING (module exists but no .prizm doc).
5. Flag any docs exceeding size limits.

OUTPUT: Freshness report table with columns: DOC_PATH | LEVEL | STATUS | PRIZM_LAST_MOD | SOURCE_LAST_MOD.

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

