# Context Snapshot — F-002: Admin Authentication

## Section 1 — Feature Brief

### Description
Implement admin-only authentication for the blog using NextAuth.js v4 with Credentials provider for email/password login. Build API routes, login page, middleware for route protection, and admin layout with sidebar navigation.

### Acceptance Criteria
- AC1: Given an admin user exists, When they submit valid credentials on /admin/login, Then they are redirected to /admin/dashboard and a session is created
- AC2: Given an admin user, When they submit an incorrect password, Then an error message 'Invalid credentials' is displayed and no session is created
- AC3: Given an unauthenticated user, When they navigate to /admin/posts, Then they are redirected to /admin/login
- AC4: Given an authenticated admin, When they click 'Logout', Then their session is destroyed and they are redirected to /admin/login
- AC5: Given an authenticated admin, When they view the admin layout, Then a sidebar with navigation links (Dashboard, Posts, Categories, Comments) is visible
- AC6: Given the admin login page, When viewed on mobile, Then the form is centered and usable on small screens

## Section 2 — Project Structure

```
.
├── .prizm-docs/
├── .prizmkit/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── prisma.config.ts
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── login/page.tsx
│   │   ├── api/
│   │   │   └── auth/[...nextauth]/route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── lib/
│   │   ├── auth.ts
│   │   └── prisma.ts
│   └── components/
├── middleware.ts
├── package.json
└── tsconfig.json
```

## Section 3 — Prizm Context

### root.prizm
- PROJECT: KitTest | LANG: TypeScript | TYPE: fullstack
- TECH_STACK: TypeScript, Next.js 16, Tailwind CSS v4, ESLint
- MODULES: app (routing), components (ui), lib (utils/prisma), prisma (database)

### prisma.prizm
- FILES: schema.prisma, seed.ts, prisma.config.ts
- MODELS: AdminUser, Post, Category, Tag, PostTag, Comment
- AdminUser fields: id, email, passwordHash, name, createdAt

## Section 4 — Existing Source Files

### src/lib/auth.ts (65 lines)
NextAuth config with Credentials provider. Queries AdminUser by email, bcrypt.compare on passwordHash. JWT session strategy. Custom signIn page at /admin/login.

### src/app/api/auth/[...nextauth]/route.ts (6 lines)
NextAuth API route handler — exports GET and POST from NextAuth(authOptions).

### src/app/admin/login/page.tsx (91 lines)
Client component with email/password form. Uses signIn("credentials") with redirect:false. Shows "Invalid credentials" error on failure. Redirects to /admin/dashboard on success. Mobile-responsive with min-h-screen flex centering, max-w-sm, px-4.

### src/app/admin/layout.tsx (76 lines)
Client component. Sidebar (w-64) with nav links: Dashboard, Posts, Categories, Comments, Settings. Header with admin name + Logout button (signOut to /admin/login). Tailwind dark mode support.

### src/app/admin/dashboard/page.tsx (12 lines)
Simple placeholder page with "Dashboard" heading and welcome text.

### middleware.ts (22 lines)
Uses withAuth from next-auth/middleware. Allows /admin/login without auth. All other /admin/* routes require valid token.

### src/lib/prisma.ts (14 lines)
Prisma client singleton with MariaDB adapter.

### src/app/layout.tsx (33 lines)
Root layout with Geist fonts. No SessionProvider wrapping — needs checking.

## Section 5 — Existing Tests
No project-level tests found. Test framework (Jest + RTL) is declared in project conventions but not yet configured.

## Section 6 — Dependencies
- next-auth@^4.24.14 — already in package.json
- bcrypt@^6.0.0 — already installed
- @prisma/client@^7.8.0 — already installed

## Implementation Log
(Populated after implementation)
