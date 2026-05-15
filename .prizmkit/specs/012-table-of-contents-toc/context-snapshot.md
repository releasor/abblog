# Context Snapshot — F-012: Table of Contents (TOC)

## Section 1 — Feature Brief

### Feature Description
Add an auto-generated table of contents for long blog posts to improve navigation. Create a utility function extractHeadings(htmlContent) that parses the post's HTML content and extracts all h2 and h3 elements, returning an array of objects with: level (2 or 3), text (heading text content), id (slugified version of the text for anchor linking). Implement a function injectHeadingIds(htmlContent) that processes the post HTML and adds id attributes to h2/h3 elements that don't already have them (using the same slugify logic as extractHeadings). Create a TableOfContents React component that renders a sticky sidebar navigation on the right side of the post page (visible on desktop only, hidden on mobile). The TOC should: display headings as a nested list (h3 indented under h2), link each heading to its anchor (#heading-id), highlight the currently visible heading as the user scrolls (using IntersectionObserver), and collapse to a floating button on tablet screens that expands the TOC on click. Add smooth scroll behavior when clicking TOC links (CSS scroll-behavior: smooth or JavaScript scrollTo). Apply the TOC only to posts longer than 1500 words (shorter posts don't need a TOC). The TOC should be positioned with position: sticky, top: 80px, and scroll independently if the heading list is longer than the viewport height. Style the TOC with Tailwind CSS v4 to match the blog's design: subtle border, small font, muted colors, with the active heading highlighted in the primary color.

### Acceptance Criteria
- Given a published post with h2 and h3 headings, When a visitor views the post on desktop, Then a table of contents is displayed in a sticky sidebar on the right
- Given the TOC is visible, When a visitor clicks a heading link, Then the page scrolls smoothly to that heading
- Given a visitor scrolls through a long post, When different headings enter the viewport, Then the corresponding TOC item is highlighted
- Given a post has fewer than 1500 words, When a visitor views the post, Then the table of contents is not displayed
- Given the TOC has many headings, When the list is taller than the viewport, Then the TOC scrolls independently without overlapping the footer
- Given a visitor is on a tablet screen, When they view a post, Then a floating TOC button is shown that expands the TOC on click
- Given a visitor is on a mobile screen, When they view a post, Then the TOC is hidden (no floating button)

## Section 2 — Project Structure

```
.\.claude
.\.claude\agents
.\.claude\command-assets
.\.claude\commands
.\.claude\rules
.\.claude\skills
.\.prizm-docs
.\.prizm-docs\admin
.\.prizm-docs\auth
.\.prizm-docs\components
.\.prizm-docs\media
.\.prizm-docs\posts
.\.prizm-docs\prisma
.\.prizm-docs\search
.\.prizmkit
.\.prizmkit\plans
.\.prizmkit\scripts
.\.prizmkit\specs
.\.prizmkit\state
.\public
.\src
.\src\app
.\src\app\about
.\src\app\admin
.\src\app\api
.\src\app\categories
.\src\app\posts
.\src\app\search
.\src\app\tags
.\src\components
.\src\lib
.\prisma
.\prisma\migrations
.\generated\prisma
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
- search [fulltext, search, query]: src/app/api/search/, src/app/search/, src/components/search-input.tsx — full-text search with relevance sorting
- comments [feedback, moderation, rate-limit]: src/app/api/comments/, src/app/api/posts/[id]/comments/, src/app/admin/(admin)/comments/ — reader comment system with admin moderation
- components [ui, react, tiptap, header, footer, dark-mode]: src/components/ — reusable UI components including layout, theme, and editor
- lib [utils, helpers, prisma, slugify, reading-time]: src/lib/ — utility functions, Prisma client, slugify, reading time
- prisma [database, schema, seed]: prisma/ — database schema, migrations, and seed script
- media [upload, image, files]: src/app/api/upload/, src/app/api/media/ — image upload and media library API
RULES:
- TypeScript fullstack project with Next.js (App Router)
- Tailwind CSS v4 (CSS-based config, no tailwind.config.ts)
- Personal blog for developers
- Use PrizmKit progressive loading protocol
PROJECT_BRIEF: .prizmkit/plans/project-brief.md
```

### posts.prizm
```
MODULE: posts
FILES: src/app/api/posts/route.ts, src/app/api/posts/[id]/route.ts, src/app/api/posts/[id]/comments/route.ts, src/app/api/categories/route.ts, src/app/api/categories/[id]/route.ts, src/app/api/tags/route.ts, src/app/api/tags/[id]/route.ts, src/app/admin/(admin)/posts/page.tsx, src/app/admin/(admin)/posts/new/page.tsx, src/app/admin/(admin)/posts/[id]/edit/page.tsx, src/app/admin/(admin)/categories/page.tsx, src/app/admin/(admin)/tags/page.tsx, src/app/posts/page.tsx, src/app/posts/[slug]/page.tsx, src/app/posts/[slug]/post-content.tsx, src/app/tags/[slug]/page.tsx, src/app/categories/page.tsx, src/app/categories/[slug]/page.tsx, src/components/post-form.tsx, src/components/post-card.tsx, src/components/pagination.tsx, src/components/tiptap-editor.tsx, src/components/comment-form.tsx, src/components/comment-list.tsx, src/lib/slugify.ts, src/lib/reading-time.ts, src/lib/related-posts.ts, src/components/related-posts.tsx
RESPONSIBILITY: blog post/category/tag CRUD — API routes, admin pages, public post/category/tag viewers with syntax highlighting. Posts API includes pending comment counts for admin badge display.
DEPENDENCIES:
- uses: @tiptap/react: rich text editor for post content
- uses: @prisma/client: database ORM for queries
- uses: highlight.js: syntax highlighting for code blocks in posts
- imports: next-auth: session validation for API routes
- imports: src/lib/prisma: Prisma client singleton
- imports: src/lib/slugify: URL slug generation
- imports: src/lib/reading-time: reading time estimation
```

### components.prizm
```
MODULE: components
FILES: src/components/header.tsx, src/components/footer.tsx, src/components/dark-mode-toggle.tsx, src/components/theme-provider.tsx, src/components/post-card.tsx, src/components/pagination.tsx, src/components/post-form.tsx, src/components/tiptap-editor.tsx, src/components/image-upload.tsx
RESPONSIBILITY: reusable UI components — site layout (header/footer), dark mode, post cards, pagination, forms, editor
DEPENDENCIES:
- uses: @tiptap/react: rich text editor
- imports: next/link: client-side navigation
- imports: next-auth/react: session provider
```

## Section 4 — Existing Source Files

### src/app/posts/[slug]/page.tsx (198 lines)
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { estimateReadingTime } from "@/lib/reading-time";
import { absoluteUrl } from "@/lib/site-url";
import { getRelatedPosts } from "@/lib/related-posts";
import { PostContent } from "./post-content";
import { CommentList } from "@/components/comment-list";
import { CommentForm } from "@/components/comment-form";
import { RelatedPosts } from "@/components/related-posts";

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

  const relatedPosts = await getRelatedPosts(post.id);

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

      <RelatedPosts posts={relatedPosts} />
    </article>
  );
}
```

### src/app/posts/[slug]/post-content.tsx (47 lines)
```tsx
"use client";

