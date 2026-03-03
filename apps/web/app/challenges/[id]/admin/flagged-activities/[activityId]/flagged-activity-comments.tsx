"use client";

import { useQuery } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { Heart } from "lucide-react";
import { useMutation } from "convex/react";

import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";

type CommentEntry = {
  comment: {
    id: string;
    content: string;
    visibility?: string;
    createdAt: string;
  };
  author: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
  likeCount: number;
  likedByMe: boolean;
};

export function FlaggedActivityComments({ activityId }: { activityId: string }) {
  const comments = useQuery(api.queries.comments.getByFlaggedActivity, {
    activityId: activityId as Id<"activities">,
  }) as CommentEntry[] | undefined;

  const toggleLike = useMutation(api.mutations.commentLikes.toggle);

  if (!comments || comments.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium text-muted-foreground">
          Admin Comments
        </h3>
        <p className="text-base text-muted-foreground">
          No admin comments yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">
        Admin Comments
      </h3>
      <div className="space-y-2">
        {comments.map((entry) => (
          <div
            key={entry.comment.id}
            className="rounded-md border p-3 bg-muted/30"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <UserAvatar
                user={entry.author}
                size="sm"
                showName
                disableLink
                className="text-xs"
              />
              <span>
                {formatDistanceToNow(new Date(entry.comment.createdAt), {
                  addSuffix: true,
                })}
              </span>
              {entry.comment.visibility && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {entry.comment.visibility}
                </Badge>
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {entry.comment.content}
            </p>
            <div className="mt-1 flex items-center gap-1">
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() =>
                  toggleLike({
                    commentId: entry.comment.id as Id<"comments">,
                  })
                }
              >
                <Heart
                  className={`h-3 w-3 ${entry.likedByMe ? "fill-red-500 text-red-500" : ""}`}
                />
                {entry.likeCount > 0 && <span>{entry.likeCount}</span>}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
