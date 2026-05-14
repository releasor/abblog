# Error Recovery & Resume Support

Structured error handling for validation failures, interrupted sessions, and checkpoint-based resumption.

## Validation Failures

When `python scripts/validate-and-generate.py validate --input <file> --mode <mode>` returns errors:

### Parse validation output
Script returns JSON with `"valid": false`, `"errors": [...]`, `"warnings": [...]`

### Decision Tree

**if `error_count == 0` (warnings only):**
- Proceed with user approval
- Show warnings and ask: "Continue? (Y/n)"

**elif `error_count > 0` (critical errors):**

Group errors by type and apply targeted fixes:

| Error Type | Symptom | Fix Offered | Auto-Fix? |
|-----------|---------|------------|-----------|
| **Schema mismatch** | `$schema` invalid, missing `project_name`, wrong `features` type | "Set `$schema` to `dev-pipeline-feature-list-v1`, `project_name` to string" | Yes |
| **Feature ID issues** | Invalid format (not `F-NNN`), duplicate IDs, undefined refs | "Suggest corrected IDs, show duplicates" | Yes |
| **Dependency errors** | Circular dependency, undefined target features | "Show cycle chain (e.g., `F-003 → F-005 → F-003`), suggest break point" | No |
| **Missing fields** | Feature missing required keys (title, description, AC) | "List each feature + missing keys, guide patch" | Partial |
| **Insufficient AC** | Feature has <2 acceptance criteria | "Show feature, suggest AC examples" | No |
| **Invalid values** | complexity not in [low/medium/high/critical], status not pending | "Show field, valid values" | Yes |

### Execution

```
For auto-fixable errors:
  1. Show summary: "Found N schema/ID/format issues"
  2. Offer: auto-fix? (Y/n)
  3. Apply fix → regenerate file
  4. Re-run validation
  5. If new errors → loop (max 2 more attempts)

For manual fixes (dependencies, AC content):
  1. Show concise prompt: "Edit line X-Y in feature-list.json"
  2. Wait for user action
  3. Retry validation (max 2 more attempts)

if all_retries_exceeded:
  → Escalate: "After 3 attempts, validation still fails.
              (a) Review file manually, OR
              (b) Restart planning from Phase 1"
```

## Resume Support

feature-planner sessions can be resumed from the last completed checkpoint when artifacts are found.

### Detection Logic

Check for artifact files in `.prizmkit/plans/`:

| Artifacts Found | Resume Action |
|-----------------|---------------|
| None | Start fresh planning (Phase 1) |
| `feature-list.json` exists but not validated | Offer to validate or extend (Phase 9) |
| `feature-list.json` + validation passed | Offer: handoff to `feature-pipeline-launcher` |
| `feature-list.draft.json` only | Resume interactive planning from last checkpoint |

When existing file detected, suggest:
> "Existing plan found with N features. Resume incremental planning? (Y/n)"

### Incremental Mode Abort

If in Incremental mode but existing `feature-list.json` not found:
- Ask: "Start new plan or provide existing file?"
- If new plan chosen → switch to Route A (New Feature Set)

### Artifact Path Convention

**CRITICAL PATH RULE**: `feature-list.json` MUST be written to `.prizmkit/plans/` directory.

Before writing, verify the directory exists: `mkdir -p .prizmkit/plans`

```
<project-root>/
  └── .prizmkit/plans/
      ├── feature-list.json              # Primary output
      ├── feature-list.draft.json        # Draft backup (Session Exit Gate)
      └── <ISO-timestamp>.backup.json    # Optional incremental backups
```

> **Note**: For cross-session workflow recovery (e.g., interrupted pipeline execution, branch-level state detection), use `recovery-workflow` instead. This error-recovery reference handles only within-session validation retries and checkpoint resumption.

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

