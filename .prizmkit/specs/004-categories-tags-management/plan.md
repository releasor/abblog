# F-004: Categories & Tags Management — Plan

## Key Components
- **API Routes**: Categories CRUD + Tags CRUD with auth, validation, post counts
- **Admin Pages**: /admin/categories, /admin/tags with inline create/edit/delete
- **Public Pages**: /categories (list), /categories/[slug] (posts by category)
- **Validation**: name 1-50 chars, slug unique, "Category already exists" error

## Data Flow
- Schema already has Category, Tag, PostTag models (no migration needed)
- Delete category: set post.categoryId to null via Prisma update
- Delete tag: PostTag entries cascade-deleted via onDelete: Cascade
- Post counts: use Prisma _count relation

## Files to Create
- `src/app/api/categories/[id]/route.ts` — GET/PUT/DELETE single category
- `src/app/api/tags/[id]/route.ts` — GET/PUT/DELETE single tag
- `src/app/admin/(admin)/categories/page.tsx` — admin categories page
- `src/app/admin/(admin)/tags/page.tsx` — admin tags page
- `src/app/categories/page.tsx` — public categories list
- `src/app/categories/[slug]/page.tsx` — public posts by category

## Files to Modify
- `src/app/api/categories/route.ts` — add POST handler, add _count to GET
- `src/app/api/tags/route.ts` — add _count to GET, add auth + validation to POST

## Tasks

- [x] 1. Update GET /api/categories to include post counts (_count) and add POST handler with auth, validation (name 1-50 chars), slug auto-generation, unique slug check, "Category already exists" error
- [x] 2. Create /api/categories/[id] route with GET (single category with post count), PUT (update name/slug with validation), DELETE (disassociate posts by setting categoryId to null, then delete category)
- [x] 3. Update GET /api/tags to include post counts (_count) and update POST handler with auth check and validation (name 1-50 chars)
- [x] 4. Create /api/tags/[id] route with GET (single tag with post count), PUT (update name/slug with validation), DELETE (PostTag cascade deletes automatically)
- [x] 5. Create /admin/categories page — client component with table (name, slug, post count, edit/delete), inline create form at top, inline edit capability
- [x] 6. Create /admin/tags page — client component with table (name, slug, post count, edit/delete), inline create form at top, inline edit capability
- [x] 7. Create /categories public page — server component listing all categories with post counts, linking to /categories/[slug]
- [x] 8. Create /categories/[slug] public page — server component listing published posts in a category using PostCard
