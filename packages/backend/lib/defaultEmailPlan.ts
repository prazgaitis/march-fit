/**
 * Default email plan for 30-day challenges
 *
 * Includes:
 * - Welcome email (on signup)
 * - Weekly recap emails (weeks 1-3)
 * - Challenge completion email
 *
 * All templates use the shared email template wrapper for consistent branding.
 */

import {
  wrapEmailTemplate,
  emailButton,
  emailCallout,
} from "./emailTemplate";

export interface DefaultEmailTemplate {
  name: string;
  subject: string;
  body: string;
  trigger: "manual" | "on_signup";
  /** When this email should be sent (days from challenge start, null for signup) */
  sendOnDay: number | null;
}

export const DEFAULT_EMAIL_PLAN: DefaultEmailTemplate[] = [
  // Welcome Email - sent immediately on signup
  {
    name: "Welcome Email",
    subject: "You're in. Let's go.",
    trigger: "on_signup",
    sendOnDay: null,
    body: wrapEmailTemplate({
      headerTitle: "Welcome to the Challenge",
      content: `
        <p style="margin: 0 0 16px;">You\u2019re officially in. The next 30 days are going to be worth it.</p>

        ${emailCallout({
          content: `<strong style="color: #e4e4e7;">Here\u2019s the deal:</strong>
          <ul style="margin: 8px 0 0; padding-left: 18px; color: #a1a1aa;">
            <li style="margin-bottom: 4px;">Log activities to earn points</li>
            <li style="margin-bottom: 4px;">Keep your streak alive every day</li>
            <li>Climb the leaderboard</li>
          </ul>`,
        })}

        <p style="margin: 20px 0;">Consistency beats intensity. Even a 10-minute walk counts. Show up every day and you\u2019ll be surprised where you end up.</p>

        <div style="text-align: center; margin: 28px 0;">
          ${emailButton({ href: "#", label: "Log Your First Activity" })}
        </div>
      `,
      footerText: "You\u2019re receiving this because you joined a challenge.",
    }),
  },

  // Week 1 Recap - Day 7
  {
    name: "Week 1 Recap",
    subject: "Week 1 done. Keep going.",
    trigger: "manual",
    sendOnDay: 7,
    body: wrapEmailTemplate({
      headerTitle: "Week 1 Complete",
      headerSubtitle: "The hardest part is already behind you",
      content: `
        <p style="margin: 0 0 16px;">Seven days in. You showed up, and that\u2019s what matters.</p>

        ${emailCallout({
          content: `<strong style="color: #e4e4e7;">Pro tip for Week 2:</strong> Don\u2019t break the streak. Even on rough days, a quick 10-minute session keeps you in the game.`,
        })}

        <p style="margin: 20px 0;">Check your dashboard to see your stats, points, and streak. Three more weeks \u2014 you\u2019ve got this.</p>
      `,
      footerText: "Keep pushing \u2014 Week 2 awaits.",
    }),
  },

  // Week 2 Recap - Day 14
  {
    name: "Week 2 Recap",
    subject: "Halfway there.",
    trigger: "manual",
    sendOnDay: 14,
    body: wrapEmailTemplate({
      headerTitle: "You\u2019re Halfway",
      headerSubtitle: "This is where habits start to stick",
      content: `
        <p style="margin: 0 0 16px;">Two weeks down. The routine is setting in \u2014 what felt hard in week one is probably getting easier. That\u2019s progress.</p>

        <!-- Progress -->
        <div style="margin: 24px 0;">
          <div style="background: #27272a; border-radius: 999px; height: 8px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #6366f1, #d946ef); height: 100%; width: 50%; border-radius: 999px;"></div>
          </div>
          <p style="text-align: center; color: #52525b; font-size: 12px; margin: 8px 0 0; letter-spacing: 0.05em;">50% COMPLETE</p>
        </div>

        ${emailCallout({
          content: `<strong style="color: #e4e4e7;">Week 3 challenge:</strong> Try an activity type you haven\u2019t done yet, or push harder on your favorite.`,
          borderColor: "#d946ef",
        })}

        <p style="margin: 20px 0;">The finish line is closer than you think. Keep the momentum going.</p>
      `,
      footerText: "Two weeks down, two to go.",
    }),
  },

  // Week 3 Recap - Day 21
  {
    name: "Week 3 Recap",
    subject: "One week left. Finish strong.",
    trigger: "manual",
    sendOnDay: 21,
    body: wrapEmailTemplate({
      headerTitle: "Final Week",
      headerSubtitle: "Seven days to the finish line",
      content: `
        <p style="margin: 0 0 16px;">Three weeks done. Your body has adapted, your routine is locked in, and you\u2019ve proven you can do this.</p>

        <!-- Progress -->
        <div style="margin: 24px 0;">
          <div style="background: #27272a; border-radius: 999px; height: 8px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #6366f1, #d946ef); height: 100%; width: 75%; border-radius: 999px;"></div>
          </div>
          <p style="text-align: center; color: #52525b; font-size: 12px; margin: 8px 0 0; letter-spacing: 0.05em;">75% COMPLETE</p>
        </div>

        ${emailCallout({
          content: `<strong style="color: #e4e4e7;">The final push:</strong> Give it everything. No regrets. Make these last 7 days count.`,
        })}

        <p style="margin: 20px 0;">Check the leaderboard \u2014 there\u2019s still time to climb.</p>
      `,
      footerText: "One week to go. Let\u2019s finish this.",
    }),
  },

  // Challenge Complete - Day 30
  {
    name: "Challenge Complete",
    subject: "You did it.",
    trigger: "manual",
    sendOnDay: 30,
    body: wrapEmailTemplate({
      headerTitle: "Challenge Complete",
      headerSubtitle: "30 days of showing up",
      content: `
        <p style="margin: 0 0 20px; font-size: 16px; color: #e4e4e7;">You made it. That\u2019s not nothing \u2014 that\u2019s 30 days of discipline, consistency, and effort.</p>

        <p style="margin: 0 0 20px;">You\u2019ve built habits that can last well beyond this challenge. The hard part was starting. You did that, and then you kept going.</p>

        <div style="text-align: center; margin: 28px 0;">
          ${emailButton({ href: "#", label: "View Final Results" })}
        </div>

        <p style="margin: 20px 0 0; color: #71717a; font-size: 13px;">Share your results, check the final leaderboard, and keep the momentum going.</p>
      `,
      footerText: "Thanks for being part of this. Until next time.",
    }),
  },
];

/**
 * Get the email templates that should be sent for a given day of the challenge
 */
export function getEmailsForDay(day: number): DefaultEmailTemplate[] {
  return DEFAULT_EMAIL_PLAN.filter(
    (template) => template.sendOnDay === day
  );
}

/**
 * Get the next scheduled email for a challenge based on days elapsed
 */
export function getNextScheduledEmail(
  daysElapsed: number
): DefaultEmailTemplate | null {
  const upcoming = DEFAULT_EMAIL_PLAN
    .filter((t) => t.sendOnDay !== null && t.sendOnDay > daysElapsed)
    .sort((a, b) => (a.sendOnDay ?? 0) - (b.sendOnDay ?? 0));

  return upcoming[0] ?? null;
}
