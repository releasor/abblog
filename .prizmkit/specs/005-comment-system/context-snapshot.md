# Context Snapshot — F-005 Comment System

## Section 1 — Feature Brief

### Feature Description
Implement a reader comment system on blog posts. On the public post page (/posts/[slug]), add a comment section below the post content with: a list of approved comments showing author name, content, and timestamp, and a comment submission form with fields for name (required, 1-50 chars), email (required, not displayed publicly), and comment content (required, 1-1000 chars).

Create API routes: GET /api/posts/[postId]/comments (list approved comments), POST /api/posts/[postId]/comments (submit a comment with PENDING status).

Create admin comment management page at /admin/comments showing all comments with status tabs (All, Pending, Approved, Rejected). Each comment row shows: post title, author name, content preview, status, and action buttons (Approve, Reject, Delete).

Create API routes: GET /api/comments (list all with filtering by status), PATCH /api/comments/[id] (update status), DELETE /api/comments/[id].

Implement basic spam prevention: rate limit comment submissions to 1 per minute per IP address using a simple in-memory store or middleware.

Add a comment count badge on the admin post list showing pending comment count per post.

### Acceptance Criteria
- Given a published post exists, When a visitor fills out the comment form with valid data and submits, Then a success message 'Comment submitted for review' is shown and the comment appears as PENDING in admin
- Given a pending comment exists, When an admin clicks 'Approve' in /admin/comments, Then the comment status changes to APPROVED and it becomes visible on the public post page
- Given an approved comment exists, When a visitor views the post, Then the comment is displayed with author name, content, and relative timestamp
- Given an admin, When they click 'Reject' on a comment, Then the comment status changes to REJECTED and it is not visible on the public page
- Given a visitor submits a comment, When they try to submit another comment within 1 minute, Then an error message 'Please wait before submitting another comment' is shown
- Given the comment form, When submitted with an empty name field, Then a validation error 'Name is required' is shown
- Given the admin post list, When a post has 2 pending comments, Then a badge showing '2 pending' is displayed next to the post title

## Section 2 — Project Structure

```
src/
  app/
    admin/(admin)/
      categories/page.tsx
      dashboard/page.tsx
      layout.tsx
      posts/page.tsx, new/page.tsx, [id]/edit/page.tsx
      tags/page.tsx
    admin/login/page.tsx
    api/auth/[...nextauth]/route.ts
    api/categories/route.ts, [id]/route.ts
    api/posts/route.ts, [id]/route.ts
    api/tags/route.ts, [id]/route.ts
    about/page.tsx
    categories/page.tsx, [slug]/page.tsx
    layout.tsx
    page.tsx
    posts/page.tsx, [slug]/page.tsx, [slug]/post-content.tsx
    providers.tsx
    tags/[slug]/page.tsx
  components/
    dark-mode-toggle.tsx
    footer.tsx
    header.tsx
    pagination.tsx
    post-card.tsx
    post-form.tsx
    tiptap-editor.tsx
    theme-provider.tsx
  lib/
    auth.ts
    prisma.ts
    reading-time.ts
    slugify.ts
  middleware.ts
prisma/
  schema.prisma
  seed.ts
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
- components [ui, react, tiptap, header, footer, dark-mode]: src/components/ — reusable UI components including layout, theme, and editor
- lib [utils, helpers, prisma, slugify, reading-time]: src/lib/ — utility functions, Prisma client, slugify, reading time
- prisma [database, schema, seed]: prisma/ — database schema, migrations, and seed script
RULES:
- TypeScript fullstack project with Next.js (App Router)
- Tailwind CSS v4 (CSS-based config, no tailwind.config.ts)
- Personal blog for developers
- Use PrizmKit progressive loading protocol
```

## Section 4 — Existing Source Files

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

enum PostStatus { DRAFT PUBLISHED }

model Category {
  id Int @id @default(autoincrement())
  name String @unique
  slug String @unique
  description String?
  posts Post[]
  @@map("categories")
}

model Tag {
  id Int @id @default(autoincrement())
  name String @unique
  slug String @unique
  posts PostTag[]
  @@map("tags")
}

