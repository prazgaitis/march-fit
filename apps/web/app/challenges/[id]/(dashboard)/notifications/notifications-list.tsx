"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Heart, MessageCircle, MessageSquare, UserPlus, Trophy, Bell, Shield, Loader2 } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Notification {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  readAt?: number;
  createdAt: number;
  actor: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
}

interface NotificationsListProps {
  notifications: Notification[];
  challengeId: string;
  userId: string;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "like":
    case "comment_like":
      return <Heart className="h-4 w-4 text-pink-500" />;
    case "comment":
      return <MessageCircle className="h-4 w-4 text-blue-500" />;
    case "follow":
    case "new_follower":
    case "join":
    case "invite_accepted":
      return <UserPlus className="h-4 w-4 text-green-500" />;
    case "achievement":
    case "streak":
      return <Trophy className="h-4 w-4 text-amber-500" />;
    case "forum_mention":
      return <MessageSquare className="h-4 w-4 text-indigo-500" />;
    case "admin_comment":
    case "admin_edit":
      return <Shield className="h-4 w-4 text-amber-500" />;
    case "feedback_response":
      return <MessageSquare className="h-4 w-4 text-emerald-500" />;
    default:
      return <Bell className="h-4 w-4 text-zinc-400" />;
  }
}

export function getNotificationMessage(notification: Notification) {
  const actorName = notification.actor.name || notification.actor.username || "Someone";

  switch (notification.type) {
    case "like":
      return `${actorName} liked your activity`;
    case "comment_like":
      return `${actorName} liked your comment`;
    case "comment":
      return `${actorName} commented on your activity`;
    case "mention":
      return `${actorName} mentioned you`;
    case "forum_mention":
      return `${actorName} mentioned you in a forum post`;
    case "follow":
    case "new_follower":
      return `${actorName} started following you`;
    case "join":
      return `${actorName} joined the challenge`;
    case "invite_accepted":
      return `${actorName} joined the challenge with your invite link`;
    case "achievement":
      return `${actorName} earned an achievement`;
    case "streak":
      return `${actorName} is on a streak!`;
    case "admin_comment":
      return "An admin left a comment on your activity";
    case "admin_edit":
      return "An admin updated your activity";
    case "feedback_response": {
      const title = notification.data?.title as string | undefined;
      const event = notification.data?.event as string | undefined;
      const label = title ? `"${title}"` : "your feedback";
      return event === "fixed"
        ? `${actorName} marked ${label} as fixed`
        : `${actorName} replied to ${label}`;
    }
    default:
      return `${actorName} interacted with you`;
  }
}

export function getNotificationLink(notification: Notification, challengeId: string) {
  if (notification.type === "feedback_response") {
    const cId = notification.data?.challengeId ?? challengeId;
    return `/challenges/${cId}/feedback`;
  }
  if (notification.type === "forum_mention" && notification.data?.postId) {
    const cId = notification.data.challengeId ?? challengeId;
    return `/challenges/${cId}/forum/${notification.data.postId}`;
  }
  if (notification.type === "invite_accepted" || notification.type === "join") {
    const cId = notification.data?.challengeId ?? challengeId;
    return `/challenges/${cId}/users/${notification.actor.id}`;
  }
  if (notification.type === "comment_like" && notification.data?.activityId) {
    const commentId = notification.data.commentId as string | undefined;
    const base = `/challenges/${challengeId}/activities/${notification.data.activityId}`;
    return commentId ? `${base}?commentId=${commentId}` : base;
  }
  if (notification.data?.activityId) {
    return `/challenges/${challengeId}/activities/${notification.data.activityId}`;
  }
  if (notification.actor.id) {
    return `/challenges/${challengeId}/users/${notification.actor.id}`;
  }
  return null;
}

function FollowBackButton({ actorId }: { actorId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [didFollow, setDidFollow] = useState(false);
  const toggleFollow = useMutation(api.mutations.follows.toggle);

  if (didFollow) {
    return (
      <span className="text-xs text-zinc-500 whitespace-nowrap">Following</span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-xs shrink-0"
      disabled={isLoading}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsLoading(true);
        try {
          await toggleFollow({ userId: actorId as Id<"users"> });
          setDidFollow(true);
        } catch (error) {
          console.error("Failed to follow back:", error);
        } finally {
          setIsLoading(false);
        }
      }}
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <>
          <UserPlus className="mr-1 h-3 w-3" />
          Follow back
        </>
      )}
    </Button>
  );
}

export function NotificationsList({ notifications, challengeId, userId }: NotificationsListProps) {
  const markAllAsRead = useMutation(api.mutations.notifications.markAllAsRead);
  const markedRef = useRef(false);
  const followingIds = useQuery(api.queries.follows.getFollowingIds);
  const followingSet = new Set(followingIds ?? []);

  useEffect(() => {
    if (markedRef.current) return;
    const hasUnread = notifications.some((n) => !n.readAt);
    if (hasUnread) {
      markedRef.current = true;
      markAllAsRead({ userId: userId as Id<"users"> });
    }
  }, [notifications, markAllAsRead, userId]);

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bell className="mb-4 h-12 w-12 text-zinc-600" />
        <h3 className="text-lg font-medium text-zinc-300">No notifications yet</h3>
        <p className="mt-1 text-sm text-zinc-500">
          When someone interacts with your activities, you&apos;ll see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {notifications.map((notification) => {
        const link = getNotificationLink(notification, challengeId);
        const isFollowNotification =
          notification.type === "follow" || notification.type === "new_follower";
        const showFollowBack =
          isFollowNotification && !followingSet.has(notification.actor.id);

        const content = (
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl p-4 transition",
              notification.readAt
                ? "bg-transparent hover:bg-zinc-900"
                : "bg-zinc-900/50 hover:bg-zinc-800/50"
            )}
          >
            <div className="relative">
              <UserAvatar
                user={{
                  id: notification.actor.id,
                  name: notification.actor.name,
                  username: notification.actor.username,
                  avatarUrl: notification.actor.avatarUrl,
                }}
                challengeId={challengeId}
                size="md"
              />
              <div className="absolute -bottom-1 -right-1 rounded-full bg-zinc-900 p-1">
                {getNotificationIcon(notification.type)}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-white">
                  {getNotificationMessage(notification)}
                </p>
                {!showFollowBack && !notification.readAt && (
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
              </p>
              {showFollowBack && (
                <div className="mt-2">
                  <FollowBackButton actorId={notification.actor.id} />
                </div>
              )}
            </div>
          </div>
        );

        if (link) {
          return (
            <Link key={notification.id} href={link}>
              {content}
            </Link>
          );
        }

        return <div key={notification.id}>{content}</div>;
      })}
    </div>
  );
}
