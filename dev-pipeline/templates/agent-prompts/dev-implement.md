"Read {{DEV_SUBAGENT_PATH}}. Implement feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}).
**IMPORTANT**: Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST — Section 3 has Prizm Context (TRAPS/RULES), Section 4 has File Manifest with paths and interfaces.
⚠️ DO NOT re-read source files already listed in Section 4 File Manifest unless you need implementation detail beyond the interface summary.
1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` for full context.
2. Run `/prizmkit-implement` to execute the tasks in plan.md. Run tests with: `{{TEST_CMD}}`. Known baseline failures (pre-existing, not your fault): `{{BASELINE_FAILURES}}`.
3. If plan.md has more than 5 tasks: run `/compact` after completing every 3 tasks to manage context budget. If `/compact` is unavailable, continue without it.
4. After implement completes, verify the '## Implementation Log' section was written to context-snapshot.md.

## Acceptance Criteria Verification

Update the AC Verification Checklist in context-snapshot.md by marking each item [x] as you verify it:
- As you complete each task, verify the corresponding acceptance criteria
- Check the AC Checklist at the end of implementation
- All [ ] must become [x] — if any AC remains unverified, the feature is incomplete
- Document any AC that cannot be verified due to test failures

## Test Failure Recovery (Convergence-Based)

If tests fail, use convergence recovery — keep fixing while progress is being made:

1. **Run tests, record results**: count failures, exclude baseline failures
2. **Check termination**: All pass → done | Plateau (same failures 3 rounds) → stop | Failures decreased → continue
3. **Fix and iterate**: analyze, apply fix, re-run `($TEST_CMD)`, go back to step 1

**Key rule**: If failures decrease (even by 1), plateau counter resets.
**Do NOT block completion** if unable to resolve — only NEW REGRESSIONS (not in baseline) require fixing.
**If any AC cannot be verified** due to test failure: the feature is incomplete, add to failure notes.

4. Do NOT execute any git commands (no git add/commit/reset/push).
Do NOT exit until all tasks are [x], the '## Implementation Log' section is written, and AC Verification Checklist is 100% complete in context-snapshot.md."
