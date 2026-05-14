#!/usr/bin/env python3
"""Generate a session-specific refactor bootstrap prompt from template and .prizmkit/plans/refactor-list.json.

Reads the refactor-bootstrap-prompt.md template and a .prizmkit/plans/refactor-list.json, resolves all
{{PLACEHOLDER}} variables, handles conditional blocks, and writes the rendered
prompt to the specified output path.

Usage:
    python3 generate-refactor-prompt.py \
        --refactor-list <path> --refactor-id <id> \
        --session-id <id> --run-id <id> \
        --retry-count <n> --resume-phase <n|null> \
        --state-dir <path> --output <path>
"""

import argparse
import json
import os
import re
import sys

from utils import enrich_global_context, load_json_file, read_platform_conventions, setup_logging


DEFAULT_MAX_RETRIES = 3

LOGGER = setup_logging("generate-refactor-prompt")


# Refactor pipeline checkpoint steps (skill_key, display_name, required_artifacts)
# Artifacts use {slug} placeholder, replaced with refactor_id at runtime.
REFACTOR_STEPS = [
    ("prizmkit-init", "Initialize",
     [".prizmkit/refactor/{slug}"]),
    ("prizmkit-plan", "Plan — Specification & Plan Generation",
     [".prizmkit/refactor/{slug}/spec.md",
      ".prizmkit/refactor/{slug}/plan.md"]),
    ("prizmkit-implement", "Implement — Behavior-Preserving Refactoring",
     [".prizmkit/refactor/{slug}/plan.md"]),
    ("prizmkit-code-review", "Review — Code Review & Behavior Verification",
     [".prizmkit/refactor/{slug}/review-report.md"]),
    ("prizmkit-committer", "Commit",
     ["--headless"]),
    ("refactor-report", "Generate Refactor Report",
     [".prizmkit/refactor/{slug}/refactor-report.md"]),
]


def generate_refactor_checkpoint(refactor_id, session_id):
    """Generate a checkpoint definition for refactor pipeline.

    Returns a dict suitable for writing as workflow-checkpoint.json.
    """
    steps = []
    prev_id = None
    for i, (skill, name, artifacts) in enumerate(REFACTOR_STEPS, 1):
        step_id = "S{:02d}".format(i)
        steps.append({
            "id": step_id,
            "skill": skill,
            "name": name,
            "status": "pending",
            "required_artifacts": [a.replace("{slug}", refactor_id) for a in artifacts],
            "depends_on": prev_id,
        })
        prev_id = step_id

    return {
        "version": 1,
        "workflow_type": "refactor-pipeline",
        "pipeline_mode": "standard",
        "item_id": refactor_id,
        "item_slug": refactor_id,
        "session_id": session_id,
        "steps": steps,
    }


def merge_refactor_checkpoint_state(existing, fresh, project_root):
    """Merge existing refactor checkpoint state into fresh definition.

    Same logic as feature/bugfix pipelines: validate artifacts, break chain
    on first invalid step.
    """
    existing_status = {}
    existing_artifacts = {}
    for step in existing.get("steps", []):
        existing_status[step["skill"]] = step["status"]
        existing_artifacts[step["skill"]] = step.get("required_artifacts", [])

    valid_completed = set()
    for skill_key, status in existing_status.items():
        if status == "completed":
            artifacts = existing_artifacts.get(skill_key, [])
            if all(os.path.exists(os.path.join(project_root, a))
                   for a in artifacts):
                valid_completed.add(skill_key)
            else:
                LOGGER.warning(
                    "Step '%s' was completed but artifacts missing — "
                    "resetting to pending", skill_key
                )
        elif status == "skipped":
            valid_completed.add(skill_key)

    chain_broken = False
    for step in fresh["steps"]:
        if chain_broken:
            step["status"] = "pending"
            continue
        prev = existing_status.get(step["skill"])
        if step["skill"] in valid_completed:
            step["status"] = prev
        else:
            chain_broken = True
            step["status"] = "pending"

    return fresh


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Generate a session-specific refactor bootstrap prompt from a template "
            "and .prizmkit/plans/refactor-list.json."
        )
    )
    parser.add_argument("--refactor-list", required=True, help="Path to .prizmkit/plans/refactor-list.json")
    parser.add_argument("--refactor-id", required=True, help="Refactor ID to generate prompt for (e.g. R-001)")
    parser.add_argument("--session-id", required=True, help="Session ID for this pipeline session")
    parser.add_argument("--run-id", required=True, help="Pipeline run ID")
    parser.add_argument("--retry-count", required=True, help="Current retry count")
    parser.add_argument("--resume-phase", required=True, help='Phase to resume from, or "null" for fresh start')
    parser.add_argument("--state-dir", default=None, help="State directory (default: .prizmkit/state/refactor)")
    parser.add_argument("--output", required=True, help="Output path for the rendered prompt")
    parser.add_argument("--template", default=None, help="Custom template path. Defaults to {script_dir}/../templates/refactor-bootstrap-prompt.md")
    parser.add_argument("--mode", default=None, help="Pipeline execution mode override: lite, standard, full")
    parser.add_argument("--critic", default=None, help="Enable critic agent: true/false")
    return parser.parse_args()


