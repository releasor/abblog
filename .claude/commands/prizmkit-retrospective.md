---
description: "Incremental .prizm-docs/ maintainer. Performs two jobs: (1) structural sync — update .prizm-docs/ KEY_FILES/INTERFACES/DEPENDENCIES, (2) architecture knowledge — inject TRAPS/RULES/DECISIONS into .prizm-docs/. All project knowledge lives in .prizm-docs/ . Run after code review passes and before committing. Trigger on: 'retrospective', 'retro', 'update docs', 'sync docs', 'wrap up', 'done with feature', 'feature complete'. (project)"
---

# PrizmKit Retrospective

| Store | Location | Content | Purpose |
|-------|----------|---------|---------|
| **Architecture Index** | `.prizm-docs/` | MODULE, FILES, INTERFACES, DEPENDENCIES, TRAPS, RULES, DECISIONS | AI quickly locates code structure, interfaces, known pitfalls, and key design decisions |

**This skill handles both structural sync and knowledge injection in one pass:**

1. **Structural Sync** — reflect what changed in code → `.prizm-docs/` (KEY_FILES, INTERFACES, DEPENDENCIES, file counts)
2. **Architecture Knowledge** — inject TRAPS, RULES, and DECISIONS → `.prizm-docs/`

For initial doc setup, validation, or migration, use `/prizmkit-prizm-docs` instead.

## When to Use

- **Before every commit** (mandatory in pipeline) — ensures docs and code are in sync
- After completing a feature, refactoring, or bug fix
- After code review passes
- User says "retrospective", "retro", "update docs", "sync docs", "wrap up"

## Input

| Parameter | Required | Description |
|-----------|----------|-------------|
| `artifact_dir` | No | Directory containing spec.md, plan.md, review-report.md. If omitted, scan `.prizmkit/` subdirectories for the most recently modified directory with a `plan.md`. If no artifact directory found, run in standalone mode (structural sync only from `git diff`). |

## When NOT to Use

- Only comments, whitespace, or formatting changed — no structural/knowledge change
- Only test files changed — no module-level impact
- Only .prizm files changed — avoid circular updates

---

### Job 1: Structural Sync (always runs)
Synchronize `.prizm-docs/` structure with actual codebase changes from this session.
→ Read `.claude/command-assets/prizmkit-retrospective/references/structural-sync-steps.md` for the detailed procedure.

**Key outputs**: Updated L1 file counts, L2 INTERFACES/DATA_FLOW, changelog entries, stale TRAPS cleanup.

---

### Job 2: Knowledge Injection (conditional)
Inject newly discovered project knowledge (TRAPS, RULES, DECISIONS) into architecture docs.
→ Read `.claude/command-assets/prizmkit-retrospective/references/knowledge-injection-steps.md` for the detailed procedure.

**Review gate**: Before running Job 2, check `review-report.md` in the artifact directory for the `## Verdict:` line:
- Verdict is `PASS` → proceed
- Verdict is `NEEDS_FIXES` → **skip Job 2** — do not inject knowledge for code that hasn't passed review. Output warning: "Review report has unresolved findings. Skipping knowledge injection."
- No `review-report.md` found → proceed with warning
- No artifact directory (standalone mode) → skip Job 2, only Job 1 runs

**Skip for**: pure refactors (no behavioral change).

**Bug Fix Documentation Policy**:
- DEFAULT for bug fixes: Run Job 1 (structural sync) only. Skip Job 2 (knowledge injection).
- RUN Job 2 when the bug fix causes any of:
  • Interface signature changes
  • Dependency additions/removals
  • Observable behavior changes to existing features
  • Newly discovered TRAPs (gotchas/pitfalls)
- When any of the above apply, run full retrospective (Job 1 + Job 2).

**Key outputs**: New TRAPS entries, RULES updates, DECISIONS records in relevant L1/L2 docs and root.prizm.

---

## Final: Changelog + Stage

**3a.** Append to `.prizm-docs/changelog.prizm`:
- Format: `<module-path> | <verb>: <one-line description>`
- Verbs: add, update, fix, remove, refactor, rename, deprecate
- One entry per meaningful change, not one per file

**3b.** Stage all doc changes:
```bash
git add .prizm-docs/
```

**HANDOFF:** `/prizmkit-committer`

## Output

- `.prizm-docs/*.prizm` — Structurally synced + TRAPS/RULES/DECISIONS enriched
- `.prizm-docs/changelog.prizm` — Appended entries
- All `.prizm-docs/` changes staged via `git add`

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

