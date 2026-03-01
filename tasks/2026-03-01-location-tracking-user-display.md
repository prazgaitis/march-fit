# 2026-03-01: Location Tracking & Centralized User Display

## Overview
Persist local time and location when activities are logged. Extract location from Strava when available. Use browser timezone passively (no location prompt). Add self-entered location to user profiles. Centralize user challenge display components with consistent, configurable props.

## Schema Changes

### Activities table
- [x] `localTime` (optional string) - ISO time string (e.g., "14:30") from the user's local clock or Strava's start_date_local
- [x] `timezone` (optional string) - IANA timezone from the browser (e.g., "America/Chicago")
- [x] `locationCity` (optional string) - City/area from Strava's location_city or browser reverse geocode
- [x] `locationState` (optional string) - State/region from Strava
- [x] `locationCountry` (optional string) - Country from Strava
- [x] `startLatlng` (optional array of 2 numbers) - [lat, lng] from Strava's start_latlng

### Users table
- [x] `location` (optional string) - Self-entered location text (e.g., "Chicago, IL")

## Backend Changes
- [x] Strava: extract start_latlng, location_city, location_state, location_country, and local time from start_date_local
- [x] Activity log mutation: accept optional timezone, localTime, locationCity, locationState, locationCountry, startLatlng
- [x] updateUser mutation: accept optional location field

## Frontend Changes
- [x] Activity log dialog: silently send browser timezone (Intl.DateTimeFormat) and local time
- [x] Settings page: add "Location" text input field for user bio location
- [x] User profile: display user location if set

## Centralized User Challenge Display
- [x] Create `UserChallengeDisplay` component with configurable props:
  - user: { id, name, username, avatarUrl, location }
  - challengeId: for profile linking
  - show: { name, username, location, points, streak, rank } - toggle what's visible
  - size: sm | md | lg
  - layout: inline | stacked
  - highlight: boolean (for current user)
  - suffix: ReactNode
- [x] Refactor leaderboard to use centralized component
- [x] Refactor activity feed to use centralized component

## Implementation Notes
- Browser timezone is available via `Intl.DateTimeFormat().resolvedOptions().timeZone` — no permissions needed
- Local time is derived from `new Date().toTimeString()` — no permissions needed
- No geolocation API prompt — location comes only from Strava or user-entered profile
- Strava API includes location_city, location_state, location_country, start_latlng in detailed activity response
