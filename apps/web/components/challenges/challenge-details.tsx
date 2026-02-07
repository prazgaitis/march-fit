import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Play } from "lucide-react";

interface Challenge {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  durationDays: number;
  streakMinPoints: number;
  welcomeVideoUrl?: string;
  welcomeMessage?: string;
}

interface ChallengeDetailsProps {
  challenge: Challenge;
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

export function ChallengeDetails({ challenge }: ChallengeDetailsProps) {
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
          <CardTitle>About This Challenge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">{challenge.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-foreground mb-2">Challenge Period</h4>
              <p className="text-sm text-muted-foreground">
                {format(challenge.startDate, "MMMM d, yyyy")} - {format(challenge.endDate, "MMMM d, yyyy")}
              </p>
              <p className="text-sm text-muted-foreground/70">{challenge.durationDays} days total</p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">Daily Goal</h4>
              <p className="text-sm text-muted-foreground">
                Minimum {challenge.streakMinPoints} points per day
              </p>
              <p className="text-sm text-muted-foreground/70">to maintain your streak</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm font-medium text-foreground">Outdoor Running</span>
              <Badge variant="secondary">7.5 pts/mile</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm font-medium text-foreground">Outdoor Cycling</span>
              <Badge variant="secondary">1.8 pts/mile</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm font-medium text-foreground">High Intensity Cardio</span>
              <Badge variant="secondary">0.9 pts/min</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm font-medium text-foreground">Low Intensity Cardio</span>
              <Badge variant="secondary">0.6 pts/min</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm font-medium text-foreground">Rowing</span>
              <Badge variant="secondary">5.5 pts/km</Badge>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-foreground">Yoga / Stretching</span>
              <Badge variant="secondary">0.4 pts/min</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}