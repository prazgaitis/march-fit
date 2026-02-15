# Challenge Admin Guide — Managing via AI Chat

This guide is for challenge administrators who want to manage their March Fit challenges from an AI assistant (Claude, ChatGPT, etc.) using MCP. For initial MCP setup, see the [MCP Guide](mcp-guide.md).

## Overview

As a challenge admin, you can perform most administration tasks through natural conversation with your AI assistant. This includes reviewing flagged activities, managing activity types, updating challenge settings, and moderating participants — all without opening the web dashboard.

## Quick Reference

### Flagged Activity Review

| What you want to do | What to say |
|----------------------|-------------|
| See pending flags | "Show me flagged activities for my challenge" |
| Get flag details | "Show me the details on that flagged activity" |
| Resolve a flag | "Resolve that flag — the activity looks legitimate" |
| Re-open a flag | "Re-open that flag, I need to investigate more" |
| Add an internal note | "Add an admin note: 'Checked Strava — times match'" |
| Add a note visible to the user | "Send a public comment to the user: 'Can you clarify the distance?'" |
| Edit a flagged activity | "Change the points on that activity to 10" |
| Delete a problematic activity | "Delete that activity" |

### Activity Type Management

| What you want to do | What to say |
|----------------------|-------------|
| List current types | "What activity types are in my challenge?" |
| Create a new type | "Add a new activity type called 'Yoga' worth 8 points" |
| Update scoring | "Change the Running type to 5 points per mile" |
| Set weekly restrictions | "Make the 'PR Bonus' type only available in week 3" |
| Set a cap | "Limit the 'Welcome Bonus' type to 1 per challenge" |

### Challenge Settings

| What you want to do | What to say |
|----------------------|-------------|
| View challenge details | "Show me the details for my challenge" |
| Update the name | "Rename the challenge to 'Spring Fitness 2026'" |
| Change dates | "Extend the challenge end date to April 30" |
| Set an announcement | "Post an announcement: 'Week 3 theme: outdoor activities!'" |
| Clear the announcement | "Clear the current announcement" |
| Change streak threshold | "Set the minimum daily points for streaks to 5" |

### Participant Management

| What you want to do | What to say |
|----------------------|-------------|
| List participants | "Who's in my challenge?" |
| Check the leaderboard | "Show me the current leaderboard" |
| Promote someone to admin | "Make Alice an admin for this challenge" |
| Demote someone to member | "Change Bob's role back to member" |

---

## Detailed Workflows

### Reviewing Flagged Activities

When participants flag suspicious activities, you'll see them in the pending queue. Here's a typical review workflow:

**1. Check for pending flags**

> "Are there any pending flagged activities in [challenge name]?"

The AI will call `list_flagged_activities` and show you a summary of each flag including who flagged it, the reason, and the activity details.

**2. Investigate a specific flag**

> "Show me the full details on the first flagged activity"

This returns the complete activity record, flag history, any prior admin comments, and the participant's info.

**3. Take action**

If the activity is legitimate:
> "Resolve that flag with a note: 'Verified against Strava data — activity is valid'"

If the activity needs correction:
> "Edit that activity — change the distance to 3.1 miles and add a note: 'Corrected distance per Strava GPS data'"

If the activity should be removed:
> "Delete that activity"

If you need to ask the participant:
> "Add a public comment: 'Hi! Can you confirm the distance for this run? It seems higher than your Strava recording.'"

**4. Verify the queue is clear**
> "Any remaining pending flags?"

### Managing Activity Types

Activity types define what participants can log and how points are calculated.

**Creating a fixed-points activity type:**

> "Create a new activity type called 'Meditation' with these settings: 5 fixed points, contributes to streak, not negative"

The AI will call `create_activity_type` with:
```json
{
  "name": "Meditation",
  "scoringConfig": { "type": "fixed", "points": 5 },
  "contributesToStreak": true,
  "isNegative": false
}
```

**Creating a per-unit activity type with bonuses:**

> "Create an activity type called 'Running' that gives 3 points per mile, contributes to streak, with a bonus: 10 extra points for runs over 13.1 miles (half marathon)"

