"use client";

import { use } from "react";
import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Pin, Trash2, MessageSquare, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import Link from "next/link";

interface AdminForumPageProps {
  params: Promise<{ id: string }>;
}

export default function AdminForumPage({ params }: AdminForumPageProps) {
  const { id } = use(params);
  const challengeId = id as Id<"challenges">;

  const { results, status, loadMore } = usePaginatedQuery(
    api.queries.forumPosts.listForAdmin,
    { challengeId },
    { initialNumItems: 50 }
  );

  const togglePin = useMutation(api.mutations.forumPosts.togglePin);
  const removePost = useMutation(api.mutations.forumPosts.remove);

  const handlePin = async (postId: string) => {
    await togglePin({ postId: postId as Id<"forumPosts"> });
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this post? This action is soft-delete and can be reversed in the database.")) return;
    await removePost({ postId: postId as Id<"forumPosts"> });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white">Forum Management</h1>
          <p className="text-xs text-zinc-500">
            Pin important posts and moderate content
          </p>
        </div>
        <Link
          href={`/challenges/${id}/forum`}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
        >
          <ExternalLink className="h-3 w-3" />
          View Forum
        </Link>
      </div>

      {status === "LoadingFirstPage" && (
        <div className="py-8 text-center text-xs text-zinc-500">Loading...</div>
      )}

      {results.length === 0 && status !== "LoadingFirstPage" && (
        <div className="py-8 text-center text-xs text-zinc-500">
          No forum posts yet.
        </div>
      )}

      <div className="overflow-hidden rounded border border-zinc-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-3 py-2 text-left font-medium text-zinc-400">
                Post
              </th>
              <th className="px-3 py-2 text-left font-medium text-zinc-400">
                Author
              </th>
              <th className="px-3 py-2 text-center font-medium text-zinc-400">
                Upvotes
              </th>
              <th className="px-3 py-2 text-center font-medium text-zinc-400">
                Replies
              </th>
              <th className="px-3 py-2 text-left font-medium text-zinc-400">
                Created
              </th>
              <th className="px-3 py-2 text-right font-medium text-zinc-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((item) => (
              <tr
                key={item.post._id}
                className={`border-b border-zinc-800/50 ${
                  item.post.deletedAt
                    ? "opacity-40"
                    : "hover:bg-zinc-900/30"
                }`}
              >
                <td className="max-w-xs px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {item.post.isPinned && (
                      <Pin className="h-3 w-3 flex-shrink-0 text-amber-400" />
                    )}
                    <Link
                      href={`/challenges/${id}/forum/${item.post._id}`}
                      className="truncate font-medium text-white hover:underline"
                    >
                      {item.post.title || "(no title)"}
                    </Link>
                    {item.post.deletedAt && (
                      <span className="ml-1 text-[10px] text-red-400">
                        DELETED
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-zinc-500">
                    {item.post.content.slice(0, 80)}
                  </p>
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {item.user?.username || "unknown"}
                </td>
                <td className="px-3 py-2 text-center font-mono text-zinc-300">
                  {item.upvoteCount}
                </td>
                <td className="px-3 py-2 text-center font-mono text-zinc-300">
                  {item.replyCount}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                  {formatDistanceToNow(new Date(item.post.createdAt), {
                    addSuffix: true,
                  })}
                </td>
                <td className="px-3 py-2">
                  {!item.post.deletedAt && (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handlePin(item.post._id)}
                        className={`rounded p-1 transition-colors ${
                          item.post.isPinned
                            ? "text-amber-400 hover:text-amber-300"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                        title={item.post.isPinned ? "Unpin" : "Pin"}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.post._id)}
                        className="rounded p-1 text-zinc-500 transition-colors hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {status === "CanLoadMore" && (
        <div className="mt-3 text-center">
          <Button variant="outline" size="sm" onClick={() => loadMore(50)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
