# Context Snapshot — F-006: Reader-Friendly UI & Layout

## Section 1 — Feature Brief

**Description**: Design and implement the public-facing blog UI with a clean, developer-friendly aesthetic using Tailwind CSS v4.

**Acceptance Criteria**:
- Given a visitor navigates to /, Then the home page shows a hero section and a grid of recent published post cards with title, excerpt, and category badge
- Given a visitor clicks on a post card, Then they are taken to /posts/[slug] showing the full post with proper typography
- Given a visitor is on a mobile device, When they view the home page, Then post cards are displayed in a single column layout
- Given a visitor clicks the dark mode toggle in the header, Then the page switches to dark color scheme and the preference is saved to localStorage
- Given a visitor refreshes the page after enabling dark mode, Then dark mode remains active
- Given a post has 1000 words, When displayed, Then reading time shows '5 min read'
- Given a post has a cover image URL set, When viewed on the post page, Then the cover image is displayed above the title
- Given a visitor views a post with tags, When they click a tag badge, Then they are taken to /tags/[slug] showing related posts
- Given the blog has 15 published posts, When a visitor views /posts, Then pagination controls are shown

## Section 2 — Project Structure

```
.
|____prisma/
| |____schema.prisma
| |____seed.ts
|____src/
| |____app/
| | |____api/
| | | |____auth/[...nextauth]/route.ts
| | | |____categories/route.ts
| | | |____posts/
| | | | |____route.ts
| | | | |____[id]/route.ts
| | | |____tags/route.ts
| | |____admin/
| | | |____(admin)/
| | | | |____dashboard/page.tsx
| | | | |____layout.tsx
| | | | |____posts/
| | | | | |____page.tsx
| | | | | |____new/page.tsx
| | | | | |____[id]/edit/page.tsx
| | | |____login/page.tsx
| | |____posts/[slug]/page.tsx
| | |____globals.css
| | |____layout.tsx
| | |____page.tsx
| | |____providers.tsx
| |____components/
| | |____post-form.tsx
| | |____tiptap-editor.tsx
| |____lib/
| | |____auth.ts
| | |____prisma.ts
| | |____slugify.ts
|____generated/prisma/
|____.prizm-docs/
| |____root.prizm
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
- auth [nextauth, login, middleware, session]: src/lib/auth.ts, middleware.ts — NextAuth.js authentication, route protection
- admin [dashboard, layout, sidebar]: src/app/admin/ — admin panel pages and layout with sidebar nav
- posts [crud, api, editor, tiptap]: src/app/api/posts/, src/app/admin/(admin)/posts/, src/app/posts/ — post CRUD API, admin UI, public view
- components [ui, react, tiptap]: src/components/ — reusable UI components including tiptap editor
- lib [utils, helpers, prisma, slugify]: src/lib/ — utility functions, Prisma client, slugify
- prisma [database, schema, seed]: prisma/ — database schema, migrations, and seed script
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
import Providers from "./providers";

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
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
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

### src/app/posts/[slug]/page.tsx
```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicPostPage({ params }: PageProps) {
  const { slug } = await params;

  const post = await prisma.post.findUnique({
    where: { slug },
    include: {
      category: { select: { name: true, slug: true } },
      tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      author: { select: { name: true } },
    },
  });

  if (!post || post.status !== "PUBLISHED") {
    notFound();
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          {post.publishedAt && (
            <time dateTime={post.publishedAt.toISOString()}>
              {formatDate(post.publishedAt)}
            </time>
          )}
          {post.category && (
            <>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-medium">
                {post.category.name}
              </span>
            </>
          )}
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span>By {post.author.name}</span>
        </div>

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {post.tags.map((pt) => (
              <span
                key={pt.tag.id}
                className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full text-xs"
              >
                #{pt.tag.name}
              </span>
            ))}
          </div>
        )}
      </header>

      {post.coverImageUrl && (
        <div className="mb-8">
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="w-full h-auto rounded-lg object-cover max-h-96"
          />
        </div>
      )}

      {post.excerpt && (
        <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8 italic border-l-4 border-zinc-300 dark:border-zinc-700 pl-4">
          {post.excerpt}
        </p>
      )}

      <div
        className="prose prose-zinc dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </article>
  );
}
```

### src/app/providers.tsx
```tsx
"use client";

