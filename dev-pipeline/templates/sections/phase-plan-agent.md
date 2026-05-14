### Plan & Tasks

```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/plan.md 2>/dev/null
```

If missing, run `/prizmkit-plan` with `artifact_dir=.prizmkit/specs/{{FEATURE_SLUG}}/` to generate `plan.md`:
- The plan.md should include: architecture — components, interfaces, data flow, files to create/modify, testing approach, and a Tasks section with `[ ]` checkboxes ordered by dependency.
- Resolve any `[NEEDS CLARIFICATION]` markers using the feature description — do NOT pause for interactive input.

**Database Design Gate** (if feature involves data persistence — new tables, schema changes, new entities):
Before proceeding past CP-1, verify:
1. Plan.md Data Model section references existing schema/model files (scan for `*.prisma`, `*.sql`, `migrations/`, `models/`, `*.entity.*` files; read them if not already in context-snapshot)
2. All new tables/fields follow existing naming conventions, ID strategy, timestamp patterns, and constraint style
3. No `[NEEDS CLARIFICATION]` remains in Data Model section — resolve by reading existing code and making a conservative choice that matches existing patterns. Document the resolution in plan.md.
4. If a DB design decision genuinely cannot be resolved from existing code alone, document the assumption made and flag it in the Implementation Log for user review.

**CP-1**: plan.md exists with Tasks section.


**Checkpoint update**: Update `workflow-checkpoint.json` — set step `prizmkit-plan` to `"completed"`.
