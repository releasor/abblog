"Read {{DEV_SUBAGENT_PATH}}. Fix NEEDS_FIXES issues for feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}).
1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/review-report.md` — contains structured Fix Instructions with exact steps.
2. Follow Fix Instructions in order (respect Depends On / Blocks dependencies). Each FIX-N has: Root Cause, Fix Strategy, Code Guidance, and Verification criteria.
3. After each fix, run the Verification command listed in that FIX-N to confirm it works.
4. Run `{{TEST_CMD}}` to verify no regressions.
5. Append fix summary to '## Implementation Log' in context-snapshot.md.
6. Do NOT execute any git commands."
