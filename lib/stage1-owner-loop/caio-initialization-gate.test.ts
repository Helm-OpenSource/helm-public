import { describe, expect, it } from "vitest";

import {
  CAIO_INITIALIZATION_ASSESSMENT_SCHEMA_VERSION,
  CAIO_INITIALIZATION_POLICY,
  computeCaioInitializationAssessment,
  selectCaioInitializationEvidenceSample,
  validateCaioInitializationAssessment,
  type CaioInitializationAssessmentInput,
  type CaioInitializationEvidenceTrace,
} from "./caio-initialization-gate";

const SHA_A = `sha256:${"a".repeat(64)}`;
const SHA_B = `sha256:${"b".repeat(64)}`;
const SHA_C = `sha256:${"c".repeat(64)}`;

function evidence(
  index: number,
  overrides: Partial<CaioInitializationEvidenceTrace> = {},
): CaioInitializationEvidenceTrace {
  return {
    evidenceRef: `evidence:caio-g0:${index}`,
    sourceRef: `source:crm-${index % 3}`,
    assetRef: `asset:crm-${index % 3}`,
    observationRunRef: `observation-run:crm-${index}`,
    authorizationReceiptRef: `receipt:authorization:crm-${index % 3}`,
    connectionReceiptRef: `receipt:connection:crm-${index % 3}`,
    initializationReceiptRef: `receipt:initialization:crm-${index % 3}`,
    sensitivity: (["internal", "confidential", "restricted"] as const)[
      index % 3
    ],
    outputType: (
      ["owner_answer", "operating_brief", "supervision_signal"] as const
    )[index % 3],
    capturedAt: new Date(
      Date.UTC(2026, 6, 23, 0, index),
    ).toISOString(),
    resolved: true,
    traceHash: SHA_A,
    ...overrides,
  };
}

function readyInput(): CaioInitializationAssessmentInput {
  return {
    schemaVersion: CAIO_INITIALIZATION_ASSESSMENT_SCHEMA_VERSION,
    workspaceRef: "workspace:synthetic-caio-pro",
    mandateRef: "caio-mandate:synthetic-caio-pro",
    evaluatedAt: "2026-07-23T08:00:00.000Z",
    assets: [
      {
        assetRef: "asset:crm-0",
        inventoryStatus: "inventoried",
        classificationStatus: "classified",
        sensitivity: "confidential",
        processingDisposition: "local_only",
        authorizationStatus: "authorized",
        authorizationReceiptRef: "receipt:authorization:crm-0",
        technicalFeasibility: "feasible",
        connectionStatus: "connected",
        connectionReceiptRef: "receipt:connection:crm-0",
        initializationStatus: "initialized",
        initializationReceiptRef: "receipt:initialization:crm-0",
        observationRunRefs: ["observation-run:crm-0"],
        schemaMappingRefs: ["schema-map:crm-0:v1"],
        companyMemoryBindings: [
          { ref: "memory-fact:crm-0", contentHash: SHA_A },
        ],
        temporalContextSnapshotRef: "artifact-bundle:context-0",
        exception: null,
      },
      {
        assetRef: "asset:crm-1",
        inventoryStatus: "inventoried",
        classificationStatus: "classified",
        sensitivity: "restricted",
        processingDisposition: "local_only",
        authorizationStatus: "authorized",
        authorizationReceiptRef: "receipt:authorization:crm-1",
        technicalFeasibility: "feasible",
        connectionStatus: "connected",
        connectionReceiptRef: "receipt:connection:crm-1",
        initializationStatus: "initialized",
        initializationReceiptRef: "receipt:initialization:crm-1",
        observationRunRefs: ["observation-run:crm-1"],
        schemaMappingRefs: ["schema-map:crm-1:v1"],
        companyMemoryBindings: [
          { ref: "memory-fact:crm-1", contentHash: SHA_B },
        ],
        temporalContextSnapshotRef: "artifact-bundle:context-0",
        exception: null,
      },
      {
        assetRef: "asset:crm-2",
        inventoryStatus: "inventoried",
        classificationStatus: "classified",
        sensitivity: "internal",
        processingDisposition: "local_only",
        authorizationStatus: "authorized",
        authorizationReceiptRef: "receipt:authorization:crm-2",
        technicalFeasibility: "feasible",
        connectionStatus: "connected",
        connectionReceiptRef: "receipt:connection:crm-2",
        initializationStatus: "initialized",
        initializationReceiptRef: "receipt:initialization:crm-2",
        observationRunRefs: ["observation-run:crm-2"],
        schemaMappingRefs: ["schema-map:crm-2:v1"],
        companyMemoryBindings: [
          { ref: "memory-fact:crm-2", contentHash: SHA_C },
        ],
        temporalContextSnapshotRef: "artifact-bundle:context-0",
        exception: null,
      },
    ],
    sources: [0, 1, 2].map((index) => ({
      sourceRef: `source:crm-${index}`,
      assetRef: `asset:crm-${index}`,
      compatibilityMode: false,
      sourceStatus: "active" as const,
      accessMode: "read_only_api" as const,
      latestRunRef: `observation-run:crm-${index}`,
      latestRunStatus: "succeeded" as const,
      latestRunOutcome: "success" as const,
      freshness: "fresh" as const,
      exception: null,
    })),
    evidenceTraces: [evidence(0), evidence(1), evidence(2)],
    knowledge: {
      memoryRebuildReceiptRef: "receipt:memory-rebuild:synthetic",
      memoryRootHash: SHA_A,
      temporalContextArtifactRef: "artifact-bundle:context-0",
      temporalContextInputHash: SHA_B,
      temporalContextSnapshotHash: SHA_C,
      temporalContextReplayRootHash: SHA_A,
      temporalContextReplayValid: true,
    },
    registeredWritePathCount: 0,
  };
}

