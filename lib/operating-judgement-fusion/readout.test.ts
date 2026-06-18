import { describe, expect, it } from "vitest";

import { fuseOperatingSignals } from "./fuse";
import { syntheticSignal } from "./fixtures";
import {
  assertReadoutPublicSafe,
  buildOperatingJudgementReadout,
  type OperatingJudgementReadout,
} from "./readout";
import type { JudgementFusionInput } from "./contract";

function fusedJudgement() {
  const input: JudgementFusionInput = {
    schemaVersion: "helm.operating-judgement-fusion.v1",
    objectRef: "Deal:deal-17",
    objectKind: "Deal",
    intendedUse: "fixture_validation",
    signals: [
      syntheticSignal(
        { signalKey: "sig-a", objectRef: "Deal:deal-17", signalFamily: "commitment", confidenceBand: "high" },
        undefined,
      ),
      syntheticSignal(
        { signalKey: "sig-b", objectRef: "Deal:deal-17", signalFamily: "risk", confidenceBand: "high" },
        undefined,
      ),
    ],
  };
  const result = fuseOperatingSignals({
    ...input,
    signals: input.signals.map((s) => ({
      ...s,
      source: { ...s.source, allowedUses: ["fixture_validation"], improvementLoopEligible: false, promotionState: "candidate" },
    })),
  });
  return result.judgement!;
}

describe("operating-judgement-fusion readout", () => {
  it("builds a public-safe readout with all adoption guards false and review required", () => {
    const readout = buildOperatingJudgementReadout(fusedJudgement(), {
      objectAlias: "object-alias-7f3a",
    });
    expect(readout).not.toBeNull();
    const safe = readout as OperatingJudgementReadout;

    expect(safe.objectKind).toBe("Deal");
    expect(safe.objectAlias).toBe("object-alias-7f3a");
    expect(safe.adoptionGuards).toEqual({
      routePageAdoptionAllowed: false,
      productionQueryDefaultAllowed: false,
      schemaOrApiChangeAllowed: false,
      officialWriteAllowed: false,
      autoExecuteAllowed: false,
      externalSendAllowed: false,
      fixtureBannerRemovalAllowed: false,
      llmFinalRankingAllowed: false,
    });
    expect(safe.promotionTriggered).toBe(false);
    expect(safe.humanReviewerRequired).toBe(true);
    expect(safe.nextReviewRequired).toBe(true);
    expect(safe.producesOwnerReviewEvidenceOnly).toBe(true);
  });

  it("never exposes the raw objectRef or raw evidenceRefs", () => {
    const readout = buildOperatingJudgementReadout(fusedJudgement(), {
      objectAlias: "object-alias-7f3a",
    })!;
    const serialized = JSON.stringify(readout);
    expect(serialized).not.toContain("Deal:deal-17");
    expect(serialized).not.toContain("crm-row-17");
    // Only the aggregate count crosses over.
    expect(readout.evidence.refCount).toBeGreaterThanOrEqual(0);
  });

  it("passes the public-safety assertion", () => {
    const readout = buildOperatingJudgementReadout(fusedJudgement(), {
      objectAlias: "object-alias-7f3a",
    })!;
    expect(assertReadoutPublicSafe(readout)).toEqual({ ok: true, errors: [] });
  });

  it("flags a raw object ref leaked into the alias", () => {
    const readout = buildOperatingJudgementReadout(fusedJudgement(), {
      objectAlias: "Deal:deal-17",
    })!;
    const result = assertReadoutPublicSafe(readout);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("object_alias_is_raw_object_ref");
  });

  it("fails closed when an adoption guard is tampered to true", () => {
    const readout = buildOperatingJudgementReadout(fusedJudgement(), {
      objectAlias: "object-alias-7f3a",
    })!;
    const tampered = {
      ...readout,
      adoptionGuards: { ...readout.adoptionGuards, officialWriteAllowed: true },
    } as unknown as OperatingJudgementReadout;
    const result = assertReadoutPublicSafe(tampered);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("adoption_guard_not_false:officialWriteAllowed");
  });

  it("returns null when given a non-advice judgement", () => {
    const bad = { ...fusedJudgement(), commitmentClass: "commitment" as const };
    expect(buildOperatingJudgementReadout(bad, { objectAlias: "x" })).toBeNull();
  });

  it("carries an optional held-out eval summary as owner-review evidence", () => {
    const readout = buildOperatingJudgementReadout(fusedJudgement(), {
      objectAlias: "object-alias-7f3a",
      evalSummary: {
        decision: "fusion_beats_baseline",
        lift: 0.4,
        fusionAccuracy: 1,
        baselineAccuracy: 0.6,
        brierScore: 0.4,
        expectedCalibrationError: 0.3,
        overconfident: false,
      },
    })!;
    expect(readout.evalSummary?.decision).toBe("fusion_beats_baseline");
    expect(readout.evalSummary?.lift).toBeCloseTo(0.4, 5);
  });
});
