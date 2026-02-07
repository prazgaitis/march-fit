"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { betterAuthClient } from "@/lib/better-auth/client";

interface SignOutButtonProps {
  children?: ReactNode;
  className?: string;
}

export function SignOutButton({ children, className }: SignOutButtonProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await betterAuthClient.signOut();
    router.push("/");
  };

  return (
    <button
      onClick={handleSignOut}
      className={className}
      type="button"
    >
      {children || "Sign Out"}
    </button>
  );
}
