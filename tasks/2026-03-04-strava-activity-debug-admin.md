# Strava Activity Debug Admin Panel

**Date:** 2026-03-04
**Description:** Improve the "Test with Participants" tab in the admin integrations page to better debug Strava activity syncing.

## Changes

- [x] Replace basic Select dropdown with searchable combobox for participant selection
- [x] Add backend query to fetch user's logged activities for a challenge
- [x] Cross-reference fetched Strava activities with logged activities (via externalId)
- [x] Show logged date (local time) for matched activities
- [x] Display `start_date_local` from Strava alongside UTC date

## Implementation Notes

- New query `getUserActivitiesForStravaDebug` in `packages/backend/queries/admin.ts`
- Uses `externalUnique` index to efficiently look up activities by user+challenge
- Frontend uses `useQuery` to reactively load logged activities when a participant is selected
- Combobox uses Popover + Command components (shadcn) for searchable participant selection
- Matched activities shown with green "Logged" badge and formatted loggedDate
