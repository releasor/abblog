# Context Snapshot — F-001: Infrastructure & Database Setup

## Section 1 — Feature Brief

Set up foundational infrastructure for the blog application:
- Install and configure Prisma ORM with MySQL driver
- Create database schema with models: AdminUser, Post, Category, Tag, PostTag, Comment
- Add seed script for default admin user and sample categories
- Configure .env for DATABASE_URL

### Acceptance Criteria

- [ ] npx prisma migrate dev creates all tables with correct columns and foreign keys
- [ ] Seed script creates admin user with email admin@blog.com and bcrypt-hashed password
- [ ] Seed script creates at least 3 default categories (Technology, Programming, Life)
- [ ] Prisma Client connects to MySQL without errors
- [ ] Post model with PUBLISHED status auto-sets publishedAt

## Section 2 — Project Structure

```
.
├── .prizm-docs/
├── public/
├── src/
│   ├── app/
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── .gitkeep
│   └── lib/
│       └── .gitkeep
├── package.json
├── tsconfig.json
├── next.config.ts
├── .env.example
└── .gitignore
```

## Section 3 — Prizm Context

### root.prizm
```
PRIZM_VERSION: 1.0
PROJECT: KitTest
LANG: TypeScript
PROJECT_TYPE: fullstack
TECH_STACK: TypeScript, Next.js 16, Tailwind CSS v4, ESLint (personal blog, user-provided)
MODULE_INDEX:
- app [routing, pages, layout]: src/app/ — Next.js App Router pages and layouts
- components [ui, react]: src/components/ — reusable UI components (empty, ready for use)
- lib [utils, helpers]: src/lib/ — utility functions and shared logic (empty, ready for use)
RULES:
- TypeScript fullstack project with Next.js (App Router)
- Tailwind CSS v4 (CSS-based config, no tailwind.config.ts)
- Personal blog for developers
- Use PrizmKit progressive loading protocol
PROJECT_BRIEF: .prizmkit/plans/project-brief.md
```

## Section 4 — Existing Source Files

### src/app/layout.tsx
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KitTest",
  description: "A personal blog for developers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

### src/app/page.tsx
```tsx
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        KitTest
      </h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        A personal blog for developers
      </p>
    </main>
  );
}
```

### package.json
```json
{
  "name": "kittest",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.6",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"],
  "exclude": ["node_modules"]
}
```

### next.config.ts
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = { };
export default nextConfig;
```

## Section 5 — Existing Tests

No test files exist yet. Testing strategy: Jest + React Testing Library.

## Section 6 — Implementation Plan

### Dependencies to Install
- `prisma` (devDep): 7.8.0
- `@prisma/client`: 7.8.0
- `bcrypt`: 6.0.0
- `@types/bcrypt` (devDep): 6.0.0

### Files to Create/Modify
1. `prisma/schema.prisma` — Database schema with all models
2. `src/lib/prisma.ts` — Prisma client singleton
3. `prisma/seed.ts` — Seed script
4. `.env` — DATABASE_URL configuration
5. `package.json` — Add dependencies and prisma seed config

### Schema Design
- AdminUser: id, email (unique), passwordHash, name, createdAt
- Post: id, title, slug (unique), content, excerpt, coverImageUrl?, status (DRAFT/PUBLISHED), publishedAt?, authorId (FK), createdAt, updatedAt
- Category: id, name (unique), slug (unique), description?
- Tag: id, name (unique), slug (unique)
- PostTag: postId, tagId (composite PK)
- Comment: id, postId (FK), authorName, authorEmail, content, status (PENDING/APPROVED/REJECTED), createdAt
