'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Crown,
  Flame,
  Heart,
  Medal,
  Shield,
  Star,
  Trophy,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getOptimizedMediaUrl } from '@/lib/media-optimizer';

export interface UserAvatarUser {
  id: string;
  name: string | null;
  username: string;
  avatarUrl: string | null;
  location?: string | null;
}

export interface BadgeOverlay {
  name: string;
  imagePublicId: string | null;
  icon: string | null;
}

interface UserAvatarProps {
  user: UserAvatarUser;
  /** Challenge ID - when provided, avatar/name will link to user profile */
  challengeId?: string;
  /** When true, never render a Link (e.g. when inside another link to avoid nested <a>) */
  disableLink?: boolean;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Show name next to avatar */
  showName?: boolean;
  /** Show @username below or next to name */
  showUsername?: boolean;
  /** Additional content to show after name/username */
  children?: React.ReactNode;
  /** Custom class for the container */
  className?: string;
  /** If provided, clicking the avatar calls this instead of navigating */
  onAvatarClick?: () => void;
  /** Show gradient ring around the avatar (Instagram-style) */
  hasStory?: boolean;
  /** Badge to show as overlay on the avatar */
  badge?: BadgeOverlay | null;
}

const sizeClasses = {
  xs: 'h-5 w-5',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-14 w-14',
  '2xl': 'h-24 w-24',
};

const textSizeClasses = {
  xs: 'text-[10px]',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
};

const badgeSizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-5 w-5',
  xl: 'h-6 w-6',
  '2xl': 'h-8 w-8',
};

const badgeIconSizeClasses = {
  xs: 'h-2 w-2',
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-3 w-3',
  xl: 'h-3.5 w-3.5',
  '2xl': 'h-5 w-5',
};

const BADGE_ICON_MAP: Record<string, LucideIcon> = {
  star: Star,
  flame: Flame,
  trophy: Trophy,
  medal: Medal,
  shield: Shield,
  zap: Zap,
  crown: Crown,
  heart: Heart,
};

function BadgeIcon({
  icon,
  className,
}: {
  icon: string | null;
  className?: string;
}) {
  const IconComponent = BADGE_ICON_MAP[icon ?? 'shield'] ?? Shield;
  return <IconComponent className={className} />;
}

function BadgeOverlayElement({
  badge,
  size,
}: {
  badge: BadgeOverlay;
  size: keyof typeof badgeSizeClasses;
}) {
  return (
    <div
      className={cn(
        'absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-background bg-zinc-900',
        badgeSizeClasses[size],
      )}
      title={badge.name}
    >
      {badge.imagePublicId ? (
        <img
          src={getOptimizedMediaUrl(badge.imagePublicId, 'thumbnail')}
          alt={badge.name}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <BadgeIcon
          icon={badge.icon}
          className={cn(badgeIconSizeClasses[size], 'text-amber-400')}
        />
      )}
    </div>
  );
}

function getInitials(name: string | null, username: string): string {
  return (name || username).slice(0, 2).toUpperCase();
}

function getDisplayName(name: string | null, username: string): string {
  return name ?? username;
}

