---
name: refactor-pipeline-launcher
description: "Launch and manage the refactor pipeline from within an AI CLI session. Start pipeline in background, monitor logs, check status, stop pipeline. Use this skill whenever the user wants to start refactoring, run the refactor pipeline, check refactor progress, retry refactors, or stop the pipeline. Trigger on: 'run refactor pipeline', 'start refactoring', 'refactor pipeline status', 'stop refactor pipeline', 'retry refactor', 'launch refactor pipeline'. (project)"
---

# Refactor Pipeline Launcher

Launch the autonomous refactor pipeline from within an AI CLI conversation. The pipeline runs as a fully detached background process -- closing the AI CLI session does NOT stop the pipeline.

### Execution Mode

Three execution modes are available. The user chooses one before configuring other options:

1. **Foreground** (recommended) — `dev-pipeline/run-refactor.ps1 run`. Visible output, direct error feedback, no orphaned processes.
2. **Background daemon** — `dev-pipeline/launch-refactor-daemon.ps1`. Runs fully detached, survives AI CLI session closure.
3. **Manual** — Display the assembled command(s) only. Do not execute anything. User runs them on their own.

### When to Use

**Start pipeline** -- User says:
- "run refactor pipeline", "start refactoring", "launch refactor pipeline"
- "execute refactor list", "refactor all", "start refactoring tasks"
- After refactor-planner completes: "refactor it", "start refactoring from the list"

**Check status** -- User says:
- "refactor pipeline status", "refactor progress", "check refactoring"
- "how's the refactoring going", "refactor status"

**Stop pipeline** -- User says:
- "stop refactor pipeline", "stop refactoring", "halt refactor", "pause refactoring"

**Show logs** -- User says:
- "refactor logs", "show refactor logs", "what's being refactored"
- "view refactor logs"

**Retry single refactor** -- User says:
- "retry R-001", "retry this refactor", "re-run R-001"

**Do NOT use this skill when:**
- User wants to plan refactoring (use `refactor-planner` instead)
- User wants a single interactive refactor in current session (use `refactor-workflow` — but note it will delegate back here for batch execution)
- User wants to implement features (use `feature-pipeline-launcher`)

### Prerequisites

Before any action, validate:

1. **refactor pipeline exists**: Confirm `dev-pipeline/launch-refactor-daemon.ps1` and `dev-pipeline/run-refactor.ps1` are present and executable
2. **For start**: `.prizmkit/plans/refactor-list.json` must exist in `.prizmkit/plans/` (or user-specified path)
3. **Dependencies**: `jq`, `python`, AI CLI (`cbc` or `claude`) must be in PATH
4. **Python version**: Requires Python 3.8+ for dev-pipeline scripts
5. **Browser tools** (optional): If any refactor has `browser_interaction` field, check the corresponding tool is available. Refactors may specify `tool: "playwright-cli"`, `tool: "opencli"`, or `tool: "auto"` (AI chooses at runtime).

Quick check:
```bash
command -v jq && command -v python && (command -v cbc || command -v claude) && echo "All dependencies OK"
# Optional: browser interaction support (check both tools — refactors may use either)
command -v playwright-cli && echo "playwright-cli OK" || echo "playwright-cli not found (playwright browser verification will be skipped)"
command -v opencli && echo "opencli OK" || echo "opencli not found (opencli browser verification will be skipped)"
```

If `.prizmkit/plans/refactor-list.json` is missing, inform user:
> "No .prizmkit/plans/refactor-list.json found. Run the `refactor-planner` skill first to generate one, or provide a path to your refactor list."

### Workflow

Detect user intent from their message, then follow the corresponding workflow:

---

#### Intent A: Start Pipeline

> **Execution model**: The pipeline processes refactor tasks **sequentially** (one at a time, in priority order). The `dependencies` field in refactor-list.json is reserved for future parallel execution support and does NOT affect current execution order.

