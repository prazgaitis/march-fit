"use client";

import { memo, useCallback, useState } from "react";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import Link from "next/link";
import { usePaginatedQuery, useMutation } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { ArrowBigUp, Loader2, MessageSquare, Pin, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

interface ForumContentProps {
  challengeId: string;
}

export function ForumContent({ challengeId }: ForumContentProps) {
  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    api.queries.forumPosts.listByChallenge,
    { challengeId: challengeId as Id<"challenges"> },
    { initialNumItems: 20 }
  );

  const sentinelRef = useInfiniteScroll(() => loadMore(20), {
    enabled: status === "CanLoadMore" && !isLoading,
  });

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

      {(status === "CanLoadMore" || isLoading) && status !== "LoadingFirstPage" && (
        <div ref={sentinelRef} className="flex justify-center pt-6">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />}
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
        "block py-3 transition-colors hover:bg-zinc-900/40",
        item.post.isPinned && "bg-amber-500/[0.02]",
      )}
    >
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
        <button
          onClick={handleUpvote}
          disabled={isUpvoting}
          className={cn(
            "flex items-center gap-1 rounded px-1 py-0.5 transition-colors active:scale-95",
            item.upvotedByUser
              ? "text-indigo-400"
              : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          <ArrowBigUp
            className="h-3.5 w-3.5"
            fill={item.upvotedByUser ? "currentColor" : "none"}
          />
          <span className="font-mono font-medium">{item.upvoteCount}</span>
        </button>
        <span>·</span>
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {item.replyCount}
        </span>
      </div>
    </Link>
  );
});
