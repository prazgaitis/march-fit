"use client";

import { use, useMemo, useState } from "react";
import { useMutation, useQuery } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";

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
  const [statusDrafts, setStatusDrafts] = useState<Record<string, FeedbackStatus>>({});
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});

  const items = data?.items ?? [];

  const initializedStatusDrafts = useMemo(() => {
    const next: Record<string, FeedbackStatus> = {};
    for (const item of items) {
      next[item.id] = statusDrafts[item.id] ?? item.status;
    }
    return next;
  }, [items, statusDrafts]);

  const initializedResponseDrafts = useMemo(() => {
    const next: Record<string, string> = {};
    for (const item of items) {
      next[item.id] = responseDrafts[item.id] ?? (item.adminResponse ?? "");
    }
    return next;
  }, [items, responseDrafts]);

  const handleSave = async (item: FeedbackRow) => {
    const nextStatus = initializedStatusDrafts[item.id] ?? item.status;
    const nextResponse = initializedResponseDrafts[item.id] ?? item.adminResponse ?? "";

    const statusChanged = nextStatus !== item.status;
    const responseChanged = nextResponse !== (item.adminResponse ?? "");

    if (!statusChanged && !responseChanged) {
      return;
    }

    setSavingId(item.id);
    try {
      await updateFeedback({
        feedbackId: item.id as Id<"feedback">,
        status: statusChanged ? nextStatus : undefined,
        adminResponse: responseChanged ? nextResponse : undefined,
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
          {items.map((item) => {
            const rowStatus = initializedStatusDrafts[item.id] ?? item.status;
            const rowResponse = initializedResponseDrafts[item.id] ?? "";
            const dirty =
              rowStatus !== item.status || rowResponse !== (item.adminResponse ?? "");

            return (
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

                <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-start">
                  <label className="text-xs text-zinc-400">
                    Status
                    <select
                      className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
                      value={rowStatus}
                      onChange={(event) =>
                        setStatusDrafts((prev) => ({
                          ...prev,
                          [item.id]: event.target.value as FeedbackStatus,
                        }))
                      }
                    >
                      <option value="open">open</option>
                      <option value="fixed">fixed</option>
                    </select>
                  </label>

                  <label className="text-xs text-zinc-400">
                    Admin response
                    <textarea
                      value={rowResponse}
                      onChange={(event) =>
                        setResponseDrafts((prev) => ({
                          ...prev,
                          [item.id]: event.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Reply to the reporter (visible to admins in this view and API outputs)"
                      className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500"
                    />
                  </label>

                  <div className="md:pt-5">
                    <Button
                      size="sm"
                      onClick={() => void handleSave(item)}
                      disabled={!dirty || savingId === item.id}
                      className="bg-indigo-500 text-white hover:bg-indigo-400"
                    >
                      {savingId === item.id ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>

                {item.respondedAt ? (
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Last responded {formatDistanceToNow(new Date(item.respondedAt), { addSuffix: true })}
                  </p>
                ) : null}
                {item.fixedAt ? (
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Marked fixed {formatDistanceToNow(new Date(item.fixedAt), { addSuffix: true })}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
