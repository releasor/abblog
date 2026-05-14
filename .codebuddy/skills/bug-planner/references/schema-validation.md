# Schema Validation Checklist

Use this checklist for manual validation when `validate-bug-list.py` is not available. The script is the source of truth — this checklist mirrors its logic.

## Required Top-Level Fields

- [ ] `$schema`: must be `"dev-pipeline-bug-fix-list-v1"`
- [ ] `project_name`: non-empty string
- [ ] `bugs`: non-empty array

## Per-Bug Required Fields

- [ ] `id`: matches pattern `B-NNN` (e.g., `B-001`)
- [ ] `title`: non-empty string
- [ ] `description`: non-empty string
- [ ] `severity`: one of `critical`, `high`, `medium`, `low`
- [ ] `error_source.type`: one of `stack_trace`, `user_report`, `failed_test`, `log_pattern`, `monitoring_alert`
- [ ] `verification_type`: one of `automated`, `manual`, `hybrid`
- [ ] `acceptance_criteria`: non-empty array of strings
- [ ] `status`: must be `pending` for new bugs

## Consistency Checks

- [ ] No duplicate bug IDs
- [ ] If `priority` is set, must be one of `high`, `medium`, `low`

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

