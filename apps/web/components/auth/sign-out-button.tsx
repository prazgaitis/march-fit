"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";

interface SignOutButtonProps {
  children?: ReactNode;
  className?: string;
}

export function SignOutButton({ children, className }: SignOutButtonProps) {
  const router = useRouter();
  const clerk = useClerk();

  const handleSignOut = async () => {
    await clerk.signOut({ redirectUrl: "/" });
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
