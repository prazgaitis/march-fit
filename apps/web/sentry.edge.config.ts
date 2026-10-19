import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
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
  enabled: process.env.NODE_ENV === "production",
});