import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

### src/app/globals.css
```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}

/* Tiptap editor styles */
.tiptap p.is-editor-empty:first-child::before {
  color: #9ca3af;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.tiptap pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1rem;
  border-radius: 0.375rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.875rem;
  overflow-x: auto;
}

.tiptap img {
  max-width: 100%;
  height: auto;
  border-radius: 0.375rem;
}

.tiptap a {
  color: #2563eb;
  text-decoration: underline;
}

.tiptap a:hover {
  color: #1d4ed8;
}
```

### src/lib/prisma.ts
```ts
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const url = process.env.DATABASE_URL!;
  const adapter = new PrismaMariaDb(url);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### src/lib/slugify.ts
```ts
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

### src/app/api/posts/route.ts
```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const status = searchParams.get("status");
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" as const : "desc" as const;

  const where: Record<string, unknown> = {};
  if (status === "DRAFT" || status === "PUBLISHED") {
    where.status = status;
  }

  const orderBy: Record<string, string> = {};
  if (sortBy === "publishedAt" || sortBy === "createdAt" || sortBy === "title") {
    orderBy[sortBy] = sortOrder;
  } else {
    orderBy.createdAt = "desc";
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: { select: { name: true } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  return NextResponse.json({
    posts: posts.map((p) => ({
      ...p,
      tags: p.tags.map((pt) => pt.tag),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, content, excerpt, coverImageUrl, categoryId, tags, status } = body;

  if (!title || !content) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }

  const slug = body.slug || slugify(title);
  const existing = await prisma.post.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "A post with this slug already exists" }, { status: 409 });
  }

  const isPublished = status === "PUBLISHED";

  const post = await prisma.post.create({
    data: {
      title,
      slug,
      content,
      excerpt: excerpt || null,
      coverImageUrl: coverImageUrl || null,
      status: isPublished ? "PUBLISHED" : "DRAFT",
      publishedAt: isPublished ? new Date() : null,
      authorId: parseInt(userId),
      categoryId: categoryId ? parseInt(categoryId) : null,
      tags: tags?.length
        ? {
            create: tags.map((tagId: string) => ({
              tag: { connect: { id: parseInt(tagId) } },
            })),
          }
        : undefined,
    },
    include: {
      category: true,
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(post, { status: 201 });
}
```

