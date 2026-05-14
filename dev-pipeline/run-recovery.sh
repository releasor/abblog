#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/run-recovery.sh - Recover Interrupted Workflow Sessions
#
# Auto-detects which workflow (feature-workflow, bug-fix-workflow,
# refactor-workflow) was interrupted and what phase it reached,
# then generates a comprehensive bootstrap prompt and spawns an
# AI CLI session to complete all remaining phases.
#
# Unlike run-feature.sh / run-bugfix.sh / run-refactor.sh, this
# is a single-shot operation (no pipeline loop) for one detected
# interrupted workflow.
#
# Usage:
#   ./run-recovery.sh                       Auto-detect and recover
#   ./run-recovery.sh run                   Same as above
#   ./run-recovery.sh run --dry-run         Generate prompt only
#   ./run-recovery.sh run --yes             Skip confirmation
#   ./run-recovery.sh run --model <model>   Override AI model
#   ./run-recovery.sh detect                Detection report only
#   ./run-recovery.sh help                  Show help
#
# Environment Variables:
#   SESSION_TIMEOUT       Session timeout in seconds (default: 0 = no limit)
#   AI_CLI                AI CLI command name (auto-detected: cbc or claude)
#   PRIZMKIT_PLATFORM     Force platform: 'codebuddy' or 'claude' (auto-detected)
#   MODEL                 AI model to use (e.g. claude-opus-4.6)
#   VERBOSE               Set to 1 to enable --verbose on AI CLI
#   HEARTBEAT_INTERVAL    Heartbeat log interval in seconds (default: 30)
#   STALE_KILL_THRESHOLD  Auto-kill after N seconds of no progress (default: 900)
#   AUTO_PUSH             Auto-push after successful recovery (default: 0)
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RECOVERY_STATE_DIR="${PROJECT_ROOT}/.prizmkit/state/recovery"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"
RECOVERY_DETECT_SCRIPT="${PROJECT_ROOT}/core/skills/orchestration-skill/workflows/recovery-workflow/scripts/detect-recovery-state.py"

# Configuration
SESSION_TIMEOUT=${SESSION_TIMEOUT:-0}
HEARTBEAT_INTERVAL=${HEARTBEAT_INTERVAL:-30}
STALE_KILL_THRESHOLD=${STALE_KILL_THRESHOLD:-900}
VERBOSE=${VERBOSE:-0}
MODEL=${MODEL:-""}
AUTO_PUSH=${AUTO_PUSH:-0}

# Source shared common helpers (CLI/platform detection + logs + deps)
source "$SCRIPT_DIR/lib/common.sh"
prizm_detect_cli_and_platform

# Source shared heartbeat library
source "$SCRIPT_DIR/lib/heartbeat.sh"

# Source shared branch library
source "$SCRIPT_DIR/lib/branch.sh"

# Detect stream-json support
detect_stream_json_support "$CLI_CMD"

# Session tracking (for cleanup)
_SESSION_DIR=""
_SESSION_PID=""

# ============================================================
# Help
# ============================================================

show_help() {
    cat <<'HELP'
Usage: ./run-recovery.sh [command] [options]

Commands:
  run       Auto-detect interrupted workflow and recover (default)
  detect    Show detection report only (no execution)
  help      Show this help

Options (for 'run' command):
  --dry-run   Generate bootstrap prompt without spawning AI session
  --yes       Skip user confirmation
  --model M   Override AI model (e.g. claude-opus-4.6)

Environment Variables:
  SESSION_TIMEOUT       Session timeout in seconds (default: 0 = no limit)
  MODEL                 AI model to use
  VERBOSE               Set to 1 for verbose AI CLI output
  HEARTBEAT_INTERVAL    Heartbeat log interval in seconds (default: 30)
  STALE_KILL_THRESHOLD  Auto-kill after N seconds no progress (default: 900)
  AUTO_PUSH             Auto-push after success (default: 0)

Examples:
  ./run-recovery.sh                     # Auto-detect and recover
  ./run-recovery.sh detect              # Show what would be recovered
  ./run-recovery.sh run --dry-run       # Generate prompt, don't execute
  ./run-recovery.sh run --yes           # Skip confirmation prompt
  ./run-recovery.sh run --model claude-opus-4.6
HELP
}

# ============================================================
# Cleanup trap
# ============================================================

