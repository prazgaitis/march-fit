/**
 * Media optimization layer.
 *
 * Currently backed by Cloudinary, but all public exports use generic names
 * so the rest of the codebase doesn't couple to the provider.
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const BETA_EMAILS = process.env.NEXT_PUBLIC_CLOUDINARY_BETA_EMAILS;

/** True when the media optimizer is configured (env vars present). */
export const isMediaOptimizerConfigured = !!(CLOUD_NAME && UPLOAD_PRESET);

/**
 * Check whether optimized media is enabled for a given user email.
 * When BETA_EMAILS is set, only those emails see optimized media.
 * When BETA_EMAILS is unset (but the optimizer is configured), everyone sees it.
 */
export function isMediaOptimizationEnabled(email?: string | null): boolean {
  if (!isMediaOptimizerConfigured) return false;
  if (!BETA_EMAILS) return true; // no beta gate → everyone
  if (!email) return false;
  const allowed = BETA_EMAILS.split(",").map((e) => e.trim().toLowerCase());
  return allowed.includes(email.toLowerCase());
}

// ---------------------------------------------------------------------------
// Transform presets
// ---------------------------------------------------------------------------

type TransformPreset = "thumbnail" | "feed" | "full" | "video_preview" | "video_feed";

const TRANSFORM_MAP: Record<TransformPreset, string> = {
  thumbnail: "c_limit,w_400,q_auto,f_auto",
  feed: "c_limit,w_800,q_auto,f_auto",
  full: "c_limit,w_1600,q_auto,f_auto",
  video_preview: "c_limit,w_800,q_auto,f_auto,pg_1", // first frame as image
  video_feed: "c_limit,w_800,q_auto,vc_h264",
};

// ---------------------------------------------------------------------------
// URL builders (internal, provider-specific)
// ---------------------------------------------------------------------------

function imageUrl(publicId: string, transform: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${publicId}`;
}

function videoUrl(publicId: string, transform: string): string {
  // Strip the `v/` prefix used to distinguish videos in our public IDs
  const rawId = publicId.startsWith("v/") ? publicId.slice(2) : publicId;
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${transform}/${rawId}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Convention: video public IDs are prefixed with `v/`. */
export function isOptimizedVideo(publicId: string): boolean {
  return publicId.startsWith("v/");
}

/**
 * Build an optimized URL for a media public ID at the given transform level.
 */
export function getOptimizedMediaUrl(
  publicId: string,
  preset: TransformPreset = "feed",
): string {
  if (isOptimizedVideo(publicId)) {
    const transform = TRANSFORM_MAP[preset] ?? TRANSFORM_MAP.video_feed;
    return videoUrl(publicId, transform);
  }
  const transform = TRANSFORM_MAP[preset] ?? TRANSFORM_MAP.feed;
  return imageUrl(publicId, transform);
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

interface UploadResult {
  publicId: string;
  url: string;
  resourceType: "image" | "video";
}

/**
 * Upload a file to the media optimizer (Cloudinary unsigned upload).
 * Returns a public ID that can be stored and used to generate optimized URLs.
 */
export async function uploadOptimizedMedia(file: File): Promise<UploadResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Media optimizer is not configured");
  }

  const isVideo = file.type.startsWith("video/");
  const resourceType = isVideo ? "video" : "image";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "march-fit");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: "POST", body: formData },
  );

  if (!response.ok) {
    throw new Error(`Media upload failed: ${response.statusText}`);
  }

  const data = (await response.json()) as { public_id: string; secure_url: string };

  // Prefix video IDs with `v/` so we can distinguish them later
  const publicId = isVideo ? `v/${data.public_id}` : data.public_id;

  return {
    publicId,
    url: data.secure_url,
    resourceType,
  };
}
