## Subagent Timeout Recovery

If any agent times out:
1. `ls .prizmkit/specs/{{FEATURE_SLUG}}/` — check what exists
2. If `context-snapshot.md` exists: open recovery prompt with `"Read .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md for project context and any Implementation Log/Review Notes from previous agents. Run git diff HEAD to see actual code changes already made. Do NOT re-read individual source files unless the File Manifest directs you to."` + only remaining steps + `model: "lite"`
3. Max 2 retries per phase. After 2 failures, orchestrator completes the work directly and appends a Recovery Note to context-snapshot.md.
