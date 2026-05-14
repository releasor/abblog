# Project Scaffolding

## Overview
Initialize the KitTest personal blog project with Next.js, TypeScript, Tailwind CSS, and ESLint. Establish a clean folder structure and baseline configuration so subsequent features can be built immediately.

## Goals

### G-1: Initialize Next.js Project
Set up a Next.js project with TypeScript and App Router as the foundation for the blog.

**Acceptance Criteria:**
- [ ] `npm run dev` starts the dev server without errors
- [ ] `npm run build` completes successfully
- [ ] TypeScript compilation has zero errors
- [ ] App Router is configured (not Pages Router)

### G-2: Configure Styling
Integrate Tailwind CSS for utility-first styling.

**Acceptance Criteria:**
- [ ] Tailwind CSS is installed and configured
- [ ] A sample page renders with Tailwind utility classes
- [ ] `tailwind.config.ts` is present and points to the correct content paths

### G-3: Set Up Code Quality
Configure ESLint with Next.js recommended rules.

**Acceptance Criteria:**
- [ ] ESLint runs without errors on the initial codebase
- [ ] `.eslintrc.json` (or equivalent) includes `next/core-web-vitals`

### G-4: Establish Project Structure
Create a clean, conventional folder layout for a Next.js blog.

**Acceptance Criteria:**
- [ ] `src/` directory contains `app/`, `components/`, and `lib/` subdirectories
- [ ] A root layout (`src/app/layout.tsx`) exists with proper HTML structure
- [ ] A home page (`src/app/page.tsx`) renders a welcome message
- [ ] `public/` directory exists for static assets

## Scope

### In Scope
- Next.js + TypeScript initialization via `create-next-app`
- Tailwind CSS setup
- ESLint configuration
- Folder structure: `src/app/`, `src/components/`, `src/lib/`, `public/`
- Root layout with basic HTML boilerplate
- Home page with placeholder content

### Out of Scope
- Blog post CRUD functionality
- Database integration
- Authentication
- CI/CD pipeline setup
- Deployment configuration
- Testing framework setup (deferred to when tests are needed)
- Prettier configuration

## Dependencies
- Node.js 18+ runtime
- npm (or pnpm/yarn) package manager

## Constraints
- Use App Router (not Pages Router)
- Use `src/` directory convention
- TypeScript strict mode enabled

## Clarifications
None — all decisions resolved.

## Review Checklist
- [x] All goals have acceptance criteria
- [x] Scope boundaries are clearly defined
- [x] Dependencies are identified
- [x] No implementation details (WHAT not HOW)
