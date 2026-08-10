import { describe, expect, it } from "vitest";

import {
  CAIO_EVIDENCE_TRACE_SCHEMA_VERSION,
  computeCaioEvidenceTraceHash,
  validateCaioEvidenceTraceArtifact,
} from "./caio-initialization-artifacts";

function evidenceTrace(overrides: Record<string, unknown> = {}) {
  const content = {
    schemaVersion: CAIO_EVIDENCE_TRACE_SCHEMA_VERSION,
    evidenceRef: "evidence:portfolio-scope:1",
    evidenceKind: "portfolio_scope",
    sourceRef: "source:crm:1",
    assetRef: "asset:crm",
    observationRunRef: "run-1",
    authorizationReceiptRef: "receipt:authorization:crm",
    connectionReceiptRef: "receipt:connection:crm",
    initializationReceiptRef: "receipt:initialization:crm",
    sensitivity: "confidential",
    outputType: "operating_brief",
    capturedAt: "2026-08-09T23:30:00.000Z",
    resolved: true,
    ...overrides,
  };
  return {
    ...content,
    traceHash: computeCaioEvidenceTraceHash(content as never),
  };
}

describe("CAIO initialization evidence trace artifact", () => {
  it("accepts an optional canonical evidence semantic kind", () => {
    expect(validateCaioEvidenceTraceArtifact(evidenceTrace())).toEqual({
      valid: true,
      errors: [],
    });
    expect(
      validateCaioEvidenceTraceArtifact(
        evidenceTrace({ evidenceKind: undefined }),
      ),
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects a non-canonical evidence semantic kind", () => {
    expect(
      validateCaioEvidenceTraceArtifact(
        evidenceTrace({ evidenceKind: "Portfolio Scope" }),
      ),
    ).toMatchObject({
      valid: false,
      errors: expect.arrayContaining(["evidence_trace_evidence_kind_invalid"]),
    });
  });

  it("binds evidence semantic kind mutations into the trace hash", () => {
    const trace = evidenceTrace();

    expect(
      validateCaioEvidenceTraceArtifact({
        ...trace,
        evidenceKind: "source_provenance",
      }),
    ).toMatchObject({
      valid: false,
      errors: expect.arrayContaining(["evidence_trace_hash_mismatch"]),
    });
  });
});
