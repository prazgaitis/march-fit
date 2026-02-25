import { defineApp } from "convex/server";
import resend from "@convex-dev/resend/convex.config";
import migrations from "@convex-dev/migrations/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";

const app = defineApp();
app.use(resend);
app.use(migrations);
app.use(aggregate, { name: "activityPointsAggregate" });

export default app;
