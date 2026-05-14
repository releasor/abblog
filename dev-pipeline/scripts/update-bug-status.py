#!/usr/bin/env python3
"""Core state machine for updating bug status in the bug-fix pipeline.

Handles eight actions:
  - get_next: Find the next bug to process based on priority and severity
  - start: Mark a bug as fixing when a session starts
  - update: Update a bug's status based on session outcome
  - status: Print a formatted overview of all bugs
  - pause: Save pipeline state for graceful shutdown
  - reset: Reset a bug to pending (status + retry count)
  - clean: Reset + delete session history + delete bugfix artifacts
  - unskip: Reset skipped bugs back to pending

Usage:
    python3 update-bug-status.py \
        --bug-list <path> --state-dir <path> \
        --action <get_next|start|update|status|pause|reset|clean|unskip> \
        [--bug-id <id>] [--session-status <status>] \
        [--session-id <id>] [--max-retries <n>]
"""

import argparse
import json
import os
import shutil
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

TERMINAL_STATUSES = {"completed", "failed", "skipped", "needs_info"}

# Severity priority (lower value = higher priority)
SEVERITY_PRIORITY = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Core state machine for bug-fix pipeline bug status management."
    )
    parser.add_argument("--bug-list", required=True, help="Path to the .prizmkit/plans/bug-fix-list.json file")
    parser.add_argument("--state-dir", required=True, help="Path to the state directory (default: .prizmkit/state/bugfix)")
    parser.add_argument(
        "--action", required=True,
        choices=["get_next", "start", "update", "status", "pause", "reset", "clean", "unskip", "complete"],
        help="Action to perform",
    )
    parser.add_argument("--bug-id", default=None, help="Bug ID (required for 'update'/'reset'/'clean' actions)")
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


def load_bug_status(state_dir, bug_id):
    """Load runtime state from status.json for a bug.

    Returns runtime fields only (retry_count, sessions, etc.).
    The 'status' field is NOT included — status lives exclusively
    in bug-fix-list.json.
    """
    status_path = os.path.join(state_dir, "bugs", bug_id, "status.json")
    if not os.path.isfile(status_path):
        now = now_iso()
        return {
            "bug_id": bug_id,
            "retry_count": 0,
            "max_retries": 3,
            "sessions": [],
            "last_session_id": None,
            "resume_from_phase": None,
            "created_at": now,
            "updated_at": now,
        }
    data, err = load_json_file(status_path)
    if err:
        now = now_iso()
        return {
            "bug_id": bug_id,
            "retry_count": 0,
            "max_retries": 3,
            "sessions": [],
            "last_session_id": None,
            "resume_from_phase": None,
            "created_at": now,
            "updated_at": now,
        }
    # Defensively remove status if present (legacy data)
    data.pop("status", None)
    return data


def save_bug_status(state_dir, bug_id, status_data):
    """Write the status.json for a bug (runtime fields only)."""
    # Defensively strip status — it belongs in bug-fix-list.json
    status_data.pop("status", None)
    status_path = os.path.join(state_dir, "bugs", bug_id, "status.json")
    return write_json_file(status_path, status_data)


def get_bug_status_from_list(bug_list_path, bug_id):
    """Read a single bug's status from bug-fix-list.json."""
    data, err = load_json_file(bug_list_path)
    if err:
        return "pending"
    for b in data.get("bugs", []):
        if isinstance(b, dict) and b.get("id") == bug_id:
            return b.get("status", "pending")
    return "pending"


def update_bug_in_list(bug_list_path, bug_id, new_status):
    data, err = load_json_file(bug_list_path)
    if err:
        return err
    bugs = data.get("bugs", [])
    found = False
    for bug in bugs:
        if isinstance(bug, dict) and bug.get("id") == bug_id:
            bug["status"] = new_status
            found = True
            break
    if not found:
        return "Bug '{}' not found in .prizmkit/plans/bug-fix-list.json".format(bug_id)
    return write_json_file(bug_list_path, data)


# ---------------------------------------------------------------------------
# Action: get_next
# ---------------------------------------------------------------------------

