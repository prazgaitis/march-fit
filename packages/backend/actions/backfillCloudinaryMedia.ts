"use node";

/**
 * Backfill: upload recent Convex storage media to Cloudinary.
 *
 * Run manually:
 *   npx convex run actions/backfillCloudinaryMedia:backfill '{"daysBack": 4}'
 *   npx convex run actions/backfillCloudinaryMedia:backfill '{"daysBack": 4}' --prod
 *
 * Requires environment variables on the Convex deployment:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_UPLOAD_PRESET
 *
 * Safe to re-run — skips activities that already have cloudinaryPublicIds.
 */

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

interface CloudinaryUploadResponse {
  public_id: string;
  resource_type: "image" | "video" | "raw";
}

export const backfill = action({
  args: {
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error(
        "Missing CLOUDINARY_CLOUD_NAME or CLOUDINARY_UPLOAD_PRESET env vars on Convex deployment",
      );
    }

    const daysBack = args.daysBack ?? 4;
    const cutoffMs = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    console.log(
      `[backfill] Looking for activities from last ${daysBack} days (since ${new Date(cutoffMs).toISOString()})`,
    );

    const activities: Array<{
      activityId: string;
      media: Array<{ storageId: string; url: string }>;
    }> = await ctx.runQuery(
      internal.queries.backfillCloudinary.getActivitiesNeedingBackfill,
      { cutoffMs },
    );

    console.log(`[backfill] Found ${activities.length} activities to process`);

    let processed = 0;
    let failed = 0;

    for (const activity of activities) {
      try {
        const publicIds: string[] = [];

        for (const media of activity.media) {
          // Download from Convex storage
          const response = await fetch(media.url);
          if (!response.ok) {
            console.error(
              `[backfill] Failed to download ${media.url}: ${response.status}`,
            );
            failed++;
            continue;
          }

          const contentType =
            response.headers.get("content-type") ?? "image/jpeg";
          const isVideo = contentType.startsWith("video/");
          const resourceType = isVideo ? "video" : "image";

          // Upload to Cloudinary
          const blob = await response.blob();
          const formData = new FormData();
          formData.append("file", blob);
          formData.append("upload_preset", uploadPreset);
          formData.append("folder", "march-fit");

          const cloudinaryRes = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
            { method: "POST", body: formData },
          );

          if (!cloudinaryRes.ok) {
            const error = await cloudinaryRes.text();
            console.error(
              `[backfill] Cloudinary upload failed for activity ${activity.activityId}: ${error}`,
            );
            failed++;
            continue;
          }

          const data = (await cloudinaryRes.json()) as CloudinaryUploadResponse;
          const publicId = isVideo ? `v/${data.public_id}` : data.public_id;
          publicIds.push(publicId);
        }

        if (publicIds.length > 0) {
          await ctx.runMutation(
            internal.mutations.backfillCloudinary.patchCloudinaryIds,
            {
              activityId: activity.activityId as Id<"activities">,
              cloudinaryPublicIds: publicIds,
            },
          );
          processed++;
          console.log(
            `[backfill] Processed activity ${activity.activityId}: ${publicIds.length} files`,
          );
        }
      } catch (error) {
        console.error(
          `[backfill] Error processing activity ${activity.activityId}:`,
          error,
        );
        failed++;
      }
    }

    const summary = `Done. Processed: ${processed}, Failed: ${failed}, Total: ${activities.length}`;
    console.log(`[backfill] ${summary}`);
    return summary;
  },
});
