"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import { isMediaOptimizationEnabled } from "@/lib/media-optimizer";

/**
 * Returns true if the current user should see optimized (Cloudinary-backed) media.
 * Safe to call unconditionally — returns false when the optimizer isn't configured
 * or the user isn't in the beta list.
 */
export function useOptimizedMedia(): boolean {
  const currentUser = useQuery(api.queries.users.current);
  return isMediaOptimizationEnabled(currentUser?.email);
}
