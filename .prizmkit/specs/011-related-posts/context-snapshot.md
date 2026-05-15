# Context Snapshot — F-011 Related Posts

## Section 1 — Feature Brief

### Description
Add a related posts section to the public post page to increase reader engagement. Create a utility function `getRelatedPosts(currentPostId, limit=3)` that queries the database for related posts using the following algorithm: (1) find posts that share the most tags with the current post, scored by number of shared tags (each shared tag = 1 point); (2) if fewer than 3 matches, supplement with posts from the same category that have the fewest shared tags (to fill the limit); (3) exclude the current post itself and any draft posts; (4) sort by score descending, then by publishedAt descending as tiebreaker. Create a RelatedPosts React component that displays a horizontal row of up to 3 post cards, each showing: title, excerpt (truncated to 100 chars), category badge, published date, and cover image thumbnail (if available). Add the RelatedPosts component to the public post page (/posts/[slug]) below the comment section. The section should have a heading 'Related Posts' styled consistently with the blog's design. If no related posts are found, the section should not render at all. Create a server-side function so the related posts are fetched during page rendering (SSR/SSG), not via client-side API call.

### Acceptance Criteria
- Given a published post with tags ['react', 'typescript'] and 3 other published posts sharing those tags, When a visitor views the post, Then 3 related post cards are displayed below the content
- Given a published post with a unique tag and 2 other posts in the same category, When a visitor views the post, Then the related posts section shows up to 3 posts (category fallback)
- Given a published post with no other posts in its category and unique tags, When a visitor views the post, Then the related posts section is not rendered
- Given a post has 5 related posts by tag score, When the related posts are displayed, Then only the top 3 by relevance are shown
- Given related posts exist, When a visitor clicks a related post card, Then they are navigated to that post's page
- Given the related posts section is rendered, When the post page is loaded via SSG, Then the related posts data is included in the pre-rendered HTML (no client-side fetch)

## Section 2 — Project Structure

```
|____.prizm-docs/
|____.prizmkit/
| |____plans/
| |____specs/
| | |____011-related-posts/
|____prisma/
| |____migrations/
| |____schema.prisma
| |____seed.ts
| |____prisma.config.ts
|____src/
| |____app/
| | |____admin/
| | | |____(admin)/
| | |____api/
| | | |____posts/
| | | |____categories/
| | | |____tags/
| | | |____comments/
| | | |____search/
| | | |____upload/
| | | |____media/
| | |____posts/
| | | |____[slug]/
| | | |____page.tsx
| | |____categories/
| | |____tags/
| | |____search/
| | |____about/
| | |____layout.tsx
| | |____page.tsx
| | |____globals.css
| |____components/
| | |____header.tsx
| | |____footer.tsx
| | |____dark-mode-toggle.tsx
| | |____theme-provider.tsx
| | |____post-card.tsx
| | |____pagination.tsx
| | |____post-form.tsx
| | |____tiptap-editor.tsx
| | |____comment-form.tsx
| | |____comment-list.tsx
| | |____search-input.tsx
| |____lib/
| | |____prisma.ts
| | |____slugify.ts
| | |____reading-time.ts
| | |____auth.ts
| | |____site-url.ts
| |____middleware.ts
|____generated/
| |____prisma/
```

## Section 3 — Prizm Context

