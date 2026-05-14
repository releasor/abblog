---
name: bugfix-pipeline-launcher
description: "Launch and manage the bugfix pipeline from within an AI CLI session. Start pipeline in background, monitor logs, check status, stop pipeline. Use this skill whenever the user wants to start fixing bugs, run the bugfix pipeline, check bugfix progress, or stop the bugfix pipeline. Trigger on: 'start fixing bugs', 'run bugfix pipeline', 'bugfix status', 'stop bug fix', 'launch bug fix', 'fix progress', 'stop fixing'. (project)"
---

# Bugfix-Pipeline Launcher

Launch the autonomous bug fix pipeline from within an AI CLI conversation. Supports foreground and background execution modes.

### Execution Mode

Three execution modes are available. The user chooses one before configuring other options:

1. **Foreground** (recommended) — `dev-pipeline/run-bugfix.ps1 run`. Visible output, direct error feedback, no orphaned processes.
2. **Background daemon** — `dev-pipeline/launch-bugfix-daemon.ps1`. Runs fully detached, survives AI CLI session closure.
3. **Manual** — Display the assembled command(s) only. Do not execute anything. User runs them on their own.

**Background mode documentation**: When the user chooses background/daemon mode, record the choice and PID in `.prizmkit/bugfix-pipeline-run.log` (append-only) with timestamp, so the decision is traceable:
```
[2026-03-26T10:30:00] MODE=daemon PID=12345 BUG_LIST=.prizmkit/plans/bug-fix-list.json BUGS=3
```

### When to Use

**Start bugfix pipeline** -- User says:
- "start fixing bugs", "run bugfix pipeline", "launch bug fixes", "fix all bugs"
- "start bug fix", "execute bug list", "begin fixing", "batch fix"
- After bug-planner completes: "fix them", "start fixing"

**Check status** -- User says:
- "bugfix status", "check bug fixes", "how's the fixing going", "bug fix progress"
- "fix progress", "bug fix status", "check fix progress", "how far along are the fixes"

**Stop bugfix pipeline** -- User says:
- "stop bug fix", "stop fixing", "halt bugfix", "pause bug fix", "stop fix pipeline"

**Show logs** -- User says:
- "bugfix logs", "show fix logs", "what's being fixed"
- "view fix logs", "fix logs"

**Do NOT use this skill when:**
- User wants to plan/collect bugs (use `bug-planner` instead)
- User wants to fix a single bug interactively in current session (use `bug-fix-workflow`)
- User wants to launch the feature pipeline (use `feature-pipeline-launcher`)

### Prerequisites

Before any action, validate:

1. **bugfix pipeline exists**: Confirm `dev-pipeline/launch-bugfix-daemon.ps1` and `dev-pipeline/run-bugfix.ps1` are present and executable
2. **For start**: `.prizmkit/plans/bug-fix-list.json` must exist in `.prizmkit/plans/` (or user-specified path)
3. **Dependencies**: `jq`, `python`, AI CLI (`cbc` or `claude`) must be in PATH
4. **Browser tools** (optional): If any bug has `browser_interaction` field, check the corresponding tool is available. Bugs may specify `tool: "playwright-cli"`, `tool: "opencli"`, or `tool: "auto"` (AI chooses at runtime).

Quick check:
```bash
command -v jq && command -v python && (command -v cbc || command -v claude) && echo "All dependencies OK"
# Optional: browser interaction support (check both tools — bugs may use either)
command -v playwright-cli && echo "playwright-cli OK" || echo "playwright-cli not found (playwright browser verification will be skipped)"
command -v opencli && echo "opencli OK" || echo "opencli not found (opencli browser verification will be skipped)"
```

If `.prizmkit/plans/bug-fix-list.json` is missing, inform user:
> "No .prizmkit/plans/bug-fix-list.json found. Run the `bug-planner` skill first to generate one, or provide a path to your bug fix list."

### Workflow

Detect user intent from their message, then follow the corresponding workflow:

---

#### Intent A: Start Bugfix Pipeline

> **Execution model**: The pipeline processes bugs **sequentially** (one at a time, in severity/priority order). The `dependencies` field in bug-fix-list.json is reserved for future parallel execution support and does NOT affect current execution order.

1. **Check prerequisites**:
   ```bash
   ls .prizmkit/plans/bug-fix-list.json 2>/dev/null && echo "Found" || echo "Missing"
   ```

