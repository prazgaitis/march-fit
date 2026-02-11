"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  CheckCircle,
  Clock,
  Mail,
  Search,
  User,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";

type SendStatus = "sent" | "pending" | "failed";
type StatusFilter = "all" | SendStatus;

type EmailSendRow = {
  id: string;
  status: SendStatus;
  error?: string;
  createdAt: number;
  sentAt?: number;
  emailName: string;
  subject: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
};

const statusConfig = {
  sent: { icon: CheckCircle, label: "Sent", className: "text-emerald-400" },
  pending: { icon: Clock, label: "Pending", className: "text-amber-400" },
  failed: { icon: XCircle, label: "Failed", className: "text-red-400" },
} as const;

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EmailSendsPage() {
  const params = useParams();
  const challengeId = params.id as string;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const sends = useQuery(api.queries.emailSequences.listSends, {
    challengeId: challengeId as Id<"challenges">,
  });

  if (!sends) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading...
      </div>
    );
  }

  // Filter
  const filtered = sends.filter((send: EmailSendRow) => {
    if (statusFilter !== "all" && send.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        send.userName.toLowerCase().includes(q) ||
        send.userEmail.toLowerCase().includes(q) ||
        send.emailName.toLowerCase().includes(q) ||
        send.subject.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Counts
  const sentCount = sends.filter((s: EmailSendRow) => s.status === "sent").length;
  const pendingCount = sends.filter((s: EmailSendRow) => s.status === "pending").length;
  const failedCount = sends.filter((s: EmailSendRow) => s.status === "failed").length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Status filter pills */}
          {(
            [
              { key: "all", label: "All", count: sends.length },
              { key: "sent", label: "Sent", count: sentCount },
              { key: "pending", label: "Pending", count: pendingCount },
              { key: "failed", label: "Failed", count: failedCount },
            ] as const
          ).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                statusFilter === key
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300",
              )}
            >
              {label}
              <span className="font-mono text-[10px]">{count}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by user or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 w-56 rounded border border-zinc-800 bg-zinc-900 pl-7 pr-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded border border-zinc-800 bg-zinc-900">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 border-b border-zinc-800 px-3 py-2">
          <div className="col-span-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Status
            </span>
          </div>
          <div className="col-span-3">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Recipient
            </span>
          </div>
          <div className="col-span-3">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Email
            </span>
          </div>
          <div className="col-span-3">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Subject
            </span>
          </div>
          <div className="col-span-2 text-right">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Time
            </span>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-zinc-800/50">
          {filtered.length > 0 ? (
            filtered.map((send: EmailSendRow) => {
              const config = statusConfig[send.status];
              const StatusIcon = config.icon;

              return (
                <div
                  key={send.id}
                  className="grid grid-cols-12 items-center gap-2 px-3 py-2 hover:bg-zinc-800/30"
                >
                  {/* Status */}
                  <div className="col-span-1">
                    <div
                      className={cn(
                        "flex items-center gap-1",
                        config.className,
                      )}
                      title={
                        send.status === "failed" && send.error
                          ? send.error
                          : config.label
                      }
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium">
                        {config.label}
                      </span>
                    </div>
                  </div>

                  {/* Recipient */}
                  <div className="col-span-3 flex items-center gap-2">
                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800">
                      {send.userAvatarUrl ? (
                        <img
                          src={send.userAvatarUrl}
                          alt=""
                          className="h-5 w-5 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-2.5 w-2.5 text-zinc-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs text-zinc-200">
                        {send.userName}
                      </div>
                      <div className="truncate text-[10px] text-zinc-500">
                        {send.userEmail}
                      </div>
                    </div>
                  </div>

                  {/* Email name */}
                  <div className="col-span-3">
                    <div className="truncate text-xs text-zinc-300">
                      {send.emailName}
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="col-span-3">
                    <div className="truncate text-xs text-zinc-500">
                      {send.subject}
                    </div>
                  </div>

                  {/* Time */}
                  <div className="col-span-2 text-right">
                    <span
                      className="text-[10px] text-zinc-500"
                      title={new Date(
                        send.sentAt ?? send.createdAt,
                      ).toLocaleString()}
                    >
                      {formatTime(send.sentAt ?? send.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-3 py-12 text-center">
              <Mail className="mx-auto h-6 w-6 text-zinc-700" />
              <div className="mt-1.5 text-xs text-zinc-500">
                {search || statusFilter !== "all"
                  ? "No sends match your filters"
                  : "No emails have been sent yet"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      {sends.length > 0 && (
        <div className="flex items-center gap-4 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">Total</span>
            <span className="font-mono text-zinc-300">{sends.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3 w-3 text-emerald-400" />
            <span className="font-mono text-emerald-400">{sentCount}</span>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-amber-400" />
              <span className="font-mono text-amber-400">{pendingCount}</span>
            </div>
          )}
          {failedCount > 0 && (
            <div className="flex items-center gap-1.5">
              <XCircle className="h-3 w-3 text-red-400" />
              <span className="font-mono text-red-400">{failedCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
