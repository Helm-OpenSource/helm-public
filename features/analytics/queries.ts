import { eachDayOfInterval, endOfDay, format, startOfDay, subDays } from "date-fns";
import { db } from "@/lib/db";
import { getMemoryExtractionQualityOverview } from "@/lib/evals/memory-evals";
import { getRecommendationQualityOverview } from "@/lib/evals/recommendation-evals";
import { getLLMOverview } from "@/lib/observability/llm-metrics.service";
import { safeParseJson } from "@/lib/utils";

function sumEventCount(eventLogs: Array<{ eventName: string }>, eventName: string) {
  return eventLogs.filter((event) => event.eventName === eventName).length;
}

function sumEditedApprovals(eventLogs: Array<{ eventName: string; metadata: string | null }>) {
  return eventLogs.filter((event) => {
    if (event.eventName !== "recommendation_feedback_submitted") return false;
    const metadata = safeParseJson<Record<string, unknown> | null>(event.metadata, null);
    return metadata?.feedbackType === "EDITED_AND_APPROVED";
  }).length;
}

export async function getAnalyticsOverview(workspaceId: string) {
  const today = startOfDay(new Date());
  const windowStart = startOfDay(subDays(today, 6));
  const windowEnd = endOfDay(new Date());

  const [snapshots, eventLogs, llmOverview, recommendationQuality, memoryQuality] = await Promise.all([
    db.dailyUsageSnapshot.findMany({
      where: {
        workspaceId,
        date: {
          gte: windowStart,
          lte: today,
        },
      },
      include: {
        user: true,
      },
      orderBy: [{ date: "asc" }],
    }),
    db.eventLog.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    }),
    getLLMOverview(workspaceId, windowStart),
    getRecommendationQualityOverview(workspaceId, windowStart),
    getMemoryExtractionQualityOverview(workspaceId, windowStart),
  ]);

  const days = eachDayOfInterval({ start: windowStart, end: today }).map((date) => {
    const key = format(date, "yyyy-MM-dd");
    const scoped = snapshots.filter((item) => format(item.date, "yyyy-MM-dd") === key);

    return {
      key,
      label: format(date, "MM/dd"),
      loginCount: scoped.reduce((sum, item) => sum + item.loginCount, 0),
      approvalsSubmitted: scoped.reduce((sum, item) => sum + item.approvalsSubmitted, 0),
      approvalsApproved: scoped.reduce((sum, item) => sum + item.approvalsApproved, 0),
      approvalsRejected: scoped.reduce((sum, item) => sum + item.approvalsRejected, 0),
      opportunityStageChanges: scoped.reduce((sum, item) => sum + item.opportunityStageChanges, 0),
      followupDraftsGenerated: scoped.reduce((sum, item) => sum + item.followupDraftsGenerated, 0),
      recommendationGenerated: eventLogs.filter((event) => format(event.createdAt, "yyyy-MM-dd") === key && event.eventName === "recommendation_generated").length,
      recommendationExplanationViewed: eventLogs.filter((event) => format(event.createdAt, "yyyy-MM-dd") === key && event.eventName === "recommendation_explanation_viewed").length,
      recommendationActionCreated: eventLogs.filter((event) => format(event.createdAt, "yyyy-MM-dd") === key && event.eventName === "recommendation_action_created").length,
      recommendationAccepted: eventLogs.filter((event) => format(event.createdAt, "yyyy-MM-dd") === key && event.eventName === "recommendation_accepted").length,
      recommendationRejected: eventLogs.filter((event) => format(event.createdAt, "yyyy-MM-dd") === key && event.eventName === "recommendation_rejected").length,
    };
  });

  const topEvents = Object.entries(
    eventLogs.reduce<Record<string, number>>((acc, event) => {
      acc[event.eventName] = (acc[event.eventName] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([eventName, count]) => ({ eventName, count: Number(count) }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 10);

  const userUsageBuckets = Array.from(
    snapshots.reduce(
      (acc, snapshot) => {
        const bucket = acc.get(snapshot.userId) ?? {
          user: snapshot.user,
          loginCount: 0,
          dashboardViewCount: 0,
          meetingViewCount: 0,
          actionItemsGenerated: 0,
          approvalsSubmitted: 0,
          approvalsApproved: 0,
          approvalsRejected: 0,
          opportunityStageChanges: 0,
          followupDraftsGenerated: 0,
          policyChanges: 0,
        };

        bucket.loginCount += snapshot.loginCount;
        bucket.dashboardViewCount += snapshot.dashboardViewCount;
        bucket.meetingViewCount += snapshot.meetingViewCount;
        bucket.actionItemsGenerated += snapshot.actionItemsGenerated;
        bucket.approvalsSubmitted += snapshot.approvalsSubmitted;
        bucket.approvalsApproved += snapshot.approvalsApproved;
        bucket.approvalsRejected += snapshot.approvalsRejected;
        bucket.opportunityStageChanges += snapshot.opportunityStageChanges;
        bucket.followupDraftsGenerated += snapshot.followupDraftsGenerated;
        bucket.policyChanges += snapshot.policyChanges;

        acc.set(snapshot.userId, bucket);
        return acc;
      },
      new Map<
        string,
        {
          user: { id: string; name: string; email: string };
          loginCount: number;
          dashboardViewCount: number;
          meetingViewCount: number;
          actionItemsGenerated: number;
          approvalsSubmitted: number;
          approvalsApproved: number;
          approvalsRejected: number;
          opportunityStageChanges: number;
          followupDraftsGenerated: number;
          policyChanges: number;
        }
      >(),
    ).values(),
  );

  const userUsage = userUsageBuckets
    .map((item) => ({
      ...item,
      totalSignals:
        item.dashboardViewCount +
        item.meetingViewCount +
        item.actionItemsGenerated +
        item.approvalsSubmitted +
        item.approvalsApproved +
        item.opportunityStageChanges +
        item.followupDraftsGenerated +
        item.policyChanges,
    }))
    .sort((left, right) => right.totalSignals - left.totalSignals);

  const todayActiveUsers = new Set(
    snapshots
      .filter((snapshot) => format(snapshot.date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd"))
      .filter((snapshot) =>
        snapshot.loginCount +
        snapshot.dashboardViewCount +
        snapshot.meetingViewCount +
        snapshot.actionItemsGenerated +
        snapshot.approvalsSubmitted +
        snapshot.approvalsApproved +
        snapshot.approvalsRejected +
        snapshot.opportunityStageChanges +
        snapshot.followupDraftsGenerated +
        snapshot.policyChanges > 0,
      )
      .map((snapshot) => snapshot.userId),
  ).size;

  const recommendationOverview = {
    generated: sumEventCount(eventLogs, "recommendation_generated"),
    cardViewed: sumEventCount(eventLogs, "recommendation_card_viewed"),
    explanationViewed: sumEventCount(eventLogs, "recommendation_explanation_viewed"),
    actionCreated: sumEventCount(eventLogs, "recommendation_action_created"),
    accepted: sumEventCount(eventLogs, "recommendation_accepted"),
    rejected: sumEventCount(eventLogs, "recommendation_rejected"),
    editedApproved: sumEditedApprovals(eventLogs),
  };

  const captureOverview = {
    started: sumEventCount(eventLogs, "capture_started"),
    audioUploaded: sumEventCount(eventLogs, "capture_audio_uploaded"),
    transcriptGenerated: sumEventCount(eventLogs, "transcript_generated"),
    insightsGenerated: sumEventCount(eventLogs, "conversation_insights_generated"),
    memoryWritten: sumEventCount(eventLogs, "capture_memory_written"),
    recommendationsRefreshed: sumEventCount(eventLogs, "capture_recommendations_refreshed"),
    actionsCreated: sumEventCount(eventLogs, "capture_actions_created"),
    processingCompleted: sumEventCount(eventLogs, "capture_processing_completed"),
    failed: sumEventCount(eventLogs, "conversation_capture_failed"),
  };

  return {
    todayActiveUsers,
    days,
    topEvents,
    userUsage,
    recentEvents: eventLogs.slice(0, 20),
    recommendationOverview,
    recommendationQuality,
    captureOverview,
    memoryQuality,
    llmOverview,
  };
}
