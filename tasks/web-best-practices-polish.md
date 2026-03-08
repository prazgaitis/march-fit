# Web Best Practices Polish
**Date:** 2026-03-07

Mobile-first polish pass covering browser compatibility, usability, UX, and design.

## Priority 1: Mobile Interaction Quality
- [x] Add `-webkit-tap-highlight-color: transparent` to suppress blue flash on tap (iOS/Android)
- [x] Add `touch-action: manipulation` on interactive elements to eliminate 300ms tap delay
- [x] Add `overscroll-behavior: none` on app shell to prevent pull-to-refresh interference
- [x] Increase mobile nav touch targets to meet 44px minimum guideline

## Priority 2: Accessibility & Viewport
- [x] Remove `maximumScale: 1` from viewport config (blocks pinch-to-zoom, WCAG violation)
- [x] Add `prefers-reduced-motion` media query to disable/reduce animations for motion-sensitive users
- [x] Add `theme-color` meta tag for mobile browser chrome coloring

## Priority 3: PWA & Home Screen
- [x] Add web app manifest (`manifest.ts`) for Add to Home Screen support
- [x] Add apple-touch-icon and PWA icon references
- [x] Set `apple-mobile-web-app-capable` and status bar style

## Priority 4: Performance & Hydration
- [x] Fix `useIsMobile` SSR flash (initializes `false`, then flips to `true` on mobile causing layout shift)
- [x] Add CSS `content-visibility: auto` on feed cards for render performance

## Priority 5: Feed & Card Usability
- [x] Make activity card click target use `<article>` for semantics
- [x] Add active/pressed state visual feedback on tappable cards
- [x] Smooth scroll behavior for in-app navigation
