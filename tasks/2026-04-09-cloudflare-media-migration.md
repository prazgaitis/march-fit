# Migrate Media CDN from Cloudinary to Cloudflare (Images + Stream)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. It is loosely modeled on the ExecPlan format at `~/code/quovy/PLANS.md` (not checked into this repo) — purpose/big-picture first, progress tracked as a living checklist, decisions recorded with rationale, and acceptance phrased as user-observable behavior.

## Purpose / Big Picture

Today every optimized image and video in march-fit is uploaded to Cloudinary and served via `res.cloudinary.com`. After this change, every new image is uploaded to Cloudflare Images and served via `imagedelivery.net/<account-hash>/<image-id>/<variant>`, and every new video is uploaded to Cloudflare Stream and served via an HLS manifest on `customer-<code>.cloudflarestream.com/<uid>/manifest/video.m3u8` (with a poster image also served by Stream). All historical Cloudinary media will have been copied to Cloudflare and the database updated so that nothing points at `res.cloudinary.com` anymore.

A user can see this working by:

1. Logging an activity with a photo from the activity log dialog. The image should appear in the feed, in the activity detail, and in the lightbox, all served from `imagedelivery.net` (confirmable by right-clicking the image and inspecting its URL). The image should be visibly resized at each of the three sizes (thumbnail 400px, feed 800px, full 1600px).
2. Logging an activity with a short video. The video should play inline in the feed using an HLS player, and its poster frame should come from Cloudflare Stream.
3. Connecting a Strava activity that has photos attached. Within ~90 seconds (the existing retry window) those photos should appear on the activity in the feed, again served from `imagedelivery.net`.
4. Opening an old activity that was uploaded before the migration. Its photos should still render correctly — they were copied to Cloudflare by the migration script and the database now points at the new IDs.
5. Visiting the admin "Wrapped" view. The floating background photos should still render.

Under the hood, the `cloudinaryPublicIds` database field is superseded by a new, vendor-neutral `optimizedMediaIds` field whose values are tagged strings (`cfi:<id>` for Cloudflare Images, `cfs:<uid>` for Cloudflare Stream). The old field remains as a read-only legacy fallback until the migration is fully verified, then is removed in a later pass.

## Progress

Use a list with checkboxes to summarize granular steps. Every stopping point must be documented here, even if it requires splitting a partially completed task into two.

- [x] (2026-04-09) Plan drafted; awaiting Cloudflare credentials from user.
- [x] (2026-04-10) Milestone 1 — Cloudflare account setup verified. Token scope confirmed for both Images and Stream via direct-upload endpoints. Three named variants (`thumbnail` 400×400 scale-down, `feed` 800×800 scale-down, `full` 1600×1600 scale-down, all `metadata: none`, `neverRequireSignedURLs: true`) created via API. Credentials written to `.env.local` (gitignored). Stream customer code `h5ouzxjjap66pdnj` and Images account hash `LILfsvnVD32t-fI_tWutyQ` recorded.
- [x] (2026-04-10) Milestone 2 — `optimizedMediaIds: v.optional(v.array(v.string()))` added to `activities` in `packages/backend/schema.ts` alongside the existing `cloudinaryPublicIds`. `pnpm typecheck` passes.
- [x] (2026-04-10) Milestone 3 — `apps/web/lib/media-optimizer.ts` rewritten to dispatch by tag (`cfi:` → Cloudflare Images, `cfs:` → Cloudflare Stream, untagged → legacy Cloudinary). New Convex action `packages/backend/actions/cloudflareMedia.ts` mints one-time direct upload URLs via an authenticated server-side call. New `packages/backend/lib/activityMedia.ts` helper DRYs the `hasAnyMedia` / `countMedia` checks that were duplicated across `activityLifecycle.ts`, `mutations/activities.ts`, and `lib/feedScore.ts`. `log` and `editActivity` mutations accept a new `optimizedMediaIds` arg alongside the legacy one. `activity-log-dialog.tsx` and `admin/badges/page.tsx` both wired to the new action. `pnpm typecheck` passes.
- [x] (2026-04-10) Milestone 4 — Strava webhook photo sync now uploads to Cloudflare Images (images) and Cloudflare Stream (videos) via the shared `lib/cloudflareApi.ts` helpers. New internal mutation `backfillCloudinary.patchOptimizedMediaIds` writes to the new field. Both the initial-sync and 90s-retry code paths are updated. Existing-photo counter sums both fields so partially-migrated activities don't double-upload. Typecheck passes.
- [x] (2026-04-10) Milestone 5 — Media display refactored to support Cloudflare Stream videos with HLS playback. `media-gallery.tsx` and `media-lightbox.tsx` now share a `MediaLightboxItem` shape carrying image URL and optional `hlsUrl`. New `hls-video.tsx` component uses `hls.js` on Chrome/Firefox, native playback on Safari. Video entries render as poster-image-plus-play-icon in the feed/grid, full HLS playback in the lightbox. Backend queries (`activities`, `algorithmicFeed`, `admin`, `users`, `wrapped`) project `optimizedMediaIds` alongside `cloudinaryPublicIds`. All frontend call sites use `resolveMediaIds()` to merge the legacy and new fields. Edit dialog splits tagged `cfi:`/`cfs:` from legacy IDs on save so each field is written independently. `hasAnyMedia`/`countMedia` helpers now wire through lifecycle, edit mutation, and feed-score backfill. Typecheck passes.
- [ ] Milestone 6 — Migration script: copy all historical Cloudinary assets into Cloudflare, populate `optimizedMediaIds`.
- [ ] Milestone 7 — Cutover: flip reads to prefer `optimizedMediaIds`, keep `cloudinaryPublicIds` as fallback for one week.
- [ ] Milestone 8 — Cleanup: remove Cloudinary env vars, delete `cloudinaryPublicIds` reads, drop the schema field after verification window.

