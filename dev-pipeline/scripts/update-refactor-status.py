#!/usr/bin/env python3
"""Core state machine for updating refactor status in the refactor pipeline.

Handles eight actions:
  - get_next: Find the next refactor to process based on dependency order, priority, complexity
  - start: Mark a refactor as in_progress when a session starts
  - update: Update a refactor's status based on session outcome
  - status: Print a formatted overview of all refactors
  - pause: Save pipeline state for graceful shutdown
  - reset: Reset a refactor to pending (status + retry count)
  - clean: Reset + delete session history + delete refactor artifacts
  - unskip: Reset skipped refactors and their downstream dependents back to pending

Usage:
    python3 update-refactor-status.py \
        --refactor-list <path> --state-dir <path> \
        --action <get_next|start|update|status|pause|reset|clean|unskip> \
        [--refactor-id <id>] [--session-status <status>] \
        [--session-id <id>] [--max-retries <n>]
"""

import argparse
import json
import os
import shutil
import sys
from datetime import datetime, timezone

from utils import (
    load_json_file,
    write_json_file,
    error_out,
    pad_right,
    _build_progress_bar,
)


SESSION_STATUS_VALUES = [
    "success",
    "partial_resumable",
    "partial_not_resumable",
    "failed",
    "crashed",
    "timed_out",
    "commit_missing",
    "docs_missing",
    "merge_conflict",
]

TERMINAL_STATUSES = {"completed", "failed", "skipped", "auto_skipped"}

# Artifact directory names (relative to project root)
REFACTOR_ARTIFACTS_REL = os.path.join(".prizmkit", "refactor")
DEV_TEAM_DIR_NAME = ".dev-team"

# Priority ordering (lower number = higher priority)
PRIORITY_ORDER = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
}

# Complexity ordering (lower number = simpler, processed first)
COMPLEXITY_ORDER = {
    "low": 0,
    "medium": 1,
    "high": 2,
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Core state machine for refactor pipeline status management."
    )
    parser.add_argument("--refactor-list", required=True, help="Path to the .prizmkit/plans/refactor-list.json file")
    parser.add_argument("--state-dir", required=True, help="Path to the state directory (default: .prizmkit/state/refactor)")
    parser.add_argument(
        "--action", required=True,
        choices=["get_next", "start", "update", "status", "pause", "reset", "clean", "unskip", "complete"],
        help="Action to perform",
    )
    parser.add_argument("--refactor-id", default=None, help="Refactor ID (required for 'update'/'reset'/'clean' actions)")
    parser.add_argument(
        "--session-status", default=None, choices=SESSION_STATUS_VALUES,
        help="Session outcome status (required for 'update' action)",
    )
    parser.add_argument("--session-id", default=None, help="Session ID (optional, for 'update' action)")
    parser.add_argument("--max-retries", type=int, default=3, help="Maximum retry count (default: 3)")
    parser.add_argument("--project-root", default=None, help="Project root directory. Required for 'clean' action.")
    return parser.parse_args()


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _default_status(refactor_id):
    """Create a default refactor runtime status object (no status field)."""
    now = now_iso()
    return {
        "refactor_id": refactor_id,
        "retry_count": 0,
        "max_retries": 3,
        "sessions": [],
        "last_session_id": None,
        "resume_from_phase": None,
        "created_at": now,
        "updated_at": now,
    }


def load_refactor_status(state_dir, refactor_id):
    """Load runtime state from status.json for a refactor.

    Returns runtime fields only (retry_count, sessions, etc.).
    The 'status' field is NOT included — status lives exclusively
    in refactor-list.json.
    """
    status_path = os.path.join(state_dir, "refactors", refactor_id, "status.json")
    if not os.path.isfile(status_path):
        return _default_status(refactor_id)
    data, err = load_json_file(status_path)
    if err:
        return _default_status(refactor_id)
    # Defensively remove status if present (legacy data)
    data.pop("status", None)
    return data


def save_refactor_status(state_dir, refactor_id, status_data):
    """Write the status.json for a refactor (runtime fields only)."""
    # Defensively strip status — it belongs in refactor-list.json
    status_data.pop("status", None)
    status_path = os.path.join(state_dir, "refactors", refactor_id, "status.json")
    return write_json_file(status_path, status_data)


