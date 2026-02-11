# CLI Script for Creating Challenges with Activity Types

**Date:** 2026-02-11

Create a reusable CLI tool that reads challenge + activity type definitions from an editable JSON file and creates them in Convex (dev or prod).

## Implementation

- [x] Create `scripts/challenge-data/template.json` — editable JSON template with all activity types
- [x] Create `packages/backend/actions/createChallengeFromConfig.ts` — Convex action that processes the JSON
- [x] Create `scripts/create-challenge.sh` — CLI entry point (dev/prod)
- [x] Add convenience scripts to root `package.json`
