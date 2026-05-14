"Read {{CRITIC_SUBAGENT_PATH}}. For feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}):
**MODE: Plan Challenge**
1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST — Section 3 has project context, Section 4 has file manifest.
2. Read `.prizm-docs/root.prizm` and relevant L1/L2 docs for affected modules.
3. Read existing source files in the modules this plan touches.
4. Challenge plan.md against the project's existing architecture, patterns, and style.
Write `.prizmkit/specs/{{FEATURE_SLUG}}/challenge-report.md` with findings (or 'No significant challenges')."
