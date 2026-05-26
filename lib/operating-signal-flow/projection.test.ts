import { describe, expect, it } from "vitest";

import fixturePack from "@/evals/operating-signal-flow/signal-flow-cases.json";
import type { OperatingSignalFlowFixturePack } from "@/lib/operating-signal-flow/contract";
import {
  buildOperatingSignalFlowDisplayModel,
  selectHighestPressurePath,
} from "@/lib/operating-signal-flow/projection";

const PACK = fixturePack as OperatingSignalFlowFixturePack;

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

    expect(display.pressureSignals).not.toHaveLength(0);
    expect(display.pressureSignals.every((item) => item.href === "/approvals")).toBe(true);
    expect(display.selectedPressure?.href).toBe("/approvals");
  });
});
