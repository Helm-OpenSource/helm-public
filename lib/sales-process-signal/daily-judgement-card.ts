/**
 * Sales-process daily judgement card — pure presentation model.
 *
 * Turns alias-only SalesProcessSignals (read-time mapped from existing
 * extraction products; nothing new is persisted) into a decision-first daily
 * card for a salesperson: what must be followed up today, which risks to look
 * at first, which commitments to honor, which objections to answer. Every
 * item is a suggestion (effectMode suggestion_only) pending human review.
 *
 * Honest by construction: zero signals yields Insufficient-Signal instead of
 * a fabricated card, and per-section caps surface a droppedCount rather than
 * truncating silently.
 */

import type { SalesProcessSignal, SalesProcessSignalType } from "./contract";

export const SALES_DAILY_JUDGEMENT_CARD_RULE_VERSION =
  "sales-process-daily-judgement-card/v1" as const;

export const SALES_DAILY_CARD_SECTION_ORDER = [
  "follow_up_today",
  "risks_first",
  "commitments_to_honor",
  "objections_to_answer",
  "need_candidates",
  "deal_outcome_reasons",
] as const;

export type SalesDailyCardSectionKey =
  (typeof SALES_DAILY_CARD_SECTION_ORDER)[number];

export const SALES_DAILY_CARD_MAX_ITEMS_PER_SECTION = 5;

const SECTION_FOR_SIGNAL_TYPE: Record<
  SalesProcessSignalType,
  SalesDailyCardSectionKey
> = {
  follow_up_window: "follow_up_today",
  risk_signal: "risks_first",
  commitment: "commitments_to_honor",
  objection: "objections_to_answer",
  need_candidate: "need_candidates",
  deal_outcome_reason: "deal_outcome_reasons",
};

const SECTION_LABELS: Record<
  SalesDailyCardSectionKey,
  { zh: string; en: string }
> = {
  follow_up_today: { zh: "今天必须跟进", en: "Follow up today" },
  risks_first: { zh: "风险先看", en: "Risks first" },
  commitments_to_honor: { zh: "承诺要兑现", en: "Commitments to honor" },
  objections_to_answer: { zh: "异议要回应", en: "Objections to answer" },
  need_candidates: { zh: "需求候选", en: "Need candidates" },
  deal_outcome_reasons: { zh: "成交 / 流失原因", en: "Deal outcome reasons" },
};

export interface SalesDailyCardItem {
  readonly signalId: string;
  readonly statement: string;
  readonly confidence: number;
  readonly followUpWindowDays?: number;
  readonly evidenceRefs: readonly string[];
  readonly sourceRef: string;
  readonly effectMode: "suggestion_only";
}

export interface SalesDailyCardSection {
  readonly key: SalesDailyCardSectionKey;
  readonly label: string;
  readonly items: readonly SalesDailyCardItem[];
  /** Items beyond the per-section cap — surfaced, never silently dropped. */
  readonly droppedCount: number;
}

export interface SalesDailyJudgementCard {
  readonly ruleVersion: typeof SALES_DAILY_JUDGEMENT_CARD_RULE_VERSION;
  readonly decision: "Card-Ready" | "Insufficient-Signal";
  readonly generatedForIso: string;
  readonly sections: readonly SalesDailyCardSection[];
  readonly totalSignals: number;
  readonly boundaries: readonly string[];
  readonly emptyGuidance: string | null;
}

export const SALES_DAILY_CARD_BOUNDARIES_ZH = [
  "每一条都是建议，不是承诺；客户可见动作必须人工确认",
  "不自动外发、不自动写回、不自动改客户关系系统阶段",
  "证据只以引用呈现，原始录音与全文不进入本卡",
] as const;

export const SALES_DAILY_CARD_BOUNDARIES_EN = [
  "Every item is a suggestion, not a commitment; customer-visible actions require human confirmation",
  "No auto-send, no auto-writeback, no automatic CRM stage changes",
  "Evidence appears as references only; raw audio and transcripts never enter this card",
] as const;

function toItem(signal: SalesProcessSignal): SalesDailyCardItem {
  return {
    signalId: signal.signalId,
    statement: signal.statement,
    confidence: signal.confidence,
    followUpWindowDays: signal.followUpWindowDays,
    evidenceRefs: signal.evidenceRefs,
    sourceRef: signal.sourceRef,
    effectMode: "suggestion_only",
  };
}

function sortItems(
  key: SalesDailyCardSectionKey,
  items: readonly SalesDailyCardItem[],
): readonly SalesDailyCardItem[] {
  const copy = [...items];
  if (key === "follow_up_today") {
    // Most urgent window first; unknown windows sink to the end.
    copy.sort((a, b) => {
      const aw = a.followUpWindowDays ?? Number.POSITIVE_INFINITY;
      const bw = b.followUpWindowDays ?? Number.POSITIVE_INFINITY;
      if (aw !== bw) return aw - bw;
      return b.confidence - a.confidence;
    });
    return copy;
  }
  copy.sort((a, b) => b.confidence - a.confidence);
  return copy;
}

export function buildSalesDailyJudgementCard(input: {
  english: boolean;
  generatedForIso: string;
  signals: readonly SalesProcessSignal[];
}): SalesDailyJudgementCard {
  const { english, generatedForIso, signals } = input;
  const boundaries = english
    ? [...SALES_DAILY_CARD_BOUNDARIES_EN]
    : [...SALES_DAILY_CARD_BOUNDARIES_ZH];

  if (signals.length === 0) {
    return {
      ruleVersion: SALES_DAILY_JUDGEMENT_CARD_RULE_VERSION,
      decision: "Insufficient-Signal",
      generatedForIso,
      sections: [],
      totalSignals: 0,
      boundaries,
      emptyGuidance: english
        ? "No sales-process signal has been captured yet. Record a conversation or ingest meeting notes first; this card never fabricates items."
        : "还没有捕获到销售过程信号。先录一段对话或导入会议纪要；本卡不会编造条目。",
    };
  }

  const grouped = new Map<SalesDailyCardSectionKey, SalesDailyCardItem[]>();
  for (const signal of signals) {
    const key = SECTION_FOR_SIGNAL_TYPE[signal.signalType];
    const bucket = grouped.get(key) ?? [];
    bucket.push(toItem(signal));
    grouped.set(key, bucket);
  }

  const sections: SalesDailyCardSection[] = SALES_DAILY_CARD_SECTION_ORDER.flatMap(
    (key) => {
      const bucket = grouped.get(key);
      if (!bucket || bucket.length === 0) return [];
      const sorted = sortItems(key, bucket);
      return [
        {
          key,
          label: english ? SECTION_LABELS[key].en : SECTION_LABELS[key].zh,
          items: sorted.slice(0, SALES_DAILY_CARD_MAX_ITEMS_PER_SECTION),
          droppedCount: Math.max(
            0,
            sorted.length - SALES_DAILY_CARD_MAX_ITEMS_PER_SECTION,
          ),
        },
      ];
    },
  );

  return {
    ruleVersion: SALES_DAILY_JUDGEMENT_CARD_RULE_VERSION,
    decision: "Card-Ready",
    generatedForIso,
    sections,
    totalSignals: signals.length,
    boundaries,
    emptyGuidance: null,
  };
}
