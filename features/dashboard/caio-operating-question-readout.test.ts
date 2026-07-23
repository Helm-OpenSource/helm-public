import { ActorType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildCaioOperatingQuestionReadout,
  type CaioCurrentAcceptedG0ReadContext,
  type CaioOperatingQuestionPortfolioHeadReadRow,
  type CaioQuestionSelectionHeadReadRow,
} from "@/features/dashboard/caio-operating-question-readout";
import {
  createCaioInitializationRevocationReceipt,
} from "@/lib/stage1-owner-loop/caio-initialization-gate-receipt";
import {
  createCaioOperatingQuestionGenerationReceipt,
  evaluateCaioOperatingQuestionGeneration,
} from "@/lib/stage1-owner-loop/caio-operating-question";
import { createCaioOperatingQuestionImplementationPlan } from "@/lib/stage1-owner-loop/caio-operating-question-implementation-plan";
import {
  syntheticOperatingQuestionG0Source,
  syntheticOperatingQuestionGenerationInput,
} from "@/lib/stage1-owner-loop/caio-operating-question.test-fixtures";
import { createCaioQuestionSelectionReceipt } from "@/lib/stage1-owner-loop/caio-question-selection";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

const READOUT_NOW = new Date("2026-07-23T10:30:00.000Z");

function storedGenerationReceipt(
  receipt: ReturnType<
    typeof createCaioOperatingQuestionGenerationReceipt
  >,
): CaioOperatingQuestionPortfolioHeadReadRow["currentGenerationReceipt"] {
  return {
    id: receipt.receiptId,
    workspaceId: receipt.workspaceRef.replace("workspace:", ""),
    initializationGateReceiptId: receipt.gateReceiptRef,
    initializationAssessmentId: receipt.assessmentRef,
    portfolioId: receipt.portfolioRef,
    previousReceiptId: receipt.previousReceiptRef,
    previousReceiptHash: receipt.previousReceiptHash,
    sequence: receipt.sequence,
    generationKey: receipt.generationKey,
    // requestHash is write-idempotency metadata and intentionally is not part
    // of the immutable public receipt contract.
    requestHash: `sha256:${"1".repeat(64)}`,
    generationInputHash: receipt.generationInputHash,
    status: receipt.status,
    evidenceRefs: JSON.stringify(receipt.evidenceRefs),
    gapCodes: JSON.stringify(receipt.gapCodes),
    generatorRevision: receipt.generatorRevision,
    policyRef: receipt.policyRef,
    policyHash: receipt.policyHash,
    receiptJson: JSON.stringify(receipt),
    contentHash: receipt.contentHash,
    authorityEffect: receipt.authorityEffect,
    recordedAt: new Date(receipt.recordedAt),
    createdAt: new Date(receipt.recordedAt),
  };
}

function currentG0Context(): CaioCurrentAcceptedG0ReadContext {
  const { assessment, gateReceipt } =
    syntheticOperatingQuestionG0Source();
  return {
    assessment,
    receipt: gateReceipt,
  };
}

