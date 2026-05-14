#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/run-refactor.sh - Autonomous Refactor Pipeline Runner
#
# Drives the prizm-dev-team through iterative AI CLI sessions to
# execute refactors from a .prizmkit/plans/refactor-list.json specification.
#
# Usage:
#   ./run-refactor.sh run [.prizmkit/plans/refactor-list.json]          Run all refactors
#   ./run-refactor.sh run <refactor-id> [options]       Run a single refactor
#   ./run-refactor.sh status [.prizmkit/plans/refactor-list.json]       Show pipeline status
#   ./run-refactor.sh reset                             Clear all state
#
# Environment Variables:
#   MAX_RETRIES           Max retries per refactor (default: 3)
#   SESSION_TIMEOUT       Session timeout in seconds (default: 0 = no limit)
#   AI_CLI                AI CLI command name (auto-detected: cbc or claude)
#   CODEBUDDY_CLI         Legacy alias for AI_CLI (deprecated, use AI_CLI instead)
#   PRIZMKIT_PLATFORM     Force platform: 'codebuddy' or 'claude' (auto-detected)
#   VERBOSE               Set to 1 to enable --verbose on AI CLI
#   HEARTBEAT_INTERVAL    Heartbeat log interval in seconds (default: 30)
#   STALE_KILL_THRESHOLD   Auto-kill session after N seconds of no progress (default: 900)
#   HEARTBEAT_STALE_THRESHOLD  Heartbeat stale threshold in seconds (default: 600)
#   LOG_CLEANUP_ENABLED   Run periodic log cleanup (default: 1)
#   LOG_RETENTION_DAYS    Delete logs older than N days (default: 14)
#   LOG_MAX_TOTAL_MB      Keep total logs under N MB via oldest-first cleanup (default: 1024)
#   DEV_BRANCH            Custom dev branch name (default: auto-generated refactor/pipeline-{run_id})
#   AUTO_PUSH             Auto-push to remote after successful refactor (default: 0). Set to 1 to enable.
#   STOP_ON_FAILURE       Stop pipeline after a task exhausts all retries (default: 0). Set to 1 to stop.
#   STRICT_BEHAVIOR_CHECK Force full test suite after each refactor item (default: 1)
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
STATE_DIR="${PROJECT_ROOT}/.prizmkit/state/refactor"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"

# Configuration
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
STRICT_BEHAVIOR_CHECK=${STRICT_BEHAVIOR_CHECK:-1}
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

# Refactor list path (set in main, used by cleanup trap)
REFACTOR_LIST=""

# Branch tracking (for cleanup on interrupt)
_ORIGINAL_BRANCH=""
_DEV_BRANCH_NAME=""

# ============================================================
# Shared: Spawn AI CLI session and wait for result
# ============================================================

