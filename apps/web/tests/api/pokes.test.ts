import { describe, it, expect, beforeEach } from "vitest";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
} from "../helpers/convex";

describe("Pokes", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  async function getNotifications(userId: Id<"users">) {
    return t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect();
    });
  }

  async function getPokes() {
    return t.run(async (ctx) => {
      return await ctx.db.query("pokes").collect();
    });
  }

  async function setupPokeTest() {
    const pokerEmail = "poker@example.com";
    const pokeeEmail = "pokee@example.com";

    const pokerId = await createTestUser(t, {
      email: pokerEmail,
      username: "poker",
      name: "Poker",
    });
    const pokeeId = await createTestUser(t, {
      email: pokeeEmail,
      username: "pokee",
      name: "Pokee",
    });

    const challengeId = await createTestChallenge(t, pokerId);

    const pokerAuth = t.withIdentity({
      subject: "poker-subject",
      email: pokerEmail,
    });
    const pokeeAuth = t.withIdentity({
      subject: "pokee-subject",
      email: pokeeEmail,
    });

    return { pokerId, pokeeId, challengeId, pokerAuth, pokeeAuth };
  }

  it("should create a poke record and notify the pokee", async () => {
    const { pokerId, pokeeId, challengeId, pokerAuth } =
      await setupPokeTest();

    const result = await pokerAuth.mutation(api.mutations.pokes.poke, {
      userId: pokeeId,
      challengeId,
    });

    expect(result.success).toBe(true);

    // Poke record created
    const pokes = await getPokes();
    expect(pokes.length).toBe(1);
    expect(pokes[0].pokerId).toBe(pokerId);
    expect(pokes[0].pokedId).toBe(pokeeId);
    expect(pokes[0].challengeId).toBe(challengeId);

    // Notification sent to pokee
    const notifications = await getNotifications(pokeeId);
    expect(notifications.length).toBe(1);
    expect(notifications[0].type).toBe("poke");
    expect(notifications[0].actorId).toBe(pokerId);
    expect(notifications[0].data.challengeId).toBe(challengeId);
  });

  it("should NOT allow poking yourself", async () => {
    const { pokerId, challengeId, pokerAuth } = await setupPokeTest();

    await expect(
      pokerAuth.mutation(api.mutations.pokes.poke, {
        userId: pokerId,
        challengeId,
      })
    ).rejects.toThrow("Cannot poke yourself");
  });

  it("should dedup rapid pokes from the same user (rollup)", async () => {
    const { pokeeId, challengeId, pokerAuth } = await setupPokeTest();

    // Poke twice rapidly
    await pokerAuth.mutation(api.mutations.pokes.poke, {
      userId: pokeeId,
      challengeId,
    });
    await pokerAuth.mutation(api.mutations.pokes.poke, {
      userId: pokeeId,
      challengeId,
    });

    // Both poke records exist
    const pokes = await getPokes();
    expect(pokes.length).toBe(2);

    // But only 1 notification due to rollup
    const notifications = await getNotifications(pokeeId);
    expect(notifications.length).toBe(1);
    expect(notifications[0].type).toBe("poke");
  });

  it("should allow poke back (mutual poking)", async () => {
    const { pokerId, pokeeId, challengeId, pokerAuth, pokeeAuth } =
      await setupPokeTest();

    // Poker pokes pokee
    await pokerAuth.mutation(api.mutations.pokes.poke, {
      userId: pokeeId,
      challengeId,
    });

    // Pokee pokes back
    await pokeeAuth.mutation(api.mutations.pokes.poke, {
      userId: pokerId,
      challengeId,
    });

    const pokes = await getPokes();
    expect(pokes.length).toBe(2);

    // Each user gets a notification
    const pokerNotifications = await getNotifications(pokerId);
    expect(pokerNotifications.length).toBe(1);
    expect(pokerNotifications[0].type).toBe("poke");

    const pokeeNotifications = await getNotifications(pokeeId);
    expect(pokeeNotifications.length).toBe(1);
    expect(pokeeNotifications[0].type).toBe("poke");
  });
});
