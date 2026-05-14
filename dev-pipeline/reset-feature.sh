#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/reset-feature.sh - Reset a failed/stuck feature
#
# Resets status and discards uncommitted working tree changes on
# the dev branch, then returns to the original branch. Session
# history and .prizmkit artifacts are preserved for debugging.
#
# With --clean, also deletes session history, .prizmkit/specs/
# artifacts, and the dev branch itself.
#
# Usage:
#   ./reset-feature.sh <feature-id|range> [options] [.prizmkit/plans/feature-list.json]
#
# Feature selection:
#   F-007              Single feature
#   F-008:F-013        Range of features (inclusive)
#   --auto-skipped     All features with auto_skipped status
#   --failed           All features with failed status
#   --stalled          All non-completed features (failed + auto_skipped)
#
# Options:
#   --clean    Also delete session history, .prizmkit/specs/{slug}/ artifacts, and dev branch
#   --run      After reset, immediately retry via pipeline (only with single feature)
#
# Normal reset (no --clean):
#   - Resets status → pending, retry_count → 0
#   - Discards uncommitted changes on dev branch (git checkout -- . && git clean -fd)
#   - Returns to default branch (main/master)
#   - Preserves dev branch, session history, and .prizmkit artifacts for debugging
#
# Examples:
#   ./reset-feature.sh F-007                          # Reset status + discard changes
#   ./reset-feature.sh F-007 --clean                  # Reset + delete everything
#   ./reset-feature.sh F-008:F-013 --clean            # Reset range
#   ./reset-feature.sh --auto-skipped                 # Reset all auto_skipped
#   ./reset-feature.sh --failed --clean               # Reset all failed + clean
#   ./reset-feature.sh --stalled --clean              # Reset all non-completed
#   ./reset-feature.sh F-007 --clean --run             # Reset + delete + retry
#   ./reset-feature.sh F-007 --clean my-features.json  # Custom feature list
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="${PROJECT_ROOT}/.prizmkit/state/features"
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

FEATURE_ID=""
FEATURE_RANGE=""
FEATURE_LIST=""
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
            echo "Usage: $0 <feature-id|range> [--clean] [--run] [--auto-skipped|--failed|--stalled] [.prizmkit/plans/feature-list.json]"
            echo ""
            echo "  feature-id          Single feature (e.g. F-007)"
            echo "  F-008:F-013         Range of features (inclusive)"
            echo "  --auto-skipped      Reset all auto_skipped features"
            echo "  --failed            Reset all failed features"
            echo "  --stalled           Reset all non-completed (failed + auto_skipped)"
            echo "  --clean             Delete session history, .prizmkit artifacts, and dev branch"
            echo "  --run               Retry immediately after reset (single feature only)"
            echo "  .prizmkit/plans/feature-list.json   Path to feature list (default: .prizmkit/plans/feature-list.json)"
            exit 0
            ;;
        F-*:F-*|f-*:f-*)  FEATURE_RANGE="$arg" ;;
        F-*|f-*)           FEATURE_ID="$arg" ;;
        *)                 FEATURE_LIST="$arg" ;;
    esac
done

if [[ -z "$FEATURE_ID" && -z "$FEATURE_RANGE" && -z "$FILTER_MODE" ]]; then
    echo "Usage: $0 <feature-id|range> [--clean] [--run] [--auto-skipped|--failed|--stalled] [.prizmkit/plans/feature-list.json]"
    echo ""
    echo "  feature-id          Single feature (e.g. F-007)"
    echo "  F-008:F-013         Range of features (inclusive)"
    echo "  --auto-skipped      Reset all auto_skipped features"
    echo "  --failed            Reset all failed features"
    echo "  --stalled           Reset all non-completed (failed + auto_skipped)"
    echo "  --clean             Delete session history and .prizmkit artifacts"
    echo "  --run               Retry immediately after reset (single feature only)"
    echo "  .prizmkit/plans/feature-list.json   Path to feature list (default: .prizmkit/plans/feature-list.json)"
    exit 1
fi

FEATURE_LIST="${FEATURE_LIST:-.prizmkit/plans/feature-list.json}"

