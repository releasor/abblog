# Context Snapshot — F-007 Search Functionality

## Section 1 — Feature Brief

### Feature Description
Add full-text search capability to the blog. Create a search API route GET /api/search?q=<query> that performs full-text search across post title, content, and excerpt fields using MySQL FULLTEXT indexes (add FULLTEXT index to Post model for title and content fields via a Prisma migration). The API should return matching posts sorted by relevance, limited to 20 results, with highlighted matching snippets. Create a search results page at /search?q=<query> showing matched posts as cards with title, excerpt (with matching terms highlighted), category, and published date. Add a search input component in the blog header that: shows a search icon button, expands into an input field on click, submits on Enter key press, navigates to /search?q=<query>. Implement debounced search suggestions (optional enhancement): as the user types, show a dropdown with top 5 matching post titles after 300ms debounce. Handle edge cases: empty query returns 'Please enter a search term', no results returns 'No posts found matching your query'. Ensure search only returns published posts (filter by status=PUBLISHED).

### Acceptance Criteria
- Given published posts exist with the word 'TypeScript' in their title, When a visitor searches for 'TypeScript', Then matching posts are displayed on /search with relevance-sorted results
- Given a visitor types a search query in the header search input and presses Enter, Then they are navigated to /search?q=<query>
- Given a search returns no results, When the visitor views the search page, Then a message 'No posts found matching your query' is displayed
- Given a visitor submits an empty search, Then a message 'Please enter a search term' is displayed
- Given a draft post contains the search term, When searching, Then the draft post is NOT included in results
- Given search results are displayed, When a post matches, Then the excerpt shows the matching terms highlighted
- Given the search input in the header, When a visitor clicks the search icon, Then the input field expands and receives focus

## Section 2 — Project Structure

```
.
├── .prizm-docs/
│   ├── root.prizm
│   ├── posts.prizm
│   ├── components.prizm
│   ├── prisma.prizm
│   └── prisma/
│       └── schema.prizm
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── posts/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/
│   │   │       ├── page.tsx
│   │   │       └── post-content.tsx
│   │   ├── api/
│   │   │   └── posts/
│   │   │       └── route.ts
│   │   ├── categories/
│   │   └── tags/
│   ├── components/
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   ├── dark-mode-toggle.tsx
│   │   ├── theme-provider.tsx
│   │   ├── post-card.tsx
│   │   ├── pagination.tsx
│   │   ├── post-form.tsx
│   │   └── tiptap-editor.tsx
│   └── lib/
│       ├── prisma.ts
│       ├── auth.ts
│       ├── slugify.ts
│       └── reading-time.ts
└── package.json
```

## Section 3 — Prizm Context

### root.prizm
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
- comments [feedback, moderation, rate-limit]: src/app/api/comments/, src/app/api/posts/[id]/comments/, src/app/admin/(admin)/comments/ — reader comment system with admin moderation
- components [ui, react, tiptap, header, footer, dark-mode]: src/components/ — reusable UI components including layout, theme, and editor
- lib [utils, helpers, prisma, slugify, reading-time]: src/lib/ — utility functions, Prisma client, slugify, reading time
- prisma [database, schema, seed]: prisma/ — database schema, migrations, and seed script
RULES:
- TypeScript fullstack project with Next.js (App Router)
- Tailwind CSS v4 (CSS-based config, no tailwind.config.ts)
- Personal blog for developers
- Use PrizmKit progressive loading protocol

