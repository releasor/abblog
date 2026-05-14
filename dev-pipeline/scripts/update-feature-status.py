#!/usr/bin/env python3
"""Core state machine for updating feature status in the dev-pipeline.

Handles nine actions:
  - get_next: Find the next feature to process based on priority and dependencies
  - start: Mark a feature as in_progress when a session starts
  - update: Update a feature's status based on session outcome
  - status: Print a formatted overview of all features
  - pause: Save pipeline state for graceful shutdown
  - reset: Reset a feature to pending (status + retry count)
  - clean: Reset + delete session history + delete prizmkit artifacts
  - complete: Shortcut for manually marking a feature as completed
  - unskip: Recover auto-skipped features (reset failed/skipped upstream + auto_skipped downstream)

Usage:
    python3 update-feature-status.py \
        --feature-list <path> --state-dir <path> \
        --action <get_next|start|update|status|pause|reset|clean|complete|unskip> \
        [--feature-id <id>] [--session-status <status>] \
        [--session-id <id>] [--max-retries <n>] \
        [--features <filter>]
"""

import argparse
import json
import os
import re
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

TERMINAL_STATUSES = {"completed", "failed", "skipped", "auto_skipped", "split"}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Core state machine for dev-pipeline feature status management."
    )
    parser.add_argument(
        "--feature-list",
        required=True,
        help="Path to the .prizmkit/plans/feature-list.json file",
    )
    parser.add_argument(
        "--state-dir",
        required=True,
        help="Path to the state directory (default: .prizmkit/state/features)",
    )
    parser.add_argument(
        "--action",
        required=True,
        choices=["get_next", "start", "update", "status", "pause", "reset", "clean", "complete", "unskip"],
        help="Action to perform",
    )
    parser.add_argument(
        "--feature-id",
        default=None,
        help="Feature ID (required for start/reset/clean/complete/update actions)",
    )
    parser.add_argument(
        "--session-status",
        default=None,
        choices=SESSION_STATUS_VALUES,
        help="Session outcome status (required for 'update' action)",
    )
    parser.add_argument(
        "--session-id",
        default=None,
        help="Session ID (optional, for 'update' action)",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=3,
        help="Maximum retry count before marking as failed (default: 3)",
    )
    parser.add_argument(
        "--feature-slug",
        default=None,
        help="Feature slug (e.g. 007-import-export-desktop). Required for 'clean' action.",
    )
    parser.add_argument(
        "--project-root",
        default=None,
        help="Project root directory. Required for 'clean' action.",
    )
    parser.add_argument(
        "--features",
        default=None,
        help="Feature filter: comma-separated IDs (F-001,F-003) or range (F-001:F-010), or mixed.",
    )
    return parser.parse_args()


def parse_feature_filter(features_str):
    """Parse --features argument into a set of feature IDs.

    Supported formats:
      F-001,F-003,F-005   -> {"F-001", "F-003", "F-005"}
      F-001:F-010          -> {"F-001", "F-002", ..., "F-010"}
      F-001,F-005:F-010    -> mixed, union of both

    Returns None if features_str is None/empty (meaning no filter).
    """
    if not features_str:
        return None

    result = set()
    for part in features_str.split(","):
        part = part.strip()
        if not part:
            continue
        if ":" in part:
            tokens = part.split(":", 1)
            m_start = re.search(r"\d+", tokens[0])
            m_end = re.search(r"\d+", tokens[1])
            if not m_start or not m_end:
                error_out("Invalid range format: {}".format(part))
            start_num = int(m_start.group())
            end_num = int(m_end.group())
            if start_num > end_num:
                start_num, end_num = end_num, start_num
            for i in range(start_num, end_num + 1):
                result.add("F-{:03d}".format(i))
        else:
            result.add(part.upper())
    return result if result else None


def now_iso():
    """Return the current UTC time in ISO8601 format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_feature_status(state_dir, feature_id):
    """Load the runtime state from status.json for a feature.

    Returns runtime fields only (retry_count, sessions, etc.).
    The 'status' field is NOT included — status lives exclusively
    in feature-list.json.
    """
    status_path = os.path.join(
        state_dir, "features", feature_id, "status.json"
    )
    if not os.path.isfile(status_path):
        now = now_iso()
        return {
            "feature_id": feature_id,
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
            "feature_id": feature_id,
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


def save_feature_status(state_dir, feature_id, status_data):
    """Write the status.json for a feature (runtime fields only)."""
    # Defensively strip status — it belongs in feature-list.json
    status_data.pop("status", None)
    status_path = os.path.join(
        state_dir, "features", feature_id, "status.json"
    )
    return write_json_file(status_path, status_data)


def get_feature_status_from_list(feature_list_path, feature_id):
    """Read a single feature's status from feature-list.json."""
    data, err = load_json_file(feature_list_path)
    if err:
        return "pending"
    for f in data.get("features", []):
        if isinstance(f, dict) and f.get("id") == feature_id:
            return f.get("status", "pending")
    return "pending"


def update_feature_in_list(feature_list_path, feature_id, new_status):
    """Update a feature's status field in .prizmkit/plans/feature-list.json.

    Reads the whole file, modifies the target feature's status, writes back.
    Returns an error string on failure, None on success.
    """
    data, err = load_json_file(feature_list_path)
    if err:
        return err
    features = data.get("features", [])
    found = False
    for feature in features:
        if isinstance(feature, dict) and feature.get("id") == feature_id:
            feature["status"] = new_status
            found = True
            break
    if not found:
        return "Feature '{}' not found in .prizmkit/plans/feature-list.json".format(feature_id)
    return write_json_file(feature_list_path, data)