def read_text_file(path):
    """Read and return the text content of a file."""
    abs_path = os.path.abspath(path)
    if not os.path.isfile(abs_path):
        return None, "File not found: {}".format(abs_path)
    try:
        with open(abs_path, "r", encoding="utf-8") as f:
            return f.read(), None
    except IOError as e:
        return None, "Cannot read file: {}".format(str(e))


def find_refactor(refactors, refactor_id):
    """Find and return the refactor dict matching the given ID."""
    for refactor in refactors:
        if isinstance(refactor, dict) and refactor.get("id") == refactor_id:
            return refactor
    return None


def format_acceptance_criteria(criteria):
    """Format acceptance criteria as a markdown bullet list."""
    if not criteria:
        return "- (none specified)"
    lines = []
    for item in criteria:
        lines.append("- {}".format(item))
    return "\n".join(lines)


def format_global_context(global_context, project_root=None):
    """Format global_context dict as a key-value list.

    If global_context is empty/sparse and project_root is provided,
    auto-detect tech stack from project files to fill gaps.
    """
    if project_root:
        enrich_global_context(global_context, project_root)

    if not global_context:
        return "- (none specified)"
    lines = []
    for key, value in sorted(global_context.items()):
        lines.append("- **{}**: {}".format(key, value))
    return "\n".join(lines)


def format_user_context(user_context):
    """Format user_context array as a markdown section.

    Returns empty string if user_context is empty or absent,
    so the template placeholder resolves to nothing.
    """
    if not user_context or not isinstance(user_context, list):
        return ""
    items = [item for item in user_context if isinstance(item, str) and item.strip()]
    if not items:
        return ""
    lines = [
        "### User-Provided Context (HIGHEST PRIORITY)",
        "",
        "> The following materials were provided by the user. "
        "They take precedence over AI inference.",
        "",
    ]
    for item in items:
        lines.append("- {}".format(item))
    return "\n".join(lines)


def format_scope(scope):
    """Format scope object into markdown detail lines."""
    if not scope or not isinstance(scope, dict):
        return "- (no scope details)"
    lines = []

    files = scope.get("files", [])
    if files:
        lines.append("- **Files**:")
        for f in files:
            lines.append("  - `{}`".format(f))

    modules = scope.get("modules", [])
    if modules:
        lines.append("- **Modules**:")
        for m in modules:
            lines.append("  - `{}`".format(m))

    if not lines:
        lines.append("- (no scope details)")
    return "\n".join(lines)


def _format_scope_list(scope, key):
    """Extract and format a list from scope by key (files or modules)."""
    if not scope or not isinstance(scope, dict):
        return "- (none specified)"
    items = scope.get(key, [])
    if not items:
        return "- (none specified)"
    return "\n".join("- `{}`".format(item) for item in items)


def format_scope_files(scope):
    """Extract and format just the files list from scope."""
    return _format_scope_list(scope, "files")


def format_scope_modules(scope):
    """Extract and format just the modules list from scope."""
    return _format_scope_list(scope, "modules")


def format_behavior_preservation(bp):
    """Format behavior_preservation object into markdown detail lines."""
    if not bp or not isinstance(bp, dict):
        return "- (no behavior preservation details)"
    lines = []

    strategy = bp.get("strategy", "unknown")
    lines.append("- **Strategy**: {}".format(strategy))

    existing_tests = bp.get("existing_tests", [])
    if existing_tests:
        lines.append("- **Existing Tests**:")
        for t in existing_tests:
            lines.append("  - `{}`".format(t))

    new_tests_needed = bp.get("new_tests_needed", [])
    if new_tests_needed:
        lines.append("- **New Tests Needed**:")
        for t in new_tests_needed:
            lines.append("  - {}".format(t))

    if len(lines) == 1:
        lines.append("- (no additional details)")
    return "\n".join(lines)


