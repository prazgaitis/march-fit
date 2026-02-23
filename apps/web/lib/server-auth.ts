import "server-only";

import * as Sentry from "@sentry/nextjs";
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { FunctionReference, OptionalRestArgs } from "convex/server";
import { Preloaded } from "convex/react";

import { api } from "@repo/backend";

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

// Export getters that lazily initialize
export function getHandler() {
  return getBetterAuthUtils().handler;
}

/**
 * Proxy an auth request to the Convex site URL.
 *
 * The library's built-in proxy (`new Request(url, request)`) can fail on
 * Vercel when the incoming body stream has already been partially consumed
 * by the platform. We eagerly read the body into an ArrayBuffer so the
 * clone is always safe.
 */
async function proxyAuthRequest(req: Request): Promise<Response> {
  const siteUrl = resolveConvexSiteUrl(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const incoming = new URL(req.url);
  const target = `${siteUrl}${incoming.pathname}${incoming.search}`;

  const body = req.method !== "GET" && req.method !== "HEAD"
    ? await req.arrayBuffer()
    : undefined;

  const proxyReq = new Request(target, {
    method: req.method,
    headers: req.headers,
    body,
    redirect: "manual",
  });
  proxyReq.headers.set("host", new URL(siteUrl).host);
  // Request uncompressed responses so Vercel doesn't trip over
  // Content-Encoding when re-serving the proxied body.
  proxyReq.headers.set("accept-encoding", "identity");

  return fetch(proxyReq);
}

function ensureResponse(response: unknown, method: string): Response {
  if (response instanceof Response) return response;
  console.warn(`[server-auth] ${method} handler returned non-Response:`, typeof response);
  return new Response(null, { status: 404 });
}

export const betterAuthHandler = {
  GET: async (req: Request) => {
    try {
      const response = await proxyAuthRequest(req);
      // Only report 4xx/5xx — 3xx redirects are expected in OAuth flows
      if (response instanceof Response && response.status >= 400) {
        const url = new URL(req.url);
        Sentry.captureMessage(
          `Auth proxy GET ${url.pathname} returned ${response.status}`,
          {
            level: "warning",
            tags: { area: "auth-proxy", method: "GET", status: String(response.status) },
            extra: { pathname: url.pathname, search: url.search },
          },
        );
      }
      return ensureResponse(response, "GET");
    } catch (error) {
      const url = new URL(req.url);
      Sentry.captureException(error, {
        tags: { area: "auth-proxy", method: "GET" },
        extra: { pathname: url.pathname, search: url.search },
      });
      console.error("[server-auth] GET handler failed:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  },
  POST: async (req: Request) => {
    try {
      const response = await proxyAuthRequest(req);
      // Only report 4xx/5xx — 3xx redirects are expected in OAuth flows
      if (response instanceof Response && response.status >= 400) {
        const url = new URL(req.url);
        Sentry.captureMessage(
          `Auth proxy POST ${url.pathname} returned ${response.status}`,
          {
            level: "warning",
            tags: { area: "auth-proxy", method: "POST", status: String(response.status) },
            extra: { pathname: url.pathname, search: url.search },
          },
        );
        console.error(`[server-auth] POST ${url.pathname} returned ${response.status}`);
      }
      return ensureResponse(response, "POST");
    } catch (error) {
      const url = new URL(req.url);
      Sentry.captureException(error, {
        tags: { area: "auth-proxy", method: "POST" },
        extra: { pathname: url.pathname },
      });
      console.error(`[server-auth] POST ${url.pathname} handler threw:`, error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  },
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