### root.prizm (L0)
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
- search [fulltext, search, query]: src/app/api/search/, src/app/search/, src/components/search-input.tsx — full-text search with relevance sorting
- comments [feedback, moderation, rate-limit]: src/app/api/comments/, src/app/api/posts/[id]/comments/, src/app/admin/(admin)/comments/ — reader comment system with admin moderation
- components [ui, react, tiptap, header, footer, dark-mode]: src/components/ — reusable UI components including layout, theme, and editor
- lib [utils, helpers, prisma, slugify, reading-time]: src/lib/ — utility functions, Prisma client, slugify, reading time
- prisma [database, schema, seed]: prisma/ — database schema, migrations, and seed script
- media [upload, image, files]: src/app/api/upload/, src/app/api/media/ — image upload and media library API
```

### Schema (from prisma/schema.prisma L2)
Models: AdminUser, Post (id, title, slug, content, excerpt, coverImageUrl, status DRAFT/PUBLISHED, publishedAt, authorId, categoryId), Category (id, name, slug, description), Tag (id, name, slug), PostTag (postId, tagId composite PK), Comment (id, postId, authorName, authorEmail, content, status, createdAt)

Post has relations: author (AdminUser), category (Category?), tags (PostTag[]), comments (Comment[])
PostTag has relations: post (Post), tag (Tag)

### Key traps
- Prisma 7 removed url from datasource block — must use prisma.config.ts
- Prisma 7 requires adapter for PrismaClient constructor
- Generated client output is ../generated/prisma, not node_modules/@prisma/client
- Public post pages are server components with direct prisma query — no API layer
- Post pages use force-dynamic or revalidate for DB-dependent pages

## Section 4 — Existing Source Files

### src/app/posts/[slug]/page.tsx (192 lines)
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { estimateReadingTime } from "@/lib/reading-time";
import { absoluteUrl } from "@/lib/site-url";
import { PostContent } from "./post-content";
import { CommentList } from "@/components/comment-list";
import { CommentForm } from "@/components/comment-form";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true },
  });
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const post = await prisma.post.findUnique({
    where: { slug },
    select: {
      title: true,
      excerpt: true,
      coverImageUrl: true,
      publishedAt: true,
      updatedAt: true,
      slug: true,
      author: { select: { name: true } },
      tags: { include: { tag: { select: { name: true } } } },
    },
  });

  if (!post) return {};

  const description = post.excerpt || `Read ${post.title} on KitTest`;
  const url = absoluteUrl(`/posts/${post.slug}`);

  return {
    title: post.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description,
      url,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt?.toISOString(),
      authors: [post.author.name],
      tags: post.tags.map((pt) => pt.tag.name),
      images: post.coverImageUrl ? [{ url: post.coverImageUrl, alt: post.title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: post.coverImageUrl ? [post.coverImageUrl] : [],
    },
  };
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.coverImageUrl || undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt?.toISOString(),
    author: {
      "@type": "Person",
      name: post.author.name,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(`/posts/${post.slug}`),
    },
  };

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {post.coverImageUrl && (
        <div className="relative w-full aspect-[16/9] mb-8 rounded-lg overflow-hidden">
          <Image
            src={post.coverImageUrl}
            alt={post.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
        </div>
      )}

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
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span>{readingTime} min read</span>
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
              <Link
                key={pt.tag.id}
                href={`/tags/${pt.tag.slug}`}
                className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                #{pt.tag.name}
              </Link>
            ))}
          </div>
        )}
      </header>

      {post.excerpt && (
        <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8 italic border-l-4 border-zinc-300 dark:border-zinc-700 pl-4">
          {post.excerpt}
        </p>
      )}

      <PostContent content={post.content} />

      <section className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800">
        <CommentList postId={post.id} />
        <div className="mt-8">
          <CommentForm postId={post.id} />
        </div>
      </section>
    </article>
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
    <Link
      href={`/posts/${slug}`}
      className="group block rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all"
    >
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

### src/lib/prisma.ts (14 lines)
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

### src/lib/reading-time.ts (5 lines)
```ts
export function estimateReadingTime(htmlContent: string): number {
  const text = htmlContent.replace(/<[^>]*>/g, "");
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}
```

### src/lib/site-url.ts (7 lines)
```ts
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
```

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

## Section 5 — Existing Tests

No test files exist in the project. No test framework (jest, vitest) is configured. The package.json has no "test" script.

TEST_CMDS: `npx tsc --noEmit` (TypeScript type-check only)

## Implementation Log
(to be filled during implementation)
