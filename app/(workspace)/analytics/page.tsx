import { getCurrentWorkspace } from "@/lib/auth/session";
import { AnalyticsClient } from "@/features/analytics/analytics-client";
import { getAnalyticsOverview } from "@/features/analytics/queries";

export default async function AnalyticsPage() {
  const workspace = await getCurrentWorkspace();
  const data = await getAnalyticsOverview(workspace.id);

  return <AnalyticsClient data={data} />;
}
