#!/usr/bin/env python3
"""Generate a session-specific bootstrap prompt from template and feature list.

Supports two modes:
1. **Section assembly** (preferred): Loads modular section files from
   templates/sections/ and assembles them based on tier, conditions, and
   feature configuration. Conditional logic is handled in Python code,
   not regex-based template blocks.
2. **Legacy template** (fallback): Reads a monolithic bootstrap-tier{1,2,3}.md
   template and resolves {{PLACEHOLDER}} variables and {{IF_xxx}} blocks.

The section assembly mode is used when templates/sections/ directory exists.
Otherwise, falls back to legacy templates for backward compatibility.

Usage:
    python3 generate-bootstrap-prompt.py \
        --feature-list <path> --feature-id <id> \
        --session-id <id> --run-id <id> \
        --retry-count <n> --resume-phase <n|null> \
        --output <path>
"""

import argparse
import json
import os
import re
import sys

from utils import enrich_global_context, load_json_file, read_platform_conventions, setup_logging


DEFAULT_MAX_RETRIES = 3

LOGGER = setup_logging("generate-bootstrap-prompt")


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Generate a session-specific bootstrap prompt from a template "
            "and .prizmkit/plans/feature-list.json."
        )
    )
    parser.add_argument(
        "--feature-list",
        required=True,
        help="Path to .prizmkit/plans/feature-list.json",
    )
    parser.add_argument(
        "--feature-id",
        required=True,
        help="Feature ID to generate prompt for (e.g. F-001)",
    )
    parser.add_argument(
        "--session-id",
        required=True,
        help="Session ID for this pipeline session",
    )
    parser.add_argument(
        "--run-id",
        required=True,
        help="Pipeline run ID",
    )
    parser.add_argument(
        "--retry-count",
        required=True,
        help="Current retry count",
    )
    parser.add_argument(
        "--resume-phase",
        required=True,
        help='Phase to resume from, or "null" for fresh start',
    )
    parser.add_argument(
        "--state-dir",
        default=None,
        help="State directory path for reading previous session info",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output path for the rendered prompt",
    )
    parser.add_argument(
        "--template",
        default=None,
        help=(
            "Custom template path. Defaults to "
            "{script_dir}/../templates/bootstrap-prompt.md"
        ),
    )
    parser.add_argument(
        "--mode",
        choices=["lite", "standard", "full"],
        default=None,
        help="Override pipeline mode (default: auto-detect from complexity)",
    )
    parser.add_argument(
        "--critic",
        choices=["true", "false"],
        default=None,
        help="Override critic enablement (default: read from feature field)",
    )
    parser.add_argument(
        "--extract-baselines",
        action="store_true",
        help="Run tests and extract baseline failures (slower, optional)",
    )

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


def find_feature(features, feature_id):
    """Find and return the feature dict matching the given ID."""
    for feature in features:
        if isinstance(feature, dict) and feature.get("id") == feature_id:
            return feature
    return None


def compute_feature_slug(feature_id, title):
    """Compute the prizmkit feature slug: ###-kebab-case-name.

    e.g. F-001 + "Project Infrastructure Setup" -> "001-project-infrastructure-setup"
    The prizmkit skills use this slug to create per-feature directories.
    """
    # Extract numeric part from feature_id (e.g., "F-001" -> "001")
    numeric = feature_id.replace("F-", "").replace("f-", "")
    # Pad to 3 digits
    numeric = numeric.zfill(3)

    # Convert title to kebab-case
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)  # remove non-alphanumeric
    slug = re.sub(r"[\s]+", "-", slug.strip())  # spaces to hyphens
    slug = re.sub(r"-+", "-", slug)  # collapse multiple hyphens
    slug = slug.strip("-")

    return "{}-{}".format(numeric, slug)


def format_acceptance_criteria(criteria):
    """Format acceptance criteria as a markdown bullet list."""
    if not criteria:
        return "- (none specified)"
    lines = []
    for item in criteria:
        lines.append("- {}".format(item))
    return "\n".join(lines)

def detect_test_commands(project_root):
    """
    Auto-detect test commands based on project structure.

    Returns: space-separated string of test commands (e.g., "npm test go test ./...")
    """
    test_commands = []

    # Check for npm/package.json
    if os.path.exists(os.path.join(project_root, "package.json")):
        test_commands.append("npm test")

    # Check for Go
    if os.path.exists(os.path.join(project_root, "go.mod")):
        test_commands.append("go test ./...")

    # Check for Rust/Cargo
    if os.path.exists(os.path.join(project_root, "Cargo.toml")):
        test_commands.append("cargo test")

    # Check for Python pytest
    if os.path.exists(os.path.join(project_root, "pytest.ini")) or \
       os.path.exists(os.path.join(project_root, "setup.py")):
        test_commands.append("pytest")

    # Check for Make test target
    makefile_path = os.path.join(project_root, "Makefile")
    if os.path.exists(makefile_path):
        try:
            with open(makefile_path, 'r') as f:
                if 'test:' in f.read():
                    test_commands.append("make test")
        except Exception:
            pass

    # Return deduplicated commands joined with && for correct shell execution
    return " && ".join(dict.fromkeys(test_commands)) if test_commands else ""


def extract_baseline_failures(test_cmd, project_root):
    """
    Run test command and extract failing tests.

    Returns: semicolon-separated list of failing test names
    """
    if not test_cmd or test_cmd.startswith("(auto-detection"):
        return ""

    try:
        import subprocess
        original_cwd = os.getcwd()
        os.chdir(project_root)

        result = subprocess.run(
            test_cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=120
        )

        os.chdir(original_cwd)

        output = result.stdout + result.stderr
        failures = []

        for line in output.split('\n'):
            if 'FAILED' in line and '::' in line:
                parts = line.split('FAILED')
                if len(parts) > 1:
                    test_name = parts[1].strip().split(' ')[0]
                    if test_name and test_name not in failures:
                        failures.append(test_name)

        return ";".join(failures) if failures else ""

    except Exception as e:
        return f"(error: {str(e)})"
    finally:
        try:
            os.chdir(original_cwd)
        except Exception:
            pass


def format_ac_checklist(acceptance_criteria):
    """Format acceptance criteria as a markdown checkbox list."""
    if not acceptance_criteria:
        return "- [ ] (no acceptance criteria specified)"
    lines = []
    for item in acceptance_criteria:
        lines.append("- [ ] {}".format(item))
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