## Surprises & Discoveries

Document unexpected behaviors, bugs, quirks of Cloudflare's APIs, or anything that shaped the implementation. Leave entries in chronological order with short evidence snippets.

- Observation: The first API token issued was valid and worked for Cloudflare Images, but Cloudflare Stream rejected all requests with error 10002 "Cloudflare Stream not enabled" — Stream is a separate paid product from Images and is not included with the Images $5/month subscription. A second token issued after Stream was enabled worked for both products.
  Evidence:
      # first token — Stream enabled check
      {"errors":[{"code":10002,"message":"Authorization Failure..."}],
       "messages":[{"code":10002,"message":"Cloudflare Stream not enabled"}]}
      # second token, after enabling Stream
      {"result":{"uploadURL":"https://upload.cloudflarestream.com/3611f3f0a6a3c0c0b19baec18e542a13","uid":"3611f3f0a6a3c0c0b19baec18e542a13"},"success":true}

- Observation: The Stream direct-upload response does not include the customer subdomain code needed for playback URLs. To discover it, fetch any video record via `GET /accounts/:id/stream/:uid` — the subdomain appears in the `thumbnail` and `playback.hls` fields as `customer-<code>.cloudflarestream.com`. For this account the code is `h5ouzxjjap66pdnj`.
  Evidence:
      "playback": {
        "hls": "https://customer-h5ouzxjjap66pdnj.cloudflarestream.com/.../manifest/video.m3u8"
      }

- Observation: Cloudflare Images ships with exactly one default variant named `public` (1366×768 scale-down). All three presets the app needs (`thumbnail`, `feed`, `full`) had to be created explicitly before the migration could begin. Created via `POST /accounts/:id/images/v1/variants`.
  Evidence:
      curl -s /variants → only "public" variant present before
      POST /variants {"id":"thumbnail",...} → 200
      POST /variants {"id":"feed",...} → 200
      POST /variants {"id":"full",...} → 200

## Decision Log

- Decision: Use **Cloudflare Images** for images and **Cloudflare Stream** for videos, rather than forcing everything into one product or keeping videos on Cloudinary.
  Rationale: Cloudflare Images is image-only. It does not accept video uploads. Cloudflare Stream is Cloudflare's purpose-built video service with HLS/DASH output, automatic thumbnailing, and per-minute storage billing. Using both gives us a single-vendor story (simpler billing, one dashboard, one set of credentials) at the cost of introducing an HLS player on the frontend. The user explicitly asked for video support, so Stream is in scope.
  Date/Author: 2026-04-09, Paul.

- Decision: Introduce a new database field `optimizedMediaIds: v.optional(v.array(v.string()))` rather than repurposing `cloudinaryPublicIds`.
  Rationale: Project convention (stated in user memory: "Don't name things after vendors") forbids naming new utilities after vendors, and the existing field is named after Cloudinary. Keeping the old field around during migration lets us roll out reads/writes independently and gives us a safe fallback if Cloudflare upload fails for a specific asset. Per the same memory note, already-deployed DB fields can stay, so we will not rename `cloudinaryPublicIds` — it will be left in place, then removed in the final cleanup pass.
  Date/Author: 2026-04-09, Paul.

- Decision: Tag IDs in `optimizedMediaIds` with a provider prefix: `cfi:<uuid>` for Cloudflare Images, `cfs:<uid>` for Cloudflare Stream.
  Rationale: The existing code used a `v/` prefix to distinguish videos from images inside a single provider. With two providers (Images vs Stream) and the possibility of a third one day, a two-letter namespace scales better and is self-describing. The prefix is cheap to parse in URL builders and leaves room for a future `conv:<storageId>` tag for raw Convex storage if we ever want to unify that path.
  Date/Author: 2026-04-09, Paul.

- Decision: Do all Cloudflare uploads **server-side via signed direct creator upload URLs**, not via client-side unsigned uploads.
  Rationale: Cloudinary allowed unsigned uploads via `upload_preset`, which is why the frontend could post directly to `api.cloudinary.com`. Cloudflare Images does support a "Direct Creator Upload" flow but it requires a short-lived one-time upload URL minted by an authenticated backend call. That is strictly better (no long-lived secret in the browser bundle), so we will take the small refactor: the frontend calls a Convex action to get an upload URL, then POSTs the file to that URL. Same two-step flow for Cloudflare Stream (`/stream/direct_upload`). This is a breaking change from the current upload flow and must be called out in Milestone 3.
  Date/Author: 2026-04-09, Paul.