def get_refactor_status_from_list(refactor_list_path, refactor_id):
    """Read a single refactor's status from refactor-list.json."""
    data, err = load_json_file(refactor_list_path)
    if err:
        return "pending"
    for r in data.get("refactors", []):
        if isinstance(r, dict) and r.get("id") == refactor_id:
            return r.get("status", "pending")
    return "pending"


def update_refactor_in_list(refactor_list_path, refactor_id, new_status):
    data, err = load_json_file(refactor_list_path)
    if err:
        return err
    refactors = data.get("refactors", [])
    found = False
    for refactor in refactors:
        if isinstance(refactor, dict) and refactor.get("id") == refactor_id:
            refactor["status"] = new_status
            found = True
            break
    if not found:
        return "Refactor '{}' not found in .prizmkit/plans/refactor-list.json".format(refactor_id)
    return write_json_file(refactor_list_path, data)


# ---------------------------------------------------------------------------
# Action: get_next
# ---------------------------------------------------------------------------


def _dependencies_met(refactor, completed_set):
    """Check if all dependencies for a refactor are in terminal (completed) status."""
    deps = refactor.get("dependencies", [])
    if not deps or not isinstance(deps, list):
        return True
    return all(dep in completed_set for dep in deps)


def _count_unmet_deps(refactor, completed_set):
    """Count how many dependencies are not yet completed."""
    deps = refactor.get("dependencies", [])
    if not deps or not isinstance(deps, list):
        return 0
    return sum(1 for dep in deps if dep not in completed_set)