spawn_and_wait_session() {
    local refactor_id="$1"
    local refactor_list="$2"
    local session_id="$3"
    local bootstrap_prompt="$4"
    local session_dir="$5"
    local max_retries="$6"
    local item_model="${7:-}"
    local base_branch="${8:-main}"

    local session_log="$session_dir/logs/session.log"
    local progress_json="$session_dir/logs/progress.json"

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
    if [[ -n "$item_model" ]]; then
        model_flag="--model $item_model"
    elif [[ -n "${MODEL:-}" ]]; then
        model_flag="--model $MODEL"
    fi

    # Unset CLAUDECODE to prevent "nested session" error when launched from
    # within an existing Claude Code session (e.g. via launch-refactor-daemon.sh).
    unset CLAUDECODE 2>/dev/null || true

    # Log bootstrap prompt in test mode
    prizm_log_bootstrap_prompt "$bootstrap_prompt" "$refactor_id"

    case "$CLI_CMD" in
        *claude*)
            # Claude Code: prompt via -p, --dangerously-skip-permissions for auto-accept
            "$CLI_CMD" \
                -p "$(cat "$bootstrap_prompt")" \
                --dangerously-skip-permissions \
                $verbose_flag \
                $stream_json_flag \
                $model_flag \
                > "$session_log" 2>&1 &
            ;;
        *)
            # CodeBuddy (cbc) and others: prompt via stdin, -y for auto-accept
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
    local cli_pid=$!

    # Start progress parser (no-op if stream-json not supported)
    start_progress_parser "$session_log" "$progress_json" "$SCRIPTS_DIR"
    local parser_pid="${_PARSER_PID:-}"

    # Timeout watchdog
    local watcher_pid=""
    if [[ $SESSION_TIMEOUT -gt 0 ]]; then
        ( sleep "$SESSION_TIMEOUT" && kill -TERM "$cli_pid" 2>/dev/null ) &
        watcher_pid=$!
    fi

    # Heartbeat monitor (with stale-kill protection)
    start_heartbeat "$cli_pid" "$session_log" "$progress_json" "$HEARTBEAT_INTERVAL" "$STALE_KILL_THRESHOLD"
    local heartbeat_pid="${_HEARTBEAT_PID:-}"

    # Wait for AI CLI to finish
    local exit_code=0
    if wait "$cli_pid" 2>/dev/null; then
        exit_code=0
    else
        exit_code=$?
    fi

    # Cleanup
    [[ -n "$watcher_pid" ]] && kill "$watcher_pid" 2>/dev/null || true
    stop_heartbeat "$heartbeat_pid"
    stop_progress_parser "$parser_pid"
    [[ -n "$watcher_pid" ]] && wait "$watcher_pid" 2>/dev/null || true

    [[ $exit_code -eq 143 ]] && exit_code=124

    # Check for stale-kill marker (heartbeat killed the process due to no progress)
    local stale_kill_marker="$session_dir/logs/stale-kill.json"
    local was_stale_killed=false
    if [[ -f "$stale_kill_marker" ]]; then
        was_stale_killed=true
        log_warn "Session was stale-killed by heartbeat monitor (no progress for too long)"
    fi

    # Session summary
    if [[ -f "$session_log" ]]; then
        local final_size=$(wc -c < "$session_log" 2>/dev/null | tr -d ' ')
        local final_lines=$(wc -l < "$session_log" 2>/dev/null | tr -d ' ')
        log_info "Session log: $final_lines lines, $((final_size / 1024))KB"
    fi
    log_info "exit_code=$exit_code"

    # ── Determine session outcome from observable signals ──────────────
    local session_status
    local project_root
    project_root="$(cd "$SCRIPT_DIR/.." && pwd)"
    local default_branch="$base_branch"

    if [[ $exit_code -eq 124 ]]; then
        log_warn "Session timed out after ${SESSION_TIMEOUT}s"
        session_status="timed_out"
    elif [[ "$was_stale_killed" == true ]]; then
        log_warn "Session stale-killed (no progress for ${STALE_KILL_THRESHOLD}s)"
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
                if git -C "$project_root" commit --no-verify -m "chore($refactor_id): auto-commit session work (stale-killed)" 2>/dev/null; then
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
            local uncommitted=""
            uncommitted=$(git -C "$project_root" status --porcelain 2>/dev/null | head -1 || true)
            if [[ -n "$uncommitted" ]]; then
                log_warn "Session exited cleanly but produced no commits (uncommitted changes found) — auto-committing..."
                git -C "$project_root" add -A 2>/dev/null || true
                if git -C "$project_root" commit --no-verify -m "chore($refactor_id): auto-commit session work" 2>/dev/null; then
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
            local dirty_files=""
            dirty_files=$(git -C "$project_root" status --porcelain 2>/dev/null || true)
            if [[ -n "$dirty_files" ]]; then
                log_info "Auto-committing remaining session artifacts..."
                git -C "$project_root" add -A 2>/dev/null || true
                git -C "$project_root" commit --no-verify --amend --no-edit 2>/dev/null \
                    || git -C "$project_root" commit --no-verify -m "chore($refactor_id): include remaining session artifacts" 2>/dev/null \
                    || true
            fi
        fi
    fi

    log_info "Session result: $session_status"

    # Validate key artifacts exist after successful session
    if [[ "$session_status" == "success" ]]; then
        local _artifact_root
        _artifact_root="$(cd "$SCRIPT_DIR/.." && pwd)"
        local plan_file="$_artifact_root/.prizmkit/refactor/$refactor_id/plan.md"
        if [[ ! -f "$plan_file" ]]; then
            log_warn "ARTIFACT_MISSING: plan.md not found at $plan_file"
        fi

        # Validate checkpoint completeness
        local checkpoint_file="$_artifact_root/.prizmkit/refactor/$refactor_id/workflow-checkpoint.json"
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

    # Subagent detection
    prizm_detect_subagents "$session_log"

    # Propagate completion notes for dependency context (only on success)
    if [[ "$session_status" == "success" ]]; then
        local summary_path="$project_root/.prizmkit/refactor/$refactor_id/completion-summary.json"
        if [[ -f "$summary_path" ]]; then
            python3 "$SCRIPTS_DIR/patch-completion-notes.py" \
                --refactor-list "$refactor_list" \
                --refactor-id "$refactor_id" \
                --summary "$summary_path" >/dev/null 2>&1 && {
                log_info "Propagated completion notes for $refactor_id to refactor-list.json"
            } || {
                log_warn "Failed to propagate completion notes for $refactor_id"
            }
        else
            log_info "No completion-summary.json for $refactor_id — dependency context will be limited"
        fi
    fi

    # Update refactor status (do NOT commit on dev branch — commit happens after merge)
    python3 "$SCRIPTS_DIR/update-refactor-status.py" \
        --refactor-list "$refactor_list" \
        --state-dir "$STATE_DIR" \
        --refactor-id "$refactor_id" \
        --session-status "$session_status" \
        --session-id "$session_id" \
        --max-retries "$max_retries" \
        --action update >/dev/null 2>&1 || true

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

    # Update status of currently in-progress refactor to interrupted
    if [[ -n "$REFACTOR_LIST" && -f "$REFACTOR_LIST" ]]; then
        # Find any in-progress refactor and mark it as failed
        local _interrupted_id
        _interrupted_id=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for item in data.get('refactors', []):
    if item.get('status') == 'in_progress':
        print(item['id'])
        break
" "$REFACTOR_LIST" 2>/dev/null || echo "")

        if [[ -n "$_interrupted_id" ]]; then
            python3 "$SCRIPTS_DIR/update-refactor-status.py" \
                --refactor-list "$REFACTOR_LIST" \
                --state-dir "$STATE_DIR" \
                --refactor-id "$_interrupted_id" \
                --session-status "failed" \
                --action update 2>/dev/null || true
            log_info "Refactor $_interrupted_id marked as failed due to interrupt"
        fi

        # Pause the pipeline
        python3 "$SCRIPTS_DIR/update-refactor-status.py" \
            --refactor-list "$REFACTOR_LIST" \
            --state-dir "$STATE_DIR" \
            --action pause 2>/dev/null || true
    fi

    # GUARANTEED: always return to original branch (save WIP on dev branch first)
    branch_ensure_return "$(cd "$SCRIPT_DIR/.." && pwd)" "$_ORIGINAL_BRANCH" "$_DEV_BRANCH_NAME"

    log_info "Refactor pipeline paused. Run './run-refactor.sh run' to resume."
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
# run-one: Run a single refactor
# ============================================================

