# Plan: F-006 Reader-Friendly UI & Layout

## Overview
Implement public-facing blog UI with clean developer aesthetic, dark mode, responsive design, and proper typography.

## Architecture

### Components to Create
1. **Header** — Blog name, nav links (Home, Posts, About), dark mode toggle
2. **Footer** — Copyright, social links placeholder
3. **PostCard** — Title, excerpt, category badge, date, reading time
4. **DarkModeToggle** — localStorage persistence, class strategy
5. **Pagination** — Page controls for post listings
6. **ReadingTime** — Utility: words / 200 wpm

### Pages to Create/Modify
1. **src/app/layout.tsx** — Add Header + Footer, dark mode class on <html>
2. **src/app/page.tsx** — Hero section + recent posts grid
3. **src/app/posts/page.tsx** — All posts paginated grid
4. **src/app/posts/[slug]/page.tsx** — Add reading time, tag links, syntax highlighting
5. **src/app/tags/[slug]/page.tsx** — Posts filtered by tag
6. **src/app/about/page.tsx** — Placeholder about page

### API Endpoints (existing, no changes needed)
- GET /api/posts?status=PUBLISHED&page=N&limit=6 — paginated published posts
- GET /api/posts/[id] — single post with tags

### Key Decisions
- Dark mode: Tailwind class strategy with localStorage persistence
- Syntax highlighting: highlight.js (already in package.json)
- Reading time: word count / 200, rounded up
- Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop
- Pagination: 6 posts per page on home, 12 on /posts

## Tasks

- [x] 1. Create utility: src/lib/reading-time.ts (word count / 200 wpm)
- [x] 2. Create component: src/components/header.tsx (nav, dark mode toggle)
- [x] 3. Create component: src/components/footer.tsx (copyright, social placeholder)
- [x] 4. Create component: src/components/dark-mode-toggle.tsx (localStorage persistence)
- [x] 5. Create component: src/components/post-card.tsx (title, excerpt, badge, date, reading time)
- [x] 6. Create component: src/components/pagination.tsx (page controls)
- [x] 7. Modify src/app/globals.css — add dark mode CSS vars, highlight.js styles
- [x] 8. Modify src/app/layout.tsx — add Header/Footer, dark mode class support
- [x] 9. Modify src/app/page.tsx — hero section + recent posts grid
- [x] 10. Create src/app/posts/page.tsx — paginated all-posts grid
- [x] 11. Modify src/app/posts/[slug]/page.tsx — reading time, tag links, syntax highlighting
- [x] 12. Create src/app/tags/[slug]/page.tsx — tag filtered posts
- [x] 13. Create src/app/about/page.tsx — placeholder about page (already existed)
- [x] 14. Build verification — ensure `npm run build` passes
