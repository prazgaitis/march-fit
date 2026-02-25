import "server-only";

import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { FunctionReference, OptionalRestArgs } from "convex/server";
import { Preloaded } from "convex/react";

import { api } from "@repo/backend";
import { rebuildResponse } from "./rebuild-response";

type AuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

type ServerAuthResult = {
  userId: string | null;
  convexToken: string | null;
  user: AuthUser | null;
};

// Lazy initialization to avoid build-time errors when env vars aren't available
let _betterAuthUtils: ReturnType<typeof convexBetterAuthNextJs> | null = null;

function resolveConvexSiteUrl(convexUrl: string): string {
  if (process.env.NEXT_PUBLIC_CONVEX_SITE_URL) {
    return process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  }

  // Convex cloud deployments use a corresponding ".convex.site" host for auth.
  if (convexUrl.includes(".convex.cloud")) {
    return convexUrl.replace(".convex.cloud", ".convex.site");
  }

  // For self-hosted or already-site URLs, reuse the same host.
  return convexUrl;
}

function getBetterAuthUtils() {
  if (!_betterAuthUtils) {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not set.");
    }

    _betterAuthUtils = convexBetterAuthNextJs({
      convexUrl,
      convexSiteUrl: resolveConvexSiteUrl(convexUrl),
    });
  }
  return _betterAuthUtils;
}

function getRequestPath(req: Request): string {
  try {
    return new URL(req.url).pathname;
  } catch {
    return "<invalid-url>";
  }
}

/**
 * Auth proxy handler that forwards requests to the Convex site URL.
 *
 * Two critical constraints on Vercel:
 * 1. Node 25+: `new Request(url, originalRequest)` crashes ("expected non-null
 *    body source") so we read the body explicitly via arrayBuffer().
 * 2. Warm instances: Returning the raw undici fetch() Response causes Next.js
 *    to return 500 with empty body on warm serverless instances. We must
 *    reconstruct a new global Response from the upstream data.
 */
function proxyHandler(method: "GET" | "POST") {
  return async (req: Request): Promise<Response> => {
    const path = getRequestPath(req);
    try {
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
      if (!convexUrl) {
        throw new Error("NEXT_PUBLIC_CONVEX_URL is not set.");
      }
      const siteUrl = resolveConvexSiteUrl(convexUrl);

      const requestUrl = new URL(req.url);
      const targetUrl = `${siteUrl}${requestUrl.pathname}${requestUrl.search}`;

      const body = method === "POST" ? await req.arrayBuffer() : undefined;

      const headers = new Headers(req.headers);
      headers.set("accept-encoding", "identity");
      headers.set("host", new URL(siteUrl).host);

      const upstream = await fetch(targetUrl, {
        method,
        headers,
        body,
        redirect: "manual",
      });

      return rebuildResponse(upstream);
    } catch (error) {
      console.error(`[server-auth] ${method} proxy threw`, {
        path,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export const betterAuthHandler = {
  GET: proxyHandler("GET"),
  POST: proxyHandler("POST"),
};

export async function isAuthenticated() {
  return getBetterAuthUtils().isAuthenticated();
}

export async function getToken() {
  return getBetterAuthUtils().getToken();
}

export async function preloadAuthQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgs<Query>
): Promise<Preloaded<Query>> {
  return getBetterAuthUtils().preloadAuthQuery(query, ...args);
}

export async function fetchAuthQuery<T>(query: any, args: Record<string, unknown>): Promise<T> {
  return getBetterAuthUtils().fetchAuthQuery(query, args);
}

export async function fetchAuthMutation<T>(mutation: any, args: Record<string, unknown>): Promise<T> {
  return getBetterAuthUtils().fetchAuthMutation(mutation, args);
}

export async function fetchAuthAction<T>(action: any, args: Record<string, unknown>): Promise<T> {
  return getBetterAuthUtils().fetchAuthAction(action, args);
}

export async function getServerAuth(): Promise<ServerAuthResult> {
  // Parallelize token + auth check instead of sequential calls
  const [token, authenticated] = await Promise.all([
    getToken(),
    isAuthenticated(),
  ]);

  if (!authenticated || !token) {
    return {
      userId: null,
      convexToken: token ?? null,
      user: null,
    };
  }

  try {
    let user = await fetchAuthQuery<{
      _id: string;
      email: string;
      name?: string;
      avatarUrl?: string;
    } | null>(api.queries.users.current, {});

    if (!user) {
      user = await fetchAuthMutation(api.mutations.users.ensureCurrent, {});
    }

    if (user) {
      return {
        userId: user._id,
        convexToken: token ?? null,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
        },
      };
    }
  } catch (error) {
    console.error("[server-auth] getServerAuth failed:", error);
  }

  return {
    userId: null,
    convexToken: token ?? null,
    user: null,
  };
}
