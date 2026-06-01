import { describe, expect, it } from "vitest";

import { DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK } from "../../features/business-advancement/phase3o-real-data-calibration-evidence-pack";
import { Phase3qRejectionError } from "../../scripts/business-advancement-phase3q-snapshot-intake-review";
import {
  PHASE3R_NEXT_STEP_NOT_READY,
  PHASE3R_NEXT_STEP_READY,
  PHASE3R_RULE_VERSION,
  PHASE3R_RUNTIME_ADOPTION_POSTURE,
  evaluatePhase3rRuntimeAdoptionPreflight,
} from "../../scripts/business-advancement-phase3r-runtime-adoption-preflight";

const CLEAN_LIVE_SNAPSHOT_PACK = {
  ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
  sampleKind: "redacted_live_db_snapshot" as const,
};

const PHASE3P_WRAPPER_SYNTHETIC = {
  evidencePack: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
  evaluation: { ruleVersion: "phase3o-real-data-calibration-evidence-pack/v1" },
};

const PHASE3P_WRAPPER_LIVE = {
  evidencePack: CLEAN_LIVE_SNAPSHOT_PACK,
  evaluation: { ruleVersion: "phase3o-real-data-calibration-evidence-pack/v1" },
};

describe("Phase 3R constants", () => {
  it("PHASE3R_RULE_VERSION is correct", () => {
    expect(PHASE3R_RULE_VERSION).toBe("phase3r-runtime-adoption-preflight/v1");
  });

  it("PHASE3R_RUNTIME_ADOPTION_POSTURE is No-Go", () => {
    expect(PHASE3R_RUNTIME_ADOPTION_POSTURE).toBe("No-Go");
  });

  it("PHASE3R_NEXT_STEP_READY mentions manual review and forbids direct adoption", () => {
    const nextStep = PHASE3R_NEXT_STEP_READY.toLowerCase();
    expect(nextStep).toContain("manual production runtime adoption review");
    expect(nextStep).toContain("no direct production adoption");
    expect(nextStep).toContain("no auto-execution");
    expect(nextStep).toContain("no auto-approve");
  });

  it("PHASE3R_NEXT_STEP_NOT_READY mentions resolving blockers", () => {
    expect(PHASE3R_NEXT_STEP_NOT_READY.toLowerCase()).toContain("blockers");
  });
});

describe("synthetic_fixture — blocked", () => {
  it("returns productionRuntimeAdoptionReviewReady false", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.productionRuntimeAdoptionReviewReady).toBe(false);
  });

  it("includes sampleKind blocker mentioning synthetic_fixture", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(
      result.blockedReasons.some((r) => r.includes("synthetic_fixture")),
    ).toBe(true);
  });

  it("productionAdoptionAllowed is false", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.productionAdoptionAllowed).toBe(false);
  });

  it("runtimeIntegrationAllowed is false", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.runtimeIntegrationAllowed).toBe(false);
  });

  it("ruleVersion is set", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.ruleVersion).toBe("phase3r-runtime-adoption-preflight/v1");
  });

  it("runtimeAdoptionPosture is No-Go", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.runtimeAdoptionPosture).toBe("No-Go");
  });

  it("includes realDataValidated blocker for synthetic_fixture", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(
      result.blockedReasons.some((r) => r.includes("realDataValidated")),
    ).toBe(true);
  });

  it("includes productionCalibrationComplete blocker for synthetic_fixture", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(
      result.blockedReasons.some((r) =>
        r.includes("productionCalibrationComplete"),
      ),
    ).toBe(true);
  });
});

describe("clean redacted_live_db_snapshot — ready but productionAdoptionAllowed false", () => {
  it("returns productionRuntimeAdoptionReviewReady true", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      CLEAN_LIVE_SNAPSHOT_PACK,
    );
    expect(result.productionRuntimeAdoptionReviewReady).toBe(true);
  });

  it("productionAdoptionAllowed remains false even when ready", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      CLEAN_LIVE_SNAPSHOT_PACK,
    );
    expect(result.productionAdoptionAllowed).toBe(false);
  });

  it("runtimeIntegrationAllowed remains false even when ready", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      CLEAN_LIVE_SNAPSHOT_PACK,
    );
    expect(result.runtimeIntegrationAllowed).toBe(false);
  });

  it("blockedReasons is empty when ready", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      CLEAN_LIVE_SNAPSHOT_PACK,
    );
    expect(result.blockedReasons).toHaveLength(0);
  });

  it("ruleVersion and runtimeAdoptionPosture are correct", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      CLEAN_LIVE_SNAPSHOT_PACK,
    );
    expect(result.ruleVersion).toBe("phase3r-runtime-adoption-preflight/v1");
    expect(result.runtimeAdoptionPosture).toBe("No-Go");
  });
});

