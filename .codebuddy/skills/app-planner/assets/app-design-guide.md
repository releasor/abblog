# App Design Reference Guide

This guide provides structured templates, decision matrices, and decomposition patterns for new application planning. Use during the vision and architecture phases of app-planner sessions.

---

## 1. App Vision Template

Use this template to capture the app vision during the initial planning phase.

```markdown
# App Vision: [APP_NAME]

## Problem Statement
[What problem does this app solve?]

## Target Users
- Primary: [Who are the main users?]
- Secondary: [Any secondary user types?]

## Core Value Proposition
[What makes this app valuable? What's the "elevator pitch"?]

## Key Differentiators
[What sets this apart from existing solutions?]
```

### Guidance

- **Problem Statement**: Should describe a real pain point in 1-3 sentences. Avoid vague statements like "improve productivity." Be specific about who suffers and why.
- **Target Users**: Identify at least one primary user persona. Secondary users are optional but useful for prioritization decisions later.
- **Core Value Proposition**: Should be expressible in one sentence. If it takes a paragraph, the scope is likely too broad.
- **Key Differentiators**: List 1-3 concrete differentiators. If none exist, reconsider whether the app needs to be built.

---

## 2. Tech Stack Decision Matrix

Use these tables to guide tech stack selection based on project requirements.

### Frontend Frameworks

| Framework | Best For | Ecosystem |
|-----------|----------|-----------|
| Next.js | Full-stack React, SSR, API routes | React ecosystem, Vercel |
| Nuxt 3 | Full-stack Vue, SSR | Vue ecosystem |
| SvelteKit | Performance-focused, smaller teams | Svelte ecosystem |
| Remix | Nested routes, data loading | React ecosystem |

### Backend Frameworks

| Framework | Best For | Language |
|-----------|----------|----------|
| Express.js | Flexible, minimal | Node.js/TS |
| FastAPI | High-perf APIs, Python ML | Python |
| NestJS | Enterprise, structured | Node.js/TS |
| Django | Batteries-included, admin | Python |
| Go (Gin/Echo) | High concurrency | Go |

### Databases

| Database | Best For | Type |
|----------|----------|------|
| PostgreSQL | Complex queries, ACID | Relational |
| MySQL | Read-heavy, simple | Relational |
| MongoDB | Flexible schema, documents | Document |
| SQLite | Embedded, prototyping | Relational |
| Redis | Caching, sessions, pub/sub | Key-Value |

### Design Systems

| System | Best For | Framework |
|--------|----------|-----------|
| shadcn/ui | Modern, customizable | React/Next.js |
| Ant Design | Enterprise, data-heavy | React |
| Material UI | Google-style, full-featured | React |
| Vuetify | Material Design for Vue | Vue |
| Tailwind CSS | Utility-first, any framework | Any |

### Common Service Patterns

| Need | Options |
|------|---------|
| Auth | NextAuth.js, Auth0, Clerk, Supabase Auth, custom JWT |
| Real-time | WebSocket, Socket.io, SSE, Supabase Realtime |
| File Storage | S3, Cloudflare R2, Supabase Storage |
| Email | SendGrid, Resend, Postmark |
| Payments | Stripe, LemonSqueezy |
| Search | Algolia, Meilisearch, Elasticsearch |

### Selection Heuristics

- If the user has no strong preference, default to **Next.js + PostgreSQL + shadcn/ui + Tailwind CSS** as a general-purpose stack.
- If the project involves ML/AI backends, prefer **FastAPI** on the backend.
- If the project requires high concurrency with minimal resource usage, consider **Go**.
- If rapid prototyping is the goal, consider **SQLite** initially with a migration path to PostgreSQL.
- Always ask about deployment preferences (Vercel, AWS, self-hosted) as this influences framework choice.



> **Note**: Feature decomposition patterns (CRUD, SaaS, Social, E-commerce) have been moved to `feature-planner/references/decomposition-patterns.md`. Load that reference during feature decomposition phase.

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

