"use node";

import { action } from "../_generated/server";
import { internal, api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// Get category IDs by name
async function getCategoryIds(ctx: any): Promise<Record<string, Id<"categories">>> {
  const categories: Record<string, Id<"categories">> = {};
  const categoryNames = [
    "Outdoor Running",
    "Cycling",
    "Low Intensity Cardio",
    "High Intensity Cardio",
    "Rowing",
    "Special",
    "Bonus",
    "Penalty",
    "Horses",
  ];

  for (const name of categoryNames) {
    const cat = await ctx.runQuery(internal.queries.categories.getByName, { name });
    if (cat) {
      categories[name] = cat._id;
    }
  }
  return categories;
}

// Activity type definitions
function getActivityTypeDefinitions(categories: Record<string, Id<"categories">>) {
  const now = Date.now();

  return {
    // ============ CORE CARDIO WITH BONUS THRESHOLDS ============
    core: [
      {
        name: "Outdoor Run",
        description: "Running, jogging, hiking, walking for fitness. 7.5 points per mile.",
        scoringConfig: { type: "unit_based", unit: "miles", pointsPerUnit: 7.5 },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Outdoor Running"],
        bonusThresholds: [
          { metric: "distance_miles", threshold: 13.1, bonusPoints: 25, description: "Half Marathon bonus" },
          { metric: "distance_miles", threshold: 26.2, bonusPoints: 100, description: "Marathon bonus" },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Outdoor Cycling",
        description: "Outdoor cycling activities. 2.4 points per mile.",
        scoringConfig: { type: "unit_based", unit: "miles", pointsPerUnit: 2.4 },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Cycling"],
        bonusThresholds: [
          { metric: "distance_miles", threshold: 100, bonusPoints: 50, description: "Century ride bonus" },
          { metric: "distance_miles", threshold: 112, bonusPoints: 100, description: "Ironman bike bonus" },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Rowing",
        description: "Indoor rowers and ski ergs. 5.5 points per kilometer.",
        scoringConfig: { type: "unit_based", unit: "kilometers", pointsPerUnit: 5.5 },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Rowing"],
        bonusThresholds: [
          { metric: "distance_km", threshold: 42.2, bonusPoints: 100, description: "Marathon erg bonus" },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Swimming",
        description: "Pool or open water swimming. 15 points per mile.",
        scoringConfig: { type: "unit_based", unit: "miles", pointsPerUnit: 15 },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["High Intensity Cardio"],
        bonusThresholds: [
          { metric: "distance_miles", threshold: 2.4, bonusPoints: 50, description: "Ironman swim bonus" },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Hi-Intensity Cardio",
        description: ">75% max HR - HIIT, interval training, boxing, cardio sports. 0.9 points per minute.",
        scoringConfig: { type: "unit_based", unit: "minutes", pointsPerUnit: 0.9 },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["High Intensity Cardio"],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Lo-Intensity Cardio",
        description: "<75% max HR - lifting, pilates, bouldering, elliptical. 0.6 points per minute.",
        scoringConfig: { type: "unit_based", unit: "minutes", pointsPerUnit: 0.6 },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Low Intensity Cardio"],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Yoga / Stretching",
        description: "Yoga, stretching, mobility work. 0.4 points per minute.",
        scoringConfig: { type: "unit_based", unit: "minutes", pointsPerUnit: 0.4 },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Low Intensity Cardio"],
        createdAt: now,
        updatedAt: now,
      },
    ],

    // ============ OTHER ACTIVITIES ============
    other: [
      {
        name: "Horses",
        description: "Horse-related fitness activities. 16.75 points per horse.",
        scoringConfig: { type: "unit_based", unit: "horses", pointsPerUnit: 16.75 },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Horses"],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Skiing Full Day",
        description: "Full day of skiing. 35 points. Note: Does not extend streak.",
        scoringConfig: { type: "unit_based", unit: "full days", pointsPerUnit: 35 },
        contributesToStreak: false,
        isNegative: false,
        categoryId: categories["Low Intensity Cardio"],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Skiing Half Day",
        description: "Half day of skiing. 15 points. Note: Does not extend streak.",
        scoringConfig: { type: "unit_based", unit: "half days", pointsPerUnit: 15 },
        contributesToStreak: false,
        isNegative: false,
        categoryId: categories["Low Intensity Cardio"],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Hotel Room Workout",
        description: "Workout while traveling. 50 points.",
        scoringConfig: { type: "completion", fixedPoints: 50 },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Special"],
        createdAt: now,
        updatedAt: now,
      },
    ],

    // ============ WEEKLY CHALLENGES (TIERED) ============
    challenges: [
      {
        name: "Burpee Challenge Week 1",
        description: "100 burpees. Chest and thighs must touch ground. <10min=50pts, <12min=30pts, >12min=10pts.",
        scoringConfig: {
          type: "tiered",
          metric: "duration_minutes",
          tiers: [
            { maxValue: 10, points: 50 },
            { maxValue: 12, points: 30 },
            { points: 10 },
          ],
        },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Special"],
        validWeeks: [1],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Burpee Challenge Week 2",
        description: "110 burpees. Chest and thighs must touch ground. <10min=50pts, <12min=30pts, >12min=10pts.",
        scoringConfig: {
          type: "tiered",
          metric: "duration_minutes",
          tiers: [
            { maxValue: 10, points: 50 },
            { maxValue: 12, points: 30 },
            { points: 10 },
          ],
        },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Special"],
        validWeeks: [2],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Burpee Challenge Week 3",
        description: "120 burpees. Chest and thighs must touch ground. <10min=50pts, <12min=30pts, >12min=10pts.",
        scoringConfig: {
          type: "tiered",
          metric: "duration_minutes",
          tiers: [
            { maxValue: 10, points: 50 },
            { maxValue: 12, points: 30 },
            { points: 10 },
          ],
        },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Special"],
        validWeeks: [3],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Burpee Challenge Week 4",
        description: "130 burpees. Chest and thighs must touch ground. <10min=50pts, <12min=30pts, >12min=10pts.",
        scoringConfig: {
          type: "tiered",
          metric: "duration_minutes",
          tiers: [
            { maxValue: 10, points: 50 },
            { maxValue: 12, points: 30 },
            { points: 10 },
          ],
        },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Special"],
        validWeeks: [4],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "The Max",
        description: "Circuit: 25 Squats + 20 Curls | 25 Squats + 20 Lunges | 25 Squats + 20 Overhead Press | 25 Squats + 20 Bent Over Rows. Never put the bar down! 20 points per circuit, max 3 circuits.",
        scoringConfig: {
          type: "unit_based",
          unit: "circuits",
          pointsPerUnit: 20,
          maxUnits: 3,
        },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Special"],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Sally-up Challenge",
        description: "How long can you hold? <60s=0pts, 60-90s=5pts, 90-120s=15pts, 120-180s=25pts, Full Video=40pts. One-time opportunity.",
        scoringConfig: {
          type: "tiered",
          metric: "duration_seconds",
          tiers: [
            { maxValue: 60, points: 0 },
            { maxValue: 90, points: 5 },
            { maxValue: 120, points: 15 },
            { maxValue: 180, points: 25 },
            { points: 40 },
          ],
        },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Special"],
        maxPerChallenge: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Tracy Anderson Arms",
        description: "See how long you can go without resting arms. 4+ min=20pts, Full Video=40pts. One-time opportunity.",
        scoringConfig: {
          type: "tiered",
          metric: "duration_minutes",
          tiers: [
            { maxValue: 4, points: 0 },
            { maxValue: 999, points: 20 },
            { points: 40 }, // Full video
          ],
        },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Special"],
        maxPerChallenge: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "The Murph",
        description: "1 Mile Run, 100 Pull ups, 200 Push ups, 300 Air squats, 1 Mile Run. 65pts base, +40pts with 20lb weighted vest.",
        scoringConfig: {
          type: "completion",
          fixedPoints: 65,
          optionalBonuses: [
            { name: "Weighted Vest", bonusPoints: 40, description: "Completed with 20lb weighted vest" },
          ],
        },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Special"],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "10 Days of Mindfulness",
        description: "Meditate, journal, reflect, pray for 10+ uninterrupted minutes for 10 straight days. 100 points. Limit 1 per challenge.",
        scoringConfig: { type: "completion", fixedPoints: 100 },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Special"],
        maxPerChallenge: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],

    // ============ SELF-AWARDED BONUSES ============
    selfBonuses: [
      {
        name: "Workout with a Friend",
        description: "Log when you work out with a friend. 25 points. One-time, Week 3 only.",
        scoringConfig: { type: "completion", fixedPoints: 25 },
        contributesToStreak: false,
        isNegative: false,
        categoryId: categories["Bonus"],
        maxPerChallenge: 1,
        validWeeks: [3],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Retro Abs Bonus",
        description: "Complete the retro abs workout. 15 points.",
        scoringConfig: { type: "completion", fixedPoints: 15 },
        contributesToStreak: true,
        isNegative: false,
        categoryId: categories["Special"],
        createdAt: now,
        updatedAt: now,
      },
    ],

    // ============ MINI-GAME BONUSES (ADMIN-AWARDED) ============
    miniGameBonuses: [
      {
        name: "Partner Week Bonus",
        description: "Awarded at the end of Partner Week based on your partnership performance.",
        scoringConfig: { type: "variable" },
        contributesToStreak: false,
        isNegative: false,
        categoryId: categories["Bonus"],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "PR Week Bonus",
        description: "Awarded if you hit a PR during PR Week.",
        scoringConfig: { type: "variable" },
        contributesToStreak: false,
        isNegative: false,
        categoryId: categories["Bonus"],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "The Hunt Bonus",
        description: "Awarded based on Hunt Week results.",
        scoringConfig: { type: "variable" },
        contributesToStreak: false,
        isNegative: false,
        categoryId: categories["Bonus"],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Category Leader Bonus",
        description: "Awarded to category leaders at end of challenge.",
        scoringConfig: { type: "variable" },
        contributesToStreak: false,
        isNegative: false,
        categoryId: categories["Bonus"],
        createdAt: now,
        updatedAt: now,
      },
    ],

    // ============ PENALTIES ============
    penalties: [
      {
        name: "Drinks",
        description: "Log your drinks. First one is free each day, then -5 points per drink.",
        scoringConfig: {
          type: "unit_based",
          unit: "drinks",
          pointsPerUnit: 5,
          dailyFreeUnits: 1,
        },
        contributesToStreak: false,
        isNegative: true,
        categoryId: categories["Penalty"],
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Overindulge",
        description: "Self-logged penalty for overindulgence. -10 points per occurrence.",
        scoringConfig: { type: "unit_based", unit: "count", pointsPerUnit: 10 },
        contributesToStreak: false,
        isNegative: true,
        categoryId: categories["Penalty"],
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

export const setup2026ActivityTypes = action({
  args: {},
  handler: async (ctx) => {
    console.log("🏋️ Setting up activity types for 2026 challenges...");

    // Get challenge IDs
    const challenges = await ctx.runQuery(api.queries.challenges.listPublic, { limit: 100 });

    const febWarmup = challenges.find((c: any) => c.name === "February Warmup 2026");
    const marchFitness = challenges.find((c: any) => c.name === "March Fitness 2026");

    if (!febWarmup || !marchFitness) {
      throw new Error("2026 challenges not found. Run setup2026Challenges first.");
    }

    // Get category IDs
    const categories = await getCategoryIds(ctx);
    console.log("📁 Found categories:", Object.keys(categories));

    // Get activity type definitions
    const defs = getActivityTypeDefinitions(categories);

    // All activity types to create
    const allActivityTypes = [
      ...defs.core,
      ...defs.other,
      ...defs.challenges,
      ...defs.selfBonuses,
      ...defs.miniGameBonuses,
      ...defs.penalties,
    ];

    // Create for both challenges
    const challengeIds = [
      { id: febWarmup.id, name: "February Warmup 2026" },
      { id: marchFitness.id, name: "March Fitness 2026" },
    ];

    const results: Record<string, number> = {};

    for (const challenge of challengeIds) {
      console.log(`\n📝 Creating activity types for ${challenge.name}...`);
      let count = 0;

      for (const activityType of allActivityTypes) {
        await ctx.runMutation(internal.mutations.activityTypes.create, {
          ...activityType,
          challengeId: challenge.id as Id<"challenges">,
        });
        count++;
      }

      results[challenge.name] = count;
      console.log(`✅ Created ${count} activity types for ${challenge.name}`);
    }

    console.log("\n🎉 Activity types setup complete!");

    return {
      success: true,
      results,
      totalTypes: allActivityTypes.length,
    };
  },
});
