/**
 * Tests for the activityTypes `kind` field — CRUD flow and backfill mutation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { api } from "@repo/backend";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
  createTestActivityType,
} from "../helpers/convex";
import type { Id } from "@repo/backend/_generated/dataModel";

describe("Activity type kind field", () => {
  let t: ReturnType<typeof createTestContext>;
  let userId: Id<"users">;
  let challengeId: Id<"challenges">;
  let tWithAuth: any;
  const EMAIL = "admin@example.com";

  beforeEach(async () => {
    t = createTestContext();
    userId = await createTestUser(t, { email: EMAIL, role: "admin" });
    tWithAuth = t.withIdentity({ subject: "sub-admin", email: EMAIL });
    challengeId = await createTestChallenge(t, userId);
  });

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  it("createActivityType stores kind", async () => {
    const id = await tWithAuth.mutation(
      api.mutations.activityTypes.createActivityType,
      {
        challengeId,
        name: "Running",
        scoringConfig: { type: "unit_based", pointsPerUnit: 8, unit: "miles" },
        contributesToStreak: true,
        isNegative: false,
        kind: "core",
      },
    );

    const doc = await t.run(async (ctx: any) => ctx.db.get(id));
    expect(doc.kind).toBe("core");
  });

  it("createActivityType without kind leaves it undefined", async () => {
    const id = await tWithAuth.mutation(
      api.mutations.activityTypes.createActivityType,
      {
        challengeId,
        name: "Running",
        scoringConfig: { type: "unit_based", pointsPerUnit: 8, unit: "miles" },
        contributesToStreak: true,
        isNegative: false,
      },
    );

    const doc = await t.run(async (ctx: any) => ctx.db.get(id));
    expect(doc.kind).toBeUndefined();
  });

  it("updateActivityType updates kind", async () => {
    const id = await createTestActivityType(t, challengeId, {
      name: "Bonus",
      kind: "challenge",
    });

    await tWithAuth.mutation(api.mutations.activityTypes.updateActivityType, {
      activityTypeId: id,
      kind: "bonus",
    });

    const doc = await t.run(async (ctx: any) => ctx.db.get(id));
    expect(doc.kind).toBe("bonus");
  });

  // ─── Backfill heuristics ───────────────────────────────────────────────────

  describe("backfillKind", () => {
    it("classifies core activities (unit_based with standard units)", async () => {
      await createTestActivityType(t, challengeId, {
        name: "Outdoor Run",
        scoringConfig: { type: "unit_based", pointsPerUnit: 8, unit: "miles" },
        contributesToStreak: true,
        isNegative: false,
      });
      await createTestActivityType(t, challengeId, {
        name: "Rowing",
        scoringConfig: { type: "unit_based", pointsPerUnit: 3.75, unit: "kilometers" },
        contributesToStreak: true,
        isNegative: false,
      });
      await createTestActivityType(t, challengeId, {
        name: "Hi-Intensity Cardio",
        scoringConfig: { type: "unit_based", pointsPerUnit: 0.9, unit: "minutes" },
        contributesToStreak: true,
        isNegative: false,
      });

      const result = await tWithAuth.mutation(
        api.mutations.activityTypes.backfillKind,
        { challengeId },
      );

      expect(result.updated).toBe(3);
      const kinds = result.results.map((r: any) => ({ name: r.name, kind: r.kind }));
      expect(kinds).toContainEqual({ name: "Outdoor Run", kind: "core" });
      expect(kinds).toContainEqual({ name: "Rowing", kind: "core" });
      expect(kinds).toContainEqual({ name: "Hi-Intensity Cardio", kind: "core" });
    });

    it("classifies penalty activities (isNegative)", async () => {
      await createTestActivityType(t, challengeId, {
        name: "Drinks",
        scoringConfig: { type: "unit_based", pointsPerUnit: 5, unit: "drinks" },
        contributesToStreak: false,
        isNegative: true,
      });

      const result = await tWithAuth.mutation(
        api.mutations.activityTypes.backfillKind,
        { challengeId },
      );

      expect(result.results[0]).toMatchObject({ name: "Drinks", kind: "penalty" });
    });

    it("classifies bonus activities (variable scoring)", async () => {
      await createTestActivityType(t, challengeId, {
        name: "PR Week Bonus",
        scoringConfig: { type: "variable" },
        contributesToStreak: false,
        isNegative: false,
      });

      const result = await tWithAuth.mutation(
        api.mutations.activityTypes.backfillKind,
        { challengeId },
      );

      expect(result.results[0]).toMatchObject({ name: "PR Week Bonus", kind: "bonus" });
    });

    it("classifies bonus activities (fixed with basePoints 0)", async () => {
      await createTestActivityType(t, challengeId, {
        name: "Mini-Game Bonus",
        scoringConfig: { type: "fixed", basePoints: 0 },
        contributesToStreak: false,
        isNegative: false,
      });

      const result = await tWithAuth.mutation(
        api.mutations.activityTypes.backfillKind,
        { challengeId },
      );

      expect(result.results[0]).toMatchObject({ name: "Mini-Game Bonus", kind: "bonus" });
    });

    it("classifies bonus activities by name match", async () => {
      await createTestActivityType(t, challengeId, {
        name: "Category Leader Bonus",
        scoringConfig: { basePoints: 1, type: "variable" },
        contributesToStreak: false,
        isNegative: false,
      });
      await createTestActivityType(t, challengeId, {
        name: "Partner Week Bonus",
        scoringConfig: { basePoints: 1, type: "variable" },
        contributesToStreak: false,
        isNegative: false,
      });

      const result = await tWithAuth.mutation(
        api.mutations.activityTypes.backfillKind,
        { challengeId },
      );

      for (const r of result.results) {
        expect(r.kind).toBe("bonus");
      }
    });

    it("classifies mindfulness and non-streak activities as bonus", async () => {
      await createTestActivityType(t, challengeId, {
        name: "10 Days of Mindfulness (Days 1-9)",
        scoringConfig: { type: "completion", fixedPoints: 1 },
        contributesToStreak: false,
        isNegative: false,
      });
      await createTestActivityType(t, challengeId, {
        name: "10 Days of Mindfulness (Day 10)",
        scoringConfig: { type: "completion", fixedPoints: 100 },
        contributesToStreak: false,
        isNegative: false,
        maxPerChallenge: 1,
      });
      await createTestActivityType(t, challengeId, {
        name: "Skiing Full Day",
        scoringConfig: { type: "unit_based", pointsPerUnit: 35, unit: "full days" },
        contributesToStreak: false,
        isNegative: false,
      });
      await createTestActivityType(t, challengeId, {
        name: "Workout with a Friend",
        scoringConfig: { type: "completion", fixedPoints: 25 },
        contributesToStreak: false,
        isNegative: false,
        maxPerChallenge: 1,
      });
      await createTestActivityType(t, challengeId, {
        name: "Retro Abs Bonus",
        scoringConfig: { type: "completion", fixedPoints: 15 },
        contributesToStreak: false,
        isNegative: false,
      });

      const result = await tWithAuth.mutation(
        api.mutations.activityTypes.backfillKind,
        { challengeId },
      );

      for (const r of result.results) {
        expect(r.kind).toBe("bonus");
      }
    });

    it("classifies challenge activities (completion, tiered, non-standard units)", async () => {
      await createTestActivityType(t, challengeId, {
        name: "Hotel Room Workout",
        scoringConfig: { type: "completion", fixedPoints: 50 },
        contributesToStreak: true,
        isNegative: false,
      });
      await createTestActivityType(t, challengeId, {
        name: "Horses",
        scoringConfig: { type: "unit_based", pointsPerUnit: 16.75, unit: "horses" },
        contributesToStreak: true,
        isNegative: false,
      });
      await createTestActivityType(t, challengeId, {
        name: "Burpee Challenge Week 1",
        scoringConfig: {
          type: "tiered",
          basePoints: 1,
          metric: "duration_minutes",
          tiers: [{ maxValue: 10, points: 50 }, { maxValue: 12, points: 30 }, { points: 10 }],
        },
        contributesToStreak: true,
        isNegative: false,
      });

      const result = await tWithAuth.mutation(
        api.mutations.activityTypes.backfillKind,
        { challengeId },
      );

      for (const r of result.results) {
        expect(r.kind).toBe("challenge");
      }
    });

    it("classifies unit_based with maxPerChallenge as challenge, not core", async () => {
      await createTestActivityType(t, challengeId, {
        name: "The Max",
        scoringConfig: { type: "unit_based", pointsPerUnit: 25, unit: "circuits", maxUnits: 3 },
        contributesToStreak: true,
        isNegative: false,
        maxPerChallenge: 3,
      });

      const result = await tWithAuth.mutation(
        api.mutations.activityTypes.backfillKind,
        { challengeId },
      );

      expect(result.results[0]).toMatchObject({ name: "The Max", kind: "challenge" });
    });

    it("skips rows that already have kind set", async () => {
      await createTestActivityType(t, challengeId, {
        name: "Custom Run",
        scoringConfig: { type: "unit_based", pointsPerUnit: 8, unit: "miles" },
        contributesToStreak: true,
        isNegative: false,
        kind: "bonus", // manually set to something different than heuristic would pick
      });

      const result = await tWithAuth.mutation(
        api.mutations.activityTypes.backfillKind,
        { challengeId },
      );

      expect(result.skipped).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.results[0]).toMatchObject({
        name: "Custom Run",
        kind: "bonus",
        skipped: true,
      });
    });

    it("dryRun does not write to DB", async () => {
      const id = await createTestActivityType(t, challengeId, {
        name: "Outdoor Run",
        scoringConfig: { type: "unit_based", pointsPerUnit: 8, unit: "miles" },
        contributesToStreak: true,
        isNegative: false,
      });

      const result = await tWithAuth.mutation(
        api.mutations.activityTypes.backfillKind,
        { challengeId, dryRun: true },
      );

      expect(result.updated).toBe(1);
      expect(result.results[0]).toMatchObject({ name: "Outdoor Run", kind: "core" });

      // Verify DB was NOT updated
      const doc = await t.run(async (ctx: any) => ctx.db.get(id));
      expect(doc.kind).toBeUndefined();
    });

    it("handles mixed activity types in a single challenge", async () => {
      await createTestActivityType(t, challengeId, {
        name: "Swimming",
        scoringConfig: { type: "unit_based", pointsPerUnit: 33, unit: "miles" },
        contributesToStreak: true,
        isNegative: false,
      });
      await createTestActivityType(t, challengeId, {
        name: "The Hunt Bonus",
        scoringConfig: { type: "variable" },
        contributesToStreak: false,
        isNegative: false,
      });
      await createTestActivityType(t, challengeId, {
        name: "Overindulge",
        scoringConfig: { type: "unit_based", pointsPerUnit: 10, unit: "count" },
        contributesToStreak: false,
        isNegative: true,
      });
      await createTestActivityType(t, challengeId, {
        name: "The Murph",
        scoringConfig: { type: "completion", fixedPoints: 80 },
        contributesToStreak: true,
        isNegative: false,
      });

      const result = await tWithAuth.mutation(
        api.mutations.activityTypes.backfillKind,
        { challengeId },
      );

      expect(result.total).toBe(4);
      expect(result.updated).toBe(4);

      const kindMap = Object.fromEntries(
        result.results.map((r: any) => [r.name, r.kind]),
      );
      expect(kindMap).toEqual({
        Swimming: "core",
        "The Hunt Bonus": "bonus",
        Overindulge: "penalty",
        "The Murph": "challenge",
      });
    });
  });
});
