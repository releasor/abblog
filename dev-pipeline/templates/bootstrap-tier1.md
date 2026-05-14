# Dev-Pipeline Session Bootstrap — Tier 1 (Single Agent)

## Session Context

- **Feature ID**: {{FEATURE_ID}} | **Session**: {{SESSION_ID}} | **Run**: {{RUN_ID}}
- **Complexity**: {{COMPLEXITY}}
- **Init**: {{INIT_DONE}} | Artifacts: spec={{HAS_SPEC}} plan={{HAS_PLAN}}

## Your Mission

You are the **session orchestrator**. Implement Feature {{FEATURE_ID}}: "{{FEATURE_TITLE}}".

**CRITICAL**: You MUST NOT exit until ALL work is complete and committed.

**Tier 1 — Single Agent**: You handle everything directly. No subagents, no TeamCreate.

### Feature Description

{{FEATURE_DESCRIPTION}}

{{USER_CONTEXT}}

### Acceptance Criteria

{{ACCEPTANCE_CRITERIA}}

### Project Brief

> Product ideas checklist from planning. Lines marked [x] are already implemented. When your feature touches any [ ] item, ensure alignment. After implementation, mark relevant items [x] and append the key file/directory paths.

{{PROJECT_BRIEF}}

### Dependencies (Already Completed)

{{COMPLETED_DEPENDENCIES}}

### App Global Context

{{GLOBAL_CONTEXT}}

## ⚠️ Context Budget Rules (CRITICAL — read before any phase)

You are running in **headless non-interactive mode** with a FINITE context window. Exceeding it will crash the session and lose all work. Follow these rules strictly:

0. **NON-INTERACTIVE MODE** — There is NO human on the other end. NEVER ask for user confirmation, NEVER wait for user input, NEVER use interactive prompts (e.g. "Would you like me to…"). If a skill has an interactive step (e.g. offer remediation, ask for approval), skip it and proceed autonomously. Make decisions based on the data available and move forward.

1. **context-snapshot.md is your single source of truth** — After Phase 1 builds it, ALWAYS read context-snapshot.md instead of re-reading individual source files
2. **Never re-read your own writes** — After you create/modify a file, do NOT read it back to verify. Trust your write was correct.
3. **Stay focused** — Do NOT explore code unrelated to this feature. No curiosity-driven reads.
4. **One task at a time** — In Phase 3 (implement), complete and test one task before starting the next.
5. **Minimize tool output** — Never load full command output into context. First capture to a temp file (`cmd 2>&1 | tee /tmp/out.txt | tail -20`), then scan the head/tail to identify relevant fields, and use targeted filtering (`grep`, `sed`, `awk`) to extract only the information needed for the current task. Only read the filtered result — never the raw full output.
6. **No intermediate commits** — Do NOT run `git add`/`git commit` during Phase 1-3. All changes are committed once at the end in Phase 4 via `/prizmkit-committer`.
7. **Capture test output once** — When running test suites, always use `($TEST_CMD) 2>&1 | tee /tmp/test-out.txt | tail -20`. Then grep `/tmp/test-out.txt` for details. Never re-run the suite just to apply a different filter.

---

## PrizmKit Directory Convention

```
.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md
.prizmkit/specs/{{FEATURE_SLUG}}/plan.md              ← includes Tasks section
```

---

## Execution

{{IF_INIT_NEEDED}}
### Phase 0: Project Bootstrap
- Run `/prizmkit-init` (invoke the prizmkit-init skill)
- Run `python3 {{INIT_SCRIPT_PATH}} --project-root {{PROJECT_ROOT}} --feature-id {{FEATURE_ID}} --feature-slug {{FEATURE_SLUG}}`
- **CP-0**: Verify `.prizm-docs/root.prizm`, `.prizmkit/config.json` exist
{{END_IF_INIT_NEEDED}}
{{IF_INIT_DONE}}
### Phase 0: SKIP (already initialized)
{{END_IF_INIT_DONE}}

### Phase 1: Build Context Snapshot

