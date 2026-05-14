### Plan Challenge — Critic Agent(s)

**Guard**: Verify critic agent file exists before spawning:
```bash
ls {{CRITIC_SUBAGENT_PATH}} 2>/dev/null && echo "CRITIC:READY" || echo "CRITIC:MISSING"
```
If CRITIC:MISSING — skip this phase entirely and proceed. Log: "Critic agent not installed — skipping Plan Challenge."

**Choose ONE path based on `{{CRITIC_COUNT}}`:**

**If {{CRITIC_COUNT}} = 1 → Single Critic** (skip to CP-2.5 after this):

**Spawn Agent**:
| Parameter | Value |
|-----------|-------|
| subagent_type | prizm-dev-team-critic |
| mode | plan |
| run_in_background | false |

**Prompt**:
> {{AGENT_PROMPT_CRITIC_PLAN_CHALLENGE}}

**If {{CRITIC_COUNT}} = 3 → Multi-Critic Voting** (skip Single Critic above):

Spawn 3 Critic agents sequentially (each with mode="plan", run_in_background=false), each with a different focus lens:

Critic-A prompt (append to base prompt above):
> "**Focus Lens: Architecture & Scalability.** Prioritize: architectural pattern fit, scalability implications, over-engineering risks, component boundary design.
> Write `.prizmkit/specs/{{FEATURE_SLUG}}/challenge-report-A.md`."

Critic-B prompt (append to base prompt above):
> "**Focus Lens: Data Model & Edge Cases.** Prioritize: data model design fit, entity relationships, edge cases in business logic, missing boundary conditions.
> Write `.prizmkit/specs/{{FEATURE_SLUG}}/challenge-report-B.md`."

Critic-C prompt (append to base prompt above):
> "**Focus Lens: Security & Performance.** Prioritize: security attack surface, authentication/authorization gaps, performance bottlenecks, resource leaks.
> Write `.prizmkit/specs/{{FEATURE_SLUG}}/challenge-report-C.md`."

After all critics return, read all 3 reports:
- Challenge raised by **2/3 or more** critics → **must respond** (adjust plan or justify why not)
- Challenge raised by **1/3 only** → logged in context-snapshot but not blocking
- Max 1 plan revision round.

**CP-2.5**: Plan challenges reviewed and resolved.


**Checkpoint update**: Update `workflow-checkpoint.json` — set step `critic-plan-review` to `"completed"`.
