#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/reset-bug.sh - Reset a failed/stuck bug fix
#
# Resets status and discards uncommitted working tree changes on
# the bugfix branch, then returns to the original branch. Session
# history and .prizmkit artifacts are preserved for debugging.
#
# With --clean, also deletes session history, .prizmkit/bugfix/
# artifacts, and the bugfix branch itself.
#
# Usage:
#   ./reset-bug.sh <bug-id|range> [options] [.prizmkit/plans/bug-fix-list.json]
#
# Bug selection:
#   B-007              Single bug
#   B-008:B-013        Range of bugs (inclusive)
#   --auto-skipped     All bugs with auto_skipped status
#   --failed           All bugs with failed status
#   --stalled          All non-completed bugs (failed + auto_skipped)
#
# Options:
#   --clean    Also delete session history, .prizmkit/bugfix/{BUG_ID}/ artifacts, and bugfix branch
#   --run      After reset, immediately retry via pipeline (only with single bug)
#
# Normal reset (no --clean):
#   - Resets status → pending, retry_count → 0
#   - Discards uncommitted changes on bugfix branch (git checkout -- . && git clean -fd)
#   - Returns to default branch (main/master)
#   - Preserves bugfix branch, session history, and .prizmkit artifacts for debugging
#
# Examples:
#   ./reset-bug.sh B-007                          # Reset status + discard changes
#   ./reset-bug.sh B-007 --clean                  # Reset + delete everything
#   ./reset-bug.sh B-008:B-013 --clean            # Reset range
#   ./reset-bug.sh --auto-skipped                 # Reset all auto_skipped
#   ./reset-bug.sh --failed --clean               # Reset all failed + clean
#   ./reset-bug.sh --stalled --clean              # Reset all non-completed
#   ./reset-bug.sh B-007 --clean --run            # Reset + delete + retry
#   ./reset-bug.sh B-007 --clean my-bugs.json     # Custom bug list
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="${PROJECT_ROOT}/.prizmkit/state/bugfix"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}    $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC}   $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}      $*"; }

# ============================================================
# Parse args
# ============================================================

BUG_ID=""
BUG_RANGE=""
BUG_LIST=""
DO_CLEAN=false
DO_RUN=false
FILTER_MODE=""

for arg in "$@"; do
    case "$arg" in
        --clean)          DO_CLEAN=true ;;
        --run)            DO_RUN=true ;;
        --auto-skipped)   FILTER_MODE="auto_skipped" ;;
        --failed)         FILTER_MODE="failed" ;;
        --stalled)        FILTER_MODE="stalled" ;;
        -h|--help)
            echo "Usage: $0 <bug-id|range> [--clean] [--run] [--auto-skipped|--failed|--stalled] [.prizmkit/plans/bug-fix-list.json]"
            echo ""
            echo "  bug-id              Single bug (e.g. B-007)"
            echo "  B-008:B-013         Range of bugs (inclusive)"
            echo "  --auto-skipped      Reset all auto_skipped bugs"
            echo "  --failed            Reset all failed bugs"
            echo "  --stalled           Reset all non-completed (failed + auto_skipped)"
            echo "  --clean             Delete session history, .prizmkit artifacts, and bugfix branch"
            echo "  --run               Retry immediately after reset (single bug only)"
            echo "  .prizmkit/plans/bug-fix-list.json   Path to bug fix list (default: .prizmkit/plans/bug-fix-list.json)"
            exit 0
            ;;
        B-*:B-*|b-*:b-*)  BUG_RANGE="$arg" ;;
        B-*|b-*)           BUG_ID="$arg" ;;
        *)                 BUG_LIST="$arg" ;;
    esac
done

if [[ -z "$BUG_ID" && -z "$BUG_RANGE" && -z "$FILTER_MODE" ]]; then
    echo "Usage: $0 <bug-id|range> [--clean] [--run] [--auto-skipped|--failed|--stalled] [.prizmkit/plans/bug-fix-list.json]"
    echo ""
    echo "  bug-id              Single bug (e.g. B-007)"
    echo "  B-008:B-013         Range of bugs (inclusive)"
    echo "  --auto-skipped      Reset all auto_skipped bugs"
    echo "  --failed            Reset all failed bugs"
    echo "  --stalled           Reset all non-completed (failed + auto_skipped)"
    echo "  --clean             Delete session history and .prizmkit artifacts"
    echo "  --run               Retry immediately after reset (single bug only)"
    echo "  .prizmkit/plans/bug-fix-list.json   Path to bug fix list (default: .prizmkit/plans/bug-fix-list.json)"
    exit 1
