#!/usr/bin/env python3
"""Detect stuck items in the dev-pipeline (features, bugs, or refactors).

Checks each item for conditions that indicate it is stuck:
  1. Max retries exceeded
  2. Same checkpoint for consecutive sessions
  3. Stale or missing heartbeat (for in_progress items)
  4. Dependency deadlock (depends on a failed item)

Outputs a JSON report to stdout and exits with code 1 if any stuck
items are found, 0 otherwise.

Usage:
    python3 detect-stuck.py --state-dir <path> --pipeline-type feature [--item-id <id>]
                            [--max-retries <n>] [--stale-threshold <seconds>]
                            [--task-list <path>]

    # Legacy feature-only args still supported:
    python3 detect-stuck.py --state-dir <path> [--feature-id <id>]
                            [--feature-list <path>]
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

from utils import error_out, setup_logging


LOGGER = setup_logging("detect-stuck")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Detect stuck items in the dev-pipeline."
    )
    parser.add_argument(
        "--state-dir",
        required=True,
        help="Path to the state directory (e.g. .prizmkit/state/features)",
    )
    parser.add_argument(
        "--pipeline-type",
        choices=["feature", "bugfix", "refactor"],
        default=None,
        help="Pipeline type (auto-detected from --feature-id/--bug-id/--refactor-id if omitted)",
    )
    parser.add_argument(
        "--item-id",
        default=None,
        help="Check a specific item ID, or check all if omitted",
    )
    # Legacy feature-only args (still supported for backward compat)
    parser.add_argument(
        "--feature-id",
        default=None,
        help="(Legacy) Feature ID — equivalent to --pipeline-type feature --item-id <id>",
    )
    parser.add_argument(
        "--bug-id",
        default=None,
        help="Bug ID — equivalent to --pipeline-type bugfix --item-id <id>",
    )
    parser.add_argument(
        "--refactor-id",
        default=None,
        help="Refactor ID — equivalent to --pipeline-type refactor --item-id <id>",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=3,
        help="Maximum allowed retries before an item is considered stuck (default: 3)",
    )
    parser.add_argument(
        "--stale-threshold",
        type=int,
        default=600,
        help="Heartbeat staleness threshold in seconds (default: 600)",
    )
    parser.add_argument(
        "--feature-list",
        default=None,
        help="(Legacy) Path to feature-list.json — use --task-list instead",
    )
    parser.add_argument(
        "--bug-list",
        default=None,
        help="Path to bug-fix-list.json",
    )
    parser.add_argument(
        "--refactor-list",
        default=None,
        help="Path to refactor-list.json",
    )
    parser.add_argument(
        "--task-list",
        default=None,
        help="Path to the task list JSON (feature-list, bug-fix-list, or refactor-list)",
    )
    return parser.parse_args()


def load_json(path):
    """Load and return parsed JSON from a file. Returns None on any error."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (IOError, OSError, json.JSONDecodeError, ValueError):
        return None


def discover_item_ids(state_dir, subdir):
    """Return a sorted list of item IDs found in state/{subdir}/."""
    items_dir = os.path.join(state_dir, subdir)
    if not os.path.isdir(items_dir):
        return []
    ids = []
    for name in os.listdir(items_dir):
        item_path = os.path.join(items_dir, name)
        if os.path.isdir(item_path):
            ids.append(name)
    return sorted(ids)


def get_session_statuses(item_dir):
    """Return session-status.json data for all sessions of an item, sorted by session ID.

    Returns a list of (session_id, data) tuples.
    """
    sessions_dir = os.path.join(item_dir, "sessions")
    if not os.path.isdir(sessions_dir):
        return []
    results = []
    for session_name in sorted(os.listdir(sessions_dir)):
        session_path = os.path.join(sessions_dir, session_name)
        if not os.path.isdir(session_path):
            continue
        status_path = os.path.join(session_path, "session-status.json")
        data = load_json(status_path)
        if data is not None:
            results.append((session_name, data))
    return results


