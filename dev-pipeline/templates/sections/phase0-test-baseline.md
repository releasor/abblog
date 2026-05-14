### Phase 0: Record Test Baseline & Detect Test Commands

**Step 1 — Detect test commands**: You know this project's tech stack. Identify ALL test commands that apply (e.g., `go test ./...`, `npm test`, `cargo test`, `pytest`, `make test`, etc.). Record them as `TEST_CMDS`.

**Step 2 — Record pre-existing failure baseline**:
```bash
# Run each test command, capture output
($TEST_CMD) 2>&1 | tee /tmp/test-baseline.txt | tail -20
```
Save the list of **pre-existing failing tests** (if any) as `BASELINE_FAILURES`. These are known failures that existed before this session — Dev must NOT be blamed for them, but must list them in COMPLETION_SIGNAL.

> **Test Output Rule**: Always capture test output to a temp file (`tee /tmp/test-out.txt`). Then grep the file instead of re-running the suite.


**Checkpoint update**: Update `workflow-checkpoint.json` — set step `test-baseline` to `"completed"`.
