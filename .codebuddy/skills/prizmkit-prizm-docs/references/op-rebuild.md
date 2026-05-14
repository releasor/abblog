# Operation: Rebuild — Detailed Steps

Regenerate docs for a specific module from scratch. Requires a module path argument.

PRECONDITION: .prizm-docs/ exists. Module path is valid.

STEPS:
1. Delete existing L1 and all L2 docs for the specified module.
2. Re-scan the module directory for files, interfaces, dependencies, subdirectories.
3. Generate fresh L1 doc with full module analysis.
4. Generate L2 docs for all sub-modules immediately (unlike init, rebuild generates L2 right away to capture current state).
5. Update MODULE_INDEX (or MODULE_GROUPS) in root.prizm with new file counts and pointers. Re-evaluate grouping: if total module count > 15 and currently using MODULE_INDEX, convert to MODULE_GROUPS. Regenerate keyword tags for rebuilt modules. **Preserve** any `PROJECT_BRIEF:` line in root.prizm.
6. Append rebuild entry to changelog.prizm: `- <module-path> | refactor: rebuilt module documentation from scratch`
7. Validate regenerated docs against size limits and format rules.

OUTPUT: Regenerated doc summary with before/after comparison.

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