def parse_iso_timestamp(ts_str):
    """Parse an ISO 8601 timestamp string to a datetime object.

    Handles formats with and without timezone info. Returns None on failure.
    """
    if not isinstance(ts_str, str):
        return None
    # Try parsing with timezone (Z suffix or +HH:MM offset)
    formats = [
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S+00:00",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%S.%f+00:00",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(ts_str, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    # Fallback: try stripping and replacing
    try:
        clean = ts_str.replace("Z", "+00:00")
        # Python 3.7+ fromisoformat
        if hasattr(datetime, "fromisoformat"):
            dt = datetime.fromisoformat(clean)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
    except (ValueError, AttributeError):
        pass
    return None


def check_max_retries(item_status, max_retries):
    """Check 1: Has the item exceeded the maximum retry count?

    Returns a stuck-report dict or None.
    """
    retry_count = item_status.get("retry_count", 0)
    if not isinstance(retry_count, int):
        return None
    if retry_count >= max_retries:
        return {
            "reason": "max_retries_exceeded",
            "details": "Retry count {} has reached or exceeded max retries {}".format(
                retry_count, max_retries
            ),
            "suggestion": "Investigate recurring failures and consider resetting the item or adjusting the approach",
        }
    return None


def check_stuck_checkpoint(item_dir):
    """Check 2: Is the item stuck at the same checkpoint for 3 consecutive sessions?

    Returns a stuck-report dict or None.
    """
    session_statuses = get_session_statuses(item_dir)
    if len(session_statuses) < 3:
        return None

    # Take the last 3 sessions
    last_three = session_statuses[-3:]
    checkpoints = []
    for _sid, data in last_three:
        cp = data.get("checkpoint_reached")
        checkpoints.append(cp)

    # All three must be non-None and identical
    if checkpoints[0] is not None and all(cp == checkpoints[0] for cp in checkpoints):
        return {
            "reason": "stuck_at_checkpoint",
            "details": "Stuck at {} for 3 consecutive sessions".format(checkpoints[0]),
            "suggestion": "Review plan.md generation - checkpoint {} validation is repeatedly failing".format(
                checkpoints[0]
            ),
        }
    return None


def check_stale_heartbeat(item_id, item_status, state_dir, items_subdir, stale_threshold, task_list_status=None):
    """Check 3: Is the heartbeat stale or missing for an in_progress item?

    Only applies to items whose status indicates active work.
    Status is read from task_list_status (task list JSON, single source of truth).
    Uses last_session_id from the item's own status.json to find the active session.

    Returns a stuck-report dict or None.
    """
    status = task_list_status
    # All pipelines now use "in_progress" as the active status
    in_progress_statuses = {"in_progress"}
    if status not in in_progress_statuses:
        return None

    # Use last_session_id from the item's own status
    session_id = item_status.get("last_session_id")
    if not session_id:
        return None

    # Check heartbeat file
    heartbeat_path = os.path.join(
        state_dir, items_subdir, item_id, "sessions", session_id, "heartbeat.json"
    )
    heartbeat = load_json(heartbeat_path)

    if heartbeat is None:
        return {
            "reason": "no_heartbeat",
            "details": "Item is {} but no heartbeat.json found for session {}".format(
                status, session_id
            ),
            "suggestion": "The agent session may have crashed without writing a heartbeat - check session logs",
        }

    # Parse heartbeat timestamp and check staleness
    ts_str = heartbeat.get("timestamp")
    heartbeat_time = parse_iso_timestamp(ts_str)
    if heartbeat_time is None:
        return {
            "reason": "stale_heartbeat",
            "details": "Heartbeat has invalid or unparseable timestamp: {}".format(ts_str),
            "suggestion": "Check the agent session - heartbeat timestamp is malformed",
        }

    now = datetime.now(timezone.utc)
    age_seconds = (now - heartbeat_time).total_seconds()
    if age_seconds > stale_threshold:
        return {
            "reason": "stale_heartbeat",
            "details": "Heartbeat is {:.0f}s old (threshold: {}s) for session {}".format(
                age_seconds, stale_threshold, session_id
            ),
            "suggestion": "The agent may be hung or crashed - consider terminating and retrying the session",
        }

    return None


def check_dependency_deadlock(item_id, task_list_data, state_dir, items_subdir, items_key):
    """Check 4: Does this item depend on a failed item?

    Reads dependency status from task list JSON (single source of truth).

    Returns a stuck-report dict or None.
    """
    if task_list_data is None:
        return None

    items = task_list_data.get(items_key, [])
    if not isinstance(items, list):
        return None

    # Build status map from task list
    status_map = {}
    for item in items:
        if isinstance(item, dict) and item.get("id"):
            status_map[item["id"]] = item.get("status", "pending")

    # Find this item in the list to get its dependencies
    deps = None
    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get("id") == item_id:
            deps = item.get("dependencies", [])
            break

    if not deps or not isinstance(deps, list):
        return None

    # Check each dependency's status from the task list
    for dep_id in deps:
        dep_state = status_map.get(dep_id)
        if dep_state == "failed":
            return {
                "reason": "dependency_failed",
                "details": "Depends on {} which has status 'failed'".format(dep_id),
                "suggestion": "Fix or skip {} to unblock {}".format(dep_id, item_id),
            }

    return None


def find_task_list(state_dir):
    """Attempt to locate and load the task list JSON via pipeline.json reference.

    Resolves the list path relative to state_dir when it is a relative path,
    so that pipeline.json is portable across machines and directory structures.
    """
    pipeline_path = os.path.join(state_dir, "pipeline.json")
    pipeline = load_json(pipeline_path)
    if pipeline is None:
        return None

    # Try various path keys used by different pipeline types
    fl_path = (
        pipeline.get("feature_list_path")
        or pipeline.get("bug_list_path")
        or pipeline.get("refactor_list_path")
    )
    if not fl_path:
        return None

    # Resolve relative paths relative to state_dir (not process cwd)
    if not os.path.isabs(fl_path):
        fl_path = os.path.join(state_dir, fl_path)

    fl_path = os.path.normpath(fl_path)
    if os.path.isfile(fl_path):
        return load_json(fl_path)

    return None


# Pipeline type configurations
PIPELINE_CONFIG = {
    "feature": {"subdir": "features", "items_key": "features", "id_label": "feature_id"},
    "bugfix": {"subdir": "bugs", "items_key": "bugs", "id_label": "bug_id"},
    "refactor": {"subdir": "refactors", "items_key": "refactors", "id_label": "refactor_id"},
}


def check_item(item_id, state_dir, items_subdir, items_key, task_list_data, max_retries, stale_threshold):
    """Run all stuck-detection checks on a single item.

    Returns a list of stuck-report dicts (may be empty if item is not stuck).
    """
    item_dir = os.path.join(state_dir, items_subdir, item_id)
    status_path = os.path.join(item_dir, "status.json")
    item_status = load_json(status_path)

    if item_status is None:
        # Create a minimal runtime dict so checks can proceed
        item_status = {}

    # Look up item status from task list (single source of truth)
    task_list_status = None
    if task_list_data:
        for item in task_list_data.get(items_key, []):
            if isinstance(item, dict) and item.get("id") == item_id:
                task_list_status = item.get("status", "pending")
                break

    reports = []

    # Check 1: Max retries exceeded
    result = check_max_retries(item_status, max_retries)
    if result is not None:
        reports.append(result)

    # Check 2: Stuck at same checkpoint
    result = check_stuck_checkpoint(item_dir)
    if result is not None:
        reports.append(result)

    # Check 3: Stale heartbeat
    result = check_stale_heartbeat(item_id, item_status, state_dir, items_subdir, stale_threshold, task_list_status)
    if result is not None:
        reports.append(result)

    # Check 4: Dependency deadlock
    result = check_dependency_deadlock(item_id, task_list_data, state_dir, items_subdir, items_key)
    if result is not None:
        reports.append(result)

    return reports


def resolve_pipeline_type(args):
    """Resolve pipeline type, item ID, and task list path from args.

    Supports both new generic args and legacy feature-only args.
    Returns (pipeline_type, item_id, task_list_path).
    """
    # Explicit --pipeline-type takes precedence
    if args.pipeline_type:
        ptype = args.pipeline_type
        item_id = args.item_id
        task_list = args.task_list
    # Legacy / shorthand: --feature-id, --bug-id, --refactor-id
    elif args.feature_id:
        ptype = "feature"
        item_id = args.feature_id
        task_list = args.feature_list or args.task_list
    elif args.bug_id:
        ptype = "bugfix"
        item_id = args.bug_id
        task_list = args.bug_list or args.task_list
    elif args.refactor_id:
        ptype = "refactor"
        item_id = args.refactor_id
        task_list = args.refactor_list or args.task_list
    # Legacy: --feature-list without --feature-id means check all features
    elif args.feature_list:
        ptype = "feature"
        item_id = None
        task_list = args.feature_list
    elif args.bug_list:
        ptype = "bugfix"
        item_id = None
        task_list = args.bug_list
    elif args.refactor_list:
        ptype = "refactor"
        item_id = None
        task_list = args.refactor_list
    else:
        # Default to feature for backward compat
        ptype = "feature"
        item_id = None
        task_list = args.task_list

    return ptype, item_id, task_list


def main():
    args = parse_args()
    state_dir = os.path.abspath(args.state_dir)

    if not os.path.isdir(state_dir):
        error_out("State directory not found: {}".format(state_dir), code=2)

    # Resolve pipeline type and parameters
    ptype, item_id, task_list_path = resolve_pipeline_type(args)
    config = PIPELINE_CONFIG[ptype]
    items_subdir = config["subdir"]
    items_key = config["items_key"]
    id_label = config["id_label"]

    # Determine which items to check
    if item_id:
        item_ids = [item_id]
    else:
        item_ids = discover_item_ids(state_dir, items_subdir)

    # Load task list for dependency checks
    if task_list_path:
        task_list_data = load_json(os.path.abspath(task_list_path))
    else:
        task_list_data = find_task_list(state_dir)

    stuck_items = []
    for iid in item_ids:
        reports = check_item(
            iid, state_dir, items_subdir, items_key,
            task_list_data, args.max_retries, args.stale_threshold
        )
        for report in reports:
            stuck_items.append(
                {
                    id_label: iid,
                    "reason": report["reason"],
                    "details": report["details"],
                    "suggestion": report["suggestion"],
                }
            )

    output = {
        "pipeline_type": ptype,
        "stuck_items": stuck_items,
        "total_checked": len(item_ids),
        "stuck_count": len(stuck_items),
    }

    print(json.dumps(output, indent=2, ensure_ascii=False))

    if stuck_items:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        error_out("detect-stuck interrupted", code=130)
    except SystemExit:
        raise
    except Exception as exc:
        LOGGER.exception("Unhandled exception in detect-stuck")
        error_out("detect-stuck failed: {}".format(str(exc)), code=1)