fi

BUG_LIST="${BUG_LIST:-.prizmkit/plans/bug-fix-list.json}"

# Resolve absolute path
if [[ ! "$BUG_LIST" = /* ]]; then
    BUG_LIST="$(pwd)/$BUG_LIST"
fi

# ============================================================
# Validation
# ============================================================

if [[ ! -f "$BUG_LIST" ]]; then
    log_error "Bug fix list not found: $BUG_LIST"
    exit 1
fi

if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
    log_error "No pipeline state found. Run './run-bugfix.sh run' first to initialize."
    exit 1
fi

# ============================================================
# Resolve bug IDs to process
# ============================================================

BUG_IDS=()

if [[ -n "$FILTER_MODE" ]]; then
    # Filter by status from bug-fix-list.json (single source of truth)
    while IFS= read -r bid; do
        [[ -n "$bid" ]] && BUG_IDS+=("$bid")
    done < <(python3 -c "
import json, sys
filter_mode = '$FILTER_MODE'
bug_list = '$BUG_LIST'
with open(bug_list) as f:
    data = json.load(f)
for bug in data.get('bugs', []):
    if not isinstance(bug, dict):
        continue
    bid = bug.get('id', '')
    status = bug.get('status', '')
    if filter_mode == 'auto_skipped' and status == 'auto_skipped':
        print(bid)
    elif filter_mode == 'failed' and status == 'failed':
        print(bid)
    elif filter_mode == 'stalled' and status in ('failed', 'auto_skipped'):
        print(bid)
" 2>/dev/null)

    if [[ ${#BUG_IDS[@]} -eq 0 ]]; then
        log_info "No bugs found with status: $FILTER_MODE"
        exit 0
    fi
    log_info "Found ${#BUG_IDS[@]} bug(s) matching --$FILTER_MODE: ${BUG_IDS[*]}"

elif [[ -n "$BUG_RANGE" ]]; then
    # Parse range B-NNN:B-MMM
    RANGE_START="${BUG_RANGE%%:*}"
    RANGE_END="${BUG_RANGE##*:}"
    START_NUM=$(echo "$RANGE_START" | sed 's/[Bb]-//' | sed 's/^0*//')
    END_NUM=$(echo "$RANGE_END" | sed 's/[Bb]-//' | sed 's/^0*//')

    if [[ -z "$START_NUM" || -z "$END_NUM" || "$START_NUM" -gt "$END_NUM" ]]; then
        log_error "Invalid range: $BUG_RANGE (start must be <= end)"
        exit 1
    fi

    for ((i=START_NUM; i<=END_NUM; i++)); do
        BUG_IDS+=("B-$(printf '%03d' "$i")")
    done
    log_info "Range $BUG_RANGE -> ${BUG_IDS[*]}"

else
    BUG_IDS=("$BUG_ID")
fi

# --run only works with single bug
if [[ "$DO_RUN" == true && ${#BUG_IDS[@]} -gt 1 ]]; then
    log_warn "--run is only supported for single bug reset. Use './run-bugfix.sh run' to resume pipeline after batch reset."
    DO_RUN=false
fi

# ============================================================
# Process each bug
# ============================================================

PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESET_COUNT=0
FAIL_COUNT=0

# Detect default branch (main or master)
DEFAULT_BRANCH=$(git -C "$PROJECT_ROOT" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "")
if [[ -z "$DEFAULT_BRANCH" ]]; then
    if git -C "$PROJECT_ROOT" rev-parse --verify main >/dev/null 2>&1; then
        DEFAULT_BRANCH="main"
    elif git -C "$PROJECT_ROOT" rev-parse --verify master >/dev/null 2>&1; then
        DEFAULT_BRANCH="master"
    else
        DEFAULT_BRANCH=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    fi
fi

for CUR_BUG_ID in "${BUG_IDS[@]}"; do

    # Get bug info from bug fix list
    BUG_INFO=$(python3 -c "
import json, sys
with open('$BUG_LIST') as f:
    data = json.load(f)
for bug in data.get('bugs', []):
    if bug.get('id') == '$CUR_BUG_ID':
        title = bug.get('title', '')
        print(json.dumps({'title': title, 'status': bug.get('status', 'unknown'), 'severity': bug.get('severity', 'medium')}))
        sys.exit(0)
sys.exit(1)
" 2>/dev/null) || {
        log_warn "Bug $CUR_BUG_ID not found in $BUG_LIST -- skipping"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        continue
    }

    BUG_TITLE=$(echo "$BUG_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])")

    # -- Show current state --
    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  Reset: $CUR_BUG_ID — $BUG_TITLE${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"

    STATUS_FILE="$STATE_DIR/bugs/$CUR_BUG_ID/status.json"
    # Read status from bug-fix-list.json (single source of truth)
    CURRENT_STATUS=$(python3 -c "
import json, sys
with open('$BUG_LIST') as f:
    data = json.load(f)
for bug in data.get('bugs', []):
    if isinstance(bug, dict) and bug.get('id') == '$CUR_BUG_ID':
        print(bug.get('status', '?'))
        sys.exit(0)
print('?')
" 2>/dev/null || echo "?")
    if [[ -f "$STATUS_FILE" ]]; then
        CURRENT_RETRY=$(python3 -c "import json; d=json.load(open('$STATUS_FILE')); print(d.get('retry_count',0))")
        SESSION_COUNT=$(python3 -c "import json; d=json.load(open('$STATUS_FILE')); print(len(d.get('sessions',[])))")
        log_info "Current status: $CURRENT_STATUS (retry $CURRENT_RETRY, $SESSION_COUNT sessions)"
    else
        log_info "Current status: $CURRENT_STATUS (no runtime state file)"
    fi

    BUGFIX_DIR="$PROJECT_ROOT/.prizmkit/bugfix/$CUR_BUG_ID"
    BUGFIX_COUNT=0
    if [[ -d "$BUGFIX_DIR" ]]; then
        BUGFIX_COUNT=$(find "$BUGFIX_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
        log_info "PrizmKit artifacts: $BUGFIX_COUNT files in .prizmkit/bugfix/$CUR_BUG_ID/"
    fi

    SESSIONS_DIR="$STATE_DIR/bugs/$CUR_BUG_ID/sessions"
    SESSIONS_COUNT=0
    if [[ -d "$SESSIONS_DIR" ]]; then
        SESSIONS_COUNT=$(find "$SESSIONS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
        log_info "Session history: $SESSIONS_COUNT session(s)"
    fi

    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"

    # ── Git cleanup: discard dev branch changes ──
    # Find dev branches matching this bug (pattern: bugfix/{BUG_ID}-*)
    DEV_BRANCHES=$(git -C "$PROJECT_ROOT" branch --list "bugfix/${CUR_BUG_ID}-*" 2>/dev/null | sed 's/^[* ]*//')
    CURRENT_BRANCH=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

    if [[ -n "$DEV_BRANCHES" ]]; then
        while IFS= read -r branch; do
            [[ -z "$branch" ]] && continue
            if [[ "$CURRENT_BRANCH" == "$branch" ]]; then
                # We're on the dev branch — discard uncommitted changes and return to default
                log_info "Discarding uncommitted changes on dev branch: $branch"
                git -C "$PROJECT_ROOT" reset HEAD 2>/dev/null || true
                git -C "$PROJECT_ROOT" checkout -- . 2>/dev/null || true
                git -C "$PROJECT_ROOT" clean -fd 2>/dev/null || true
                log_info "Switching to $DEFAULT_BRANCH..."
                if ! git -C "$PROJECT_ROOT" checkout "$DEFAULT_BRANCH" 2>/dev/null; then
                    log_warn "Failed to checkout $DEFAULT_BRANCH — staying on $branch"
                else
                    CURRENT_BRANCH="$DEFAULT_BRANCH"
                fi
            else
                # Not on the dev branch — discard its uncommitted changes
                _stashed=false
                _dirty=""
                _dirty=$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null || true)
                if [[ -n "$_dirty" ]]; then
                    git -C "$PROJECT_ROOT" stash push --include-untracked -m "reset-bug-temp" 2>/dev/null && _stashed=true
                fi
                if git -C "$PROJECT_ROOT" checkout "$branch" 2>/dev/null; then
                    log_info "Discarding uncommitted changes on dev branch: $branch"
                    git -C "$PROJECT_ROOT" reset HEAD 2>/dev/null || true
                    git -C "$PROJECT_ROOT" checkout -- . 2>/dev/null || true
                    git -C "$PROJECT_ROOT" clean -fd 2>/dev/null || true
                    git -C "$PROJECT_ROOT" checkout "$CURRENT_BRANCH" 2>/dev/null || true
                else
                    log_warn "Could not checkout $branch to discard changes"
                fi
                [[ "$_stashed" == true ]] && git -C "$PROJECT_ROOT" stash pop 2>/dev/null || true
            fi
            # Only delete the dev branch in --clean mode
            if [[ "$DO_CLEAN" == true ]]; then
                if git -C "$PROJECT_ROOT" branch -D "$branch" 2>/dev/null; then
                    log_success "Deleted dev branch: $branch"
                else
                    log_warn "Failed to delete branch: $branch"
                fi
            else
                log_info "Dev branch preserved for debugging: $branch"
            fi
        done <<< "$DEV_BRANCHES"
    fi

    # -- Execute reset --
    _reset_tmpstderr=$(mktemp)
    if [[ "$DO_CLEAN" == true ]]; then
        log_info "Cleaning $CUR_BUG_ID (reset + delete artifacts)..."
        RESULT=$(python3 "$SCRIPTS_DIR/update-bug-status.py" \
            --bug-list "$BUG_LIST" \
            --state-dir "$STATE_DIR" \
            --bug-id "$CUR_BUG_ID" \
            --project-root "$PROJECT_ROOT" \
            --action clean 2>"$_reset_tmpstderr")
    else
        log_info "Resetting $CUR_BUG_ID status..."
        RESULT=$(python3 "$SCRIPTS_DIR/update-bug-status.py" \
            --bug-list "$BUG_LIST" \
            --state-dir "$STATE_DIR" \
            --bug-id "$CUR_BUG_ID" \
            --action reset 2>"$_reset_tmpstderr")
    fi
    _reset_stderr=$(cat "$_reset_tmpstderr" 2>/dev/null || true)
    rm -f "$_reset_tmpstderr"
    if [[ -n "$_reset_stderr" ]]; then
        log_warn "$_reset_stderr"
    fi

    # Check for errors
    if echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'error' not in d else 1)" 2>/dev/null; then
        RESET_COUNT=$((RESET_COUNT + 1))
        if [[ "$DO_CLEAN" == true ]]; then
            log_success "$CUR_BUG_ID cleaned: status -> pending, $SESSIONS_COUNT session(s) deleted, $BUGFIX_COUNT artifact(s) deleted, dev branch deleted"
        else
            log_success "$CUR_BUG_ID reset: status -> pending, retry count -> 0, dev branch discarded"
        fi
    else
        ERROR_MSG=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null || echo "$RESULT")
        log_error "Reset $CUR_BUG_ID failed: $ERROR_MSG"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

done

# ============================================================
# Summary
# ============================================================

echo ""
echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Reset complete: $RESET_COUNT succeeded, $FAIL_COUNT failed${NC}"
echo -e "${BOLD}════════════════════════════════════════════════════${NC}"

echo ""
echo -e "${BOLD}Next steps:${NC}"
if [[ "$DO_RUN" == true && ${#BUG_IDS[@]} -eq 1 ]]; then
    log_info "Auto-retrying ${BUG_IDS[0]}..."
    echo ""
    exec "$SCRIPT_DIR/run-bugfix.sh" run "${BUG_IDS[0]}" "$BUG_LIST"
else
    log_info "  ./dev-pipeline/run-bugfix.sh run .prizmkit/plans/bug-fix-list.json         # Resume pipeline from first pending"
    if [[ ${#BUG_IDS[@]} -eq 1 ]]; then
        log_info "  ./dev-pipeline/run-bugfix.sh run ${BUG_IDS[0]}     # Run single bug"
    fi
fi
echo ""
