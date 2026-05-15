# Plan — F-012: Table of Contents (TOC)

## Architecture

The post page currently uses `max-w-3xl mx-auto` for centered layout. The TOC requires a wider container with a sticky sidebar on the right. The post page (`src/app/posts/[slug]/page.tsx`) will be modified to use a flex/grid layout: post content on the left (keeping `max-w-3xl`) and a TOC sidebar on the right (visible on `lg:` breakpoint and above).

### New Files
- `src/lib/toc.ts` — Utility: `extractHeadings(html)`, `injectHeadingIds(html)`, `countWords(html)`
- `src/components/table-of-contents.tsx` — Client component: sticky sidebar, IntersectionObserver highlight, tablet floating button

### Modified Files
- `src/app/posts/[slug]/page.tsx` — Wrap content in flex container, conditionally render TOC
- `src/app/globals.css` — Add `html { scroll-behavior: smooth }`

### Data Flow
1. Server: `page.tsx` calls `injectHeadingIds(post.content)` to ensure all h2/h3 have IDs
2. Server: `page.tsx` calls `extractHeadings(processedContent)` to get heading array
3. Server: `page.tsx` calls `countWords(post.content)` — skip TOC if < 1500
4. Server: passes `headings` and `processedContent` to client components
5. Client: `TableOfContents` uses IntersectionObserver to highlight active heading

## Tasks

- [x] Create `src/lib/toc.ts` with `extractHeadings()`, `injectHeadingIds()`, and `countWords()` utility functions. Use existing `slugify()` from `src/lib/slugify.ts`.
- [x] Create `src/components/table-of-contents.tsx` — client component with: nested list rendering (h3 indented under h2), smooth-scroll anchor links, IntersectionObserver for active heading highlighting, sticky positioning (top: 80px, independent scroll), tablet floating button (hidden on mobile, collapsible on md/lg), Tailwind styling matching blog design.
- [x] Modify `src/app/posts/[slug]/page.tsx` — widen container for sidebar layout, call `injectHeadingIds` + `extractHeadings` + `countWords`, conditionally render `TableOfContents` for posts >= 1500 words, pass processed content to `PostContent`.
- [x] Add `html { scroll-behavior: smooth }` to `src/app/globals.css`.
- [x] Write tests for `src/lib/toc.ts` — `extractHeadings`, `injectHeadingIds`, `countWords`.
- [ ] Verify all acceptance criteria pass manually (desktop TOC, smooth scroll, active highlight, short post skip, independent scroll, tablet button, mobile hidden).
