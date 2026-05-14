# Dev-Pipeline Refactor Session Bootstrap

## Session Context

- **Refactor ID**: {{REFACTOR_ID}}
- **Refactor Title**: {{REFACTOR_TITLE}}
- **Refactor Type**: {{REFACTOR_TYPE}}
- **Priority**: {{PRIORITY}}
- **Complexity**: {{COMPLEXITY}}

## Your Mission

You are the **refactor session orchestrator**. Execute Refactor {{REFACTOR_ID}}: "{{REFACTOR_TITLE}}".

**CRITICAL SESSION LIFECYCLE RULE**: You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, you MUST **wait for each to finish** (run_in_background=false) before proceeding. Do NOT spawn an agent in the background and exit — that kills the session.

**NON-INTERACTIVE MODE**: You are running in headless non-interactive mode. There is NO human on the other end. NEVER ask for user confirmation, NEVER wait for user input, NEVER use interactive prompts (e.g. "Would you like me to…"). If a skill has an interactive step (e.g. offer remediation, ask for approval), skip it and proceed autonomously. Make decisions based on the data available and move forward.

**MANDATORY TEAM REQUIREMENT**: You MUST use the `prizm-dev-team` agents (Dev + Reviewer). This is NON-NEGOTIABLE. All implementation and review work MUST be performed by the appropriate team agents (Dev, Reviewer). You are the orchestrator — handle coordination, planning, and commit phases directly.

**REFACTOR DOCUMENTATION POLICY**:
- **DEFAULT**: Run `/prizmkit-retrospective` with full sync (Job 1 + Job 2), because refactoring changes code structure and interfaces.
- **SKIP Job 2** only if the refactor is a pure rename with no interface changes.
- Commit with `refactor(<scope>):` prefix, NOT `feat:` or `fix:`

### Team Definition Reference

- **Team config**: `{{TEAM_CONFIG_PATH}}`

### Refactor Description

{{REFACTOR_DESCRIPTION}}

{{USER_CONTEXT}}

### Scope

**Files:**
{{SCOPE_FILES}}

**Modules:**
{{SCOPE_MODULES}}

### Behavior Preservation

- **Strategy**: {{BEHAVIOR_STRATEGY}}
- **Existing Tests**:
{{EXISTING_TESTS}}
- **New Tests Needed**:
{{NEW_TESTS_NEEDED}}

### Acceptance Criteria

{{ACCEPTANCE_CRITERIA}}

### Dependencies

{{DEPENDENCIES}}

### App Global Context

{{GLOBAL_CONTEXT}}

### Project Conventions

> Read {{PLATFORM_CONVENTIONS}} for project-level coding standards, architecture decisions, and development rules.

## Refactor Artifacts Directory

**ALWAYS** use per-refactor subdirectory `.prizmkit/refactor/{{REFACTOR_ID}}/`:

```
.prizmkit/refactor/{{REFACTOR_ID}}/
├── spec.md              ← /prizmkit-plan output (goals, scope, behavior preservation)
├── plan.md              ← /prizmkit-plan output (change approach, tasks)
└── refactor-report.md   ← Phase 5 output (generated after commit)
```

## Execution Instructions

**YOU are the orchestrator. Execute each phase by spawning the appropriate team agent with run_in_background=false.**

## Workflow Checkpoint System

A checkpoint file tracks your progress through this workflow:

**Path**: `{{CHECKPOINT_PATH}}`

**How to use**:
1. **Before each step**: Read `workflow-checkpoint.json`, verify the previous step has `status: "completed"` or `status: "skipped"`. If not, complete it first.
2. **After completing a step**: Update the step's `status` to `"completed"` in `workflow-checkpoint.json`.

### Step 1: Initialize

#### Agent Setup

Reference `{{TEAM_CONFIG_PATH}}` for agent definitions:
- Dev: `{{DEV_SUBAGENT_PATH}}`
- Reviewer: `{{REVIEWER_SUBAGENT_PATH}}`

