# Plan: Project Scaffolding

## Change Approach
Greenfield initialization — use `create-next-app` with TypeScript, Tailwind CSS, and App Router presets. Then organize the generated structure into the target layout.

## Component Design

### New Components
- `src/app/layout.tsx`: Root layout with HTML shell, font setup, global styles
- `src/app/page.tsx`: Home page with welcome content
- `src/app/globals.css`: Tailwind directives and base styles
- `tailwind.config.ts`: Tailwind configuration with content paths
- `tsconfig.json`: TypeScript config with strict mode and path aliases
- `.eslintrc.json`: ESLint with next/core-web-vitals

### Modified Components
None — greenfield.

## Data Model
Not applicable — no data persistence in this task.

## Interface Design
Not applicable — no API endpoints in this task.

## Testing Strategy
- Unit: Not applicable (scaffolding only)
- Integration: Verify `npm run build` succeeds
- E2E: Verify dev server starts and home page renders

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| create-next-app version changes folder structure | L | Inspect generated output, adjust if needed |
| Tailwind config path mismatch | L | Verify content paths in tailwind.config.ts |

## Pre-Implementation Gates
- [x] Spec coverage: all 4 goals mapped to tasks
- [x] No data model involved
- [x] No `[NEEDS CLARIFICATION]` items
- [x] No existing behavior to preserve

## Tasks

### Strategy: MVP-first

### Phase: Setup
- [x] [T-001] Run `create-next-app` with TypeScript, Tailwind CSS, App Router, src/ dir — file: package.json
- [x] [T-002] Verify generated project builds and runs — file: (verification)

### Phase: Foundation
- [x] [T-010] Review and clean up generated folder structure (ensure src/app/, src/components/, src/lib/, public/ exist) — file: src/
- [x] [T-011] Configure TypeScript strict mode in tsconfig.json — file: tsconfig.json
- [x] [T-012] Verify ESLint config includes next/core-web-vitals — file: .eslintrc.json
- [x] [T-013] Verify tailwind.config.ts content paths cover src/ — file: tailwind.config.ts (Tailwind v4 uses CSS-based config, no file needed)

### Phase: Core
- [x] [T-100] [G-4] Create src/components/ and src/lib/ directories with .gitkeep — file: src/components/.gitkeep, src/lib/.gitkeep
- [x] [T-101] [G-1] [G-4] Update root layout (src/app/layout.tsx) with clean HTML structure — file: src/app/layout.tsx
- [x] [T-102] [G-1] [G-2] Update home page (src/app/page.tsx) with welcome message using Tailwind classes — file: src/app/page.tsx

### Phase: Polish
- [x] [T-900] Run `npm run build` — verify zero errors
- [x] [T-901] Run `npm run lint` — verify zero warnings
- [x] [T-902] Run `npm run dev` — verify home page renders in browser

### Checkpoints
- [x] [CP-1] After Setup: `npm run dev` starts, home page loads
- [x] [CP-2] After Foundation: TypeScript strict mode active, ESLint passes, Tailwind works
- [x] [CP-3] After Core: clean folder structure, layout and page render correctly
