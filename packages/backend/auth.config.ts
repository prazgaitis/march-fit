import type { AuthConfig } from "convex/server";

const providers: AuthConfig["providers"] = process.env.CLERK_JWT_ISSUER_DOMAIN
  ? [{
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: process.env.CLERK_CONVEX_AUDIENCE ?? "convex",
    }]
  : [];

export default {
  providers,
} satisfies AuthConfig;
