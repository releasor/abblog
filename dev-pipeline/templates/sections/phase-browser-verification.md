### Browser Verification (playwright-cli) — MANDATORY

You MUST execute this phase. Do NOT skip it. Do NOT mark it as completed without actually running playwright-cli.

**CRITICAL CONSTRAINT — playwright-cli ONLY, NO Playwright MCP**:
- You MUST use `playwright-cli` (the CLI tool) for ALL browser interactions in this phase
- **NEVER** use Playwright MCP server, Playwright MCP tools, or any MCP-based browser automation
- If you have Playwright MCP configured, IGNORE it entirely — use the CLI command `playwright-cli` exclusively
- All browser actions go through `playwright-cli <command>` in the Bash tool, not through any MCP tool call

**Step 0 — Playwright CLI Readiness Check (BLOCKING — must pass before any browser action)**:

0a. Check if `playwright-cli` is installed:
```bash
which playwright-cli 2>/dev/null && playwright-cli --version 2>/dev/null || echo "NOT_INSTALLED"
```
If output is `NOT_INSTALLED`, install it:
```bash
npm install -g @playwright/cli@latest
```
Then verify installation succeeded:
```bash
playwright-cli --version
```
If installation fails, log the error in context-snapshot.md under `## Browser Verification: SKIPPED — playwright-cli installation failed` and proceed to the next phase. Do NOT attempt browser verification without playwright-cli.

0b. Learn playwright-cli usage (run once per session to understand available commands):
```bash
playwright-cli --help
```
Use this output to determine the correct commands for your verification steps. Do NOT guess command syntax — refer to the help output.

0c. Check if playwright-cli skill is installed for the current AI platform:
```bash
# Detect AI CLI platform
CURRENT_PLATFORM=""
if which claude >/dev/null 2>&1; then
  CURRENT_PLATFORM="claude"
  SKILL_DIR="$HOME/.claude/skills"
elif which cbc >/dev/null 2>&1; then
  CURRENT_PLATFORM="codebuddy"
  SKILL_DIR="$HOME/.cbc/skills"
else
  # Try to detect from environment or config
  CURRENT_PLATFORM="unknown"
fi

# Check if playwright-cli skill exists
if [ -d "$SKILL_DIR/playwright-cli" ] || ls "$SKILL_DIR"/playwright* 2>/dev/null | grep -q .; then
  echo "SKILL_EXISTS"
else
  echo "SKILL_MISSING"
fi
```
If `SKILL_MISSING`:
```bash
# Install playwright-cli skills (defaults to claude platform)
playwright-cli install --skills
```
If the current platform is NOT claude, move the installed skill files to the correct location:
```bash
# Skills are installed to claude's default location — move to current platform's skill dir
if [ "$CURRENT_PLATFORM" != "claude" ] && [ "$CURRENT_PLATFORM" != "unknown" ]; then
  CLAUDE_SKILL_DIR="$HOME/.claude/skills"
  if [ -d "$CLAUDE_SKILL_DIR/playwright-cli" ]; then
    mkdir -p "$SKILL_DIR"
    cp -r "$CLAUDE_SKILL_DIR/playwright-cli" "$SKILL_DIR/"
    echo "Moved playwright-cli skill from claude to $CURRENT_PLATFORM"
  fi
fi
```

0d. Read the installed playwright-cli skill for workflow guidance:
After skill installation, read the skill's SKILL.md to understand recommended workflows and patterns. Use these patterns to construct your verification flow — do NOT invent your own patterns if the skill provides them.

**Step 1 — Start Dev Server**:

You know this project's tech stack. Detect and start the dev server yourself:

1. Identify the dev server start command from project config (`package.json` scripts, `Makefile`, `docker-compose.yml`, etc.)
2. **Detect the dev server port** — use the pre-detected port from pipeline if available, otherwise extract from project config. Do NOT hardcode or guess the port:
   ```bash
   # Use pipeline-injected port if available, otherwise extract from package.json
   DEV_PORT={{DEV_PORT}}
   # If DEV_PORT is still a placeholder, detect at runtime:
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
6. Open the app in playwright-cli: `playwright-cli open http://localhost:$DEV_PORT`
7. If the page requires authentication, use playwright-cli to register a test user and log in first

**Step 2 — Verification**:

Use `playwright-cli snapshot` on the running app to discover actual element refs, then verify these goals:
{{BROWSER_VERIFY_STEPS}}

Construct your verification workflow based on:
1. The playwright-cli skill documentation (read in Step 0d)
2. The `playwright-cli --help` output (captured in Step 0b)
3. The current task's acceptance criteria and implemented features

Decide the concrete playwright-cli actions (click, fill, snapshot, screenshot, etc.) yourself based on the snapshot output and your knowledge of the implemented code. The goals above describe WHAT to verify — you determine HOW using playwright-cli commands.

Take a final screenshot for evidence: `playwright-cli screenshot`

**Step 3 — Cleanup (REQUIRED — you started it, you stop it)**:

1. Close the playwright-cli browser: `playwright-cli close`
2. Kill the dev server process: `kill $DEV_SERVER_PID 2>/dev/null || true`
3. Verify port is released: `lsof -ti:$DEV_PORT | xargs kill -9 2>/dev/null || true`

**Step 4 — Reporting**:

Append results to `context-snapshot.md`:
```
## Browser Verification
URL: http://localhost:$DEV_PORT
Dev Server Command: <actual command used>
playwright-cli version: <version>
Steps executed: [list of playwright-cli commands used]
Screenshot: [path]
Result: PASS / FAIL (reason)
Server cleanup: confirmed
Browser cleanup: confirmed
```

If verification fails, log the failure details but continue to commit. Failures do NOT block the commit, but you MUST attempt verification and MUST clean up the dev server.


**Checkpoint update**: Update `workflow-checkpoint.json` — set step `browser-verification` to `"completed"`.
