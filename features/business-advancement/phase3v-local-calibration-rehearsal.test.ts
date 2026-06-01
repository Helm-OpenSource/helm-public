import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
  evaluatePhase3oRealDataCalibrationEvidencePack,
} from "./phase3o-real-data-calibration-evidence-pack";
import {
  PHASE3V_REHEARSAL_POSTURE,
  PHASE3V_RULE_VERSION,
  PHASE3V_RUNTIME_ADOPTION_POSTURE,
  buildPhase3vLocalCalibrationRehearsalResult,
  type Phase3vCollectorOutput,
} from "../../scripts/business-advancement-phase3v-local-calibration-rehearsal";

function outputFor(
  sampleKind: "synthetic_fixture" | "local_development_snapshot" | "redacted_live_db_snapshot",
): Phase3vCollectorOutput {
  const evidencePack = {
    ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    sampleKind,
  };
  return {
    evidencePack,
    evaluation: evaluatePhase3oRealDataCalibrationEvidencePack(evidencePack),
  };
}

describe("Phase 3V local calibration rehearsal constants", () => {
  it("keeps local rehearsal separate from runtime adoption", () => {
    expect(PHASE3V_RULE_VERSION).toBe(
      "phase3v-local-calibration-rehearsal/v1",
    );
    expect(PHASE3V_REHEARSAL_POSTURE).toBe(
      "Local-Development-Rehearsal-Only",
    );
    expect(PHASE3V_RUNTIME_ADOPTION_POSTURE).toBe("No-Go");
  });
});

describe("buildPhase3vLocalCalibrationRehearsalResult", () => {
  it("passes local rehearsal when Phase 3Q accepts and Phase 3R/3S stay blocked", () => {
    const result = buildPhase3vLocalCalibrationRehearsalResult(
      outputFor("local_development_snapshot"),
    );

    expect(result.localRehearsalPassed).toBe(true);
    expect(result.sampleKind).toBe("local_development_snapshot");
    expect(result.phase3qIntakePassed).toBe(true);
    expect(result.phase3rExpectedBlocked).toBe(true);
    expect(result.phase3sExpectedNoGo).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("never exposes production or runtime authority during local rehearsal", () => {
    const result = buildPhase3vLocalCalibrationRehearsalResult(
      outputFor("local_development_snapshot"),
    );

    expect(result.productionAdoptionAllowed).toBe(false);
    expect(result.runtimeIntegrationAllowed).toBe(false);
    expect(result.phase3r.productionAdoptionAllowed).toBe(false);
    expect(result.phase3r.runtimeIntegrationAllowed).toBe(false);
    expect(result.phase3s.productionAdoptionAllowed).toBe(false);
    expect(result.phase3s.runtimeIntegrationAllowed).toBe(false);
    expect(result.phase3s.productionAdoptionDecision).toBe("No-Go");
  });

  it("fails rehearsal for synthetic fixtures", () => {
    const result = buildPhase3vLocalCalibrationRehearsalResult(
      outputFor("synthetic_fixture"),
    );

    expect(result.localRehearsalPassed).toBe(false);
    expect(result.blockers.join("\n")).toContain("synthetic_fixture");
  });

  it("fails rehearsal for live snapshots because Phase 3V is local-only", () => {
    const result = buildPhase3vLocalCalibrationRehearsalResult(
      outputFor("redacted_live_db_snapshot"),
    );

    expect(result.localRehearsalPassed).toBe(false);
    expect(result.blockers.join("\n")).toContain("redacted_live_db_snapshot");
    expect(result.blockers.join("\n")).toContain("Phase 3R unexpectedly");
    expect(result.blockers.join("\n")).toContain("Phase 3S unexpectedly");
  });
});