Create refactor artifacts directory:
```bash
mkdir -p .prizmkit/refactor/{{REFACTOR_ID}}
```

### Step 2: Pipeline Phases

#### Phase 1: Plan — Specification & Plan Generation

**Goal**: Generate spec.md and plan.md with behavior-preserving task breakdown.

Run `/prizmkit-plan` with `artifact_dir=.prizmkit/refactor/{{REFACTOR_ID}}/`:
- Description: "{{REFACTOR_TITLE}} — {{REFACTOR_DESCRIPTION}}"
- The spec.md MUST include:
  - Goals with acceptance criteria (from the acceptance criteria above)
  - Scope (files and modules from above)
  - Behavior Preservation section (strategy: {{BEHAVIOR_STRATEGY}}, existing tests, what must not change)
- The plan.md MUST include:
  - Change approach with behavior preservation strategy
  - Tasks ordered by safety: safe renames first → extractions → structural changes
  - Every task ends with "run test suite to verify behavior preserved"
  - Rollback strategy

Resolve any `[NEEDS CLARIFICATION]` markers using the refactor description — do NOT pause for interactive input.

{{IF_BROWSER_INTERACTION}}

#### Browser Verification Strategy

The refactor may affect UI behavior. Browser verification can validate:
- **UI Render**: UI components render identically after refactoring
- **User Interactions**: Navigation, form submissions, and workflows function as before
- **Feature Coverage**: Refactored features work end-to-end in real browser environment

{{IF_BROWSER_TOOL_AUTO}}
Browser tool will be auto-selected at runtime based on dev server and feature complexity.
{{END_IF_BROWSER_TOOL_AUTO}}

{{IF_BROWSER_TOOL_PLAYWRIGHT}}
**Tool: playwright-cli** — Local isolated browser instance for dev server verification
{{END_IF_BROWSER_TOOL_PLAYWRIGHT}}

{{IF_BROWSER_TOOL_OPENCLI}}
**Tool: opencli** — Chrome session with existing login for testing OAuth/third-party integrations
{{END_IF_BROWSER_TOOL_OPENCLI}}

**Verification Goals**:
{{BROWSER_VERIFY_STEPS}}

Include browser verification approach in plan.md:
- Which UI flows should be smoke-tested after refactoring?
- Any specific user journeys affected by the structural changes?
- Should verification be part of review phase or implementation phase?

{{END_IF_BROWSER_INTERACTION}}

- **CP-RF-1**: Both `spec.md` and `plan.md` exist in `.prizmkit/refactor/{{REFACTOR_ID}}/`
- **Checkpoint update**: set step `prizmkit-plan` to `"completed"` in `{{CHECKPOINT_PATH}}`

---

#### Phase 2: Implement — Behavior-Preserving Refactoring

**Goal**: Execute all tasks from plan.md while preserving existing behavior.

- Spawn Dev agent (Agent tool, subagent_type="prizm-dev-team-dev", run_in_background=false)
  Prompt: "Read {{DEV_SUBAGENT_PATH}}. For refactor {{REFACTOR_ID}} ('{{REFACTOR_TITLE}}'):
  1. Read `.prizmkit/refactor/{{REFACTOR_ID}}/spec.md` and `.prizmkit/refactor/{{REFACTOR_ID}}/plan.md`
  2. Read `.prizm-docs/` for affected modules (TRAPS, RULES, PATTERNS)
  3. Before making any changes, run the existing test suite to establish a green baseline
  4. Run `/prizmkit-implement` with `artifact_dir=.prizmkit/refactor/{{REFACTOR_ID}}/` — this handles the full implementation cycle:
     - Reads plan.md Tasks section
     - Implements task-by-task, marking each `[x]` immediately
     - Runs tests after EVERY task — all tests MUST pass (behavior preservation)
     - If tests fail: revert the task, analyze why, try alternative approach
     - Writes '## Implementation Log' to context-snapshot.md (or equivalent)
  5. Do NOT change behavior — only improve structure