1. **Check prerequisites**:
   ```bash
   ls .prizmkit/plans/refactor-list.json 2>/dev/null && echo "Found" || echo "Missing"
   ```

2. **Check not already running**:
   ```bash
   dev-pipeline/launch-refactor-daemon.ps1 status 2>/dev/null
   ```
   If running, inform user and ask: "Refactor pipeline is already running. Want to restart it, check status, or view logs?"

3. **Show refactor summary** (so user knows what will be refactored):
   ```bash
   python -c "
   import json
   with open('.prizmkit/plans/refactor-list.json') as f:
       data = json.load(f)
   refactors = data.get('refactors', [])
   print(f'Total refactor tasks: {len(refactors)}')
   type_counts = {}
   for r in refactors:
       t = r.get('type', 'unknown')
       type_counts[t] = type_counts.get(t, 0) + 1
   if type_counts:
       print(f'By type: {dict(sorted(type_counts.items()))}')
   print()
   priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
   refactors_sorted = sorted(refactors, key=lambda r: (priority_order.get(r.get('priority', 'medium'), 2), r.get('id', '')))
   for r in refactors_sorted:
       print(f\"  {r['id']}: [{r.get('priority','medium').upper()}] [{r.get('type','?')}] {r.get('title', 'untitled')}\")
   "
   ```
   If pipeline state already exists, use the status command instead:
   ```bash
   python dev-pipeline/scripts/update-refactor-status.py \
     --refactor-list .prizmkit/plans/refactor-list.json \
     --state-dir .prizmkit/state/refactor \
     --action status 2>/dev/null
   ```

4. **Run preflight checks** (behavior-preservation baseline):

   Before refactoring, verify the codebase is in a clean, testable state:
   ```bash
   # Check git working tree is clean
   git status --porcelain | head -5
   # Run existing test suite to establish baseline
   npm test 2>&1 | tail -20 || echo "Test command failed or not configured"
   ```

   If git working tree is dirty, warn the user:
   > "Working tree has uncommitted changes. It's recommended to commit or stash changes before starting refactoring so each refactor task has a clean baseline. Continue anyway?"

   If test baseline fails, warn the user:
   > "Test suite is not passing. Refactoring relies on tests to verify behavior preservation. Fix failing tests before starting the refactor pipeline, or continue at your own risk."

   Wait for user confirmation before proceeding.

5. **Ask execution mode** (first user decision):

   Present the three modes and ask the user to choose:
   - **(1) Foreground** (recommended) — pipeline runs in the current session via `run-refactor.sh run`. Visible output and direct error feedback.
   - **(2) Background daemon** — pipeline runs fully detached via `launch-refactor-daemon.sh`. Survives AI CLI session closure.
   - **(3) Manual** — display the final assembled commands only. Do not execute anything. User runs them on their own.

