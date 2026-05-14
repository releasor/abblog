#!/usr/bin/env python3
"""Generate a session-specific bug fix bootstrap prompt from template and .prizmkit/plans/bug-fix-list.json.

Reads the bugfix-bootstrap-prompt.md template and a .prizmkit/plans/bug-fix-list.json, resolves all
{{PLACEHOLDER}} variables, handles conditional blocks, and writes the rendered
prompt to the specified output path.

Usage:
    python3 generate-bugfix-prompt.py \
        --bug-list <path> --bug-id <id> \
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

LOGGER = setup_logging("generate-bugfix-prompt")


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Generate a session-specific bug fix bootstrap prompt from a template "
            "and .prizmkit/plans/bug-fix-list.json."
        )
    )
    parser.add_argument("--bug-list", required=True, help="Path to .prizmkit/plans/bug-fix-list.json")
    parser.add_argument("--bug-id", required=True, help="Bug ID to generate prompt for (e.g. B-001)")
    parser.add_argument("--session-id", required=True, help="Session ID for this pipeline session")
    parser.add_argument("--run-id", required=True, help="Pipeline run ID")
    parser.add_argument("--retry-count", required=True, help="Current retry count")
    parser.add_argument("--resume-phase", required=True, help='Phase to resume from, or "null" for fresh start')
    parser.add_argument("--state-dir", default=None, help="State directory (default: .prizmkit/state/bugfix)")
    parser.add_argument("--output", required=True, help="Output path for the rendered prompt")
    parser.add_argument("--template", default=None, help="Custom template path. Defaults to {script_dir}/../templates/bugfix-bootstrap-prompt.md")
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


def find_bug(bugs, bug_id):
    """Find and return the bug dict matching the given ID."""
    for bug in bugs:
        if isinstance(bug, dict) and bug.get("id") == bug_id:
            return bug
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


def format_error_source_details(error_source):
    """Format error_source fields into markdown detail lines."""
    if not error_source or not isinstance(error_source, dict):
        return "- (no error source details)"
    lines = []
    etype = error_source.get("type", "unknown")

    if etype == "stack_trace" and error_source.get("stack_trace"):
        lines.append("- **Stack Trace**:")
        lines.append("```")
        lines.append(error_source["stack_trace"])
        lines.append("```")
    if error_source.get("error_message"):
        lines.append("- **Error Message**: {}".format(error_source["error_message"]))
    if etype == "log_pattern" and error_source.get("log_snippet"):
        lines.append("- **Log Snippet**:")
        lines.append("```")
        lines.append(error_source["log_snippet"])
        lines.append("```")
    if etype == "failed_test" and error_source.get("failed_test_path"):
        lines.append("- **Failed Test**: `{}`".format(error_source["failed_test_path"]))
    if etype == "user_report" and error_source.get("reproduction_steps"):
        lines.append("- **Reproduction Steps**:")
        for i, step in enumerate(error_source["reproduction_steps"], 1):
            lines.append("  {}. {}".format(i, step))

    if not lines:
        lines.append("- (no additional details)")
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


def format_environment(env):
    """Format environment dict as a key-value list."""
    if not env or not isinstance(env, dict):
        return "- (not specified)"
    lines = []
    for key, value in sorted(env.items()):
        if value:
            lines.append("- **{}**: {}".format(key, value))
    if not lines:
        return "- (not specified)"
    return "\n".join(lines)


def get_prev_session_status(state_dir, bug_id):
    """Read previous session status from state dir if available."""
    if not state_dir:
        return "N/A (first run)"

    bug_status_path = os.path.join(state_dir, "bugs", bug_id, "status.json")
    if not os.path.isfile(bug_status_path):
        return "N/A (first run)"

    try:
        with open(bug_status_path, "r", encoding="utf-8") as f:
            bug_status = json.load(f)
    except (json.JSONDecodeError, IOError):
        return "N/A (could not read bug status)"

    last_session_id = bug_status.get("last_session_id")
    if not last_session_id:
        return "N/A (first run)"

    session_status_path = os.path.join(
        state_dir, "bugs", bug_id, "sessions",
        last_session_id, "session-status.json"
    )
    if not os.path.isfile(session_status_path):
        return "N/A (previous session status file not found)"

    try:
        with open(session_status_path, "r", encoding="utf-8") as f:
            session_data = json.load(f)
    except (json.JSONDecodeError, IOError):
        return "N/A (could not read previous session status)"

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


def build_replacements(args, bug, global_context, script_dir):
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
        project_root, ".prizmkit", "state", "bugfix", "bugs", args.bug_id,
        "sessions", args.session_id, "session-status.json"
    )

    # Error source
    error_source = bug.get("error_source", {})
    error_type = error_source.get("type", "unknown") if isinstance(error_source, dict) else "unknown"

    # Determine fix scope from affected_modules or title
    affected_modules = bug.get("affected_modules", [])
    if affected_modules:
        fix_scope = affected_modules[0]
    else:
        fix_scope = bug.get("title", "unknown").split()[0].lower() if bug.get("title") else "unknown"

    # Determine verification type
    vtype = bug.get("verification_type", "automated")

    # Browser interaction - extract from bug if present
    browser_interaction = bug.get("browser_interaction")
    browser_enabled = False
    browser_verify_steps = ""
    browser_tool = "auto"

    # Environment override
    browser_verify_env = os.environ.get("BROWSER_VERIFY", "").lower()
    if browser_verify_env == "false":
        browser_interaction = None

    # Extract browser config (same logic as feature pipeline)
    if browser_interaction and isinstance(browser_interaction, bool):
        browser_enabled = True
        browser_tool = "auto"
        browser_verify_steps = "   # (no specific verify goals — reproduce the bug and verify it's fixed)"
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
            browser_verify_steps = "   # (reproduce bug and verify fix)"

    replacements = {
        "{{RUN_ID}}": args.run_id,
        "{{SESSION_ID}}": args.session_id,
        "{{BUG_ID}}": args.bug_id,
        "{{BUG_TITLE}}": bug.get("title", ""),
        "{{SEVERITY}}": bug.get("severity", "medium"),
        "{{VERIFICATION_TYPE}}": vtype,
        "{{BUG_DESCRIPTION}}": bug.get("description", ""),
        "{{USER_CONTEXT}}": format_user_context(bug.get("user_context", [])),
        "{{ERROR_SOURCE_TYPE}}": error_type,
        "{{ERROR_SOURCE_DETAILS}}": format_error_source_details(error_source),
        "{{ACCEPTANCE_CRITERIA}}": format_acceptance_criteria(
            bug.get("acceptance_criteria", [])
        ),
        "{{ENVIRONMENT}}": format_environment(bug.get("environment")),
        "{{GLOBAL_CONTEXT}}": format_global_context(global_context, project_root),
        "{{PLATFORM_CONVENTIONS}}": read_platform_conventions(project_root),
        "{{TEAM_CONFIG_PATH}}": team_config_path,
        "{{DEV_SUBAGENT_PATH}}": dev_subagent,
        "{{REVIEWER_SUBAGENT_PATH}}": reviewer_subagent,
        "{{SESSION_STATUS_PATH}}": session_status_path,
        "{{PROJECT_ROOT}}": project_root,
        "{{FIX_SCOPE}}": fix_scope,
        "{{TIMESTAMP}}": "",  # Placeholder, agent fills in the timestamp
        "{{BROWSER_ENABLED}}": "true" if browser_enabled else "false",
        "{{BROWSER_TOOL}}": browser_tool,
        "{{BROWSER_VERIFY_STEPS}}": browser_verify_steps,
    }

    return replacements


def process_conditional_blocks(content, bug):
    """Handle conditional blocks based on verification_type and browser_interaction."""
    # Handle verification type blocks
    vtype = bug.get("verification_type", "automated")
    is_manual_or_hybrid = vtype in ("manual", "hybrid")

    if is_manual_or_hybrid:
        content = content.replace("{{IF_VERIFICATION_MANUAL_OR_HYBRID}}\n", "")
        content = content.replace("{{IF_VERIFICATION_MANUAL_OR_HYBRID}}", "")
        content = content.replace("{{END_IF_VERIFICATION_MANUAL_OR_HYBRID}}\n", "")
        content = content.replace("{{END_IF_VERIFICATION_MANUAL_OR_HYBRID}}", "")
    else:
        # Remove the entire conditional block
        content = re.sub(
            r"\{\{IF_VERIFICATION_MANUAL_OR_HYBRID\}\}.*?\{\{END_IF_VERIFICATION_MANUAL_OR_HYBRID\}\}\n?",
            "", content, flags=re.DOTALL,
        )

    # Handle browser interaction blocks
    browser_interaction = bug.get("browser_interaction")
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


def render_template(template_content, replacements, bug):
    """Render the template by processing conditionals and replacing placeholders."""
    # Step 1: Process conditional blocks
    content = process_conditional_blocks(template_content, bug)

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
    """Emit standardized failure JSON and exit."""
    print(json.dumps({"success": False, "error": message}, indent=2, ensure_ascii=False))
    sys.exit(1)


# ============================================================
# Checkpoint generation for bugfix pipeline
# ============================================================

BUGFIX_STEPS = [
    ("prizmkit-init", "Initialize", []),
    ("bug-diagnosis-and-plan", "Diagnose & Plan",
     [".prizmkit/bugfix/{slug}/spec.md",
      ".prizmkit/bugfix/{slug}/plan.md"]),
    ("prizmkit-implement", "Implement Fix", []),
    ("prizmkit-code-review", "Code Review", []),
    ("prizmkit-committer", "Commit", ["--headless"]),
    ("bug-report", "Generate Fix Report",
     [".prizmkit/bugfix/{slug}/fix-report.md"]),
]


def generate_bugfix_checkpoint(bug_id, session_id):
    """Generate a checkpoint definition for bugfix pipeline.

    Returns a dict suitable for writing as workflow-checkpoint.json.
    """
    steps = []
    prev_id = None
    for i, (skill, name, artifacts) in enumerate(BUGFIX_STEPS, 1):
        step_id = "S{:02d}".format(i)
        steps.append({
            "id": step_id,
            "skill": skill,
            "name": name,
            "status": "pending",
            "required_artifacts": [a.replace("{slug}", bug_id) for a in artifacts],
            "depends_on": prev_id,
        })
        prev_id = step_id

    return {
        "version": 1,
        "workflow_type": "bugfix-pipeline",
        "pipeline_mode": "single",
        "item_id": bug_id,
        "item_slug": bug_id,
        "session_id": session_id,
        "steps": steps,
    }


def merge_bugfix_checkpoint_state(existing, fresh, project_root):
    """Merge existing bugfix checkpoint state into fresh definition.

    Same logic as feature pipeline: validate artifacts, break chain on
    first invalid step.
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


