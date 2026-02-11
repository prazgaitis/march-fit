import Link from "next/link";
import type { Doc } from "@repo/backend/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play } from "lucide-react";
interface Challenge {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  welcomeVideoUrl?: string;
  welcomeMessage?: string;
}

interface ChallengeDetailsProps {
  challenge: Challenge;
  activityTypes: Doc<"activityTypes">[];
}

// Extract video embed URL from various formats
function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;

  // Handle various YouTube URL formats
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Just the video ID
  ];

  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
  }

  // If it's already an embed URL, return as-is
  if (url.includes("youtube.com/embed/")) {
    return url;
  }

  // For Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return null;
}

function formatScoringSummary(config: Record<string, unknown>): string {
  const type = config["type"] as string | undefined;
  const basePoints = Number(config["basePoints"] ?? 0);
  const unit = config["unit"] as string | undefined;
  const pointsPerUnit = Number(config["pointsPerUnit"] ?? 1);

  if (type === "tiered") return "Tiered scoring";
  if (type === "completion") return `${basePoints || 1} pts per completion`;
  if (type === "variable") return "Variable scoring";

  if (unit) {
    const unitLabel = unit.replace("_", " ");
    if (basePoints > 0) {
      return `${basePoints} base + ${pointsPerUnit} pts/${unitLabel}`;
    }
    return `${pointsPerUnit} pts/${unitLabel}`;
  }

  if (basePoints > 0) return `${basePoints} pts`;

  return "Points vary";
}

export function ChallengeDetails({ challenge, activityTypes }: ChallengeDetailsProps) {
  const videoEmbedUrl = challenge.welcomeVideoUrl
    ? getVideoEmbedUrl(challenge.welcomeVideoUrl)
    : null;

  return (
    <div className="space-y-6">
      {/* Welcome Video */}
      {videoEmbedUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Welcome
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video overflow-hidden rounded-lg bg-black">
              <iframe
                src={videoEmbedUrl}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            {challenge.welcomeMessage && (
              <p className="mt-4 text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {challenge.welcomeMessage}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Welcome Message (without video) */}
      {!videoEmbedUrl && challenge.welcomeMessage && (
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {challenge.welcomeMessage}
            </p>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>How to Participate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Join the Challenge</h4>
                <p className="text-sm text-muted-foreground">
                  Click the &quot;Join Challenge&quot; button to register for this challenge.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Log Your Activities</h4>
                <p className="text-sm text-muted-foreground">
                  Record your workouts manually or connect your fitness apps like Strava or Apple Health.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Earn Points & Compete</h4>
                <p className="text-sm text-muted-foreground">
                  Activities earn you points based on duration, distance, and type. Compete on the leaderboard!
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Types & Scoring</CardTitle>
        </CardHeader>
        <CardContent>
          {activityTypes.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No activity types configured yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activityTypes.slice(0, 6).map((activityType) => (
                <div
                  key={activityType._id}
                  className="flex justify-between items-center py-2 border-b border-border"
                >
                  <div className="min-w-0 pr-4">
                    <p className="text-sm font-medium text-foreground truncate">
                      {activityType.name}
                    </p>
                    {activityType.contributesToStreak && (
                      <p className="text-xs text-muted-foreground">Counts toward streak</p>
                    )}
                  </div>
                  <Badge variant="secondary">
                    {formatScoringSummary((activityType.scoringConfig as Record<string, unknown>) ?? {})}
                  </Badge>
                </div>
              ))}
              {activityTypes.length > 6 && (
                <div className="pt-2">
                  <Link
                    className="text-sm font-medium text-primary hover:underline"
                    href={`/challenges/${activityTypes[0].challengeId}/activity-types`}
                  >
                    View all activity types
                  </Link>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
