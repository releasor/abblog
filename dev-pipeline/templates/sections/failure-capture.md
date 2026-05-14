## Failure Capture Protocol

If you encounter an unrecoverable error, context overflow, or are about to exit without completing all phases:

1. Write `.prizmkit/specs/{{FEATURE_SLUG}}/failure-log.md` BEFORE exiting:
   ```
   FAILURE_TYPE: timeout | test_failure | review_rejected | context_overflow | unknown
   PHASE: <which phase failed>
   ROOT_CAUSE: <1-2 sentence explanation>
   ATTEMPTED: <approaches already tried>
   SUGGESTION: <what the next session should try differently>
   DISCOVERED_TRAPS:
   - [CRITICAL|HIGH|LOW] <gotcha discovered during this failed session> | FIX: <approach>
   ```

2. This file is intentionally lightweight — write it BEFORE context runs out.

**Lifecycle**: failure-log.md is a temporary cross-session artifact. Do NOT commit it to git. After a successful session (all phases complete + commit done), delete it:
```bash
rm -f .prizmkit/specs/{{FEATURE_SLUG}}/failure-log.md
```
