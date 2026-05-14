#!/usr/bin/env python3
"""Generate a recovery bootstrap prompt from detection output.

Reads the JSON output of detect-recovery-state.py, determines which workflow
was interrupted and at which phase, then assembles a comprehensive bootstrap
prompt that explicitly enumerates every remaining phase with full instructions.

Unlike the feature/bugfix prompt generators that use template files, this script
builds the prompt programmatically because recovery prompts vary dramatically
by workflow type and phase.

Usage:
    python3 generate-recovery-prompt.py \
        --detection-json <path> \
        --output <path> \
        [--project-root <path>] \
        [--session-id <id>]
"""

import argparse
import json
import os
import subprocess
import sys

from utils import load_json_file, setup_logging


LOGGER = setup_logging("generate-recovery-prompt")


# ============================================================
# Phase instruction maps — one per workflow type
#
# Each phase maps to (name, instructions) where instructions are
# adapted for autonomous (non-interactive) recovery mode.
# These must be kept in sync with the corresponding SKILL.md files.
# ============================================================

BUGFIX_PHASES = {
    0: (
        "Branch Setup",
        """\
Check current branch. You should already be on a fix/* branch from the
interrupted session. If so, continue on it. If somehow on main, create
a new fix branch:
```bash
git checkout -b fix/{bug_id}-recovery
```""",
    ),
    1: (
        "Deep Bug Diagnosis",
        """\
Read the bug description and all available artifacts to understand the bug.
Since this is an autonomous recovery session, skip interactive Q&A.
Use whatever information is available:
- Read bug entry from `.prizmkit/plans/bug-fix-list.json` if bug ID is known
- Read any existing artifacts in `.prizmkit/bugfix/{bug_id}/`
- Read relevant source code and test files
- Read `.prizm-docs/` for affected modules

Produce a bug summary with: symptom, reproduction steps, expected behavior,
affected files, and root cause hypothesis.""",
    ),
    2: (
        "Triage",
        """\
Locate affected code and identify root cause:
1. Read `.prizm-docs/root.prizm` then relevant L1/L2 docs for affected modules
2. Read files mentioned in the bug description or error/stack trace
3. Check `.prizm-docs/` TRAPS for known patterns
4. Classify: root cause (confirmed/suspected), blast radius, fix complexity
5. Log your diagnosis (no need to ask for user confirmation in autonomous mode)""",
    ),
    3: (
        "Reproduce",
        """\
Create a failing test that proves the bug exists:
1. Write a reproduction test: `<module>.test.ts` with test case `should handle <bug scenario>`
2. Run the test — confirm it FAILS (red)
3. If the bug is hard to reproduce automatically, write a best-effort test
   and proceed""",
    ),
    4: (
        "Fix",
        """\
Implement the minimal fix (red → green):
1. Read fix-plan.md if it exists for the planned approach
2. Change the minimum code to fix the root cause — do NOT refactor
3. Run the reproduction test — must PASS (green)
4. Run the full module test suite — must pass (no regressions)
5. If regressions occur, fix them (max 3 attempts)""",
    ),
    5: (
        "Review",
        """\
Verify fix quality:
1. Self-review: does the fix address root cause (not just symptom)?
   Edge cases covered? Follows project conventions?
2. Run full test suite one final time
3. If any issues found, fix and re-review (max 3 rounds)""",
    ),
    6: (
        "User Verification",
        """\
Since this is an autonomous recovery session, substitute automated verification
for manual user testing:
1. Run the full test suite
2. Verify ALL tests pass
3. If tests fail, fix and retry (max 3 attempts)
4. Proceed to next phase once all tests are green""",
    ),
    7: (
        "Commit & Merge",
        """\
Commit the fix and finalize:
1. Run `/prizmkit-retrospective` (structural sync only — update file counts,
   interfaces, dependencies in .prizm-docs/)
2. Stage all changed files explicitly (NEVER use `git add -A` or `git add .`)
3. Run `/prizmkit-committer --headless` with commit prefix `fix(<scope>): <description>`
4. Verify working tree is clean: `git status --short`
5. Write `fix-report.md` to `.prizmkit/bugfix/{bug_id}/fix-report.md` with:
   - Root cause summary
   - Fix description
   - Files changed
   - Test results""",
    ),
}