{{IF_BROWSER_INTERACTION}}

  6. **Browser Smoke Tests** (after every major refactor task):
     - Use browser tools to verify UI still renders correctly
     - Test the primary user flows affected by the refactoring
     - Confirm no visual or interactive regressions
     - Document any manual browser verification steps in implementation notes

{{END_IF_BROWSER_INTERACTION}}

  7. If the refactor involves multiple files: run `/compact` after completing half the tasks to free context budget. If `/compact` is unavailable, continue without it.
  8. After all tasks complete, run the full test suite one final time
  "
- **Wait for Dev to return**
- If Dev reports test failures that cannot be resolved after 3 attempts: escalate, write status="failed"
- **CP-RF-2**: All tasks completed, all tests green
- **Checkpoint update**: set step `prizmkit-implement` to `"completed"` in `{{CHECKPOINT_PATH}}`

---

#### Phase 3: Review — Code Review & Behavior Verification

**Goal**: Verify refactoring quality and behavior preservation.

- Spawn Reviewer agent (Agent tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false)
  Prompt: "Read {{REVIEWER_SUBAGENT_PATH}}. For refactor {{REFACTOR_ID}}:
  1. Read `.prizmkit/refactor/{{REFACTOR_ID}}/spec.md` for goals and behavior preservation contracts
  2. Read `.prizmkit/refactor/{{REFACTOR_ID}}/plan.md` for architecture decisions and completed tasks
  3. Run `/prizmkit-code-review` with artifact_dir=.prizmkit/refactor/{{REFACTOR_ID}}/. The skill runs an internal review-fix loop (Reviewer → filter → Dev fix, max 3 rounds) and writes review-report.md.
  4. Run full test suite and verify ALL tests pass

{{IF_BROWSER_INTERACTION}}

  5. **Browser Verification Review**:
     - Verify that critical user workflows still function end-to-end in browser
     - Confirm UI renders consistently after structural changes
     - Validate any behavior-sensitive components behave identically
     - Document browser verification findings in review-report.md

{{END_IF_BROWSER_INTERACTION}}

  6. review-report.md will be written to .prizmkit/refactor/{{REFACTOR_ID}}/ by prizmkit-code-review
  7. Report: verdict (PASS/NEEDS_FIXES), number of rounds, findings fixed/rejected
  "
- **Wait for Reviewer to return**
- Read `review-report.md` — if PASS proceed, if NEEDS_FIXES log remaining findings and proceed.
- **CP-RF-3**: Code review complete, tests pass, behavior preserved
- **Checkpoint update**: set step `prizmkit-code-review` to `"completed"` in `{{CHECKPOINT_PATH}}`

---

#### Phase 4: Commit & Report

**Goal**: Commit the refactor, update docs, generate report.

**This phase is executed by YOU (the orchestrator), NOT a subagent.**

1. Run `/prizmkit-retrospective` (full sync — Job 1 + Job 2) to update `.prizm-docs/` with structural changes

2. Run `/prizmkit-committer --headless` with:
   - Commit message: `refactor({{REFACTOR_ID}}): {{REFACTOR_TITLE}}`
   - Include all refactored files and any new/updated tests
   - Do NOT push (user will push manually)

3. Write the refactor report to `.prizmkit/refactor/{{REFACTOR_ID}}/refactor-report.md`

   The refactor-report.md MUST contain these sections:
   - Refactor Summary (ID, title, type, status, phases completed)
   - What Changed (files modified, structural changes made, diff summary)
   - Behavior Verification (test suite results before/after, specific tests exercised)

{{IF_BROWSER_INTERACTION}}

   - Browser Verification (UI flows tested, tools used, any manual verification performed)

