# 2026-02-16 Mobile browser chrome hide on feed

Date: 2026-02-16

- [x] Review current dashboard/feed scroll containers and mobile nav positioning
- [x] Identify approach for browser bottom bar hide behavior + translucent app nav
- [x] Outline implementation plan and risks for this codebase
- [x] Switch dashboard to document scrolling on mobile while preserving desktop internal scroller
- [x] Add translucent mobile nav styling with safe-area inset support
- [x] Keep mobile nav persistently visible (no hide/reveal) with translucent styling
- [x] Enable viewport safe-area usage via `viewportFit: "cover"`
- [x] Offset mobile top content/sticky feed nav for safe-area top inset
- [x] Tune mobile bottom nav translucency closer to x.com style
- [x] Dial bottom nav translucency further (lower alpha + higher backdrop saturation)
- [x] Try a no-glass variant (no backdrop blur/saturation) with plain translucent background
- [x] Add fade in/out behavior for mobile bottom nav on scroll direction
- [x] Restyle log activity button to transparent icon style (remove purple fill)
- [x] Refine fade UX to dim (not fully hide) and keep nav visibly active on reveal
- [x] Validate changes with `pnpm -F web typecheck` and targeted ESLint