def format_dependencies(dependencies, refactors=None):
    """Format dependencies list as a markdown bullet list with completion context.

    When refactors list is provided, look up completed dependencies and include
    their completion_notes for rich context propagation.
    """
    if not dependencies or not isinstance(dependencies, list):
        return "- (none)"
    if len(dependencies) == 0:
        return "- (none)"

    # Build lookup map if refactors list is provided
    refactor_map = {}
    if refactors:
        for r in refactors:
            if isinstance(r, dict) and "id" in r:
                refactor_map[r["id"]] = r

    lines = []
    for dep in dependencies:
        dep_info = refactor_map.get(dep)
        if dep_info and dep_info.get("status") == "completed":
            header = "- **{}** — {} (completed)".format(
                dep, dep_info.get("title", "Untitled")
            )
            notes = dep_info.get("completion_notes", [])
            if notes and isinstance(notes, list):
                note_lines = [
                    "  - {}".format(n) for n in notes
                    if isinstance(n, str) and n.strip()
                ]
                if note_lines:
                    header += "\n" + "\n".join(note_lines)
            lines.append(header)
        else:
            lines.append("- `{}`".format(dep))
    return "\n".join(lines)


def get_prev_session_status(state_dir, refactor_id):
    """Read previous session status from state dir if available."""
    if not state_dir:
        return "N/A (first run)"

    refactor_status_path = os.path.join(state_dir, "refactors", refactor_id, "status.json")
    try:
        with open(refactor_status_path, "r", encoding="utf-8") as f:
            refactor_status = json.load(f)
    except (json.JSONDecodeError, IOError, OSError):
        return "N/A (first run)"

    last_session_id = refactor_status.get("last_session_id")
    if not last_session_id:
        return "N/A (first run)"

    session_status_path = os.path.join(
        state_dir, "refactors", refactor_id, "sessions",
        last_session_id, "session-status.json"
    )
    try:
        with open(session_status_path, "r", encoding="utf-8") as f:
            session_data = json.load(f)
    except (json.JSONDecodeError, IOError, OSError):
        return "N/A (previous session status file not found)"

    status = session_data.get("status", "unknown")
    checkpoint = session_data.get("checkpoint_reached", "none")
    current_phase = session_data.get("current_phase", "unknown")
    errors = session_data.get("errors", [])

    result = "{} (checkpoint: {}, last phase: {})".format(
        status, checkpoint, current_phase
    )
    if errors:
        result += " — errors: {}".format("; ".join(str(e) for e in errors))
    return result


def resolve_project_root(script_dir):
    """Resolve project root as the parent of dev-pipeline/."""
    dev_pipeline_dir = os.path.dirname(script_dir)
    project_root = os.path.dirname(dev_pipeline_dir)
    return os.path.abspath(project_root)


