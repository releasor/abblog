# Context Snapshot — F-008: SEO & Performance Optimization

## Section 1 — Feature Brief

### Feature Description
Implement SEO best practices and performance optimizations for the blog. Add dynamic metadata to all pages using Next.js generateMetadata: post pages include title, description (from excerpt), og:image (cover image), canonical URL, article:published_time, article:modified_time, article:author, article:tag. Generate a sitemap.xml using Next.js App Router's sitemap.ts that includes all published posts, categories, and static pages with lastModified dates and priority scores. Generate a robots.txt using Next.js App Router's robots.ts that allows all crawlers and references the sitemap. Create an RSS feed at /feed.xml using the rss library that includes the last 20 published posts with title, link, description, author, and published date. Implement Next.js Static Site Generation (SSG) for post pages using generateStaticParams to pre-render all published posts at build time. Add ISR (Incremental Static Regeneration) with revalidate: 3600 (1 hour) for post pages so new posts appear without full rebuild. Optimize images: use Next.js Image component for cover images and post content images with proper width/height and lazy loading. Add structured data (JSON-LD) for blog posts using schema.org BlogPosting markup. Ensure all pages pass Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1.

### Acceptance Criteria
- Given a published post exists, When a crawler fetches /posts/[slug], Then the HTML contains Open Graph meta tags (og:title, og:description, og:image)
- Given published posts exist, When /sitemap.xml is fetched, Then it contains URLs for all published posts with lastModified dates
- Given the blog is deployed, When /robots.txt is fetched, Then it allows all crawlers and references /sitemap.xml
- Given published posts exist, When /feed.xml is fetched, Then it contains the last 20 posts in RSS 2.0 format
- Given a post page is loaded, When inspecting the HTML, Then JSON-LD structured data with BlogPosting schema is present
- Given a post page is built, When using Next.js build, Then the page is pre-rendered as static HTML (SSG)
- Given a post is updated, When the ISR revalidation period expires, Then the page reflects the updated content without manual rebuild
- Given a post has a cover image, When the page loads, Then the image uses Next.js Image component with lazy loading

## Section 2 — Project Structure

```
E:\Prizm\KitTest
├── .prizm-docs/
├── .prizmkit/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── public/
├── src/
│   ├── app/
│   │   ├── about/page.tsx
│   │   ├── admin/
│   │   ├── api/
│   │   ├── categories/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── posts/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/
│   │   │       ├── page.tsx
│   │   │       └── post-content.tsx
│   │   ├── search/page.tsx
│   │   ├── tags/[slug]/page.tsx
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── comment-form.tsx
│   │   ├── comment-list.tsx
│   │   ├── dark-mode-toggle.tsx
│   │   ├── footer.tsx
│   │   ├── header.tsx
│   │   ├── pagination.tsx
│   │   ├── post-card.tsx
│   │   ├── post-form.tsx
│   │   ├── search-input.tsx
│   │   ├── theme-provider.tsx
│   │   └── tiptap-editor.tsx
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── prisma.ts
│   │   ├── reading-time.ts
│   │   └── slugify.ts
│   └── middleware.ts
├── package.json
├── next.config.ts
└── tsconfig.json
```

## Section 3 — Prizm Context

### root.prizm
- PROJECT: KitTest
- LANG: TypeScript
- TECH_STACK: TypeScript, Next.js 16, Tailwind CSS v4
- MODULE_INDEX includes: app, auth, admin, posts, comments, components, lib, prisma

## Section 4 — Existing Source Files

### src/app/posts/[slug]/page.tsx (108 lines)
Current post page: fetches post by slug via Prisma, renders title/excerpt/content/tags/category/comments. Uses `<img>` for cover image (not Next.js Image). No generateMetadata, no JSON-LD, no ISR revalidate, no generateStaticParams.

### src/app/layout.tsx (47 lines)
Root layout with static metadata (title: "KitTest", description: "A personal blog for developers"). Uses Geist fonts, ThemeProvider, Header/Footer.

### src/app/page.tsx (55 lines)
Home page: `export const dynamic = "force-dynamic"`, fetches 6 latest published posts. No metadata.

### src/app/posts/page.tsx (68 lines)
Posts listing page: `export const dynamic = "force-dynamic"`, paginated with Pagination component.

### src/app/categories/[slug]/page.tsx (68 lines)
Category page: `export const dynamic = "force-dynamic"`.

### src/app/tags/[slug]/page.tsx (75 lines)
Tag page: `export const dynamic = "force-dynamic"`.

### src/app/posts/[slug]/post-content.tsx (47 lines)
Client component for rendering HTML content with highlight.js code syntax highlighting. Uses `dangerouslySetInnerHTML`.

### src/components/post-card.tsx (51 lines)
PostCard component for listing pages. Uses `<Link>` for navigation.

### src/lib/prisma.ts (14 lines)
Prisma client singleton using MariaDB adapter.

### src/lib/reading-time.ts (5 lines)
Reading time estimator: strips HTML, counts words, divides by 200.

### prisma/schema.prisma (99 lines)
Models: AdminUser, Post (with slug, content, excerpt, coverImageUrl, status, publishedAt, authorId, categoryId, createdAt, updatedAt), Category, Tag, PostTag, Comment.

### package.json
Dependencies: next 16.2.6, react 19.2.4, @prisma/client ^7.8.0, next-auth ^4.24.14, tiptap, highlight.js, bcrypt, mariadb. No `rss` package installed.

### next.config.ts (5 lines)
Empty config.

## Section 5 — Existing Tests

No test files found in the project. Test command: `npm test` (not configured in package.json scripts).

## Section 6 — Implementation Notes

### Key observations:
1. Post page uses `<img>` not `<Image>` — needs migration to Next.js Image component
2. No `generateMetadata` on any page — all pages have static or no metadata
3. No `generateStaticParams` — all pages are dynamic (`force-dynamic` on listing pages)
4. No sitemap.ts, robots.ts, or feed route exists
5. No JSON-LD structured data anywhere
6. No `rss` npm package installed — need to add it
7. `NEXT_PUBLIC_SITE_URL` env var not set — need to add or use a default
8. Post model has all needed fields: title, slug, excerpt, coverImageUrl, publishedAt, updatedAt, author, tags, category
