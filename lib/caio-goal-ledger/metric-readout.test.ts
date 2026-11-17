import { describe, expect, it } from "vitest";

import { buildCoreDefaultNorthstarKpis, type NorthstarKpi, validateNorthstarKpis } from "@/lib/shell/northstar-kpi";

import { evaluateCaioGoalThresholdEcho, projectCaioGoalReadouts } from "./metric-readout";
import { syntheticCaioGoalLedgerDocument } from "./testing/synthetic-chain";

const document = syntheticCaioGoalLedgerDocument();
const metrics = (kpis: ReadonlyArray<NorthstarKpi>, english = false) =>
  projectCaioGoalReadouts(document, kpis, english).flatMap((readout) => readout.metrics);
const byKey = (kpis: ReadonlyArray<NorthstarKpi>, key: string) => metrics(kpis).find((kpi) => kpi.key === key);
const sourceKpi = (overrides: Partial<NorthstarKpi>): NorthstarKpi => ({
  key: "line_a.outcome", label: "Source outcome", status: "measured", unit: "count", value: 7, bandLabel: null,
  direction: "up_good", href: "/northstar", basisRef: "basis.source.outcome", ...overrides,
});

describe("projectCaioGoalReadouts", () => {
  it("reads every metric as pending_source with no value and a note while Core has no source", () => {
    for (const english of [false, true]) {
      const projected = metrics(buildCoreDefaultNorthstarKpis(), english);
      expect(projected.map((kpi) => kpi.key)).toEqual(["line_a.outcome", "line_a.quality", "review.close_days", "review.spend_band"]);
      for (const kpi of projected) {
        expect(kpi).toMatchObject({ status: "pending_source", value: null, bandLabel: null, href: null });
        expect(kpi.pendingSourceNote?.trim()).toBeTruthy();
      }
      expect(validateNorthstarKpis(projected)).toEqual([]);
    }
    expect(byKey([], "line_a.quality")).toMatchObject({
      label: "质量", unit: "percent", direction: "up_good", basisRef: "basis.line_a.quality",
    });
    expect(metrics([], true)[0].label).toBe("Outcome");
  });

  it("passes a matching source readout through as it is", () => {
    const measured = sourceKpi({});
    const noData = sourceKpi({ key: "review.close_days", unit: "days", status: "no_data", value: null, direction: "down_good" });
    const pending = sourceKpi({ key: "review.spend_band", unit: "currency_band", status: "pending_source", value: null,
      direction: "neutral", pendingSourceNote: "Source note" });
    expect(byKey([measured], "line_a.outcome")).toBe(measured);
    expect(byKey([noData], "review.close_days")).toBe(noData);
    expect(byKey([pending], "review.spend_band")).toBe(pending);
  });

  it("shows a measured 0 as 0, apart from a metric with no readout", () => {
    expect(byKey([sourceKpi({ value: 0 })], "line_a.outcome")).toMatchObject({ status: "measured", value: 0 });
    expect(byKey([sourceKpi({ value: 0 })], "line_a.quality")).toMatchObject({ status: "pending_source", value: null });
  });

  it("downgrades a readout in another unit to pending_source, with its own note", () => {
    const projected = byKey([sourceKpi({ key: "line_a.quality", unit: "ratio", value: 0.4 })], "line_a.quality");
    expect(projected).toMatchObject({ status: "pending_source", unit: "percent", value: null, label: "质量" });
    expect(projected?.pendingSourceNote).not.toBe(byKey([], "line_a.quality")?.pendingSourceNote);
    expect(validateNorthstarKpis([projected!])).toEqual([]);
  });

  it("uses the first readout for a key and ignores readouts the ledger does not name", () => {
    const first = sourceKpi({ value: 1 });
    const projected = metrics([sourceKpi({ key: "other.metric" }), first, sourceKpi({ value: 2 })]);
    expect(projected.find((kpi) => kpi.key === "line_a.outcome")).toBe(first);
    expect(projected.some((kpi) => kpi.key === "other.metric")).toBe(false);
  });

  it("carries each goal's text, components and threshold state", () => {
    const [reliability, cadence] = projectCaioGoalReadouts(document, [], false);
    expect(reliability).toMatchObject({
      goalKey: "goal.reliability", kind: "northstar", title: document.goals[0].title, componentKeys: ["line_a", "line_b"],
      threshold: { ref: "threshold.goal.reliability", sha256: "b".repeat(64), state: "pinned" },
    });
    expect(cadence.threshold).toEqual({ ref: "threshold.goal.cadence", sha256: null, state: "unset" });
    const unlined = { ...document, goals: [{ ...document.goals[1], threshold: null }] };
    expect(projectCaioGoalReadouts(unlined, [], false)[0].threshold).toBeNull();
  });
});

describe("evaluateCaioGoalThresholdEcho", () => {
  const pinned = { ref: "threshold.x", sha256: "b".repeat(64) };
  it.each<[string, Parameters<typeof evaluateCaioGoalThresholdEcho>[0], string | null, string]>([
    ["the sealed digest echoed", pinned, "b".repeat(64), "match"],
    ["another digest echoed", pinned, "c".repeat(64), "mismatch"],
    ["no echo for a pinned line", pinned, null, "mismatch"],
    ["no line and no echo", { ref: "threshold.x", sha256: null }, null, "unset"],
    ["no threshold and no echo", null, null, "unset"],
    ["an echo for a goal without a line", { ref: "threshold.x", sha256: null }, "b".repeat(64), "mismatch"],
  ])("%s", (_name, threshold, echoed, expected) => {
    expect(evaluateCaioGoalThresholdEcho(threshold, echoed)).toBe(expected);
  });
});
