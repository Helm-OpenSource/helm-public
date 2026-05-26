import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_INTERNAL_DOGFOOD_RUN_REPORT_INPUT,
  INTERNAL_DOGFOOD_RUN_REPORT_POSTURE,
  INTERNAL_DOGFOOD_RUN_REPORT_RULE_VERSION,
  INTERNAL_DOGFOOD_RUN_REPORT_RUNTIME_ADOPTION,
  POSITIVE_INTERNAL_DOGFOOD_RUN_REPORT_INPUT,
  buildInternalDogfoodRunReport,
  type InternalDogfoodRunObservation,
  type InternalDogfoodRunReportInput,
} from "./internal-dogfood-run-report";

function build(patch: Partial<InternalDogfoodRunReportInput> = {}) {
  return buildInternalDogfoodRunReport({
    ...POSITIVE_INTERNAL_DOGFOOD_RUN_REPORT_INPUT,
    ...patch,
  });
}

function positiveObservations(): InternalDogfoodRunObservation[] {
  return [...POSITIVE_INTERNAL_DOGFOOD_RUN_REPORT_INPUT.observations];
}

describe("internal dogfood run report constants", () => {
  it("keeps run report disabled-internal-only and runtime no-go", () => {
    expect(INTERNAL_DOGFOOD_RUN_REPORT_RULE_VERSION).toBe(
      "business-advancement-internal-dogfood-run-report/v1",
    );
    expect(INTERNAL_DOGFOOD_RUN_REPORT_POSTURE).toBe(
      "Disabled-Internal-Dogfood-Run-Report",
    );
    expect(INTERNAL_DOGFOOD_RUN_REPORT_RUNTIME_ADOPTION).toBe("No-Go");
  });
});

describe("buildInternalDogfoodRunReport", () => {
  it("defaults to blocked without founder approval or observations", () => {
    const report = buildInternalDogfoodRunReport(
      DEFAULT_INTERNAL_DOGFOOD_RUN_REPORT_INPUT,
    );

    expect(report.decision).toBe("Blocked");
    expect(report.recommendation).toBe("Blocked");
    expect(report.productionQueryAdoptionAllowed).toBe(false);
    expect(report.runtimeIntegrationAllowed).toBe(false);
    expect(report.publicTrialAllowed).toBe(false);
    expect(report.blockers.join("\n")).toContain("founder decision");
    expect(report.blockers.join("\n")).toContain("TPQR-001");
  });

  it("builds a ready run report from positive disabled dogfood observations", () => {
    const report = buildInternalDogfoodRunReport(
      POSITIVE_INTERNAL_DOGFOOD_RUN_REPORT_INPUT,
    );

    expect(report.decision).toBe("Run-Report-Ready");
    expect(report.recommendation).toBe("Continue-Disabled-Internal-Dogfooding");
    expect(report.runtimeAdoption).toBe("No-Go");
    expect(report.productionQueryAdoptionAllowed).toBe(false);
    expect(report.runtimeIntegrationAllowed).toBe(false);
    expect(report.publicTrialAllowed).toBe(false);
    expect(report.metrics).toMatchObject({
      reviewedCount: 4,
      acceptedCount: 4,
      falsePositiveCount: 0,
      missingEvidenceCount: 0,
      thresholdConcernCount: 0,
      stopRequestCount: 0,
    });
    expect(report.blockers).toEqual([]);
  });

  it("recommends revision when observations contain quality issues", () => {
    const observations = positiveObservations();
    observations[0] = {
      ...observations[0],
      acceptedCount: 0,
      falsePositiveCount: 1,
      notes: "One blocked-decision candidate looked noisy in run review.",
    };

    const report = build({ observations });

    expect(report.decision).toBe("Run-Report-Ready");
    expect(report.recommendation).toBe("Revise-Before-Next-Internal-Dogfood");
    expect(report.metrics.falsePositiveCount).toBe(1);
    expect(report.productionQueryAdoptionAllowed).toBe(false);
    expect(report.runtimeIntegrationAllowed).toBe(false);
  });

  it("blocks when any observation requests stop", () => {
    const observations = positiveObservations();
    observations[1] = {
      ...observations[1],
      stopRequested: true,
      notes: "Stop and return to calibration before another run.",
    };

    const report = build({ observations });

    expect(report.decision).toBe("Blocked");
    expect(report.recommendation).toBe("Stop-And-Return-To-Calibration");
    expect(report.blockers.join("\n")).toContain("stop request");
  });

  it("blocks if founder decision did not approve the disabled iteration", () => {
    const report = build({
      founderDecision:
        DEFAULT_INTERNAL_DOGFOOD_RUN_REPORT_INPUT.founderDecision,
    });

    expect(report.decision).toBe("Blocked");
    expect(report.blockers.join("\n")).toContain(
      "Approve-Next-Disabled-Internal-Dogfood-Iteration",
    );
  });

  it("blocks if a required TPQR family is missing", () => {
    const observations = positiveObservations().filter(
      (observation) => observation.familyId !== "TPQR-004",
    );

    const report = build({ observations });

    expect(report.decision).toBe("Blocked");
    expect(report.familyCoverage.find((item) => item.familyId === "TPQR-004")).toMatchObject({
      covered: false,
      observationCount: 0,
    });
  });

  it("blocks invalid count totals", () => {
    const observations = positiveObservations();
    observations[0] = {
      ...observations[0],
      reviewedCount: 1,
      acceptedCount: 2,
    };

    const report = build({ observations });

    expect(report.decision).toBe("Blocked");
    expect(report.blockers.join("\n")).toContain("count totals");
  });

  it("blocks invalid run context timestamps", () => {
    const report = build({
      runContext: {
        ...POSITIVE_INTERNAL_DOGFOOD_RUN_REPORT_INPUT.runContext,
        endedAtIso: "2026-04-30T00:00:00.000Z",
      },
    });

    expect(report.decision).toBe("Blocked");
    expect(report.blockers.join("\n")).toContain("endedAtIso");
  });

  it("preserves the founder decision packet as source evidence", () => {
    const report = buildInternalDogfoodRunReport(
      POSITIVE_INTERNAL_DOGFOOD_RUN_REPORT_INPUT,
    );

    expect(report.sourceFounderDecision.decision).toBe(
      "Approve-Next-Disabled-Internal-Dogfood-Iteration",
    );
    expect(report.sourceFounderDecision).toBe(
      POSITIVE_INTERNAL_DOGFOOD_RUN_REPORT_INPUT.founderDecision,
    );
  });

  it("does not import production query, mobile, app, db, prisma, fs or network modules", () => {
    const source = readFileSync(
      "features/business-advancement/internal-dogfood-run-report.ts",
      "utf8",
    );

    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(importLines.join("\n")).not.toContain("@/");
    expect(importLines.join("\n")).not.toContain("data/queries");
    expect(importLines.join("\n")).not.toContain("features/mobile");
    expect(importLines.join("\n")).not.toContain("app/");
    expect(importLines.join("\n")).not.toContain("prisma");
    expect(importLines.join("\n")).not.toContain("from \"fs\"");
    expect(source).not.toContain("fetch(");
  });
});
