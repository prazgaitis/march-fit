import { describe, it, expect, beforeEach } from "vitest";
import { api } from "@repo/backend";
import {
  createTestContext,
  createTestUser,
  createTestChallenge,
} from "../helpers/convex";

describe("Forum Posts", () => {
  let t: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    t = createTestContext();
  });

  // Helper to set up a challenge with a participant
  async function setupChallengeWithParticipant(overrides?: {
    userEmail?: string;
    userRole?: "user" | "admin";
  }) {
    const email = overrides?.userEmail ?? "test@example.com";
    const userId = await createTestUser(t, {
      email,
      role: overrides?.userRole ?? "user",
    });
    const tWithAuth = t.withIdentity({ subject: "test-user", email });
    const challengeId = await createTestChallenge(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.insert("userChallenges", {
        userId,
        challengeId,
        joinedAt: Date.now(),
        totalPoints: 0,
        currentStreak: 0,
        modifierFactor: 1,
        paymentStatus: "paid",
        updatedAt: Date.now(),
      });
    });

    return { userId, challengeId, tWithAuth, email };
  }

  describe("create mutation", () => {
    it("should create a top-level forum post", async () => {
      const { challengeId, tWithAuth, userId } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Hello World",
          content: "This is my first forum post!",
        }
      );

      expect(postId).toBeDefined();

      // Verify post in DB
      const post = await t.run(async (ctx) => {
        return await ctx.db.get(postId);
      });

      expect(post).not.toBeNull();
      expect(post!.title).toBe("Hello World");
      expect(post!.content).toBe("This is my first forum post!");
      expect(post!.userId).toBe(userId);
      expect(post!.challengeId).toBe(challengeId);
      expect(post!.isPinned).toBe(false);
      expect(post!.parentPostId).toBeUndefined();
      expect(post!.deletedAt).toBeUndefined();
    });

    it("should create a reply to an existing post", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const parentId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Parent Post",
          content: "Original question",
        }
      );

      const replyId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          content: "This is a reply!",
          parentPostId: parentId,
        }
      );

      const reply = await t.run(async (ctx) => {
        return await ctx.db.get(replyId);
      });

      expect(reply!.parentPostId).toBe(parentId);
      expect(reply!.title).toBeUndefined();
    });

    it("should reject empty content", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      await expect(
        tWithAuth.mutation(api.mutations.forumPosts.create, {
          challengeId,
          title: "Title",
          content: "   ",
        })
      ).rejects.toThrow("Post content cannot be empty");
    });

    it("should require a title for top-level posts", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      await expect(
        tWithAuth.mutation(api.mutations.forumPosts.create, {
          challengeId,
          content: "Content without title",
        })
      ).rejects.toThrow("Top-level posts require a title");
    });

    it("should reject non-participants", async () => {
      // Create challenge with one user
      const creatorEmail = "creator@example.com";
      const creatorId = await createTestUser(t, {
        email: creatorEmail,
        username: "creator",
      });
      const challengeId = await createTestChallenge(t, creatorId);

      // Create a second user who is NOT a participant
      const otherEmail = "other@example.com";
      await createTestUser(t, {
        email: otherEmail,
        username: "other",
      });
      const otherAuth = t.withIdentity({
        subject: "other-user",
        email: otherEmail,
      });

      await expect(
        otherAuth.mutation(api.mutations.forumPosts.create, {
          challengeId,
          title: "Should Fail",
          content: "I'm not a participant",
        })
      ).rejects.toThrow("Must be a challenge participant to post");
    });

    it("should reject unauthenticated users", async () => {
      const creatorEmail = "creator@example.com";
      const creatorId = await createTestUser(t, { email: creatorEmail });
      const challengeId = await createTestChallenge(t, creatorId);

      await expect(
        t.mutation(api.mutations.forumPosts.create, {
          challengeId,
          title: "No Auth",
          content: "Should fail",
        })
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("update mutation", () => {
    it("should allow the author to update their post", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Original Title",
          content: "Original content",
        }
      );

      await tWithAuth.mutation(api.mutations.forumPosts.update, {
        postId,
        title: "Updated Title",
        content: "Updated content",
      });

      const updated = await t.run(async (ctx) => {
        return await ctx.db.get(postId);
      });

      expect(updated!.title).toBe("Updated Title");
      expect(updated!.content).toBe("Updated content");
    });

    it("should reject updates from non-authors/non-admins", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Original",
          content: "Content",
        }
      );

      // Create a second user
      const otherEmail = "other@example.com";
      const otherUserId = await createTestUser(t, {
        email: otherEmail,
        username: "other",
      });
      const otherAuth = t.withIdentity({
        subject: "other-user",
        email: otherEmail,
      });

      // Add other user as participant
      await t.run(async (ctx) => {
        await ctx.db.insert("userChallenges", {
          userId: otherUserId,
          challengeId,
          joinedAt: Date.now(),
          totalPoints: 0,
          currentStreak: 0,
          modifierFactor: 1,
          paymentStatus: "paid",
          updatedAt: Date.now(),
        });
      });

      await expect(
        otherAuth.mutation(api.mutations.forumPosts.update, {
          postId,
          content: "Hacked!",
        })
      ).rejects.toThrow("Not authorized to edit this post");
    });
  });

  describe("remove mutation", () => {
    it("should soft-delete a post", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "To Delete",
          content: "This will be deleted",
        }
      );

      await tWithAuth.mutation(api.mutations.forumPosts.remove, { postId });

      const deleted = await t.run(async (ctx) => {
        return await ctx.db.get(postId);
      });

      expect(deleted!.deletedAt).toBeDefined();
      expect(deleted!.deletedAt).toBeGreaterThan(0);
    });

    it("should allow admins to delete any post", async () => {
      // Create challenge and post by regular user
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "User Post",
          content: "Regular user post",
        }
      );

      // Create admin user
      const adminEmail = "admin@example.com";
      const adminId = await createTestUser(t, {
        email: adminEmail,
        username: "admin",
        role: "admin",
      });
      const adminAuth = t.withIdentity({
        subject: "admin-user",
        email: adminEmail,
      });

      await adminAuth.mutation(api.mutations.forumPosts.remove, { postId });

      const deleted = await t.run(async (ctx) => {
        return await ctx.db.get(postId);
      });

      expect(deleted!.deletedAt).toBeDefined();
    });

    it("should reject deletion by non-authors/non-admins", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Protected",
          content: "Cannot be deleted by others",
        }
      );

      const otherEmail = "other@example.com";
      const otherUserId = await createTestUser(t, {
        email: otherEmail,
        username: "other",
      });
      const otherAuth = t.withIdentity({
        subject: "other-user",
        email: otherEmail,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("userChallenges", {
          userId: otherUserId,
          challengeId,
          joinedAt: Date.now(),
          totalPoints: 0,
          currentStreak: 0,
          modifierFactor: 1,
          paymentStatus: "paid",
          updatedAt: Date.now(),
        });
      });

      await expect(
        otherAuth.mutation(api.mutations.forumPosts.remove, { postId })
      ).rejects.toThrow("Not authorized to delete this post");
    });
  });

  describe("toggleUpvote mutation", () => {
    it("should allow the author to upvote their own post", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Upvotable",
          content: "Upvote me!",
        }
      );

      const result = await tWithAuth.mutation(
        api.mutations.forumPosts.toggleUpvote,
        { postId }
      );

      expect(result.upvoted).toBe(true);

      // Verify in DB
      const upvotes = await t.run(async (ctx) => {
        return await ctx.db
          .query("forumPostUpvotes")
          .withIndex("postId", (q) => q.eq("postId", postId))
          .collect();
      });

      expect(upvotes).toHaveLength(1);
    });

    it("should remove upvote on second toggle", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Toggle Test",
          content: "Toggle upvote",
        }
      );

      // Upvote
      await tWithAuth.mutation(api.mutations.forumPosts.toggleUpvote, {
        postId,
      });
      // Un-upvote
      const result = await tWithAuth.mutation(
        api.mutations.forumPosts.toggleUpvote,
        { postId }
      );

      expect(result.upvoted).toBe(false);

      const upvotes = await t.run(async (ctx) => {
        return await ctx.db
          .query("forumPostUpvotes")
          .withIndex("postId", (q) => q.eq("postId", postId))
          .collect();
      });

      expect(upvotes).toHaveLength(0);
    });

    it("should reject upvoting a deleted post", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Deleted",
          content: "Will be deleted",
        }
      );

      await tWithAuth.mutation(api.mutations.forumPosts.remove, { postId });

      await expect(
        tWithAuth.mutation(api.mutations.forumPosts.toggleUpvote, { postId })
      ).rejects.toThrow("Post not found");
    });
  });

  describe("togglePin mutation", () => {
    it("should allow challenge creator to pin a post", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Pin Me",
          content: "Important post",
        }
      );

      // The creator of the challenge should be able to pin
      const result = await tWithAuth.mutation(
        api.mutations.forumPosts.togglePin,
        { postId }
      );

      expect(result.isPinned).toBe(true);

      const post = await t.run(async (ctx) => {
        return await ctx.db.get(postId);
      });

      expect(post!.isPinned).toBe(true);
    });

    it("should allow global admins to pin posts", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Admin Pin",
          content: "Admin will pin this",
        }
      );

      // Create global admin
      const adminEmail = "admin@example.com";
      await createTestUser(t, {
        email: adminEmail,
        username: "admin",
        role: "admin",
      });
      const adminAuth = t.withIdentity({
        subject: "admin-user",
        email: adminEmail,
      });

      const result = await adminAuth.mutation(
        api.mutations.forumPosts.togglePin,
        { postId }
      );

      expect(result.isPinned).toBe(true);
    });

    it("should unpin a pinned post", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Toggle Pin",
          content: "Pin and unpin",
        }
      );

      // Pin
      await tWithAuth.mutation(api.mutations.forumPosts.togglePin, {
        postId,
      });
      // Unpin
      const result = await tWithAuth.mutation(
        api.mutations.forumPosts.togglePin,
        { postId }
      );

      expect(result.isPinned).toBe(false);
    });

    it("should reject pinning by non-admins", async () => {
      // Create challenge by one user
      const creatorEmail = "creator@example.com";
      const creatorId = await createTestUser(t, {
        email: creatorEmail,
        username: "creator",
      });
      const creatorAuth = t.withIdentity({
        subject: "creator",
        email: creatorEmail,
      });
      const challengeId = await createTestChallenge(t, creatorId);

      // Add creator as participant
      await t.run(async (ctx) => {
        await ctx.db.insert("userChallenges", {
          userId: creatorId,
          challengeId,
          joinedAt: Date.now(),
          totalPoints: 0,
          currentStreak: 0,
          modifierFactor: 1,
          paymentStatus: "paid",
          updatedAt: Date.now(),
        });
      });

      const postId = await creatorAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Creator Post",
          content: "Content",
        }
      );

      // Create regular participant
      const regularEmail = "regular@example.com";
      const regularId = await createTestUser(t, {
        email: regularEmail,
        username: "regular",
      });
      const regularAuth = t.withIdentity({
        subject: "regular",
        email: regularEmail,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("userChallenges", {
          userId: regularId,
          challengeId,
          joinedAt: Date.now(),
          totalPoints: 0,
          currentStreak: 0,
          modifierFactor: 1,
          paymentStatus: "paid",
          updatedAt: Date.now(),
        });
      });

      await expect(
        regularAuth.mutation(api.mutations.forumPosts.togglePin, { postId })
      ).rejects.toThrow("Only admins can pin posts");
    });

    it("should reject pinning a reply", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const parentId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Parent",
          content: "Parent content",
        }
      );

      const replyId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          content: "Reply content",
          parentPostId: parentId,
        }
      );

      await expect(
        tWithAuth.mutation(api.mutations.forumPosts.togglePin, {
          postId: replyId,
        })
      ).rejects.toThrow("Only top-level posts can be pinned");
    });
  });

  describe("queries", () => {
    it("should list posts with pinned first", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      // Create several posts
      const postA = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Post A",
          content: "First post",
        }
      );

      const postB = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Post B",
          content: "Second post",
        }
      );

      const postC = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Post C",
          content: "Third post - will be pinned",
        }
      );

      // Pin post A (the oldest)
      await tWithAuth.mutation(api.mutations.forumPosts.togglePin, {
        postId: postA,
      });

      const result = await tWithAuth.query(
        api.queries.forumPosts.listByChallenge,
        {
          challengeId,
          paginationOpts: { numItems: 10, cursor: null },
        }
      );

      expect(result.page).toHaveLength(3);
      // Pinned post should be first
      expect(result.page[0].post._id).toBe(postA);
      expect(result.page[0].post.isPinned).toBe(true);
    });

    it("should not show deleted posts in listing", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Deleted Post",
          content: "Will be deleted",
        }
      );

      await tWithAuth.mutation(api.mutations.forumPosts.remove, {
        postId,
      });

      const result = await tWithAuth.query(
        api.queries.forumPosts.listByChallenge,
        {
          challengeId,
          paginationOpts: { numItems: 10, cursor: null },
        }
      );

      expect(result.page).toHaveLength(0);
    });

    it("should return post details with replies", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Main Post",
          content: "The question",
        }
      );

      await tWithAuth.mutation(api.mutations.forumPosts.create, {
        challengeId,
        content: "Reply 1",
        parentPostId: postId,
      });

      await tWithAuth.mutation(api.mutations.forumPosts.create, {
        challengeId,
        content: "Reply 2",
        parentPostId: postId,
      });

      const result = await tWithAuth.query(
        api.queries.forumPosts.getById,
        { postId }
      );

      expect(result).not.toBeNull();
      expect(result!.post.title).toBe("Main Post");
      expect(result!.replies).toHaveLength(2);
      expect(result!.replies[0].post.content).toBe("Reply 1");
      expect(result!.replies[1].post.content).toBe("Reply 2");
    });

    it("should show upvote count and user upvote status", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Upvote Test",
          content: "Check upvotes",
        }
      );

      // Before upvoting
      let result = await tWithAuth.query(api.queries.forumPosts.getById, {
        postId,
      });
      expect(result!.upvoteCount).toBe(0);
      expect(result!.upvotedByUser).toBe(false);

      // After upvoting
      await tWithAuth.mutation(api.mutations.forumPosts.toggleUpvote, {
        postId,
      });

      result = await tWithAuth.query(api.queries.forumPosts.getById, {
        postId,
      });
      expect(result!.upvoteCount).toBe(1);
      expect(result!.upvotedByUser).toBe(true);
    });

    it("should correctly report isAdmin and isAuthor", async () => {
      const { challengeId, tWithAuth } =
        await setupChallengeWithParticipant();

      const postId = await tWithAuth.mutation(
        api.mutations.forumPosts.create,
        {
          challengeId,
          title: "Auth Test",
          content: "Check auth flags",
        }
      );

      // The challenge creator (who is also the author) checks
      const result = await tWithAuth.query(
        api.queries.forumPosts.getById,
        { postId }
      );

      // Creator of challenge = admin
      expect(result!.isAdmin).toBe(true);
      expect(result!.isAuthor).toBe(true);
    });
  });
});
