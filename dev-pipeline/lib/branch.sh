#!/usr/bin/env bash
# ============================================================
# dev-pipeline/lib/branch.sh - Git Branch Lifecycle Library
#
# Shared by run-feature.sh, run-bugfix.sh, and run-refactor.sh
# for branch-based serial development. Each pipeline run creates
# a dev branch and all features/bugs/refactors commit on it.
#
# Functions:
#   branch_create                   — Create and checkout a new branch
#   branch_return                   — Checkout back to original branch
#   branch_merge                    — Merge dev branch into original and optionally push
#   branch_ensure_return            — Guaranteed return to original branch (try/finally)
#
# Environment:
#   _ORIGINAL_BRANCH                Set by caller before branch_create
#   _DEV_BRANCH_NAME                Set by caller after branch_create
#   DEV_BRANCH                      Optional custom branch name override
#   AUTO_PUSH                       Set to 1 to auto-push after successful feature
# ============================================================

# branch_create <project_root> <branch_name> <source_branch>
#
# Creates a new branch from source_branch and checks it out.
# If the branch already exists, checks it out instead.
#
# Returns 0 on success, 1 on failure.
branch_create() {
    local project_root="$1"
    local branch_name="$2"
    local source_branch="$3"

    # Check if branch already exists
    if git -C "$project_root" rev-parse --verify "$branch_name" >/dev/null 2>&1; then
        log_info "Branch already exists: $branch_name — checking out"
        if ! git -C "$project_root" checkout "$branch_name" 2>/dev/null; then
            log_error "Failed to checkout existing branch: $branch_name"
            return 1
        fi
        return 0
    fi

    # Create and checkout new branch
    if ! git -C "$project_root" checkout -b "$branch_name" "$source_branch" 2>/dev/null; then
        log_warn "Failed to create branch: $branch_name from $source_branch"
        return 1
    fi

    log_info "Created and checked out branch: $branch_name (from $source_branch)"
    return 0
}

# branch_return <project_root> <original_branch>
#
# Checks out the original branch after pipeline completes.
# Safe to call even if already on the original branch.
#
# Returns 0 on success, 1 on failure.
branch_return() {
    local project_root="$1"
    local original_branch="$2"

    local current_branch
    current_branch=$(git -C "$project_root" rev-parse --abbrev-ref HEAD 2>/dev/null) || {
        log_error "Failed to determine current branch"
        return 1
    }

    if [[ "$current_branch" == "$original_branch" ]]; then
        return 0
    fi

    if ! git -C "$project_root" checkout "$original_branch" 2>/dev/null; then
        log_error "Failed to checkout original branch: $original_branch"
        return 1
    fi

    log_info "Returned to branch: $original_branch"
    return 0
}

