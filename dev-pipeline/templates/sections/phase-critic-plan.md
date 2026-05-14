### Plan Challenge — Critic Agent

**Guard**: Verify critic agent file exists before spawning:
```bash
ls {{CRITIC_SUBAGENT_PATH}} 2>/dev/null && echo "CRITIC:READY" || echo "CRITIC:MISSING"
```
If CRITIC:MISSING — skip this phase entirely and proceed. Log: "Critic agent not installed — skipping Plan Challenge."

**Spawn Agent**:
| Parameter | Value |
|-----------|-------|
| subagent_type | prizm-dev-team-critic |
| mode | plan |
| run_in_background | false |

**Prompt**:
> {{AGENT_PROMPT_CRITIC_PLAN_CHALLENGE}}

Wait for Critic to return.
- Read challenge-report.md. For items marked CRITICAL/HIGH: decide whether to adjust plan.md or document why the plan stands.
- Max 1 plan revision round.

**CP-2.5**: Plan challenges reviewed and resolved.


**Checkpoint update**: Update `workflow-checkpoint.json` — set step `critic-plan-review` to `"completed"`.
