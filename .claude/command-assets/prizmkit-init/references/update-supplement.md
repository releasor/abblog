# Update Supplement — Post-Merge Gap-Fill Procedure

Runs after tech stack merge in Update mode:

1. **Module scan**: Re-scan project directories using the same TWO-TIER model from Step 1. Compare discovered modules against existing MODULE_INDEX in root.prizm.
2. **Missing L1 check**: For any discovered module with no corresponding L1 `.prizm` doc → create L1 immediately and add to MODULE_INDEX.
3. **Missing L2 check**: For any module/sub-module that has source files with meaningful logic but no L2 `.prizm` doc → create L2 using the L2 GENERATION TEMPLATE. Judgment call: skip trivial wrapper directories or single-config modules.
4. **Stale L1 check**: For existing L1 docs, verify FILES count and KEY_FILES are still accurate. Update if source directory contents have changed significantly.
5. **Report**: Include in the Update report: modules added, L1 docs created, L2 docs created, stale docs refreshed.

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