import { useEffect, useRef } from "react";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import sql from "highlight.js/lib/languages/sql";
import "highlight.js/styles/github-dark.css";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("sql", sql);

interface PostContentProps {
  content: string;
}

export function PostContent({ content }: PostContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.querySelectorAll("pre code").forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });
    }
  }, [content]);

  return (
    <div
      ref={ref}
      className="prose prose-zinc dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
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
      suppressHydrationWarning
    >
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

### src/lib/slugify.ts (9 lines)
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

### src/lib/reading-time.ts (5 lines)
```ts
export function estimateReadingTime(htmlContent: string): number {
  const text = htmlContent.replace(/<[^>]*>/g, "");
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}
```

### src/app/globals.css (106 lines)
```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}

/* Post content typography */
.prose pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1rem;
  border-radius: 0.375rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.875rem;
  overflow-x: auto;
}

.prose code:not(pre code) {
  background: #f4f4f5;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: var(--font-geist-mono), monospace;
}

.dark .prose code:not(pre code) {
  background: #27272a;
}

.prose img {
  max-width: 100%;
  height: auto;
  border-radius: 0.375rem;
}

.prose a {
  color: #2563eb;
  text-decoration: underline;
}

.prose a:hover {
  color: #1d4ed8;
}

.prose blockquote {
  border-left-color: #d4d4d8;
}

.dark .prose blockquote {
  border-left-color: #3f3f46;
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

### package.json (48 lines)
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
    "highlight.js": "^11.11.1",
    "mariadb": "^3.5.2",
    "next": "16.2.6",
    "next-auth": "^4.24.14",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "rss": "^1.2.2"
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
    "@types/rss": "^0.0.32",
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

No project-level test files exist. Testing strategy is Jest + React Testing Library (per project conventions).

## Implementation Log

(To be filled by /prizmkit-implement)
