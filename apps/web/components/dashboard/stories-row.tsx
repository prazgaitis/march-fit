"use client";

import { useMemo, useRef } from "react";
import { Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ActivityLogDialogLazy as ActivityLogDialog } from "./activity-log-dialog-lazy";

/** A single slide within a story — one media item from one activity */
export interface StorySlide {
  activityId: string;
  mediaUrl: string;
  activityType: string | null;
  createdAt: number;
  pointsEarned: number;
  likes: number;
  comments: number;
  likedByUser: boolean;
}

/** One story per user, containing all their recent media slides */
export interface StoryItem {
  user: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
  challengeId: string;
  slides: StorySlide[];
}

interface StoriesRowProps {
  stories: StoryItem[];
  onStoryPress: (index: number) => void;
  currentUser?: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
  challengeId?: string;
  challengeStartDate?: string;
}

export function StoriesRow({
  stories,
  onStoryPress,
  currentUser,
  challengeId,
  challengeStartDate,
}: StoriesRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check if current user already has a story in the list
  const myStoryIndex = useMemo(
    () => (currentUser ? stories.findIndex((s) => s.user.id === currentUser.id) : -1),
    [stories, currentUser],
  );
  const hasOwnStory = myStoryIndex >= 0;

  // Reorder: pin current user's story first, exclude from rest
  const otherStories = useMemo(() => {
    if (!hasOwnStory) return stories;
    return stories.filter((_, i) => i !== myStoryIndex);
  }, [stories, hasOwnStory, myStoryIndex]);

  if (stories.length === 0 && !currentUser) return null;

  return (
    <div className="relative -mx-4">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* First position: current user */}
        {currentUser && (
          hasOwnStory ? (
            // User has a story — tap to view it
            <button
              onClick={() => onStoryPress(myStoryIndex)}
              className="flex shrink-0 flex-col items-center gap-1.5"
            >
              <div className="rounded-full bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-amber-500 p-[2.5px]">
                <div className="rounded-full bg-black p-[2px]">
                  <Avatar className="h-16 w-16">
                    <AvatarImage
                      src={currentUser.avatarUrl ?? undefined}
                      alt={currentUser.name ?? currentUser.username}
                    />
                    <AvatarFallback className="text-xs">
                      {(currentUser.name ?? currentUser.username)
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
              <span className="w-16 truncate text-center text-[11px] text-zinc-400">
                Your story
              </span>
            </button>
          ) : challengeId ? (
            // No story — tap to log activity
            <ActivityLogDialog
              challengeId={challengeId}
              challengeStartDate={challengeStartDate}
              trigger={
                <button className="flex shrink-0 flex-col items-center gap-1.5">
                  <div className="relative">
                    <div className="rounded-full border-2 border-zinc-700 p-[2px]">
                      <Avatar className="h-16 w-16">
                        <AvatarImage
                          src={currentUser.avatarUrl ?? undefined}
                          alt={currentUser.name ?? currentUser.username}
                        />
                        <AvatarFallback className="text-xs">
                          {(currentUser.name ?? currentUser.username)
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 ring-2 ring-black">
                      <Plus className="h-3 w-3 text-white" />
                    </div>
                  </div>
                  <span className="w-16 truncate text-center text-[11px] text-zinc-400">
                    Your story
                  </span>
                </button>
              }
            />
          ) : null
        )}

        {/* Other users' stories */}
        {otherStories.map((story) => {
          const originalIndex = stories.indexOf(story);
          return (
            <button
              key={story.user.id}
              onClick={() => onStoryPress(originalIndex)}
              className="flex shrink-0 flex-col items-center gap-1.5"
            >
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
          );
        })}
      </div>
    </div>
  );
}
