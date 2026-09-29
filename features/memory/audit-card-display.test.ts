import { describe, expect, it } from "vitest";

import { buildAuditCardDisplay } from "@/features/memory/audit-card-display";
import { formatMemoryVisibleText } from "@/features/memory/display-copy";

const labelled = {
  actionType: "demo.m2_operator.reactivation.applied",
  actor: "operator:demo-backfill",
  targetType: "demo.case_batch",
  summary: "Reactivation: 4 suspended cases set active by operator",
  displayLabels: {
    action: { zh: "批量恢复案件", en: "Case reactivation" },
    actor: { zh: "回填任务", en: "Backfill job" },
    targetType: { zh: "案件批次", en: "Case batch" },
  },
};

describe("memory audit replay card display", () => {
  it("uses the Chinese action label as headline and keeps the stored summary as detail", () => {
    const zhText = (value: string) => formatMemoryVisibleText(value, false);
    const card = buildAuditCardDisplay(labelled, false, zhText);

    expect(card.title).toBe("批量恢复案件");
    expect(card.detail).toBe(zhText(labelled.summary));
    expect(card.badge).toBeNull();
    expect(card.actionCode).toBe("demo.m2_operator.reactivation.applied");
    // Labels are rendered verbatim, never through the keyword normalizer.
    expect(card.actor).toBe("回填任务");
    expect(card.targetType).toBe("案件批次");
    expect([card.title, card.badge, card.actor, card.targetType].join(" ")).not.toMatch(
      /[A-Za-z_]{3,}/,
    );
  });

  it("keeps English copy in English locale, using registered English labels", () => {
    const card = buildAuditCardDisplay(labelled, true, (value) => value);

    expect(card.title).toBe(labelled.summary);
    expect(card.detail).toBeNull();
    expect(card.badge).toBe("Case reactivation");
    expect(card.actor).toBe("Backfill job");
    expect(card.targetType).toBe("Case batch");
  });

  it("falls back to the frontstage normalizer for unlabelled Core rows", () => {
    const zhText = (value: string) => formatMemoryVisibleText(value, false);
    const card = buildAuditCardDisplay(
      {
        actionType: "RECOMMENDATION_GENERATED",
        actor: "Helm",
        targetType: "COMPANY",
        summary: "系统为华东智造生成了下一步建议",
      },
      false,
      zhText,
    );

    expect(card.title).toBe("系统为华东智造生成了下一步建议");
    expect(card.detail).toBeNull();
    expect(card.badge).toBe("生成判断建议");
    expect(card.targetType).toBe("公司");
  });
});
