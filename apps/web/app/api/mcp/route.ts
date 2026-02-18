import { AsyncLocalStorage } from "node:async_hooks";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

export const runtime = "nodejs";

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

const apiTokenStorage = new AsyncLocalStorage<string>();

function resolveConvexSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_CONVEX_SITE_URL) {
    return process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  }

  if (process.env.CONVEX_SITE_URL) {
    return process.env.CONVEX_SITE_URL;
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_CONVEX_SITE_URL/CONVEX_SITE_URL/NEXT_PUBLIC_CONVEX_URL"
    );
  }

  if (convexUrl.includes(".convex.cloud")) {
    return convexUrl.replace(".convex.cloud", ".convex.site");
  }

  if (convexUrl.includes(":3210")) {
    return convexUrl.replace(":3210", ":3211");
  }

  return convexUrl;
}

function getApiBaseUrl(): string {
  const base = resolveConvexSiteUrl().replace(/\/$/, "");
  return `${base}/api/v1`;
}

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "bearer" && token) {
      return token;
    }
  }

  // Fallback: token as URL param (for Claude.ai MCP which doesn't support bearer auth)
  const url = new URL(request.url);
  const paramToken = url.searchParams.get("token");
  if (paramToken) {
    return paramToken;
  }

  return null;
}

async function apiRequest(
  bearerToken: string,
  path: string,
  options: ApiRequestOptions = {}
): Promise<unknown> {
  const baseUrl = getApiBaseUrl();
  const url = new URL(`${baseUrl}${path}`);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function asTextResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function requireApiToken(): string {
  const token = apiTokenStorage.getStore();
  if (!token) {
    throw new Error("Missing API token for request context");
  }
  return token;
}

const mcpHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "me",
      {
        title: "Current User",
        description: "Get current user profile and enrolled challenges.",
      },
      async () => {
        const token = requireApiToken();
        const [me, challenges] = await Promise.all([
          apiRequest(token, "/me"),
          apiRequest(token, "/challenges", {
            query: { limit: 100, offset: 0 },
          }),
        ]);

        return asTextResult({
          me,
          challenges,
        });
      }
    );

    server.registerTool(
      "list_challenges",
      {
        title: "List Challenges",
        description: "List challenges visible to the authenticated user.",
        inputSchema: {
          limit: z.number().int().min(1).max(200).optional(),
          offset: z.number().int().min(0).optional(),
        },
      },
      async ({ limit, offset }) => {
        const token = requireApiToken();
        const data = await apiRequest(token, "/challenges", {
          query: {
            limit: limit ?? 20,
            offset: offset ?? 0,
          },
        });
        return asTextResult(data);
      }
    );

    server.registerTool(
      "challenge_leaderboard",
      {
        title: "Challenge Leaderboard",
        description: "Get leaderboard for a challenge.",
        inputSchema: {
          challengeId: z.string().min(1),
        },
      },
      async ({ challengeId }) => {
        const token = requireApiToken();
        const data = await apiRequest(
          token,
          `/challenges/${challengeId}/leaderboard`
        );
        return asTextResult(data);
      }
    );

    server.registerTool(
      "list_activities",
      {
        title: "List Activities",
        description: "List activities for a challenge feed.",
        inputSchema: {
          challengeId: z.string().min(1),
          limit: z.number().int().min(1).max(200).optional(),
          cursor: z.string().optional(),
        },
      },
      async ({ challengeId, limit, cursor }) => {
        const token = requireApiToken();
        const data = await apiRequest(token, `/challenges/${challengeId}/activities`, {
          query: {
            limit: limit ?? 20,
            cursor,
          },
        });
        return asTextResult(data);
      }
    );

    server.registerTool(
      "log_activity",
      {
        title: "Log Activity",
        description: "Log a new activity in a challenge.",
        inputSchema: {
          challengeId: z.string().min(1),
          activityTypeId: z.string().min(1),
          loggedDate: z.string().min(1),
          metrics: z.record(z.string(), z.unknown()).optional(),
          notes: z.string().optional(),
          source: z.string().optional(),
        },
      },
      async ({ challengeId, activityTypeId, loggedDate, metrics, notes, source }) => {
        const token = requireApiToken();
        const data = await apiRequest(token, `/challenges/${challengeId}/activities`, {
          method: "POST",
          body: {
            activityTypeId,
            loggedDate,
            metrics,
            notes,
            source,
          },
        });
        return asTextResult(data);
      }
    );

    server.registerTool(
      "get_challenge",
      {
        title: "Get Challenge",
        description: "Get details for a single challenge by ID.",
        inputSchema: {
          challengeId: z.string().min(1),
        },
      },
      async ({ challengeId }) => {
        const token = requireApiToken();
        const data = await apiRequest(token, `/challenges/${challengeId}`);
        return asTextResult(data);
      }
    );

    server.registerTool(
      "list_activity_types",
      {
        title: "List Activity Types",
        description:
          "List all activity types configured for a challenge. Returns scoring config, bonus thresholds, and restrictions.",
        inputSchema: {
          challengeId: z.string().min(1),
        },
      },
      async ({ challengeId }) => {
        const token = requireApiToken();
        const data = await apiRequest(
          token,
          `/challenges/${challengeId}/activity-types`
        );
        return asTextResult(data);
      }
    );

    server.registerTool(
      "list_participants",
      {
        title: "List Participants",
        description:
          "List participants in a challenge with their roles, points, and payment status.",
        inputSchema: {
          challengeId: z.string().min(1),
          limit: z.number().int().min(1).max(200).optional(),
          offset: z.number().int().min(0).optional(),
        },
      },
      async ({ challengeId, limit, offset }) => {
        const token = requireApiToken();
        const data = await apiRequest(
          token,
          `/challenges/${challengeId}/participants`,
          { query: { limit: limit ?? 50, offset: offset ?? 0 } }
        );
        return asTextResult(data);
      }
    );

    server.registerTool(
      "get_activity",
      {
        title: "Get Activity",
        description: "Get full details for a single activity by ID.",
        inputSchema: {
          activityId: z.string().min(1),
        },
      },
      async ({ activityId }) => {
        const token = requireApiToken();
        const data = await apiRequest(token, `/activities/${activityId}`);
        return asTextResult(data);
      }
    );

    server.registerTool(
      "delete_activity",
      {
        title: "Delete Activity",
        description:
          "Delete an activity. Users can delete their own activities; admins can delete any activity in their challenge.",
        inputSchema: {
          activityId: z.string().min(1),
        },
      },
      async ({ activityId }) => {
        const token = requireApiToken();
        const data = await apiRequest(token, `/activities/${activityId}`, {
          method: "DELETE",
        });
        return asTextResult(data);
      }
    );

    // ─── Admin Tools (require challenge admin role) ─────────────────────

    server.registerTool(
      "update_participant_role",
      {
        title: "Update Participant Role",
        description:
          "Set a participant's role in a challenge (member or admin). Requires challenge admin role.",
        inputSchema: {
          challengeId: z.string().min(1),
          userId: z.string().min(1),
          role: z.enum(["member", "admin"]),
        },
      },
      async ({ challengeId, userId, role }) => {
        const token = requireApiToken();
        const data = await apiRequest(
          token,
          `/challenges/${challengeId}/participants/${userId}`,
          { method: "PATCH", body: { role } }
        );
        return asTextResult(data);
      }
    );

    server.registerTool(
      "update_challenge",
      {
        title: "Update Challenge",
        description:
          "Update challenge settings. Requires challenge admin role. Returns 403 if not authorized.",
        inputSchema: {
          challengeId: z.string().min(1),
          name: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          durationDays: z.number().int().optional(),
          streakMinPoints: z.number().optional(),
          announcement: z.string().nullable().optional(),
        },
      },
      async ({ challengeId, ...updates }) => {
        const token = requireApiToken();
        const data = await apiRequest(
          token,
          `/challenges/${challengeId}`,
          { method: "PUT", body: updates }
        );
        return asTextResult(data);
      }
    );

    server.registerTool(
      "set_announcement",
      {
        title: "Set Challenge Announcement",
        description:
          "Set or clear the announcement banner for a challenge. Requires challenge admin role.",
        inputSchema: {
          challengeId: z.string().min(1),
          announcement: z.string().nullable(),
        },
      },
      async ({ challengeId, announcement }) => {
        const token = requireApiToken();
        const data = await apiRequest(
          token,
          `/challenges/${challengeId}/announcement`,
          { method: "POST", body: { announcement } }
        );
        return asTextResult(data);
      }
    );

    server.registerTool(
      "list_flagged_activities",
      {
        title: "List Flagged Activities",
        description:
          "List flagged activities for a challenge. Requires challenge admin role.",
        inputSchema: {
          challengeId: z.string().min(1),
          status: z
            .enum(["pending", "resolved"])
            .optional()
            .describe("Filter by flag status. Omit for all."),
        },
      },
      async ({ challengeId, status }) => {
        const token = requireApiToken();
        const data = await apiRequest(
          token,
          `/challenges/${challengeId}/flagged`,
          { query: { status } }
        );
        return asTextResult(data);
      }
    );

    server.registerTool(
      "get_flagged_activity",
      {
        title: "Get Flagged Activity Detail",
        description:
          "Get details of a flagged activity. Requires challenge admin role.",
        inputSchema: {
          challengeId: z.string().min(1),
          activityId: z.string().min(1),
        },
      },
      async ({ activityId }) => {
        const token = requireApiToken();
        const data = await apiRequest(
          token,
          `/flagged/${activityId}`
        );
        return asTextResult(data);
      }
    );

    server.registerTool(
      "resolve_flagged_activity",
      {
        title: "Resolve Flagged Activity",
        description:
          "Resolve or re-open a flagged activity. Requires challenge admin role.",
        inputSchema: {
          activityId: z.string().min(1),
          status: z.enum(["pending", "resolved"]),
          notes: z.string().optional(),
        },
      },
      async ({ activityId, status, notes }) => {
        const token = requireApiToken();
        const data = await apiRequest(
          token,
          `/flagged/${activityId}/resolve`,
          { method: "POST", body: { status, notes } }
        );
        return asTextResult(data);
      }
    );

    server.registerTool(
      "add_admin_comment",
      {
        title: "Add Admin Comment",
        description:
          "Add an admin comment to a flagged activity. Requires challenge admin role.",
        inputSchema: {
          activityId: z.string().min(1),
          comment: z.string().min(1),
          visibility: z
            .enum(["internal", "public"])
            .optional()
            .describe("Defaults to internal."),
        },
      },
      async ({ activityId, comment, visibility }) => {
        const token = requireApiToken();
        const data = await apiRequest(
          token,
          `/flagged/${activityId}/comment`,
          { method: "POST", body: { comment, visibility } }
        );
        return asTextResult(data);
      }
    );

    server.registerTool(
      "create_activity_type",
      {
        title: "Create Activity Type",
        description:
          "Create a new activity type in a challenge. Requires challenge admin role.",
        inputSchema: {
          challengeId: z.string().min(1),
          name: z.string().min(1),
          description: z.string().optional(),
          scoringConfig: z
            .record(z.string(), z.unknown())
            .describe(
              'Scoring configuration object (e.g. {"type":"fixed","points":10} or {"type":"per_unit","metric":"miles","pointsPerUnit":5})'
            ),
          contributesToStreak: z.boolean(),
          isNegative: z.boolean(),
          bonusThresholds: z
            .array(
              z.object({
                metric: z.string(),
                threshold: z.number(),
                bonusPoints: z.number(),
                description: z.string(),
              })
            )
            .optional(),
          maxPerChallenge: z.number().int().optional(),
          validWeeks: z.array(z.number().int()).optional(),
        },
      },
      async ({ challengeId, ...rest }) => {
        const token = requireApiToken();
        const data = await apiRequest(
          token,
          `/challenges/${challengeId}/activity-types`,
          { method: "POST", body: rest }
        );
        return asTextResult(data);
      }
    );

    server.registerTool(
      "update_activity_type",
      {
        title: "Update Activity Type",
        description:
          "Update an existing activity type (name, scoring, thresholds, etc.). Requires challenge admin role.",
        inputSchema: {
          activityTypeId: z.string().min(1),
          name: z.string().optional(),
          description: z.string().optional(),
          scoringConfig: z.record(z.string(), z.unknown()).optional(),
          contributesToStreak: z.boolean().optional(),
          isNegative: z.boolean().optional(),
          bonusThresholds: z
            .array(
              z.object({
                metric: z.string(),
                threshold: z.number(),
                bonusPoints: z.number(),
                description: z.string(),
              })
            )
            .optional(),
          maxPerChallenge: z.number().int().optional(),
          validWeeks: z.array(z.number().int()).optional(),
        },
      },
      async ({ activityTypeId, ...updates }) => {
        const token = requireApiToken();
        const data = await apiRequest(
          token,
          `/activity-types/${activityTypeId}`,
          { method: "PATCH", body: updates }
        );
        return asTextResult(data);
      }
    );

    // ─── Forum Tools ──────────────────────────────────────────────────

    server.registerTool(
      "list_forum_posts",
      {
        title: "List Forum Posts",
        description:
          "List top-level forum posts for a challenge (paginated). Returns pinned posts first.",
        inputSchema: {
          challengeId: z.string().min(1),
          limit: z.number().int().min(1).max(200).optional(),
          cursor: z.string().optional(),
        },
      },
      async ({ challengeId, limit, cursor }) => {
        const token = requireApiToken();
        const data = await apiRequest(
          token,
          `/challenges/${challengeId}/forum`,
          { query: { limit: limit ?? 20, cursor } }
        );
        return asTextResult(data);
      }
    );

    server.registerTool(
      "get_forum_post",
      {
        title: "Get Forum Post",
        description:
          "Get a single forum post with its replies, upvote counts, and author info.",
        inputSchema: {
          postId: z.string().min(1),
        },
      },
      async ({ postId }) => {
        const token = requireApiToken();
        const data = await apiRequest(token, `/forum-posts/${postId}`);
        return asTextResult(data);
      }
    );

    server.registerTool(
      "create_forum_post",
      {
        title: "Create Forum Post",
        description:
          "Create a top-level forum post or reply in a challenge. Top-level posts require a title.",
        inputSchema: {
          challengeId: z.string().min(1),
          title: z.string().optional().describe("Required for top-level posts, omit for replies."),
          content: z.string().min(1),
          parentPostId: z
            .string()
            .optional()
            .describe("Set to a post ID to create a reply."),
        },
      },
      async ({ challengeId, title, content, parentPostId }) => {
        const token = requireApiToken();
        const data = await apiRequest(
          token,
          `/challenges/${challengeId}/forum`,
          { method: "POST", body: { title, content, parentPostId } }
        );
        return asTextResult(data);
      }
    );

    server.registerTool(
      "update_forum_post",
      {
        title: "Update Forum Post",
        description:
          "Edit a forum post. Only the author or admins can edit.",
        inputSchema: {
          postId: z.string().min(1),
          title: z.string().optional(),
          content: z.string().optional(),
        },
      },
      async ({ postId, title, content }) => {
        const token = requireApiToken();
        const data = await apiRequest(token, `/forum-posts/${postId}`, {
          method: "PATCH",
          body: { title, content },
        });
        return asTextResult(data);
      }
    );

    server.registerTool(
      "delete_forum_post",
      {
        title: "Delete Forum Post",
        description:
          "Soft-delete a forum post. Only the author or admins can delete.",
        inputSchema: {
          postId: z.string().min(1),
        },
      },
      async ({ postId }) => {
        const token = requireApiToken();
        const data = await apiRequest(token, `/forum-posts/${postId}`, {
          method: "DELETE",
        });
        return asTextResult(data);
      }
    );

    server.registerTool(
      "toggle_forum_upvote",
      {
        title: "Toggle Forum Upvote",
        description: "Upvote or un-upvote a forum post.",
        inputSchema: {
          postId: z.string().min(1),
        },
      },
      async ({ postId }) => {
        const token = requireApiToken();
        const data = await apiRequest(token, `/forum-posts/${postId}/upvote`, {
          method: "POST",
        });
        return asTextResult(data);
      }
    );

    server.registerTool(
      "toggle_forum_pin",
      {
        title: "Toggle Forum Pin",
        description:
          "Pin or unpin a top-level forum post. Requires challenge admin role.",
        inputSchema: {
          postId: z.string().min(1),
        },
      },
      async ({ postId }) => {
        const token = requireApiToken();
        const data = await apiRequest(token, `/forum-posts/${postId}/pin`, {
          method: "POST",
        });
        return asTextResult(data);
      }
    );

    server.registerTool(
      "admin_edit_activity",
      {
        title: "Admin Edit Activity",
        description:
          "Edit any activity as an admin (e.g. correct points or notes). Requires challenge admin role.",
        inputSchema: {
          activityId: z.string().min(1),
          notes: z.string().optional(),
          metrics: z.record(z.string(), z.unknown()).optional(),
          loggedDate: z.string().optional(),
          activityTypeId: z.string().optional(),
        },
      },
      async ({ activityId, ...updates }) => {
        const token = requireApiToken();
        const data = await apiRequest(
          token,
          `/admin/activities/${activityId}`,
          { method: "PATCH", body: updates }
        );
        return asTextResult(data);
      }
    );
  },
  {
    capabilities: {
      tools: {},
    },
  },
  {
    basePath: "/api",
    disableSse: true,
  }
);

async function authenticatedMcpHandler(request: Request): Promise<Response> {
  const token = getBearerToken(request);
  if (!token) {
    return new Response(
      JSON.stringify({
        error: "Missing or invalid Authorization header. Use: Bearer <api-key>",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    await apiRequest(token, "/me");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid or revoked API key" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  return apiTokenStorage.run(token, () => mcpHandler(request));
}

export async function GET(request: Request) {
  return authenticatedMcpHandler(request);
}

export async function POST(request: Request) {
  return authenticatedMcpHandler(request);
}

export async function DELETE(request: Request) {
  return authenticatedMcpHandler(request);
}
