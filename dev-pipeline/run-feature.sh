#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/run-feature.sh - Autonomous Dev Pipeline Runner
#
# Drives the prizm-dev-team multi-agent team through iterative
# AI CLI sessions (CodeBuddy or Claude Code) to build a complete app
# from a feature list.
#
# Usage:
#   ./run-feature.sh run [.prizmkit/plans/feature-list.json]            Run all features
#   ./run-feature.sh run <feature-id> [options]         Run a single feature
#   ./run-feature.sh status [.prizmkit/plans/feature-list.json]         Show pipeline status
#   ./run-feature.sh reset                              Clear all state
#
# Environment Variables:
#   MAX_RETRIES           Max retries per feature (default: 3)
#   SESSION_TIMEOUT       Session timeout in seconds (default: 0 = no limit)
#   AI_CLI                AI CLI command name (override; also readable from .prizmkit/config.json)
#   CODEBUDDY_CLI         Legacy alias for AI_CLI (deprecated, use AI_CLI instead)
#   PRIZMKIT_PLATFORM     Force platform: 'codebuddy' or 'claude' (auto-detected)
#   MODEL                 AI model to use (e.g. claude-opus-4.6, claude-sonnet-4.6, claude-haiku-4.5)
#   VERBOSE               Set to 1 to enable --verbose on AI CLI (shows subagent output)
#   HEARTBEAT_INTERVAL    Heartbeat log interval in seconds (default: 30)
#   STALE_KILL_THRESHOLD   Auto-kill session after N seconds of no progress (default: 900)
#   HEARTBEAT_STALE_THRESHOLD  Heartbeat stale threshold in seconds (default: 600)
#   LOG_CLEANUP_ENABLED   Run periodic log cleanup (default: 1)
#   LOG_RETENTION_DAYS    Delete logs older than N days (default: 14)
#   LOG_MAX_TOTAL_MB      Keep total logs under N MB via oldest-first cleanup (default: 1024)
#   PIPELINE_MODE         Override mode for all features: lite|standard|full (used by daemon)
#   DEV_BRANCH            Custom dev branch name (default: auto-generated dev/{feature_id}-YYYYMMDDHHmm)
#   AUTO_PUSH             Auto-push to remote after successful feature (default: 0). Set to 1 to enable.
#   STOP_ON_FAILURE       Stop pipeline after a task exhausts all retries (default: 0). Set to 1 to stop.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
STATE_DIR="${PROJECT_ROOT}/.prizmkit/state/features"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"

# Configuration (override via environment variables)
MAX_RETRIES=${MAX_RETRIES:-3}
SESSION_TIMEOUT=${SESSION_TIMEOUT:-0}
HEARTBEAT_STALE_THRESHOLD=${HEARTBEAT_STALE_THRESHOLD:-600}
HEARTBEAT_INTERVAL=${HEARTBEAT_INTERVAL:-30}
STALE_KILL_THRESHOLD=${STALE_KILL_THRESHOLD:-900}
LOG_CLEANUP_ENABLED=${LOG_CLEANUP_ENABLED:-1}
LOG_RETENTION_DAYS=${LOG_RETENTION_DAYS:-14}
LOG_MAX_TOTAL_MB=${LOG_MAX_TOTAL_MB:-1024}
VERBOSE=${VERBOSE:-0}
MODEL=${MODEL:-""}
DEV_BRANCH=${DEV_BRANCH:-""}
AUTO_PUSH=${AUTO_PUSH:-0}
STOP_ON_FAILURE=${STOP_ON_FAILURE:-0}
ENABLE_DEPLOY=${ENABLE_DEPLOY:-0}

# Source shared common helpers (CLI/platform detection + logs + deps)
source "$SCRIPT_DIR/lib/common.sh"
prizm_detect_cli_and_platform

# Source shared heartbeat library
source "$SCRIPT_DIR/lib/heartbeat.sh"

# Source shared branch library
source "$SCRIPT_DIR/lib/branch.sh"

# Detect stream-json support
detect_stream_json_support "$CLI_CMD"

# Feature list path (set in main, used by cleanup trap)
FEATURE_LIST=""

# Branch tracking (for cleanup on interrupt)
_ORIGINAL_BRANCH=""
_DEV_BRANCH_NAME=""

# ============================================================
# Shared: Spawn an AI CLI session and wait for result
# ============================================================

