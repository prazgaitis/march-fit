import { AsyncLocalStorage } from "node:async_hooks";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

export const runtime = "nodejs";

type ApiRequestOptions = {
  method?: "GET" | "POST";
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
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
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
