# Plan — F-003: Post Management CRUD

## Key Components

1. **Schema Update**: Add `categoryId` to Post model, create migration
2. **Dependencies**: Install @tiptap/react + extensions for rich text editing
3. **Slug Utility**: `src/lib/slugify.ts` — URL-friendly slug generation from title
4. **API Routes**: CRUD endpoints for posts, plus categories/tags read endpoints
5. **Admin Pages**: Post list, create form, edit form under /admin/posts/
6. **Public Page**: /posts/[slug] — published post viewer

## Data Flow

- Admin creates/edits post via form → API validates & persists → list refreshes
- Slug auto-generated from title on client, editable by admin
- Status change to PUBLISHED sets publishedAt timestamp server-side
- Delete cascades to PostTag and Comment via Prisma onDelete: Cascade
- Public page queries by slug, filters to PUBLISHED only

## Files to Create/Modify

### Modify
- `prisma/schema.prisma` — add categoryId to Post, add category relation
- `prisma/seed.ts` — add sample tags
- `src/app/globals.css` — add tiptap editor styles

### Create
- `src/lib/slugify.ts` — slug generation utility
- `src/app/api/posts/route.ts` — GET (list+pagination), POST (create)
- `src/app/api/posts/[id]/route.ts` — GET, PUT, DELETE single post
- `src/app/api/categories/route.ts` — GET categories for dropdown
- `src/app/api/tags/route.ts` — GET tags for multi-select
- `src/app/admin/(admin)/posts/page.tsx` — post list with table, filtering, pagination
- `src/app/admin/(admin)/posts/new/page.tsx` — create post form
- `src/app/admin/(admin)/posts/[id]/edit/page.tsx` — edit post form
- `src/components/post-form.tsx` — shared create/edit form component
- `src/components/tiptap-editor.tsx` — rich text editor wrapper
- `src/app/posts/[slug]/page.tsx` — public post view page

## Tasks

- [x] T1: Update Prisma schema — add categoryId to Post, add category relation, run migration
- [x] T2: Install @tiptap/react and extensions, verify versions
- [x] T3: Create slug utility (src/lib/slugify.ts)
- [x] T4: Create API routes — /api/posts (GET list+pagination, POST create), /api/posts/[id] (GET, PUT, DELETE)
- [x] T5: Create API routes — /api/categories (GET), /api/tags (GET)
- [x] T6: Create tiptap editor component (src/components/tiptap-editor.tsx)
- [x] T7: Create post form component (src/components/post-form.tsx) with title, slug, editor, excerpt, cover image, category, tags, status
- [x] T8: Create admin post list page (/admin/posts) with table, status filter, date sort, pagination
- [x] T9: Create admin post create page (/admin/posts/new)
- [x] T10: Create admin post edit page (/admin/posts/[id]/edit)
- [x] T11: Create public post page (/posts/[slug]) — published only, 404 for drafts
- [x] T12: Update seed.ts to include sample tags
- [x] T13: Build verification — ensure TypeScript compiles, no errors
