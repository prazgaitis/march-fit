import { describe, it, expect, beforeEach } from "vitest";
import { internal } from "@repo/backend";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
  createTestActivityType,
} from "../helpers/convex";

describe("findActivitiesNeedingCloudflareBackfill", () => {
  let t: ReturnType<typeof createTestContext>;
  let insertActivity: (fields: Record<string, unknown>) => Promise<string>;

  beforeEach(async () => {
    t = createTestContext();
    const userId = await createTestUser(t);
    const challengeId = await createTestChallenge(t, userId);
    const activityTypeId = await createTestActivityType(t, challengeId);

    insertActivity = (fields) =>
      t.run(async (ctx) =>
        ctx.db.insert("activities", {
          userId,
          challengeId,
          activityTypeId,
          loggedDate: Date.now(),
          pointsEarned: 10,
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "resolved",
          source: "manual",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          ...fields,
        }),
      );
  });

  it("returns only legacy-only, non-deleted activities with the fields the backfill needs", async () => {
    const legacyOnly = await insertActivity({
      source: "strava",
      externalId: "12345",
      cloudinaryPublicIds: ["march-fit/a", "v/march-fit/b"],
    });
    await insertActivity({ cloudinaryPublicIds: ["march-fit/c"], optimizedMediaIds: ["cfi:x"] });
    await insertActivity({ cloudinaryPublicIds: ["march-fit/d"], deletedAt: Date.now() });
    await insertActivity({ cloudinaryPublicIds: [] });
    await insertActivity({});

    const result = await t.query(
      internal.queries.backfillCloudflareMedia.findActivitiesNeedingCloudflareBackfill,
      { paginationOpts: { numItems: 50, cursor: null } },
    );

    expect(result.isDone).toBe(true);
    expect(result.page).toHaveLength(1);
    expect(result.page[0]).toMatchObject({
      _id: legacyOnly,
      source: "strava",
      externalId: "12345",
      cloudinaryPublicIds: ["march-fit/a", "v/march-fit/b"],
    });
  });

  it("pages through every candidate so unrecoverable ones don't block later pages", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(await insertActivity({ cloudinaryPublicIds: [`march-fit/${i}`] }));
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const result = await t.query(
        internal.queries.backfillCloudflareMedia.findActivitiesNeedingCloudflareBackfill,
        { paginationOpts: { numItems: 2, cursor } },
      );
      seen.push(...result.page.map((c: { _id: string }) => c._id));
      cursor = result.continueCursor;
      isDone = result.isDone;
    }

    expect(seen.sort()).toEqual([...ids].sort());
  });

  it("targets a single activity by id", async () => {
    const target = await insertActivity({ cloudinaryPublicIds: ["march-fit/z"] });
    const migrated = await insertActivity({
      cloudinaryPublicIds: ["march-fit/y"],
      optimizedMediaIds: ["cfi:y"],
    });

    const hit = await t.query(
      internal.queries.backfillCloudflareMedia.findActivitiesNeedingCloudflareBackfill,
      { paginationOpts: { numItems: 1, cursor: null }, activityId: target },
    );
    expect(hit.page.map((c: { _id: string }) => c._id)).toEqual([target]);

    const miss = await t.query(
      internal.queries.backfillCloudflareMedia.findActivitiesNeedingCloudflareBackfill,
      { paginationOpts: { numItems: 1, cursor: null }, activityId: migrated },
    );
    expect(miss.page).toEqual([]);
  });
});