cleanup() {
    local exit_code=$?
    # Kill any background processes
    if [[ -n "${_SESSION_PID:-}" ]]; then
        kill "$_SESSION_PID" 2>/dev/null || true
        wait "$_SESSION_PID" 2>/dev/null || true
    fi
    # Stop heartbeat if running
    stop_heartbeat "${_HEARTBEAT_PID:-}" 2>/dev/null || true
    # Log recovery session location
    if [[ -n "${_SESSION_DIR:-}" && -d "${_SESSION_DIR:-}" ]]; then
        log_info "Session directory: $_SESSION_DIR"
        if [[ -f "$_SESSION_DIR/logs/session.log" ]]; then
            log_info "Session log: $_SESSION_DIR/logs/session.log"
        fi
    fi
    if [[ $exit_code -ne 0 && $exit_code -ne 130 ]]; then
        log_info "Re-run ./run-recovery.sh to try again."
    fi
}
trap cleanup EXIT

# ============================================================
# Detection
# ============================================================

run_detection() {
    local detection_output
    local detect_stderr_file
    detect_stderr_file=$(mktemp)
    detection_output=$(python3 "$RECOVERY_DETECT_SCRIPT" --project-root "$PROJECT_ROOT" 2>"$detect_stderr_file") || {
        log_error "Detection script failed"
        if [[ -s "$detect_stderr_file" ]]; then
            log_error "Details: $(cat "$detect_stderr_file")"
        fi
        rm -f "$detect_stderr_file"
        return 1
    }
    # Show migration warnings or other informational messages from detection
    if [[ -s "$detect_stderr_file" ]]; then
        log_warn "$(cat "$detect_stderr_file")"
    fi
    rm -f "$detect_stderr_file"
    echo "$detection_output"
}

display_report() {
    local detection_json="$1"

    local detected workflow_type branch phase phase_name reason remaining
    detected=$(echo "$detection_json" | jq -r '.detected // false')

    if [[ "$detected" != "true" ]]; then
        echo ""
        log_info "No interrupted workflow detected in this workspace."
        echo ""
        echo "  To start a new workflow:"
        echo "    • /feature-workflow   — build features from idea to code"
        echo "    • /bug-fix-workflow   — fix a specific bug interactively"
        echo "    • /refactor-workflow  — behavior-preserving code restructuring"
        echo ""
        return 1
    fi

    workflow_type=$(echo "$detection_json" | jq -r '.workflow_type')
    branch=$(echo "$detection_json" | jq -r '.git.current_branch // "unknown"')
    phase=$(echo "$detection_json" | jq -r '.phase')
    phase_name=$(echo "$detection_json" | jq -r '.phase_name')
    reason=$(echo "$detection_json" | jq -r '.recovery.reason // ""')
    remaining=$(echo "$detection_json" | jq -r '.recovery.remaining_work // ""')

    local uncommitted staged commits_ahead
    uncommitted=$(echo "$detection_json" | jq -r '.git.uncommitted_files // 0')
    staged=$(echo "$detection_json" | jq -r '.git.staged_files // 0')
    commits_ahead=$(echo "$detection_json" | jq -r '.git.commits_ahead_of_main // 0')

    local has_changes files_modified files_added test_files
    has_changes=$(echo "$detection_json" | jq -r '.code.has_changes // false')
    files_modified=$(echo "$detection_json" | jq -r '.code.files_modified // 0')
    files_added=$(echo "$detection_json" | jq -r '.code.files_added // 0')
    test_files=$(echo "$detection_json" | jq -r '.code.test_files_touched // 0')

    echo ""
    echo "═══════════════════════════════════════════════════"
    echo "  Recovery Report"
    echo "═══════════════════════════════════════════════════"
    echo ""
    echo "  Workflow:     $workflow_type"
    echo "  Branch:       $branch"
    echo "  Phase:        $phase — $phase_name"
    echo ""

    if [[ "$has_changes" == "true" ]]; then
        echo "  Code Changes:"
        echo "    Modified:   $files_modified files"
        echo "    Added:      $files_added files"
        echo "    Tests:      $test_files test files touched"
        echo ""
    fi

    echo "  Git State:"
    echo "    Uncommitted: $uncommitted files"
    echo "    Staged:      $staged files"
    echo "    Ahead:       $commits_ahead commits ahead of main"
    echo ""
    echo "  Reason:   $reason"
    echo "  Remaining: $remaining"
    echo ""

    # Show other interrupted workflows (if any)
    local others
    others=$(echo "$detection_json" | jq -r '.other_interrupted_workflows // [] | .[]' 2>/dev/null)
    if [[ -n "$others" ]]; then
        echo "  Note: Other interrupted workflows also detected:"
        echo "$others" | while IFS= read -r w; do
            echo "    • $w"
        done
        echo "  (Run recovery again after this one completes)"
        echo ""
    fi

    echo "═══════════════════════════════════════════════════"
    echo ""

    return 0
}