function generatedRows() {
  const evaluation = evaluateCaioOperatingQuestionGeneration(
    syntheticOperatingQuestionGenerationInput(),
  );
  if (!evaluation.portfolio) {
    throw new Error("synthetic portfolio required");
  }
  const portfolio = evaluation.portfolio;
  const generationReceipt = createCaioOperatingQuestionGenerationReceipt({
    evaluation,
    previousReceipt: null,
    evidenceRefs: portfolio.evidenceRefs,
    recordedAt: "2026-07-23T09:00:00.000Z",
  });
  const workspaceId = portfolio.workspaceRef.replace("workspace:", "");
  const portfolioHead: CaioOperatingQuestionPortfolioHeadReadRow = {
    initializationGateReceiptId: portfolio.gateReceiptRef,
    initializationAssessmentId: portfolio.assessmentRef,
    currentGenerationReceiptId: generationReceipt.receiptId,
    currentPortfolioId: portfolio.portfolioId,
    generationSequence: 1,
    portfolioSequence: 1,
    version: 1,
    updatedAt: new Date("2026-07-23T09:00:00.000Z"),
    currentGenerationReceipt: storedGenerationReceipt(
      generationReceipt,
    ),
    currentPortfolio: {
      id: portfolio.portfolioId,
      workspaceId,
      initializationGateReceiptId: portfolio.gateReceiptRef,
      initializationAssessmentId: portfolio.assessmentRef,
      previousPortfolioId: portfolio.previousPortfolioRef,
      sequence: portfolio.sequence,
      generationKey: portfolio.generationKey,
      generationInputHash: portfolio.generationInputHash,
      generatorRevision: portfolio.generatorRevision,
      generatorRef: portfolio.generatorRef,
      modelRef: portfolio.modelRef,
      policyRef: portfolio.policyRef,
      policyHash: portfolio.policyHash,
      g0ContextHash: portfolio.g0ContextHash,
      evidenceUniverseHash: portfolio.evidenceUniverseHash,
      evidenceRefs: JSON.stringify(portfolio.evidenceRefs),
      auditRefs: JSON.stringify(portfolio.auditRefs),
      portfolioJson: JSON.stringify(portfolio),
      contentHash: portfolio.contentHash,
      authorityEffect: portfolio.authorityEffect,
      generatedAt: new Date(portfolio.generatedAt),
      createdAt: new Date(portfolio.generatedAt),
    },
  };
  return {
    portfolio,
    generationReceipt,
    portfolioHead,
    currentG0Context: currentG0Context(),
  };
}

function selectedRows(input?: {
  includeImplementationPlans?: boolean;
}) {
  const { portfolio, portfolioHead, currentG0Context } = generatedRows();
  const selectionReceipt = createCaioQuestionSelectionReceipt({
    portfolio,
    workspaceRef: portfolio.workspaceRef,
    ceoPrincipalBindingRef: "binding:ceo:synthetic-caio",
    ceoPrincipalRef: "principal:ceo:synthetic-caio",
    actorUserRef: "user:ceo:synthetic-caio",
    idempotencyKey: "selection:dashboard:1",
    previousReceipt: null,
    selections: portfolio.candidates.slice(0, 2).map((candidate, index) => ({
      questionId: candidate.questionId,
      questionOverride: null,
      goal: candidate.firstNarrowLoop.objective,
      successMetrics: [
        {
          metricKey: `metric-${index + 1}`,
          target: `Validate priority ${index + 1}`,
        },
      ],
      priority: index + 1,
      implementationScopeRefs: ["scope:review-only"],
      ownerRef: null,
      reviewerRef: null,
      startsAt: null,
      endsAt: null,
      prohibitedActions: ["external_side_effect"],
    })),
    reasonCodes: ["ceo_selected_operating_focus"],
    evidenceRefs: [portfolio.candidates[0].evidenceRefs[0]],
    selectedAt: "2026-07-23T10:00:00.000Z",
  });
  const selectionHead: CaioQuestionSelectionHeadReadRow = {
    currentPortfolioId: portfolio.portfolioId,
    currentGateReceiptId: portfolio.gateReceiptRef,
    currentReceiptId: selectionReceipt.receiptId,
    sequence: 1,
    version: 1,
    updatedAt: new Date("2026-07-23T10:00:00.000Z"),
    currentReceipt: {
      id: selectionReceipt.receiptId,
      workspaceId: portfolio.workspaceRef.replace("workspace:", ""),
      portfolioId: selectionReceipt.portfolioRef,
      initializationGateReceiptId: selectionReceipt.gateReceiptRef,
      ceoPrincipalBindingId:
        selectionReceipt.ceoPrincipalBindingRef,
      previousReceiptId: selectionReceipt.previousReceiptRef,
      previousReceiptHash: selectionReceipt.previousReceiptHash,
      sequence: selectionReceipt.sequence,
      idempotencyKey: selectionReceipt.idempotencyKey,
      requestHash: selectionReceipt.requestHash,
      actorType: ActorType.USER,
      actorUserId: selectionReceipt.actorUserRef,
      ceoPrincipalRef: selectionReceipt.ceoPrincipalRef,
      selectionsJson: JSON.stringify(selectionReceipt.selections),
      selectedQuestionIds: JSON.stringify(
        selectionReceipt.selectedQuestionIds,
      ),
      reasonCodes: JSON.stringify(selectionReceipt.reasonCodes),
      evidenceRefs: JSON.stringify(selectionReceipt.evidenceRefs),
      receiptJson: JSON.stringify(selectionReceipt),
      contentHash: selectionReceipt.contentHash,
      authorityEffect: selectionReceipt.authorityEffect,
      workPacketEffect: selectionReceipt.workPacketEffect,
      selectedAt: new Date(selectionReceipt.selectedAt),
      createdAt: new Date(selectionReceipt.selectedAt),
      decisionBindings: selectionReceipt.selectedQuestionIds.map(
        (questionId, index) => {
          const candidate = portfolio.candidates.find(
            (item) => item.questionId === questionId,
          );
          if (!candidate) throw new Error("selected candidate required");
          const decisionRecordId = `decision-${index + 1}`;
          const bindingId = `binding-${index + 1}`;
          const implementationPlan =
            createCaioOperatingQuestionImplementationPlan({
              portfolio,
              selectionReceipt,
              questionId,
              decisionRecordRef: decisionRecordId,
            });
          return {
            id: bindingId,
            workspaceId: portfolio.workspaceRef.replace("workspace:", ""),
            selectionReceiptId: selectionReceipt.receiptId,
            portfolioId: portfolio.portfolioId,
            questionId,
            candidateHash: candidate.contentHash,
            decisionRecordId,
            actorUserId: selectionReceipt.actorUserRef,
            createdAt: new Date(selectionReceipt.selectedAt),
            implementationPlan:
              input?.includeImplementationPlans === false
                ? null
                : {
                    id: implementationPlan.planId,
                    workspaceId: portfolio.workspaceRef.replace(
                      "workspace:",
                      "",
                    ),
                    selectionReceiptId: selectionReceipt.receiptId,
                    portfolioId: portfolio.portfolioId,
                    questionId,
                    candidateHash: candidate.contentHash,
                    decisionBindingId: bindingId,
                    decisionRecordId,
                    planJson: JSON.stringify(implementationPlan),
                    contentHash: implementationPlan.contentHash,
                    status: implementationPlan.status,
                    implementationReadiness:
                      implementationPlan.implementationReadiness,
                    gapCodes: JSON.stringify(
                      implementationPlan.gapCodes,
                    ),
                    authorityEffect:
                      implementationPlan.authorityEffect,
                    workPacketEffect:
                      implementationPlan.workPacketEffect,
                    actorUserId: selectionReceipt.actorUserRef,
                    plannedAt: new Date(implementationPlan.createdAt),
                    createdAt: new Date(implementationPlan.createdAt),
                  },
          };
        },
      ),
    },
  };
  return {
    portfolio,
    portfolioHead,
    currentG0Context,
    selectionReceipt,
    selectionHead,
  };
}

