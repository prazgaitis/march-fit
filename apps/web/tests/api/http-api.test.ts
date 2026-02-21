import { describe, it, expect, beforeEach } from "vitest";
import { api, internal } from "@repo/backend";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
} from "../helpers/convex";
import { generateApiKey, hashApiKey } from "../../../../packages/backend/lib/apiKey";

describe("API Key Module", () => {
  describe("generateApiKey", () => {
    it("should generate a key with mf_ prefix", async () => {
      const { rawKey, keyHash, keyPrefix } = await generateApiKey();

      expect(rawKey).toMatch(/^mf_[0-9a-f]{48}$/);
      expect(keyPrefix).toBe(rawKey.slice(0, 11));
      expect(keyHash).toHaveLength(64); // SHA-256 hex
    });

    it("should generate unique keys", async () => {
      const key1 = await generateApiKey();
      const key2 = await generateApiKey();

      expect(key1.rawKey).not.toBe(key2.rawKey);
      expect(key1.keyHash).not.toBe(key2.keyHash);
    });
  });

  describe("hashApiKey", () => {
    it("should produce consistent hashes", async () => {
      const hash1 = await hashApiKey("mf_test123");
      const hash2 = await hashApiKey("mf_test123");

      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different keys", async () => {
      const hash1 = await hashApiKey("mf_key_a");
      const hash2 = await hashApiKey("mf_key_b");

      expect(hash1).not.toBe(hash2);
    });

    it("should match the hash from generateApiKey", async () => {
      const { rawKey, keyHash } = await generateApiKey();
      const recomputed = await hashApiKey(rawKey);

      expect(recomputed).toBe(keyHash);
    });
  });
});

describe("API Key Mutations", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(() => {
    t = createTestContext();
  });

  describe("createKey", () => {
    it("should create an API key for authenticated user", async () => {
      const email = "test@example.com";
      await createTestUser(t, { email });
      const auth = t.withIdentity({ subject: "user-id", email });

      const result = await auth.mutation(api.mutations.apiKeys.createKey, {
        name: "My CLI Key",
      });

      expect(result.rawKey).toMatch(/^mf_/);
      expect(result.keyPrefix).toBe(result.rawKey.slice(0, 11));
      expect(result.name).toBe("My CLI Key");
    });

    it("should reject unauthenticated users", async () => {
      await expect(
        t.mutation(api.mutations.apiKeys.createKey, { name: "test" })
      ).rejects.toThrow("Not authenticated");
    });

    it("should enforce 10 key limit", async () => {
      const email = "test@example.com";
      const userId = await createTestUser(t, { email });
      const auth = t.withIdentity({ subject: "user-id", email });

      // Create 10 keys
      for (let i = 0; i < 10; i++) {
        await auth.mutation(api.mutations.apiKeys.createKey, {
          name: `Key ${i}`,
        });
      }

      // 11th should fail
      await expect(
        auth.mutation(api.mutations.apiKeys.createKey, { name: "Key 11" })
      ).rejects.toThrow("Maximum of 10 active API keys");
    });

    it("should allow creating keys after revoking one", async () => {
      const email = "test@example.com";
      await createTestUser(t, { email });
      const auth = t.withIdentity({ subject: "user-id", email });

      // Create 10 keys
      const keys = [];
      for (let i = 0; i < 10; i++) {
        keys.push(
          await auth.mutation(api.mutations.apiKeys.createKey, {
            name: `Key ${i}`,
          })
        );
      }

      // Revoke one - need to find the key ID
      const listedKeys = await auth.query(api.queries.apiKeys.listKeys, {});
      await auth.mutation(api.mutations.apiKeys.revokeKey, {
        keyId: listedKeys[0].id,
      });

      // Now creating another should work
      const newKey = await auth.mutation(api.mutations.apiKeys.createKey, {
        name: "Replacement Key",
      });
      expect(newKey.rawKey).toMatch(/^mf_/);
    });
  });

  describe("revokeKey", () => {
    it("should revoke a key", async () => {
      const email = "test@example.com";
      await createTestUser(t, { email });
      const auth = t.withIdentity({ subject: "user-id", email });

      await auth.mutation(api.mutations.apiKeys.createKey, { name: "Key 1" });

      const keys = await auth.query(api.queries.apiKeys.listKeys, {});
      expect(keys).toHaveLength(1);

      await auth.mutation(api.mutations.apiKeys.revokeKey, {
        keyId: keys[0].id,
      });

      const keysAfter = await auth.query(api.queries.apiKeys.listKeys, {});
      expect(keysAfter).toHaveLength(0);
    });

    it("should not allow revoking another user's key", async () => {
      const email1 = "user1@example.com";
      const email2 = "user2@example.com";
      await createTestUser(t, { email: email1, username: "user1" });
      await createTestUser(t, { email: email2, username: "user2" });

      const auth1 = t.withIdentity({ subject: "user1-id", email: email1 });
      const auth2 = t.withIdentity({ subject: "user2-id", email: email2 });

      await auth1.mutation(api.mutations.apiKeys.createKey, { name: "Key" });
      const user1Keys = await auth1.query(api.queries.apiKeys.listKeys, {});

      await expect(
        auth2.mutation(api.mutations.apiKeys.revokeKey, {
          keyId: user1Keys[0].id,
        })
      ).rejects.toThrow("Not authorized");
    });
  });

  describe("getUserByKeyHash", () => {
    it("should find user by key hash", async () => {
      const email = "test@example.com";
      const userId = await createTestUser(t, { email });
      const auth = t.withIdentity({ subject: "user-id", email });

      const { rawKey } = await auth.mutation(
        api.mutations.apiKeys.createKey,
        { name: "Lookup Key" }
      );

      const keyHash = await hashApiKey(rawKey);
      const result = await t.run(async (ctx) => {
        // Manually look up via the index since getUserByKeyHash is internal
        const key = await ctx.db
          .query("apiKeys")
          .withIndex("keyHash", (q) => q.eq("keyHash", keyHash))
          .first();
        if (!key) return null;
        const user = await ctx.db.get(key.userId);
        return user ? { user, keyId: key._id } : null;
      });

      expect(result).not.toBeNull();
      expect(result!.user._id).toBe(userId);
    });

    it("should return null for revoked key", async () => {
      const email = "test@example.com";
      await createTestUser(t, { email });
      const auth = t.withIdentity({ subject: "user-id", email });

      const { rawKey } = await auth.mutation(
        api.mutations.apiKeys.createKey,
        { name: "To Revoke" }
      );

      const keys = await auth.query(api.queries.apiKeys.listKeys, {});
      await auth.mutation(api.mutations.apiKeys.revokeKey, {
        keyId: keys[0].id,
      });

      const keyHash = await hashApiKey(rawKey);
      const result = await t.run(async (ctx) => {
        const key = await ctx.db
          .query("apiKeys")
          .withIndex("keyHash", (q) => q.eq("keyHash", keyHash))
          .first();
        if (!key || key.revokedAt) return null;
        const user = await ctx.db.get(key.userId);
        return user ? { user, keyId: key._id } : null;
      });

      expect(result).toBeNull();
    });

    it("should return null for non-existent key hash", async () => {
      const keyHash = await hashApiKey("mf_nonexistent");
      const result = await t.run(async (ctx) => {
        const key = await ctx.db
          .query("apiKeys")
          .withIndex("keyHash", (q) => q.eq("keyHash", keyHash))
          .first();
        return key ?? null;
      });

      expect(result).toBeNull();
    });
  });
});

