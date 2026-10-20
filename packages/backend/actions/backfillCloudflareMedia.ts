"use node";

import { internalAction, type ActionCtx } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  uploadBlobToCloudflareImages,
  uploadBlobToCloudflareStream,
} from "../lib/cloudflareApi";
import {
  httpFetchStravaActivityPhotos,
  httpRefreshStravaToken,
  uploadStravaPhotosToCloudflare,
} from "./strava";

/**
 * Backfill: recover historical Cloudinary-era media into Cloudflare.
 *
 * For every activity where `cloudinaryPublicIds` is non-empty and
 * `optimizedMediaIds` is empty, find a live copy of the media, upload it to
 * Cloudflare, and write the tagged IDs into `optimizedMediaIds`. Sources, in
 * order:
 *   1. Strava — for `source: "strava"` activities, re-fetch the photos from
 *      the Strava API using the owner's integration. Only the media field is
 *      patched; the activity is not re-scored.
 *   2. Cloudinary — only works if the Cloudinary cloud is reachable again
 *      (CLOUDINARY_CLOUD_NAME set and the account re-enabled).
 * Activities that also have Convex `mediaIds` don't need this: the display
 * layer falls back to those once the legacy Cloudinary cloud is unset.
 *
 * The legacy field is left untouched. A result is only persisted when the
 * full set uploads, so a partially failed activity is retried on the next run.
 *
 * Strava's API allows ~100 read requests per 15 minutes, so keep batches small
 * and pass the returned `continueCursor` back in to resume.
 *
 * Usage:
 *   # dry run: reports what would be recovered (fetches Strava photo lists and probes Cloudinary; uploads nothing)
 *   npx convex run actions/backfillCloudflareMedia:backfill '{"limit": 25}'
 *
 *   # real run, then resume with the returned cursor
 *   npx convex run actions/backfillCloudflareMedia:backfill '{"limit": 25, "dryRun": false}'
 *   npx convex run actions/backfillCloudflareMedia:backfill '{"limit": 25, "dryRun": false, "cursor": "..."}'
 *
 *   # target a single activity
 *   npx convex run actions/backfillCloudflareMedia:backfill '{"activityId": "...", "dryRun": false}'
 */
export const backfill = internalAction({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
    activityId: v.optional(v.id("activities")),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    const { page, continueCursor, isDone } = await ctx.runQuery(
      internal.queries.backfillCloudflareMedia.findActivitiesNeedingCloudflareBackfill,
      {
        paginationOpts: { numItems: args.limit ?? 25, cursor: args.cursor ?? null },
        activityId: args.activityId,
      },
    );

    const stravaTokens = new Map<Id<"users">, string | null>();

    const results: Array<{
      activityId: string;
      source: "strava" | "cloudinary" | null;
      recovered: boolean;
      sourceCount: number;
      uploaded: string[];
      skipped: Array<{ item: string; reason: string }>;
      error?: string;
    }> = [];

    for (const activity of page) {
      let source: "strava" | "cloudinary" | null = null;
      let sourceCount = 0;
      const uploaded: string[] = [];
      const skipped: Array<{ item: string; reason: string }> = [];

      try {
        // 1. Strava
        if (activity.source === "strava" && activity.externalId) {
          const accessToken = await getStravaAccessToken(ctx, activity.userId, stravaTokens);
          if (!accessToken) {
            skipped.push({ item: "strava", reason: "no usable Strava token" });
          } else {
            const photoUrls = await httpFetchStravaActivityPhotos(
              accessToken,
              Number(activity.externalId),
              null,
            );
            if (photoUrls.length === 0) {
              skipped.push({ item: "strava", reason: "Strava returned no photos" });
            } else {
              source = "strava";
              sourceCount = photoUrls.length;
              if (dryRun) {
                uploaded.push(...photoUrls.map((url) => `[dry-run] <from ${url}>`));
              } else {
                uploaded.push(...(await uploadStravaPhotosToCloudflare(photoUrls)));
              }
            }
          }
        }

        // 2. Cloudinary
        if (!source && cloudName) {
          source = "cloudinary";
          sourceCount = activity.cloudinaryPublicIds.length;
          for (const publicId of activity.cloudinaryPublicIds) {
            const isVideo = publicId.startsWith("v/");
            const rawId = isVideo ? publicId.slice(2) : publicId;
            // Original-quality Cloudinary URL (no transform suffix).
            const sourceUrl = isVideo
              ? `https://res.cloudinary.com/${cloudName}/video/upload/${rawId}.mp4`
              : `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;

            if (dryRun) {
              const probe = await fetch(sourceUrl, { method: "HEAD" });
              if (probe.ok) {
                uploaded.push(`[dry-run] ${isVideo ? "cfs:" : "cfi:"}<from ${sourceUrl}>`);
              } else {
                skipped.push({ item: publicId, reason: `download ${probe.status} ${probe.statusText}` });
              }
              continue;
            }

            const sourceResponse = await fetch(sourceUrl);
            if (!sourceResponse.ok) {
              skipped.push({
                item: publicId,
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
        }

        if (!source) {
          skipped.push({ item: "activity", reason: "no recoverable source" });
        }

        // Only persist when the full set uploaded successfully — a partial
        // set would leave the activity permanently missing media. If any
        // assets failed, leave optimizedMediaIds empty so the next run picks
        // it up again.
        const recovered = source !== null && uploaded.length > 0 && uploaded.length === sourceCount;

        if (!dryRun && recovered) {
          await ctx.runMutation(
            internal.mutations.backfillCloudinary.patchOptimizedMediaIds,
            {
              activityId: activity._id,
              optimizedMediaIds: uploaded,
            },
          );
        }

        results.push({ activityId: activity._id, source, recovered, sourceCount, uploaded, skipped });
      } catch (error) {
        results.push({
          activityId: activity._id,
          source,
          recovered: false,
          sourceCount,
          uploaded,
          skipped,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      dryRun,
      processed: results.length,
      // In a dry run: how many would be recovered.
      recovered: results.filter((r) => r.recovered).length,
      continueCursor,
      isDone,
      results,
    };
  },
});

/**
 * Get a usable Strava access token for a user, refreshing it if it expires
 * within the hour. Cached per run so each user's token is refreshed at most once.
 */
async function getStravaAccessToken(
  ctx: ActionCtx,
  userId: Id<"users">,
  cache: Map<Id<"users">, string | null>,
): Promise<string | null> {
  if (cache.has(userId)) return cache.get(userId)!;

  let accessToken: string | null = null;
  const integration = await ctx.runQuery(
    internal.queries.integrations.getActiveStravaForUser,
    { userId },
  );
  if (integration?.accessToken && integration.refreshToken && integration.expiresAt) {
    accessToken = integration.accessToken;
    if (integration.expiresAt <= Math.floor(Date.now() / 1000) + 3600) {
      try {
        const tokenData = await httpRefreshStravaToken(integration.refreshToken);
        await ctx.runMutation(internal.mutations.integrations.updateStravaTokens, {
          integrationId: integration._id,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: tokenData.expires_at,
        });
        accessToken = tokenData.access_token;
      } catch {
        // Revoked on Strava's side or app deauthorized; skip this user's activities.
        accessToken = null;
      }
    }
  }

  cache.set(userId, accessToken);
  return accessToken;
}