6. **Ask configuration options** ⚠️ MANDATORY INTERACTIVE STEP — applies to ALL execution modes (Foreground, Background, AND Manual). You MUST ask the user to configure options and WAIT for their response BEFORE proceeding to step 7. Do NOT skip this step or merge it with step 7.

   ⛔ **HARD STOP**: You MUST call `AskUserQuestion` with the questions below and WAIT for the user's response. You MUST NOT:
   - Skip this step and jump to step 7
   - Merge step 6 and step 7 into one response
   - Assume default values and show the command without asking
   - Show the command as text and ask "ready?" without presenting the options
   If you find yourself writing the final command before the user has answered these questions, STOP — you are violating this rule.

   Use `AskUserQuestion` to present the following configuration choices. Each question is a separate selectable option:

   **Question 1 — Verbose logging** (multiSelect: false):
   - On (default) — Detailed AI session logs including tool calls and subagent activity
   - Off — Minimal logging

   **Question 2 — Max retries** (multiSelect: false):
   - 3 (default)
   - 1
   - 5

   **Question 3 — Strict behavior check** (multiSelect: false):
   - On (default) — Run full test suite after each refactor task to verify behavior preservation
   - Off — Skip post-task test verification (faster but riskier)

   **Question 4 — Advanced config?** (multiSelect: false):
   - No (default) — Use defaults for critic review, session timeout, and failure behavior
   - Yes — Configure critic review, session timeout, and stop-on-failure options

   Note: Refactor filter defaults to all refactor items (by priority order). If the user selects "Other" on any option, handle their custom input.

   **If user chose "Yes" to Advanced config**, ask a second round of `AskUserQuestion`:

   **Question 1 — Session timeout** (multiSelect: false):
   - None (default) — No timeout
   - 30 min — `SESSION_TIMEOUT=1800`
   - 1 hour — `SESSION_TIMEOUT=3600`
   - 2 hours — `SESSION_TIMEOUT=7200`

   **Question 2 — Stop on failure** (multiSelect: false):
   - Off (default) — Pipeline continues to next task after failure
   - On — Pipeline halts immediately when a task exhausts all retries (`STOP_ON_FAILURE=1`)

   **Question 3 — Critic review** (multiSelect: false):
   - Off (default) — Skip adversarial review
   - On — Enable adversarial critic review: an independent AI agent reviews the refactor plan for completeness and the implementation for regressions, missed edge cases, and behavior violations. Adds ~5-10 min per refactor task.

   **Question 4 — Deploy after completion?** (multiSelect: false):
   - No (default) — Skip deployment after pipeline completes
   - Yes — Run /prizmkit-deploy automatically after all refactors complete successfully (`ENABLE_DEPLOY=1`). Deployment is blocked if any refactor did not complete successfully (status not 'completed' or manually 'skipped').

   Default Critic to Off unless refactor items have `priority: "critical"` (in which case default to On).

   **Environment variable mapping** (for translating user responses → env vars):

   | Config choice | Environment variable |
   |-----------|---------------------|
   | Verbose: On | `VERBOSE=1` |
   | Verbose: Off | `VERBOSE=0` |
   | Max retries: N | `MAX_RETRIES=N` |
   | Strict behavior: On | `STRICT_BEHAVIOR_CHECK=1` |
   | Strict behavior: Off | `STRICT_BEHAVIOR_CHECK=0` |
   | Critic: On | `ENABLE_CRITIC=true` |
   | Timeout: value | `SESSION_TIMEOUT=<seconds>` |
   | Stop on failure: On | `STOP_ON_FAILURE=1` |
   | Deploy: Yes | `ENABLE_DEPLOY=1` |

   **Advanced environment variables** (not exposed in interactive menu, pass via `--env`):

   | Variable | Default | Purpose |
   |----------|---------|---------|
   | `MODEL` | (none) | AI model override (e.g. `claude-opus-4.6`) |
   | `AUTO_PUSH` | `0` | Auto-push to remote after successful refactor (`1` to enable) |
   | `DEV_BRANCH` | auto-generated | Custom dev branch name (default: `refactor/pipeline-{run_id}`) |
   | `HEARTBEAT_INTERVAL` | `30` | Heartbeat log interval in seconds |
   | `HEARTBEAT_STALE_THRESHOLD` | `600` | Max seconds without heartbeat before marking stale |
   | `LOG_CLEANUP_ENABLED` | `1` | Run periodic log cleanup (`0` to disable) |
   | `LOG_RETENTION_DAYS` | `14` | Delete logs older than N days |
   | `LOG_MAX_TOTAL_MB` | `1024` | Keep total logs under N MB via oldest-first cleanup |

   ⚠️ STOP HERE and wait for user response before continuing to step 7.