def build_replacements(args, refactor, refactors, global_context, script_dir):
    """Build the full dict of placeholder -> replacement value."""
    project_root = resolve_project_root(script_dir)

    # Platform-aware agent/team path resolution
    platform = os.environ.get("PRIZMKIT_PLATFORM", "")
    home_dir = os.path.expanduser("~")

    if not platform:
        if os.path.isdir(os.path.join(project_root, ".claude", "agents")):
            platform = "claude"
        else:
            platform = "codebuddy"

    if platform == "claude":
        agents_dir = os.path.join(project_root, ".claude", "agents")
        team_config_path = os.path.join(project_root, ".claude", "team-info.json")
    else:
        agents_dir = os.path.join(project_root, ".codebuddy", "agents")
        team_config_path = os.path.join(
            home_dir, ".codebuddy", "teams", "prizm-dev-team", "config.json"
        )

    dev_subagent = os.path.join(agents_dir, "prizm-dev-team-dev.md")
    reviewer_subagent = os.path.join(agents_dir, "prizm-dev-team-reviewer.md")

    # Session status path
    session_status_path = os.path.join(
        project_root, ".prizmkit", "state", "refactor", "refactors", args.refactor_id,
        "sessions", args.session_id, "session-status.json"
    )

    # Scope
    scope = refactor.get("scope", {})

    # Behavior preservation
    bp = refactor.get("behavior_preservation", {})
    behavior_strategy = bp.get("strategy", "test-gate") if isinstance(bp, dict) else "test-gate"
    existing_tests = bp.get("existing_tests", []) if isinstance(bp, dict) else []
    if not isinstance(existing_tests, list):
        existing_tests = []
    new_tests_needed = bp.get("new_tests_needed", []) if isinstance(bp, dict) else []
    if not isinstance(new_tests_needed, list):
        new_tests_needed = []

    # Format existing tests
    if existing_tests:
        existing_tests_str = "\n".join("- `{}`".format(t) for t in existing_tests)
    else:
        existing_tests_str = "- (none specified)"

    # Format new tests needed
    if new_tests_needed:
        new_tests_str = "\n".join("- {}".format(t) for t in new_tests_needed)
    else:
        new_tests_str = "- (none specified)"

    # Browser interaction - extract from refactor if present
    browser_interaction = refactor.get("browser_interaction")
    browser_enabled = False
    browser_verify_steps = ""
    browser_tool = "auto"

    # Environment override
    browser_verify_env = os.environ.get("BROWSER_VERIFY", "").lower()
    if browser_verify_env == "false":
        browser_interaction = None

    # Extract browser config (same logic as feature and bugfix pipelines)
    if browser_interaction and isinstance(browser_interaction, bool):
        browser_enabled = True
        browser_tool = "auto"
        browser_verify_steps = "   # (no specific verify goals — validate UI renders correctly and feature still works)"
    elif browser_interaction and isinstance(browser_interaction, dict):
        browser_tool = browser_interaction.get("tool", "auto")
        if browser_tool not in ("playwright-cli", "opencli", "auto"):
            LOGGER.warning("Unknown browser_interaction.tool '%s', defaulting to 'auto'", browser_tool)
            browser_tool = "auto"

        steps = browser_interaction.get("verify_steps", [])
        if steps:
            browser_enabled = True
            browser_verify_steps = "\n".join(
                "   # Step {}: {}".format(i + 1, step)
                for i, step in enumerate(steps)
            )
        elif browser_interaction.get("url") or browser_interaction.get("enabled", True):
            browser_enabled = True
            browser_verify_steps = "   # (validate UI renders correctly and feature still works)"

    replacements = {
        "{{RUN_ID}}": args.run_id,
        "{{SESSION_ID}}": args.session_id,
        "{{REFACTOR_ID}}": args.refactor_id,
        "{{REFACTOR_TITLE}}": refactor.get("title", ""),
        "{{REFACTOR_TYPE}}": refactor.get("type", "restructure"),
        "{{SCOPE_FILES}}": format_scope_files(scope),
        "{{SCOPE_MODULES}}": format_scope_modules(scope),
        "{{BEHAVIOR_STRATEGY}}": behavior_strategy,
        "{{EXISTING_TESTS}}": existing_tests_str,
        "{{NEW_TESTS_NEEDED}}": new_tests_str,
        "{{PRIORITY}}": refactor.get("priority", "medium"),
        "{{COMPLEXITY}}": refactor.get("complexity", "medium"),
        "{{REFACTOR_DESCRIPTION}}": refactor.get("description", ""),
        "{{USER_CONTEXT}}": format_user_context(refactor.get("user_context", [])),
        "{{ACCEPTANCE_CRITERIA}}": format_acceptance_criteria(
            refactor.get("acceptance_criteria", [])
        ),
        "{{DEPENDENCIES}}": format_dependencies(
            refactor.get("dependencies", []), refactors
        ),
        "{{GLOBAL_CONTEXT}}": format_global_context(global_context, project_root),
        "{{TEAM_CONFIG_PATH}}": team_config_path,
        "{{DEV_SUBAGENT_PATH}}": dev_subagent,
        "{{REVIEWER_SUBAGENT_PATH}}": reviewer_subagent,
        "{{SESSION_STATUS_PATH}}": session_status_path,
        "{{PROJECT_ROOT}}": project_root,
        "{{CHECKPOINT_PATH}}": os.path.join(
            ".prizmkit", "refactor", args.refactor_id, "workflow-checkpoint.json",
        ),
        "{{TIMESTAMP}}": "",  # Placeholder — agent fills in timestamp
        "{{PLATFORM_CONVENTIONS}}": read_platform_conventions(project_root),
        "{{BROWSER_ENABLED}}": "true" if browser_enabled else "false",
        "{{BROWSER_TOOL}}": browser_tool,
        "{{BROWSER_VERIFY_STEPS}}": browser_verify_steps,
    }

    return replacements


