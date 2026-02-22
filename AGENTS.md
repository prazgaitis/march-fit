# AGENTS.md

Instructions for AI code agents (OpenAI Codex, Claude Code, etc.) working on this codebase.

## Project Overview

This is a fitness challenge platform with:
- **Frontend**: Next.js 15 app in `apps/web/`
- **Backend**: Convex serverless functions in `packages/backend/`
- **Auth**: Better Auth via `@convex-dev/better-auth`

## Date Handling (Local Date Semantics)

Daily totals, streaks, and PR-day logic must be based on the user's local calendar date.
We store this as a date-only value in `activities.loggedDate` (UTC ms at the local date),
or derive it from Strava `start_date_local`. Do not bucket or compare by time-of-day.

Use `formatDateOnlyFromUtcMs(loggedDate)` for grouping, and avoid
`new Date(...).toISOString().slice(0, 10)` in daily rollups.

The client must send a local date (or a local timestamp plus timezone) for activity logging.
The backend should normalize to a date-only value and must not infer a local date from UTC alone.

## Development Process

When starting a new task, add a markdown file in `/tasks` directory with a descriptive slug, date header, and checkbox todos.

## Convex Backend Development

### Directory Structure

```
packages/backend/
├── _generated/          # Auto-generated types (DO NOT EDIT)
├── actions/             # Convex actions (can call external APIs)
├── mutations/           # Convex mutations (write to database)
├── queries/             # Convex queries (read from database)
├── lib/                 # Shared utilities
├── schema.ts            # Database schema definition
├── index.ts             # Package exports
└── convex.json          # Convex configuration
```

### Running the Dev Server

```bash
# From project root - starts both Next.js and Convex
pnpm dev

# Or just the backend
cd packages/backend && pnpm dev
```

The dev server will:
1. Push schema/function changes to your dev deployment
2. Regenerate types in `_generated/`
3. Display function logs in terminal

### Writing Convex Functions

**Queries** (read-only, cached):
```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getById = query({
  args: { id: v.id("tableName") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

**Mutations** (write operations):
```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tableName", {
      name: args.name,
      createdAt: Date.now(),
    });
  },
});
```

**Actions** (can call external APIs):
```typescript
import { action } from "./_generated/server";
import { v } from "convex/values";

export const fetchExternal = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const response = await fetch(args.url);
    return await response.json();
  },
});
```

## Testing Convex Functions

### Setup (First Time)

```bash
cd packages/backend
pnpm add -D vitest @edge-runtime/vm
```

Create `packages/backend/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});
```

Add to `packages/backend/package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

### Writing Tests

Create test files like `queries/users.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("users", () => {
  test("can create and query users", async () => {
    const t = convexTest(schema);

    const userId = await t.mutation(api.mutations.users.create, {
      email: "test@example.com",
      name: "Test User",
    });

    const user = await t.query(api.queries.users.getById, { id: userId });

    expect(user).toMatchObject({
      email: "test@example.com",
      name: "Test User",
    });
  });

  test("authenticated user context", async () => {
    const t = convexTest(schema);

    // Simulate authenticated user
    const asUser = t.withIdentity({
      name: "Test User",
      email: "test@example.com",
    });

    await asUser.mutation(api.mutations.users.updateProfile, {
      name: "Updated Name",
    });
  });
});
```

### Running Tests

```bash
cd packages/backend
pnpm test          # Watch mode
pnpm test:run      # Run once
```

### Direct Database Access in Tests

```typescript
const t = convexTest(schema);

await t.run(async (ctx) => {
  await ctx.db.insert("users", {
    email: "setup@example.com",
    createdAt: Date.now(),
  });
});
```

### Limitations

convex-test is a mock - always manually test against real Convex before shipping.

## Environment Setup

```bash
# Required for Convex
NEXT_PUBLIC_CONVEX_URL="https://your-project.convex.cloud"

# For Better Auth
BETTER_AUTH_SECRET="generate-a-long-secret"
NEXT_PUBLIC_AUTH_PROVIDER="better-auth"
```

## Verification Checklist

1. `pnpm typecheck` - Types compile
2. `pnpm lint` - Linting passes
3. `cd packages/backend && pnpm test:run` - Tests pass
4. `pnpm dev` - Dev server runs without errors

## Resources

- [Convex Docs](https://docs.convex.dev/)
- [convex-test](https://docs.convex.dev/testing/convex-test)
- [Better Auth](https://www.better-auth.com/)
