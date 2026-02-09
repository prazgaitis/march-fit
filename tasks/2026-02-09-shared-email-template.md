# 2026-02-09 - Shared Email Template

Create a unified email template wrapper used by all transactional emails in the app, and add an admin UI section to preview it.

## Tasks

- [x] Create shared email template wrapper (`packages/backend/lib/emailTemplate.ts`)
  - `wrapEmailTemplate()` - wraps content in branded March Fitness layout
  - `emailButton()` - styled CTA button helper
  - `emailCallout()` - highlighted callout box helper
  - `getEmailTemplatePreviewHtml()` - returns preview HTML for admin UI
  - Exports `DEFAULT_FROM_EMAIL` constant used across all email senders

- [x] Update default email plan to use shared template
  - All 5 default templates (Welcome, Week 1-3 Recaps, Challenge Complete) now use `wrapEmailTemplate()`
  - Consistent branding, spacing, and footer across all emails

- [x] Update invite email to use shared template
  - `challengeInvites.ts` now imports from `emailTemplate.ts`
  - Invite emails use indigo gradient header with branded layout
  - Removed duplicate `DEFAULT_FROM_EMAIL` constant

- [x] Update email sequences mutation to use shared `DEFAULT_FROM_EMAIL`
  - Removed local constant, imports from `emailTemplate.ts`

- [x] Add email template preview in admin emails page
  - Toggle between "Email Sequences" and "Email Template" views
  - Template view shows info panel with component breakdown and usage list
  - Full iframe preview of the base template
  - New query `getEmailTemplatePreview` returns preview HTML

## Implementation Notes

- The template uses inline styles for maximum email client compatibility
- Gray background (`#f4f4f5`) with white content card and rounded corners
- Header banner supports customizable gradients per email type
- "March Fitness" branding in header and footer link to march.fit
- Template is pure HTML generation (no React) since it runs on the Convex backend
