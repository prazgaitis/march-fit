"use client";

import { memo, useCallback, useState } from "react";
import { Loader2, UserCheck, UserPlus } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { Button } from "@/components/ui/button";

export const FollowButton = memo(function FollowButton({
  userId,
  isFollowing,
}: {
  userId: string;
  isFollowing: boolean;
}) {
  const [isToggling, setIsToggling] = useState(false);
  const toggleFollow = useMutation(api.mutations.follows.toggle);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isToggling) return;
      setIsToggling(true);
      try {
        await toggleFollow({ userId: userId as Id<"users"> });
      } catch (error) {
        console.error("Failed to toggle follow:", error);
      } finally {
        setIsToggling(false);
      }
    },
    [isToggling, toggleFollow, userId],
  );

  if (isToggling) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </Button>
    );
  }

  if (isFollowing) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={handleClick}
      >
        <UserCheck className="h-4 w-4 text-blue-400" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      onClick={handleClick}
    >
      <UserPlus className="h-4 w-4 text-muted-foreground" />
    </Button>
  );
});
