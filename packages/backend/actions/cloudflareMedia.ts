"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { cloudflareCredentials, parseCloudflareResponse } from "../lib/cloudflareApi";

/**
 * Mint a one-time Cloudflare direct creator upload URL so a client can POST a
 * file to Cloudflare Images or Cloudflare Stream without ever seeing the
 * account API token. Returns a pre-assigned asset ID in the tagged form used
 * everywhere else in the app: `cfi:<id>` for Images, `cfs:<uid>` for Stream.
 */
export const createDirectUploadUrl = action({
  args: {
    kind: v.union(v.literal("image"), v.literal("video")),
  },
  handler: async (ctx, { kind }): Promise<{ uploadUrl: string; id: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { accountId, apiToken } = cloudflareCredentials();
    const authHeader = { Authorization: `Bearer ${apiToken}` };

    if (kind === "image") {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`,
        { method: "POST", headers: authHeader },
      );
      const result = await parseCloudflareResponse<{ id: string; uploadURL: string }>(
        response,
        "Images direct_upload",
      );
      return { uploadUrl: result.uploadURL, id: `cfi:${result.id}` };
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ maxDurationSeconds: 300 }),
      },
    );
    const result = await parseCloudflareResponse<{ uid: string; uploadURL: string }>(
      response,
      "Stream direct_upload",
    );
    return { uploadUrl: result.uploadURL, id: `cfs:${result.uid}` };
  },
});