# ============================================================
# Session spawn (simplified from run-bugfix.sh)
# ============================================================

spawn_recovery_session() {
    local bootstrap_prompt="$1"
    local session_dir="$2"
    local session_model="${3:-}"

    local session_log="$session_dir/logs/session.log"
    local progress_json="$session_dir/logs/progress.json"

    local verbose_flag=""
    if [[ "$VERBOSE" == "1" ]]; then
        verbose_flag="--verbose"
    fi

    local stream_json_flag=""
    if [[ "$USE_STREAM_JSON" == "true" ]]; then
        stream_json_flag="--output-format stream-json"
        verbose_flag="--verbose"
    fi

    local model_flag=""
    local effective_model="${session_model:-$MODEL}"
    if [[ -n "$effective_model" ]]; then
        model_flag="--model $effective_model"
    fi

    # Unset CLAUDECODE to prevent "nested session" error
    unset CLAUDECODE 2>/dev/null || true

    log_info "Spawning AI CLI session..."
    log_info "CLI: $CLI_CMD"
    [[ -n "$effective_model" ]] && log_info "Model: $effective_model"
    log_info "Prompt: $bootstrap_prompt"

    case "$CLI_CMD" in
        *claude*)
            "$CLI_CMD" \
                -p "$(cat "$bootstrap_prompt")" \
                --dangerously-skip-permissions \
                $verbose_flag \
                $stream_json_flag \
                $model_flag \
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
    _SESSION_PID=$!

    # Start progress parser
    start_progress_parser "$session_log" "$progress_json" "$SCRIPTS_DIR"
    local parser_pid="${_PARSER_PID:-}"

    # Timeout watchdog
    local watcher_pid=""
    if [[ $SESSION_TIMEOUT -gt 0 ]]; then
        ( sleep "$SESSION_TIMEOUT" && kill -TERM "$_SESSION_PID" 2>/dev/null ) &
        watcher_pid=$!
    fi

    # Heartbeat monitor
    start_heartbeat "$_SESSION_PID" "$session_log" "$progress_json" "$HEARTBEAT_INTERVAL" "$STALE_KILL_THRESHOLD"
    _HEARTBEAT_PID="${_HEARTBEAT_PID:-}"

    # Wait for session to finish
    local exit_code=0
    if wait "$_SESSION_PID" 2>/dev/null; then
        exit_code=0
    else
        exit_code=$?
    fi
    _SESSION_PID=""

    # Cleanup background processes
    [[ -n "$watcher_pid" ]] && kill "$watcher_pid" 2>/dev/null || true
    stop_heartbeat "${_HEARTBEAT_PID:-}"
    _HEARTBEAT_PID=""
    stop_progress_parser "$parser_pid"
    [[ -n "$watcher_pid" ]] && wait "$watcher_pid" 2>/dev/null || true

    # Map SIGTERM to timeout
    if [[ $exit_code -eq 143 ]]; then
        exit_code=124
    fi

    # Check for stale-kill
    local stale_kill_marker="$session_dir/logs/stale-kill.json"
    if [[ -f "$stale_kill_marker" ]]; then
        log_warn "Session was stale-killed (no progress for too long)"
    fi

    # Log session summary
    if [[ -f "$session_log" ]]; then
        local final_size final_lines
        final_size=$(wc -c < "$session_log" 2>/dev/null | tr -d ' ')
        final_lines=$(wc -l < "$session_log" 2>/dev/null | tr -d ' ')
        log_info "Session log: $final_lines lines, $((final_size / 1024))KB"
    fi
    log_info "Session exit code: $exit_code"

    return $exit_code
}

# ============================================================
# Post-session outcome detection
# ============================================================

detect_session_outcome() {
    local exit_code="$1"
    local session_dir="$2"
    local workflow_type="$3"
    local main_branch="${4:-main}"

    local stale_kill_marker="$session_dir/logs/stale-kill.json"
    local was_stale_killed=false
    [[ -f "$stale_kill_marker" ]] && was_stale_killed=true

    if [[ $exit_code -eq 124 ]]; then
        log_warn "Session timed out"
        echo "timed_out"
        return
    fi

    if [[ "$was_stale_killed" == true ]]; then
        log_warn "Session stale-killed"
    fi

    # Check for commits
    local has_commits=""
    has_commits=$(git -C "$PROJECT_ROOT" log "${main_branch}..HEAD" --oneline 2>/dev/null | head -1 || true)

    if [[ -n "$has_commits" ]]; then
        echo "success"
        return
    fi

    # Check for uncommitted changes
    local uncommitted=""
    uncommitted=$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null | head -1 || true)
    if [[ -n "$uncommitted" ]]; then
        # Try auto-commit to preserve work (like run-bugfix.sh does)
        log_info "Uncommitted changes found — attempting to preserve work..."
        git -C "$PROJECT_ROOT" add -A 2>/dev/null || true
        if git -C "$PROJECT_ROOT" commit --no-verify -m "wip(recovery): auto-save interrupted session work" 2>/dev/null; then
            log_info "Auto-saved recovery work as WIP commit"
            echo "success_wip"
            return
        fi
        echo "partial"
        return
    fi

    if [[ $exit_code -ne 0 ]]; then
        echo "failed"
    else
        echo "no_changes"
    fi
}