```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now:
1. Read `.prizm-docs/root.prizm` and relevant L1 prizm docs
2. Detect source code directories: read KEY_FILES and STRUCTURE sections from `root.prizm` to identify where source code lives (e.g. `src/`, `app/`, `lib/`, `cmd/`, `packages/`, or project root). If `root.prizm` is missing, scan the project tree:
   ```bash
   find . -maxdepth 2 -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.go" -o -name "*.java" -o -name "*.rb" -o -name "*.rs" \) -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/vendor/*' | head -30
   ```
   Identify the top-level source directories from the results.
3. Scan the detected source directories for files related to this feature; read each one
4. Write `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: run the following to get a visual directory tree, then paste output:
     ```bash
     find . -maxdepth 2 -type d -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/__pycache__/*' -not -path '*/vendor/*' | sed -e 's;[^/]*/;|____;g;s;____|; |;g'
     ```
   - **Section 3 — Prizm Context**: content of root.prizm and relevant L1/L2 docs
   - **Section 4 — Existing Source Files**: **full verbatim content** of each related file in fenced code blocks (with `### path/to/file` heading and line count). Include ALL files needed for implementation and review — downstream phases read this section instead of re-reading individual source files
   - **Section 5 — Existing Tests**: full content of related test files as code block

### Phase 2: Plan & Tasks

```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/ 2>/dev/null
```

If plan.md missing, run `/prizmkit-plan` with `artifact_dir=.prizmkit/specs/{{FEATURE_SLUG}}/` to generate `plan.md`:
- The plan.md should include: key components, data flow, files to create/modify, and a Tasks section with `[ ]` checkboxes (each task = one implementable unit). Keep under 80 lines.
- Resolve any `[NEEDS CLARIFICATION]` markers using the feature description — do NOT pause for interactive input.

**Database Design Gate** (if feature involves data persistence — new tables, schema changes, new entities):
Before proceeding past CP-1:
1. Scan for existing schema files (`*.prisma`, `*.sql`, `migrations/`, `models/`, `*.entity.*`) and read them
2. Ensure new tables/fields follow existing naming conventions and constraint patterns
3. Resolve all uncertain DB design decisions before writing Tasks — document choices in plan.md

**CP-1**: plan.md exists with Tasks section.

### Phase 3: Implement + Test

**Build artifacts**: After any build/compile command (`go build`, `npm run build`, `tsc`, etc.), ensure the output binary or build directory is in `.gitignore`:
```bash
# Example for Go
grep -q '^/binary-name$' .gitignore || echo '/binary-name' >> .gitignore
```
Never commit compiled binaries, build output, or generated artifacts.

**3a.** Detect test commands and record baseline:

You know this project's tech stack. Identify ALL test commands that apply (e.g., `go test ./...`, `npm test`, `cargo test`, `pytest`, `make test`, etc.). Record them as `TEST_CMDS` (one or more commands). Then record baseline:
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

**3b-compact.** Context management — if plan.md has more than 5 tasks, run `/compact` after completing every 3 tasks during implementation. This prevents context window exhaustion in long sessions. If `/compact` is not available (non-Claude CLI), skip this step.

**3c.** After implement completes, verify:
1. All tasks in plan.md are `[x]`
2. Run the full test suite to ensure nothing is broken
3. Verify each acceptance criterion from Section 1 of context-snapshot.md is met — check mentally, do NOT re-read files you already wrote
4. If any criterion is not met, fix it now using the convergence-based recovery loop below

**CP-2**: All acceptance criteria met, all tests pass.

### Test Failure Recovery (Convergence-Based)

When tests fail, use convergence recovery — keep fixing while progress is being made:

1. **Run tests, record results**: count failures, exclude baseline failures
2. **Check termination**: All pass → done | Plateau (same failures 3 rounds) → stop | Failures decreased → continue
3. **Fix and iterate**: analyze, fix, re-run `($TEST_CMD)`, go back to step 1

**Key rule**: If failures decrease (even by 1), plateau counter resets. Do NOT block commit for unresolved failures — document and defer to next session.


{{IF_BROWSER_INTERACTION}}
### Phase 3.5: Browser Verification — MANDATORY

You MUST execute this phase. Do NOT skip it.

**Browser Tool**: {{BROWSER_TOOL}}

{{IF_BROWSER_TOOL_PLAYWRIGHT}}
**Using: playwright-cli**

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
Then verify installation succeeded: `playwright-cli --version`. If installation fails, log `## Browser Verification: SKIPPED — playwright-cli installation failed` in context-snapshot.md and proceed to the next phase.

0b. Learn playwright-cli usage (run once per session):
```bash
playwright-cli --help
```

0c. Check if playwright-cli skill is installed for the current AI platform:
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

0d. Read the installed playwright-cli skill (SKILL.md) for workflow guidance. Use its recommended patterns to construct your verification flow.

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
6. Open the app in playwright-cli: `playwright-cli open http://localhost:$DEV_PORT`
7. If the page requires authentication, use playwright-cli to register a test user and log in first

**Step 2 — Verification**:

Use `playwright-cli snapshot` on the running app to discover actual element refs, then verify these goals:
   {{BROWSER_VERIFY_STEPS}}

