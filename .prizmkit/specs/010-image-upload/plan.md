# F-010 Image Upload — Plan

## Key Components

1. **Upload API** — POST /api/upload accepts multipart/form-data, validates type/size, saves to public/uploads/
2. **ImageUpload Component** — drag-and-drop zone with preview, progress, error display
3. **Post Form Integration** — replace coverImageUrl text input with ImageUpload
4. **Media Admin Page** — /admin/media grid showing uploaded images with copy-URL
5. **Admin Sidebar** — add "Media" nav link

## Data Flow

- ImageUpload component → POST /api/upload (FormData) → server validates → saves to public/uploads/ → returns { url: "/uploads/filename.ext" }
- Media page → GET /api/media → scans public/uploads/ dir → returns file list with metadata

## Files to Create

- `src/app/api/upload/route.ts` — upload endpoint
- `src/app/api/media/route.ts` — list uploaded files
- `src/components/image-upload.tsx` — reusable upload component
- `src/app/admin/(admin)/media/page.tsx` — media gallery page

## Files to Modify

- `src/components/post-form.tsx` — replace cover image text input with ImageUpload
- `src/app/admin/(admin)/layout.tsx` — add Media nav link

## Tasks

- [x] Create POST /api/upload route with auth, file validation (type/size), sanitization, mkdir -p for public/uploads/
- [x] Create GET /api/media route that scans public/uploads/ and returns file metadata
- [x] Create ImageUpload component with drag-and-drop, file input fallback, preview, progress, error messages
- [x] Integrate ImageUpload into post-form.tsx replacing coverImageUrl text input
- [x] Create /admin/media page with image grid, thumbnails, names, sizes, dates, copy-URL button
- [x] Add "Media" link to admin sidebar navLinks array
