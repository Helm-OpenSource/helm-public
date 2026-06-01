import { describe, expect, it } from "vitest";

import { DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK } from "../../features/business-advancement/phase3o-real-data-calibration-evidence-pack";
import { Phase3qRejectionError } from "../../scripts/business-advancement-phase3q-snapshot-intake-review";
import {
  PHASE3S_ALLOWED_NEXT_STEP_NOT_READY,
  PHASE3S_ALLOWED_NEXT_STEP_READY,
  PHASE3S_FORBIDDEN_WORK,
  PHASE3S_MANDATORY_CHECKLIST,
  PHASE3S_PRODUCTION_ADOPTION_DECISION,
  PHASE3S_REVIEW_POSTURE,
  PHASE3S_REVIEWER_ROLES,
  PHASE3S_RULE_VERSION,
  buildPhase3sRuntimeAdoptionReviewPacket,
} from "../../scripts/business-advancement-phase3s-runtime-adoption-review-packet";

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

describe("Phase 3S constants", () => {
  it("PHASE3S_RULE_VERSION is correct", () => {
    expect(PHASE3S_RULE_VERSION).toBe("phase3s-runtime-adoption-review-packet/v1");
  });

  it("PHASE3S_REVIEW_POSTURE is Manual-Review-Only", () => {
    expect(PHASE3S_REVIEW_POSTURE).toBe("Manual-Review-Only");
  });

  it("PHASE3S_PRODUCTION_ADOPTION_DECISION is No-Go", () => {
    expect(PHASE3S_PRODUCTION_ADOPTION_DECISION).toBe("No-Go");
  });

  it("PHASE3S_REVIEWER_ROLES is non-empty", () => {
    expect(PHASE3S_REVIEWER_ROLES.length).toBeGreaterThan(0);
  });

  it("PHASE3S_MANDATORY_CHECKLIST is non-empty", () => {
    expect(PHASE3S_MANDATORY_CHECKLIST.length).toBeGreaterThan(0);
  });

  it("PHASE3S_FORBIDDEN_WORK is non-empty", () => {
    expect(PHASE3S_FORBIDDEN_WORK.length).toBeGreaterThan(0);
  });

  it("PHASE3S_ALLOWED_NEXT_STEP_READY mentions manual review and forbids direct adoption", () => {
    const nextStep = PHASE3S_ALLOWED_NEXT_STEP_READY.toLowerCase();
    expect(nextStep).toContain("manual production runtime adoption review");
    expect(nextStep).toContain("no direct runtime adoption");
    expect(nextStep).toContain("no auto-execution");
    expect(nextStep).toContain("no auto-approve");
  });

  it("PHASE3S_ALLOWED_NEXT_STEP_NOT_READY mentions Phase 3R blockers", () => {
    const nextStep = PHASE3S_ALLOWED_NEXT_STEP_NOT_READY.toLowerCase();
    expect(nextStep).toContain("phase 3r blockers");
  });
});

describe("synthetic_fixture — blocked", () => {
  it("returns productionRuntimeAdoptionReviewPacketReady false", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.productionRuntimeAdoptionReviewPacketReady).toBe(false);
  });

  it("productionAdoptionAllowed is false", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.productionAdoptionAllowed).toBe(false);
  });

  it("runtimeIntegrationAllowed is false", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.runtimeIntegrationAllowed).toBe(false);
  });

  it("productionAdoptionDecision is No-Go", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.productionAdoptionDecision).toBe("No-Go");
  });

  it("reviewPosture is Manual-Review-Only", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.reviewPosture).toBe("Manual-Review-Only");
  });

  it("ruleVersion is correct", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.ruleVersion).toBe("phase3s-runtime-adoption-review-packet/v1");
  });

  it("blockedReasons is non-empty for synthetic", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.blockedReasons.length).toBeGreaterThan(0);
  });

  it("blockedReasons matches preflight blockedReasons", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.blockedReasons).toEqual(result.preflight.blockedReasons);
  });

  it("allowedNextStep mentions resolving blockers", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.allowedNextStep.toLowerCase()).toContain("blockers");
  });
});

describe("clean redacted_live_db_snapshot — packet ready but productionAdoptionAllowed false and decision No-Go", () => {
  it("returns productionRuntimeAdoptionReviewPacketReady true", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    expect(result.productionRuntimeAdoptionReviewPacketReady).toBe(true);
  });

  it("productionAdoptionAllowed remains false even when packet ready", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    expect(result.productionAdoptionAllowed).toBe(false);
  });

  it("runtimeIntegrationAllowed remains false even when packet ready", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    expect(result.runtimeIntegrationAllowed).toBe(false);
  });

  it("productionAdoptionDecision is No-Go even when packet ready", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    expect(result.productionAdoptionDecision).toBe("No-Go");
  });

  it("blockedReasons is empty when ready", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    expect(result.blockedReasons).toHaveLength(0);
  });

  it("reviewPosture is Manual-Review-Only when ready", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    expect(result.reviewPosture).toBe("Manual-Review-Only");
  });

  it("preflight.productionRuntimeAdoptionReviewReady is true", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    expect(result.preflight.productionRuntimeAdoptionReviewReady).toBe(true);
  });

  it("preflight.productionAdoptionAllowed is false", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    expect(result.preflight.productionAdoptionAllowed).toBe(false);
  });
});

