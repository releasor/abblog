"Read {{DEV_SUBAGENT_PATH}}. You are resuming implementation of feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}).
1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` — Section 4 has File Manifest, 'Implementation Log' (if present) shows what was already done.
2. Run `git diff HEAD` to see actual code changes already made.
3. Run `/prizmkit-implement` to complete the remaining `[ ]` tasks. Run tests with: `{{TEST_CMD}}`.
4. Do NOT execute any git commands."
