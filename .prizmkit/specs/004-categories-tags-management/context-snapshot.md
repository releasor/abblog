# Context Snapshot — F-004: Categories & Tags Management

## Section 1 — Feature Brief

### Description
Build admin interfaces for managing blog categories and tags. Create admin pages: /admin/categories (list with name, slug, post count, edit/delete actions), /admin/tags (list with name, slug, post count, edit/delete actions). Each page should have an inline create form at the top (name input + submit button) and inline edit capability. Create API routes: GET/POST /api/categories (list, create), GET/PUT/DELETE /api/categories/[id], GET/POST /api/tags (list, create), GET/PUT/DELETE /api/tags/[id]. Implement slug auto-generation from name. When a category or tag is deleted, disassociate it from all posts (remove PostTag entries, set post categoryId to null). Add validation: category/tag name must be 1-50 characters, slug must be unique. Create public pages: /categories (list all categories with post counts), /categories/[slug] (list posts in a category), /tags/[slug] (list posts with a tag). Each public listing page should show post cards with title, excerpt, published date, and category.

### Acceptance Criteria
- Given an authenticated admin, When they visit /admin/categories, Then a list of all categories with post counts is displayed
- Given an authenticated admin, When they create a new category 'JavaScript', Then it appears in the list with slug 'javascript' and 0 posts
- Given an authenticated admin, When they delete a category that has posts, Then the posts remain but their categoryId is set to null
- Given an authenticated admin, When they visit /admin/tags, Then a list of all tags with post counts is displayed
- Given a category 'Programming' with 3 published posts, When a visitor goes to /categories/programming, Then 3 post cards are shown
- Given a tag 'react' with 2 published posts, When a visitor goes to /tags/react, Then 2 post cards are shown
- Given an admin tries to create a category with a name that already exists, Then an error message 'Category already exists' is shown

## Section 2 — Project Structure

```
.
|____.prizm-docs/
|____.prizmkit/
| |____plans/
| |____specs/
| | |____004-categories-tags-management/
|____prisma/
| |____schema.prisma
| |____seed.ts
| |____prisma.config.ts
|____src/
| |____app/
| | |____admin/
| | | | |____(admin)/
| | | | | |____dashboard/
| | | | | |____layout.tsx
| | | | | |____posts/
| | | |____layout.tsx
| | | |____login/
| | |____api/
| | | |____categories/
| | | | |____route.ts
| | | |____posts/
| | | | |____[id]/
| | | | | |____route.ts
| | | | |____route.ts
| | | |____tags/
| | | | |____route.ts
| | |____layout.tsx
| | |____posts/
| | | |____[slug]/
| | | |____page.tsx
| | |____providers.tsx
| | |____tags/
| | | |____[slug]/
| | | | |____page.tsx
| |____components/
| | |____dark-mode-toggle.tsx
| | |____footer.tsx
| | |____header.tsx
| | |____pagination.tsx
| | |____post-card.tsx
| | |____post-form.tsx
| | |____theme-provider.tsx
| | |____tiptap-editor.tsx
| |____lib/
| | |____auth.ts
| | |____prisma.ts
| | |____reading-time.ts
| | |____slugify.ts
```

## Section 3 — Prizm Context

### root.prizm
- PRIZM_VERSION: 1.0
- PROJECT: KitTest
- LANG: TypeScript
- PROJECT_TYPE: fullstack
- TECH_STACK: TypeScript, Next.js 16, Tailwind CSS v4, ESLint
- MODULE_INDEX: app, auth, admin, posts, components, lib, prisma

### prisma/schema.prizm
- Schema has 6 models: AdminUser, Post, Category, Tag, PostTag, Comment
- Category model: id, name (unique), slug (unique), description
- Tag model: id, name (unique), slug (unique)
- PostTag model: postId, tagId (composite PK) with onDelete: Cascade
- Post model has categoryId (optional) referencing Category
- TRAP: Prisma 7 removed url from datasource block, must use prisma.config.ts
- TRAP: Generated client output is ../generated/prisma, not node_modules/@prisma/client

### posts.prizm
- Posts module covers API routes, admin pages, public post viewer, tag pages
- Already has /api/categories/route.ts (GET only) and /api/tags/route.ts (GET+POST)
- Already has /tags/[slug]/page.tsx (public tag page)

