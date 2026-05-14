#!/usr/bin/env python3
"""Initialize the refactor pipeline state directory from a .prizmkit/plans/refactor-list.json file.

Validates the refactor list schema, sorts by priority/complexity, checks for
circular dependencies, and creates the state directory structure with pipeline
and per-refactor status files.

Usage:
    python3 init-refactor-pipeline.py --refactor-list <path> --state-dir <path>
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone

from utils import load_json_file


EXPECTED_SCHEMA = "dev-pipeline-refactor-list-v1"
REFACTOR_ID_PATTERN = re.compile(r"^R-\d{3}$")

REQUIRED_REFACTOR_FIELDS = [
    "id",
    "title",
    "description",
    "scope",
    "type",
    "priority",
    "complexity",
    "behavior_preservation",
    "acceptance_criteria",
    "dependencies",
    "status",
]

VALID_TYPES = ["extract", "rename", "restructure", "simplify", "decouple", "migrate"]
VALID_PRIORITIES = ["critical", "high", "medium", "low"]
VALID_COMPLEXITIES = ["low", "medium", "high"]
VALID_STATUSES = [
    "pending", "in_progress", "completed", "failed", "skipped", "auto_skipped",
]
TERMINAL_STATUSES = {"completed", "failed", "skipped", "auto_skipped"}
VALID_BEHAVIOR_STRATEGIES = ["test-gate", "snapshot", "manual"]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Initialize refactor pipeline state from a .prizmkit/plans/refactor-list.json file."
    )
    parser.add_argument(
        "--refactor-list",
        required=True,
        help="Path to the .prizmkit/plans/refactor-list.json file",
    )
    parser.add_argument(
        "--state-dir",
        required=True,
        help="Path to the state directory (default: .prizmkit/state/refactor)",
    )
    return parser.parse_args()


def load_refactor_list(path):
    """Load and return the parsed JSON from the refactor list file."""
    data, err = load_json_file(path)
    if err:
        return None, [err]
    return data, []


def validate_schema(data):
    """Validate the top-level schema and structure of the refactor list."""
    errors = []

    # Check $schema
    schema = data.get("$schema")
    if schema != EXPECTED_SCHEMA:
        errors.append(
            "Invalid $schema: expected '{}', got '{}'".format(EXPECTED_SCHEMA, schema)
        )

    # Check project_name
    if "project_name" not in data:
        errors.append("Missing required field: project_name")
    elif not isinstance(data["project_name"], str) or not data["project_name"].strip():
        errors.append("project_name must be a non-empty string")

    # Check refactors array
    if "refactors" not in data:
        errors.append("Missing required field: refactors")
    elif not isinstance(data["refactors"], list):
        errors.append("refactors must be an array")
    elif len(data["refactors"]) == 0:
        errors.append("refactors array must contain at least one refactor")

    return errors


def validate_refactors(refactors):
    """Validate each refactor object in the list."""
    errors = []
    seen_ids = set()

    for i, refactor in enumerate(refactors):
        if not isinstance(refactor, dict):
            errors.append("Refactor at index {} is not an object".format(i))
            continue

        # Check required fields
        for field in REQUIRED_REFACTOR_FIELDS:
            if field not in refactor:
                errors.append(
                    "Refactor at index {} missing required field: {}".format(i, field)
                )

        # Validate refactor ID format
        rid = refactor.get("id")
        if rid is not None:
            if not isinstance(rid, str) or not REFACTOR_ID_PATTERN.match(rid):
                errors.append(
                    "Refactor at index {} has invalid id '{}' "
                    "(must match R-NNN pattern)".format(i, rid)
                )
            elif rid in seen_ids:
                errors.append("Duplicate refactor id: {}".format(rid))
            else:
                seen_ids.add(rid)

        # Validate type
        rtype = refactor.get("type")
        if rtype is not None and rtype not in VALID_TYPES:
            errors.append(
                "Refactor '{}' has invalid type '{}' "
                "(must be one of {})".format(
                    rid or "index {}".format(i), rtype, VALID_TYPES
                )
            )

        # Validate priority
        priority = refactor.get("priority")
        if priority is not None and priority not in VALID_PRIORITIES:
            errors.append(
                "Refactor '{}' has invalid priority '{}' "
                "(must be one of {})".format(
                    rid or "index {}".format(i), priority, VALID_PRIORITIES
                )
            )

        # Validate complexity
        complexity = refactor.get("complexity")
        if complexity is not None and complexity not in VALID_COMPLEXITIES:
            errors.append(
                "Refactor '{}' has invalid complexity '{}' "
                "(must be one of {})".format(
                    rid or "index {}".format(i), complexity, VALID_COMPLEXITIES
                )
            )

        # Validate status
        status = refactor.get("status")
        if status is not None and status not in VALID_STATUSES:
            errors.append(
                "Refactor '{}' has invalid status '{}' "
                "(must be one of {})".format(
                    rid or "index {}".format(i), status, VALID_STATUSES
                )
            )

        # Validate scope is an object
        scope = refactor.get("scope")
        if scope is not None:
            if not isinstance(scope, dict):
                errors.append(
                    "Refactor '{}' scope must be an object".format(
                        rid or "index {}".format(i)
                    )
                )

        # Validate behavior_preservation
        bp = refactor.get("behavior_preservation")
        if bp is not None:
            if not isinstance(bp, dict):
                errors.append(
                    "Refactor '{}' behavior_preservation must be an object".format(
                        rid or "index {}".format(i)
                    )
                )
            else:
                strategy = bp.get("strategy")
                if strategy is not None and strategy not in VALID_BEHAVIOR_STRATEGIES:
                    errors.append(
                        "Refactor '{}' behavior_preservation.strategy '{}' "
                        "must be one of {}".format(
                            rid or "index {}".format(i), strategy, VALID_BEHAVIOR_STRATEGIES
                        )
                    )

        # Validate acceptance_criteria is a list
        ac = refactor.get("acceptance_criteria")
        if ac is not None and not isinstance(ac, list):
            errors.append(
                "Refactor '{}' acceptance_criteria must be an array".format(
                    rid or "index {}".format(i)
                )
            )

        # Validate dependencies is a list
        deps = refactor.get("dependencies")
        if deps is not None and not isinstance(deps, list):
            errors.append(
                "Refactor '{}' dependencies must be an array".format(
                    rid or "index {}".format(i)
                )
            )

    return errors, seen_ids


def check_circular_dependencies(refactors):
    """Check for circular dependencies among refactors. Returns list of error strings."""
    errors = []

    # Build adjacency map: id -> list of dependency ids
    dep_map = {}
    valid_ids = set()
    for refactor in refactors:
        if not isinstance(refactor, dict):
            continue
        rid = refactor.get("id")
        if not rid:
            continue
        valid_ids.add(rid)
        deps = refactor.get("dependencies", [])
        if isinstance(deps, list):
            dep_map[rid] = [d for d in deps if isinstance(d, str)]
        else:
            dep_map[rid] = []

    # Check that all dependency references point to valid IDs
    for rid, deps in dep_map.items():
        for dep_id in deps:
            if dep_id not in valid_ids:
                errors.append(
                    "Refactor '{}' depends on '{}' which does not exist".format(rid, dep_id)
                )

    # DFS cycle detection
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {rid: WHITE for rid in valid_ids}

    def dfs(node, path):
        color[node] = GRAY
        path.append(node)
        for neighbor in dep_map.get(node, []):
            if neighbor not in color:
                continue
            if color[neighbor] == GRAY:
                # Found a cycle
                cycle_start = path.index(neighbor)
                cycle = path[cycle_start:] + [neighbor]
                errors.append(
                    "Circular dependency detected: {}".format(" -> ".join(cycle))
                )
                return
            if color[neighbor] == WHITE:
                dfs(neighbor, path)
        path.pop()
        color[node] = BLACK

    for rid in valid_ids:
        if color[rid] == WHITE:
            dfs(rid, [])

    return errors


def create_state_directory(state_dir, refactor_list_path, refactors):
    """Create the state directory structure with pipeline.json and per-refactor status files."""
    abs_state_dir = os.path.abspath(state_dir)
    abs_refactor_list_path = os.path.abspath(refactor_list_path)
    # Store as relative path from state_dir so pipeline.json is portable across machines
    rel_refactor_list_path = os.path.relpath(abs_refactor_list_path, abs_state_dir)
    refactors_dir = os.path.join(abs_state_dir, "refactors")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    run_id = "refactor-run-" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

    # Create top-level state directory
    os.makedirs(abs_state_dir, exist_ok=True)
    os.makedirs(refactors_dir, exist_ok=True)

    # Count refactors already in terminal status at init time
    completed_count = sum(
        1 for r in refactors
        if isinstance(r, dict) and r.get("status") in TERMINAL_STATUSES
    )

    # Write pipeline.json
    pipeline_state = {
        "run_id": run_id,
        "pipeline_type": "refactor",
        "status": "initialized",
        "refactor_list_path": rel_refactor_list_path,
        "created_at": now,
        "total_refactors": len(refactors),
        "completed_refactors": completed_count,
    }
    pipeline_path = os.path.join(abs_state_dir, "pipeline.json")
    with open(pipeline_path, "w", encoding="utf-8") as f:
        json.dump(pipeline_state, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Write per-refactor status.json and create sessions directory
    for refactor in refactors:
        if not isinstance(refactor, dict):
            continue
        rid = refactor.get("id")
        if rid is None:
            continue

        refactor_dir = os.path.join(refactors_dir, rid)
        sessions_dir = os.path.join(refactor_dir, "sessions")
        os.makedirs(sessions_dir, exist_ok=True)

        refactor_status = {
            "refactor_id": rid,
            "retry_count": 0,
            "max_retries": 3,
            "sessions": [],
            "last_session_id": None,
            "resume_from_phase": None,
            "created_at": now,
            "updated_at": now,
        }
        status_path = os.path.join(refactor_dir, "status.json")
        with open(status_path, "w", encoding="utf-8") as f:
            json.dump(refactor_status, f, indent=2, ensure_ascii=False)
            f.write("\n")

    return abs_state_dir


def main():
    args = parse_args()

    # Load refactor list
    data, load_errors = load_refactor_list(args.refactor_list)
    if load_errors:
        output = {"valid": False, "errors": load_errors}
        print(json.dumps(output, indent=2, ensure_ascii=False))
        sys.exit(1)

    # Validate schema
    schema_errors = validate_schema(data)
    if schema_errors:
        output = {"valid": False, "errors": schema_errors}
        print(json.dumps(output, indent=2, ensure_ascii=False))
        sys.exit(1)

    # Validate refactors
    refactors = data["refactors"]
    refactor_errors, refactor_ids = validate_refactors(refactors)
    if refactor_errors:
        output = {"valid": False, "errors": refactor_errors}
        print(json.dumps(output, indent=2, ensure_ascii=False))
        sys.exit(1)

    # Check for circular dependencies
    dep_errors = check_circular_dependencies(refactors)
    if dep_errors:
        output = {"valid": False, "errors": dep_errors}
        print(json.dumps(output, indent=2, ensure_ascii=False))
        sys.exit(1)

    # Create state directory
    try:
        abs_state_dir = create_state_directory(
            args.state_dir, args.refactor_list, refactors
        )
    except (IOError, OSError) as e:
        output = {"valid": False, "errors": ["Failed to create state directory: {}".format(str(e))]}
        print(json.dumps(output, indent=2, ensure_ascii=False))
        sys.exit(1)

    # Success output
    output = {
        "valid": True,
        "refactors_count": len(refactors),
        "state_dir": abs_state_dir,
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
