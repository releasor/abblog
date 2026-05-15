# F-011 Related Posts — Plan

## Overview
Add a related posts section to the public post page (`/posts/[slug]`) below the comment section. Server-side rendered using Prisma queries against existing PostTag and Post tables (no schema changes needed).

## Data Flow
1. `getRelatedPosts(currentPostId, limit)` in `src/lib/related-posts.ts` queries Prisma
2. Algorithm: score posts by shared tag count, fill remaining with same-category posts, exclude current + drafts
3. Returns array of post objects with title, slug, excerpt, category, publishedAt, coverImageUrl
4. Called in `src/app/posts/[slug]/page.tsx` (server component), passed to `<RelatedPosts>`
5. `RelatedPosts` component renders horizontal row of up to 3 cards, or nothing if empty

## Files to Create
- `src/lib/related-posts.ts` — getRelatedPosts() utility function
- `src/components/related-posts.tsx` — RelatedPosts display component

## Files to Modify
- `src/app/posts/[slug]/page.tsx` — import and render RelatedPosts below comment section

## Tasks
- [x] 1. Create `src/lib/related-posts.ts` with `getRelatedPosts(currentPostId, limit=3)` function: query PostTag to find posts sharing tags, score by shared tag count, supplement with same-category posts, exclude current post and drafts, sort by score desc then publishedAt desc
- [x] 2. Create `src/components/related-posts.tsx` — server component accepting posts array prop, renders heading "Related Posts" + horizontal grid of up to 3 cards with title, excerpt (100 char truncation), category badge, published date, cover image thumbnail; returns null if empty
- [x] 3. Integrate into `src/app/posts/[slug]/page.tsx` — import getRelatedPosts and RelatedPosts, call getRelatedPosts after post fetch, render RelatedPosts below CommentForm section
- [x] 4. Run TypeScript type-check (`npx tsc --noEmit`) to verify no type errors
