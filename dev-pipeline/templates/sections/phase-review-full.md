### Review + Test — Code Review

Run `/prizmkit-code-review` with `artifact_dir=.prizmkit/specs/{{FEATURE_SLUG}}/`.

The skill runs an internal review-fix loop (Reviewer Agent → filter → Dev Agent fix, max 3 rounds) and writes `review-report.md` to the artifact directory.

**Gate Check — Review Report**:
After `/prizmkit-code-review` returns, verify the review report:
```bash
grep -q "## Verdict" .prizmkit/specs/{{FEATURE_SLUG}}/review-report.md && echo "GATE:PASS" || echo "GATE:MISSING"
```
If GATE:MISSING — re-run `/prizmkit-code-review`.

Read `review-report.md` and check the Verdict:
- `PASS` → proceed to next phase
- `NEEDS_FIXES` → the skill exhausted its max rounds; log the remaining findings and proceed (do not retry externally)

Run the full test suite: `({{TEST_CMD}}) 2>&1 | tee /tmp/review-test-out.txt | tail -20`

**CP-3**: Review complete, tests pass, report written.


**Checkpoint update**: Update `workflow-checkpoint.json` — set step `prizmkit-code-review` to `"completed"`.
