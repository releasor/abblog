#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/launch-refactor-daemon.sh - Daemon wrapper for run-refactor.sh
#
# Manages run-refactor.sh as a background daemon process with PID tracking,
# log consolidation, and lifecycle commands.
#
# Usage:
#   ./launch-refactor-daemon.sh start [.prizmkit/plans/refactor-list.json] [--mode <mode>] [--critic] [--env "KEY=VAL ..."]
#   ./launch-refactor-daemon.sh stop
#   ./launch-refactor-daemon.sh status
#   ./launch-refactor-daemon.sh logs [--lines N] [--follow]
#   ./launch-refactor-daemon.sh restart [.prizmkit/plans/refactor-list.json] [--mode <mode>] [--critic] [--env "KEY=VAL ..."]
#
# NOTE:
#   In AI skill sessions, always use this daemon wrapper.
#   Do NOT call `run-refactor.sh run ...` directly, because foreground sessions may be killed by CLI timeout.
#
# Files managed:
#   .prizmkit/state/refactor/.pipeline.pid          - PID of the background run-refactor.sh process
#   .prizmkit/state/refactor/pipeline-daemon.log    - Consolidated stdout+stderr
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="${PROJECT_ROOT}/.prizmkit/state/refactor"
PID_FILE="$STATE_DIR/.pipeline.pid"
LOG_FILE="$STATE_DIR/pipeline-daemon.log"
RUN_SCRIPT="$SCRIPT_DIR/run-refactor.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}    $*" >&2; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}    $*" >&2; }
log_error()   { echo -e "${RED}[ERROR]${NC}   $*" >&2; }
log_success() { echo -e "${GREEN}[OK]${NC}      $*" >&2; }

# ============================================================
# Helpers
# ============================================================

is_running() {
    if [[ ! -f "$PID_FILE" ]]; then
        return 1
    fi
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null) || return 1
    if [[ -z "$pid" ]]; then
        return 1
    fi
    if kill -0 "$pid" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

get_pid() {
    if [[ -f "$PID_FILE" ]]; then
        cat "$PID_FILE" 2>/dev/null || echo ""
    else
        echo ""
    fi
}

