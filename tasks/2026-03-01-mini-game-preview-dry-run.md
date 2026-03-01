# 2026-03-01 Mini-Game Preview (Dry Run) System

## Description

Add preview/dry-run capabilities for mini-game operations. Currently `start` immediately locks in partner/prey assignments and `end` immediately awards points. Since participants are in different time zones, admins need to see what assignments and scores *would* look like before committing.

## Current State

- `start` mutation: Reads leaderboard → creates participant records with assignments → transitions to `active`. **No undo.**
- `end` mutation: Calculates outcomes → creates bonus activities → updates totalPoints → transitions to `completed`. **No undo.**
- Both operations are irreversible once committed.

## Goals

- [x] `previewStart` query — Shows proposed partner/prey/hunter assignments without creating records
- [x] `previewEnd` query — Shows proposed scores/outcomes without awarding points
- [x] HTTP API endpoints for both previews
- [x] Internal mutations for HTTP API bridge
- [x] Comprehensive tests for preview accuracy (preview matches real outcome)
- [x] Documentation updates (MINI-GAMES.md, CLAUDE.md)

## API Endpoints

- `GET /api/v1/mini-games/:id/preview-start` — Preview partner/prey assignments for a draft game
- `GET /api/v1/mini-games/:id/preview-end` — Preview scores/outcomes for an active game

## Design

### previewStart (query, read-only)
- Takes a draft mini-game ID
- Reads current leaderboard (same logic as `start`)
- Returns the proposed assignments without writing anything:
  - Partner Week: `[{ user, rank, points, partner }]`
  - Hunt Week: `[{ user, rank, points, prey, hunter }]`
  - PR Week: `[{ user, rank, points, dailyPr }]`

### previewEnd (query, read-only)
- Takes an active mini-game ID
- Reads current participant records + current leaderboard (same logic as `end`)
- Returns the proposed outcomes without writing anything:
  - Partner Week: `[{ user, partnerWeekPoints, bonusPoints }]`
  - Hunt Week: `[{ user, initialRank, currentRank, caughtPrey, wasCaught, bonusPoints }]`
  - PR Week: `[{ user, initialPr, weekMaxPoints, hitPr, bonusPoints }]`

### Key Principle
The preview logic reuses the *exact same calculation functions* as the real mutations to guarantee fidelity. The only difference: previews don't write.

## Implementation Notes

### Shared Calculation Library (`lib/miniGameCalculations.ts`)
Extracted read-only calculation functions into a shared library used by both preview queries and (eventually) the real mutations. Uses a `ReadCtx` type that works in both query and mutation contexts. Functions:
- `getLeaderboard` — sorted leaderboard with user details
- `previewPartnerWeekStart/End` — partner assignment and outcome calculations
- `previewHuntWeekStart/End` — prey/hunter assignment and outcome calculations
- `previewPrWeekStart/End` — PR snapshot and outcome calculations
- `calculateMaxDailyPoints`, `getPointsInPeriod`, `getMaxDailyPointsInPeriod` — shared helpers

### Preview Queries (`queries/miniGames.ts`)
- `previewStart`: Validates draft status, gets leaderboard, returns type-specific assignments with user details and config
- `previewEnd`: Validates active status, gets participants, returns type-specific outcomes with totalBonusPoints

### HTTP API Handlers (`httpApi.ts`)
- `handlePreviewStartMiniGame`: GET handler, admin auth, delegates to `previewStart` query
- `handlePreviewEndMiniGame`: GET handler, admin auth, delegates to `previewEnd` query
- Routes registered before start/end routes (longer paths match first)

### Tests (`mini-games-preview.test.ts`)
18 tests covering:
- Preview assignments for all 3 game types
- Preview outcomes for all 3 game types
- **Fidelity tests**: preview matches real start/end result exactly (partner week and hunt week start, all 3 types for end)
- Status validation (non-draft/non-active rejection)
- Edge cases (no participants, zero bonus, custom config)