Construct your verification workflow based on: (1) the playwright-cli skill documentation, (2) the `--help` output, (3) the current task's acceptance criteria. Decide the concrete playwright-cli actions yourself. Take a final screenshot: `playwright-cli screenshot`.

**Step 3 — Cleanup (REQUIRED — you started it, you stop it)**:

1. Close the playwright-cli browser: `playwright-cli close`
2. Kill the dev server process: `kill $DEV_SERVER_PID 2>/dev/null || true`
3. Verify port is released: `lsof -ti:$DEV_PORT | xargs kill -9 2>/dev/null || true`
{{END_IF_BROWSER_TOOL_PLAYWRIGHT}}
{{IF_BROWSER_TOOL_OPENCLI}}
**Using: opencli** (reuses Chrome logged-in sessions)

**CRITICAL CONSTRAINT — opencli browser ONLY**:
- You MUST use `opencli browser` for ALL browser interactions in this phase
- All browser actions go through `opencli browser <command>` in the Bash tool

**Step 0 — OpenCLI Readiness Check (BLOCKING)**:

0a. Check if `opencli` is installed:
```bash
which opencli 2>/dev/null && opencli --version 2>/dev/null || echo "NOT_INSTALLED"
```
If `NOT_INSTALLED`: `npm install -g @jackwener/opencli@latest`. If installation fails, log `## Browser Verification: SKIPPED — opencli installation failed` and proceed.

0b. Verify Browser Bridge: `opencli doctor`. If fails, log skip and proceed.

0c. Learn usage: `opencli browser --help 2>/dev/null || opencli --help`

**Step 1 — Start Dev Server**: (same port detection as playwright path)
```bash
DEV_PORT={{DEV_PORT}}
if [ "$DEV_PORT" = "{{DEV_PORT}}" ]; then
  DEV_PORT=$(node -e "const s=require('./package.json').scripts.dev; const m=s.match(/-p\s+(\d+)/); console.log(m?m[1]:'')" 2>/dev/null)
  DEV_PORT=${DEV_PORT:-3000}
fi
```
Start server, wait for ready, then: `opencli browser open http://localhost:$DEV_PORT && opencli browser state`

**Step 2 — Verification**:

Use `opencli browser state` to discover elements with `[N]` indices, then verify:
   {{BROWSER_VERIFY_STEPS}}

Chain commands: `opencli browser click <N> && opencli browser wait time 1 && opencli browser state`

**Step 3 — Cleanup**:
1. `opencli browser close`
2. `kill $DEV_SERVER_PID 2>/dev/null || true`
3. `lsof -ti:$DEV_PORT | xargs kill -9 2>/dev/null || true`
{{END_IF_BROWSER_TOOL_OPENCLI}}
{{IF_BROWSER_TOOL_AUTO}}
**Tool Selection**: Choose the best browser tool at runtime.

**Step 0 — Detect available tools**:
```bash
echo "=== playwright-cli ===" && which playwright-cli 2>/dev/null && playwright-cli --version 2>/dev/null || echo "NOT_INSTALLED"
echo "=== opencli ===" && which opencli 2>/dev/null && opencli --version 2>/dev/null || echo "NOT_INSTALLED"
```
If opencli installed: `opencli doctor 2>/dev/null || echo "OPENCLI_BRIDGE_FAILED"`

**Decision table**:
| Condition | Tool |
|-----------|------|
| Only playwright-cli available | playwright-cli |
| Only opencli available (doctor passes) | opencli |
| Both — local dev server, forms, components | playwright-cli |
| Both — needs real login state (OAuth/SSO) | opencli |
| Both — third-party integration verification | opencli |
| Neither available | Install playwright-cli as default |

Then follow the corresponding tool's workflow above (Steps 1-3).
{{END_IF_BROWSER_TOOL_AUTO}}

**Step 4 — Reporting**:

Append results to `context-snapshot.md`:
   ```
   ## Browser Verification
   Tool: <playwright-cli or opencli>
   URL: http://localhost:$DEV_PORT
   Dev Server Command: <actual command used>
   Tool version: <version>
   Steps executed: [list of commands used]
   Screenshot: [path]
   Result: PASS / FAIL (reason)
   Server cleanup: confirmed
   Browser cleanup: confirmed
   ```

If verification fails, log the failure details but continue to commit. Failures do NOT block the commit, but you MUST attempt verification and MUST clean up the dev server.
{{END_IF_BROWSER_INTERACTION}}

### Phase 4: Architecture Sync & Commit (SINGLE COMMIT)

