# 2026-03-16 Fix Upvote Button Spacing

The upvote button uses a fixed-width left column (`w-10`) on forum posts, wasting 40px of horizontal space — especially noticeable on long posts and mobile.

## Changes

- [x] Move upvote from left column to inline position in the post meta/footer line (forum list)
- [x] Move upvote from left column to inline position in forum detail (main post + replies)
- [x] Keep same interaction behavior (toggle, filled/unfilled icon, indigo color when active)
