# Add Core Components to Storybook

**Date:** 2026-03-02

Build a comprehensive Storybook design system for the March Fit application, covering all core UI and feature components.

## Goals

- [x] Establish well-organized Storybook categories
- [x] Create stories for all base UI components
- [x] Create stories for data display components (user avatars, challenge displays)
- [x] Create stories for challenge feature components
- [x] Create stories for mini-game cards
- [x] Create stories for dashboard/profile components
- [ ] Verify Storybook builds

## Storybook Organization

### Categories
- **UI** - Base design system primitives (Button, Card, Badge, Avatar, Input, etc.)
- **Data Display** - Composed components for showing user/challenge data
- **Challenges** - Challenge listing, details, and participant components
- **Dashboard** - Navigation and sidebar components
- **Mini-Games** - Game card components (Partner Week, Hunt Week, PR Week)
- **Profile** - Profile and streak components

## Implementation Notes

- Stories use mock data to avoid Convex dependency where possible
- Components with heavy hook dependencies (ActivityFeed, ChallengeSidebar) are skipped for now
- All stories include autodocs for automatic documentation
- Dark theme is the default background matching the app's design