- Decision: Use Cloudflare Images in **stored mode** ($5/month for 100,000 images) rather than the "use my own storage" transform-only mode.
  Rationale: Stored mode matches the current Cloudinary model one-for-one: upload bytes, get back an ID, serve via variant URLs. The transform-only alternative would require the source bytes to live in a publicly fetchable location — Convex storage URLs are signed and not designed for long-lived external access, so we would end up introducing Cloudflare R2 as a third system (upload → R2 → Cloudflare transforms from R2). That is strictly more architectural surface for an app that is nowhere near the 100k image threshold and will not be for years. The $5/month is effectively a flat "don't think about it" fee. If volume ever changes the math, switching to transform-only mode is a future decision with no lock-in — the public URLs on `imagedelivery.net` look the same either way.
  Date/Author: 2026-04-09, Paul.

- Decision: The migration script will **copy** assets rather than moving them, and will leave Cloudinary assets in place until Milestone 8.
  Rationale: Copying is idempotent and reversible; deletion is not. If Cloudflare has an outage or a regression is discovered post-cutover, we can flip reads back to `cloudinaryPublicIds` without data loss. The final cleanup milestone will delete the Cloudinary assets only after the verification window passes.
  Date/Author: 2026-04-09, Paul.

## Outcomes & Retrospective

Fill in at each major milestone. Compare result against the purpose above.

- (pending)

## Context and Orientation

This repo is a Turborepo monorepo for a fitness challenge app. The two directories that matter for this plan are `apps/web/` (Next.js 15 frontend) and `packages/backend/` (Convex backend). Media handling is deliberately isolated behind an abstraction at `apps/web/lib/media-optimizer.ts` so the rest of the frontend does not import the provider directly. That abstraction is the single most important file in this plan; it is where the Cloudinary-specific URL construction and upload logic currently lives.

The backend mirrors the same logic inside Strava's webhook handler at `packages/backend/actions/strava.ts`. That handler has its own `uploadPhotosToCloudinary` helper and its own `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_UPLOAD_PRESET` environment variables (separate from the `NEXT_PUBLIC_*` ones the frontend uses). Both code paths write into the same database field on the activities table: `activities.cloudinaryPublicIds`, defined in `packages/backend/schema.ts` around line 174 as an optional array of strings.

The `cloudinaryPublicIds` array uses a convention where video public IDs are prefixed with `v/` to distinguish them from images. That convention is load-bearing: the URL builder in `media-optimizer.ts` reads it to decide whether to build a `/video/upload/` URL or an `/image/upload/` URL. The new plan replaces this ad-hoc prefix with an explicit two-letter namespace (`cfi:`, `cfs:`) on the new field.

Display of media happens in several places, all of which go through `getOptimizedMediaUrl` from `media-optimizer.ts`:

- `apps/web/components/media-gallery.tsx` — the primary gallery used on activity cards in the feed and in the activity detail view. Has a `variant` prop of `"feed"` or `"detail"` which maps to the `feed` or `full` transform preset.
- `apps/web/components/dashboard/activity-feed.tsx` — the big feed component that renders cards using `media-gallery` and also renders a standalone lightbox for inspecting photos at full size.
- `apps/web/components/dashboard/activity-log-dialog.tsx` — where new activities are logged. This is the only place in the frontend that calls `uploadOptimizedMedia` today.
- `apps/web/lib/story-utils.ts` — builds a list of slides for the stories view.
- `apps/web/components/wrapped/floating-photos.tsx` — the end-of-year "wrapped" background decoration that pulls a sample of photos.
- `apps/web/components/user-avatar.tsx` — occasionally displays an optimized variant of a user avatar.
- `apps/web/hooks/use-optimized-media.ts` — a small hook that gates media optimization behind a per-user beta email list.

Backend queries that return `cloudinaryPublicIds` to the client (and will need to return the new field too):

- `packages/backend/queries/activities.ts` — list and detail queries.
- `packages/backend/queries/algorithmicFeed.ts` — the main feed.
- `packages/backend/queries/admin.ts` — the flagged-activity review UI.
- `packages/backend/queries/users.ts` — user activity lists.
- `packages/backend/queries/wrapped.ts` — pulls `cloudinaryPublicIds` directly for the wrapped background.

Backend mutations that accept `cloudinaryPublicIds` from the client (and will need to accept the new field too):

- `packages/backend/mutations/activities.ts` — both `logActivity` and the admin edit path.
- `packages/backend/lib/activityLifecycle.ts` — shared logic for "does this activity have media?" which decides whether to award the photo-bonus.
- `packages/backend/lib/feedScore.ts` — counts media for the feed ranking score.

Two existing backfill files exist in the repo for the *previous* backfill (Convex storage → Cloudinary): `packages/backend/actions/backfillCloudinaryMedia.ts` and `packages/backend/queries/backfillCloudinary.ts`. They are the best template for writing the new migration script. Do not delete them — they still do useful work for any activities uploaded during the migration window that land in Convex storage and need to be hoisted to the CDN.