def _default_project_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _build_feature_slug(feature_id, title):
    numeric = feature_id.replace("F-", "").replace("f-", "").zfill(3)
    cleaned = re.sub(r"[^a-z0-9\s-]", "", (title or "").lower())
    cleaned = re.sub(r"[\s]+", "-", cleaned.strip())
    cleaned = re.sub(r"-+", "-", cleaned).strip("-")
    if not cleaned:
        cleaned = "feature"
    return "{}-{}".format(numeric, cleaned)


def _get_feature_slug(feature_list_path, feature_id):
    data, err = load_json_file(feature_list_path)
    if err:
        return None
    for feature in data.get("features", []):
        if isinstance(feature, dict) and feature.get("id") == feature_id:
            return _build_feature_slug(feature_id, feature.get("title", ""))
    return None


def cleanup_feature_artifacts(feature_list_path, state_dir, feature_id, project_root=None):
    """Delete intermediate artifacts for a failed feature run.

    Cleans session history, per-feature transient state, generated specs,
    current-session pointer, and .dev-team workspace to avoid context pollution.
    """
    if not project_root:
        project_root = _default_project_root()

    cleaned = []

    # 1) Remove all session history
    sessions_dir = os.path.join(state_dir, "features", feature_id, "sessions")
    sessions_deleted = 0
    if os.path.isdir(sessions_dir):
        for entry in os.listdir(sessions_dir):
            entry_path = os.path.join(sessions_dir, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
                sessions_deleted += 1
        cleaned.append("Deleted {} session(s) from {}".format(sessions_deleted, sessions_dir))

    # 2) Remove transient files under feature state dir (keep status.json)
    feature_dir = os.path.join(state_dir, "features", feature_id)
    if os.path.isdir(feature_dir):
        for entry in os.listdir(feature_dir):
            if entry == "status.json" or entry == "sessions":
                continue
            entry_path = os.path.join(feature_dir, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
                cleaned.append("Deleted directory {}".format(entry_path))
            elif os.path.isfile(entry_path):
                os.remove(entry_path)
                cleaned.append("Deleted file {}".format(entry_path))

    # 3) Remove generated prizm specs for this feature
    feature_slug = _get_feature_slug(feature_list_path, feature_id)
    if feature_slug:
        specs_dir = os.path.join(project_root, ".prizmkit", "specs", feature_slug)
        if os.path.isdir(specs_dir):
            file_count = sum(len(files) for _, _, files in os.walk(specs_dir))
            shutil.rmtree(specs_dir)
            cleaned.append("Deleted {} ({} files)".format(specs_dir, file_count))

    # 4) Remove global dev-team workspace to avoid stale context contamination
    dev_team_dir = os.path.join(project_root, ".dev-team")
    if os.path.isdir(dev_team_dir):
        file_count = sum(len(files) for _, _, files in os.walk(dev_team_dir))
        shutil.rmtree(dev_team_dir)
        cleaned.append("Deleted {} ({} files)".format(dev_team_dir, file_count))

    # 5) Clear current-session pointer if it points to this feature
    # (no-op: current-session.json has been removed from the pipeline)

    return cleaned


def load_session_status(state_dir, feature_id, session_id):
    """Load a session's session-status.json file."""
    session_status_path = os.path.join(
        state_dir, "features", feature_id, "sessions",
        session_id, "session-status.json"
    )
    data, err = load_json_file(session_status_path)
    if err:
        return None, err
    return data, None


# ---------------------------------------------------------------------------
# Auto-skip: cascade failure to blocked downstream features
# ---------------------------------------------------------------------------

def auto_skip_blocked_features(feature_list_path, state_dir, failed_feature_id):
    """Recursively mark all downstream features blocked by a failed feature as auto_skipped.

    When a feature is marked as failed, any feature whose dependency chain includes
    the failed feature can never be executed. This function propagates the failure
    by marking those blocked features as auto_skipped, allowing the pipeline to
    continue processing unblocked features and eventually reach PIPELINE_COMPLETE.

    Re-reads .prizmkit/plans/feature-list.json from disk to get the latest state (including the
    just-written failed status from update_feature_in_list).

    NOTE: This function performs a read-modify-write on .prizmkit/plans/feature-list.json without
    file locking. The caller (action_update) also writes to .prizmkit/plans/feature-list.json
    immediately before calling this. Safe for single-pipeline execution, but if
    multiple pipeline instances share the same .prizmkit/plans/feature-list.json concurrently,
    a race condition may cause lost writes. Add file locking if parallel pipelines
    are introduced.
    """
    data, err = load_json_file(feature_list_path)
    if err:
        return []
    features = data.get("features", [])

    # Build current status map
    status_map = {}
    for f in features:
        if isinstance(f, dict) and f.get("id"):
            status_map[f["id"]] = f.get("status", "pending")

    # Collect all features to auto-skip (recursive propagation)
    to_skip = set()
    changed = True
    while changed:
        changed = False
        for f in features:
            if not isinstance(f, dict):
                continue
            fid = f.get("id")
            if not fid or fid in to_skip:
                continue
            current = status_map.get(fid, "pending")
            if current in TERMINAL_STATUSES:
                continue
            deps = f.get("dependencies", [])
            for dep_id in deps:
                dep_status = status_map.get(dep_id, "pending")
                if dep_status in ("failed", "skipped", "auto_skipped") or dep_id in to_skip:
                    to_skip.add(fid)
                    status_map[fid] = "auto_skipped"
                    changed = True
                    break

    if not to_skip:
        return []

    # Batch-write to .prizmkit/plans/feature-list.json
    for f in features:
        if isinstance(f, dict) and f.get("id") in to_skip:
            f["status"] = "auto_skipped"
    write_json_file(feature_list_path, data)

    # Update timestamps in status.json for each auto-skipped feature
    for fid in to_skip:
        fs = load_feature_status(state_dir, fid)
        fs["updated_at"] = now_iso()
        save_feature_status(state_dir, fid, fs)

    # Build blocking reason map for logging
    skipped_info = []
    for f in features:
        if not isinstance(f, dict):
            continue
        fid = f.get("id")
        if fid not in to_skip:
            continue
        deps = f.get("dependencies", [])
        blockers = [
            d for d in deps
            if d == failed_feature_id or d in to_skip
        ]
        skipped_info.append({
            "feature_id": fid,
            "title": f.get("title", ""),
            "blocked_by": blockers,
        })

    print(
        "[auto-skip] {} feature(s) auto-skipped due to failed {}:".format(
            len(skipped_info), failed_feature_id
        ),
        file=sys.stderr,
    )
    for info in skipped_info:
        print(
            "  {} ({}) — blocked by {}".format(
                info["feature_id"],
                info["title"],
                ", ".join(info["blocked_by"]),
            ),
            file=sys.stderr,
        )

    return skipped_info


# ---------------------------------------------------------------------------
# Action: get_next
# ---------------------------------------------------------------------------

def action_get_next(feature_list_data, state_dir, feature_filter=None):
    """Find the next feature to process.

    Priority logic:
    1. Skip terminal statuses (completed, failed, skipped, auto_skipped, split)
    2. If feature_filter is set, skip features not in the filter
    3. Check that all dependencies are completed
    4. Prefer in_progress features over pending ones (interrupted session resume)
    5. Among eligible features, pick highest priority (high > medium > low)
    """
    features = feature_list_data.get("features", [])
    if not features:
        print("PIPELINE_COMPLETE")
        return

    # Build status map from ALL features (for dependency checking).
    # Status comes from feature-list.json (the single source of truth).
    # This must happen BEFORE the feature filter is applied, because
    # filtered features may depend on features outside the filter.
    status_map = {}  # feature_id -> status string
    status_data_map = {}  # feature_id -> runtime status data (retry_count, etc.)
    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        if not fid:
            continue
        status_map[fid] = feature.get("status", "pending")
        fs = load_feature_status(state_dir, fid)
        status_data_map[fid] = fs

    # Apply feature filter: only consider these features as candidates
    # for execution, but dependency checking still uses the full status_map
    if feature_filter is not None:
        features = [
            f for f in features
            if isinstance(f, dict) and f.get("id") in feature_filter
        ]
        if not features:
            print("PIPELINE_COMPLETE")
            return

    # Check if all features are in terminal state
    non_terminal = [
        f for f in features
        if isinstance(f, dict) and f.get("id")
        and status_map.get(f["id"], "pending") not in TERMINAL_STATUSES
    ]
    if not non_terminal:
        print("PIPELINE_COMPLETE")
        return

    # Find eligible features (dependencies all completed)
    eligible = []
    has_remaining = False
    for feature in non_terminal:
        fid = feature.get("id")
        if not fid:
            continue
        has_remaining = True
        deps = feature.get("dependencies", [])
        all_deps_completed = True
        for dep_id in deps:
            if status_map.get(dep_id, "pending") != "completed":
                all_deps_completed = False
                break
        if all_deps_completed:
            eligible.append(feature)

    if not eligible:
        if has_remaining:
            print("PIPELINE_BLOCKED")
        else:
            print("PIPELINE_COMPLETE")
        return

    # Separate in_progress from pending
    in_progress_features = []
    pending_features = []
    for feature in eligible:
        fid = feature.get("id")
        fstatus = status_map.get(fid, "pending")
        if fstatus == "in_progress":
            in_progress_features.append(feature)
        else:
            pending_features.append(feature)

    # Priority mapping: string enum → sort order (critical first)
    _PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}

    # Prefer in_progress features, then pending; sort by priority (high > medium > low)
    if in_progress_features:
        candidates = sorted(
            in_progress_features,
            key=lambda f: _PRIORITY_ORDER.get(f.get("priority", "low"), 3)
        )
    else:
        candidates = sorted(
            pending_features,
            key=lambda f: _PRIORITY_ORDER.get(f.get("priority", "low"), 3)
        )

    chosen = candidates[0]
    chosen_id = chosen["id"]
    chosen_status_data = status_data_map.get(chosen_id, {})

    result = {
        "feature_id": chosen_id,
        "title": chosen.get("title", ""),
        "retry_count": chosen_status_data.get("retry_count", 0),
        "resume_from_phase": chosen_status_data.get("resume_from_phase", None),
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: update
# ---------------------------------------------------------------------------

def action_update(args, feature_list_path, state_dir):
    """Update a feature's status based on session outcome.

    Failure policy:
    - Never continue from partial/failed session context
    - Always clean intermediate artifacts and restart from scratch
    """
    feature_id = args.feature_id
    session_status = args.session_status
    session_id = args.session_id
    max_retries = args.max_retries

    if not feature_id:
        error_out("--feature-id is required for 'update' action")
        return
    if not session_status:
        error_out("--session-status is required for 'update' action")
        return

    fs = load_feature_status(state_dir, feature_id)
    current_list_status = get_feature_status_from_list(feature_list_path, feature_id)

    # Track what status we write to feature-list.json
    new_status = current_list_status

    if session_status == "success":
        # No-op guard: if this exact successful session was already recorded,
        # avoid rewriting state files again (prevents post-commit dirty changes).
        existing_sessions = fs.get("sessions", [])
        already_completed = current_list_status == "completed" and fs.get("resume_from_phase") is None
        same_session_already_recorded = (
            session_id
            and session_id in existing_sessions
            and fs.get("last_session_id") == session_id
        )
        if already_completed and (same_session_already_recorded or not session_id):
            summary = {
                "action": "update",
                "feature_id": feature_id,
                "session_status": session_status,
                "new_status": "completed",
                "retry_count": fs.get("retry_count", 0),
                "resume_from_phase": fs.get("resume_from_phase"),
                "updated_at": fs.get("updated_at"),
                "no_op": True,
            }
            print(json.dumps(summary, indent=2, ensure_ascii=False))
            return

        new_status = "completed"
        fs["resume_from_phase"] = None
        err = update_feature_in_list(feature_list_path, feature_id, "completed")
        if err:
            error_out("Failed to update .prizmkit/plans/feature-list.json: {}".format(err))
            return
    elif session_status in ("commit_missing", "docs_missing", "merge_conflict"):
        # Degraded outcome: keep artifacts for retry.
        # Store granular reason in status.json (internal state),
        # but write only schema-valid status to feature-list.json.
        fs["retry_count"] = fs.get("retry_count", 0) + 1

        if fs["retry_count"] >= max_retries:
            new_status = "failed"
        else:
            # feature-list.json gets schema-valid "pending" (will be retried)
            new_status = "pending"

        fs["degraded_reason"] = session_status
        fs["resume_from_phase"] = None
        fs["sessions"] = []
        fs["last_session_id"] = None

        err = update_feature_in_list(feature_list_path, feature_id, new_status)
        if err:
            error_out("Failed to update .prizmkit/plans/feature-list.json: {}".format(err))
            return
    else:
        # crashed / failed / timed_out — preserve all artifacts for debugging.
        fs["retry_count"] = fs.get("retry_count", 0) + 1

        if fs["retry_count"] >= max_retries:
            new_status = "failed"
        else:
            new_status = "pending"

        fs["resume_from_phase"] = None
        # Keep sessions list and last_session_id for debugging

        err = update_feature_in_list(feature_list_path, feature_id, new_status)
        if err:
            error_out("Failed to update .prizmkit/plans/feature-list.json: {}".format(err))
            return

    if session_status == "success" and session_id:
        sessions = fs.get("sessions", [])
        if session_id not in sessions:
            sessions.append(session_id)
        fs["sessions"] = sessions
        fs["last_session_id"] = session_id

    fs["updated_at"] = now_iso()

    err = save_feature_status(state_dir, feature_id, fs)
    if err:
        error_out("Failed to save feature status: {}".format(err))
        return

    # Auto-skip downstream features when this feature is marked as failed or skipped
    auto_skipped_features = []
    if new_status in ("failed", "skipped"):
        auto_skipped_features = auto_skip_blocked_features(
            feature_list_path, state_dir, feature_id
        )

    summary = {
        "action": "update",
        "feature_id": feature_id,
        "session_status": session_status,
        "new_status": new_status,
        "retry_count": fs["retry_count"],
        "resume_from_phase": fs.get("resume_from_phase"),
        "updated_at": fs["updated_at"],
    }
    if auto_skipped_features:
        summary["auto_skipped"] = [info["feature_id"] for info in auto_skipped_features]
    if session_status in ("commit_missing", "docs_missing", "merge_conflict"):
        summary["degraded_reason"] = session_status
        summary["restart_policy"] = "finalization_retry"
    elif session_status != "success":
        summary["restart_policy"] = "preserve_and_retry"
        summary["artifacts_preserved"] = True

    print(json.dumps(summary, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: status
# ---------------------------------------------------------------------------

# ANSI color codes
COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_RED = "\033[91m"
COLOR_GRAY = "\033[90m"
COLOR_BOLD = "\033[1m"
COLOR_RESET = "\033[0m"

BOX_WIDTH = 68


def _calc_feature_duration(state_dir, feature_id):
    """Calculate the duration (in seconds) of a completed feature.

    Computes duration from status.json's created_at and updated_at fields.
    If session records exist, attempts to use the first session's started_at
    to the last update time for the calculation.
    Returns None if the duration cannot be calculated.
    """
    fs_path = os.path.join(state_dir, "features", feature_id, "status.json")
    if not os.path.isfile(fs_path):
        return None
    data, err = load_json_file(fs_path)
    if err or not data:
        return None

    created_at = data.get("created_at")
    updated_at = data.get("updated_at")
    if not created_at or not updated_at:
        return None

    try:
        fmt = "%Y-%m-%dT%H:%M:%SZ"
        t_start = datetime.strptime(created_at, fmt)
        t_end = datetime.strptime(updated_at, fmt)
        delta = (t_end - t_start).total_seconds()
        # Filter outliers: ignore durations less than 10s or more than 24h
        if delta < 10 or delta > 86400:
            return None
        return delta
    except (ValueError, TypeError):
        return None


def _format_duration(seconds):
    """Format seconds into a human-readable duration string."""
    if seconds is None:
        return "N/A"
    seconds = int(seconds)
    if seconds < 60:
        return "{}s".format(seconds)
    elif seconds < 3600:
        m = seconds // 60
        s = seconds % 60
        return "{}m{}s".format(m, s)
    else:
        h = seconds // 3600
        m = (seconds % 3600) // 60
        return "{}h{}m".format(h, m)


def _estimate_remaining_time(features, state_dir, counts, feature_list_data=None):
    """Estimate remaining time based on completed feature durations, weighted by complexity.

    Strategy:
    1. Collect durations of all completed features, grouped by complexity
    2. For remaining pending/in_progress features, estimate using the average duration
       of the corresponding complexity level
    3. If no historical data exists for a complexity level, fall back to the global average

    Returns an (estimated_seconds, confidence) tuple.
    confidence: "high" (>=50% completed), "medium" (>=25%), "low" (<25%)
    """
    # Complexity weights (used for estimation when no historical data is available)
    COMPLEXITY_WEIGHT = {"low": 1.0, "medium": 2.0, "high": 4.0}

    # Build feature-list status map (status lives in feature-list.json)
    fl_status_map = {}
    if feature_list_data:
        for f in feature_list_data.get("features", []):
            if isinstance(f, dict) and f.get("id"):
                fl_status_map[f["id"]] = f.get("status", "pending")

    # Collect completed feature durations grouped by complexity
    duration_by_complexity = {}  # complexity -> [duration_seconds]
    feature_complexity_map = {}  # feature_id -> complexity

    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        if not fid:
            continue
        complexity = feature.get("estimated_complexity", "medium")
        feature_complexity_map[fid] = complexity

    all_durations = []
    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        if not fid:
            continue
        if fl_status_map.get(fid) != "completed":
            continue
        duration = _calc_feature_duration(state_dir, fid)
        if duration is None:
            continue
        complexity = feature_complexity_map.get(fid, "medium")
        if complexity not in duration_by_complexity:
            duration_by_complexity[complexity] = []
        duration_by_complexity[complexity].append(duration)
        all_durations.append(duration)

    if not all_durations:
        return None, "low"

    # Calculate average duration per complexity level
    avg_by_complexity = {}
    for c, durations in duration_by_complexity.items():
        avg_by_complexity[c] = sum(durations) / len(durations)
    global_avg = sum(all_durations) / len(all_durations)

    # Estimate duration for remaining features
    remaining_seconds = 0.0
    remaining_count = 0
    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        if not fid:
            continue
        fstatus = fl_status_map.get(fid, "pending")
        if fstatus in TERMINAL_STATUSES:
            continue
        remaining_count += 1
        complexity = feature_complexity_map.get(fid, "medium")
        if complexity in avg_by_complexity:
            remaining_seconds += avg_by_complexity[complexity]
        else:
            # No historical data for this complexity; estimate using global avg × weight ratio
            weight = COMPLEXITY_WEIGHT.get(complexity, 2.0)
            base_weight = COMPLEXITY_WEIGHT.get("medium", 2.0)
            remaining_seconds += global_avg * (weight / base_weight)

    # Calculate confidence level
    total = len([f for f in features if isinstance(f, dict) and f.get("id")])
    completed = counts.get("completed", 0)
    if total > 0:
        ratio = completed / total
        if ratio >= 0.5:
            confidence = "high"
        elif ratio >= 0.25:
            confidence = "medium"
        else:
            confidence = "low"
    else:
        confidence = "low"

    return remaining_seconds, confidence


def action_status(feature_list_data, state_dir, feature_filter=None):
    """Print a formatted overview of all features and their status.

    Status is read exclusively from .prizmkit/plans/feature-list.json (the single source of
    truth).  state_dir is only used for ETA estimation when session history
    is available.
    """
    features = feature_list_data.get("features", [])
    app_name = feature_list_data.get("project_name", feature_list_data.get("app_name", "Unknown"))

    # Apply feature filter
    if feature_filter is not None:
        features = [
            f for f in features
            if isinstance(f, dict) and f.get("id") in feature_filter
        ]

    # Gather status info
    counts = {
        "completed": 0,
        "in_progress": 0,
        "failed": 0,
        "pending": 0,
        "skipped": 0,
        "auto_skipped": 0,
    }
    feature_lines = []

    # Build status map from .prizmkit/plans/feature-list.json only
    status_map = {}
    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        if not fid:
            continue
        status_map[fid] = feature.get("status", "pending")

    # Build degraded_reason map from status.json (internal pipeline state)
    degraded_reason_map = {}
    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        if not fid:
            continue
        fs = load_feature_status(state_dir, fid)
        dr = fs.get("degraded_reason")
        if dr:
            degraded_reason_map[fid] = dr

    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        title = feature.get("title", "Untitled")
        if not fid:
            continue

        fstatus = feature.get("status", "pending")
        degraded_reason = degraded_reason_map.get(fid)

        # Count statuses
        if fstatus in counts:
            counts[fstatus] += 1
        else:
            counts["pending"] += 1

        # Build status indicator and color
        # Show degraded reason via icon when a pending feature has one
        if fstatus == "pending" and degraded_reason == "commit_missing":
            icon = COLOR_RED + "[↑]" + COLOR_RESET
        elif fstatus == "pending" and degraded_reason == "docs_missing":
            icon = COLOR_RED + "[D]" + COLOR_RESET
        elif fstatus == "pending" and degraded_reason == "merge_conflict":
            icon = COLOR_RED + "[⚡]" + COLOR_RESET
        elif fstatus == "completed":
            icon = COLOR_GREEN + "[✓]" + COLOR_RESET
        elif fstatus == "in_progress":
            icon = COLOR_YELLOW + "[→]" + COLOR_RESET
        elif fstatus == "failed":
            icon = COLOR_RED + "[✗]" + COLOR_RESET
        elif fstatus == "skipped":
            icon = COLOR_GRAY + "[—]" + COLOR_RESET
        elif fstatus == "auto_skipped":
            icon = COLOR_GRAY + "[⊘]" + COLOR_RESET
        else:
            icon = COLOR_GRAY + "[ ]" + COLOR_RESET

        # Build detail suffix
        detail = ""
        if fstatus == "pending" and degraded_reason:
            detail = " ({}, retrying)".format(degraded_reason)
            # Also check if blocked by dependencies
            deps = feature.get("dependencies", [])
            blocking = [
                d for d in deps
                if status_map.get(d, "pending") != "completed"
            ]
            if blocking:
                detail = " ({}, blocked by {})".format(degraded_reason, ", ".join(blocking))
        elif fstatus == "pending":
            # Check if blocked by dependencies
            deps = feature.get("dependencies", [])
            blocking = [
                d for d in deps
                if status_map.get(d, "pending") != "completed"
            ]
            if blocking:
                detail = " (blocked by {})".format(", ".join(blocking))
        elif fstatus == "auto_skipped":
            deps = feature.get("dependencies", [])
            blockers = [
                d for d in deps
                if status_map.get(d, "pending") in ("failed", "skipped", "auto_skipped")
            ]
            if blockers:
                detail = " (auto-skipped: blocked by {})".format(", ".join(blockers))
        elif fstatus == "failed" and degraded_reason:
            detail = " (last failure: {})".format(degraded_reason)

        # Apply color to the whole line content
        if fstatus == "completed":
            line_content = "{} {} {}{}".format(
                fid, icon, COLOR_GREEN + title + COLOR_RESET, detail
            )
        elif fstatus == "in_progress":
            line_content = "{} {} {}{}".format(
                fid, icon, COLOR_YELLOW + title + COLOR_RESET, detail
            )
        elif fstatus == "failed":
            line_content = "{} {} {}{}".format(
                fid, icon, COLOR_RED + title + COLOR_RESET, detail
            )
        elif degraded_reason:
            line_content = "{} {} {}{}".format(
                fid, icon, COLOR_RED + title + COLOR_RESET, detail
            )
        else:
            line_content = "{} {} {}{}".format(
                fid, icon, COLOR_GRAY + title + COLOR_RESET, detail
            )

        feature_lines.append(line_content)

    total = len(features)
    completed = counts["completed"]

    # Calculate percentage
    if total > 0:
        percent = round(completed / total * 100, 1)
    else:
        percent = 0.0

    # Generate progress bar
    progress_bar = _build_progress_bar(percent, width=24)

    # Estimate remaining time
    est_remaining, confidence = _estimate_remaining_time(
        features, state_dir, counts, feature_list_data
    )

    summary_line = "Total: {} features | Completed: {} | In Progress: {}".format(
        total, completed, counts["in_progress"]
    )
    summary_line2 = "Failed: {} | Pending: {} | Skipped: {} | Auto-skipped: {}".format(
        counts["failed"], counts["pending"], counts["skipped"], counts["auto_skipped"]
    )

    # Count degraded features (pending with a degraded_reason from status.json)
    degraded_count = sum(
        1 for fid, dr in degraded_reason_map.items()
        if status_map.get(fid) == "pending" and dr
    )
    if degraded_count > 0:
        summary_line3 = "Degraded (retrying): {}".format(degraded_count)
    else:
        summary_line3 = None

    # Build estimated remaining time line
    CONFIDENCE_ICONS = {"high": "●", "medium": "◐", "low": "○"}
    if est_remaining is not None:
        eta_str = _format_duration(est_remaining)
        conf_icon = CONFIDENCE_ICONS.get(confidence, "○")
        eta_line = "ETA: ~{}  (confidence: {} {})".format(
            eta_str, conf_icon, confidence
        )
    else:
        eta_line = "ETA: calculating... (need >=1 completed feature)"

    # Print the box
    inner = BOX_WIDTH - 2  # space inside the vertical bars
    print("╔" + "═" * BOX_WIDTH + "╗")
    print("║" + pad_right(COLOR_BOLD + "  Dev-Pipeline Status" + COLOR_RESET, inner) + " ║")
    print("╠" + "═" * BOX_WIDTH + "╣")
    print("║" + pad_right("  Project: {}".format(app_name), inner) + " ║")
    print("║" + pad_right("  {}".format(summary_line), inner) + " ║")
    print("║" + pad_right("  {}".format(summary_line2), inner) + " ║")
    if summary_line3:
        print("║" + pad_right("  {}".format(summary_line3), inner) + " ║")
    print("╠" + "─" * BOX_WIDTH + "╣")
    print("║" + pad_right("  Progress: {}".format(progress_bar), inner) + " ║")
    print("║" + pad_right("  {}".format(eta_line), inner) + " ║")
    print("╠" + "═" * BOX_WIDTH + "╣")
    for line in feature_lines:
        print("║" + pad_right("  {}".format(line), inner) + " ║")
    print("╚" + "═" * BOX_WIDTH + "╝")


# ---------------------------------------------------------------------------
# Action: start
# ---------------------------------------------------------------------------

def action_start(args, feature_list_path, state_dir):
    """Mark a feature as in_progress at session start.

    This keeps .prizmkit/plans/feature-list.json/state status in sync during execution,
    instead of only updating after session end.
    """
    feature_id = args.feature_id
    if not feature_id:
        error_out("--feature-id is required for 'start' action")
        return

    fs = load_feature_status(state_dir, feature_id)
    old_status = get_feature_status_from_list(feature_list_path, feature_id)

    fs["updated_at"] = now_iso()

    err = save_feature_status(state_dir, feature_id, fs)
    if err:
        error_out("Failed to save feature status: {}".format(err))
        return

    err = update_feature_in_list(feature_list_path, feature_id, "in_progress")
    if err:
        error_out("Failed to update .prizmkit/plans/feature-list.json: {}".format(err))
        return

    result = {
        "action": "start",
        "feature_id": feature_id,
        "old_status": old_status,
        "new_status": "in_progress",
        "updated_at": fs["updated_at"],
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: reset
# ---------------------------------------------------------------------------

def action_reset(args, feature_list_path, state_dir):
    """Reset a feature to pending state.

    Resets status.json runtime fields (retry_count -> 0, clear sessions,
    clear resume_from_phase) and updates .prizmkit/plans/feature-list.json status to pending.
    Does NOT delete any files on disk.
    """
    feature_id = args.feature_id
    if not feature_id:
        error_out("--feature-id is required for 'reset' action")
        return

    # Load current status to preserve created_at
    fs = load_feature_status(state_dir, feature_id)
    old_status = get_feature_status_from_list(feature_list_path, feature_id)
    old_retry = fs.get("retry_count", 0)

    # Reset runtime fields
    fs["retry_count"] = 0
    fs["sessions"] = []
    fs["last_session_id"] = None
    fs["resume_from_phase"] = None
    fs["updated_at"] = now_iso()

    # Write back status.json
    err = save_feature_status(state_dir, feature_id, fs)
    if err:
        error_out("Failed to save feature status: {}".format(err))
        return

    # Update .prizmkit/plans/feature-list.json
    err = update_feature_in_list(feature_list_path, feature_id, "pending")
    if err:
        error_out("Failed to update .prizmkit/plans/feature-list.json: {}".format(err))
        return

    result = {
        "action": "reset",
        "feature_id": feature_id,
        "old_status": old_status,
        "old_retry_count": old_retry,
        "new_status": "pending",
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: clean
# ---------------------------------------------------------------------------

def action_clean(args, feature_list_path, state_dir):
    """Reset a feature AND delete all associated artifacts.

    Deletes:
    - state/features/F-XXX/sessions/ (all session history)
    - .prizmkit/specs/{slug}/ (spec, plan, tasks, contracts)

    Then performs a full reset (same as action_reset).
    """
    feature_id = args.feature_id
    feature_slug = args.feature_slug
    project_root = args.project_root

    if not feature_id:
        error_out("--feature-id is required for 'clean' action")
        return
    if not feature_slug:
        error_out("--feature-slug is required for 'clean' action")
        return
    if not project_root:
        error_out("--project-root is required for 'clean' action")
        return

    cleaned = []

    # 1. Delete session history
    sessions_dir = os.path.join(state_dir, "features", feature_id, "sessions")
    sessions_deleted = 0
    if os.path.isdir(sessions_dir):
        for entry in os.listdir(sessions_dir):
            entry_path = os.path.join(sessions_dir, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
                sessions_deleted += 1
        cleaned.append("Deleted {} session(s) from {}".format(
            sessions_deleted, sessions_dir
        ))

    # 2. Delete prizmkit specs for this feature
    specs_dir = os.path.join(project_root, ".prizmkit", "specs", feature_slug)
    if os.path.isdir(specs_dir):
        file_count = sum(
            len(files) for _, _, files in os.walk(specs_dir)
        )
        shutil.rmtree(specs_dir)
        cleaned.append("Deleted {} ({} files)".format(specs_dir, file_count))

    # 3. Delete global dev-team workspace (shared AI transient context)
    dev_team_dir = os.path.join(project_root, ".dev-team")
    if os.path.isdir(dev_team_dir):
        file_count = sum(len(files) for _, _, files in os.walk(dev_team_dir))
        shutil.rmtree(dev_team_dir)
        cleaned.append("Deleted {} ({} files)".format(dev_team_dir, file_count))

    # 4. (removed: current-session.json no longer used)

    # 5. Reset status (reuse reset logic)
    fs = load_feature_status(state_dir, feature_id)
    old_status = get_feature_status_from_list(feature_list_path, feature_id)
    old_retry = fs.get("retry_count", 0)

    fs["retry_count"] = 0
    fs["sessions"] = []
    fs["last_session_id"] = None
    fs["resume_from_phase"] = None
    fs["updated_at"] = now_iso()

    err = save_feature_status(state_dir, feature_id, fs)
    if err:
        error_out("Failed to save feature status: {}".format(err))
        return

    err = update_feature_in_list(feature_list_path, feature_id, "pending")
    if err:
        error_out("Failed to update .prizmkit/plans/feature-list.json: {}".format(err))
        return

    result = {
        "action": "clean",
        "feature_id": feature_id,
        "feature_slug": feature_slug,
        "old_status": old_status,
        "old_retry_count": old_retry,
        "new_status": "pending",
        "sessions_deleted": sessions_deleted,
        "cleaned": cleaned,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: unskip
# ---------------------------------------------------------------------------

def action_unskip(args, feature_list_path, state_dir):
    """Recover auto-skipped features by resetting them and their failed upstream.

    Two modes:
    - --feature-id F-032: Reset the specified failed/skipped feature + all auto_skipped
      features whose dependency chain includes it.
    - No --feature-id: Reset ALL failed, skipped, and auto_skipped features to pending.
    """
    feature_id = args.feature_id

    data, err = load_json_file(feature_list_path)
    if err:
        error_out("Cannot load feature list: {}".format(err))
        return
    features = data.get("features", [])

    to_reset = set()

    if feature_id:
        # Find the target feature
        target = None
        for f in features:
            if isinstance(f, dict) and f.get("id") == feature_id:
                target = f
                break
        if not target:
            error_out("Feature '{}' not found in .prizmkit/plans/feature-list.json".format(feature_id))
            return
        if target.get("status") not in ("failed", "skipped", "auto_skipped"):
            error_out(
                "Feature '{}' has status '{}', expected 'failed', 'skipped', or 'auto_skipped'".format(
                    feature_id, target.get("status", "unknown")
                )
            )
            return

        # If target is failed or skipped, reset it and find all auto_skipped descendants
        if target.get("status") in ("failed", "skipped"):
            to_reset.add(feature_id)
            # Find all auto_skipped features that depend (transitively) on this one
            changed = True
            while changed:
                changed = False
                for f in features:
                    if not isinstance(f, dict):
                        continue
                    fid = f.get("id")
                    if not fid or fid in to_reset:
                        continue
                    if f.get("status") != "auto_skipped":
                        continue
                    deps = f.get("dependencies", [])
                    if any(d in to_reset for d in deps):
                        to_reset.add(fid)
                        changed = True

        # If target is auto_skipped, reset it and its failed upstream + siblings
        elif target.get("status") == "auto_skipped":
            to_reset.add(feature_id)
            # Transitively walk upstream to find ALL failed/auto_skipped ancestors
            # (e.g., F-001 failed → F-002 auto_skipped → F-003 auto_skipped;
            #  unskip F-003 must also find and reset F-001)
            upstream_changed = True
            while upstream_changed:
                upstream_changed = False
                for f in features:
                    if not isinstance(f, dict):
                        continue
                    fid = f.get("id")
                    if not fid or fid not in to_reset:
                        continue
                    for dep_id in f.get("dependencies", []):
                        if dep_id in to_reset:
                            continue
                        for dep_f in features:
                            if isinstance(dep_f, dict) and dep_f.get("id") == dep_id:
                                if dep_f.get("status") in ("failed", "skipped", "auto_skipped"):
                                    to_reset.add(dep_id)
                                    upstream_changed = True
            # Also reset downstream auto_skipped features blocked by the same upstreams
            changed = True
            while changed:
                changed = False
                for f in features:
                    if not isinstance(f, dict):
                        continue
                    fid = f.get("id")
                    if not fid or fid in to_reset:
                        continue
                    if f.get("status") != "auto_skipped":
                        continue
                    fdeps = f.get("dependencies", [])
                    if any(d in to_reset for d in fdeps):
                        to_reset.add(fid)
                        changed = True
    else:
        # No feature-id: reset ALL failed + skipped + auto_skipped
        for f in features:
            if isinstance(f, dict) and f.get("id"):
                if f.get("status") in ("failed", "skipped", "auto_skipped"):
                    to_reset.add(f["id"])

    if not to_reset:
        error_out("No features to unskip")
        return

    # Reset all collected features in .prizmkit/plans/feature-list.json
    reset_details = []
    for f in features:
        if isinstance(f, dict) and f.get("id") in to_reset:
            old_status = f.get("status", "unknown")
            f["status"] = "pending"
            reset_details.append({
                "feature_id": f["id"],
                "title": f.get("title", ""),
                "old_status": old_status,
            })

    err = write_json_file(feature_list_path, data)
    if err:
        error_out("Failed to write .prizmkit/plans/feature-list.json: {}".format(err))
        return

    # Reset runtime fields in status.json for each feature
    for fid in to_reset:
        fs = load_feature_status(state_dir, fid)
        fs["retry_count"] = 0
        fs["sessions"] = []
        fs["last_session_id"] = None
        fs["resume_from_phase"] = None
        fs["updated_at"] = now_iso()
        save_feature_status(state_dir, fid, fs)

    result = {
        "action": "unskip",
        "reset_count": len(to_reset),
        "features": reset_details,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: pause
# ---------------------------------------------------------------------------

def action_pause(state_dir):
    """Save current pipeline state for graceful shutdown."""
    pipeline_path = os.path.join(state_dir, "pipeline.json")

    data, err = load_json_file(pipeline_path)
    if err:
        # If pipeline.json doesn't exist, create a minimal one
        data = {
            "status": "paused",
            "paused_at": now_iso(),
        }
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
# Main
# ---------------------------------------------------------------------------

def main():
    args = parse_args()

    # Validate action-specific requirements
    if args.action == "update":
        if not args.feature_id:
            error_out("--feature-id is required for 'update' action")
        if not args.session_status:
            error_out("--session-status is required for 'update' action")
    if args.action in ("start", "reset", "clean", "complete"):
        if not args.feature_id:
            error_out("--feature-id is required for '{}' action".format(args.action))
    if args.action == "clean":
        if not args.feature_slug:
            error_out("--feature-slug is required for 'clean' action")
        if not args.project_root:
            error_out("--project-root is required for 'clean' action")

    # Load feature list
    feature_list_data, err = load_json_file(args.feature_list)
    if err:
        error_out("Cannot load feature list: {}".format(err))

    # Parse feature filter (used by get_next and status)
    feature_filter = parse_feature_filter(args.features)

    # Dispatch action
    if args.action == "get_next":
        action_get_next(feature_list_data, args.state_dir, feature_filter)
    elif args.action == "start":
        action_start(args, args.feature_list, args.state_dir)
    elif args.action == "update":
        action_update(args, args.feature_list, args.state_dir)
    elif args.action == "status":
        action_status(feature_list_data, args.state_dir, feature_filter)
    elif args.action == "reset":
        action_reset(args, args.feature_list, args.state_dir)
    elif args.action == "clean":
        action_clean(args, args.feature_list, args.state_dir)
    elif args.action == "complete":
        # Shortcut: 'complete' is equivalent to 'update --session-status success'
        args.session_status = "success"
        action_update(args, args.feature_list, args.state_dir)
    elif args.action == "pause":
        action_pause(args.state_dir)
    elif args.action == "unskip":
        action_unskip(args, args.feature_list, args.state_dir)


if __name__ == "__main__":
    main()
