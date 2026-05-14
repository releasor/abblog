## PrizmKit Directory Convention

```
.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md  ← orchestrator writes Sections 1-4; Dev appends Implementation Log; Reviewer appends Review Notes
.prizmkit/specs/{{FEATURE_SLUG}}/spec.md
.prizmkit/specs/{{FEATURE_SLUG}}/plan.md              ← includes Tasks section
```

**`context-snapshot.md`** is the shared knowledge base. Orchestrator writes Sections 1-4; Dev appends Implementation Log; Reviewer appends Review Notes. This eliminates redundant I/O across all agents.
