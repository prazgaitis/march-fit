import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";

import { isUnauthenticatedConvexError } from "@/lib/convex-auth-error";

describe("isUnauthenticatedConvexError", () => {
  it("returns true for structured Convex unauthenticated errors", () => {
    const error = new ConvexError({
      code: "unauthenticated",
      message: "Your session has expired. Please sign in again to continue.",
    });

    expect(isUnauthenticatedConvexError(error)).toBe(true);
  });

  it("returns true for legacy unauthenticated message errors", () => {
    expect(isUnauthenticatedConvexError(new Error("Not authenticated"))).toBe(true);
    expect(isUnauthenticatedConvexError(new Error("unauthenticated"))).toBe(true);
    expect(isUnauthenticatedConvexError(new Error("Your session has expired"))).toBe(true);
  });

  it("returns false for non-auth errors", () => {
    expect(isUnauthenticatedConvexError(new Error("Challenge not found"))).toBe(false);
    expect(isUnauthenticatedConvexError("invalid activity type")).toBe(false);
  });
});
