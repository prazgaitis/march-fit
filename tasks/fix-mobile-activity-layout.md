# Fix Mobile Activity Layout

**Date:** 2026-03-05

## Problem
The activity detail page on mobile has too many nested cards/bordered sections, making it feel heavy and cluttered. Points, date, and metrics each have their own bordered containers inside the main card.

## Changes
- [x] Remove outer `<Card>` wrapper from the main activity content — use a flat layout
- [x] Replace bordered boxes for points/date with simpler inline rows
- [x] Simplify metrics display (remove individual bordered boxes)
- [x] Remove Card wrapper from comments section
- [x] Keep action bar (like, comment, share) as a clean divider section
