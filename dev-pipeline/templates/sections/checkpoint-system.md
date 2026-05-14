## Workflow Checkpoint System

A checkpoint file tracks your progress through this workflow:

**Path**: `{{CHECKPOINT_PATH}}`

### Rules

1. **Before each skill**: Read `workflow-checkpoint.json`, verify the previous step has `status: "completed"` or `status: "skipped"`. If it is still `"pending"` or `"in_progress"`, you MUST complete it first before moving on.

2. **Starting a skill**: Update the current step to `status: "in_progress"`.

3. **After each skill completes**: Update the current step to `status: "completed"`. Then immediately re-read the file to verify the JSON is valid. If the read fails, re-write the file with correct JSON.

4. **On failure**: Set the step to `status: "failed"` and continue to the next step if possible, or halt and write failure-log.md.

5. **On session exit**: The checkpoint file reflects your actual progress. Do NOT manually set future steps to "completed".

### Checkpoint Update Pattern

After completing each skill:

1. Read `{{CHECKPOINT_PATH}}`
2. Update the current step `"status": "completed"`
3. Update the next step `"status": "in_progress"`
4. Write the updated JSON back to `{{CHECKPOINT_PATH}}`
5. Verify: `python3 -c "import json; json.load(open('{{CHECKPOINT_PATH}}'))"` — if this fails, re-write

### Resume Behavior

**Checkpoint is the primary source of truth for resume.** On retry sessions:

1. Read `workflow-checkpoint.json` — steps already `"completed"` or `"skipped"` are skipped
2. Start from the first `"pending"` or `"in_progress"` step
3. If `failure-log.md` exists, read it for diagnostic context (why the previous session failed, what approach to try differently) — but do NOT use it to determine which step to resume from
4. If `workflow-checkpoint.json` is missing or corrupted, fall back to `failure-log.md` + the resume phase as the legacy mechanism
