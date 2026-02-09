/**
 * Shared email template wrapper for all transactional emails.
 *
 * Provides a consistent March Fitness branded layout with:
 * - Branded header with logo text
 * - Content area
 * - Footer with unsubscribe-friendly copy
 *
 * Used by: invite emails, email sequences, signup emails, etc.
 */

export const DEFAULT_FROM_EMAIL = "March Fitness <noreply@march.fit>";

export interface EmailTemplateOptions {
  /** The inner HTML content of the email */
  content: string;
  /** Optional header title (shown in the colored banner) */
  headerTitle?: string;
  /** Optional subtitle below the header title */
  headerSubtitle?: string;
  /** CSS gradient for the header banner. Defaults to amber brand gradient */
  headerGradient?: string;
  /** Footer text. Defaults to March Fitness branding */
  footerText?: string;
  /** Whether to show the March Fitness logo text in the header. Defaults to true */
  showLogo?: boolean;
}

/**
 * Wraps email content in a consistent March Fitness branded template.
 *
 * Usage:
 * ```ts
 * const html = wrapEmailTemplate({
 *   headerTitle: "You're Invited!",
 *   content: `<p>Join the challenge...</p>`,
 * });
 * ```
 */
export function wrapEmailTemplate(options: EmailTemplateOptions): string {
  const {
    content,
    headerTitle,
    headerSubtitle,
    headerGradient = "linear-gradient(135deg, #f59e0b, #d97706)",
    footerText = "You're receiving this email from March Fitness.",
    showLogo = true,
  } = options;

  const headerSection = headerTitle
    ? `
    <div style="background: ${headerGradient}; padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
      ${showLogo ? `<div style="font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-bottom: 12px;">March Fitness</div>` : ""}
      <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700; line-height: 1.3;">${headerTitle}</h1>
      ${headerSubtitle ? `<p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 15px;">${headerSubtitle}</p>` : ""}
    </div>`
    : `
    <div style="padding: 24px 24px 0; text-align: center;">
      <div style="font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #d97706; margin-bottom: 8px;">March Fitness</div>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>March Fitness</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 560px; margin: 0 auto; padding: 24px 16px;">
    <!-- Email Container -->
    <div style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
      ${headerSection}

      <!-- Content -->
      <div style="padding: 28px 24px; color: #333333; font-size: 15px; line-height: 1.6;">
        ${content}
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 20px 16px; color: #a1a1aa; font-size: 12px; line-height: 1.5;">
      <p style="margin: 0;">${footerText}</p>
      <p style="margin: 8px 0 0; color: #d4d4d8;">
        <a href="https://march.fit" style="color: #d97706; text-decoration: none;">march.fit</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Creates a styled CTA button for use inside email content.
 */
export function emailButton(options: {
  href: string;
  label: string;
  color?: string;
}): string {
  const { href, label, color = "#f59e0b" } = options;
  return `<a href="${href}" style="display: inline-block; background: ${color}; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 8px 0;">${label}</a>`;
}

/**
 * Creates a highlighted callout box for use inside email content.
 */
export function emailCallout(options: {
  content: string;
  borderColor?: string;
  bgColor?: string;
}): string {
  const {
    content,
    borderColor = "#f59e0b",
    bgColor = "#fef3c7",
  } = options;
  return `<div style="background: ${bgColor}; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid ${borderColor};">${content}</div>`;
}

/**
 * Returns a preview-friendly sample of the email template (for admin UI).
 */
export function getEmailTemplatePreviewHtml(): string {
  return wrapEmailTemplate({
    headerTitle: "Email Header Title",
    headerSubtitle: "Optional subtitle text",
    content: `
      <p style="margin: 0 0 16px;">This is the standard email template used for all March Fitness transactional emails.</p>

      ${emailCallout({ content: "<strong>Callout Box</strong><p style='margin: 4px 0 0;'>Important information is highlighted in these callout boxes.</p>" })}

      <p style="margin: 16px 0;">Regular paragraph text goes here. The template provides consistent branding, typography, and spacing across all emails sent from the platform.</p>

      <div style="text-align: center; margin: 24px 0;">
        ${emailButton({ href: "#", label: "Call to Action Button" })}
      </div>

      <p style="margin: 16px 0 0; color: #666;">Muted helper text appears in gray like this.</p>
    `,
    footerText: "You're receiving this email from March Fitness.",
  });
}
