'use client';

import { useQuery } from 'convex/react';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import type { MentionableUser } from '@/lib/rich-text';

export function useMentionableUsers(challengeId: string) {
  const users = useQuery(api.queries.participations.getMentionable, {
    challengeId: challengeId as Id<"challenges">,
  });

  return { 
    users: (users as MentionableUser[]) ?? [], 
    loading: users === undefined, 
    error: null 
  };
}
