#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/run-bugfix.sh - Autonomous Bug Fix Pipeline Runner
#
# Drives the prizm-dev-team through iterative AI CLI sessions to
# fix bugs from a .prizmkit/plans/bug-fix-list.json specification.
#
# Usage:
#   ./run-bugfix.sh run [.prizmkit/plans/bug-fix-list.json]          Run all bugs
#   ./run-bugfix.sh run <bug-id> [options]            Run a single bug
#   ./run-bugfix.sh status [.prizmkit/plans/bug-fix-list.json]        Show pipeline status
#   ./run-bugfix.sh reset                             Clear all state
#
# Environment Variables:
#   MAX_RETRIES           Max retries per bug (default: 3)
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
#   DEV_BRANCH            Custom dev branch name (default: auto-generated bugfix/pipeline-{run_id})
#   AUTO_PUSH             Auto-push to remote after successful bug fix (default: 0). Set to 1 to enable.
#   STOP_ON_FAILURE       Stop pipeline after a task exhausts all retries (default: 0). Set to 1 to stop.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
STATE_DIR="${PROJECT_ROOT}/.prizmkit/state/bugfix"
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

# Bug list path (set in main, used by cleanup trap)
BUG_LIST=""

# Branch tracking (for cleanup on interrupt)
_ORIGINAL_BRANCH=""
_DEV_BRANCH_NAME=""

# ============================================================
# Shared: Spawn AI CLI session and wait for result
# ============================================================