# Spawns an AI CLI session with heartbeat + timeout, waits for completion,
# checks session status, and updates feature status.
#
# Arguments:
#   $1 - feature_id
#   $2 - feature_list (absolute path)
#   $3 - session_id
#   $4 - bootstrap_prompt (path)
#   $5 - session_dir
#   $6 - max_retries (for status update)
spawn_and_wait_session() {
    local feature_id="$1"
    local feature_list="$2"
    local session_id="$3"
    local bootstrap_prompt="$4"
    local session_dir="$5"
    local max_retries="$6"
    local feature_model="${7:-}"
    local base_branch="${8:-main}"

    local session_log="$session_dir/logs/session.log"
    local progress_json="$session_dir/logs/progress.json"

    # Spawn AI CLI session
    local verbose_flag=""
    if [[ "$VERBOSE" == "1" ]]; then
        verbose_flag="--verbose"
    fi

    local stream_json_flag=""
    if [[ "$USE_STREAM_JSON" == "true" ]]; then
        stream_json_flag="--output-format stream-json"
        # claude-internal requires --verbose when using stream-json with -p/--print
        verbose_flag="--verbose"
    fi

    local model_flag=""
    local effective_model="${feature_model:-$MODEL}"
    if [[ -n "$effective_model" ]]; then
        model_flag="--model $effective_model"
    fi

    # Unset CLAUDECODE to prevent "nested session" error when launched from
    # within an existing Claude Code session (e.g. via launch-feature-daemon.sh).
    unset CLAUDECODE 2>/dev/null || true

    case "$CLI_CMD" in
        *claude*)
            # Claude Code: prompt via stdin to avoid Windows argument length limit (~32KB)
            "$CLI_CMD" \
                --print \
                --dangerously-skip-permissions \
                $verbose_flag \
                $stream_json_flag \
                $model_flag \
                < "$bootstrap_prompt" \
                > "$session_log" 2>&1 &
            ;;
        *)
            # CodeBuddy (cbc) and others: prompt via stdin
            "$CLI_CMD" \
                --print \
                -y \
                $verbose_flag \
                $stream_json_flag \
                $model_flag \
                < "$bootstrap_prompt" \
                > "$session_log" 2>&1 &
            ;;
    esac
    local cbc_pid=$!

    # Start progress parser (no-op if stream-json not supported)
    start_progress_parser "$session_log" "$progress_json" "$SCRIPTS_DIR"
    local parser_pid="${_PARSER_PID:-}"

    # Timeout watchdog (only if SESSION_TIMEOUT > 0)
    local watcher_pid=""
    if [[ $SESSION_TIMEOUT -gt 0 ]]; then
        ( sleep "$SESSION_TIMEOUT" && kill -TERM "$cbc_pid" 2>/dev/null ) &
        watcher_pid=$!
    fi

    # Heartbeat monitor (reads progress.json when available, falls back to tail)
    # Also monitors for stale sessions and auto-kills if no progress for STALE_KILL_THRESHOLD seconds
    start_heartbeat "$cbc_pid" "$session_log" "$progress_json" "$HEARTBEAT_INTERVAL" "$STALE_KILL_THRESHOLD"
    local heartbeat_pid="${_HEARTBEAT_PID:-}"

    # Wait for AI CLI to finish
    local exit_code=0
    if wait "$cbc_pid" 2>/dev/null; then
        exit_code=0
    else
        exit_code=$?
    fi

    # Clean up watcher, heartbeat, and parser
    [[ -n "$watcher_pid" ]] && kill "$watcher_pid" 2>/dev/null || true
    stop_heartbeat "$heartbeat_pid"
    stop_progress_parser "$parser_pid"
    [[ -n "$watcher_pid" ]] && wait "$watcher_pid" 2>/dev/null || true

    # Map SIGTERM (143) to timeout code 124
    if [[ $exit_code -eq 143 ]]; then
        exit_code=124
    fi

    # Check for stale-kill marker (heartbeat killed the process due to no progress)
    local stale_kill_marker="$session_dir/logs/stale-kill.json"
    local was_stale_killed=false
    if [[ -f "$stale_kill_marker" ]]; then
        was_stale_killed=true
        log_warn "Session was stale-killed by heartbeat monitor (no progress for too long)"
    fi

    # Show final session summary
    if [[ -f "$session_log" ]]; then
        local final_size=$(wc -c < "$session_log" 2>/dev/null | tr -d ' ')
        local final_lines=$(wc -l < "$session_log" 2>/dev/null | tr -d ' ')
        log_info "Session log: $final_lines lines, $((final_size / 1024))KB"
    fi
    log_info "exit_code=$exit_code"

    # ── Determine session outcome from observable signals ──────────────
    # No dependency on session-status.json — uses exit code, git commits,
    # and working tree cleanliness as the single source of truth.
    local session_status
    local project_root
    project_root="$(cd "$SCRIPT_DIR/.." && pwd)"
    local default_branch="$base_branch"

    if [[ $exit_code -eq 124 ]]; then
        log_warn "Session timed out after ${SESSION_TIMEOUT}s"
        session_status="timed_out"
    elif [[ "$was_stale_killed" == true ]]; then
        log_warn "Session stale-killed (no progress for ${STALE_KILL_THRESHOLD}s)"
        # Treat stale-killed as potentially successful — check for commits
        local has_commits=""
        if git -C "$project_root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
            has_commits=$(git -C "$project_root" log "${default_branch}..HEAD" --oneline 2>/dev/null | head -1)
        fi
        if [[ -n "$has_commits" ]]; then
            log_info "Stale-killed session has commits — treating as success"
            session_status="success"
        else
            local uncommitted=""
            uncommitted=$(git -C "$project_root" status --porcelain 2>/dev/null | head -1 || true)
            if [[ -n "$uncommitted" ]]; then
                log_warn "Stale-killed session has uncommitted changes — auto-committing..."
                git -C "$project_root" add -A 2>/dev/null || true
                if git -C "$project_root" commit --no-verify -m "chore($feature_id): auto-commit session work (stale-killed)" 2>/dev/null; then
                    log_info "Auto-commit succeeded"
                    session_status="success"
                else
                    log_warn "Auto-commit failed — no changes to commit"
                    session_status="crashed"
                fi
            else
                log_warn "Stale-killed session produced no commits and no changes"
                session_status="crashed"
            fi
        fi
    elif [[ $exit_code -ne 0 ]]; then
        log_warn "Session exited with code $exit_code"
        session_status="crashed"
    else
        # Exit code 0 — check if the session actually produced commits
        local has_commits=""
        if git -C "$project_root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
            has_commits=$(git -C "$project_root" log "${default_branch}..HEAD" --oneline 2>/dev/null | head -1)
        fi

        if [[ -n "$has_commits" ]]; then
            session_status="success"
        else
            # No commits found — check if there are uncommitted changes (session
            # did work but didn't commit, e.g. context window exhausted)
            local uncommitted=""
            uncommitted=$(git -C "$project_root" status --porcelain 2>/dev/null | head -1 || true)
            if [[ -n "$uncommitted" ]]; then
                log_warn "Session exited cleanly but produced no commits (uncommitted changes found) — auto-committing..."
                git -C "$project_root" add -A 2>/dev/null || true
                if git -C "$project_root" commit --no-verify -m "chore($feature_id): auto-commit session work" 2>/dev/null; then
                    log_info "Auto-commit succeeded"
                    session_status="success"
                else
                    log_warn "Auto-commit failed — no changes to commit"
                    session_status="crashed"
                fi
            else
                log_warn "Session exited cleanly but produced no commits and no changes"
                session_status="crashed"
            fi
        fi
    fi

    # ── Post-success validation ──────────────────────────────────────────
    if [[ "$session_status" == "success" ]]; then
        if git -C "$project_root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
            # Auto-commit any remaining dirty files produced during the session
            local dirty_files=""
            dirty_files=$(git -C "$project_root" status --porcelain 2>/dev/null || true)
            if [[ -n "$dirty_files" ]]; then
                log_info "Auto-committing remaining session artifacts..."
                git -C "$project_root" add -A 2>/dev/null || true
                git -C "$project_root" commit --no-verify --amend --no-edit 2>/dev/null \
                    || git -C "$project_root" commit --no-verify -m "chore($feature_id): include remaining session artifacts" 2>/dev/null \
                    || true
            fi
        fi
    fi

    log_info "Session result: $session_status"

    # Subagent detection
    prizm_detect_subagents "$session_log"

    # Write lightweight session summary for post-session inspection
    local feature_slug
    feature_slug=$(python3 -c "
import json, re, sys
flist, fid = sys.argv[1], sys.argv[2]
with open(flist) as f:
    data = json.load(f)
for feat in data.get('features', []):
    if feat.get('id') == fid:
        fnum = feat['id'].replace('F-', '').replace('f-', '').zfill(3)
        title = feat.get('title', '').lower()
        title = re.sub(r'[^a-z0-9\s-]', '', title)
        title = re.sub(r'[\s]+', '-', title.strip())
        title = re.sub(r'-+', '-', title).strip('-')
        print(f'{fnum}-{title}')
        sys.exit(0)
sys.exit(1)
" "$feature_list" "$feature_id" 2>/dev/null) || {
        log_warn "Could not resolve feature slug for $feature_id — session summary and artifact validation will be skipped"
        feature_slug=""
    }

    # Validate key artifacts exist after successful session
    if [[ "$session_status" == "success" && -n "$feature_slug" ]]; then
        local project_root_for_artifacts
        project_root_for_artifacts="$(cd "$SCRIPT_DIR/.." && pwd)"
        local context_snapshot="$project_root_for_artifacts/.prizmkit/specs/${feature_slug}/context-snapshot.md"
        local plan_file="$project_root_for_artifacts/.prizmkit/specs/${feature_slug}/plan.md"

        if [[ ! -f "$context_snapshot" ]]; then
            log_warn "ARTIFACT_MISSING: context-snapshot.md not found at $context_snapshot"
        fi
        if [[ ! -f "$plan_file" ]]; then
            log_warn "ARTIFACT_MISSING: plan.md not found at $plan_file"
        fi

        # Validate checkpoint completeness
        local checkpoint_file="$project_root_for_artifacts/.prizmkit/specs/${feature_slug}/workflow-checkpoint.json"
        if [[ -f "$checkpoint_file" ]]; then
            local checkpoint_result
            checkpoint_result=$(python3 -c "
import json, sys
try:
    with open(sys.argv[1]) as f:
        data = json.load(f)
except json.JSONDecodeError as e:
    print('CORRUPTED: {}'.format(e))
    sys.exit(2)
incomplete = [s for s in data['steps'] if s['status'] not in ('completed', 'skipped')]
if incomplete:
    for s in incomplete:
        print('INCOMPLETE: {} {} = {}'.format(s['id'], s['skill'], s['status']))
    sys.exit(1)
print('ALL_COMPLETE')
sys.exit(0)
" "$checkpoint_file" 2>&1) || checkpoint_result="CHECK_FAILED"
            local check_exit=$?
            if [[ "$checkpoint_result" == "CHECK_FAILED" ]]; then
                check_exit=2
            elif [[ "$checkpoint_result" == *"INCOMPLETE"* ]]; then
                check_exit=1
            else
                check_exit=0
            fi
            if [[ $check_exit -eq 2 ]]; then
                log_warn "CHECKPOINT_CORRUPTED: workflow-checkpoint.json is not valid JSON"
            elif [[ $check_exit -eq 1 ]]; then
                log_warn "CHECKPOINT_INCOMPLETE: Not all workflow steps completed:"
                echo "$checkpoint_result" | while read -r line; do log_warn "  $line"; done
            else
                log_info "CHECKPOINT: All workflow steps completed"
            fi
        else
            log_info "CHECKPOINT: No workflow-checkpoint.json found (checkpoint system not active)"
        fi
    fi

    # Check if session produced a failure-log for future retries
    if [[ "$session_status" != "success" && -n "$feature_slug" ]]; then
        local project_root_for_failure
        project_root_for_failure="$(cd "$SCRIPT_DIR/.." && pwd)"
        local failure_log="$project_root_for_failure/.prizmkit/specs/${feature_slug}/failure-log.md"
        if [[ -f "$failure_log" ]]; then
            log_info "FAILURE_LOG: Session wrote failure-log.md — will be available to next retry"
        else
            log_info "FAILURE_LOG: No failure-log.md written by session"
        fi
    fi

    # Propagate completion notes for dependency context (only on success)
    if [[ "$session_status" == "success" && -n "$feature_slug" ]]; then
        local summary_path="$project_root/.prizmkit/specs/$feature_slug/completion-summary.json"
        if [[ -f "$summary_path" ]]; then
            python3 "$SCRIPTS_DIR/patch-completion-notes.py" \
                --feature-list "$feature_list" \
                --feature-id "$feature_id" \
                --summary "$summary_path" >/dev/null 2>&1 && {
                log_info "Propagated completion notes for $feature_id to feature-list.json"
            } || {
                log_warn "Failed to propagate completion notes for $feature_id"
            }
        else
            log_info "No completion-summary.json for $feature_id — dependency context will be limited"
        fi
    fi

    # Update feature status (do NOT commit on dev branch — commit happens after merge)
    local update_output
    update_output=$(python3 "$SCRIPTS_DIR/update-feature-status.py" \
        --feature-list "$feature_list" \
        --state-dir "$STATE_DIR" \
        --feature-id "$feature_id" \
        --session-status "$session_status" \
        --session-id "$session_id" \
        --max-retries "$max_retries" \
        --action update 2>&1) || {
        log_error "Failed to update feature status: $update_output"
        log_error ".prizmkit/plans/feature-list.json may be out of sync. Manual intervention needed."
    }

    # Return status via global variable (avoids $() swallowing stdout)
    _SPAWN_RESULT="$session_status"
}

