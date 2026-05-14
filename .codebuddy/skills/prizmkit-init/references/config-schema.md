# config.json Schema — Tech Stack Fields

## Merge Strategy

Handles re-init without losing user edits:

- Read existing `config.json` if present
- If `tech_stack` field exists AND `_auto_detected` is `false` or absent:
  → **SKIP** — user has manually configured tech stack, preserve their settings
- If `tech_stack` field exists AND `_auto_detected` is `true`:
  → **MERGE** — overwrite auto-detected values with new detection results, but preserve any keys the user added manually (keys not in the new detection result)
- If `tech_stack` field does NOT exist:
  → **WRITE** full detected tech stack with `"_auto_detected": true`
- Only include fields that were actually detected (no empty/null values)

## Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `adoption_mode` | string | `"passive"` \| `"advisory"` \| `"active"` |
| `platform` | string | `"codebuddy"` \| `"claude"` \| `"both"` |
| `tech_stack` | object | Detected or user-provided tech stack |
| `tech_stack._auto_detected` | boolean | `true` if auto-detected, `false` if user-provided |

## Examples

Fullstack project:
```json
{
  "adoption_mode": "passive",
  "platform": "claude",
  "tech_stack": {
    "language": "TypeScript",
    "runtime": "Node.js 20",
    "frontend_framework": "React",
    "frontend_styling": "Tailwind CSS",
    "backend_framework": "Express.js",
    "database": "PostgreSQL",
    "orm": "Prisma",
    "testing": "Vitest",
    "bundler": "Vite",
    "project_type": "fullstack",
    "_auto_detected": true
  }
}
```

Pure Python backend:
```json
{
  "adoption_mode": "passive",
  "platform": "claude",
  "tech_stack": {
    "language": "Python",
    "runtime": "Python >=3.11",
    "backend_framework": "FastAPI",
    "database": "PostgreSQL",
    "orm": "SQLAlchemy",
    "testing": "pytest",
    "project_type": "backend",
    "_auto_detected": true
  }
}
```

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

