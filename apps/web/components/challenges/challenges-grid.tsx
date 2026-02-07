"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import Link from "next/link";

interface Challenge {
  id: string;
  name: string;
  description: string | null;
  startDate: number;
  endDate: number;
  durationDays: number;
  participantCount: number;
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const startDate = new Date(challenge.startDate);
  const endDate = new Date(challenge.endDate);
  const now = new Date();

  const isActive = now >= startDate && now <= endDate;
  const isUpcoming = now < startDate;

  const status = isUpcoming ? "Upcoming" : isActive ? "Active" : "Completed";
  const statusColor = isUpcoming ? "text-yellow-400" : isActive ? "text-green-400" : "text-gray-400";

  return (
    <Link href={`/challenges/${challenge.id}`} className="group block">
      <div className="relative overflow-hidden rounded-2xl bg-zinc-900/50 border border-zinc-800 p-6 transition-all duration-300 hover:border-zinc-600 hover:bg-zinc-900/80">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-fuchsia-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <span className={`text-xs uppercase tracking-wider font-medium ${statusColor}`}>
              {status}
            </span>
            <span className="text-xs text-zinc-500">
              {challenge.participantCount} {challenge.participantCount === 1 ? "participant" : "participants"}
            </span>
          </div>

          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-zinc-100 transition-colors">
            {challenge.name}
          </h3>

          {challenge.description && (
            <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
              {challenge.description}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>{startDate.toLocaleDateString()}</span>
            <span className="text-zinc-600">•</span>
            <span>{endDate.toLocaleDateString()}</span>
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800">
            <span className="inline-flex items-center text-xs font-medium text-white group-hover:text-indigo-400 transition-colors">
              View Challenge
              <svg className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ChallengesGrid() {
  const challenges = useQuery(api.queries.challenges.listPublic, {
    limit: 20,
    offset: 0,
  });

  const loading = challenges === undefined;
  const error = challenges === null ? "Failed to load challenges" : null;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-6 animate-pulse"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="h-4 bg-zinc-800 rounded w-16" />
              <div className="h-4 bg-zinc-800 rounded w-20" />
            </div>
            <div className="h-6 bg-zinc-800 rounded mb-2" />
            <div className="h-4 bg-zinc-800 rounded mb-4 w-3/4" />
            <div className="flex items-center justify-between">
              <div className="h-3 bg-zinc-800 rounded w-20" />
              <div className="h-3 bg-zinc-800 rounded w-3" />
              <div className="h-3 bg-zinc-800 rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-400 text-lg mb-2">Failed to load challenges</div>
        <p className="text-zinc-500">{error}</p>
      </div>
    );
  }

  if (!challenges || challenges.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-6">🏆</div>
        <h3 className="text-2xl font-bold text-white mb-2">No challenges available</h3>
        <p className="text-zinc-400 max-w-md mx-auto">
          New challenges are being prepared. Check back soon to join the competition!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {challenges.map((challenge: (typeof challenges)[number]) => (
        <ChallengeCard key={challenge.id} challenge={challenge} />
      ))}
    </div>
  );
}