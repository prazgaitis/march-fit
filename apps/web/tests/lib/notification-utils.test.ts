import { describe, expect, it } from "vitest";

import {
  getNotificationMessage,
  getNotificationLink,
  type Notification,
} from "@/app/challenges/[id]/(dashboard)/notifications/notifications-list";

function makeNotification(
  overrides: Partial<Notification> & { type: string },
): Notification {
  return {
    id: "notif-1",
    createdAt: Date.now(),
    actor: {
      id: "actor-1",
      name: "Alice",
      username: "alice",
      avatarUrl: null,
    },
    ...overrides,
  };
}

// ─── getNotificationMessage ──────────────────────────────────────────────

describe("getNotificationMessage", () => {
  it("returns correct message for like", () => {
    const n = makeNotification({ type: "like" });
    expect(getNotificationMessage(n)).toBe("Alice liked your activity");
  });

  it("returns correct message for comment_like", () => {
    const n = makeNotification({ type: "comment_like" });
    expect(getNotificationMessage(n)).toBe("Alice liked your comment");
  });

  it("returns correct message for comment", () => {
    const n = makeNotification({ type: "comment" });
    expect(getNotificationMessage(n)).toBe("Alice commented on your activity");
  });

  it("returns correct message for new_follower", () => {
    const n = makeNotification({ type: "new_follower" });
    expect(getNotificationMessage(n)).toBe("Alice started following you");
  });

  it("returns correct message for join", () => {
    const n = makeNotification({ type: "join" });
    expect(getNotificationMessage(n)).toBe("Alice joined the challenge");
  });

  it("returns correct message for invite_accepted", () => {
    const n = makeNotification({ type: "invite_accepted" });
    expect(getNotificationMessage(n)).toBe(
      "Alice joined the challenge with your invite link",
    );
  });

  it("returns correct message for admin_comment", () => {
    const n = makeNotification({ type: "admin_comment" });
    expect(getNotificationMessage(n)).toBe(
      "An admin left a comment on your activity",
    );
  });

  it("returns correct message for admin_edit", () => {
    const n = makeNotification({ type: "admin_edit" });
    expect(getNotificationMessage(n)).toBe("An admin updated your activity");
  });

  it("returns correct message for feedback_response with title and fixed event", () => {
    const n = makeNotification({
      type: "feedback_response",
      data: { title: "Bug report", event: "fixed" },
    });
    expect(getNotificationMessage(n)).toBe(
      'Alice marked "Bug report" as fixed',
    );
  });

  it("returns correct message for feedback_response reply", () => {
    const n = makeNotification({
      type: "feedback_response",
      data: { title: "Feature request" },
    });
    expect(getNotificationMessage(n)).toBe(
      'Alice replied to "Feature request"',
    );
  });

  it("falls back to username when name is null", () => {
    const n = makeNotification({
      type: "like",
      actor: { id: "a1", name: null, username: "bob", avatarUrl: null },
    });
    expect(getNotificationMessage(n)).toBe("bob liked your activity");
  });

  it("returns generic message for unknown type", () => {
    const n = makeNotification({ type: "unknown_type" });
    expect(getNotificationMessage(n)).toBe("Alice interacted with you");
  });
});

// ─── getNotificationLink ─────────────────────────────────────────────────

describe("getNotificationLink", () => {
  const challengeId = "challenge-1";

  it("routes feedback_response to feedback page", () => {
    const n = makeNotification({
      type: "feedback_response",
      data: { challengeId: "c2" },
    });
    expect(getNotificationLink(n, challengeId)).toBe("/challenges/c2/feedback");
  });

  it("routes feedback_response to current challenge if no challengeId in data", () => {
    const n = makeNotification({ type: "feedback_response" });
    expect(getNotificationLink(n, challengeId)).toBe(
      "/challenges/challenge-1/feedback",
    );
  });

  it("routes forum_mention to forum post", () => {
    const n = makeNotification({
      type: "forum_mention",
      data: { postId: "post-1", challengeId: "c3" },
    });
    expect(getNotificationLink(n, challengeId)).toBe(
      "/challenges/c3/forum/post-1",
    );
  });

  it("routes invite_accepted to actor profile", () => {
    const n = makeNotification({
      type: "invite_accepted",
      data: { challengeId: "c4" },
    });
    expect(getNotificationLink(n, challengeId)).toBe(
      "/challenges/c4/users/actor-1",
    );
  });

  it("routes join to actor profile", () => {
    const n = makeNotification({ type: "join", data: {} });
    expect(getNotificationLink(n, challengeId)).toBe(
      "/challenges/challenge-1/users/actor-1",
    );
  });

  it("routes comment_like to activity page with commentId query param", () => {
    const n = makeNotification({
      type: "comment_like",
      data: { activityId: "act-1", commentId: "comm-1" },
    });
    expect(getNotificationLink(n, challengeId)).toBe(
      "/challenges/challenge-1/activities/act-1?commentId=comm-1",
    );
  });

  it("routes comment_like to activity page without commentId when missing", () => {
    const n = makeNotification({
      type: "comment_like",
      data: { activityId: "act-1" },
    });
    expect(getNotificationLink(n, challengeId)).toBe(
      "/challenges/challenge-1/activities/act-1",
    );
  });

  it("routes comment_like without activityId to actor profile", () => {
    const n = makeNotification({
      type: "comment_like",
      data: { commentId: "comm-1" },
    });
    expect(getNotificationLink(n, challengeId)).toBe(
      "/challenges/challenge-1/users/actor-1",
    );
  });

  it("routes like with activityId to activity page", () => {
    const n = makeNotification({
      type: "like",
      data: { activityId: "act-2" },
    });
    expect(getNotificationLink(n, challengeId)).toBe(
      "/challenges/challenge-1/activities/act-2",
    );
  });

  it("routes comment with activityId to activity page", () => {
    const n = makeNotification({
      type: "comment",
      data: { activityId: "act-3" },
    });
    expect(getNotificationLink(n, challengeId)).toBe(
      "/challenges/challenge-1/activities/act-3",
    );
  });

  it("falls back to actor profile when no activityId", () => {
    const n = makeNotification({ type: "like" });
    expect(getNotificationLink(n, challengeId)).toBe(
      "/challenges/challenge-1/users/actor-1",
    );
  });
});
