import { db } from "@/lib/db";

export async function getCaptureObservabilityOverview(workspaceId: string, since?: Date) {
  const [sessions, transcripts] = await Promise.all([
    db.captureSession.findMany({
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
      orderBy: {
        createdAt: "desc",
      },
      take: 60,
      select: {
        id: true,
        title: true,
        status: true,
        durationSeconds: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
    db.conversationTranscript.findMany({
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
      orderBy: {
        createdAt: "desc",
      },
      take: 60,
      select: {
        id: true,
        sourceType: true,
        provider: true,
        model: true,
        language: true,
        confidence: true,
        createdAt: true,
      },
    }),
  ]);

  const completedSessions = sessions.filter((item) => item.status === "COMPLETED");
  const failedSessions = sessions.filter((item) => item.status === "FAILED");
  const averageDurationSeconds = completedSessions.length
    ? Math.round(
        completedSessions.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0) / completedSessions.length,
      )
    : 0;

  const transcriptSourceBreakdown = Object.entries(
    transcripts.reduce<Record<string, number>>((acc, item) => {
      acc[item.sourceType] = (acc[item.sourceType] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([sourceType, count]) => ({ sourceType, count }))
    .sort((left, right) => right.count - left.count);

  const languageBreakdown = Object.entries(
    transcripts.reduce<Record<string, number>>((acc, item) => {
      acc[item.language] = (acc[item.language] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([language, count]) => ({ language, count }))
    .sort((left, right) => right.count - left.count);

  const providerBreakdown = Object.entries(
    transcripts.reduce<Record<string, number>>((acc, item) => {
      const key = item.provider ? `${item.provider}:${item.model ?? "unknown"}` : item.sourceType;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([provider, count]) => ({ provider, count }))
    .sort((left, right) => right.count - left.count);

  const averageConfidence = transcripts.length
    ? Math.round(transcripts.reduce((sum, item) => sum + (item.confidence ?? 0), 0) / transcripts.length)
    : 0;

  return {
    totalSessions: sessions.length,
    completedSessions: completedSessions.length,
    failedSessions: failedSessions.length,
    averageDurationSeconds,
    transcriptSourceBreakdown,
    languageBreakdown,
    providerBreakdown,
    averageConfidence,
    recentFailures: failedSessions.slice(0, 5),
  };
}
