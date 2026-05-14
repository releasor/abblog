---
description: "Launch and manage the dev-pipeline from within an AI CLI session. Start pipeline in background, monitor logs, check status, stop pipeline. Use this skill whenever the user wants to start building features, run the pipeline, check pipeline progress, retry features, or stop the pipeline. Trigger on: 'run pipeline', 'start pipeline', 'start building', 'pipeline status', 'stop pipeline', 'retry feature', 'launch pipeline', 'start implementing', 'check pipeline status', 'stop the pipeline'. (project)"
---

# Dev-Pipeline Launcher

Launch the autonomous development pipeline from within an AI CLI conversation. The pipeline runs as a fully detached background process -- closing the AI CLI session does NOT stop the pipeline.

### Execution Mode

Three execution modes are available. The user chooses one before configuring other options:

1. **Foreground** (recommended) — `dev-pipeline/run-feature.ps1 run`. Visible output, direct error feedback, no orphaned processes.
2. **Background daemon** — `dev-pipeline/launch-feature-daemon.ps1`. Runs fully detached, survives AI CLI session closure.
3. **Manual** — Display the assembled command(s) only. Do not execute anything. User runs them on their own.

### When to Use

**Start pipeline** -- User says:
- "run pipeline", "start pipeline", "start building", "launch dev-pipeline"
- "run the features", "execute feature list", "start implementing"
- "launch pipeline", "run the pipeline", "start auto-development"
- After feature-planner completes: "build it", "start developing from the feature list"
- "run only F-001 to F-005", "run features F-001,F-003", "only build these features"

**Check status** -- User says:
- "pipeline status", "check pipeline", "how's it going", "progress"
- "check progress", "what's the current situation"

**Stop pipeline** -- User says:
- "stop pipeline", "kill pipeline", "halt", "pause"
- "stop the pipeline", "pause the pipeline"

**Show logs** -- User says:
- "show logs", "pipeline logs", "tail logs", "what's happening"
- "view logs", "check the logs"

**Retry single feature node** -- User says:
- "retry F-003", "retry this feature", "retry this node", "re-run this feature"

**Do NOT use this skill when:**
- User wants to plan features (use `feature-planner` instead)
- User wants to implement a single feature manually within current session (use `prizmkit-implement`)
- User wants to define specs/plan (use `prizmkit-plan`)

### Prerequisites

Before any action, validate:

1. **dev-pipeline exists**: Confirm `dev-pipeline/launch-feature-daemon.ps1` is present and executable
2. **For start**: `.prizmkit/plans/feature-list.json` must exist in `.prizmkit/plans/` (or user-specified path)
3. **Dependencies**: `jq`, `python`, AI CLI (`cbc` or `claude`) must be in PATH
4. **Python version**: Requires Python 3.8+ for dev-pipeline scripts
5. **Browser tools** (optional): If any feature has `browser_interaction` field, check the corresponding tool is available. Features may specify `tool: "playwright-cli"`, `tool: "opencli"`, or `tool: "auto"` (AI chooses at runtime).

Quick check:
```bash
command -v jq && command -v python && (command -v cbc || command -v claude) && echo "All dependencies OK"
# Optional: browser interaction support (check both tools — features may use either)
command -v playwright-cli && echo "playwright-cli OK" || echo "playwright-cli not found (playwright browser verification will be skipped)"
command -v opencli && echo "opencli OK" || echo "opencli not found (opencli browser verification will be skipped)"
```

If `.prizmkit/plans/feature-list.json` is missing, inform user:
> "No .prizmkit/plans/feature-list.json found. Run the `feature-planner` skill first to generate one, or provide a path to your feature list."

### Workflow

Detect user intent from their message, then follow the corresponding workflow:

---

#### Intent A: Start Pipeline

> **Execution model**: The pipeline processes features **sequentially** (one at a time, in order). The `dependencies` field in feature-list.json is reserved for future parallel execution support and does NOT affect current execution order.

1. **Check prerequisites**:
   ```bash
   ls .prizmkit/plans/feature-list.json 2>/dev/null && echo "Found" || echo "Missing"
   ```

