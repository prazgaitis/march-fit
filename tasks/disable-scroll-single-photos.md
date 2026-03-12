# Disable Scroll on Single Photo Posts

**Date:** 2026-03-12

## Description

Horizontal scroll/swipe should be disabled on single photo posts in the feed. Currently the `MediaCarousel` component attaches touch swipe handlers even when there's only one image, allowing unnecessary drag behavior.

## Tasks

- [x] Remove touch/swipe handlers from `MediaCarousel` when only one photo is present
