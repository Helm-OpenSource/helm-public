import { describe, expect, it } from "vitest";

import type { SalesProcessSignal } from "./contract";
import {
  SALES_DAILY_CARD_MAX_ITEMS_PER_SECTION,
  SALES_DAILY_CARD_SECTION_ORDER,
  SALES_DAILY_JUDGEMENT_CARD_RULE_VERSION,
  buildSalesDailyJudgementCard,
} from "./daily-judgement-card";

function signal(
  overrides: Partial<SalesProcessSignal> & { signalId: string },
): SalesProcessSignal {
  return {
    contractVersion: "sales-process-signal/v1",
    signalType: "commitment",
    statement: "买方同意评估试用",
    sourceKind: "conversation_insight",
    sourceRef: `conversation_insight:${overrides.signalId}`,
    evidenceRefs: ["segment:1"],
    aliases: { workspace: "workspace_alias_internal" },
    confidence: 70,
    reviewPosture: "review_required",
    dataShape: "alias_only",
    rawPayloadIncluded: false,
    transcriptIncluded: false,
    audioIncluded: false,
    ...overrides,
  };
}

describe("buildSalesDailyJudgementCard", () => {
  it("returns Insufficient-Signal with guidance instead of fabricating a card", () => {
    const card = buildSalesDailyJudgementCard({
      english: false,
      generatedForIso: "2026-07-06T00:00:00.000Z",
      signals: [],
    });

    expect(card.ruleVersion).toBe(SALES_DAILY_JUDGEMENT_CARD_RULE_VERSION);
    expect(card.decision).toBe("Insufficient-Signal");
    expect(card.sections).toEqual([]);
    expect(card.emptyGuidance).toContain("不会编造");
  });

  it("groups signals into decision-first sections in fixed order", () => {
    const card = buildSalesDailyJudgementCard({
      english: false,
      generatedForIso: "2026-07-06T00:00:00.000Z",
      signals: [
        signal({ signalId: "a", signalType: "objection" }),
        signal({ signalId: "b", signalType: "follow_up_window", followUpWindowDays: 2 }),
        signal({ signalId: "c", signalType: "risk_signal" }),
        signal({ signalId: "d", signalType: "commitment" }),
      ],
    });

    expect(card.decision).toBe("Card-Ready");
    expect(card.sections.map((s) => s.key)).toEqual([
      "follow_up_today",
      "risks_first",
      "commitments_to_honor",
      "objections_to_answer",
    ]);
    expect(
      SALES_DAILY_CARD_SECTION_ORDER.indexOf(card.sections[0].key),
    ).toBeLessThan(SALES_DAILY_CARD_SECTION_ORDER.indexOf(card.sections[1].key));
    expect(card.totalSignals).toBe(4);
  });

  it("sorts follow-ups by urgency with unknown windows last", () => {
    const card = buildSalesDailyJudgementCard({
      english: true,
      generatedForIso: "2026-07-06T00:00:00.000Z",
      signals: [
        signal({ signalId: "late", signalType: "follow_up_window", followUpWindowDays: 7 }),
        signal({ signalId: "unknown", signalType: "follow_up_window", followUpWindowDays: undefined }),
        signal({ signalId: "urgent", signalType: "follow_up_window", followUpWindowDays: 1 }),
      ],
    });

    expect(card.sections[0].items.map((i) => i.signalId)).toEqual([
      "urgent",
      "late",
      "unknown",
    ]);
  });

  it("caps sections and surfaces droppedCount instead of silent truncation", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      signal({ signalId: `r${i}`, signalType: "risk_signal", confidence: 50 + i }),
    );
    const card = buildSalesDailyJudgementCard({
      english: true,
      generatedForIso: "2026-07-06T00:00:00.000Z",
      signals: many,
    });

    const risks = card.sections.find((s) => s.key === "risks_first");
    expect(risks?.items.length).toBe(SALES_DAILY_CARD_MAX_ITEMS_PER_SECTION);
    expect(risks?.droppedCount).toBe(3);
    expect(risks?.items[0].confidence).toBe(57);
  });

  it("marks every item suggestion_only and keeps review-first boundaries", () => {
    const card = buildSalesDailyJudgementCard({
      english: false,
      generatedForIso: "2026-07-06T00:00:00.000Z",
      signals: [signal({ signalId: "a" })],
    });

    expect(
      card.sections.every((s) => s.items.every((i) => i.effectMode === "suggestion_only")),
    ).toBe(true);
    expect(card.boundaries.join("\n")).toContain("建议，不是承诺");
    expect(card.boundaries.join("\n")).toContain("不自动外发");
  });
});
