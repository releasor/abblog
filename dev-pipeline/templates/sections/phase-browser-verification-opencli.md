### Browser Verification (opencli) — MANDATORY

You MUST execute this phase. Do NOT skip it. Do NOT mark it as completed without actually running opencli.

**CRITICAL CONSTRAINT — opencli browser ONLY, NO Playwright**:
- You MUST use `opencli browser` (the CLI tool) for ALL browser interactions in this phase
- **NEVER** use playwright-cli, Playwright MCP server, or any MCP-based browser automation
- All browser actions go through `opencli browser <command>` in the Bash tool, not through any MCP tool call
- OpenCLI reuses Chrome's logged-in sessions — your existing authentication is available automatically

**Step 0 — OpenCLI Readiness Check (BLOCKING — must pass before any browser action)**:

0a. Check if `opencli` is installed:
```bash
which opencli 2>/dev/null && opencli --version 2>/dev/null || echo "NOT_INSTALLED"
```
If output is `NOT_INSTALLED`, install it:
```bash
npm install -g @jackwener/opencli@latest
```
Then verify installation succeeded: `opencli --version`. If installation fails, log `## Browser Verification: SKIPPED — opencli installation failed` in context-snapshot.md and proceed to the next phase.

0b. Verify Browser Bridge connectivity:
```bash
opencli doctor
```
If `opencli doctor` fails (Chrome not running or extension not installed), log `## Browser Verification: SKIPPED — opencli doctor failed (Chrome/extension not ready)` in context-snapshot.md and proceed to the next phase.

0c. Learn opencli browser usage (run once per session):
```bash
opencli browser --help 2>/dev/null || opencli --help
```

**Step 1 — Start Dev Server**:

You know this project's tech stack. Detect and start the dev server yourself:

1. Identify the dev server start command from project config (`package.json` scripts, `Makefile`, `docker-compose.yml`, etc.)
2. **Detect the dev server port** — use the pre-detected port from pipeline if available, otherwise extract from project config. Do NOT hardcode or guess the port:
   ```bash
   DEV_PORT={{DEV_PORT}}
   if [ "$DEV_PORT" = "{{DEV_PORT}}" ]; then
     DEV_PORT=$(node -e "const s=require('./package.json').scripts.dev; const m=s.match(/-p\s+(\d+)/); console.log(m?m[1]:'')")
     if [ -z "$DEV_PORT" ]; then
       DEV_PORT=$(echo "$NEXT_PUBLIC_SITE_URL" | sed -nE 's|.*:([0-9]+).*|\1|p')
     fi
     DEV_PORT=${DEV_PORT:-3000}
   fi
   echo "Detected DEV_PORT=$DEV_PORT"
   ```
3. Verify the port is available:
   ```bash
   lsof -ti:$DEV_PORT 2>/dev/null && echo "PORT_IN_USE" || echo "PORT_FREE"
   ```
4. Start the dev server in background, capture PID:
   ```bash
   <start-command> &
   DEV_SERVER_PID=$!
   ```
5. Wait for server to be ready: poll `http://localhost:$DEV_PORT` with `curl -s -o /dev/null -w "%{http_code}"` until it returns 200 or 302 (max 30 seconds, 2s interval)
6. Open the app in opencli and inspect page state:
   ```bash
   opencli browser open http://localhost:$DEV_PORT && opencli browser state
   ```
7. If the page requires authentication, use opencli browser to interact with login forms (opencli reuses Chrome cookies, so SSO/OAuth may already be active)

**Step 2 — Verification**:

Use `opencli browser state` on the running app to discover elements with `[N]` indices, then verify these goals:
   {{BROWSER_VERIFY_STEPS}}

Key opencli browser commands for verification:
- `opencli browser state` — structured DOM with `[N]` element indices (FREE, always use this)
- `opencli browser click <N>` — click element by index
- `opencli browser type <N> "text"` — type into input
- `opencli browser get text <N>` — read element text
- `opencli browser get value <N>` — read input value
- `opencli browser wait text "Success"` — wait for text to appear
- `opencli browser wait selector ".loaded"` — wait for element
- `opencli browser scroll down` — scroll page
- `opencli browser eval "(function(){ ... })()"` — read-only JS evaluation for data extraction

**Chain commands aggressively with `&&`** to minimize tool calls:
```bash
# GOOD: open + inspect in one call
opencli browser open http://localhost:$DEV_PORT && opencli browser state

# GOOD: fill form in one call
opencli browser type 3 "hello" && opencli browser type 4 "world" && opencli browser click 7

# GOOD: click + wait + re-inspect
opencli browser click 12 && opencli browser wait time 1 && opencli browser state
```

**IMPORTANT**: Always run `opencli browser state` after page-changing actions (open, click on links, scroll) to get fresh element indices. Never guess indices.

Construct your verification workflow based on: (1) the `opencli browser --help` output, (2) the current task's acceptance criteria. Decide the concrete actions yourself. Take a final screenshot if needed: `opencli browser screenshot`.

**Step 3 — Cleanup (REQUIRED — you started it, you stop it)**:

1. Close the opencli browser session: `opencli browser close`
2. Kill the dev server process: `kill $DEV_SERVER_PID 2>/dev/null || true`
3. Verify port is released: `lsof -ti:$DEV_PORT | xargs kill -9 2>/dev/null || true`

**Step 4 — Reporting**:

Append results to `context-snapshot.md`:
   ```
   ## Browser Verification
   Tool: opencli
   URL: http://localhost:$DEV_PORT
   Dev Server Command: <actual command used>
   opencli version: <version>
   Steps executed: [list of opencli browser commands used]
   Screenshot: [path if taken]
   Result: PASS / FAIL (reason)
   Server cleanup: confirmed
   Browser cleanup: confirmed
   ```

If verification fails, log the failure details but continue to commit. Failures do NOT block the commit, but you MUST attempt verification and MUST clean up the dev server.


**Checkpoint update**: Update `workflow-checkpoint.json` — set step `browser-verification` to `"completed"`.
