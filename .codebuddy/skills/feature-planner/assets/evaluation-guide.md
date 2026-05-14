# feature planner Evaluation Guide

This guide is for maintainers who evaluate and iterate on the `feature-planner` skill quality.

## Evaluation & Quality Gates (Optional but Recommended)

After multiple planning cycles or before committing refined skill logic, run standardized evaluation.

### One-Command Evaluation

Requires npm setup:

```bash
npm run skill:review -- \
  --workspace .prizmkit/skill-evals/feature-planner-workspace \
  --iteration iteration-N \
  --skill-name feature-planner \
  --skill-path ${SKILL_DIR} \
  --runs 3 \
  --grader-cmd "python ${SKILL_DIR}/scripts/validate-and-generate.py grade --workspace {workspace} --iteration {iteration}"
```

Produces:
- `benchmark.json` — quantitative metrics (pass rate, feature quality, time)
- `benchmark.md` — human-readable summary
- `review.html` — interactive evaluation viewer

### Metrics Tracked

| Metric | Computation | Target | Interpretation |
|--------|-------------|--------|-----------------|
| `plan_validity` | % runs with validation pass | >95% | Higher = more robust planning |
| `avg_features_per_run` | avg feature count | ±20% consistency | Should be stable across runs |
| `avg_acceptance_criteria` | AC count per feature | 4-6 | Target sweet spot for test coverage |
| `dependency_complexity` | max DAG depth, cycle count | depth < 5 | Manageable dependency graph |
| `description_quality` | word count, keyword coverage | min 20 words | Sufficient AC detail |
| `latency_sec` | wall-clock execution time | <120s per run | UX acceptable |

### When to Run Evaluation

- After major SKILL.md revisions
- Before releasing new skill updates
- Quarterly quality assurance
- Post-optimization to measure improvement

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

