# 2026-02-28 Challenge API Mini-Games

## Description

Expose full mini-game management through the HTTP API (for CLI/MCP consumption), make game configuration explicit and well-documented, and add comprehensive test coverage for all mini-game scenarios.

## Goals

- [x] HTTP API endpoints for full mini-game CRUD and lifecycle (create, update, delete, start, end, list, get)
- [x] Internal mutations to bridge HTTP API auth with existing mini-game mutations
- [x] Comprehensive test coverage for mini-game lifecycle, configuration, edge cases, and API endpoints
- [x] Documentation (README + CLAUDE.md) explaining each game type, mechanics, and point calculations

## API Endpoints

- `GET    /api/v1/challenges/:id/mini-games` — List mini-games for a challenge
- `POST   /api/v1/challenges/:id/mini-games` — Create a new mini-game (admin)
- `GET    /api/v1/mini-games/:id` — Get mini-game details with participants
- `PATCH  /api/v1/mini-games/:id` — Update a draft mini-game (admin)
- `DELETE /api/v1/mini-games/:id` — Delete a draft mini-game (admin)
- `POST   /api/v1/mini-games/:id/start` — Start a draft mini-game (admin)
- `POST   /api/v1/mini-games/:id/end` — End an active mini-game (admin)

## Implementation Notes

Filled in after implementation.
