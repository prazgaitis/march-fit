const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/** Whether Cloudinary is configured (env vars set) */
export const isCloudinaryConfigured = !!(CLOUD_NAME && UPLOAD_PRESET);

/** Comma-separated list of emails that should use Cloudinary uploads (empty = everyone) */
const BETA_EMAILS = process.env.NEXT_PUBLIC_CLOUDINARY_BETA_EMAILS;

/**
 * Check if Cloudinary uploads are enabled for a given user.
 * If BETA_EMAILS is set, only those users get Cloudinary.
 * If BETA_EMAILS is not set, all users get Cloudinary (when configured).
 */
export function isCloudinaryEnabledForUser(email?: string | null): boolean {
  if (!isCloudinaryConfigured) return false;
  if (!BETA_EMAILS) return true; // no allowlist = everyone
  if (!email) return false;
  const allowed = BETA_EMAILS.split(",").map((e) => e.trim().toLowerCase());
  return allowed.includes(email.toLowerCase());
}

export type CloudinaryTransform =
  | "thumbnail" // 400px, low quality — stories row, small previews
  | "feed" // 800px, medium quality — feed cards
  | "full" // 1600px, high quality — lightbox, detail view
  | "original" // no transforms
  | "video_preview" // video poster/thumbnail
  | "video_feed"; // compressed video for feed

const TRANSFORMS: Record<CloudinaryTransform, string> = {
  thumbnail: "c_fill,w_400,h_400,q_60,f_auto",
  feed: "c_limit,w_800,q_auto,f_auto",
  full: "c_limit,w_1600,q_auto:good,f_auto",
  original: "",
  video_preview: "c_limit,w_800,q_auto,f_jpg,so_0", // first frame as jpg
  video_feed: "c_limit,w_800,q_auto,ac_aac,vc_h264",
};

/**
 * Build a Cloudinary delivery URL with transforms.
 */
export function cloudinaryUrl(
  publicId: string,
  transform: CloudinaryTransform = "feed",
): string {
  const t = TRANSFORMS[transform];
  const base = `https://res.cloudinary.com/${CLOUD_NAME}`;
  if (!t) return `${base}/image/upload/${publicId}`;
  return `${base}/image/upload/${t}/${publicId}`;
}

/**
 * Build a Cloudinary video URL with transforms.
 */
export function cloudinaryVideoUrl(
  publicId: string,
  transform: CloudinaryTransform = "video_feed",
): string {
  const t = TRANSFORMS[transform];
  const base = `https://res.cloudinary.com/${CLOUD_NAME}`;
  if (!t) return `${base}/video/upload/${publicId}`;
  return `${base}/video/upload/${t}/${publicId}`;
}

/**
 * Check if a Cloudinary public ID is a video based on resource_type stored in the ID.
 * Convention: video public IDs are prefixed with "v/" (e.g. "v/march-fit/abc123")
 */
export function isCloudinaryVideo(publicId: string): boolean {
  return publicId.startsWith("v/");
}

/**
 * Get the appropriate URL for a Cloudinary public ID at a given transform level.
 */
export function getCloudinaryMediaUrl(
  publicId: string,
  transform: CloudinaryTransform = "feed",
): string {
  if (isCloudinaryVideo(publicId)) {
    // Strip the "v/" prefix for the actual public ID
    const videoId = publicId.slice(2);
    if (transform === "thumbnail" || transform === "video_preview") {
      return cloudinaryVideoUrl(videoId, "video_preview");
    }
    return cloudinaryVideoUrl(videoId, "video_feed");
  }
  return cloudinaryUrl(publicId, transform);
}

interface CloudinaryUploadResponse {
  public_id: string;
  resource_type: "image" | "video" | "raw";
  secure_url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Upload a file to Cloudinary using unsigned upload preset.
 * Only call this when isCloudinaryEnabled is true.
 */
export async function uploadToCloudinary(
  file: File,
): Promise<{ publicId: string; resourceType: string }> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary is not configured");
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
    const error = await response.text();
    throw new Error(`Cloudinary upload failed: ${error}`);
  }

  const data: CloudinaryUploadResponse = await response.json();

  // Prefix video IDs with "v/" so we can distinguish them later
  const publicId = isVideo ? `v/${data.public_id}` : data.public_id;

  return { publicId, resourceType: data.resource_type };
}