# ============================================================
# Commands
# ============================================================

cmd_detect() {
    prizm_check_common_dependencies
    prizm_ensure_git_repo "$PROJECT_ROOT"

    local detection_json
    detection_json=$(run_detection) || {
        log_error "Detection failed"
        exit 1
    }

    display_report "$detection_json"
}

cmd_run() {
    local dry_run=false
    local skip_confirm=false
    local model_override=""

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run)
                dry_run=true
                shift
                ;;
            --yes|-y)
                skip_confirm=true
                shift
                ;;
            --model)
                model_override="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Step 1: Check dependencies
    prizm_check_common_dependencies
    prizm_ensure_git_repo "$PROJECT_ROOT"

    # Step 2: Run detection
    log_info "Detecting interrupted workflow..."
    local detection_json
    detection_json=$(run_detection) || {
        log_error "Detection failed"
        exit 1
    }

    # Step 3: Display report
    if ! display_report "$detection_json"; then
        exit 0  # No workflow detected, clean exit
    fi

    local workflow_type phase phase_name main_branch
    workflow_type=$(echo "$detection_json" | jq -r '.workflow_type')
    phase=$(echo "$detection_json" | jq -r '.phase')
    phase_name=$(echo "$detection_json" | jq -r '.phase_name')

    # Detect main branch (used for post-session commit check)
    main_branch="main"
    if ! git -C "$PROJECT_ROOT" rev-parse --verify main >/dev/null 2>&1; then
        if git -C "$PROJECT_ROOT" rev-parse --verify master >/dev/null 2>&1; then
            main_branch="master"
        fi
    fi

    # Step 4: User confirmation
    if [[ "$skip_confirm" != true ]]; then
        echo -n "Ready to resume from Phase $phase ($phase_name). Continue? [y/N] "
        read -r answer
        if [[ ! "$answer" =~ ^[Yy]$ ]]; then
            log_info "Recovery cancelled by user."
            exit 0
        fi
    else
        log_info "Confirmation skipped (--yes flag)"
    fi

    # Step 5: Create session directory
    local timestamp session_id session_dir
    timestamp=$(date +%Y%m%d-%H%M%S)
    session_id="recovery-${workflow_type}-${timestamp}"
    session_dir="$RECOVERY_STATE_DIR/$session_id"
    _SESSION_DIR="$session_dir"
    mkdir -p "$session_dir/logs"

    # Save detection JSON for reference
    local detection_file="$session_dir/detection.json"
    echo "$detection_json" > "$detection_file"

    # Step 6: Generate bootstrap prompt
    log_info "Generating recovery bootstrap prompt..."
    local bootstrap_prompt="$session_dir/bootstrap-prompt.md"
    local gen_stderr_file="$session_dir/logs/prompt-gen-stderr.log"
    local gen_output
    gen_output=$(python3 "$SCRIPTS_DIR/generate-recovery-prompt.py" \
        --detection-json "$detection_file" \
        --output "$bootstrap_prompt" \
        --project-root "$PROJECT_ROOT" \
        --session-id "$session_id" \
        2>"$gen_stderr_file") || {
        log_error "Failed to generate recovery prompt"
        if [[ -s "$gen_stderr_file" ]]; then
            log_error "Details: $(cat "$gen_stderr_file")"
        fi
        exit 1
    }

    local gen_success
    gen_success=$(echo "$gen_output" | jq -r '.success // false')
    if [[ "$gen_success" != "true" ]]; then
        local gen_error
        gen_error=$(echo "$gen_output" | jq -r '.error // "unknown error"')
        log_error "Prompt generation failed: $gen_error"
        exit 1
    fi

    local prompt_lines
    prompt_lines=$(wc -l < "$bootstrap_prompt" | tr -d ' ')
    log_success "Bootstrap prompt generated: $prompt_lines lines"
    log_info "Prompt: $bootstrap_prompt"

    # Step 7: Dry run exits here
    if [[ "$dry_run" == true ]]; then
        echo ""
        log_success "Dry run complete. Inspect the prompt with:"
        echo "  cat $bootstrap_prompt"
        echo ""
        echo "To execute recovery:"
        echo "  ./run-recovery.sh run --yes"
        exit 0
    fi

    # Step 8: Record current branch
    local current_branch
    current_branch=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || echo "unknown")
    log_info "Current branch: $current_branch"
    log_info "NOTE: Recovery continues on current branch (no new branch created)"

    # Step 9: Spawn AI CLI session
    echo ""
    log_info "Starting recovery session..."
    log_info "Workflow: $workflow_type"
    log_info "Resuming from: Phase $phase ($phase_name)"
    echo ""

    local exit_code=0
    spawn_recovery_session "$bootstrap_prompt" "$session_dir" "$model_override" || exit_code=$?

    # Step 10: Detect outcome
    local outcome
    outcome=$(detect_session_outcome "$exit_code" "$session_dir" "$workflow_type" "$main_branch")

    # Step 11: Post-session report
    echo ""
    echo "═══════════════════════════════════════════════════"
    echo "  Recovery Result"
    echo "═══════════════════════════════════════════════════"
    echo ""
    echo "  Workflow:      $workflow_type"
    echo "  Recovered from: Phase $phase ($phase_name)"
    echo "  Outcome:       $outcome"
    echo "  Session log:   $session_dir/logs/session.log"
    echo ""

    case "$outcome" in
        success)
            log_success "Recovery completed successfully!"
            # Auto-push if configured
            if [[ "$AUTO_PUSH" == "1" ]]; then
                log_info "Auto-pushing to remote (AUTO_PUSH=1)..."
                if git -C "$PROJECT_ROOT" push 2>/dev/null; then
                    log_success "Pushed to remote"
                else
                    log_warn "Push failed — push manually: git push"
                fi
            fi
            echo ""
            echo "  Next steps:"
            echo "    • Review changes: git log --oneline -5"
            echo "    • Run tests: npm test"
            if [[ "$workflow_type" == "bug-fix-workflow" && "$current_branch" == fix/* ]]; then
                echo "    • Merge to main: git checkout main && git merge $current_branch"
            fi
            if [[ "$AUTO_PUSH" != "1" ]]; then
                echo "    • Push when ready: git push"
            fi
            echo ""
            ;;
        success_wip)
            log_warn "Recovery session interrupted — work auto-saved as WIP commit."
            echo ""
            echo "  The session was interrupted but uncommitted changes were saved."
            echo "  The WIP commit preserves your progress."
            echo ""
            echo "  Next steps:"
            echo "    • Run recovery again to complete remaining phases: ./run-recovery.sh"
            echo "    • Or review the WIP commit: git log --oneline -1"
            echo ""
            ;;
        partial)
            log_warn "Session completed but has uncommitted changes."
            echo ""
            echo "  The session did work but didn't finish committing."
            echo "  Check uncommitted changes:"
            echo "    git status"
            echo "    git diff"
            echo ""
            echo "  Options:"
            echo "    • Run recovery again: ./run-recovery.sh"
            echo "    • Commit manually: git add <files> && git commit"
            echo ""
            ;;
        timed_out)
            log_warn "Session timed out before completing."
            echo ""
            echo "  Options:"
            echo "    • Run recovery again: ./run-recovery.sh"
            echo "    • Increase timeout: SESSION_TIMEOUT=3600 ./run-recovery.sh"
            echo ""
            ;;
        no_changes)
            log_warn "Session completed but produced no changes."
            echo ""
            echo "  The session may have already been fully recovered,"
            echo "  or the AI couldn't make progress."
            echo "  Check the session log for details:"
            echo "    cat $session_dir/logs/session.log"
            echo ""
            ;;
        *)
            log_error "Recovery session failed."
            echo ""
            echo "  Check session log for errors:"
            echo "    cat $session_dir/logs/session.log"
            echo ""
            echo "  Options:"
            echo "    • Run recovery again: ./run-recovery.sh"
            echo "    • Start fresh: /<workflow> command"
            echo ""
            ;;
    esac

    echo "═══════════════════════════════════════════════════"

    if [[ "$outcome" == "success" ]]; then
        exit 0
    else
        exit 1
    fi
}

# ============================================================
# Main
# ============================================================

main() {
    local command="${1:-run}"
    shift || true

    case "$command" in
        run)
            cmd_run "$@"
            ;;
        detect)
            cmd_detect
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