2. **Check not already running**:
   ```bash
   dev-pipeline/launch-bugfix-daemon.ps1 status 2>/dev/null
   ```
   If running, inform user and ask: "Bugfix pipeline is already running. Want to restart it, check status, or view logs?"

3. **Show bug summary** (so user knows what will be fixed):
   ```bash
   python -c "
   import json
   with open('.prizmkit/plans/bug-fix-list.json') as f:
       data = json.load(f)
   bugs = data.get('bugs', [])
   severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
   bugs_sorted = sorted(bugs, key=lambda b: (severity_order.get(b.get('severity', 'medium'), 2), b.get('priority', 99)))
   print(f'Total bugs: {len(bugs)}')
   sev_counts = {}
   for b in bugs:
       s = b.get('severity', 'medium')
       sev_counts[s] = sev_counts.get(s, 0) + 1
   print(f'By severity: {dict(sorted(sev_counts.items(), key=lambda x: severity_order.get(x[0], 2)))}')
   print()
   for b in bugs_sorted:
       print(f\"  {b['id']}: [{b.get('severity','?').upper()}] {b.get('title', 'untitled')}\")
   "
   ```
   If pipeline state already exists, use the status command instead:
   ```bash
   python dev-pipeline/scripts/update-bug-status.py \
     --bug-list .prizmkit/plans/bug-fix-list.json \
     --state-dir .prizmkit/state/bugfix \
     --action status 2>/dev/null
   ```

4. **Ask execution mode** (first user decision):

   Present the three modes and ask the user to choose:
   - **(1) Foreground** (recommended) — pipeline runs in the current session via `run-bugfix.sh run`. Visible output and direct error feedback.
   - **(2) Background daemon** — pipeline runs fully detached via `launch-bugfix-daemon.sh`. Survives AI CLI session closure.
   - **(3) Manual** — display the final assembled commands only. Do not execute anything. User runs them on their own.

5. **Ask configuration options** ⚠️ MANDATORY INTERACTIVE STEP — applies to ALL execution modes (Foreground, Background, AND Manual). You MUST ask the user to configure options and WAIT for their response BEFORE proceeding to step 6. Do NOT skip this step or merge it with step 6.

   ⛔ **HARD STOP**: You MUST call `AskUserQuestion` with the questions below and WAIT for the user's response. You MUST NOT:
   - Skip this step and jump to the next step
   - Merge this step and the next step into one response
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

   **Question 3 — Critic review** (multiSelect: false):
   - Off (default) — Skip adversarial review
   - On — Enable adversarial critic review: an independent AI agent reviews the diagnosis/plan for completeness and the fix for defects, edge cases, and regression risks. Adds ~5-10 min per bug.

   **Question 4 — Advanced config?** (multiSelect: false):
   - No (default) — Use defaults for session timeout and failure behavior
   - Yes — Configure session timeout and stop-on-failure options

   Note: Bug filter defaults to all bugs (by severity order). Default Critic to Off unless bugs have `severity: "critical"` or `severity: "high"` (in which case default to On). If the user selects "Other" on any option, handle their custom input.

   **If user chose "Yes" to Advanced config**, ask a second round of `AskUserQuestion`:

   **Question 1 — Session timeout** (multiSelect: false):
   - None (default) — No timeout
   - 30 min — `SESSION_TIMEOUT=1800`
   - 1 hour — `SESSION_TIMEOUT=3600`
   - 2 hours — `SESSION_TIMEOUT=7200`

   **Question 2 — Stop on failure** (multiSelect: false):
   - Off (default) — Pipeline continues to next task after failure
   - On — Pipeline halts immediately when a task exhausts all retries (`STOP_ON_FAILURE=1`)

   **Question 3 — Deploy after completion?** (multiSelect: false):
   - No (default) — Skip deployment after pipeline completes
   - Yes — Run /prizmkit-deploy automatically after all bugs fixed successfully (`ENABLE_DEPLOY=1`). Deployment is blocked if any bug was not fixed (status not 'completed', 'skipped', or 'needs_info').

   **Environment variable mapping** (for translating user responses → env vars):

   | Config choice | Environment variable |
   |-----------|---------------------|
   | Verbose: Off | `VERBOSE=0` |
   | Verbose: On | `VERBOSE=1` |
   | Max retries: N | `MAX_RETRIES=N` |
   | Critic: On | `ENABLE_CRITIC=true` |
   | Timeout: value | `SESSION_TIMEOUT=<seconds>` |
   | Stop on failure: On | `STOP_ON_FAILURE=1` |
   | Deploy: Yes | `ENABLE_DEPLOY=1` |

   **Advanced environment variables** (not exposed in interactive menu, pass via `--env`):

   | Variable | Default | Purpose |
   |----------|---------|---------|
   | `MODEL` | (none) | AI model override (e.g. `claude-opus-4.6`) |
   | `AUTO_PUSH` | `0` | Auto-push to remote after successful bug fix (`1` to enable) |
   | `DEV_BRANCH` | auto-generated | Custom dev branch name (default: `bugfix/pipeline-{run_id}`) |
   | `HEARTBEAT_INTERVAL` | `30` | Heartbeat log interval in seconds |
   | `HEARTBEAT_STALE_THRESHOLD` | `600` | Max seconds without heartbeat before marking stale |
   | `LOG_CLEANUP_ENABLED` | `1` | Run periodic log cleanup (`0` to disable) |
   | `LOG_RETENTION_DAYS` | `14` | Delete logs older than N days |
   | `LOG_MAX_TOTAL_MB` | `1024` | Keep total logs under N MB via oldest-first cleanup |

   ⚠️ STOP HERE and wait for user response before continuing to step 6.

