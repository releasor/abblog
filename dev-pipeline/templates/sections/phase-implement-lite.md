### Implement + Test

**Build artifacts**: After any build/compile command (`go build`, `npm run build`, `tsc`, etc.), ensure the output binary or build directory is in `.gitignore`:
```bash
# Example for Go
grep -q '^/binary-name$' .gitignore || echo '/binary-name' >> .gitignore
```
Never commit compiled binaries, build output, or generated artifacts.

**Dependency version gate (BLOCKING)**: Before running ANY package install command (`npm install`, `pip install`, `cargo build`, `go mod tidy`, `bundle install`, etc.):
1. Every version number in your dependency manifest MUST be verified against the real registry (see Context Budget Rules §9)
2. If you used a scaffold tool that generated a `package.json` / `requirements.txt` / etc., verify the versions it wrote too — scaffold tools can emit outdated versions
3. Do NOT proceed with install until all versions are confirmed real. Violation = wasted timeout cycles

**Scaffold file rule**: After running any init/scaffold command, record generated files in context-snapshot.md under `### Scaffold Files (do not re-read)`. Never re-read these files — their content is standard boilerplate (see Context Budget Rules §8).

**3a.** Detect test commands and record baseline:

You know this project's tech stack. Identify ALL test commands that apply (e.g., `go test ./...`, `npm test`, `cargo test`, `pytest`, `make test`, etc.). Record them as `TEST_CMDS`. Then record baseline:
```bash
# Run each test command, capture output
($TEST_CMD) 2>&1 | tee /tmp/test-baseline.txt | tail -20
```

**3b.** Run `/prizmkit-implement` — this handles the full implementation cycle:
- Reads plan.md Tasks section from `.prizmkit/specs/{{FEATURE_SLUG}}/`
- Reads context from `context-snapshot.md` (Prizm docs, TRAPS, file manifest)
- Implements task-by-task with TDD, marking each `[x]` immediately
- Creates/updates L2 `.prizm` docs when creating new modules or significantly modifying existing ones — AI selectively decides which modules warrant L2 based on complexity and importance
- Runs tests using `TEST_CMD` after each task
- Writes '## Implementation Log' to `context-snapshot.md`

**3c.** After implement completes, verify:
1. All tasks in plan.md are `[x]`
2. Run the full test suite to ensure nothing is broken
3. Verify each acceptance criterion from Section 1 of context-snapshot.md is met — check mentally, do NOT re-read files you already wrote
4. If any criterion is not met, fix it now using the convergence-based recovery loop (see Test Failure Recovery Protocol)

**CP-2**: All acceptance criteria met, all tests pass.


**Checkpoint update**: Update `workflow-checkpoint.json` — set step `prizmkit-implement` to `"completed"`.