FEATURE_PHASES = {
    1: (
        "Brainstorm",
        """\
Since this is an autonomous recovery session, work with whatever context is
available. Read existing project files, `.prizm-docs/`, and any user-provided
materials to understand the requirements. Skip interactive Q&A.
Produce a requirements summary if one doesn't already exist.""",
    ),
    2: (
        "Plan",
        """\
Invoke `/feature-planner` skill with the requirements summary to generate
`.prizmkit/plans/feature-list.json`. Validate the output exists and contains
properly structured features.""",
    ),
    3: (
        "Launch",
        """\
Invoke `/feature-pipeline-launcher` skill:
- Input: path to `.prizmkit/plans/feature-list.json`
- The launcher handles execution mode selection and prerequisites
- Let the launcher present options and manage the pipeline start

If `/feature-pipeline-launcher` is not available, run the pipeline directly:
```bash
./dev-pipeline/run-feature.sh run .prizmkit/plans/feature-list.json
```""",
    ),
    4: (
        "Monitor",
        """\
Check pipeline status and report results:
```bash
python3 dev-pipeline/scripts/update-feature-status.py \\
  --feature-list .prizmkit/plans/feature-list.json \\
  --state-dir .prizmkit/state/features \\
  --action status
```
Report completion status for each feature.""",
    ),
}

REFACTOR_PHASES = {
    1: (
        "Brainstorm",
        """\
Since this is an autonomous recovery session, work with whatever context is
available. Read existing project files, `.prizm-docs/`, and any materials
to understand the refactoring goals. Skip interactive Q&A.
Produce a refactoring goals summary if one doesn't already exist.""",
    ),
    2: (
        "Plan",
        """\
Invoke `/refactor-planner` skill with the goals summary to generate
`.prizmkit/plans/refactor-list.json`. Validate the output exists and contains
properly structured refactor items.""",
    ),
    3: (
        "Launch",
        """\
Invoke `/refactor-pipeline-launcher` skill:
- Input: path to `.prizmkit/plans/refactor-list.json`
- The launcher handles execution mode selection and prerequisites
- Let the launcher present options and manage the pipeline start

If `/refactor-pipeline-launcher` is not available, run the pipeline directly:
```bash
./dev-pipeline/run-refactor.sh run .prizmkit/plans/refactor-list.json
```""",
    ),
    4: (
        "Monitor",
        """\
Check pipeline status and report results:
```bash
python3 dev-pipeline/scripts/update-refactor-status.py \\
  --refactor-list .prizmkit/plans/refactor-list.json \\
  --state-dir .prizmkit/state/refactor \\
  --action status
```
Report completion status for each refactor item.""",
    ),
}

# Maps workflow_type to (phase_map, all_phases_ordered)
WORKFLOW_REGISTRY = {
    "bug-fix-workflow": (BUGFIX_PHASES, [0, 1, 2, 3, 4, 5, 6, 7]),
    "feature-workflow": (FEATURE_PHASES, [1, 2, 3, 4]),
    "refactor-workflow": (REFACTOR_PHASES, [1, 2, 3, 4]),
}


# ============================================================
# Artifact reading
# ============================================================

def read_file_safe(path, max_chars=8000):
    """Read a file, truncate if too large. Returns content or None."""
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        if len(content) > max_chars:
            content = content[:max_chars] + "\n\n... (truncated)"
        return content
    except (IOError, UnicodeDecodeError):
        return None


def read_bugfix_artifacts(project_root, bug_id):
    """Read existing bug fix artifacts for context injection."""
    if not bug_id:
        return {}
    bugfix_dir = os.path.join(project_root, ".prizmkit", "bugfix", bug_id)
    artifacts = {}
    for name in [
        "fix-plan.md", "spec.md", "plan.md",
        "context-snapshot.md", "fix-report.md",
    ]:
        path = os.path.join(bugfix_dir, name)
        content = read_file_safe(path)
        if content:
            artifacts[name] = content
    return artifacts


def read_feature_artifacts(project_root):
    """Read existing feature workflow artifacts."""
    artifacts = {}
    # Feature list
    for location in [
        os.path.join(project_root, ".prizmkit", "plans", "feature-list.json"),
        os.path.join(project_root, "feature-list.json"),
    ]:
        content = read_file_safe(location)
        if content:
            artifacts["feature-list.json"] = content
            break
    return artifacts


