#!/usr/bin/env bash
# ============================================================
# dev-pipeline/lib/common.sh - Shared shell helpers
#
# Shared by feature and bugfix pipeline runners.
# Provides:
#   - CLI/platform detection
#   - Common color + log helpers
#   - Common dependency checks
# ============================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}    $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}    $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC}   $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"; }

# ============================================================
# .env file loading
# ============================================================

# Load .env file if it exists. Does NOT override already-set env vars.
# Supports: KEY=VALUE, KEY="VALUE", KEY='VALUE', comments (#), empty lines.
# If the file does not exist, silently continues (no error).
prizm_load_env() {
    local env_file="${1:-.env}"
    [[ -f "$env_file" ]] || return 0

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        # Remove inline comments (not inside quotes)
        line="${line%%#*}"
        # Trim whitespace
        line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        [[ -z "$line" ]] && continue
        # Parse KEY=VALUE
        if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local val="${BASH_REMATCH[2]}"
            # Strip surrounding quotes
            val="${val#\"}" ; val="${val%\"}"
            val="${val#\'}" ; val="${val%\'}"
            # Only set if not already defined in environment
            if [[ -z "${!key+x}" ]]; then
                export "$key=$val"
            fi
        fi
    done < "$env_file"
}

# ============================================================
# Test mode: bootstrap prompt logging
# ============================================================

# Log bootstrap prompt content when PRIZMKIT_ENV=test.
# Called after prompt generation, before AI CLI session spawn.
# Usage: prizm_log_bootstrap_prompt <prompt_path> <item_id>
prizm_log_bootstrap_prompt() {
    local prompt_path="$1"
    local item_id="$2"

    [[ "${PRIZMKIT_ENV:-}" == "test" ]] || return 0
    [[ -f "$prompt_path" ]] || return 0

    local lines size
    lines=$(wc -l < "$prompt_path" 2>/dev/null | tr -d ' ')
    size=$(wc -c < "$prompt_path" 2>/dev/null | tr -d ' ')

    echo ""
    echo -e "${MAGENTA}[TEST]${NC} ════════════════════════════════════════════════════"
    echo -e "${MAGENTA}[TEST]${NC} Bootstrap Prompt for $item_id"
    echo -e "${MAGENTA}[TEST]${NC} Lines: $lines | Size: $((size / 1024))KB"
    echo -e "${MAGENTA}[TEST]${NC} Path: $prompt_path"
    echo -e "${MAGENTA}[TEST]${NC} ════════════════════════════════════════════════════"
    cat "$prompt_path"
    echo ""
    echo -e "${MAGENTA}[TEST]${NC} ════════════════════════ END ═══════════════════════"
    echo ""
}

