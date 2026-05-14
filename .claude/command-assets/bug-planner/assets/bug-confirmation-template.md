# Bug Confirmation Templates

## Per-Bug Confirmation Template

Present this after extracting and clarifying each bug:

```
┌─ Bug Confirmation: B-NNN ─────────────────────────────
│ Title:       <auto-suggested title>
│ Description: <expected vs actual behavior>
│ Severity:    <auto-classified> | Verification: <type>
│
│ Reproduction: <steps if available, or "not provided">
│ Affected:     <module/feature or "unknown">
│
│ Acceptance Criteria (fix verified when):
│   1. <criterion — specific enough for automated pipeline to verify>
│   2. <criterion>
│
│ Open Questions:
│   - <any unclear points, or "None">
└────────────────────────────────────────────────────────
```

Then ask three confirmation questions:
1. "描述是否准确？是否需要修改？" / "Is the description accurate? Any corrections?"
2. "是否需要补充更多细节？（复现步骤、环境信息、相关代码位置等）" / "Need to add more details? (reproduction steps, environment, related code locations, etc.)"
3. "验证条件是否具体到 pipeline 可以自主判断修复成功？" / "Are the acceptance criteria specific enough that the pipeline can autonomously verify the fix?"

Only finalize the bug entry after user confirms all three points.

## Completeness Review Template

Display during Phase 4 pre-generation review:

```
┌─ Completeness Review ─────────────────────────────────────────────────
│ Bug    │ Description │ Criteria   │ Reproducible │ Notes
│ B-001  │ ✓ Clear     │ ✓ Specific │ ✓ Yes        │ —
│ B-002  │ ⚠ Vague     │ ⚠ Subjective│ ✓ Yes       │ "encoding works" → needs specific test case
│ B-003  │ ✓ Clear     │ ⚠ No metric│ ⚠ No steps  │ needs perf threshold + reproduction steps
└────────────────────────────────────────────────────────────────────────
```

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

