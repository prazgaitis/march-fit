# Forum @Mention Support

**Date:** 2026-02-17

## Overview
Add @mention support to forum posts and replies using the existing Tiptap rich-text editor, and send notifications when users are mentioned.

## Tasks

- [x] Replace Textarea with RichTextEditor in `new-post-dialog.tsx`
- [x] Replace Textarea with RichTextEditor in `forum-post-detail.tsx` (replies)
- [x] Update content display to use RichTextViewer in `forum-post-detail.tsx`
- [x] Update content preview in `forum-content.tsx` to extract plain text from JSON
- [x] Create `packages/backend/lib/mentions.ts` for server-side mention extraction
- [x] Update `forumPosts.create` mutation to send mention notifications
- [x] Add `forum_mention` notification type to notifications list display