2. **Check not already running**:
   ```bash
   dev-pipeline/launch-feature-daemon.ps1 status 2>/dev/null
   ```
   If running, inform user and ask: "Pipeline is already running. Want to restart it, check status, or view logs?"

3. **Show feature summary** (so user knows what will be built):
   ```bash
   python -c "
   import json
   with open('.prizmkit/plans/feature-list.json') as f:
       data = json.load(f)
   features = data.get('features', [])
   print(f'Total features: {len(features)}')
   for f in features:
       print(f\"  {f['id']}: {f.get('title', 'untitled')}\")
   "
   ```
   If pipeline state already exists, use the status command instead:
   ```bash
   python dev-pipeline/scripts/update-feature-status.py \
     --feature-list .prizmkit/plans/feature-list.json \
     --state-dir .prizmkit/state/features \
     --action status 2>/dev/null
   ```

4. **Run environment preflight checks** (database connectivity, migrations, dev server):

   Run the preflight script to auto-detect the database type, verify env vars, test connectivity, and check migration status:
   ```bash
   python .claude/command-assets/feature-pipeline-launcher/scripts/preflight-check.py .prizmkit/plans/feature-list.json
   ```

   The script:
   - Reads `global_context.database` from `.prizmkit/plans/feature-list.json` and `.prizmkit/config.json`
   - Scans `.env.local` / `.env` for connection variables (supports Supabase, PostgreSQL, MySQL, MongoDB, Firebase, and generic `DATABASE_URL`)
   - Tests connectivity using the appropriate method per database type
   - Checks migration status (Prisma, Drizzle, Supabase raw SQL, or generic migration directories)
   - Checks if the dev server is running (from `browser_interaction` URLs)
   - Outputs `PREFLIGHT ✓` (pass), `PREFLIGHT ⚠` (warning), or `PREFLIGHT ℹ` (info) lines
   - Exits 0 (all clear), 1 (warnings found), or 2 (error — feature list not found)

   If the script reports `⚠` warnings, present them to the user and ask:
   > "Environment preflight found issues (listed above). The pipeline can still run, but database-related features may produce code that passes mock tests without real database verification. Continue anyway?"

   Wait for user confirmation. If they want to fix issues first, suggest remediation based on the warnings (apply migrations, configure env vars, check database service status).

   If `global_context.database` is absent and no features mention database keywords, the script skips DB checks automatically.

5. **Ask execution mode** (first user decision):

   Present the three modes and ask the user to choose:
   - **(1) Foreground** (recommended) — pipeline runs in the current session via `run-feature.sh run`. Visible output and direct error feedback.
   - **(2) Background daemon** — pipeline runs fully detached via `launch-feature-daemon.sh`. Survives AI CLI session closure.
   - **(3) Manual** — display the final assembled commands only. Do not execute anything. User runs them on their own.