# Detect AI CLI + platform.
# Priority:
#   AI_CLI env > .prizmkit/config.json > CODEBUDDY_CLI > auto-detect(cbc/claude) > error
#
# Exports:
#   CLI_CMD
#   PLATFORM
#   PRIZMKIT_PLATFORM
prizm_detect_cli_and_platform() {
    # Load .env from project root if it exists (does not override existing env vars)
    local _env_root
    _env_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)" || true
    if [[ -n "$_env_root" ]]; then
        prizm_load_env "$_env_root/.env"
    fi

    local _raw_cli=""

    if [[ -n "${AI_CLI:-}" ]]; then
        _raw_cli="$AI_CLI"
    elif [[ -f ".prizmkit/config.json" ]]; then
        _config_ai_cli=$(python3 -c "
import json, sys
try:
    with open('.prizmkit/config.json') as f:
        d = json.load(f)
    v = d.get('ai_cli', '')
    if not v:
        p = d.get('platform', '')
        if p == 'claude': v = 'claude'
        elif p == 'codebuddy': v = 'cbc'
    if v: print(v)
except: pass
" 2>/dev/null || true)
        if [[ -n "$_config_ai_cli" ]]; then
            _raw_cli="$_config_ai_cli"
        elif [[ -n "${CODEBUDDY_CLI:-}" ]]; then
            _raw_cli="$CODEBUDDY_CLI"
        elif command -v claude &>/dev/null; then
            _raw_cli="claude"
        elif command -v cbc &>/dev/null; then
            _raw_cli="cbc"
        else
            echo "ERROR: No AI CLI found. Install CodeBuddy (cbc) or Claude Code (claude)." >&2
            exit 1
        fi
    elif [[ -n "${CODEBUDDY_CLI:-}" ]]; then
        _raw_cli="$CODEBUDDY_CLI"
    elif command -v claude &>/dev/null; then
        _raw_cli="claude"
    elif command -v cbc &>/dev/null; then
        _raw_cli="cbc"
    else
        echo "ERROR: No AI CLI found. Install CodeBuddy (cbc) or Claude Code (claude)." >&2
        exit 1
    fi

    CLI_CMD="$_raw_cli"

    if [[ -n "${PRIZMKIT_PLATFORM:-}" ]]; then
        PLATFORM="$PRIZMKIT_PLATFORM"
    elif [[ "$_raw_cli" == *"claude"* ]]; then
        PLATFORM="claude"
    else
        PLATFORM="codebuddy"
    fi

    export CLI_CMD
    export PLATFORM
    export PRIZMKIT_PLATFORM="$PLATFORM"
}

# prizm_detect_subagents <session_log>
#
# Scan session log for subagent spawns, count them, and log the result.
# Sets _SUBAGENT_COUNT to the number of Agent tool calls detected.
# Requires: USE_STREAM_JSON (from detect_stream_json_support)
_SUBAGENT_COUNT=0
prizm_detect_subagents() {
    local session_log="$1"
    _SUBAGENT_COUNT=0
    [[ -f "$session_log" ]] || return 0

    local count=0
    if [[ "$USE_STREAM_JSON" == "true" ]]; then
        count=$(grep -c '"name"[[:space:]]*:[[:space:]]*"Agent"' "$session_log" 2>/dev/null) || true
    else
        count=$(grep -cE '(Tool: Agent|"tool":\s*"Agent"|tool_use.*Agent|subagent_type)' "$session_log" 2>/dev/null) || true
    fi

    count=${count:-0}
    _SUBAGENT_COUNT=$count
    if [[ "$count" -gt 0 ]]; then
        log_info "Subagent calls detected in session: $count"
    else
        log_info "Subagent calls detected in session: 0 (single-agent mode)"
    fi
}

# Common dependency check (jq + python3 + optional CLI in PATH)
# Args:
#   $1 - cli command (optional)
prizm_check_common_dependencies() {
    local cli_cmd="${1:-}"

    if ! command -v jq &>/dev/null; then
        log_error "jq is required but not installed. Install with: brew install jq"
        exit 1
    fi

    if ! command -v python3 &>/dev/null; then
        log_error "python3 is required but not installed."
        exit 1
    fi

    if [[ -n "$cli_cmd" ]] && ! command -v "$cli_cmd" &>/dev/null; then
        log_warn "AI CLI '$cli_cmd' not found in PATH."
        log_warn "Set AI_CLI environment variable to the correct command."
        log_warn "Continuing anyway (will fail when spawning sessions)..."
    fi
}