def read_refactor_artifacts(project_root):
    """Read existing refactor workflow artifacts."""
    artifacts = {}
    for location in [
        os.path.join(project_root, ".prizmkit", "plans", "refactor-list.json"),
        os.path.join(project_root, "refactor-list.json"),
    ]:
        content = read_file_safe(location)
        if content:
            artifacts["refactor-list.json"] = content
            break
    return artifacts


def get_code_diff_summary(project_root, main_branch="main"):
    """Get a summary of code changes for context."""
    try:
        result = subprocess.run(
            ["git", "diff", main_branch, "--stat"],
            capture_output=True, text=True, cwd=project_root, timeout=10,
        )
        if result.stdout.strip():
            return result.stdout.strip()
    except (subprocess.SubprocessError, FileNotFoundError):
        pass
    return "(no diff available)"


def read_bug_description(project_root, bug_id):
    """Try to read bug description from bug-fix-list.json."""
    if not bug_id:
        return None
    for location in [
        os.path.join(project_root, ".prizmkit", "plans", "bug-fix-list.json"),
        os.path.join(project_root, "bug-fix-list.json"),
    ]:
        if os.path.isfile(location):
            try:
                with open(location, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for bug in data.get("bugs", []):
                    if bug.get("id") == bug_id:
                        return bug
            except (json.JSONDecodeError, IOError):
                pass
    return None


# ============================================================
# Prompt assembly
# ============================================================

def get_remaining_phases(workflow_type, current_phase):
    """Get list of remaining phase numbers (inclusive of current)."""
    phase_map, all_phases = WORKFLOW_REGISTRY.get(workflow_type, ({}, []))
    remaining = [p for p in all_phases if p >= current_phase]
    return remaining, phase_map


def format_artifact_section(artifacts):
    """Format artifacts dict as markdown sections."""
    if not artifacts:
        return "(no artifacts found from previous session)"
    sections = []
    for name, content in sorted(artifacts.items()):
        sections.append(
            "### {name}\n\n```\n{content}\n```".format(
                name=name, content=content,
            )
        )
    return "\n\n".join(sections)


def build_bugfix_prompt(detection, project_root):
    """Build recovery prompt for bug-fix-workflow."""
    context = detection.get("context", {})
    bug_id = context.get("bug_id", "UNKNOWN")
    branch = context.get("branch", "unknown")
    phase = detection.get("phase", 1)
    phase_name = detection.get("phase_name", "Unknown")
    git_state = detection.get("git", {})
    code_state = detection.get("code", {})
    recovery = detection.get("recovery", {})

    # Read artifacts
    artifacts = read_bugfix_artifacts(project_root, bug_id)
    bug_desc = read_bug_description(project_root, bug_id)
    diff_summary = get_code_diff_summary(project_root, "main")

    # Get remaining phases
    remaining, phase_map = get_remaining_phases("bug-fix-workflow", phase)

    # Build prompt
    lines = []
    lines.append("# Recovery Session — Bug Fix Workflow")
    lines.append("")
    lines.append("## Context")
    lines.append("")
    lines.append("You are RECOVERING an interrupted bug-fix-workflow session.")
    lines.append("")
    lines.append("- **Bug ID**: {}".format(bug_id))
    lines.append("- **Branch**: {}".format(branch))
    lines.append("- **Interrupted at**: Phase {} — {}".format(phase, phase_name))
    lines.append("- **Remaining work**: {}".format(recovery.get("remaining_work", "unknown")))
    lines.append("")

    lines.append("## CRITICAL RULES")
    lines.append("")
    lines.append("1. You MUST complete ALL remaining phases listed below — do NOT stop after implementation")
    lines.append("2. Execute phases in ORDER. Do NOT skip any phase.")
    lines.append("3. After the LAST phase, output a recovery summary.")
    lines.append("4. This is a NON-INTERACTIVE autonomous session — proceed without asking for user input.")
    lines.append("5. Use `/prizmkit-code-review`, `/prizmkit-committer`, `/prizmkit-retrospective` as specified in each phase.")
    lines.append("6. When staging files for commit, always use explicit file names — NEVER use `git add -A` or `git add .`.")
    lines.append("")

    # Bug description (if available)
    if bug_desc:
        lines.append("## Bug Description (from bug-fix-list.json)")
        lines.append("")
        lines.append("- **ID**: {}".format(bug_desc.get("id", bug_id)))
        lines.append("- **Title**: {}".format(bug_desc.get("title", "(untitled)")))
        lines.append("- **Description**: {}".format(bug_desc.get("description", "(none)")))
        lines.append("- **Severity**: {}".format(bug_desc.get("severity", "(unset)")))
        if bug_desc.get("acceptance_criteria"):
            lines.append("- **Acceptance Criteria**:")
            for ac in bug_desc["acceptance_criteria"]:
                lines.append("  - {}".format(ac))
        lines.append("")

    # Git state
    lines.append("## Git State")
    lines.append("")
    lines.append("- **Branch**: {}".format(branch))
    lines.append("- **Commits ahead of main**: {}".format(
        git_state.get("commits_ahead_of_main", 0)))
    lines.append("- **Uncommitted files**: {}".format(
        git_state.get("uncommitted_files", 0)))
    lines.append("- **Staged files**: {}".format(
        git_state.get("staged_files", 0)))
    lines.append("")

    # Code changes summary
    if code_state.get("has_changes"):
        lines.append("## Code Changes (from interrupted session)")
        lines.append("")
        lines.append("- Files modified: {}".format(code_state.get("files_modified", 0)))
        lines.append("- Files added: {}".format(code_state.get("files_added", 0)))
        lines.append("- Files deleted: {}".format(code_state.get("files_deleted", 0)))
        lines.append("- Test files touched: {}".format(code_state.get("test_files_touched", 0)))
        lines.append("- Directories touched: {}".format(
            ", ".join(code_state.get("directories_touched", [])) or "(none)"))
        lines.append("")
        lines.append("### Diff Summary")
        lines.append("")
        lines.append("```")
        lines.append(diff_summary)
        lines.append("```")
        lines.append("")

    # Existing artifacts
    if artifacts:
        lines.append("## Existing Artifacts (from interrupted session)")
        lines.append("")
        lines.append(format_artifact_section(artifacts))
        lines.append("")

    # Remaining phases
    lines.append("---")
    lines.append("")
    lines.append("## Remaining Phases — Execute ALL of these in order")
    lines.append("")

    for i, phase_num in enumerate(remaining):
        name, instructions = phase_map.get(phase_num, ("Unknown", ""))
        # Substitute {bug_id} in instructions
        instructions = instructions.replace("{bug_id}", bug_id)

        label = "CURRENT PHASE" if i == 0 else ""
        if label:
            lines.append("### Phase {}: {} — {}".format(phase_num, name, label))
        else:
            lines.append("### Phase {}: {}".format(phase_num, name))
        lines.append("")
        lines.append(instructions)
        lines.append("")

    # Completion section
    lines.append("---")
    lines.append("")
    lines.append("## FINAL: Recovery Summary")
    lines.append("")
    lines.append("After ALL phases above are complete, output:")
    lines.append("")
    lines.append("```")
    lines.append("Recovery complete.")
    lines.append("  Workflow:      bug-fix-workflow")
    lines.append("  Bug:           {}".format(bug_id))
    lines.append("  Recovered from: Phase {} ({})".format(phase, phase_name))
    lines.append("  Completed:     {}".format(
        " → ".join("Phase {} ({})".format(p, phase_map.get(p, ("?",))[0])
                    for p in remaining)))
    lines.append("  Commit:        <commit hash>")
    lines.append("```")
    lines.append("")

    # Reminders
    lines.append("## Reminders")
    lines.append("")
    lines.append("- All bug-fix artifacts go in `.prizmkit/bugfix/{}/`".format(bug_id))
    lines.append("- Commit with `fix(<scope>): <description>` prefix")
    lines.append("- Do NOT ask for user input — this is autonomous")
    lines.append("- Do NOT stop before completing ALL remaining phases")
    lines.append("- `/prizmkit-committer` is MANDATORY — do NOT skip the commit phase")
    lines.append("- `/prizmkit-retrospective` is MANDATORY — do NOT skip the docs sync phase")

    return "\n".join(lines)


def build_feature_prompt(detection, project_root):
    """Build recovery prompt for feature-workflow."""
    context = detection.get("context", {})
    branch = context.get("branch", "unknown")
    phase = detection.get("phase", 1)
    phase_name = detection.get("phase_name", "Unknown")
    recovery = detection.get("recovery", {})

    artifacts = read_feature_artifacts(project_root)
    remaining, phase_map = get_remaining_phases("feature-workflow", phase)

    lines = []
    lines.append("# Recovery Session — Feature Workflow")
    lines.append("")
    lines.append("## Context")
    lines.append("")
    lines.append("You are RECOVERING an interrupted feature-workflow session.")
    lines.append("")
    lines.append("- **Branch**: {}".format(branch))
    lines.append("- **Interrupted at**: Phase {} — {}".format(phase, phase_name))
    lines.append("- **Remaining work**: {}".format(recovery.get("remaining_work", "unknown")))
    lines.append("")

    lines.append("## CRITICAL RULES")
    lines.append("")
    lines.append("1. You MUST complete ALL remaining phases listed below — do NOT stop early")
    lines.append("2. Execute phases in ORDER. Do NOT skip any phase.")
    lines.append("3. After the LAST phase, output a recovery summary.")
    lines.append("4. This is a NON-INTERACTIVE autonomous session — proceed without asking for user input.")
    lines.append("")

    if artifacts:
        lines.append("## Existing Artifacts")
        lines.append("")
        lines.append(format_artifact_section(artifacts))
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## Remaining Phases — Execute ALL of these in order")
    lines.append("")

    for i, phase_num in enumerate(remaining):
        name, instructions = phase_map.get(phase_num, ("Unknown", ""))
        label = "CURRENT PHASE" if i == 0 else ""
        if label:
            lines.append("### Phase {}: {} — {}".format(phase_num, name, label))
        else:
            lines.append("### Phase {}: {}".format(phase_num, name))
        lines.append("")
        lines.append(instructions)
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## FINAL: Recovery Summary")
    lines.append("")
    lines.append("After ALL phases above are complete, output:")
    lines.append("")
    lines.append("```")
    lines.append("Recovery complete.")
    lines.append("  Workflow:      feature-workflow")
    lines.append("  Recovered from: Phase {} ({})".format(phase, phase_name))
    lines.append("  Completed:     {}".format(
        " → ".join("Phase {} ({})".format(p, phase_map.get(p, ("?",))[0])
                    for p in remaining)))
    lines.append("```")
    lines.append("")

    lines.append("## Reminders")
    lines.append("")
    lines.append("- Use `/feature-pipeline-launcher` to start the pipeline (Phase 3)")
    lines.append("- Do NOT ask for user input — this is autonomous")
    lines.append("- Do NOT stop before completing ALL remaining phases")

    return "\n".join(lines)


def build_refactor_prompt(detection, project_root):
    """Build recovery prompt for refactor-workflow."""
    context = detection.get("context", {})
    branch = context.get("branch", "unknown")
    phase = detection.get("phase", 1)
    phase_name = detection.get("phase_name", "Unknown")
    recovery = detection.get("recovery", {})

    artifacts = read_refactor_artifacts(project_root)
    remaining, phase_map = get_remaining_phases("refactor-workflow", phase)

    lines = []
    lines.append("# Recovery Session — Refactor Workflow")
    lines.append("")
    lines.append("## Context")
    lines.append("")
    lines.append("You are RECOVERING an interrupted refactor-workflow session.")
    lines.append("")
    lines.append("- **Branch**: {}".format(branch))
    lines.append("- **Interrupted at**: Phase {} — {}".format(phase, phase_name))
    lines.append("- **Remaining work**: {}".format(recovery.get("remaining_work", "unknown")))
    lines.append("")

    lines.append("## CRITICAL RULES")
    lines.append("")
    lines.append("1. You MUST complete ALL remaining phases listed below — do NOT stop early")
    lines.append("2. Execute phases in ORDER. Do NOT skip any phase.")
    lines.append("3. After the LAST phase, output a recovery summary.")
    lines.append("4. This is a NON-INTERACTIVE autonomous session — proceed without asking for user input.")
    lines.append("")

    if artifacts:
        lines.append("## Existing Artifacts")
        lines.append("")
        lines.append(format_artifact_section(artifacts))
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## Remaining Phases — Execute ALL of these in order")
    lines.append("")

    for i, phase_num in enumerate(remaining):
        name, instructions = phase_map.get(phase_num, ("Unknown", ""))
        label = "CURRENT PHASE" if i == 0 else ""
        if label:
            lines.append("### Phase {}: {} — {}".format(phase_num, name, label))
        else:
            lines.append("### Phase {}: {}".format(phase_num, name))
        lines.append("")
        lines.append(instructions)
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## FINAL: Recovery Summary")
    lines.append("")
    lines.append("After ALL phases above are complete, output:")
    lines.append("")
    lines.append("```")
    lines.append("Recovery complete.")
    lines.append("  Workflow:      refactor-workflow")
    lines.append("  Recovered from: Phase {} ({})".format(phase, phase_name))
    lines.append("  Completed:     {}".format(
        " → ".join("Phase {} ({})".format(p, phase_map.get(p, ("?",))[0])
                    for p in remaining)))
    lines.append("```")
    lines.append("")

    lines.append("## Reminders")
    lines.append("")
    lines.append("- Use `/refactor-pipeline-launcher` to start the pipeline (Phase 3)")
    lines.append("- Do NOT ask for user input — this is autonomous")
    lines.append("- Do NOT stop before completing ALL remaining phases")

    return "\n".join(lines)


# ============================================================
# Main
# ============================================================

PROMPT_BUILDERS = {
    "bug-fix-workflow": build_bugfix_prompt,
    "feature-workflow": build_feature_prompt,
    "refactor-workflow": build_refactor_prompt,
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate a recovery bootstrap prompt from detection output",
    )
    parser.add_argument(
        "--detection-json",
        required=True,
        help="Path to JSON file with detect-recovery-state.py output",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output path for the rendered prompt",
    )
    parser.add_argument(
        "--project-root",
        default=None,
        help="Project root directory (default: auto-detect from git)",
    )
    parser.add_argument(
        "--session-id",
        default=None,
        help="Session ID for this recovery session",
    )
    return parser.parse_args()


def resolve_project_root(given_root):
    """Resolve project root from argument or git."""
    if given_root:
        return os.path.abspath(given_root)
    # Auto-detect: script is at dev-pipeline/scripts/, project root is 2 levels up
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(os.path.dirname(script_dir))


def emit_failure(message):
    """Emit standardized failure JSON and exit."""
    print(json.dumps({"success": False, "error": message}, indent=2, ensure_ascii=False))
    sys.exit(1)


def main():
    args = parse_args()
    project_root = resolve_project_root(args.project_root)

    # Load detection JSON
    detection, err = load_json_file(args.detection_json)
    if err:
        emit_failure("Detection JSON error: {}".format(err))

    if not detection.get("detected"):
        emit_failure("No interrupted workflow detected — nothing to recover")

    workflow_type = detection.get("workflow_type")
    if workflow_type not in PROMPT_BUILDERS:
        emit_failure("Unknown workflow type: {}".format(workflow_type))

    # Build prompt
    builder = PROMPT_BUILDERS[workflow_type]
    prompt_content = builder(detection, project_root)

    # Write output
    output_path = os.path.abspath(args.output)
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.isdir(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(prompt_content)
    except IOError as e:
        emit_failure("Cannot write output: {}".format(str(e)))

    # Success JSON
    phase = detection.get("phase", 0)
    phase_name = detection.get("phase_name", "Unknown")
    remaining, _ = get_remaining_phases(workflow_type, phase)
    output = {
        "success": True,
        "workflow_type": workflow_type,
        "resume_phase": phase,
        "resume_phase_name": phase_name,
        "remaining_phases": remaining,
        "prompt_path": output_path,
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        emit_failure("generate-recovery-prompt interrupted")
    except SystemExit:
        raise
    except Exception as exc:
        LOGGER.exception("Unhandled exception in generate-recovery-prompt")
        emit_failure("Unexpected error: {}".format(str(exc)))
