# 2026-03-02 Add Standard Mini-Games Button

## Description

Add a one-click admin action to create the standard mini-game schedule for production challenges.

## Todos

- [x] Add UI button in mini-games admin page for standard setup
- [x] Implement standard week definitions and date calculations (Days 8-14, 15-21, 22-28)
- [x] Prevent duplicate standard mini-games when some already exist
- [x] Validate with typecheck/tests

## Implementation Notes

- Added `Add Standard Weeks` button in mini-games admin header.
- Standard templates now create:
  - Partner Week: days 8-14 (`bonusPercentage: 10`)
  - Hunt Week: days 15-21 (`catchBonus: 75`, `caughtPenalty: 25`)
  - PR Week: days 22-28 (`prBonus: 100`)
- Creation skips entries that already exist (same type + date range) and entries outside challenge bounds.