describe("Phase 3P wrapper accepted", () => {
  it("accepts a Phase 3P --print-json synthetic wrapper without throwing", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(PHASE3P_WRAPPER_SYNTHETIC);
    expect(result.ruleVersion).toBe("phase3s-runtime-adoption-review-packet/v1");
  });

  it("Phase 3P wrapper with synthetic_fixture is blocked", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(PHASE3P_WRAPPER_SYNTHETIC);
    expect(result.productionRuntimeAdoptionReviewPacketReady).toBe(false);
  });

  it("Phase 3P wrapper with live snapshot is ready", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(PHASE3P_WRAPPER_LIVE);
    expect(result.productionRuntimeAdoptionReviewPacketReady).toBe(true);
  });

  it("Phase 3P wrapper with live snapshot still has productionAdoptionAllowed false", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(PHASE3P_WRAPPER_LIVE);
    expect(result.productionAdoptionAllowed).toBe(false);
    expect(result.runtimeIntegrationAllowed).toBe(false);
  });

  it("Phase 3P wrapper with live snapshot still has productionAdoptionDecision No-Go", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(PHASE3P_WRAPPER_LIVE);
    expect(result.productionAdoptionDecision).toBe("No-Go");
  });
});

describe("sensitive key rejected", () => {
  it("throws Phase3qRejectionError for input with 'title' key", () => {
    const input = {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      title: "Meeting notes",
    };
    expect(() =>
      buildPhase3sRuntimeAdoptionReviewPacket(input),
    ).toThrowError(Phase3qRejectionError);
  });

  it("throws Phase3qRejectionError for input with 'secret' key", () => {
    const input = {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      secret: "top-secret-value",
    };
    expect(() =>
      buildPhase3sRuntimeAdoptionReviewPacket(input),
    ).toThrowError(Phase3qRejectionError);
  });

  it("throws Phase3qRejectionError for input with 'token' key", () => {
    const input = {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      token: "bearer-abc",
    };
    expect(() =>
      buildPhase3sRuntimeAdoptionReviewPacket(input),
    ).toThrowError(Phase3qRejectionError);
  });

  it("rejection error carries sensitiveKeys populated", () => {
    const input = {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      body: "free text",
    };
    let caught: Phase3qRejectionError | undefined;
    try {
      buildPhase3sRuntimeAdoptionReviewPacket(input);
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
      buildPhase3sRuntimeAdoptionReviewPacket(input),
    ).toThrowError(Phase3qRejectionError);
  });

  it("rejection error carries sensitiveEmailValues populated", () => {
    const input = {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      contactField: "contact@corp.io",
    };
    let caught: Phase3qRejectionError | undefined;
    try {
      buildPhase3sRuntimeAdoptionReviewPacket(input);
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
      buildPhase3sRuntimeAdoptionReviewPacket({ someRandomKey: "value" }),
    ).toThrow();
  });

  it("throws for null input", () => {
    expect(() => buildPhase3sRuntimeAdoptionReviewPacket(null)).toThrow();
  });

  it("throws for array input", () => {
    expect(() =>
      buildPhase3sRuntimeAdoptionReviewPacket([1, 2, 3]),
    ).toThrow();
  });

  it("throws for string input", () => {
    expect(() =>
      buildPhase3sRuntimeAdoptionReviewPacket("not an object"),
    ).toThrow();
  });

  it("throws when evidencePack field is null", () => {
    expect(() =>
      buildPhase3sRuntimeAdoptionReviewPacket({ evidencePack: null }),
    ).toThrow();
  });
});

describe("forbiddenWork lists no production paths", () => {
  it("forbiddenWork includes data/queries.ts", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(
      result.forbiddenWork.some((w) => w.toLowerCase().includes("data/queries")),
    ).toBe(true);
  });

  it("forbiddenWork includes app route", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(
      result.forbiddenWork.some((w) => w.toLowerCase().includes("app route")),
    ).toBe(true);
  });

  it("forbiddenWork includes prisma schema", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(
      result.forbiddenWork.some((w) => w.toLowerCase().includes("prisma schema")),
    ).toBe(true);
  });

  it("forbiddenWork includes mobile read-model", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(
      result.forbiddenWork.some((w) => w.toLowerCase().includes("mobile read-model")),
    ).toBe(true);
  });

  it("forbiddenWork includes auto-execution", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(
      result.forbiddenWork.some((w) => w.toLowerCase().includes("auto-execution")),
    ).toBe(true);
  });

  it("forbiddenWork includes official write path", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(
      result.forbiddenWork.some((w) => w.toLowerCase().includes("official write path")),
    ).toBe(true);
  });

  it("forbiddenWork is the same for ready and blocked results", () => {
    const blocked = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    const ready = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    expect(blocked.forbiddenWork).toEqual(ready.forbiddenWork);
  });
});

