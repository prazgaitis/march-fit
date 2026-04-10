/**
 * Media optimization layer.
 *
 * Backed by Cloudflare Images (photos) and Cloudflare Stream (videos).
 * Media IDs carry a two-letter provider tag:
 *   cfi:<id>   Cloudflare Images
 *   cfs:<uid>  Cloudflare Stream
 * Historical Cloudinary public IDs (no tag, or a legacy `v/` prefix for
 * videos) are still recognized and served through an internal legacy URL
 * builder until the Cloudinary → Cloudflare backfill has been retired.
 */

const IMAGES_ACCOUNT_HASH = process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH;
const STREAM_CUSTOMER_CODE = process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE;
const BETA_EMAILS = process.env.NEXT_PUBLIC_OPTIMIZED_MEDIA_BETA_EMAILS;

// Legacy Cloudinary cloud name, kept readable through the migration so
// activities that only have pre-migration `cloudinaryPublicIds` still render.
const LEGACY_CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/** True when the media optimizer is configured (Cloudflare Images env vars present). */
export const isMediaOptimizerConfigured = !!IMAGES_ACCOUNT_HASH;

/**
 * Check whether optimized media is enabled for a given user email.
 * When BETA_EMAILS is set, only those emails see optimized media.
 * When BETA_EMAILS is unset (but the optimizer is configured), everyone sees it.
 */
export function isMediaOptimizationEnabled(email?: string | null): boolean {
  if (!isMediaOptimizerConfigured) return false;
  if (!BETA_EMAILS) return true;
  if (!email) return false;
  const allowed = BETA_EMAILS.split(",").map((e) => e.trim().toLowerCase());
  return allowed.includes(email.toLowerCase());
}

// ---------------------------------------------------------------------------
// Transform presets
// ---------------------------------------------------------------------------

export type TransformPreset =
  | "thumbnail"
  | "feed"
  | "full"
  | "video_preview"
  | "video_feed";

// Cloudflare Images variant names, created once in the Images dashboard / API.
// Must match the variant IDs configured on the account.
const IMAGE_VARIANT_FOR_PRESET: Record<TransformPreset, string> = {
  thumbnail: "thumbnail",
  feed: "feed",
  full: "full",
  video_preview: "feed",
  video_feed: "full",
};

// Stream thumbnail heights (pixels) per preset, used to generate poster images
// for video entries in image-shaped contexts like feed cards and the wrapped grid.
const STREAM_THUMBNAIL_HEIGHT: Record<TransformPreset, number> = {
  thumbnail: 400,
  feed: 800,
  full: 1600,
  video_preview: 800,
  video_feed: 800,
};

// ---------------------------------------------------------------------------
// Tag handling
// ---------------------------------------------------------------------------

const CFI_PREFIX = "cfi:";
const CFS_PREFIX = "cfs:";
const LEGACY_VIDEO_PREFIX = "v/";

function isCloudflareImageId(id: string): boolean {
  return id.startsWith(CFI_PREFIX);
}

function isCloudflareStreamId(id: string): boolean {
  return id.startsWith(CFS_PREFIX);
}

/** True for any ID the optimizer knows how to treat as a video (Cloudflare Stream or legacy Cloudinary video). */
export function isOptimizedVideo(id: string): boolean {
  return isCloudflareStreamId(id) || id.startsWith(LEGACY_VIDEO_PREFIX);
}

// ---------------------------------------------------------------------------
// URL builders (internal)
// ---------------------------------------------------------------------------

function cloudflareImageUrl(id: string, preset: TransformPreset): string {
  const rawId = id.slice(CFI_PREFIX.length);
  const variant = IMAGE_VARIANT_FOR_PRESET[preset];
  return `https://imagedelivery.net/${IMAGES_ACCOUNT_HASH}/${rawId}/${variant}`;
}

function cloudflareStreamThumbnailUrl(id: string, preset: TransformPreset): string {
  const uid = id.slice(CFS_PREFIX.length);
  const height = STREAM_THUMBNAIL_HEIGHT[preset];
  return `https://customer-${STREAM_CUSTOMER_CODE}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg?height=${height}`;
}

// Legacy Cloudinary URL builder. Retired in Milestone 8 once all assets are backfilled.
const LEGACY_CLOUDINARY_TRANSFORM: Record<TransformPreset, string> = {
  thumbnail: "c_limit,w_400,q_auto,f_auto",
  feed: "c_limit,w_800,q_auto,f_auto",
  full: "c_limit,w_1600,q_auto,f_auto",
  video_preview: "c_limit,w_800,q_auto,f_auto,pg_1",
  video_feed: "c_limit,w_800,q_auto,vc_h264",
};

