import {
  ActorType,
  MembershipStatus,
  WorkspaceRole,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditMock,
  dbMock,
  policyAccessMock,
  trustedContextMock,
} = vi.hoisted(() => {
  const client = {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    membership: { findUnique: vi.fn() },
    caioPrincipalBinding: { findFirst: vi.fn() },
    caioOperatingQuestionPortfolio: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    caioOperatingQuestionGenerationReceipt: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    caioOperatingQuestionPortfolioHead: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    caioQuestionSelectionReceipt: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    caioQuestionSelectionHead: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    opportunity: { findFirst: vi.fn() },
    observationSourceRun: { findFirst: vi.fn() },
  };
  return {
    auditMock: { writeAuditLog: vi.fn() },
    dbMock: client,
    policyAccessMock: { assertWorkspacePolicyServiceAccess: vi.fn() },
    trustedContextMock: vi.fn(),
  };
});

vi.mock("@/lib/audit", () => ({
  writeAuditLog: auditMock.writeAuditLog,
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspacePolicyServiceAccess:
    policyAccessMock.assertWorkspacePolicyServiceAccess,
}));
vi.mock("./caio-initialization-gate-store.service", () => ({
  loadCurrentAcceptedCaioInitializationContextForUpdate:
    trustedContextMock,
}));

import {
  generateCaioOperatingQuestionPortfolioFromPackInput,
  generateCaioOperatingQuestionPortfolio,
  selectCaioOperatingQuestions,
} from "./caio-operating-question-store.service";
import {
  CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
  CAIO_PRO_PACK_OPERATING_INPUT_SCHEMA_VERSION,
} from "./caio-pro-fde-cross-repo-contract";
import {
  createCaioOperatingQuestionGenerationReceipt,
  evaluateCaioOperatingQuestionGeneration,
  type CaioOperatingQuestionPortfolio,
} from "./caio-operating-question";
import {
  syntheticOperatingQuestionCandidate,
  syntheticOperatingQuestionG0Source,
  syntheticOperatingQuestionGenerationInput,
  SYNTHETIC_CAIO_EVIDENCE_REFS,
} from "./caio-operating-question.test-fixtures";

const NOW = new Date("2026-07-23T09:00:00.000Z");
const WORKSPACE_ID = "synthetic-caio";
const OWNER_USER_ID = "user:ceo:synthetic-caio";
const CEO_REF = "principal:ceo:synthetic-caio";

function trustedInitialization() {
  const source = syntheticOperatingQuestionG0Source();
  return {
    assessmentInput: source.assessmentInput,
    assessment: source.assessment,
    receipt: source.gateReceipt,
    head: source.currentHead,
  };
}

function portfolioRow(portfolio: CaioOperatingQuestionPortfolio) {
  return {
    id: portfolio.portfolioId,
    workspaceId: WORKSPACE_ID,
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
    createdAt: NOW,
  };
}

function generatedPortfolio(): CaioOperatingQuestionPortfolio {
  const evaluation = evaluateCaioOperatingQuestionGeneration(
    syntheticOperatingQuestionGenerationInput(),
  );
  if (!evaluation.portfolio) {
    throw new Error("synthetic portfolio required");
  }
  return evaluation.portfolio;
}

function generatedReceipt(portfolio: CaioOperatingQuestionPortfolio) {
  const evaluation = evaluateCaioOperatingQuestionGeneration({
    ...syntheticOperatingQuestionGenerationInput(),
    previousPortfolio: null,
  });
  if (evaluation.portfolio?.portfolioId !== portfolio.portfolioId) {
    throw new Error("synthetic generation mismatch");
  }
  return createCaioOperatingQuestionGenerationReceipt({
    evaluation,
    previousReceipt: null,
    evidenceRefs: portfolio.evidenceRefs,
    recordedAt: NOW.toISOString(),
  });
}

function packOperatingInput(overrides: Record<string, unknown> = {}) {
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
    workspaceRef: `workspace:${WORKSPACE_ID}`,
    portfolioRef: "opportunity:portfolio-1",
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
        definition: "Share completed inside the accepted operating window.",
        unit: "percent",
        evidenceRefs: SYNTHETIC_CAIO_EVIDENCE_REFS,
      },
    ],
    evidenceApplicabilityRules: [
      {
        ruleRef: "evidence-rule:delivery-risk",
        taxonomyRefs: ["taxonomy:operating-risk"],
        acceptedEvidenceKinds: ["source_observation"],
      },
    ],
    candidateInputs: [
      {
        candidateRef: "candidate-input:delivery-risk",
        taxonomyRefs: ["taxonomy:operating-risk"],
        metricRefs: ["metric:on-time-completion"],
        evidenceRefs: SYNTHETIC_CAIO_EVIDENCE_REFS,
        rationale: "Current evidence supports Core-owned candidate drafting.",
      },
    ],
    authorityEffect: "none" as const,
    ...overrides,
  };
}

