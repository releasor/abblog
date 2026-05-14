## Context Budget Rules (CRITICAL — read before any phase)

You are running in **headless non-interactive mode** with a FINITE context window. Exceeding it will crash the session and lose all work. Follow these rules strictly:

0. **NON-INTERACTIVE MODE** — There is NO human on the other end. NEVER ask for user confirmation, NEVER wait for user input, NEVER use interactive prompts (e.g. "Would you like me to…"). If a skill has an interactive step (e.g. offer remediation, ask for approval), skip it and proceed autonomously. Make decisions based on the data available and move forward.

1. **context-snapshot.md is your single source of truth** — After it is built, ALWAYS read context-snapshot.md instead of re-reading individual source files
2. **Never re-read your own writes** — After you create/modify a file, do NOT read it back to verify. Trust your write was correct.
3. **Stay focused** — Do NOT explore code unrelated to this feature. No curiosity-driven reads.
4. **One task at a time** — Complete and test one task before starting the next.
5. **Minimize tool output** — Never load full command output into context. First capture to a temp file (`cmd 2>&1 | tee /tmp/out.txt | tail -20`), then scan the head/tail to identify relevant fields, and use targeted filtering (`grep`, `sed`, `awk`) to extract only the information needed for the current task. Only read the filtered result — never the raw full output.
6. **No intermediate commits** — Do NOT run `git add`/`git commit` during implementation phases. All changes are committed once at the end via `/prizmkit-committer`.
7. **Capture test output once** — When running test suites, always use `($TEST_CMD) 2>&1 | tee /tmp/test-out.txt | tail -20`. Then grep `/tmp/test-out.txt` for details. Never re-run the suite just to apply a different filter.
8. **Scaffold / generated file awareness (CRITICAL)** — When you run a scaffolding tool or package manager init command (`npm init`, `npx create-*`, `vite create`, `cargo init`, `go mod init`, `rails new`, `django-admin startproject`, `npx shadcn-ui init`, etc.), the output files are **generated boilerplate**. You MUST:
   - Identify and mentally tag all files created by the tool as "scaffold files"
   - Record the list of scaffold-generated files in context-snapshot.md under a `### Scaffold Files (do not re-read)` section
   - **NEVER re-read scaffold files** after initial creation. Their content is standard boilerplate — you already know what they contain from the tool that generated them
   - If you need to modify a scaffold file, make the edit directly without reading it first (you know the standard template content)
   - This applies equally to `node_modules/`, `package-lock.json`, generated config files (`tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `.eslintrc`, etc.) produced by init commands
   - When passing context to subagents, explicitly tell them which files are scaffold-generated so they skip reading them too
9. **Package version verification (HARD CONSTRAINT — BLOCKING)** — Before writing ANY dependency version in `package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, `Gemfile`, `pyproject.toml`, or any other dependency manifest:
   - You MUST verify the real version exists by querying the package registry first:
     - npm/Node.js: `npm view <package> dist-tags.latest 2>/dev/null`
     - Python/pip: `pip index versions <package> 2>/dev/null | head -1`
     - Go: `go list -m -versions <module>@latest 2>/dev/null`
     - Rust: `cargo search <crate> --limit 1 2>/dev/null`
   - **NEVER guess or hallucinate version numbers**. If you cannot verify a version, use `"latest"` or `"*"` as a placeholder, or omit the version constraint entirely and let the package manager resolve it
   - If the registry query fails (network issue, package not found), you MUST either:
     (a) Use a known-safe version you have high confidence in, OR
     (b) Skip that dependency and document it as a manual step, OR
     (c) Use no version constraint (e.g., `"express": "*"`)
   - **This is a BLOCKING gate**: do NOT run `npm install` / `pip install` / `cargo build` / `go mod tidy` until ALL versions in the manifest have been verified or use open constraints
   - Batch version lookups: query multiple packages in parallel to save time (e.g., run multiple `npm view` commands concurrently)
