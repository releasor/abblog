# Plan — F-001: Infrastructure & Database Setup

## Key Components
1. Prisma ORM setup with MySQL
2. Database schema (6 models)
3. Prisma client singleton
4. Seed script with admin user and categories
5. Environment configuration

## Data Flow
- App → prisma client singleton → MySQL via Prisma ORM
- Seed script → prisma client → populate default data

## Files to Create/Modify
| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Create | Database schema with all models |
| `src/lib/prisma.ts` | Create | Prisma client singleton for Next.js |
| `prisma/seed.ts` | Create | Seed script: admin user + categories |
| `.env` | Create | DATABASE_URL for MySQL |
| `package.json` | Modify | Add prisma deps, bcrypt, seed config |

## Tasks

- [x] 1. Install dependencies: `@prisma/client`, `bcrypt`, `prisma`, `@types/bcrypt`, `@prisma/adapter-mariadb`, `mariadb`, `tsx`, `dotenv`
- [x] 2. Create `prisma/schema.prisma` with all models (AdminUser, Post, Category, Tag, PostTag, Comment) using MySQL provider
- [x] 3. Create `.env` with `DATABASE_URL="mysql://root:password@localhost:3306/kitblog"`
- [x] 4. Create `src/lib/prisma.ts` — Prisma client singleton with MariaDB adapter for Next.js
- [x] 5. Create `prisma/seed.ts` — seed admin user (admin@blog.com, bcrypt-hashed password) and 3 categories (Technology, Programming, Life)
- [x] 6. Add `prisma.seed` config to `package.json` pointing to `npx tsx prisma/seed.ts`
- [x] 7. Run `npx prisma generate` to generate Prisma client
- [x] 8. Verify schema compiles and seed script has no TypeScript errors
- [x] 9. Create `prisma.config.ts` (Prisma 7 requirement) with datasource URL from .env
