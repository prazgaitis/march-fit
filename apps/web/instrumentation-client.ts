import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  // Performance — sample enough to diagnose mobile issues
  tracesSampleRate: 0.2,

  // Pin collection to the v10 baseline (sendDefaultPii: false): headers are
  // still collected but sensitive values always scrubbed; no cookies, request
  // bodies, user info, or database query data.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpBodies: [],
    databaseQueryData: false,
  },

  // Session Replay — 10% baseline, 100% on errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.browserTracingIntegration({
      enableLongAnimationFrame: true,
    }),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Filter noise
  ignoreErrors: [
    "ResizeObserver loop",
    "Non-Error promise rejection",
    /^Loading chunk/,
    /^Failed to fetch/,
  ],

  // Tag events with device type for easy filtering
  beforeSend(event) {
    if (typeof navigator !== "undefined") {
      event.tags = {
        ...event.tags,
        isMobile: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
          ? "true"
          : "false",
      };
    }
    return event;
  },

  // Tag spans with device type for easy filtering (beforeSendTransaction is
  // removed in v12; spans are the v11 replacement for transactions).
  beforeSendSpan(span) {
    if (typeof navigator !== "undefined") {
      span.attributes["isMobile"] = /Android|iPhone|iPad|iPod|Mobile/i.test(
        navigator.userAgent
      )
        ? "true"
        : "false";
    }
    return span;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
