# Mini-Games System

Mini-games are weekly bonus challenges that run within a parent challenge. They add an extra competitive layer by pairing participants, creating predator-prey dynamics, or challenging personal records.

## Game Types

### Partner Week (`partner_week`)

Participants are paired based on leaderboard rank at game start. Each player earns a percentage of their partner's points during the game week.

**Pairing Algorithm:**
- Rank 1 pairs with Rank N (last place)
- Rank 2 pairs with Rank N-1
- Rank 3 pairs with Rank N-2
- ...and so on
- If odd number of participants, the middle-ranked player pairs with themselves

**Config:**
| Field | Default | Description |
|-------|---------|-------------|
| `bonusPercentage` | `10` | Percentage of partner's earned points awarded as bonus |

**Bonus Calculation:**
```
bonusPoints = round(partnerPointsDuringGame * bonusPercentage / 100)
```

Only "real" activities count — `source: "mini_game"` bonus activities are excluded from the partner's point total.

**Example:** Partner earns 200 points during the week with 10% config → you receive 20 bonus points.

---

### Hunt Week (`hunt_week`)

A predator-prey chain based on the leaderboard at game start. Each participant "hunts" the person directly above them and is "hunted" by the person directly below.

**Assignment:**
- Each player's **prey** is the person one rank above them (lower rank number = higher on leaderboard)
- Each player's **hunter** is the person one rank below them
- Rank 1 (first place) has no prey to hunt
- Last place has no hunter chasing them

**Config:**
| Field | Default | Description |
|-------|---------|-------------|
| `catchBonus` | `75` | Points awarded for surpassing your prey on the leaderboard |
| `caughtPenalty` | `25` | Points deducted if your hunter surpasses you |

**Outcome Determination:**
- **Caught Prey:** Your current rank is now lower (better) than your prey's current rank
- **Was Caught:** Your hunter's current rank is now lower (better) than yours

**Bonus Calculation:**
```
bonusPoints = (caughtPrey ? catchBonus : 0) - (wasCaught ? caughtPenalty : 0)
```

**Examples:**
- Catch prey only: `+75` points
- Caught by hunter only: `-25` points
- Catch prey AND caught by hunter: `+75 - 25 = +50` points
- Neither: `0` points

---

### PR Week (`pr_week`)

Challenge participants to beat their personal record for highest single-day points total. The PR is calculated from all days before the game starts.

**Initial State Capture:**
- At game start, the system calculates each participant's maximum daily points across all challenge days prior to the game
- Activities with `source: "mini_game"` are excluded from PR calculation
- If the participant has no prior activities, their PR is `0`

**Config:**
| Field | Default | Description |
|-------|---------|-------------|
| `prBonus` | `100` | Points awarded for beating your personal daily record |

**Outcome Determination:**
- The system finds the maximum single-day points total during the game period
- Multiple activities on the same day are summed together
- The PR must be **strictly exceeded** (equal does not count)

**Bonus Calculation:**
```
bonusPoints = weekMaxPoints > initialPr ? prBonus : 0
```

**Example:** PR before game is 50 points/day. During game week, you log 30 + 25 = 55 points on one day → PR beaten → `+100` bonus.

---

## Game Lifecycle

```
draft → active → calculating → completed
```

1. **Draft:** Game is created with type, dates, and config. Can be edited or deleted.
2. **Active:** Game has been started. Participant records are created with initial state snapshots. No further edits allowed.
3. **Calculating:** Transitional state while outcomes are being computed and bonuses awarded.
4. **Completed:** All bonuses have been awarded. Final state and outcomes are stored on each participant record.

### State Transition Rules

| From | To | Trigger |
|------|-----|---------|
| `draft` | `active` | `start` mutation |
| `active` | `calculating` | `end` mutation (first step) |
| `calculating` | `completed` | `end` mutation (second step, automatic) |

- Only `draft` games can be edited or deleted
- Only `draft` games can be started
- Only `active` games can be ended
- Starting requires at least 1 participant in the challenge

## Bonus Activity Creation

When a game ends and bonuses are calculated:

1. A `Mini-Game Bonus` activity type is created for the challenge (if one doesn't already exist). This type has `contributesToStreak: false`.
2. For each participant with a non-zero bonus, an activity is inserted with:
   - `source: "mini_game"`
   - `externalId: "mini_game_{gameId}_{userId}"`
   - `pointsEarned`: the calculated bonus (can be negative for hunt week penalties)
   - `notes`: human-readable description of the bonus
3. The participant's `userChallenges.totalPoints` is updated atomically.

## API Endpoints

All endpoints require API key authentication (`Authorization: Bearer mf_...`).

### Challenge-scoped

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/v1/challenges/:id/mini-games` | List all mini-games | Any authenticated user |
| `POST` | `/api/v1/challenges/:id/mini-games` | Create a new mini-game | Challenge admin |

### Mini-game operations

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/v1/mini-games/:id` | Get mini-game with participants | Any authenticated user |
| `PATCH` | `/api/v1/mini-games/:id` | Update a draft mini-game | Challenge admin |
| `DELETE` | `/api/v1/mini-games/:id` | Delete a draft mini-game | Challenge admin |
| `POST` | `/api/v1/mini-games/:id/start` | Start a draft mini-game | Challenge admin |
| `POST` | `/api/v1/mini-games/:id/end` | End an active mini-game | Challenge admin |

### Create Mini-Game Request Body

```json
{
  "type": "partner_week",
  "name": "Partner Week #1",
  "startsAt": 1704844800000,
  "endsAt": 1705449600000,
  "config": {
    "bonusPercentage": 15
  }
}
```

### Update Mini-Game Request Body

```json
{
  "name": "Updated Name",
  "startsAt": 1704844800000,
  "endsAt": 1705449600000,
  "config": {
    "bonusPercentage": 20
  }
}
```

All fields are optional. Only provided fields are updated.

## Convex Queries

| Query | Description |
|-------|-------------|
| `queries.miniGames.list` | All mini-games for a challenge with participant counts |
| `queries.miniGames.getById` | Single game with all participants and user data |
| `queries.miniGames.getActive` | Active games only |
| `queries.miniGames.getUserStatus` | Current user's live status in active games |
| `queries.miniGames.getUserHistory` | User's completed games with outcomes |

## Schema

### `miniGames` table

| Field | Type | Description |
|-------|------|-------------|
| `challengeId` | `Id<"challenges">` | Parent challenge |
| `type` | `"partner_week" \| "hunt_week" \| "pr_week"` | Game type |
| `name` | `string` | Display name |
| `startsAt` | `number` | Game start timestamp (UTC ms) |
| `endsAt` | `number` | Game end timestamp (UTC ms) |
| `status` | `"draft" \| "active" \| "calculating" \| "completed"` | Current state |
| `config` | `any` | Game-type-specific configuration |
| `createdAt` | `number` | Creation timestamp |
| `updatedAt` | `number` | Last update timestamp |

### `miniGameParticipants` table

| Field | Type | Description |
|-------|------|-------------|
| `miniGameId` | `Id<"miniGames">` | Parent game |
| `userId` | `Id<"users">` | Participant |
| `initialState` | `any` | Snapshot at game start (`{ rank, points, dailyPr? }`) |
| `partnerUserId` | `Id<"users">?` | Partner (partner_week only) |
| `preyUserId` | `Id<"users">?` | Hunt target (hunt_week only) |
| `hunterUserId` | `Id<"users">?` | Who's hunting them (hunt_week only) |
| `finalState` | `any?` | Snapshot at game end |
| `bonusPoints` | `number?` | Calculated bonus |
| `outcome` | `any?` | Game-specific results |
| `bonusActivityId` | `Id<"activities">?` | Reference to the awarded bonus activity |
| `createdAt` | `number` | Creation timestamp |

## Key Files

| File | Description |
|------|-------------|
| `mutations/miniGames.ts` | Game creation, lifecycle, and outcome calculation |
| `queries/miniGames.ts` | Real-time queries for game state and user status |
| `mutations/apiMutations.ts` | Internal mutations for HTTP API (create/update/delete) |
| `httpApi.ts` | HTTP API route handlers |
| `schema.ts` | Table definitions and indexes |