describe("Phase 3P wrapper accepted", () => {
  it("accepts a Phase 3P --print-json synthetic wrapper without throwing", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      PHASE3P_WRAPPER_SYNTHETIC,
    );
    expect(result.ruleVersion).toBe("phase3r-runtime-adoption-preflight/v1");
  });

  it("Phase 3P wrapper with synthetic_fixture is blocked", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      PHASE3P_WRAPPER_SYNTHETIC,
    );
    expect(result.productionRuntimeAdoptionReviewReady).toBe(false);
  });

  it("Phase 3P wrapper with clean live snapshot is ready", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(PHASE3P_WRAPPER_LIVE);
    expect(result.productionRuntimeAdoptionReviewReady).toBe(true);
    expect(result.productionAdoptionAllowed).toBe(false);
  });

  it("Phase 3P wrapper with live snapshot still has productionAdoptionAllowed false", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(PHASE3P_WRAPPER_LIVE);
    expect(result.productionAdoptionAllowed).toBe(false);
    expect(result.runtimeIntegrationAllowed).toBe(false);
  });
});

describe("sensitive key rejected", () => {
  it("throws Phase3qRejectionError for input with 'title' key", () => {
    const input = {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      title: "Meeting notes",
    };
    expect(() =>
      evaluatePhase3rRuntimeAdoptionPreflight(input),
    ).toThrowError(Phase3qRejectionError);
  });

  it("throws Phase3qRejectionError for input with 'secret' key", () => {
    const input = {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      secret: "top-secret-value",
    };
    expect(() =>
      evaluatePhase3rRuntimeAdoptionPreflight(input),
    ).toThrowError(Phase3qRejectionError);
  });

  it("throws Phase3qRejectionError for input with 'token' key", () => {
    const input = {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      token: "bearer-abc",
    };
    expect(() =>
      evaluatePhase3rRuntimeAdoptionPreflight(input),
    ).toThrowError(Phase3qRejectionError);
  });

  it("rejection error carries sensitiveKeys populated", () => {
    const input = {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      body: "free text",
    };
    let caught: Phase3qRejectionError | undefined;
    try {
      evaluatePhase3rRuntimeAdoptionPreflight(input);
    } catch (e) {
      if (e instanceof Phase3qRejectionError) caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught?.validation.valid).toBe(false);
    expect(caught?.validation.sensitiveKeys).toContain("body");
  });
});

describe("email-like value rejected", () => {
  it("throws Phase3qRejectionError for input with email-like string value", () => {
    const input = {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      rawAddr: "user@example.com",
    };
    expect(() =>
      evaluatePhase3rRuntimeAdoptionPreflight(input),
    ).toThrowError(Phase3qRejectionError);
  });

  it("rejection error carries sensitiveEmailValues populated", () => {
    const input = {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      contactField: "contact@corp.io",
    };
    let caught: Phase3qRejectionError | undefined;
    try {
      evaluatePhase3rRuntimeAdoptionPreflight(input);
    } catch (e) {
      if (e instanceof Phase3qRejectionError) caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught?.validation.sensitiveEmailValues.length).toBeGreaterThan(0);
  });
});

