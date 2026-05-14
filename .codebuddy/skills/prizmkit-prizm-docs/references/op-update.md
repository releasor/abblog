# Operation: Update — Detailed Steps

Update .prizm-docs/ to reflect recent code changes.

PRECONDITION: .prizm-docs/ exists with root.prizm.

STEPS:
1. Get changed files via `git diff --cached --name-status`. If nothing staged, use `git diff --name-status`. If no git changes at all, do full rescan comparing code against existing docs — this includes checking for modules that have source files but no L2 doc.
2. Map changed files to modules by matching against MODULE_INDEX or MODULE_GROUPS in root.prizm. Group changes by module.
3. Classify each change: A (added) -> new KEY_FILES entries. D (deleted) -> remove entries, update counts. M (modified) -> check dependency changes. R (renamed) -> update all path references.
4. Update affected docs: L2 first (KEY_FILES, INTERFACES, DATA_FLOW, DEPENDENCIES, TRAPS, CHANGELOG), then L1 (FILES count, KEY_FILES, DEPENDENCIES — L1 does NOT contain INTERFACES/DATA_FLOW/TRAPS/DECISIONS), then L0 (MODULE_INDEX or MODULE_GROUPS counts, CROSS_CUTTING) only if structural change. No UPDATED timestamps — git tracks modification times. **Preserve** any `PROJECT_BRIEF:` line in root.prizm — it is managed by prizmkit-init, not by this skill.
5. Skip updates if: only internal implementation changed (no interface/dependency change), only comments/whitespace/formatting, only .prizm files changed. DO NOT skip test file changes or bug fixes — they may reveal TRAPS worth capturing in L2.
6. If new directory qualifies as a module (per MODULE_DISCOVERY_CRITERIA) and matches no existing module: create L1 immediately, add to MODULE_INDEX. If the current diff includes Added or Modified source files in this module → also create L2 immediately with sections: MODULE, FILES, RESPONSIBILITY, INTERFACES, DATA_FLOW, KEY_FILES, DEPENDENCIES, RULES, TRAPS, DECISIONS, CHANGELOG. Otherwise defer L2.
6a. **L2 gap check** (runs during full rescan mode only — when no git changes detected): For each existing module in MODULE_INDEX, check if L2 doc exists. If L2 is missing and the module has source files with meaningful logic (not trivial config/wrapper) → create L2 with sections: MODULE, FILES, RESPONSIBILITY, INTERFACES, DATA_FLOW, KEY_FILES, DEPENDENCIES, RULES, TRAPS, DECISIONS, CHANGELOG. This ensures Update fills documentation gaps left by previous sessions.
7. Append entries to changelog.prizm using format: `- <module-path> | <verb>: <description>`
8. Enforce size limits: L0 > 4KB -> consolidate. L1 > 4KB -> trim KEY_FILES descriptions, ensure RULES <= 3 entries. L2 > 5KB -> split or archive.
9. Stage updated .prizm files via `git add .prizm-docs/`

OUTPUT: List of updated/created/skipped docs with reasons.

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