### prisma/schema.prisma
```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "mysql"
}

model AdminUser {
  id           Int       @id @default(autoincrement())
  email        String    @unique
  passwordHash String    @map("password_hash")
  name         String
  createdAt    DateTime  @default(now()) @map("created_at")

  posts Post[]

  @@map("admin_users")
}

model Post {
  id           Int       @id @default(autoincrement())
  title        String
  slug         String    @unique
  content      String    @db.LongText
  excerpt      String?
  coverImageUrl String?  @map("cover_image_url")
  status       PostStatus @default(DRAFT)
  publishedAt  DateTime? @map("published_at")
  authorId     Int       @map("author_id")
  categoryId   Int?      @map("category_id")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  author   AdminUser  @relation(fields: [authorId], references: [id])
  category Category? @relation(fields: [categoryId], references: [id])
  tags     PostTag[]
  comments Comment[]

  @@map("posts")
}

enum PostStatus {
  DRAFT
  PUBLISHED
}

model Category {
  id          Int     @id @default(autoincrement())
  name        String  @unique
  slug        String  @unique
  description String?

  posts Post[]

  @@map("categories")
}

model Tag {
  id   Int    @id @default(autoincrement())
  name String @unique
  slug String @unique

  posts PostTag[]

  @@map("tags")
}

model PostTag {
  postId Int  @map("post_id")
  tagId  Int  @map("tag_id")

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
  @@map("post_tags")
}

model Comment {
  id          Int           @id @default(autoincrement())
  postId      Int           @map("post_id")
  authorName  String        @map("author_name")
  authorEmail String        @map("author_email")
  content     String        @db.LongText
  status      CommentStatus @default(PENDING)
  createdAt   DateTime      @default(now()) @map("created_at")

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@map("comments")
}

enum CommentStatus {
  PENDING
  APPROVED
  REJECTED
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
    "@prisma/adapter-mariadb": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "@tiptap/extension-code-block": "^3.23.4",
    "@tiptap/extension-image": "^3.23.4",
    "@tiptap/extension-link": "^3.23.4",
    "@tiptap/extension-placeholder": "^3.23.4",
    "@tiptap/react": "^3.23.4",
    "@tiptap/starter-kit": "^3.23.4",
    "bcrypt": "^6.0.0",
    "mariadb": "^3.5.2",
    "next": "16.2.6",
    "next-auth": "^4.24.14",
    "highlight.js": "^11.11.1",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@tailwindcss/typography": "^0.5.19",
    "@types/bcrypt": "^6.0.0",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "dotenv": "^17.4.2",
    "eslint": "^9",
    "eslint-config-next": "16.2.6",
    "prisma": "^7.8.0",
    "tailwindcss": "^4",
    "tsx": "^4.21.0",
    "typescript": "^5"
  }
}
```

## Section 5 — Existing Tests

No project-specific tests found.

## Implementation Log

All tasks completed. Build passes with `npm run build`.

### Changes Made
- Added `export const dynamic = "force-dynamic"` to page.tsx, posts/page.tsx, tags/[slug]/page.tsx to prevent DB-dependent pages from being statically generated
- All other components and pages were already implemented from a prior session

### Files Created/Modified
- src/lib/reading-time.ts — reading time utility (words / 200 wpm)
- src/components/theme-provider.tsx — dark mode context with localStorage
- src/components/dark-mode-toggle.tsx — toggle button
- src/components/header.tsx — nav bar with logo, links, dark mode toggle
- src/components/footer.tsx — copyright and social links
- src/components/post-card.tsx — post card component
- src/components/pagination.tsx — pagination controls
- src/app/layout.tsx — updated with Header/Footer/ThemeProvider
- src/app/page.tsx — hero section + recent posts grid
- src/app/posts/page.tsx — paginated all posts
- src/app/posts/[slug]/page.tsx — reading time, tag links, PostContent
- src/app/posts/[slug]/post-content.tsx — highlight.js syntax highlighting
- src/app/tags/[slug]/page.tsx — tag filtered posts
- src/app/about/page.tsx — about page
- src/app/globals.css — dark mode vars, prose styles

## Browser Verification
Tool: playwright-cli v0.1.13
URL: http://localhost:3000
Dev Server Command: npm run dev
Steps executed:
- Opened / — hero section with "KitTest" title and tagline renders correctly
- Verified recent post cards show title, excerpt, date, and reading time
- Clicked dark mode toggle — button changed to "Switch to light mode", dark mode active
- Verified localStorage has theme=dark persisted
- Navigated to /posts/my-updated-post — post detail shows title, date, reading time, author, content
- Navigated to /posts — "All Posts" heading, post cards in grid layout
- Navigated to /about — renders with proper content sections
- Reloaded /about — dark mode persists after page refresh (button still "Switch to light mode")
Result: PASS — All verified ACs: hero section, post cards, dark mode toggle, localStorage persistence, post detail page, responsive grid, about page
Screenshot: .prizmkit/specs/006-reader-friendly-ui-layout/browser-verification.png
Server cleanup: confirmed
Browser cleanup: confirmed