def get_completed_dependencies(features, feature):
    """Look up dependency features and list those with status=completed.

    When a completed dependency has completion_notes (written by the AI
    session and propagated by the pipeline runner), include them as rich
    context so the downstream session knows what was built.
    """
    deps = feature.get("dependencies", [])
    if not deps:
        return "- (no dependencies)"

    # Build a lookup map
    feature_map = {}
    for f in features:
        if isinstance(f, dict) and "id" in f:
            feature_map[f["id"]] = f

    sections = []
    for dep_id in deps:
        dep = feature_map.get(dep_id)
        if dep and dep.get("status") == "completed":
            header = "- **{}** — {} (completed)".format(
                dep_id, dep.get("title", "Untitled")
            )
            notes = dep.get("completion_notes", [])
            if notes and isinstance(notes, list):
                note_lines = "\n".join(
                    "  - {}".format(n) for n in notes
                    if isinstance(n, str) and n.strip()
                )
                if note_lines:
                    header += "\n" + note_lines
            sections.append(header)

    if not sections:
        return "- (no completed dependencies yet)"
    return "\n".join(sections)


def get_prev_session_status(state_dir, feature_id):
    """Read previous session status from state dir if available."""
    if not state_dir:
        return "N/A (first run)"

    # Try to read the feature status file to find the last session
    feature_status_path = os.path.join(
        state_dir, "features", feature_id, "status.json"
    )
    if not os.path.isfile(feature_status_path):
        return "N/A (first run)"

    try:
        with open(feature_status_path, "r", encoding="utf-8") as f:
            feature_status = json.load(f)
    except (json.JSONDecodeError, IOError):
        return "N/A (could not read feature status)"

    last_session_id = feature_status.get("last_session_id")
    if not last_session_id:
        return "N/A (first run)"

    # Try to read the last session's session-status.json
    session_status_path = os.path.join(
        state_dir, "features", feature_id, "sessions",
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


def _read_project_brief(project_root):
    """Read project-brief.md from new or old location with fallback.

    Returns the file content as a string, or a fallback message if absent.
    This brief is generated by app-planner during interactive planning and
    captures the user's product ideas as a checklist. Each line is one idea,
    marked [ ] for pending or [x] for completed. Feature sessions should mark
    items [x] and append key file paths when implementing relevant ideas.
    """
    # Check both new and old paths for backward compatibility
    new_path = os.path.join(project_root, ".prizmkit", "plans", "project-brief.md")
    old_path = os.path.join(project_root, "project-brief.md")

    for brief_path in [new_path, old_path]:
        if os.path.isfile(brief_path):
            try:
                with open(brief_path, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    if brief_path == old_path:
                        # Warn user about old path
                        import sys
                        print("⚠️  Migration notice: project-brief.md found in root. "
                              "Please move to .prizmkit/plans/project-brief.md",
                              file=sys.stderr)
                    return content
            except IOError:
                return "(project-brief.md exists but could not be read)"

    return "(No project brief available)"


def resolve_project_root(script_dir):
    """Resolve project root as the parent directory of dev-pipeline/.

    The script lives at dev-pipeline/scripts/, so project root is two
    levels up from the script directory.
    """
    # script_dir = .../dev-pipeline/scripts
    # dev_pipeline_dir = .../dev-pipeline
    # project_root = .../
    dev_pipeline_dir = os.path.dirname(script_dir)
    project_root = os.path.dirname(dev_pipeline_dir)
    return os.path.abspath(project_root)


def process_conditional_blocks(content, resume_phase):
    """Handle conditional blocks based on resume_phase.

    Supports:
    - {{IF_FRESH_START}} / {{END_IF_FRESH_START}}
    - {{IF_RESUME}} / {{END_IF_RESUME}}
    - {{IF_RETRY}} / {{END_IF_RETRY}}
    """
    is_resume = resume_phase != "null"

    if is_resume:
        # Remove fresh-start blocks, keep resume blocks
        content = re.sub(
            r"\{\{IF_FRESH_START\}\}.*?\{\{END_IF_FRESH_START\}\}\n?",
            "", content, flags=re.DOTALL,
        )
        content = re.sub(r"\{\{IF_RESUME\}\}\n?", "", content)
        content = re.sub(r"\{\{END_IF_RESUME\}\}\n?", "", content)
    else:
        # Keep fresh-start blocks, remove resume blocks
        content = re.sub(r"\{\{IF_FRESH_START\}\}\n?", "", content)
        content = re.sub(r"\{\{END_IF_FRESH_START\}\}\n?", "", content)
        content = re.sub(
            r"\{\{IF_RESUME\}\}.*?\{\{END_IF_RESUME\}\}\n?",
            "", content, flags=re.DOTALL,
        )

    return content


def process_mode_blocks(content, pipeline_mode, init_done, critic_enabled=False,
                        browser_interaction=False, browser_tool="auto"):
    """Process pipeline mode, init, critic, and browser conditional blocks.

    Keeps the block matching the current mode, removes the others.
    Handles {{IF_CRITIC_ENABLED}} / {{END_IF_CRITIC_ENABLED}} blocks.
    Handles {{IF_BROWSER_INTERACTION}} / {{END_IF_BROWSER_INTERACTION}} blocks.
    Handles {{IF_BROWSER_TOOL_PLAYWRIGHT}} / {{IF_BROWSER_TOOL_OPENCLI}} /
    {{IF_BROWSER_TOOL_AUTO}} blocks (nested inside browser interaction block).
    """
    # Handle lite/standard/full blocks
    modes = ["lite", "standard", "full"]

    for mode in modes:
        tag_open = "{{{{IF_MODE_{}}}}}".format(mode.upper())
        tag_close = "{{{{END_IF_MODE_{}}}}}".format(mode.upper())

        if mode == pipeline_mode:
            # Keep content, remove tags
            content = content.replace(tag_open + "\n", "")
            content = content.replace(tag_open, "")
            content = content.replace(tag_close + "\n", "")
            content = content.replace(tag_close, "")
        else:
            # Remove entire block
            pattern = re.escape(tag_open) + r".*?" + re.escape(tag_close) + r"\n?"
            content = re.sub(pattern, "", content, flags=re.DOTALL)

    # Init blocks
    if init_done:
        content = re.sub(r"\{\{IF_INIT_DONE\}\}\n?", "", content)
        content = re.sub(r"\{\{END_IF_INIT_DONE\}\}\n?", "", content)
        content = re.sub(
            r"\{\{IF_INIT_NEEDED\}\}.*?\{\{END_IF_INIT_NEEDED\}\}\n?",
            "", content, flags=re.DOTALL,
        )
    else:
        content = re.sub(r"\{\{IF_INIT_NEEDED\}\}\n?", "", content)
        content = re.sub(r"\{\{END_IF_INIT_NEEDED\}\}\n?", "", content)
        content = re.sub(
            r"\{\{IF_INIT_DONE\}\}.*?\{\{END_IF_INIT_DONE\}\}\n?",
            "", content, flags=re.DOTALL,
        )

    # Critic blocks
    critic_open = "{{IF_CRITIC_ENABLED}}"
    critic_close = "{{END_IF_CRITIC_ENABLED}}"
    if critic_enabled:
        # Keep content, remove tags
        content = content.replace(critic_open + "\n", "")
        content = content.replace(critic_open, "")
        content = content.replace(critic_close + "\n", "")
        content = content.replace(critic_close, "")
    else:
        # Remove entire CRITIC blocks
        pattern = re.escape(critic_open) + r".*?" + re.escape(critic_close) + r"\n?"
        content = re.sub(pattern, "", content, flags=re.DOTALL)

    # Browser interaction blocks
    browser_open = "{{IF_BROWSER_INTERACTION}}"
    browser_close = "{{END_IF_BROWSER_INTERACTION}}"
    if browser_interaction:
        content = content.replace(browser_open + "\n", "")
        content = content.replace(browser_open, "")
        content = content.replace(browser_close + "\n", "")
        content = content.replace(browser_close, "")
    else:
        pattern = re.escape(browser_open) + r".*?" + re.escape(browser_close) + r"\n?"
        content = re.sub(pattern, "", content, flags=re.DOTALL)

    # Browser tool selection blocks (nested inside browser interaction)
    tool_variants = ["PLAYWRIGHT", "OPENCLI", "AUTO"]
    # Map browser_tool value to the variant tag name
    active_variant = {
        "playwright-cli": "PLAYWRIGHT",
        "opencli": "OPENCLI",
        "auto": "AUTO",
    }.get(browser_tool, "AUTO")

    for variant in tool_variants:
        tool_open = "{{{{IF_BROWSER_TOOL_{}}}}}".format(variant)
        tool_close = "{{{{END_IF_BROWSER_TOOL_{}}}}}".format(variant)
        if variant == active_variant and browser_interaction:
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


def detect_init_status(project_root):
    """Check if PrizmKit init has already been done."""
    prizm_docs = os.path.join(project_root, ".prizm-docs", "root.prizm")
    prizmkit_config = os.path.join(project_root, ".prizmkit", "config.json")
    return os.path.isfile(prizm_docs) and os.path.isfile(prizmkit_config)


def detect_existing_artifacts(project_root, feature_slug):
    """Check which planning artifacts already exist for this feature.

    Returns a dict with keys: has_spec, has_plan, all_complete.
    Tasks are now part of plan.md (Tasks section), not a separate file.
    """
    specs_dir = os.path.join(project_root, ".prizmkit", "specs", feature_slug)
    result = {
        "has_spec": os.path.isfile(os.path.join(specs_dir, "spec.md")),
        "has_plan": os.path.isfile(os.path.join(specs_dir, "plan.md")),
    }
    result["all_complete"] = all([
        result["has_spec"], result["has_plan"]
    ])
    return result


def determine_pipeline_mode(complexity):
    """Map estimated_complexity to pipeline mode.

    Returns: 'lite', 'standard', or 'full'

    Tier assignment rationale:
    - low + medium → lite (single agent): most features don't benefit from
      the orchestrator→dev→reviewer overhead. A single agent reading
      .prizm-docs + implementing directly is faster and cheaper.
    - high → standard (orchestrator + dev + reviewer): complex features
      need the spec→plan→analyze→implement→review pipeline.
    - critical → full (full team + framework guardrails): architectural
      changes that touch many files and need extra safety checks.
    """
    mapping = {
        "low": "lite",
        "medium": "lite",
        "high": "standard",
        "critical": "full",
    }
    return mapping.get(complexity, "lite")


# ============================================================
# Checkpoint generation
# ============================================================

# Mapping: section name -> (skill_key, display_name, required_artifacts)
# skill_key is a unique identifier in the checkpoint, not necessarily the
# prizmkit skill name.  This ensures each section has a distinct key so
# merge_checkpoint_state() never collides.
SECTION_TO_SKILL = {
    "phase0-init": ("prizmkit-init", "Project Bootstrap",
                    [".prizm-docs/root.prizm", ".prizmkit/config.json"]),
    "phase0-test-baseline": ("test-baseline", "Test Baseline", []),
    "phase-context-snapshot": ("context-snapshot", "Build Context Snapshot",
                               [".prizmkit/specs/{slug}/context-snapshot.md"]),
    "phase-specify-plan": ("context-snapshot-and-plan", "Specify & Plan",
                           [".prizmkit/specs/{slug}/context-snapshot.md",
                            ".prizmkit/specs/{slug}/plan.md"]),
    "phase-plan": ("prizmkit-plan", "Plan & Tasks",
                   [".prizmkit/specs/{slug}/plan.md"]),
    "phase-critic-plan": ("critic-plan-review", "Critic: Plan Review", []),
    "phase-implement": ("prizmkit-implement", "Implement + Test", []),
    "phase-review": ("prizmkit-code-review", "Code Review", []),
    "phase-browser": ("browser-verification", "Browser Verification", []),
    "phase-commit": None,  # special: split into retrospective + committer
}

# phase-commit is split into two steps
_COMMIT_STEPS = [
    ("prizmkit-retrospective", "Retrospective", []),
    ("prizmkit-committer", "Commit", ["--headless"]),
]


def _resolve_artifacts(artifact_templates, slug):
    """Replace {slug} placeholder with the actual feature slug."""
    return [a.replace("{slug}", slug) for a in artifact_templates]


def generate_checkpoint_definition(sections, pipeline_mode, workflow_type,
                                   item_id, item_slug, session_id,
                                   init_done=False):
    """Derive checkpoint step definitions from the assembled sections list.

    Args:
        sections: list of (name, content) tuples from assemble_sections()
        pipeline_mode: "lite" | "standard" | "full"
        workflow_type: "feature-pipeline"
        item_id: feature ID (e.g. "F-001")
        item_slug: feature slug (e.g. "001-user-auth")
        session_id: current session ID
        init_done: whether project is already initialized (Phase 0 skip)

    Returns:
        dict suitable for writing as workflow-checkpoint.json
    """
    steps = []
    step_counter = 1
    prev_step_id = None

    for section_name, _content in sections:
        if section_name not in SECTION_TO_SKILL:
            continue

        mapping = SECTION_TO_SKILL[section_name]

        if mapping is None:
            # phase-commit -> split into retrospective + committer
            for skill, name, artifacts in _COMMIT_STEPS:
                step_id = "S{:02d}".format(step_counter)
                steps.append({
                    "id": step_id,
                    "skill": skill,
                    "name": name,
                    "status": "pending",
                    "required_artifacts": _resolve_artifacts(artifacts, item_slug),
                    "depends_on": prev_step_id,
                })
                prev_step_id = step_id
                step_counter += 1
            continue

        skill, name, artifacts = mapping
        step_id = "S{:02d}".format(step_counter)

        status = "pending"
        if init_done and section_name in ("phase0-init", "phase0-test-baseline"):
            status = "skipped"

        steps.append({
            "id": step_id,
            "skill": skill,
            "name": name,
            "status": status,
            "required_artifacts": _resolve_artifacts(artifacts, item_slug),
            "depends_on": prev_step_id,
        })

        prev_step_id = step_id
        step_counter += 1

    return {
        "version": 1,
        "workflow_type": workflow_type,
        "pipeline_mode": pipeline_mode,
        "item_id": item_id,
        "item_slug": item_slug,
        "session_id": session_id,
        "steps": steps,
    }


def merge_checkpoint_state(existing, fresh, project_root):
    """Merge existing checkpoint state into a freshly generated definition.

    Matching is by skill_key (not step ID), since tier changes across retries
    may shift step IDs.

    Merge rules:
    1. Only keep completed steps whose required_artifacts all exist on disk
    2. Keep skipped steps unconditionally
    3. Once a step is NOT completed/skipped, break the dependency chain:
       all subsequent steps reset to pending
    """
    existing_status = {}
    existing_artifacts = {}
    for step in existing.get("steps", []):
        existing_status[step["skill"]] = step["status"]
        existing_artifacts[step["skill"]] = step.get("required_artifacts", [])

    # Determine which completed steps have valid artifacts
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

    # Apply to fresh steps; break chain on first non-valid step
    chain_broken = False
    for step in fresh["steps"]:
        if chain_broken:
            step["status"] = "pending"
            continue

        prev = existing_status.get(step["skill"])
        if step["skill"] in valid_completed:
            step["status"] = prev  # completed or skipped
        else:
            chain_broken = True
            step["status"] = "pending"

    return fresh


# ============================================================
# Section Assembly (new modular approach)
# ============================================================


def load_section(sections_dir, name):
    """Load a section file from the sections directory.

    Returns the file content as a string, or raises FileNotFoundError.
    """
    path = os.path.join(sections_dir, name)
    if not os.path.isfile(path):
        raise FileNotFoundError("Section file not found: {}".format(path))
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def load_agent_prompts(templates_dir):
    """Load agent prompt templates from agent-prompts/ directory.

    Returns a dict of {{AGENT_PROMPT_XXX}} -> prompt content replacements.
    If the directory does not exist, returns an empty dict (backward compat).
    """
    agent_prompts_dir = os.path.join(templates_dir, "agent-prompts")
    if not os.path.isdir(agent_prompts_dir):
        LOGGER.debug("No agent-prompts/ directory found, skipping")
        return {}

    # Map filename -> placeholder name
    # e.g. dev-implement.md -> {{AGENT_PROMPT_DEV_IMPLEMENT}}
    prompt_map = {}
    for filename in sorted(os.listdir(agent_prompts_dir)):
        if not filename.endswith(".md"):
            continue
        stem = filename[:-3]  # remove .md
        placeholder = "{{{{AGENT_PROMPT_{}}}}}".format(
            stem.upper().replace("-", "_")
        )
        filepath = os.path.join(agent_prompts_dir, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                prompt_map[placeholder] = f.read().strip()
            LOGGER.debug("Loaded agent prompt: %s -> %s", filename, placeholder)
        except IOError as exc:
            LOGGER.warning("Failed to load agent prompt %s: %s", filename, exc)

    return prompt_map


def _tier_header(pipeline_mode):
    """Return the tier-specific header and mission description."""
    headers = {
        "lite": (
            "# Dev-Pipeline Session Bootstrap — Tier 1 (Single Agent)\n",
            "**Tier 1 — Single Agent**: You handle everything directly. "
            "No subagents, no TeamCreate.\n",
        ),
        "standard": (
            "# Dev-Pipeline Session Bootstrap — Tier 2 (Dual Agent)\n",
            "**Tier 2 — Dual Agent**: You handle context + planning "
            "directly. Then spawn Dev and Reviewer subagents. Spawn Dev "
            "and Reviewer agents via the Agent tool.\n",
        ),
        "full": (
            "# Dev-Pipeline Session Bootstrap — Tier 3 (Full Team)\n",
            "**Tier 3 — Full Team**: For complex features, use the full "
            "pipeline with Dev + Reviewer agents spawned via the Agent "
            "tool.\n",
        ),
    }
    return headers.get(pipeline_mode, headers["lite"])


def _tier_reminders(pipeline_mode, critic_enabled=False):
    """Return tier-specific reminder text."""
    common = [
        "- MANDATORY skills: `/prizmkit-retrospective`, `/prizmkit-committer` "
        "— never skip these",
        "- Build context-snapshot.md FIRST; use it throughout instead of "
        "re-reading files",
        "- `/prizmkit-committer` is mandatory — do NOT skip the commit phase, "
        "and do NOT replace it with manual git commit commands",
        "- Do NOT run `git add`/`git commit` during implementation phases — "
        "all changes are committed once in the commit phase",
        "- If any files remain after the commit, amend the existing commit — "
        "do NOT create a follow-up commit",
        "- When staging files, always use explicit file names — NEVER use "
        "`git add -A` or `git add .`",
    ]

    if pipeline_mode == "lite":
        specific = [
            "- Tier 1: you handle everything directly — no subagents needed",
        ]
    elif pipeline_mode == "standard":
        specific = [
            "- Tier 2: orchestrator builds context+plan, Analyzer checks "
            "consistency, Dev implements, Reviewer reviews+tests — use "
            "direct Agent spawn for agents",
            "- context-snapshot.md is append-only: orchestrator writes "
            "Sections 1-4, Dev appends Implementation Log, Reviewer "
            "appends Review Notes",
            "- Gate checks enforce Implementation Log and Review Notes are "
            "written before proceeding",
            "- Do NOT use `run_in_background=true` when spawning subagents",
            "- On timeout: check snapshot + git diff HEAD → model:lite → "
            "remaining steps only → max 2 retries per phase → "
            "orchestrator fallback",
        ]
    else:  # full
        specific = [
            "- Tier 3: full team — Dev (implementation) → Reviewer "
            "(review + test) — spawn agents directly via Agent tool",
            "- context-snapshot.md is append-only: orchestrator writes "
            "Sections 1-4, Dev appends Implementation Log, Reviewer "
            "appends Review Notes",
            "- Gate checks enforce Implementation Log and Review Notes are "
            "written before proceeding",
            "- Do NOT use `run_in_background=true` when spawning agents",
            "- On timeout: check snapshot → model:lite → remaining steps "
            "only → max 2 retries → orchestrator fallback",
        ]

    lines = ["## Reminders\n"] + specific + common
    return "\n".join(lines) + "\n"


def assemble_sections(pipeline_mode, sections_dir, init_done, is_resume,
                      critic_enabled, browser_enabled, retry_count=0,
                      browser_tool="auto"):
    """Assemble prompt sections based on tier and conditions.

    Uses Python code for conditional logic instead of regex-based
    template blocks. Each section is loaded from a separate .md file.

    Returns a list of (section_name, content) tuples in order.
    """
    sections = []

    # --- Header ---
    title, tier_desc = _tier_header(pipeline_mode)
    sections.append(("header", title))

    # --- Session Context ---
    sections.append(("session-context",
                      load_section(sections_dir, "session-context.md")))

    # --- Mission ---
    mission = (
        "## Your Mission\n\n"
        "You are the **session orchestrator**. Implement Feature "
        "{{FEATURE_ID}}: \"{{FEATURE_TITLE}}\".\n\n"
        "**CRITICAL**: You MUST NOT exit until ALL work is complete "
        "and committed."
    )
    if pipeline_mode != "lite":
        mission += (
            " When you spawn subagents, wait for each to finish "
            "(run_in_background=false)."
        )
    if pipeline_mode == "full":
        mission += (
            " Do NOT spawn agents in background and exit — "
            "that kills the session."
        )
    mission += "\n\n" + tier_desc
    sections.append(("mission", mission))

    # --- Feature Context (XML-wrapped, optimization 3) ---
    sections.append(("feature-context",
                      load_section(sections_dir, "feature-context.md")))

    # --- Context Budget Rules ---
    sections.append(("context-budget-rules",
                      load_section(sections_dir, "context-budget-rules.md")))

    # --- Directory Convention (tier-specific) ---
    if pipeline_mode == "lite":
        dc_file = "directory-convention-lite.md"
    elif pipeline_mode == "standard":
        dc_file = "directory-convention-agent.md"
    else:
        dc_file = "directory-convention-full.md"
    sections.append(("directory-convention",
                      load_section(sections_dir, dc_file)))

    # --- Subagent Timeout Recovery (only for agent tiers) ---
    if pipeline_mode in ("standard", "full"):
        sections.append(("timeout-recovery",
                          load_section(sections_dir,
                                       "subagent-timeout-recovery.md")))

    # --- Checkpoint System ---
    checkpoint_section_path = os.path.join(sections_dir, "checkpoint-system.md")
    if os.path.isfile(checkpoint_section_path):
        sections.append(("checkpoint-system",
                          load_section(sections_dir, "checkpoint-system.md")))

    # --- Execution header ---
    sections.append(("execution-header", "---\n\n## Execution\n"))

    # --- Phase 0: Init or Test Baseline ---
    if not init_done:
        sections.append(("phase0-init",
                          load_section(sections_dir, "phase0-init.md")))
    else:
        if pipeline_mode in ("standard", "full"):
            sections.append(("phase0-test-baseline",
                              load_section(sections_dir,
                                           "phase0-test-baseline.md")))
        else:
            sections.append(("phase0-skip",
                              "### Phase 0: SKIP (already initialized)\n"))

    # --- Context Snapshot + Plan (tier-dependent) ---
    if pipeline_mode == "full":
        # Tier 3: full specify + plan workflow
        sections.append(("phase-specify-plan",
                          load_section(sections_dir,
                                       "phase-specify-plan-full.md")))
    else:
        # Tier 1 & 2: separate context snapshot + plan
        snapshot_base = load_section(sections_dir,
                                     "phase-context-snapshot-base.md")
        if pipeline_mode == "lite":
            snapshot_suffix = load_section(
                sections_dir, "phase-context-snapshot-lite-suffix.md")
        else:
            snapshot_suffix = load_section(
                sections_dir, "phase-context-snapshot-agent-suffix.md")
        sections.append(("phase-context-snapshot",
                          snapshot_base + "\n" + snapshot_suffix))

        if pipeline_mode == "lite":
            sections.append(("phase-plan",
                              load_section(sections_dir,
                                           "phase-plan-lite.md")))
        else:
            sections.append(("phase-plan",
                              load_section(sections_dir,
                                           "phase-plan-agent.md")))

    # --- Critic: Plan Challenge (only if critic enabled) ---
    if critic_enabled:
        if pipeline_mode == "full":
            sections.append(("phase-critic-plan",
                              load_section(sections_dir,
                                           "phase-critic-plan-full.md")))
        else:
            sections.append(("phase-critic-plan",
                              load_section(sections_dir,
                                           "phase-critic-plan.md")))

    # --- Implement (tier-dependent) ---
    if pipeline_mode == "lite":
        sections.append(("phase-implement",
                          load_section(sections_dir,
                                       "phase-implement-lite.md")))
    elif pipeline_mode == "full":
        sections.append(("phase-implement",
                          load_section(sections_dir,
                                       "phase-implement-full.md")))
    else:
        sections.append(("phase-implement",
                          load_section(sections_dir,
                                       "phase-implement-agent.md")))

    # --- Test Failure Recovery Protocol (tier-specific) ---
    if pipeline_mode == "lite":
        sections.append(("test-failure-recovery",
                          load_section(sections_dir,
                                       "test-failure-recovery-lite.md")))
    else:
        sections.append(("test-failure-recovery",
                          load_section(sections_dir,
                                       "test-failure-recovery-agent.md")))

    # --- AC Verification Checklist (all tiers) ---
    ac_checklist_path = os.path.join(sections_dir, "ac-verification-checklist.md")
    if os.path.isfile(ac_checklist_path):
        sections.append(("ac-verification-checklist",
                          load_section(sections_dir,
                                       "ac-verification-checklist.md")))

    # --- Review (only for agent tiers) ---
    if pipeline_mode == "full":
        sections.append(("phase-review",
                          load_section(sections_dir,
                                       "phase-review-full.md")))
    elif pipeline_mode == "standard":
        sections.append(("phase-review",
                          load_section(sections_dir,
                                       "phase-review-agent.md")))

    # --- Browser Verification (conditional, tool-aware) ---
    if browser_enabled:
        if browser_tool == "opencli":
            browser_section_file = "phase-browser-verification-opencli.md"
        elif browser_tool == "playwright-cli":
            browser_section_file = "phase-browser-verification.md"
        else:
            # "auto" or unknown → let AI choose at runtime
            browser_section_file = "phase-browser-verification-auto.md"
        sections.append(("phase-browser",
                          load_section(sections_dir,
                                       browser_section_file)))

    # --- Commit (tier-dependent) ---
    if pipeline_mode == "full":
        sections.append(("phase-commit",
                          load_section(sections_dir,
                                       "phase-commit-full.md")))
    else:
        sections.append(("phase-commit",
                          load_section(sections_dir,
                                       "phase-commit.md")))

    # --- Critical Paths ---
    if pipeline_mode == "lite":
        cp_file = "critical-paths-lite.md"
    elif pipeline_mode == "full":
        cp_file = "critical-paths-full.md"
    else:
        cp_file = "critical-paths-agent.md"
    sections.append(("critical-paths",
                      load_section(sections_dir, cp_file)))

    # --- Failure Capture ---
    sections.append(("failure-capture",
                      load_section(sections_dir, "failure-capture.md")))

    # --- Reminders ---
    sections.append(("reminders",
                      _tier_reminders(pipeline_mode, critic_enabled)))

    return sections


def render_from_sections(sections, replacements):
    """Join assembled sections and replace all {{PLACEHOLDER}} variables.

    No regex-based conditional block processing needed — all conditions
    were resolved during assembly.
    """
    content = "\n".join(text for _, text in sections)

    # Replace all placeholders — run twice to handle agent prompt templates
    # that contain their own {{PLACEHOLDER}} variables.  First pass injects
    # agent prompt content (e.g. {{AGENT_PROMPT_DEV_IMPLEMENT}} expands to a
    # block containing {{FEATURE_ID}}).  Second pass replaces the inner vars.
    for _pass in range(2):
        for placeholder, value in replacements.items():
            content = content.replace(placeholder, value)

    return content


# ============================================================
# Rendered output validation (optimization 7)
# ============================================================


def validate_rendered(content):
    """Validate rendered prompt content for completeness.

    Checks:
    1. No unreplaced {{PLACEHOLDER}} variables remain
    2. No unclosed conditional blocks (legacy {{IF_xxx}} tags)
    3. Required sections present

    Returns (is_valid, warnings, errors) tuple.
    """
    warnings = []
    errors = []

    # Check for unreplaced placeholders (excluding code blocks that may
    # contain literal double braces like Jinja or Go templates)
    unreplaced = re.findall(r"\{\{[A-Z][A-Z_0-9]+\}\}", content)
    if unreplaced:
        # Deduplicate
        unique = sorted(set(unreplaced))
        warnings.append(
            "Unreplaced placeholders: {}".format(", ".join(unique))
        )

    # Check for unclosed conditional blocks (legacy)
    unclosed_if = re.findall(
        r"\{\{(?:IF|END_IF)_[A-Z_]+\}\}", content
    )
    if unclosed_if:
        unique = sorted(set(unclosed_if))
        errors.append(
            "Unclosed conditional blocks: {}".format(", ".join(unique))
        )

    # Check required sections exist
    required_markers = [
        ("## Your Mission", "Mission section"),
        ("## Execution", "Execution section"),
        ("## Failure Capture", "Failure Capture Protocol"),
    ]
    for marker, label in required_markers:
        if marker not in content:
            errors.append("Missing required section: {}".format(label))

    is_valid = len(errors) == 0

    # Log results
    for w in warnings:
        LOGGER.warning("VALIDATE: %s", w)
    for e in errors:
        LOGGER.error("VALIDATE: %s", e)

    return is_valid, warnings, errors


def build_replacements(args, feature, features, global_context, script_dir):
    """Build the full dict of placeholder -> replacement value."""
    project_root = resolve_project_root(script_dir)

    # Resolve paths - platform-aware agent/team resolution
    platform = os.environ.get("PRIZMKIT_PLATFORM", "")
    home_dir = os.path.expanduser("~")

    # Auto-detect platform if not set
    if not platform:
        has_claude = os.path.isdir(os.path.join(project_root, ".claude", "agents"))
        has_codebuddy = os.path.isdir(os.path.join(project_root, ".codebuddy", "agents"))
        if has_claude:
            platform = "claude"
        elif has_codebuddy:
            platform = "codebuddy"
        else:
            raise RuntimeError(
                "PrizmKit agents not found. Neither .claude/agents/ nor .codebuddy/agents/ exists. "
                "Run `npx prizmkit install` first, or set PRIZMKIT_PLATFORM=claude|codebuddy explicitly."
            )

    if platform == "claude":
        # Claude Code: agents in .claude/agents/, no native team config
        agents_dir = os.path.join(project_root, ".claude", "agents")
        team_config_path = os.path.join(
            project_root, ".claude", "team-info.json",
        )
    else:
        # CodeBuddy: agents in .codebuddy/agents/, team in ~/.codebuddy/teams/
        agents_dir = os.path.join(project_root, ".codebuddy", "agents")
        team_config_path = os.path.join(
            home_dir, ".codebuddy", "teams", "prizm-dev-team", "config.json",
        )

    # Agent definitions are .md files in the platform-specific agents dir
    dev_subagent = os.path.join(
        agents_dir, "prizm-dev-team-dev.md",
    )
    reviewer_subagent = os.path.join(
        agents_dir, "prizm-dev-team-reviewer.md",
    )
    critic_subagent = os.path.join(
        agents_dir, "prizm-dev-team-critic.md",
    )

    # Verify agent files actually exist — missing files cause confusing
    # errors when the AI session tries to read them later.
    for agent_path, agent_name in [
        (dev_subagent, "dev agent"),
        (reviewer_subagent, "reviewer agent"),
    ]:
        if not os.path.isfile(agent_path):
            LOGGER.warning(
                "Agent file not found: %s (%s). "
                "Subagent spawning may fail. "
                "Run `npx prizmkit install` to reinstall agent definitions.",
                agent_path, agent_name,
            )
    # Validator scripts - check if they exist in .codebuddy/scripts/, otherwise use dev-pipeline/scripts/
    validator_scripts_dir = os.path.join(project_root, "dev-pipeline", "scripts")
    init_script_path = os.path.join(validator_scripts_dir, "init-dev-team.py")

    # Session status path (relative to project root)
    session_status_path = os.path.join(
        ".prizmkit", "state", "features", args.feature_id,
        "sessions", args.session_id, "session-status.json",
    )
    # Make it absolute from project root
    session_status_abs = os.path.join(project_root, session_status_path)

    # Compute feature slug for per-feature directory naming
    feature_slug = compute_feature_slug(
        args.feature_id, feature.get("title", "")
    )

    # Detect project state
    init_done = detect_init_status(project_root)
    artifacts = detect_existing_artifacts(project_root, feature_slug)
    complexity = feature.get(
        "estimated_complexity",
        feature.get("complexity", "medium"),
    )
    if args.mode:
        pipeline_mode = args.mode
    else:
        pipeline_mode = determine_pipeline_mode(complexity)

    # Auto-detect resume: if all planning artifacts exist and resume_phase
    # is "null" (fresh start), skip to Phase 6
    effective_resume = args.resume_phase
    if effective_resume == "null" and artifacts["all_complete"]:
        effective_resume = "6"

    # Determine critic enablement (priority: CLI > env > feature field > default)
    critic_env = os.environ.get("ENABLE_CRITIC", "").lower()
    if args.critic is not None:
        critic_enabled = args.critic == "true"
    elif critic_env in ("true", "1"):
        critic_enabled = True
    elif critic_env in ("false", "0"):
        critic_enabled = False
    else:
        critic_enabled = bool(feature.get("critic", False))

    # Determine critic count (from feature field, default 1)
    # Multi-critic voting (3) must be explicitly set by the user in .prizmkit/plans/feature-list.json
    critic_count = feature.get("critic_count", 1)

    # Guard: if critic enabled but agent file missing, force disable and warn
    if critic_enabled and not os.path.isfile(critic_subagent):
        LOGGER.warning(
            "Critic enabled but agent file not found: %s. "
            "Critic phases will be SKIPPED. "
            "Run `npx prizmkit install` to install agent definitions.",
            critic_subagent,
        )
        critic_enabled = False

    # Guard: if critic enabled but tier doesn't support it (lite), warn and disable
    if critic_enabled and pipeline_mode == "lite":
        LOGGER.warning(
            "Critic enabled for feature %s but pipeline_mode='lite' (tier1) "
            "does not support critic phases. Critic will be SKIPPED. "
            "Use estimated_complexity='high' or pass --mode standard/full.",
            args.feature_id,
        )
        critic_enabled = False

    # Browser interaction - extract from feature if present
    browser_interaction = feature.get("browser_interaction")
    browser_enabled = False
    browser_verify_steps = ""
    browser_tool = "auto"  # default: AI chooses at runtime

    browser_verify_env = os.environ.get("BROWSER_VERIFY", "").lower()
    if browser_verify_env == "false":
        browser_interaction = None

    if browser_interaction and isinstance(browser_interaction, bool):
        # Simple boolean: browser verification enabled, no specific goals
        browser_enabled = True
        browser_tool = "auto"
        browser_verify_steps = (
            "   # (no specific verify goals — explore the app and "
            "verify the feature works as expected)")
    elif browser_interaction and isinstance(browser_interaction, dict):
        # Extract tool preference (playwright-cli / opencli / auto)
        browser_tool = browser_interaction.get("tool", "auto")
        if browser_tool not in ("playwright-cli", "opencli", "auto"):
            LOGGER.warning(
                "Unknown browser_interaction.tool '%s', defaulting to 'auto'",
                browser_tool,
            )
            browser_tool = "auto"

        # browser_interaction only needs verify_steps — AI auto-detects
        # dev server command, URL, and port from project config
        steps = browser_interaction.get("verify_steps", [])
        if steps:
            browser_enabled = True
            browser_verify_steps = "\n".join(
                "   # Goal {}: {}".format(i + 1, step)
                for i, step in enumerate(steps)
            )
        elif browser_interaction.get("url") or browser_interaction.get("enabled", True):
            # Backward compat: old format had url/setup_command fields
            browser_enabled = True
            browser_verify_steps = (
                "   # (no specific verify goals — explore the app and "
                "verify the feature works as expected)")

    # Auto-detect test commands from project structure
    test_cmd = detect_test_commands(project_root)
    if not test_cmd:
        test_cmd = "(auto-detection found no standard test commands; manually specify TEST_CMD)"

    # Optionally extract baseline failures from test execution
    baseline_failures = ""
    if args.extract_baselines:
        baseline_failures = extract_baseline_failures(test_cmd, project_root)

    # Extract coverage target from feature.testing field (new in v2)
    coverage_target = "80"  # Default coverage target
    testing_config = feature.get("testing", {})
    if isinstance(testing_config, dict):
        coverage_target = str(testing_config.get("coverage_target", 80))

    # Detect dev server port from package.json
    dev_port = "3000"  # Default fallback
    try:
        pkg_path = os.path.join(project_root, "package.json")
        if os.path.isfile(pkg_path):
            with open(pkg_path, "r", encoding="utf-8") as f:
                pkg = json.load(f)
            dev_script = pkg.get("scripts", {}).get("dev", "")
            # Extract -p <port> from dev script
            port_match = re.search(r"-p\s+(\d+)", dev_script)
            if port_match:
                dev_port = port_match.group(1)
            else:
                # Fallback: try NEXT_PUBLIC_SITE_URL from .env files
                for env_file in [".env.local", ".env"]:
                    env_path = os.path.join(project_root, env_file)
                    if os.path.isfile(env_path):
                        with open(env_path, "r", encoding="utf-8") as ef:
                            for line in ef:
                                m = re.match(
                                    r"NEXT_PUBLIC_SITE_URL\s*=\s*.*?:([0-9]+)", line.strip()
                                )
                                if m:
                                    dev_port = m.group(1)
                                    break
                        if dev_port != "3000":
                            break
    except Exception:
        pass  # Keep default 3000 on any error
    dev_url = f"http://localhost:{dev_port}"

    replacements = {
        "{{RUN_ID}}": args.run_id,
        "{{SESSION_ID}}": args.session_id,
        "{{FEATURE_ID}}": args.feature_id,
        "{{FEATURE_LIST_PATH}}": os.path.abspath(args.feature_list),
        "{{FEATURE_TITLE}}": feature.get("title", ""),
        "{{FEATURE_DESCRIPTION}}": feature.get("description", ""),
        "{{USER_CONTEXT}}": format_user_context(feature.get("user_context", [])),
        "{{ACCEPTANCE_CRITERIA}}": format_acceptance_criteria(
            feature.get("acceptance_criteria", [])
        ),
        "{{COMPLETED_DEPENDENCIES}}": get_completed_dependencies(
            features, feature
        ),
        "{{GLOBAL_CONTEXT}}": format_global_context(global_context, project_root),
        "{{PROJECT_BRIEF}}": _read_project_brief(project_root),
        "{{PLATFORM_CONVENTIONS}}": read_platform_conventions(project_root),
        "{{TEAM_CONFIG_PATH}}": team_config_path,
        "{{DEV_SUBAGENT_PATH}}": dev_subagent,
        "{{REVIEWER_SUBAGENT_PATH}}": reviewer_subagent,
        "{{CRITIC_SUBAGENT_PATH}}": critic_subagent,
        "{{INIT_SCRIPT_PATH}}": init_script_path,
        "{{SESSION_STATUS_PATH}}": session_status_abs,
        "{{PROJECT_ROOT}}": project_root,
        "{{FEATURE_SLUG}}": feature_slug,
        "{{CHECKPOINT_PATH}}": os.path.join(
            ".prizmkit", "specs", feature_slug, "workflow-checkpoint.json",
        ),
        "{{PIPELINE_MODE}}": pipeline_mode,
        "{{COMPLEXITY}}": complexity,
        "{{CRITIC_ENABLED}}": "true" if critic_enabled else "false",
        "{{CRITIC_COUNT}}": str(critic_count),
        "{{INIT_DONE}}": "true" if init_done else "false",
        "{{HAS_SPEC}}": "true" if artifacts["has_spec"] else "false",
        "{{HAS_PLAN}}": "true" if artifacts["has_plan"] else "false",
        "{{BROWSER_VERIFY_STEPS}}": browser_verify_steps,
        "{{BROWSER_TOOL}}": browser_tool,
        "{{AC_CHECKLIST}}": format_ac_checklist(
            feature.get("acceptance_criteria", [])
        ),
        "{{TEST_CMD}}": test_cmd,
        "{{BASELINE_FAILURES}}": baseline_failures,
        "{{COVERAGE_TARGET}}": coverage_target,
        "{{DEV_PORT}}": dev_port,
        "{{DEV_URL}}": dev_url,
    }

    return replacements, effective_resume, browser_enabled, browser_tool


def render_template(template_content, replacements, resume_phase,
                    browser_enabled=False, browser_tool="auto"):
    """Render the template by processing conditionals and replacing placeholders."""
    # Step 1: Process fresh_start/resume conditional blocks
    content = process_conditional_blocks(template_content, resume_phase)

    # Step 2: Process mode, init, critic, and browser conditional blocks
    pipeline_mode = replacements.get("{{PIPELINE_MODE}}", "standard")
    init_done = replacements.get("{{INIT_DONE}}", "false") == "true"
    critic_enabled = replacements.get("{{CRITIC_ENABLED}}", "false") == "true"
    content = process_mode_blocks(content, pipeline_mode, init_done, critic_enabled,
                                  browser_enabled, browser_tool)

    # Step 3: Replace all {{PLACEHOLDER}} variables (two passes for nested
    # agent prompt templates that may contain their own placeholders)
    for _pass in range(2):
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


def main():
    args = parse_args()

    # Resolve script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    templates_dir = os.path.join(script_dir, "..", "templates")
    sections_dir = os.path.join(templates_dir, "sections")

    # Load feature list early (needed for both code paths)
    feature_list_data, err = load_json_file(args.feature_list)
    if err:
        emit_failure("Feature list error: {}".format(err))

    features = feature_list_data.get("features")
    if not isinstance(features, list):
        emit_failure("Feature list does not contain a 'features' array")

    feature = find_feature(features, args.feature_id)
    if feature is None:
        emit_failure(
            "Feature '{}' not found in feature list".format(args.feature_id)
        )

    global_context = feature_list_data.get("global_context", {})
    if not isinstance(global_context, dict):
        global_context = {}

    # Build replacements (shared by both code paths)
    replacements, effective_resume, browser_enabled, browser_tool = build_replacements(
        args, feature, features, global_context, script_dir
    )

    # Load agent prompt templates and merge into replacements
    agent_prompt_replacements = load_agent_prompts(templates_dir)
    replacements.update(agent_prompt_replacements)

    # Extract state needed for assembly
    pipeline_mode = replacements.get("{{PIPELINE_MODE}}", "lite")
    init_done = replacements.get("{{INIT_DONE}}", "false") == "true"
    is_resume = effective_resume != "null"
    critic_enabled = replacements.get("{{CRITIC_ENABLED}}", "false") == "true"

    # ── Choose rendering path ──────────────────────────────────────────
    use_sections = os.path.isdir(sections_dir) and not args.template

    if use_sections:
        # New modular section assembly (code-level conditional logic)
        LOGGER.info("Using section assembly from %s", sections_dir)
        try:
            sections = assemble_sections(
                pipeline_mode, sections_dir, init_done, is_resume,
                critic_enabled, browser_enabled,
                retry_count=int(args.retry_count),
                browser_tool=browser_tool,
            )
            rendered = render_from_sections(sections, replacements)
        except FileNotFoundError as exc:
            LOGGER.warning(
                "Section assembly failed (%s), falling back to legacy "
                "template", exc,
            )
            use_sections = False

    if not use_sections:
        # Legacy monolithic template path (backward compatible)
        if args.template:
            template_path = args.template
        else:
            complexity = feature.get(
                "estimated_complexity",
                feature.get("complexity", "medium"),
            )
            _mode = args.mode or determine_pipeline_mode(complexity)
            _tier_file_map = {
                "lite": "bootstrap-tier1.md",
                "standard": "bootstrap-tier2.md",
                "full": "bootstrap-tier3.md",
            }
            _tier_file = _tier_file_map.get(_mode, "bootstrap-tier2.md")
            _tier_path = os.path.join(templates_dir, _tier_file)
            if os.path.isfile(_tier_path):
                template_path = _tier_path
            else:
                template_path = os.path.join(
                    templates_dir, "bootstrap-prompt.md"
                )

        template_content, err = read_text_file(template_path)
        if err:
            emit_failure("Template error: {}".format(err))

        rendered = render_template(
            template_content, replacements, effective_resume, browser_enabled,
            browser_tool
        )

    # ── Validate rendered output ───────────────────────────────────────
    is_valid, warnings, errors = validate_rendered(rendered)
    if not is_valid:
        LOGGER.error(
            "Rendered prompt failed validation: %s",
            "; ".join(errors),
        )
        # Continue anyway — a partially valid prompt is better than none

    # ── Write output ───────────────────────────────────────────────────
    err = write_output(args.output, rendered)
    if err:
        emit_failure(err)

    # ── Generate checkpoint file ──────────────────────────────────────
    project_root = resolve_project_root(
        os.path.dirname(os.path.abspath(__file__))
    )
    feature_slug = replacements.get("{{FEATURE_SLUG}}", "")
    checkpoint_path = ""

    if use_sections and feature_slug:
        checkpoint = generate_checkpoint_definition(
            sections=sections,
            pipeline_mode=pipeline_mode,
            workflow_type="feature-pipeline",
            item_id=args.feature_id,
            item_slug=feature_slug,
            session_id=args.session_id,
            init_done=init_done,
        )

        checkpoint_dir = os.path.join(
            project_root, ".prizmkit", "specs", feature_slug,
        )
        os.makedirs(checkpoint_dir, exist_ok=True)
        checkpoint_path = os.path.join(
            checkpoint_dir, "workflow-checkpoint.json",
        )

        # On resume, merge existing completed state (with artifact validation)
        if is_resume and os.path.exists(checkpoint_path):
            try:
                with open(checkpoint_path, "r", encoding="utf-8") as f:
                    existing = json.load(f)
                checkpoint = merge_checkpoint_state(
                    existing, checkpoint, project_root,
                )
                LOGGER.info("Merged existing checkpoint state from %s",
                            checkpoint_path)
            except (json.JSONDecodeError, KeyError) as exc:
                LOGGER.warning(
                    "Existing checkpoint corrupted (%s) — generating fresh",
                    exc,
                )

        with open(checkpoint_path, "w", encoding="utf-8") as f:
            json.dump(checkpoint, f, indent=2, ensure_ascii=False)
        LOGGER.info("Wrote checkpoint to %s", checkpoint_path)

    # ── Success JSON ───────────────────────────────────────────────────
    feature_model = feature.get("model", "")
    mode_agent_counts = {"lite": 1, "standard": 3, "full": 3}
    agent_count = mode_agent_counts.get(pipeline_mode, 1)
    critic_count_val = int(replacements.get("{{CRITIC_COUNT}}", "1"))
    if critic_enabled:
        agent_count += critic_count_val
    output = {
        "success": True,
        "output_path": os.path.abspath(args.output),
        "model": feature_model,
        "pipeline_mode": pipeline_mode,
        "agent_count": agent_count,
        "critic_enabled": "true" if critic_enabled else "false",
        "render_mode": "sections" if use_sections else "legacy",
        "validation_warnings": len(warnings),
        "validation_errors": len(errors),
        "checkpoint_path": checkpoint_path,
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        emit_failure("generate-bootstrap-prompt interrupted")
    except SystemExit:
        raise
    except Exception as exc:
        LOGGER.exception("Unhandled exception in generate-bootstrap-prompt")
        emit_failure("Unexpected error: {}".format(str(exc)))