Beta gating: today, optimized media is gated by `NEXT_PUBLIC_CLOUDINARY_BETA_EMAILS` (a comma-separated allow list). The gate returns `false` from `isMediaOptimizationEnabled` for users not on the list. That logic should be preserved by the migration — we simply rename the env var to `NEXT_PUBLIC_OPTIMIZED_MEDIA_BETA_EMAILS` (vendor-neutral), keeping the same allow-list semantics.

## Interfaces and Dependencies

Be prescriptive. The new contract that must exist at the end of the migration:

In `apps/web/lib/media-optimizer.ts`, the public API is unchanged at the call sites:

    export type TransformPreset = "thumbnail" | "feed" | "full" | "video_preview" | "video_feed";

    export function isOptimizedVideo(id: string): boolean;
    export function getOptimizedMediaUrl(id: string, preset?: TransformPreset): string;
    export function getOptimizedVideoPlaybackUrl(id: string): { hls: string; poster: string };
    export function isMediaOptimizationEnabled(email?: string | null): boolean;
    export const isMediaOptimizerConfigured: boolean;

    export interface UploadResult {
      id: string;            // new: tagged ID, e.g. "cfi:abc123" or "cfs:def456"
      url: string;           // delivery URL (first usable form, e.g. "feed" preset)
      resourceType: "image" | "video";
    }

    export async function uploadOptimizedMedia(file: File): Promise<UploadResult>;

`getOptimizedMediaUrl` inspects the tag:

- `cfi:<id>` → `https://imagedelivery.net/<ACCOUNT_HASH>/<id>/<variant>` where `<variant>` maps from the preset (thumbnail/feed/full).
- `cfs:<uid>` + image-ish preset → `https://customer-<CODE>.cloudflarestream.com/<uid>/thumbnails/thumbnail.jpg?height=<h>` (a poster frame).
- `cfs:<uid>` + `video_feed` → returns the HLS manifest URL, but callers that need both URL and poster should prefer `getOptimizedVideoPlaybackUrl`.

The new Convex action for minting upload URLs must exist at `packages/backend/actions/cloudflareMedia.ts`:

    export const createDirectUploadUrl = action({
      args: { kind: v.union(v.literal("image"), v.literal("video")) },
      handler: async (ctx, { kind }): Promise<{ uploadUrl: string; id: string }> => { ... }
    });

For `kind: "image"`, it calls Cloudflare Images `POST /accounts/:account_id/images/v2/direct_upload`. For `kind: "video"`, it calls Cloudflare Stream `POST /accounts/:account_id/stream/direct_upload`. Both return a one-time URL and a pre-assigned asset ID. The action returns the tagged form of the ID (`cfi:<id>` or `cfs:<uid>`) so the frontend never has to know the tag convention.

Environment variables that must exist after this migration:

- `CLOUDFLARE_ACCOUNT_ID` — backend only, used to call the Cloudflare API.
- `CLOUDFLARE_API_TOKEN` — backend only, scoped to `Cloudflare Images:Edit` and `Cloudflare Stream:Edit`. Never exposed to the client.
- `NEXT_PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH` — the public account hash used in `imagedelivery.net/<hash>/...` URLs. Safe to ship in the bundle.
- `NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE` — the customer subdomain used in `customer-<code>.cloudflarestream.com`. Safe to ship in the bundle.
- `NEXT_PUBLIC_OPTIMIZED_MEDIA_BETA_EMAILS` — replaces `NEXT_PUBLIC_CLOUDINARY_BETA_EMAILS`.

