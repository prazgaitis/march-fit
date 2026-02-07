"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, UserPlus, Trophy, Bell } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

interface Notification {
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
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "like":
      return <Heart className="h-4 w-4 text-pink-500" />;
    case "comment":
      return <MessageCircle className="h-4 w-4 text-blue-500" />;
    case "follow":
    case "join":
      return <UserPlus className="h-4 w-4 text-green-500" />;
    case "achievement":
    case "streak":
      return <Trophy className="h-4 w-4 text-amber-500" />;
    default:
      return <Bell className="h-4 w-4 text-zinc-400" />;
  }
}

function getNotificationMessage(notification: Notification) {
  const actorName = notification.actor.name || notification.actor.username || "Someone";

  switch (notification.type) {
    case "like":
      return `${actorName} liked your activity`;
    case "comment":
      return `${actorName} commented on your activity`;
    case "mention":
      return `${actorName} mentioned you`;
    case "follow":
      return `${actorName} started following you`;
    case "join":
      return `${actorName} joined the challenge`;
    case "achievement":
      return `${actorName} earned an achievement`;
    case "streak":
      return `${actorName} is on a streak!`;
    default:
      return `${actorName} interacted with you`;
  }
}

function getNotificationLink(notification: Notification, challengeId: string) {
  if (notification.data?.activityId) {
    return `/challenges/${challengeId}/activities/${notification.data.activityId}`;
  }
  if (notification.actor.id) {
    return `/challenges/${challengeId}/users/${notification.actor.id}`;
  }
  return null;
}

export function NotificationsList({ notifications, challengeId }: NotificationsListProps) {
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
              <p className="text-sm text-white">
                {getNotificationMessage(notification)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
              </p>
            </div>
            {!notification.readAt && (
              <div className="h-2 w-2 rounded-full bg-indigo-500" />
            )}
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
