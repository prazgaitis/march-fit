import { describe, it, expect, beforeEach } from "vitest";
import { api } from "@repo/backend";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
} from "../helpers/convex";
import type { Id } from "@repo/backend/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { DataModel } from "@repo/backend/_generated/dataModel";

describe("getUsersByEmailsCsv", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  /**
   * Helper: insert an emailSequence and return its ID.
   */
  async function createEmailSequence(
    challengeId: Id<"challenges">,
  ): Promise<Id<"emailSequences">> {
    return t.run(async (ctx: GenericMutationCtx<DataModel>) => {
      return ctx.db.insert("emailSequences", {
        challengeId,
        name: "Test Sequence",
        subject: "Test Subject",
        body: "<p>Hello</p>",
        trigger: "manual",
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  }

  /**
   * Helper: mark an email as sent to a user.
   */
  async function markEmailSent(
    emailSequenceId: Id<"emailSequences">,
    userId: Id<"users">,
    challengeId: Id<"challenges">,
  ): Promise<void> {
    await t.run(async (ctx: GenericMutationCtx<DataModel>) => {
      await ctx.db.insert("emailSends", {
        emailSequenceId,
        userId,
        challengeId,
        status: "sent",
        sentAt: Date.now(),
        createdAt: Date.now(),
      });
    });
  }

  it("returns empty results for an empty email list", async () => {
    const creatorId = await createTestUser(t);
    const challengeId = await createTestChallenge(t, creatorId);
    const emailSequenceId = await createEmailSequence(
      challengeId as Id<"challenges">,
    );

    const result = await t.query(
      api.queries.emailSequences.getUsersByEmailsCsv,
      { emailSequenceId, emails: [] },
    );

    expect(result.matched).toHaveLength(0);
    expect(result.notFound).toHaveLength(0);
  });

  it("returns matched users with alreadySent false when not sent", async () => {
    const creatorId = await createTestUser(t, {
      email: "creator@example.com",
      username: "creator",
    });
    const userId = await createTestUser(t, {
      email: "alice@example.com",
      username: "alice",
      name: "Alice",
    });
    const challengeId = await createTestChallenge(
      t,
      creatorId as string,
    );
    const emailSequenceId = await createEmailSequence(
      challengeId as Id<"challenges">,
    );

    const result = await t.query(
      api.queries.emailSequences.getUsersByEmailsCsv,
      {
        emailSequenceId,
        emails: ["alice@example.com"],
      },
    );

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].email).toBe("alice@example.com");
    expect(result.matched[0].username).toBe("alice");
    expect(result.matched[0].alreadySent).toBe(false);
    expect(result.notFound).toHaveLength(0);
  });

  it("marks alreadySent true for users who received the email", async () => {
    const creatorId = await createTestUser(t, {
      email: "creator2@example.com",
      username: "creator2",
    });
    const userId = await createTestUser(t, {
      email: "bob@example.com",
      username: "bob",
    });
    const challengeId = await createTestChallenge(
      t,
      creatorId as string,
    );
    const emailSequenceId = await createEmailSequence(
      challengeId as Id<"challenges">,
    );

    // Mark as sent
    await markEmailSent(
      emailSequenceId,
      userId as Id<"users">,
      challengeId as Id<"challenges">,
    );

    const result = await t.query(
      api.queries.emailSequences.getUsersByEmailsCsv,
      {
        emailSequenceId,
        emails: ["bob@example.com"],
      },
    );

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].email).toBe("bob@example.com");
    expect(result.matched[0].alreadySent).toBe(true);
  });

  it("puts emails with no matching account in notFound", async () => {
    const creatorId = await createTestUser(t, {
      email: "creator3@example.com",
      username: "creator3",
    });
    const challengeId = await createTestChallenge(
      t,
      creatorId as string,
    );
    const emailSequenceId = await createEmailSequence(
      challengeId as Id<"challenges">,
    );

    const result = await t.query(
      api.queries.emailSequences.getUsersByEmailsCsv,
      {
        emailSequenceId,
        emails: ["nobody@example.com", "ghost@example.com"],
      },
    );

    expect(result.matched).toHaveLength(0);
    expect(result.notFound).toContain("nobody@example.com");
    expect(result.notFound).toContain("ghost@example.com");
  });

  it("deduplicates input emails (only one result per email)", async () => {
    const creatorId = await createTestUser(t, {
      email: "creator4@example.com",
      username: "creator4",
    });
    const userId = await createTestUser(t, {
      email: "charlie@example.com",
      username: "charlie",
    });
    const challengeId = await createTestChallenge(
      t,
      creatorId as string,
    );
    const emailSequenceId = await createEmailSequence(
      challengeId as Id<"challenges">,
    );

    const result = await t.query(
      api.queries.emailSequences.getUsersByEmailsCsv,
      {
        emailSequenceId,
        emails: [
          "charlie@example.com",
          "charlie@example.com",
          "charlie@example.com",
        ],
      },
    );

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].email).toBe("charlie@example.com");
  });

  it("returns correct split for mixed input (found/not found/already sent)", async () => {
    const creatorId = await createTestUser(t, {
      email: "creator5@example.com",
      username: "creator5",
    });
    const sentUserId = await createTestUser(t, {
      email: "sent@example.com",
      username: "sentuser",
    });
    const unsentUserId = await createTestUser(t, {
      email: "unsent@example.com",
      username: "unsentuser",
    });
    const challengeId = await createTestChallenge(
      t,
      creatorId as string,
    );
    const emailSequenceId = await createEmailSequence(
      challengeId as Id<"challenges">,
    );

    // Mark one user as already sent
    await markEmailSent(
      emailSequenceId,
      sentUserId as Id<"users">,
      challengeId as Id<"challenges">,
    );

    const result = await t.query(
      api.queries.emailSequences.getUsersByEmailsCsv,
      {
        emailSequenceId,
        emails: ["sent@example.com", "unsent@example.com", "nobody@example.com"],
      },
    );

    expect(result.matched).toHaveLength(2);
    expect(result.notFound).toEqual(["nobody@example.com"]);

    const sentResult = result.matched.find((u) => u.email === "sent@example.com");
    const unsentResult = result.matched.find(
      (u) => u.email === "unsent@example.com",
    );

    expect(sentResult?.alreadySent).toBe(true);
    expect(unsentResult?.alreadySent).toBe(false);
  });
});