6. **Ask configuration options** ⚠️ MANDATORY INTERACTIVE STEP — applies to ALL execution modes (Foreground, Background, AND Manual). You MUST ask the user to configure options and WAIT for their response BEFORE proceeding to step 7. Do NOT skip this step or merge it with step 7.

   ⛔ **HARD STOP**: You MUST call `AskUserQuestion` with the 4 questions below and WAIT for the user's response. You MUST NOT:
   - Skip this step and jump to step 7
   - Merge step 6 and step 7 into one response
   - Assume default values and show the command without asking
   - Show the command as text and ask "ready?" without presenting the options
   If you find yourself writing the final command before the user has answered these questions, STOP — you are violating this rule.

   Use `AskUserQuestion` to present the following configuration choices. Each question is a separate selectable option:

   **Question 1 — Critic review** (multiSelect: false):
   - Off (default) — Skip adversarial review
   - On — Enable adversarial critic review: an independent AI agent reviews the spec/plan for completeness and the implementation for defects, edge cases, and missed requirements. Adds ~5-10 min per feature.

   **Question 2 — Verbose logging** (multiSelect: false):
   - On (default) — Detailed AI session logs including tool calls and subagent activity
   - Off — Minimal logging

   **Question 3 — Max retries** (multiSelect: false):
   - 3 (default)
   - 1
   - 5

   **Question 4 — Advanced config?** (multiSelect: false):
   - No (default) — Use defaults for session timeout and failure behavior
   - Yes — Configure session timeout and stop-on-failure options

   Note: Due to the 4-question limit per `AskUserQuestion` call, Feature filter and Browser verify use their defaults (all features, auto-detect browser tools). If the user selects "Other" on any option, handle their custom input.

   Default Critic to Off unless features have `estimated_complexity: "high"` or above (in which case default to On).

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
   - Yes — Run /prizmkit-deploy automatically after all features complete successfully (`ENABLE_DEPLOY=1`). Deployment is blocked if any feature did not complete successfully (status not 'completed' or manually 'skipped').

   **Environment variable mapping** (for translating user responses → env vars):

   | Config choice | Environment variable |
   |-----------|---------------------|
   | Critic: On | `ENABLE_CRITIC=true` |
   | Verbose: Off | `VERBOSE=0` |
   | Verbose: On | `VERBOSE=1` |
   | Max retries: N | `MAX_RETRIES=N` |
   | Timeout: value | `SESSION_TIMEOUT=<seconds>` |
   | Stop on failure: On | `STOP_ON_FAILURE=1` |
   | Deploy: Yes | `ENABLE_DEPLOY=1` |

   **Advanced environment variables** (not exposed in interactive menu, pass via `--env`):

   | Variable | Default | Purpose |
   |----------|---------|---------|
   | `MODEL` | (none) | AI model override (e.g. `claude-opus-4.6`) |
   | `AUTO_PUSH` | `0` | Auto-push to remote after successful feature (`1` to enable) |
   | `DEV_BRANCH` | auto-generated | Custom dev branch name (default: `dev/{feature_id}-YYYYMMDDHHmm`) |
   | `HEARTBEAT_INTERVAL` | `30` | Heartbeat log interval in seconds |
   | `HEARTBEAT_STALE_THRESHOLD` | `600` | Max seconds without heartbeat before marking stale |
   | `PIPELINE_MODE` | (none) | Override mode for all features: `lite`\|`standard`\|`full` |
   | `LOG_CLEANUP_ENABLED` | `1` | Run periodic log cleanup (`0` to disable) |
   | `LOG_RETENTION_DAYS` | `14` | Delete logs older than N days |
   | `LOG_MAX_TOTAL_MB` | `1024` | Keep total logs under N MB via oldest-first cleanup |

   ⚠️ STOP HERE and wait for user response before continuing to step 7.

7. **Show final command**: After user confirms configuration in step 6, assemble the complete command from execution mode + user-confirmed configuration, and present it to the user.

   **Foreground command:**
   ```bash
   VERBOSE=1 dev-pipeline/run-feature.ps1 run .prizmkit/plans/feature-list.json
   ```
   With all options:
   ```bash
   VERBOSE=1 ENABLE_CRITIC=true MAX_RETRIES=5 SESSION_TIMEOUT=3600 ENABLE_DEPLOY=1 \
     dev-pipeline/run-feature.ps1 run .prizmkit/plans/feature-list.json --features F-001:F-005
   ```

   **Background daemon command:**
   ```bash
   dev-pipeline/launch-feature-daemon.ps1 start .prizmkit/plans/feature-list.json --env "VERBOSE=1"
   ```
   With all options:
   ```bash
   dev-pipeline/launch-feature-daemon.ps1 start .prizmkit/plans/feature-list.json --features F-001:F-005 \
     --env "VERBOSE=1 ENABLE_CRITIC=true MAX_RETRIES=5 ENABLE_DEPLOY=1"
   ```

   **Manual mode**: Print the assembled command(s) and **stop here**. Do not execute anything. Do not proceed to step 8.
   ```
   # To run in foreground:
   VERBOSE=1 dev-pipeline/run-feature.ps1 run .prizmkit/plans/feature-list.json

   # To run in background (detached):
   dev-pipeline/launch-feature-daemon.ps1 start .prizmkit/plans/feature-list.json --env "VERBOSE=1"

   # To check status:
   dev-pipeline/run-feature.ps1 status .prizmkit/plans/feature-list.json
   ```