def process_conditional_blocks(content, resume_phase, refactor):
    """Handle conditional blocks based on resume_phase and browser_interaction."""
    # Handle fresh start blocks
    is_resume = resume_phase != "null"

    if is_resume:
        content = re.sub(
            r"\{\{IF_FRESH_START\}\}.*?\{\{END_IF_FRESH_START\}\}\n?",
            "", content, flags=re.DOTALL,
        )
    else:
        content = content.replace("{{IF_FRESH_START}}\n", "")
        content = content.replace("{{IF_FRESH_START}}", "")
        content = content.replace("{{END_IF_FRESH_START}}\n", "")
        content = content.replace("{{END_IF_FRESH_START}}", "")

    # Handle browser interaction blocks
    browser_interaction = refactor.get("browser_interaction")
    browser_enabled = False
    browser_tool = "auto"

    # Check environment override
    browser_verify_env = os.environ.get("BROWSER_VERIFY", "").lower()
    if browser_verify_env == "false":
        browser_interaction = None

    # Determine if browser is enabled
    if browser_interaction:
        if isinstance(browser_interaction, bool):
            browser_enabled = True
        elif isinstance(browser_interaction, dict):
            steps = browser_interaction.get("verify_steps", [])
            if steps or browser_interaction.get("url") or browser_interaction.get("enabled", True):
                browser_enabled = True
            browser_tool = browser_interaction.get("tool", "auto")

    # Process browser interaction blocks
    browser_open = "{{IF_BROWSER_INTERACTION}}"
    browser_close = "{{END_IF_BROWSER_INTERACTION}}"

    if browser_enabled:
        # Keep content, remove tags
        content = content.replace(browser_open + "\n", "")
        content = content.replace(browser_open, "")
        content = content.replace(browser_close + "\n", "")
        content = content.replace(browser_close, "")
    else:
        # Remove entire block
        pattern = re.escape(browser_open) + r".*?" + re.escape(browser_close) + r"\n?"
        content = re.sub(pattern, "", content, flags=re.DOTALL)

    # Process browser tool selection blocks (nested inside browser interaction)
    tool_variants = ["PLAYWRIGHT", "OPENCLI", "AUTO"]
    active_variant = {
        "playwright-cli": "PLAYWRIGHT",
        "opencli": "OPENCLI",
        "auto": "AUTO",
    }.get(browser_tool, "AUTO")

    for variant in tool_variants:
        tool_open = "{{{{IF_BROWSER_TOOL_{}}}}}".format(variant)
        tool_close = "{{{{END_IF_BROWSER_TOOL_{}}}}}".format(variant)

        if variant == active_variant and browser_enabled:
            # Keep content, remove tags
            content = content.replace(tool_open + "\n", "")
            content = content.replace(tool_open, "")
            content = content.replace(tool_close + "\n", "")
            content = content.replace(tool_close, "")
        else:
            # Remove entire block
            pat = re.escape(tool_open) + r".*?" + re.escape(tool_close) + r"\n?"
            content = re.sub(pat, "", content, flags=re.DOTALL)

    return content



def render_template(template_content, replacements, resume_phase, refactor):
    """Render the template by processing conditionals and replacing placeholders."""
    # Step 1: Process conditional blocks
    content = process_conditional_blocks(template_content, resume_phase, refactor)

    # Step 2: Replace all {{PLACEHOLDER}} variables
    for placeholder, value in replacements.items():
        content = content.replace(placeholder, value)

    return content


def write_output(output_path, content):
    """Write the rendered content to the output file."""
    abs_path = os.path.abspath(output_path)
    output_dir = os.path.dirname(abs_path)
    if output_dir and not os.path.isdir(output_dir):
        try:
            os.makedirs(output_dir, exist_ok=True)
        except OSError as e:
            return "Cannot create output directory: {}".format(str(e))
    try:
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(content)
    except IOError as e:
        return "Cannot write output file: {}".format(str(e))
    return None


def emit_failure(message):
    """Emit standardized failure JSON and exit.

    Uses a different format than error_out() — includes 'success: false'
    for compatibility with the pipeline's JSON parsing expectations.
    """
    print(json.dumps({"success": False, "error": message}, indent=2, ensure_ascii=False))
    sys.exit(1)


