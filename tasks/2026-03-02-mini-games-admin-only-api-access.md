# 2026-03-02 Mini-Games Admin-Only API Access

## Description

Enforce admin-only access for mini-game HTTP API actions, verify whether preview/dry-run is exposed in the mini-games admin panel, and add preview/dry-run support to that panel.

## Todos

- [x] Audit mini-game HTTP handlers for authorization gaps
- [x] Enforce challenge-admin authorization consistently for mini-game API actions
- [ ] Add/update tests for admin-only behavior (HTTP layer)
- [x] Verify whether admin panel exposes preview/dry-run and document findings
- [x] Add preview-start and preview-end UI to mini-games admin panel

## Findings

- Preview/dry-run was not initially exposed in the admin panel UI.
- Admin detail page now includes `Preview Start` (draft) and `Preview End` (active) dialogs backed by `queries.miniGames.previewStart` / `queries.miniGames.previewEnd`.