8. **Confirm and launch** (Foreground and Background only — Manual mode ends at step 7):

   Ask: "Ready to launch the pipeline with the above command?"

   After user confirms, execute the command from step 7.

9. **Post-launch** (depends on execution mode):

   **If foreground**: Pipeline runs to completion in the terminal. After it finishes:
   - Summarize results: total features, succeeded, failed, skipped
   - If all succeeded: each feature session has already run `prizmkit-retrospective` internally. Ask user what's next.
   - If some failed: show failed feature IDs and suggest `reset-feature.sh <F-XXX> --clean --run` for a fresh retry
   - **Browser verification**: If any completed features have `browser_interaction` and the corresponding browser tool (`playwright-cli` or `opencli`) is installed, offer to run browser verification (see Post-Pipeline Browser Verification)

   **If background daemon**:
   1. Verify launch:
      ```bash
      dev-pipeline/launch-feature-daemon.ps1 status
      ```
   2. Start log monitoring — Use the Bash tool with `run_in_background: true`:
      ```bash
      tail -f .prizmkit/state/features/pipeline-daemon.log
      ```
   3. Report to user:
      - Pipeline PID
      - Log file location
      - "You can ask me 'pipeline status' or 'show logs' at any time"
      - "Closing this session will NOT stop the pipeline"

---

#### Intent B: Check Status

1. **Check daemon status**:
   ```bash
   dev-pipeline/launch-feature-daemon.ps1 status
   ```

2. **Show feature-level progress**:
   ```bash
   python dev-pipeline/scripts/update-feature-status.py \
     --feature-list .prizmkit/plans/feature-list.json \
     --state-dir .prizmkit/state/features \
     --action status
   ```

3. **Show recent log activity** (last 20 lines):
   ```bash
   tail -20 .prizmkit/state/features/pipeline-daemon.log
   ```

4. **Summarize** to user: total features, completed, in-progress, failed, pending.

---

#### Intent C: Stop Pipeline

1. **Stop the daemon**:
   ```bash
   dev-pipeline/launch-feature-daemon.ps1 stop
   ```

2. **Verify stopped**:
   ```bash
   dev-pipeline/launch-feature-daemon.ps1 status 2>/dev/null || true
   ```

3. **Inform user**: "Pipeline stopped. State is preserved -- you can resume later with 'start pipeline' and it will pick up where it left off."

---

#### Intent D: Show Logs

1. **Check if running**:
   ```bash
   dev-pipeline/launch-feature-daemon.ps1 status 2>/dev/null
   ```

2. **If running** -- Start live tail with Bash tool `run_in_background: true`:
   ```bash
   tail -f .prizmkit/state/features/pipeline-daemon.log
   ```

3. **If not running** -- Show last 50 lines:
   ```bash
   tail -50 .prizmkit/state/features/pipeline-daemon.log
   ```

4. **For per-feature session logs** (when user asks about a specific feature):
   ```bash
   # Check feature status for last session ID
   cat .prizmkit/state/features/features/<FEATURE_ID>/status.json 2>/dev/null
   # Then tail that feature's session log
   tail -100 .prizmkit/state/features/features/<FEATURE_ID>/sessions/<SESSION_ID>/logs/session.log
   ```

---

#### Intent E: Retry Single Feature Node

When user says "retry F-003" or "clean retry F-003":

```bash
dev-pipeline/reset-feature.ps1 F-003 --clean --run .prizmkit/plans/feature-list.json
```

Notes:
- `reset-feature.sh --clean --run` performs a full clean (deletes session history and artifacts) before retrying — this gives a fresh start.
- Keep pipeline daemon mode for main run management (`launch-feature-daemon.sh`).

---

#### Post-Pipeline Browser Verification

After pipeline completion, if features have `browser_interaction` fields and the corresponding browser tool (`playwright-cli` or `opencli`) is installed:

