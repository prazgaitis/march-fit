"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";

/**
 * Seed the database with initial data
 * This can be called from the Convex dashboard or CLI
 */
export const seed = action({
  args: {},
  handler: async (ctx) => {
    console.log("🌱 Seeding Convex database...");

    // Seed categories
    console.log("📁 Seeding categories...");
    const categories = await seedCategories(ctx);

    // Seed template activity types
    console.log("📋 Seeding template activity types...");
    const templateActivityTypes = await seedTemplateActivityTypes(ctx, categories);

    // Seed users
    console.log("👥 Seeding users...");
    const users = await seedUsers(ctx);

    // Seed challenges
    console.log("🏆 Seeding challenges...");
    const challenges = await seedChallenges(ctx, users.admin);

    // Seed activity types for challenges
    console.log("⚙️ Seeding activity types for challenges...");
    await seedActivityTypesForChallenges(ctx, challenges, templateActivityTypes);

    // Seed participations
    console.log("🤝 Seeding participations...");
    await seedParticipations(ctx, challenges, users);

    // Seed activities
    console.log("🏃 Seeding activities...");
    await seedActivities(ctx, challenges, users);

    // Seed forum posts
    console.log("💬 Seeding forum posts...");
    await seedForumPosts(ctx, challenges, users);

    // Ensure admin users are set up correctly
    console.log("👑 Ensuring admin users...");
    await ctx.runMutation(internal.mutations.users.ensureAdmins, {});

    console.log("🎉 Database seeding completed!");
    return { success: true };
  },
});

export const seedIfMissing = action({
  args: {},
  handler: async (ctx) => {
    console.log("🌱 Seeding missing data (non-destructive)...");

    console.log("📁 Ensuring categories...");
    const categories = await seedCategories(ctx);

    console.log("📋 Ensuring template activity types...");
    const templateActivityTypes = await seedTemplateActivityTypes(ctx, categories);

    console.log("👥 Ensuring users...");
    const users = await seedUsers(ctx, true);

    console.log("🏆 Ensuring challenges...");
    const challenges = await seedChallenges(ctx, users.admin, true);

    console.log("⚙️ Ensuring activity types for challenges...");
    await seedActivityTypesForChallenges(ctx, challenges, templateActivityTypes, true);

    console.log("🤝 Ensuring participations...");
    await seedParticipations(ctx, challenges, users, true);

    console.log("🏃 Ensuring activities...");
    await seedActivities(ctx, challenges, users, true);

    console.log("💬 Ensuring forum posts...");
    await seedForumPosts(ctx, challenges, users, true);

    console.log("👑 Ensuring admin users...");
    await ctx.runMutation(internal.mutations.users.ensureAdmins, {});

    console.log("🎉 Missing data seeding completed!");
    return { success: true };
  },
});

async function seedCategories(ctx: any) {
  const now = Date.now();

  const categoryData = [
    { name: "Outdoor Running", description: "Running, jogging, hiking, walking for fitness" },
    { name: "Cycling", description: "Outdoor cycling activities" },
    { name: "Low Intensity Cardio", description: "<75% max HR - lifting, pilates, bouldering, elliptical" },
    { name: "High Intensity Cardio", description: ">75% max HR - HIIT, interval training, boxing, cardio sports" },
    { name: "Rowing", description: "Indoor rowers and ski ergs" },
    { name: "Special", description: "Special challenge workouts and events" },
    { name: "Bonus", description: "Bonus activities and achievements" },
    { name: "Penalty", description: "Activities that result in point deductions" },
    { name: "Horses", description: "Horse-related activities" },
  ];

  const categories: Record<string, any> = {};

  for (const cat of categoryData) {
    // Check if category exists
    const existing = await ctx.runQuery(internal.queries.categories.getByName, {
      name: cat.name,
    });

    if (existing) {
      categories[cat.name] = existing;
    } else {
      const id = await ctx.runMutation(internal.mutations.categories.create, {
        name: cat.name,
        description: cat.description,
        createdAt: now,
        updatedAt: now,
      });
      categories[cat.name] = { _id: id, ...cat };
    }
  }

  return categories;
}

