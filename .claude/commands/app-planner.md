---
description: "Plan an application through interactive conversation — capture vision, tech stack, constraints, and project brief. Works for both new (greenfield) and existing (brownfield) projects that need app-level planning. Use this skill when users say 'plan an app', 'design a new project', 'start from scratch', 'build a new application', or discuss app-level architecture and design. Also use for existing projects that need a project brief or app-level context. For adding features to existing projects that already have a project brief, use feature-planner instead."
---

# app planner

Plan an application from idea to actionable project context through interactive conversation. Works for both **greenfield** (new) and **brownfield** (existing) projects:
- Vision and problem statement
- Tech stack selection (or confirmation of existing stack)
- Constraints and design direction
- Architecture decision capture
- Project brief accumulation (`.prizmkit/plans/project-brief.md`)

This skill captures **project-level context only**: vision, tech stack, conventions, architecture decisions, and project brief. It does NOT do feature decomposition or generate `feature-list.json` — that is `feature-planner`'s job.

For adding features to an **existing** project that already has a project brief, use `feature-planner` directly.

## Invocation Commitment (Hard Rule)
 You must NEVER:
- Bypass the interactive phases because you judge the task to be "simple"

If you believe the task is better suited for a different workflow, you MUST:
1. **Explain why** you think a different path is more appropriate
2. **Ask the user explicitly** whether they want to switch
3. **Only switch if the user confirms**

## Scope Boundary (Hard Rule)

**This skill is PLANNING ONLY.** You must NEVER:
- Create, modify, or delete source code files (*.js, *.ts, *.py, *.go, *.html, *.css, etc.)
- Create project scaffolding, directories, or boilerplate
- Run build/install/test commands (npm init, pip install, etc.)
- Execute any implementation action beyond writing planning artifacts

**Your ONLY writable outputs are:**
1. `.prizmkit/plans/project-brief.md` (`.prizmkit/plans/` — accumulated project context brief)
2. Project conventions and architecture decisions appended to `CLAUDE.md` / `CODEBUDDY.md` (with user consent)
3. Infrastructure configuration (database conventions + deployment config) appended to `CLAUDE.md` / `CODEBUDDY.md` `### Infrastructure` section

**After planning is complete**, you MUST:
1. Present the summary of captured project-level context (vision, conventions, architecture decisions, project brief)
2. List the artifacts produced and suggest possible next steps (e.g., `feature-planner`, `prizmkit-plan`, etc.) — but do NOT auto-invoke any of them
3. **NEVER auto-execute** the pipeline, feature-planner, or any implementation step
4. **NEVER generate `feature-list.json`** — that is exclusively `feature-planner`'s responsibility

## When to Use

Trigger this skill for requests like:
- "Plan an app", "Design a project", "Design a new application"
- "Start from scratch", "Build something new", "Create a new product"
- "Help me figure out what to build", "Brainstorm an app idea"
- "What tech stack should I use?", "Help me choose frameworks"
- "Create a project brief for my existing project"
- "Help me document what this project is about"
- "I have a codebase but no project plan yet"

Do NOT use this skill when:
- The user already has a project brief and wants to add features → use `feature-planner`
- The user wants to run the pipeline → use `feature-pipeline-launcher`
- The user is debugging/refactoring or wants to write source code directly

## Resource Loading Rules (Mandatory)

1. **App design reference** — always load at session start:
   - Read `.claude/command-assets/app-planner/assets/app-design-guide.md` for vision templates and tech stack matrix

2. **Load on-demand references when triggered**:
   - Architecture decisions emerged → read `.claude/command-assets/app-planner/references/architecture-decisions.md`
   - Frontend/UI project detected → read `.claude/command-assets/app-planner/references/frontend-design-guide.md`
   - User wants to explore ideas before committing → read `.claude/command-assets/app-planner/references/brainstorm-guide.md`
   - During brainstorm Phase C → also read `.claude/command-assets/app-planner/references/red-team-checklist.md`