6. **Show final command**: Assemble the complete command from execution mode + confirmed configuration, and present it to the user.

   **Foreground command:**
   ```bash
   VERBOSE=1 dev-pipeline/run-bugfix.ps1 run .prizmkit/plans/bug-fix-list.json
   ```
   With all options:
   ```bash
   VERBOSE=1 MAX_RETRIES=5 SESSION_TIMEOUT=3600 ENABLE_DEPLOY=1 \
     dev-pipeline/run-bugfix.ps1 run .prizmkit/plans/bug-fix-list.json
   ```

   **Background daemon command:**
   ```bash
   dev-pipeline/launch-bugfix-daemon.ps1 start .prizmkit/plans/bug-fix-list.json --env "VERBOSE=1"
   ```
   With all options:
   ```bash
   dev-pipeline/launch-bugfix-daemon.ps1 start .prizmkit/plans/bug-fix-list.json \
     --env "VERBOSE=1 MAX_RETRIES=5 ENABLE_DEPLOY=1"
   ```

   **Manual mode**: Print the assembled command(s) and **stop here**. Do not execute anything. Do not proceed to step 7.
   ```
   # To run in foreground:
   VERBOSE=1 dev-pipeline/run-bugfix.ps1 run .prizmkit/plans/bug-fix-list.json

   # To run in background (detached):
   dev-pipeline/launch-bugfix-daemon.ps1 start .prizmkit/plans/bug-fix-list.json --env "VERBOSE=1"

   # To check status:
   dev-pipeline/run-bugfix.ps1 status .prizmkit/plans/bug-fix-list.json
   ```

7. **Confirm and launch** (Foreground and Background only — Manual mode ends at step 6):

   Ask: "Ready to launch the bugfix pipeline with the above command?"

   After user confirms, execute the command from step 6.

8. **Post-launch** (depends on execution mode):

   **If foreground**: Pipeline runs to completion in the terminal. After it finishes:
   - Summarize results: total bugs, fixed, failed, skipped
   - If all fixed: each bug session has already run `prizmkit-retrospective` internally (structural sync by default; full retrospective when the fix changed interfaces, dependencies, or observable behavior). Ask user what's next.
   - If some failed: show failed bug IDs and suggest `dev-pipeline/reset-bug.ps1 <B-XXX> --clean --run` for a fresh retry

   **If background daemon**:
   1. Verify launch:
      ```bash
      dev-pipeline/launch-bugfix-daemon.ps1 status
      ```
   2. Start log monitoring — Use the Bash tool with `run_in_background: true`:
      ```bash
      tail -f .prizmkit/state/bugfix/pipeline-daemon.log
      ```
   3. Report to user:
      - Pipeline PID
      - Log file location
      - "You can ask me 'bugfix status' or 'show fix logs' at any time"
      - "Closing this session will NOT stop the pipeline"

---

#### Intent B: Check Status

1. **Check daemon status**:
   ```bash
   dev-pipeline/launch-bugfix-daemon.ps1 status
   ```

2. **Show bug-level progress**:
   ```bash
   python dev-pipeline/scripts/update-bug-status.py \
     --bug-list .prizmkit/plans/bug-fix-list.json \
     --state-dir .prizmkit/state/bugfix \
     --action status
   ```

3. **Show recent log activity** (last 20 lines):
   ```bash
   tail -20 .prizmkit/state/bugfix/pipeline-daemon.log
   ```

