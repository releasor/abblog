## Test Failure Recovery Protocol

When tests fail during implementation, use **convergence-based recovery** — keep fixing as long as progress is being made.

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

### Escalation — Single Agent

When the recovery loop exits with remaining failures:
- Document all remaining failures in Implementation Log with root cause analysis
- Record PARTIAL status with known failure list
- **Do NOT block commit** — unresolved test failures are deferred to next session

### Context-Aware Optimization

**Skip redundant re-runs**: If Implementation Log already confirms "all tests passing", skip full suite re-run.

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