7. **Show final command**: After user confirms configuration in step 6, assemble the complete command from execution mode + user-confirmed configuration, and present it to the user.

   **Foreground command:**
   ```bash
   VERBOSE=1 STRICT_BEHAVIOR_CHECK=1 dev-pipeline/run-refactor.ps1 run .prizmkit/plans/refactor-list.json
   ```
   With all options:
   ```bash
   VERBOSE=1 STRICT_BEHAVIOR_CHECK=1 MAX_RETRIES=5 SESSION_TIMEOUT=3600 ENABLE_DEPLOY=1 \
     dev-pipeline/run-refactor.ps1 run .prizmkit/plans/refactor-list.json
   ```

   **Background daemon command:**
   ```bash
   dev-pipeline/launch-refactor-daemon.ps1 start .prizmkit/plans/refactor-list.json --env "VERBOSE=1 STRICT_BEHAVIOR_CHECK=1"
   ```
   With all options:
   ```bash
   dev-pipeline/launch-refactor-daemon.ps1 start .prizmkit/plans/refactor-list.json \
     --env "VERBOSE=1 STRICT_BEHAVIOR_CHECK=1 MAX_RETRIES=5 ENABLE_DEPLOY=1"
   ```

   **Manual mode**: Print the assembled command(s) and **stop here**. Do not execute anything. Do not proceed to step 8.
   ```
   # To run in foreground:
   VERBOSE=1 STRICT_BEHAVIOR_CHECK=1 dev-pipeline/run-refactor.ps1 run .prizmkit/plans/refactor-list.json

   # To run in background (detached):
   dev-pipeline/launch-refactor-daemon.ps1 start .prizmkit/plans/refactor-list.json --env "VERBOSE=1 STRICT_BEHAVIOR_CHECK=1"

   # To check status:
   dev-pipeline/run-refactor.ps1 status .prizmkit/plans/refactor-list.json
   ```

8. **Confirm and launch** (Foreground and Background only — Manual mode ends at step 7):

   Ask: "Ready to launch the refactor pipeline with the above command?"

   After user confirms, execute the command from step 7.

9. **Post-launch** (depends on execution mode):

   **If foreground**: Pipeline runs to completion in the terminal. After it finishes:
   - Summarize results: total refactors, succeeded, failed, skipped
   - If all succeeded: each refactor session has already run `prizmkit-retrospective` internally. Ask user what's next.
   - If some failed: show failed refactor IDs and suggest `reset-refactor.sh <R-XXX> --clean --run` for a fresh retry

   **If background daemon**:
   1. Verify launch:
      ```bash
      dev-pipeline/launch-refactor-daemon.ps1 status
      ```
   2. Start log monitoring — Use the Bash tool with `run_in_background: true`:
      ```bash
      tail -f .prizmkit/state/refactor/pipeline-daemon.log
      ```
   3. Report to user:
      - Pipeline PID
      - Log file location
      - "You can ask me 'refactor status' or 'show refactor logs' at any time"
      - "Closing this session will NOT stop the pipeline"

---

#### Intent B: Check Status

1. **Check daemon status**:
   ```bash
   dev-pipeline/launch-refactor-daemon.ps1 status
   ```

2. **Show refactor-level progress**:
   ```bash
   python dev-pipeline/scripts/update-refactor-status.py \
     --refactor-list .prizmkit/plans/refactor-list.json \
     --state-dir .prizmkit/state/refactor \
     --action status
   ```

3. **Show recent log activity** (last 20 lines):
   ```bash
   tail -20 .prizmkit/state/refactor/pipeline-daemon.log
   ```

4. **Summarize** to user: total refactors, completed, in-progress, failed, pending.

---

#### Intent C: Stop Pipeline

1. **Stop the daemon**:
   ```bash
   dev-pipeline/launch-refactor-daemon.ps1 stop
   ```

2. **Verify stopped**:
   ```bash
   dev-pipeline/launch-refactor-daemon.ps1 status 2>/dev/null || true
   ```

3. **Inform user**: "Refactor pipeline stopped. State is preserved -- you can resume later with 'start refactoring' and it will pick up where it left off."

---

#### Intent D: Show Logs

1. **Check if running**:
   ```bash
   dev-pipeline/launch-refactor-daemon.ps1 status 2>/dev/null
   ```

