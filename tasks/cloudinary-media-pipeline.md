# Cloudinary Media Pipeline

**Date:** 2026-03-07
**Description:** Replace direct Convex file storage with Cloudinary for media uploads. Get automatic image optimization, responsive variants, and video transcoding.

## Approach

Upload directly to Cloudinary from the client using unsigned upload presets. Store Cloudinary public IDs in the database. Use URL transformations for optimized delivery (thumbnails for feed/stories, full-size for lightbox).

## Implementation

### Phase 1: Upload Pipeline
- [x] Add Cloudinary env vars (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`)
- [x] Create `lib/cloudinary.ts` utility for uploads and URL generation
- [x] Update `activity-log-dialog.tsx` to upload to Cloudinary instead of Convex storage
- [x] Update schema: add `cloudinaryIds` field (array of public IDs) alongside existing `mediaIds`
- [x] Update `log` mutation to accept `cloudinaryIds`

### Phase 2: Display Pipeline
- [x] Create `getCloudinaryUrl(publicId, transforms)` helper with presets (thumbnail, feed, full, video)
- [x] Update `MediaGallery` to use optimized Cloudinary URLs
- [x] Update `MediaLightbox` to use full-quality Cloudinary URLs
- [x] Update backend queries to return `cloudinaryIds` alongside `mediaUrls`
- [x] Update story viewer to use optimized URLs

### Phase 3: Cleanup
- [ ] Migrate existing Convex media to Cloudinary (optional, can keep dual support)
- [ ] Remove `generateUploadUrl` mutation once fully migrated
