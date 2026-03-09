# Sentry Logging for API & MCP

**Date:** 2026-03-08
**Description:** Add structured Sentry logging and metrics tracking for HTTP API v1 and MCP server requests.

## Changes

- [x] Add request-level Sentry logging to HTTP API v1 router (method, route, status, duration, user)
- [x] Add Sentry logging to MCP route handler (tool calls, auth, errors)
- [x] Track API request metrics: latency, status codes, route patterns
- [x] Track MCP tool usage metrics: which tools are called, duration, errors
- [x] Report errors with full context (route, user, params)

## Implementation Notes

- Backend (Convex) uses direct Sentry envelope submission via `reportBackendSentryEvent()` since the Sentry SDK can't run in the Convex runtime
- MCP server runs in Next.js (Node.js runtime) so it uses `@sentry/nextjs` SDK directly
- API logging captures: method, route pattern, status code, duration, userId
- MCP logging captures: tool name, duration, success/failure, userId context
- All logging is fire-and-forget to avoid impacting request latency
