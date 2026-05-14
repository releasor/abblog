#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/reset-refactor.sh - Reset a failed/stuck refactor
#
# Clears all state and artifacts for a refactor so it can be
# re-executed from scratch by the pipeline.
#
# Usage:
#   ./reset-refactor.sh <refactor-id|range> [options] [.prizmkit/plans/refactor-list.json]
#
# Refactor selection:
#   R-007              Single refactor
#   R-008:R-013        Range of refactors (inclusive)
#   --auto-skipped     All refactors with auto_skipped status
#   --failed           All refactors with failed status
#   --stalled          All non-completed refactors (failed + auto_skipped)
#
# Options:
#   --clean    Also delete session history and .prizmkit/specs/{slug}/ artifacts
#   --run      After reset, immediately retry via pipeline (only with single refactor)
#
# Examples:
#   ./reset-refactor.sh R-007                          # Reset status only
#   ./reset-refactor.sh R-007 --clean                  # Reset + delete artifacts
#   ./reset-refactor.sh R-008:R-013 --clean            # Reset range
#   ./reset-refactor.sh --auto-skipped                 # Reset all auto_skipped
#   ./reset-refactor.sh --failed --clean               # Reset all failed + clean
#   ./reset-refactor.sh --stalled --clean              # Reset all non-completed
#   ./reset-refactor.sh R-007 --clean --run            # Reset + delete + retry
#   ./reset-refactor.sh R-007 --clean my-refactors.json  # Custom refactor list
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="${PROJECT_ROOT}/.prizmkit/state/refactor"
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

REFACTOR_ID=""
REFACTOR_RANGE=""
REFACTOR_LIST=""
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
            echo "Usage: $0 <refactor-id|range> [--clean] [--run] [--auto-skipped|--failed|--stalled] [.prizmkit/plans/refactor-list.json]"
            echo ""
            echo "  refactor-id          Single refactor (e.g. R-007)"
            echo "  R-008:R-013          Range of refactors (inclusive)"
            echo "  --auto-skipped       Reset all auto_skipped refactors"
            echo "  --failed             Reset all failed refactors"
            echo "  --stalled            Reset all non-completed (failed + auto_skipped)"
            echo "  --clean              Delete session history and .prizmkit artifacts"
            echo "  --run                Retry immediately after reset (single refactor only)"
            echo "  .prizmkit/plans/refactor-list.json   Path to refactor list (default: .prizmkit/plans/refactor-list.json)"
            exit 0
            ;;
        R-*:R-*|r-*:r-*)  REFACTOR_RANGE="$arg" ;;
        R-*|r-*)           REFACTOR_ID="$arg" ;;
        *)                 REFACTOR_LIST="$arg" ;;
    esac
done

if [[ -z "$REFACTOR_ID" && -z "$REFACTOR_RANGE" && -z "$FILTER_MODE" ]]; then
    echo "Usage: $0 <refactor-id|range> [--clean] [--run] [--auto-skipped|--failed|--stalled] [.prizmkit/plans/refactor-list.json]"
    echo ""
    echo "  refactor-id          Single refactor (e.g. R-007)"
    echo "  R-008:R-013          Range of refactors (inclusive)"
    echo "  --auto-skipped       Reset all auto_skipped refactors"
    echo "  --failed             Reset all failed refactors"
    echo "  --stalled            Reset all non-completed (failed + auto_skipped)"
    echo "  --clean              Delete session history and .prizmkit artifacts"
    echo "  --run                Retry immediately after reset (single refactor only)"
    echo "  .prizmkit/plans/refactor-list.json   Path to refactor list (default: .prizmkit/plans/refactor-list.json)"
    exit 1
fi

REFACTOR_LIST="${REFACTOR_LIST:-.prizmkit/plans/refactor-list.json}"

