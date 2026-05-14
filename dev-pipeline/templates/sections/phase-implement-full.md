### Implement — Dev Agent

**Build artifacts rule** (passed to Dev): After any build/compile command (`go build`, `npm run build`, `tsc`, etc.), ensure the output binary or build directory is in `.gitignore`. Never commit compiled binaries, build output, or generated artifacts.

**Dependency version gate (BLOCKING — pass to Dev agent)**: Before running ANY package install command (`npm install`, `pip install`, `cargo build`, `go mod tidy`, `bundle install`, etc.):
1. Every version number in the dependency manifest MUST be verified against the real registry (see Context Budget Rules §9)
2. If a scaffold tool generated a `package.json` / `requirements.txt` / etc., verify the versions it wrote too — scaffold tools can emit outdated versions
3. Do NOT proceed with install until all versions are confirmed real. Violation = wasted timeout cycles that can crash the session

**Scaffold file rule (pass to Dev agent)**: After running any init/scaffold command, record generated files in context-snapshot.md under `### Scaffold Files (do not re-read)`. Never re-read these files — their content is standard boilerplate (see Context Budget Rules §8). When spawning subagents, explicitly list scaffold files so they skip reading them.

Before spawning Dev, check plan.md Tasks section:
```bash
grep -c '^\- \[ \]' .prizmkit/specs/{{FEATURE_SLUG}}/plan.md 2>/dev/null || true
```
- If result is `0` (all tasks already `[x]`) → **SKIP this phase**, go directly to Review. Do NOT spawn Dev.
- If result is non-zero → spawn Dev agent below.

**Spawn Agent**:
| Parameter | Value |
|-----------|-------|
| subagent_type | prizm-dev-team-dev |
| run_in_background | false |

**Prompt**:
> {{AGENT_PROMPT_DEV_IMPLEMENT}}

**Gate Check — Implementation Log**:
After Dev agent returns, verify the Implementation Log was written:
```bash
grep -q "## Implementation Log" .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md && echo "GATE:PASS" || echo "GATE:MISSING"
```
If GATE:MISSING — send message to Dev (re-spawn if needed): "Write the '## Implementation Log' section to context-snapshot.md before I can proceed to review. Include: files changed/created, key decisions, deviations from plan, notable discoveries."

Wait for Dev to return. **If Dev times out before all tasks are `[x]`**:
1. Check progress: `grep -c '^\- \[ \]' .prizmkit/specs/{{FEATURE_SLUG}}/plan.md`
2. If any tasks remain: re-spawn Dev with this recovery prompt:
   > {{AGENT_PROMPT_DEV_RESUME}}
3. Max 2 recovery retries. After 2 failures, orchestrator implements remaining tasks directly.

All tasks `[x]`, tests pass.


**Checkpoint update**: Update `workflow-checkpoint.json` — set step `prizmkit-implement` to `"completed"`.
