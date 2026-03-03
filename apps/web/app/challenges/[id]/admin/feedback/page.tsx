"use client";

import { use, useState } from "react";
import { useMutation, useQuery } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { Heart, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";

type FeedbackType = "bug" | "question" | "idea" | "other";
type FeedbackStatus = "open" | "fixed";

type FeedbackRow = {
  id: string;
  type: FeedbackType;
  status: FeedbackStatus;
  title?: string;
  description: string;
  adminResponse?: string;
  createdAt: number;
  fixedAt?: number;
  respondedAt?: number;
  reporter: {
    name: string | null;
    username: string;
  } | null;
};

type FeedbackResult = {
  items: FeedbackRow[];
};

const typeLabel: Record<FeedbackType, string> = {
  bug: "Bug",
  question: "Question",
  idea: "Idea",
  other: "Other",
};

interface AdminFeedbackPageProps {
  params: Promise<{ id: string }>;
}

export default function AdminFeedbackPage({ params }: AdminFeedbackPageProps) {
  const { id } = use(params);
  const challengeId = id as Id<"challenges">;

  const data = useQuery(api.queries.feedback.listForAdmin, {
    challengeId,
  }) as FeedbackResult | undefined;

  const updateFeedback = useMutation(api.mutations.feedback.updateByAdmin);
  const [savingId, setSavingId] = useState<string | null>(null);

  const items = data?.items ?? [];

  const handleStatusChange = async (item: FeedbackRow, status: FeedbackStatus) => {
    if (status === item.status) return;
    setSavingId(item.id);
    try {
      await updateFeedback({
        feedbackId: item.id as Id<"feedback">,
        status,
      });
    } catch (error) {
      console.error("Failed to update feedback:", error);
      alert(error instanceof Error ? error.message : "Failed to update feedback");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-sm font-semibold text-white">Feedback</h1>
        <p className="text-xs text-zinc-500">
          Review participant reports, respond, and mark issues as fixed.
        </p>
      </div>

      {!data ? (
        <div className="py-8 text-center text-xs text-zinc-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="rounded border border-zinc-800 py-8 text-center text-xs text-zinc-500">
          No feedback yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded border border-zinc-800 bg-zinc-900/40 p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide">
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-indigo-300">
                  {typeLabel[item.type]}
                </span>
                <span
                  className={`rounded px-2 py-0.5 ${
                    item.status === "fixed"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-zinc-700 text-zinc-300"
                  }`}
                >
                  {item.status}
                </span>
                <span className="text-zinc-500 normal-case tracking-normal">
                  Reported by {item.reporter?.name || item.reporter?.username || "unknown"} {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                </span>
              </div>

              {item.title ? (
                <h2 className="text-sm font-semibold text-zinc-100">{item.title}</h2>
              ) : null}
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{item.description}</p>

              <div className="mt-3 flex items-center gap-3">
                <label className="text-xs text-zinc-400">
                  Status
                  <select
                    className="ml-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
                    value={item.status}
                    disabled={savingId === item.id}
                    onChange={(event) =>
                      void handleStatusChange(item, event.target.value as FeedbackStatus)
                    }
                  >
                    <option value="open">open</option>
                    <option value="fixed">fixed</option>
                  </select>
                </label>
                {item.fixedAt ? (
                  <span className="text-[11px] text-zinc-500">
                    Marked fixed {formatDistanceToNow(new Date(item.fixedAt), { addSuffix: true })}
                  </span>
                ) : null}
              </div>

              <AdminFeedbackCommentThread feedbackId={item.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type CommentEntry = {
  comment: {
    id: string;
    content: string;
    createdAt: string;
  };
  author: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
  likeCount: number;
  likedByMe: boolean;
};

function AdminFeedbackCommentThread({ feedbackId }: { feedbackId: string }) {
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const comments = useQuery(api.queries.comments.getByFeedbackId, {
    feedbackId: feedbackId as Id<"feedback">,
  }) as CommentEntry[] | undefined;

  const createComment = useMutation(api.mutations.comments.createOnFeedback);
  const toggleLike = useMutation(api.mutations.commentLikes.toggle);

  const handleSubmit = async () => {
    if (!commentText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createComment({
        feedbackId: feedbackId as Id<"feedback">,
        content: commentText.trim(),
      });
      setCommentText("");
    } catch (error) {
      console.error("Failed to post comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        Comments
      </p>

      {comments && comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((entry) => (
            <div
              key={entry.comment.id}
              className="rounded-md border border-zinc-700/50 bg-zinc-800/50 p-3"
            >
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <UserAvatar
                  user={entry.author}
                  size="sm"
                  showName
                  disableLink
                  className="text-xs"
                />
                <span>
                  {formatDistanceToNow(new Date(entry.comment.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">
                {entry.comment.content}
              </p>
              <div className="mt-1 flex items-center gap-1">
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  onClick={() =>
                    toggleLike({
                      commentId: entry.comment.id as Id<"comments">,
                    })
                  }
                >
                  <Heart
                    className={`h-3 w-3 ${entry.likedByMe ? "fill-red-500 text-red-500" : ""}`}
                  />
                  {entry.likeCount > 0 && <span>{entry.likeCount}</span>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Post a comment..."
          className="border-zinc-700 bg-zinc-900 text-zinc-100 text-sm h-8"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={isSubmitting || !commentText.trim()}
          onClick={handleSubmit}
          className="h-8 px-2"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
