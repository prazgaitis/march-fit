"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { CheckCircle2, Circle, Heart, MessageSquare, Send, Wrench } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";

interface FeedbackContentProps {
  challengeId: string;
}

type FeedbackListItem = {
  id: string;
  type: "bug" | "question" | "idea" | "other";
  title?: string;
  description: string;
  adminResponse?: string;
  status: "open" | "fixed";
  createdAt: number;
  fixedAt?: number;
  respondedAt?: number;
  reporter: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  } | null;
  respondedBy: {
    id: string;
    name: string | null;
    username: string;
  } | null;
  fixedBy: {
    id: string;
    name: string | null;
    username: string;
  } | null;
};

type FeedbackListResult = {
  items: FeedbackListItem[];
  canMarkFixed: boolean;
};

const feedbackTypeLabels: Record<FeedbackListItem["type"], string> = {
  bug: "Bug",
  question: "Question",
  idea: "Idea",
  other: "Other",
};

export function FeedbackContent({ challengeId }: FeedbackContentProps) {
  const [type, setType] = useState<FeedbackListItem["type"]>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const feedback = useQuery(api.queries.feedback.listByChallenge, {
    challengeId: challengeId as Id<"challenges">,
  }) as FeedbackListResult | undefined;

  const createFeedback = useMutation(api.mutations.feedback.create);
  const markFixed = useMutation(api.mutations.feedback.markFixed);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    try {
      await createFeedback({
        challengeId: challengeId as Id<"challenges">,
        type,
        title: title.trim() || undefined,
        description,
      });
      setType("bug");
      setTitle("");
      setDescription("");
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      alert(error instanceof Error ? error.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkFixed = async (feedbackId: string) => {
    setResolvingId(feedbackId);
    try {
      await markFixed({ feedbackId: feedbackId as Id<"feedback"> });
    } catch (error) {
      console.error("Failed to mark feedback fixed:", error);
      alert(error instanceof Error ? error.message : "Failed to mark feedback fixed");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">Feedback</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Report bugs or rough edges you run into in this challenge.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
      >
        <Select value={type} onValueChange={(value: FeedbackListItem["type"]) => setType(value)}>
          <SelectTrigger className="border-zinc-700 bg-zinc-900 text-zinc-100">
            <SelectValue placeholder="Select feedback type" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="question">Question</SelectItem>
            <SelectItem value="idea">Idea</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Short title (optional)"
          maxLength={120}
          className="border-zinc-700 bg-zinc-900 text-zinc-100"
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the bug and how to reproduce it"
          required
          rows={4}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting || !description.trim()}
            className="bg-indigo-500 text-white hover:bg-indigo-400"
          >
            Submit report
          </Button>
        </div>
      </form>

      {!feedback ? (
        <div className="py-8 text-center text-zinc-500">Loading feedback...</div>
      ) : feedback.items.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 text-center text-zinc-500">
          No bug reports yet.
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.items.map((item: FeedbackListItem) => {
            const isFixed = item.status === "fixed";
            return (
              <div
                key={item.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-indigo-500/20 text-indigo-300">
                        {feedbackTypeLabels[item.type]}
                      </span>
                      {isFixed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-zinc-500" />
                      )}
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          isFixed
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-zinc-700 text-zinc-300"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    {item.title ? (
                      <h2 className="mt-2 text-base font-semibold text-zinc-100">{item.title}</h2>
                    ) : null}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">
                      {item.description}
                    </p>
                    <FeedbackCommentThread feedbackId={item.id} />
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      {item.reporter ? (
                        <UserAvatar
                          user={item.reporter}
                          size="sm"
                          showName
                          disableLink
                          className="text-xs"
                        />
                      ) : (
                        <span>Unknown reporter</span>
                      )}
                      <span>
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </span>
                      {item.fixedAt && item.fixedBy ? (
                        <span>
                          Fixed {formatDistanceToNow(new Date(item.fixedAt), { addSuffix: true })} by{" "}
                          {item.fixedBy.name || item.fixedBy.username}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {feedback.canMarkFixed && !isFixed ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkFixed(item.id)}
                      disabled={resolvingId === item.id}
                      className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                    >
                      <Wrench className="mr-1 h-3 w-3" />
                      {resolvingId === item.id ? "Marking..." : "Mark fixed"}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
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

function FeedbackCommentThread({ feedbackId }: { feedbackId: string }) {
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

  if (!comments) return null;

  return (
    <div className="mt-3 space-y-2">
      {comments.length > 0 && (
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
          placeholder="Reply..."
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