def action_get_next(bug_list_data, state_dir):
    """Find the next bug to process.

    Priority logic:
    1. Skip terminal statuses (completed, failed, skipped, needs_info)
    2. Prefer in_progress bugs (interrupted session resume) over pending
    3. Sort by: severity (critical > high > medium > low), then by priority (high > medium > low)
    """
    bugs = bug_list_data.get("bugs", [])
    if not bugs:
        print("PIPELINE_COMPLETE")
        return

    # Build status map from bug-fix-list.json (single source of truth)
    status_map = {}
    status_data_map = {}
    for bug in bugs:
        if not isinstance(bug, dict):
            continue
        bid = bug.get("id")
        if not bid:
            continue
        status_map[bid] = bug.get("status", "pending")
        bs = load_bug_status(state_dir, bid)
        status_data_map[bid] = bs

    # Check if all bugs are terminal
    non_terminal = [
        b for b in bugs
        if isinstance(b, dict) and b.get("id")
        and status_map.get(b["id"], "pending") not in TERMINAL_STATUSES
    ]
    if not non_terminal:
        print("PIPELINE_COMPLETE")
        return

    # Separate in_progress from pending
    in_progress_bugs = []
    pending_bugs = []
    for bug in non_terminal:
        bid = bug.get("id")
        bstatus = status_map.get(bid, "pending")
        if bstatus == "in_progress":
            in_progress_bugs.append(bug)
        elif bstatus == "pending":
            pending_bugs.append(bug)

    _PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}

    def sort_key(b):
        severity = b.get("severity", "medium")
        sev_order = SEVERITY_PRIORITY.get(severity, 2)
        priority = _PRIORITY_ORDER.get(b.get("priority", "low"), 2)
        return (sev_order, priority)

    if in_progress_bugs:
        candidates = sorted(in_progress_bugs, key=sort_key)
    elif pending_bugs:
        candidates = sorted(pending_bugs, key=sort_key)
    else:
        # All remaining bugs are in non-terminal but also non-pending/in_progress states
        print("PIPELINE_BLOCKED")
        return

    chosen = candidates[0]
    chosen_id = chosen["id"]
    chosen_status_data = status_data_map.get(chosen_id, {})

    result = {
        "bug_id": chosen_id,
        "title": chosen.get("title", ""),
        "severity": chosen.get("severity", "medium"),
        "retry_count": chosen_status_data.get("retry_count", 0),
        "resume_from_phase": chosen_status_data.get("resume_from_phase", None),
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: update
# ---------------------------------------------------------------------------

def action_update(args, bug_list_path, state_dir):
    bug_id = args.bug_id
    session_status = args.session_status
    session_id = args.session_id
    max_retries = args.max_retries

    if not bug_id:
        error_out("--bug-id is required for 'update' action")
        return
    if not session_status:
        error_out("--session-status is required for 'update' action")
        return

    bs = load_bug_status(state_dir, bug_id)

    # Track what status we write to bug-fix-list.json
    new_status = get_bug_status_from_list(bug_list_path, bug_id)

    if session_status == "success":
        new_status = "completed"
        bs["resume_from_phase"] = None
        err = update_bug_in_list(bug_list_path, bug_id, "completed")
        if err:
            error_out("Failed to update .prizmkit/plans/bug-fix-list.json: {}".format(err))
            return
    elif session_status in ("commit_missing", "docs_missing", "merge_conflict"):
        bs["retry_count"] = bs.get("retry_count", 0) + 1

        if bs["retry_count"] >= max_retries:
            new_status = "failed"
        else:
            new_status = "pending"

        bs["degraded_reason"] = session_status
        bs["resume_from_phase"] = None
        bs["sessions"] = []
        bs["last_session_id"] = None

        err = update_bug_in_list(bug_list_path, bug_id, new_status)
        if err:
            error_out("Failed to update .prizmkit/plans/bug-fix-list.json: {}".format(err))
            return
    else:
        bs["retry_count"] = bs.get("retry_count", 0) + 1

        cleaned = cleanup_bug_artifacts(
            state_dir=state_dir,
            bug_id=bug_id,
            project_root=args.project_root,
        )

        if bs["retry_count"] >= max_retries:
            new_status = "failed"
        else:
            new_status = "pending"

        bs["resume_from_phase"] = None
        bs["sessions"] = []
        bs["last_session_id"] = None

        err = update_bug_in_list(bug_list_path, bug_id, new_status)
        if err:
            error_out("Failed to update .prizmkit/plans/bug-fix-list.json: {}".format(err))
            return

    if session_status == "success" and session_id:
        sessions = bs.get("sessions", [])
        if session_id not in sessions:
            sessions.append(session_id)
        bs["sessions"] = sessions
        bs["last_session_id"] = session_id

    bs["updated_at"] = now_iso()

    err = save_bug_status(state_dir, bug_id, bs)
    if err:
        error_out("Failed to save bug status: {}".format(err))
        return

    summary = {
        "action": "update",
        "bug_id": bug_id,
        "session_status": session_status,
        "new_status": new_status,
        "retry_count": bs["retry_count"],
        "resume_from_phase": bs.get("resume_from_phase"),
        "updated_at": bs["updated_at"],
    }
    if session_status in ("commit_missing", "docs_missing", "merge_conflict"):
        summary["degraded_reason"] = session_status
        summary["restart_policy"] = "finalization_retry"
    elif session_status != "success":
        summary["restart_policy"] = "full_restart"
        summary["cleanup_performed"] = cleaned

    print(json.dumps(summary, indent=2, ensure_ascii=False))


def _default_project_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def cleanup_bug_artifacts(state_dir, bug_id, project_root=None):
    """Delete intermediate artifacts for a failed bug run."""
    if not project_root:
        project_root = _default_project_root()

    cleaned = []

    # 1) Remove all session history
    sessions_dir = os.path.join(state_dir, "bugs", bug_id, "sessions")
    sessions_deleted = 0
    if os.path.isdir(sessions_dir):
        for entry in os.listdir(sessions_dir):
            entry_path = os.path.join(sessions_dir, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
                sessions_deleted += 1
        cleaned.append("Deleted {} session(s) from {}".format(sessions_deleted, sessions_dir))

    # 2) Remove transient files under bug dir (keep status.json)
    bug_dir = os.path.join(state_dir, "bugs", bug_id)
    if os.path.isdir(bug_dir):
        for entry in os.listdir(bug_dir):
            if entry == "status.json" or entry == "sessions":
                continue
            entry_path = os.path.join(bug_dir, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
                cleaned.append("Deleted directory {}".format(entry_path))
            elif os.path.isfile(entry_path):
                os.remove(entry_path)
                cleaned.append("Deleted file {}".format(entry_path))

    # 3) Remove bugfix artifacts
    bugfix_dir = os.path.join(project_root, ".prizmkit", "bugfix", bug_id)
    if os.path.isdir(bugfix_dir):
        file_count = sum(len(files) for _, _, files in os.walk(bugfix_dir))
        shutil.rmtree(bugfix_dir)
        cleaned.append("Deleted {} ({} files)".format(bugfix_dir, file_count))

    # 4) Remove shared dev-team workspace
    dev_team_dir = os.path.join(project_root, ".dev-team")
    if os.path.isdir(dev_team_dir):
        file_count = sum(len(files) for _, _, files in os.walk(dev_team_dir))
        shutil.rmtree(dev_team_dir)
        cleaned.append("Deleted {} ({} files)".format(dev_team_dir, file_count))

    # 5) (removed: current-session.json no longer used)

    return cleaned


def load_session_status(state_dir, bug_id, session_id):
    session_status_path = os.path.join(
        state_dir, "bugs", bug_id, "sessions",
        session_id, "session-status.json"
    )
    data, err = load_json_file(session_status_path)
    if err:
        return None, err
    return data, None


# ---------------------------------------------------------------------------
# Action: status
# ---------------------------------------------------------------------------

COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_RED = "\033[91m"
COLOR_GRAY = "\033[90m"
COLOR_MAGENTA = "\033[95m"
COLOR_BOLD = "\033[1m"
COLOR_RESET = "\033[0m"

BOX_WIDTH = 68


SEVERITY_ICONS = {
    "critical": COLOR_RED + "🔴" + COLOR_RESET,
    "high": COLOR_MAGENTA + "🟠" + COLOR_RESET,
    "medium": COLOR_YELLOW + "🟡" + COLOR_RESET,
    "low": COLOR_GRAY + "🟢" + COLOR_RESET,
}


def action_status(bug_list_data, state_dir):
    bugs = bug_list_data.get("bugs", [])
    project_name = bug_list_data.get("project_name", "Unknown")

    counts = {"completed": 0, "in_progress": 0, "failed": 0, "pending": 0, "needs_info": 0, "skipped": 0}
    bug_lines = []

    for bug in bugs:
        if not isinstance(bug, dict):
            continue
        bid = bug.get("id")
        title = bug.get("title", "Untitled")
        severity = bug.get("severity", "medium")
        if not bid:
            continue

        bstatus = bug.get("status", "pending")
        bs = load_bug_status(state_dir, bid)
        retry_count = bs.get("retry_count", 0)
        max_retries_val = bs.get("max_retries", 3)
        resume_phase = bs.get("resume_from_phase")

        if bstatus in counts:
            counts[bstatus] += 1
        else:
            counts["pending"] += 1

        # Status icon
        if bstatus == "completed":
            icon = COLOR_GREEN + "[✓]" + COLOR_RESET
        elif bstatus == "in_progress":
            icon = COLOR_YELLOW + "[→]" + COLOR_RESET
        elif bstatus == "failed":
            icon = COLOR_RED + "[✗]" + COLOR_RESET
        elif bstatus == "needs_info":
            icon = COLOR_MAGENTA + "[?]" + COLOR_RESET
        elif bstatus == "skipped":
            icon = COLOR_GRAY + "[—]" + COLOR_RESET
        else:
            icon = COLOR_GRAY + "[ ]" + COLOR_RESET

        # Severity badge
        sev_badge = "[{}]".format(severity[:4].upper())

        # Detail
        detail = ""
        if bstatus == "in_progress":
            parts = []
            if retry_count > 0:
                parts.append("retry {}/{}".format(retry_count, max_retries_val))
            if resume_phase is not None:
                parts.append("CP-BF-{}".format(resume_phase))
            if parts:
                detail = " ({})".format(", ".join(parts))
        elif bstatus == "failed":
            detail = " (failed after {} retries)".format(retry_count)
        elif bstatus == "needs_info":
            detail = " (needs more info)"

        # Colorize
        if bstatus == "completed":
            line_content = "{} {} {} {} {}{}".format(
                bid, icon, sev_badge, COLOR_GREEN + title + COLOR_RESET, "", detail
            )
        elif bstatus == "in_progress":
            line_content = "{} {} {} {} {}{}".format(
                bid, icon, sev_badge, COLOR_YELLOW + title + COLOR_RESET, "", detail
            )
        elif bstatus == "failed":
            line_content = "{} {} {} {} {}{}".format(
                bid, icon, sev_badge, COLOR_RED + title + COLOR_RESET, "", detail
            )
        elif bstatus == "needs_info":
            line_content = "{} {} {} {} {}{}".format(
                bid, icon, sev_badge, COLOR_MAGENTA + title + COLOR_RESET, "", detail
            )
        else:
            line_content = "{} {} {} {} {}{}".format(
                bid, icon, sev_badge, COLOR_GRAY + title + COLOR_RESET, "", detail
            )

        bug_lines.append(line_content)

    total = len(bugs)
    completed = counts["completed"]
    percent = round(completed / total * 100, 1) if total > 0 else 0.0
    progress_bar = _build_progress_bar(percent, width=24)

    summary_line = "Total: {} bugs | Completed: {} | In Progress: {}".format(
        total, completed, counts["in_progress"]
    )
    summary_line2 = "Failed: {} | Pending: {} | Needs Info: {} | Skipped: {}".format(
        counts["failed"], counts["pending"], counts["needs_info"], counts["skipped"]
    )

    inner = BOX_WIDTH - 2
    print("╔" + "═" * BOX_WIDTH + "╗")
    print("║" + pad_right(COLOR_BOLD + "  Bug-Fix Pipeline Status" + COLOR_RESET, inner) + " ║")
    print("╠" + "═" * BOX_WIDTH + "╣")
    print("║" + pad_right("  Project: {}".format(project_name), inner) + " ║")
    print("║" + pad_right("  {}".format(summary_line), inner) + " ║")
    print("║" + pad_right("  {}".format(summary_line2), inner) + " ║")
    print("╠" + "─" * BOX_WIDTH + "╣")
    print("║" + pad_right("  Progress: {}".format(progress_bar), inner) + " ║")
    print("╠" + "═" * BOX_WIDTH + "╣")
    for line in bug_lines:
        print("║" + pad_right("  {}".format(line), inner) + " ║")
    print("╚" + "═" * BOX_WIDTH + "╝")


# ---------------------------------------------------------------------------
# Action: reset
# ---------------------------------------------------------------------------

def action_reset(args, bug_list_path, state_dir):
    bug_id = args.bug_id
    if not bug_id:
        error_out("--bug-id is required for 'reset' action")
        return

    bs = load_bug_status(state_dir, bug_id)
    old_status = get_bug_status_from_list(bug_list_path, bug_id)
    old_retry = bs.get("retry_count", 0)

    bs["retry_count"] = 0
    bs["sessions"] = []
    bs["last_session_id"] = None
    bs["resume_from_phase"] = None
    bs["updated_at"] = now_iso()

    err = save_bug_status(state_dir, bug_id, bs)
    if err:
        error_out("Failed to save bug status: {}".format(err))
        return

    err = update_bug_in_list(bug_list_path, bug_id, "pending")
    if err:
        error_out("Failed to update .prizmkit/plans/bug-fix-list.json: {}".format(err))
        return

    result = {
        "action": "reset",
        "bug_id": bug_id,
        "old_status": old_status,
        "old_retry_count": old_retry,
        "new_status": "pending",
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: clean
# ---------------------------------------------------------------------------

def action_clean(args, bug_list_path, state_dir):
    bug_id = args.bug_id
    project_root = args.project_root

    if not bug_id:
        error_out("--bug-id is required for 'clean' action")
        return
    if not project_root:
        error_out("--project-root is required for 'clean' action")
        return

    cleaned = []

    # 1. Delete session history
    sessions_dir = os.path.join(state_dir, "bugs", bug_id, "sessions")
    sessions_deleted = 0
    if os.path.isdir(sessions_dir):
        for entry in os.listdir(sessions_dir):
            entry_path = os.path.join(sessions_dir, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
                sessions_deleted += 1
        cleaned.append("Deleted {} session(s) from {}".format(sessions_deleted, sessions_dir))

    # 2. Delete bugfix artifacts for this bug
    bugfix_dir = os.path.join(project_root, ".prizmkit", "bugfix", bug_id)
    if os.path.isdir(bugfix_dir):
        file_count = sum(len(files) for _, _, files in os.walk(bugfix_dir))
        shutil.rmtree(bugfix_dir)
        cleaned.append("Deleted {} ({} files)".format(bugfix_dir, file_count))

    # 3. Delete shared dev-team workspace
    dev_team_dir = os.path.join(project_root, ".dev-team")
    if os.path.isdir(dev_team_dir):
        file_count = sum(len(files) for _, _, files in os.walk(dev_team_dir))
        shutil.rmtree(dev_team_dir)
        cleaned.append("Deleted {} ({} files)".format(dev_team_dir, file_count))

    # 4. (removed: current-session.json no longer used)

    # 5. Reset status
    bs = load_bug_status(state_dir, bug_id)
    old_status = get_bug_status_from_list(bug_list_path, bug_id)
    old_retry = bs.get("retry_count", 0)

    bs["retry_count"] = 0
    bs["sessions"] = []
    bs["last_session_id"] = None
    bs["resume_from_phase"] = None
    bs["updated_at"] = now_iso()

    err = save_bug_status(state_dir, bug_id, bs)
    if err:
        error_out("Failed to save bug status: {}".format(err))
        return

    err = update_bug_in_list(bug_list_path, bug_id, "pending")
    if err:
        error_out("Failed to update .prizmkit/plans/bug-fix-list.json: {}".format(err))
        return

    result = {
        "action": "clean",
        "bug_id": bug_id,
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

def action_start(args, bug_list_path, state_dir):
    """Mark a bug as in_progress when a session starts.

    This keeps bug-fix-list.json/state status in sync during execution,
    instead of only updating after session end.
    """
    bug_id = args.bug_id
    if not bug_id:
        error_out("--bug-id is required for 'start' action")
        return

    bs = load_bug_status(state_dir, bug_id)
    old_status = get_bug_status_from_list(bug_list_path, bug_id)

    bs["updated_at"] = now_iso()

    err = save_bug_status(state_dir, bug_id, bs)
    if err:
        error_out("Failed to save bug status: {}".format(err))
        return

    err = update_bug_in_list(bug_list_path, bug_id, "in_progress")
    if err:
        error_out("Failed to update .prizmkit/plans/bug-fix-list.json: {}".format(err))
        return

    result = {
        "action": "start",
        "bug_id": bug_id,
        "old_status": old_status,
        "new_status": "in_progress",
        "updated_at": bs["updated_at"],
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: unskip
# ---------------------------------------------------------------------------

def action_unskip(args, bug_list_path, state_dir):
    """Reset skipped bugs back to pending.

    Two modes:
    - --bug-id B-001: Reset the specified skipped bug to pending.
    - No --bug-id: Reset ALL skipped bugs to pending.
    """
    bug_id = args.bug_id

    data, err = load_json_file(bug_list_path)
    if err:
        error_out("Cannot load bug fix list: {}".format(err))
        return
    bugs = data.get("bugs", [])

    to_reset = set()

    if bug_id:
        # Find the target bug
        target = None
        for b in bugs:
            if isinstance(b, dict) and b.get("id") == bug_id:
                target = b
                break
        if not target:
            error_out("Bug '{}' not found in .prizmkit/plans/bug-fix-list.json".format(bug_id))
            return
        if target.get("status") not in ("failed", "skipped", "needs_info"):
            error_out(
                "Bug '{}' has status '{}', expected 'failed', 'skipped', or 'needs_info'".format(
                    bug_id, target.get("status", "unknown")
                )
            )
            return
        to_reset.add(bug_id)
    else:
        # No bug-id: reset ALL skipped/failed/needs_info bugs
        for b in bugs:
            if isinstance(b, dict) and b.get("id"):
                if b.get("status") in ("failed", "skipped", "needs_info"):
                    to_reset.add(b["id"])

    if not to_reset:
        error_out("No bugs to unskip")
        return

    # Reset all collected bugs in bug-fix-list.json
    reset_details = []
    for b in bugs:
        if isinstance(b, dict) and b.get("id") in to_reset:
            old_status = b.get("status", "unknown")
            b["status"] = "pending"
            reset_details.append({
                "bug_id": b["id"],
                "title": b.get("title", ""),
                "old_status": old_status,
            })

    err = write_json_file(bug_list_path, data)
    if err:
        error_out("Failed to write .prizmkit/plans/bug-fix-list.json: {}".format(err))
        return

    # Reset runtime fields in status.json for each bug
    for bid in to_reset:
        bs = load_bug_status(state_dir, bid)
        bs["retry_count"] = 0
        bs["sessions"] = []
        bs["last_session_id"] = None
        bs["resume_from_phase"] = None
        bs["updated_at"] = now_iso()
        save_bug_status(state_dir, bid, bs)

    result = {
        "action": "unskip",
        "reset_count": len(to_reset),
        "bugs": reset_details,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = parse_args()

    if args.action == "update":
        if not args.bug_id:
            error_out("--bug-id is required for 'update' action")
        if not args.session_status:
            error_out("--session-status is required for 'update' action")
    if args.action in ("start", "reset", "clean", "complete"):
        if not args.bug_id:
            error_out("--bug-id is required for '{}' action".format(args.action))
    if args.action == "clean":
        if not args.project_root:
            error_out("--project-root is required for 'clean' action")

    bug_list_data, err = load_json_file(args.bug_list)
    if err:
        error_out("Cannot load bug fix list: {}".format(err))

    if args.action == "get_next":
        action_get_next(bug_list_data, args.state_dir)
    elif args.action == "start":
        action_start(args, args.bug_list, args.state_dir)
    elif args.action == "update":
        action_update(args, args.bug_list, args.state_dir)
    elif args.action == "status":
        action_status(bug_list_data, args.state_dir)
    elif args.action == "reset":
        action_reset(args, args.bug_list, args.state_dir)
    elif args.action == "clean":
        action_clean(args, args.bug_list, args.state_dir)
    elif args.action == "pause":
        action_pause(args.state_dir)
    elif args.action == "unskip":
        action_unskip(args, args.bug_list, args.state_dir)
    elif args.action == "complete":
        # Shortcut: 'complete' is equivalent to 'update --session-status success'
        args.session_status = "success"
        action_update(args, args.bug_list, args.state_dir)


if __name__ == "__main__":
    main()
