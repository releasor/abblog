### Specify + Plan (Full Workflow)

Check existing artifacts first:
```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/ 2>/dev/null
```

- Both (spec.md, plan.md) exist → **SKIP to CP-1**
- `context-snapshot.md` exists → use it directly, skip context snapshot building
- Some missing → generate only missing files

**Step A — Build Context Snapshot** (skip if `context-snapshot.md` already exists):

1. Read `.prizm-docs/root.prizm` and relevant L1/L2 prizm docs
2. Detect source code directories: read KEY_FILES and STRUCTURE sections from `root.prizm` to identify where source code lives (e.g. `src/`, `app/`, `lib/`, `cmd/`, `packages/`, or project root). If `root.prizm` is missing, scan the project tree:
   ```bash
   find . -maxdepth 2 -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.go" -o -name "*.java" -o -name "*.rb" -o -name "*.rs" \) -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/vendor/*' | head -30
   ```
   Identify the top-level source directories from the results.
3. Scan the detected source directories for files related to this feature; read each one
4. Write `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`:
   - **Section 1 — Task Brief**: task description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: run the following to get a visual directory tree, then paste output:
     ```bash
     find . -maxdepth 2 -type d -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/__pycache__/*' -not -path '*/vendor/*' | sed -e 's;[^/]*/;|____;g;s;____|; |;g'
     ```
   - **Section 3 — Prizm Context**: full content of root.prizm and relevant L1/L2 docs
   - **Section 4 — File Manifest**: For each file relevant to this feature, list: file path, why it's needed (modify/reference/test), key interface signatures (function names + params + return types). Do NOT include full file content — agents read files on-demand. Format:
     ### Files to Modify
     | File | Why Needed | Key Interfaces |
     |------|-----------|----------------|
     | `<source-dir>/config.js` | Add runtime config layer | `config` (Zod object), `configSchema` |

     ### Files for Reference
     | File | Why Needed | Key Interfaces |
     |------|-----------|----------------|
     | `<source-dir>/security/permission-guard.js` | Permission check integration | `checkCommandPermission(userId, cmd)` |

     ### Known TRAPS (from .prizm-docs/)
     - <trap entries extracted from L1/L2 docs>
   - **Section 5 — Existing Tests**: full content of related test files as code blocks
5. Confirm: `ls .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`

**After Step A**: Use context-snapshot.md Section 4 File Manifest to guide targeted file reads. Do NOT scan directories or read unrelated files.

**Step B — Planning Artifacts** (generate only missing files):

```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/spec.md .prizmkit/specs/{{FEATURE_SLUG}}/plan.md 2>/dev/null
```

- spec.md missing: Run `/prizmkit-plan` → generate spec.md. Resolve any `[NEEDS CLARIFICATION]` markers using the task description — do NOT pause for interactive input.
- plan.md missing: Run `/prizmkit-plan` → generate plan.md (change approach, components, interface design, data model, testing strategy, risk assessment, and Tasks section with `[ ]` checkboxes)

> All files go under `.prizmkit/specs/{{FEATURE_SLUG}}/`. Confirm each with `ls` after writing.

**Database Design Gate** (if feature involves data persistence — new tables, schema changes, new entities):
Before proceeding past CP-1, verify:
1. Plan.md Data Model section references existing schema/model files (scan for `*.prisma`, `*.sql`, `migrations/`, `models/`, `*.entity.*` files; read them if not already in context-snapshot)
2. All new tables/fields follow existing naming conventions, ID strategy, timestamp patterns, and constraint style
3. No `[NEEDS CLARIFICATION]` remains in Data Model section — resolve by reading existing code and making a conservative choice that matches existing patterns. Document the resolution in plan.md.
4. If a DB design decision genuinely cannot be resolved from existing code alone, document the assumption made and flag it in the Implementation Log for user review.

**CP-1**: Both spec.md and plan.md exist.


**Checkpoint update**: Update `workflow-checkpoint.json` — set step `context-snapshot-and-plan` to `"completed"`.
