import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { formatDistanceToNow } from "date-fns";

interface Participant {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  joinedAt: Date;
}

interface ParticipantsListProps {
  challengeId: string;
  participants: Participant[];
}

export function ParticipantsList({ challengeId, participants }: ParticipantsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Participants</CardTitle>
        <p className="text-sm text-muted-foreground">
          {participants.length === 0
            ? "No participants yet"
            : `${participants.length} of many participants`}
        </p>
      </CardHeader>
      <CardContent>
        {participants.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">
              Be the first to join this challenge!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {participants.map((participant) => (
              <UserAvatar
                key={participant.id}
                user={participant}
                challengeId={challengeId}
                size="md"
                showName
                showUsername
                className="p-3 rounded-lg hover:bg-accent transition-colors"
              >
                <p className="text-xs text-muted-foreground/70">
                  Joined {formatDistanceToNow(participant.joinedAt)} ago
                </p>
              </UserAvatar>
            ))}

            {participants.length >= 10 && (
              <div className="text-center pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  + many more participants
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}