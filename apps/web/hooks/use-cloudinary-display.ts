"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import { isCloudinaryEnabledForUser } from "@/lib/cloudinary";

/**
 * Returns true if the current user should see Cloudinary-optimized media.
 * Gated by NEXT_PUBLIC_CLOUDINARY_BETA_EMAILS when set.
 */
export function useCloudinaryDisplay(): boolean {
  const currentUser = useQuery(api.queries.users.current);
  return isCloudinaryEnabledForUser(currentUser?.email);
}
