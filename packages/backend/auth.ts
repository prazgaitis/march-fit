import { createClient } from "@convex-dev/better-auth";
import { betterAuth } from "better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { GenericCtx } from "@convex-dev/better-auth";
import authConfig from "./auth.config";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { hexToBytes } from "@noble/hashes/utils.js";

// Custom scrypt password hashing with reduced memory for Convex runtime.
// Default better-auth uses N=16384,r=16 (~32MB). We use r=8 (~16MB) which
// matches OWASP recommendations and fits within Convex action memory limits.
const SCRYPT_CONFIG = { N: 16384, r: 8, p: 1, dkLen: 64 };

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function scryptKey(password: string, salt: string): Promise<Uint8Array> {
  return await scryptAsync(password.normalize("NFKC"), salt, {
    ...SCRYPT_CONFIG,
    maxmem: 128 * SCRYPT_CONFIG.N * SCRYPT_CONFIG.r * 2,
  });
}

const hashPassword = async (password: string) => {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const key = await scryptKey(password, salt);
  return `${salt}:${toHex(key)}`;
};

const verifyPassword = async ({
  hash,
  password,
}: {
  hash: string;
  password: string;
}) => {
  const [salt, key] = hash.split(":");
  if (!salt || !key) throw new Error("Invalid password hash");
  const derived = await scryptKey(password, salt);
  const expected = hexToBytes(key);
  if (derived.length !== expected.length) return false;
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < derived.length; i++) {
    diff |= derived[i] ^ expected[i];
  }
  return diff === 0;
};

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
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
    },
    emailAndPassword: {
      enabled: true,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
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
