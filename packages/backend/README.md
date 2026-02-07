# March Fit Convex Backend

Convex schema, queries, mutations, and actions for March Fit.

## Development

From the repo root:

```bash
pnpm dev
```

To run with local Convex Docker:

```bash
pnpm convex:start
pnpm convex:admin-key
pnpm dev:local
```

## Structure

- `schema.ts` - Database schema
- `queries/` - Read operations
- `mutations/` - Write operations
- `actions/` - External API calls
- `lib/` - Shared utilities

## Notes

Convex types in `_generated/` are auto-generated. Do not edit them manually.
