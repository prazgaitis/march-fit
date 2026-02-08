import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "@repo/backend";
import { dateOnlyToUtcMs } from "@/lib/date-only";

let _convex: ConvexHttpClient | null = null;
function getConvex() {
  if (!_convex) {
    _convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  }
  return _convex;
}

interface StravaWebhookEvent {
  aspect_type: "create" | "update" | "delete";
  event_time: number;
  object_id: number;
  object_type: "activity" | "athlete";
  owner_id: number;
  subscription_id: number;
  updates?: {
    title?: string;
    type?: string;
    private?: boolean;
    authorized?: boolean;
  };
}

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  elapsed_time: number;
  moving_time: number;
  distance?: number;
  average_speed?: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain?: number;
  kudos_count: number;
  achievement_count: number;
  athlete_count: number;
  photo_count: number;
  private: boolean;
  flagged: boolean;
}

/**
 * Webhook verification endpoint (GET)
 * Called by Strava when setting up webhook subscription
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    // Verify the webhook subscription
    if (mode === "subscribe" && token === process.env.STRAVA_VERIFY_TOKEN) {
      console.log("Strava webhook subscription verified");
      return NextResponse.json({ "hub.challenge": challenge });
    }

    return NextResponse.json(
      { error: "Invalid verification token" },
      { status: 403 }
    );
  } catch (error) {
    console.error("Error verifying webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Webhook event handler (POST)
 * Called by Strava when activities are created/updated/deleted
 */
export async function POST(request: NextRequest) {
  try {
    console.log("=== Strava Webhook: Starting processing ===");
    const body = (await request.json()) as StravaWebhookEvent;
    console.log("Webhook event:", {
      aspect_type: body.aspect_type,
      object_type: body.object_type,
      object_id: body.object_id,
      owner_id: body.owner_id,
    });

    // Only process activity events
    if (body.object_type !== "activity") {
      console.log("Ignoring non-activity event:", body.object_type);
      return NextResponse.json({ received: true });
    }

    // Find user by Strava athlete ID
    const integrationData = await getConvex().query(
      internal.queries.integrations.getByAthleteId,
      { athleteId: body.owner_id }
    );

    if (!integrationData) {
      console.log("No user found for Strava athlete:", body.owner_id);
      // Return 200 to acknowledge receipt (don't retry)
      return NextResponse.json({ received: true, user_found: false });
    }

    const { integration, user } = integrationData;
    console.log("Found user:", { userId: user._id, athleteId: body.owner_id });

    // Handle delete event
    if (body.aspect_type === "delete") {
      console.log("Processing delete for activity:", body.object_id);
      const result = await getConvex().mutation(
        internal.mutations.stravaWebhook.deleteFromStrava,
        { externalId: body.object_id.toString() }
      );
      console.log("Delete result:", result);
      return NextResponse.json({
        received: true,
        deleted: result.deleted,
      });
    }

    // For create/update, we need to fetch activity details
    // First, check if token needs refresh
    let accessToken = integration.accessToken;
    if (!accessToken || !integration.refreshToken || !integration.expiresAt) {
      console.error("Missing token data for integration:", integration._id);
      return NextResponse.json(
        { error: "Integration missing token data" },
        { status: 500 }
      );
    }

    // Refresh token if needed
    const refreshedToken = await getConvex().action(
      api.actions.strava.refreshToken,
      {
        integrationId: integration._id,
        currentExpiresAt: integration.expiresAt,
        refreshToken: integration.refreshToken,
      }
    );

    if (refreshedToken) {
      accessToken = refreshedToken;
    }

    // Fetch activity details from Strava
    console.log("Fetching activity details from Strava:", body.object_id);
    const activity = (await getConvex().action(api.actions.strava.fetchActivity, {
      accessToken: accessToken!,
      activityId: body.object_id,
    })) as StravaActivity;

    console.log("Activity details:", {
      id: activity.id,
      name: activity.name,
      type: activity.type,
      sport_type: activity.sport_type,
      date: activity.start_date,
    });

    // Get user's challenge participations
    const participations = await getConvex().query(
      internal.mutations.stravaWebhook.getUserParticipations,
      { userId: user._id }
    );

    if (!participations || participations.length === 0) {
      console.log("No active challenges for user:", user._id);
      return NextResponse.json({
        received: true,
        processed_challenges: 0,
      });
    }

    console.log("Found challenge participations:", participations.length);

    // Process each challenge
    const activityDate = new Date(activity.start_date);
    const activityDateTs = activityDate.getTime();
    let processedChallenges = 0;

    for (const { challenge } of participations) {
      if (!challenge) continue;

      const challengeStartMs = dateOnlyToUtcMs(challenge.startDate);
      const challengeEndMs = dateOnlyToUtcMs(challenge.endDate);

      // Check if activity date is within challenge bounds
      if (activityDateTs < challengeStartMs || activityDateTs > challengeEndMs) {
        console.log("Activity outside challenge dates:", {
          activity_date: activity.start_date,
          challenge_start: challenge.startDate,
          challenge_end: challenge.endDate,
        });
        continue;
      }

      console.log("Processing activity for challenge:", challenge._id);

      // Create/update activity
      const result = await getConvex().mutation(
        internal.mutations.stravaWebhook.createFromStrava,
        {
          userId: user._id,
          challengeId: challenge._id,
          stravaActivity: activity,
        }
      );

      if (result) {
        processedChallenges++;
        console.log("Successfully processed activity for challenge:", challenge._id);
      } else {
        console.log("No matching activity type for challenge:", challenge._id);
      }
    }

    console.log(
      `=== Strava Webhook: Completed (processed ${processedChallenges} challenges) ===`
    );

    return NextResponse.json({
      received: true,
      processed_challenges: processedChallenges,
    });
  } catch (error) {
    console.error("=== Strava Webhook: Error ===", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