describe("allowedNextStep does not grant adoption", () => {
  it("allowedNextStep for ready result does not contain productionAdoptionAllowed=true", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    expect(result.allowedNextStep.toLowerCase()).not.toContain(
      "productionadoptionallowed=true",
    );
  });

  it("allowedNextStep for ready result does not contain runtimeIntegrationAllowed=true", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    expect(result.allowedNextStep.toLowerCase()).not.toContain(
      "runtimeintegrationallowed=true",
    );
  });

  it("allowedNextStep for ready result explicitly forbids direct runtime adoption", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    const step = result.allowedNextStep.toLowerCase();
    expect(step).toContain("no direct runtime adoption");
  });

  it("allowedNextStep for ready result requires implementation plan", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    const step = result.allowedNextStep.toLowerCase();
    expect(step).toContain("implementation plan");
  });

  it("allowedNextStep for not-ready result only asks for blocker resolution", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    const step = result.allowedNextStep.toLowerCase();
    expect(step).toContain("blockers");
    expect(step).toContain("re-run");
    expect(step).not.toContain("productionadoptionallowed=true");
    expect(step).not.toContain("runtimeintegrationallowed=true");
  });
});

describe("--print-json serializable shape", () => {
  it("result has all required fields for JSON serialization (blocked)", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    expect(serialized).toHaveProperty("ruleVersion");
    expect(serialized).toHaveProperty("reviewPosture");
    expect(serialized).toHaveProperty("productionRuntimeAdoptionReviewPacketReady");
    expect(serialized).toHaveProperty("productionAdoptionAllowed");
    expect(serialized).toHaveProperty("runtimeIntegrationAllowed");
    expect(serialized).toHaveProperty("productionAdoptionDecision");
    expect(serialized).toHaveProperty("preflight");
    expect(serialized).toHaveProperty("blockedReasons");
    expect(serialized).toHaveProperty("reviewerRoles");
    expect(serialized).toHaveProperty("mandatoryChecklist");
    expect(serialized).toHaveProperty("forbiddenWork");
    expect(serialized).toHaveProperty("allowedNextStep");
  });

  it("result has all required fields for JSON serialization (ready)", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    expect(serialized).toHaveProperty("ruleVersion");
    expect(serialized).toHaveProperty("reviewPosture");
    expect(serialized).toHaveProperty("productionRuntimeAdoptionReviewPacketReady");
    expect(serialized).toHaveProperty("productionAdoptionAllowed");
    expect(serialized).toHaveProperty("runtimeIntegrationAllowed");
    expect(serialized).toHaveProperty("productionAdoptionDecision");
    expect(serialized).toHaveProperty("preflight");
    expect(serialized).toHaveProperty("blockedReasons");
    expect(serialized).toHaveProperty("reviewerRoles");
    expect(serialized).toHaveProperty("mandatoryChecklist");
    expect(serialized).toHaveProperty("forbiddenWork");
    expect(serialized).toHaveProperty("allowedNextStep");
  });

  it("serialized productionAdoptionAllowed is false for blocked result", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
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
    const result = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    expect(serialized.productionAdoptionAllowed).toBe(false);
    expect(serialized.runtimeIntegrationAllowed).toBe(false);
    expect(serialized.productionRuntimeAdoptionReviewPacketReady).toBe(true);
  });

  it("serialized productionAdoptionDecision is No-Go for ready result", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(CLEAN_LIVE_SNAPSHOT_PACK);
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    expect(serialized.productionAdoptionDecision).toBe("No-Go");
  });

  it("serialized blockedReasons is an array", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    expect(Array.isArray(serialized.blockedReasons)).toBe(true);
  });

  it("serialized reviewerRoles is a non-empty array", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    expect(Array.isArray(serialized.reviewerRoles)).toBe(true);
    expect((serialized.reviewerRoles as unknown[]).length).toBeGreaterThan(0);
  });

  it("serialized forbiddenWork is a non-empty array", () => {
    const result = buildPhase3sRuntimeAdoptionReviewPacket(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    expect(Array.isArray(serialized.forbiddenWork)).toBe(true);
    expect((serialized.forbiddenWork as unknown[]).length).toBeGreaterThan(0);
  });
});