```json
{
  "name": "Running",
  "scoringConfig": { "type": "per_unit", "metric": "miles", "pointsPerUnit": 3 },
  "contributesToStreak": true,
  "isNegative": false,
  "bonusThresholds": [
    { "metric": "miles", "threshold": 13.1, "bonusPoints": 10, "description": "Half marathon bonus" }
  ]
}
```

**Creating a week-restricted activity type:**

> "Create a 'PR Week Bonus' type worth 15 points, only available during week 2, max 1 per challenge"

```json
{
  "name": "PR Week Bonus",
  "scoringConfig": { "type": "fixed", "points": 15 },
  "contributesToStreak": false,
  "isNegative": false,
  "validWeeks": [2],
  "maxPerChallenge": 1
}
```

**Updating an existing activity type:**

> "Update the 'Running' activity type to give 4 points per mile instead of 3"

### Setting Announcements

Announcements appear as a banner at the top of the challenge page for all participants.

> "Set the announcement for my challenge to: 'Reminder: This week's theme is outdoor activities. Double points for hiking and cycling!'"

To clear it:
> "Clear the announcement for my challenge"

### Editing Activities

As an admin, you can edit any participant's activity. Common scenarios:

**Correcting points:**
> "Change the points on activity [id] to 25"

**Changing the activity type:**
> "Change that activity's type from 'Walking' to 'Hiking'"

**Fixing a logged date:**
> "Move that activity to February 10th"

**Adding admin notes:**
> "Update the notes on that activity to 'Adjusted per participant request'"

All admin edits are logged in the activity's audit history and the participant receives a notification.

### Creating a Challenge

You can create new challenges entirely from chat:

> "Create a new challenge called 'April Fitness 2026' starting April 1, ending April 30, 30 days, with a streak minimum of 5 points"

After creating the challenge, you'll want to add activity types:

> "Now add these activity types to the new challenge:
> - Running: 3 points per mile, contributes to streak
> - Cycling: 2 points per mile, contributes to streak
> - Yoga: 8 fixed points, contributes to streak
> - Rest Day Penalty: -3 fixed points, negative, does not contribute to streak"

---

## Tips

- **Use challenge names** in your requests. The AI will look up the ID for you.
- **Be specific** about what you want to change. "Update the scoring" is ambiguous; "Change Running to 4 points per mile" is clear.
- **Review before bulk actions.** Ask to see the current state before making changes: "Show me all activity types" before updating them.
- **Internal vs. public comments.** By default, admin comments are internal (only visible to admins). Say "public comment" or "visible to the user" if you want the participant to see it.
- **Audit trail.** All admin actions (edits, comments, resolutions) are recorded in the activity's flag history. This happens automatically.

## Tool Reference

| Tool | Required Role | Description |
|------|---------------|-------------|
| `me` | any | Your profile and challenges |
| `list_challenges` | any | List challenges you can see |
| `get_challenge` | any | Single challenge details |
| `challenge_leaderboard` | any | Leaderboard rankings |
| `list_activities` | any | Activity feed (paginated) |
| `list_activity_types` | any | Activity types with scoring config |
| `list_participants` | any | Participants with roles and scores |
| `log_activity` | any | Log an activity |
| `get_activity` | any | Single activity detail |
| `delete_activity` | owner/admin | Delete an activity |
| `update_challenge` | admin | Update challenge settings |
| `set_announcement` | admin | Set/clear announcement banner |
| `update_participant_role` | admin | Change participant role |
| `list_flagged_activities` | admin | List flagged activities |
| `get_flagged_activity` | admin | Flagged activity details + history |
| `resolve_flagged_activity` | admin | Resolve or re-open a flag |
| `add_admin_comment` | admin | Comment on a flagged activity |
| `admin_edit_activity` | admin | Edit any activity's details |
| `create_activity_type` | admin | Create a new activity type |
| `update_activity_type` | admin | Modify an activity type |

## See Also

- [MCP Setup Guide](mcp-guide.md) — connecting your AI assistant to March Fit
- [Web Admin Console](https://march.fit) — the full web-based admin dashboard
