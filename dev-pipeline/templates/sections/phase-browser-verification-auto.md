### Browser Verification — MANDATORY

You MUST execute this phase. Do NOT skip it. Do NOT mark it as completed without actually running browser verification.

**Step 0 — Tool Selection (BLOCKING — decide before any browser action)**:

0a. Check which browser tools are available:
```bash
echo "=== playwright-cli ==="
which playwright-cli 2>/dev/null && playwright-cli --version 2>/dev/null || echo "NOT_INSTALLED"
echo "=== opencli ==="
which opencli 2>/dev/null && opencli --version 2>/dev/null || echo "NOT_INSTALLED"
```

0b. If opencli is installed, verify Browser Bridge connectivity:
```bash
opencli doctor 2>/dev/null || echo "OPENCLI_BRIDGE_FAILED"
```

0c. **Choose your tool** based on availability and scenario:

| Condition | Use this tool |
|-----------|--------------|
| Only playwright-cli installed | `playwright-cli` |
| Only opencli installed (and doctor passes) | `opencli` |
| Both installed — verifying local dev server, forms, components | `playwright-cli` (isolated, deterministic) |
| Both installed — feature needs real login state (OAuth/SSO) | `opencli` (reuses Chrome sessions) |
| Both installed — verifying third-party integration pages | `opencli` (has logged-in cookies) |
| Both installed — headless CI environment | `playwright-cli` (no Chrome dependency) |
| Neither installed | Skip — log `## Browser Verification: SKIPPED — no browser tool available` |

If neither tool is available, install playwright-cli as the default:
```bash
npm install -g @playwright/cli@latest
playwright-cli --version
```

Record your choice:
```bash
BROWSER_TOOL="playwright-cli"   # or "opencli"
echo "Selected browser tool: $BROWSER_TOOL"
```

---

**If you chose `playwright-cli`**, follow this workflow:

0d. Check if playwright-cli skill is installed for the current AI platform:
```bash
CURRENT_PLATFORM=""
if which claude >/dev/null 2>&1; then
  CURRENT_PLATFORM="claude"; SKILL_DIR="$HOME/.claude/skills"
elif which cbc >/dev/null 2>&1; then
  CURRENT_PLATFORM="codebuddy"; SKILL_DIR="$HOME/.cbc/skills"
else
  CURRENT_PLATFORM="unknown"
fi
if [ -d "$SKILL_DIR/playwright-cli" ] || ls "$SKILL_DIR"/playwright* 2>/dev/null | grep -q .; then
  echo "SKILL_EXISTS"
else
  echo "SKILL_MISSING"
fi
```
If `SKILL_MISSING`: run `playwright-cli install --skills`. If current platform is NOT claude, copy installed skill from `$HOME/.claude/skills/playwright-cli` to `$SKILL_DIR/playwright-cli`.

0e. Read the installed playwright-cli skill (SKILL.md) for workflow guidance. Learn usage: `playwright-cli --help`.

**Step 1 — Start Dev Server + Open (playwright-cli)**:
1. Identify and start the dev server (see port detection below)
2. Open: `playwright-cli open http://localhost:$DEV_PORT`
3. If auth needed, use playwright-cli to register a test user and log in

**Step 2 — Verification (playwright-cli)**:
Use `playwright-cli snapshot` to discover element refs, then verify these goals:
   {{BROWSER_VERIFY_STEPS}}

Construct your verification workflow based on: (1) the playwright-cli skill documentation, (2) the `--help` output, (3) the current task's acceptance criteria. Take a final screenshot: `playwright-cli screenshot`.

**Step 3 — Cleanup (playwright-cli)**:
1. `playwright-cli close`
2. `kill $DEV_SERVER_PID 2>/dev/null || true`
3. `lsof -ti:$DEV_PORT | xargs kill -9 2>/dev/null || true`

---

**If you chose `opencli`**, follow this workflow:

0d. Learn usage: `opencli browser --help 2>/dev/null || opencli --help`

**Step 1 — Start Dev Server + Open (opencli)**:
1. Identify and start the dev server (see port detection below)
2. Open and inspect: `opencli browser open http://localhost:$DEV_PORT && opencli browser state`
3. If auth needed, opencli reuses Chrome cookies — SSO/OAuth may already be active

**Step 2 — Verification (opencli)**:
Use `opencli browser state` to discover elements with `[N]` indices, then verify these goals:
   {{BROWSER_VERIFY_STEPS}}

Key commands: `state`, `click <N>`, `type <N> "text"`, `get text <N>`, `get value <N>`, `wait text "..."`, `wait selector "..."`, `scroll down`, `eval "(function(){ ... })()"`.

**Chain commands with `&&`**: `opencli browser type 3 "hello" && opencli browser click 7`

Always run `state` after page-changing actions to get fresh indices.

**Step 3 — Cleanup (opencli)**:
1. `opencli browser close`
2. `kill $DEV_SERVER_PID 2>/dev/null || true`
3. `lsof -ti:$DEV_PORT | xargs kill -9 2>/dev/null || true`

---

**Shared: Dev Server Port Detection** (used by both tools):

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

Verify port available: `lsof -ti:$DEV_PORT 2>/dev/null && echo "PORT_IN_USE" || echo "PORT_FREE"`

Start dev server: `<start-command> & DEV_SERVER_PID=$!`

Wait for ready: poll `http://localhost:$DEV_PORT` with `curl -s -o /dev/null -w "%{http_code}"` until 200/302 (max 30s, 2s interval).

---

**Step 4 — Reporting** (both tools):

Append results to `context-snapshot.md`:
   ```
   ## Browser Verification
   Tool: <playwright-cli or opencli>
   URL: http://localhost:$DEV_PORT
   Dev Server Command: <actual command used>
   Tool version: <version>
   Steps executed: [list of commands used]
   Screenshot: [path if taken]
   Result: PASS / FAIL (reason)
   Server cleanup: confirmed
   Browser cleanup: confirmed
   ```

If verification fails, log the failure details but continue to commit. Failures do NOT block the commit, but you MUST attempt verification and MUST clean up the dev server.


**Checkpoint update**: Update `workflow-checkpoint.json` — set step `browser-verification` to `"completed"`.
