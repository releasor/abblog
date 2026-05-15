# Plan — F-008: SEO & Performance Optimization

## Architecture

### Key Components
1. **Dynamic Metadata** — `generateMetadata` on post pages for OG tags, canonical URLs, article meta
2. **Sitemap** — `src/app/sitemap.ts` using Next.js App Router sitemap convention
3. **Robots.txt** — `src/app/robots.ts` using Next.js App Router robots convention
4. **RSS Feed** — `src/app/feed.xml/route.ts` as a Route Handler
5. **SSG + ISR** — `generateStaticParams` + `revalidate: 3600` on post pages
6. **Image Optimization** — Replace `<img>` with Next.js `<Image>` component
7. **JSON-LD Structured Data** — BlogPosting schema on post pages
8. **Site URL Config** — `NEXT_PUBLIC_SITE_URL` env var for absolute URLs

### Data Flow
- Post pages fetch from Prisma → generate metadata + JSON-LD → render with SSG/ISR
- Sitemap/robots/RSS query Prisma for published posts/categories → generate XML/text/RSS responses

### Dependencies to Add
- `rss` — RSS feed generation (npm package)

### Environment
- Add `NEXT_PUBLIC_SITE_URL` to `.env.example` (default: `http://localhost:3000`)

## Tasks

- [ ] 1. Install `rss` package and add `NEXT_PUBLIC_SITE_URL` to `.env.example`; create `src/lib/site-url.ts` helper
- [ ] 2. Add `generateMetadata` to post page (`src/app/posts/[slug]/page.tsx`) with OG tags, article meta, canonical URL
- [ ] 3. Replace `<img>` with Next.js `<Image>` in post page for cover image with lazy loading
- [ ] 4. Add JSON-LD BlogPosting structured data to post page
- [ ] 5. Add `generateStaticParams` and `revalidate: 3600` to post page for SSG + ISR
- [ ] 6. Create `src/app/sitemap.ts` with all published posts, categories, and static pages
- [ ] 7. Create `src/app/robots.ts` allowing all crawlers, referencing sitemap
- [ ] 8. Create `src/app/feed.xml/route.ts` RSS feed with last 20 posts
- [ ] 9. Add `generateMetadata` to home page, posts listing, categories, category detail, tag detail, about, search pages
- [ ] 10. Verify build succeeds and all routes work
