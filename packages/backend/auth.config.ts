import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";

// Use Better Auth provider for Convex authentication
// This uses the CONVEX_SITE_URL to fetch JWKS from the Convex deployment
export default {
  providers: [getAuthConfigProvider()],
};


