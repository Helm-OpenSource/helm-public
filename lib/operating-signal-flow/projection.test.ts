import { describe, expect, it } from "vitest";

import fixturePack from "@/evals/operating-signal-flow/signal-flow-cases.json";
import type { OperatingSignalFlowFixturePack } from "@/lib/operating-signal-flow/contract";
import {
  buildOperatingSignalFlowDetailDisplayModel,
  buildOperatingSignalFlowDisplayModel,
  buildOperatingSignalFlowSnapshotDetailDisplayModel,
  selectHighestPressurePath,
} from "@/lib/operating-signal-flow/projection";
import {
  buildOperatingSignalFlowRuntimeShadowSnapshot,
  type OperatingSignalFlowShadowActionRow,
  type OperatingSignalFlowShadowApprovalRow,
  type OperatingSignalFlowShadowAuditRow,
} from "@/lib/operating-signal-flow/runtime-shadow-adapter";

const PACK = fixturePack as OperatingSignalFlowFixturePack;
const NOW = new Date("2026-05-29T02:00:00.000Z");

function shadowActionRow(
  overrides: Partial<OperatingSignalFlowShadowActionRow> = {},
): OperatingSignalFlowShadowActionRow {
  return {
    id: "action-1",
    workspaceId: "ws-1",
    ownerId: "owner-1",
    actionType: "CREATE_TASK",
    sourceType: "SYSTEM_INFERENCE",
    riskLevel: "HIGH",
    suggestedAt: new Date("2026-05-29T01:10:00.000Z"),
    dueDate: new Date("2026-05-30T01:10:00.000Z"),
    executedAt: null,
    status: "PENDING_APPROVAL",
    executionStatus: "pending",
    executionMode: "REQUIRES_APPROVAL",
    requiresApproval: true,
    createdAt: new Date("2026-05-29T01:10:00.000Z"),
    updatedAt: new Date("2026-05-29T01:20:00.000Z"),
    ...overrides,
  };
}

function shadowApprovalRow(
  overrides: Partial<OperatingSignalFlowShadowApprovalRow> = {},
): OperatingSignalFlowShadowApprovalRow {
  return {
    id: "approval-1",
    workspaceId: "ws-1",
    status: "PENDING",
    isHighRisk: true,
    autoExecute: false,
    reviewedAt: null,
    createdAt: new Date("2026-05-29T01:30:00.000Z"),
    updatedAt: new Date("2026-05-29T01:30:00.000Z"),
    ...overrides,
  };
}

function shadowAuditRow(
  overrides: Partial<OperatingSignalFlowShadowAuditRow> = {},
): OperatingSignalFlowShadowAuditRow {
  return {
    id: "audit-1",
    workspaceId: "ws-1",
    actorType: "SYSTEM",
    actionType: "OPERATING_SIGNAL_FLOW_SHADOW_RECEIPT",
    targetType: "ActionItem",
    relatedObjectType: "ActionItem",
    traceId: "trace-raw-secret",
    requestId: "request-raw-secret",
    parentEventId: "parent-raw-secret",
    createdAt: new Date("2026-05-29T01:45:00.000Z"),
    ...overrides,
  };
}