1. **Check which features qualify**:
   ```bash
   python -c "
   import json
   with open('.prizmkit/plans/feature-list.json') as f:
       data = json.load(f)
   for feat in data.get('features', []):
       bi = feat.get('browser_interaction')
       if bi and feat.get('status') == 'completed':
           tool = bi.get('tool', 'auto') if isinstance(bi, dict) else 'auto'
           print(f\"  {feat['id']}: {feat.get('title','')} (tool: {tool})\")
   " 2>/dev/null
   ```

2. **Ask user**: "N features have browser verification configured. Run browser verification now? (Y/n)"

3. **If yes**, for each qualifying feature:
   - Start dev server if `setup_command` is specified
   - Select browser tool based on `browser_interaction.tool`:
     - `"playwright-cli"` → Use `playwright-cli snapshot` to discover element refs, then verify each goal in `verify_steps`
     - `"opencli"` → Use `opencli browser` to interact with Chrome's logged-in session (ideal for OAuth/third-party verification)
     - `"auto"` → AI chooses the appropriate tool based on context (default: `playwright-cli` for local dev, `opencli` for authenticated flows)
   - Take a screenshot after verification
   - Close browser and stop dev server

4. **Report results**:
   - For each feature: URL opened, tool used, steps executed, screenshot path
   - If any step fails: flag as verification failure

**Important**: Browser verification is best-effort — failures here do NOT change the feature's pipeline status. They serve as visual confirmation aids for the user.

---

### Error Handling

| Error | Action |
|-------|--------|
| `.prizmkit/plans/feature-list.json` not found | Tell user to run `feature-planner` skill first |
| `jq` not installed | Suggest: `brew install jq` |
| `cbc`/`claude` not in PATH | Check AI CLI installation |
| Pipeline already running | Show status, ask if user wants to stop and restart |
| PID file stale (process dead) | `launch-feature-daemon.sh` auto-cleans, retry start |
| Launch failed (process died immediately) | Show last 20 lines of log: `tail -20 .prizmkit/state/features/pipeline-daemon.log` |
| Feature stuck/blocked | Use `reset-feature.sh <F-XXX> --clean --run` for a fresh retry |
| All features blocked/failed | Show status, suggest daemon-safe recovery: `dev-pipeline/reset-feature.ps1 <F-XXX> --clean --run .prizmkit/plans/feature-list.json` |
| `playwright-cli` not installed | Browser verification skipped for playwright features (non-blocking). Suggest: `npm install -g @playwright/cli@latest && playwright-cli install --skills` |
| `opencli` not installed | Browser verification skipped for opencli features (non-blocking). Install opencli for Chrome session-based browser verification |
| Permission denied on script | Run `chmod +x dev-pipeline/launch-feature-daemon.ps1 dev-pipeline/run-feature.ps1` |
| Pipeline stop failed (process won't die) | Process may be stuck in I/O wait. Try `kill -9 <PID>` manually. Check for orphaned child processes with `ps aux \| grep claude` |
| Deploy session failed | Pipeline completed but deploy session exited non-zero. Check `.prizmkit/state/features/deploy/<session_id>/logs/session.log`. Retry manually: `/prizmkit-deploy`. |
| `.env.local` missing or incomplete | Warn: database connection variables not found. Suggest creating env file with required connection variables for the project's database |
| Database unreachable | Warn: database features will produce mock-only tests. Suggest checking database service status and connection credentials |
| Migrations not applied | Warn: tables or schema referenced in migration files not found in database. Suggest applying pending migrations |

### Integration Notes

- **After feature-planner**: This is the natural next step. When user finishes planning and has `.prizmkit/plans/feature-list.json`, suggest launching the pipeline.
- **Session independence**: The pipeline runs completely detached. User can close the AI CLI session, open a new session later, and use this skill to check progress or stop the pipeline.
- **Single instance**: Only one pipeline can run at a time. The PID file prevents duplicates.
- **Pipeline coexistence**: Feature and bugfix pipelines use separate state directories (`.prizmkit/state/features/` vs `.prizmkit/state/bugfix/`), so they can run simultaneously without conflict.
- **State preservation**: Stopping and restarting the pipeline resumes from where it left off -- completed features are not re-run.
- **HANDOFF**: After pipeline completes all features, each session has already run `prizmkit-retrospective` internally. Ask user what's next.

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