spawn_and_wait_session() {
    local bug_id="$1"
    local bug_list="$2"
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
    # within an existing Claude Code session (e.g. via launch-bugfix-daemon.sh).
    unset CLAUDECODE 2>/dev/null || true

    # Log bootstrap prompt in test mode
    prizm_log_bootstrap_prompt "$bootstrap_prompt" "$bug_id"

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
                if git -C "$project_root" commit --no-verify -m "chore($bug_id): auto-commit session work (stale-killed)" 2>/dev/null; then
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
                if git -C "$project_root" commit --no-verify -m "chore($bug_id): auto-commit session work" 2>/dev/null; then
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
                    || git -C "$project_root" commit --no-verify -m "chore($bug_id): include remaining session artifacts" 2>/dev/null \
                    || true
            fi
        fi
    fi

    log_info "Session result: $session_status"

    # Validate checkpoint completeness after successful session
    if [[ "$session_status" == "success" ]]; then
        local _ckpt_root
        _ckpt_root="$(cd "$SCRIPT_DIR/.." && pwd)"
        local checkpoint_file="$_ckpt_root/.prizmkit/bugfix/${bug_id}/workflow-checkpoint.json"
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
        fi
    fi

    # Subagent detection
    prizm_detect_subagents "$session_log"

    # Update bug status (do NOT commit on dev branch — commit happens after merge)
    python3 "$SCRIPTS_DIR/update-bug-status.py" \
        --bug-list "$bug_list" \
        --state-dir "$STATE_DIR" \
        --bug-id "$bug_id" \
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

    # Update status of currently in-progress bug to interrupted
    if [[ -n "$BUG_LIST" && -f "$BUG_LIST" ]]; then
        # Find any in-progress bug and mark it as failed
        local _interrupted_id
        _interrupted_id=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for bug in data.get('bugs', []):
    if bug.get('status') == 'in_progress':
        print(bug['id'])
        break
" "$BUG_LIST" 2>/dev/null || echo "")

        if [[ -n "$_interrupted_id" ]]; then
            python3 "$SCRIPTS_DIR/update-bug-status.py" \
                --bug-list "$BUG_LIST" \
                --state-dir "$STATE_DIR" \
                --bug-id "$_interrupted_id" \
                --session-status "failed" \
                --action update 2>/dev/null || true
            log_info "Bug $_interrupted_id marked as failed due to interrupt"
        fi

        # Pause the pipeline
        python3 "$SCRIPTS_DIR/update-bug-status.py" \
            --bug-list "$BUG_LIST" \
            --state-dir "$STATE_DIR" \
            --action pause 2>/dev/null || true
    fi

    # GUARANTEED: always return to original branch (save WIP on dev branch first)
    branch_ensure_return "$(cd "$SCRIPT_DIR/.." && pwd)" "$_ORIGINAL_BRANCH" "$_DEV_BRANCH_NAME"

    log_info "Bug fix pipeline paused. Run './run-bugfix.sh run' to resume."
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
# run-one: Run a single bug fix
# ============================================================

run_one() {
    local bug_id=""
    local bug_list=""
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
            B-*|b-*) bug_id="$1"; shift ;;
            *) bug_list="$1"; shift ;;
        esac
    done

    if [[ -z "$bug_id" ]]; then
        log_error "Bug ID is required (e.g. B-001)"
        echo ""
        show_help
        exit 1
    fi

    if [[ -z "$bug_list" ]]; then
        bug_list=".prizmkit/plans/bug-fix-list.json"
    fi
    if [[ ! "$bug_list" = /* ]]; then
        bug_list="$(pwd)/$bug_list"
    fi
    BUG_LIST="$bug_list"

    if [[ ! -f "$bug_list" ]]; then
        log_error "Bug fix list not found: $bug_list"
        exit 1
    fi

    check_dependencies
    run_log_cleanup

    # Initialize state if needed
    if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
        log_info "Initializing bugfix pipeline state..."
        local init_result init_stderr init_tmpstderr
        init_tmpstderr=$(mktemp)
        if ! init_result=$(python3 "$SCRIPTS_DIR/init-bugfix-pipeline.py" \
            --bug-list "$bug_list" \
            --state-dir "$STATE_DIR" 2>"$init_tmpstderr"); then
            init_stderr=$(cat "$init_tmpstderr" 2>/dev/null || true)
            rm -f "$init_tmpstderr"
            if [[ -n "$init_stderr" ]]; then
                log_warn "$init_stderr"
            fi
            log_error "Bugfix pipeline initialization failed (script error)"
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
            log_error "Bugfix pipeline initialization failed:"
            echo "$init_result"
            exit 1
        fi

        local bugs_count
        bugs_count=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('bugs_count', 0))" 2>/dev/null || echo "0")
        log_success "Bugfix pipeline initialized with $bugs_count bugs"

        # Ensure state directory is gitignored
        local _gitignore_path
        _gitignore_path="$(cd "$SCRIPT_DIR/.." && pwd)/.gitignore"
        local _state_rel
        _state_rel=$(python3 -c "import os; print(os.path.relpath('$STATE_DIR', '$(cd "$SCRIPT_DIR/.." && pwd)'))" 2>/dev/null || echo ".prizmkit/state/bugfix")
        if [[ -f "$_gitignore_path" ]]; then
            if ! grep -qF "$_state_rel" "$_gitignore_path" 2>/dev/null; then
                printf '\n# Pipeline runtime state (auto-added by dev-pipeline)\n%s/\n' "$_state_rel" >> "$_gitignore_path"
            fi
        else
            printf '# Pipeline runtime state (auto-added by dev-pipeline)\n%s/\n' "$_state_rel" > "$_gitignore_path"
        fi
    fi

    # Verify bug exists
    local bug_title
    bug_title=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for bug in data.get('bugs', []):
    if bug.get('id') == sys.argv[2]:
        print(bug.get('title', ''))
        sys.exit(0)
sys.exit(1)
" "$bug_list" "$bug_id" 2>/dev/null) || {
        log_error "Bug $bug_id not found in $bug_list"
        exit 1
    }

    local bug_severity
    bug_severity=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for bug in data.get('bugs', []):
    if bug.get('id') == sys.argv[2]:
        print(bug.get('severity', 'medium'))
        sys.exit(0)
sys.exit(1)
" "$bug_list" "$bug_id" 2>/dev/null) || bug_severity="medium"

    # Optional Clean
    if [[ "$do_clean" == true ]]; then
        if [[ "$dry_run" == true ]]; then
            log_warn "Dry-run mode: --clean ignored (no artifacts will be deleted)"
        else
            log_info "Cleaning artifacts for $bug_id..."

            local project_root
            project_root="$(cd "$SCRIPT_DIR/.." && pwd)"

            local bugfix_dir="$project_root/.prizmkit/bugfix/$bug_id"
            if [[ -d "$bugfix_dir" ]]; then
                rm -rf "$bugfix_dir"
                log_info "Removed $bugfix_dir"
            fi

            local dev_team_dir="$project_root/.dev-team"
            if [[ -d "$dev_team_dir" ]]; then
                rm -rf "$dev_team_dir"
                log_info "Removed $dev_team_dir"
            fi

            local bug_state_dir="$STATE_DIR/bugs/$bug_id"
            if [[ -d "$bug_state_dir" ]]; then
                rm -rf "$bug_state_dir"
                log_info "Removed $bug_state_dir"
            fi
        fi
    fi

    # Reset bug status (conditional)
    if [[ "$no_reset" == false && "$dry_run" == false ]]; then
        python3 "$SCRIPTS_DIR/update-bug-status.py" \
            --bug-list "$bug_list" \
            --state-dir "$STATE_DIR" \
            --bug-id "$bug_id" \
            --action reset >/dev/null 2>&1 || {
            log_warn "Failed to reset bug status (may already be pending)"
        }
    elif [[ "$dry_run" == true && "$no_reset" == false ]]; then
        log_info "Dry-run mode: skipping status reset"
    fi

    # Generate bootstrap prompt
    local run_id session_id session_dir bootstrap_prompt
    run_id=$(jq -r '.run_id' "$STATE_DIR/pipeline.json")
    session_id="${bug_id}-$(date +%Y%m%d%H%M%S)"
    session_dir="$STATE_DIR/bugs/$bug_id/sessions/$session_id"
    mkdir -p "$session_dir/logs"

    bootstrap_prompt="$session_dir/bootstrap-prompt.md"

    # Read retry count from status.json
    local retry_count
    retry_count=$(python3 -c "
import json, os
status_path = os.path.join('$STATE_DIR', 'bugs', '$bug_id', 'status.json')
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
status_path = os.path.join('$STATE_DIR', 'bugs', '$bug_id', 'status.json')
if os.path.isfile(status_path):
    with open(status_path) as f:
        d = json.load(f)
    print(d.get('resume_from_phase') or 'null')
else:
    print('null')
" 2>/dev/null || echo "null")

    log_info "Generating bugfix bootstrap prompt..."
    local prompt_args=(
        --bug-list "$bug_list"
        --bug-id "$bug_id"
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
    gen_output=$(python3 "$SCRIPTS_DIR/generate-bugfix-prompt.py" "${prompt_args[@]}" 2>/dev/null) || {
        log_error "Failed to generate bootstrap prompt for $bug_id"
        return 1
    }
    local bug_model pipeline_mode agent_count critic_enabled
    bug_model=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('model',''))" 2>/dev/null || echo "")
    pipeline_mode=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('pipeline_mode','standard'))" 2>/dev/null || echo "standard")
    agent_count=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('agent_count',3))" 2>/dev/null || echo "3")
    critic_enabled=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('critic_enabled','false'))" 2>/dev/null || echo "false")

    if [[ "$dry_run" == true ]]; then
        echo ""
        echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
        echo -e "${BOLD}  Dry Run: $bug_id — $bug_title${NC}"
        echo -e "${BOLD}  Severity: $bug_severity${NC}"
        echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
        echo ""
        log_info "Session ID:    $session_id"
        if [[ -n "$mode_override" ]]; then
            log_info "Mode Override: $mode_override"
        fi
        log_info "Pipeline mode: $pipeline_mode"
        log_info "Agents:        $agent_count (critic: $([ "$critic_enabled" = "true" ] && echo "enabled" || echo "disabled"))"
        if [[ -n "$bug_model" ]]; then
            log_info "Bug Model:     $bug_model"
        elif [[ -n "$MODEL" ]]; then
            log_info "Model (env):   $MODEL"
        else
            log_info "Model:         (CLI default)"
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
    echo -e "${BOLD}  Bug Fix: $bug_id — $bug_title${NC}"
    echo -e "${BOLD}  Severity: $bug_severity${NC}"
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
    if [[ -n "$bug_model" ]]; then
        log_info "Bug model: $bug_model"
    fi
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo ""

    cleanup_single_bug() {
        echo ""
        log_warn "Interrupted. Killing session..."
        kill 0 2>/dev/null || true
        # Log current branch info
        if [[ -n "$_DEV_BRANCH_NAME" ]]; then
            log_info "Development was on branch: $_DEV_BRANCH_NAME"
        fi
        log_info "Session log: $session_dir/logs/session.log"

        # Update bug status to failed on interrupt
        if [[ -n "$bug_list" && -f "$bug_list" ]]; then
            python3 "$SCRIPTS_DIR/update-bug-status.py" \
                --bug-list "$bug_list" \
                --state-dir "$STATE_DIR" \
                --bug-id "$bug_id" \
                --session-status "failed" \
                --action update 2>/dev/null || true
            log_info "Bug $bug_id marked as failed due to interrupt"
        fi

        # GUARANTEED: always return to original branch (save WIP on dev branch first)
        branch_ensure_return "$(cd "$SCRIPT_DIR/.." && pwd)" "$_ORIGINAL_BRANCH" "$_DEV_BRANCH_NAME"
        exit 130
    }
    trap cleanup_single_bug SIGINT SIGTERM

    _SPAWN_RESULT=""

    # Branch lifecycle: create and checkout bugfix branch
    local _proj_root
    _proj_root="$(cd "$SCRIPT_DIR/.." && pwd)"
    local _source_branch
    _source_branch=$(git -C "$_proj_root" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    _ORIGINAL_BRANCH="$_source_branch"

    # Mark bug as in-progress (update JSON for runtime monitoring, no commit)
    # The status change will be committed together with the final status update
    # after the session completes, avoiding an extra noise commit per bug.
    python3 "$SCRIPTS_DIR/update-bug-status.py" \
        --bug-list "$bug_list" \
        --state-dir "$STATE_DIR" \
        --bug-id "$bug_id" \
        --action start >/dev/null 2>&1 || true

    local _branch_name="${DEV_BRANCH:-bugfix/${bug_id}-$(date +%s)}"
    if branch_create "$_proj_root" "$_branch_name" "$_source_branch"; then
        _DEV_BRANCH_NAME="$_branch_name"
    else
        log_warn "Failed to create branch; running session on current branch"
    fi

    spawn_and_wait_session \
        "$bug_id" "$bug_list" "$session_id" \
        "$bootstrap_prompt" "$session_dir" 999 "$bug_model" "$_ORIGINAL_BRANCH"
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

    # Commit bug status update on the original branch (after guaranteed return)
    if ! git -C "$_proj_root" diff --quiet "$bug_list" 2>/dev/null; then
        git -C "$_proj_root" add "$bug_list"
        git -C "$_proj_root" commit --no-verify -m "chore($bug_id): update bug status" 2>/dev/null || true
    fi

    echo ""
    if [[ "$session_status" == "success" ]]; then
        log_success "════════════════════════════════════════════════════"
        log_success "  $bug_id fixed successfully!"
        log_success "════════════════════════════════════════════════════"
    else
        log_error "════════════════════════════════════════════════════"
        log_error "  $bug_id result: $session_status"
        log_error "  Review log: $session_dir/logs/session.log"
        log_error "════════════════════════════════════════════════════"
    fi
}

# ============================================================
# Main Loop: Run all bugs
# ============================================================

main() {
    local bug_list="${1:-.prizmkit/plans/bug-fix-list.json}"

    if [[ ! "$bug_list" = /* ]]; then
        bug_list="$(pwd)/$bug_list"
    fi
    BUG_LIST="$bug_list"

    if [[ ! -f "$bug_list" ]]; then
        log_error "Bug fix list not found: $bug_list"
        log_info "Create a bug fix list first using the bug-planner skill,"
        log_info "or provide a path: ./run-bugfix.sh run <path-to-.prizmkit/plans/bug-fix-list.json>"
        exit 1
    fi

    check_dependencies
    run_log_cleanup

    # Initialize pipeline state if needed
    if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
        log_info "Initializing bugfix pipeline state..."
        local init_result init_stderr init_tmpstderr
        init_tmpstderr=$(mktemp)
        if ! init_result=$(python3 "$SCRIPTS_DIR/init-bugfix-pipeline.py" \
            --bug-list "$bug_list" \
            --state-dir "$STATE_DIR" 2>"$init_tmpstderr"); then
            init_stderr=$(cat "$init_tmpstderr" 2>/dev/null || true)
            rm -f "$init_tmpstderr"
            if [[ -n "$init_stderr" ]]; then
                log_warn "$init_stderr"
            fi
            log_error "Bugfix pipeline initialization failed (script error)"
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
            log_error "Bugfix pipeline initialization failed:"
            echo "$init_result"
            exit 1
        fi

        local bugs_count
        bugs_count=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('bugs_count', 0))" 2>/dev/null || echo "0")
        log_success "Bugfix pipeline initialized with $bugs_count bugs"

        # Ensure state directory is gitignored
        local _gitignore_path
        _gitignore_path="$(cd "$SCRIPT_DIR/.." && pwd)/.gitignore"
        local _state_rel
        _state_rel=$(python3 -c "import os; print(os.path.relpath('$STATE_DIR', '$(cd "$SCRIPT_DIR/.." && pwd)'))" 2>/dev/null || echo ".prizmkit/state/bugfix")
        if [[ -f "$_gitignore_path" ]]; then
            if ! grep -qF "$_state_rel" "$_gitignore_path" 2>/dev/null; then
                printf '\n# Pipeline runtime state (auto-added by dev-pipeline)\n%s/\n' "$_state_rel" >> "$_gitignore_path"
            fi
        else
            printf '# Pipeline runtime state (auto-added by dev-pipeline)\n%s/\n' "$_state_rel" > "$_gitignore_path"
        fi
    else
        log_info "Resuming existing bugfix pipeline..."
    fi

    # Print header
    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}        Bug-Fix Pipeline Runner Started${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    log_info "Bug fix list: $bug_list"
    log_info "Max retries per bug: $MAX_RETRIES"
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

    # Branch lifecycle: per-bug branches (like feature pipeline)
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

        # Find next bug to process
        local next_bug
        if ! next_bug=$(python3 "$SCRIPTS_DIR/update-bug-status.py" \
            --bug-list "$bug_list" \
            --state-dir "$STATE_DIR" \
            --max-retries "$MAX_RETRIES" \
            --action get_next 2>/dev/null); then
            log_error "Failed to get next bug"
            break
        fi

        if [[ "$next_bug" == "PIPELINE_COMPLETE" ]]; then
            echo ""
            log_success "════════════════════════════════════════════════════"
            log_success "  All bugs processed! Bug fix pipeline finished."
            log_success "  Total sessions: $session_count"
            log_success "  Total subagent calls: $total_subagent_calls"
            log_success "════════════════════════════════════════════════════"

            # ── Deploy session (only if ENABLE_DEPLOY=1 and all bugs fixed) ──
            if [[ "$ENABLE_DEPLOY" == "1" ]]; then
                local incomplete_count
                incomplete_count=$({ python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
bad = [b for b in data.get('bugs', [])
       if b.get('status') not in ('completed', 'skipped', 'needs_info')]
for b in bad:
    print(f\"  {b['id']}: {b.get('status', 'unknown')} — {b.get('title', '')}\")
print(len(bad))
" "$bug_list" 2>/dev/null || echo "0"; } | tee /dev/stderr | tail -1)

                if [[ "$incomplete_count" -gt 0 ]]; then
                    echo ""
                    log_warn "DEPLOY BLOCKED: $incomplete_count bug(s) not fixed successfully."
                    log_warn "Fix failed bugs and re-run, or manually run /prizmkit-deploy."
                else
                    echo ""
                    log_info "All bugs fixed — starting deploy session..."
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

All bugs have been fixed successfully.

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

        if [[ "$next_bug" == "PIPELINE_BLOCKED" ]]; then
            log_warn "All remaining bugs are blocked (needs_info/failed)."
            log_warn "Run './run-bugfix.sh status' to see details."
            log_warn "Waiting 60s before re-checking... (Ctrl+C to stop)"
            sleep 60
            continue
        fi

        # Parse bug info
        local bug_id bug_title bug_severity retry_count resume_phase
        bug_id=$(echo "$next_bug" | jq -r '.bug_id')
        bug_title=$(echo "$next_bug" | jq -r '.title')
        bug_severity=$(echo "$next_bug" | jq -r '.severity')
        retry_count=$(echo "$next_bug" | jq -r '.retry_count // 0')
        resume_phase=$(echo "$next_bug" | jq -r '.resume_from_phase // "null"')

        echo ""
        echo -e "${BOLD}────────────────────────────────────────────────────${NC}"
        log_info "Bug: ${BOLD}$bug_id${NC} — $bug_title"
        log_info "Severity: $bug_severity | Retry: $retry_count / $MAX_RETRIES"
        if [[ "$resume_phase" != "null" ]]; then
            log_info "Resuming from Phase $resume_phase"
        fi
        echo -e "${BOLD}────────────────────────────────────────────────────${NC}"

        # Pre-commit any dirty tree from previous iteration
        if ! git -C "$_proj_root" diff --quiet HEAD 2>/dev/null || [ -n "$(git -C "$_proj_root" ls-files --others --exclude-standard 2>/dev/null)" ]; then
            log_info "Dirty working tree detected — committing before $bug_id..."
            git -C "$_proj_root" add -A 2>/dev/null || true
            git -C "$_proj_root" commit --no-verify -m "chore: capture artifacts before $bug_id session" 2>/dev/null || true
        fi

        # Mark bug as in-progress BEFORE creating dev branch
        # This ensures the in_progress status commit lands on the original branch,
        # not the dev branch — preventing rebase conflicts in branch_merge later.
        python3 "$SCRIPTS_DIR/update-bug-status.py" \
            --bug-list "$bug_list" \
            --state-dir "$STATE_DIR" \
            --bug-id "$bug_id" \
            --action start >/dev/null 2>&1 || true
        # Commit the in_progress status on the original branch
        if ! git -C "$_proj_root" diff --quiet "$bug_list" 2>/dev/null; then
            git -C "$_proj_root" add "$bug_list" 2>/dev/null || true
            git -C "$_proj_root" commit --no-verify -m "chore($bug_id): mark in_progress" 2>/dev/null || true
        fi

        # Create per-bug dev branch (from the now-updated original branch)
        local _bug_branch="${DEV_BRANCH:-bugfix/${bug_id}-$(date +%Y%m%d%H%M)}"
        if branch_create "$_proj_root" "$_bug_branch" "$_ORIGINAL_BRANCH"; then
            _DEV_BRANCH_NAME="$_bug_branch"
            log_info "Dev branch: $_bug_branch"
        else
            log_warn "Failed to create dev branch; running on current branch: $_ORIGINAL_BRANCH"
            _DEV_BRANCH_NAME=""
        fi

        # Generate session
        local session_id run_id
        run_id=$(jq -r '.run_id' "$STATE_DIR/pipeline.json")
        session_id="${bug_id}-$(date +%Y%m%d%H%M%S)"

        local session_dir="$STATE_DIR/bugs/$bug_id/sessions/$session_id"
        mkdir -p "$session_dir/logs"

        local bootstrap_prompt="$session_dir/bootstrap-prompt.md"

        local main_prompt_args=(
            --bug-list "$bug_list"
            --bug-id "$bug_id"
            --session-id "$session_id"
            --run-id "$run_id"
            --retry-count "$retry_count"
            --resume-phase "$resume_phase"
            --state-dir "$STATE_DIR"
            --output "$bootstrap_prompt"
        )

        # Support PIPELINE_MODE env var (set by launch-bugfix-daemon.sh --mode)
        if [[ -n "${PIPELINE_MODE:-}" ]]; then
            main_prompt_args+=(--mode "$PIPELINE_MODE")
        fi

        # Support ENABLE_CRITIC env var (set by launch-bugfix-daemon.sh --critic)
        if [[ "${ENABLE_CRITIC:-}" == "true" || "${ENABLE_CRITIC:-}" == "1" ]]; then
            main_prompt_args+=(--critic "true")
        elif [[ "${ENABLE_CRITIC:-}" == "false" || "${ENABLE_CRITIC:-}" == "0" ]]; then
            main_prompt_args+=(--critic "false")
        fi

        local gen_output
        gen_output=$(python3 "$SCRIPTS_DIR/generate-bugfix-prompt.py" "${main_prompt_args[@]}" 2>/dev/null) || {
            log_error "Failed to generate bootstrap prompt for $bug_id"
            branch_ensure_return "$_proj_root" "$_ORIGINAL_BRANCH"
            _DEV_BRANCH_NAME=""
            continue
        }
        local bug_model pipeline_mode agent_count critic_enabled
        bug_model=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('model',''))" 2>/dev/null || echo "")
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
        if [[ -n "$bug_model" ]]; then
            log_info "Bug model: $bug_model"
        fi

        # Spawn session
        log_info "Spawning AI CLI session: $session_id"
        _SPAWN_RESULT=""

        spawn_and_wait_session \
            "$bug_id" "$bug_list" "$session_id" \
            "$bootstrap_prompt" "$session_dir" "$MAX_RETRIES" "$bug_model" "$_ORIGINAL_BRANCH"

        local session_status="$_SPAWN_RESULT"

        # Merge per-bug dev branch back to original on success
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

        # Commit bug status update on the original branch (after guaranteed return)
        if ! git -C "$_proj_root" diff --quiet "$bug_list" 2>/dev/null; then
            git -C "$_proj_root" add "$bug_list"
            git -C "$_proj_root" commit --no-verify -m "chore($bug_id): update bug status" 2>/dev/null || true
        fi

        session_count=$((session_count + 1))
        total_subagent_calls=$((total_subagent_calls + _SUBAGENT_COUNT))

        # Stop-on-failure: abort pipeline if task failed and STOP_ON_FAILURE is enabled
        if [[ "$session_status" != "success" && "$STOP_ON_FAILURE" == "1" ]]; then
            echo ""
            log_error "════════════════════════════════════════════════════"
            log_error "  STOP_ON_FAILURE: Pipeline halted after $bug_id failed."
            log_error "  Total sessions completed: $session_count"
            log_error "  Set STOP_ON_FAILURE=0 to continue past failures."
            log_error "════════════════════════════════════════════════════"
            break
        fi

        # Stuck detection
        if python3 "$SCRIPTS_DIR/detect-stuck.py" \
            --state-dir "$STATE_DIR" \
            --pipeline-type bugfix \
            --bug-list "$bug_list" \
            --max-retries "$MAX_RETRIES" \
            2>/dev/null | jq -e '.stuck_count > 0' >/dev/null 2>&1; then
            log_warn "STUCK_DETECTED: Some bugs may be stuck — run detect-stuck.py for details"
        fi

        # Completion notes propagation (on success)
        if [ "$_SPAWN_RESULT" = "success" ]; then
            local _summary_path="$_proj_root/.prizmkit/bugfix/${bug_id}/completion-summary.json"
            if [ -f "$_summary_path" ]; then
                python3 "$SCRIPTS_DIR/patch-completion-notes.py" \
                    --bug-list "$bug_list" \
                    --bug-id "$bug_id" \
                    --summary "$_summary_path" 2>/dev/null || true
            fi
        fi

        log_info "Pausing 5s before next bug..."
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
    echo "  run [.prizmkit/plans/bug-fix-list.json]                 Run all bugs by severity/priority order"
    echo "  run <bug-id> [options]                   Run a single bug fix"
    echo "  status [.prizmkit/plans/bug-fix-list.json]               Show bug fix pipeline status"
    echo "  reset                                    Clear all bugfix state"
    echo "  help                                     Show this help message"
    echo ""
    echo "Single Bug Options (run <bug-id>):"
    echo "  --dry-run                   Generate bootstrap prompt only, don't spawn session"
    echo "  --clean                     Delete artifacts and reset before running"
    echo "  --no-reset                  Skip status reset (preserve retry count)"
    echo "  --timeout N                 Session timeout in seconds (default: 0 = no limit)"
    echo "  --mode <lite|standard|full> Override pipeline mode"
    echo "  --critic                    Enable adversarial critic review"
    echo "  --no-critic                 Disable adversarial critic review"
    echo ""
    echo "Environment Variables:"
    echo "  MAX_RETRIES           Max retries per bug (default: 3)"
    echo "  SESSION_TIMEOUT       Session timeout in seconds (default: 0 = no limit)"
    echo "  MODEL                 Default AI model (overridden by per-bug model in bug list)"
    echo "  PIPELINE_MODE         Default pipeline mode: lite|standard|full (overridden by --mode)"
    echo "  ENABLE_CRITIC         Enable/disable critic: true|false|1|0 (overridden by --critic/--no-critic)"
    echo "  AI_CLI                AI CLI command name (auto-detected: cbc or claude)"
    echo "  VERBOSE               Set to 1 for verbose AI CLI output"
    echo "  HEARTBEAT_INTERVAL    Heartbeat log interval in seconds (default: 30)"
    echo "  STALE_KILL_THRESHOLD  Auto-kill session after N seconds of no progress (default: 900)"
    echo "  STOP_ON_FAILURE       Stop pipeline when a task exhausts retries: 0|1 (default: 0)"
    echo "  LOG_CLEANUP_ENABLED   Run log cleanup before execution (default: 1)"
    echo "  LOG_RETENTION_DAYS    Delete logs older than N days (default: 14)"
    echo "  LOG_MAX_TOTAL_MB      Keep total logs under N MB (default: 1024)"
    echo ""
    echo "Examples:"
    echo "  ./run-bugfix.sh run                                    # Run all bugs"
    echo "  ./run-bugfix.sh run .prizmkit/plans/bug-fix-list.json                  # Custom bug list"
    echo "  ./run-bugfix.sh run B-001 --dry-run                    # Inspect generated prompt"
    echo "  ./run-bugfix.sh run B-001 --clean                      # Clean artifacts + reset + run"
    echo "  ./run-bugfix.sh run B-001 --no-reset                   # Retry without resetting status"
    echo "  ./run-bugfix.sh run B-001 --timeout 3600               # 1h timeout"
    echo "  ./run-bugfix.sh status                                 # Show status"
    echo "  MAX_RETRIES=5 ./run-bugfix.sh run                      # Custom retries"
}

case "${1:-run}" in
    run|resume)
        shift || true
        if [[ "${1:-}" =~ ^[Bb]-[0-9]+ ]]; then
            run_one "$@"
        else
            main "${1:-.prizmkit/plans/bug-fix-list.json}"
        fi
        ;;
    status)
        check_dependencies
        if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
            log_error "No bugfix pipeline state found. Run './run-bugfix.sh run' first."
            exit 1
        fi
        python3 "$SCRIPTS_DIR/update-bug-status.py" \
            --bug-list "${2:-.prizmkit/plans/bug-fix-list.json}" \
            --state-dir "$STATE_DIR" \
            --action status
        ;;
    reset)
        log_warn "Resetting bugfix pipeline state..."
        rm -rf "$STATE_DIR"
        log_success "Bugfix state cleared. Run './run-bugfix.sh run' to start fresh."
        ;;
    unskip)
        check_dependencies
        if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
            log_error "No bugfix pipeline state found. Run './run-bugfix.sh run' first."
            exit 1
        fi
        _unskip_bug_list=".prizmkit/plans/bug-fix-list.json"
        _unskip_bug_id=""
        shift || true
        # Parse arguments: optional bug-id and bug-list path
        while [[ $# -gt 0 ]]; do
            if [[ "$1" =~ ^[Bb]-[0-9]+ ]]; then
                _unskip_bug_id="$1"
            else
                _unskip_bug_list="$1"
            fi
            shift
        done
        _unskip_args=(
            --bug-list "$_unskip_bug_list"
            --state-dir "$STATE_DIR"
            --action unskip
        )
        if [[ -n "$_unskip_bug_id" ]]; then
            _unskip_args+=(--bug-id "$_unskip_bug_id")
        fi
        python3 "$SCRIPTS_DIR/update-bug-status.py" "${_unskip_args[@]}"

        # Commit the status change
        if ! git diff --quiet "$_unskip_bug_list" 2>/dev/null; then
            git add "$_unskip_bug_list"
            git commit -m "chore: unskip skipped bugs" 2>/dev/null || true
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
