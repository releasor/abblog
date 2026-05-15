# F-007: Search Functionality — Plan

## Architecture

### Data Flow
1. User types in header search input → submits on Enter → navigates to `/search?q=<query>`
2. `/search` page calls search API or queries Prisma directly with FULLTEXT search
3. MySQL FULLTEXT index on `posts.title` and `posts.content` enables relevance-sorted results
4. Results displayed as PostCard components with highlighted matching terms in excerpt

### Key Decisions
- Use MySQL FULLTEXT indexes (InnoDB supports FULLTEXT since MySQL 5.6+) for relevance sorting
- Add FULLTEXT index via Prisma migration SQL (Prisma doesn't natively support FULLTEXT, so use raw SQL in migration)
- Search API uses `$queryRawUnsafe` with MATCH...AGAINST for FULLTEXT search
- Search input is a client component in the header with expand/collapse animation
- Highlight matching terms using simple string replacement (wrap matches in `<mark>` tags)
- Debounced suggestions dropdown as optional enhancement

### Files to Create/Modify
- `prisma/schema.prisma` — add @@index for FULLTEXT (via raw SQL migration)
- `prisma/migrations/..._add_fulltext_index/migration.sql` — raw SQL FULLTEXT index
- `src/app/api/search/route.ts` — search API endpoint
- `src/app/search/page.tsx` — search results page
- `src/components/search-input.tsx` — expandable search input component
- `src/components/header.tsx` — integrate search input

## Tasks

- [ ] 1. Add FULLTEXT index to posts table via Prisma migration
- [ ] 2. Create search API route (GET /api/search?q=<query>)
- [ ] 3. Create search results page (/search?q=<query>)
- [ ] 4. Create search input component with expand/collapse
- [ ] 5. Integrate search input into header
- [ ] 6. Add debounced search suggestions dropdown
- [ ] 7. Verify all acceptance criteria