**4a.** Run `/prizmkit-retrospective` — maintains `.prizm-docs/` (architecture index):
1. **Structural sync**: Use `git diff --cached --name-status` to locate changed modules, update KEY_FILES/INTERFACES/DEPENDENCIES/file counts in affected `.prizm-docs/` files
2. **Architecture knowledge** (feature sessions only): Extract TRAPS/RULES/DECISIONS from completed work into `.prizm-docs/`
3. **L2 coverage check**: For any module/sub-module with source files created or significantly modified in this session but no L2 `.prizm` doc — evaluate whether L2 is warranted and create if so. The current session has the best context for accurate KEY_FILES, TRAPS, and DECISIONS.
4. Stage doc changes: `git add .prizm-docs/`
⚠️ Do NOT commit here. Only stage.

**4b.** Stage all feature code explicitly (NEVER use `git add -A` or `git add .`):
```bash
git add <specific-files-created-or-modified>
git add .prizm-docs/
```

**4c.** Run `/prizmkit-committer` → THE ONLY commit for this feature:
`feat({{FEATURE_ID}}): {{FEATURE_TITLE}}`
This single commit includes: feature code + tests + .prizm-docs/ updates. Do NOT push.
- MANDATORY: commit must be done via `/prizmkit-committer` skill. Do NOT run manual `git add`/`git commit` as a substitute.
- Do NOT run `update-feature-status.py` here — the pipeline runner handles feature-list.json updates automatically after session exit.

**4d.** Final verification:
```bash
git status --short
```
Working tree MUST be clean after this step. If any feature-related files remain, stage them into the SAME commit via `git add <file> && git commit --amend --no-edit`, do NOT create a separate commit.

**Exception**: `session-summary.md` in the artifact directory is a local cross-session artifact generated by `/prizmkit-committer` — it is NOT committed to git. Ignore it in the clean-tree check.

**4e.** Write completion summary for downstream dependency context:

Write `.prizmkit/specs/{{FEATURE_SLUG}}/completion-summary.json` with the key changes from this session. This file is NOT committed to git — the pipeline runner reads it to propagate context to dependent features.

```json
{
  "completion_notes": [
    "<each item: one key change, API, model, or integration point that downstream features may need>",
    "Example: Added User model (id, email, password_hash, display_name) in prisma/schema.prisma",
    "Example: POST /api/auth/register and POST /api/auth/login endpoints in src/api/auth.ts",
    "Example: Auth middleware in src/middleware/auth.ts — validates JWT on protected routes"
  ]
}
```

Rules for writing completion notes:
- Focus on **what downstream features need to know**: new APIs, models, exported functions, key file paths
- Each note should be self-contained and concise (one line, under 120 characters preferred)
- Include 3-8 notes covering the most important changes
- Do NOT include test files, config changes, or internal implementation details unless they affect other features
- If this feature has no downstream dependents, still write the summary (it serves as documentation)

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/{{FEATURE_SLUG}}/` |
| Context Snapshot | `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` |
| Project Root | {{PROJECT_ROOT}} |

## Failure Capture Protocol

If you encounter an unrecoverable error, context overflow, or are about to exit without completing all phases:

1. Write `.prizmkit/specs/{{FEATURE_SLUG}}/failure-log.md` BEFORE exiting:
   ```
   FAILURE_TYPE: timeout | test_failure | review_rejected | context_overflow | unknown
   PHASE: <which phase failed>
   ROOT_CAUSE: <1-2 sentence explanation>
   ATTEMPTED: <approaches already tried>
   SUGGESTION: <what the next session should try differently>
   DISCOVERED_TRAPS:
   - [CRITICAL|HIGH|LOW] <gotcha discovered during this failed session> | FIX: <approach>
   ```

2. This file is intentionally lightweight — write it BEFORE context runs out.

**Lifecycle**: failure-log.md is a temporary cross-session artifact. Do NOT commit it to git. After a successful session (all phases complete + commit done), delete it:
```bash
rm -f .prizmkit/specs/{{FEATURE_SLUG}}/failure-log.md
```

## Reminders

- Tier 1: you handle everything directly — no subagents needed
- MANDATORY skills: `/prizmkit-retrospective`, `/prizmkit-committer` — never skip these
- Build context-snapshot.md FIRST; use it throughout instead of re-reading files
- `/prizmkit-committer` is mandatory — do NOT skip the commit phase, and do NOT replace it with manual git commit commands
- Do NOT run `git add`/`git commit` during Phase 1-3 — all changes are committed once in Phase 4
- If any files remain after the commit, amend the existing commit — do NOT create a follow-up commit
- When staging files, always use explicit file names — NEVER use `git add -A` or `git add .`
