# MCP & Admin Documentation

**Date:** 2026-02-15
**Description:** Add beginner-friendly MCP documentation and a dedicated admin guide for managing challenges via AI chat apps. Fill gaps in admin MCP/API tooling.

## Goals

- [x] Create a comprehensive MCP setup guide for beginners (Claude, ChatGPT, other clients)
- [x] Create an admin-focused guide for challenge administration via AI chat
- [x] Identify and fill gaps in the MCP tool surface for admin operations
- [x] Link new docs from the main README

## Implementation Notes

### New Documentation

- `docs/mcp-guide.md` — beginner-friendly guide explaining what MCP is, how to get an API key, and setup instructions for Claude Code, Claude Desktop, ChatGPT, and generic MCP clients. Includes example conversations and troubleshooting.
- `docs/admin-guide.md` — dedicated admin guide with quick-reference tables, detailed workflows for reviewing flagged activities, managing activity types (including scoring config JSON examples), setting announcements, and participant management. Full tool reference table with required roles.
- `docs/mcp.md` — updated to link to the new guides and include the complete tool list (was previously missing admin tools).

### New MCP Tools Added (7)

Previously the MCP server had 13 tools. Added 7 more for a total of 20:

| Tool | Type | Description |
|------|------|-------------|
| `get_challenge` | user | Get single challenge details |
| `list_activity_types` | user | List activity types with scoring config |
| `list_participants` | user | List participants with roles/scores |
| `get_activity` | user | Get single activity details |
| `delete_activity` | user/admin | Delete an activity |
| `create_activity_type` | admin | Create a new activity type |
| `update_activity_type` | admin | Modify an existing activity type |

### New HTTP API Endpoints (3)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/challenges/:id/activity-types` | Create activity type (admin) |
| PATCH | `/api/v1/activity-types/:id` | Update activity type (admin) |

### Backend Changes

- `packages/backend/mutations/apiMutations.ts` — added `createActivityTypeForUser` and `updateActivityTypeForUser` internal mutations
- `packages/backend/queries/activityTypes.ts` — added `getByIdInternal` query for looking up activity types by ID
- `packages/backend/httpApi.ts` — added route handlers and routes for activity type create/update
- `apps/web/app/api/mcp/route.ts` — added 7 new tool registrations, updated `ApiRequestOptions` type to include DELETE
