"use client";

import { useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface StoryItem {
  activityId: string;
  user: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
  mediaUrls: string[];
  activityType: string | null;
  createdAt: number;
  pointsEarned: number;
}

interface StoriesRowProps {
  stories: StoryItem[];
  onStoryPress: (index: number) => void;
}

export function StoriesRow({ stories, onStoryPress }: StoriesRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (stories.length === 0) return null;

  return (
    <div className="relative -mx-4">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {stories.map((story, index) => (
          <button
            key={story.activityId}
            onClick={() => onStoryPress(index)}
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            {/* Gradient ring */}
            <div className="rounded-full bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-amber-500 p-[2.5px]">
              <div className="rounded-full bg-black p-[2px]">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={story.user.avatarUrl ?? undefined}
                    alt={story.user.name ?? story.user.username}
                  />
                  <AvatarFallback className="text-xs">
                    {(story.user.name ?? story.user.username)
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
            <span className="w-16 truncate text-center text-[11px] text-zinc-400">
              {story.user.name?.split(" ")[0] ?? story.user.username}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