run_one() {
    local refactor_id=""
    local refactor_list=""
    local dry_run=false
    local do_clean=false
    local no_reset=false
    local mode_override=""
    local critic_override=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run) dry_run=true; shift ;;
            --clean) do_clean=true; shift ;;
            --no-reset) no_reset=true; shift ;;
            --timeout) shift; SESSION_TIMEOUT="${1:-0}"; shift ;;
            --mode)
                shift
                if [[ $# -eq 0 ]]; then
                    log_error "--mode requires a value (lite|standard|full)"
                    exit 1
                fi
                case "$1" in
                    lite|standard|full) mode_override="$1" ;;
                    *) log_error "Invalid mode: $1 (must be lite, standard, or full)"; exit 1 ;;
                esac
                shift
                ;;
            --critic) critic_override="true"; shift ;;
            --no-critic) critic_override="false"; shift ;;
            R-*|r-*) refactor_id="$1"; shift ;;
            *) refactor_list="$1"; shift ;;
        esac
    done

    if [[ -z "$refactor_id" ]]; then
        log_error "Refactor ID is required (e.g. R-001)"
        echo ""
        show_help
        exit 1
    fi

    if [[ -z "$refactor_list" ]]; then
        refactor_list=".prizmkit/plans/refactor-list.json"
    fi
    if [[ ! "$refactor_list" = /* ]]; then
        refactor_list="$(pwd)/$refactor_list"
    fi
    REFACTOR_LIST="$refactor_list"

    if [[ ! -f "$refactor_list" ]]; then
        log_error "Refactor list not found: $refactor_list"
        exit 1
    fi

    check_dependencies
    run_log_cleanup

    # Initialize state if needed
    if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
        log_info "Initializing refactor pipeline state..."
        local init_result init_stderr init_tmpstderr
        init_tmpstderr=$(mktemp)
        if ! init_result=$(python3 "$SCRIPTS_DIR/init-refactor-pipeline.py" \
            --refactor-list "$refactor_list" \
            --state-dir "$STATE_DIR" 2>"$init_tmpstderr"); then
            init_stderr=$(cat "$init_tmpstderr" 2>/dev/null || true)
            rm -f "$init_tmpstderr"
            if [[ -n "$init_stderr" ]]; then
                log_warn "$init_stderr"
            fi
            log_error "Refactor pipeline initialization failed (script error)"
            exit 1
        fi
        init_stderr=$(cat "$init_tmpstderr" 2>/dev/null || true)
        rm -f "$init_tmpstderr"

        if [[ -n "$init_stderr" ]]; then
            log_warn "$init_stderr"
        fi

        local init_valid
        init_valid=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('valid', False))" 2>/dev/null || echo "False")

        if [[ "$init_valid" != "True" ]]; then
            log_error "Refactor pipeline initialization failed:"
            echo "$init_result"
            exit 1
        fi

        local refactors_count
        refactors_count=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('refactors_count', 0))" 2>/dev/null || echo "0")
        log_success "Refactor pipeline initialized with $refactors_count refactors"

        # Ensure state directory is gitignored
        local _gitignore_path
        _gitignore_path="$(cd "$SCRIPT_DIR/.." && pwd)/.gitignore"
        local _state_rel
        _state_rel=$(python3 -c "import os; print(os.path.relpath('$STATE_DIR', '$(cd "$SCRIPT_DIR/.." && pwd)'))" 2>/dev/null || echo ".prizmkit/state/refactor")
        if [[ -f "$_gitignore_path" ]]; then
            if ! grep -qF "$_state_rel" "$_gitignore_path" 2>/dev/null; then
                printf '\n# Pipeline runtime state (auto-added by dev-pipeline)\n%s/\n' "$_state_rel" >> "$_gitignore_path"
            fi
        else
            printf '# Pipeline runtime state (auto-added by dev-pipeline)\n%s/\n' "$_state_rel" > "$_gitignore_path"
        fi
    fi

    # Verify refactor exists
    local refactor_title
    refactor_title=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for item in data.get('refactors', []):
    if item.get('id') == sys.argv[2]:
        print(item.get('title', ''))
        sys.exit(0)
sys.exit(1)
" "$refactor_list" "$refactor_id" 2>/dev/null) || {
        log_error "Refactor $refactor_id not found in $refactor_list"
        exit 1
    }

    local refactor_complexity
    refactor_complexity=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for item in data.get('refactors', []):
    if item.get('id') == sys.argv[2]:
        print(item.get('complexity', 'medium'))
        sys.exit(0)
sys.exit(1)
" "$refactor_list" "$refactor_id" 2>/dev/null) || refactor_complexity="medium"

    # Optional Clean
    if [[ "$do_clean" == true ]]; then
        if [[ "$dry_run" == true ]]; then
            log_warn "Dry-run mode: --clean ignored (no artifacts will be deleted)"
        else
            log_info "Cleaning artifacts for $refactor_id..."

            local project_root
            project_root="$(cd "$SCRIPT_DIR/.." && pwd)"

            local refactor_dir="$project_root/.prizmkit/refactor/$refactor_id"
            if [[ -d "$refactor_dir" ]]; then
                rm -rf "$refactor_dir"
                log_info "Removed $refactor_dir"
            fi

            local dev_team_dir="$project_root/.dev-team"
            if [[ -d "$dev_team_dir" ]]; then
                rm -rf "$dev_team_dir"
                log_info "Removed $dev_team_dir"
            fi

            local refactor_state_dir="$STATE_DIR/refactors/$refactor_id"
            if [[ -d "$refactor_state_dir" ]]; then
                rm -rf "$refactor_state_dir"
                log_info "Removed $refactor_state_dir"
            fi
        fi
    fi

    # Reset refactor status (conditional)
    if [[ "$no_reset" == false && "$dry_run" == false ]]; then
        python3 "$SCRIPTS_DIR/update-refactor-status.py" \
            --refactor-list "$refactor_list" \
            --state-dir "$STATE_DIR" \
            --refactor-id "$refactor_id" \
            --action reset >/dev/null 2>&1 || {
            log_warn "Failed to reset refactor status (may already be pending)"
        }
    elif [[ "$dry_run" == true && "$no_reset" == false ]]; then
        log_info "Dry-run mode: skipping status reset"
    fi

    # Generate bootstrap prompt
    local run_id session_id session_dir bootstrap_prompt
    run_id=$(jq -r '.run_id' "$STATE_DIR/pipeline.json")
    session_id="${refactor_id}-$(date +%Y%m%d%H%M%S)"
    session_dir="$STATE_DIR/refactors/$refactor_id/sessions/$session_id"
    mkdir -p "$session_dir/logs"

    bootstrap_prompt="$session_dir/bootstrap-prompt.md"

    # Read retry count from status.json
    local retry_count
    retry_count=$(python3 -c "
import json, os
status_path = os.path.join('$STATE_DIR', 'refactors', '$refactor_id', 'status.json')
if os.path.isfile(status_path):
    with open(status_path) as f:
        d = json.load(f)
    print(d.get('retry_count', 0))
else:
    print(0)
" 2>/dev/null || echo "0")
    local resume_phase
    resume_phase=$(python3 -c "
import json, os
status_path = os.path.join('$STATE_DIR', 'refactors', '$refactor_id', 'status.json')
if os.path.isfile(status_path):
    with open(status_path) as f:
        d = json.load(f)
    print(d.get('resume_from_phase') or 'null')
else:
    print('null')
" 2>/dev/null || echo "null")

    log_info "Generating refactor bootstrap prompt..."
    local prompt_args=(
        --refactor-list "$refactor_list"
        --refactor-id "$refactor_id"
        --session-id "$session_id"
        --run-id "$run_id"
        --retry-count "$retry_count"
        --resume-phase "$resume_phase"
        --state-dir "$STATE_DIR"
        --output "$bootstrap_prompt"
    )

    if [[ -n "$mode_override" ]]; then
        prompt_args+=(--mode "$mode_override")
    elif [[ -n "${PIPELINE_MODE:-}" ]]; then
        prompt_args+=(--mode "$PIPELINE_MODE")
    fi

    if [[ -n "${critic_override:-}" ]]; then
        prompt_args+=(--critic "$critic_override")
    elif [[ "${ENABLE_CRITIC:-}" == "true" || "${ENABLE_CRITIC:-}" == "1" ]]; then
        prompt_args+=(--critic "true")
    elif [[ "${ENABLE_CRITIC:-}" == "false" || "${ENABLE_CRITIC:-}" == "0" ]]; then
        prompt_args+=(--critic "false")
    fi

    local gen_output
    gen_output=$(python3 "$SCRIPTS_DIR/generate-refactor-prompt.py" "${prompt_args[@]}" 2>/dev/null) || {
        log_error "Failed to generate bootstrap prompt for $refactor_id"
        return 1
    }
    local refactor_model pipeline_mode agent_count critic_enabled
    refactor_model=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('model',''))" 2>/dev/null || echo "")
    pipeline_mode=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('pipeline_mode','standard'))" 2>/dev/null || echo "standard")
    agent_count=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('agent_count',3))" 2>/dev/null || echo "3")
    critic_enabled=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('critic_enabled','false'))" 2>/dev/null || echo "false")

    if [[ "$dry_run" == true ]]; then
        echo ""
        echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
        echo -e "${BOLD}  Dry Run: $refactor_id — $refactor_title${NC}"
        echo -e "${BOLD}  Complexity: $refactor_complexity${NC}"
        echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
        echo ""
        log_info "Session ID:    $session_id"
        if [[ -n "$mode_override" ]]; then
            log_info "Mode Override: $mode_override"
        fi
        log_info "Pipeline mode: $pipeline_mode"
        log_info "Agents:        $agent_count (critic: $([ "$critic_enabled" = "true" ] && echo "enabled" || echo "disabled"))"
        if [[ -n "$refactor_model" ]]; then
            log_info "Refactor Model: $refactor_model"
        elif [[ -n "$MODEL" ]]; then
            log_info "Model (env):    $MODEL"
        else
            log_info "Model:          (CLI default)"
        fi
        echo ""
        log_info "Bootstrap prompt written to:"
        echo "  $bootstrap_prompt"
        echo ""
        log_success "Dry run complete. Inspect full prompt with:"
        echo "  cat $bootstrap_prompt"
        return 0
    fi

    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  Refactor: $refactor_id — $refactor_title${NC}"
    echo -e "${BOLD}  Complexity: $refactor_complexity${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    log_info "Session ID: $session_id"
    log_info "Prompt: $bootstrap_prompt"
    log_info "Log: $session_dir/logs/session.log"
    local _run_one_mode_desc
    case "$pipeline_mode" in
        lite)     _run_one_mode_desc="Tier 1 — Single Agent" ;;
        standard) _run_one_mode_desc="Tier 2 — Orchestrator + Dev + Reviewer" ;;
        full)     _run_one_mode_desc="Tier 3 — Full Team (+ Multi-Critic)" ;;
        *)        _run_one_mode_desc="$pipeline_mode" ;;
    esac
    log_info "Pipeline mode: ${BOLD}$pipeline_mode${NC} ($_run_one_mode_desc)"
    log_info "Agents: $agent_count (critic: $([ "$critic_enabled" = "true" ] && echo "enabled" || echo "disabled"))"
    if [[ -n "$refactor_model" ]]; then
        log_info "Refactor model: $refactor_model"
    fi
    if [[ "$STRICT_BEHAVIOR_CHECK" == "1" ]]; then
        log_info "Strict behavior check: enabled"
    fi
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo ""

    cleanup_single_refactor() {
        echo ""
        log_warn "Interrupted. Killing session..."
        kill 0 2>/dev/null || true
        # Log current branch info
        if [[ -n "$_DEV_BRANCH_NAME" ]]; then
            log_info "Development was on branch: $_DEV_BRANCH_NAME"
        fi
        log_info "Session log: $session_dir/logs/session.log"

        # Update refactor status to failed on interrupt
        if [[ -n "$refactor_list" && -f "$refactor_list" ]]; then
            python3 "$SCRIPTS_DIR/update-refactor-status.py" \
                --refactor-list "$refactor_list" \
                --state-dir "$STATE_DIR" \
                --refactor-id "$refactor_id" \
                --session-status "failed" \
                --action update 2>/dev/null || true
            log_info "Refactor $refactor_id marked as failed due to interrupt"
        fi

        # GUARANTEED: always return to original branch (save WIP on dev branch first)
        branch_ensure_return "$(cd "$SCRIPT_DIR/.." && pwd)" "$_ORIGINAL_BRANCH" "$_DEV_BRANCH_NAME"
        exit 130
    }
    trap cleanup_single_refactor SIGINT SIGTERM

    _SPAWN_RESULT=""

    # Branch lifecycle: create and checkout refactor branch
    local _proj_root
    _proj_root="$(cd "$SCRIPT_DIR/.." && pwd)"
    local _source_branch
    _source_branch=$(git -C "$_proj_root" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    _ORIGINAL_BRANCH="$_source_branch"

    # Mark refactor as in-progress (update JSON for runtime monitoring, no commit)
    # The status change will be committed together with the final status update
    # after the session completes, avoiding an extra noise commit per refactor.
    python3 "$SCRIPTS_DIR/update-refactor-status.py" \
        --refactor-list "$refactor_list" \
        --state-dir "$STATE_DIR" \
        --refactor-id "$refactor_id" \
        --action start >/dev/null 2>&1 || true

    local _branch_name="${DEV_BRANCH:-refactor/${refactor_id}-$(date +%s)}"
    if branch_create "$_proj_root" "$_branch_name" "$_source_branch"; then
        _DEV_BRANCH_NAME="$_branch_name"
    else
        log_warn "Failed to create branch; running session on current branch"
    fi

    spawn_and_wait_session \
        "$refactor_id" "$refactor_list" "$session_id" \
        "$bootstrap_prompt" "$session_dir" 999 "$refactor_model" "$_ORIGINAL_BRANCH"
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

    # Commit refactor status update on the original branch (after guaranteed return)
    if ! git -C "$_proj_root" diff --quiet "$refactor_list" 2>/dev/null; then
        git -C "$_proj_root" add "$refactor_list"
        git -C "$_proj_root" commit --no-verify -m "chore($refactor_id): update refactor status" 2>/dev/null || true
    fi

    echo ""
    if [[ "$session_status" == "success" ]]; then
        log_success "════════════════════════════════════════════════════"
        log_success "  $refactor_id completed successfully!"
        log_success "════════════════════════════════════════════════════"
    else
        log_error "════════════════════════════════════════════════════"
        log_error "  $refactor_id result: $session_status"
        log_error "  Review log: $session_dir/logs/session.log"
        log_error "════════════════════════════════════════════════════"
    fi
}

# ============================================================
# Main Loop: Run all refactors
# ============================================================

main() {
    local refactor_list="${1:-.prizmkit/plans/refactor-list.json}"

    if [[ ! "$refactor_list" = /* ]]; then
        refactor_list="$(pwd)/$refactor_list"
    fi
    REFACTOR_LIST="$refactor_list"

    if [[ ! -f "$refactor_list" ]]; then
        log_error "Refactor list not found: $refactor_list"
        log_info "Create a refactor list first using the refactor-planner skill,"
        log_info "or provide a path: ./run-refactor.sh run <path-to-.prizmkit/plans/refactor-list.json>"
        exit 1
    fi

    check_dependencies
    run_log_cleanup

    # Initialize pipeline state if needed
    if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
        log_info "Initializing refactor pipeline state..."
        local init_result init_stderr init_tmpstderr
        init_tmpstderr=$(mktemp)
        if ! init_result=$(python3 "$SCRIPTS_DIR/init-refactor-pipeline.py" \
            --refactor-list "$refactor_list" \
            --state-dir "$STATE_DIR" 2>"$init_tmpstderr"); then
            init_stderr=$(cat "$init_tmpstderr" 2>/dev/null || true)
            rm -f "$init_tmpstderr"
            if [[ -n "$init_stderr" ]]; then
                log_warn "$init_stderr"
            fi
            log_error "Refactor pipeline initialization failed (script error)"
            exit 1
        fi
        init_stderr=$(cat "$init_tmpstderr" 2>/dev/null || true)
        rm -f "$init_tmpstderr"

        if [[ -n "$init_stderr" ]]; then
            log_warn "$init_stderr"
        fi

        local init_valid
        init_valid=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('valid', False))" 2>/dev/null || echo "False")

        if [[ "$init_valid" != "True" ]]; then
            log_error "Refactor pipeline initialization failed:"
            echo "$init_result"
            exit 1
        fi

        local refactors_count
        refactors_count=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('refactors_count', 0))" 2>/dev/null || echo "0")
        log_success "Refactor pipeline initialized with $refactors_count refactors"

        # Ensure state directory is gitignored
        local _gitignore_path
        _gitignore_path="$(cd "$SCRIPT_DIR/.." && pwd)/.gitignore"
        local _state_rel
        _state_rel=$(python3 -c "import os; print(os.path.relpath('$STATE_DIR', '$(cd "$SCRIPT_DIR/.." && pwd)'))" 2>/dev/null || echo ".prizmkit/state/refactor")
        if [[ -f "$_gitignore_path" ]]; then
            if ! grep -qF "$_state_rel" "$_gitignore_path" 2>/dev/null; then
                printf '\n# Pipeline runtime state (auto-added by dev-pipeline)\n%s/\n' "$_state_rel" >> "$_gitignore_path"
            fi
        else
            printf '# Pipeline runtime state (auto-added by dev-pipeline)\n%s/\n' "$_state_rel" > "$_gitignore_path"
        fi
    else
        log_info "Resuming existing refactor pipeline..."
    fi

    # Print header
    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}        Refactor Pipeline Runner Started${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    log_info "Refactor list: $refactor_list"
    log_info "Max retries per refactor: $MAX_RETRIES"
    if [[ $SESSION_TIMEOUT -gt 0 ]]; then
        log_info "Session timeout: ${SESSION_TIMEOUT}s"
    else
        log_info "Session timeout: none"
    fi
    log_info "AI CLI: $CLI_CMD (platform: $PLATFORM)"
    if [[ -n "${MODEL:-}" ]]; then
        log_info "Default Model: $MODEL"
    fi
    if [[ "$STRICT_BEHAVIOR_CHECK" == "1" ]]; then
        log_info "Strict behavior check: enabled"
    else
        log_info "Strict behavior check: disabled"
    fi
    if [[ "$STOP_ON_FAILURE" == "1" ]]; then
        log_info "Stop on failure: enabled"
    fi
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo ""

    # Branch lifecycle: per-refactor branches (like feature pipeline)
    local _proj_root
    _proj_root="$(cd "$SCRIPT_DIR/.." && pwd)"
    local _source_branch
    _source_branch=$(git -C "$_proj_root" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    _ORIGINAL_BRANCH="$_source_branch"

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

        # Find next refactor to process (dependency-topological order)
        local next_refactor
        if ! next_refactor=$(python3 "$SCRIPTS_DIR/update-refactor-status.py" \
            --refactor-list "$refactor_list" \
            --state-dir "$STATE_DIR" \
            --max-retries "$MAX_RETRIES" \
            --action get_next 2>/dev/null); then
            log_error "Failed to get next refactor"
            break
        fi

        if [[ "$next_refactor" == "PIPELINE_COMPLETE" ]]; then
            echo ""
            log_success "════════════════════════════════════════════════════"
            log_success "  All refactors processed! Refactor pipeline finished."
            log_success "  Total sessions: $session_count"
            log_success "  Total subagent calls: $total_subagent_calls"
            log_success "════════════════════════════════════════════════════"

            # ── Deploy session (only if ENABLE_DEPLOY=1 and all refactors completed) ──
            if [[ "$ENABLE_DEPLOY" == "1" ]]; then
                local incomplete_count
                incomplete_count=$({ python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
bad = [r for r in data.get('refactors', [])
       if r.get('status') not in ('completed', 'skipped')]
for r in bad:
    print(f\"  {r['id']}: {r.get('status', 'unknown')} — {r.get('title', '')}\")
print(len(bad))
" "$refactor_list" 2>/dev/null || echo "0"; } | tee /dev/stderr | tail -1)

                if [[ "$incomplete_count" -gt 0 ]]; then
                    echo ""
                    log_warn "DEPLOY BLOCKED: $incomplete_count refactor(s) not completed successfully."
                    log_warn "Fix failed refactors and re-run, or manually run /prizmkit-deploy."
                else
                    echo ""
                    log_info "All refactors completed — starting deploy session..."
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

All refactor tasks have been completed successfully.

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

        if [[ "$next_refactor" == "PIPELINE_BLOCKED" ]]; then
            log_warn "All remaining refactors are blocked (failed/dependency unmet)."
            log_warn "Run './run-refactor.sh status' to see details."
            log_warn "Waiting 60s before re-checking... (Ctrl+C to stop)"
            sleep 60
            continue
        fi

        # Parse refactor info
        local refactor_id refactor_title refactor_complexity retry_count resume_phase
        refactor_id=$(echo "$next_refactor" | jq -r '.refactor_id')
        refactor_title=$(echo "$next_refactor" | jq -r '.title')
        refactor_complexity=$(echo "$next_refactor" | jq -r '.complexity')
        retry_count=$(echo "$next_refactor" | jq -r '.retry_count // 0')
        resume_phase=$(echo "$next_refactor" | jq -r '.resume_from_phase // "null"')

        echo ""
        echo -e "${BOLD}────────────────────────────────────────────────────${NC}"
        log_info "Refactor: ${BOLD}$refactor_id${NC} — $refactor_title"
        log_info "Complexity: $refactor_complexity | Retry: $retry_count / $MAX_RETRIES"
        if [[ "$resume_phase" != "null" ]]; then
            log_info "Resuming from Phase $resume_phase"
        fi
        echo -e "${BOLD}────────────────────────────────────────────────────${NC}"

        # Pre-commit any dirty tree from previous iteration
        if ! git -C "$_proj_root" diff --quiet HEAD 2>/dev/null || [ -n "$(git -C "$_proj_root" ls-files --others --exclude-standard 2>/dev/null)" ]; then
            log_info "Dirty working tree detected — committing before $refactor_id..."
            git -C "$_proj_root" add -A 2>/dev/null || true
            git -C "$_proj_root" commit --no-verify -m "chore: capture artifacts before $refactor_id session" 2>/dev/null || true
        fi

        # Mark refactor as in-progress BEFORE creating dev branch
        # This ensures the in_progress status commit lands on the original branch,
        # not the dev branch — preventing rebase conflicts in branch_merge later.
        python3 "$SCRIPTS_DIR/update-refactor-status.py" \
            --refactor-list "$refactor_list" \
            --state-dir "$STATE_DIR" \
            --refactor-id "$refactor_id" \
            --action start >/dev/null 2>&1 || true
        # Commit the in_progress status on the original branch
        if ! git -C "$_proj_root" diff --quiet "$refactor_list" 2>/dev/null; then
            git -C "$_proj_root" add "$refactor_list" 2>/dev/null || true
            git -C "$_proj_root" commit --no-verify -m "chore($refactor_id): mark in_progress" 2>/dev/null || true
        fi

        # Create per-refactor dev branch (from the now-updated original branch)
        local _refactor_branch="${DEV_BRANCH:-refactor/${refactor_id}-$(date +%Y%m%d%H%M)}"
        if branch_create "$_proj_root" "$_refactor_branch" "$_ORIGINAL_BRANCH"; then
            _DEV_BRANCH_NAME="$_refactor_branch"
            log_info "Dev branch: $_refactor_branch"
        else
            log_warn "Failed to create dev branch; running on current branch: $_ORIGINAL_BRANCH"
            _DEV_BRANCH_NAME=""
        fi

        # Generate session
        local session_id run_id
        run_id=$(jq -r '.run_id' "$STATE_DIR/pipeline.json")
        session_id="${refactor_id}-$(date +%Y%m%d%H%M%S)"

        local session_dir="$STATE_DIR/refactors/$refactor_id/sessions/$session_id"
        mkdir -p "$session_dir/logs"

        local bootstrap_prompt="$session_dir/bootstrap-prompt.md"

        local main_prompt_args=(
            --refactor-list "$refactor_list"
            --refactor-id "$refactor_id"
            --session-id "$session_id"
            --run-id "$run_id"
            --retry-count "$retry_count"
            --resume-phase "$resume_phase"
            --state-dir "$STATE_DIR"
            --output "$bootstrap_prompt"
        )

        # Support PIPELINE_MODE env var (set by launch-refactor-daemon.sh --mode)
        if [[ -n "${PIPELINE_MODE:-}" ]]; then
            main_prompt_args+=(--mode "$PIPELINE_MODE")
        fi

        # Support ENABLE_CRITIC env var (set by launch-refactor-daemon.sh --critic)
        if [[ "${ENABLE_CRITIC:-}" == "true" || "${ENABLE_CRITIC:-}" == "1" ]]; then
            main_prompt_args+=(--critic "true")
        elif [[ "${ENABLE_CRITIC:-}" == "false" || "${ENABLE_CRITIC:-}" == "0" ]]; then
            main_prompt_args+=(--critic "false")
        fi

        local gen_output
        gen_output=$(python3 "$SCRIPTS_DIR/generate-refactor-prompt.py" "${main_prompt_args[@]}" 2>/dev/null) || {
            log_error "Failed to generate bootstrap prompt for $refactor_id"
            branch_ensure_return "$_proj_root" "$_ORIGINAL_BRANCH"
            _DEV_BRANCH_NAME=""
            continue
        }
        local refactor_model pipeline_mode agent_count critic_enabled
        refactor_model=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('model',''))" 2>/dev/null || echo "")
        pipeline_mode=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('pipeline_mode','standard'))" 2>/dev/null || echo "standard")
        agent_count=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('agent_count',3))" 2>/dev/null || echo "3")
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

        if [[ -n "$refactor_model" ]]; then
            log_info "Refactor model: $refactor_model"
        fi

        # Spawn session
        log_info "Spawning AI CLI session: $session_id"
        _SPAWN_RESULT=""

        spawn_and_wait_session \
            "$refactor_id" "$refactor_list" "$session_id" \
            "$bootstrap_prompt" "$session_dir" "$MAX_RETRIES" "$refactor_model" "$_ORIGINAL_BRANCH"

        # Validate key artifacts after successful session
        if [[ "$_SPAWN_RESULT" == "success" ]]; then
            local _artifact_root
            _artifact_root="$(cd "$SCRIPT_DIR/.." && pwd)"
            local plan_file="$_artifact_root/.prizmkit/refactor/$refactor_id/plan.md"
            if [[ ! -f "$plan_file" ]]; then
                log_warn "ARTIFACT_MISSING: plan.md not found at $plan_file"
            else
                log_info "ARTIFACT_CHECK: plan.md exists for $refactor_id"
            fi
        fi

        local session_status="$_SPAWN_RESULT"

        # Merge per-refactor dev branch back to original on success
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

        # Commit refactor status update on the original branch (after guaranteed return)
        if ! git -C "$_proj_root" diff --quiet "$refactor_list" 2>/dev/null; then
            git -C "$_proj_root" add "$refactor_list"
            git -C "$_proj_root" commit --no-verify -m "chore($refactor_id): update refactor status" 2>/dev/null || true
        fi

        # Stuck detection
        if python3 "$SCRIPTS_DIR/detect-stuck.py" \
            --state-dir "$STATE_DIR" \
            --pipeline-type refactor \
            --refactor-list "$REFACTOR_LIST" \
            --max-retries "$MAX_RETRIES" \
            2>/dev/null | jq -e '.stuck_count > 0' >/dev/null 2>&1; then
            log_warn "STUCK_DETECTED: Some refactors may be stuck — run detect-stuck.py for details"
        fi

        session_count=$((session_count + 1))
        total_subagent_calls=$((total_subagent_calls + _SUBAGENT_COUNT))

        # Stop-on-failure: abort pipeline if task failed and STOP_ON_FAILURE is enabled
        if [[ "$session_status" != "success" && "$STOP_ON_FAILURE" == "1" ]]; then
            echo ""
            log_error "════════════════════════════════════════════════════"
            log_error "  STOP_ON_FAILURE: Pipeline halted after $refactor_id failed."
            log_error "  Total sessions completed: $session_count"
            log_error "  Set STOP_ON_FAILURE=0 to continue past failures."
            log_error "════════════════════════════════════════════════════"
            break
        fi

        log_info "Pausing 5s before next refactor..."
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
    echo "  run [.prizmkit/plans/refactor-list.json]                Run all refactors in dependency-topological order"
    echo "  run <refactor-id> [options]              Run a single refactor"
    echo "  status [.prizmkit/plans/refactor-list.json]              Show refactor pipeline status"
    echo "  reset                                    Clear all refactor state"
    echo "  help                                     Show this help message"
    echo ""
    echo "Single Refactor Options (run <refactor-id>):"
    echo "  --dry-run                   Generate bootstrap prompt only, don't spawn session"
    echo "  --clean                     Delete artifacts and reset before running"
    echo "  --no-reset                  Skip status reset (preserve retry count)"
    echo "  --timeout N                 Session timeout in seconds (default: 0 = no limit)"
    echo "  --mode <lite|standard|full> Override pipeline mode"
    echo "  --critic                    Enable adversarial critic review"
    echo "  --no-critic                 Disable adversarial critic review"
    echo ""
    echo "Environment Variables:"
    echo "  MAX_RETRIES              Max retries per refactor (default: 3)"
    echo "  SESSION_TIMEOUT          Session timeout in seconds (default: 0 = no limit)"
    echo "  MODEL                    Default AI model (overridden by per-refactor model in refactor list)"
    echo "  PIPELINE_MODE            Default pipeline mode: lite|standard|full (overridden by --mode)"
    echo "  ENABLE_CRITIC            Enable/disable critic: true|false|1|0 (overridden by --critic/--no-critic)"
    echo "  AI_CLI                   AI CLI command name (auto-detected: cbc or claude)"
    echo "  VERBOSE                  Set to 1 for verbose AI CLI output"
    echo "  STRICT_BEHAVIOR_CHECK    Force full test suite after each refactor (default: 1)"
    echo "  HEARTBEAT_INTERVAL       Heartbeat log interval in seconds (default: 30)"
    echo "  STALE_KILL_THRESHOLD     Auto-kill session after N seconds of no progress (default: 900)"
    echo "  STOP_ON_FAILURE          Stop pipeline when a task exhausts retries: 0|1 (default: 0)"
    echo "  LOG_CLEANUP_ENABLED      Run log cleanup before execution (default: 1)"
    echo "  LOG_RETENTION_DAYS       Delete logs older than N days (default: 14)"
    echo "  LOG_MAX_TOTAL_MB         Keep total logs under N MB (default: 1024)"
    echo ""
    echo "Examples:"
    echo "  ./run-refactor.sh run                                    # Run all refactors"
    echo "  ./run-refactor.sh run .prizmkit/plans/refactor-list.json                 # Custom refactor list"
    echo "  ./run-refactor.sh run R-001 --dry-run                    # Inspect generated prompt"
    echo "  ./run-refactor.sh run R-001 --timeout 3600               # 1h timeout"
    echo "  ./run-refactor.sh status                                 # Show status"
    echo "  STRICT_BEHAVIOR_CHECK=0 ./run-refactor.sh run            # Skip full test suite"
    echo "  MAX_RETRIES=5 ./run-refactor.sh run                      # Custom retries"
}

case "${1:-run}" in
    run|resume)
        shift || true
        if [[ "${1:-}" =~ ^[Rr]-[0-9]+ ]]; then
            run_one "$@"
        else
            main "${1:-.prizmkit/plans/refactor-list.json}"
        fi
        ;;
    status)
        check_dependencies
        if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
            log_error "No refactor pipeline state found. Run './run-refactor.sh run' first."
            exit 1
        fi
        python3 "$SCRIPTS_DIR/update-refactor-status.py" \
            --refactor-list "${2:-.prizmkit/plans/refactor-list.json}" \
            --state-dir "$STATE_DIR" \
            --action status
        ;;
    reset)
        log_warn "Resetting refactor pipeline state..."
        rm -rf "$STATE_DIR"
        log_success "Refactor state cleared. Run './run-refactor.sh run' to start fresh."
        ;;
    unskip)
        check_dependencies
        if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
            log_error "No refactor pipeline state found. Run './run-refactor.sh run' first."
            exit 1
        fi
        _unskip_refactor_list=".prizmkit/plans/refactor-list.json"
        _unskip_refactor_id=""
        shift || true
        # Parse arguments: optional refactor-id and refactor-list path
        while [[ $# -gt 0 ]]; do
            if [[ "$1" =~ ^[Rr]-[0-9]+ ]]; then
                _unskip_refactor_id="$1"
            else
                _unskip_refactor_list="$1"
            fi
            shift
        done
        _unskip_args=(
            --refactor-list "$_unskip_refactor_list"
            --state-dir "$STATE_DIR"
            --action unskip
        )
        if [[ -n "$_unskip_refactor_id" ]]; then
            _unskip_args+=(--refactor-id "$_unskip_refactor_id")
        fi
        python3 "$SCRIPTS_DIR/update-refactor-status.py" "${_unskip_args[@]}"

        # Commit the status change
        if ! git diff --quiet "$_unskip_refactor_list" 2>/dev/null; then
            git add "$_unskip_refactor_list"
            git commit -m "chore: unskip auto-skipped refactors" 2>/dev/null || true
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
