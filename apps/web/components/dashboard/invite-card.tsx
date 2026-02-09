"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Copy, Share2, UserPlus } from "lucide-react";

interface InviteCardProps {
  challengeId: string;
}

export function InviteCard({ challengeId }: InviteCardProps) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const existingCode = useQuery(api.queries.challengeInvites.getMyInviteCode, {
    challengeId: challengeId as Id<"challenges">,
  });

  const generateCode = useMutation(
    api.mutations.challengeInvites.getOrCreateInviteCode
  );

  const [inviteCode, setInviteCode] = useState<string | null>(null);

  // Use existing code from query, or the one we just generated
  const code = inviteCode ?? existingCode;

  const inviteUrl = code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/challenges/${challengeId}/invite/${code}`
    : null;

  const handleGenerateCode = async () => {
    try {
      setGenerating(true);
      const result = await generateCode({
        challengeId: challengeId as Id<"challenges">,
      });
      setInviteCode(result);
    } catch (error) {
      console.error("Failed to generate invite code", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      console.error("Failed to copy to clipboard");
    }
  };

  const handleShare = async () => {
    if (!inviteUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join my fitness challenge!",
          url: inviteUrl,
        });
      } else {
        await handleCopy();
      }
    } catch (error) {
      // User cancelled share or it failed - that's ok
      if ((error as Error)?.name !== "AbortError") {
        console.error("Share failed", error);
      }
    }
  };

  return (
    <Card className="border-indigo-500/30 bg-indigo-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-indigo-400" />
          <CardTitle className="text-base">Invite friends</CardTitle>
        </div>
        <CardDescription>
          Share your personal link to invite friends to this challenge.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {code ? (
          <div className="flex gap-2">
            <div className="flex-1 truncate rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-muted-foreground">
              {inviteUrl}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              title="Copy link"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleShare}
              title="Share link"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleGenerateCode}
            disabled={generating}
            variant="secondary"
            className="w-full"
          >
            {generating ? "Generating..." : "Get your invite link"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
