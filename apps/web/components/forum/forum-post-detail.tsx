"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import ReactMarkdown from "react-markdown";
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
import { cn } from "@/lib/utils";

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
    return <div className="py-12 text-center text-sm text-zinc-500">Loading...</div>;
  }

  if (data === null) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500">Post not found</div>
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
        className="mb-4 inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Forum
      </Link>

      {/* Main post */}
      <div className="flex gap-3">
        {/* Upvote column */}
        <div className="flex w-10 shrink-0 flex-col items-center pt-1">
          <button
            onClick={() => handleUpvote(data.post._id)}
            className={cn(
              "rounded p-1 transition-colors active:scale-95",
              data.upvotedByUser
                ? "text-indigo-400"
                : "text-zinc-600 hover:text-zinc-400",
            )}
          >
            <ArrowBigUp
              className="h-6 w-6"
              fill={data.upvotedByUser ? "currentColor" : "none"}
            />
          </button>
          <span
            className={cn(
              "text-sm font-mono font-medium",
              data.upvotedByUser ? "text-indigo-400" : "text-zinc-500",
            )}
          >
            {data.upvoteCount}
          </span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            {data.post.isPinned && (
              <Pin className="mt-1 h-4 w-4 shrink-0 rotate-45 text-amber-400" />
            )}
            <h1 className="break-words text-lg font-bold text-white">
              {data.post.title}
            </h1>
          </div>

          {/* Meta */}
          <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-500">
            <UserAvatar
              user={data.user}
              challengeId={challengeId}
              size="xs"
            />
            <span className="font-medium text-zinc-400">
              {data.user.username}
            </span>
            <span>·</span>
            <span>
              {formatDistanceToNow(new Date(data.post.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>

          {/* Body */}
          <div className="mt-4 break-words text-sm text-zinc-300">
            <PostContent content={data.post.content} />
          </div>

          {/* Actions */}
          {(data.isAdmin || data.isAuthor) && (
            <div className="mt-3 flex items-center gap-1 border-t border-zinc-800/50 pt-3">
              {data.isAdmin && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-zinc-500 hover:text-white" onClick={handlePin}>
                  <Pin className="h-3 w-3" />
                  {data.post.isPinned ? "Unpin" : "Pin"}
                </Button>
              )}
              {(data.isAuthor || data.isAdmin) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-400/70 hover:text-red-300"
                  onClick={() => handleDelete(data.post._id)}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="my-5 border-t border-zinc-800" />

      {/* Reply count */}
      <h2 className="mb-4 text-xs font-medium uppercase tracking-widest text-zinc-500">
        {data.replies.length} {data.replies.length === 1 ? "Reply" : "Replies"}
      </h2>

      {/* Replies */}
      <div className="space-y-0 divide-y divide-zinc-800/50">
        {data.replies.map((reply: typeof data.replies[number]) => (
          <div key={reply.post._id} className="flex gap-3 py-3">
            {/* Upvote column */}
            <div className="flex w-10 shrink-0 flex-col items-center pt-0.5">
              <button
                onClick={() => handleUpvote(reply.post._id)}
                className={cn(
                  "rounded p-1 transition-colors active:scale-95",
                  reply.upvotedByUser
                    ? "text-indigo-400"
                    : "text-zinc-600 hover:text-zinc-400",
                )}
              >
                <ArrowBigUp
                  className="h-5 w-5"
                  fill={reply.upvotedByUser ? "currentColor" : "none"}
                />
              </button>
              <span
                className={cn(
                  "text-xs font-mono font-medium",
                  reply.upvotedByUser ? "text-indigo-400" : "text-zinc-500",
                )}
              >
                {reply.upvoteCount}
              </span>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                {reply.user && (
                  <>
                    <UserAvatar
                      user={reply.user}
                      challengeId={challengeId}
                      size="xs"
                    />
                    <span className="font-medium text-zinc-400">
                      {reply.user.username}
                    </span>
                    <span>·</span>
                  </>
                )}
                <span>
                  {formatDistanceToNow(new Date(reply.post.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <div className="mt-1.5 break-words text-sm text-zinc-300">
                <PostContent content={reply.post.content} />
              </div>
              {(data.isAdmin || (reply.user && data.isAuthor)) && (
                <div className="mt-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-red-400/70 hover:text-red-300"
                    onClick={() => handleDelete(reply.post._id)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reply form */}
      <form onSubmit={handleReply} className="mt-5 border-t border-zinc-800 pt-5">
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
  );
}

/**
 * Extract markdown-compatible text from Tiptap JSON.
 * Converts bold/italic marks to markdown syntax and joins paragraphs with newlines.
 */
function tiptapToMarkdown(content: string): string | null {
  try {
    const doc = JSON.parse(content);
    if (doc?.type !== "doc" || !Array.isArray(doc.content)) return null;

    function renderNode(node: { type?: string; text?: string; content?: typeof doc.content; marks?: Array<{ type: string; attrs?: Record<string, unknown> }> }): string {
      if (node.type === "text" && typeof node.text === "string") {
        let text = node.text;
        if (node.marks) {
          for (const mark of node.marks) {
            if (mark.type === "bold") text = `**${text}**`;
            else if (mark.type === "italic") text = `*${text}*`;
            else if (mark.type === "link" && mark.attrs?.href) text = `[${text}](${mark.attrs.href})`;
          }
        }
        return text;
      }
      if (node.type === "hardBreak") return "\n";
      if (node.type === "mention") return `@${(node as { attrs?: { username?: string } }).attrs?.username ?? ""}`;
      const children = node.content?.map(renderNode).join("") ?? "";
      if (node.type === "paragraph") return children;
      if (node.type === "heading") return children;
      if (node.type === "horizontalRule") return "---";
      return children;
    }

    return doc.content
      .map((node: typeof doc.content[0]) => renderNode(node))
      .join("\n");
  } catch {
    return null;
  }
}

/** Check if plain text contains markdown table or heading syntax */
function containsMarkdownSyntax(text: string): boolean {
  return /^\|.+\|$/m.test(text) || /^#{1,6}\s/m.test(text);
}

/**
 * Renders post content — uses RichTextViewer for JSON (Tiptap) content,
 * falls back to markdown rendering with activity link card detection for legacy posts.
 * Tiptap content that contains markdown syntax (tables, headings) is extracted
 * and rendered through ReactMarkdown for proper formatting.
 */
function PostContent({
  content,
}: {
  content: string;
}) {
  // If it looks like Tiptap JSON, check if it contains markdown syntax
  if (content.trim().startsWith("{")) {
    const extracted = tiptapToMarkdown(content);
    if (extracted && containsMarkdownSyntax(extracted)) {
      return (
        <div className="space-y-3">
          <div className="prose prose-sm prose-invert max-w-none break-words prose-p:my-2 prose-pre:bg-zinc-900 prose-pre:text-zinc-200 prose-code:text-zinc-200 prose-a:text-indigo-300 prose-a:underline">
            <ReactMarkdown>{extracted}</ReactMarkdown>
          </div>
          <PostActivityCards content={extracted} />
        </div>
      );
    }
    return <RichTextViewer content={content} />;
  }

  // Legacy plain text/markdown
  return (
    <div className="space-y-3">
      <div className="prose prose-sm prose-invert max-w-none break-words prose-p:my-2 prose-pre:bg-zinc-900 prose-pre:text-zinc-200 prose-code:text-zinc-200 prose-a:text-indigo-300 prose-a:underline">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      <PostActivityCards content={content} />
    </div>
  );
}

/**
 * Renders rich activity cards for any activity URLs found in content.
 */
function PostActivityCards({
  content,
}: {
  content: string;
}) {
  // Match activity URLs in the content, including optional protocol+host prefix
  const activityUrlPattern =
    /(?:https?:\/\/[^\s/]+)?\/challenges\/[a-zA-Z0-9_]+\/activities\/([a-zA-Z0-9_]+)/g;

  const activityIds: string[] = [];
  let match;

  while ((match = activityUrlPattern.exec(content)) !== null) {
    const activityId = match[1];
    if (!activityIds.includes(activityId)) {
      activityIds.push(activityId);
    }
  }

  if (activityIds.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {activityIds.map((activityId) => (
        <ActivityLinkCard key={activityId} activityId={activityId} />
      ))}
    </div>
  );
}