2. **If running** -- Start live tail with Bash tool `run_in_background: true`:
   ```bash
   tail -f .prizmkit/state/refactor/pipeline-daemon.log
   ```

3. **If not running** -- Show last 50 lines:
   ```bash
   tail -50 .prizmkit/state/refactor/pipeline-daemon.log
   ```

4. **For per-refactor session logs** (when user asks about a specific refactor):
   ```bash
   # Check refactor status for last session ID
   cat .prizmkit/state/refactor/refactors/<REFACTOR_ID>/status.json 2>/dev/null
   # Then tail that refactor's session log
   tail -100 .prizmkit/state/refactor/refactors/<REFACTOR_ID>/sessions/<SESSION_ID>/logs/session.log
   ```

---

#### Intent E: Retry Single Refactor

When user says "retry R-001" or "clean retry R-001":

```bash
dev-pipeline/reset-refactor.ps1 R-001 --clean --run .prizmkit/plans/refactor-list.json
```

Notes:
- `reset-refactor.sh --clean --run` performs a full clean (deletes session history and artifacts) before retrying — this gives a fresh start.
- Keep pipeline daemon mode for main run management (`launch-refactor-daemon.sh`).

---

### Error Handling

| Error | Action |
|-------|--------|
| `.prizmkit/plans/refactor-list.json` not found | Tell user to run `refactor-planner` skill first |
| Circular dependencies in refactor list | Fix dependency graph in `.prizmkit/plans/refactor-list.json` before launching |
| Test baseline failing | Fix failing tests before starting refactoring -- behavior preservation requires a green baseline |
| `jq` not installed | Suggest: `brew install jq` |
| `cbc`/`claude` not in PATH | Check AI CLI installation |
| Refactor pipeline already running | Show status, ask if user wants to stop and restart |
| PID file stale (process dead) | `launch-refactor-daemon.sh` auto-cleans, retry start |
| Launch failed (process died immediately) | Show last 20 lines of log: `tail -20 .prizmkit/state/refactor/pipeline-daemon.log` |
| Refactor stuck/blocked | Use `reset-refactor.sh <R-XXX> --clean --run` for a fresh retry |
| All refactors blocked/failed | Show status, suggest recovery: `dev-pipeline/reset-refactor.ps1 <R-XXX> --clean --run .prizmkit/plans/refactor-list.json` |
| `playwright-cli` not installed | Browser verification skipped for playwright refactors (non-blocking). Suggest: `npm install -g @playwright/cli@latest && playwright-cli install --skills` |
| `opencli` not installed | Browser verification skipped for opencli refactors (non-blocking). Install opencli for Chrome session-based browser verification |
| Deploy session failed | Pipeline completed but deploy session exited non-zero. Check `.prizmkit/state/refactor/deploy/<session_id>/logs/session.log`. Retry manually: `/prizmkit-deploy`. |
| Permission denied on script | Run `chmod +x dev-pipeline/launch-refactor-daemon.ps1 dev-pipeline/run-refactor.ps1` |

### Integration Notes

- **After refactor-planner**: This is the natural next step. When user finishes refactor planning and has `.prizmkit/plans/refactor-list.json`, suggest launching the refactor pipeline.
- **Session independence**: The pipeline runs completely detached. User can close the AI CLI session, open a new session later, and use this skill to check progress or stop the pipeline.
- **Single instance**: Only one refactor pipeline can run at a time. The PID file prevents duplicates.
- **Pipeline coexistence**: Refactor pipeline uses `.prizmkit/state/refactor/` separate from `.prizmkit/state/features/` (features) and `.prizmkit/state/bugfix/` (bugs), so all three pipelines can run simultaneously without conflict.
- **State preservation**: Stopping and restarting the pipeline resumes from where it left off -- completed refactors are not re-run.
- **HANDOFF**: After pipeline completes all refactors, each session has already run `prizmkit-retrospective` internally. Ask user what's next.

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

