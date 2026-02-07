/**
 * Default email plan for 30-day challenges
 *
 * Includes:
 * - Welcome email (on signup)
 * - Weekly recap emails (weeks 1-4)
 * - Challenge completion email
 */

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
    subject: "Welcome to the Challenge! Let's Get Started",
    trigger: "on_signup",
    sendOnDay: null,
    body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 24px; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { background: #fafafa; padding: 24px; border-radius: 8px; }
    .highlight { background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b; }
    .cta { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
    .footer { text-align: center; color: #666; font-size: 14px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Welcome to the Challenge!</h1>
  </div>
  <div class="content">
    <p>Hey there!</p>
    <p>You're officially in! Welcome to the fitness challenge. We're excited to have you join us on this journey.</p>

    <div class="highlight">
      <strong>Quick Start Guide:</strong>
      <ul>
        <li>Log your first activity to get started</li>
        <li>Check the leaderboard to see where you stand</li>
        <li>Every activity counts toward your streak!</li>
      </ul>
    </div>

    <p>The next 30 days are going to be transformative. Remember, consistency beats intensity. Even a small workout counts!</p>

    <a href="#" class="cta">Log Your First Activity</a>

    <p>Let's crush this together!</p>
  </div>
  <div class="footer">
    <p>You're receiving this because you joined the challenge.</p>
  </div>
</body>
</html>
    `.trim(),
  },

  // Week 1 Recap - Day 7
  {
    name: "Week 1 Recap",
    subject: "Week 1 Complete! Here's How You Did",
    trigger: "manual",
    sendOnDay: 7,
    body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981, #059669); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 24px; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; }
    .content { background: #fafafa; padding: 24px; border-radius: 8px; }
    .stat-box { background: white; padding: 16px; border-radius: 8px; text-align: center; margin: 8px 0; border: 1px solid #e5e7eb; }
    .stat-number { font-size: 32px; font-weight: 700; color: #10b981; }
    .stat-label { color: #666; font-size: 14px; }
    .highlight { background: #d1fae5; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #10b981; }
    .footer { text-align: center; color: #666; font-size: 14px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Week 1 Complete!</h1>
    <p>You've made it through the first week</p>
  </div>
  <div class="content">
    <p>Congratulations on completing your first week! The hardest part is starting, and you've already done that.</p>

    <div class="highlight">
      <strong>Week 1 Highlights:</strong>
      <p>Check your dashboard to see your stats, points earned, and current streak. Every day you showed up counts!</p>
    </div>

    <p><strong>Pro tip for Week 2:</strong> Try to maintain your streak. Even on tough days, a short 10-minute activity keeps you in the game.</p>

    <p>Three more weeks to go. You've got this!</p>
  </div>
  <div class="footer">
    <p>Keep pushing - Week 2 awaits!</p>
  </div>
</body>
</html>
    `.trim(),
  },

  // Week 2 Recap - Day 14
  {
    name: "Week 2 Recap",
    subject: "Halfway There! Week 2 Recap",
    trigger: "manual",
    sendOnDay: 14,
    body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 24px; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; }
    .content { background: #fafafa; padding: 24px; border-radius: 8px; }
    .progress-bar { background: #e5e7eb; border-radius: 999px; height: 12px; overflow: hidden; margin: 16px 0; }
    .progress-fill { background: linear-gradient(90deg, #8b5cf6, #7c3aed); height: 100%; width: 50%; border-radius: 999px; }
    .highlight { background: #ede9fe; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #8b5cf6; }
    .footer { text-align: center; color: #666; font-size: 14px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>You're Halfway There!</h1>
    <p>Week 2 is in the books</p>
  </div>
  <div class="content">
    <p>Amazing work! You've hit the halfway point of the challenge. This is where habits start to form.</p>

    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>
    <p style="text-align: center; color: #666; font-size: 14px;">50% Complete</p>

    <div class="highlight">
      <strong>Midpoint Check-in:</strong>
      <p>By now, you're probably starting to feel the routine. The activities that felt hard in week 1 might be getting easier. That's progress!</p>
    </div>

    <p><strong>Challenge for Week 3:</strong> Try a new activity type you haven't done yet, or push a little harder on your favorite one.</p>

    <p>The finish line is closer than you think. Keep that momentum going!</p>
  </div>
  <div class="footer">
    <p>Two weeks down, two to go!</p>
  </div>
</body>
</html>
    `.trim(),
  },

  // Week 3 Recap - Day 21
  {
    name: "Week 3 Recap",
    subject: "One Week Left! Week 3 Recap",
    trigger: "manual",
    sendOnDay: 21,
    body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 24px; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; }
    .content { background: #fafafa; padding: 24px; border-radius: 8px; }
    .progress-bar { background: #e5e7eb; border-radius: 999px; height: 12px; overflow: hidden; margin: 16px 0; }
    .progress-fill { background: linear-gradient(90deg, #f59e0b, #d97706); height: 100%; width: 75%; border-radius: 999px; }
    .highlight { background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b; }
    .footer { text-align: center; color: #666; font-size: 14px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Final Week Incoming!</h1>
    <p>Week 3 complete - you're almost there</p>
  </div>
  <div class="content">
    <p>Incredible! You've made it through three weeks. Just 7 more days and you'll have completed the entire challenge.</p>

    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>
    <p style="text-align: center; color: #666; font-size: 14px;">75% Complete</p>

    <div class="highlight">
      <strong>The Final Push:</strong>
      <p>This is the home stretch. Your body has adapted, your routine is set, and you've proven you can do this. Now let's finish strong!</p>
    </div>

    <p><strong>Week 4 Goal:</strong> Give it everything you've got. No regrets. Make these last 7 days count!</p>

    <p>Check the leaderboard - there's still time to climb those rankings!</p>
  </div>
  <div class="footer">
    <p>One week to glory. Let's go!</p>
  </div>
</body>
</html>
    `.trim(),
  },

  // Challenge Complete - Day 30
  {
    name: "Challenge Complete",
    subject: "You Did It! Challenge Complete",
    trigger: "manual",
    sendOnDay: 30,
    body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #fbbf24, #f59e0b, #d97706); padding: 40px; border-radius: 12px; text-align: center; margin-bottom: 24px; }
    .header h1 { color: white; margin: 0; font-size: 32px; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header p { color: rgba(255,255,255,0.95); margin: 12px 0 0; font-size: 18px; }
    .trophy { font-size: 64px; margin-bottom: 16px; }
    .content { background: #fafafa; padding: 24px; border-radius: 8px; }
    .highlight { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 16px 0; text-align: center; }
    .highlight h3 { margin: 0 0 8px; color: #92400e; }
    .cta { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
    .footer { text-align: center; color: #666; font-size: 14px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="trophy">🏆</div>
    <h1>CONGRATULATIONS!</h1>
    <p>You completed the 30-day challenge!</p>
  </div>
  <div class="content">
    <p>What an incredible achievement! You showed up, put in the work, and made it all the way to the finish line.</p>

    <div class="highlight">
      <h3>30 Days of Dedication</h3>
      <p>You've built habits that can last a lifetime. The discipline you've shown is something to be truly proud of.</p>
    </div>

    <p>Take a moment to celebrate this accomplishment. You earned it!</p>

    <p><strong>What's next?</strong></p>
    <ul>
      <li>Check your final standings on the leaderboard</li>
      <li>Share your achievement with friends</li>
      <li>Keep the momentum going - don't let those habits fade!</li>
    </ul>

    <a href="#" class="cta">View Final Results</a>

    <p>Thank you for being part of this challenge. Until next time!</p>
  </div>
  <div class="footer">
    <p>Congratulations, Champion! 🎉</p>
  </div>
</body>
</html>
    `.trim(),
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
