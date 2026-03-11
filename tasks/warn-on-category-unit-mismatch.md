# Warn on Category Unit Mismatch

**Date:** 2026-03-11
**Description:** Add a soft warning in the admin activity types UI when an activity type's unit differs from other activity types in the same category.

## Context

Category leader metrics sum `totalMetricValue` across all activity types in a category and display it with a single unit label. If activity types in the same category have different units (e.g., miles vs km), the totals are nonsensical. Currently there is no validation or warning about this.

## Tasks

- [x] Add helper function to detect unit mismatch when selecting a category
- [x] Show warning banner below category dropdown in both create and edit forms
- [x] Warning is non-blocking (soft validation only)
