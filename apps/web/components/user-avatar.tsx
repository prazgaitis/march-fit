'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface UserAvatarUser {
  id: string;
  name: string | null;
  username: string;
  avatarUrl: string | null;
}

interface UserAvatarProps {
  user: UserAvatarUser;
  /** Challenge ID - when provided, avatar/name will link to user profile */
  challengeId?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Show name next to avatar */
  showName?: boolean;
  /** Show @username below or next to name */
  showUsername?: boolean;
  /** Additional content to show after name/username */
  children?: React.ReactNode;
  /** Custom class for the container */
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-14 w-14',
  '2xl': 'h-24 w-24',
};

const textSizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
};

function getInitials(name: string | null, username: string): string {
  return (name || username).slice(0, 2).toUpperCase();
}

function getDisplayName(name: string | null, username: string): string {
  return name ?? username;
}

export function UserAvatar({
  user,
  challengeId,
  size = 'md',
  showName = false,
  showUsername = false,
  children,
  className,
}: UserAvatarProps) {
  const profileUrl = challengeId
    ? `/challenges/${challengeId}/users/${user.id}`
    : undefined;

  const avatarElement = (
    <Avatar className={cn(sizeClasses[size], profileUrl && 'transition-opacity hover:opacity-80')}>
      <AvatarImage
        src={user.avatarUrl ?? undefined}
        alt={getDisplayName(user.name, user.username)}
      />
      <AvatarFallback>{getInitials(user.name, user.username)}</AvatarFallback>
    </Avatar>
  );

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
    if (profileUrl) {
      return (
        <Link href={profileUrl} className={cn('shrink-0', className)}>
          {avatarElement}
        </Link>
      );
    }
    return <div className={cn('shrink-0', className)}>{avatarElement}</div>;
  }

  // Avatar with text content
  const content = (
    <div className={cn('flex items-center gap-3', className)}>
      {avatarElement}
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
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Additional info to show after the username (e.g., timestamp) */
  suffix?: React.ReactNode;
  className?: string;
}

export function UserAvatarInline({
  user,
  challengeId,
  size = 'lg',
  suffix,
  className,
}: UserAvatarInlineProps) {
  const profileUrl = challengeId
    ? `/challenges/${challengeId}/users/${user.id}`
    : undefined;

  const avatarElement = (
    <Avatar className={cn(sizeClasses[size], profileUrl && 'transition-opacity hover:opacity-80')}>
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
