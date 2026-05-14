# Verification Checklist — Spec & Plan Consistency

Run this checklist after generating the Tasks section in plan.md. Fix any issues inline before outputting the final plan.

---

## Coverage

- [ ] Every goal (G-N) in spec.md has at least one task in plan.md
- [ ] Every task has a target file path (`— file: path/to/file`)
- [ ] Risk assessment contains at least one risk with a mitigation plan
- [ ] If spec includes `## Behavior Preservation` → at least one verification task exists
- [ ] If spec includes `## Root Cause` → at least one reproduction test task exists

## Duplication Detection

- [ ] No near-duplicate requirements exist across spec.md sections (same intent, different wording)
- [ ] If duplicates found, consolidate to the clearer phrasing and remove the other

## Orphan Detection

- [ ] No task exists without a mapped goal (orphan task)
- [ ] No plan component exists without a corresponding spec requirement

## Ambiguity Scan

- [ ] No unresolved `[NEEDS CLARIFICATION]`, TBD, TODO, or `???` markers remain
- [ ] No vague criteria without measurable thresholds (e.g., "fast", "secure", "scalable", "intuitive" — replace with concrete numbers or conditions)

## Terminology Consistency

- [ ] Same concept uses the same name in both spec.md and plan.md (no terminology drift)
- [ ] Data entities referenced in plan.md exist in spec.md (and vice versa)

## Task Ordering

- [ ] No task references the output of a later task without an explicit dependency note
- [ ] Foundation tasks precede Core tasks that depend on them
- [ ] Checkpoint tasks exist between phases

## Rules Alignment

- [ ] No spec or plan element conflicts with `.prizm-docs/root.prizm` RULES MUST/NEVER directives
- [ ] Tech stack choices in plan.md match `.prizm-docs/root.prizm` TECH_STACK (if defined)

## Database Design (skip if no Data Model section)

- [ ] New entity/field naming follows conventions documented in "Existing Schema Audit"
- [ ] All fields have explicit nullability (NOT NULL or nullable)
- [ ] Foreign key constraints and indexes are defined
- [ ] ID strategy and timestamp patterns match existing tables
- [ ] No unresolved questions remain in Data Model "Unresolved Questions" section
- [ ] Style Conformance Checklist in plan.md is fully checked

## Action on Failure

If any check fails:
1. Fix the issue directly in spec.md or plan.md
2. Re-run the failed checks only
3. Do not proceed to output until all checks pass

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