# Resolve absolute path
if [[ ! "$REFACTOR_LIST" = /* ]]; then
    REFACTOR_LIST="$(pwd)/$REFACTOR_LIST"
fi

# ============================================================
# Validation
# ============================================================

if [[ ! -f "$REFACTOR_LIST" ]]; then
    log_error "Refactor list not found: $REFACTOR_LIST"
    exit 1
fi

if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
    log_error "No pipeline state found. Run './run-refactor.sh run' first to initialize."
    exit 1
fi

# ============================================================
# Resolve refactor IDs to process
# ============================================================

REFACTOR_IDS=()

if [[ -n "$FILTER_MODE" ]]; then
    # Filter by status from refactor-list.json (single source of truth)
    while IFS= read -r rid; do
        [[ -n "$rid" ]] && REFACTOR_IDS+=("$rid")
    done < <(python3 -c "
import json, sys
filter_mode = '$FILTER_MODE'
refactor_list = '$REFACTOR_LIST'
with open(refactor_list) as f:
    data = json.load(f)
for r in data.get('refactors', []):
    if not isinstance(r, dict):
        continue
    rid = r.get('id', '')
    status = r.get('status', '')
    if filter_mode == 'auto_skipped' and status == 'auto_skipped':
        print(rid)
    elif filter_mode == 'failed' and status == 'failed':
        print(rid)
    elif filter_mode == 'stalled' and status in ('failed', 'auto_skipped'):
        print(rid)
" 2>/dev/null)

    if [[ ${#REFACTOR_IDS[@]} -eq 0 ]]; then
        log_info "No refactors found with status: $FILTER_MODE"
        exit 0
    fi
    log_info "Found ${#REFACTOR_IDS[@]} refactor(s) matching --$FILTER_MODE: ${REFACTOR_IDS[*]}"

elif [[ -n "$REFACTOR_RANGE" ]]; then
    # Parse range R-NNN:R-MMM
    RANGE_START="${REFACTOR_RANGE%%:*}"
    RANGE_END="${REFACTOR_RANGE##*:}"
    START_NUM=$(echo "$RANGE_START" | sed 's/[Rr]-//' | sed 's/^0*//')
    END_NUM=$(echo "$RANGE_END" | sed 's/[Rr]-//' | sed 's/^0*//')

    if [[ -z "$START_NUM" || -z "$END_NUM" || "$START_NUM" -gt "$END_NUM" ]]; then
        log_error "Invalid range: $REFACTOR_RANGE (start must be <= end)"
        exit 1
    fi

    for ((i=START_NUM; i<=END_NUM; i++)); do
        REFACTOR_IDS+=("R-$(printf '%03d' "$i")")
    done
    log_info "Range $REFACTOR_RANGE -> ${REFACTOR_IDS[*]}"

else
    REFACTOR_IDS=("$REFACTOR_ID")
fi

# --run only works with single refactor
if [[ "$DO_RUN" == true && ${#REFACTOR_IDS[@]} -gt 1 ]]; then
    log_warn "--run is only supported for single refactor reset. Use './run-refactor.sh run' to resume pipeline after batch reset."
    DO_RUN=false
fi

# ============================================================
# Process each refactor
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

for CUR_REFACTOR_ID in "${REFACTOR_IDS[@]}"; do

    # Get refactor info from refactor list
    REFACTOR_INFO=$(python3 -c "
import json, sys, re
with open('$REFACTOR_LIST') as f:
    data = json.load(f)
for item in data.get('refactors', []):
    if item.get('id') == '$CUR_REFACTOR_ID':
        title = item.get('title', '')
        # Compute slug
        numeric = '$CUR_REFACTOR_ID'.replace('R-', '').replace('r-', '').zfill(3)
        slug = title.lower()
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s]+', '-', slug.strip())
        slug = re.sub(r'-+', '-', slug).strip('-')
        slug = '{}-{}'.format(numeric, slug)
        print(json.dumps({'title': title, 'slug': slug, 'status': item.get('status', 'unknown')}))
        sys.exit(0)
sys.exit(1)
" 2>/dev/null) || {
        log_warn "Refactor $CUR_REFACTOR_ID not found in $REFACTOR_LIST -- skipping"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        continue
    }

    REFACTOR_TITLE=$(echo "$REFACTOR_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])")
    REFACTOR_SLUG=$(echo "$REFACTOR_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['slug'])")

    # -- Show current state --
    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  Reset: $CUR_REFACTOR_ID — $REFACTOR_TITLE${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"

    STATUS_FILE="$STATE_DIR/refactors/$CUR_REFACTOR_ID/status.json"
    # Read status from refactor-list.json (single source of truth)
    CURRENT_STATUS=$(python3 -c "
import json, sys
with open('$REFACTOR_LIST') as f:
    data = json.load(f)
for r in data.get('refactors', []):
    if isinstance(r, dict) and r.get('id') == '$CUR_REFACTOR_ID':
        print(r.get('status', '?'))
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

    SPECS_DIR="$PROJECT_ROOT/.prizmkit/specs/$REFACTOR_SLUG"
    SPECS_COUNT=0
    if [[ -d "$SPECS_DIR" ]]; then
        SPECS_COUNT=$(find "$SPECS_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
        log_info "PrizmKit artifacts: $SPECS_COUNT files in .prizmkit/specs/$REFACTOR_SLUG/"
    fi

    SESSIONS_DIR="$STATE_DIR/refactors/$CUR_REFACTOR_ID/sessions"
    SESSIONS_COUNT=0
    if [[ -d "$SESSIONS_DIR" ]]; then
        SESSIONS_COUNT=$(find "$SESSIONS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
        log_info "Session history: $SESSIONS_COUNT session(s)"
    fi

    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"

    # ── Git cleanup: discard dev branch changes ──
    # Find dev branches matching this refactor (pattern: refactor/{REFACTOR_ID}-*)
    DEV_BRANCHES=$(git -C "$PROJECT_ROOT" branch --list "refactor/${CUR_REFACTOR_ID}-*" 2>/dev/null | sed 's/^[* ]*//')
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
                    git -C "$PROJECT_ROOT" stash push --include-untracked -m "reset-refactor-temp" 2>/dev/null && _stashed=true
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
        log_info "Cleaning $CUR_REFACTOR_ID (reset + delete artifacts)..."
        RESULT=$(python3 "$SCRIPTS_DIR/update-refactor-status.py" \
            --refactor-list "$REFACTOR_LIST" \
            --state-dir "$STATE_DIR" \
            --refactor-id "$CUR_REFACTOR_ID" \
            --project-root "$PROJECT_ROOT" \
            --action clean 2>"$_reset_tmpstderr")
    else
        log_info "Resetting $CUR_REFACTOR_ID status..."
        RESULT=$(python3 "$SCRIPTS_DIR/update-refactor-status.py" \
            --refactor-list "$REFACTOR_LIST" \
            --state-dir "$STATE_DIR" \
            --refactor-id "$CUR_REFACTOR_ID" \
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
            log_success "$CUR_REFACTOR_ID cleaned: status -> pending, $SESSIONS_COUNT session(s) deleted, $SPECS_COUNT artifact(s) deleted, dev branch deleted"
        else
            log_success "$CUR_REFACTOR_ID reset: status -> pending, retry count -> 0, dev branch discarded"
        fi
    else
        ERROR_MSG=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null || echo "$RESULT")
        log_error "Reset $CUR_REFACTOR_ID failed: $ERROR_MSG"
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
if [[ "$DO_RUN" == true && ${#REFACTOR_IDS[@]} -eq 1 ]]; then
    log_info "Auto-retrying ${REFACTOR_IDS[0]}..."
    echo ""
    exec "$SCRIPT_DIR/run-refactor.sh" run "${REFACTOR_IDS[0]}" "$REFACTOR_LIST"
else
    log_info "  ./dev-pipeline/run-refactor.sh run .prizmkit/plans/refactor-list.json         # Resume pipeline from first pending"
    if [[ ${#REFACTOR_IDS[@]} -eq 1 ]]; then
        log_info "  ./dev-pipeline/run-refactor.sh run ${REFACTOR_IDS[0]}     # Run single refactor"
    fi
fi
echo ""