describe("invalid shape rejected", () => {
  it("throws for a completely wrong shape", () => {
    expect(() =>
      evaluatePhase3rRuntimeAdoptionPreflight({ someRandomKey: "value" }),
    ).toThrow();
  });

  it("throws for null input", () => {
    expect(() => evaluatePhase3rRuntimeAdoptionPreflight(null)).toThrow();
  });

  it("throws for array input", () => {
    expect(() =>
      evaluatePhase3rRuntimeAdoptionPreflight([1, 2, 3]),
    ).toThrow();
  });

  it("throws for string input", () => {
    expect(() =>
      evaluatePhase3rRuntimeAdoptionPreflight("not an object"),
    ).toThrow();
  });

  it("throws when evidencePack field is null", () => {
    expect(() =>
      evaluatePhase3rRuntimeAdoptionPreflight({ evidencePack: null }),
    ).toThrow();
  });

  it("throws when evidencePack field is a string", () => {
    expect(() =>
      evaluatePhase3rRuntimeAdoptionPreflight({ evidencePack: "not-an-object" }),
    ).toThrow();
  });
});

describe("--print-json output shape", () => {
  it("result has all required fields for JSON serialization", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    expect(serialized).toHaveProperty("ruleVersion");
    expect(serialized).toHaveProperty("runtimeAdoptionPosture");
    expect(serialized).toHaveProperty("productionRuntimeAdoptionReviewReady");
    expect(serialized).toHaveProperty("productionAdoptionAllowed");
    expect(serialized).toHaveProperty("runtimeIntegrationAllowed");
    expect(serialized).toHaveProperty("blockedReasons");
    expect(serialized).toHaveProperty("allowedNextStep");
  });

  it("serialized productionAdoptionAllowed is false for blocked result", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    expect(serialized.productionAdoptionAllowed).toBe(false);
    expect(serialized.runtimeIntegrationAllowed).toBe(false);
  });

  it("serialized productionAdoptionAllowed is false for ready result", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      CLEAN_LIVE_SNAPSHOT_PACK,
    );
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    expect(serialized.productionAdoptionAllowed).toBe(false);
    expect(serialized.runtimeIntegrationAllowed).toBe(false);
    expect(serialized.productionRuntimeAdoptionReviewReady).toBe(true);
  });

  it("serialized blockedReasons is an array", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    expect(Array.isArray(serialized.blockedReasons)).toBe(true);
  });
});

describe("nextAllowedWork forbids direct production adoption", () => {
  it("allowedNextStep for ready result explicitly restricts work to manual review", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      CLEAN_LIVE_SNAPSHOT_PACK,
    );
    const allowedNextStep = result.allowedNextStep.toLowerCase();
    expect(allowedNextStep).toContain(
      "manual production runtime adoption review",
    );
    expect(allowedNextStep).toContain("no direct production adoption");
    expect(allowedNextStep).toContain("no auto-execution");
  });

  it("allowedNextStep for not-ready result only asks for blocker resolution", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    const allowedNextStep = result.allowedNextStep.toLowerCase();
    expect(allowedNextStep).toContain("resolve all blockers");
    expect(allowedNextStep).toContain("re-run this preflight gate");
    expect(allowedNextStep).not.toContain("productionadoptionallowed=true");
    expect(allowedNextStep).not.toContain("runtimeintegrationallowed=true");
  });

  it("productionAdoptionAllowed is false for all valid inputs regardless of readiness", () => {
    const blockedResult = evaluatePhase3rRuntimeAdoptionPreflight(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(blockedResult.productionAdoptionAllowed).toBe(false);

    const readyResult = evaluatePhase3rRuntimeAdoptionPreflight(
      CLEAN_LIVE_SNAPSHOT_PACK,
    );
    expect(readyResult.productionAdoptionAllowed).toBe(false);
  });

  it("runtimeIntegrationAllowed is false for all valid inputs", () => {
    const blockedResult = evaluatePhase3rRuntimeAdoptionPreflight(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(blockedResult.runtimeIntegrationAllowed).toBe(false);

    const readyResult = evaluatePhase3rRuntimeAdoptionPreflight(
      CLEAN_LIVE_SNAPSHOT_PACK,
    );
    expect(readyResult.runtimeIntegrationAllowed).toBe(false);
  });

  it("allowedNextStep for ready result explicitly forbids direct production adoption", () => {
    const result = evaluatePhase3rRuntimeAdoptionPreflight(
      CLEAN_LIVE_SNAPSHOT_PACK,
    );
    const allowedNextStep = result.allowedNextStep.toLowerCase();
    expect(allowedNextStep).toContain("no direct production adoption");
    expect(allowedNextStep).toContain("no runtimeintegrationallowed");
  });
});