def action_get_next(refactor_list_data, state_dir):
    """Find the next refactor to process.

    Priority logic:
    1. Skip terminal statuses (completed, failed, skipped)
    2. Only consider refactors whose dependencies are all completed
    3. Prefer in_progress refactors (interrupted session resume) over pending
    4. Sort by: dependency order (no-dependency items first),
       then priority (critical > high > medium > low),
       then complexity (low first)
    """
    refactors = refactor_list_data.get("refactors", [])
    if not refactors:
        print("PIPELINE_COMPLETE")
        return

    # Build status map from refactor-list.json (single source of truth)
    status_map = {}
    status_data_map = {}
    for r in refactors:
        if not isinstance(r, dict):
            continue
        rid = r.get("id")
        if not rid:
            continue
        status_map[rid] = r.get("status", "pending")
        rs = load_refactor_status(state_dir, rid)
        status_data_map[rid] = rs

    completed_set = {rid for rid, st in status_map.items() if st in TERMINAL_STATUSES}

    # Check if all refactors are terminal
    non_terminal = [
        r for r in refactors
        if isinstance(r, dict) and r.get("id")
        and status_map.get(r["id"], "pending") not in TERMINAL_STATUSES
    ]
    if not non_terminal:
        print("PIPELINE_COMPLETE")
        return

    # Filter to only those with met dependencies
    eligible = [r for r in non_terminal if _dependencies_met(r, completed_set)]
    if not eligible:
        print("PIPELINE_BLOCKED")
        return

    # Separate in_progress from pending
    in_progress_refactors = []
    pending_refactors = []
    for r in eligible:
        rid = r.get("id")
        rstatus = status_map.get(rid, "pending")
        if rstatus == "in_progress":
            in_progress_refactors.append(r)
        elif rstatus == "pending":
            pending_refactors.append(r)

    def sort_key(r):
        unmet = _count_unmet_deps(r, completed_set)
        priority = PRIORITY_ORDER.get(r.get("priority", "medium"), 2)
        complexity = COMPLEXITY_ORDER.get(r.get("complexity", "medium"), 1)
        return (unmet, priority, complexity)

    if in_progress_refactors:
        candidates = sorted(in_progress_refactors, key=sort_key)
    elif pending_refactors:
        candidates = sorted(pending_refactors, key=sort_key)
    else:
        print("PIPELINE_BLOCKED")
        return

    chosen = candidates[0]
    chosen_id = chosen["id"]
    chosen_status_data = status_data_map.get(chosen_id, {})

    result = {
        "refactor_id": chosen_id,
        "title": chosen.get("title", ""),
        "type": chosen.get("type", "restructure"),
        "priority": chosen.get("priority", "medium"),
        "complexity": chosen.get("complexity", "medium"),
        "retry_count": chosen_status_data.get("retry_count", 0),
        "resume_from_phase": chosen_status_data.get("resume_from_phase", None),
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: update
# ---------------------------------------------------------------------------

def action_update(args, refactor_list_path, state_dir):
    refactor_id = args.refactor_id
    session_status = args.session_status
    session_id = args.session_id
    max_retries = args.max_retries

    if not refactor_id:
        error_out("--refactor-id is required for 'update' action")
        return
    if not session_status:
        error_out("--session-status is required for 'update' action")
        return

    rs = load_refactor_status(state_dir, refactor_id)

    # Track what status we write to refactor-list.json
    new_status = get_refactor_status_from_list(refactor_list_path, refactor_id)

    if session_status == "success":
        new_status = "completed"
        rs["resume_from_phase"] = None
        err = update_refactor_in_list(refactor_list_path, refactor_id, "completed")
        if err:
            error_out("Failed to update .prizmkit/plans/refactor-list.json: {}".format(err))
            return
    elif session_status in ("commit_missing", "docs_missing", "merge_conflict"):
        rs["retry_count"] = rs.get("retry_count", 0) + 1

        if rs["retry_count"] >= max_retries:
            new_status = "failed"
        else:
            new_status = "pending"

        rs["degraded_reason"] = session_status
        rs["resume_from_phase"] = None
        rs["sessions"] = []
        rs["last_session_id"] = None

        err = update_refactor_in_list(refactor_list_path, refactor_id, new_status)
        if err:
            error_out("Failed to update .prizmkit/plans/refactor-list.json: {}".format(err))
            return
    else:
        rs["retry_count"] = rs.get("retry_count", 0) + 1

        cleaned = cleanup_refactor_artifacts(
            state_dir=state_dir,
            refactor_id=refactor_id,
            project_root=args.project_root,
        )

        if rs["retry_count"] >= max_retries:
            new_status = "failed"
        else:
            new_status = "pending"

        rs["resume_from_phase"] = None
        rs["sessions"] = []
        rs["last_session_id"] = None

        err = update_refactor_in_list(refactor_list_path, refactor_id, new_status)
        if err:
            error_out("Failed to update .prizmkit/plans/refactor-list.json: {}".format(err))
            return

    if session_status == "success" and session_id:
        sessions = rs.get("sessions", [])
        if session_id not in sessions:
            sessions.append(session_id)
        rs["sessions"] = sessions
        rs["last_session_id"] = session_id

    rs["updated_at"] = now_iso()

    err = save_refactor_status(state_dir, refactor_id, rs)
    if err:
        error_out("Failed to save refactor status: {}".format(err))
        return

    # Auto-skip downstream refactors when this refactor is marked as failed or skipped
    auto_skipped_refactors = []
    if new_status in ("failed", "skipped"):
        auto_skipped_refactors = auto_skip_blocked_refactors(
            refactor_list_path, state_dir, refactor_id
        )

    summary = {
        "action": "update",
        "refactor_id": refactor_id,
        "session_status": session_status,
        "new_status": new_status,
        "retry_count": rs["retry_count"],
        "resume_from_phase": rs.get("resume_from_phase"),
        "updated_at": rs["updated_at"],
    }
    if auto_skipped_refactors:
        summary["auto_skipped"] = [info["refactor_id"] for info in auto_skipped_refactors]
    if session_status in ("commit_missing", "docs_missing", "merge_conflict"):
        summary["degraded_reason"] = session_status
        summary["restart_policy"] = "finalization_retry"
    elif session_status != "success":
        summary["restart_policy"] = "full_restart"
        summary["cleanup_performed"] = cleaned

    print(json.dumps(summary, indent=2, ensure_ascii=False))


def _default_project_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def cleanup_refactor_artifacts(state_dir, refactor_id, project_root=None):
    """Delete intermediate artifacts for a failed refactor run."""
    if not project_root:
        project_root = _default_project_root()

    cleaned = []

    # 1) Remove all session history
    sessions_dir = os.path.join(state_dir, "refactors", refactor_id, "sessions")
    sessions_deleted = 0
    if os.path.isdir(sessions_dir):
        for entry in os.listdir(sessions_dir):
            entry_path = os.path.join(sessions_dir, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
                sessions_deleted += 1
        cleaned.append("Deleted {} session(s) from {}".format(sessions_deleted, sessions_dir))

    # 2) Remove transient files under refactor dir (keep status.json)
    refactor_dir = os.path.join(state_dir, "refactors", refactor_id)
    if os.path.isdir(refactor_dir):
        for entry in os.listdir(refactor_dir):
            if entry == "status.json" or entry == "sessions":
                continue
            entry_path = os.path.join(refactor_dir, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
                cleaned.append("Deleted directory {}".format(entry_path))
            elif os.path.isfile(entry_path):
                os.remove(entry_path)
                cleaned.append("Deleted file {}".format(entry_path))

    # 3) Remove refactor artifacts
    refactor_artifact_dir = os.path.join(project_root, REFACTOR_ARTIFACTS_REL, refactor_id)
    if os.path.isdir(refactor_artifact_dir):
        shutil.rmtree(refactor_artifact_dir)
        cleaned.append("Deleted {}".format(refactor_artifact_dir))

    # 4) Remove shared dev-team workspace
    dev_team_dir = os.path.join(project_root, DEV_TEAM_DIR_NAME)
    if os.path.isdir(dev_team_dir):
        shutil.rmtree(dev_team_dir)
        cleaned.append("Deleted {}".format(dev_team_dir))

    return cleaned


def load_session_status(state_dir, refactor_id, session_id):
    session_status_path = os.path.join(
        state_dir, "refactors", refactor_id, "sessions",
        session_id, "session-status.json"
    )
    data, err = load_json_file(session_status_path)
    if err:
        return None, err
    return data, None


# ---------------------------------------------------------------------------
# Auto-skip: cascade failure to blocked downstream refactors
# ---------------------------------------------------------------------------

def auto_skip_blocked_refactors(refactor_list_path, state_dir, failed_refactor_id):
    """Recursively mark all downstream refactors blocked by a failed refactor as auto_skipped.

    When a refactor is marked as failed, any refactor whose dependency chain includes
    the failed refactor can never be executed. This function propagates the failure
    by marking those blocked refactors as auto_skipped, allowing the pipeline to
    continue processing unblocked refactors and eventually reach PIPELINE_COMPLETE.

    Re-reads .prizmkit/plans/refactor-list.json from disk to get the latest state (including the
    just-written failed status from update_refactor_in_list).

    NOTE: This function performs a read-modify-write on .prizmkit/plans/refactor-list.json without
    file locking. The caller (action_update) also writes to .prizmkit/plans/refactor-list.json
    immediately before calling this. Safe for single-pipeline execution, but if
    multiple pipeline instances share the same .prizmkit/plans/refactor-list.json concurrently,
    a race condition may cause lost writes. Add file locking if parallel pipelines
    are introduced.
    """
    data, err = load_json_file(refactor_list_path)
    if err:
        return []
    refactors = data.get("refactors", [])

    # Build current status map
    status_map = {}
    for r in refactors:
        if isinstance(r, dict) and r.get("id"):
            status_map[r["id"]] = r.get("status", "pending")

    # Collect all refactors to auto-skip (recursive propagation)
    to_skip = set()
    changed = True
    while changed:
        changed = False
        for r in refactors:
            if not isinstance(r, dict):
                continue
            rid = r.get("id")
            if not rid or rid in to_skip:
                continue
            current = status_map.get(rid, "pending")
            if current in TERMINAL_STATUSES:
                continue
            deps = r.get("dependencies", [])
            for dep_id in deps:
                dep_status = status_map.get(dep_id, "pending")
                if dep_status in ("failed", "skipped", "auto_skipped") or dep_id in to_skip:
                    to_skip.add(rid)
                    status_map[rid] = "auto_skipped"
                    changed = True
                    break

    if not to_skip:
        return []

    # Batch-write to .prizmkit/plans/refactor-list.json
    for r in refactors:
        if isinstance(r, dict) and r.get("id") in to_skip:
            r["status"] = "auto_skipped"
    write_json_file(refactor_list_path, data)

    # Update timestamps in status.json for each auto-skipped refactor
    for rid in to_skip:
        rs = load_refactor_status(state_dir, rid)
        rs["updated_at"] = now_iso()
        save_refactor_status(state_dir, rid, rs)

    # Build blocking reason map for logging
    skipped_info = []
    for r in refactors:
        if not isinstance(r, dict):
            continue
        rid = r.get("id")
        if rid not in to_skip:
            continue
        deps = r.get("dependencies", [])
        blockers = [
            d for d in deps
            if d == failed_refactor_id or d in to_skip
        ]
        skipped_info.append({
            "refactor_id": rid,
            "title": r.get("title", ""),
            "blocked_by": blockers,
        })

    print(
        "[auto-skip] {} refactor(s) auto-skipped due to failed {}:".format(
            len(skipped_info), failed_refactor_id
        ),
        file=sys.stderr,
    )
    for info in skipped_info:
        print(
            "  {} ({}) — blocked by {}".format(
                info["refactor_id"],
                info["title"],
                ", ".join(info["blocked_by"]),
            ),
            file=sys.stderr,
        )

    return skipped_info


# ---------------------------------------------------------------------------
# Action: status
# ---------------------------------------------------------------------------

COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_RED = "\033[91m"
COLOR_GRAY = "\033[90m"
COLOR_MAGENTA = "\033[95m"
COLOR_CYAN = "\033[96m"
COLOR_BOLD = "\033[1m"
COLOR_RESET = "\033[0m"

BOX_WIDTH = 72

TYPE_ICONS = {
    "extract": "📦",
    "rename": "🏷️",
    "restructure": "🏗️",
    "simplify": "✂️",
    "decouple": "🔗",
    "migrate": "🚀",
}

COMPLEXITY_BADGES = {
    "low": COLOR_GREEN + "[LOW]" + COLOR_RESET,
    "medium": COLOR_YELLOW + "[MED]" + COLOR_RESET,
    "high": COLOR_RED + "[HI]" + COLOR_RESET,
}


def action_status(refactor_list_data, state_dir):
    refactors = refactor_list_data.get("refactors", [])
    project_name = refactor_list_data.get("project_name", "Unknown")

    counts = {"completed": 0, "in_progress": 0, "failed": 0, "pending": 0, "skipped": 0, "auto_skipped": 0}
    refactor_lines = []

    for r in refactors:
        if not isinstance(r, dict):
            continue
        rid = r.get("id")
        title = r.get("title", "Untitled")
        rtype = r.get("type", "restructure")
        complexity = r.get("complexity", "medium")
        if not rid:
            continue

        rstatus = r.get("status", "pending")
        rs = load_refactor_status(state_dir, rid)
        retry_count = rs.get("retry_count", 0)
        max_retries_val = rs.get("max_retries", 3)
        resume_phase = rs.get("resume_from_phase")

        if rstatus in counts:
            counts[rstatus] += 1
        else:
            counts["pending"] += 1

        # Status icon
        if rstatus == "completed":
            icon = COLOR_GREEN + "[✓]" + COLOR_RESET
        elif rstatus == "in_progress":
            icon = COLOR_YELLOW + "[→]" + COLOR_RESET
        elif rstatus == "failed":
            icon = COLOR_RED + "[✗]" + COLOR_RESET
        elif rstatus == "skipped":
            icon = COLOR_GRAY + "[—]" + COLOR_RESET
        elif rstatus == "auto_skipped":
            icon = COLOR_GRAY + "[⊘]" + COLOR_RESET
        else:
            icon = COLOR_GRAY + "[ ]" + COLOR_RESET

        # Type badge
        type_icon = TYPE_ICONS.get(rtype, "🔧")
        type_badge = "[{}]".format(rtype[:6].upper())

        # Complexity badge
        cmplx_badge = COMPLEXITY_BADGES.get(complexity, "[MED]")

        # Detail
        detail = ""
        if rstatus == "in_progress":
            parts = []
            if retry_count > 0:
                parts.append("retry {}/{}".format(retry_count, max_retries_val))
            if resume_phase is not None:
                parts.append("CP-RF-{}".format(resume_phase))
            if parts:
                detail = " ({})".format(", ".join(parts))
        elif rstatus == "failed":
            detail = " (failed after {} retries)".format(retry_count)

        # Colorize title based on status
        if rstatus == "completed":
            colored_title = COLOR_GREEN + title + COLOR_RESET
        elif rstatus == "in_progress":
            colored_title = COLOR_YELLOW + title + COLOR_RESET
        elif rstatus == "failed":
            colored_title = COLOR_RED + title + COLOR_RESET
        else:
            colored_title = COLOR_GRAY + title + COLOR_RESET

        line_content = "{} {} {} {} {} {} {}{}".format(
            rid, icon, type_badge, cmplx_badge, type_icon, colored_title, "", detail
        )

        refactor_lines.append(line_content)

    total = len(refactors)
    completed = counts["completed"]
    percent = round(completed / total * 100, 1) if total > 0 else 0.0
    progress_bar = _build_progress_bar(percent, width=24)

    summary_line = "Total: {} refactors | Completed: {} | In Progress: {}".format(
        total, completed, counts["in_progress"]
    )
    summary_line2 = "Failed: {} | Pending: {} | Skipped: {} | Auto-skipped: {}".format(
        counts["failed"], counts["pending"], counts["skipped"], counts["auto_skipped"]
    )

    inner = BOX_WIDTH - 2
    print("╔" + "═" * BOX_WIDTH + "╗")
    print("║" + pad_right(COLOR_BOLD + "  Refactor Pipeline Status" + COLOR_RESET, inner) + " ║")
    print("╠" + "═" * BOX_WIDTH + "╣")
    print("║" + pad_right("  Project: {}".format(project_name), inner) + " ║")
    print("║" + pad_right("  {}".format(summary_line), inner) + " ║")
    print("║" + pad_right("  {}".format(summary_line2), inner) + " ║")
    print("╠" + "─" * BOX_WIDTH + "╣")
    print("║" + pad_right("  Progress: {}".format(progress_bar), inner) + " ║")
    print("╠" + "═" * BOX_WIDTH + "╣")
    for line in refactor_lines:
        print("║" + pad_right("  {}".format(line), inner) + " ║")
    print("╚" + "═" * BOX_WIDTH + "╝")


# ---------------------------------------------------------------------------
# Action: reset
# ---------------------------------------------------------------------------

def action_reset(args, refactor_list_path, state_dir):
    refactor_id = args.refactor_id
    if not refactor_id:
        error_out("--refactor-id is required for 'reset' action")
        return

    rs = load_refactor_status(state_dir, refactor_id)
    old_status = get_refactor_status_from_list(refactor_list_path, refactor_id)
    old_retry = rs.get("retry_count", 0)

    rs["retry_count"] = 0
    rs["sessions"] = []
    rs["last_session_id"] = None
    rs["resume_from_phase"] = None
    rs["updated_at"] = now_iso()

    err = save_refactor_status(state_dir, refactor_id, rs)
    if err:
        error_out("Failed to save refactor status: {}".format(err))
        return

    err = update_refactor_in_list(refactor_list_path, refactor_id, "pending")
    if err:
        error_out("Failed to update .prizmkit/plans/refactor-list.json: {}".format(err))
        return

    result = {
        "action": "reset",
        "refactor_id": refactor_id,
        "old_status": old_status,
        "old_retry_count": old_retry,
        "new_status": "pending",
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: clean
# ---------------------------------------------------------------------------

def action_clean(args, refactor_list_path, state_dir):
    refactor_id = args.refactor_id
    project_root = args.project_root

    if not refactor_id:
        error_out("--refactor-id is required for 'clean' action")
        return
    if not project_root:
        error_out("--project-root is required for 'clean' action")
        return

    cleaned = []

    # 1. Delete session history
    sessions_dir = os.path.join(state_dir, "refactors", refactor_id, "sessions")
    sessions_deleted = 0
    if os.path.isdir(sessions_dir):
        for entry in os.listdir(sessions_dir):
            entry_path = os.path.join(sessions_dir, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
                sessions_deleted += 1
        cleaned.append("Deleted {} session(s) from {}".format(sessions_deleted, sessions_dir))

    # 2. Delete refactor artifacts for this refactor
    refactor_artifact_dir = os.path.join(project_root, REFACTOR_ARTIFACTS_REL, refactor_id)
    if os.path.isdir(refactor_artifact_dir):
        shutil.rmtree(refactor_artifact_dir)
        cleaned.append("Deleted {}".format(refactor_artifact_dir))

    # 3. Delete shared dev-team workspace
    dev_team_dir = os.path.join(project_root, DEV_TEAM_DIR_NAME)
    if os.path.isdir(dev_team_dir):
        shutil.rmtree(dev_team_dir)
        cleaned.append("Deleted {}".format(dev_team_dir))

    # 4. Reset status
    rs = load_refactor_status(state_dir, refactor_id)
    old_status = get_refactor_status_from_list(refactor_list_path, refactor_id)
    old_retry = rs.get("retry_count", 0)

    rs["retry_count"] = 0
    rs["sessions"] = []
    rs["last_session_id"] = None
    rs["resume_from_phase"] = None
    rs["updated_at"] = now_iso()

    err = save_refactor_status(state_dir, refactor_id, rs)
    if err:
        error_out("Failed to save refactor status: {}".format(err))
        return

    err = update_refactor_in_list(refactor_list_path, refactor_id, "pending")
    if err:
        error_out("Failed to update .prizmkit/plans/refactor-list.json: {}".format(err))
        return

    result = {
        "action": "clean",
        "refactor_id": refactor_id,
        "old_status": old_status,
        "old_retry_count": old_retry,
        "new_status": "pending",
        "sessions_deleted": sessions_deleted,
        "cleaned": cleaned,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: pause
# ---------------------------------------------------------------------------

def action_pause(state_dir):
    pipeline_path = os.path.join(state_dir, "pipeline.json")
    data, err = load_json_file(pipeline_path)
    if err:
        data = {"status": "paused", "paused_at": now_iso()}
    else:
        data["status"] = "paused"
        data["paused_at"] = now_iso()

    err = write_json_file(pipeline_path, data)
    if err:
        error_out("Failed to write pipeline.json: {}".format(err))
        return

    result = {
        "action": "pause",
        "status": "paused",
        "paused_at": data["paused_at"],
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: start
# ---------------------------------------------------------------------------

def action_start(args, refactor_list_path, state_dir):
    """Mark a refactor as in_progress when a session starts.

    This keeps refactor-list.json/state status in sync during execution,
    instead of only updating after session end.
    """
    refactor_id = args.refactor_id
    if not refactor_id:
        error_out("--refactor-id is required for 'start' action")
        return

    rs = load_refactor_status(state_dir, refactor_id)
    old_status = get_refactor_status_from_list(refactor_list_path, refactor_id)

    rs["updated_at"] = now_iso()

    err = save_refactor_status(state_dir, refactor_id, rs)
    if err:
        error_out("Failed to save refactor status: {}".format(err))
        return

    err = update_refactor_in_list(refactor_list_path, refactor_id, "in_progress")
    if err:
        error_out("Failed to update .prizmkit/plans/refactor-list.json: {}".format(err))
        return

    result = {
        "action": "start",
        "refactor_id": refactor_id,
        "old_status": old_status,
        "new_status": "in_progress",
        "updated_at": rs["updated_at"],
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: unskip
# ---------------------------------------------------------------------------

def action_unskip(args, refactor_list_path, state_dir):
    """Recover skipped/auto_skipped/failed refactors by resetting them and their failed upstream.

    Two modes:
    - --refactor-id R-001: Reset the specified failed/skipped/auto_skipped refactor + all
      downstream auto_skipped refactors whose dependency chain includes it.
      If the target is auto_skipped, also walk upstream to find and reset the
      failed/skipped ancestor that caused the cascade.
    - No --refactor-id: Reset ALL failed, skipped, and auto_skipped refactors to pending.
    """
    refactor_id = args.refactor_id

    data, err = load_json_file(refactor_list_path)
    if err:
        error_out("Cannot load refactor list: {}".format(err))
        return
    refactors = data.get("refactors", [])

    to_reset = set()

    if refactor_id:
        # Find the target refactor
        target = None
        for r in refactors:
            if isinstance(r, dict) and r.get("id") == refactor_id:
                target = r
                break
        if not target:
            error_out("Refactor '{}' not found in .prizmkit/plans/refactor-list.json".format(refactor_id))
            return
        if target.get("status") not in ("failed", "skipped", "auto_skipped"):
            error_out(
                "Refactor '{}' has status '{}', expected 'failed', 'skipped', or 'auto_skipped'".format(
                    refactor_id, target.get("status", "unknown")
                )
            )
            return

        # If target is failed or skipped, reset it and find all auto_skipped descendants
        if target.get("status") in ("failed", "skipped"):
            to_reset.add(refactor_id)
            # Find all auto_skipped refactors that depend (transitively) on this one
            changed = True
            while changed:
                changed = False
                for r in refactors:
                    if not isinstance(r, dict):
                        continue
                    rid = r.get("id")
                    if not rid or rid in to_reset:
                        continue
                    if r.get("status") != "auto_skipped":
                        continue
                    deps = r.get("dependencies", [])
                    if any(d in to_reset for d in deps):
                        to_reset.add(rid)
                        changed = True

        # If target is auto_skipped, reset it and its failed upstream + siblings
        elif target.get("status") == "auto_skipped":
            to_reset.add(refactor_id)
            # Transitively walk upstream to find ALL failed/auto_skipped ancestors
            # (e.g., R-001 failed → R-002 auto_skipped → R-003 auto_skipped;
            #  unskip R-003 must also find and reset R-001)
            upstream_changed = True
            while upstream_changed:
                upstream_changed = False
                for r in refactors:
                    if not isinstance(r, dict):
                        continue
                    rid = r.get("id")
                    if not rid or rid not in to_reset:
                        continue
                    for dep_id in r.get("dependencies", []):
                        if dep_id in to_reset:
                            continue
                        for dep_r in refactors:
                            if isinstance(dep_r, dict) and dep_r.get("id") == dep_id:
                                if dep_r.get("status") in ("failed", "skipped", "auto_skipped"):
                                    to_reset.add(dep_id)
                                    upstream_changed = True
            # Also reset downstream auto_skipped refactors blocked by the same upstreams
            changed = True
            while changed:
                changed = False
                for r in refactors:
                    if not isinstance(r, dict):
                        continue
                    rid = r.get("id")
                    if not rid or rid in to_reset:
                        continue
                    if r.get("status") != "auto_skipped":
                        continue
                    rdeps = r.get("dependencies", [])
                    if any(d in to_reset for d in rdeps):
                        to_reset.add(rid)
                        changed = True
    else:
        # No refactor-id: reset ALL failed + skipped + auto_skipped
        for r in refactors:
            if isinstance(r, dict) and r.get("id"):
                if r.get("status") in ("failed", "skipped", "auto_skipped"):
                    to_reset.add(r["id"])

    if not to_reset:
        error_out("No refactors to unskip")
        return

    # Reset all collected refactors in refactor-list.json
    reset_details = []
    for r in refactors:
        if isinstance(r, dict) and r.get("id") in to_reset:
            old_status = r.get("status", "unknown")
            r["status"] = "pending"
            reset_details.append({
                "refactor_id": r["id"],
                "title": r.get("title", ""),
                "old_status": old_status,
            })

    err = write_json_file(refactor_list_path, data)
    if err:
        error_out("Failed to write .prizmkit/plans/refactor-list.json: {}".format(err))
        return

    # Reset runtime fields in status.json for each refactor
    for rid in to_reset:
        rs = load_refactor_status(state_dir, rid)
        rs["retry_count"] = 0
        rs["sessions"] = []
        rs["last_session_id"] = None
        rs["resume_from_phase"] = None
        rs["updated_at"] = now_iso()
        save_refactor_status(state_dir, rid, rs)

    result = {
        "action": "unskip",
        "reset_count": len(to_reset),
        "refactors": reset_details,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = parse_args()

    if args.action == "update":
        if not args.refactor_id:
            error_out("--refactor-id is required for 'update' action")
        if not args.session_status:
            error_out("--session-status is required for 'update' action")
    if args.action in ("start", "reset", "clean", "complete"):
        if not args.refactor_id:
            error_out("--refactor-id is required for '{}' action".format(args.action))
    if args.action == "clean":
        if not args.project_root:
            error_out("--project-root is required for 'clean' action")

    refactor_list_data, err = load_json_file(args.refactor_list)
    if err:
        error_out("Cannot load refactor list: {}".format(err))

    if args.action == "get_next":
        action_get_next(refactor_list_data, args.state_dir)
    elif args.action == "update":
        action_update(args, args.refactor_list, args.state_dir)
    elif args.action == "status":
        action_status(refactor_list_data, args.state_dir)
    elif args.action == "reset":
        action_reset(args, args.refactor_list, args.state_dir)
    elif args.action == "clean":
        action_clean(args, args.refactor_list, args.state_dir)
    elif args.action == "start":
        action_start(args, args.refactor_list, args.state_dir)
    elif args.action == "pause":
        action_pause(args.state_dir)
    elif args.action == "unskip":
        action_unskip(args, args.refactor_list, args.state_dir)
    elif args.action == "complete":
        # Shortcut: 'complete' is equivalent to 'update --session-status success'
        args.session_status = "success"
        action_update(args, args.refactor_list, args.state_dir)


if __name__ == "__main__":
    main()