describe("operating signal flow projection", () => {
  it("builds the shared display model from the checked-in contract fixture", () => {
    const display = buildOperatingSignalFlowDisplayModel(PACK, "zh-CN");

    expect(display.stats.find((item) => item.label === "客户资产")?.value).toBe(15);
    expect(display.stats.find((item) => item.label === "信号类型")?.value).toBe(7);
    expect(display.stats.find((item) => item.label === "待处理")?.value).toBe(10);
    expect(display.stats.find((item) => item.label === "需拍板")?.value).toBe(1);
    expect(display.stages.map((item) => item.id)).toEqual([
      "source",
      "collector",
      "gate",
      "object",
      "judgement",
      "review",
      "learning",
    ]);
    expect(display.journey.title).toBe("Nimbus 法务/交付时间表承诺");
    expect(display.journey.summaryItems.map((item) => item.label)).toEqual([
      "客户材料",
      "客户/机会",
      "经营信号",
      "下一步",
    ]);
    expect(display.journey.steps).toHaveLength(11);
    expect(display.journey.steps[0]).toMatchObject({
      title: "客户信息进入",
      source: "Nimbus 安全评审同步会",
      object: "Nimbus 法务/交付时间表承诺",
      evidence: "证据 1/3",
    });
    expect(display.journey.steps.at(-1)).toMatchObject({
      title: "沉淀跟进经验",
      evidence: "证据 3/3",
    });
    expect(display.lifecycle.title).toBe("客户经营资产全链路图");
    expect(display.lifecycle.autoLineLabel).toBe("客户经营过程");
    expect(display.lifecycle.evolutionTitle).toBe("按信号类型看客户资产");
    expect(display.lifecycle.phases.map((item) => item.id)).toEqual([
      "capture",
      "object-evidence",
      "judgement-gate",
      "human-boundary",
      "receipt",
      "memory-learning",
    ]);
    expect(display.lifecycle.branches.map((item) => item.id)).toEqual([
      "source-permission",
      "evidence-object",
      "review-boundary",
      "receipt-learning",
    ]);
    expect(display.lifecycle.familyEvolution).toHaveLength(7);
    expect(display.lifecycle.familyEvolution[0]).toMatchObject({
      label: "客户承诺",
      objectSummary: expect.stringContaining("Nimbus"),
      sourceSummary: expect.stringContaining("Nimbus"),
    });
    expect(display.lifecycle.familyEvolution.map((item) => item.objectSummary).join(" / ")).toContain("Beacon");
    expect(display.lifecycle.familyEvolution.map((item) => item.objectSummary).join(" / ")).toContain("Aya Nakamura");
    expect(display.lifecycle.coverage).toContainEqual({
      label: "经营链路",
      value: "24/25",
      detail: "由当前脱敏客户资产覆盖",
    });
    expect(display.aiPosture).toContainEqual({ label: "AI 排序权", value: "0" });
    expect(display.aiPosture).toContainEqual({ label: "跨客户动作", value: "0" });
    expect(display.pressureSignals).toHaveLength(4);
    expect(display.selectedPressure?.href).toMatch(
      /^\/operating\/signals\/boundary%3Aalias-f/u,
    );
    expect(display.selectedPressure?.handoffHref).toBe("/approvals");
    expect(display.dataPosture).toBe("fixture");
    expect(display.fixtureBannerVisible).toBe(true);
    expect(display.boundaryStatementVisible).toBe(true);
    expect(display.animationPolicy).toBe("disabled");
    expect(display.postureHighlights.map((item) => item.dataPosture)).toEqual([
      "empty",
      "fixture",
      "degraded",
    ]);
  });

  it("keeps the headline in review-first advice wording", () => {
    const zhDisplay = buildOperatingSignalFlowDisplayModel(PACK, "zh-CN");
    const enDisplay = buildOperatingSignalFlowDisplayModel(PACK, "en-US");

    expect(zhDisplay.headline).toBe("客户经营信号资产图");
    expect(zhDisplay.summary).toContain("Nimbus");
    expect(zhDisplay.headline).not.toContain("停住");
    expect(enDisplay.headline).toBe("Customer operating signal asset map");
    expect(enDisplay.summary).toContain("Nimbus");
    expect(enDisplay.headline).not.toMatch(/stopped/i);
  });

  it("uses fixture entry point metadata for happy-path outcome counts", () => {
    const entryPointCase = PACK.cases.find(
      (item) => item.id === PACK.entryPoints.happyPathCaseId,
    );
    const display = buildOperatingSignalFlowDisplayModel(PACK, "en-US");

    expect(entryPointCase).toBeDefined();
    expect(display.stages.find((item) => item.id === "learning")?.value).toBe(
      String(entryPointCase?.snapshot.events.length),
    );
    expect(display.journey.caseId).toBe(PACK.entryPoints.happyPathCaseId);
    expect(display.journey.steps).toHaveLength(entryPointCase?.snapshot.events.length ?? 0);
  });

  it("fails loudly when fixture entry point metadata points to a missing case", () => {
    const brokenPack: OperatingSignalFlowFixturePack = {
      ...PACK,
      entryPoints: {
        happyPathCaseId: "OSF-MISSING-HAPPY-PATH",
      },
    };

    expect(() => buildOperatingSignalFlowDisplayModel(brokenPack, "en-US")).toThrow(
      /happyPathCaseId:OSF-MISSING-HAPPY-PATH/u,
    );
  });

  it("fails loudly when fixture posture samples are missing", () => {
    const brokenPack: OperatingSignalFlowFixturePack = {
      ...PACK,
      cases: PACK.cases.filter((item) => item.snapshot.dataPosture !== "fixture"),
    };

    expect(() => buildOperatingSignalFlowDisplayModel(brokenPack, "en-US")).toThrow(
      /fixture posture missing: fixture/u,
    );
  });

  it("keeps selected pressure path deterministic and aligned with the fixture contract", () => {
    const checkedSnapshots = PACK.cases
      .filter((item) => item.expectedSelectedPathSignalKey)
      .map((item) => item.snapshot);

    expect(checkedSnapshots.length).toBeGreaterThan(0);
    for (const snapshot of checkedSnapshots) {
      expect(selectHighestPressurePath(snapshot)).toBe(snapshot.selectedPathSignalKey);
    }
  });

  it("falls back to the review route when fixture actions include unsafe routes", () => {
    const unsafePack: OperatingSignalFlowFixturePack = {
      ...PACK,
      cases: PACK.cases.map((item) => ({
        ...item,
        snapshot: {
          ...item.snapshot,
          events: item.snapshot.events.map((event) => ({
            ...event,
            allowedNextActions: ["/api/unsafe-write"],
          })),
        },
      })),
    };

    const display = buildOperatingSignalFlowDisplayModel(unsafePack, "en-US");
    const detail = buildOperatingSignalFlowDetailDisplayModel(
      unsafePack,
      "en-US",
      display.pressureSignals[0]?.signalKey ?? "",
    );

    expect(display.pressureSignals).not.toHaveLength(0);
    expect(display.pressureSignals.every((item) => item.href.startsWith("/operating/signals/"))).toBe(true);
    expect(display.pressureSignals.every((item) => !item.href.includes("/api/"))).toBe(true);
    expect(display.selectedPressure?.href).toMatch(/^\/operating\/signals\//u);
    expect(display.selectedPressure?.handoffHref).toBe("/approvals");
    expect(detail?.primaryAction.href).toBe("/approvals");
  });

  it("builds a single-signal lifecycle detail from customer-facing asset facts", () => {
    const detail = buildOperatingSignalFlowDetailDisplayModel(
      PACK,
      "zh-CN",
      "boundary:alias-f",
    );

    expect(detail).toBeDefined();
    expect(detail?.title).toBe("Acme 试点承诺型外发草稿");
    expect(detail?.family).toBe("谨慎动作");
    expect(detail?.state).toBe("高风险动作停住");
    expect(detail?.blocker).toBe("外部动作需拍板");
    expect(detail?.primaryAction).toMatchObject({
      label: "打开复核路径",
      href: "/approvals",
    });
    expect(detail?.quickFacts.map((item) => item.label)).toEqual([
      "客户材料",
      "客户资产",
      "当前停住点",
      "证据",
    ]);
    expect(detail?.lifecycle.phases).toHaveLength(6);
    expect(detail?.lifecycle.phases.map((phase) => phase.status)).toEqual([
      "done",
      "done",
      "done",
      "blocked",
      "waiting",
      "waiting",
    ]);
    expect(detail?.aiPosture).toContainEqual({
      label: "外部权限",
      value: "0",
      detail: expect.stringContaining("external_send_not_allowed"),
    });
    expect(detail?.boundary).toContain("不外发");
  });

  it("builds route-disconnected detail models from current-window runtime shadow snapshots", () => {
    const shadow = buildOperatingSignalFlowRuntimeShadowSnapshot({
      workspaceId: "ws-1",
      window: "24h",
      generatedAt: NOW,
      actions: [shadowActionRow()],
      approvals: [shadowApprovalRow()],
      audits: [shadowAuditRow()],
    });

    expect(shadow.state).toBe("shadow_ready");
    if (shadow.state !== "shadow_ready") throw new Error("expected shadow_ready");

    const detail = buildOperatingSignalFlowSnapshotDetailDisplayModel(
      shadow.snapshot,
      "zh-CN",
      "osf-shadow-action-001",
    );

    expect(detail).toBeDefined();
    expect(detail?.dataPosture).toBe("current_window");
    expect(detail?.title).toBe("当前工作区经营闭环");
    expect(detail?.source).toBe("行动候选（脱敏计数）");
    expect(detail?.object).toBe("当前工作区经营闭环");
    expect(detail?.family).toBe("经营风险");
    expect(detail?.primaryAction).toMatchObject({
      label: "打开复核路径",
      href: "/approvals",
    });
    expect(detail?.fixtureBanner).toContain("不代表生产页面已接入");
    expect(detail?.boundary).toContain("未接路由的投影");
    expect(detail?.secondaryActions.map((item) => item.href)).toContain("/operating");

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("trace-raw-secret");
    expect(serialized).not.toContain("request-raw-secret");
    expect(serialized).not.toContain("parent-raw-secret");
  });
});
