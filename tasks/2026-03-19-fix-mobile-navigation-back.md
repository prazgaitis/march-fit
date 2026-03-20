# 2026-03-19 Fix Mobile Navigation Back on Leaderboard

## Problem
Navigating from a search-filtered leaderboard to a user's profile and then pressing back loses the search filter and active tab. Both were stored in React `useState`, which resets on remount.

## Changes
- [x] Move leaderboard search query (`q`) and active tab (`tab`) from React state to URL search params
- [x] Add X clear button to leaderboard search input
- [x] Use `router.replace` with `scroll: false` for seamless URL updates without history pollution
