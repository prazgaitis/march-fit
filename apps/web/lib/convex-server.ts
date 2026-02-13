import "server-only";

import { ConvexHttpClient } from "convex/browser";

/**
 * Create a fresh ConvexHttpClient per request instead of reusing a module-level
 * singleton. Module-level instances can become stale in serverless environments
 * (Vercel) when connections persist across warm invocations.
 */
export function getConvexClient() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}