4. **Summarize** to user: total bugs, completed, in-progress, failed, pending, needs-info.

---

#### Intent C: Stop Bugfix Pipeline

1. **Stop the daemon**:
   ```bash
   dev-pipeline/launch-bugfix-daemon.ps1 stop
   ```

2. **Verify stopped**:
   ```bash
   dev-pipeline/launch-bugfix-daemon.ps1 status 2>/dev/null || true
   ```

3. **Inform user**: "Bugfix pipeline stopped. State is preserved -- you can resume later with 'start bug fix' and it will pick up where it left off."

---

#### Intent D: Show Logs

1. **Check if running**:
   ```bash
   dev-pipeline/launch-bugfix-daemon.ps1 status 2>/dev/null
   ```

2. **If running** -- Start live tail with Bash tool `run_in_background: true`:
   ```bash
   tail -f .prizmkit/state/bugfix/pipeline-daemon.log
   ```

3. **If not running** -- Show last 50 lines:
   ```bash
   tail -50 .prizmkit/state/bugfix/pipeline-daemon.log
   ```

4. **For per-bug session logs** (when user asks about a specific bug):
   ```bash
   # Check bug status for last session ID
   cat .prizmkit/state/bugfix/bugs/<BUG_ID>/status.json 2>/dev/null
   # Then tail that bug's session log
   tail -100 .prizmkit/state/bugfix/bugs/<BUG_ID>/sessions/<SESSION_ID>/logs/session.log
   ```

---

#### Intent E: Retry Single Bug

When user says "retry B-001":

```bash
dev-pipeline/reset-bug.ps1 B-001 --clean --run .prizmkit/plans/bug-fix-list.json
```

**Note:** `reset-bug.sh --clean --run` performs a full clean (deletes session history and artifacts) before retrying — this gives a fresh start.

### Error Handling

| Error | Action |
|-------|--------|
| `.prizmkit/plans/bug-fix-list.json` not found | Tell user to run `bug-planner` skill first |
| `jq` not installed | Suggest: `brew install jq` |
| `cbc`/`claude` not in PATH | Check AI CLI installation |
| Bugfix pipeline already running | Show status, ask if user wants to stop and restart |
| PID file stale (process dead) | `launch-bugfix-daemon.sh` auto-cleans, retry start |
| Launch failed (process died immediately) | Show last 20 lines of log: `tail -20 .prizmkit/state/bugfix/pipeline-daemon.log` |
| All bugs blocked/failed/needs-info | Show status, suggest retrying or providing more info |
| `playwright-cli` not installed | Browser verification skipped for playwright bugs (non-blocking). Suggest: `npm install -g @playwright/cli@latest && playwright-cli install --skills` |
| `opencli` not installed | Browser verification skipped for opencli bugs (non-blocking). Install opencli for Chrome session-based browser verification |
| Deploy session failed | Pipeline completed but deploy session exited non-zero. Check `.prizmkit/state/bugfix/deploy/<session_id>/logs/session.log`. Retry manually: `/prizmkit-deploy`. |
| Permission denied on script | Run `chmod +x dev-pipeline/launch-bugfix-daemon.ps1 dev-pipeline/run-bugfix.ps1` |

### Integration Notes

- **After bug-planner**: This is the natural next step. When user finishes bug planning and has `.prizmkit/plans/bug-fix-list.json`, suggest launching the bugfix pipeline.
- **Session independence**: In daemon mode, the bugfix pipeline runs completely detached. User can close the AI CLI, open a new session later, and use this skill to check progress or stop the pipeline.
- **Single instance**: Only one bugfix pipeline can run at a time. The PID file prevents duplicates.
- **Feature pipeline coexistence**: Bugfix and feature pipelines use separate state directories (`.prizmkit/state/bugfix/` vs `.prizmkit/state/features/`), so they can run simultaneously without conflict.
- **State preservation**: Stopping and restarting the bugfix pipeline resumes from where it left off -- completed bugs are not re-fixed.
- **Bug ordering**: Bugs are processed by severity (critical → high → medium → low), then by priority number within the same severity.
- **Background mode traceability**: When daemon mode is chosen, the decision is logged to `.prizmkit/bugfix-pipeline-run.log` with timestamp, PID, and bug count for auditability.
- **HANDOFF**: After pipeline completes all bugs, suggest running `prizmkit-retrospective` to capture lessons learned, or checking the fix reports in `.prizmkit/bugfix/`.

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

