### Architecture Sync & Commit (SINGLE COMMIT)

**a.** Run `/prizmkit-retrospective` — maintains `.prizm-docs/` (architecture index):
1. **Structural sync**: Use `git diff --cached --name-status` to locate changed modules, update KEY_FILES/INTERFACES/DEPENDENCIES/file counts in affected `.prizm-docs/` files
2. **Architecture knowledge** (feature sessions only): Extract TRAPS/RULES/DECISIONS from completed work into `.prizm-docs/`
3. **L2 coverage check**: For any module/sub-module with source files created or significantly modified in this session but no L2 `.prizm` doc — evaluate whether L2 is warranted and create if so. The current session has the best context for accurate KEY_FILES, TRAPS, and DECISIONS.
4. Stage doc changes: `git add .prizm-docs/`
⚠️ Do NOT commit here. Only stage.

**b.** Stage all feature code explicitly (NEVER use `git add -A` or `git add .`):
```bash
git add <specific-files-created-or-modified>
git add .prizm-docs/
```

**c.** Run `/prizmkit-committer` → THE ONLY commit for this feature:
`feat({{FEATURE_ID}}): {{FEATURE_TITLE}}`
This single commit includes: feature code + tests + .prizm-docs/ updates. Do NOT push.
- MANDATORY: commit must be done via `/prizmkit-committer` skill. Do NOT run manual `git add`/`git commit` as a substitute.
- Do NOT run `update-feature-status.py` here — the pipeline runner handles feature-list.json updates automatically after session exit.

**d.** Final verification:
```bash
git status --short
```
Working tree MUST be clean after this step. If any feature-related files remain, stage them into the SAME commit via `git add <file> && git commit --amend --no-edit`, do NOT create a separate commit.

**e.** Write completion summary for downstream dependency context:

Write `.prizmkit/specs/{{FEATURE_SLUG}}/completion-summary.json` with the key changes from this session. This file is NOT committed to git — the pipeline runner reads it to propagate context to dependent features.

```json
{
  "completion_notes": [
    "<each item: one key change, API, model, or integration point that downstream features may need>",
    "Example: Added User model (id, email, password_hash, display_name) in prisma/schema.prisma",
    "Example: POST /api/auth/register and POST /api/auth/login endpoints in src/api/auth.ts",
    "Example: Auth middleware in src/middleware/auth.ts — validates JWT on protected routes"
  ]
}
```

Rules for writing completion notes:
- Focus on **what downstream features need to know**: new APIs, models, exported functions, key file paths
- Each note should be self-contained and concise (one line, under 120 characters preferred)
- Include 3-8 notes covering the most important changes
- Do NOT include test files, config changes, or internal implementation details unless they affect other features
- If this feature has no downstream dependents, still write the summary (it serves as documentation)


**Checkpoint update**: After `/prizmkit-retrospective` completes, update `workflow-checkpoint.json` — set step `prizmkit-retrospective` to `"completed"`. After `/prizmkit-committer` completes, set step `prizmkit-committer` to `"completed"`.