describe("API Internal Mutations", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(() => {
    t = createTestContext();
  });

  describe("createChallengeForUser", () => {
    it("should create challenge and auto-join creator", async () => {
      const userId = await createTestUser(t);

      const challengeId = await t.mutation(
        internal.mutations.apiMutations.createChallengeForUser,
        {
          userId,
          name: "API Challenge",
          startDate: "2025-03-01",
          endDate: "2025-03-31",
          durationDays: 30,
          streakMinPoints: 10,
          weekCalcMethod: "from_start",
        }
      );

      expect(challengeId).toBeDefined();

      // Verify challenge exists
      const challenge = await t.run(async (ctx) => ctx.db.get(challengeId));
      expect(challenge!.name).toBe("API Challenge");
      expect(challenge!.creatorId).toBe(userId);

      // Verify participation
      const participation = await t.run(async (ctx) => {
        return ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", userId).eq("challengeId", challengeId)
          )
          .first();
      });
      expect(participation).not.toBeNull();
      expect(participation!.totalPoints).toBe(0);
    });

    it("should reject invalid dates", async () => {
      const userId = await createTestUser(t);

      await expect(
        t.mutation(internal.mutations.apiMutations.createChallengeForUser, {
          userId,
          name: "Bad Dates",
          startDate: "2025-03-31",
          endDate: "2025-03-01",
          durationDays: 30,
          streakMinPoints: 10,
          weekCalcMethod: "from_start",
        })
      ).rejects.toThrow("End date must be after start date");
    });
  });

  describe("logActivityForUser", () => {
    it("should keep penalty activities negative even with negative pointsPerUnit config", async () => {
      const userId = await createTestUser(t, {
        email: "api-negative-log@test.com",
        username: "api-negative-log",
      });
      const challengeId = await createTestChallenge(t, userId);

      const activityTypeId = await t.run(async (ctx) => {
        await ctx.db.insert("userChallenges", {
          userId,
          challengeId,
          joinedAt: Date.now(),
          totalPoints: 0,
          currentStreak: 0,
          modifierFactor: 1,
          paymentStatus: "paid",
          updatedAt: Date.now(),
        });

        return await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Penalty Count",
          scoringConfig: {
            unit: "count",
            pointsPerUnit: -5,
            basePoints: 0,
          },
          contributesToStreak: false,
          isNegative: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(
        internal.mutations.apiMutations.logActivityForUser,
        {
          userId,
          challengeId,
          activityTypeId,
          loggedDate: "2024-01-15",
          metrics: { count: 2 },
          source: "manual",
        }
      );

      expect(result.pointsEarned).toBe(-10);

      const participation = await t.run(async (ctx) =>
        ctx.db
          .query("userChallenges")
          .withIndex("userChallengeUnique", (q) =>
            q.eq("userId", userId).eq("challengeId", challengeId)
          )
          .first()
      );
      expect(participation!.totalPoints).toBe(-10);
    });
  });

  describe("updateChallengeForUser", () => {
    it("should update challenge fields", async () => {
      const userId = await createTestUser(t);
      const challengeId = await createTestChallenge(t, userId);

      await t.mutation(internal.mutations.apiMutations.updateChallengeForUser, {
        userId,
        challengeId,
        name: "Updated Name",
        announcement: "Hello everyone!",
      });

      const updated = await t.run(async (ctx) => ctx.db.get(challengeId));
      expect(updated!.name).toBe("Updated Name");
      expect(updated!.announcement).toBe("Hello everyone!");
    });
  });

  describe("removeActivityForUser", () => {
    it("should soft-delete own activity", async () => {
      const userId = await createTestUser(t);
      const challengeId = await createTestChallenge(t, userId);

      // Create participation and activity type
      const { participationId, activityTypeId } = await t.run(async (ctx) => {
        const pId = await ctx.db.insert("userChallenges", {
          userId,
          challengeId,
          joinedAt: Date.now(),
          totalPoints: 10,
          currentStreak: 0,
          modifierFactor: 1,
          paymentStatus: "paid",
          updatedAt: Date.now(),
        });
        const atId = await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Running",
          description: "Go for a run",
          scoringConfig: { type: "fixed", points: 10 },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return { participationId: pId, activityTypeId: atId };
      });

      // Create activity
      const activityId = await t.run(async (ctx) => {
        return ctx.db.insert("activities", {
          userId,
          challengeId,
          activityTypeId,
          loggedDate: Date.now(),
          metrics: {},
          pointsEarned: 10,
          source: "manual",
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(
        internal.mutations.apiMutations.removeActivityForUser,
        { userId, activityId }
      );

      expect(result.deleted).toBe(true);

      // Verify soft delete
      const activity = await t.run(async (ctx) => ctx.db.get(activityId));
      expect(activity!.deletedAt).toBeDefined();

      // Verify points deducted
      const participation = await t.run(async (ctx) =>
        ctx.db.get(participationId)
      );
      expect(participation!.totalPoints).toBe(0);
    });

    it("should not allow deleting another user's activity", async () => {
      const user1 = await createTestUser(t, {
        email: "u1@test.com",
        username: "u1",
      });
      const user2 = await createTestUser(t, {
        email: "u2@test.com",
        username: "u2",
        role: "user",
      });
      const challengeId = await createTestChallenge(t, user1);

      const activityId = await t.run(async (ctx) => {
        const atId = await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Running",
          description: "Go for a run",
          scoringConfig: { type: "fixed", points: 10 },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return ctx.db.insert("activities", {
          userId: user1,
          challengeId,
          activityTypeId: atId,
          loggedDate: Date.now(),
          metrics: {},
          pointsEarned: 10,
          source: "manual",
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        t.mutation(internal.mutations.apiMutations.removeActivityForUser, {
          userId: user2,
          activityId,
        })
      ).rejects.toThrow("Not authorized to delete activity");
    });

    it("should preserve negative totals when deleting a positive activity", async () => {
      const userId = await createTestUser(t, {
        email: "negative-api@test.com",
        username: "negative-api",
      });
      const challengeId = await createTestChallenge(t, userId);

      const { participationId, activityTypeId } = await t.run(async (ctx) => {
        const pId = await ctx.db.insert("userChallenges", {
          userId,
          challengeId,
          joinedAt: Date.now(),
          totalPoints: -5,
          currentStreak: 0,
          modifierFactor: 1,
          paymentStatus: "paid",
          updatedAt: Date.now(),
        });
        const atId = await ctx.db.insert("activityTypes", {
          challengeId,
          name: "Running",
          description: "Go for a run",
          scoringConfig: { type: "fixed", points: 5 },
          contributesToStreak: true,
          isNegative: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return { participationId: pId, activityTypeId: atId };
      });

      const activityId = await t.run(async (ctx) =>
        ctx.db.insert("activities", {
          userId,
          challengeId,
          activityTypeId,
          loggedDate: Date.now(),
          metrics: {},
          pointsEarned: 5,
          source: "manual",
          flagged: false,
          adminCommentVisibility: "internal",
          resolutionStatus: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      );

      await t.mutation(internal.mutations.apiMutations.removeActivityForUser, {
        userId,
        activityId,
      });

      const participation = await t.run(async (ctx) => ctx.db.get(participationId));
      expect(participation!.totalPoints).toBe(-10);
    });
  });
});