# ============================================================
# Graceful Shutdown
# ============================================================

cleanup() {
    echo ""
    log_warn "Received interrupt signal. Saving state..."

    # Kill all child processes (claude-internal, heartbeat, progress parser, etc.)
    kill 0 2>/dev/null || true

    # Log current branch info for recovery
    if [[ -n "$_DEV_BRANCH_NAME" ]]; then
        log_info "Development was on branch: $_DEV_BRANCH_NAME"
        log_info "Original branch was: $_ORIGINAL_BRANCH"
    fi

    # Update status of currently in-progress feature to interrupted
    if [[ -n "$FEATURE_LIST" && -f "$FEATURE_LIST" ]]; then
        # Find any in-progress feature and mark it as interrupted
        local _interrupted_id
        _interrupted_id=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for feat in data.get('features', []):
    if feat.get('status') == 'in_progress':
        print(feat['id'])
        break
" "$FEATURE_LIST" 2>/dev/null || echo "")

        if [[ -n "$_interrupted_id" ]]; then
            python3 "$SCRIPTS_DIR/update-feature-status.py" \
                --feature-list "$FEATURE_LIST" \
                --state-dir "$STATE_DIR" \
                --feature-id "$_interrupted_id" \
                --session-status "failed" \
                --action update 2>/dev/null || true
            log_info "Feature $_interrupted_id marked as failed due to interrupt"
        fi

        # Pause the pipeline (mark remaining pending items)
        python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "$FEATURE_LIST" \
            --state-dir "$STATE_DIR" \
            --action pause 2>/dev/null || true
    fi

    # GUARANTEED: always return to original branch (save WIP on dev branch first)
    branch_ensure_return "$(cd "$SCRIPT_DIR/.." && pwd)" "$_ORIGINAL_BRANCH" "$_DEV_BRANCH_NAME"

    log_info "Pipeline paused. Run './run-feature.sh run' to resume."
    exit 130
}
trap cleanup SIGINT SIGTERM

# ============================================================
# Dependency Check
# ============================================================

check_dependencies() {
    prizm_check_common_dependencies "$CLI_CMD"
    local _project_root
    _project_root="$(cd "$SCRIPT_DIR/.." && pwd)"
    prizm_ensure_git_repo "$_project_root"
}

run_log_cleanup() {
    if [[ "$LOG_CLEANUP_ENABLED" != "1" ]]; then
        return 0
    fi

    local cleanup_result
    cleanup_result=$(python3 "$SCRIPTS_DIR/cleanup-logs.py" \
        --state-dir "$STATE_DIR" \
        --retention-days "$LOG_RETENTION_DAYS" \
        --max-total-mb "$LOG_MAX_TOTAL_MB" 2>/dev/null) || {
        log_warn "Log cleanup failed (continuing)"
        return 0
    }

    local deleted reclaimed_kb
    deleted=$(echo "$cleanup_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('deleted_files', 0))" 2>/dev/null || echo "0")
    reclaimed_kb=$(echo "$cleanup_result" | python3 -c "import sys,json; print(int(json.load(sys.stdin).get('reclaimed_bytes', 0)/1024))" 2>/dev/null || echo "0")

    if [[ "$deleted" -gt 0 ]]; then
        log_info "Log cleanup: deleted $deleted files, reclaimed ${reclaimed_kb}KB"
    fi
}

# ============================================================
# run-one: Run a single feature with full control
# ============================================================

