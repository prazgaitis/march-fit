"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  ChevronDown,
  ChevronUp,
  Flame,
  Loader2,
  Search,
  Trophy,
  User,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";

type SortField = "name" | "points" | "streak";
type SortDirection = "asc" | "desc";

const paymentStatusStyles: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  unpaid: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
};

const roleStyles: Record<string, string> = {
  admin: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  member: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

export default function AdminParticipantsPage() {
  const params = useParams();
  const challengeId = params.id as string;
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("points");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [clearingUserId, setClearingUserId] = useState<string | null>(null);

  const updateRole = useMutation(api.mutations.participations.updateRole);
  const clearTestPayment = useMutation(api.mutations.payments.clearTestPayment);

  const paymentConfig = useQuery(api.queries.paymentConfig.getPaymentConfig, {
    challengeId: challengeId as Id<"challenges">,
  });

  const participants = useQuery(api.queries.challenges.getParticipants, {
    challengeId: challengeId as Id<"challenges">,
    limit: 1000, // Get all participants for admin view
  });

  const paymentInfo = useQuery(api.queries.paymentConfig.getPublicPaymentInfo, {
    challengeId: challengeId as Id<"challenges">,
  });

  if (!participants || !paymentInfo) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading...
      </div>
    );
  }

  const requiresPayment = paymentInfo.requiresPayment;
  const isTestMode = paymentConfig?.testMode ?? false;

  const handleClearPayment = async (userId: string) => {
    if (!confirm("Clear this user's payment data? They will need to pay again to rejoin.")) {
      return;
    }
    setClearingUserId(userId);
    try {
      await clearTestPayment({
        challengeId: challengeId as Id<"challenges">,
        userId: userId as Id<"users">,
      });
    } catch (error) {
      console.error("Failed to clear payment:", error);
      alert(error instanceof Error ? error.message : "Failed to clear payment");
    } finally {
      setClearingUserId(null);
    }
  };

  // Filter by search
  const filtered = participants.filter((p: (typeof participants)[number]) => {
    const searchLower = search.toLowerCase();
    return (
      p.user.name?.toLowerCase().includes(searchLower) ||
      p.user.username.toLowerCase().includes(searchLower)
    );
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case "name":
        comparison = (a.user.name || a.user.username).localeCompare(
          b.user.name || b.user.username
        );
        break;
      case "points":
        comparison = a.stats.totalPoints - b.stats.totalPoints;
        break;
      case "streak":
        comparison = a.stats.currentStreak - b.stats.currentStreak;
        break;
    }
    return sortDirection === "desc" ? -comparison : comparison;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortHeader = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        "flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-300",
        className
      )}
    >
      {children}
      {sortField === field &&
        (sortDirection === "desc" ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronUp className="h-3 w-3" />
        ))}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-500">
          {filtered.length} participant{filtered.length !== 1 ? "s" : ""}
          {search && ` matching "${search}"`}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 w-48 rounded border border-zinc-800 bg-zinc-900 pl-7 pr-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded border border-zinc-800 bg-zinc-900">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 border-b border-zinc-800 px-3 py-2">
          <div className="col-span-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              #
            </span>
          </div>
          <div className="col-span-3">
            <SortHeader field="name">Participant</SortHeader>
          </div>
          <div className="col-span-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Role
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Payment
            </span>
          </div>
          <div className="col-span-2 text-right">
            <SortHeader field="points" className="justify-end">
              Points
            </SortHeader>
          </div>
          <div className="col-span-1 text-right">
            <SortHeader field="streak" className="justify-end">
              Streak
            </SortHeader>
          </div>
          <div className="col-span-2 text-right">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Actions
            </span>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-zinc-800/50">
          {sorted.length > 0 ? (
            sorted.map((participant, index) => (
              <div
                key={participant.user.id}
                className="grid grid-cols-12 items-center gap-2 px-3 py-2 hover:bg-zinc-800/30"
              >
                <div className="col-span-1">
                  <span className="font-mono text-xs text-zinc-600">
                    {index + 1}
                  </span>
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800">
                    {participant.user.avatarUrl ? (
                      <img
                        src={participant.user.avatarUrl}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-3 w-3 text-zinc-500" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-zinc-200">
                      {participant.user.name || participant.user.username}
                    </div>
                    {participant.user.name && (
                      <div className="text-[10px] text-zinc-500">
                        @{participant.user.username}
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-1">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      roleStyles[participant.role] ||
                        "bg-zinc-500/15 text-zinc-300 border-zinc-500/30"
                    )}
                  >
                    {participant.role}
                  </span>
                </div>
                <div className="col-span-2">
                  {requiresPayment ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        paymentStatusStyles[participant.paymentStatus] ||
                          "bg-zinc-500/15 text-zinc-300 border-zinc-500/30"
                      )}
                    >
                      {participant.paymentStatus}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500">N/A</span>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Trophy className="h-3 w-3 text-amber-400" />
                    <span className="font-mono text-sm text-emerald-400">
                      {participant.stats.totalPoints.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="col-span-1 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Flame className="h-3 w-3 text-orange-400" />
                    <span className="font-mono text-sm text-zinc-300">
                      {participant.stats.currentStreak}d
                    </span>
                  </div>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  {isTestMode && requiresPayment && participant.paymentStatus !== "unpaid" && (
                    <button
                      onClick={() => handleClearPayment(participant.user.id)}
                      disabled={clearingUserId === participant.user.id}
                      className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 hover:underline disabled:opacity-50"
                    >
                      {clearingUserId === participant.user.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      Clear Payment
                    </button>
                  )}
                  <button
                    onClick={() =>
                      updateRole({
                        challengeId: challengeId as Id<"challenges">,
                        userId: participant.user.id,
                        role: participant.role === "admin" ? "member" : "admin",
                      })
                    }
                    className={cn(
                      "text-xs hover:underline",
                      participant.role === "admin"
                        ? "text-red-400 hover:text-red-300"
                        : "text-indigo-400 hover:text-indigo-300"
                    )}
                  >
                    {participant.role === "admin" ? "Remove Admin" : "Make Admin"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-8 text-center text-xs text-zinc-600">
              {search ? "No participants match your search" : "No participants yet"}
            </div>
          )}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">Total Points</span>
            <span className="font-mono text-emerald-400">
              {sorted.reduce((sum, p) => sum + p.stats.totalPoints, 0).toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">Avg Points</span>
            <span className="font-mono text-zinc-300">
              {sorted.length > 0
                ? (
                    sorted.reduce((sum, p) => sum + p.stats.totalPoints, 0) /
                    sorted.length
                  ).toFixed(1)
                : "0"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">Active Streaks</span>
            <span className="font-mono text-orange-400">
              {sorted.filter((p) => p.stats.currentStreak > 0).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
