"use client";

import { memo, useCallback, useState } from "react";
import Link from "next/link";
import { usePaginatedQuery, useMutation } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { ArrowBigUp, MessageSquare, Pin, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

interface ForumContentProps {
  challengeId: string;
}

export function ForumContent({ challengeId }: ForumContentProps) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.queries.forumPosts.listByChallenge,
    { challengeId: challengeId as Id<"challenges"> },
    { initialNumItems: 20 }
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Forum</h1>
        <Button asChild size="sm">
          <Link href={`/challenges/${challengeId}/forum/new`}>
            <Plus className="h-4 w-4" />
            New Post
          </Link>
        </Button>
      </div>

      <div className="divide-y divide-zinc-800/70">
        {results.map((item) => (
          <ForumPostCard
            key={item.post._id}
            item={item}
            challengeId={challengeId}
          />
        ))}
      </div>

      {status === "CanLoadMore" && (
        <div className="pt-6 text-center">
          <Button variant="outline" size="sm" onClick={() => loadMore(20)}>
            Load more
          </Button>
        </div>
      )}

      {results.length === 0 && status !== "LoadingFirstPage" && (
        <div className="py-16 text-center text-zinc-500">
          <MessageSquare className="mx-auto mb-3 h-8 w-8" />
          <p className="text-sm">No posts yet. Start the conversation!</p>
        </div>
      )}

      {status === "LoadingFirstPage" && (
        <div className="py-16 text-center text-zinc-500 text-sm">Loading...</div>
      )}
    </div>
  );
}

interface ForumPostCardProps {
  item: {
    post: {
      _id: string;
      title?: string;
      content: string;
      isPinned: boolean;
      createdAt: number;
    };
    user: {
      id: string;
      username: string;
      name: string | null;
      avatarUrl: string | null;
    } | null;
    upvoteCount: number;
    replyCount: number;
    upvotedByUser: boolean;
  };
  challengeId: string;
}

const ForumPostCard = memo(function ForumPostCard({ item, challengeId }: ForumPostCardProps) {
  const toggleUpvote = useMutation(api.mutations.forumPosts.toggleUpvote);
  const [isUpvoting, setIsUpvoting] = useState(false);

  const handleUpvote = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsUpvoting(true);
    try {
      await toggleUpvote({ postId: item.post._id as Id<"forumPosts"> });
    } catch (error) {
      console.error("Failed to toggle upvote", error);
    } finally {
      setIsUpvoting(false);
    }
  }, [item.post._id, toggleUpvote]);

  return (
    <Link
      href={`/challenges/${challengeId}/forum/${item.post._id}`}
      className={cn(
        "flex gap-3 py-3 transition-colors hover:bg-zinc-900/40",
        item.post.isPinned && "bg-amber-500/[0.02]",
      )}
    >
      {/* Upvote column */}
      <div className="flex w-10 shrink-0 flex-col items-center pt-0.5">
        <button
          onClick={handleUpvote}
          disabled={isUpvoting}
          className={cn(
            "rounded p-1 transition-colors active:scale-95",
            item.upvotedByUser
              ? "text-indigo-400"
              : "text-zinc-600 hover:text-zinc-400",
          )}
        >
          <ArrowBigUp
            className="h-5 w-5"
            fill={item.upvotedByUser ? "currentColor" : "none"}
          />
        </button>
        <span
          className={cn(
            "text-xs font-mono font-medium",
            item.upvotedByUser ? "text-indigo-400" : "text-zinc-500",
          )}
        >
          {item.upvoteCount}
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Title row */}
        <div className="flex items-center gap-1.5">
          {item.post.isPinned && (
            <Pin className="h-3 w-3 shrink-0 rotate-45 text-amber-400" />
          )}
          <h3 className="truncate text-sm font-semibold text-zinc-100">
            {item.post.title}
          </h3>
        </div>

        {/* Meta line */}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
          {item.user && (
            <>
              <UserAvatar user={item.user} size="xs" disableLink />
              <span className="font-medium text-zinc-400">
                {item.user.username}
              </span>
              <span>·</span>
            </>
          )}
          <span>
            {formatDistanceToNow(new Date(item.post.createdAt), {
              addSuffix: true,
            })}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {item.replyCount}
          </span>
        </div>
      </div>
    </Link>
  );
});
