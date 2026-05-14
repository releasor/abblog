## Test Failure Recovery Protocol

When tests fail during implementation (Phase 3 / Phase 4), use **convergence-based recovery** — keep fixing as long as progress is being made.

### Recovery Loop

1. **Run tests and record results**:
   - Count total failures and note which tests failed
   - Compare against baseline (BASELINE_FAILURES) — exclude pre-existing failures

2. **Check termination conditions** (evaluate BEFORE each fix attempt):
   - **All tests pass** → Done. Exit recovery loop.
   - **Plateau detected** — same failure count AND same failing tests for 3 consecutive rounds → AI cannot resolve these failures. Document and exit.
   - **Still making progress** — failure count decreased compared to previous round → Continue fixing.
   - **First round** — no history yet → Proceed to fix.

3. **Fix and iterate**:
   - Analyze remaining failures: root cause (code bug vs. test brittleness vs. environment issue)
   - Categorize:
     - **Pre-existing baseline failure**: Expected, do NOT fix
     - **New regression**: Fix the code
     - **Brittle test**: Fix the test or environment setup
   - Apply fix, re-run `($TEST_CMD)`, go back to step 1

### Convergence Tracking

Track failures each round. Example: 5→3→3→3→3 = plateau at round 3, stop at round 5 (3/3).

**Key rule**: If failures decrease (even by 1), the plateau counter resets to 0.

### Escalation — Dev + Reviewer Workflow

When the recovery loop exits with remaining failures:
- Dev appends failure details to Implementation Log
- Reviewer agent runs full test suite in Phase 5
- If Reviewer confirms NEW regressions (not in baseline): mark verdict as `NEEDS_FIXES`
- If Reviewer confirms only baseline failures remain: proceed with `PASS_WITH_WARNINGS`

### Context-Aware Test Re-run (Performance Optimization)

**Skip redundant re-runs**:
- If Implementation Log section in context-snapshot.md already confirms "all tests passing"
- → Skip Phase 5 test suite re-run (Reviewer will verify baseline log instead)
- This avoids rebuilding/re-running tests when already verified

**When to re-run**:
- If Implementation Log is missing or incomplete
- If any new code was added after the last test run
- If Reviewer suspects brittleness or environment drift

### Failure Capture Rules

If tests remain broken after recovery:

```
## Test Failures Encountered

- **Test**: [test name/path]
  - Root Cause: [explanation]
  - Category: [pre-existing baseline | new regression | brittle test | environment]
  - Rounds Attempted: [N rounds, plateau at round M]
  - Status: [still failing | requires next session | known limitation]

- **Impact on Feature**: [can AC be verified despite failure | blocks AC verification]
```

**Rule**: If any AC cannot be verified due to test failure, the feature is incomplete. Document in failure-log.md for next session.
