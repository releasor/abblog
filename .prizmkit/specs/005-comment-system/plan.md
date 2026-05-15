# F-005 Comment System — Implementation Plan

## Architecture

The Comment model already exists in prisma/schema.prisma (Comment with PENDING/APPROVED/REJECTED status). No schema changes needed.

### Data Flow
- Public: Visitor submits comment → POST /api/posts/[postId]/comments → PENDING status → Admin reviews
- Public: GET /api/posts/[postId]/comments → returns APPROVED comments only
- Admin: GET /api/comments?status=X → returns all comments filtered by status
- Admin: PATCH /api/comments/[id] → update status (approve/reject)
- Admin: DELETE /api/comments/[id] → delete comment
- Rate limiting: in-memory Map keyed by IP, 1 req/min

### Files to Create
1. `src/app/api/posts/[postId]/comments/route.ts` — public comment API (GET approved, POST new)
2. `src/app/api/comments/route.ts` — admin comment list API (GET all with filtering)
3. `src/app/api/comments/[id]/route.ts` — admin comment update/delete API (PATCH, DELETE)
4. `src/components/comment-form.tsx` — client component for comment submission
5. `src/components/comment-list.tsx` — client component for displaying approved comments
6. `src/app/admin/(admin)/comments/page.tsx` — admin comment management page

### Files to Modify
1. `src/app/posts/[slug]/page.tsx` — append comment section below PostContent
2. `src/app/admin/(admin)/posts/page.tsx` — add pending comment count badge

## Tasks

- [x] 1. Create public comment API: GET /api/posts/[postId]/comments (approved only) and POST /api/posts/[postId]/comments (with validation and rate limiting)
- [x] 2. Create admin comment API: GET /api/comments with status filtering, PATCH /api/comments/[id] for status updates, DELETE /api/comments/[id]
- [x] 3. Create CommentForm client component with name/email/content fields and validation
- [x] 4. Create CommentList client component showing approved comments with relative timestamps
- [x] 5. Update public post page to include CommentList and CommentForm below post content
- [x] 6. Create admin comments management page with status tabs, comment rows, and action buttons
- [x] 7. Add pending comment count badge to admin posts list
- [x] 8. Run build and verify all acceptance criteria
