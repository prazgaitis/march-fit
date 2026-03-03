# Generalize Comments Table + Comment Likes

**Date:** 2026-03-03

## Overview

Unify three separate "comment" patterns into a single generalized `comments` table and add comment likes.

## Tasks

### Schema
- [ ] Add `parentType`, `feedbackId`, `visibility` to comments table
- [ ] Add `commentLikes` table

### Backend
- [ ] Generalize `comments.ts` create mutation to accept parentType
- [ ] Add `commentLikes.ts` toggle mutation
- [ ] Update feed score guard to filter by parentType
- [ ] Update affinity cron guard to skip non-activity comments
- [ ] Update `feedback.ts` updateByAdmin to create comments
- [ ] Update `admin.ts` addAdminComment to use comments table
- [ ] Update apiMutations with new comment mutations
- [ ] Update comments queries with getByParent
- [ ] Add HTTP API endpoints for feedback comments and comment likes
- [ ] Update MCP route tools

### Frontend
- [ ] Add comment likes to activity detail
- [ ] Replace feedback admin response with comment thread
- [ ] Update admin feedback page with comment thread
- [ ] Update flagged activity detail with comment list

### Migration
- [ ] Add backfill migration for parentType
- [ ] Add notification types
