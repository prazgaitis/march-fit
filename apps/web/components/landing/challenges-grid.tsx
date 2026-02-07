"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import { ChallengeCard } from "./challenge-card";

export function ChallengesGrid() {
  const challenges = useQuery(api.queries.challenges.listPublic, {
    limit: 20,
    offset: 0,
  });

  const loading = challenges === undefined;
  const error = challenges === null ? "Failed to load challenges" : null;

  if (loading) {
    return (
      <section id="challenges" className="py-16 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Active Challenges
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join thousands of fitness enthusiasts in exciting challenges
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-xl shadow-md overflow-hidden animate-pulse"
              >
                <div className="h-32 bg-muted" />
                <div className="p-6">
                  <div className="h-6 bg-muted rounded mb-2" />
                  <div className="h-4 bg-muted rounded mb-4" />
                  <div className="flex justify-between">
                    <div className="h-4 bg-muted rounded w-24" />
                    <div className="h-4 bg-muted rounded w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="challenges" className="py-16 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Active Challenges
            </h2>
            <p className="text-destructive">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="challenges" className="py-16 bg-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Active Challenges
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join thousands of fitness enthusiasts in exciting challenges.
            Choose from a variety of activities and compete with others to reach your goals.
          </p>
        </div>

        {!challenges || challenges.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              No active challenges available at the moment.
            </p>
            <p className="text-muted-foreground/70 mt-2">
              Check back soon for new exciting fitness challenges!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {challenges.map((challenge: (typeof challenges)[number]) => (
              <ChallengeCard
                key={challenge.id}
                challenge={{
                  ...challenge,
                  startDate: new Date(challenge.startDate),
                  endDate: new Date(challenge.endDate),
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}