model PostTag {
  postId Int @map("post_id")
  tagId Int @map("tag_id")
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag Tag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([postId, tagId])
  @@map("post_tags")
}

model Comment {
  id Int @id @default(autoincrement())
  postId Int @map("post_id")
  authorName String @map("author_name")
  authorEmail String @map("author_email")
  content String @db.LongText
  status CommentStatus @default(PENDING)
  createdAt DateTime @default(now()) @map("created_at")
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  @@map("comments")
}

enum CommentStatus { PENDING APPROVED REJECTED }
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

### src/lib/auth.ts
```ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.adminUser.findUnique({ where: { email: credentials.email } });
        if (!user) return null;
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;
        return { id: String(user.id), email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  callbacks: {
    async jwt({ token, user }) { if (user) token.id = user.id; return token; },
    async session({ session, token }) { if (session.user) (session.user as { id: string }).id = token.id as string; return session; },
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
};
```

### src/app/posts/[slug]/page.tsx (public post page — needs comment section appended)
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { estimateReadingTime } from "@/lib/reading-time";
import { PostContent } from "./post-content";

interface PageProps { params: Promise<{ slug: string }> }

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
  if (!post || post.status !== "PUBLISHED") notFound();
  const readingTime = estimateReadingTime(post.content);
  // ... renders article with cover, header, tags, excerpt, PostContent
  // MISSING: comment section below PostContent
}
```

### src/app/posts/[slug]/post-content.tsx
```tsx
"use client";
import { useEffect, useRef } from "react";
import hljs from "highlight.js/lib/core";
// ... registers languages, renders HTML content with syntax highlighting
export function PostContent({ content }: PostContentProps) { /* ... */ }
```

### src/app/api/posts/route.ts
```ts
// GET: list posts with pagination, filtering, sorting
// POST: create post (requires auth)
```

### src/app/api/posts/[id]/route.ts
```ts
// GET: single post by id
// PUT: update post (requires auth)
// DELETE: delete post (requires auth) — cascade deletes comments
```

### src/app/admin/(admin)/posts/page.tsx (admin post list — needs pending comment badge)
```tsx
"use client";
// Lists posts with status filter, sort, pagination
// MISSING: pending comment count badge per post
```

### src/app/admin/(admin)/layout.tsx (admin layout — already has Comments nav link)
```tsx
"use client";
const navLinks = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/tags", label: "Tags" },
  { href: "/admin/comments", label: "Comments" },
  { href: "/admin/settings", label: "Settings" },
];
// ... sidebar + header layout
```

### src/middleware.ts
```ts
// NextAuth middleware for protecting /admin routes
```

## Section 5 — Existing Tests

No project-level test files found. No Jest config exists yet.

## Implementation Log

### Files Created
- src/app/api/posts/[id]/comments/route.ts — public comment API (GET approved, POST with rate limiting)
- src/app/api/comments/route.ts — admin comment list API (GET with status filtering)
- src/app/api/comments/[id]/route.ts — admin comment update/delete API (PATCH, DELETE)
- src/components/comment-form.tsx — client component with validation
- src/components/comment-list.tsx — client component with relative timestamps
- src/app/admin/(admin)/comments/page.tsx — admin comment management page

### Files Modified
- src/app/posts/[slug]/page.tsx — added CommentList and CommentForm below post content
- src/app/api/posts/route.ts — added _count of pending comments, mapped to pendingComments
- src/app/admin/(admin)/posts/page.tsx — displays pendingComments badge

### Linter Improvements
- CommentForm: improved per-field validation with error states
- CommentList: simplified relative time formatting
- Admin posts: refored to use API-returned pendingComments instead of separate fetch
- Admin comments: improved auth checks and error messages
- API routes: improved validation and include statements

### Browser Verification
Tool: playwright-cli
URL: http://localhost:3000
Result: PARTIAL — DB unavailable (RSA public key issue, pre-existing environment problem)
- /posts page: renders but no data (DB timeout)
- /admin/comments: redirects to /admin/login (expected, requires auth)
- /admin/posts: redirects to /admin/login (expected, requires auth)
- Build: PASS — all routes compiled and registered
- Server cleanup: confirmed
