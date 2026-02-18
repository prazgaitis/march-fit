"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  ArrowBigUp,
  ArrowLeft,
  Pin,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { RichTextViewer } from "@/components/editor/rich-text-viewer";
import { useMentionableUsers } from "@/hooks/use-mentionable-users";
import { isEditorContentEmpty } from "@/lib/rich-text-utils";
import { ActivityLinkCard } from "./activity-link-card";

interface ForumPostDetailProps {
  postId: string;
  challengeId: string;
}

export function ForumPostDetail({ postId, challengeId }: ForumPostDetailProps) {
  const data = useQuery(api.queries.forumPosts.getById, {
    postId: postId as Id<"forumPosts">,
  });

  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createPost = useMutation(api.mutations.forumPosts.create);
  const toggleUpvote = useMutation(api.mutations.forumPosts.toggleUpvote);
  const togglePin = useMutation(api.mutations.forumPosts.togglePin);
  const removePost = useMutation(api.mutations.forumPosts.remove);
  const { users: mentionOptions } = useMentionableUsers(challengeId);

  if (data === undefined) {
    return <div className="py-12 text-center text-zinc-500">Loading...</div>;
  }

  if (data === null) {
    return (
      <div className="py-12 text-center text-zinc-500">Post not found</div>
    );
  }

  const replyEmpty = !replyContent || isEditorContentEmpty(replyContent);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (replyEmpty) return;

    setSubmitting(true);
    try {
      await createPost({
        challengeId: challengeId as Id<"challenges">,
        content: replyContent,
        parentPostId: postId as Id<"forumPosts">,
      });
      setReplyContent("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpvote = async (id: string) => {
    await toggleUpvote({ postId: id as Id<"forumPosts"> });
  };

  const handlePin = async () => {
    await togglePin({ postId: postId as Id<"forumPosts"> });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    await removePost({ postId: id as Id<"forumPosts"> });
  };

  return (
    <div>
      {/* Back link */}
      <Link
        href={`/challenges/${challengeId}/forum`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Forum
      </Link>

      {/* Main post */}
      <div className="rounded-lg border border-zinc-800 p-5">
        <div className="flex gap-3">
          {/* Upvote */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => handleUpvote(data.post._id)}
              className={`rounded p-1 transition-colors ${
                data.upvotedByUser
                  ? "text-indigo-400 hover:text-indigo-300"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <ArrowBigUp
                className="h-6 w-6"
                fill={data.upvotedByUser ? "currentColor" : "none"}
              />
            </button>
            <span
              className={`text-sm font-medium ${
                data.upvotedByUser ? "text-indigo-400" : "text-zinc-500"
              }`}
            >
              {data.upvoteCount}
            </span>
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {data.post.isPinned && (
                <Pin className="h-4 w-4 flex-shrink-0 text-amber-400" />
              )}
              <h1 className="text-xl font-bold text-white">
                {data.post.title}
              </h1>
            </div>

            <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
              <UserAvatar
                user={data.user}
                challengeId={challengeId}
                size="sm"
                showName
                className="text-xs"
              />
              <span>
                {formatDistanceToNow(new Date(data.post.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>

            <div className="mt-4 break-words text-sm text-zinc-300">
              <PostContent content={data.post.content} challengeId={challengeId} />
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center gap-2">
              {data.isAdmin && (
                <Button variant="ghost" size="sm" onClick={handlePin}>
                  <Pin className="h-3 w-3" />
                  {data.post.isPinned ? "Unpin" : "Pin"}
                </Button>
              )}
              {(data.isAuthor || data.isAdmin) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(data.post._id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="mt-6">
        <h2 className="mb-4 text-lg font-semibold">
          {data.replies.length} {data.replies.length === 1 ? "Reply" : "Replies"}
        </h2>

        <div className="space-y-3">
          {data.replies.map((reply: typeof data.replies[number]) => (
            <div
              key={reply.post._id}
              className="rounded-lg border border-zinc-800/50 p-4"
            >
              <div className="flex gap-3">
                {/* Upvote */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => handleUpvote(reply.post._id)}
                    className={`rounded p-1 transition-colors ${
                      reply.upvotedByUser
                        ? "text-indigo-400 hover:text-indigo-300"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <ArrowBigUp
                      className="h-5 w-5"
                      fill={reply.upvotedByUser ? "currentColor" : "none"}
                    />
                  </button>
                  <span
                    className={`text-xs font-medium ${
                      reply.upvotedByUser ? "text-indigo-400" : "text-zinc-500"
                    }`}
                  >
                    {reply.upvoteCount}
                  </span>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    {reply.user && (
                      <UserAvatar
                        user={reply.user}
                        challengeId={challengeId}
                        size="sm"
                        showName
                        className="text-xs"
                      />
                    )}
                    <span>
                      {formatDistanceToNow(new Date(reply.post.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="mt-2 break-words text-sm text-zinc-300">
                    <PostContent content={reply.post.content} challengeId={challengeId} />
                  </div>
                  {(data.isAdmin || (reply.user && data.isAuthor)) && (
                    <div className="mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(reply.post._id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reply form */}
        <form onSubmit={handleReply} className="mt-4">
          <RichTextEditor
            placeholder="Write a reply..."
            value={replyContent}
            onChange={setReplyContent}
            mentionOptions={mentionOptions}
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={submitting || replyEmpty}
            >
              {submitting ? "Replying..." : "Reply"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Renders post content — uses RichTextViewer for JSON (Tiptap) content,
 * falls back to plain text with activity link detection for legacy posts.
 */
function PostContent({
  content,
  challengeId,
}: {
  content: string;
  challengeId: string;
}) {
  // If it looks like Tiptap JSON, render with RichTextViewer
  if (content.trim().startsWith("{")) {
    return <RichTextViewer content={content} />;
  }

  // Legacy plain text: detect activity links
  return (
    <div className="whitespace-pre-wrap">
      <PostContentWithLinks content={content} challengeId={challengeId} />
    </div>
  );
}

/**
 * Renders post content with activity links detected and shown as rich cards.
 * Looks for URLs matching /challenges/.../activities/... pattern.
 */
function PostContentWithLinks({
  content,
  challengeId,
}: {
  content: string;
  challengeId: string;
}) {
  // Match activity URLs in the content, including optional protocol+host prefix
  const activityUrlPattern =
    /(?:https?:\/\/[^\s/]+)?\/challenges\/([a-zA-Z0-9_]+)\/activities\/([a-zA-Z0-9_]+)/g;

  const parts: Array<{ type: "text" | "activity"; value: string; activityId?: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = activityUrlPattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    parts.push({
      type: "activity",
      value: match[0],
      activityId: match[2],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }

  if (parts.length === 0) {
    return <>{content}</>;
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "activity" && part.activityId) {
          return (
            <span key={i}>
              <span className="text-indigo-400">{part.value}</span>
              <ActivityLinkCard activityId={part.activityId} />
            </span>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </>
  );
}
