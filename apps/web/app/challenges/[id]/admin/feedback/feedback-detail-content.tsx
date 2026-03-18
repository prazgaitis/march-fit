"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import {
  Check,
  Heart,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { useFeedbackList } from "./feedback-list-context";

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
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  } | null;
  fixedBy: {
    id: string;
    name: string | null;
    username: string;
  } | null;
  respondedBy: {
    id: string;
    name: string | null;
    username: string;
  } | null;
};

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

const typeLabel: Record<FeedbackType, string> = {
  bug: "Bug",
  question: "Question",
  idea: "Idea",
  other: "Other",
};

const typeColor: Record<FeedbackType, string> = {
  bug: "border-destructive/30 bg-destructive/5",
  question: "border-blue-500/30 bg-blue-500/5",
  idea: "border-amber-500/30 bg-amber-500/5",
  other: "border-zinc-500/30 bg-zinc-500/5",
};

const typeIconColor: Record<FeedbackType, string> = {
  bug: "text-destructive",
  question: "text-blue-400",
  idea: "text-amber-400",
  other: "text-zinc-400",
};

interface FeedbackDetailContentProps {
  challengeId: string;
  feedbackId: string;
}

export function FeedbackDetailContent({
  challengeId,
  feedbackId,
}: FeedbackDetailContentProps) {
  const [isPending, setIsPending] = useState(false);

  const data = useQuery(api.queries.feedback.listForAdmin, {
    challengeId: challengeId as Id<"challenges">,
  }) as { items: FeedbackRow[] } | undefined;

  const item = data?.items.find((i) => i.id === feedbackId);

  const updateFeedback = useMutation(api.mutations.feedback.updateByAdmin);

  // Keyboard navigation
  const { items: sidebarItems, setSelectedId } = useFeedbackList();

  const navigateToSibling = useCallback(
    (direction: "prev" | "next") => {
      if (sidebarItems.length === 0) return;
      const currentIndex = sidebarItems.findIndex((i) => i.id === feedbackId);
      if (currentIndex === -1) {
        const fallback = sidebarItems[0];
        if (fallback) {
          setSelectedId(fallback.id);
        }
        return;
      }
      const targetIndex =
        direction === "prev" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= sidebarItems.length) return;
      const target = sidebarItems[targetIndex];
      setSelectedId(target.id);
    },
    [sidebarItems, feedbackId, setSelectedId],
  );

  const handleStatusToggle = useCallback(async () => {
    if (!item || isPending) return;
    const nextStatus: FeedbackStatus =
      item.status === "open" ? "fixed" : "open";
    setIsPending(true);
    try {
      await updateFeedback({
        feedbackId: feedbackId as Id<"feedback">,
        status: nextStatus,
      });
    } catch (error) {
      console.error("Failed to update feedback:", error);
    } finally {
      setIsPending(false);
    }
  }, [item, isPending, feedbackId, updateFeedback]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "ArrowLeft":
        case "j":
          e.preventDefault();
          navigateToSibling("prev");
          break;
        case "ArrowRight":
        case "k":
          e.preventDefault();
          navigateToSibling("next");
          break;
        case "f":
          e.preventDefault();
          handleStatusToggle();
          break;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigateToSibling, handleStatusToggle]);

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm font-medium text-zinc-400">
          Feedback not found
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          It may have been deleted.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Type banner */}
      <div
        className={`rounded-lg border px-3 py-2.5 ${typeColor[item.type]}`}
      >
        <div className="flex items-start gap-2.5">
          <MessageSquare
            className={`mt-0.5 h-4 w-4 shrink-0 ${typeIconColor[item.type]}`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p
                className={`text-xs font-semibold ${typeIconColor[item.type]}`}
              >
                {typeLabel[item.type]}
              </p>
              {item.status === "fixed" ? (
                <Badge
                  variant="default"
                  className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/20 text-emerald-300 border-0"
                >
                  Fixed
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 h-4 border-zinc-600 text-zinc-300"
                >
                  Open
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(item.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
            {item.title && (
              <p className="mt-1 text-sm font-semibold text-foreground">
                {item.title}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="border-b border-zinc-800 px-1 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {item.status === "open" ? (
            <Button
              type="button"
              onClick={handleStatusToggle}
              disabled={isPending}
              className="gap-1.5"
            >
              <Check className="h-4 w-4" />
              Mark Fixed
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleStatusToggle}
              disabled={isPending}
              className="gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              Reopen
            </Button>
          )}
          {item.fixedAt && item.fixedBy && (
            <span className="text-[11px] text-muted-foreground">
              Fixed by {item.fixedBy.name ?? item.fixedBy.username}{" "}
              {formatDistanceToNow(new Date(item.fixedAt), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>
      </div>

      {/* Reporter info */}
      {item.reporter && (
        <div className="flex items-center gap-2 px-4 py-3">
          <UserAvatar user={item.reporter} size="sm" disableLink />
          <div>
            <p className="text-xs font-medium">
              {item.reporter.name ?? item.reporter.username}
            </p>
            {item.reporter.name && (
              <p className="text-[10px] text-muted-foreground">
                @{item.reporter.username}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      <div className="px-4 pb-4">
        <p className="whitespace-pre-wrap text-sm text-zinc-200 leading-relaxed">
          {item.description}
        </p>
      </div>

      {/* Comments */}
      <div className="border-t border-zinc-800 mt-2 px-4 pt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Comments
        </p>
        <FeedbackComments feedbackId={feedbackId} />
      </div>
    </div>
  );
}

function FeedbackComments({ feedbackId }: { feedbackId: string }) {
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
    <div className="space-y-2">
      {comments && comments.length > 0 ? (
        <div className="space-y-2">
          {comments.map((entry) => (
            <div
              key={entry.comment.id}
              className="rounded-md border p-3 bg-muted/30"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
      ) : (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}

      <div className="flex items-center gap-2 pt-1">
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