describe("CAIO operating-question dashboard readout", () => {
  it("keeps the empty state honest", () => {
    expect(
      buildCaioOperatingQuestionReadout({
        now: READOUT_NOW,
        currentG0Context: null,
        portfolioHead: null,
        selectionHead: null,
      }),
    ).toMatchObject({
      state: "not_generated",
      boundary: "read_only",
      candidates: [],
      selectedQuestionIds: [],
      implementationPlanCount: 0,
    });
  });

  it("projects exactly ten validated questions without implying CEO selection", () => {
    const { portfolioHead, currentG0Context } = generatedRows();

    const readout = buildCaioOperatingQuestionReadout({
      now: READOUT_NOW,
      currentG0Context,
      portfolioHead,
      selectionHead: null,
    });

    expect(readout.state).toBe("awaiting_selection");
    expect(readout.candidates).toHaveLength(10);
    expect(readout.candidates[0]).toMatchObject({
      rank: 1,
      selected: false,
      decisionRecordId: null,
    });
  });

  it("shows current CEO selections with canonical DecisionRecord bindings and implementation plans", () => {
    const {
      portfolioHead,
      currentG0Context,
      selectionReceipt,
      selectionHead,
    } = selectedRows();

    const readout = buildCaioOperatingQuestionReadout({
      now: READOUT_NOW,
      currentG0Context,
      portfolioHead,
      selectionHead,
    });

    expect(readout.state).toBe("selected");
    expect(readout.selectedQuestionIds).toEqual(
      selectionReceipt.selectedQuestionIds,
    );
    expect(readout.decisionBindingCount).toBe(2);
    expect(readout.implementationPlanCount).toBe(2);
    expect(
      readout.candidates
        .filter((candidate) => candidate.selected)
        .map((candidate) => ({
          decisionRecordId: candidate.decisionRecordId,
          implementationPlanId: candidate.implementationPlanId,
          implementationReadiness:
            candidate.implementationReadiness,
          hasExplicitGaps:
            candidate.implementationGapCodes.length > 0,
        })),
    ).toEqual([
      {
        decisionRecordId: "decision-1",
        implementationPlanId: expect.stringMatching(
          /^caio-operating-question-plan:/,
        ),
        implementationReadiness: "needs_configuration",
        hasExplicitGaps: true,
      },
      {
        decisionRecordId: "decision-2",
        implementationPlanId: expect.stringMatching(
          /^caio-operating-question-plan:/,
        ),
        implementationReadiness: "needs_configuration",
        hasExplicitGaps: true,
      },
    ]);
  });

  it("marks a complete DecisionRecord binding set as planning incomplete until plans exist", () => {
    const {
      portfolioHead,
      currentG0Context,
      selectionReceipt,
      selectionHead,
    } = selectedRows({ includeImplementationPlans: false });

    expect(
      buildCaioOperatingQuestionReadout({
        now: READOUT_NOW,
        currentG0Context,
        portfolioHead,
        selectionHead,
      }),
    ).toMatchObject({
      state: "planning_incomplete",
      selectedQuestionIds: selectionReceipt.selectedQuestionIds,
      decisionBindingCount: 2,
      implementationPlanCount: 0,
    });
  });

  it("fails closed when an implementation plan no longer matches its canonical row", () => {
    const { portfolioHead, currentG0Context, selectionHead } =
      selectedRows();
    selectionHead.currentReceipt.decisionBindings[0].implementationPlan!.contentHash =
      `sha256:${"f".repeat(64)}`;

    expect(
      buildCaioOperatingQuestionReadout({
        now: READOUT_NOW,
        currentG0Context,
        portfolioHead,
        selectionHead,
      }),
    ).toMatchObject({
      state: "invalid_evidence",
      candidates: [],
      decisionBindingCount: 0,
      implementationPlanCount: 0,
    });
  });

  it("fails closed when a valid plan for another selected question is attached to the binding", () => {
    const {
      portfolio,
      portfolioHead,
      currentG0Context,
      selectionReceipt,
      selectionHead,
    } = selectedRows();
    const [targetBinding, otherBinding] =
      selectionHead.currentReceipt.decisionBindings;
    const crossQuestionPlan =
      createCaioOperatingQuestionImplementationPlan({
        portfolio,
        selectionReceipt,
        questionId: otherBinding.questionId,
        decisionRecordRef: targetBinding.decisionRecordId,
      });
    targetBinding.implementationPlan = {
      ...targetBinding.implementationPlan!,
      id: crossQuestionPlan.planId,
      questionId: otherBinding.questionId,
      candidateHash: otherBinding.candidateHash,
      planJson: JSON.stringify(crossQuestionPlan),
      contentHash: crossQuestionPlan.contentHash,
      status: crossQuestionPlan.status,
      implementationReadiness:
        crossQuestionPlan.implementationReadiness,
      gapCodes: JSON.stringify(crossQuestionPlan.gapCodes),
      authorityEffect: crossQuestionPlan.authorityEffect,
      workPacketEffect: crossQuestionPlan.workPacketEffect,
      plannedAt: new Date(crossQuestionPlan.createdAt),
    };

    expect(
      buildCaioOperatingQuestionReadout({
        now: READOUT_NOW,
        currentG0Context,
        portfolioHead,
        selectionHead,
      }),
    ).toMatchObject({
      state: "invalid_evidence",
      candidates: [],
      decisionBindingCount: 0,
      implementationPlanCount: 0,
    });
  });

  it.each([
    [
      "reordered",
      (values: string[]) => [...values].reverse(),
    ],
    [
      "duplicated",
      (values: string[]) => [...values, values[0]],
    ],
    [
      "whitespace-padded",
      (values: string[]) => [` ${values[0]} `, ...values.slice(1)],
    ],
  ])(
    "fails closed when canonical gapCodes are %s",
    (_label, mutateGapCodes) => {
      const { portfolioHead, currentG0Context, selectionHead } =
        selectedRows();
      const plan =
        selectionHead.currentReceipt.decisionBindings[0]
          .implementationPlan!;
      const gapCodes = JSON.parse(plan.gapCodes) as string[];
      plan.gapCodes = JSON.stringify(mutateGapCodes(gapCodes));

      expect(
        buildCaioOperatingQuestionReadout({
          now: READOUT_NOW,
          currentG0Context,
          portfolioHead,
          selectionHead,
        }),
      ).toMatchObject({
        state: "invalid_evidence",
        candidates: [],
        decisionBindingCount: 0,
        implementationPlanCount: 0,
      });
    },
  );

  it("fails closed when a DecisionRecord binding targets a different candidate version", () => {
    const { portfolioHead, currentG0Context, selectionHead } =
      selectedRows();
    selectionHead.currentReceipt.decisionBindings[0].candidateHash =
      `sha256:${"f".repeat(64)}`;

    expect(
      buildCaioOperatingQuestionReadout({
        now: READOUT_NOW,
        currentG0Context,
        portfolioHead,
        selectionHead,
      }),
    ).toMatchObject({
      state: "invalid_evidence",
      candidates: [],
      decisionBindingCount: 0,
    });
  });

  it("fails closed when re-signed selection JSON disagrees with canonical columns", () => {
    const { portfolioHead, currentG0Context, selectionHead } =
      selectedRows();
    const receipt = JSON.parse(
      selectionHead.currentReceipt.receiptJson,
    );
    const { contentHash: _contentHash, ...resignedBasis } = {
      ...receipt,
      ceoPrincipalRef: "principal:ceo:re-signed-only",
    };
    selectionHead.currentReceipt.receiptJson = JSON.stringify({
      ...resignedBasis,
      contentHash: sha256(canonicalJson(resignedBasis)),
    });

    expect(
      buildCaioOperatingQuestionReadout({
        now: READOUT_NOW,
        currentG0Context,
        portfolioHead,
        selectionHead,
      }),
    ).toMatchObject({
      state: "invalid_evidence",
      candidates: [],
      decisionBindingCount: 0,
    });
  });

  it("ignores a selection head that belongs to a superseded portfolio", () => {
    const {
      portfolioHead,
      currentG0Context,
      selectionHead: staleSelectionHead,
    } = selectedRows();
    staleSelectionHead.currentPortfolioId = "portfolio:superseded";

    const readout = buildCaioOperatingQuestionReadout({
      now: READOUT_NOW,
      currentG0Context,
      portfolioHead,
      selectionHead: staleSelectionHead,
    });

    expect(readout).toMatchObject({
      state: "awaiting_selection",
      selectionReceiptId: null,
      selectedQuestionIds: [],
      decisionBindingCount: 0,
    });
    expect(readout.candidates).toHaveLength(10);
  });

  it("fails closed on invalid persisted evidence", () => {
    const { portfolioHead, currentG0Context } = generatedRows();
    portfolioHead.currentPortfolio = {
      ...portfolioHead.currentPortfolio!,
      portfolioJson: "{}",
    };

    expect(
      buildCaioOperatingQuestionReadout({
        now: READOUT_NOW,
        currentG0Context,
        portfolioHead,
        selectionHead: null,
      }),
    ).toMatchObject({
      state: "invalid_evidence",
      candidates: [],
    });
  });

  it("fails closed when re-signed Portfolio JSON disagrees with canonical columns", () => {
    const { portfolioHead, currentG0Context } = generatedRows();
    const portfolio = JSON.parse(
      portfolioHead.currentPortfolio!.portfolioJson,
    );
    const {
      contentHash: _contentHash,
      ...resignedBasis
    } = {
      ...portfolio,
      generatorRef: "generator:re-signed-but-not-persisted",
    };
    portfolioHead.currentPortfolio!.portfolioJson = JSON.stringify({
      ...resignedBasis,
      contentHash: sha256(canonicalJson(resignedBasis)),
    });

    expect(
      buildCaioOperatingQuestionReadout({
        now: READOUT_NOW,
        currentG0Context,
        portfolioHead,
        selectionHead: null,
      }),
    ).toMatchObject({
      state: "invalid_evidence",
      candidates: [],
    });
  });

  it("hides an old Portfolio after the current G0 is revoked", () => {
    const { portfolioHead, currentG0Context } = generatedRows();
    const { assessment, gateReceipt } =
      syntheticOperatingQuestionG0Source();
    const revoked = createCaioInitializationRevocationReceipt({
      workspaceRef: assessment.workspaceRef,
      assessment,
      mandateRef: assessment.mandateRef,
      ceoPrincipalBindingRef: gateReceipt.ceoPrincipalBindingRef,
      ceoPrincipalRef: gateReceipt.ceoPrincipalRef,
      actorUserRef: gateReceipt.actorUserRef,
      idempotencyKey: "revoke:synthetic-caio:dashboard",
      evidenceRefs: ["evidence:revoke:synthetic-caio"],
      previousReceipt: gateReceipt,
      recordedAt: "2026-07-23T10:00:00.000Z",
      acceptedExceptionRefs: gateReceipt.acceptedExceptionRefs,
      reasonCodes: ["owner_revoked_initialization"],
    });
    currentG0Context.receipt = revoked;

    expect(
      buildCaioOperatingQuestionReadout({
        now: READOUT_NOW,
        currentG0Context,
        portfolioHead,
        selectionHead: null,
      }),
    ).toMatchObject({
      state: "invalid_evidence",
      candidates: [],
    });
  });

  it("keeps the last valid portfolio visible after a later insufficient-evidence attempt", () => {
    const { generationReceipt, portfolioHead, currentG0Context } =
      generatedRows();
    const insufficientEvaluation =
      evaluateCaioOperatingQuestionGeneration(
        syntheticOperatingQuestionGenerationInput([]),
      );
    const insufficientReceipt =
      createCaioOperatingQuestionGenerationReceipt({
        evaluation: insufficientEvaluation,
        previousReceipt: generationReceipt,
        evidenceRefs: [insufficientEvaluation.g0Context.evidenceRefs[0]],
        recordedAt: "2026-07-23T10:00:00.000Z",
      });
    portfolioHead.generationSequence = 2;
    portfolioHead.updatedAt = new Date("2026-07-23T10:00:00.000Z");
    portfolioHead.currentGenerationReceiptId =
      insufficientReceipt.receiptId;
    portfolioHead.currentGenerationReceipt =
      storedGenerationReceipt(insufficientReceipt);

    const readout = buildCaioOperatingQuestionReadout({
      now: READOUT_NOW,
      currentG0Context,
      portfolioHead,
      selectionHead: null,
    });

    expect(readout).toMatchObject({
      state: "last_valid_portfolio_stale",
      generationSequence: 2,
      portfolioSequence: 1,
      portfolioGeneratedAt: "2026-07-23T09:00:00.000Z",
    });
    expect(readout.candidates).toHaveLength(10);
  });

  it("fails closed when an insufficient receipt retains a non-predecessor portfolio", () => {
    const { portfolioHead, currentG0Context } = generatedRows();
    const insufficientEvaluation =
      evaluateCaioOperatingQuestionGeneration(
        syntheticOperatingQuestionGenerationInput([]),
      );
    const insufficientReceipt =
      createCaioOperatingQuestionGenerationReceipt({
        evaluation: insufficientEvaluation,
        previousReceipt: null,
        evidenceRefs: [insufficientEvaluation.g0Context.evidenceRefs[0]],
        recordedAt: "2026-07-23T09:00:00.000Z",
      });
    portfolioHead.currentGenerationReceiptId =
      insufficientReceipt.receiptId;
    portfolioHead.currentGenerationReceipt =
      storedGenerationReceipt(insufficientReceipt);

    expect(
      buildCaioOperatingQuestionReadout({
        now: READOUT_NOW,
        currentG0Context,
        portfolioHead,
        selectionHead: null,
      }),
    ).toMatchObject({
      state: "invalid_evidence",
      candidates: [],
    });
  });
});
