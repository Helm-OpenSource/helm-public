import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRODUCTION_QUERY_LIVE_DB_CALIBRATION_EVIDENCE,
  DEFAULT_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT,
  POSITIVE_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT,
  REDACTED_REAL_DATA_CALIBRATION_PACKAGE_POSTURE,
  REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RULE_VERSION,
  REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RUNTIME_ADOPTION,
  evaluateRedactedRealDataCalibrationPackageGate,
} from "./redacted-real-data-calibration-package-gate";

describe("redacted real-data calibration package gate constants", () => {
  it("keeps package planning-only and runtime adoption no-go", () => {
    expect(REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RULE_VERSION).toBe(
      "redacted-real-data-calibration-package/v1",
    );
    expect(REDACTED_REAL_DATA_CALIBRATION_PACKAGE_POSTURE).toBe(
      "Planning-Only",
    );
    expect(REDACTED_REAL_DATA_CALIBRATION_PACKAGE_RUNTIME_ADOPTION).toBe(
      "No-Go",
    );
  });
});

describe("evaluateRedactedRealDataCalibrationPackageGate blockers", () => {
  it("default fixture is No-Go because both actual evidence lines are pending", () => {
    const result = evaluateRedactedRealDataCalibrationPackageGate(
      DEFAULT_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT,
    );

    expect(result.decision).toBe("No-Go");
    expect(result.productionAdoptionAllowed).toBe(false);
    expect(result.runtimeIntegrationAllowed).toBe(false);
    expect(result.summary.packageReady).toBe(false);
    expect(result.summary.askHelmInteractionEvidenceReady).toBe(false);
    expect(result.summary.productionQueryLiveDbEvidenceReady).toBe(false);
    expect(result.blockers.join("\n")).toContain(
      "Ask Helm interaction actual live redacted evidence is missing",
    );
    expect(result.blockers.join("\n")).toContain(
      "Production query actual redacted_live_db_snapshot evidence is missing",
    );
  });

  it("does not accept production query local development snapshot", () => {
    const result = evaluateRedactedRealDataCalibrationPackageGate({
      ...POSITIVE_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT,
      productionQueryLiveDbEvidence: {
        ...DEFAULT_PRODUCTION_QUERY_LIVE_DB_CALIBRATION_EVIDENCE,
        phase3pSnapshotCollected: true,
        phase3qIntakePassed: true,
        phase3rPreflightPassed: false,
        phase3sReviewPacketReady: false,
        sampleKind: "local_development_snapshot",
        realDataValidated: false,
        productionCalibrationComplete: false,
        blockedReasons: [
          'sampleKind is "local_development_snapshot"; must be "redacted_live_db_snapshot".',
        ],
        snapshotRef: "local-snapshot",
        reviewPacketRef: "local-packet",
      },
    });

    expect(result.decision).toBe("No-Go");
    expect(result.summary.askHelmInteractionEvidenceReady).toBe(true);
    expect(result.summary.productionQueryLiveDbEvidenceReady).toBe(false);
    expect(result.checks.find((check) => check.name.includes("production"))?.detail).toContain(
      "local_development_snapshot",
    );
  });

  it("does not accept Ask Helm synthetic interaction evidence", () => {
    const result = evaluateRedactedRealDataCalibrationPackageGate({
      ...POSITIVE_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT,
      askHelmInteractionEvidence:
        DEFAULT_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT
          .askHelmInteractionEvidence,
    });

    expect(result.decision).toBe("No-Go");
    expect(result.summary.askHelmInteractionEvidenceReady).toBe(false);
    expect(result.summary.productionQueryLiveDbEvidenceReady).toBe(true);
  });
});

describe("evaluateRedactedRealDataCalibrationPackageGate positive fixture", () => {
  it("only reaches Ready-For-Manual-Review and never production Go", () => {
    const result = evaluateRedactedRealDataCalibrationPackageGate(
      POSITIVE_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT,
    );

    expect(result.decision).toBe("Ready-For-Manual-Review");
    expect(result.decision).not.toBe("Go");
    expect(result.blockers).toHaveLength(0);
    expect(result.productionAdoptionAllowed).toBe(false);
    expect(result.runtimeIntegrationAllowed).toBe(false);
    expect(result.runtimeAdoption).toBe("No-Go");
    expect(result.summary).toMatchObject({
      packageReady: true,
      askHelmInteractionEvidenceReady: true,
      productionQueryLiveDbEvidenceReady: true,
      decision: "Ready-For-Manual-Review",
    });
  });

  it("returns deterministic stable output", () => {
    const first = evaluateRedactedRealDataCalibrationPackageGate(
      POSITIVE_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT,
    );
    const second = evaluateRedactedRealDataCalibrationPackageGate(
      POSITIVE_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_INPUT,
    );

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
