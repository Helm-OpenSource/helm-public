import { describe, expect, it } from "vitest";

import { DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK } from "../../features/business-advancement/phase3o-real-data-calibration-evidence-pack";
import {
  PHASE3Q_SENSITIVE_KEYS,
  Phase3qRejectionError,
  extractEvidencePack,
  runPhase3qSnapshotIntakeReview,
  scanSensitiveEmailValues,
  scanSensitiveKeys,
  validateSnapshotInput,
} from "../../scripts/business-advancement-phase3q-snapshot-intake-review";

describe("PHASE3Q_SENSITIVE_KEYS", () => {
  it("includes all required sensitive key names", () => {
    const required = [
      "title",
      "description",
      "subject",
      "body",
      "email",
      "counterpart",
      "participants",
      "summary",
      "secret",
      "token",
    ];
    for (const key of required) {
      expect(PHASE3Q_SENSITIVE_KEYS).toContain(key);
    }
  });

  it("has exactly 10 sensitive keys", () => {
    expect(PHASE3Q_SENSITIVE_KEYS).toHaveLength(10);
  });
});

describe("scanSensitiveKeys", () => {
  it("returns empty for a clean object", () => {
    expect(
      scanSensitiveKeys({ rowId: "abc-hash", workspaceId: "ws-hash" }),
    ).toEqual([]);
  });

  it("detects a sensitive key at top level", () => {
    const result = scanSensitiveKeys({ title: "Meeting notes" });
    expect(result).toContain("title");
  });

  it("detects sensitive keys case-insensitively", () => {
    const result = scanSensitiveKeys({ Email: "redacted", TOKEN: "redacted" });
    expect(result).toEqual(["Email", "TOKEN"]);
  });

  it("detects a sensitive key nested in an object", () => {
    const result = scanSensitiveKeys({
      rows: { nested: { description: "text" } },
    });
    expect(result.some((p) => p.includes("description"))).toBe(true);
  });

  it("detects a sensitive key inside an array element", () => {
    const result = scanSensitiveKeys([{ subject: "Re: follow up" }]);
    expect(result.some((p) => p.includes("subject"))).toBe(true);
  });

  it("detects all 10 sensitive key names in one object", () => {
    const obj = {
      title: 1,
      description: 2,
      subject: 3,
      body: 4,
      email: 5,
      counterpart: 6,
      participants: 7,
      summary: 8,
      secret: 9,
      token: 10,
    };
    const result = scanSensitiveKeys(obj);
    expect(result).toHaveLength(10);
  });

  it("returns empty for the default Phase 3O synthetic evidence pack", () => {
    const result = scanSensitiveKeys(DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK);
    expect(result).toEqual([]);
  });

  it("does not flag non-sensitive key names that partially match", () => {
    expect(scanSensitiveKeys({ emailThreadId: "thread-abc", rowId: "r1" })).toEqual([]);
  });

  it("includes path in reported key location", () => {
    const result = scanSensitiveKeys({ rows: { tpqr001: [{ token: "abc" }] } });
    expect(result.some((p) => p.includes("token"))).toBe(true);
    expect(result.some((p) => p.includes("rows"))).toBe(true);
  });
});

