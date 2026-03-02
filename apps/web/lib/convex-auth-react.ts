"use client";

import { useAction as useBaseAction, useMutation as useBaseMutation } from "convex/react";
import type {
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from "convex/server";
import { useCallback } from "react";

import { betterAuthClient } from "@/lib/better-auth/client";
import { isUnauthenticatedConvexError } from "@/lib/convex-auth-error";

export * from "convex/react";

type MutationRef = FunctionReference<"mutation">;
type ActionRef = FunctionReference<"action">;

type MutationCaller<Mutation extends MutationRef> = (
  ...args: OptionalRestArgs<Mutation>
) => Promise<FunctionReturnType<Mutation>>;

type ActionCaller<Action extends ActionRef> = (
  ...args: OptionalRestArgs<Action>
) => Promise<FunctionReturnType<Action>>;

async function refreshSessionIfPossible() {
  try {
    await betterAuthClient.getSession({ fetchOptions: { throw: false } });
  } catch {
    // Best effort refresh only; caller will surface the original/retry error.
  }
}

export function useMutation<Mutation extends MutationRef>(
  mutation: Mutation,
): MutationCaller<Mutation> {
  const baseMutation = useBaseMutation(mutation);

  return useCallback(
    async (...args: OptionalRestArgs<Mutation>) => {
      try {
        return await baseMutation(...args);
      } catch (error) {
        if (!isUnauthenticatedConvexError(error)) {
          throw error;
        }

        await refreshSessionIfPossible();
        return await baseMutation(...args);
      }
    },
    [baseMutation],
  );
}

export function useAction<Action extends ActionRef>(
  action: Action,
): ActionCaller<Action> {
  const baseAction = useBaseAction(action);

  return useCallback(
    async (...args: OptionalRestArgs<Action>) => {
      try {
        return await baseAction(...args);
      } catch (error) {
        if (!isUnauthenticatedConvexError(error)) {
          throw error;
        }

        await refreshSessionIfPossible();
        return await baseAction(...args);
      }
    },
    [baseAction],
  );
}