def main():
    args = parse_args()

    # Resolve script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Resolve template path
    if args.template:
        template_path = args.template
    else:
        template_path = os.path.join(
            script_dir, "..", "templates", "bugfix-bootstrap-prompt.md"
        )

    # Load template
    template_content, err = read_text_file(template_path)
    if err:
        emit_failure("Template error: {}".format(err))

    # Load bug fix list
    bug_list_data, err = load_json_file(args.bug_list)
    if err:
        emit_failure("Bug list error: {}".format(err))

    # Extract bugs array
    bugs = bug_list_data.get("bugs")
    if not isinstance(bugs, list):
        emit_failure("Bug fix list does not contain a 'bugs' array")

    # Find the target bug
    bug = find_bug(bugs, args.bug_id)
    if bug is None:
        emit_failure("Bug '{}' not found in bug fix list".format(args.bug_id))

    # Extract global context
    global_context = bug_list_data.get("global_context", {})
    if not isinstance(global_context, dict):
        global_context = {}

    # Build replacements
    replacements = build_replacements(args, bug, global_context, script_dir)

    # Add checkpoint path to replacements
    checkpoint_rel = os.path.join(
        ".prizmkit", "bugfix", args.bug_id, "workflow-checkpoint.json",
    )
    replacements["{{CHECKPOINT_PATH}}"] = checkpoint_rel

    # Render the template
    rendered = render_template(template_content, replacements, bug)

    # Write the output
    err = write_output(args.output, rendered)
    if err:
        emit_failure(err)

    # Generate checkpoint file
    project_root = resolve_project_root(script_dir)
    checkpoint_path = os.path.join(project_root, checkpoint_rel)
    checkpoint_dir = os.path.dirname(checkpoint_path)
    os.makedirs(checkpoint_dir, exist_ok=True)

    checkpoint = generate_bugfix_checkpoint(args.bug_id, args.session_id)

    is_resume = args.resume_phase != "null"
    if is_resume and os.path.exists(checkpoint_path):
        try:
            with open(checkpoint_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
            checkpoint = merge_bugfix_checkpoint_state(
                existing, checkpoint, project_root,
            )
            LOGGER.info("Merged existing bugfix checkpoint from %s",
                        checkpoint_path)
        except (json.JSONDecodeError, KeyError) as exc:
            LOGGER.warning(
                "Existing bugfix checkpoint corrupted (%s) — generating fresh",
                exc,
            )

    with open(checkpoint_path, "w", encoding="utf-8") as f:
        json.dump(checkpoint, f, indent=2, ensure_ascii=False)
    LOGGER.info("Wrote bugfix checkpoint to %s", checkpoint_path)

    # Resolve critic and mode
    bug_critic = bug.get("critic", False)
    if args.critic is not None:
        critic_enabled = str(args.critic).lower() == "true"
    else:
        critic_enabled = bool(bug_critic)

    pipeline_mode = args.mode or "standard"
    agent_count = 5 if critic_enabled else 3

    # Success
    bug_model = bug.get("model", "")
    # Extract browser interaction state for output
    browser_interaction = bug.get("browser_interaction")
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
            if browser_tool not in ("playwright-cli", "opencli", "auto"):
                browser_tool = "auto"

    output = {
        "success": True,
        "output_path": os.path.abspath(args.output),
        "checkpoint_path": checkpoint_path,
        "model": bug_model,
        "pipeline_mode": pipeline_mode,
        "agent_count": agent_count,
        "critic_enabled": critic_enabled,
        "browser_enabled": browser_enabled,
        "browser_tool": browser_tool
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        emit_failure("generate-bugfix-prompt interrupted")
    except SystemExit:
        raise
    except Exception as exc:
        LOGGER.exception("Unhandled exception in generate-bugfix-prompt")
        emit_failure("Unexpected error: {}".format(str(exc)))