def main():
    args = parse_args()

    # Resolve script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Resolve template path
    if args.template:
        template_path = args.template
    else:
        template_path = os.path.join(
            script_dir, "..", "templates", "refactor-bootstrap-prompt.md"
        )

    # Load template
    template_content, err = read_text_file(template_path)
    if err:
        emit_failure("Template error: {}".format(err))

    # Load refactor list
    refactor_list_data, err = load_json_file(args.refactor_list)
    if err:
        emit_failure("Refactor list error: {}".format(err))

    # Extract refactors array
    refactors = refactor_list_data.get("refactors")
    if not isinstance(refactors, list):
        emit_failure("Refactor list does not contain a 'refactors' array")

    # Find the target refactor
    refactor = find_refactor(refactors, args.refactor_id)
    if refactor is None:
        emit_failure("Refactor '{}' not found in refactor list".format(args.refactor_id))

    # Extract global context
    global_context = refactor_list_data.get("global_context", {})
    if not isinstance(global_context, dict):
        global_context = {}

    # Build replacements
    replacements = build_replacements(args, refactor, refactors, global_context, script_dir)

    # Render the template
    rendered = render_template(template_content, replacements, args.resume_phase, refactor)

    # Write the output
    err = write_output(args.output, rendered)
    if err:
        emit_failure(err)

    # Generate checkpoint file
    project_root = resolve_project_root(script_dir)
    checkpoint_rel = os.path.join(
        ".prizmkit", "refactor", args.refactor_id, "workflow-checkpoint.json",
    )
    checkpoint_path = os.path.join(project_root, checkpoint_rel)
    checkpoint_dir = os.path.dirname(checkpoint_path)
    os.makedirs(checkpoint_dir, exist_ok=True)

    checkpoint = generate_refactor_checkpoint(args.refactor_id, args.session_id)

    is_resume = args.resume_phase != "null"
    if is_resume and os.path.exists(checkpoint_path):
        try:
            with open(checkpoint_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
            checkpoint = merge_refactor_checkpoint_state(
                existing, checkpoint, project_root,
            )
            LOGGER.info("Merged existing refactor checkpoint from %s",
                        checkpoint_path)
        except (json.JSONDecodeError, KeyError) as exc:
            LOGGER.warning(
                "Existing refactor checkpoint corrupted (%s) — generating fresh",
                exc,
            )

    with open(checkpoint_path, "w", encoding="utf-8") as f:
        json.dump(checkpoint, f, indent=2, ensure_ascii=False)
    LOGGER.info("Wrote refactor checkpoint to %s", checkpoint_path)

    # Resolve critic and mode
    refactor_critic = refactor.get("critic", False)
    if args.critic is not None:
        critic_enabled = str(args.critic).lower() == "true"
    else:
        critic_enabled = bool(refactor_critic)

    pipeline_mode = args.mode or "standard"
    agent_count = 5 if critic_enabled else 3

    # Success
    refactor_model = refactor.get("model", "")

    # Extract browser state for JSON output
    browser_interaction = refactor.get("browser_interaction")
    browser_enabled = False
    browser_tool = "auto"

    browser_verify_env = os.environ.get("BROWSER_VERIFY", "").lower()
    if browser_verify_env == "false":
        browser_interaction = None

    if browser_interaction:
        if isinstance(browser_interaction, bool):
            browser_enabled = True
        elif isinstance(browser_interaction, dict):
            steps = browser_interaction.get("verify_steps", [])
            if steps or browser_interaction.get("url") or browser_interaction.get("enabled", True):
                browser_enabled = True
            browser_tool = browser_interaction.get("tool", "auto")

    output = {
        "success": True,
        "output_path": os.path.abspath(args.output),
        "checkpoint_path": checkpoint_path,
        "model": refactor_model,
        "pipeline_mode": pipeline_mode,
        "agent_count": agent_count,
        "critic_enabled": critic_enabled,
        "browser_enabled": browser_enabled,
        "browser_tool": browser_tool,
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        emit_failure("generate-refactor-prompt interrupted")
    except SystemExit:
        raise
    except Exception as exc:
        LOGGER.exception("Unhandled exception in generate-refactor-prompt")
        emit_failure("Unexpected error: {}".format(str(exc)))
