# CSV Export from Admin Panel

**Date:** 2026-04-01
**Description:** Add the ability to export all activity data for a challenge as a CSV file from the admin panel. The export must paginate through activities to avoid hitting Convex limits and email the admin a download link when the file is ready.

## Requirements

- [x] Add `exports` table to schema to track export jobs
- [x] Create internal query for paginated activity fetching
- [x] Create Convex action that paginates through all activities, builds CSV, stores in Convex file storage
- [x] Create mutation to kick off export job
- [x] Send email with download link when export completes
- [x] Add admin UI page under `/admin/exports`
- [x] Add "Exports" nav item to admin layout

## Implementation Notes

- Activities are fetched in pages of 500 using cursor-based pagination via the `challengeId` index
- CSV is generated server-side in a Convex action to handle large datasets
- File is stored in Convex storage and a signed URL is generated for download
- Email is sent via Resend using the existing email template system
- Export status is tracked in the `exports` table (pending → processing → completed / failed)