async function seedTemplateActivityTypes(ctx: any, categories: Record<string, any>) {
  const now = Date.now();
  const existingTemplates = await ctx.runQuery(internal.queries.templates.list, {});

  const templateData = [
    // Core workout activities
    {
      name: "Outdoor Run",
      categoryId: categories["Outdoor Running"]._id,
      scoringConfig: { type: "distance", unit: "miles", pointsPerUnit: 7.5 },
      contributesToStreak: true,
      isNegative: false,
      bonusThresholds: [
        {
          metric: "distance_miles",
          threshold: 26.2,
          bonusPoints: 50,
          description: "Marathon bonus",
        },
      ],
    },
    {
      name: "Outdoor Cycling",
      categoryId: categories["Cycling"]._id,
      scoringConfig: { type: "distance", unit: "miles", pointsPerUnit: 1.8 },
      contributesToStreak: true,
      isNegative: false,
      bonusThresholds: [
        {
          metric: "distance_miles",
          threshold: 112,
          bonusPoints: 50,
          description: "Ironman bike bonus",
        },
      ],
    },
    {
      name: "Rowing",
      categoryId: categories["Rowing"]._id,
      scoringConfig: { type: "distance", unit: "kilometers", pointsPerUnit: 5.5 },
      contributesToStreak: true,
      isNegative: false,
      bonusThresholds: [
        {
          metric: "distance_km",
          threshold: 42.2,
          bonusPoints: 50,
          description: "Marathon erg bonus",
        },
      ],
    },
    {
      name: "Swimming",
      categoryId: categories["High Intensity Cardio"]._id,
      scoringConfig: { type: "distance", unit: "miles", pointsPerUnit: 20 },
      contributesToStreak: true,
      isNegative: false,
      bonusThresholds: [
        {
          metric: "distance_miles",
          threshold: 2.4,
          bonusPoints: 50,
          description: "Ironman swim bonus",
        },
      ],
    },
    {
      name: "Hi-Intensity Cardio",
      categoryId: categories["High Intensity Cardio"]._id,
      scoringConfig: { type: "duration", unit: "minutes", pointsPerUnit: 0.9 },
      contributesToStreak: true,
      isNegative: false,
    },
    {
      name: "Lo-Intensity Cardio",
      categoryId: categories["Low Intensity Cardio"]._id,
      scoringConfig: { type: "duration", unit: "minutes", pointsPerUnit: 0.6 },
      contributesToStreak: true,
      isNegative: false,
    },
    {
      name: "Yoga / Stretching",
      categoryId: categories["Low Intensity Cardio"]._id,
      scoringConfig: { type: "duration", unit: "minutes", pointsPerUnit: 0.4 },
      contributesToStreak: true,
      isNegative: false,
    },
    {
      name: "Horses",
      categoryId: categories["Horses"]._id,
      scoringConfig: { type: "count", unit: "horses", pointsPerUnit: 16.75 },
      contributesToStreak: true,
      isNegative: false,
    },
    // Special challenges
    {
      name: "The Murph",
      description: "1 mile run, 100 pull-ups, 200 push-ups, 300 squats, 1 mile run",
      categoryId: categories["Special"]._id,
      scoringConfig: {
        type: "variant",
        defaultVariant: "standard",
        variants: {
          standard: {
            name: "Standard",
            points: 65,
          },
          weighted: {
            name: "Weighted Vest (20+ lbs)",
            points: 85,
          },
        },
      },
      contributesToStreak: true,
      isNegative: false,
    },
    {
      name: "Hotel Room Workout",
      categoryId: categories["Special"]._id,
      scoringConfig: { type: "count", unit: "completion", pointsPerUnit: 50 },
      contributesToStreak: true,
      isNegative: false,
    },
    {
      name: "The Max",
      categoryId: categories["Special"]._id,
      scoringConfig: { type: "count", unit: "circuits", pointsPerUnit: 20 },
      contributesToStreak: true,
      isNegative: false,
    },
    {
      name: "Thigh Burner Special",
      categoryId: categories["Special"]._id,
      scoringConfig: { type: "count", unit: "completion", pointsPerUnit: 60 },
      contributesToStreak: true,
      isNegative: false,
    },
    // Burpee challenges
    {
      name: "Burpee Challenge Week 1",
      categoryId: categories["Special"]._id,
      scoringConfig: { type: "count", unit: "completion", pointsPerUnit: 1 },
      contributesToStreak: true,
      isNegative: false,
    },
    {
      name: "Burpee Challenge Week 2",
      categoryId: categories["Special"]._id,
      scoringConfig: { type: "count", unit: "completion", pointsPerUnit: 1 },
      contributesToStreak: true,
      isNegative: false,
    },
    {
      name: "Burpee Challenge Week 3",
      categoryId: categories["Special"]._id,
      scoringConfig: { type: "count", unit: "completion", pointsPerUnit: 1 },
      contributesToStreak: true,
      isNegative: false,
    },
    {
      name: "Burpee Challenge Week 4",
      categoryId: categories["Special"]._id,
      scoringConfig: { type: "count", unit: "burpees", pointsPerUnit: 0.5 },
      contributesToStreak: true,
      isNegative: false,
    },
    // Bonus activities
    {
      name: "Workout with a Friend",
      categoryId: categories["Bonus"]._id,
      scoringConfig: { type: "count", unit: "completion", pointsPerUnit: 25 },
      contributesToStreak: false,
      isNegative: false,
    },
    {
      name: "10 Days of Mindfulness",
      categoryId: categories["Bonus"]._id,
      scoringConfig: { type: "count", unit: "completion", pointsPerUnit: 100 },
      contributesToStreak: false,
      isNegative: false,
    },
    {
      name: "March Fitness Triathlon",
      categoryId: categories["Bonus"]._id,
      scoringConfig: { type: "count", unit: "completion", pointsPerUnit: 100 },
      contributesToStreak: false,
      isNegative: false,
    },
    {
      name: "Skiing Half Day",
      categoryId: categories["Bonus"]._id,
      scoringConfig: { type: "count", unit: "half_days", pointsPerUnit: 15 },
      contributesToStreak: true,
      isNegative: false,
    },
    {
      name: "Skiing Full Day",
      categoryId: categories["Bonus"]._id,
      scoringConfig: { type: "count", unit: "full_days", pointsPerUnit: 35 },
      contributesToStreak: true,
      isNegative: false,
    },
    {
      name: "Sally-up challenge",
      categoryId: categories["Bonus"]._id,
      scoringConfig: { type: "count", unit: "completion", pointsPerUnit: 1 },
      contributesToStreak: true,
      isNegative: false,
    },
    {
      name: "Tracy Anderson Arms",
      categoryId: categories["Bonus"]._id,
      scoringConfig: { type: "count", unit: "completion", pointsPerUnit: 1 },
      contributesToStreak: true,
      isNegative: false,
    },
    {
      name: "Partner Week Card Workout",
      categoryId: categories["Special"]._id,
      scoringConfig: { type: "count", unit: "completion", pointsPerUnit: 70 },
      contributesToStreak: true,
      isNegative: false,
    },
    {
      name: "Active Recovery Fight and Flow Practice",
      categoryId: categories["Special"]._id,
      scoringConfig: { type: "count", unit: "completion", pointsPerUnit: 65 },
      contributesToStreak: true,
      isNegative: false,
    },
    // Penalty activities
    {
      name: "Drinks",
      categoryId: categories["Penalty"]._id,
      scoringConfig: { type: "count", unit: "drinks", pointsPerUnit: 5 },
      contributesToStreak: false,
      isNegative: true,
    },
    {
      name: "Overindulge",
      categoryId: categories["Penalty"]._id,
      scoringConfig: { type: "count", unit: "instances", pointsPerUnit: 10 },
      contributesToStreak: false,
      isNegative: true,
    },
  ];

  const templates: any[] = [];

  for (const template of templateData) {
    const existing = existingTemplates.find((t: any) => t.name === template.name);
    if (existing) {
      templates.push(existing);
      continue;
    }

    const id = await ctx.runMutation(internal.mutations.templates.create, {
      ...template,
      createdAt: now,
      updatedAt: now,
    });
    templates.push({ _id: id, ...template });
  }

  return templates;
}

