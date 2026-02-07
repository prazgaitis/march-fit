export interface StravaActivity {
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

export interface LogActivityData {
  challengeId: string;
  activityTypeId: string;
  loggedDate: string;
  metrics: Record<string, unknown>;
  notes: string | null;
  imageUrl: string | null;
  source: "strava";
  externalId: string;
  externalData: StravaActivity;
}

export type ActivityTypeFetcher = (challengeId: string) => Promise<Array<{ id: string; name: string }>>;

export class StravaActivityMapper {
  constructor(
    private readonly challengeId: string,
    private readonly _userId: string,
    private readonly fetchActivityTypes?: ActivityTypeFetcher
  ) {}

  async mapActivity(
    stravaActivity: StravaActivity,
    activityTypeId: string
  ): Promise<LogActivityData> {
    const loggedDate = new Date(stravaActivity.start_date)
      .toISOString()
      .split('T')[0];

    const metrics = this.extractMetrics(stravaActivity);

    return {
      challengeId: this.challengeId,
      activityTypeId,
      loggedDate,
      metrics,
      notes: null,
      imageUrl: null,
      source: "strava",
      externalId: stravaActivity.id.toString(),
      externalData: stravaActivity,
    };
  }

  async detectActivityType(stravaActivity: StravaActivity): Promise<string | null> {
    const sportTypeMapping: Record<string, string[]> = {
      'Running': ['Run', 'TrailRun', 'VirtualRun'],
      'Cycling': ['Ride', 'VirtualRide', 'EBikeRide'],
      'Swimming': ['Swim'],
      'Strength Training': ['WeightTraining', 'Workout'],
      'Walking': ['Walk', 'Hike'],
      'Yoga': ['Yoga'],
    };

    if (!this.fetchActivityTypes) {
      throw new Error('fetchActivityTypes is required for detectActivityType');
    }

    // Try to find activity type by sport_type first, then by type
    for (const [activityName, stravaTypes] of Object.entries(sportTypeMapping)) {
      if (
        stravaTypes.includes(stravaActivity.sport_type) ||
        stravaTypes.includes(stravaActivity.type)
      ) {
        const allActivityTypes = await this.fetchActivityTypes(this.challengeId);

        // Look for a matching activity type by name
        const matchingType = allActivityTypes.find(type =>
          type.name.toLowerCase().includes(activityName.toLowerCase())
        );

        if (matchingType) {
          return matchingType.id;
        }
      }
    }

    return null;
  }

  private extractMetrics(stravaActivity: StravaActivity): Record<string, unknown> {
    const metrics: Record<string, unknown> = {};

    // Always include duration in minutes
    metrics.minutes = Math.round(stravaActivity.elapsed_time / 60);

    // Add distance if available (convert from meters to km)
    if (stravaActivity.distance) {
      metrics.distance_km = stravaActivity.distance / 1000;
    }

    // Add heart rate data if available
    if (stravaActivity.average_heartrate) {
      metrics.average_heartrate = stravaActivity.average_heartrate;
    }
    if (stravaActivity.max_heartrate) {
      metrics.max_heartrate = stravaActivity.max_heartrate;
    }

    // Add elevation if available
    if (stravaActivity.total_elevation_gain) {
      metrics.elevation_gain_m = stravaActivity.total_elevation_gain;
    }

    // Activity-specific metrics
    if (this.isRunningActivity(stravaActivity)) {
      this.addRunningMetrics(metrics, stravaActivity);
    } else if (this.isCyclingActivity(stravaActivity)) {
      this.addCyclingMetrics(metrics, stravaActivity);
    } else if (this.isSwimmingActivity(stravaActivity)) {
      this.addSwimmingMetrics(metrics, stravaActivity);
    }

    return metrics;
  }

  private isRunningActivity(activity: StravaActivity): boolean {
    return ['Run', 'TrailRun', 'VirtualRun'].includes(activity.sport_type) ||
           ['Run', 'TrailRun', 'VirtualRun'].includes(activity.type);
  }

  private isCyclingActivity(activity: StravaActivity): boolean {
    return ['Ride', 'VirtualRide', 'EBikeRide'].includes(activity.sport_type) ||
           ['Ride', 'VirtualRide', 'EBikeRide'].includes(activity.type);
  }

  private isSwimmingActivity(activity: StravaActivity): boolean {
    return ['Swim'].includes(activity.sport_type) ||
           ['Swim'].includes(activity.type);
  }

  private addRunningMetrics(metrics: Record<string, unknown>, activity: StravaActivity): void {
    if (activity.distance && activity.elapsed_time) {
      metrics.average_pace_min_per_km = this.calculateRunningPace(
        activity.distance,
        activity.elapsed_time
      );
    }
  }

  private addCyclingMetrics(metrics: Record<string, unknown>, activity: StravaActivity): void {
    if (activity.average_speed) {
      metrics.average_speed_kmh = this.convertSpeedToKmh(activity.average_speed);
    }
  }

  private addSwimmingMetrics(metrics: Record<string, unknown>, activity: StravaActivity): void {
    if (activity.distance && activity.moving_time) {
      metrics.average_pace_min_per_100m = this.calculateSwimmingPace(
        activity.distance,
        activity.moving_time
      );
    }
  }

  calculateRunningPace(distanceMeters: number, timeSeconds: number): string {
    const distanceKm = distanceMeters / 1000;
    const paceSecondsPerKm = timeSeconds / distanceKm;
    const minutes = Math.floor(paceSecondsPerKm / 60);
    const seconds = Math.round(paceSecondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  calculateSwimmingPace(distanceMeters: number, timeSeconds: number): string {
    const distance100m = distanceMeters / 100;
    const pacePer100m = timeSeconds / distance100m;
    const minutes = Math.floor(pacePer100m / 60);
    const seconds = Math.round(pacePer100m % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  convertSpeedToKmh(speedMs: number): string {
    const speedKmh = speedMs * 3.6;
    return speedKmh.toFixed(1);
  }
}
