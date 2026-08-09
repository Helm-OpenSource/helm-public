import { describe, expect, it } from "vitest";

import {
  CAIO_PRO_CANONICAL_EXECUTION_RECEIPT_WRITER_CONTRACT,
  CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE,
  CAIO_PRO_FDE_CROSS_REPO_COMPATIBLE_INTERFACE_VERSIONS,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
  CAIO_PRO_FDE_OBJECT_SEMANTICS,
  CAIO_PRO_PACK_OPERATING_INPUT_CONTRACT,
  CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION,
  CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_CONTRACT,
  CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_SCHEMA_VERSION,
  caioProPackOperatingInputSchema,
  createCaioProPrivateExecutionResultProjection,
  validateCaioProFdeCrossRepoInterfaceVersion,
  validateCaioProPrivateExecutionResultProjection,
} from "./caio-pro-fde-cross-repo-contract";

function packInput() {
  return {
    schemaVersion: CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION,
    taxonomy: [
      {
        taxonomyRef: "taxonomy:operating-risk",
        categoryRef: "category:delivery-risk",
        label: "Delivery risk",
      },
    ],
    metrics: [
      {
        metricRef: "metric:on-time-completion",
        definition: "Share of governed work completed within its accepted window.",
        unit: "percent",
        evidenceRefs: ["evidence:metric-definition"],
      },
    ],
    evidenceApplicabilityRules: [
      {
        ruleRef: "evidence-rule:delivery-risk",
        taxonomyRefs: ["taxonomy:operating-risk"],
        acceptedEvidenceKinds: ["verified_receipt", "source_observation"],
      },
    ],
    candidateInputs: [
      {
        candidateRef: "candidate-input:delivery-risk",
        taxonomyRefs: ["taxonomy:operating-risk"],
        metricRefs: ["metric:on-time-completion"],
        evidenceRefs: ["evidence:current-delivery-window"],
        rationale: "Evidence indicates a measurable delivery variance.",
      },
    ],
    authorityEffect: "none" as const,
  };
}