function legacyCloudinaryUrl(id: string, preset: TransformPreset): string {
  const transform = LEGACY_CLOUDINARY_TRANSFORM[preset];
  if (id.startsWith(LEGACY_VIDEO_PREFIX)) {
    const rawId = id.slice(LEGACY_VIDEO_PREFIX.length);
    return `https://res.cloudinary.com/${LEGACY_CLOUDINARY_CLOUD}/video/upload/${transform}/${rawId}`;
  }
  return `https://res.cloudinary.com/${LEGACY_CLOUDINARY_CLOUD}/image/upload/${transform}/${id}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Build an optimized URL for a media ID at the given transform preset. */
export function getOptimizedMediaUrl(
  id: string,
  preset: TransformPreset = "feed",
): string {
  if (isCloudflareImageId(id)) return cloudflareImageUrl(id, preset);
  if (isCloudflareStreamId(id)) return cloudflareStreamThumbnailUrl(id, preset);
  return legacyCloudinaryUrl(id, preset);
}

/**
 * Build the HLS manifest + poster URLs for a video ID.
 * Use this when rendering a `<video>` element; for image-shaped placeholders
 * (feed thumbnails, poster frames in grids) prefer `getOptimizedMediaUrl`.
 */
export function getOptimizedVideoPlaybackUrl(
  id: string,
): { hls: string; poster: string } {
  if (isCloudflareStreamId(id)) {
    const uid = id.slice(CFS_PREFIX.length);
    const base = `https://customer-${STREAM_CUSTOMER_CODE}.cloudflarestream.com/${uid}`;
    return {
      hls: `${base}/manifest/video.m3u8`,
      poster: `${base}/thumbnails/thumbnail.jpg?height=800`,
    };
  }
  // Legacy Cloudinary video: MP4 playback + first-frame poster.
  const rawId = id.startsWith(LEGACY_VIDEO_PREFIX) ? id.slice(LEGACY_VIDEO_PREFIX.length) : id;
  return {
    hls: `https://res.cloudinary.com/${LEGACY_CLOUDINARY_CLOUD}/video/upload/c_limit,w_800,q_auto/${rawId}.mp4`,
    poster: `https://res.cloudinary.com/${LEGACY_CLOUDINARY_CLOUD}/video/upload/c_limit,w_800,q_auto,f_auto,pg_1/${rawId}`,
  };
}

/**
 * Pick the media ID list to render for an activity, preferring the new field
 * and falling back to the legacy one during the migration window.
 */
export function resolveMediaIds(activity: {
  optimizedMediaIds?: string[] | null;
  cloudinaryPublicIds?: string[] | null;
}): string[] {
  if (activity.optimizedMediaIds && activity.optimizedMediaIds.length > 0) {
    return activity.optimizedMediaIds;
  }
  return activity.cloudinaryPublicIds ?? [];
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export interface UploadResult {
  /** Tagged media ID, e.g. "cfi:<id>" or "cfs:<uid>". */
  id: string;
  url: string;
  resourceType: "image" | "video";
}

/** Mints a one-time Cloudflare direct creator upload URL. Typically the Convex action `api.actions.cloudflareMedia.createDirectUploadUrl`. */
export type CreateDirectUploadUrl = (args: {
  kind: "image" | "video";
}) => Promise<{ uploadUrl: string; id: string }>;

/**
 * Upload a file via Cloudflare's direct creator upload flow.
 * Step 1 — ask the backend (via the provided callback) for a one-time upload URL
 *          and a pre-assigned tagged asset ID.
 * Step 2 — POST the file directly to that URL as multipart form data.
 * The backend never sees the bytes; we keep the Cloudflare API token on the server.
 */
export async function uploadOptimizedMedia(
  file: File,
  createUploadUrl: CreateDirectUploadUrl,
): Promise<UploadResult> {
  const resourceType: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";

  const { uploadUrl, id } = await createUploadUrl({ kind: resourceType });

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(uploadUrl, { method: "POST", body: formData });
  if (!response.ok) {
    throw new Error(`Media upload failed: ${response.status} ${response.statusText}`);
  }

  return {
    id,
    url: getOptimizedMediaUrl(id, "feed"),
    resourceType,
  };
}
