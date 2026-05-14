# Plan — F-002: Admin Authentication

## Key Components

1. **NextAuth.js v4** — Credentials provider for email/password auth, JWT session strategy
2. **Auth API Route** — `src/app/api/auth/[...nextauth]/route.ts` with NextAuth handlers
3. **Admin Login Page** — `src/app/admin/login/page.tsx` with form, error display, mobile-responsive
4. **Auth Middleware** — `middleware.ts` protecting `/admin/*` except `/admin/login`
5. **Admin Layout** — `src/app/admin/layout.tsx` with sidebar nav + header with logout

## Data Flow

1. User submits credentials at `/admin/login` → NextAuth Credentials provider
2. Provider queries `AdminUser` by email → bcrypt.compare() on passwordHash
3. On success: JWT session created, redirect to `/admin/dashboard`
4. On failure: error message displayed
5. Middleware checks JWT on every `/admin/*` request → redirect to login if missing
6. Admin layout reads session → displays user name + logout button

## Dependencies to Install

- `next-auth@^4.24.14` (stable v4 with Credentials provider)
- `@auth/prisma-adapter@^2.11.2` (Prisma adapter for session storage — optional, using JWT strategy)

Note: Using JWT session strategy (no DB sessions needed), so @auth/prisma-adapter is not required. bcrypt is already installed.

## Files to Create

1. `src/lib/auth.ts` — NextAuth config with Credentials provider
2. `src/app/api/auth/[...nextauth]/route.ts` — NextAuth API route handler
3. `src/app/admin/login/page.tsx` — Login page with form
4. `src/app/admin/layout.tsx` — Admin layout with sidebar + header
5. `src/app/admin/dashboard/page.tsx` — Dashboard placeholder page
6. `middleware.ts` — Route protection middleware

## Files to Modify

- `package.json` — add next-auth dependency
- `src/app/globals.css` — potentially add admin-specific styles (if needed)

## Tasks

- [x] 1. Install next-auth dependency and verify package.json
- [x] 2. Create NextAuth config (src/lib/auth.ts) with Credentials provider + bcrypt verification
- [x] 3. Create NextAuth API route (src/app/api/auth/[...nextauth]/route.ts)
- [x] 4. Create admin login page (src/app/admin/login/page.tsx) with form, error handling, mobile-responsive
- [x] 5. Create admin dashboard placeholder (src/app/admin/dashboard/page.tsx)
- [x] 6. Create admin layout (src/app/admin/layout.tsx) with sidebar nav + header with logout
- [x] 7. Create middleware.ts for route protection (/admin/* except /admin/login)
- [x] 8. Add SessionProvider wrapper (src/app/providers.tsx) in root layout
- [ ] 9. Verify build compiles and all acceptance criteria
