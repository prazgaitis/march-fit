# Add Category Selection to Admin Activity Types

**Date:** 2026-02-20

## Overview
Activity types support a `categoryId` field in the schema and mutations, but the admin UI never exposed it. This task adds a category dropdown to the admin activity types page for both creating and editing activity types.

## Changes

- [x] Fetch categories in the admin activity types page and pass to the table component
- [x] Add Category column to the activity types table
- [x] Add category dropdown to the edit form
- [x] Add category dropdown to the create form
- [x] Wire `categoryId` into create and update mutation calls
- [x] Typecheck passes

## Files Modified
- `apps/web/app/challenges/[id]/admin/activity-types/page.tsx` — fetch categories via `api.queries.categories.getAll`
- `apps/web/components/admin/admin-activity-types-table.tsx` — add Category column, dropdowns in create/edit forms