run_one() {
    local feature_id=""
    local feature_list=""
    local dry_run=false
    local resume_phase=""
    local mode_override=""
    local critic_override=""
    local do_clean=false
    local no_reset=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run)
                dry_run=true
                shift
                ;;
            --resume-phase)
                shift
                if [[ $# -eq 0 ]]; then
                    log_error "--resume-phase requires a value"
                    exit 1
                fi
                resume_phase="$1"
                shift
                ;;
            --mode)
                shift
                if [[ $# -eq 0 ]]; then
                    log_error "--mode requires a value (lite|standard|full)"
                    exit 1
                fi
                case "$1" in
                    lite|standard|full)
                        mode_override="$1"
                        ;;
                    *)
                        log_error "Invalid mode: $1 (must be lite, standard, or full)"
                        exit 1
                        ;;
                esac
                shift
                ;;
            --clean)
                do_clean=true
                shift
                ;;
            --no-reset)
                no_reset=true
                shift
                ;;
            --critic)
                critic_override="true"
                shift
                ;;
            --no-critic)
                critic_override="false"
                shift
                ;;
            --timeout)
                shift
                if [[ $# -eq 0 ]]; then
                    log_error "--timeout requires a value in seconds"
                    exit 1
                fi
                SESSION_TIMEOUT="$1"
                shift
                ;;
            F-*|f-*)
                feature_id="$1"
                shift
                ;;
            *)
                feature_list="$1"
                shift
                ;;
        esac
    done

    # Validate required args
    if [[ -z "$feature_id" ]]; then
        log_error "Feature ID is required (e.g. F-007)"
        echo ""
        show_help
        exit 1
    fi

    # Default feature list
    if [[ -z "$feature_list" ]]; then
        feature_list=".prizmkit/plans/feature-list.json"
    fi

    # Resolve to absolute path
    if [[ ! "$feature_list" = /* ]]; then
        feature_list="$(pwd)/$feature_list"
    fi

    FEATURE_LIST="$feature_list"

    # Default resume phase
    if [[ -z "$resume_phase" ]]; then
        resume_phase="null"
    fi

    # Validation
    if [[ ! -f "$feature_list" ]]; then
        log_error "Feature list not found: $feature_list"
        exit 1
    fi

    check_dependencies
    run_log_cleanup

    # Initialize pipeline state if needed (same logic as run_all)
    if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
        log_info "Initializing pipeline state for single-feature run..."
        local init_result init_stderr init_tmpstderr
        init_tmpstderr=$(mktemp)
        if ! init_result=$(python3 "$SCRIPTS_DIR/init-pipeline.py" \
            --feature-list "$feature_list" \
            --state-dir "$STATE_DIR" 2>"$init_tmpstderr"); then
            init_stderr=$(cat "$init_tmpstderr" 2>/dev/null || true)
            rm -f "$init_tmpstderr"
            if [[ -n "$init_stderr" ]]; then
                log_warn "$init_stderr"
            fi
            log_error "Pipeline initialization failed (script error)"
            exit 1
        fi
        init_stderr=$(cat "$init_tmpstderr" 2>/dev/null || true)
        rm -f "$init_tmpstderr"

        # Show any stderr warnings without corrupting JSON
        if [[ -n "$init_stderr" ]]; then
            log_warn "$init_stderr"
        fi

        local init_valid
        init_valid=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('valid', False))" 2>/dev/null || echo "False")

        if [[ "$init_valid" != "True" ]]; then
            log_error "Pipeline initialization failed:"
            echo "$init_result"
            exit 1
        fi

        local features_count
        features_count=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('features_count', 0))" 2>/dev/null || echo "0")
        log_success "Pipeline initialized with $features_count features"
    fi

    # Verify feature exists
    local feature_title
    feature_title=$(python3 -c "
import json, sys
feature_list_path, fid = sys.argv[1], sys.argv[2]
with open(feature_list_path) as f:
    data = json.load(f)
for feat in data.get('features', []):
    if feat.get('id') == fid:
        print(feat.get('title', ''))
        sys.exit(0)
sys.exit(1)
" "$feature_list" "$feature_id" 2>/dev/null) || {
        log_error "Feature $feature_id not found in $feature_list"
        exit 1
    }

    # Optional Clean
    if [[ "$do_clean" == true ]]; then
        if [[ "$dry_run" == true ]]; then
            log_warn "Dry-run mode: --clean ignored (no artifacts will be deleted)"
        else
            log_info "Cleaning artifacts for $feature_id..."

            local feature_slug
            feature_slug=$(python3 -c "
import json, re, sys
feature_list_path, fid = sys.argv[1], sys.argv[2]
with open(feature_list_path) as f:
    data = json.load(f)
for feat in data.get('features', []):
    if feat.get('id') == fid:
        fnum = feat['id'].replace('F-', '').replace('f-', '').zfill(3)
        title = feat.get('title', '').lower()
        title = re.sub(r'[^a-z0-9\s-]', '', title)
        title = re.sub(r'[\s]+', '-', title.strip())
        title = re.sub(r'-+', '-', title).strip('-')
        print(f'{fnum}-{title}')
        sys.exit(0)
sys.exit(1)
" "$feature_list" "$feature_id" 2>/dev/null) || {
                log_warn "Could not determine feature slug for cleanup"
                feature_slug=""
            }

            local project_root
            project_root="$(cd "$SCRIPT_DIR/.." && pwd)"

            if [[ -n "$feature_slug" ]]; then
                local specs_dir="$project_root/.prizmkit/specs/$feature_slug"
                if [[ -d "$specs_dir" ]]; then
                    rm -rf "$specs_dir"
                    log_info "Removed $specs_dir"
                fi
            fi

            local dev_team_dir="$project_root/.dev-team"
            if [[ -d "$dev_team_dir" ]]; then
                rm -rf "$dev_team_dir"
                log_info "Removed $dev_team_dir"
            fi

            local feature_state_dir="$STATE_DIR/features/$feature_id"
            if [[ -d "$feature_state_dir" ]]; then
                rm -rf "$feature_state_dir"
                log_info "Removed $feature_state_dir"
            fi
        fi
    fi

    # Reset Status
    if [[ "$no_reset" == false && "$dry_run" == false ]]; then
        log_info "Resetting $feature_id status..."
        python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "$feature_list" \
            --state-dir "$STATE_DIR" \
            --feature-id "$feature_id" \
            --action reset >/dev/null 2>&1 || {
            log_warn "Failed to reset feature status (may already be pending)"
        }
    elif [[ "$dry_run" == true && "$no_reset" == false ]]; then
        log_info "Dry-run mode: skipping status reset"
    fi

    # Generate Bootstrap Prompt
    local run_id session_id session_dir bootstrap_prompt
    run_id=$(jq -r '.run_id' "$STATE_DIR/pipeline.json")
    session_id="${feature_id}-$(date +%Y%m%d%H%M%S)"
    session_dir="$STATE_DIR/features/$feature_id/sessions/$session_id"
    mkdir -p "$session_dir/logs"

    bootstrap_prompt="$session_dir/bootstrap-prompt.md"

    # Read retry count from status.json
    local retry_count
    retry_count=$(python3 -c "
import json, os
status_path = os.path.join('$STATE_DIR', 'features', '$feature_id', 'status.json')
if os.path.isfile(status_path):
    with open(status_path) as f:
        d = json.load(f)
    print(d.get('retry_count', 0))
else:
    print(0)
" 2>/dev/null || echo "0")

    local prompt_args=(
        --feature-list "$feature_list"
        --feature-id "$feature_id"
        --session-id "$session_id"
        --run-id "$run_id"
        --retry-count "$retry_count"
        --resume-phase "$resume_phase"
        --state-dir "$STATE_DIR"
        --output "$bootstrap_prompt"
    )

    if [[ -n "$mode_override" ]]; then
        prompt_args+=(--mode "$mode_override")
    fi

    if [[ -n "${critic_override:-}" ]]; then
        prompt_args+=(--critic "$critic_override")
    elif [[ "${ENABLE_CRITIC:-}" == "true" || "${ENABLE_CRITIC:-}" == "1" ]]; then
        prompt_args+=(--critic "true")
    elif [[ "${ENABLE_CRITIC:-}" == "false" || "${ENABLE_CRITIC:-}" == "0" ]]; then
        prompt_args+=(--critic "false")
    fi

    log_info "Generating bootstrap prompt..."
    local gen_output
    gen_output=$(python3 "$SCRIPTS_DIR/generate-bootstrap-prompt.py" "${prompt_args[@]}" 2>/dev/null) || {
        log_error "Failed to generate bootstrap prompt for $feature_id"
        return 1
    }
    local feature_model pipeline_mode agent_count critic_enabled
    feature_model=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('model',''))" 2>/dev/null || echo "")
    pipeline_mode=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('pipeline_mode','lite'))" 2>/dev/null || echo "lite")
    agent_count=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('agent_count',1))" 2>/dev/null || echo "1")
    critic_enabled=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('critic_enabled','false'))" 2>/dev/null || echo "false")

    # Dry-Run: Print info and exit
    if [[ "$dry_run" == true ]]; then
        echo ""
        echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
        echo -e "${BOLD}  Dry Run: $feature_id — $feature_title${NC}"
        echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
        echo ""
        log_info "Session ID:    $session_id"
        log_info "Resume Phase:  $resume_phase"
        if [[ -n "$mode_override" ]]; then
            log_info "Mode Override: $mode_override"
        else
            log_info "Mode:          auto-detect (from complexity)"
        fi
        log_info "Pipeline mode: $pipeline_mode"
        log_info "Agents:        $agent_count (critic: $([ "$critic_enabled" = "true" ] && echo "enabled" || echo "disabled"))"
        if [[ -n "$feature_model" ]]; then
            log_info "Feature Model: $feature_model"
        elif [[ -n "${MODEL:-}" ]]; then
            log_info "Model (env):   $MODEL"
        else
            log_info "Model:         (CLI default)"
        fi
        echo ""
        log_info "Bootstrap prompt written to:"
        echo "  $bootstrap_prompt"
        echo ""

        local prompt_lines
        prompt_lines=$(wc -l < "$bootstrap_prompt" | tr -d ' ')
        log_info "Prompt: $prompt_lines lines"
        echo ""
        echo -e "${BOLD}--- Session Context (from prompt) ---${NC}"
        sed -n '/^## Session Context/,/^##[^#]/p' "$bootstrap_prompt" | head -20
        echo -e "${BOLD}--- end ---${NC}"
        echo ""

        log_success "Dry run complete. Inspect full prompt with:"
        echo "  cat $bootstrap_prompt"
        return 0
    fi

    # Log bootstrap prompt in test mode
    prizm_log_bootstrap_prompt "$bootstrap_prompt" "$feature_id"

    # Spawn AI CLI Session
    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  Run: $feature_id — $feature_title${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    log_info "AI CLI: $CLI_CMD (platform: $PLATFORM)"
    log_info "Session ID: $session_id"
    log_info "Resume Phase: $resume_phase"
    local effective_model="${feature_model:-$MODEL}"
    if [[ -n "$effective_model" ]]; then
        log_info "Model: $effective_model"
    else
        log_info "Model: (CLI default)"
    fi
    if [[ -n "$mode_override" ]]; then
        log_info "Mode Override: $mode_override"
    fi
    local _run_one_mode_desc
    case "$pipeline_mode" in
        lite)     _run_one_mode_desc="Tier 1 — Single Agent" ;;
        standard) _run_one_mode_desc="Tier 2 — Orchestrator + Dev + Reviewer" ;;
        full)     _run_one_mode_desc="Tier 3 — Full Team (+ Multi-Critic)" ;;
        *)        _run_one_mode_desc="$pipeline_mode" ;;
    esac
    log_info "Pipeline mode: ${BOLD}$pipeline_mode${NC} ($_run_one_mode_desc)"
    log_info "Agents: $agent_count (critic: $([ "$critic_enabled" = "true" ] && echo "enabled" || echo "disabled"))"
    if [[ $SESSION_TIMEOUT -gt 0 ]]; then
        log_info "Session timeout: ${SESSION_TIMEOUT}s"
    else
        log_info "Session timeout: none"
    fi
    log_info "Prompt: $bootstrap_prompt"
    log_info "Log: $session_dir/logs/session.log"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo ""

    # Override cleanup trap for single-feature mode (use distinct name to avoid overwriting global cleanup)
    cleanup_single_feature() {
        echo ""
        log_warn "Interrupted. Killing session..."
        # Kill all child processes
        kill 0 2>/dev/null || true
        # Log current branch info
        if [[ -n "$_DEV_BRANCH_NAME" ]]; then
            log_info "Development was on branch: $_DEV_BRANCH_NAME"
        fi
        log_info "Session log: $session_dir/logs/session.log"

        # Update feature status to failed on interrupt
        if [[ -n "$feature_list" && -f "$feature_list" ]]; then
            python3 "$SCRIPTS_DIR/update-feature-status.py" \
                --feature-list "$feature_list" \
                --state-dir "$STATE_DIR" \
                --feature-id "$feature_id" \
                --session-status "failed" \
                --action update 2>/dev/null || true
            log_info "Feature $feature_id marked as failed due to interrupt"
        fi

        # GUARANTEED: always return to original branch (save WIP on dev branch first)
        branch_ensure_return "$(cd "$SCRIPT_DIR/.." && pwd)" "$_ORIGINAL_BRANCH" "$_DEV_BRANCH_NAME"
        exit 130
    }
    trap cleanup_single_feature SIGINT SIGTERM

    _SPAWN_RESULT=""

    # Branch lifecycle: create and checkout feature branch
    local _proj_root
    _proj_root="$(cd "$SCRIPT_DIR/.." && pwd)"
    local _source_branch
    _source_branch=$(git -C "$_proj_root" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    _ORIGINAL_BRANCH="$_source_branch"

    # Mark feature as in-progress (update JSON for runtime monitoring, no commit)
    # The status change will be committed together with the final status update
    # after the session completes, avoiding an extra noise commit per feature.
    python3 "$SCRIPTS_DIR/update-feature-status.py" \
        --feature-list "$feature_list" \
        --state-dir "$STATE_DIR" \
        --feature-id "$feature_id" \
        --action start >/dev/null 2>&1 || true

    local _branch_name="${DEV_BRANCH:-dev/${feature_id}-$(date +%Y%m%d%H%M)}"
    if branch_create "$_proj_root" "$_branch_name" "$_source_branch"; then
        _DEV_BRANCH_NAME="$_branch_name"
    else
        log_warn "Failed to create branch; running session on current branch"
    fi

    spawn_and_wait_session \
        "$feature_id" "$feature_list" "$session_id" \
        "$bootstrap_prompt" "$session_dir" 999 "$feature_model" "$_ORIGINAL_BRANCH"
    local session_status="$_SPAWN_RESULT"

    # Merge dev branch back to original on success
    if [[ "$session_status" == "success" && -n "$_DEV_BRANCH_NAME" ]]; then
        if branch_merge "$_proj_root" "$_DEV_BRANCH_NAME" "$_ORIGINAL_BRANCH" "$AUTO_PUSH"; then
            _DEV_BRANCH_NAME=""
        else
            log_warn "Auto-merge failed — dev branch preserved: $_DEV_BRANCH_NAME"
            log_warn "Merge manually: git checkout $_ORIGINAL_BRANCH && git rebase $_DEV_BRANCH_NAME"
            _DEV_BRANCH_NAME=""
        fi
    elif [[ -n "$_DEV_BRANCH_NAME" ]]; then
        # Session failed — preserve dev branch for inspection
        log_warn "Session failed — dev branch preserved for inspection: $_DEV_BRANCH_NAME"
        _DEV_BRANCH_NAME=""
    fi

    # GUARANTEED: always return to original branch regardless of success/failure/merge outcome
    branch_ensure_return "$_proj_root" "$_ORIGINAL_BRANCH"

    # Commit feature status update on the original branch (after guaranteed return)
    if ! git -C "$_proj_root" diff --quiet "$feature_list" 2>/dev/null; then
        git -C "$_proj_root" add "$feature_list"
        git -C "$_proj_root" commit --no-verify -m "chore($feature_id): update feature status" 2>/dev/null || true
    fi

    echo ""
    if [[ "$session_status" == "success" ]]; then
        log_success "════════════════════════════════════════════════════"
        log_success "  $feature_id completed successfully!"
        log_success "════════════════════════════════════════════════════"
    else
        log_error "════════════════════════════════════════════════════"
        log_error "  $feature_id result: $session_status"
        log_error "  Review log: $session_dir/logs/session.log"
        log_error "════════════════════════════════════════════════════"
    fi
}

# ============================================================
# Main Loop: Run all features
# ============================================================

main() {
    local feature_list="${1:-.prizmkit/plans/feature-list.json}"
    local features_filter="${2:-}"

    # Resolve to absolute path
    if [[ ! "$feature_list" = /* ]]; then
        feature_list="$(pwd)/$feature_list"
    fi

    FEATURE_LIST="$feature_list"

    # Validate feature list exists
    if [[ ! -f "$feature_list" ]]; then
        log_error "Feature list not found: $feature_list"
        log_info "Create a feature list first using the feature-planner skill,"
        log_info "or provide a path: ./run-feature.sh run <path-to-.prizmkit/plans/feature-list.json>"
        exit 1
    fi

    # Validate .prizmkit/plans/feature-list.json is under project root
    local fl_dir
    fl_dir="$(cd "$(dirname "$feature_list")" && pwd)"
    local project_root
    project_root="$(pwd)"
    if [[ "$fl_dir" != "$project_root"/.prizmkit/plans && "$fl_dir" != "$project_root" ]]; then
        log_warn "feature-list.json is not under project root ($project_root), found at $fl_dir"
        log_warn "Pipeline expects feature-list.json at <project-root>/.prizmkit/plans/feature-list.json. Proceeding but results may be unstable."
    fi

    check_dependencies
    run_log_cleanup

    # Initialize pipeline state if needed
    if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
        log_info "Initializing pipeline state..."
        local init_result init_stderr init_tmpstderr
        init_tmpstderr=$(mktemp)
        if ! init_result=$(python3 "$SCRIPTS_DIR/init-pipeline.py" \
            --feature-list "$feature_list" \
            --state-dir "$STATE_DIR" 2>"$init_tmpstderr"); then
            init_stderr=$(cat "$init_tmpstderr" 2>/dev/null || true)
            rm -f "$init_tmpstderr"
            if [[ -n "$init_stderr" ]]; then
                log_warn "$init_stderr"
            fi
            log_error "Pipeline initialization failed (script error)"
            exit 1
        fi
        init_stderr=$(cat "$init_tmpstderr" 2>/dev/null || true)
        rm -f "$init_tmpstderr"

        # Show any stderr warnings (e.g. project root detection) without corrupting JSON
        if [[ -n "$init_stderr" ]]; then
            log_warn "$init_stderr"
        fi

        local init_valid
        init_valid=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('valid', False))" 2>/dev/null || echo "False")

        if [[ "$init_valid" != "True" ]]; then
            log_error "Pipeline initialization failed:"
            echo "$init_result"
            exit 1
        fi

        local features_count
        features_count=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('features_count', 0))" 2>/dev/null || echo "0")
        log_success "Pipeline initialized with $features_count features"

        # Ensure state directory is gitignored (prevents branch-switch state loss)
        local _gitignore_path
        _gitignore_path="$(cd "$SCRIPT_DIR/.." && pwd)/.gitignore"
        local _state_rel
        _state_rel=$(python3 -c "import os; print(os.path.relpath('$STATE_DIR', '$(cd "$SCRIPT_DIR/.." && pwd)'))" 2>/dev/null || echo ".prizmkit/state/features")
        if [[ -f "$_gitignore_path" ]]; then
            if ! grep -qF "$_state_rel" "$_gitignore_path" 2>/dev/null; then
                printf '\n# Pipeline runtime state (auto-added by dev-pipeline)\n%s/\n' "$_state_rel" >> "$_gitignore_path"
                log_info "Added $_state_rel/ to .gitignore"
            fi
        else
            printf '# Pipeline runtime state (auto-added by dev-pipeline)\n%s/\n' "$_state_rel" > "$_gitignore_path"
            log_info "Created .gitignore with $_state_rel/"
        fi
    else
        log_info "Resuming existing pipeline..."
    fi

    # Print header
    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}          Dev-Pipeline Runner Started${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    log_info "Feature list: $feature_list"
    if [[ -n "$features_filter" ]]; then
        log_info "Features filter: $features_filter"
    fi
    log_info "Max retries per feature: $MAX_RETRIES"
    if [[ $SESSION_TIMEOUT -gt 0 ]]; then
        log_info "Session timeout: ${SESSION_TIMEOUT}s"
    else
        log_info "Session timeout: none"
    fi
    log_info "AI CLI: $CLI_CMD (platform: $PLATFORM)"
    if [[ -n "${MODEL:-}" ]]; then
        log_info "Default Model: $MODEL"
    fi
    if [[ "$STOP_ON_FAILURE" == "1" ]]; then
        log_info "Stop on failure: enabled"
    fi
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo ""

    # Branch lifecycle: each feature gets its own dev branch (created per-iteration below)
    local _proj_root
    _proj_root="$(cd "$SCRIPT_DIR/.." && pwd)"
    local _source_branch
    _source_branch=$(git -C "$_proj_root" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    _ORIGINAL_BRANCH="$_source_branch"

    # Main processing loop
    local session_count=0
    local total_subagent_calls=0

    while true; do
        # Safety net: ensure we're on the original branch at the start of each iteration.
        # If a previous iteration's `continue` skipped branch_ensure_return, we could
        # still be on a dev branch. This prevents cascading branch confusion.
        if [[ -n "$_ORIGINAL_BRANCH" ]]; then
            local _cur_branch
            _cur_branch=$(git -C "$_proj_root" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
            if [[ -n "$_cur_branch" && "$_cur_branch" != "$_ORIGINAL_BRANCH" ]]; then
                log_warn "Still on branch $_cur_branch at loop start — returning to $_ORIGINAL_BRANCH"
                branch_ensure_return "$_proj_root" "$_ORIGINAL_BRANCH"
            fi
        fi

        # Check for stuck features
        local stuck_result
        stuck_result=$(python3 "$SCRIPTS_DIR/detect-stuck.py" \
            --state-dir "$STATE_DIR" \
            --feature-list "$FEATURE_LIST" \
            --max-retries "$MAX_RETRIES" \
            --stale-threshold "$HEARTBEAT_STALE_THRESHOLD" 2>/dev/null || echo '{"stuck_count": 0}')

        local stuck_count
        stuck_count=$(echo "$stuck_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('stuck_count', 0))" 2>/dev/null || echo "0")

        if [[ "$stuck_count" -gt 0 ]]; then
            log_warn "Detected $stuck_count stuck feature(s):"
            echo "$stuck_result" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for f in data.get('stuck_features', []):
    print(f'  - {f[\"feature_id\"]}: {f[\"reason\"]} — {f[\"suggestion\"]}')
" 2>/dev/null || true
        fi

        # Find next feature to process
        local next_feature
        local _get_next_args=(
            --feature-list "$feature_list"
            --state-dir "$STATE_DIR"
            --max-retries "$MAX_RETRIES"
            --action get_next
        )
        if [[ -n "$features_filter" ]]; then
            _get_next_args+=(--features "$features_filter")
        fi
        if ! next_feature=$(python3 "$SCRIPTS_DIR/update-feature-status.py" \
            "${_get_next_args[@]}" 2>/dev/null); then

            log_error "Failed to get next feature"
            break
        fi


        if [[ "$next_feature" == "PIPELINE_COMPLETE" ]]; then
            echo ""
            log_success "════════════════════════════════════════════════════"
            log_success "  Pipeline finished."
            log_success "  Total sessions: $session_count"
            log_success "  Total subagent calls: $total_subagent_calls"
            log_success "════════════════════════════════════════════════════"

            # Check for auto-skipped features
            local auto_skipped_count
            auto_skipped_count=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
count = sum(1 for f in data.get('features', []) if f.get('status') == 'auto_skipped')
print(count)
" "$feature_list" 2>/dev/null || echo "0")

            if [[ "$auto_skipped_count" -gt 0 ]]; then
                echo ""
                log_warn "$auto_skipped_count feature(s) were auto-skipped due to failed dependencies."
                log_warn "Run './run-feature.sh status' to see details."
                log_warn "Run './run-feature.sh unskip' to reset and retry them."
            fi

            # ── Deploy session (only if ENABLE_DEPLOY=1 and all features completed) ──
            if [[ "$ENABLE_DEPLOY" == "1" ]]; then
                local incomplete_count
                incomplete_count=$({ python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
bad = [f for f in data.get('features', [])
       if f.get('status') not in ('completed', 'skipped')]
for f in bad:
    print(f\"  {f['id']}: {f.get('status', 'unknown')} — {f.get('title', '')}\")
print(len(bad))
" "$feature_list" 2>/dev/null || echo "0"; } | tee /dev/stderr | tail -1)

                if [[ "$incomplete_count" -gt 0 ]]; then
                    echo ""
                    log_warn "DEPLOY BLOCKED: $incomplete_count task(s) not completed successfully."
                    log_warn "Fix failed tasks and re-run, or manually run /prizmkit-deploy."
                else
                    echo ""
                    log_info "All tasks completed — starting deploy session..."
                    log_info "ENABLE_DEPLOY=1"

                    local deploy_session_id="deploy-$(date +%Y%m%d%H%M%S)"
                    local deploy_session_dir="$STATE_DIR/deploy/$deploy_session_id"
                    mkdir -p "$deploy_session_dir/logs"

                    local deploy_prompt="$deploy_session_dir/bootstrap-prompt.md"
                    local _deploy_branch _deploy_commit
                    _deploy_branch=$(git -C "$_proj_root" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
                    _deploy_commit=$(git -C "$_proj_root" rev-parse --short HEAD 2>/dev/null || echo "unknown")
                    cat > "$deploy_prompt" << DEPLOY_PROMPT_EOF
## Deploy

All features in the pipeline completed successfully.

- Branch: $_deploy_branch
- Commit: $_deploy_commit

Run /prizmkit-deploy to deploy the project. Read .prizmkit/deploy/deploy.config.json
for deployment configuration. If no deploy config exists, guide the user through
setting one up before deploying.
DEPLOY_PROMPT_EOF

                    log_info "Deploy prompt: $deploy_prompt"
                    log_info "Deploy log: $deploy_session_dir/logs/session.log"

                    case "$CLI_CMD" in
                        *claude*)
                            "$CLI_CMD" \
                                -p "$(cat "$deploy_prompt")" \
                                --dangerously-skip-permissions \
                                > "$deploy_session_dir/logs/session.log" 2>&1
                            ;;
                        *)
                            "$CLI_CMD" \
                                --print \
                                -y \
                                < "$deploy_prompt" \
                                > "$deploy_session_dir/logs/session.log" 2>&1
                            ;;
                    esac
                    local deploy_exit=$?

                    if [[ $deploy_exit -eq 0 ]]; then
                        log_success "Deploy session completed (exit 0)"
                    else
                        log_warn "Deploy session exited with code $deploy_exit"
                        log_warn "Review log: $deploy_session_dir/logs/session.log"
                    fi
                fi
            fi

            break
        fi

        if [[ "$next_feature" == "PIPELINE_BLOCKED" ]]; then
            log_warn "All remaining features are blocked by dependencies or failed."
            log_warn "Run './run-feature.sh status' to see details."
            log_warn "Waiting 60s before re-checking... (Ctrl+C to stop)"
            sleep 60
            continue
        fi

        # Parse feature info
        local feature_id feature_title retry_count resume_phase
        feature_id=$(echo "$next_feature" | jq -r '.feature_id')
        feature_title=$(echo "$next_feature" | jq -r '.title')
        retry_count=$(echo "$next_feature" | jq -r '.retry_count // 0')
        resume_phase=$(echo "$next_feature" | jq -r '.resume_from_phase // "null"')

        echo ""
        echo -e "${BOLD}────────────────────────────────────────────────────${NC}"
        log_info "Feature: ${BOLD}$feature_id${NC} — $feature_title"
        log_info "Retry: $retry_count / $MAX_RETRIES"
        if [[ "$resume_phase" != "null" ]]; then
            log_info "Resuming from Phase $resume_phase"
        fi
        echo -e "${BOLD}────────────────────────────────────────────────────${NC}"

        # Commit dirty working tree before starting feature
        local _dirty_files=""
        _dirty_files=$(git -C "$_proj_root" status --porcelain 2>/dev/null || true)
        if [[ -n "$_dirty_files" ]]; then
            log_info "Dirty working tree detected — committing before $feature_id..."
            git -C "$_proj_root" add -A 2>/dev/null || true
            git -C "$_proj_root" commit --no-verify -m "ready for run $feature_id" 2>/dev/null || true
        fi

        # Mark feature as in-progress BEFORE creating dev branch
        # This ensures the in_progress status commit lands on the original branch,
        # not the dev branch — preventing rebase conflicts in branch_merge later.
        python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "$feature_list" \
            --state-dir "$STATE_DIR" \
            --feature-id "$feature_id" \
            --action start >/dev/null 2>&1 || true
        # Commit the in_progress status on the original branch
        if ! git -C "$_proj_root" diff --quiet "$feature_list" 2>/dev/null; then
            git -C "$_proj_root" add "$feature_list" 2>/dev/null || true
            git -C "$_proj_root" commit --no-verify -m "chore($feature_id): mark in_progress" 2>/dev/null || true
        fi

        # Create per-feature dev branch (from the now-updated original branch)
        local _feature_branch="${DEV_BRANCH:-dev/${feature_id}-$(date +%Y%m%d%H%M)}"
        if branch_create "$_proj_root" "$_feature_branch" "$_ORIGINAL_BRANCH"; then
            _DEV_BRANCH_NAME="$_feature_branch"
            log_info "Dev branch: $_feature_branch"
        else
            log_warn "Failed to create dev branch; running on current branch: $_ORIGINAL_BRANCH"
            _DEV_BRANCH_NAME=""
        fi

        # Generate session ID and bootstrap prompt
        local session_id run_id
        run_id=$(jq -r '.run_id' "$STATE_DIR/pipeline.json")
        session_id="${feature_id}-$(date +%Y%m%d%H%M%S)"

        local session_dir="$STATE_DIR/features/$feature_id/sessions/$session_id"
        mkdir -p "$session_dir/logs"

        local bootstrap_prompt="$session_dir/bootstrap-prompt.md"

        local main_prompt_args=(
            --feature-list "$feature_list"
            --feature-id "$feature_id"
            --session-id "$session_id"
            --run-id "$run_id"
            --retry-count "$retry_count"
            --resume-phase "$resume_phase"
            --state-dir "$STATE_DIR"
            --output "$bootstrap_prompt"
        )

        # Support PIPELINE_MODE env var (set by launch-feature-daemon.sh --mode)
        if [[ -n "${PIPELINE_MODE:-}" ]]; then
            main_prompt_args+=(--mode "$PIPELINE_MODE")
        fi

        # Support ENABLE_CRITIC env var (set by launch-feature-daemon.sh --critic)
        if [[ "${ENABLE_CRITIC:-}" == "true" || "${ENABLE_CRITIC:-}" == "1" ]]; then
            main_prompt_args+=(--critic "true")
        elif [[ "${ENABLE_CRITIC:-}" == "false" || "${ENABLE_CRITIC:-}" == "0" ]]; then
            main_prompt_args+=(--critic "false")
        fi

        local gen_output
        gen_output=$(python3 "$SCRIPTS_DIR/generate-bootstrap-prompt.py" "${main_prompt_args[@]}" 2>/dev/null) || {
            log_error "Failed to generate bootstrap prompt for $feature_id"
            branch_ensure_return "$_proj_root" "$_ORIGINAL_BRANCH"
            _DEV_BRANCH_NAME=""
            continue
        }
        local feature_model pipeline_mode agent_count critic_enabled
        feature_model=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('model',''))" 2>/dev/null || echo "")
        pipeline_mode=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('pipeline_mode','lite'))" 2>/dev/null || echo "lite")
        agent_count=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('agent_count',1))" 2>/dev/null || echo "1")
        critic_enabled=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('critic_enabled','false'))" 2>/dev/null || echo "false")

        # Log pipeline mode and agent configuration
        local _mode_desc
        case "$pipeline_mode" in
            lite)     _mode_desc="Tier 1 — Single Agent" ;;
            standard) _mode_desc="Tier 2 — Orchestrator + Dev + Reviewer" ;;
            full)     _mode_desc="Tier 3 — Full Team (+ Multi-Critic)" ;;
            *)        _mode_desc="$pipeline_mode" ;;
        esac
        log_info "Pipeline mode: ${BOLD}$pipeline_mode${NC} ($_mode_desc)"
        log_info "Agents: $agent_count (critic: $([ "$critic_enabled" = "true" ] && echo "enabled" || echo "disabled"))"

        # Spawn session and wait
        prizm_log_bootstrap_prompt "$bootstrap_prompt" "$feature_id"
        log_info "Spawning AI CLI session: $session_id"
        if [[ -n "$feature_model" ]]; then
            log_info "Feature model: $feature_model"
        fi
        _SPAWN_RESULT=""

        spawn_and_wait_session \
            "$feature_id" "$feature_list" "$session_id" \
            "$bootstrap_prompt" "$session_dir" "$MAX_RETRIES" "$feature_model" "$_ORIGINAL_BRANCH"
        local session_status="$_SPAWN_RESULT"

        # Merge per-feature dev branch back to original on success
        if [[ "$session_status" == "success" && -n "$_DEV_BRANCH_NAME" ]]; then
            if branch_merge "$_proj_root" "$_DEV_BRANCH_NAME" "$_ORIGINAL_BRANCH" "$AUTO_PUSH"; then
                _DEV_BRANCH_NAME=""
            else
                log_warn "Auto-merge failed — dev branch preserved: $_DEV_BRANCH_NAME"
                log_warn "Merge manually: git checkout $_ORIGINAL_BRANCH && git rebase $_DEV_BRANCH_NAME"
                _DEV_BRANCH_NAME=""
            fi
        elif [[ -n "$_DEV_BRANCH_NAME" ]]; then
            # Session failed — preserve dev branch for inspection
            log_warn "Session failed — dev branch preserved for inspection: $_DEV_BRANCH_NAME"
            _DEV_BRANCH_NAME=""
        fi

        # GUARANTEED: always return to original branch regardless of success/failure/merge outcome
        branch_ensure_return "$_proj_root" "$_ORIGINAL_BRANCH"

        # Commit feature status update on the original branch (after guaranteed return)
        if ! git -C "$_proj_root" diff --quiet "$feature_list" 2>/dev/null; then
            git -C "$_proj_root" add "$feature_list"
            git -C "$_proj_root" commit --no-verify -m "chore($feature_id): update feature status" 2>/dev/null || true
        fi

        session_count=$((session_count + 1))
        total_subagent_calls=$((total_subagent_calls + _SUBAGENT_COUNT))

        # Stop-on-failure: abort pipeline if task failed and STOP_ON_FAILURE is enabled
        if [[ "$session_status" != "success" && "$STOP_ON_FAILURE" == "1" ]]; then
            echo ""
            log_error "════════════════════════════════════════════════════"
            log_error "  STOP_ON_FAILURE: Pipeline halted after $feature_id failed."
            log_error "  Total sessions completed: $session_count"
            log_error "  Set STOP_ON_FAILURE=0 to continue past failures."
            log_error "════════════════════════════════════════════════════"
            break
        fi

        # Brief pause before next iteration
        log_info "Pausing 5s before next feature..."
        sleep 5
    done
}

# ============================================================
# Entry Point
# ============================================================

show_help() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  run [.prizmkit/plans/feature-list.json] [--features <filter>]  Run features (all or filtered subset)"
    echo "  run <feature-id> [options]              Run a single feature"
    echo "  status [.prizmkit/plans/feature-list.json]               Show pipeline status"
    echo "  unskip [feature-id] [.prizmkit/plans/feature-list.json]  Reset auto-skipped/failed features"
    echo "  test-cli                                 Test AI CLI: show detected CLI, version, and model"
    echo "  reset                                    Clear all state and start fresh"
    echo "  help                                     Show this help message"
    echo ""
    echo "Feature Filter (--features):"
    echo "  --features F-001,F-003,F-005             Run only specified features"
    echo "  --features F-001:F-010                   Run a range of features (F-001 through F-010)"
    echo "  --features F-001,F-005:F-010             Mixed: individual IDs + ranges"
    echo ""
    echo "Single Feature Options (run <feature-id>):"
    echo "  --dry-run                   Generate bootstrap prompt only, don't spawn session"
    echo "  --resume-phase N            Override resume phase (default: auto-detect)"
    echo "  --mode <lite|standard|full> Override pipeline mode (bypasses estimated_complexity)"
    echo "  --critic                    Enable adversarial critic review for this feature"
    echo "  --no-critic                 Disable critic review (overrides feature-list setting)"
    echo "  --clean                     Delete artifacts and reset before running"
    echo "  --no-reset                  Skip feature status reset step"
    echo "  --timeout N                 Session timeout in seconds (default: 0 = no limit)"
    echo ""
    echo "Environment Variables:"
    echo "  MAX_RETRIES           Max retries per feature (default: 3)"
    echo "  SESSION_TIMEOUT       Session timeout in seconds (default: 0 = no limit)"
    echo "  AI_CLI                AI CLI command name (auto-detected: cbc or claude)"
    echo "  MODEL                 AI model ID (e.g. claude-opus-4.6, claude-sonnet-4.6, claude-haiku-4.5)"
    echo "  HEARTBEAT_INTERVAL    Heartbeat log interval in seconds (default: 30)"
    echo "  STALE_KILL_THRESHOLD  Auto-kill session after N seconds of no progress (default: 900)"
    echo "  HEARTBEAT_STALE_THRESHOLD  Heartbeat stale threshold in seconds (default: 600)"
    echo "  LOG_CLEANUP_ENABLED   Run log cleanup before execution (default: 1)"
    echo "  LOG_RETENTION_DAYS    Delete logs older than N days (default: 14)"
    echo "  LOG_MAX_TOTAL_MB      Keep total logs under N MB (default: 1024)"
    echo "  PIPELINE_MODE         Override mode for all features: lite|standard|full"
    echo "  ENABLE_CRITIC         Enable critic review for all features: true|false"
    echo "  STOP_ON_FAILURE       Stop pipeline when a task exhausts retries: 0|1 (default: 0)"
    echo ""
    echo "Examples:"
    echo "  ./run-feature.sh run                                         # Run all features"
    echo "  ./run-feature.sh run --features F-001,F-003,F-005             # Run specific features"
    echo "  ./run-feature.sh run --features F-001:F-010                   # Run features F-001 through F-010"
    echo "  ./run-feature.sh run F-007 --dry-run                          # Inspect generated prompt"
    echo "  ./run-feature.sh run F-007 --dry-run --mode lite               # Test lite mode"
    echo "  ./run-feature.sh run F-007 --resume-phase 6                    # Skip to implementation"
    echo "  ./run-feature.sh run F-007 --mode full --timeout 3600          # Full mode, 1h timeout"
    echo "  ./run-feature.sh run F-007 --clean --mode standard             # Clean + run standard"
    echo "  ./run-feature.sh status                                        # Show pipeline status"
    echo "  MAX_RETRIES=5 SESSION_TIMEOUT=7200 ./run-feature.sh run        # Custom config"
    echo "  MODEL=claude-sonnet-4.6 ./run-feature.sh run                    # Use Sonnet model"
    echo "  MODEL=claude-haiku-4.5 ./run-feature.sh test-cli                # Test with Haiku"
}

case "${1:-run}" in
    run|resume)
        shift || true
        # Check if first arg is a feature ID (F-xxx pattern)
        if [[ "${1:-}" =~ ^[Ff]-[0-9]+ ]]; then
            run_one "$@"
        else
            # Parse positional and --features flag
             _run_feature_list=".prizmkit/plans/feature-list.json"
             _run_features_filter=""
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --features)
                        shift
                        if [[ $# -eq 0 ]]; then
                            log_error "--features requires a value (e.g. --features F-001,F-003 or --features F-001:F-010)"
                            exit 1
                        fi
                        _run_features_filter="$1"
                        shift
                        ;;
                    *)
                        _run_feature_list="$1"
                        shift
                        ;;
                esac
            done
            main "$_run_feature_list" "$_run_features_filter"
        fi
        ;;
    status)
        check_dependencies
        if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
            log_error "No pipeline state found. Run './run-feature.sh run' first."
            exit 1
        fi
        python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "${2:-.prizmkit/plans/feature-list.json}" \
            --state-dir "$STATE_DIR" \
            --action status
        ;;
    test-cli)
        echo ""
        echo "============================================"
        echo "  Dev-Pipeline AI CLI Test"
        echo "============================================"
        echo ""
        echo "  Detected CLI:    $CLI_CMD"
        echo "  Platform:        $PLATFORM"
        if [[ -n "$MODEL" ]]; then
            echo "  Requested Model: $MODEL"
        fi

        # Get CLI version (first line only)
        cli_version=$("$CLI_CMD" -v 2>&1 | head -1 || echo "unknown")
        echo "  CLI Version:     $cli_version"
        echo ""
        echo "  Querying AI model (headless mode)..."

        test_prompt="What AI assistant/platform are you and what model are you running? Reply in one line, e.g. \"I'm Claude Code Claude Opnus x.x\".No extra text."

        local_model_flag=""
        if [[ -n "$MODEL" ]]; then
            local_model_flag="--model $MODEL"
        fi

        # Run headless query with 30s timeout (background + kill pattern for macOS)
        tmpfile=$(mktemp)
        (
            unset CLAUDECODE
            case "$CLI_CMD" in
                *claude*)
                    "$CLI_CMD" -p "$test_prompt" --dangerously-skip-permissions --no-session-persistence $local_model_flag > "$tmpfile" 2>/dev/null
                    ;;
                *)
                    echo "$test_prompt" | "$CLI_CMD" --print -y $local_model_flag > "$tmpfile" 2>/dev/null
                    ;;
            esac
        ) &
        query_pid=$!
        ( sleep 30 && kill "$query_pid" 2>/dev/null ) &
        timer_pid=$!
        wait "$query_pid" 2>/dev/null
        kill "$timer_pid" 2>/dev/null
        wait "$timer_pid" 2>/dev/null || true

        model_reply=$(cat "$tmpfile" 2>/dev/null | head -3)
        rm -f "$tmpfile"

        if [[ -z "$model_reply" ]]; then
            model_reply="(no response — CLI may require auth or is unavailable)"
        fi

        echo ""
        echo "  AI Response:     $model_reply"
        echo ""
        echo "============================================"
        echo ""
        ;;
    reset)
        log_warn "Resetting pipeline state..."
        rm -rf "$STATE_DIR"
        log_success "State cleared. Run './run-feature.sh run' to start fresh."
        ;;
    unskip)
        check_dependencies
        if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
            log_error "No pipeline state found. Run './run-feature.sh run' first."
            exit 1
        fi
        _unskip_feature_list=".prizmkit/plans/feature-list.json"
        _unskip_feature_id=""
        shift || true
        # Parse arguments: optional feature-id and feature-list path
        while [[ $# -gt 0 ]]; do
            if [[ "$1" =~ ^[Ff]-[0-9]+ ]]; then
                _unskip_feature_id="$1"
            else
                _unskip_feature_list="$1"
            fi
            shift
        done
        _unskip_args=(
            --feature-list "$_unskip_feature_list"
            --state-dir "$STATE_DIR"
            --action unskip
        )
        if [[ -n "$_unskip_feature_id" ]]; then
            _unskip_args+=(--feature-id "$_unskip_feature_id")
        fi
        python3 "$SCRIPTS_DIR/update-feature-status.py" "${_unskip_args[@]}"

        # Commit the status change
        if ! git diff --quiet "$_unskip_feature_list" 2>/dev/null; then
            git add "$_unskip_feature_list"
            git commit -m "chore: unskip auto-skipped features" 2>/dev/null || true
        fi
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