# branch_merge <project_root> <dev_branch> <original_branch> [auto_push]
#
# Merges dev_branch into original_branch, then optionally pushes.
# Steps:
#   1. Stash tracked dirty files (NOT untracked — .prizmkit/state/ is gitignored)
#   2. Rebase dev_branch onto original_branch (handles diverged main)
#   3. Fast-forward merge original_branch to rebased dev tip
#   4. Push to remote if auto_push == "1"
#   5. Delete dev_branch (local only, it's been merged)
#   6. Restore stashed files
#
# IMPORTANT: On failure, caller MUST still call branch_ensure_return()
# to guarantee return to the original branch.
#
# Returns 0 on success, 1 on failure.
branch_merge() {
    local project_root="$1"
    local dev_branch="$2"
    local original_branch="$3"
    local auto_push="${4:-0}"

    # Step 1: Stash any tracked uncommitted changes so checkout is not blocked.
    # Only stash tracked changes (not untracked). Untracked files like
    # .prizmkit/state/ are gitignored and survive checkout without issue.
    # Using --include-untracked causes stash pop conflicts and can lose
    # state/ files that are needed for pipeline status tracking.
    local had_stash=false
    local tracked_dirty
    tracked_dirty=$(git -C "$project_root" diff --name-only 2>/dev/null || true)
    local staged_dirty
    staged_dirty=$(git -C "$project_root" diff --cached --name-only 2>/dev/null || true)
    if [[ -n "$tracked_dirty" || -n "$staged_dirty" ]]; then
        if git -C "$project_root" stash push -m "pipeline-merge-stash" 2>/dev/null; then
            had_stash=true
        else
            log_warn "git stash failed — uncommitted tracked changes may not be preserved during merge"
            had_stash=false
        fi
    fi

    # Step 2: Rebase dev branch onto original to make it fast-forwardable.
    # This handles the case where original_branch has diverged
    # (e.g. commits were made on main while the pipeline was running).
    # "git rebase A B" is equivalent to: git checkout B && git rebase A
    log_info "Merging $dev_branch into $original_branch..."
    if ! git -C "$project_root" rebase "$original_branch" "$dev_branch" 2>&1; then
        log_error "Rebase of $dev_branch onto $original_branch failed — resolve manually:"
        log_error "  git rebase --abort  # then resolve conflicts and retry"
        git -C "$project_root" rebase --abort 2>/dev/null || true
        if [[ "$had_stash" == true ]]; then
            if ! git -C "$project_root" stash pop 2>/dev/null; then
                log_warn "git stash pop failed after rebase abort — run 'git stash list' to check"
            fi
        fi
        return 1
    fi
    # After the rebase we are on dev_branch — checkout original for the fast-forward
    if ! git -C "$project_root" checkout "$original_branch" 2>/dev/null; then
        log_error "Failed to checkout $original_branch for merge"
        if [[ "$had_stash" == true ]]; then
            if ! git -C "$project_root" stash pop 2>/dev/null; then
                log_warn "git stash pop failed after checkout failure — run 'git stash list' to check"
            fi
        fi
        return 1
    fi

    # Step 3: Fast-forward original_branch to the rebased dev tip
    if ! git -C "$project_root" merge --ff-only "$dev_branch" 2>&1; then
        log_error "Merge failed after rebase — this should not happen, resolve manually:"
        log_error "  git checkout $original_branch && git rebase $dev_branch"
        if [[ "$had_stash" == true ]]; then
            if ! git -C "$project_root" stash pop 2>/dev/null; then
                log_warn "git stash pop failed after merge failure — run 'git stash list' to check"
            fi
        fi
        return 1
    fi

    log_success "Merged $dev_branch into $original_branch"

    # Step 4: Push if AUTO_PUSH enabled
    if [[ "$auto_push" == "1" ]]; then
        log_info "Pushing $original_branch to remote..."
        if git -C "$project_root" push 2>/dev/null; then
            log_success "Pushed $original_branch to remote"
        else
            log_warn "Push failed — run 'git push' manually"
        fi
    fi

    # Step 5: Delete merged dev branch
    git -C "$project_root" branch -d "$dev_branch" 2>/dev/null && \
        log_info "Deleted merged branch: $dev_branch" || true

    # Step 6: Restore stashed files
    if [[ "$had_stash" == true ]]; then
        if ! git -C "$project_root" stash pop 2>/dev/null; then
            log_warn "git stash pop failed after merge — stashed changes may be lost. Run 'git stash list' to check."
        fi
    fi

    return 0
}

