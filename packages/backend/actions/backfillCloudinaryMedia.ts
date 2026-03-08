"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  resource_type: string;
}

/**
 * Backfill existing Convex-stored media to Cloudinary.
 *
 * Run via:
 *   npx convex run actions/backfillCloudinaryMedia:backfill '{"daysBack": 4}'
 *
 * Requires CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET env vars
 * on the Convex deployment.
 */
export const backfill = action({
  args: {
    daysBack: v.optional(v.number()),
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error(
        "Missing CLOUDINARY_CLOUD_NAME or CLOUDINARY_UPLOAD_PRESET env vars",
      );
    }

    const dryRun = args.dryRun ?? false;

    const activities = await ctx.runQuery(
      internal.queries.backfillCloudinary.findActivitiesNeedingBackfill,
      { daysBack: args.daysBack ?? 4, limit: args.limit ?? 50 },
    );

    const results: Array<{
      activityId: string;
      mediaCount: number;
      publicIds: string[];
      error?: string;
    }> = [];

    for (const activity of activities) {
      try {
        const publicIds: string[] = [];

        for (const storageId of activity.mediaIds) {
          // Get the URL for the stored file
          const url = await ctx.storage.getUrl(storageId);
          if (!url) {
            console.warn(`No URL for storage ID ${storageId}`);
            continue;
          }

          if (dryRun) {
            publicIds.push(`[dry-run] ${storageId}`);
            continue;
          }

          // Download from Convex storage
          const fileResponse = await fetch(url);
          if (!fileResponse.ok) {
            console.warn(`Failed to download ${url}: ${fileResponse.statusText}`);
            continue;
          }
          const blob = await fileResponse.blob();

          // Detect resource type from content-type
          const contentType = fileResponse.headers.get("content-type") ?? "";
          const isVideo = contentType.startsWith("video/");
          const resourceType = isVideo ? "video" : "image";

          // Upload to Cloudinary
          const formData = new FormData();
          formData.append("file", blob);
          formData.append("upload_preset", uploadPreset);
          formData.append("folder", "march-fit");

          const cloudinaryRes = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
            { method: "POST", body: formData },
          );

          if (!cloudinaryRes.ok) {
            console.warn(
              `Cloudinary upload failed for ${storageId}: ${cloudinaryRes.statusText}`,
            );
            continue;
          }

          const data = (await cloudinaryRes.json()) as CloudinaryUploadResponse;
          const publicId = isVideo ? `v/${data.public_id}` : data.public_id;
          publicIds.push(publicId);
        }

        if (!dryRun && publicIds.length > 0) {
          await ctx.runMutation(
            internal.mutations.backfillCloudinary.patchCloudinaryIds,
            { activityId: activity._id, cloudinaryPublicIds: publicIds },
          );
        }

        results.push({
          activityId: activity._id,
          mediaCount: activity.mediaIds.length,
          publicIds,
        });
      } catch (error) {
        results.push({
          activityId: activity._id,
          mediaCount: activity.mediaIds.length,
          publicIds: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      dryRun,
      totalActivities: activities.length,
      processed: results.length,
      results,
    };
  },
});
