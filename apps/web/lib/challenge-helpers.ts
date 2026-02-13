import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { ApiError } from "./errors";
import { getConvexClient } from "./convex-server";

export async function getChallengeOrThrow(challengeId: string) {
  const convex = getConvexClient();
  const challenge = await convex.query(api.queries.challenges.getById, {
    challengeId: challengeId as Id<"challenges">,
  });

  if (!challenge) {
    throw new ApiError(404, "Challenge not found");
  }

  return challenge;
}

export function assertCanManageChallenge(
  user: { role: string; _id: Id<"users"> },
  challenge: { creatorId: Id<"users"> },
) {
  if (user.role !== "admin" && challenge.creatorId !== user._id) {
    throw new ApiError(403, "Forbidden");
  }
}

export async function requireChallengeParticipant(
  userId: Id<"users">,
  challengeId: Id<"challenges">,
) {
  const convex = getConvexClient();
  const participation = await convex.query(
    api.queries.participations.getByUserAndChallenge,
    {
      userId,
      challengeId,
    },
  );

  if (!participation) {
    throw new ApiError(403, "You are not part of this challenge");
  }

  return participation;
}

export async function isChallengeParticipant(
  userId: Id<"users">,
  challengeId: Id<"challenges">,
) {
  const convex = getConvexClient();
  const participation = await convex.query(
    api.queries.participations.getByUserAndChallenge,
    {
      userId,
      challengeId,
    },
  );

  return Boolean(participation);
}