export function UserAvatar({
  user,
  challengeId,
  disableLink = false,
  size = 'md',
  showName = false,
  showUsername = false,
  children,
  className,
  onAvatarClick,
  hasStory = false,
  badge,
}: UserAvatarProps) {
  const profileUrl = !disableLink && !onAvatarClick && challengeId
    ? `/challenges/${challengeId}/users/${user.id}`
    : undefined;

  const avatarInner = (
    <Avatar className={cn(sizeClasses[size], (profileUrl || onAvatarClick) && 'transition-opacity hover:opacity-80')}>
      <AvatarImage
        src={user.avatarUrl ?? undefined}
        alt={getDisplayName(user.name, user.username)}
      />
      <AvatarFallback>{getInitials(user.name, user.username)}</AvatarFallback>
    </Avatar>
  );

  const avatarWithStory = hasStory ? (
    <div className="rounded-full bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-amber-500 p-[2.5px]">
      <div className="rounded-full bg-background p-[2px]">
        {avatarInner}
      </div>
    </div>
  ) : avatarInner;

  // Wrap with badge overlay if present
  const avatarElement = badge ? (
    <div className="relative inline-flex">
      {avatarWithStory}
      <BadgeOverlayElement badge={badge} size={size} />
    </div>
  ) : avatarWithStory;

  const nameElement = showName && (
    <span className={cn('font-semibold', textSizeClasses[size], profileUrl && 'hover:underline')}>
      {getDisplayName(user.name, user.username)}
    </span>
  );

  const usernameElement = showUsername && (
    <span className="text-sm text-muted-foreground">@{user.username}</span>
  );

  // Avatar only mode
  if (!showName && !showUsername && !children) {
    if (onAvatarClick) {
      return (
        <button onClick={onAvatarClick} className={cn('shrink-0 cursor-pointer', className)}>
          {avatarElement}
        </button>
      );
    }
    if (profileUrl) {
      return (
        <Link href={profileUrl} className={cn('shrink-0', className)}>
          {avatarElement}
        </Link>
      );
    }
    return <div className={cn('shrink-0', className)}>{avatarElement}</div>;
  }

  // Avatar with text content — avatar clickable separately when onAvatarClick is set
  const avatarPart = onAvatarClick ? (
    <button onClick={onAvatarClick} className="shrink-0 cursor-pointer">
      {avatarElement}
    </button>
  ) : avatarElement;

  const content = (
    <div className={cn('flex items-center gap-3', className)}>
      {avatarPart}
      <div className="flex-1 min-w-0">
        {nameElement}
        {showName && showUsername ? (
          <div>{usernameElement}</div>
        ) : (
          usernameElement
        )}
        {children}
      </div>
    </div>
  );

  if (profileUrl) {
    return (
      <Link href={profileUrl} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

/**
 * Inline user display for feed cards - avatar, name, and username in a row
 * Designed to be used in card headers
 */
interface UserAvatarInlineProps {
  user: UserAvatarUser;
  challengeId?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Additional info to show after the username (e.g., timestamp) */
  suffix?: React.ReactNode;
  className?: string;
  /** Badge to show as overlay on the avatar */
  badge?: BadgeOverlay | null;
}

export function UserAvatarInline({
  user,
  challengeId,
  size = 'lg',
  suffix,
  className,
  badge,
}: UserAvatarInlineProps) {
  const profileUrl = challengeId
    ? `/challenges/${challengeId}/users/${user.id}`
    : undefined;

  const avatarInner = (
    <Avatar className={cn(sizeClasses[size], profileUrl && 'transition-opacity hover:opacity-80')}>
      <AvatarImage
        src={user.avatarUrl ?? undefined}
        alt={getDisplayName(user.name, user.username)}
      />
      <AvatarFallback>{getInitials(user.name, user.username)}</AvatarFallback>
    </Avatar>
  );

  const avatarElement = badge ? (
    <div className="relative inline-flex">
      {avatarInner}
      <BadgeOverlayElement badge={badge} size={size} />
    </div>
  ) : avatarInner;

  const LinkedAvatar = profileUrl ? (
    <Link href={profileUrl} className="shrink-0">
      {avatarElement}
    </Link>
  ) : (
    avatarElement
  );

  const nameElement = profileUrl ? (
    <Link href={profileUrl} className={cn('font-semibold hover:underline', textSizeClasses[size])}>
      {getDisplayName(user.name, user.username)}
    </Link>
  ) : (
    <span className={cn('font-semibold', textSizeClasses[size])}>
      {getDisplayName(user.name, user.username)}
    </span>
  );

  const usernameElement = profileUrl ? (
    <Link href={profileUrl} className="text-sm text-muted-foreground hover:underline">
      @{user.username}
    </Link>
  ) : (
    <span className="text-sm text-muted-foreground">@{user.username}</span>
  );

  return (
    <div className={cn('flex items-start gap-4', className)}>
      {LinkedAvatar}
      <div className="flex-1">
        <div className={textSizeClasses[size]}>{nameElement}</div>
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          {usernameElement}
          {suffix}
        </div>
      </div>
    </div>
  );
}