# Resolve absolute path
if [[ ! "$FEATURE_LIST" = /* ]]; then
    FEATURE_LIST="$(pwd)/$FEATURE_LIST"
fi

# ============================================================
# Validation
# ============================================================

if [[ ! -f "$FEATURE_LIST" ]]; then
    log_error "Feature list not found: $FEATURE_LIST"
    exit 1
fi

if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
    log_error "No pipeline state found. Run './run-feature.sh run' first to initialize."
    exit 1
fi

# ============================================================
# Resolve feature IDs to process
# ============================================================

FEATURE_IDS=()

if [[ -n "$FILTER_MODE" ]]; then
    # Filter by status from feature-list.json (single source of truth)
    while IFS= read -r fid; do
        [[ -n "$fid" ]] && FEATURE_IDS+=("$fid")
    done < <(python3 -c "
import json, sys
filter_mode = '$FILTER_MODE'
feature_list = '$FEATURE_LIST'
with open(feature_list) as f:
    data = json.load(f)
for feat in data.get('features', []):
    if not isinstance(feat, dict):
        continue
    fid = feat.get('id', '')
    status = feat.get('status', '')
    if filter_mode == 'auto_skipped' and status == 'auto_skipped':
        print(fid)
    elif filter_mode == 'failed' and status == 'failed':
        print(fid)
    elif filter_mode == 'stalled' and status in ('failed', 'auto_skipped'):
        print(fid)
" 2>/dev/null)

    if [[ ${#FEATURE_IDS[@]} -eq 0 ]]; then
        log_info "No features found with status: $FILTER_MODE"
        exit 0
    fi
    log_info "Found ${#FEATURE_IDS[@]} feature(s) matching --$FILTER_MODE: ${FEATURE_IDS[*]}"

elif [[ -n "$FEATURE_RANGE" ]]; then
    # Parse range F-NNN:F-MMM
    RANGE_START="${FEATURE_RANGE%%:*}"
    RANGE_END="${FEATURE_RANGE##*:}"
    START_NUM=$(echo "$RANGE_START" | sed 's/[Ff]-//' | sed 's/^0*//')
    END_NUM=$(echo "$RANGE_END" | sed 's/[Ff]-//' | sed 's/^0*//')

    if [[ -z "$START_NUM" || -z "$END_NUM" || "$START_NUM" -gt "$END_NUM" ]]; then
        log_error "Invalid range: $FEATURE_RANGE (start must be <= end)"
        exit 1
    fi

    for ((i=START_NUM; i<=END_NUM; i++)); do
        FEATURE_IDS+=("F-$(printf '%03d' "$i")")
    done
    log_info "Range $FEATURE_RANGE → ${FEATURE_IDS[*]}"

else
    FEATURE_IDS=("$FEATURE_ID")
fi

# --run only works with single feature
if [[ "$DO_RUN" == true && ${#FEATURE_IDS[@]} -gt 1 ]]; then
    log_warn "--run is only supported for single feature reset. Use './run-feature.sh run' to resume pipeline after batch reset."
    DO_RUN=false
fi

# ============================================================
# Process each feature
# ============================================================

PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESET_COUNT=0
FAIL_COUNT=0

# Detect default branch (main or master)
DEFAULT_BRANCH=$(git -C "$PROJECT_ROOT" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "")
if [[ -z "$DEFAULT_BRANCH" ]]; then
    # Fallback: check if main or master exists
    if git -C "$PROJECT_ROOT" rev-parse --verify main >/dev/null 2>&1; then
        DEFAULT_BRANCH="main"
    elif git -C "$PROJECT_ROOT" rev-parse --verify master >/dev/null 2>&1; then
        DEFAULT_BRANCH="master"
    else
        DEFAULT_BRANCH=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    fi
fi

for CUR_FEATURE_ID in "${FEATURE_IDS[@]}"; do

    # Get feature info from feature list
    FEATURE_INFO=$(python3 -c "
import json, sys, re
with open('$FEATURE_LIST') as f:
    data = json.load(f)
for feat in data.get('features', []):
    if feat.get('id') == '$CUR_FEATURE_ID':
        title = feat.get('title', '')
        # Compute slug
        numeric = '$CUR_FEATURE_ID'.replace('F-', '').replace('f-', '').zfill(3)
        slug = title.lower()
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s]+', '-', slug.strip())
        slug = re.sub(r'-+', '-', slug).strip('-')
        slug = '{}-{}'.format(numeric, slug)
        print(json.dumps({'title': title, 'slug': slug, 'status': feat.get('status', 'unknown')}))
        sys.exit(0)
sys.exit(1)
" 2>/dev/null) || {
        log_warn "Feature $CUR_FEATURE_ID not found in $FEATURE_LIST — skipping"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        continue
    }

    FEATURE_TITLE=$(echo "$FEATURE_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])")
    FEATURE_SLUG=$(echo "$FEATURE_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['slug'])")

    # ── Show current state ──
    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  Reset: $CUR_FEATURE_ID — $FEATURE_TITLE${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"

    STATUS_FILE="$STATE_DIR/features/$CUR_FEATURE_ID/status.json"
    # Read status from feature-list.json (single source of truth)
    CURRENT_STATUS=$(python3 -c "
import json, sys
with open('$FEATURE_LIST') as f:
    data = json.load(f)
for feat in data.get('features', []):
    if isinstance(feat, dict) and feat.get('id') == '$CUR_FEATURE_ID':
        print(feat.get('status', '?'))
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

    SPECS_DIR="$PROJECT_ROOT/.prizmkit/specs/$FEATURE_SLUG"
    SPECS_COUNT=0
    if [[ -d "$SPECS_DIR" ]]; then
        SPECS_COUNT=$(find "$SPECS_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
        log_info "PrizmKit artifacts: $SPECS_COUNT files in .prizmkit/specs/$FEATURE_SLUG/"
    fi

    SESSIONS_DIR="$STATE_DIR/features/$CUR_FEATURE_ID/sessions"
    SESSIONS_COUNT=0
    if [[ -d "$SESSIONS_DIR" ]]; then
        SESSIONS_COUNT=$(find "$SESSIONS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
        log_info "Session history: $SESSIONS_COUNT session(s)"
    fi

    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"

    # ── Git cleanup: discard dev branch changes ──
    # Find dev branches matching this feature (pattern: dev/{FEATURE_ID}-*)
    DEV_BRANCHES=$(git -C "$PROJECT_ROOT" branch --list "dev/${CUR_FEATURE_ID}-*" 2>/dev/null | sed 's/^[* ]*//')
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
                # Temporarily switch, discard, switch back
                _stashed=false
                _dirty=""
                _dirty=$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null || true)
                if [[ -n "$_dirty" ]]; then
                    git -C "$PROJECT_ROOT" stash push --include-untracked -m "reset-feature-temp" 2>/dev/null && _stashed=true
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

    # ── Execute reset ──
    _reset_tmpstderr=$(mktemp)
    if [[ "$DO_CLEAN" == true ]]; then
        log_info "Cleaning $CUR_FEATURE_ID (reset + delete artifacts)..."
        RESULT=$(python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "$FEATURE_LIST" \
            --state-dir "$STATE_DIR" \
            --feature-id "$CUR_FEATURE_ID" \
            --feature-slug "$FEATURE_SLUG" \
            --project-root "$PROJECT_ROOT" \
            --action clean 2>"$_reset_tmpstderr")
    else
        log_info "Resetting $CUR_FEATURE_ID status..."
        RESULT=$(python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "$FEATURE_LIST" \
            --state-dir "$STATE_DIR" \
            --feature-id "$CUR_FEATURE_ID" \
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
            log_success "$CUR_FEATURE_ID cleaned: status → pending, $SESSIONS_COUNT session(s) deleted, $SPECS_COUNT artifact(s) deleted, dev branch deleted"
        else
            log_success "$CUR_FEATURE_ID reset: status → pending, retry count → 0, dev branch discarded"
        fi
    else
        ERROR_MSG=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null || echo "$RESULT")
        log_error "Reset $CUR_FEATURE_ID failed: $ERROR_MSG"
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
if [[ "$DO_RUN" == true && ${#FEATURE_IDS[@]} -eq 1 ]]; then
    log_info "Auto-retrying ${FEATURE_IDS[0]}..."
    echo ""
    exec "$SCRIPT_DIR/run-feature.sh" run "${FEATURE_IDS[0]}" "$FEATURE_LIST"
else
    log_info "  ./dev-pipeline/run-feature.sh run .prizmkit/plans/feature-list.json         # Resume pipeline from first pending"
    if [[ ${#FEATURE_IDS[@]} -eq 1 ]]; then
        log_info "  ./dev-pipeline/run-feature.sh run ${FEATURE_IDS[0]}     # Run single feature"
    fi
fi
echo ""
