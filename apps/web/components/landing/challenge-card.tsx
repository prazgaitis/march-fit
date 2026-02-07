import Link from "next/link";
import { Calendar, Users, Clock } from "lucide-react";
import { formatDistanceToNow, isBefore } from "date-fns";

interface ChallengeCardProps {
  challenge: {
    id: string;
    name: string;
    description: string | null;
    startDate: Date;
    endDate: Date;
    durationDays: number;
    participantCount: number;
  };
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const now = new Date();
  const isUpcoming = isBefore(now, challenge.startDate);
  const isActive = !isUpcoming && isBefore(now, challenge.endDate);

  const getStatusInfo = () => {
    if (isUpcoming) {
      return {
        label: "Starts in",
        value: formatDistanceToNow(challenge.startDate),
        className: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
      };
    }
    if (isActive) {
      return {
        label: "Ends in",
        value: formatDistanceToNow(challenge.endDate),
        className: "bg-green-500/20 text-green-600 dark:text-green-400",
      };
    }
    return {
      label: "Completed",
      value: formatDistanceToNow(challenge.endDate) + " ago",
      className: "bg-muted text-muted-foreground",
    };
  };

  const status = getStatusInfo();

  return (
    <Link href={`/challenges/${challenge.id}`}>
      <div className="bg-card rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden group cursor-pointer">
        {/* Header with gradient background */}
        <div className="h-32 bg-gradient-to-r from-primary to-primary/80 relative">
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute top-4 left-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${status.className}`}>
              {status.label}: {status.value}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="text-xl font-bold text-card-foreground mb-2 group-hover:text-primary transition-colors">
            {challenge.name}
          </h3>

          {challenge.description && (
            <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
              {challenge.description}
            </p>
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                <span>{challenge.participantCount} participants</span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span>{challenge.durationDays} days</span>
              </div>
            </div>

            <div className="flex items-center text-xs">
              <Calendar className="w-4 h-4 mr-1" />
              {new Date(challenge.startDate).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}