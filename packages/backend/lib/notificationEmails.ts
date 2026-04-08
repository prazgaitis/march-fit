/**
 * Email notification helpers.
 *
 * Maps notification types to email preference fields and generates
 * email content for each notification type.
 */

import type { Doc } from "../_generated/dataModel";
import { wrapEmailTemplate, emailButton } from "./emailTemplate";

/** Maps a notification type string to its corresponding preference field. */
export function getEmailPreferenceField(
  notificationType: string,
): keyof Omit<Doc<"notificationPreferences">, "_id" | "_creationTime" | "userId" | "updatedAt"> | null {
  switch (notificationType) {
    case "like":
    case "comment_like":
      return "emailLikes";
    case "comment":
    case "feedback_comment":
      return "emailComments";
    case "follow":
    case "new_follower":
      return "emailFollows";
    case "join":
    case "invite_accepted":
      return "emailChallengeJoins";
    case "achievement":
    case "streak":
      return "emailAchievements";
    case "strava_import":
      return "emailStravaImports";
    case "mini_game_partner_activity":
    case "mini_game_hunter_activity":
    case "mini_game_prey_activity":
      return "emailMiniGames";
    case "admin_comment":
    case "admin_edit":
      return "emailAdmin";
    default:
      return null;
  }
}

/** Build subject line for a notification email. */
export function getNotificationEmailSubject(
  notificationType: string,
  actorName: string,
): string {
  switch (notificationType) {
    case "like":
      return `${actorName} liked your activity`;
    case "comment_like":
      return `${actorName} liked your comment`;
    case "comment":
      return `${actorName} commented on your activity`;
    case "feedback_comment":
      return `${actorName} commented on your feedback`;
    case "follow":
    case "new_follower":
      return `${actorName} started following you`;
    case "join":
      return `${actorName} joined the challenge`;
    case "invite_accepted":
      return `${actorName} joined with your invite link`;
    case "achievement":
      return `You earned an achievement!`;
    case "streak":
      return `Your streak is on fire!`;
    case "strava_import":
      return `Your Strava activity was imported`;
    case "mini_game_partner_activity":
      return `Your partner ${actorName} logged an activity`;
    case "mini_game_hunter_activity":
      return `Your hunter ${actorName} logged an activity`;
    case "mini_game_prey_activity":
      return `Your prey ${actorName} logged an activity`;
    case "admin_comment":
      return `An admin commented on your activity`;
    case "admin_edit":
      return `An admin updated your activity`;
    default:
      return `New notification on March Fitness`;
  }
}

/** Build HTML body for a notification email. */
export function getNotificationEmailHtml(
  notificationType: string,
  actorName: string,
  data?: Record<string, unknown>,
  challengeId?: string,
): string {
  const dashboardUrl = challengeId
    ? `https://march.fit/challenges/${challengeId}/notifications`
    : `https://march.fit`;

  let message: string;

  switch (notificationType) {
    case "like":
      message = `<strong style="color:#e4e4e7;">${actorName}</strong> liked your activity.`;
      break;
    case "comment_like":
      message = `<strong style="color:#e4e4e7;">${actorName}</strong> liked your comment.`;
      break;
    case "comment":
      message = `<strong style="color:#e4e4e7;">${actorName}</strong> commented on your activity.`;
      break;
    case "feedback_comment":
      message = `<strong style="color:#e4e4e7;">${actorName}</strong> commented on your feedback.`;
      break;
    case "follow":
    case "new_follower":
      message = `<strong style="color:#e4e4e7;">${actorName}</strong> started following you.`;
      break;
    case "join":
      message = `<strong style="color:#e4e4e7;">${actorName}</strong> joined the challenge.`;
      break;
    case "invite_accepted":
      message = `<strong style="color:#e4e4e7;">${actorName}</strong> joined the challenge using your invite link.`;
      break;
    case "achievement": {
      const achievementName = data?.achievementName as string | undefined;
      message = achievementName
        ? `You earned the <strong style="color:#e4e4e7;">${achievementName}</strong> achievement!`
        : `You earned an achievement!`;
      break;
    }
    case "streak":
      message = `Your streak is going strong! Keep it up.`;
      break;
    case "strava_import": {
      const activityName = data?.activityName as string | undefined;
      const points = data?.pointsEarned as number | undefined;
      if (activityName && points != null) {
        message = `Your Strava activity <strong style="color:#e4e4e7;">"${activityName}"</strong> was imported — <strong style="color:#e4e4e7;">${points} pts</strong> earned.`;
      } else {
        message = `Your Strava activity was imported successfully.`;
      }
      break;
    }
    case "mini_game_partner_activity": {
      const gameName = data?.miniGameName as string | undefined;
      message = gameName
        ? `Your partner <strong style="color:#e4e4e7;">${actorName}</strong> logged an activity during <strong style="color:#e4e4e7;">${gameName}</strong>.`
        : `Your partner <strong style="color:#e4e4e7;">${actorName}</strong> logged an activity.`;
      break;
    }
    case "mini_game_hunter_activity": {
      const gameName = data?.miniGameName as string | undefined;
      message = gameName
        ? `Your hunter <strong style="color:#e4e4e7;">${actorName}</strong> logged an activity during <strong style="color:#e4e4e7;">${gameName}</strong>. Stay sharp!`
        : `Your hunter <strong style="color:#e4e4e7;">${actorName}</strong> logged an activity. Stay sharp!`;
      break;
    }
    case "mini_game_prey_activity": {
      const gameName = data?.miniGameName as string | undefined;
      message = gameName
        ? `Your prey <strong style="color:#e4e4e7;">${actorName}</strong> logged an activity during <strong style="color:#e4e4e7;">${gameName}</strong>. Time to hunt!`
        : `Your prey <strong style="color:#e4e4e7;">${actorName}</strong> logged an activity. Time to hunt!`;
      break;
    }
    case "admin_comment":
      message = `An admin left a comment on your activity.`;
      break;
    case "admin_edit":
      message = `An admin updated your activity.`;
      break;
    default:
      message = `You have a new notification.`;
  }

  const content = `
    <p style="margin: 0 0 20px;">${message}</p>
    <div style="text-align: center; margin: 28px 0;">
      ${emailButton({ href: dashboardUrl, label: "View Notifications" })}
    </div>
    <p style="margin: 20px 0 0; color: #71717a; font-size: 13px;">You can manage your email notification preferences in your challenge settings.</p>
  `;

  return wrapEmailTemplate({
    headerTitle: getNotificationEmailSubject(notificationType, actorName),
    content,
    footerText: "You\u2019re receiving this because you enabled email notifications on March Fitness.",
  });
}
