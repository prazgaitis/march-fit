import { ConvexError } from "convex/values";

const UNAUTHENTICATED_PATTERN = /not authenticated|unauthenticated|session has expired/i;

export function isUnauthenticatedConvexError(error: unknown): boolean {
  if (
    error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data !== null &&
    (error.data as { code?: string }).code === "unauthenticated"
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return UNAUTHENTICATED_PATTERN.test(message);
}
