# Dev-Pipeline Fallback Bootstrap Prompt

> **Note**: This is an emergency fallback template. Normally, `generate-bootstrap-prompt.py`
> selects a tier-specific template (`bootstrap-tier1.md`, `bootstrap-tier2.md`, or `bootstrap-tier3.md`).
> If you are seeing this prompt, the tier-specific templates were not found.

## Feature Context

- **Feature ID**: {{FEATURE_ID}}
- **Title**: {{FEATURE_TITLE}}
- **Description**: {{FEATURE_DESCRIPTION}}
- **Slug**: {{FEATURE_SLUG}}

{{USER_CONTEXT}}

### Acceptance Criteria

{{ACCEPTANCE_CRITERIA}}

## Instructions

You are running in **headless non-interactive mode** — no human is available for input.
Infer what needs to be done from the feature context above and follow the standard dev loop.

### Execution Steps

1. **Read context**: Read `.prizm-docs/root.prizm` and relevant L1/L2 docs to understand the codebase.

2. **Plan**: Run `/prizmkit-plan` with `artifact_dir=.prizmkit/specs/{{FEATURE_SLUG}}/` to produce `spec.md` and `plan.md`.

3. **Implement**: Run `/prizmkit-implement` with `artifact_dir=.prizmkit/specs/{{FEATURE_SLUG}}/` to execute the plan using TDD (write tests first, then implement).

4. **Test**: Run the project test suite to verify all tests pass with no regressions.

5. **Review**: Run `/prizmkit-code-review` with `artifact_dir=.prizmkit/specs/{{FEATURE_SLUG}}/` to review and auto-fix changes against the spec (internal review-fix loop, max 3 rounds).

6. **Retrospective**: Run `/prizmkit-retrospective` to sync `.prizm-docs/` with code changes.

7. **Commit**: Run `/prizmkit-committer --headless` to commit all changes. Do NOT push.

### Critical Rules

- Do NOT ask for user input — decide autonomously.
- Do NOT push to remote — the user will push manually.
- Write all artifacts to `.prizmkit/specs/{{FEATURE_SLUG}}/`.
- If a step fails after 3 attempts, write a status report and stop.
