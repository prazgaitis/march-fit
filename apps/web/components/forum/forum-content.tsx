"use client";

import Link from "next/link";
import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { ArrowBigUp, MessageSquare, Pin, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { getPlainTextFromValue } from "@/lib/rich-text-utils";

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
        <Button asChild>
          <Link href={`/challenges/${challengeId}/forum/new`}>
            <Plus className="h-4 w-4" />
            New Post
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        {results.map((item) => (
          <ForumPostCard
            key={item.post._id}
            item={item}
            challengeId={challengeId}
          />
        ))}

        {status === "CanLoadMore" && (
          <div className="pt-4 text-center">
            <Button variant="outline" onClick={() => loadMore(20)}>
              Load more
            </Button>
          </div>
        )}

        {results.length === 0 && status !== "LoadingFirstPage" && (
          <div className="py-12 text-center text-zinc-500">
            <MessageSquare className="mx-auto mb-3 h-8 w-8" />
            <p>No posts yet. Start the conversation!</p>
          </div>
        )}

        {status === "LoadingFirstPage" && (
          <div className="py-12 text-center text-zinc-500">Loading...</div>
        )}
      </div>
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

function ForumPostCard({ item, challengeId }: ForumPostCardProps) {
  const toggleUpvote = useMutation(api.mutations.forumPosts.toggleUpvote);

  const handleUpvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleUpvote({ postId: item.post._id as Id<"forumPosts"> });
  };

  return (
    <Link
      href={`/challenges/${challengeId}/forum/${item.post._id}`}
      className="flex gap-3 rounded-lg border border-zinc-800 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900/50"
    >
      {/* Upvote column */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={handleUpvote}
          className={`rounded p-1 transition-colors ${
            item.upvotedByUser
              ? "text-indigo-400 hover:text-indigo-300"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <ArrowBigUp
            className="h-5 w-5"
            fill={item.upvotedByUser ? "currentColor" : "none"}
          />
        </button>
        <span
          className={`text-xs font-medium ${
            item.upvotedByUser ? "text-indigo-400" : "text-zinc-500"
          }`}
        >
          {item.upvoteCount}
        </span>
      </div>

      {/* Content column */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {item.post.isPinned && (
            <Pin className="h-3 w-3 flex-shrink-0 text-amber-400" />
          )}
          <h3 className="truncate font-semibold text-white">
            {item.post.title}
          </h3>
        </div>

        <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
          {getPlainTextFromValue(item.post.content)}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          {item.user && (
            <UserAvatar
              user={item.user}
              size="sm"
              showName
              className="text-xs"
            />
          )}
          <span>
            {formatDistanceToNow(new Date(item.post.createdAt), {
              addSuffix: true,
            })}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {item.replyCount}
          </span>
        </div>
      </div>
    </Link>
  );
}
