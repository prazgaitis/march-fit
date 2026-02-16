import { createClient } from "@convex-dev/better-auth";
import { betterAuth } from "better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { GenericCtx } from "@convex-dev/better-auth";
import authConfig from "./auth.config";

const authLogLevel = (process.env.AUTH_LOG_LEVEL ?? "").toUpperCase();
const verboseAuthLogging =
  authLogLevel === "DEBUG" || process.env.CONVEX_AUTH_VERBOSE === "1";

/**
 * Better Auth client for Convex backend
 * This provides the adapter and HTTP route registration for Better Auth
 */
export const authComponent = createClient<DataModel>(components.betterAuth, {
  verbose: verboseAuthLogging,
});

/**
 * Create the Better Auth instance with Convex adapter
 * This is used to register HTTP routes and for server-side auth operations
 */
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  // Use SITE_URL (Next.js app) as base — OAuth state cookies are set on the
  // Next.js domain, so the callback must go through the Next.js proxy too.
  const siteUrl = process.env.SITE_URL || process.env.CONVEX_SITE_URL;

  return betterAuth({
    baseURL: siteUrl,
    basePath: "/api/auth",
    database: authComponent.adapter(ctx),
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:3001",
      process.env.SITE_URL || "",
      // Also trust www variant of the site URL
      ...(process.env.SITE_URL
        ? [process.env.SITE_URL.replace("://", "://www.")]
        : []),
    ].filter(Boolean),
    emailAndPassword: {
      enabled: true,
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes — avoids DB lookup on every /get-session
      },
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectURI: process.env.SITE_URL
          ? `${process.env.SITE_URL}/api/auth/callback/google`
          : undefined,
      },
    },
    plugins: [
      convex({
        authConfig,
      }),
    ],
  });
};