clean_stale_pid() {
    if [[ -f "$PID_FILE" ]]; then
        local pid
        pid=$(get_pid)
        if [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null; then
            rm -f "$PID_FILE"
            log_warn "Cleaned stale PID file (process $pid no longer running)"
        fi
    fi
}

# ============================================================
# start
# ============================================================

cmd_start() {
    local refactor_list=""
    local env_overrides=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --env) shift; env_overrides="${1:-}"; shift ;;
            --mode)
                shift
                if [[ $# -eq 0 ]]; then
                    log_error "--mode requires a value (lite|standard|full)"
                    exit 1
                fi
                case "$1" in
                    lite|standard|full)
                        PIPELINE_MODE="$1"
                        ;;
                    *)
                        log_error "Invalid mode: $1 (must be lite, standard, or full)"
                        exit 1
                        ;;
                esac
                shift
                ;;
            --critic)
                ENABLE_CRITIC=true
                shift
                ;;
            --no-critic)
                ENABLE_CRITIC=false
                shift
                ;;
            *) refactor_list="$1"; shift ;;
        esac
    done

    if [[ -z "$refactor_list" ]]; then
        refactor_list=".prizmkit/plans/refactor-list.json"
    fi
    if [[ ! "$refactor_list" = /* ]]; then
        refactor_list="$(cd "$(dirname "$refactor_list")" 2>/dev/null && pwd)/$(basename "$refactor_list")"
    fi

    if [[ ! -f "$refactor_list" ]]; then
        log_error "Refactor list not found: $refactor_list"
        log_error "Run the refactor-planner skill first to generate .prizmkit/plans/refactor-list.json"
        exit 2
    fi

    if [[ ! -x "$RUN_SCRIPT" ]]; then
        log_error "run-refactor.sh not found or not executable: $RUN_SCRIPT"
        exit 2
    fi

    clean_stale_pid

    if is_running; then
        local pid
        pid=$(get_pid)
        log_error "Refactor pipeline is already running (PID: $pid)"
        log_error "Use './launch-refactor-daemon.sh stop' first, or './launch-refactor-daemon.sh restart'"
        exit 1
    fi

    mkdir -p "$STATE_DIR"

    local env_cmd=""
    if [[ -n "$env_overrides" ]]; then
        env_cmd="env $env_overrides"
    fi

    local start_time
    start_time=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    # Rotate log if over 50 MB
    if [[ -f "$LOG_FILE" ]]; then
        local log_bytes
        log_bytes=$(wc -c < "$LOG_FILE" 2>/dev/null | tr -d ' ')
        if [[ "$log_bytes" -gt 52428800 ]]; then
            mv "$LOG_FILE" "${LOG_FILE}.$(date -u '+%Y%m%dT%H%M%S').bak"
            log_info "Log rotated (was $((log_bytes / 1048576))MB): ${LOG_FILE}.bak"
        fi
    fi

    log_info "Launching refactor pipeline..."
    log_info "Refactor list: $refactor_list"
    log_info "Log file: $LOG_FILE"

    # Unset CLAUDECODE to allow spawning nested Claude Code sessions.
    # When this daemon is launched from within a Claude Code session, the env var
    # is inherited and blocks child claude processes with "nested sessions" error.
    unset CLAUDECODE 2>/dev/null || true

    {
        echo ""
        echo "================================================================"
        echo "  Refactor Pipeline Daemon Started: $start_time"
        echo "  Refactor list: $refactor_list"
        if [[ -n "$env_overrides" ]]; then
            echo "  Environment: $env_overrides"
        fi
        echo "================================================================"
        echo ""
    } >> "$LOG_FILE"

    [[ -n "${PIPELINE_MODE:-}" ]] && export PIPELINE_MODE
    [[ -n "${ENABLE_CRITIC:-}" ]] && export ENABLE_CRITIC

    if [[ -n "$env_cmd" ]]; then
        nohup $env_cmd "$RUN_SCRIPT" run "$refactor_list" >> "$LOG_FILE" 2>&1 &
    else
        nohup "$RUN_SCRIPT" run "$refactor_list" >> "$LOG_FILE" 2>&1 &
    fi
    local pipeline_pid=$!
    disown "$pipeline_pid" 2>/dev/null || true

    echo "$pipeline_pid" > "${PID_FILE}.tmp"
    mv "${PID_FILE}.tmp" "$PID_FILE"

    # Write start metadata (atomic)
    python3 -c "
import json, os
data = {
    'pid': $pipeline_pid,
    'pipeline_type': 'refactor',
    'started_at': '$start_time',
    'refactor_list': '$refactor_list',
    'env_overrides': '$env_overrides',
    'log_file': '$LOG_FILE'
}
target = os.path.join('$STATE_DIR', '.pipeline-meta.json')
tmp = target + '.tmp'
with open(tmp, 'w') as f:
    json.dump(data, f, indent=2)
os.replace(tmp, target)
" 2>/dev/null || true

    sleep 2
    if is_running; then
        log_success "Refactor pipeline started successfully (PID: $pipeline_pid)"
        log_info "Monitor logs: ./launch-refactor-daemon.sh logs --follow"
        log_info "Check status: ./launch-refactor-daemon.sh status"
        echo "{\"success\": true, \"pid\": $pipeline_pid, \"log_file\": \"$LOG_FILE\", \"started_at\": \"$start_time\"}"
    else
        log_error "Refactor pipeline process died immediately after launch"
        log_error "Check log for errors: tail -20 $LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
    fi
}

# ============================================================
# stop
# ============================================================

cmd_stop() {
    if [[ ! -f "$PID_FILE" ]]; then
        log_info "Refactor pipeline is not running (no PID file)"
        echo '{"success": true, "message": "not running"}'
        return 0
    fi

    local pid
    pid=$(get_pid)

    if [[ -z "$pid" ]]; then
        log_info "Refactor pipeline is not running (empty PID file)"
        rm -f "$PID_FILE"
        echo '{"success": true, "message": "not running"}'
        return 0
    fi

    if ! kill -0 "$pid" 2>/dev/null; then
        log_info "Refactor pipeline is not running (process $pid already exited)"
        rm -f "$PID_FILE"
        echo '{"success": true, "message": "already exited"}'
        return 0
    fi

    log_info "Stopping refactor pipeline (PID: $pid)..."

    # Kill the entire process group to include child processes (claude-internal, etc.)
    # First try SIGTERM to the process group (negative PID)
    kill -TERM -- -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true

    local waited=0
    while [[ $waited -lt 30 ]]; do
        if ! kill -0 "$pid" 2>/dev/null; then
            break
        fi
        sleep 1
        waited=$((waited + 1))
    done

    # Force kill if still alive (process group first, then individual)
    if kill -0 "$pid" 2>/dev/null; then
        log_warn "Process did not exit after 30s, sending SIGKILL..."
        kill -9 -- -"$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
        sleep 1
    fi

    rm -f "$PID_FILE"

    if ! kill -0 "$pid" 2>/dev/null; then
        log_success "Refactor pipeline stopped"
        echo "{\"success\": true, \"pid\": $pid, \"message\": \"stopped\"}"
    else
        log_error "Failed to stop refactor pipeline (PID: $pid)"
        echo "{\"success\": false, \"pid\": $pid, \"message\": \"failed to stop\"}"
        exit 1
    fi
}

# ============================================================
# status
# ============================================================

cmd_status() {
    clean_stale_pid

    if ! is_running; then
        log_info "Refactor pipeline is not running"

        if [[ -f "$STATE_DIR/.pipeline-meta.json" ]]; then
            local last_refactor_list
            last_refactor_list=$(python3 -c "
import json
with open('$STATE_DIR/.pipeline-meta.json') as f:
    print(json.load(f).get('refactor_list', ''))
" 2>/dev/null || echo "")

            if [[ -n "$last_refactor_list" && -f "$last_refactor_list" ]]; then
                echo "" >&2
                log_info "Last run refactor progress:"
                python3 "$SCRIPT_DIR/scripts/update-refactor-status.py" \
                    --refactor-list "$last_refactor_list" \
                    --state-dir "$STATE_DIR" \
                    --action status >&2 2>/dev/null || true
                echo "" >&2
            fi
        fi

        echo '{"running": false}'
        return 1
    fi

    local pid
    pid=$(get_pid)

    local started_at=""
    local refactor_list_path=""
    if [[ -f "$STATE_DIR/.pipeline-meta.json" ]]; then
        started_at=$(python3 -c "
import json
with open('$STATE_DIR/.pipeline-meta.json') as f:
    print(json.load(f).get('started_at', ''))
" 2>/dev/null || echo "")
        refactor_list_path=$(python3 -c "
import json
with open('$STATE_DIR/.pipeline-meta.json') as f:
    print(json.load(f).get('refactor_list', ''))
" 2>/dev/null || echo "")
    fi

    log_success "Refactor pipeline is running (PID: $pid)"
    if [[ -n "$started_at" ]]; then
        log_info "Started at: $started_at"
    fi
    log_info "Log file: $LOG_FILE"

    if [[ -n "$refactor_list_path" && -f "$refactor_list_path" ]]; then
        echo "" >&2
        python3 "$SCRIPT_DIR/scripts/update-refactor-status.py" \
            --refactor-list "$refactor_list_path" \
            --state-dir "$STATE_DIR" \
            --action status >&2 2>/dev/null || true
        echo "" >&2
    fi

    if [[ -f "$LOG_FILE" ]]; then
        log_info "--- Last 5 log lines ---"
        tail -5 "$LOG_FILE" >&2 || true
        echo "" >&2
    fi

    local progress_json=""
    if [[ -n "$refactor_list_path" && -f "$refactor_list_path" ]]; then
        progress_json=$(python3 -c "
import json, os
bl = json.load(open('$refactor_list_path'))
items = bl.get('refactors', [])
total = len(items)
counts = {'completed': 0, 'in_progress': 0, 'failed': 0, 'pending': 0, 'skipped': 0, 'auto_skipped': 0}
for item in items:
    rid = item.get('id', '')
    sp = os.path.join('$STATE_DIR', 'refactors', rid, 'status.json')
    if os.path.isfile(sp):
        fs = json.load(open(sp))
        st = fs.get('status', 'pending')
    else:
        st = 'pending'
    if st in counts:
        counts[st] += 1
    else:
        counts['pending'] += 1
pct = round(counts['completed'] / total * 100, 1) if total > 0 else 0
print(json.dumps({'total': total, 'completed': counts['completed'], 'in_progress': counts['in_progress'], 'failed': counts['failed'], 'pending': counts['pending'], 'skipped': counts['skipped'], 'auto_skipped': counts['auto_skipped'], 'percent': pct}))
" 2>/dev/null || echo "")
    fi

    if [[ -n "$progress_json" ]]; then
        echo "{\"running\": true, \"pid\": $pid, \"pipeline_type\": \"refactor\", \"log_file\": \"$LOG_FILE\", \"started_at\": \"$started_at\", \"refactor_list\": \"$refactor_list_path\", \"progress\": $progress_json}"
    else
        echo "{\"running\": true, \"pid\": $pid, \"pipeline_type\": \"refactor\", \"log_file\": \"$LOG_FILE\", \"started_at\": \"$started_at\", \"refactor_list\": \"$refactor_list_path\"}"
    fi
}

# ============================================================
# logs
# ============================================================

cmd_logs() {
    local lines=50
    local follow=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --lines|-n) shift; lines="${1:-50}"; shift ;;
            --follow|-f) follow=true; shift ;;
            *) log_error "Unknown option: $1"; exit 1 ;;
        esac
    done

    if [[ ! -f "$LOG_FILE" ]]; then
        log_info "No log file found at $LOG_FILE"
        exit 0
    fi

    if [[ "$follow" == true ]]; then
        log_info "Following $LOG_FILE (Ctrl+C to stop)..."
        echo "" >&2
        tail -f "$LOG_FILE"
    else
        tail -"$lines" "$LOG_FILE"
    fi
}

# ============================================================
# restart
# ============================================================

cmd_restart() {
    cmd_stop 2>/dev/null || true
    sleep 1
    cmd_start "$@"
}

# ============================================================
# Entry point
# ============================================================

show_help() {
    cat <<'HELP'
Usage: launch-refactor-daemon.sh <command> [options]

Commands:
  start [.prizmkit/plans/refactor-list.json] [--mode <mode>] [--critic] [--env "K=V ..."]   Start refactor pipeline in background
  stop                                             Gracefully stop pipeline
  status                                           Check if pipeline is running
  logs [--lines N] [--follow]                      View pipeline logs
  restart [.prizmkit/plans/refactor-list.json] [--mode <mode>] [--critic] [--env "K=V ..."]  Stop + start pipeline
  help                                             Show this help

Options:
  --mode <lite|standard|full>              Override pipeline mode for all refactors
  --critic                                 Enable adversarial critic review for all refactors
  --no-critic                              Disable adversarial critic review for all refactors
  --env "KEY=VAL ..."                        Set environment variables

Examples:
  ./launch-refactor-daemon.sh start                              # Start with default .prizmkit/plans/refactor-list.json
  ./launch-refactor-daemon.sh start my-refactors.json            # Start with custom refactor list
  ./launch-refactor-daemon.sh start --mode full                  # Full mode for complex refactors
  ./launch-refactor-daemon.sh start --critic                     # Enable adversarial critic review
  ./launch-refactor-daemon.sh start --env "MAX_RETRIES=5"
  ./launch-refactor-daemon.sh start --env "STRICT_BEHAVIOR_CHECK=0"
  ./launch-refactor-daemon.sh start .prizmkit/plans/refactor-list.json --mode full --critic --env "VERBOSE=1"
  ./launch-refactor-daemon.sh status                             # Check if running (JSON on stdout)
  ./launch-refactor-daemon.sh logs --follow                      # Live log tailing
  ./launch-refactor-daemon.sh stop                               # Graceful shutdown
  ./launch-refactor-daemon.sh restart                            # Stop + start

Environment Variables (pass via --env):
  MAX_RETRIES              Max retries per refactor (default: 3)
  SESSION_TIMEOUT          Session timeout in seconds (default: 0 = no limit)
  VERBOSE                  Set to 1 for verbose AI CLI output
  STRICT_BEHAVIOR_CHECK    Force full test suite after each refactor (default: 1)
  HEARTBEAT_INTERVAL       Heartbeat log interval in seconds (default: 30)
  DEV_BRANCH               Custom dev branch name (default: auto-generated)
  AUTO_PUSH                Auto-push to remote after successful refactor (default: 0, set 1 to enable)
HELP
}

case "${1:-help}" in
    start) shift; cmd_start "$@" ;;
    stop) cmd_stop ;;
    status) cmd_status ;;
    logs|log) shift; cmd_logs "$@" ;;
    restart) shift; cmd_restart "$@" ;;
    help|--help|-h) show_help ;;
    *) log_error "Unknown command: $1"; echo "" >&2; show_help; exit 1 ;;
esac
