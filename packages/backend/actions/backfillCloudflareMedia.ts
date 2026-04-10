"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  uploadBlobToCloudflareImages,
  uploadBlobToCloudflareStream,
} from "../lib/cloudflareApi";

/**
 * Backfill: copy historical Cloudinary assets into Cloudflare.
 *
 * For every activity where `cloudinaryPublicIds` is non-empty and
 * `optimizedMediaIds` is empty, download each Cloudinary asset at its
 * original quality, upload it to Cloudflare Images (or Stream for videos),
 * and write the resulting tagged IDs into `optimizedMediaIds`. The legacy
 * field is left untouched as a rollback safety net until Milestone 8.
 *
 * Idempotent by construction: the query only returns activities that need
 * migration, and the mutation only writes if the target field is empty.
 * Per-asset failures are logged and the batch continues.
 *
 * Usage:
 *   # dry run, preview work for up to 10 activities
 *   npx convex run actions/backfillCloudflareMedia:backfill '{"limit": 10, "dryRun": true}'
 *
 *   # real run in batches of 50
 *   npx convex run actions/backfillCloudflareMedia:backfill '{"limit": 50, "dryRun": false}'
 *
 *   # target a single activity for recovery
 *   npx convex run actions/backfillCloudflareMedia:backfill '{"activityId": "...", "dryRun": false}'
 */
export const backfill = action({
  args: {
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
    activityId: v.optional(v.id("activities")),
  },
  handler: async (ctx, args) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
      throw new Error(
        "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / CLOUDINARY_CLOUD_NAME must be set so the script knows where to download source assets from",
      );
    }

    const dryRun = args.dryRun ?? true;
    const limit = args.limit ?? 50;

    const activities = await ctx.runQuery(
      internal.queries.backfillCloudflareMedia.findActivitiesNeedingCloudflareBackfill,
      { limit, activityId: args.activityId },
    );

    const results: Array<{
      activityId: string;
      sourceCount: number;
      uploaded: string[];
      skipped: Array<{ publicId: string; reason: string }>;
      error?: string;
    }> = [];

    for (const activity of activities) {
      const uploaded: string[] = [];
      const skipped: Array<{ publicId: string; reason: string }> = [];

      try {
        for (const publicId of activity.cloudinaryPublicIds) {
          const isVideo = publicId.startsWith("v/");
          const rawId = isVideo ? publicId.slice(2) : publicId;
          // Original-quality Cloudinary URL (no transform suffix).
          const sourceUrl = isVideo
            ? `https://res.cloudinary.com/${cloudName}/video/upload/${rawId}.mp4`
            : `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;

          if (dryRun) {
            uploaded.push(`[dry-run] ${isVideo ? "cfs:" : "cfi:"}<from ${sourceUrl}>`);
            continue;
          }

          const sourceResponse = await fetch(sourceUrl);
          if (!sourceResponse.ok) {
            skipped.push({
              publicId,
              reason: `download ${sourceResponse.status} ${sourceResponse.statusText}`,
            });
            continue;
          }
          const blob = await sourceResponse.blob();

          const taggedId = isVideo
            ? await uploadBlobToCloudflareStream(blob, `backfill ${publicId}`)
            : await uploadBlobToCloudflareImages(blob, `backfill ${publicId}`);
          uploaded.push(taggedId);
        }

        // Only persist when the full set uploaded successfully — a partial
        // set would leave the activity permanently missing media. If any
        // assets failed, leave optimizedMediaIds empty so the next run picks
        // it up again.
        const allUploaded =
          uploaded.length === activity.cloudinaryPublicIds.length && skipped.length === 0;

        if (!dryRun && allUploaded && uploaded.length > 0) {
          await ctx.runMutation(
            internal.mutations.backfillCloudinary.patchOptimizedMediaIds,
            {
              activityId: activity._id as Id<"activities">,
              optimizedMediaIds: uploaded,
            },
          );
        }

        results.push({
          activityId: activity._id,
          sourceCount: activity.cloudinaryPublicIds.length,
          uploaded,
          skipped,
        });
      } catch (error) {
        results.push({
          activityId: activity._id,
          sourceCount: activity.cloudinaryPublicIds.length,
          uploaded,
          skipped,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      dryRun,
      totalCandidates: activities.length,
      processed: results.length,
      results,
    };
  },
});