### admin.prizm
- Admin panel layout with sidebar nav already includes Categories link
- Nav links: Dashboard, Posts, Categories, Comments, Settings

## Section 4 — Existing Source Files

### prisma/schema.prisma (100 lines)
- Category: id, name (unique), slug (unique), description, posts Post[]
- Tag: id, name (unique), slug (unique), posts PostTag[]
- PostTag: postId, tagId composite PK, onDelete: Cascade on both
- Post: categoryId optional FK to Category

### src/lib/prisma.ts (14 lines)
- Singleton PrismaClient with MariaDB adapter
- Import from ../../generated/prisma/client

### src/lib/slugify.ts (9 lines)
- Standard slugify: lowercase, trim, replace non-word chars, spaces to dashes

### src/lib/auth.ts (65 lines)
- NextAuth with CredentialsProvider, JWT strategy
- Session includes user.id

### src/app/api/categories/route.ts (9 lines)
- GET only: returns all categories ordered by name
- Missing: POST handler, _count for post counts

### src/app/api/tags/route.ts (31 lines)
- GET: returns all tags ordered by name
- POST: creates tag with auto-slug, returns existing if slug matches
- Missing: _count for post counts, auth check on POST

### src/app/api/posts/route.ts (103 lines)
- GET: paginated posts with category and tags
- POST: creates post with auth check, slug auto-generation

### src/app/api/posts/[id]/route.ts (139 lines)
- GET/PUT/DELETE for individual posts with auth checks

### src/app/admin/(admin)/layout.tsx (76 lines)
- Sidebar with nav links including Categories (already present)
- Uses useSession, signOut, usePathname

### src/app/admin/(admin)/posts/page.tsx (237 lines)
- Client component with table listing, filters, pagination
- Pattern to follow for categories/tags admin pages

### src/app/posts/page.tsx (68 lines)
- Server component, paginated post listing with PostCard
- Pattern for public listing pages

### src/app/tags/[slug]/page.tsx (75 lines)
- Server component, shows posts with a given tag
- Uses PostCard, already implemented

### src/components/post-card.tsx (51 lines)
- Reusable card: title, slug, excerpt, category, publishedAt, readingTime

### src/components/pagination.tsx (49 lines)
- Reusable pagination with basePath prop

### src/components/header.tsx (29 lines)
- Navigation: Home, Posts, About

### prisma/seed.ts (63 lines)
- Seeds admin user, 3 categories, 8 tags

## Section 5 — Existing Tests
No project test files exist. Test infrastructure (Jest + React Testing Library) is declared but not yet set up.

## Implementation Log

### Files Created
- `src/app/api/categories/[id]/route.ts` — GET/PUT/DELETE single category with auth, validation, post disassociation on delete
- `src/app/api/tags/[id]/route.ts` — GET/PUT/DELETE single tag with auth, validation, cascade delete via Prisma
- `src/app/admin/(admin)/categories/page.tsx` — admin categories page with inline create/edit/delete
- `src/app/admin/(admin)/tags/page.tsx` — admin tags page with inline create/edit/delete
- `src/app/categories/page.tsx` — public categories list with post counts
- `src/app/categories/[slug]/page.tsx` — public posts by category using PostCard

### Files Modified
- `src/app/api/categories/route.ts` — added POST handler with auth/validation, added _count to GET
- `src/app/api/tags/route.ts` — added auth check and validation to POST, added _count to GET
- `src/app/admin/(admin)/layout.tsx` — added Tags link to sidebar nav

### TypeScript Check: Passed (no errors)

## Browser Verification
Tool: playwright-cli
URL: http://localhost:3000
Dev Server Command: npm run dev (already running on port 3000)
Tool version: 0.1.13
Steps executed:
1. Logged in as admin@blog.com / admin123
2. Verified /admin/categories shows 3 categories (Life, Programming, Technology) with post counts
3. Created "JavaScript" category — appeared with slug "javascript" and 0 posts
4. Tested duplicate "JavaScript" — error "Category already exists" displayed
5. Verified /admin/tags shows 8 tags with post counts
6. Verified /categories public page shows all 4 categories with post counts
7. Verified /categories/programming shows category page with 0 posts
8. Verified /tags/react shows tag page
Screenshot: .playwright-cli/page-2026-05-15T02-08-02-504Z.png
Result: PASS
Server cleanup: confirmed (dev server was pre-existing)
Browser cleanup: confirmed