function observationRun() {
  return {
    id: "run-1",
    workspaceId: WORKSPACE_ID,
    programId: "program-1",
    sourceId: "source-1",
    authorizationVersion: 1,
    windowStart: new Date("2026-07-23T00:00:00.000Z"),
    windowEnd: new Date("2026-07-24T00:00:00.000Z"),
    status: "SUCCEEDED",
    observedAt: new Date("2026-07-23T08:30:00.000Z"),
    outcome: "SUCCESS",
    evidenceRefs: JSON.stringify([
      "opportunity:portfolio-1",
      ...SYNTHETIC_CAIO_EVIDENCE_REFS,
    ]),
    program: {
      id: "program-1",
      workspaceId: WORKSPACE_ID,
      status: "ACTIVE",
      revokedAt: null,
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      authorizationVersion: 1,
      scopeRefs: JSON.stringify(["opportunity:portfolio-1"]),
    },
    source: {
      id: "source-1",
      workspaceId: WORKSPACE_ID,
      programId: "program-1",
      status: "ACTIVE",
    },
  };
}

describe("CAIO operating question store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$queryRaw.mockReset();
    dbMock.$transaction.mockImplementation(
      async (operation: (tx: typeof dbMock) => Promise<unknown>) =>
        operation(dbMock),
    );
    policyAccessMock.assertWorkspacePolicyServiceAccess.mockResolvedValue(
      undefined,
    );
    trustedContextMock.mockResolvedValue(trustedInitialization());
    dbMock.membership.findUnique.mockResolvedValue({
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.ACTIVE,
    });
    dbMock.caioOperatingQuestionPortfolioHead.create.mockResolvedValue({});
    dbMock.caioOperatingQuestionPortfolioHead.updateMany.mockResolvedValue({
      count: 1,
    });
    dbMock.caioQuestionSelectionHead.create.mockResolvedValue({});
    dbMock.caioQuestionSelectionHead.updateMany.mockResolvedValue({
      count: 1,
    });
    dbMock.caioOperatingQuestionGenerationReceipt.findUnique.mockResolvedValue(
      null,
    );
    dbMock.caioQuestionSelectionReceipt.findUnique.mockResolvedValue(null);
    dbMock.opportunity.findFirst.mockResolvedValue({
      id: "portfolio-1",
      workspaceId: WORKSPACE_ID,
    });
    dbMock.observationSourceRun.findFirst.mockResolvedValue(observationRun());
    auditMock.writeAuditLog.mockResolvedValue({ id: "audit-1" });
  });

  it("persists an exact-ten portfolio and a no-authority generation receipt", async () => {
    dbMock.$queryRaw.mockResolvedValueOnce([]);

    const result = await generateCaioOperatingQuestionPortfolio({
      workspaceId: WORKSPACE_ID,
      actorUserId: OWNER_USER_ID,
      generationKey: "generation:synthetic-caio:1",
      generatorRef: "generator:caio-operating-question",
      modelRef: "model:synthetic-local",
      candidates: Array.from({ length: 10 }, (_, index) =>
        syntheticOperatingQuestionCandidate(index),
      ),
      auditRefs: ["audit:question-generation:1"],
      now: NOW,
    });

    expect(result.replayed).toBe(false);
    expect(result.portfolio?.candidates).toHaveLength(10);
    expect(result.receipt.authorityEffect).toBe("none");
    expect(
      dbMock.caioOperatingQuestionPortfolio.create,
    ).toHaveBeenCalledOnce();
    expect(
      dbMock.caioOperatingQuestionGenerationReceipt.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "generated",
        portfolioId: result.portfolio?.portfolioId,
        authorityEffect: "none",
      }),
    });
    expect(
      dbMock.caioOperatingQuestionPortfolioHead.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        currentPortfolioId: result.portfolio?.portfolioId,
        portfolioSequence: 1,
      }),
    });
  });

  it("consumes a versioned Pack input only after workspace Portfolio and evidence resolution", async () => {
    dbMock.$queryRaw.mockResolvedValueOnce([]);
    const candidates = Array.from({ length: 10 }, (_, index) =>
      syntheticOperatingQuestionCandidate(index, {
        impactObjectRefs: ["opportunity:portfolio-1"],
      }),
    );

    const result = await generateCaioOperatingQuestionPortfolioFromPackInput({
      interfaceDescriptor: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
      packOperatingInput: packOperatingInput(),
      workspaceId: WORKSPACE_ID,
      actorUserId: OWNER_USER_ID,
      generationKey: "generation:synthetic-caio:pack-1",
      generatorRef: "generator:caio-operating-question",
      modelRef: "model:synthetic-local",
      candidates,
      auditRefs: ["audit:question-generation:pack-1"],
      now: NOW,
    });

    expect(result.portfolio?.candidates).toHaveLength(10);
    expect(dbMock.opportunity.findFirst).toHaveBeenCalledWith({
      where: { id: "portfolio-1", workspaceId: WORKSPACE_ID },
      select: { id: true, workspaceId: true },
    });
    expect(dbMock.observationSourceRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1", workspaceId: WORKSPACE_ID },
      }),
    );
  });

  it("rejects descriptor drift and candidate Portfolio drift before generation writes", async () => {
    const candidates = Array.from({ length: 10 }, (_, index) =>
      syntheticOperatingQuestionCandidate(index, {
        impactObjectRefs: ["opportunity:other-portfolio"],
      }),
    );
    await expect(
      generateCaioOperatingQuestionPortfolioFromPackInput({
        interfaceDescriptor: {
          ...CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
          contractHash: `sha256:${"0".repeat(64)}`,
        },
        packOperatingInput: packOperatingInput(),
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_USER_ID,
        generationKey: "generation:synthetic-caio:pack-drift",
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        candidates,
        auditRefs: ["audit:question-generation:pack-drift"],
        now: NOW,
      }),
    ).rejects.toThrow("pack_interface_descriptor_invalid");
    expect(dbMock.$transaction).not.toHaveBeenCalled();

    await expect(
      generateCaioOperatingQuestionPortfolioFromPackInput({
        interfaceDescriptor: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
        packOperatingInput: packOperatingInput(),
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_USER_ID,
        generationKey: "generation:synthetic-caio:pack-scope-drift",
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        candidates,
        auditRefs: ["audit:question-generation:pack-scope-drift"],
        now: NOW,
      }),
    ).rejects.toThrow("pack_core_candidate_scope_invalid");
    expect(dbMock.caioOperatingQuestionPortfolio.create).not.toHaveBeenCalled();
  });

  it("records an insufficient-evidence receipt without creating or erasing a portfolio", async () => {
    dbMock.$queryRaw.mockResolvedValueOnce([]);

    const result = await generateCaioOperatingQuestionPortfolio({
      workspaceId: WORKSPACE_ID,
      actorUserId: OWNER_USER_ID,
      generationKey: "generation:synthetic-caio:insufficient",
      generatorRef: "generator:caio-operating-question",
      modelRef: "model:synthetic-local",
      candidates: [syntheticOperatingQuestionCandidate(0)],
      auditRefs: ["audit:question-generation:insufficient"],
      now: NOW,
    });

    expect(result.portfolio).toBeNull();
    expect(result.receipt.status).toBe("insufficient_evidence");
    expect(
      dbMock.caioOperatingQuestionPortfolio.create,
    ).not.toHaveBeenCalled();
    expect(
      dbMock.caioOperatingQuestionPortfolioHead.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        currentPortfolioId: null,
        portfolioSequence: 0,
      }),
    });
  });

  it("persists a CEO zero-to-three selection against only the current portfolio", async () => {
    const portfolio = generatedPortfolio();
    const generationReceipt = generatedReceipt(portfolio);
    dbMock.$queryRaw
      .mockResolvedValueOnce([
        {
          workspaceId: WORKSPACE_ID,
          initializationGateReceiptId: portfolio.gateReceiptRef,
          initializationAssessmentId: portfolio.assessmentRef,
          currentGenerationReceiptId: generationReceipt.receiptId,
          currentPortfolioId: portfolio.portfolioId,
          generationSequence: 1,
          portfolioSequence: 1,
          version: 1,
          updatedAt: NOW,
        },
      ])
      .mockResolvedValueOnce([]);
    dbMock.caioPrincipalBinding.findFirst.mockResolvedValue({
      id: "binding:ceo:synthetic-caio",
    });
    dbMock.caioOperatingQuestionPortfolio.findFirst.mockResolvedValue(
      portfolioRow(portfolio),
    );
    const selectedQuestionId = portfolio.candidates[0].questionId;

    const result = await selectCaioOperatingQuestions({
      workspaceId: WORKSPACE_ID,
      expectedPortfolioId: portfolio.portfolioId,
      actorUserId: OWNER_USER_ID,
      ceoPrincipalRef: CEO_REF,
      idempotencyKey: "selection:synthetic-caio:1",
      selections: [
        {
          questionId: selectedQuestionId,
          questionOverride: null,
          goal: "Validate the first governed operating question",
          successMetrics: [
            { metricKey: "metric:selection", target: "improve" },
          ],
          priority: 1,
          implementationScopeRefs: ["scope:selection"],
          ownerRef: "role:operating-owner",
          reviewerRef: "role:independent-reviewer",
          startsAt: "2026-07-24T00:00:00.000Z",
          endsAt: "2026-08-23T00:00:00.000Z",
          prohibitedActions: ["external_send_without_review"],
        },
      ],
      reasonCodes: ["ceo_priority_reviewed"],
      evidenceRefs: [portfolio.evidenceRefs[0]],
      now: NOW,
    });

    expect(result.receipt.selectedQuestionIds).toEqual([selectedQuestionId]);
    expect(result.receipt.authorityEffect).toBe("none");
    expect(result.receipt.workPacketEffect).toBe("none");
    expect(dbMock.caioQuestionSelectionReceipt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: ActorType.USER,
        authorityEffect: "none",
        workPacketEffect: "none",
      }),
    });
    expect(dbMock.caioQuestionSelectionHead.create).toHaveBeenCalledOnce();
  });

  it("fails closed before writing when current accepted G0 cannot be loaded", async () => {
    trustedContextMock.mockRejectedValueOnce(new Error("g0_stale"));

    await expect(
      generateCaioOperatingQuestionPortfolio({
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_USER_ID,
        generationKey: "generation:synthetic-caio:stale",
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        candidates: Array.from({ length: 10 }, (_, index) =>
          syntheticOperatingQuestionCandidate(index),
        ),
        auditRefs: ["audit:question-generation:stale"],
        now: NOW,
      }),
    ).rejects.toThrow("g0_stale");
    expect(
      dbMock.caioOperatingQuestionPortfolio.create,
    ).not.toHaveBeenCalled();
    expect(
      dbMock.caioOperatingQuestionGenerationReceipt.create,
    ).not.toHaveBeenCalled();
  });

  it("uses only evidence from the current portfolio for CEO selection", async () => {
    const portfolio = generatedPortfolio();
    const generationReceipt = generatedReceipt(portfolio);
    dbMock.$queryRaw.mockResolvedValueOnce([
      {
        workspaceId: WORKSPACE_ID,
        initializationGateReceiptId: portfolio.gateReceiptRef,
        initializationAssessmentId: portfolio.assessmentRef,
        currentGenerationReceiptId: generationReceipt.receiptId,
        currentPortfolioId: portfolio.portfolioId,
        generationSequence: 1,
        portfolioSequence: 1,
        version: 1,
        updatedAt: NOW,
      },
    ]);
    dbMock.caioPrincipalBinding.findFirst.mockResolvedValue({
      id: "binding:ceo:synthetic-caio",
    });
    dbMock.caioOperatingQuestionPortfolio.findFirst.mockResolvedValue(
      portfolioRow(portfolio),
    );

    await expect(
      selectCaioOperatingQuestions({
        workspaceId: WORKSPACE_ID,
        expectedPortfolioId: portfolio.portfolioId,
        actorUserId: OWNER_USER_ID,
        ceoPrincipalRef: CEO_REF,
        idempotencyKey: "selection:synthetic-caio:outside-evidence",
        selections: [],
        reasonCodes: ["ceo_priority_reviewed"],
        evidenceRefs: ["evidence:not-in-current-portfolio"],
        now: NOW,
      }),
    ).rejects.toThrow("selection_evidence_outside_current_portfolio");
    expect(dbMock.caioQuestionSelectionReceipt.create).not.toHaveBeenCalled();
  });
});