async function seedUsers(ctx: any, idempotent = false) {
  const now = Date.now();

  const getOrCreateUser = async (user: { username: string; email: string; name: string; role: "admin" | "user" }) => {
    if (idempotent) {
      const existing = await ctx.runQuery(internal.queries.users.getByEmail, { email: user.email });
      if (existing) return existing._id;
    }
    return await ctx.runMutation(internal.mutations.users.create, {
      ...user,
      createdAt: now,
      updatedAt: now,
    });
  };

  const adminId = await getOrCreateUser({
    username: "prazgaitis",
    email: "prazgaitis@gmail.com",
    name: "Paulius Razgaitis",
    role: "admin",
  });

  // Second admin user
  const admin2Id = await getOrCreateUser({
    username: "paul",
    email: "paul@gocomplete.ai",
    name: "Paul Razgaitis",
    role: "admin",
  });

  const sampleUserId = await getOrCreateUser({
    username: "sampleuser",
    email: "sample@example.com",
    name: "Sample User",
    role: "user",
  });

  const additionalUsers = [
    { username: "alice_runs", email: "alice@example.com", name: "Alice Johnson" },
    { username: "bob_cyclist", email: "bob@example.com", name: "Bob Smith" },
    { username: "carol_yoga", email: "carol@example.com", name: "Carol Williams" },
    { username: "david_lifts", email: "david@example.com", name: "David Brown" },
    { username: "emma_swimmer", email: "emma@example.com", name: "Emma Davis" },
  ];

  const additionalUserIds = [];
  for (const user of additionalUsers) {
    const id = await getOrCreateUser({ ...user, role: "user" });
    additionalUserIds.push(id);
  }

  return {
    admin: adminId,
    admin2: admin2Id,
    sample: sampleUserId,
    additional: additionalUserIds,
  };
}