describe("CAIO Pro FDE public cross-repo contract", () => {
  it("keeps the business Portfolio distinct from the exactly-ten question portfolio", () => {
    expect(CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION).toBe(
      "helm.caio-pro-fde.cross-repo-interface.v1",
    );
    expect(CAIO_PRO_FDE_OBJECT_SEMANTICS.Portfolio).toMatchObject({
      objectName: "Portfolio",
      semantic: "business_asset_or_case_scope",
      operatingQuestionAuthority: "none",
    });
    expect(
      CAIO_PRO_FDE_OBJECT_SEMANTICS.CaioOperatingQuestionPortfolio,
    ).toMatchObject({
      objectName: "CaioOperatingQuestionPortfolio",
      semantic: "exactly_ten_operating_questions",
      operatingQuestionAuthority:
        "public_core_exactly_ten_or_insufficient_evidence",
      generationOutcomes: ["exactly_ten", "insufficient_evidence"],
    });
  });

  it("publishes a deterministic interface identity and rejects unknown versions", () => {
    expect(CAIO_PRO_FDE_CROSS_REPO_COMPATIBLE_INTERFACE_VERSIONS).toEqual([
      CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
    ]);
    expect(CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH).toMatch(
      /^sha256:[a-f0-9]{64}$/u,
    );
    expect(CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF).toContain(
      CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH.slice(7, 23),
    );
    expect(
      validateCaioProFdeCrossRepoInterfaceVersion(
        CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
      ),
    ).toEqual({ valid: true, errors: [] });
    expect(
      validateCaioProFdeCrossRepoInterfaceVersion(
        "helm.caio-pro-fde.cross-repo-interface.v2",
      ),
    ).toEqual({
      valid: false,
      errors: ["caio_pro_fde_cross_repo_interface_version_unsupported"],
    });
  });

  it("accepts only Pack taxonomy, metrics, evidence rules and candidate inputs", () => {
    expect(CAIO_PRO_PACK_OPERATING_INPUT_CONTRACT).toMatchObject({
      allowedTopLevelFields: [
        "schemaVersion",
        "taxonomy",
        "metrics",
        "evidenceApplicabilityRules",
        "candidateInputs",
        "authorityEffect",
      ],
      fixedQuestionOutput: "prohibited",
      coreGenerationOutcomes: ["exactly_ten", "insufficient_evidence"],
      authorityEffect: "none",
    });
    expect(caioProPackOperatingInputSchema.parse(packInput())).toEqual(
      packInput(),
    );

    expect(
      caioProPackOperatingInputSchema.safeParse({
        ...packInput(),
        questions: Array.from({ length: 10 }, (_, index) => ({
          questionId: `question-${index + 1}`,
        })),
      }).success,
    ).toBe(false);
    expect(
      caioProPackOperatingInputSchema.safeParse({
        ...packInput(),
        portfolio: { candidates: [] },
      }).success,
    ).toBe(false);
  });

  it("publishes a tamper-evident private result projection with no canonical write authority", () => {
    expect(CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_CONTRACT).toMatchObject({
      outputKind: "execution_proof_and_result_projection",
      canonicalExecutionReceiptWriteAuthority: "none",
      authorityEffect: "none",
    });
    const projection = createCaioProPrivateExecutionResultProjection({
      projectionRef: "private-result:execution-1",
      workspaceRef: "workspace:workspace-1",
      decisionRecordRef: "decision-record:decision-1",
      actionItemRef: "action-item:action-1",
      executionProofRefs: ["private-proof:execution-1"],
      outcome: {
        outcomeRef: "business-outcome:delivery-recovered",
        result: "success",
        followedAiRecommendation: true,
      },
      recordedAt: "2026-08-09T10:00:00.000Z",
    });

    expect(projection).toMatchObject({
      schemaVersion:
        CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_SCHEMA_VERSION,
      authorityEffect: "none",
      canonicalExecutionReceiptWriteAuthority: "none",
    });
    expect(validateCaioProPrivateExecutionResultProjection(projection)).toEqual({
      valid: true,
      errors: [],
    });
    expect(
      validateCaioProPrivateExecutionResultProjection({
        ...projection,
        outcome: { ...projection.outcome, result: "failure" },
      }),
    ).toEqual({
      valid: false,
      errors: ["private_execution_result_projection_content_hash_mismatch"],
    });
    expect(() =>
      createCaioProPrivateExecutionResultProjection({
        projectionRef: "private-result:execution-2",
        workspaceRef: "workspace:workspace-1",
        decisionRecordRef: "decision-record:decision-1",
        actionItemRef: "action-item:action-1",
        executionProofRefs: ["private-proof:execution-2"],
        outcome: {
          outcomeRef: "raw business result with spaces",
          result: "success",
          followedAiRecommendation: true,
        },
        recordedAt: "2026-08-09T10:00:00.000Z",
      }),
    ).toThrow();
  });

  it("names the sole canonical receipt writer and limits control-plane consumption", () => {
    expect(CAIO_PRO_CANONICAL_EXECUTION_RECEIPT_WRITER_CONTRACT).toEqual(
      expect.objectContaining({
        canonicalObjectName: "ExecutionReceipt",
        soleWriter: "recordExecutionReceipt",
        writerModule: "lib/receipts/execution-receipt.service.ts",
        privateExecutorOutputObjectName:
          "CaioProPrivateExecutionResultProjection",
        controlPlaneIndexFields: ["summary", "contentHash", "sourceRef"],
        authorityEffect: "none",
      }),
    );
  });

  it("exports a deterministic completion evaluator identity without copying the checklist", () => {
    expect(CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE).toMatchObject({
      evaluatorRevision: "caio-pro-v1-completion-evaluator.v1",
      completionItemCount: 13,
      consumerRule: "reference_only",
      packageReadyImplementationShaSource: "release_bom",
      charterShaIsPackageReadyImplementationSha: false,
    });
    expect(CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractHash).toMatch(
      /^sha256:[a-f0-9]{64}$/,
    );
    expect(CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractRef).toContain(
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractHash.slice(7, 23),
    );
    expect(CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE).not.toHaveProperty(
      "completionItems",
    );
  });
});