describe("CAIO Pro initialization gate G0", () => {
  it("derives ready_for_owner_acceptance from complete evidence without accepting on behalf of the CEO", () => {
    const assessment = computeCaioInitializationAssessment(readyInput());

    expect(assessment.decision).toBe("ready_for_owner_acceptance");
    expect(assessment.failures).toEqual([]);
    expect(assessment.metrics.initializationRate).toBe(1);
    expect(assessment.metrics.sourceHealthRate).toBe(1);
    expect(assessment.metrics.evidenceTraceabilityRate).toBe(1);
    expect(assessment.ownerAcceptanceRequired).toBe(true);
    expect(assessment.ownerApprovalRecorded).toBe(false);
    expect(assessment.authorityEffect).toBe("none");
    expect(validateCaioInitializationAssessment(assessment)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("fails closed when an initialized projection lacks schema, Memory, or Context bindings", () => {
    const input = readyInput();
    input.assets[0] = {
      ...input.assets[0],
      schemaMappingRefs: [],
      companyMemoryBindings: [],
      temporalContextSnapshotRef: null,
    };

    const assessment = computeCaioInitializationAssessment(input);

    expect(assessment.decision).toBe("not_ready");
    expect(assessment.failures).toEqual(
      expect.arrayContaining([
        "initialized_asset_missing_schema_mapping",
        "initialized_asset_missing_company_memory",
        "initialized_asset_missing_temporal_context",
      ]),
    );
  });

  it("fails closed when a connected asset has no connection receipt binding", () => {
    const input = readyInput();
    input.assets[0].connectionReceiptRef = null;

    const assessment = computeCaioInitializationAssessment(input);

    expect(assessment.decision).toBe("not_ready");
    expect(assessment.failures).toContain("asset_state_incomplete");
  });

  it("does not infer complete inventory from an empty catalog", () => {
    const input = readyInput();
    input.assets = [];
    input.sources = [];
    input.evidenceTraces = [];

    const assessment = computeCaioInitializationAssessment(input);

    expect(assessment.decision).toBe("not_ready");
    expect(assessment.failures).toEqual(
      expect.arrayContaining([
        "asset_catalog_empty",
        "connected_source_missing",
        "evidence_trace_sample_empty",
      ]),
    );
  });

  it("accepts the 95 percent source-health boundary and rejects 94 percent without complete exceptions", () => {
    const atThreshold = readyInput();
    atThreshold.sources = Array.from({ length: 20 }, (_, index) => ({
      sourceRef: `source:threshold-${index}`,
      assetRef: "asset:crm-0",
      compatibilityMode: false,
      sourceStatus: "active" as const,
      accessMode: "read_only_api" as const,
      latestRunRef: `observation-run:threshold-${index}`,
      latestRunStatus:
        index === 19 ? ("failed" as const) : ("succeeded" as const),
      latestRunOutcome:
        index === 19 ? ("failure" as const) : ("success" as const),
      freshness: index === 19 ? ("stale" as const) : ("fresh" as const),
      exception: null,
    }));
    atThreshold.evidenceTraces = atThreshold.sources.map((source, index) =>
      evidence(index, {
        sourceRef: source.sourceRef,
        assetRef: source.assetRef,
        observationRunRef: source.latestRunRef,
      }),
    );

    expect(
      computeCaioInitializationAssessment(atThreshold).metrics.sourceHealthRate,
    ).toBe(0.95);
    expect(
      computeCaioInitializationAssessment(atThreshold).failures,
    ).not.toContain("connected_source_health_below_threshold");

    const belowThreshold = readyInput();
    belowThreshold.sources = Array.from({ length: 100 }, (_, index) => ({
      sourceRef: `source:below-${index}`,
      assetRef: "asset:crm-0",
      compatibilityMode: false,
      sourceStatus: "active" as const,
      accessMode: "read_only_api" as const,
      latestRunRef: `observation-run:below-${index}`,
      latestRunStatus:
        index >= 94 ? ("failed" as const) : ("succeeded" as const),
      latestRunOutcome:
        index >= 94 ? ("failure" as const) : ("success" as const),
      freshness: index >= 94 ? ("stale" as const) : ("fresh" as const),
      exception: null,
    }));
    belowThreshold.evidenceTraces = belowThreshold.sources.map(
      (source, index) =>
        evidence(index, {
          sourceRef: source.sourceRef,
          assetRef: source.assetRef,
          observationRunRef: source.latestRunRef,
        }),
    );

    const belowAssessment =
      computeCaioInitializationAssessment(belowThreshold);
    expect(belowAssessment.metrics.sourceHealthRate).toBe(0.94);
    expect(belowAssessment.failures).toContain(
      "connected_source_health_below_threshold",
    );
  });

  it("allows unhealthy sources only when every unhealthy source has a complete transparent exception", () => {
    const input = readyInput();
    input.sources[0] = {
      ...input.sources[0],
      latestRunStatus: "partial",
      latestRunOutcome: "partial_success",
      freshness: "stale",
      exception: {
        exceptionRef: "exception:source:crm-0",
        reasonCodes: ["vendor_rate_limit"],
        riskOwnerRef: "role:data-owner",
        nextReviewAt: "2026-07-30T08:00:00.000Z",
        evidenceRefs: ["evidence:source-exception:crm-0"],
      },
    };

    const assessment = computeCaioInitializationAssessment(input);

    expect(assessment.metrics.sourceHealthRate).toBeCloseTo(2 / 3);
    expect(assessment.failures).not.toContain(
      "connected_source_health_below_threshold",
    );
    expect(assessment.exceptionRefs).toContain("exception:source:crm-0");
  });

  it("rejects compatibility-only sources, unknown runs, and any registered write path", () => {
    const input = readyInput();
    input.sources[0] = {
      ...input.sources[0],
      compatibilityMode: true,
      latestRunStatus: "unknown",
      latestRunOutcome: "unknown",
      freshness: "unknown",
    };
    input.registeredWritePathCount = 1;

    const assessment = computeCaioInitializationAssessment(input);

    expect(assessment.failures).toEqual(
      expect.arrayContaining([
        "compatibility_source_present",
        "connected_source_health_below_threshold",
        "registered_write_path_present",
      ]),
    );
  });

  it("samples all records at 50 and deterministically samples at least 50 with full category coverage at 51", () => {
    const fifty = Array.from({ length: 50 }, (_, index) => evidence(index));
    expect(
      selectCaioInitializationEvidenceSample(
        fifty,
        CAIO_INITIALIZATION_POLICY.policyHash,
      ),
    ).toHaveLength(50);

    const fiftyOne = Array.from({ length: 51 }, (_, index) => evidence(index));
    const first = selectCaioInitializationEvidenceSample(
      fiftyOne,
      CAIO_INITIALIZATION_POLICY.policyHash,
    );
    const second = selectCaioInitializationEvidenceSample(
      [...fiftyOne].reverse(),
      CAIO_INITIALIZATION_POLICY.policyHash,
    );

    expect(first.length).toBeGreaterThanOrEqual(50);
    expect(second).toEqual(first);
    expect(new Set(first.map((item) => item.sourceRef))).toEqual(
      new Set(fiftyOne.map((item) => item.sourceRef)),
    );
    expect(new Set(first.map((item) => item.sensitivity))).toEqual(
      new Set(fiftyOne.map((item) => item.sensitivity)),
    );
    expect(new Set(first.map((item) => item.outputType))).toEqual(
      new Set(fiftyOne.map((item) => item.outputType)),
    );
  });

  it("rejects unresolved evidence and invalid temporal-context replay", () => {
    const input = readyInput();
    input.evidenceTraces[0] = {
      ...input.evidenceTraces[0],
      resolved: false,
    };
    input.knowledge.temporalContextReplayValid = false;

    const assessment = computeCaioInitializationAssessment(input);

    expect(assessment.failures).toEqual(
      expect.arrayContaining([
        "evidence_traceability_failed",
        "temporal_context_not_rebuildable",
      ]),
    );
  });

  it("detects assessment payload tampering through the content hash", () => {
    const assessment = computeCaioInitializationAssessment(readyInput());

    expect(
      validateCaioInitializationAssessment({
        ...assessment,
        metrics: {
          ...assessment.metrics,
          sourceHealthRate: 0,
        },
      }).errors,
    ).toContain("assessment_content_hash_mismatch");
  });

  it("fails closed on duplicate catalog identities or an invalid evaluation instant", () => {
    const input = readyInput();
    input.assets.push({ ...input.assets[0] });
    input.evaluatedAt = "not-a-timestamp";

    expect(
      computeCaioInitializationAssessment(input).failures,
    ).toContain("input_invalid");
  });
});
