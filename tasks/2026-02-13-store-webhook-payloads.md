# Store Strava Webhook Payloads

**Date:** 2026-02-13
**Description:** Store raw Strava webhook payloads so they can be reprocessed if processing fails.

## Background

Strava webhook events sometimes fail during processing (e.g., Convex server errors, token issues, etc.). When this happens, the webhook payload is lost and the activity is never synced. By storing the raw payload immediately upon receipt, we can retry failed webhooks later.

## Implementation

- [x] Add `webhookPayloads` table to Convex schema
  - Fields: service, eventType, payload (raw JSON), status (received/processing/completed/failed), error message, processing metadata, timestamps
  - Indexes: by status (for querying failed payloads), by service
- [x] Create mutations for storing and updating webhook payloads
  - `storePayload` - insert raw payload immediately on receipt
  - `updatePayloadStatus` - update status as processing progresses
- [x] Update Strava webhook POST handler
  - Store payload as "received" before any processing
  - Update to "processing" when starting
  - Update to "completed" with result on success
  - Update to "failed" with error on failure
  - Always return 200 to Strava (prevent retries that would create duplicates)

## Notes

- Payloads are stored with `v.any()` for the raw body to accommodate any webhook format
- The `processedAt` and `error` fields support debugging and reprocessing workflows
- Status flow: received -> processing -> completed/failed
