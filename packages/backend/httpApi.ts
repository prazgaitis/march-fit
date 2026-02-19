/**
 * HTTP API v1 for March Fit
 *
 * RESTful API authenticated via API keys (Bearer token).
 * Designed for CLI and MCP server consumption.
 */
import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import { hashApiKey } from "./lib/apiKey";

// ─── Types ───────────────────────────────────────────────────────────────────

type HttpCtx = {
  runQuery: (ref: any, args: any) => Promise<any>;
  runMutation: (ref: any, args: any) => Promise<any>;
  runAction: (ref: any, args: any) => Promise<any>;
};

type AuthResult = {
  user: Doc<"users">;
  keyId: Id<"apiKeys">;
};

// ─── Response Helpers ────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// ─── Auth Helper ─────────────────────────────────────────────────────────────

async function authenticateApiKey(
  ctx: HttpCtx,
  request: Request
): Promise<AuthResult | Response> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(
      "Missing or invalid Authorization header. Use: Bearer <api-key>",
      401
    );
  }

  const rawKey = authHeader.slice(7);
  if (!rawKey.startsWith("mf_")) {
    return errorResponse("Invalid API key format", 401);
  }

  const keyHash = await hashApiKey(rawKey);
  const result = await ctx.runQuery(internal.queries.apiKeys.getUserByKeyHash, {
    keyHash,
  });

  if (!result) {
    return errorResponse("Invalid or revoked API key", 401);
  }

  // Fire-and-forget lastUsedAt update
  ctx.runMutation(internal.mutations.apiKeys.touchLastUsed, {
    keyId: result.keyId,
  });

  return result as AuthResult;
}

// ─── Route Matching Helper ───────────────────────────────────────────────────

function matchRoute(
  path: string,
  pattern: string
): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

// ─── Admin Check Helper ─────────────────────────────────────────────────────

async function checkChallengeAdmin(
  ctx: HttpCtx,
  userId: Id<"users">,
  challengeId: Id<"challenges">,
  user: Doc<"users">
): Promise<boolean> {
  if (user.role === "admin") return true;

  const challenge = await ctx.runQuery(
    internal.queries.challenges.getByIdInternal,
    { challengeId }
  );
  if (!challenge) return false;
  if (challenge.creatorId === userId) return true;

  const participation = await ctx.runQuery(
    api.queries.participations.getByUserAndChallenge,
    { userId, challengeId }
  );
  return participation?.role === "admin";
}

// ─── JSON body parser ────────────────────────────────────────────────────────

async function parseJsonBody(request: Request): Promise<any | Response> {
  try {
    return await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
}

// ─── Route Handlers ──────────────────────────────────────────────────────────

async function handleGetMe(ctx: HttpCtx, request: Request): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  return jsonResponse({
    id: auth.user._id,
    username: auth.user.username,
    email: auth.user.email,
    name: auth.user.name,
    avatarUrl: auth.user.avatarUrl,
    role: auth.user.role,
    createdAt: auth.user.createdAt,
  });
}

async function handleListChallenges(
  ctx: HttpCtx,
  request: Request
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") ?? "20");
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const challenges = await ctx.runQuery(api.queries.challenges.listForUser, {
    userId: auth.user._id,
    limit,
    offset,
  });

  return jsonResponse({ challenges });
}

async function handleGetChallenge(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const challenge = await ctx.runQuery(api.queries.challenges.getById, {
    challengeId,
  });

  if (!challenge) {
    return errorResponse("Challenge not found", 404);
  }

  return jsonResponse({ challenge });
}

