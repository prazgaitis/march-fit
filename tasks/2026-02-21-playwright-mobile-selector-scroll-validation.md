# 2026-02-21 — Playwright mobile selector scroll validation

## Todos
- [x] Create a fresh branch for Playwright validation
- [x] Attempt authenticated mobile Playwright run against dashboard flow
- [x] Reproduce selector behavior under auth (selector scrolls in current build)
- [x] Capture evidence (scroll metrics + screenshot)
- [x] Reuse newly created user in fresh context and validate behavior
- [x] Add reusable Playwright e2e test script for sign-up + reuse flow
- [ ] Apply follow-up fix if still reproducible

## Notes
- Existing scripted credentials in `scripts/perf-test.mjs` currently redirect back to sign-in.
- Email/password sign-up works when filling Name + Email + Password and waiting for URL transition to `/challenges`.
- With a newly created user that joins challenge `js79t7qjg4sdehecxyngd3jjcs810wp1`, activity-type list reports `scrollHeight: 1496`, `clientHeight: 300`, and `scrollTop` changes on wheel input.
- Added reusable e2e script: `apps/web/tests/e2e/mobile-activity-selector-scroll.mjs`
- Added commands:
  - `pnpm -F web test:e2e:mobile-selector`
  - `pnpm test:e2e:mobile-selector`