# Ensure git is installed and a given directory is a git repository.
# If git is missing, attempt auto-install; on failure print instructions and exit.
# If not inside a git repo, run git init + initial commit automatically.
#
# Usage: prizm_ensure_git_repo [directory]
#   directory — path to check/initialize (defaults to current working directory)
prizm_ensure_git_repo() {
    local target_dir="${1:-.}"

    # --- helper: run a command with a timeout (macOS-compatible) ---
    # Uses GNU timeout / gtimeout if available, otherwise a background+kill fallback.
    _run_with_timeout() {
        local secs="$1"; shift
        if command -v timeout &>/dev/null; then
            timeout "$secs" "$@"
        elif command -v gtimeout &>/dev/null; then
            gtimeout "$secs" "$@"
        else
            # background + kill fallback
            "$@" &
            local pid=$!
            ( sleep "$secs" && kill "$pid" 2>/dev/null ) &
            local watchdog=$!
            if wait "$pid" 2>/dev/null; then
                kill "$watchdog" 2>/dev/null; wait "$watchdog" 2>/dev/null
                return 0
            else
                kill "$watchdog" 2>/dev/null; wait "$watchdog" 2>/dev/null
                return 1
            fi
        fi
    }

    if ! command -v git &>/dev/null; then
        log_warn "git is not installed. Attempting automatic installation..."
        local _install_ok=false
        case "$(uname -s)" in
            Darwin)
                if command -v brew &>/dev/null; then
                    log_info "Installing git via Homebrew..."
                    if _run_with_timeout 120 brew install git &>/dev/null; then
                        _install_ok=true
                    fi
                else
                    # xcode-select --install opens a GUI dialog that cannot be automated;
                    # skip auto-install and fall through to manual instructions.
                    log_info "Homebrew not found; cannot auto-install git on macOS."
                fi
                ;;
            Linux)
                # Verify passwordless sudo is available (daemon/CI safety)
                if ! sudo -n true 2>/dev/null; then
                    log_info "sudo requires a password; cannot auto-install git."
                elif command -v apt-get &>/dev/null; then
                    log_info "Installing git via apt-get..."
                    _run_with_timeout 120 sudo apt-get update -y &>/dev/null
                    if _run_with_timeout 120 sudo apt-get install -y git &>/dev/null; then
                        _install_ok=true
                    fi
                elif command -v yum &>/dev/null; then
                    log_info "Installing git via yum..."
                    if _run_with_timeout 120 sudo yum install -y git &>/dev/null; then
                        _install_ok=true
                    fi
                elif command -v dnf &>/dev/null; then
                    log_info "Installing git via dnf..."
                    if _run_with_timeout 120 sudo dnf install -y git &>/dev/null; then
                        _install_ok=true
                    fi
                elif command -v pacman &>/dev/null; then
                    log_info "Installing git via pacman..."
                    if _run_with_timeout 120 sudo pacman -S --noconfirm git &>/dev/null; then
                        _install_ok=true
                    fi
                fi
                ;;
        esac

        if $_install_ok && command -v git &>/dev/null; then
            log_success "git installed successfully ($(git --version))."
        else
            log_error "Automatic git installation failed or timed out."
            log_error "Please install git manually:"
            log_error "  macOS:   brew install git   or   xcode-select --install"
            log_error "  Ubuntu:  sudo apt-get install git"
            log_error "  CentOS:  sudo yum install git"
            log_error "  Windows: https://git-scm.com/download/win"
            exit 1
        fi
    fi

    # Validate target directory exists
    if [[ ! -d "$target_dir" ]]; then
        log_error "Target directory does not exist: $target_dir"
        exit 1
    fi

    if ! git -C "$target_dir" rev-parse --is-inside-work-tree &>/dev/null 2>&1; then
        log_warn "Directory is not a git repository: $target_dir"
        log_info "Initializing git repository..."
        git -C "$target_dir" init -b main
        log_info "Git repository initialized at: $target_dir"
        # Create initial commit so branches and diffs work
        if ! git -C "$target_dir" add -A; then
            log_error "Failed to stage files in: $target_dir"
            exit 1
        fi
        git -C "$target_dir" commit --no-verify -m "chore: initial commit (auto-created by dev-pipeline)" || {
            # If nothing to commit (empty project), create an empty initial commit
            git -C "$target_dir" commit --no-verify --allow-empty -m "chore: initial commit (auto-created by dev-pipeline)"
        }
        log_success "Initial commit created — workspace content committed."
    fi
}
