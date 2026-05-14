#!/usr/bin/env python3
"""Patch completion_notes into feature-list.json, refactor-list.json, or bug-fix-list.json.

Reads a completion-summary.json file written by the AI session and patches
the corresponding item in the task list with the completion_notes field.

This enables rich dependency context propagation: when a downstream task's
bootstrap prompt is generated, it can read completion_notes from its
completed dependencies to understand what was built/changed.

Usage:
    python3 patch-completion-notes.py \
        --feature-list .prizmkit/plans/feature-list.json \
        --feature-id F-001 \
        --summary .prizmkit/specs/001-my-feature/completion-summary.json

    python3 patch-completion-notes.py \
        --refactor-list .prizmkit/plans/refactor-list.json \
        --refactor-id R-001 \
        --summary <path-to-summary>
"""

import argparse
import json
import os
import sys

from utils import load_json_file, write_json_file, setup_logging

LOGGER = setup_logging("patch-completion-notes")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Patch completion_notes into a task list from completion-summary.json."
    )
    parser.add_argument(
        "--feature-list",
        default=None,
        help="Path to .prizmkit/plans/feature-list.json",
    )
    parser.add_argument(
        "--refactor-list",
        default=None,
        help="Path to .prizmkit/plans/refactor-list.json",
    )
    parser.add_argument(
        "--bug-list",
        default=None,
        help="Path to .prizmkit/plans/bug-fix-list.json",
    )
    parser.add_argument(
        "--feature-id",
        default=None,
        help="Feature ID to patch (e.g. F-001)",
    )
    parser.add_argument(
        "--refactor-id",
        default=None,
        help="Refactor ID to patch (e.g. R-001)",
    )
    parser.add_argument(
        "--bug-id",
        default=None,
        help="Bug ID to patch (e.g. B-001)",
    )
    parser.add_argument(
        "--summary",
        required=True,
        help="Path to completion-summary.json file",
    )
    return parser.parse_args()


def read_completion_notes(summary_path):
    """Read completion_notes from a completion-summary.json file.

    Returns a list of strings, or an empty list if the file is missing
    or malformed.
    """
    if not os.path.isfile(summary_path):
        LOGGER.warning("Summary file not found: %s", summary_path)
        return []

    data, err = load_json_file(summary_path)
    if err:
        LOGGER.warning("Failed to read summary: %s", err)
        return []

    notes = data.get("completion_notes", [])
    if not isinstance(notes, list):
        LOGGER.warning("completion_notes is not a list in %s", summary_path)
        return []

    # Filter: only keep non-empty strings
    return [n for n in notes if isinstance(n, str) and n.strip()]


def patch_list(list_path, item_id, item_key, notes):
    """Patch completion_notes into a task list JSON file.

    Args:
        list_path: Path to the JSON list file
        item_id: ID of the item to patch (e.g. "F-001" or "R-001")
        item_key: Key for the items array (e.g. "features" or "refactors")
        notes: List of completion note strings
    """
    data, err = load_json_file(list_path)
    if err:
        LOGGER.error("Failed to read list: %s", err)
        return False

    items = data.get(item_key, [])
    found = False
    for item in items:
        if isinstance(item, dict) and item.get("id") == item_id:
            item["completion_notes"] = notes
            found = True
            break

    if not found:
        LOGGER.error("Item %s not found in %s", item_id, list_path)
        return False

    err = write_json_file(list_path, data)
    if err:
        LOGGER.error("Failed to write list: %s", err)
        return False

    LOGGER.info(
        "Patched %d completion notes for %s in %s",
        len(notes), item_id, list_path,
    )
    return True


def main():
    args = parse_args()

    # Determine mode: feature, refactor, or bug
    if args.feature_list and args.feature_id:
        list_path = args.feature_list
        item_id = args.feature_id
        item_key = "features"
    elif args.refactor_list and args.refactor_id:
        list_path = args.refactor_list
        item_id = args.refactor_id
        item_key = "refactors"
    elif args.bug_list and args.bug_id:
        list_path = args.bug_list
        item_id = args.bug_id
        item_key = "bugs"
    else:
        print(
            "Error: must provide either (--feature-list + --feature-id) "
            "or (--refactor-list + --refactor-id) "
            "or (--bug-list + --bug-id)",
            file=sys.stderr,
        )
        sys.exit(1)

    # Read completion notes
    notes = read_completion_notes(args.summary)
    if not notes:
        LOGGER.info("No completion notes to patch for %s", item_id)
        sys.exit(0)

    # Patch the list
    if not patch_list(list_path, item_id, item_key, notes):
        sys.exit(1)

    # Output result
    result = {
        "item_id": item_id,
        "notes_count": len(notes),
        "list_path": os.path.abspath(list_path),
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
    except SystemExit:
        raise
    except Exception as exc:
        LOGGER.exception("Unhandled exception")
        print("Error: {}".format(exc), file=sys.stderr)
        sys.exit(1)