describe("scanSensitiveEmailValues", () => {
  it("returns empty for a clean object", () => {
    expect(
      scanSensitiveEmailValues({ rowId: "workspace-ab12cd34ef56ab12" }),
    ).toEqual([]);
  });

  it("detects an email-like string value at top level", () => {
    const result = scanSensitiveEmailValues({
      counterpartEmail: "user@example.com",
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("counterpartEmail");
  });

  it("detects an email-like value nested in an array", () => {
    const result = scanSensitiveEmailValues([{ addr: "foo@bar.org" }]);
    expect(result.some((p) => p.includes("addr"))).toBe(true);
  });

  it("passes opaque hashed IDs that do not match the email pattern", () => {
    expect(
      scanSensitiveEmailValues({
        workspaceId: "workspace-ab12cd34ef56ab12",
        rowId: "actionItem-99aabbccddeeff00",
      }),
    ).toEqual([]);
  });

  it("returns empty for the default Phase 3O synthetic evidence pack", () => {
    expect(
      scanSensitiveEmailValues(DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK),
    ).toEqual([]);
  });

  it("does not flag numbers or booleans", () => {
    expect(
      scanSensitiveEmailValues({
        referenceClockMs: 1777161600000,
        hasApprovalTask: false,
      }),
    ).toEqual([]);
  });

  it("detects email-like values nested deeply", () => {
    const result = scanSensitiveEmailValues({
      rows: { tpqr001: [{ meta: { addr: "test@corp.io" } }] },
    });
    expect(result.some((p) => p.includes("addr"))).toBe(true);
  });
});

describe("extractEvidencePack", () => {
  it("accepts a Phase 3O direct evidencePack object", () => {
    const pack = extractEvidencePack(DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK);
    expect(pack.sampleKind).toBe("synthetic_fixture");
    expect(pack.workspaceId).toBe(DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.workspaceId);
  });

  it("accepts a Phase 3P --print-json object with evidencePack key", () => {
    const phase3pOutput = {
      evidencePack: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      evaluation: {
        ruleVersion: "phase3o-real-data-calibration-evidence-pack/v1",
      },
    };
    const pack = extractEvidencePack(phase3pOutput);
    expect(pack.sampleKind).toBe("synthetic_fixture");
    expect(pack.workspaceId).toBe(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK.workspaceId,
    );
  });

  it("throws for a string input", () => {
    expect(() => extractEvidencePack("not an object")).toThrow(
      /non-null object/,
    );
  });

  it("throws for null input", () => {
    expect(() => extractEvidencePack(null)).toThrow(/non-null object/);
  });

  it("throws for array input", () => {
    expect(() => extractEvidencePack([1, 2, 3])).toThrow(/non-null object/);
  });

  it("throws for an object missing required Phase 3O fields", () => {
    expect(() => extractEvidencePack({ someRandomKey: "value" })).toThrow(
      /Phase 3O evidencePack object/,
    );
  });

  it("throws when evidencePack field is not an object", () => {
    expect(() =>
      extractEvidencePack({ evidencePack: "not-an-object" }),
    ).toThrow(/non-null object/);
  });

  it("throws when evidencePack field is null", () => {
    expect(() => extractEvidencePack({ evidencePack: null })).toThrow(
      /non-null object/,
    );
  });
});

describe("validateSnapshotInput", () => {
  it("passes a clean Phase 3O evidence pack", () => {
    const result = validateSnapshotInput(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.valid).toBe(true);
    expect(result.sensitiveKeys).toHaveLength(0);
    expect(result.sensitiveEmailValues).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects input with a sensitive key", () => {
    const result = validateSnapshotInput({
      title: "Meeting notes",
      rowId: "abc",
    });
    expect(result.valid).toBe(false);
    expect(result.sensitiveKeys).toContain("title");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects input with an email-like value", () => {
    const result = validateSnapshotInput({
      rowId: "abc",
      addr: "user@example.com",
    });
    expect(result.valid).toBe(false);
    expect(result.sensitiveEmailValues.length).toBeGreaterThan(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("reports both sensitive key and email value errors separately", () => {
    const result = validateSnapshotInput({
      subject: "Contract renewal",
      addr: "partner@corp.com",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.sensitiveKeys.length).toBeGreaterThan(0);
    expect(result.sensitiveEmailValues.length).toBeGreaterThan(0);
  });

  it("passes a Phase 3P --print-json object that has no sensitive fields", () => {
    const phase3pOutput = {
      evidencePack: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      evaluation: { ruleVersion: "phase3o-real-data-calibration-evidence-pack/v1" },
    };
    const result = validateSnapshotInput(phase3pOutput);
    expect(result.valid).toBe(true);
  });
});

describe("runPhase3qSnapshotIntakeReview", () => {
  it("evaluates a clean Phase 3O direct evidence pack", () => {
    const result = runPhase3qSnapshotIntakeReview(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.ruleVersion).toBe("phase3q-snapshot-intake-review/v1");
    expect(result.runtimeAdoptionPosture).toBe("No-Go");
    expect(result.validation.valid).toBe(true);
    expect(result.evidencePack.sampleKind).toBe("synthetic_fixture");
    expect(result.evaluation.runtimeAdoptionPosture).toBe("No-Go");
  });

  it("evaluates a clean Phase 3P --print-json wrapped object", () => {
    const phase3pOutput = {
      evidencePack: DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      evaluation: { ruleVersion: "phase3o-real-data-calibration-evidence-pack/v1" },
    };
    const result = runPhase3qSnapshotIntakeReview(phase3pOutput);
    expect(result.evidencePack.sampleKind).toBe("synthetic_fixture");
    expect(result.evaluation.runtimeAdoptionPosture).toBe("No-Go");
  });

  it("throws Phase3qRejectionError for input containing a sensitive key", () => {
    const input = {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      title: "not allowed",
    };
    expect(() => runPhase3qSnapshotIntakeReview(input)).toThrowError(
      Phase3qRejectionError,
    );
  });

  it("throws Phase3qRejectionError for input containing an email-like value", () => {
    const input = {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      rawAddr: "contact@acme.io",
    };
    expect(() => runPhase3qSnapshotIntakeReview(input)).toThrowError(
      Phase3qRejectionError,
    );
  });

  it("rejection error carries the validation result with sensitiveKeys populated", () => {
    const input = { title: "sensitive data" };
    let caught: Phase3qRejectionError | undefined;
    try {
      runPhase3qSnapshotIntakeReview(input);
    } catch (e) {
      if (e instanceof Phase3qRejectionError) caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught?.validation.valid).toBe(false);
    expect(caught?.validation.sensitiveKeys).toContain("title");
  });

  it("rejection error carries the validation result with sensitiveEmailValues populated", () => {
    const input = { rawEmail: "foo@bar.com" };
    let caught: Phase3qRejectionError | undefined;
    try {
      runPhase3qSnapshotIntakeReview(input);
    } catch (e) {
      if (e instanceof Phase3qRejectionError) caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught?.validation.sensitiveEmailValues.length).toBeGreaterThan(0);
  });

  it("synthetic evidence pack evaluation is not realDataValidated", () => {
    const result = runPhase3qSnapshotIntakeReview(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.evaluation.realDataValidated).toBe(false);
    expect(result.evaluation.productionCalibrationComplete).toBe(false);
  });

  it("a redacted_live_db_snapshot evidence pack that passes all checks is realDataValidated", () => {
    const liveSnapshotPack = {
      ...DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
      sampleKind: "redacted_live_db_snapshot" as const,
    };
    const result = runPhase3qSnapshotIntakeReview(liveSnapshotPack);
    expect(result.evaluation.realDataValidated).toBe(true);
    expect(result.evaluation.productionCalibrationComplete).toBe(true);
    expect(result.evaluation.blockers).toHaveLength(0);
  });

  it("result includes the evaluation with TPQR family summaries", () => {
    const result = runPhase3qSnapshotIntakeReview(
      DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
    );
    expect(result.evaluation.tpqr001).toBeDefined();
    expect(result.evaluation.tpqr003).toBeDefined();
    expect(result.evaluation.tpqr004).toBeDefined();
  });
});