async function handleCreateChallenge(
  ctx: HttpCtx,
  request: Request
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const {
    name,
    description,
    startDate,
    endDate,
    durationDays,
    streakMinPoints,
    weekCalcMethod,
    visibility,
  } = body;

  if (
    !name ||
    !startDate ||
    !endDate ||
    durationDays === undefined ||
    streakMinPoints === undefined
  ) {
    return errorResponse(
      "Missing required fields: name, startDate, endDate, durationDays, streakMinPoints",
      400
    );
  }

  try {
    const challengeId = await ctx.runMutation(
      internal.mutations.apiMutations.createChallengeForUser,
      {
        userId: auth.user._id,
        name,
        description,
        startDate,
        endDate,
        durationDays,
        streakMinPoints,
        weekCalcMethod: weekCalcMethod ?? "iso",
        visibility: visibility ?? "public",
      }
    );

    return jsonResponse({ id: challengeId }, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create challenge", 400);
  }
}

async function handleUpdateChallenge(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    challengeId,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  try {
    await ctx.runMutation(
      internal.mutations.apiMutations.updateChallengeForUser,
      {
        userId: auth.user._id,
        challengeId,
        ...body,
      }
    );
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to update challenge", 400);
  }
}

async function handleListActivityTypes(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const activityTypes = await ctx.runQuery(
    api.queries.activityTypes.getByChallengeId,
    { challengeId }
  );

  return jsonResponse({ activityTypes });
}

async function handleListActivities(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const challengeId = params.id as Id<"challenges">;
  const limit = parseInt(url.searchParams.get("limit") ?? "20");

  const activities = await ctx.runQuery(
    api.queries.activities.getChallengeFeed,
    {
      challengeId,
      includeEngagementCounts: true,
      includeMediaUrls: false,
      paginationOpts: {
        numItems: limit,
        cursor: url.searchParams.get("cursor") ?? null,
      },
    }
  );

  return jsonResponse({
    activities: activities.page.map((item: any) => ({
      id: item.activity._id,
      userId: item.activity.userId,
      challengeId: item.activity.challengeId,
      activityTypeId: item.activity.activityTypeId,
      loggedDate: item.activity.loggedDate,
      metrics: item.activity.metrics,
      pointsEarned: item.activity.pointsEarned,
      notes: item.activity.notes,
      source: item.activity.source,
      flagged: item.activity.flagged,
      createdAt: item.activity.createdAt,
      user: item.user,
      activityType: item.activityType
        ? { id: item.activityType.id, name: item.activityType.name }
        : null,
      likes: item.likes,
      comments: item.comments,
    })),
    continueCursor: activities.continueCursor,
    isDone: activities.isDone,
  });
}

async function handleLogActivity(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const { activityTypeId, loggedDate, metrics, notes, source } = body;

  if (!activityTypeId || !loggedDate) {
    return errorResponse(
      "Missing required fields: activityTypeId, loggedDate",
      400
    );
  }

  try {
    const result = await ctx.runMutation(
      internal.mutations.apiMutations.logActivityForUser,
      {
        userId: auth.user._id,
        challengeId,
        activityTypeId: activityTypeId as Id<"activityTypes">,
        loggedDate,
        metrics,
        notes,
        source: source ?? "manual",
      }
    );

    return jsonResponse(result, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to log activity", 400);
  }
}

async function handleGetActivity(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const activityId = params.id as Id<"activities">;
  const activity = await ctx.runQuery(api.queries.activities.getById, {
    activityId,
  });

  if (!activity) {
    return errorResponse("Activity not found", 404);
  }

  return jsonResponse({ activity });
}

async function handleDeleteActivity(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const activityId = params.id as Id<"activities">;

  try {
    await ctx.runMutation(
      internal.mutations.apiMutations.removeActivityForUser,
      {
        userId: auth.user._id,
        activityId,
      }
    );
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to delete activity", 400);
  }
}

async function handleGetLeaderboard(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const leaderboard = await ctx.runQuery(
    api.queries.participations.getFullLeaderboard,
    { challengeId }
  );

  return jsonResponse({ leaderboard });
}

async function handleListParticipants(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const challengeId = params.id as Id<"challenges">;
  const limit = parseInt(url.searchParams.get("limit") ?? "50");
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const participants = await ctx.runQuery(
    api.queries.challenges.getParticipants,
    { challengeId, limit, offset }
  );

  return jsonResponse({ participants });
}

async function handleSetAnnouncement(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    challengeId,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  if (body.announcement === undefined) {
    return errorResponse("Missing required field: announcement", 400);
  }

  try {
    await ctx.runMutation(
      internal.mutations.apiMutations.updateChallengeForUser,
      {
        userId: auth.user._id,
        challengeId,
        announcement: body.announcement,
      }
    );
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to set announcement", 400);
  }
}

async function handleListFlagged(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    challengeId,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as
    | "pending"
    | "resolved"
    | null;
  const limit = parseInt(url.searchParams.get("limit") ?? "50");
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const result = await ctx.runQuery(api.queries.admin.listFlaggedActivities, {
    challengeId,
    status: status ?? undefined,
    limit,
    offset,
  });

  return jsonResponse(result);
}

async function handleGetFlaggedDetail(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const activityId = params.activityId as Id<"activities">;
  const detail = await ctx.runQuery(
    api.queries.admin.getFlaggedActivityDetail,
    { activityId }
  );

  if (!detail) {
    return errorResponse("Flagged activity not found", 404);
  }

  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    detail.activity.challengeId as Id<"challenges">,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  return jsonResponse(detail);
}

async function handleResolveFlagged(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const activityId = params.activityId as Id<"activities">;
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const { status, notes } = body;
  if (!status || !["pending", "resolved"].includes(status)) {
    return errorResponse(
      "Missing or invalid field: status (must be 'pending' or 'resolved')",
      400
    );
  }

  try {
    await ctx.runMutation(
      internal.mutations.apiMutations.resolveFlagForUser,
      {
        userId: auth.user._id,
        activityId,
        status,
        notes,
      }
    );
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(
      err.message || "Failed to resolve flagged activity",
      400
    );
  }
}

async function handleAddAdminComment(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const activityId = params.activityId as Id<"activities">;
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const { comment, visibility } = body;
  if (!comment) {
    return errorResponse("Missing required field: comment", 400);
  }

  try {
    await ctx.runMutation(
      internal.mutations.apiMutations.addAdminCommentForUser,
      {
        userId: auth.user._id,
        activityId,
        comment,
        visibility: visibility ?? "internal",
      }
    );
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to add admin comment", 400);
  }
}

async function handleAdminEditActivity(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const activityId = params.id as Id<"activities">;
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  try {
    await ctx.runMutation(
      internal.mutations.apiMutations.adminEditActivityForUser,
      {
        userId: auth.user._id,
        activityId,
        ...body,
      }
    );
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to edit activity", 400);
  }
}

async function handleUpdateParticipantRole(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const targetUserId = params.userId as Id<"users">;

  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    challengeId,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const { role } = body;
  if (!role || !["member", "admin"].includes(role)) {
    return errorResponse(
      "Missing or invalid field: role (must be 'member' or 'admin')",
      400
    );
  }

  try {
    const result = await ctx.runMutation(
      internal.mutations.apiMutations.updateParticipantRoleForUser,
      {
        userId: auth.user._id,
        challengeId,
        targetUserId,
        role,
      }
    );
    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse(
      err.message || "Failed to update participant role",
      400
    );
  }
}

// ─── Achievement Management ─────────────────────────────────────────────────

async function handleListAchievements(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const achievements = await ctx.runQuery(
    api.queries.achievements.getByChallengeId,
    { challengeId }
  );

  return jsonResponse({ achievements });
}

async function handleCreateAchievement(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    challengeId,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const { name, description, bonusPoints, criteria, frequency } = body;

  if (!name || !description || bonusPoints === undefined || !criteria || !frequency) {
    return errorResponse(
      "Missing required fields: name, description, bonusPoints, criteria, frequency",
      400
    );
  }

  try {
    const achievementId = await ctx.runMutation(
      api.mutations.achievements.createAchievement,
      { challengeId, name, description, bonusPoints, criteria, frequency }
    );
    return jsonResponse({ id: achievementId }, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create achievement", 400);
  }
}

async function handleGetAchievementProgress(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const progress = await ctx.runQuery(
    internal.queries.achievements.getUserProgressInternal,
    { challengeId, userId: auth.user._id }
  );

  return jsonResponse({ progress });
}

async function handleUpdateAchievement(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const achievementId = params.id as Id<"achievements">;

  const achievement = await ctx.runQuery(
    internal.queries.achievements.getByIdInternal,
    { achievementId }
  );
  if (!achievement) {
    return errorResponse("Achievement not found", 404);
  }

  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    achievement.challengeId as Id<"challenges">,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  try {
    await ctx.runMutation(api.mutations.achievements.updateAchievement, {
      achievementId,
      ...body,
    });
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to update achievement", 400);
  }
}

async function handleDeleteAchievement(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const achievementId = params.id as Id<"achievements">;

  const achievement = await ctx.runQuery(
    internal.queries.achievements.getByIdInternal,
    { achievementId }
  );
  if (!achievement) {
    return errorResponse("Achievement not found", 404);
  }

  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    achievement.challengeId as Id<"challenges">,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  try {
    await ctx.runMutation(api.mutations.achievements.deleteAchievement, {
      achievementId,
    });
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to delete achievement", 400);
  }
}

// ─── Payment Config ─────────────────────────────────────────────────────────

async function handleSavePaymentConfig(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    challengeId,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const {
    stripeSecretKey,
    stripePublishableKey,
    stripeTestSecretKey,
    stripeTestPublishableKey,
    stripeWebhookSecret,
    stripeTestWebhookSecret,
    priceInCents,
    currency,
    testMode,
    allowCustomAmount,
  } = body;

  if (priceInCents === undefined || priceInCents === null) {
    return errorResponse("Missing required field: priceInCents", 400);
  }
  if (testMode === undefined || testMode === null) {
    return errorResponse("Missing required field: testMode", 400);
  }

  try {
    await ctx.runMutation(
      internal.mutations.paymentConfig.savePaymentConfigInternal,
      {
        challengeId,
        stripeSecretKey,
        stripePublishableKey,
        stripeTestSecretKey,
        stripeTestPublishableKey,
        stripeWebhookSecret,
        stripeTestWebhookSecret,
        priceInCents,
        currency,
        testMode,
        allowCustomAmount,
      }
    );
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to save payment config", 400);
  }
}

async function handleGetPaymentConfig(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    challengeId,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  const config = await ctx.runQuery(
    internal.queries.paymentConfig.getPaymentConfigInternal,
    { challengeId }
  );

  if (!config) {
    return jsonResponse({ config: null });
  }

  return jsonResponse({ config });
}

// ─── Activity Type Management ───────────────────────────────────────────────

async function handleCreateActivityType(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    challengeId,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const { name, description, scoringConfig, contributesToStreak, isNegative, bonusThresholds, maxPerChallenge, validWeeks } = body;

  if (!name || scoringConfig === undefined || contributesToStreak === undefined || isNegative === undefined) {
    return errorResponse(
      "Missing required fields: name, scoringConfig, contributesToStreak, isNegative",
      400
    );
  }

  try {
    const activityTypeId = await ctx.runMutation(
      internal.mutations.apiMutations.createActivityTypeForUser,
      {
        userId: auth.user._id,
        challengeId,
        name,
        description,
        scoringConfig,
        contributesToStreak,
        isNegative,
        bonusThresholds,
        maxPerChallenge,
        validWeeks,
      }
    );
    return jsonResponse({ id: activityTypeId }, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create activity type", 400);
  }
}

async function handleUpdateActivityType(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const activityTypeId = params.id as Id<"activityTypes">;

  // Look up the activity type to find its challenge
  const activityType = await ctx.runQuery(
    internal.queries.activityTypes.getByIdInternal,
    { activityTypeId }
  );
  if (!activityType) {
    return errorResponse("Activity type not found", 404);
  }

  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    activityType.challengeId as Id<"challenges">,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  try {
    await ctx.runMutation(
      internal.mutations.apiMutations.updateActivityTypeForUser,
      {
        userId: auth.user._id,
        activityTypeId,
        ...body,
      }
    );
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to update activity type", 400);
  }
}

// ─── Forum ──────────────────────────────────────────────────────────────────

async function handleListForumPosts(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const challengeId = params.id as Id<"challenges">;
  const limit = parseInt(url.searchParams.get("limit") ?? "20");

  const result = await ctx.runQuery(
    internal.queries.forumPosts.listByChallengeInternal,
    {
      userId: auth.user._id,
      challengeId,
      paginationOpts: {
        numItems: limit,
        cursor: url.searchParams.get("cursor") ?? null,
      },
    }
  );

  return jsonResponse({
    posts: result.page,
    continueCursor: result.continueCursor,
    isDone: result.isDone,
  });
}

async function handleGetForumPost(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const postId = params.id as Id<"forumPosts">;
  const result = await ctx.runQuery(
    internal.queries.forumPosts.getByIdInternal,
    { userId: auth.user._id, postId }
  );

  if (!result) {
    return errorResponse("Forum post not found", 404);
  }

  return jsonResponse(result);
}

async function handleCreateForumPost(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const { title, content, parentPostId } = body;
  if (!content) {
    return errorResponse("Missing required field: content", 400);
  }

  try {
    const postId = await ctx.runMutation(
      internal.mutations.apiMutations.createForumPostForUser,
      {
        userId: auth.user._id,
        challengeId,
        title,
        content,
        parentPostId: parentPostId as Id<"forumPosts"> | undefined,
      }
    );
    return jsonResponse({ id: postId }, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create forum post", 400);
  }
}

async function handleUpdateForumPost(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const postId = params.id as Id<"forumPosts">;
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  try {
    await ctx.runMutation(
      internal.mutations.apiMutations.updateForumPostForUser,
      {
        userId: auth.user._id,
        postId,
        title: body.title,
        content: body.content,
      }
    );
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to update forum post", 400);
  }
}

async function handleDeleteForumPost(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const postId = params.id as Id<"forumPosts">;

  try {
    await ctx.runMutation(
      internal.mutations.apiMutations.removeForumPostForUser,
      { userId: auth.user._id, postId }
    );
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to delete forum post", 400);
  }
}

async function handleToggleForumUpvote(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const postId = params.id as Id<"forumPosts">;

  try {
    const result = await ctx.runMutation(
      internal.mutations.apiMutations.toggleForumUpvoteForUser,
      { userId: auth.user._id, postId }
    );
    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to toggle upvote", 400);
  }
}

async function handleToggleForumPin(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const postId = params.id as Id<"forumPosts">;

  try {
    const result = await ctx.runMutation(
      internal.mutations.apiMutations.toggleForumPinForUser,
      { userId: auth.user._id, postId }
    );
    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to toggle pin", 400);
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────

type RouteEntry = {
  method: string;
  pattern: string;
  handler: (
    ctx: HttpCtx,
    request: Request,
    params: Record<string, string>
  ) => Promise<Response>;
};

const routes: RouteEntry[] = [
  // User
  { method: "GET", pattern: "/api/v1/me", handler: handleGetMe },

  // Challenges
  {
    method: "GET",
    pattern: "/api/v1/challenges",
    handler: handleListChallenges,
  },
  {
    method: "POST",
    pattern: "/api/v1/challenges",
    handler: handleCreateChallenge,
  },

  // Challenge sub-resources (longer paths first)
  // Achievements (progress must come before the plain list route)
  {
    method: "GET",
    pattern: "/api/v1/challenges/:id/achievements/progress",
    handler: handleGetAchievementProgress,
  },
  {
    method: "GET",
    pattern: "/api/v1/challenges/:id/achievements",
    handler: handleListAchievements,
  },
  {
    method: "POST",
    pattern: "/api/v1/challenges/:id/achievements",
    handler: handleCreateAchievement,
  },
  // Activity types
  {
    method: "GET",
    pattern: "/api/v1/challenges/:id/activity-types",
    handler: handleListActivityTypes,
  },
  {
    method: "POST",
    pattern: "/api/v1/challenges/:id/activity-types",
    handler: handleCreateActivityType,
  },
  {
    method: "GET",
    pattern: "/api/v1/challenges/:id/activities",
    handler: handleListActivities,
  },
  {
    method: "POST",
    pattern: "/api/v1/challenges/:id/activities",
    handler: handleLogActivity,
  },
  {
    method: "GET",
    pattern: "/api/v1/challenges/:id/leaderboard",
    handler: handleGetLeaderboard,
  },
  {
    method: "GET",
    pattern: "/api/v1/challenges/:id/participants",
    handler: handleListParticipants,
  },
  {
    method: "PATCH",
    pattern: "/api/v1/challenges/:id/participants/:userId",
    handler: handleUpdateParticipantRole,
  },
  {
    method: "PUT",
    pattern: "/api/v1/challenges/:id/announcement",
    handler: handleSetAnnouncement,
  },
  {
    method: "GET",
    pattern: "/api/v1/challenges/:id/flagged",
    handler: handleListFlagged,
  },

  // Payment config (admin)
  {
    method: "POST",
    pattern: "/api/v1/challenges/:id/payment-config",
    handler: handleSavePaymentConfig,
  },
  {
    method: "GET",
    pattern: "/api/v1/challenges/:id/payment-config",
    handler: handleGetPaymentConfig,
  },

  // Forum
  {
    method: "GET",
    pattern: "/api/v1/challenges/:id/forum",
    handler: handleListForumPosts,
  },
  {
    method: "POST",
    pattern: "/api/v1/challenges/:id/forum",
    handler: handleCreateForumPost,
  },

  // Single challenge
  {
    method: "GET",
    pattern: "/api/v1/challenges/:id",
    handler: handleGetChallenge,
  },
  {
    method: "PATCH",
    pattern: "/api/v1/challenges/:id",
    handler: handleUpdateChallenge,
  },

  // Activities
  {
    method: "GET",
    pattern: "/api/v1/activities/:id",
    handler: handleGetActivity,
  },
  {
    method: "DELETE",
    pattern: "/api/v1/activities/:id",
    handler: handleDeleteActivity,
  },

  // Flagged activities (admin)
  {
    method: "POST",
    pattern: "/api/v1/flagged/:activityId/resolve",
    handler: handleResolveFlagged,
  },
  {
    method: "POST",
    pattern: "/api/v1/flagged/:activityId/comment",
    handler: handleAddAdminComment,
  },
  {
    method: "GET",
    pattern: "/api/v1/flagged/:activityId",
    handler: handleGetFlaggedDetail,
  },

  // Forum posts (single post operations - longer paths first)
  {
    method: "POST",
    pattern: "/api/v1/forum-posts/:id/upvote",
    handler: handleToggleForumUpvote,
  },
  {
    method: "POST",
    pattern: "/api/v1/forum-posts/:id/pin",
    handler: handleToggleForumPin,
  },
  {
    method: "GET",
    pattern: "/api/v1/forum-posts/:id",
    handler: handleGetForumPost,
  },
  {
    method: "PATCH",
    pattern: "/api/v1/forum-posts/:id",
    handler: handleUpdateForumPost,
  },
  {
    method: "DELETE",
    pattern: "/api/v1/forum-posts/:id",
    handler: handleDeleteForumPost,
  },

  // Admin activity edit
  {
    method: "PATCH",
    pattern: "/api/v1/admin/activities/:id",
    handler: handleAdminEditActivity,
  },

  // Activity type management (admin)
  {
    method: "PATCH",
    pattern: "/api/v1/activity-types/:id",
    handler: handleUpdateActivityType,
  },

  // Achievement management (admin)
  {
    method: "PATCH",
    pattern: "/api/v1/achievements/:id",
    handler: handleUpdateAchievement,
  },
  {
    method: "DELETE",
    pattern: "/api/v1/achievements/:id",
    handler: handleDeleteAchievement,
  },
];

/**
 * Main API v1 router httpAction.
 * Dispatches requests to the appropriate handler based on method + path pattern.
 */
export const apiV1Router = httpAction(async (ctx, request) => {
  const method = request.method;

  if (method === "OPTIONS") {
    return corsPreflightResponse();
  }

  const url = new URL(request.url);
  let path = url.pathname;

  // Strip trailing slash
  if (path.endsWith("/") && path.length > 1) {
    path = path.slice(0, -1);
  }

  // Find matching route
  for (const route of routes) {
    if (route.method !== method) continue;
    const params = matchRoute(path, route.pattern);
    if (params !== null) {
      return route.handler(ctx, request, params);
    }
  }

  return errorResponse("Not found", 404);
});
