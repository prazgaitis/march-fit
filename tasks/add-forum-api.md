# Add Forum Tools to MCP, CLI, and API

**Date:** 2026-02-17

Expose forum/discussion feature via HTTP API, MCP server, and CLI so API key users and AI agents can interact with challenge forums programmatically.

## Implementation

- [x] Add internal query variants in `queries/forumPosts.ts` (`listByChallengeInternal`, `getByIdInternal`)
- [x] Add internal mutations in `mutations/apiMutations.ts` for forum operations
- [x] Add HTTP API route handlers + routes in `httpApi.ts`
- [x] Add MCP tools in `apps/web/app/api/mcp/route.ts`
- [x] Add CLI commands in `packages/cli/bin/mf.js`
- [x] Typecheck with `pnpm typecheck`
