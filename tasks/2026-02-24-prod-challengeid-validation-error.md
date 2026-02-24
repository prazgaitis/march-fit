# 2026-02-24 - Prod challengeId ArgumentValidationError

## Todos
- [x] Pull full issue details from Sentry for issue 7287216486
- [x] Trace callsites of `queries/challenges:getByIdWithCount`
- [x] Identify why UUID is being sent instead of Convex `Id<"challenges">`
- [x] Implement and verify fix
- [x] Document root cause and mitigation

## Notes
- Sentry MCP org/project access in this environment does not include the `march-fitness` project, so issue details were verified via provided issue summary plus production CLI/API reproduction.
- Production reproduction:
  - `GET https://www.march.fit/challenges/6a36b9cd-604c-4ab0-8c62-8341a89106fc` renders 404 fallback, but still executes `queries/challenges:getByIdWithCount` first.
  - Invalid UUID challenge IDs trigger Convex argument validation when `getByIdWithCount` expects `v.id("challenges")`.
- Mitigation applied: `getByIdWithCount` now accepts `v.string()`, normalizes with `ctx.db.normalizeId("challenges", ...)`, and returns `null` when invalid.