async function seedChallenges(ctx: any, adminUserId: any, idempotent = false) {
  const now = Date.now();

  // Create at least one active challenge (current month)
  const currentMonth = new Date(now);
  const formatDateOnly = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const monthStart = formatDateOnly(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
  const monthEnd = formatDateOnly(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0));
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

  const challengeData = [
    {
      name: "Current Month Fitness Challenge",
      description: "Get fit this month with daily activities! Join our community challenge to build healthy habits and compete with friends.",
      startDate: monthStart,
      endDate: monthEnd,
      durationDays: daysInMonth,
      streakMinPoints: 10,
      weekCalcMethod: "sunday",
    },
    {
      name: "March Fitness Challenge",
      description: "Get fit this March with daily activities! Join our community challenge to build healthy habits and compete with friends.",
      startDate: "2025-03-01",
      endDate: "2025-03-31",
      durationDays: 31,
      streakMinPoints: 10,
      weekCalcMethod: "sunday",
    },
    {
      name: "February Warmup Challenge",
      description: "Warm up for March with a full month of consistent movement. Build your streak and momentum in February.",
      startDate: "2026-02-01",
      endDate: "2026-02-28",
      durationDays: 28,
      streakMinPoints: 10,
      weekCalcMethod: "sunday",
    },
    {
      name: "Summer Shape-Up Challenge",
      description: "Get ready for summer with this intensive 6-week fitness challenge. Focus on strength, cardio, and flexibility.",
      startDate: "2025-06-01",
      endDate: "2025-07-15",
      durationDays: 45,
      streakMinPoints: 15,
      weekCalcMethod: "sunday",
    },
    {
      name: "New Year, New You",
      description: "Start the year strong with our most popular challenge! Build lasting habits that will transform your health.",
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      durationDays: 31,
      streakMinPoints: 12,
      weekCalcMethod: "sunday",
    },
    {
      name: "Holiday Wellness Challenge",
      description: "Stay healthy during the holiday season. Focus on mindful movement and stress-relief activities.",
      startDate: "2024-12-01",
      endDate: "2024-12-31",
      durationDays: 31,
      streakMinPoints: 8,
      weekCalcMethod: "sunday",
    },
    {
      name: "Spring Sprint Challenge",
      description: "A quick 2-week intensive challenge to jumpstart your spring fitness routine. High energy, big results!",
      startDate: "2025-04-15",
      endDate: "2025-04-28",
      durationDays: 14,
      streakMinPoints: 20,
      weekCalcMethod: "sunday",
    },
    {
      name: "March Fitness 2026",
      description: "The ultimate March Fitness challenge returns for 2026! 31 days of movement, streaks, and friendly competition.",
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      durationDays: 31,
      streakMinPoints: 10,
      weekCalcMethod: "sunday",
    },
  ];

  const challengeIds = [];
  for (const challenge of challengeData) {
    if (idempotent) {
      const existing = await ctx.runQuery(internal.queries.challenges.getByName, {
        name: challenge.name,
      });
      if (existing) {
        challengeIds.push(existing._id);
        continue;
      }
    }

    const id = await ctx.runMutation(internal.mutations.challenges.create, {
      ...challenge,
      creatorId: adminUserId,
      createdAt: now,
      updatedAt: now,
    });
    challengeIds.push(id);
  }

  return challengeIds;
}

