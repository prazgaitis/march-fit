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
import {
  hashToken,
  OAUTH_ACCESS_TOKEN_PREFIX,
  OAUTH_REFRESH_TOKEN_PREFIX,
  scopesAreSubset,
  getRequiredScopes,
} from "./lib/oauth";
import {
  reportBackendSentryEvent,
  reportLatencyIfExceeded,
} from "./lib/latencyMonitoring";

// ─── Types ───────────────────────────────────────────────────────────────────

type HttpCtx = {
  runQuery: (ref: any, args: any) => Promise<any>;
  runMutation: (ref: any, args: any) => Promise<any>;
  runAction: (ref: any, args: any) => Promise<any>;
};

type AuthResult = {
  user: Doc<"users">;
  keyId: Id<"apiKeys">;
  /** Present when authenticated via OAuth token (null for API keys) */
  oauthScopes?: string[];
  /** Present when OAuth token is scoped to a specific challenge */
  oauthChallengeId?: Id<"challenges">;
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

  // OAuth access token
  if (rawKey.startsWith(OAUTH_ACCESS_TOKEN_PREFIX)) {
    const tokenHash = await hashToken(rawKey);
    const result = await ctx.runQuery(
      internal.queries.oauth.getAccessTokenByHash,
      { tokenHash }
    );
    if (!result) {
      return errorResponse("Invalid or expired OAuth token", 401);
    }
    return {
      user: result.user,
      keyId: result.token._id as unknown as Id<"apiKeys">, // Satisfy type — not a real apiKey
      oauthScopes: result.token.scopes,
      oauthChallengeId: result.token.challengeId,
    };
  }

  // API key
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

/**
 * Check that an OAuth-scoped auth result has the required scopes for a route.
 * Returns an error Response if insufficient, or null if OK.
 */
function checkOAuthScopes(
  auth: AuthResult,
  method: string,
  routePattern: string
): Response | null {
  if (!auth.oauthScopes) return null; // API key — full access

  const required = getRequiredScopes(method, routePattern);
  if (required === null) {
    // Endpoint not accessible via OAuth
    return errorResponse(
      "This endpoint is not available for OAuth tokens",
      403
    );
  }
  if (!scopesAreSubset(required, auth.oauthScopes)) {
    return errorResponse(
      `Insufficient scope. Required: ${required.join(", ")}`,
      403
    );
  }
  return null;
}

/**
 * If the OAuth token is scoped to a challenge, verify the request targets that challenge.
 * Returns an error Response if mismatched, or null if OK.
 */
function checkOAuthChallengeScope(
  auth: AuthResult,
  challengeId: string
): Response | null {
  if (!auth.oauthChallengeId) return null; // Not challenge-scoped
  if (auth.oauthChallengeId !== challengeId) {
    return errorResponse(
      "This token is scoped to a different challenge",
      403
    );
  }
  return null;
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

  // If challenge-scoped, only return the scoped challenge
  if (auth.oauthChallengeId) {
    const challenge = await ctx.runQuery(api.queries.challenges.getById, {
      challengeId: auth.oauthChallengeId,
    });
    return jsonResponse({ challenges: challenge ? [challenge] : [] });
  }

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
  const challengeScopeErr = checkOAuthChallengeScope(auth, challengeId);
  if (challengeScopeErr) return challengeScopeErr;

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
  const challengeScopeErr = checkOAuthChallengeScope(auth, challengeId);
  if (challengeScopeErr) return challengeScopeErr;

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
  const challengeScopeErr = checkOAuthChallengeScope(auth, challengeId);
  if (challengeScopeErr) return challengeScopeErr;
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
  const challengeScopeErr = checkOAuthChallengeScope(auth, challengeId);
  if (challengeScopeErr) return challengeScopeErr;
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
  const challengeScopeErr = checkOAuthChallengeScope(auth, challengeId);
  if (challengeScopeErr) return challengeScopeErr;

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

async function handleCreateFeedback(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const challengeId = params.id as Id<"challenges">;
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const { type, title, description } = body;
  const validTypes = ["bug", "question", "idea", "other"];
  if (!type || !validTypes.includes(type)) {
    return errorResponse(
      "Missing or invalid field: type (must be 'bug', 'question', 'idea', or 'other')",
      400
    );
  }
  if (!description || typeof description !== "string") {
    return errorResponse("Missing required field: description", 400);
  }

  try {
    const result = await ctx.runMutation(
      internal.mutations.apiMutations.createFeedbackForUser,
      {
        userId: auth.user._id,
        challengeId,
        type,
        title,
        description,
      }
    );
    return jsonResponse(result, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create feedback", 400);
  }
}

async function handleListFeedbackForAdmin(
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

  const feedback = await ctx.runQuery(
    internal.queries.feedback.listByChallengeInternal,
    { challengeId }
  );

  return jsonResponse(feedback);
}

async function handleUpdateFeedbackForAdmin(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const feedbackId = params.id as Id<"feedback">;
  const feedback = await ctx.runQuery(internal.queries.feedback.getByIdInternal, {
    feedbackId,
  });
  if (!feedback) {
    return errorResponse("Feedback not found", 404);
  }

  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    feedback.challengeId as Id<"challenges">,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  try {
    const result = await ctx.runMutation(
      internal.mutations.apiMutations.updateFeedbackForUser,
      {
        userId: auth.user._id,
        feedbackId,
        status: body.status,
        adminResponse: body.adminResponse,
      }
    );
    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to update feedback", 400);
  }
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

async function handleCreateFeedbackComment(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const feedbackId = params.id as Id<"feedback">;
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const { content } = body;
  if (!content || typeof content !== "string" || !content.trim()) {
    return errorResponse("Missing required field: content", 400);
  }

  try {
    const result = await ctx.runMutation(
      internal.mutations.apiMutations.createFeedbackCommentForUser,
      {
        userId: auth.user._id,
        feedbackId,
        content,
      }
    );
    return jsonResponse(result, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create comment", 400);
  }
}

async function handleListFeedbackComments(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const feedbackId = params.id as Id<"feedback">;

  try {
    const comments = await ctx.runQuery(
      api.queries.comments.getByFeedbackId,
      { feedbackId }
    );
    return jsonResponse(comments);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to list comments", 400);
  }
}

async function handleToggleCommentLike(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const commentId = params.id as Id<"comments">;

  try {
    const result = await ctx.runMutation(
      internal.mutations.apiMutations.toggleCommentLikeForUser,
      {
        userId: auth.user._id,
        commentId,
      }
    );
    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to toggle comment like", 400);
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

// ─── Mini-Games ──────────────────────────────────────────────────────────────

async function handleListMiniGames(
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

  const miniGames = await ctx.runQuery(api.queries.miniGames.list, {
    challengeId,
  });

  return jsonResponse({ miniGames });
}

async function handleGetMiniGame(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const miniGameId = params.id as Id<"miniGames">;
  const miniGame = await ctx.runQuery(api.queries.miniGames.getById, {
    miniGameId,
  });

  if (!miniGame) {
    return errorResponse("Mini-game not found", 404);
  }

  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    miniGame.challengeId as Id<"challenges">,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  return jsonResponse({ miniGame });
}

async function handleCreateMiniGame(
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

  const { type, name, startsAt, endsAt, config } = body;

  if (!type || !name || startsAt === undefined || endsAt === undefined) {
    return errorResponse(
      "Missing required fields: type, name, startsAt, endsAt",
      400
    );
  }

  const validTypes = ["partner_week", "hunt_week", "pr_week"];
  if (!validTypes.includes(type)) {
    return errorResponse(
      `Invalid type. Must be one of: ${validTypes.join(", ")}`,
      400
    );
  }

  try {
    const result = await ctx.runMutation(
      internal.mutations.apiMutations.createMiniGameForUser,
      {
        userId: auth.user._id,
        challengeId,
        type,
        name,
        startsAt,
        endsAt,
        config,
      }
    );
    return jsonResponse(result, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create mini-game", 400);
  }
}

async function handleUpdateMiniGame(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const miniGameId = params.id as Id<"miniGames">;

  // Look up mini-game to find its challenge for admin check
  const miniGame = await ctx.runQuery(api.queries.miniGames.getById, {
    miniGameId,
  });
  if (!miniGame) {
    return errorResponse("Mini-game not found", 404);
  }

  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    miniGame.challengeId as Id<"challenges">,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  try {
    const result = await ctx.runMutation(
      internal.mutations.apiMutations.updateMiniGameForUser,
      {
        userId: auth.user._id,
        miniGameId,
        name: body.name,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        config: body.config,
      }
    );
    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to update mini-game", 400);
  }
}

async function handleDeleteMiniGame(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const miniGameId = params.id as Id<"miniGames">;

  const miniGame = await ctx.runQuery(api.queries.miniGames.getById, {
    miniGameId,
  });
  if (!miniGame) {
    return errorResponse("Mini-game not found", 404);
  }

  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    miniGame.challengeId as Id<"challenges">,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  try {
    const result = await ctx.runMutation(
      internal.mutations.apiMutations.removeMiniGameForUser,
      { userId: auth.user._id, miniGameId }
    );
    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to delete mini-game", 400);
  }
}

async function handleStartMiniGame(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const miniGameId = params.id as Id<"miniGames">;

  const miniGame = await ctx.runQuery(api.queries.miniGames.getById, {
    miniGameId,
  });
  if (!miniGame) {
    return errorResponse("Mini-game not found", 404);
  }

  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    miniGame.challengeId as Id<"challenges">,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  try {
    const result = await ctx.runMutation(
      api.mutations.miniGames.start,
      { miniGameId }
    );
    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to start mini-game", 400);
  }
}

async function handleEndMiniGame(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const miniGameId = params.id as Id<"miniGames">;

  const miniGame = await ctx.runQuery(api.queries.miniGames.getById, {
    miniGameId,
  });
  if (!miniGame) {
    return errorResponse("Mini-game not found", 404);
  }

  const isAdmin = await checkChallengeAdmin(
    ctx,
    auth.user._id,
    miniGame.challengeId as Id<"challenges">,
    auth.user
  );
  if (!isAdmin) {
    return errorResponse("Not authorized - challenge admin required", 403);
  }

  try {
    const result = await ctx.runMutation(
      api.mutations.miniGames.end,
      { miniGameId }
    );
    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to end mini-game", 400);
  }
}

async function handlePreviewStartMiniGame(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const miniGameId = params.id as Id<"miniGames">;

  try {
    const miniGame = await ctx.runQuery(api.queries.miniGames.getById, {
      miniGameId,
    });
    if (!miniGame) {
      return errorResponse("Mini-game not found", 404);
    }

    const isAdmin = await checkChallengeAdmin(
      ctx,
      auth.user._id,
      miniGame.challengeId as Id<"challenges">,
      auth.user
    );
    if (!isAdmin) {
      return errorResponse("Not authorized - challenge admin required", 403);
    }

    const preview = await ctx.runQuery(
      api.queries.miniGames.previewStart,
      { miniGameId }
    );
    return jsonResponse({ preview });
  } catch (err: any) {
    const msg = err.message || "Failed to preview start";
    const status = msg.includes("not found") ? 404 : 400;
    return errorResponse(msg, status);
  }
}

async function handlePreviewEndMiniGame(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const miniGameId = params.id as Id<"miniGames">;

  try {
    const miniGame = await ctx.runQuery(api.queries.miniGames.getById, {
      miniGameId,
    });
    if (!miniGame) {
      return errorResponse("Mini-game not found", 404);
    }

    const isAdmin = await checkChallengeAdmin(
      ctx,
      auth.user._id,
      miniGame.challengeId as Id<"challenges">,
      auth.user
    );
    if (!isAdmin) {
      return errorResponse("Not authorized - challenge admin required", 403);
    }

    const preview = await ctx.runQuery(
      api.queries.miniGames.previewEnd,
      { miniGameId }
    );
    return jsonResponse({ preview });
  } catch (err: any) {
    const msg = err.message || "Failed to preview end";
    const status = msg.includes("not found") ? 404 : 400;
    return errorResponse(msg, status);
  }
}

// ─── OAuth Endpoints ────────────────────────────────────────────────────────

/**
 * GET /api/v1/oauth/authorize — Validate params and redirect to consent page.
 * The frontend consent page lives at /oauth/authorize on the Next.js app.
 */
async function handleOAuthAuthorize(
  ctx: HttpCtx,
  request: Request,
  _params: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const responseType = url.searchParams.get("response_type");
  const scope = url.searchParams.get("scope");
  const state = url.searchParams.get("state");

  if (responseType !== "code") {
    return errorResponse("response_type must be 'code'", 400);
  }
  if (!clientId || !redirectUri || !scope) {
    return errorResponse("Missing required parameters: client_id, redirect_uri, scope", 400);
  }

  // Validate the client
  const app = await ctx.runQuery(internal.queries.oauth.getAppByClientId, { clientId });
  if (!app || !app.isActive) {
    return errorResponse("Invalid client_id", 400);
  }
  if (!app.redirectUris.includes(redirectUri)) {
    return errorResponse("redirect_uri not registered for this application", 400);
  }

  const requestedScopes = scope.split(" ").filter(Boolean);
  const { validateScopes, scopesAreSubset: scopeSubset } = await import("./lib/oauth");
  if (!validateScopes(requestedScopes) || !scopeSubset(requestedScopes, app.scopes)) {
    return errorResponse("Invalid or unauthorized scopes", 400);
  }

  // Optional challenge scoping
  const challengeId = url.searchParams.get("challenge_id");
  let challengeName: string | undefined;
  if (challengeId) {
    const challenge = await ctx.runQuery(api.queries.challenges.getById, {
      challengeId: challengeId as Id<"challenges">,
    });
    if (!challenge) {
      return errorResponse("Invalid challenge_id", 400);
    }
    challengeName = challenge.name;
  }

  // Redirect to the frontend consent page with all params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || "http://localhost:3000";
  const consentUrl = new URL("/oauth/authorize", appUrl);
  consentUrl.searchParams.set("client_id", clientId);
  consentUrl.searchParams.set("redirect_uri", redirectUri);
  consentUrl.searchParams.set("scope", scope);
  if (state) consentUrl.searchParams.set("state", state);
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  if (codeChallenge) consentUrl.searchParams.set("code_challenge", codeChallenge);
  if (codeChallengeMethod) consentUrl.searchParams.set("code_challenge_method", codeChallengeMethod);
  if (challengeId) consentUrl.searchParams.set("challenge_id", challengeId);
  if (challengeName) consentUrl.searchParams.set("challenge_name", challengeName);

  // Add app metadata for the consent screen
  consentUrl.searchParams.set("app_name", app.name);
  if (app.description) consentUrl.searchParams.set("app_description", app.description);
  if (app.iconUrl) consentUrl.searchParams.set("app_icon", app.iconUrl);

  return new Response(null, {
    status: 302,
    headers: {
      Location: consentUrl.toString(),
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * POST /api/v1/oauth/authorize — User approves the consent; issue auth code.
 * Called by the consent page (authenticated via session cookie forwarded from Next.js).
 * For simplicity, this accepts userId in the body (called server-side from Next.js API route).
 */
async function handleOAuthAuthorizePost(
  ctx: HttpCtx,
  request: Request,
  _params: Record<string, string>
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method, user_id, challenge_id } = body;

  if (!client_id || !redirect_uri || !scope || !user_id) {
    return errorResponse("Missing required fields", 400);
  }

  // Validate client + redirect URI
  const app = await ctx.runQuery(internal.queries.oauth.getAppByClientId, { clientId: client_id });
  if (!app || !app.isActive) {
    return errorResponse("Invalid client_id", 400);
  }
  if (!app.redirectUris.includes(redirect_uri)) {
    return errorResponse("redirect_uri mismatch", 400);
  }

  const scopes = typeof scope === "string" ? scope.split(" ").filter(Boolean) : scope;

  // Create authorization code
  const result = await ctx.runMutation(internal.mutations.oauth.createAuthorizationCode, {
    clientId: client_id,
    userId: user_id,
    redirectUri: redirect_uri,
    scopes,
    challengeId: challenge_id as Id<"challenges"> | undefined,
    codeChallenge: code_challenge,
    codeChallengeMethod: code_challenge_method,
  });

  // Build redirect URL
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set("code", result.code);
  if (state) redirectUrl.searchParams.set("state", state);

  return jsonResponse({ redirect_uri: redirectUrl.toString() });
}

/**
 * POST /api/v1/oauth/token — Exchange auth code for tokens, or refresh tokens.
 */
async function handleOAuthToken(
  ctx: HttpCtx,
  request: Request,
  _params: Record<string, string>
): Promise<Response> {
  // Accept both JSON and form-encoded bodies (OAuth spec uses form-encoded)
  let body: Record<string, string>;
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const parsed = await parseJsonBody(request);
    if (parsed instanceof Response) return parsed;
    body = parsed;
  } else {
    const text = await request.text();
    body = Object.fromEntries(new URLSearchParams(text));
  }

  const grantType = body.grant_type;

  // ── Authorization Code Grant ────────────────────────────────────────────
  if (grantType === "authorization_code") {
    const { code, redirect_uri, client_id, client_secret, code_verifier } = body;
    if (!code || !redirect_uri || !client_id) {
      return errorResponse("Missing required fields: code, redirect_uri, client_id", 400);
    }

    // Authenticate client
    const app = await ctx.runQuery(internal.queries.oauth.getAppByClientId, { clientId: client_id });
    if (!app || !app.isActive) {
      return errorResponse("Invalid client_id", 401);
    }

    // Client secret is required for confidential clients (not using PKCE)
    if (client_secret) {
      const secretHash = await hashToken(client_secret);
      if (secretHash !== app.clientSecretHash) {
        return errorResponse("Invalid client_secret", 401);
      }
    }

    // Look up the authorization code
    const codeRecord = await ctx.runQuery(internal.queries.oauth.getAuthorizationCode, { code });
    if (!codeRecord) {
      return errorResponse("Invalid authorization code", 400);
    }
    if (codeRecord.usedAt) {
      return errorResponse("Authorization code already used", 400);
    }
    if (codeRecord.expiresAt < Date.now()) {
      return errorResponse("Authorization code expired", 400);
    }
    if (codeRecord.clientId !== client_id) {
      return errorResponse("client_id mismatch", 400);
    }
    if (codeRecord.redirectUri !== redirect_uri) {
      return errorResponse("redirect_uri mismatch", 400);
    }

    // Exchange code for tokens
    const tokens = await ctx.runMutation(internal.mutations.oauth.exchangeCodeForTokens, {
      codeId: codeRecord._id,
      clientId: client_id,
      userId: codeRecord.userId,
      scopes: codeRecord.scopes,
      challengeId: codeRecord.challengeId,
      codeVerifier: code_verifier,
      codeChallenge: codeRecord.codeChallenge,
      codeChallengeMethod: codeRecord.codeChallengeMethod,
    });

    return jsonResponse({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: tokens.scopes.join(" "),
      ...(tokens.challengeId ? { challenge_id: tokens.challengeId } : {}),
    });
  }

  // ── Refresh Token Grant ─────────────────────────────────────────────────
  if (grantType === "refresh_token") {
    const { refresh_token, client_id, client_secret } = body;
    if (!refresh_token || !client_id) {
      return errorResponse("Missing required fields: refresh_token, client_id", 400);
    }

    // Authenticate client
    const app = await ctx.runQuery(internal.queries.oauth.getAppByClientId, { clientId: client_id });
    if (!app || !app.isActive) {
      return errorResponse("Invalid client_id", 401);
    }
    if (client_secret) {
      const secretHash = await hashToken(client_secret);
      if (secretHash !== app.clientSecretHash) {
        return errorResponse("Invalid client_secret", 401);
      }
    }

    // Look up the refresh token
    const rtHash = await hashToken(refresh_token);
    const rtRecord = await ctx.runQuery(internal.queries.oauth.getRefreshTokenByHash, { tokenHash: rtHash });
    if (!rtRecord) {
      return errorResponse("Invalid or expired refresh token", 400);
    }
    if (rtRecord.clientId !== client_id) {
      return errorResponse("client_id mismatch", 400);
    }

    const tokens = await ctx.runMutation(internal.mutations.oauth.refreshAccessToken, {
      refreshTokenId: rtRecord._id,
      clientId: client_id,
      userId: rtRecord.userId,
      scopes: rtRecord.scopes,
      challengeId: rtRecord.challengeId,
      oldAccessTokenHash: rtRecord.accessTokenHash,
    });

    return jsonResponse({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: tokens.scopes.join(" "),
      ...(tokens.challengeId ? { challenge_id: tokens.challengeId } : {}),
    });
  }

  return errorResponse("Unsupported grant_type. Use 'authorization_code' or 'refresh_token'.", 400);
}

/**
 * POST /api/v1/oauth/revoke — Revoke a token.
 */
async function handleOAuthRevoke(
  ctx: HttpCtx,
  request: Request,
  _params: Record<string, string>
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const { token, token_type_hint } = body;
  if (!token) {
    return errorResponse("Missing token", 400);
  }

  const tokenHash = await hashToken(token);

  if (token_type_hint === "refresh_token" || token.startsWith(OAUTH_REFRESH_TOKEN_PREFIX)) {
    await ctx.runMutation(internal.mutations.oauth.revokeRefreshToken, { tokenHash });
  } else {
    await ctx.runMutation(internal.mutations.oauth.revokeAccessToken, { tokenHash });
  }

  // Per RFC 7009, always return 200 even if token was not found
  return jsonResponse({ success: true });
}

/**
 * POST /api/v1/oauth/apps — Register a new OAuth app (authenticated via API key).
 */
async function handleCreateOAuthApp(
  ctx: HttpCtx,
  request: Request,
  _params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const { name, description, icon_url, redirect_uris, scopes, homepage } = body;
  if (!name || !redirect_uris || !scopes) {
    return errorResponse("Missing required fields: name, redirect_uris, scopes", 400);
  }

  try {
    const result = await ctx.runMutation(internal.mutations.oauth.createAppForUser, {
      userId: auth.user._id,
      name,
      description,
      iconUrl: icon_url,
      redirectUris: redirect_uris,
      scopes,
      homepage,
    });

    return jsonResponse(result, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create OAuth app", 400);
  }
}

/**
 * GET /api/v1/oauth/apps — List the developer's OAuth apps.
 */
async function handleListOAuthApps(
  ctx: HttpCtx,
  request: Request,
  _params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const apps = await ctx.runQuery(internal.queries.oauth.listAppsByUserId, {
    userId: auth.user._id,
  });
  return jsonResponse({ apps });
}

/**
 * GET /api/v1/oauth/apps/:id — Get a single OAuth app.
 */
async function handleGetOAuthApp(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const appId = params.id as Id<"oauthApps">;
  const app = await ctx.runQuery(internal.queries.oauth.getAppById, { appId });
  if (!app || app.userId !== auth.user._id) {
    return errorResponse("App not found", 404);
  }

  return jsonResponse({
    id: app._id,
    name: app.name,
    description: app.description,
    iconUrl: app.iconUrl,
    clientId: app.clientId,
    clientSecretPrefix: app.clientSecretPrefix,
    redirectUris: app.redirectUris,
    scopes: app.scopes,
    homepage: app.homepage,
    isActive: app.isActive,
    createdAt: app.createdAt,
  });
}

/**
 * PATCH /api/v1/oauth/apps/:id — Update an OAuth app.
 */
async function handleUpdateOAuthApp(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;

  const appId = params.id as Id<"oauthApps">;
  try {
    await ctx.runMutation(internal.mutations.oauth.updateAppForUser, {
      userId: auth.user._id,
      appId,
      name: body.name,
      description: body.description,
      iconUrl: body.icon_url,
      redirectUris: body.redirect_uris,
      scopes: body.scopes,
      homepage: body.homepage,
    });
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to update app", 400);
  }
}

/**
 * DELETE /api/v1/oauth/apps/:id — Deactivate an OAuth app.
 */
async function handleDeleteOAuthApp(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const appId = params.id as Id<"oauthApps">;
  try {
    await ctx.runMutation(internal.mutations.oauth.deleteAppForUser, {
      userId: auth.user._id,
      appId,
    });
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to delete app", 400);
  }
}

/**
 * POST /api/v1/oauth/apps/:id/rotate-secret — Rotate client secret.
 */
async function handleRotateOAuthSecret(
  ctx: HttpCtx,
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const auth = await authenticateApiKey(ctx, request);
  if (auth instanceof Response) return auth;

  const appId = params.id as Id<"oauthApps">;
  try {
    const result = await ctx.runMutation(internal.mutations.oauth.rotateSecretForUser, {
      userId: auth.user._id,
      appId,
    });
    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to rotate secret", 400);
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
    method: "POST",
    pattern: "/api/v1/challenges/:id/feedback",
    handler: handleCreateFeedback,
  },
  {
    method: "GET",
    pattern: "/api/v1/challenges/:id/feedback",
    handler: handleListFeedbackForAdmin,
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

  // Mini-games (challenge sub-resource)
  {
    method: "GET",
    pattern: "/api/v1/challenges/:id/mini-games",
    handler: handleListMiniGames,
  },
  {
    method: "POST",
    pattern: "/api/v1/challenges/:id/mini-games",
    handler: handleCreateMiniGame,
  },

  // OAuth Provider
  {
    method: "GET",
    pattern: "/api/v1/oauth/authorize",
    handler: handleOAuthAuthorize,
  },
  {
    method: "POST",
    pattern: "/api/v1/oauth/authorize",
    handler: handleOAuthAuthorizePost,
  },
  {
    method: "POST",
    pattern: "/api/v1/oauth/token",
    handler: handleOAuthToken,
  },
  {
    method: "POST",
    pattern: "/api/v1/oauth/revoke",
    handler: handleOAuthRevoke,
  },
  {
    method: "POST",
    pattern: "/api/v1/oauth/apps/:id/rotate-secret",
    handler: handleRotateOAuthSecret,
  },
  {
    method: "GET",
    pattern: "/api/v1/oauth/apps/:id",
    handler: handleGetOAuthApp,
  },
  {
    method: "PATCH",
    pattern: "/api/v1/oauth/apps/:id",
    handler: handleUpdateOAuthApp,
  },
  {
    method: "DELETE",
    pattern: "/api/v1/oauth/apps/:id",
    handler: handleDeleteOAuthApp,
  },
  {
    method: "POST",
    pattern: "/api/v1/oauth/apps",
    handler: handleCreateOAuthApp,
  },
  {
    method: "GET",
    pattern: "/api/v1/oauth/apps",
    handler: handleListOAuthApps,
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
  {
    method: "PATCH",
    pattern: "/api/v1/feedback/:id",
    handler: handleUpdateFeedbackForAdmin,
  },
  // Feedback comments
  {
    method: "POST",
    pattern: "/api/v1/feedback/:id/comments",
    handler: handleCreateFeedbackComment,
  },
  {
    method: "GET",
    pattern: "/api/v1/feedback/:id/comments",
    handler: handleListFeedbackComments,
  },
  // Comment likes
  {
    method: "POST",
    pattern: "/api/v1/comments/:id/like",
    handler: handleToggleCommentLike,
  },

  // Mini-game management (single resource - longer paths first)
  {
    method: "GET",
    pattern: "/api/v1/mini-games/:id/preview-start",
    handler: handlePreviewStartMiniGame,
  },
  {
    method: "GET",
    pattern: "/api/v1/mini-games/:id/preview-end",
    handler: handlePreviewEndMiniGame,
  },
  {
    method: "POST",
    pattern: "/api/v1/mini-games/:id/start",
    handler: handleStartMiniGame,
  },
  {
    method: "POST",
    pattern: "/api/v1/mini-games/:id/end",
    handler: handleEndMiniGame,
  },
  {
    method: "GET",
    pattern: "/api/v1/mini-games/:id",
    handler: handleGetMiniGame,
  },
  {
    method: "PATCH",
    pattern: "/api/v1/mini-games/:id",
    handler: handleUpdateMiniGame,
  },
  {
    method: "DELETE",
    pattern: "/api/v1/mini-games/:id",
    handler: handleDeleteMiniGame,
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
  const startedAt = Date.now();

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
      try {
        // OAuth scope checking is done inside individual handlers that call authenticateApiKey.
        // The checkOAuthScopes function is available for handlers that need it.
        const response = await route.handler(ctx, request, params);

        // Log API request metrics
        const durationMs = Date.now() - startedAt;
        reportBackendSentryEvent({
          message: `API ${method} ${route.pattern} → ${response.status}`,
          operation: `api.${method}.${route.pattern}`,
          level: "info",
          sampleRate: 0.25,
          tags: {
            subsystem: "api",
            routePattern: route.pattern,
            method,
            statusCode: String(response.status),
          },
          extra: {
            path,
            params,
            durationMs,
            statusCode: response.status,
          },
        });

        // Also report latency if it exceeds threshold
        reportLatencyIfExceeded({
          operation: `api.${method}.${route.pattern}`,
          startedAt,
        });

        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const durationMs = Date.now() - startedAt;
        reportBackendSentryEvent({
          message: "Unhandled API v1 route error",
          operation: `api.${method}.${route.pattern}`,
          level: "error",
          tags: {
            subsystem: "api",
            routePattern: route.pattern,
            method,
            statusCode: "500",
          },
          extra: {
            path,
            params,
            errorMessage: message,
            durationMs,
          },
        });
        console.error("[httpApi] unhandled route error", {
          method,
          path,
          routePattern: route.pattern,
          params,
          message,
        });
        return errorResponse("Internal server error", 500);
      }
    }
  }

  return errorResponse("Not found", 404);
});