### prisma/schema.prizm
TRAPS:
- [CRITICAL] Prisma 7 removed url from datasource block — must use prisma.config.ts with defineConfig() | FIX: create prisma.config.ts with datasource.url from env
- [CRITICAL] Prisma 7 requires adapter for PrismaClient constructor — no default driver | FIX: use @prisma/adapter-mariadb with connection string
- [HIGH] Generated client output is ../generated/prisma, not node_modules/@prisma/client | FIX: import from ../../generated/prisma/client
- [LOW] MariaDB adapter is wire-compatible with MySQL but uses different npm package | FIX: use @prisma/adapter-mariadb, not @prisma/adapter-mysql (doesn't exist)

## Section 4 — Existing Source Files

### prisma/schema.prisma (100 lines)
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

### src/lib/prisma.ts (14 lines)
```typescript
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

### src/components/header.tsx (29 lines)
```tsx
"use client";

import Link from "next/link";
import { DarkModeToggle } from "./dark-mode-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-zinc-900 dark:text-zinc-100 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
          KitTest
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            Home
          </Link>
          <Link href="/posts" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            Posts
          </Link>
          <Link href="/about" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            About
          </Link>
          <DarkModeToggle />
        </nav>
      </div>
    </header>
  );
}
```

### src/components/post-card.tsx (51 lines)
```tsx
import Link from "next/link";

interface PostCardProps {
  title: string;
  slug: string;
  excerpt: string | null;
  category: { name: string; slug: string } | null;
  publishedAt: Date | null;
  readingTime: number;
}

export function PostCard({ title, slug, excerpt, category, publishedAt, readingTime }: PostCardProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Link href={`/posts/${slug}`} className="group block rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all">
      <div className="flex items-center gap-2 mb-3">
        {category && (
          <span className="px-2.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full text-xs font-medium">
            {category.name}
          </span>
        )}
      </div>
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors mb-2">
        {title}
      </h3>
      {excerpt && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-2">
          {excerpt}
        </p>
      )}
      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-500">
        {publishedAt && <time dateTime={publishedAt.toISOString()}>{formatDate(publishedAt)}</time>}
        <span>{readingTime} min read</span>
      </div>
    </Link>
  );
}
```

### src/app/posts/page.tsx (68 lines)
```tsx
import { prisma } from "@/lib/prisma";
import { estimateReadingTime } from "@/lib/reading-time";
import { PostCard } from "@/components/post-card";
import { Pagination } from "@/components/pagination";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function PostsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const limit = 12;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: { select: { name: true, slug: true } },
      },
    }),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  if (page > totalPages && totalPages > 0) {
    notFound();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">All Posts</h1>
      {posts.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-500 text-center py-12">No posts published yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <PostCard key={post.id} title={post.title} slug={post.slug} excerpt={post.excerpt} category={post.category} publishedAt={post.publishedAt} readingTime={estimateReadingTime(post.content)} />
            ))}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} basePath="/posts" />
        </>
      )}
    </div>
  );
}
```

### src/app/api/posts/route.ts (105 lines)
```typescript
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
        _count: { select: { comments: { where: { status: "PENDING" } } } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  return NextResponse.json({
    posts: posts.map((p) => ({
      ...p,
      tags: p.tags.map((pt) => pt.tag),
      pendingComments: p._count.comments,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
      title, slug, content,
      excerpt: excerpt || null,
      coverImageUrl: coverImageUrl || null,
      status: isPublished ? "PUBLISHED" : "DRAFT",
      publishedAt: isPublished ? new Date() : null,
      authorId: parseInt(userId),
      categoryId: categoryId ? parseInt(categoryId) : null,
      tags: tags?.length
        ? { create: tags.map((tagId: string) => ({ tag: { connect: { id: parseInt(tagId) } } })) }
        : undefined,
    },
    include: { category: true, tags: { include: { tag: true } } },
  });

  return NextResponse.json(post, { status: 201 });
}
```

### src/app/layout.tsx (46 lines)
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KitTest",
  description: "A personal blog for developers",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Providers>
          <ThemeProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
```

### src/app/posts/[slug]/page.tsx (108 lines)
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { estimateReadingTime } from "@/lib/reading-time";
import { PostContent } from "./post-content";
import { CommentList } from "@/components/comment-list";
import { CommentForm } from "@/components/comment-form";

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

  const readingTime = estimateReadingTime(post.content);

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      {/* ... full article rendering with comments ... */}
    </article>
  );
}
```

## Section 5 — Existing Tests

No existing test files found for the search feature. The project uses Jest + React Testing Library per project conventions.