async function seedActivityTypesForChallenges(
  ctx: any,
  challengeIds: any[],
  templateActivityTypes: any[],
  idempotent = false,
) {
  const now = Date.now();

  for (const challengeId of challengeIds) {
    if (idempotent) {
      const existing = await ctx.runQuery(internal.queries.activityTypes.listByChallenge, { challengeId });
      if (existing.length > 0) {
        continue;
      }
    }

    for (const template of templateActivityTypes) {
      await ctx.runMutation(internal.mutations.activityTypes.create, {
        challengeId,
        templateId: template._id,
        name: template.name,
        categoryId: template.categoryId,
        scoringConfig: template.scoringConfig,
        contributesToStreak: template.contributesToStreak,
        isNegative: template.isNegative,
        bonusThresholds: template.bonusThresholds,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

async function seedParticipations(ctx: any, challengeIds: any[], users: any, idempotent = false) {
  const now = Date.now();
  const userCounts = [5, 3, 4, 2, 3, 1];

  for (let i = 0; i < challengeIds.length; i++) {
    const challengeId = challengeIds[i];
    const userCount = userCounts[i] || 2;
    if (idempotent) {
      const existing = await ctx.runQuery(internal.queries.participations.getRecent, { challengeId, limit: 1 });
      if (existing.length > 0) {
        continue;
      }
    }

    // Add admin user (creator)
    await ctx.runMutation(internal.mutations.participations.create, {
      challengeId,
      userId: users.admin,
      invitedByUserId: undefined,
      joinedAt: now,
      totalPoints: 0,
      currentStreak: 0,
      modifierFactor: 1,
      paymentStatus: "paid",
      updatedAt: now,
    });

    // Add sample user
    await ctx.runMutation(internal.mutations.participations.create, {
      challengeId,
      userId: users.sample,
      invitedByUserId: users.admin,
      joinedAt: now,
      totalPoints: 0,
      currentStreak: 0,
      modifierFactor: 1,
      paymentStatus: "paid",
      updatedAt: now,
    });

    // Add additional users
    for (let j = 0; j < Math.min(userCount, users.additional.length); j++) {
      await ctx.runMutation(internal.mutations.participations.create, {
        challengeId,
        userId: users.additional[j],
        invitedByUserId: users.admin,
        joinedAt: now,
        totalPoints: 0,
        currentStreak: 0,
        modifierFactor: 1,
        paymentStatus: "paid",
        updatedAt: now,
      });
    }
  }
}

async function seedActivities(ctx: any, challengeIds: any[], users: any, idempotent = false) {
  // This is a simplified version - you can expand it to generate random activities
  // For now, we'll just create a few sample activities
  const now = Date.now();

  // Get activity types for the first challenge
  const activityTypes = await ctx.runQuery(internal.queries.activityTypes.listByChallenge, {
    challengeId: challengeIds[0],
  });

  if (activityTypes.length === 0) return;

  if (idempotent) {
    const existingActivities = await ctx.runQuery(internal.queries.activities.listByChallenge, {
      challengeId: challengeIds[0],
      limit: 1,
    });
    if (existingActivities.length > 0) return;
  }

  // Create a few sample activities
  const sampleActivities = [
    {
      userId: users.admin,
      challengeId: challengeIds[0],
      activityTypeId: activityTypes[0]._id,
      loggedDate: Date.now() - 86400000, // Yesterday
      metrics: { distance: 5.2 },
      pointsEarned: 39,
      source: "manual" as const,
      flagged: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const activity of sampleActivities) {
    await ctx.runMutation(internal.mutations.activities.create, activity);
  }
}

async function seedForumPosts(ctx: any, challengeIds: any[], users: any, idempotent = false) {
  const challengeId = challengeIds[0];

  if (idempotent) {
    const existing = await ctx.runQuery(api.queries.forumPosts.listByChallenge, {
      challengeId,
      paginationOpts: { numItems: 1, cursor: null },
    });
    if (existing.page.length > 0) return;
  }

  const now = Date.now();
  const DAY = 86400000;

  const allUsers = [users.admin, users.sample, ...users.additional];

  const posts = [
    {
      userId: users.admin,
      title: "Welcome to the Challenge Forum!",
      content:
        "Hey everyone! Use this space to share tips, ask questions, and motivate each other throughout the challenge. Let's crush it this month!",
      isPinned: true,
      createdAt: now - 7 * DAY,
    },
    {
      userId: allUsers[2] ?? users.sample,
      title: "Best pre-workout meals?",
      content:
        "I've been struggling with energy during morning workouts. What do you all eat before exercising? Looking for something quick that won't sit heavy.",
      createdAt: now - 5 * DAY,
    },
    {
      userId: allUsers[3] ?? users.sample,
      title: "Rest day guilt — anyone else?",
      content:
        "I know rest days are important for recovery but I always feel guilty taking them during the challenge. How do you deal with it?",
      createdAt: now - 4 * DAY,
    },
    {
      userId: users.sample,
      title: "New personal best on my 5K!",
      content:
        "Just ran my fastest 5K ever — 22:34! The streak motivation from this challenge is really pushing me. Thanks for the energy everyone 🏃",
      createdAt: now - 3 * DAY,
    },
    {
      userId: allUsers[4] ?? users.admin,
      title: "Stretching routine recommendations",
      content:
        "I've been getting tight hamstrings from all the running. Does anyone have a good 10-15 minute stretching routine they swear by?",
      createdAt: now - 2 * DAY,
    },
    {
      userId: allUsers[5] ?? users.sample,
      title: "Week 2 check-in — how's everyone doing?",
      content:
        "We're halfway through week 2! Share your progress, struggles, or wins. I've managed to keep my streak alive so far but yesterday was close.",
      createdAt: now - 1 * DAY,
    },
  ];

  const postIds = [];
  for (const post of posts) {
    const id = await ctx.runMutation(internal.mutations.forumPosts.internalCreate, {
      challengeId,
      userId: post.userId,
      title: post.title,
      content: post.content,
      isPinned: post.isPinned ?? false,
      createdAt: post.createdAt,
      updatedAt: post.createdAt,
    });
    postIds.push(id);
  }

  // Add some replies
  const replies = [
    {
      parentIndex: 0,
      userId: users.sample,
      content: "Thanks for setting this up! Excited to be part of the challenge.",
      createdAt: now - 6.5 * DAY,
    },
    {
      parentIndex: 0,
      userId: allUsers[3] ?? users.sample,
      content: "Let's go!! Already logged my first workout today.",
      createdAt: now - 6 * DAY,
    },
    {
      parentIndex: 1,
      userId: users.admin,
      content:
        "I usually go with a banana and some peanut butter about 30 minutes before. Light but gives good energy.",
      createdAt: now - 4.5 * DAY,
    },
    {
      parentIndex: 1,
      userId: allUsers[4] ?? users.sample,
      content: "Oatmeal with berries has been my go-to. Easy to digest and keeps me fueled for a full hour.",
      createdAt: now - 4 * DAY,
    },
    {
      parentIndex: 2,
      userId: users.admin,
      content:
        "Rest days are part of the program! Your muscles need recovery to get stronger. No guilt needed.",
      createdAt: now - 3.5 * DAY,
    },
    {
      parentIndex: 3,
      userId: allUsers[2] ?? users.admin,
      content: "That's awesome! Congrats on the PR! 🎉",
      createdAt: now - 2.5 * DAY,
    },
  ];

  for (const reply of replies) {
    await ctx.runMutation(internal.mutations.forumPosts.internalCreate, {
      challengeId,
      userId: reply.userId,
      content: reply.content,
      parentPostId: postIds[reply.parentIndex],
      createdAt: reply.createdAt,
      updatedAt: reply.createdAt,
    });
  }
}
