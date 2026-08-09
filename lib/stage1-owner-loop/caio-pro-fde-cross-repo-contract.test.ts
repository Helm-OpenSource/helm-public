import { describe, expect, it } from "vitest";

import {
  CAIO_PRO_CANONICAL_EXECUTION_RECEIPT_WRITER_CONTRACT,
  CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE,
  CAIO_PRO_FDE_CROSS_REPO_COMPATIBLE_INTERFACE_VERSIONS,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
  CAIO_PRO_FDE_OBJECT_SEMANTICS,
  CAIO_PRO_PACK_OPERATING_INPUT_CONTRACT,
  CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION,
  CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_CONTRACT,
  CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_SCHEMA_VERSION,
  caioProPackOperatingInputSchema,
  createCaioProPrivateExecutionResultProjection,
  validateCaioProFdeConsumerIdentity,
  validateCaioProFdeCrossRepoInterfaceVersion,
  validateCaioProPrivateExecutionResultProjection,
} from "./caio-pro-fde-cross-repo-contract";

function packInput() {
  return {
    schemaVersion: CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION,
    interfaceVersion: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
    contractRef: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
    contractHash: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
    evaluatorRevision:
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorRevision,
    evaluatorContractRef:
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractRef,
    evaluatorContractHash:
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractHash,
    workspaceRef: "workspace:workspace-1",
    portfolioRef: "opportunity:opportunity-1",
    evidenceSnapshotRef: "observation-run:run-1",
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
        evidenceRefs: ["observation-run:run-1"],
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
        evidenceRefs: ["observation-run:run-1"],
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
        "interfaceVersion",
        "contractRef",
        "contractHash",
        "evaluatorRevision",
        "evaluatorContractRef",
        "evaluatorContractHash",
        "workspaceRef",
        "portfolioRef",
        "evidenceSnapshotRef",
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
    expect(
      caioProPackOperatingInputSchema.safeParse({
        ...packInput(),
        contractHash: `sha256:${"0".repeat(64)}`,
      }).success,
    ).toBe(false);
    expect(
      caioProPackOperatingInputSchema.safeParse({
        ...packInput(),
        workspaceRef: "workspace:workspace-2",
      }).success,
    ).toBe(true);
    expect(
      caioProPackOperatingInputSchema.safeParse({
        ...packInput(),
        candidateInputs: Array.from({ length: 129 }, (_, index) => ({
          ...packInput().candidateInputs[0],
          candidateRef: `candidate-input:candidate-${index}`,
        })),
      }).success,
    ).toBe(false);
  });

  it("validates the complete interface and evaluator identity fail-closed", () => {
    const identity = {
      interfaceVersion: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
      contractRef: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
      contractHash: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
      evaluatorRevision:
        CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorRevision,
      evaluatorContractRef:
        CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractRef,
      evaluatorContractHash:
        CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractHash,
    };
    expect(validateCaioProFdeConsumerIdentity(identity)).toEqual({
      valid: true,
      errors: [],
    });
    for (const field of Object.keys(identity)) {
      expect(
        validateCaioProFdeConsumerIdentity({
          ...identity,
          [field]: "unknown:drift",
        }).valid,
      ).toBe(false);
    }
    expect(
      validateCaioProFdeConsumerIdentity({ ...identity, extra: true }).valid,
    ).toBe(false);
  });

  it("rejects URLs, IP literals, PII and secret-like refs", () => {
    const privateAddress = [10, 0, 0, 8].join(".");
    const unsafeRefs = [
      "observation-run:https://example.invalid/result",
      `observation-run:${privateAddress}`,
      "observation-run:13800138000",
      "observation-run:11010519491231002X",
      "observation-run:6222020202020202020",
      "observation-run:fe80::1",
      `observation-run:case:${privateAddress}`,
      `observation-run:server-${privateAddress}`,
      "observation-run:case:fe80::1",
      "observation-run:case:13800138000",
      "observation-run:ref-13800138000",
      "observation-run:ref-11010519491231002X",
      "observation-run:ref-6222020202020202020",
      "observation-run:phone-13800138000",
      "observation-run:id-card-11010519491231002X",
      "observation-run:bank-card-6222020202020202020",
      "observation-run:https:example.invalid",
      "observation-run:token-secret-value",
      "observation-run:mysql-username-password",
      `observation-run:sk-${"a".repeat(32)}`,
    ];
    for (const outcomeRef of unsafeRefs) {
      expect(() =>
        createCaioProPrivateExecutionResultProjection({
          ...privateProjectionInput(),
          evidenceSnapshotRef: outcomeRef,
          executionProofRefs: [outcomeRef],
          outcome: {
            ...privateProjectionInput().outcome,
            outcomeRef,
          },
        }),
      ).toThrow();
    }
  });

  it("publishes a tamper-evident private result projection with no canonical write authority", () => {
    expect(CAIO_PRO_PRIVATE_EXECUTION_RESULT_PROJECTION_CONTRACT).toMatchObject({
      outputKind: "execution_proof_and_result_projection",
      acceptedReceiptOutcomeMapping: {
        SUCCESS: {
          businessResult: "success",
          actionItemStatus: "EXECUTED",
          supervisionStatus: "resolved",
        },
        PARTIAL_SUCCESS: {
          businessResult: "failure",
          actionItemStatus: "EXECUTED",
          supervisionStatus: "open",
        },
        FAILURE: {
          businessResult: "failure",
          actionItemStatus: "EXECUTED",
          supervisionStatus: "open",
        },
      },
      prohibitedReceiptOutcomeRouting: {
        NOT_EXECUTED: "existing_core_blocked_without_execution_path",
        REJECTED: "existing_core_approval_rejection_path",
      },
      businessResultAuthority:
        "trusted_evidence_constrained_by_receipt_outcome",
      canonicalExecutionReceiptWriteAuthority: "none",
      authorityEffect: "none",
    });
    const projection = createCaioProPrivateExecutionResultProjection(
      privateProjectionInput(),
    );

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
        actionTaken: "Tampered result text.",
      }),
    ).toEqual({
      valid: false,
      errors: ["private_execution_result_projection_content_hash_mismatch"],
    });
    expect(() =>
      createCaioProPrivateExecutionResultProjection({
        ...privateProjectionInput(),
        outcome: {
          outcomeRef: "raw business result with spaces",
          result: "success",
          followedAiRecommendation: true,
        },
      }),
    ).toThrow();
    for (const [receiptOutcome, result] of [
      ["SUCCESS", "failure"],
      ["PARTIAL_SUCCESS", "success"],
      ["FAILURE", "success"],
    ] as const) {
      expect(() =>
        createCaioProPrivateExecutionResultProjection({
          ...privateProjectionInput(),
          receiptOutcome,
          outcome: {
            ...privateProjectionInput().outcome,
            result,
          },
        }),
      ).toThrow();
    }
    for (const receiptOutcome of ["NOT_EXECUTED", "REJECTED"] as const) {
      expect(() =>
        createCaioProPrivateExecutionResultProjection({
          ...privateProjectionInput(),
          receiptOutcome: receiptOutcome as "SUCCESS",
        }),
      ).toThrow();
    }
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
    expect(CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR).toMatchObject({
      contractHash: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
      contractRef: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
    });
  });
});

function privateProjectionInput() {
  return {
    interfaceVersion: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
    contractRef: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
    contractHash: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
    evaluatorRevision:
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorRevision,
    evaluatorContractRef:
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractRef,
    evaluatorContractHash:
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractHash,
    projectionRef: "private-result:execution-1",
    workspaceRef: "workspace:workspace-1",
    portfolioRef: "opportunity:opportunity-1",
    evidenceSnapshotRef: "observation-run:run-1",
    decisionRecordRef: "decision-record:decision-1",
    actionItemRef: "action-item:action-1",
    approvalTaskRef: "approval-task:approval-1",
    executionProofRefs: ["observation-run:run-1"],
    receiptOutcome: "SUCCESS" as const,
    actionTaken: "Recorded the private executor result projection.",
    outcome: {
      outcomeRef: "observation-run:run-1",
      result: "success" as const,
      followedAiRecommendation: true,
    },
    recordedAt: "2026-08-09T10:00:00.000Z",
  };
}
