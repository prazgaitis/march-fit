import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table - linked to Better Auth via email
  users: defineTable({
    username: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
    age: v.optional(v.number()),
    role: v.union(v.literal("user"), v.literal("admin")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("username", ["username"])
    .index("email", ["email"]),

  // User Integrations
  userIntegrations: defineTable({
    userId: v.id("users"),
    service: v.union(v.literal("strava"), v.literal("apple_health")),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    athleteId: v.optional(v.number()), // Strava athlete ID for webhook lookups
    webhookSubscriptionId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    revoked: v.boolean(),
  })
    .index("userId", ["userId"])
    .index("athleteId", ["athleteId"]),

  // Challenges
  challenges: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    creatorId: v.id("users"),
    startDate: v.union(v.string(), v.number()),
    endDate: v.union(v.string(), v.number()),
    streakMinPoints: v.number(),
    durationDays: v.number(),
    weekCalcMethod: v.string(),
    autoFlagRules: v.optional(v.any()),
    // Welcome content
    welcomeVideoUrl: v.optional(v.string()), // YouTube/Vimeo embed URL
    welcomeMessage: v.optional(v.string()), // Rich text welcome message
    // Visibility
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    // Announcement
    announcement: v.optional(v.string()), // Current announcement text
    announcementUpdatedAt: v.optional(v.number()), // When announcement was last changed
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("creatorId", ["creatorId"]),

  // Activity Types
  activityTypes: defineTable({
    challengeId: v.id("challenges"),
    templateId: v.optional(v.id("templateActivityTypes")),
    name: v.string(),
    description: v.optional(v.string()),
    scoringConfig: v.any(),
    contributesToStreak: v.boolean(),
    isNegative: v.boolean(),
    categoryId: v.optional(v.id("categories")),
    // Threshold bonuses - auto-apply bonus points when metrics exceed thresholds
    bonusThresholds: v.optional(
      v.array(
        v.object({
          metric: v.string(), // e.g., "distance_miles", "distance_km", "duration_minutes"
          threshold: v.number(), // e.g., 26.2 for marathon
          bonusPoints: v.number(), // bonus points to award
          description: v.string(), // e.g., "Marathon bonus"
        })
      )
    ),
    // Frequency limits for one-time or limited bonuses
    maxPerChallenge: v.optional(v.number()), // e.g., 1 for one-time bonuses
    // Time restrictions - which weeks this activity type is valid
    validWeeks: v.optional(v.array(v.number())), // e.g., [3] for week 3 only
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("challengeId", ["challengeId"])
    .index("templateId", ["templateId"])
    .index("categoryId", ["categoryId"]),

  // Bonus Rules
  bonusRules: defineTable({
    challengeId: v.id("challenges"),
    description: v.string(),
    conditionConfig: v.any(),
    bonusPoints: v.number(),
    oncePerDay: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("challengeId", ["challengeId"]),

  // Integration Mappings
  integrationMappings: defineTable({
    challengeId: v.id("challenges"),
    service: v.union(v.literal("strava"), v.literal("apple_health")),
    externalType: v.string(),
    activityTypeId: v.id("activityTypes"),
    metricMapping: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("challengeId", ["challengeId"])
    .index("activityTypeId", ["activityTypeId"]),

  // Activities
  activities: defineTable({
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    activityTypeId: v.id("activityTypes"),
    loggedDate: v.number(),
    metrics: v.optional(v.any()),
    pointsEarned: v.number(),
    // Threshold bonuses that were triggered for this activity
    triggeredBonuses: v.optional(
      v.array(
        v.object({
          metric: v.string(),
          threshold: v.number(),
          bonusPoints: v.number(),
          description: v.string(),
        })
      )
    ),
    imageUrl: v.optional(v.string()), // Legacy field for backward compatibility
    mediaIds: v.optional(v.array(v.id("_storage"))), // New field for media attachments
    notes: v.optional(v.string()),
    flagged: v.boolean(),
    flaggedAt: v.optional(v.number()),
    flaggedReason: v.optional(v.string()),
    adminComment: v.optional(v.string()),
    adminCommentVisibility: v.union(
      v.literal("internal"),
      v.literal("participant"),
    ),
    resolutionStatus: v.union(
      v.literal("pending"),
      v.literal("resolved"),
    ),
    resolutionNotes: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    resolvedById: v.optional(v.id("users")),
    source: v.union(
      v.literal("manual"),
      v.literal("strava"),
      v.literal("apple_health"),
      v.literal("mini_game"),
    ),
    externalId: v.optional(v.string()),
    externalData: v.optional(v.any()),
    deletedAt: v.optional(v.number()),
    deletedById: v.optional(v.id("users")),
    deletedReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("userId", ["userId"])
    .index("challengeId", ["challengeId"])
    .index("activityTypeId", ["activityTypeId"])
    .index("resolvedById", ["resolvedById"])
    .index("challengeLoggedDate", ["challengeId", "loggedDate"])
    .index("externalUnique", ["userId", "challengeId", "externalId"])
    .index("by_user_challenge_date", ["userId", "challengeId", "loggedDate"])
    .index("challengeFlagged", ["challengeId", "flagged"]),

  // Flags
  flags: defineTable({
    activityId: v.id("activities"),
    flaggerUserId: v.id("users"),
    reason: v.string(),
    resolved: v.boolean(),
    createdAt: v.number(),
  })
    .index("activityId", ["activityId"])
    .index("flaggerUserId", ["flaggerUserId"]),

  // Activity Flag History
  activityFlagHistory: defineTable({
    activityId: v.id("activities"),
    actorId: v.id("users"),
    actionType: v.union(
      v.literal("flagged"),
      v.literal("comment"),
      v.literal("resolution"),
      v.literal("edit"),
    ),
    payload: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("activityId", ["activityId"])
    .index("actorId", ["actorId"]),

  // Likes
  likes: defineTable({
    activityId: v.id("activities"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("activityId", ["activityId"])
    .index("userId", ["userId"])
    .index("activityUserUnique", ["activityId", "userId"]),

  // Comments
  comments: defineTable({
    activityId: v.id("activities"),
    userId: v.id("users"),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("activityId", ["activityId"])
    .index("userId", ["userId"]),

  // User Challenges (Participations)
  userChallenges: defineTable({
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    role: v.optional(v.union(v.literal("member"), v.literal("admin"))), // Challenge-specific role
    joinedAt: v.number(),
    invitedByUserId: v.optional(v.id("users")),
    totalPoints: v.number(),
    currentStreak: v.number(),
    lastStreakDay: v.optional(v.number()),
    modifierFactor: v.number(),
    paymentStatus: v.union(
      v.literal("unpaid"),
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
    ),
    paymentReceivedAt: v.optional(v.number()),
    paymentReference: v.optional(v.string()),
    dismissedAnnouncementAt: v.optional(v.number()), // When user dismissed the announcement
    updatedAt: v.number(),
  })
    .index("userId", ["userId"])
    .index("challengeId", ["challengeId"])
    .index("invitedByUserId", ["invitedByUserId"])
    .index("userChallengeUnique", ["userId", "challengeId"]),

  // Categories
  categories: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("name", ["name"]),

  // Template Activity Types
  templateActivityTypes: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    scoringConfig: v.any(),
    contributesToStreak: v.boolean(),
    isNegative: v.boolean(),
    categoryId: v.id("categories"),
    bonusThresholds: v.optional(
      v.array(
        v.object({
          metric: v.string(),
          threshold: v.number(),
          bonusPoints: v.number(),
          description: v.string(),
        })
      )
    ),
    // Frequency limits for one-time or limited bonuses
    maxPerChallenge: v.optional(v.number()),
    // Time restrictions - which weeks this activity type is valid
    validWeeks: v.optional(v.array(v.number())),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("categoryId", ["categoryId"]),

  // Notifications
  notifications: defineTable({
    userId: v.id("users"),
    actorId: v.id("users"),
    type: v.string(),
    data: v.optional(v.any()),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("userId", ["userId"])
    .index("actorId", ["actorId"]),

  // Follows (user follow relationships)
  follows: defineTable({
    followerId: v.id("users"), // The user who is following
    followingId: v.id("users"), // The user being followed
    createdAt: v.number(),
  })
    .index("followerId", ["followerId"])
    .index("followingId", ["followingId"])
    .index("followerFollowing", ["followerId", "followingId"]),

  // Mini Games
  miniGames: defineTable({
    challengeId: v.id("challenges"),
    type: v.union(
      v.literal("partner_week"),
      v.literal("hunt_week"),
      v.literal("pr_week"),
    ),
    name: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("calculating"),
      v.literal("completed"),
    ),
    config: v.any(), // Game-specific config (bonus percentages, point values, etc.)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("challengeId", ["challengeId"])
    .index("status", ["status"])
    .index("challengeStatus", ["challengeId", "status"]),

  // Mini Game Participants
  miniGameParticipants: defineTable({
    miniGameId: v.id("miniGames"),
    userId: v.id("users"),
    initialState: v.any(), // Snapshot at game start (rank, points, dailyPr, etc.)
    partnerUserId: v.optional(v.id("users")), // For partner_week
    preyUserId: v.optional(v.id("users")), // For hunt_week - who they're hunting
    hunterUserId: v.optional(v.id("users")), // For hunt_week - who's hunting them
    finalState: v.optional(v.any()), // Snapshot at game end
    bonusPoints: v.optional(v.number()), // Calculated bonus
    outcome: v.optional(v.any()), // Game-specific results (caughtPrey, wasCaught, hitPr, etc.)
    bonusActivityId: v.optional(v.id("activities")), // Reference to awarded bonus activity
    createdAt: v.number(),
  })
    .index("miniGameId", ["miniGameId"])
    .index("userId", ["userId"])
    .index("miniGameUser", ["miniGameId", "userId"]),

  // Achievements - combination bonuses for completing multiple qualifying activities
  achievements: defineTable({
    challengeId: v.id("challenges"),
    name: v.string(), // e.g., "Marathon Club"
    description: v.string(), // e.g., "Complete 3 marathon-length activities"
    bonusPoints: v.number(),
    criteria: v.object({
      activityTypeIds: v.array(v.id("activityTypes")), // Which activity types count
      metric: v.string(), // e.g., "distance_miles"
      threshold: v.number(), // e.g., 26.2
      requiredCount: v.number(), // e.g., 3
    }),
    frequency: v.union(
      v.literal("once_per_challenge"),
      v.literal("once_per_week"),
      v.literal("unlimited")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("challengeId", ["challengeId"]),

  // User Achievements - tracks which users have earned which achievements
  userAchievements: defineTable({
    challengeId: v.id("challenges"),
    userId: v.id("users"),
    achievementId: v.id("achievements"),
    earnedAt: v.number(),
    qualifyingActivityIds: v.array(v.id("activities")), // The activities that qualified
    bonusActivityId: v.optional(v.id("activities")), // Reference to the bonus activity created
  })
    .index("challengeId", ["challengeId"])
    .index("userId", ["userId"])
    .index("achievementId", ["achievementId"])
    .index("userAchievement", ["userId", "achievementId"]),

  // Workspaces
  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    ownerId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("slug", ["slug"])
    .index("ownerId", ["ownerId"]),

  // Memberships
  memberships: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("userId", ["userId"])
    .index("workspaceId", ["workspaceId"])
    .index("userWorkspaceUnique", ["userId", "workspaceId"]),

  // Invitations
  invitations: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
    invitedById: v.optional(v.id("users")),
    invitedUserId: v.optional(v.id("users")),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("expired"),
    ),
    token: v.string(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    declinedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("workspaceId", ["workspaceId"])
    .index("email", ["email"])
    .index("token", ["token"])
    .index("invitedById", ["invitedById"])
    .index("invitedUserId", ["invitedUserId"]),

  // Challenge Invites - personal invite codes per user per challenge
  challengeInvites: defineTable({
    challengeId: v.id("challenges"),
    userId: v.id("users"),
    code: v.string(), // Short alphanumeric invite code
    createdAt: v.number(),
  })
    .index("code", ["code"])
    .index("userChallengeUnique", ["userId", "challengeId"]),

  // Email Sequences - email templates per challenge
  emailSequences: defineTable({
    challengeId: v.id("challenges"),
    name: v.string(),
    subject: v.string(),
    body: v.string(), // HTML content
    trigger: v.union(
      v.literal("manual"), // Admin manually triggers
      v.literal("on_signup"), // Auto-send when user joins challenge
    ),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("challengeId", ["challengeId"])
    .index("challengeTrigger", ["challengeId", "trigger"]),

  // Challenge Payment Config - Stripe settings per challenge
  challengePaymentConfig: defineTable({
    challengeId: v.id("challenges"),
    // Live keys
    stripeSecretKey: v.optional(v.string()), // Encrypted
    stripePublishableKey: v.optional(v.string()),
    // Test keys
    stripeTestSecretKey: v.optional(v.string()), // Encrypted
    stripeTestPublishableKey: v.optional(v.string()),
    // Settings
    testMode: v.boolean(),
    priceInCents: v.number(),
    currency: v.string(), // e.g., "usd"
    // Webhook secret for verifying Stripe webhooks
    stripeWebhookSecret: v.optional(v.string()), // Encrypted
    stripeTestWebhookSecret: v.optional(v.string()), // Encrypted
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("challengeId", ["challengeId"]),

  // Payment Records - individual payment transactions
  paymentRecords: defineTable({
    challengeId: v.id("challenges"),
    userId: v.id("users"),
    userChallengeId: v.optional(v.id("userChallenges")),
    stripeCheckoutSessionId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    amountInCents: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("refunded"),
    ),
    stripeCustomerId: v.optional(v.string()),
    stripeCustomerEmail: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("challengeId", ["challengeId"])
    .index("userId", ["userId"])
    .index("userChallengeId", ["userChallengeId"])
    .index("stripeCheckoutSessionId", ["stripeCheckoutSessionId"])
    .index("stripePaymentIntentId", ["stripePaymentIntentId"]),

  // Email Sends - tracking sent emails
  emailSends: defineTable({
    emailSequenceId: v.id("emailSequences"),
    userId: v.id("users"),
    challengeId: v.id("challenges"),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("emailSequenceId", ["emailSequenceId"])
    .index("userId", ["userId"])
    .index("challengeId", ["challengeId"])
    .index("userSequence", ["userId", "emailSequenceId"]),
});
