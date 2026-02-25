import { createClient } from "@convex-dev/better-auth";
import { betterAuth } from "better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { lastLoginMethod } from "better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { GenericCtx } from "@convex-dev/better-auth";
import authConfig from "./auth.config";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import {
  DEFAULT_FROM_EMAIL,
  wrapEmailTemplate,
  emailButton,
} from "./lib/emailTemplate";

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

function getTrustedOrigins(siteUrl?: string): string[] {
  const origins = new Set<string>(["http://localhost:3000", "http://localhost:3001"]);
  if (!siteUrl) return Array.from(origins);

  const normalized = siteUrl.replace(/\/+$/, "");
  origins.add(normalized);

  try {
    const url = new URL(normalized);
    const host = url.hostname;
    if (host.startsWith("www.")) {
      origins.add(`${url.protocol}//${host.slice(4)}`);
    } else {
      origins.add(`${url.protocol}//www.${host}`);
    }
  } catch {
    // Ignore invalid SITE_URL values; the explicit value is still included above.
  }

  return Array.from(origins);
}

/**
 * Better Auth client for Convex backend
 * This provides the adapter and HTTP route registration for Better Auth
 */
export const authComponent = createClient<DataModel>(components.betterAuth, {
  verbose: false,
});

/**
 * Create the Better Auth instance with Convex adapter
 * This is used to register HTTP routes and for server-side auth operations
 */
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  // Use SITE_URL (Next.js app) as base — OAuth state cookies are set on the
  // Next.js domain, so the callback must go through the Next.js proxy too.
  const siteUrl = process.env.SITE_URL || process.env.CONVEX_SITE_URL;
  const trustedOrigins = getTrustedOrigins(process.env.SITE_URL);

  return betterAuth({
    baseURL: siteUrl,
    basePath: "/api/auth",
    database: authComponent.adapter(ctx),
    trustedOrigins,
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
      sendResetPassword: async ({ user, url }) => {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          console.log(
            "\n========================================\n" +
              "[auth] Password reset link (RESEND_API_KEY not set)\n" +
              `  User:  ${user.email}\n` +
              `  URL:   ${url}\n` +
              "========================================\n",
          );
          return;
        }

        const html = wrapEmailTemplate({
          headerTitle: "Reset Your Password",
          headerSubtitle: "We received a request to reset your password.",
          content: `
            <p style="margin: 0 0 20px;">Click the button below to choose a new password. This link will expire in 1 hour.</p>
            <div style="text-align: center; margin: 28px 0;">
              ${emailButton({ href: url, label: "Reset Password" })}
            </div>
            <p style="margin: 20px 0 0; color: #71717a; font-size: 13px;">If you didn&rsquo;t request this, you can safely ignore this email. Your password won&rsquo;t change.</p>
          `,
          footerText:
            "You\u2019re receiving this because a password reset was requested for your March Fitness account.",
        });

        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: DEFAULT_FROM_EMAIL,
              to: [user.email],
              subject: "Reset your password — March Fitness",
              html,
            }),
          });

          if (!res.ok) {
            const body = await res.text();
            console.error(
              "[auth] Failed to send password reset email:",
              res.status,
              body,
            );
          }
        } catch (err) {
          console.error("[auth] Error sending password reset email:", err);
        }
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
      lastLoginMethod(),
    ],
  });
};