# branch_save_wip <project_root> <dev_branch>
#
# Saves any uncommitted work-in-progress on the dev branch before returning
# to the original branch. Called during interrupt/crash cleanup to preserve
# partially completed AI work that hasn't been committed yet.
#
# Commits ALL changes (tracked + untracked, excluding gitignored) with a
# "wip:" prefix message so it's easy to identify and squash later.
#
# Safe to call when the working tree is clean — it simply does nothing.
# Never fails — errors are logged but the function always returns 0.
branch_save_wip() {
    local project_root="$1"
    local dev_branch="$2"

    # Nothing to save if dev_branch is empty
    if [[ -z "$dev_branch" ]]; then
        return 0
    fi

    # Verify we're actually on the dev branch
    local current_branch
    current_branch=$(git -C "$project_root" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    if [[ "$current_branch" != "$dev_branch" ]]; then
        return 0
    fi

    # Check if there are any uncommitted changes (tracked or untracked, excluding gitignored)
    local has_changes
    has_changes=$(git -C "$project_root" status --porcelain 2>/dev/null || true)
    if [[ -z "$has_changes" ]]; then
        return 0
    fi

    log_warn "Saving uncommitted work-in-progress on branch: $dev_branch"

    # Stage all changes (tracked + untracked, respects .gitignore)
    if ! git -C "$project_root" add -A 2>/dev/null; then
        log_warn "git add -A failed — uncommitted work may be lost on branch switch"
        return 0
    fi

    # Commit with WIP marker
    if git -C "$project_root" commit --no-verify \
        -m "wip($dev_branch): interrupted — uncommitted work saved" \
        -m "Pipeline was interrupted by signal. This commit preserves work-in-progress." \
        -m "To resume: git checkout $dev_branch" 2>/dev/null; then
        log_info "Saved uncommitted work on branch $dev_branch"
    else
        log_warn "git commit failed — uncommitted work may be lost on branch switch"
    fi

    return 0
}

# branch_ensure_return <project_root> <original_branch> [dev_branch]
#
# GUARANTEED return to the original branch. Like a try/finally block.
# Must be called in EVERY exit path: success, failure, interrupt, crash.
# This is the single point of truth for "always go back to original branch".
#
# If dev_branch is provided and we're currently on it, any uncommitted
# work is saved as a WIP commit before switching (via branch_save_wip).
#
# Handles:
#   - Saving uncommitted WIP on dev branch (if dev_branch provided)
#   - Aborting any in-progress rebase (leftover from branch_merge failure)
#   - Stashing any tracked dirty files that block checkout
#   - Checking out original_branch
#   - Restoring stashed files
#   - Logging for diagnostics
#
# Never fails — errors are logged but the function always returns 0
# so it can be used in cleanup traps without breaking error handling.
branch_ensure_return() {
    local project_root="$1"
    local original_branch="$2"
    local dev_branch="${3:-}"

    # If original_branch is empty or unset, nothing to return to
    if [[ -z "$original_branch" ]]; then
        return 0
    fi

    # Abort any in-progress rebase (can happen if branch_merge failed mid-way)
    if git -C "$project_root" rebase --show-current-patch >/dev/null 2>&1; then
        log_warn "Aborting in-progress rebase..."
        git -C "$project_root" rebase --abort 2>/dev/null || true
    fi

    # Check current branch
    local current_branch
    current_branch=$(git -C "$project_root" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

    if [[ "$current_branch" == "$original_branch" ]]; then
        return 0
    fi

    # Save any uncommitted WIP on dev branch before switching away
    # Use dev_branch if provided; otherwise infer from current_branch
    local _wip_branch="${dev_branch:-$current_branch}"
    if [[ -n "$_wip_branch" && "$_wip_branch" != "$original_branch" ]]; then
        branch_save_wip "$project_root" "$_wip_branch"
    fi

    log_info "Ensuring return to original branch: $original_branch (currently on: ${current_branch:-unknown})"

    # Stash any tracked dirty files that would block checkout
    # (branch_save_wip should have committed everything, but this is a safety net
    #  in case the commit failed or new files appeared)
    local had_stash=false
    local tracked_dirty
    tracked_dirty=$(git -C "$project_root" diff --name-only 2>/dev/null || true)
    local staged_dirty
    staged_dirty=$(git -C "$project_root" diff --cached --name-only 2>/dev/null || true)
    if [[ -n "$tracked_dirty" || -n "$staged_dirty" ]]; then
        if git -C "$project_root" stash push -m "pipeline-ensure-return-stash" 2>/dev/null; then
            had_stash=true
        fi
    fi

    # Checkout original branch
    if git -C "$project_root" checkout "$original_branch" 2>/dev/null; then
        log_info "Returned to branch: $original_branch"
    else
        log_error "Failed to checkout $original_branch — manual recovery needed"
    fi

    # Restore stashed files
    if [[ "$had_stash" == true ]]; then
        if ! git -C "$project_root" stash pop 2>/dev/null; then
            log_warn "git stash pop failed during branch return — stashed changes may be lost. Run 'git stash list' to check."
        fi
    fi

    return 0
}
