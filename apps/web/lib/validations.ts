import { z } from "zod";

export const activitySourceValues = [
  "manual",
  "strava",
  "apple_health",
] as const;

export const integrationServiceValues = [
  "strava",
  "apple_health",
] as const;

export const userRoleValues = ["user", "admin"] as const;
export const activityResolutionStatusValues = [
  "pending",
  "resolved",
  "reopened",
] as const;

export const activityAdminCommentVisibilityValues = [
  "internal",
  "participant",
] as const;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const jsonValueSchema: z.ZodType<Record<string, unknown>> = z
  .record(z.string(), z.any())
  .default({});

export const createChallengeSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  streakMinPoints: z.coerce.number().min(0),
  durationDays: z.coerce.number().int().positive(),
  weekCalcMethod: z.string().min(1).default("from_start"),
  autoFlagRules: jsonValueSchema.optional(),
});

export const updateChallengeSchema = createChallengeSchema
  .partial()
  .extend({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    streakMinPoints: z.coerce.number().min(0).optional(),
    durationDays: z.coerce.number().int().positive().optional(),
  });

export const joinChallengeSchema = z.object({
  invitedByUserId: z.string().uuid().optional(),
});

export const createActivityTypeSchema = z.object({
  templateId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  scoringConfig: jsonValueSchema,
  contributesToStreak: z.boolean().optional(),
  isNegative: z.boolean().optional(),
  categoryId: z.string().uuid().optional(),
});

export const updateActivityTypeSchema = createActivityTypeSchema.partial();

export const createTemplateActivityTypeSchema = z.object({
  name: z.string().min(1).max(200),
  scoringConfig: jsonValueSchema,
  contributesToStreak: z.boolean().optional(),
  isNegative: z.boolean().optional(),
  categoryId: z.string().uuid(),
});

export const updateTemplateActivityTypeSchema =
  createTemplateActivityTypeSchema.partial();

export const logActivitySchema = z.object({
  challengeId: z.string().uuid(),
  activityTypeId: z.string().uuid(),
  loggedDate: z.string(),
  metrics: z.any().optional(),
  notes: z.string().max(5000).optional(),
  imageUrl: z.string().url().optional(),
  source: z.enum(activitySourceValues).default("manual"),
  externalId: z.string().max(255).optional(),
  externalData: z.any().optional(),
});

export const updateActivitySchema = logActivitySchema.partial().extend({
  challengeId: z.string().uuid().optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const createFlagSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export const createBonusRuleSchema = z.object({
  description: z.string().min(1).max(255),
  conditionConfig: jsonValueSchema,
  bonusPoints: z.coerce.number(),
  oncePerDay: z.boolean().optional(),
});

export const updateBonusRuleSchema = createBonusRuleSchema.partial();

export const integrationConnectSchema = z.object({
  service: z.enum(integrationServiceValues),
  code: z.string().min(1),
});

export const createIntegrationMappingSchema = z.object({
  service: z.enum(integrationServiceValues),
  externalType: z.string().min(1).max(200),
  activityTypeId: z.string().uuid(),
  metricMapping: jsonValueSchema.optional(),
});

export const updateIntegrationMappingSchema =
  createIntegrationMappingSchema.partial();

export const createCategorySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const adminUpdateUserSchema = z.object({
  role: z.enum(userRoleValues),
});

export const leaderboardQuerySchema = paginationQuerySchema;

export const categoryLeaderboardQuerySchema = paginationQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  week: z.coerce.number().int().positive().optional(),
});

export const feedQuerySchema = paginationQuerySchema;

export const commentsQuerySchema = paginationQuerySchema;

export const participantsQuerySchema = paginationQuerySchema;

export const flaggedActivitiesQuerySchema = paginationQuerySchema
  .extend({
    status: z
      .enum(activityResolutionStatusValues)
      .optional(),
    participantId: z.string().uuid().optional(),
    search: z.string().optional(),
  })
  .partial({
    page: true,
    limit: true,
  });

export const updateFlagResolutionSchema = z.object({
  resolutionStatus: z.enum(activityResolutionStatusValues),
  resolutionNotes: z.string().max(2000).optional().nullable(),
});

export const adminCommentSchema = z.object({
  comment: z.string().min(1).max(2000),
  visibility: z.enum(activityAdminCommentVisibilityValues).default("internal"),
});

export const adminEditActivitySchema = z.object({
  loggedDate: z.coerce.date().optional(),
  pointsEarned: z.coerce.number().optional(),
  notes: z.string().max(5000).optional().nullable(),
  metrics: jsonValueSchema.optional(),
});
