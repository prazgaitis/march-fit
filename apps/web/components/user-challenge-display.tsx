'use client';

import Link from 'next/link';
import { Flame, MapPin } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PointsDisplay } from '@/components/ui/points-display';
import { cn } from '@/lib/utils';

export interface UserChallengeUser {
  id: string;
  name: string | null;
  username: string;
  avatarUrl: string | null;
  location?: string | null;
}

export interface UserChallengeDisplayProps {
  user: UserChallengeUser;
  /** Challenge ID for profile linking */
  challengeId?: string;
  /** When true, never render a Link */
  disableLink?: boolean;
  /** Control what info is visible */
  show?: {
    name?: boolean;
    username?: boolean;
    location?: boolean;
    points?: boolean;
    streak?: boolean;
  };
  /** Points value (required when show.points is true) */
  points?: number;
  /** Streak value (required when show.streak is true) */
  streak?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Highlight this row (e.g. for current user) */
  highlight?: boolean;
  /** Additional content rendered after the user info (e.g. timestamp) */
  suffix?: React.ReactNode;
  /** Additional content rendered below name line */
  children?: React.ReactNode;
  /** Custom class for root container */
  className?: string;
}

const avatarSizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const nameSizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

function getInitials(name: string | null, username: string): string {
  return (name || username).slice(0, 2).toUpperCase();
}

function getDisplayName(name: string | null, username: string): string {
  return name ?? username;
}

export function UserChallengeDisplay({
  user,
  challengeId,
  disableLink = false,
  show = {},
  points,
  streak,
  size = 'md',
  highlight = false,
  suffix,
  children,
  className,
}: UserChallengeDisplayProps) {
  const {
    name: showName = true,
    username: showUsername = true,
    location: showLocation = false,
    points: showPoints = false,
    streak: showStreak = false,
  } = show;

  const profileUrl =
    !disableLink && challengeId
      ? `/challenges/${challengeId}/users/${user.id}`
      : undefined;

  const avatarElement = (
    <Avatar
      className={cn(
        avatarSizeClasses[size],
        profileUrl && 'transition-opacity hover:opacity-80',
      )}
    >
      <AvatarImage
        src={user.avatarUrl ?? undefined}
        alt={getDisplayName(user.name, user.username)}
      />
      <AvatarFallback>{getInitials(user.name, user.username)}</AvatarFallback>
    </Avatar>
  );

  const LinkedAvatar = profileUrl ? (
    <Link href={profileUrl} className="shrink-0">
      {avatarElement}
    </Link>
  ) : (
    <div className="shrink-0">{avatarElement}</div>
  );

  const nameElement = showName ? (
    profileUrl ? (
      <Link
        href={profileUrl}
        className={cn(
          'font-semibold hover:underline truncate',
          nameSizeClasses[size],
        )}
      >
        {getDisplayName(user.name, user.username)}
      </Link>
    ) : (
      <span
        className={cn('font-semibold truncate', nameSizeClasses[size])}
      >
        {getDisplayName(user.name, user.username)}
      </span>
    )
  ) : null;

  const usernameElement = showUsername ? (
    <span className="text-sm text-muted-foreground">@{user.username}</span>
  ) : null;

  const locationElement =
    showLocation && user.location ? (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        {user.location}
      </span>
    ) : null;

  const pointsElement =
    showPoints && points !== undefined ? (
      <div className="text-right shrink-0">
        <PointsDisplay
          points={points}
          size="lg"
          showSign={false}
          showLabel={false}
          className={cn('font-bold', points >= 0 && 'text-white')}
        />
        <p className="text-xs text-zinc-500">points</p>
      </div>
    ) : null;

  const streakElement =
    showStreak && streak !== undefined && streak > 0 ? (
      <div className="flex items-center gap-1 rounded-full bg-orange-500/20 px-3 py-1 shrink-0">
        <Flame className="h-4 w-4 text-orange-500" />
        <span className="text-sm font-medium text-orange-500">{streak}</span>
      </div>
    ) : null;

  return (
    <div
      className={cn(
        'flex items-center gap-4',
        highlight && 'bg-indigo-500/10 ring-1 ring-indigo-500/30',
        className,
      )}
    >
      {LinkedAvatar}

      <div className="flex-1 min-w-0">
        <div className={nameSizeClasses[size]}>{nameElement}</div>
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          {usernameElement}
          {locationElement}
          {suffix}
        </div>
        {children}
      </div>

      {pointsElement}
      {streakElement}
    </div>
  );
}
