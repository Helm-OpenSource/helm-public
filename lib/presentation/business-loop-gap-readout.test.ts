import { describe, expect, it } from "vitest";
import { buildBusinessLoopGapReadout } from "@/lib/presentation/business-loop-gap-readout";
import type { OperatingGap } from "@/lib/operating-system/operating-gap";

function createGap(overrides?: Partial<OperatingGap>): OperatingGap {
  return {
    id: "gap-1",
    gapKey: "workspace-1:missing-kpi-link",
    workspaceId: "workspace-1",
    kind: "missing-kpi-link",
    sourceRepresentation: "coordination-metrics",
    title: "Missing KPI link",
    summary: "The main loop still lacks KPI grounding.",
    ownerHint: null,
    severity: "critical",
    operatorReviewRequired: true,
    nextActionHint: "Bind the current review block to a KPI owner.",
    evidenceRefs: ["/reports"],
    evidenceSummary: "Reports are still disconnected from the main KPI chain.",
    escalationPosture: "restore-grounding",
    href: "/reports",
    updatedAt: new Date("2026-04-08T10:00:00.000Z"),
    ...overrides,
  };
}

describe("buildBusinessLoopGapReadout", () => {
  it("formats blocker, decision, next action and connection from the primary gap", () => {
    const readout = buildBusinessLoopGapReadout({
      english: true,
      businessLoopGapSummary: {
        totalOpen: 2,
        reviewRequired: 2,
        kindCounts: [{ kind: "missing-kpi-link", count: 2 }],
        primaryGap: createGap(),
      },
    });

    expect(readout.blocker).toBe(
      "Missing KPI link · The main loop still lacks KPI grounding.",
    );
    expect(readout.pendingDecision).toBe(
      "Missing KPI link · The main loop still lacks KPI grounding.",
    );
    expect(readout.nextAction).toBe(
      "Missing KPI link · Bind the current review block to a KPI owner.",
    );
    expect(readout.connection).toEqual({
      label: "Loop gap",
      value: "Missing KPI link",
      description:
        "The main loop still lacks KPI grounding. · 2 loop gaps still need review",
      href: "/reports",
    });
  });

  it("uses fallback href and keeps the decision empty when review is not required", () => {
    const readout = buildBusinessLoopGapReadout({
      english: false,
      fallbackHref: "/operating",
      businessLoopGapSummary: {
        totalOpen: 1,
        reviewRequired: 1,
        kindCounts: [{ kind: "missing-kpi-link", count: 1 }],
        primaryGap: createGap({
          title: "对象未绑定",
          summary: "当前线索还没有可靠 owner。",
          operatorReviewRequired: false,
          nextActionHint: null,
          href: undefined,
        }),
      },
    });

    expect(readout.pendingDecision).toBeUndefined();
    expect(readout.nextAction).toBeUndefined();
    expect(readout.connection).toEqual({
      label: "闭环缺口",
      value: "对象未绑定",
      description: "当前线索还没有可靠负责人。",
      href: "/operating",
    });
  });

  it("localizes stale KPI linkage gaps for Chinese surfaces", () => {
    const readout = buildBusinessLoopGapReadout({
      english: false,
      businessLoopGapSummary: {
        totalOpen: 1,
        reviewRequired: 1,
        kindCounts: [{ kind: "missing-kpi-link", count: 1 }],
        primaryGap: createGap({
          title: "KPI link stale",
          summary:
            "The current operating loop still points at a stale coordination metrics snapshot from 2026-04-15, so KPI linkage needs a fresh baseline before it can guide current judgement.",
          nextActionHint:
            "Refresh the coordination metrics snapshot or connect a current report baseline before ranking this loop by outcome movement.",
        }),
      },
    });

    expect(readout.blocker).toBe(
      "结果口径过期 · 2026-04-15 的结果基线已过期，先刷新再判断。",
    );
    expect(readout.nextAction).toBe(
      "结果口径过期 · 先刷新指标或接入当前周报，再看结果排序。",
    );
    expect(readout.connection?.value).toBe("结果口径过期");
  });

  it("localizes pending KPI linkage gaps for Chinese approval surfaces", () => {
    const readout = buildBusinessLoopGapReadout({
      english: false,
      businessLoopGapSummary: {
        totalOpen: 1,
        reviewRequired: 1,
        kindCounts: [{ kind: "missing-kpi-link", count: 1 }],
        primaryGap: createGap({
          title: "KPI link pending",
          summary:
            "Current operating loop still has no coordination metrics snapshot, so outcome movement cannot be compared against a current KPI or baseline readout yet.",
          nextActionHint:
            "Write one daily coordination metrics snapshot or attach one current report baseline before treating this loop as measurable.",
        }),
      },
    });

    expect(readout.blocker).toBe(
      "缺结果口径 · 缺当前 KPI 或周报基线，暂时不能判断结果变化。",
    );
    expect(readout.pendingDecision).toBe(
      "缺结果口径 · 缺当前 KPI 或周报基线，暂时不能判断结果变化。",
    );
    expect(readout.nextAction).toBe(
      "缺结果口径 · 先补每日指标或接入当前周报。",
    );
    expect(readout.connection?.value).toBe("缺结果口径");
  });

  it("returns empty fields when there is no primary gap", () => {
    const readout = buildBusinessLoopGapReadout({
      english: true,
      businessLoopGapSummary: {
        totalOpen: 0,
        reviewRequired: 0,
        kindCounts: [],
        primaryGap: null,
      },
    });

    expect(readout.primaryGap).toBeNull();
    expect(readout.blocker).toBeUndefined();
    expect(readout.pendingDecision).toBeUndefined();
    expect(readout.nextAction).toBeUndefined();
    expect(readout.connection).toBeUndefined();
  });
});
