/**
 * Read-time loader for the sales-process daily judgement card.
 *
 * Loads the current user's recent conversation insights (scoped by
 * CaptureSession.userId within the workspace), maps them through the pure
 * alias-only SalesProcessSignal mappers, and builds the daily card. Nothing
 * is persisted; hygiene-suppressed and unclassifiable insights are simply
 * not shown (they stay available for human review at their source).
 */

import { db } from "@/lib/db";
import {
  mapConversationInsightToSalesProcessSignal,
  type ConversationInsightTypeLike,
} from "./mappers";
import type { SalesProcessSignal } from "./contract";
import {
  buildSalesDailyJudgementCard,
  type SalesDailyJudgementCard,
} from "./daily-judgement-card";

export const SALES_DAILY_CARD_LOOKBACK_DAYS = 14;
export const SALES_DAILY_CARD_MAX_INSIGHTS = 200;

export async function getSalesDailyJudgementCardForUser(input: {
  workspaceId: string;
  userId: string;
  english: boolean;
  now: Date;
}): Promise<SalesDailyJudgementCard> {
  const since = new Date(
    input.now.getTime() - SALES_DAILY_CARD_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );

  const insights = await db.conversationInsight.findMany({
    where: {
      workspaceId: input.workspaceId,
      createdAt: { gte: since },
      captureSession: { userId: input.userId },
    },
    select: {
      id: true,
      insightType: true,
      title: true,
      confidence: true,
      sourceSegmentRefs: true,
    },
    orderBy: { createdAt: "desc" },
    take: SALES_DAILY_CARD_MAX_INSIGHTS,
  });

  const signals: SalesProcessSignal[] = insights.flatMap((insight) => {
    const result = mapConversationInsightToSalesProcessSignal(
      {
        id: insight.id,
        insightType: insight.insightType as ConversationInsightTypeLike,
        title: insight.title,
        confidence: insight.confidence,
        sourceSegmentRefs: insight.sourceSegmentRefs,
      },
      {
        aliases: { workspace: `workspace:${input.workspaceId}` },
      },
    );
    return result.signal ? [result.signal] : [];
  });

  return buildSalesDailyJudgementCard({
    english: input.english,
    generatedForIso: input.now.toISOString(),
    signals,
  });
}
