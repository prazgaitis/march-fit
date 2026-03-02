import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Cron-only affinity updates keep likes/comments writes lightweight.
crons.interval(
  "recompute-user-affinities",
  { minutes: 15 },
  internal.mutations.follows.recomputeAffinitiesFromInteractions,
  {},
);

export default crons;
