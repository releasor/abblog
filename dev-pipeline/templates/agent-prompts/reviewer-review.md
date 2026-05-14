"Read {{REVIEWER_SUBAGENT_PATH}}. For feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}):
1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/spec.md` (if it exists) for goals and acceptance criteria; if spec.md does not exist, read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` Section 1 instead
2. Read `.prizmkit/specs/{{FEATURE_SLUG}}/plan.md` for architecture decisions and completed tasks
3. Run /prizmkit-code-review with artifact_dir=.prizmkit/specs/{{FEATURE_SLUG}}/. The skill will run its internal review-fix loop (Reviewer → filter → Dev fix, max 3 rounds) and write review-report.md.
4. Run the full test suite using `{{TEST_CMD}}`. When running tests: `({{TEST_CMD}}) 2>&1 | tee /tmp/review-test-out.txt | tail -20`, then grep `/tmp/review-test-out.txt` for details — do NOT re-run the suite multiple times.
5. review-report.md will be written to .prizmkit/specs/{{FEATURE_SLUG}}/ by prizmkit-code-review.
Report: verdict (PASS/NEEDS_FIXES), number of rounds, findings fixed/rejected."
