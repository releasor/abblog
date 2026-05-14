# Architecture Decision Capture

During planning, key **framework-level** architectural decisions may emerge. When they do, capture them in the project instruction file so all future AI sessions have this context.

## What Qualifies (ALL must apply)

Only capture decisions that are **framework-shaping** — NOT individual feature details. Qualifying categories:

| Category | Examples |
|----------|----------|
| Tech stack choices | PostgreSQL over MongoDB, React over Vue, Node.js runtime |
| Communication patterns | REST vs GraphQL, WebSocket vs SSE vs polling |
| Architectural patterns | Monorepo, microservices, monolith, event-driven |
| Data model strategies | Relational vs document, event sourcing, CQRS |
| Security architecture | JWT vs session, OAuth provider, RBAC model |

**Do NOT capture**: individual feature implementation details, UI component choices, specific API endpoint designs, or anything scoped to a single feature.

**This is conditional** — most planning sessions will NOT produce architecture decisions. Only capture when genuinely impactful decisions are made during the discussion.

## When to Capture

After Phase 2 (Confirm constraints and tech assumptions), before Phase 3 (Capture architecture decisions and finalize project brief). At this point decisions are settled.

## How to Capture

1. **Detect platform** — determine which project instruction file to update:
   - `.claude/` directory exists → append to `CLAUDE.md`
   - `.codebuddy/` directory exists → append to `CODEBUDDY.md`
   - Both exist → append to both
   - Neither exists → skip (no project instruction file)

2. **Check for existing section** — read the target file and look for `### Architecture Decisions` heading:
   - If heading exists → append new entries below it (avoid duplicates with existing entries)
   - If heading does not exist → create it at the end of the file

3. **Format** — one line per decision, no feature IDs:
   ```markdown
   ### Architecture Decisions
   - WebSocket for real-time: sub-second latency required for collaboration features
   - PostgreSQL: relational data model with complex queries, ACID compliance needed
   - Monorepo structure: shared types between frontend and backend
   ```

4. **User confirmation** — before writing, show the collected decisions and ask:
   > "These architecture decisions were identified during planning. Record them to [CLAUDE.md / CODEBUDDY.md]? (Y/n)"

   If user declines, skip without further prompting.

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

