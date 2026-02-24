"use client";

import * as Sentry from "@sentry/nextjs";

type SentryContext = {
  area: string;
  challengeId?: string | null;
  userId?: string | null;
  tags?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, unknown>;
  level?: Sentry.SeverityLevel;
};

function attachCommonContext(scope: Sentry.Scope, context: SentryContext) {
  scope.setTag("area", context.area);

  if (typeof window !== "undefined") {
    scope.setTag("pathname", window.location.pathname);
    scope.setTag("host", window.location.host);
  }

  if (context.challengeId) {
    scope.setTag("challengeId", context.challengeId);
  }

  if (context.userId) {
    scope.setUser({ id: context.userId });
  }

  for (const [key, value] of Object.entries(context.tags ?? {})) {
    if (value !== undefined && value !== null) {
      scope.setTag(key, String(value));
    }
  }

  if (context.extra) {
    scope.setExtras(context.extra);
  }
}

export function captureAppException(error: unknown, context: SentryContext) {
  Sentry.withScope((scope) => {
    attachCommonContext(scope, context);
    Sentry.captureException(error, {
      level: context.level ?? "error",
    });
  });
}

export function captureAppMessage(message: string, context: SentryContext) {
  Sentry.withScope((scope) => {
    attachCommonContext(scope, context);
    Sentry.captureMessage(message, context.level ?? "warning");
  });
}
