import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Store a raw webhook payload for tracking and potential reprocessing
 */
export const store = internalMutation({
  args: {
    service: v.union(v.literal("strava"), v.literal("stripe")),
    eventType: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("webhookPayloads", {
      service: args.service,
      eventType: args.eventType,
      payload: args.payload,
      status: "received",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update the status of a webhook payload
 */
export const updateStatus = internalMutation({
  args: {
    payloadId: v.id("webhookPayloads"),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
    processingResult: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.payloadId, {
      status: args.status,
      ...(args.error !== undefined && { error: args.error }),
      ...(args.processingResult !== undefined && { processingResult: args.processingResult }),
      ...(args.status === "completed" || args.status === "failed"
        ? { processedAt: now }
        : {}),
      updatedAt: now,
    });
  },
});
