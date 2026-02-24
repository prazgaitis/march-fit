# E2E Tests with Playwright

**Date:** 2026-02-24
**Description:** Add Playwright E2E tests that exercise core functionality against production nightly via GitHub Actions.

## Overview

Set up Playwright-based E2E tests that run against the production site (https://march.fit) every night. Tests use a dedicated private challenge for E2E testing so they don't pollute public data.

## Tasks

- [x] Set up Playwright configuration in the monorepo (`e2e/` directory at root)
- [x] Create E2E challenge config JSON for prod deployment
- [x] Write test: Google sign-in page navigation (verify page loads, Google button present)
- [x] Write test: Fresh user flow (sign up, join challenge via invite, log activities, verify leaderboard/points)
- [x] Write test: Persistent user flows (sign in with known users, log activities, assert cumulative progress)
- [x] Create GitHub Actions nightly workflow (`.github/workflows/e2e.yml`)

## Implementation Notes

### Test Strategy

1. **Google Sign-In Test**: Navigate to `/sign-in`, verify the page renders, the Google button exists. Click it and verify we get redirected to Google's OAuth page (we can't complete the flow since we don't have a bot-friendly Google account).

2. **Fresh User Track**: Each run creates a new user with a unique email (timestamp-based), signs up via `/sign-up`, joins the E2E private challenge via invite link, logs a few activities, and asserts:
   - Dashboard shows correct point totals
   - Leaderboard includes the user with correct points
   - Activity page shows logged activities

3. **Persistent User Tracks**: Multiple pre-created users that sign in each run and log activities. Over time, their point totals should grow. Tests assert:
   - Sign-in works
   - Previous activities still visible
   - New activities add to cumulative totals
   - Leaderboard rankings reflect cumulative progress

### Environment

- Tests run against `https://march.fit` (production)
- Private challenge created specifically for E2E tests
- Secrets stored in GitHub Actions secrets:
  - `E2E_CHALLENGE_INVITE_CODE` - Invite code for the private E2E challenge
  - `E2E_USER_PASSWORD` - Shared password for persistent test users
  - `E2E_CHALLENGE_ID` - Convex ID of the E2E challenge
