# 2026-02-21 Backend Latency Sentry Runtime

- [x] Confirm backend dev failure cause (`@sentry/node` pulling Node built-ins into Convex runtime bundle)
- [x] Replace latency reporting helper with Convex runtime-safe implementation
- [x] Remove Node-only Sentry dependency from backend package
- [x] Verify backend typecheck and capture results (`pnpm typecheck` passes; no backend `test:run` script exists)
