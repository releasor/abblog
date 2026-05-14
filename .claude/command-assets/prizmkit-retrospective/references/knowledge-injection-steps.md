# Knowledge Injection — Detailed Steps (2a–2c)

**2a.** Gather context — read the **actual code that was changed** plus any available artifacts:

- `git diff HEAD` — the real source of truth for what happened
- `review-report.md` in the artifact directory — read the findings and fix instructions. If this file exists, use it as a source for pre-categorized decisions and findings.
- `plan.md` in the artifact directory — read planned vs actual
- Any companion documents in the artifact directory (e.g., `refactor-analysis.md`, `fix-report.md`) — read what was discovered
- The relevant `.prizm-docs/` L1/L2 docs for affected modules

**2b.** Extract knowledge from what was **observed in code**, not invented:

**TRAPS** (highest priority) — things that look safe but break:
- Minimal format: `- [SEVERITY] <description> | FIX: <approach>`
- Full format: `- [SEVERITY] <description> | FIX: <approach> | REF: <hash> | STALE_IF: <glob>`
- Source: actual bugs hit, surprising behavior discovered in code, non-obvious coupling

**TRAPS severity classification**:
- `[CRITICAL]`: data loss, security, financial error, system crash
- `[HIGH]`: functional failure, silent error, interface incompatibility
- `[LOW]`: misleading naming, non-intuitive API, minor performance issue

When writing TRAPS:
- Severity prefix is MANDATORY (e.g., `[CRITICAL]`, `[HIGH]`, `[LOW]`)
- OPTIONAL: append `| REF: <7-char-hash>` when you know the relevant commit (for traceability)
- OPTIONAL: append `| STALE_IF: <glob>` when the TRAP is tightly coupled to specific files (for auto-expiry detection)

**Consuming [REVIEW] markers** (from staleness check 1g):
- If you encounter a TRAP prefixed with `[REVIEW]` (e.g., `[REVIEW][HIGH] ...`), verify whether the trap is still valid by checking the current code. If still valid: remove the `[REVIEW]` prefix, keeping the severity. If no longer relevant: delete the TRAP entry and append CHANGELOG.

**RULES** — conventions established or constraints discovered:
- Format: `- MUST/NEVER/PREFER: <rule>`
- Source: patterns that proved necessary during implementation

**DECISIONS** — key design choices that affect future development:
- Format: `- <what was decided> — <rationale>`
- Source: non-obvious design choices, interface conventions, cross-module contracts
- Only record decisions that a future AI session would benefit from knowing
- Do NOT record obvious implementation details that can be derived by reading the code

**QUALITY GATE**: Every item must answer: "If a new AI session reads only `.prizm-docs/` and this entry, does it gain actionable understanding?" If not, discard. Do not record trivially observable code patterns — the AI can read the code directly.

**2c.** Inject into the correct `.prizm-docs/` file:
- Module-level TRAPS/RULES/DECISIONS → the affected **L2** `.prizm` file. If the target L2 does not exist, create it first using the L2 GENERATION TEMPLATE before injecting knowledge. (TRAPS/DECISIONS/RULES belong in L2, not L1.)
- Project-level RULES/PATTERNS → `root.prizm` (respect the current format — MODULE_INDEX or MODULE_GROUPS — do not convert between them during injection)
- Cross-module concerns spanning 2+ modules → `root.prizm` CROSS_CUTTING section

**RULE**: Only add genuinely new information. Never duplicate existing entries. Never rewrite entire files.

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

