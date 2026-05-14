# Browser Interaction Planning

For web apps with UI, features that involve user-facing pages or interactive flows can optionally include a `browser_interaction` field. This enables the dev-pipeline to verify UI behavior automatically using `playwright-cli` after implementation.

## How to Capture

During Phase 4.2, auto-generate `browser_interaction` for all qualifying features (see SKILL.md §Browser Interaction Planning for auto-detection rules). Present a **batch summary** to the user showing which features received `browser_interaction` — do NOT ask per-feature. The user can opt out specific features from the summary.

For each qualifying feature, generate the `browser_interaction` object:

```json
{
  "browser_interaction": {
    "verify_steps": [
      "Verify login form renders with email and password fields",
      "Verify valid credentials redirect to dashboard",
      "Verify invalid password shows error message"
    ]
  }
}
```

## Field Rules

- `tool` selects the browser verification tool. Values: `"playwright-cli"`, `"opencli"`, `"auto"` (default).
  - **`"auto"`** (default): AI chooses at runtime based on available tools and scenario. Recommended for most cases.
  - **`"playwright-cli"`**: Isolated browser instance, no login state. Best for local dev server verification, form testing, component rendering checks.
  - **`"opencli"`**: Reuses Chrome's logged-in sessions via Browser Bridge. Best for verifying third-party integrations (OAuth callbacks, API dashboards), features requiring real authentication state, or pages behind SSO.

  | Scenario | Recommended `tool` |
  |----------|-------------------|
  | Local dev server, pure frontend components | `playwright-cli` |
  | Needs real login state (e.g., OAuth redirect page) | `opencli` |
  | Third-party API integration dashboard verification | `opencli` |
  | Headless CI environment | `playwright-cli` |
  | Unsure / mixed scenarios | `auto` |

- `verify_steps` are **verification goals**, not specific tool commands. Describe WHAT to verify, not HOW to verify it. The pipeline AI will:
  1. Auto-detect the dev server start command from project config (`package.json`, `Makefile`, etc.)
  2. Start the server and discover the URL/port at runtime
  3. Use `playwright-cli snapshot` to discover real element refs
  4. Decide the concrete click/fill/assert operations itself
  This works better than prescribing URLs/commands at planning time because: (1) ports may differ across environments, (2) element refs don't exist yet, (3) UI structure may change during implementation, (4) the AI has full context of the actual code when it runs verification.
  - **Good**: `"Verify login form accepts valid credentials and redirects to dashboard"`
  - **Bad**: `"click <ref> — click login button"` (guesses at refs that don't exist yet)
- Do NOT specify `url`, `setup_command`, or `port` — the AI detects these at runtime from the actual project configuration
- An empty `browser_interaction: {}` object (no verify_steps) is valid — the AI will explore the app and verify the feature works as expected

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

