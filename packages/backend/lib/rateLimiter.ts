import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

/**
 * Application-level rate limiter.
 *
 * mcpApiRequests: per-user token bucket for the HTTP API (consumed by MCP
 * and any direct API integrations). Allows a steady 60 req/min with a
 * burst headroom of 20 extra tokens so normal interactive use is never
 * throttled. Aggressive polling (like a misconfigured MCP client) will hit
 * the cap within seconds and receive 429s until the bucket refills.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  mcpApiRequests: {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 20,
  },
});