{{END_IF_BROWSER_INTERACTION}}

   - Code Quality Metrics (if measurable: files consolidated, duplication reduced, etc.)
   - Acceptance Criteria Verification (checklist with pass/fail for each criterion)

4. Write completion summary for downstream dependency context:

   Write `.prizmkit/refactor/{{REFACTOR_ID}}/completion-summary.json` — this is NOT committed to git. The pipeline runner reads it to propagate context to dependent refactors.
   ```json
   {
     "completion_notes": [
       "<each item: one key structural change that downstream refactors may need to know>",
       "Example: Extracted shared validation logic into src/utils/validation.ts",
       "Example: Renamed UserService → AuthService, moved from src/services/ to src/auth/",
       "Example: Decoupled payment module from user module via PaymentGateway interface"
     ]
   }
   ```
   Rules: focus on structural changes, new module boundaries, renamed/moved files, changed interfaces. 3-8 notes, each under 120 chars.

- **CP-RF-4**: Commit recorded, refactor-report.md written, .prizm-docs/ updated
- **Checkpoint update**: set steps `prizmkit-committer` and `refactor-report` to `"completed"` in `{{CHECKPOINT_PATH}}`

### Step 3: Report Session Status

**CRITICAL**: Before this session ends, you MUST write the session status file.

Write to: `{{SESSION_STATUS_PATH}}`

```json
{
  "session_id": "{{SESSION_ID}}",
  "refactor_id": "{{REFACTOR_ID}}",
  "status": "<success|partial|failed>",
  "completed_phases": [1, 2, 3, 4],
  "current_phase": 4,
  "checkpoint_reached": "CP-RF-4",
  "errors": [],
  "can_resume": false,
  "resume_from_phase": null,
  "artifacts": {
    "spec_path": ".prizmkit/refactor/{{REFACTOR_ID}}/spec.md",
    "plan_path": ".prizmkit/refactor/{{REFACTOR_ID}}/plan.md",
    "report_path": ".prizmkit/refactor/{{REFACTOR_ID}}/refactor-report.md"
  },
  "git_commit": "<commit hash>",
  "behavior_preserved": true,
  "timestamp": "{{TIMESTAMP}}"
}
```

**Status values**: `success` (all phases done) | `partial` (can resume) | `failed` (unrecoverable)

## Critical Paths

| Resource | Path |
|----------|------|
| Team Definition (source of truth) | `{{TEAM_CONFIG_PATH}}` |
| Refactor Artifacts Dir | `.prizmkit/refactor/{{REFACTOR_ID}}/` |
| Spec | `.prizmkit/refactor/{{REFACTOR_ID}}/spec.md` |
| Plan | `.prizmkit/refactor/{{REFACTOR_ID}}/plan.md` |
| Refactor Report | `.prizmkit/refactor/{{REFACTOR_ID}}/refactor-report.md` |
| Dev Agent Def | {{DEV_SUBAGENT_PATH}} |
| Reviewer Agent Def | {{REVIEWER_SUBAGENT_PATH}} |
| Session Status Output | {{SESSION_STATUS_PATH}} |
| Workflow Checkpoint | {{CHECKPOINT_PATH}} |
| Project Root | {{PROJECT_ROOT}} |

## Reminders

- **MANDATORY**: Use `prizm-dev-team` agents — single-agent execution is FORBIDDEN
- **Behavior preservation is the #1 priority**: If tests break, stop and fix before proceeding
- **Run tests after EVERY task** — not just at the end
- Use `/prizmkit-plan` with `artifact_dir=.prizmkit/refactor/{{REFACTOR_ID}}/` for spec + plan generation
- **Commit with** `refactor(<scope>):` prefix, NOT `feat:` or `fix:`
- **Run full retrospective** (Job 1 + Job 2) — refactoring changes code structure
- ALWAYS write session-status.json before exiting
- Do NOT use `run_in_background=true` when spawning agents
