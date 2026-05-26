import { db } from "@/lib/db";

export async function getLLMOverview(workspaceId: string, since?: Date) {
  const logs = await db.lLMCallLog.findMany({
    where: {
      workspaceId,
      ...(since
        ? {
            createdAt: {
              gte: since,
            },
          }
        : {}),
    },
    include: {
      user: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 80,
  });

  const totalPromptTokens = logs.reduce((sum, item) => sum + (item.tokenUsagePrompt ?? 0), 0);
  const totalCompletionTokens = logs.reduce((sum, item) => sum + (item.tokenUsageCompletion ?? 0), 0);
  const successfulLogs = logs.filter((item) => item.success);
  const averageLatencyMs = successfulLogs.length
    ? Math.round(successfulLogs.reduce((sum, item) => sum + (item.latencyMs ?? 0), 0) / successfulLogs.length)
    : 0;

  const taskBreakdown = Object.entries(
    logs.reduce<Record<string, number>>((acc, item) => {
      acc[item.taskType] = (acc[item.taskType] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([taskType, count]) => ({ taskType, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const promptBreakdown = Object.entries(
    logs.reduce<Record<string, number>>((acc, item) => {
      const key = item.promptKey ? `${item.promptKey}@${item.promptVersion}` : item.promptVersion;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([promptKey, count]) => ({ promptKey, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const fallbackBreakdown = Object.entries(
    logs.reduce<Record<string, number>>((acc, item) => {
      if (!item.fallbackReason) return acc;
      acc[item.fallbackReason] = (acc[item.fallbackReason] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const providerBreakdown = Object.entries(
    logs.reduce<Record<string, number>>((acc, item) => {
      const key = `${item.provider}:${item.model}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([providerModel, count]) => ({ providerModel, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  return {
    totalCalls: logs.length,
    successCount: logs.filter((item) => item.success).length,
    fallbackCount: logs.filter((item) => !item.success).length,
    averageLatencyMs,
    totalPromptTokens,
    totalCompletionTokens,
    taskBreakdown,
    promptBreakdown,
    fallbackBreakdown,
    providerBreakdown,
    recentLogs: logs.slice(0, 16),
  };
}