The old Cloudinary variables (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET`, `NEXT_PUBLIC_CLOUDINARY_BETA_EMAILS`) must remain readable through Milestone 7 so the migration script can download from Cloudinary. They are removed in Milestone 8.

## Plan of Work

The work is organized into eight milestones described in prose below. Each milestone produces something demonstrable, and each can be committed and shipped independently. Do not collapse milestones together; the whole point of this shape is to keep the riskier pieces (schema, cutover, cleanup) isolated from the cheaper ones (Cloudflare setup, frontend rewrite).

### Milestone 1 — Cloudflare account setup and smoke test

Before touching any code, verify that Cloudflare Images and Cloudflare Stream are both enabled on the account and that an API token with the right scopes can upload an image and a video from the command line. This is cheap, catches setup mistakes before they land in application code, and produces the account hash and stream customer code needed by later milestones.

Cloudflare setup (the user will do this in the dashboard; record the resulting values in `.env.local`):

1. Enable **Cloudflare Images** on the account. Note the account ID and the account hash (found in the Images dashboard; the hash is the opaque string that appears in `imagedelivery.net/<hash>/...` URLs).
2. Enable **Cloudflare Stream** on the account. Note the customer subdomain code (found in the Stream dashboard, e.g. `customer-abc123xyz`).
3. Create an API token with the permissions `Account → Cloudflare Images → Edit` and `Account → Stream → Edit`, scoped to the specific account. Save the token string.
4. Create three **Cloudflare Images variants** in the dashboard, matching the existing Cloudinary transform sizes:
   - Name `thumbnail`, fit `scale-down`, width `400`, metadata `none`.
   - Name `feed`, fit `scale-down`, width `800`, metadata `none`.
   - Name `full`, fit `scale-down`, width `1600`, metadata `none`.
   (Stream handles video sizing automatically via adaptive bitrate, so no variants are needed there.)

Smoke test commands (run from any shell, not from inside the repo, with the account id and token exported):

    # Direct upload an image from a local file:
    curl -X POST \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -F "file=@/tmp/test.jpg" \
      "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/images/v1"

    # Expected: 200 with JSON containing `result.id` and `result.variants` (three URLs, one per variant).

    # Direct upload a video to Stream:
    curl -X POST \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -F "file=@/tmp/test.mp4" \
      "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/stream"

    # Expected: 200 with JSON containing `result.uid`, `result.preview` (mp4 preview),
    # `result.playback.hls` (HLS manifest URL), and `result.thumbnail` (poster URL).

Acceptance: both curl commands return 200 and the image's `feed` variant URL loads in a browser. Record the account ID, account hash, API token, and stream customer code in `apps/web/.env.local` (frontend vars) and the root `.env.local` (backend vars). Do not commit the token.

### Milestone 2 — Add `optimizedMediaIds` to the schema

Edit `packages/backend/schema.ts`, locate the activities table around line 174, and add a new optional field immediately below `cloudinaryPublicIds`:

    optimizedMediaIds: v.optional(v.array(v.string())), // Tagged media IDs: "cfi:<id>" for Cloudflare Images, "cfs:<uid>" for Cloudflare Stream

Do not remove or modify `cloudinaryPublicIds`. Both fields coexist through Milestone 7.

Run `pnpm dev` to let Convex pick up the schema change automatically (per the user's global instruction: local Convex does not need manual deploys). No data migration is required at this point because the field is optional.

Acceptance: `pnpm typecheck` passes and Convex dashboard at `http://localhost:6791` shows the new column on the activities table.

### Milestone 3 — Rewrite `media-optimizer.ts` for Cloudflare

Replace the body of `apps/web/lib/media-optimizer.ts` with a Cloudflare-backed implementation that preserves the public API listed above in *Interfaces and Dependencies*. Key implementation notes:

1. Read the new env vars (`NEXT_PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH`, `NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE`, `NEXT_PUBLIC_OPTIMIZED_MEDIA_BETA_EMAILS`) rather than the old Cloudinary ones.
2. Keep `isMediaOptimizerConfigured` true iff the account hash is present. The stream customer code is only required for video playback, so its absence should not disable image delivery.
3. Rewrite `isOptimizedVideo` to check the `cfs:` prefix (with a fallback to the legacy `v/` prefix so that any stray Cloudinary IDs still passing through during the transition keep working).
4. Rewrite `getOptimizedMediaUrl(id, preset)`:
   - If the ID starts with `cfi:`, strip the tag and return `https://imagedelivery.net/<HASH>/<id>/<variant>` where variant is the name of the preset (`thumbnail` / `feed` / `full`). Unknown presets fall back to `feed`.
   - If the ID starts with `cfs:`, return a Stream thumbnail URL for all image-ish presets: `https://customer-<CODE>.cloudflarestream.com/<uid>/thumbnails/thumbnail.jpg?height=<h>` with h ∈ {240, 480, 960} matching thumbnail/feed/full.
   - Legacy `cloudinaryPublicIds` values are handled by a separate `getLegacyCloudinaryUrl` helper kept in the same file (internal) — it contains the old URL builder verbatim. Callers at the display sites in Milestone 5 will invoke the legacy helper when they see a value on the old field.
5. Add a new exported `getOptimizedVideoPlaybackUrl(id)` that for a `cfs:` ID returns `{ hls: "https://customer-<CODE>.cloudflarestream.com/<uid>/manifest/video.m3u8", poster: "https://customer-<CODE>.cloudflarestream.com/<uid>/thumbnails/thumbnail.jpg" }`.
6. Rewrite `uploadOptimizedMedia(file)`:
   - Call a new Convex action `api.cloudflareMedia.createDirectUploadUrl` with `{ kind: isVideo ? "video" : "image" }`. It returns `{ uploadUrl, id }` where `id` is already tagged (`cfi:` or `cfs:`).
   - POST the file to `uploadUrl` as multipart/form-data with the single field `file`. (Cloudflare's direct upload endpoints accept this shape for both Images and Stream.)
   - On success, return `{ id, url: getOptimizedMediaUrl(id, "feed"), resourceType }`.

The action `createDirectUploadUrl` lives in a new file `packages/backend/actions/cloudflareMedia.ts`:

- For images: `POST https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/images/v2/direct_upload` with an auth header `Authorization: Bearer <API_TOKEN>` and an empty body. The response contains `result.uploadURL` and `result.id`. Return `{ uploadUrl: result.uploadURL, id: "cfi:" + result.id }`.
- For videos: `POST https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/stream/direct_upload` with the same auth header and a JSON body `{ "maxDurationSeconds": 300 }` (we don't expect activity videos longer than 5 minutes; bump later if needed). The response contains `result.uploadURL` and `result.uid`. Return `{ uploadUrl: result.uploadURL, id: "cfs:" + result.uid }`.
- The action must read `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` from `process.env` and must throw a clear error if either is missing (so the frontend's `isMediaOptimizerConfigured` is the only gate on UX, but server-side failures surface as real errors rather than silent 401s).

Update `apps/web/components/dashboard/activity-log-dialog.tsx` so that when it calls `uploadOptimizedMedia` it passes the returned `id` into the existing `cloudinaryPublicIds` array it builds for `logActivity`. **However**, this field must now be sent on `optimizedMediaIds` (the new field). The mutation in `packages/backend/mutations/activities.ts` accepts both fields during the transition; see Milestone 5.

Acceptance for this milestone (no UI changes visible yet because nothing reads `optimizedMediaIds`):

1. `pnpm typecheck` passes.
2. `pnpm -F web build` passes.
3. Manually call the action from the Convex dashboard: run `actions/cloudflareMedia:createDirectUploadUrl` with `{"kind":"image"}` and observe a 200 response with `uploadUrl` containing `upload.imagedelivery.net` and an `id` starting with `cfi:`.

### Milestone 4 — Strava webhook uploads to Cloudflare

Update `packages/backend/actions/strava.ts` (the `uploadPhotosToCloudinary` helper and its caller). Rename the function to `uploadPhotosToCloudflare` and rewrite its body: for each URL, fetch the blob, detect video vs image by content-type, and then upload via the standard Cloudflare API rather than a direct upload URL (because this code path is already running on the server with credentials).

- Image: `POST https://api.cloudflare.com/client/v4/accounts/<id>/images/v1` with `Authorization: Bearer <token>` and a multipart body containing `file`. Response has `result.id`. Push `"cfi:" + result.id`.
- Video: `POST https://api.cloudflare.com/client/v4/accounts/<id>/stream` with the same auth header and a multipart body containing `file`. Response has `result.uid`. Push `"cfs:" + result.uid`.

The caller (the internal action that processes Strava webhooks, around lines 1033–1086 of `strava.ts`) must patch the activity with the new IDs on `optimizedMediaIds`, not `cloudinaryPublicIds`. The existing retry-at-90-seconds logic is unchanged.

Acceptance: open a test Strava activity with photos, trigger the webhook (or manually invoke the retry action), and observe that the activity row in the Convex dashboard gains an `optimizedMediaIds` array whose entries start with `cfi:`.

### Milestone 5 — Display components read from the new field

For every display site listed in *Context and Orientation*, change the data flow so it prefers `activity.optimizedMediaIds` when present and falls back to `activity.cloudinaryPublicIds` when only the old field exists.

The recommended shape is a small helper in `apps/web/lib/media-optimizer.ts`:

    export function resolveMediaIds(activity: {
      optimizedMediaIds?: string[] | null;
      cloudinaryPublicIds?: string[] | null;
    }): string[] {
      if (activity.optimizedMediaIds && activity.optimizedMediaIds.length > 0) {
        return activity.optimizedMediaIds;
      }
      return activity.cloudinaryPublicIds ?? [];
    }

And `getOptimizedMediaUrl` automatically handles both because it dispatches by tag prefix (`cfi:`, `cfs:`, or legacy Cloudinary if no tag).

Specific files to update (search-and-replace is not enough — check each call site so you understand the shape of the data it has):

- `apps/web/components/media-gallery.tsx` — the `optimizedMediaIds` prop name it accepts already matches the new field, but the data passed in must come from `resolveMediaIds`. Update the parents (`activity-feed.tsx`, `activity-log-dialog.tsx` preview, any detail page) to use the helper.
- `apps/web/components/dashboard/activity-feed.tsx` — feed cards and the lightbox. Replace direct reads of `cloudinaryPublicIds` with the helper.
- `apps/web/lib/story-utils.ts` — replace direct reads.
- `apps/web/components/wrapped/floating-photos.tsx` — replace direct reads. Note that this component filters out videos (today by checking `!id.startsWith("v/")`). Update to filter by `!id.startsWith("cfs:")` AND still filter the legacy `v/` form.
- `apps/web/components/user-avatar.tsx` — replace direct reads.

For videos: `media-gallery.tsx` currently treats the entire collection as images. Add a minimal branch: if a resolved ID is `cfs:*`, render a `<video>` element with the HLS manifest from `getOptimizedVideoPlaybackUrl`, and a `poster` attribute with the thumbnail URL. For HLS playback, Safari plays HLS natively — so on Safari, set `src` to the HLS URL and it works. For Chrome/Firefox, use `hls.js` (already used elsewhere? if not, add it: `pnpm -F web add hls.js`). The feed-variant renders the first frame as a still image (via the poster URL at width 800) and plays on click.

Backend queries and mutations also need to carry the new field through:

- In `packages/backend/queries/activities.ts`, `queries/algorithmicFeed.ts`, `queries/admin.ts`, `queries/users.ts`, `queries/wrapped.ts`, add `optimizedMediaIds: activity.optimizedMediaIds` to every projected return alongside the existing `cloudinaryPublicIds`.
- In `packages/backend/mutations/activities.ts`, add `optimizedMediaIds: v.optional(v.array(v.string()))` to the args of `logActivity` and the admin edit mutation. Persist it on insert/update alongside (not instead of) `cloudinaryPublicIds`. A new write should land in `optimizedMediaIds`; `cloudinaryPublicIds` should only be written by the migration script.
- In `packages/backend/lib/activityLifecycle.ts`, update the "has media" check at lines ~152–172 to consider `optimizedMediaIds` as well as the existing fields. Do the same in `lib/feedScore.ts` for the media count.

Acceptance:

1. Log a new activity with a photo. The photo must render in the feed via `imagedelivery.net/<hash>/<id>/feed`. Verify by right-clicking the image in the browser and inspecting its `src`.
2. Log a new activity with a short video. The video must render in the feed with an HLS source from `customer-<code>.cloudflarestream.com` and a poster image.
3. Old activities (those with `cloudinaryPublicIds` set but no `optimizedMediaIds`) must continue to render correctly via the legacy code path, served from `res.cloudinary.com`.

### Milestone 6 — Migration script: copy Cloudinary assets to Cloudflare

Create a new file `packages/backend/actions/backfillCloudflareMedia.ts` modeled on the existing `packages/backend/actions/backfillCloudinaryMedia.ts`. It should be an internal action callable via `npx convex run`.

The script's job: for every activity where `cloudinaryPublicIds` is set but `optimizedMediaIds` is empty, download each Cloudinary asset at its original quality, upload it to Cloudflare (Images or Stream by content-type), and write the resulting tagged IDs to `optimizedMediaIds` *without touching* `cloudinaryPublicIds`.

Details:

- Source URL for a Cloudinary image: `https://res.cloudinary.com/<CLOUD_NAME>/image/upload/<publicId>` — note: *without* a transform, so we get the original.
- Source URL for a Cloudinary video (legacy `v/` prefix): strip the prefix, then `https://res.cloudinary.com/<CLOUD_NAME>/video/upload/<rawId>.mp4`.
- Batch arguments: `{ limit: number, dryRun: boolean, activityId?: string }`. Default `limit = 50`, `dryRun = true`. Named argument `activityId` allows targeting a single activity for recovery.
- On each activity, fetch the Cloudinary asset, detect whether it is a video by the URL path (`/video/upload/`), upload to the appropriate Cloudflare endpoint with the authenticated API token, and patch the activity via an internal mutation `internal.apiMutations.setOptimizedMediaIds` (new, idempotent, takes an activity ID and an array and writes it only if `optimizedMediaIds` is currently empty — this makes the migration safely re-runnable).
- Log every asset migrated with its old and new ID so we have a replayable audit trail in case a Cloudflare asset gets lost.
- Handle failures per-asset: if one asset fails, log and continue; do not abort the batch.

Run it in production in three stages to de-risk:

1. `dryRun: true, limit: 10` — prints the work plan, no writes.
2. `dryRun: false, limit: 10` — migrate ten activities, verify in the UI.
3. `dryRun: false, limit: 10000` — full run. Can be invoked multiple times because of the idempotent `only if empty` guard in the mutation.

Acceptance: after the final run, `npx convex data activities --prod | wc -l` count of activities with `cloudinaryPublicIds` non-empty and `optimizedMediaIds` empty is zero. The wrapped page still shows the same number of background photos as before migration.

### Milestone 7 — Cutover window and verification

Nothing to code in this milestone; it is a timed watch. After Milestone 6 completes, leave the system running for one week with both fields populated. New writes go to `optimizedMediaIds` (via the updated mutation). Old activities have both fields populated (the migration copied Cloudinary → Cloudflare). Reads prefer the new field, fall back to the old one.

During this week: monitor error logs for any reference to `res.cloudinary.com` in unexpected places (indicates a display site that wasn't updated in Milestone 5). Ask one or two beta users to confirm feed rendering is unchanged. If anything is wrong, we can flip the resolve helper to prefer `cloudinaryPublicIds` as a panic switch — no data loss.

Acceptance: one full week with no Cloudflare-media-related bug reports and no `res.cloudinary.com` references served to users for activities that have `optimizedMediaIds` set.

### Milestone 8 — Cleanup

Only after Milestone 7's verification window passes:

1. Delete the legacy `getLegacyCloudinaryUrl` helper from `apps/web/lib/media-optimizer.ts`.
2. Remove the fallback branch in `resolveMediaIds` so it reads `optimizedMediaIds` only. Any activity whose `optimizedMediaIds` is empty at this point is a migration bug and should be investigated first.
3. Remove `cloudinaryPublicIds` from the write path in mutations and from the return shape in queries (the schema field can stay — per project convention, deployed DB fields don't have to be dropped, and leaving it avoids a risky schema migration).
4. Remove the old Cloudinary environment variables from `.env.example`, Vercel, and any local `.env.local` files.
5. Delete the old action files `packages/backend/actions/backfillCloudinaryMedia.ts`, `packages/backend/mutations/backfillCloudinary.ts`, and `packages/backend/queries/backfillCloudinary.ts` if they are no longer referenced.
6. Delete the Cloudinary assets themselves via `DELETE /admin/api/v1_1/<cloud>/resources/image/upload` or the dashboard, and cancel the Cloudinary subscription.

Acceptance: `rg -i cloudinary` across the repo returns zero results outside of this plan file and historical task notes in `tasks/`. `pnpm build` still passes.

## Concrete Steps

Each command assumes the working directory is the repository root unless stated otherwise. Update this section as work proceeds so a future contributor picking up mid-migration knows exactly where things stand.

Start local Convex and Next.js in one terminal:

    pnpm dev

In a separate terminal for testing Cloudflare credentials (these two commands should be run once, after Milestone 1):

    curl -X POST \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -F "file=@/tmp/test.jpg" \
      "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/images/v1"

    curl -X POST \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -F "file=@/tmp/test.mp4" \
      "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/stream"

To run the migration against a single activity for testing (after Milestone 6):

    npx convex run actions/backfillCloudflareMedia:backfill '{"dryRun": true, "limit": 1}'

To run against production (after local verification):

    npx convex run actions/backfillCloudflareMedia:backfill '{"dryRun": false, "limit": 10}' --prod

To check remaining unmigrated activities:

    npx convex run queries/backfillCloudflareMedia:countRemaining '{}' --prod

Typecheck, lint, build — run before every commit:

    pnpm typecheck
    pnpm lint
    pnpm -F web build

## Validation and Acceptance

The system is "done" when all of the following are true:

1. Logging a new image via the activity dialog produces a request to `api.cloudflare.com/.../images/v2/direct_upload` (visible in the browser network tab), followed by a multipart POST to an `upload.imagedelivery.net/...` URL, followed by a Convex mutation that includes `optimizedMediaIds: ["cfi:<id>"]` in its args.
2. The same flow for a video produces a request to `stream/direct_upload`, followed by a multipart POST to the returned upload URL, followed by a Convex mutation with `optimizedMediaIds: ["cfs:<uid>"]`.
3. An activity whose `cloudinaryPublicIds` is set but whose `optimizedMediaIds` is empty still renders correctly (proves the legacy fallback works during transition).
4. After the migration script runs, every activity that previously had `cloudinaryPublicIds` non-empty also has `optimizedMediaIds` non-empty, with matching array lengths.
5. Right-clicking any feed image on a post-migration page and inspecting the URL shows `imagedelivery.net`, not `res.cloudinary.com`.
6. A video in the feed plays inline when clicked. Its `<video>` element's `src` (or `hls.js` source) points at `customer-<code>.cloudflarestream.com/<uid>/manifest/video.m3u8`.
7. `pnpm typecheck`, `pnpm lint`, `pnpm -F web build`, and `pnpm test -- --run` all pass.
8. `rg -i cloudinary` returns zero hits outside of `tasks/` historical files after Milestone 8.

## Idempotence and Recovery

Milestones 1 through 5 are additive and reversible: they add a new field, new env vars, new files, and new code paths while leaving the Cloudinary path intact. If anything goes wrong, revert the commit.

Milestone 6 (the migration script) is idempotent by construction: the internal mutation `setOptimizedMediaIds` only writes when the target field is currently empty. Re-running the script skips already-migrated activities. If a specific activity's migration failed (e.g., Cloudflare rejected one asset), clear its `optimizedMediaIds` with a one-off mutation and re-run the script targeted at that activity.

Milestone 7 is a time window with an explicit rollback path: flip the resolve helper to prefer the legacy field, ship, done. No data is harmed.

Milestone 8 is destructive and irreversible (Cloudinary assets are deleted). Do not execute it until Milestone 7's verification week has passed with zero incidents, and take a Cloudinary account-wide backup first via the Cloudinary dashboard's export feature or `cld sync`.

## Artifacts and Notes

Keep a short log of commands that proved something worked, as indented blocks, for future diagnostics. Fill in as implementation proceeds.

    # 2026-04-09 — plan drafted; no artifacts yet.

    # 2026-04-10 — Milestone 1 complete. Evidence:
    # Images direct_upload (scope check, produced an unused upload URL that self-expires):
    #   {"result":{"id":"429c1821-3b99-45f8-099b-85bbdf73fd00",
    #     "uploadURL":"https://upload.imagedelivery.net/LILfsvnVD32t-fI_tWutyQ/429c1821-3b99-45f8-099b-85bbdf73fd00"},
    #    "success":true}
    # Stream direct_upload:
    #   {"result":{"uploadURL":"https://upload.cloudflarestream.com/3611f3f0a6a3c0c0b19baec18e542a13",
    #     "uid":"3611f3f0a6a3c0c0b19baec18e542a13"},
    #    "success":true}
    # Variants list after creation:
    #   thumbnail (400x400 scale-down, metadata none, public)
    #   feed      (800x800 scale-down, metadata none, public)
    #   full      (1600x1600 scale-down, metadata none, public)

## Notes and Revisions

- 2026-04-09: Initial draft. Covers the full Cloudinary → Cloudflare migration including Stream for videos. Awaiting Cloudflare credentials from the user before implementation can begin.
