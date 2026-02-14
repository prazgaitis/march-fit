# MCP Server Endpoint

**Date:** 2026-02-14
**Description:** Add an MCP server endpoint in the Next.js app (Vercel-hosted) that exposes tools backed by March Fit HTTP API and authenticated via Bearer API key.

## TODO
- [x] Add MCP handler dependencies for web app
- [x] Implement `app/api/mcp/route.ts` with auth verification
- [x] Add core tools (`me`, challenge list/detail, leaderboard, activities list/log)
- [x] Document client connection examples (URL + auth header)
- [x] Verify with lint and local MCP route smoke check (`/api/mcp` 401/200/401)

## Verification Notes
- `pnpm -F web exec eslint 'app/api/mcp/route.ts'` passes.
- Local route smoke checks pass:
  - no auth: `401`
  - valid key + initialize: `200` streamable MCP response
  - invalid key: `401`
- `pnpm -F web typecheck` is currently blocked by an unrelated workspace error in `packages/backend/lib/resend.ts` (`@convex-dev/resend` module resolution).
