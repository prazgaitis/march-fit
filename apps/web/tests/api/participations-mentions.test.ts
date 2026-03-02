import { beforeEach, describe, expect, it } from "vitest";
import { api } from "@repo/backend";
import {
  createTestChallenge,
  createTestContext,
  createTestParticipation,
  createTestUser,
} from "../helpers/convex";

describe("participations.getMentionable", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(() => {
    t = createTestContext();
  });

  it("returns mentionable users for all challenge participants", async () => {
    const ownerId = await createTestUser(t, {
      email: "owner-mentions@example.com",
      username: "owner_mentions",
    });
    const challengeId = await createTestChallenge(t, ownerId, {
      name: "Mentions Coverage Challenge",
    });

    const participantCount = 120;
    for (let i = 0; i < participantCount; i += 1) {
      const userId = await createTestUser(t, {
        email: `mention-user-${i}@example.com`,
        username: `mention_user_${i}`,
        name: `Mention User ${i}`,
      });
      await createTestParticipation(t, userId, challengeId, {
        joinedAt: i,
      });
    }

    const mentionable = await t.query(api.queries.participations.getMentionable, {
      challengeId,
    });

    expect(mentionable).toHaveLength(participantCount);
    expect(mentionable.some((user) => user.username === "mention_user_0")).toBe(true);
    expect(mentionable.some((user) => user.username === "mention_user_119")).toBe(true);
  });
});
