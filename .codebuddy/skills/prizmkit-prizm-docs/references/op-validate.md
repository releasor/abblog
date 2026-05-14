# Operation: Validate — Detailed Steps

Check format compliance and consistency of all .prizm docs.

PRECONDITION: .prizm-docs/ exists.

STEPS:
1. FORMAT CHECK: Verify all .prizm files use KEY: value format. Flag any prose paragraphs, code blocks (```), markdown headers (##), emoji, ASCII art, or horizontal rules. Flag TRAPS entries missing severity prefix ([CRITICAL], [HIGH], or [LOW]). Note: [REVIEW] preceding severity (e.g., `[REVIEW][HIGH]`) is a valid temporary staleness marker, not a format violation.
2. SIZE CHECK: Verify size limits: L0 <= 4KB, L1 <= 4KB, L2 <= 5KB. Report files exceeding limits with current size.
3. POINTER CHECK: Verify all arrow (->) references resolve to existing .prizm files. Report broken pointers.
4. STALENESS CHECK: Compare git modification time of each .prizm file against source directory. Flag docs where source was modified more recently.
5. COMPLETENESS CHECK: Verify root.prizm has all required fields (PRIZM_VERSION, PROJECT, LANG, MODULE_INDEX or MODULE_GROUPS). Verify L1 docs have MODULE, FILES, RESPONSIBILITY, DEPENDENCIES (no INTERFACES/TRAPS/DECISIONS). Verify L2 docs have MODULE, FILES, KEY_FILES, DEPENDENCIES, INTERFACES, TRAPS.
6. ANTI-PATTERN CHECK: Flag duplicate information across levels, implementation details in L0/L1, TODO items, session-specific context.
7. RULES HIERARCHY CHECK: Verify L1/L2 RULES do not contradict root.prizm RULES. L1/L2 may only supplement with module-specific exceptions.
8. TRAPS STALENESS CHECK: For each L2 doc where TRAPS section has more than 8 entries, verify that TRAPS include staleness metadata (`STALE_IF:` or `REF:` fields). Flag TRAPS without any staleness metadata as `NEEDS_METADATA` — these are not auto-removed, but flagged for the next `/prizmkit-retrospective` to enrich with `STALE_IF:` globs or `REF:` hashes.

OUTPUT: Validation report with PASS/FAIL per check, list of issues with file paths and suggested fixes.

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