3. **Project conventions discovery** — after Intent Confirmation, before brainstorm or vision work:
   → Read `CLAUDE.md` / `CODEBUDDY.md` and check for `### Project Conventions` section
   → If section exists and covers the project well → skip silently
   → If section is missing or incomplete → run the **AI-driven convention discovery** below:

   **Do NOT follow any fixed checklist.** Every project is different. You must analyze the project first, then reason about what system-level conventions this specific project needs.

   **Step 1: Analyze the project**
   - Read tech stack, dependencies, existing code, config files, README, any existing style guides or linter configs
   - For brownfield: also read actual source code patterns (naming, file structure, error handling, etc.)
   - For greenfield: use the user's stated goals and intended tech stack

   **Step 2: Reason about what conventions matter for THIS project**
   Think about what decisions, if left unstandardized, would cause inconsistency as the project grows. Consider all dimensions relevant to the project — these might include (but are NOT limited to):
   - Language and localization choices
   - Code style and naming patterns
   - Architecture and communication patterns
   - Data format and storage decisions
   - Security and auth approaches
   - UI/UX patterns
   - Testing strategies
   - Deployment and environment patterns
   - ...anything else you observe that needs a project-level decision

   The point is: YOU decide what's relevant based on what you see. A Next.js SaaS app needs completely different conventions than a Python data pipeline or a Go microservice.

   **Step 3: Present findings via `AskUserQuestion`**

   First, show "Already decided" conventions as text:
   > **Already decided** (detected from your codebase):
   > - [convention]: [value] (source: [where you found it])
   > - [convention]: [value] (source: [where you found it])

   Then use `AskUserQuestion` for conventions that need user input (up to 4 questions per call, use multiple calls as needed — no limit on total rounds). Each question:
   - Question text includes the convention name AND why it matters for this project
   - Options are the reasonable choices (2-4 per question)
   - Mark the recommended option first with "(Recommended)" in its label
   - Use `description` field to explain trade-offs

   After each batch of `AskUserQuestion` calls, reassess: are there more project-level conventions to cover? If yes, continue with more `AskUserQuestion` calls. Keep going until ALL project-level conventions are fully addressed.

   Then ask in text: "Anything I missed that you'd like to standardize?" — if the user adds more, continue the discovery loop.

   **Rules:**
   - **No interaction limit** — keep asking until every project-level convention is covered. Do NOT stop early or batch-skip to save rounds.
   - Every proposed convention must be justified by something you observed in the project — explain WHY it matters
   - Auto-confirm anything already evident from the codebase (show as "detected", let user override)
   - Propose as many conventions as the project genuinely needs, but don't pad with irrelevant ones
   - The "Anything I missed?" question is NOT the end — if the user adds items, ask follow-up `AskUserQuestion` calls to clarify those too

   → Save answers to `CLAUDE.md` / `CODEBUDDY.md` under `### Project Conventions` section (format: one bullet per convention)
   → Output format will naturally vary per project — that is the intended behavior

   **Infrastructure Convention Discovery (Database + Deployment)**

   After project conventions are captured, check `CLAUDE.md` / `CODEBUDDY.md` for `### Infrastructure` section:

   - If `### Infrastructure` section does not exist → this project was not initialized with prizmkit-init's Phase 4.5. Treat as if both database and deployment are undecided — run full inquiry below.
   - If `<!-- infrastructure: deferred -->` → user explicitly skipped at init time. Ask: "During project init you deferred infrastructure decisions. Would you like to configure them now?" (options: "Yes — configure now (Recommended)", "Skip — decide later")
   - If `<!-- database: deferred -->` → only database was deferred, run database inquiry only
   - If `<!-- deployment: deferred -->` or deployment section is missing → run deployment inquiry only
   - If both sections exist with real values → read existing config, present as "Already decided", ask: "Anything to change?" If no → skip to next phase.

   **Database Convention Deep Inquiry** (AI-driven, context-aware — select from pool based on project):

   AI analyzes the detected database type, ORM, and tech stack, then selects relevant questions from this pool. Do NOT ask all questions — only those that matter for THIS project:

   1. **Table naming convention**: snake_case / camelCase / PascalCase; prefix convention (e.g., `t_`, `tbl_`, none). For brownfield: detect from existing migration files or schema and present as "Already decided" with override option.
   2. **Field naming convention**: snake_case / camelCase; common fields convention — are `created_at`, `updated_at`, `deleted_at` (soft delete) required on all tables? What about `id` vs `uuid` column naming?
   3. **Migration conventions**:
      - File storage directory (e.g., `db/migrations/`, `prisma/migrations/`, `alembic/versions/`)
      - Naming rule (timestamp prefix `20240101_create_users`, sequence prefix `001_create_users`, ORM auto-generated)
      - Migration tool (ORM built-in / Flyway / Liquibase / golang-migrate / manual SQL)
      - For brownfield: detect existing migration directory and naming pattern, present as "Already decided"
   4. **Primary key strategy**: Auto-increment integer / UUID v4 / ULID / Snowflake ID / Other
   5. **Index naming convention**: e.g., `idx_{table}_{column}`, `ix_{table}_{column}`, or ORM default
   6. **Environment separation**: dev/test/prod database separation strategy; connection config management (env vars / config files / secret manager)

   Use `AskUserQuestion` for each batch (up to 4 questions per call). For brownfield projects, show detected patterns as recommended options. Each question MUST include a "Skip — decide later" option.

   **Deployment Configuration Deep Inquiry** (AI-driven, context-aware):

   Read the existing `### Infrastructure` → `#### Deployment` section for the deployment target, then ask relevant follow-up questions:

   1. **Deployment target refinement**:
      - Own server: SSH access method (key-based / password), OS (Ubuntu / CentOS / other), Docker installed?
      - SaaS platform: specific platform confirmation, existing account and project? Already deployed before?
      - Container: orchestration method (Docker Compose / K8s / ECS / Cloud Run)
   2. **Existing infrastructure**:
      - Remote machine availability — IP/domain? Existing server configuration?
      - Existing CI/CD pipeline — GitHub Actions / GitLab CI / Jenkins / other? Already configured?
      - Domain name and SSL — already owned? DNS provider? SSL management (Let's Encrypt / platform-managed / other)?
   3. **AI-assisted deployment**:
      - Whether AI should help execute deploy commands (via SaaS CLI like `vercel deploy`, `fly deploy`, `railway up`, `docker push`, or SSH remote commands)
      - If yes: collect necessary info — API token storage method (env var name, e.g., `VERCEL_TOKEN`), project name/ID on the platform, target environment (production / staging)
      - Explicitly inform: "AI will show each command and wait for your confirmation before executing"
   4. **Environment variable management**: production env var strategy (SaaS platform dashboard / `.env.production` committed to repo / secret manager like AWS Secrets Manager, Vault / CI/CD secrets)

   Use `AskUserQuestion` for each batch. Each question MUST include a "Skip — decide later" option.

   **After infrastructure inquiry**:
   - Update `CLAUDE.md` / `CODEBUDDY.md` `### Infrastructure` section with all collected information. Replace `<!-- deferred -->` markers with real values. Preserve any existing values that were confirmed unchanged. Full format:
     ```markdown
     ### Infrastructure

     #### Database
     - **Type**: [database type]
     - **ORM**: [ORM name]
     - **Table naming**: [convention, e.g., snake_case, no prefix]
     - **Field naming**: [convention]; common fields: [list]
     - **Primary key**: [strategy]
     - **Migration directory**: [path]
     - **Migration naming**: [rule]
     - **Index naming**: [convention]
     - **Environment separation**: [strategy]

     #### Deployment
     - **Target**: [platform/method]
     - **AI-assisted deploy**: [yes/no]
     - **Domain**: [domain or "not configured"]
     - **SSL**: [management method]
     - **CI/CD**: [tool or "not configured"]
     - **Env var management**: [strategy]

     #### Deployment Credentials Reference
     - [platform]: [token/auth method description]
     ```
   - Items still marked "Skip — decide later" remain as `<!-- [topic]: deferred -->` in CLAUDE.md for `prizmkit-deploy` to pick up later.

4. **Project brief accumulation** — throughout all interactive phases:
   → Read `.claude/command-assets/app-planner/references/project-brief-guide.md` for template and rules
   → Update after each meaningful user response containing business intent, constraints, or design decisions

## Prerequisites

Before questions, check optional context files (never block if absent):
- `.prizm-docs/root.prizm` (architecture/project context)
- `.prizmkit/config.json` (existing stack preferences and detected tech stack)
- `CLAUDE.md` / `CODEBUDDY.md` `### Project Conventions` section (previously answered project conventions)
- `CLAUDE.md` / `CODEBUDDY.md` `### Infrastructure` section (database and deployment config from prizmkit-init or previous app-planner run)

**Tech stack auto-population from config.json:**
- If `.prizmkit/config.json` contains a `tech_stack` object, use it to pre-fill tech assumptions.
- Map config fields: `language`, `runtime`, `frontend_framework`, `frontend_styling`, `backend_framework`, `database`, `orm`, `testing`, `bundler`, `project_type`.
- Do NOT re-ask for tech stack info already in config.json. Show the detected stack and ask: "Is this correct? Any changes?"
- If config.json has no `tech_stack`, fall back to asking during Phase 2.

Note:
- This skill **reads** `.prizmkit/config.json` if present.
- This skill does **not** create `.prizmkit/config.json` directly.
- Creation/update is handled by bootstrap/init flows (e.g., `prizmkit-init`, `dev-pipeline/scripts/init-dev-team.py`).

## Interaction Style (Hard Rule)

**ALL decision points MUST use the `AskUserQuestion` tool** to present interactive, selectable options. Do NOT render options as plain text (e.g., `[A] option [B] option`) — the user must be able to click/select, not type a letter.

This applies to:
- Intent confirmation
- Project conventions
- Tech stack selection
- Architecture decisions
- Session exit gates
- Brownfield prerequisite check
- Any other decision point

**How to use `AskUserQuestion`:**
- Each decision point → one `AskUserQuestion` call with 1-4 questions. Use multiple calls as needed — there is NO limit on total rounds for project-level convention discovery. Keep going until everything is covered.
- Each question has 2-4 selectable options (the tool auto-adds "Other" for custom input)
- Use `multiSelect: true` when the user can pick more than one
- Mark the recommended option first and append "(Recommended)" to its label
- Use the `description` field to explain trade-offs or implications
- **Every non-essential question MUST include a "Skip" option** (e.g., "Skip — decide later"). Users should never be forced to answer something they want to defer. Skipped items are simply not written to conventions — they can be added in a future session.

**What can be skipped vs. what cannot:**
- **Cannot skip**: Intent confirmation (must know the session goal)
- **Everything else can be skipped**: conventions, tech stack choices, architecture decisions, design direction, etc. If the user skips, move on — do not re-ask or block progress.

**When gathering open-ended information** (e.g., "describe your app idea"), use regular text questions — but follow up with `AskUserQuestion`-based clarifications wherever possible.

## Intent Confirmation (Mandatory First Step)

After initial greeting, use `AskUserQuestion` to confirm intent:

**Question**: "What would you like to do?"
- **Produce a project plan (Recommended)** — define vision, tech stack, and constraints → generates project-brief.md for pipeline use
- **Explore ideas first** — brainstorm and refine ideas before committing to a plan
- **Generate project context only** — for an existing project that needs a project brief without full planning

Route by answer:
- **Produce a project plan** → Continue to Core Workflow. Set session goal = `produce`.
- **Explore ideas first** → Enter **Exploration Mode**:
  - Run project conventions check first
  - Load `.claude/command-assets/app-planner/references/brainstorm-guide.md` and follow its structured ideation process (Phases A-D)
  - Brainstorm Phase D output serves as the Vision Summary (CP-AP-2)
  - After brainstorm completes, use `AskUserQuestion`: "Ideas are taking shape. What's next?"
    - **Continue to project planning (Recommended)** — capture tech stack, conventions, and architecture decisions
    - **Continue refining** — keep brainstorming
    - **Save draft & exit** — save progress to .prizmkit/planning/
  - **Checkpoints in explore mode**: CP-AP-0 (required), CP-AP-1 (required), CP-AP-2 (from brainstorm output), CP-AP-3 (only if user proceeds to Phase 2), CP-AP-4 and CP-AP-5 (only if user transitions to produce mode)
- **Generate project context only** → Enter **Quick Context Mode** (brownfield only):
  - Run Project State Detection → if greenfield, redirect to produce mode
  - Proactively scan the project (same as brownfield behavior)
  - Generate project-brief.md from inferred context
  - Skip extensive brainstorming and constraint phases
  - Present brief for user confirmation → write → done

Session goal tracking: Track the intent (`produce`, `explore`, or `quick_context`) throughout the session. If `explore`, always re-prompt before ending.

## Project State Detection (after Intent Confirmation)

Detect whether this is a **greenfield** (new) or **brownfield** (existing) project and adapt the workflow accordingly.

### Detection Signals

| Signal | Greenfield | Brownfield |
|--------|-----------|------------|
| `package.json` / `pyproject.toml` / `go.mod` / `Cargo.toml` / `pom.xml` | absent | present |
| `src/` or `app/` directory with source files | absent | present |
| `.git` with commit history | absent or initial commit only | present with history |
| Empty or near-empty directory | yes | no |

### Greenfield Behavior (default)

Proceed with the standard Core Workflow — ask all questions from scratch.

### Brownfield Behavior

When an existing project is detected:

**Step 1: Prerequisite Check (Mandatory)**

Before ANY planning work, check if AI-essential project context files exist:

| File | Purpose | Status |
|------|---------|--------|
| `.prizm-docs/root.prizm` | Project architecture context for AI | exists / missing |
| `.prizmkit/config.json` | Tech stack + runtime config | exists / missing |
| `.prizmkit/plans/project-brief.md` | Product vision checklist | exists / missing |

**If ANY are missing**, show the status table, then use `AskUserQuestion`:

**Question**: "Some AI context files are missing. These help AI understand your project — making planning much more effective. How would you like to proceed?"
- **Run project init first (Recommended)** — invoke `prizmkit-init` to scan your codebase and generate these files, then return to planning
- **Continue without init** — I'll scan the project manually during this session (less thorough)
- **Skip, I'll set these up later** — proceed with planning using only what's available

- **Run project init first** → Invoke `prizmkit-init`, then resume app-planner from where it left off
- **Continue without init** → Continue with Step 2 below (manual scan)
- **Skip** → Continue with Step 3, skip scanning

**Step 2: Proactive Project Scanning**

Do NOT ask the user to describe their project — read it yourself first:

1. **Scan project structure** to understand the codebase layout:
   ```bash
   find . -maxdepth 2 -type d -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/__pycache__/*' -not -path '*/vendor/*' | sed -e 's;[^/]*/;|____;g;s;____|; |;g'
   ```

2. **Read existing project metadata** to infer tech stack and purpose:
   - `package.json` → name, description, dependencies, scripts
   - `pyproject.toml` / `requirements.txt` → Python dependencies
   - `go.mod` → Go module info
   - `README.md` → project description and goals
   - `.prizmkit/config.json` → previously detected tech stack
   - `.prizm-docs/root.prizm` → existing architecture context

3. **Read key source files** (entry points, main routes, core models) to understand what the project actually does — don't rely solely on metadata.

**Step 3: Present inferred summary with confirmation**

Show the summary as text, then use `AskUserQuestion`:

> Based on my analysis of your codebase:
>
> **Project**: [name] — [inferred description]
> **Tech Stack**: [framework] + [language] + [key dependencies]
> **Key Features Found**: [list 3-5 detected capabilities]
> **Architecture**: [e.g., monolithic, microservices, serverless]

**Question**: "Does this look correct?"
- **Yes, looks correct (Recommended)** — proceed with planning
- **Mostly correct, with changes** — I'll note corrections
- **This is off** — let me describe the project

**Step 4: Pre-fill and focus**

- Phase 2 tech stack selection → largely pre-filled from dependencies
- Vision/problem statement → inferred from README or package description (user confirms)
- Existing features → note them as `[x]` items in project brief

**Focus remaining questions** (as options where possible) on what CANNOT be inferred:
- Target users and core value proposition
- Future direction and planned capabilities
- Non-functional requirements (performance, scale, security)
- Design direction (for frontend projects)

## Core Workflow

Execute the planning workflow in conversation mode with mandatory checkpoints:

### Interactive Phases
1. Clarify business goal and scope
   1.1 Confirm deliverable intent (→ Intent Confirmation — option-based)
   1.2 **Requirement clarification** — for ANY unclear aspect of the user's vision, goals, target users, or scope, use option-based questions where possible. When common patterns exist, present them as choices. Only use open-ended questions for truly unique input (e.g., "describe your app idea"). Follow up with option-based clarifications.
2. Confirm constraints and tech assumptions
   2.1 Tech stack selection — use `.claude/command-assets/app-planner/assets/app-design-guide.md` §2 decision matrix. Use `AskUserQuestion` for each major tech decision (framework, database, styling, etc.)
   2.2 **Frontend design check** (for frontend projects) — scan for existing UI/UX design docs. If none found, use `AskUserQuestion`:
       - Question: "No UI/UX design docs found. Would you like to establish design direction?"
       - Options: "Establish design direction now (Recommended)", "Skip for now", "I have external designs"
3. Capture architecture decisions and finalize project brief
4. Present completion summary with artifacts produced and possible next steps

### Checkpoints (Mandatory Gates)

Checkpoints catch cascading errors early — skipping one means the next phase builds on unvalidated assumptions.

| Checkpoint | Artifact/State | Criteria | Phase |
|-----------|----------------|----------|-------|
| **CP-AP-0** | Intent Confirmed | User confirmed session goal (produce / explore) | 1 |
| **CP-AP-1** | Conventions Checked | Project conventions loaded or asked; `### Project Conventions` section in `CLAUDE.md` / `CODEBUDDY.md` up to date | 1 |
| **CP-AP-1.5** | Infrastructure Checked | Infrastructure config loaded or asked; `### Infrastructure` section in `CLAUDE.md` / `CODEBUDDY.md` addressed — configured or explicitly deferred | 1-2 |
| **CP-AP-2** | Vision Summary | Goal/users/differentiators confirmed by user. For brownfield: existing purpose confirmed or refined. | 1-2 |
| **CP-AP-3** | Frontend Design Evaluated | For frontend projects: checked for existing UI/UX design system; user was asked if missing. **Auto-pass** for backend-only or non-UI projects. | 2 |
| **CP-AP-4** | Project Brief Accumulated | `.prizmkit/plans/project-brief.md` exists at `.prizmkit/plans/` with at least 3 ideas listed. For brownfield: already-implemented items marked `[x]` count toward this total. | 3 |
| **CP-AP-5** | Planning Complete | All project-level context captured: conventions, infrastructure config, tech stack, architecture decisions, project brief finalized | 4 |

## Architecture Decision Capture

After Phase 2, if framework-shaping architecture decisions emerged during planning (tech stack, communication patterns, data model strategies — not individual feature details), read `.claude/command-assets/app-planner/references/architecture-decisions.md` and follow the capture flow. Most sessions will NOT produce architecture decisions — only capture when genuinely impactful.

**How it works**:
1. If decisions are captured → append to `CLAUDE.md` / `CODEBUDDY.md` under `### Architecture Decisions` section
2. Downstream skills (feature-planner, prizmkit-plan, etc.) read `CLAUDE.md` / `CODEBUDDY.md` as standard context, so they automatically receive these decisions
3. Do NOT write directly to `.prizm-docs/root.prizm` — that file is maintained by `prizmkit-prizm-docs` and `prizmkit-retrospective`. If the project needs `.prizm-docs/`, recommend the user run `prizmkit-prizm-docs` init after planning.

## Project Brief Accumulation

During interactive planning, maintain a `.prizmkit/plans/project-brief.md` at `.prizmkit/plans/` as a simple checklist of product ideas.

→ Read `.claude/command-assets/app-planner/references/project-brief-guide.md` for full format and rules.

## Session Exit Gate

Prevent accidental session exit without completing the planning artifacts.

### Trigger Conditions

Activate when ALL true:
- Session goal = `produce`
- `.prizmkit/plans/project-brief.md` has not been written or is incomplete (fewer than 3 ideas listed)

### Gate Behavior

When the session appears to be ending:
1. **Remind**: "You set out to produce a project plan but `.prizmkit/plans/project-brief.md` isn't complete yet."
2. Use `AskUserQuestion`: "How would you like to proceed?"
   - **Continue to completion (Recommended)** — finish the project brief
   - **Save draft & exit** — write current progress as draft to `.prizmkit/planning/`
   - **Abandon** — exit without saving

## Completion Summary

After all checkpoints pass, present a summary and end the session:

1. **Summary** (as text): List all project-level artifacts produced:
   - Project conventions → `CLAUDE.md` / `CODEBUDDY.md` `### Project Conventions`
   - Infrastructure config → `CLAUDE.md` / `CODEBUDDY.md` `### Infrastructure` (database conventions + deployment config)
   - Tech stack → `.prizmkit/config.json`
   - Architecture decisions (if any) → `CLAUDE.md` / `CODEBUDDY.md` `### Architecture Decisions`
   - Project brief → `.prizmkit/plans/project-brief.md`

2. **Suggest possible next steps** (as text, NOT auto-invoked):
   > Project-level planning is complete. When you're ready, here are some possible next steps:
   > - `feature-planner` — decompose the project into features and generate `feature-list.json`
   > - `prizmkit-plan` — start working on a specific feature directly
   > - `prizmkit-prizm-docs` — initialize or update project documentation
   > - `prizmkit-deploy` — supplement infrastructure config or execute deployment (if AI-assisted deploy was configured)

   **Do NOT invoke any of these.** The user decides what to do next, in their own time.

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

