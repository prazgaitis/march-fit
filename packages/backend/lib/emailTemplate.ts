/**
 * Shared email template wrapper for all transactional emails.
 *
 * Matches the March Fitness brand: dark, bold, minimal with
 * indigo-to-fuchsia gradient accents and uppercase typography.
 *
 * Used by: invite emails, email sequences, signup emails, etc.
 */

export const DEFAULT_FROM_EMAIL = "March Fitness <noreply@march.fit>";

export interface EmailTemplateOptions {
  /** The inner HTML content of the email */
  content: string;
  /** Optional large title shown in the header area */
  headerTitle?: string;
  /** Optional subtitle below the header title */
  headerSubtitle?: string;
  /** Footer text. Defaults to generic March Fitness copy */
  footerText?: string;
}

/**
 * Wraps email content in the March Fitness branded template.
 */
export function wrapEmailTemplate(options: EmailTemplateOptions): string {
  const {
    content,
    headerTitle,
    headerSubtitle,
    footerText = "You\u2019re receiving this because you\u2019re part of a challenge on March Fitness.",
  } = options;

  const headerBlock = headerTitle
    ? `
      <!-- Header -->
      <td style="padding: 40px 32px 32px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; line-height: 1.2;">${headerTitle}</h1>
        ${headerSubtitle ? `<p style="margin: 12px 0 0; font-size: 15px; color: #a1a1aa; line-height: 1.5;">${headerSubtitle}</p>` : ""}
      </td>`
    : `
      <!-- Spacer -->
      <td style="padding: 32px 32px 0;"></td>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>March Fitness</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #e4e4e7;">
  <!-- Wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #09090b;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px;">

          <!-- Logo -->
          <tr>
            <td style="padding: 0 0 24px; text-align: center;">
              <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.35em; text-transform: uppercase; color: #71717a;">march fitness</span>
            </td>
          </tr>

          <!-- Gradient Divider -->
          <tr>
            <td style="padding: 0 0 0; height: 2px; background: linear-gradient(90deg, #6366f1, #d946ef); border-radius: 2px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #18181b; border-radius: 0 0 12px 12px;">
                <tr>
                  ${headerBlock}
                </tr>
                <tr>
                  <!-- Content -->
                  <td style="padding: 0 32px 36px; font-size: 15px; line-height: 1.7; color: #d4d4d8;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 8px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #52525b; line-height: 1.5;">${footerText}</p>
              <p style="margin: 10px 0 0;">
                <a href="https://march.fit" style="font-size: 11px; font-weight: 700; letter-spacing: 0.3em; text-transform: uppercase; color: #6366f1; text-decoration: none;">march.fit</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Creates a styled CTA button for use inside email content.
 * Defaults to the brand indigo-purple.
 */
export function emailButton(options: {
  href: string;
  label: string;
  color?: string;
}): string {
  const { href, label, color = "#6366f1" } = options;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;"><tr><td style="background: ${color}; border-radius: 8px;"><a href="${href}" style="display: inline-block; padding: 13px 32px; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; letter-spacing: 0.02em;">${label}</a></td></tr></table>`;
}

/**
 * Creates a highlighted callout/tip box for use inside email content.
 */
export function emailCallout(options: {
  content: string;
  borderColor?: string;
}): string {
  const { content, borderColor = "#6366f1" } = options;
  return `<div style="background: #27272a; padding: 16px 18px; border-radius: 8px; margin: 20px 0; border-left: 3px solid ${borderColor}; color: #d4d4d8; font-size: 14px; line-height: 1.6;">${content}</div>`;
}

/**
 * Returns a preview-friendly sample of the email template (for admin UI).
 */
export function getEmailTemplatePreviewHtml(): string {
  return wrapEmailTemplate({
    headerTitle: "Welcome to the Challenge",
    headerSubtitle: "Here\u2019s everything you need to get started",
    content: `
      <p style="margin: 0 0 16px;">Hey there \u2014 you\u2019re officially in. We\u2019re excited to have you join us for the next 30 days.</p>

      ${emailCallout({ content: "<strong style='color: #e4e4e7;'>Quick tip:</strong> Log your first activity today to start building your streak. Even a short walk counts." })}

      <p style="margin: 20px 0;">Every activity you log earns points and keeps your streak alive. Consistency beats intensity \u2014 show up every day and you\u2019ll be surprised where you end up.</p>

      <div style="text-align: center; margin: 28px 0;">
        ${emailButton({ href: "#", label: "Log Your First Activity" })}
      </div>

      <p style="margin: 20px 0 0; color: #71717a; font-size: 13px;">Check the leaderboard to see where you stand against the competition.</p>
    `,
  });
}
