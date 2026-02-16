import { NextResponse } from "next/server";
import type { Id } from "@repo/backend/_generated/dataModel";
import { api } from "@repo/backend";

import { fetchAuthQuery } from "@/lib/server-auth";

interface FeedRequestBody {
  followingOnly?: boolean;
  includeEngagementCounts?: boolean;
  includeMediaUrls?: boolean;
  cursor?: string | null;
  numItems?: number;
}

function parseBody(value: unknown): FeedRequestBody {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as FeedRequestBody;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = parseBody(await request.json().catch(() => ({})));

    const followingOnly = Boolean(body.followingOnly);
    const includeEngagementCounts = body.includeEngagementCounts ?? true;
    const includeMediaUrls = body.includeMediaUrls ?? true;
    const cursor = typeof body.cursor === "string" || body.cursor === null
      ? body.cursor
      : null;
    const requestedNumItems = Number.isFinite(body.numItems)
      ? Number(body.numItems)
      : 10;
    const numItems = Math.min(50, Math.max(1, requestedNumItems));

    const result = await fetchAuthQuery(api.queries.activities.getChallengeFeed, {
      challengeId: id as Id<"challenges">,
      followingOnly,
      includeEngagementCounts,
      includeMediaUrls,
      paginationOpts: {
        numItems,
        cursor,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[feed api] failed", error);
    return NextResponse.json(
      { error: "Failed to load feed" },
      { status: 500 }
    );
  }
}
