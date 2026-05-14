### Plan & Tasks

```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/ 2>/dev/null
```

If plan.md missing, run `/prizmkit-plan` with `artifact_dir=.prizmkit/specs/{{FEATURE_SLUG}}/`:
- Pass the feature description and acceptance criteria from the Feature Context section above as input
- The plan.md should include: key components, data flow, files to create/modify, and a Tasks section with `[ ]` checkboxes (each task = one implementable unit). Keep under 80 lines.
- Resolve any `[NEEDS CLARIFICATION]` markers using the feature description — do NOT pause for interactive input.

**Database Design Gate** (if feature involves data persistence — new tables, schema changes, new entities):
Before proceeding past CP-1:
1. Scan for existing schema files (`*.prisma`, `*.sql`, `migrations/`, `models/`, `*.entity.*`) and read them
2. Ensure new tables/fields follow existing naming conventions and constraint patterns
3. Resolve all uncertain DB design decisions before writing Tasks — document choices in plan.md

**CP-1**: plan.md exists with Tasks section.


**Checkpoint update**: Update `workflow-checkpoint.json` — set step `prizmkit-plan` to `"completed"`.
