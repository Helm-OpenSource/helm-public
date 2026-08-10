import {
  ActorType,
  MembershipStatus,
  WorkspaceRole,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCaioAccessGatewayMount,
} from "@/tools/caio-access-gateway/server";
import {
  CAIO_MOUNT_FIXTURE_CLIENT_ADDRESS,
  CAIO_MOUNT_FIXTURE_CONFIG,
  CAIO_MOUNT_FIXTURE_FINGERPRINT,
  createCaioMountFixturePorts,
} from "@/tools/caio-access-gateway/mount-fixture";

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
    observationSourceRun: { findFirst: vi.fn(), findMany: vi.fn() },
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
vi.mock(
  "./caio-initialization-gate-store.service",
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import("./caio-initialization-gate-store.service")
    >();
    return {
      ...actual,
      loadCurrentAcceptedCaioInitializationContextForUpdate:
        trustedContextMock,
    };
  },
);

import {
  CaioInitializationGateStoreError,
} from "./caio-initialization-gate-store.service";
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
  CAIO_OPERATING_QUESTION_G0_CONTEXT_SCHEMA_VERSION_V1,
  createCaioOperatingQuestionG0ContextForSchemaVersion,
  createCaioOperatingQuestionGenerationReceipt,
  evaluateCaioOperatingQuestionGeneration,
  type CaioOperatingQuestionGenerationReceipt,
  type CaioOperatingQuestionPortfolio,
} from "./caio-operating-question";
import {
  syntheticOperatingQuestionCandidate,
  syntheticOperatingQuestionG0Input,
  syntheticOperatingQuestionG0Source,
  syntheticOperatingQuestionGenerationInput,
  SYNTHETIC_CAIO_EVIDENCE_KINDS,
  SYNTHETIC_CAIO_EVIDENCE_REFS,
} from "./caio-operating-question.test-fixtures";

const NOW = new Date("2026-07-23T09:00:00.000Z");
const WORKSPACE_ID = "synthetic-caio";
const OWNER_USER_ID = "user:ceo:synthetic-caio";
const PRODUCTION_OWNER_USER_ID = "ceo-synthetic-caio";
const CEO_REF = "principal:ceo:synthetic-caio";
const PACK_EVIDENCE_KINDS = SYNTHETIC_CAIO_EVIDENCE_KINDS.slice(0, 10);

function trustedInitialization(
  mutate?: (
    input: ReturnType<typeof syntheticOperatingQuestionG0Input>,
  ) => void,
) {
  const assessmentInput = syntheticOperatingQuestionG0Input();
  mutate?.(assessmentInput);
  const source = syntheticOperatingQuestionG0Source(assessmentInput);
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

function generationReceiptRow(
  receipt: CaioOperatingQuestionGenerationReceipt,
) {
  return {
    id: receipt.receiptId,
    workspaceId: WORKSPACE_ID,
    initializationGateReceiptId: receipt.gateReceiptRef,
    initializationAssessmentId: receipt.assessmentRef,
    portfolioId: receipt.portfolioRef,
    previousReceiptId: receipt.previousReceiptRef,
    previousReceiptHash: receipt.previousReceiptHash,
    sequence: receipt.sequence,
    generationKey: receipt.generationKey,
    requestHash: `sha256:${"d".repeat(64)}`,
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
    createdAt: NOW,
  };
}

function historicalGeneratedState() {
  const source = syntheticOperatingQuestionG0Source();
  const g0Context = createCaioOperatingQuestionG0ContextForSchemaVersion(
    source,
    CAIO_OPERATING_QUESTION_G0_CONTEXT_SCHEMA_VERSION_V1,
  );
  const candidates = Array.from({ length: 10 }, (_, index) => {
    const draft = syntheticOperatingQuestionCandidate(index);
    const evidenceRef = `operating-${index + 1}`;
    return {
      ...draft,
      facts: draft.facts.map((fact) => ({
        ...fact,
        evidenceRefs: [evidenceRef],
      })),
      inferences: draft.inferences.map((inference) => ({
        ...inference,
        evidenceRefs: [evidenceRef],
      })),
      evidenceRefs: [evidenceRef],
    };
  });
  const evaluation = evaluateCaioOperatingQuestionGeneration({
    ...syntheticOperatingQuestionGenerationInput(candidates),
    g0Context,
  });
  if (!evaluation.portfolio) {
    throw new Error("historical synthetic portfolio required");
  }
  const receipt = createCaioOperatingQuestionGenerationReceipt({
    evaluation,
    previousReceipt: null,
    evidenceRefs: evaluation.portfolio.evidenceRefs,
    recordedAt: NOW.toISOString(),
  });
  return { portfolio: evaluation.portfolio, receipt };
}

function packOperatingInput(
  count = 10,
  overrides: Record<string, unknown> = {},
) {
  const evidenceRefs = SYNTHETIC_CAIO_EVIDENCE_REFS.slice(0, count);
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
    evidenceBindings: evidenceRefs.map((evidenceRef, index) => ({
      evidenceRef,
      evidenceKind: PACK_EVIDENCE_KINDS[index],
    })),
    taxonomy: evidenceRefs.map((_, index) => ({
      taxonomyRef: `taxonomy:operating-risk-${index + 1}`,
      categoryRef: `category:delivery-risk-${index + 1}`,
      label: `Delivery risk ${index + 1}`,
    })),
    metrics: evidenceRefs.map((evidenceRef, index) => ({
      metricRef: `metric:on-time-completion-${index + 1}`,
      definition: `Share completed inside operating window ${index + 1}.`,
      unit: "percent",
      evidenceRefs: [evidenceRef],
    })),
    evidenceApplicabilityRules: evidenceRefs.map((_, index) => ({
      ruleRef: `evidence-rule:delivery-risk-${index + 1}`,
      taxonomyRefs: [`taxonomy:operating-risk-${index + 1}`],
      acceptedEvidenceKinds: [PACK_EVIDENCE_KINDS[index]],
    })),
    candidateInputs: evidenceRefs.map((evidenceRef, index) => ({
      candidateRef: `candidate-input:delivery-risk-${index + 1}`,
      taxonomyRefs: [`taxonomy:operating-risk-${index + 1}`],
      metricRefs: [`metric:on-time-completion-${index + 1}`],
      evidenceRefs: [evidenceRef],
      rationale: `Review governed delivery evidence ${index + 1}.`,
    })),
    authorityEffect: "none" as const,
    ...overrides,
  };
}

function observationRun(
  id = "run-1",
  sourceKind = "crm",
  freshness = "FRESH",
) {
  const evidenceRefs =
    id === "run-1"
      ? ["opportunity:portfolio-1", ...SYNTHETIC_CAIO_EVIDENCE_REFS]
      : ["opportunity:portfolio-1", `evidence:${id}`];
  return {
    id,
    workspaceId: WORKSPACE_ID,
    programId: "program-1",
    sourceId: `source:${id}`,
    authorizationVersion: 1,
    windowStart: new Date("2026-07-23T00:00:00.000Z"),
    windowEnd: new Date("2026-07-24T00:00:00.000Z"),
    status: "SUCCEEDED",
    observedAt: new Date("2026-07-23T08:30:00.000Z"),
    summaryHash: `sha256:${"e".repeat(64)}`,
    completenessPercent: 100,
    freshness,
    outcome: "SUCCESS",
    errorCodes: null,
    evidenceRefs: JSON.stringify(evidenceRefs),
    program: {
      id: "program-1",
      workspaceId: WORKSPACE_ID,
      status: "ACTIVE",
      revokedAt: null,
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      expiresAt: new Date("2027-08-01T00:00:00.000Z"),
      authorizationVersion: 1,
      authorizationRef: "authorization:program-1",
      scopeRefs: JSON.stringify(["opportunity:portfolio-1"]),
    },
    source: {
      id: `source:${id}`,
      workspaceId: WORKSPACE_ID,
      programId: "program-1",
      status: "ACTIVE",
      sourceKind,
      freshnessSlaMinutes: 525_600,
      authorizationRef: "authorization:program-1",
    },
  };
}

function productionGenerationMount(packInput: unknown) {
  const fixture = createCaioMountFixturePorts();
  const resolveOperatingInput = vi.fn(async () => packInput);
  const mount = createCaioAccessGatewayMount({
    config: {
      ...CAIO_MOUNT_FIXTURE_CONFIG,
      featureFlags: {
        ...CAIO_MOUNT_FIXTURE_CONFIG.featureFlags,
        mutationsEnabled: true,
      },
    },
    posture: "self_service",
    ports: {
      ...fixture.ports,
      tokenAuthenticator: {
        authenticate: async ({ expectedAudience }) => ({
          tokenId: "token:workbuddy-question-generation",
          workspaceId: WORKSPACE_ID,
          userRef: `user:${PRODUCTION_OWNER_USER_ID}`,
          clientType: "workbuddy" as const,
          deviceRef: "device:workbuddy-question-generation",
          audience: expectedAudience,
        }),
      },
      projectResolver: {
        listAccessibleProjectRefs: async () => ["opportunity:portfolio-1"],
      },
      operatingQuestionPackProviders: [
        Object.freeze({
          providerId: "pack-provider:synthetic-operating-input-v1",
          resolveOperatingInput,
        }),
      ],
    },
  });
  return { mount, resolveOperatingInput };
}

function productionGenerationRequest(generationKey: string) {
  return {
    method: "POST",
    url: "/v1/operating-questions/generate",
    headers: { authorization: "Bearer hcaio_mcp_test" },
    clientIp: CAIO_MOUNT_FIXTURE_CLIENT_ADDRESS,
    peer: {
      certificateFingerprint: CAIO_MOUNT_FIXTURE_FINGERPRINT,
      sourceAddress: CAIO_MOUNT_FIXTURE_CLIENT_ADDRESS,
      authorized: true as const,
    },
    body: JSON.stringify({
      portfolioRef: "opportunity:portfolio-1",
      generationKey,
    }),
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
    dbMock.observationSourceRun.findMany.mockImplementation(
      async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => observationRun(id)),
    );
    auditMock.writeAuditLog.mockResolvedValue({ id: "audit-1" });
  });

  it("rejects an already-cancelled generation before policy or database access", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      generateCaioOperatingQuestionPortfolio({
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_USER_ID,
        generationKey: "generation:synthetic-caio:cancelled",
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        candidates: Array.from({ length: 10 }, (_, index) =>
          syntheticOperatingQuestionCandidate(index),
        ),
        auditRefs: ["audit:question-generation:cancelled"],
        now: NOW,
        signal: controller.signal,
      }),
    ).rejects.toThrow("request_cancelled");
    expect(
      policyAccessMock.assertWorkspacePolicyServiceAccess,
    ).not.toHaveBeenCalled();
    expect(dbMock.$transaction).not.toHaveBeenCalled();
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

  it("validates a persisted v1 head but requires an explicit accepted G0 rollover before new generation", async () => {
    const historical = historicalGeneratedState();
    dbMock.$queryRaw.mockResolvedValueOnce([
      {
        workspaceId: WORKSPACE_ID,
        initializationGateReceiptId: historical.portfolio.gateReceiptRef,
        initializationAssessmentId: historical.portfolio.assessmentRef,
        currentGenerationReceiptId: historical.receipt.receiptId,
        currentPortfolioId: historical.portfolio.portfolioId,
        generationSequence: historical.receipt.sequence,
        portfolioSequence: historical.portfolio.sequence,
        version: 1,
        updatedAt: NOW,
      },
    ]);
    dbMock.caioOperatingQuestionGenerationReceipt.findFirst.mockResolvedValue(
      generationReceiptRow(historical.receipt),
    );
    dbMock.caioOperatingQuestionPortfolio.findFirst.mockResolvedValue(
      portfolioRow(historical.portfolio),
    );

    await expect(
      generateCaioOperatingQuestionPortfolio({
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_USER_ID,
        generationKey: "generation:synthetic-caio:v2-before-g0-rollover",
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        candidates: Array.from({ length: 10 }, (_, index) =>
          syntheticOperatingQuestionCandidate(index),
        ),
        auditRefs: ["audit:question-generation:v2-before-g0-rollover"],
        now: NOW,
      }),
    ).rejects.toThrow("question_g0_rollover_required");
    expect(dbMock.caioOperatingQuestionPortfolio.create).not.toHaveBeenCalled();
    expect(
      dbMock.caioOperatingQuestionGenerationReceipt.create,
    ).not.toHaveBeenCalled();
  });

  it("rejects a tampered persisted v1 head before any write", async () => {
    const historical = historicalGeneratedState();
    dbMock.$queryRaw.mockResolvedValueOnce([
      {
        workspaceId: WORKSPACE_ID,
        initializationGateReceiptId: historical.portfolio.gateReceiptRef,
        initializationAssessmentId: historical.portfolio.assessmentRef,
        currentGenerationReceiptId: historical.receipt.receiptId,
        currentPortfolioId: historical.portfolio.portfolioId,
        generationSequence: historical.receipt.sequence,
        portfolioSequence: historical.portfolio.sequence,
        version: 1,
        updatedAt: NOW,
      },
    ]);
    dbMock.caioOperatingQuestionGenerationReceipt.findFirst.mockResolvedValue(
      generationReceiptRow(historical.receipt),
    );
    dbMock.caioOperatingQuestionPortfolio.findFirst.mockResolvedValue({
      ...portfolioRow(historical.portfolio),
      contentHash: `sha256:${"0".repeat(64)}`,
    });

    await expect(
      generateCaioOperatingQuestionPortfolio({
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_USER_ID,
        generationKey: "generation:synthetic-caio:tampered-v1",
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        candidates: Array.from({ length: 10 }, (_, index) =>
          syntheticOperatingQuestionCandidate(index),
        ),
        auditRefs: ["audit:question-generation:tampered-v1"],
        now: NOW,
      }),
    ).rejects.toThrow("stored_question_portfolio_binding_invalid");
    expect(dbMock.caioOperatingQuestionPortfolio.create).not.toHaveBeenCalled();
    expect(
      dbMock.caioOperatingQuestionGenerationReceipt.create,
    ).not.toHaveBeenCalled();
  });

  it("starts a new v2 root only after a distinct accepted G0 rollover", async () => {
    const historical = historicalGeneratedState();
    const nextAcceptedG0 = trustedInitialization((assessmentInput) => {
      assessmentInput.evaluatedAt = "2026-07-23T07:05:00.000Z";
    });
    trustedContextMock.mockResolvedValue(nextAcceptedG0);
    dbMock.$queryRaw.mockResolvedValueOnce([
      {
        workspaceId: WORKSPACE_ID,
        initializationGateReceiptId: historical.portfolio.gateReceiptRef,
        initializationAssessmentId: historical.portfolio.assessmentRef,
        currentGenerationReceiptId: historical.receipt.receiptId,
        currentPortfolioId: historical.portfolio.portfolioId,
        generationSequence: historical.receipt.sequence,
        portfolioSequence: historical.portfolio.sequence,
        version: 1,
        updatedAt: NOW,
      },
    ]);

    const result = await generateCaioOperatingQuestionPortfolio({
      workspaceId: WORKSPACE_ID,
      actorUserId: OWNER_USER_ID,
      generationKey: "generation:synthetic-caio:accepted-g0-rollover",
      generatorRef: "generator:caio-operating-question",
      modelRef: "model:synthetic-local",
      candidates: Array.from({ length: 10 }, (_, index) =>
        syntheticOperatingQuestionCandidate(index),
      ),
      auditRefs: ["audit:question-generation:accepted-g0-rollover"],
      now: NOW,
    });

    expect(result.portfolio).toMatchObject({
      sequence: 1,
      previousPortfolioRef: null,
      gateReceiptRef: nextAcceptedG0.receipt.receiptId,
    });
    expect(result.receipt).toMatchObject({
      sequence: 1,
      previousReceiptRef: null,
      gateReceiptRef: nextAcceptedG0.receipt.receiptId,
    });
    expect(dbMock.caioOperatingQuestionPortfolioHead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          initializationGateReceiptId: nextAcceptedG0.receipt.receiptId,
        }),
      }),
    );
  });

  it("derives and persists exactly ten Core-owned questions from scoped Pack semantics", async () => {
    dbMock.$queryRaw.mockResolvedValueOnce([]);

    const result = await generateCaioOperatingQuestionPortfolioFromPackInput({
      interfaceDescriptor: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
      packOperatingInput: packOperatingInput(),
      workspaceId: WORKSPACE_ID,
      actorUserId: OWNER_USER_ID,
      generationKey: "generation:synthetic-caio:pack-1",
      generatorRef: "generator:caio-operating-question",
      modelRef: "model:synthetic-local",
      auditRefs: ["audit:question-generation:pack-1"],
      now: NOW,
    });

    expect(result.portfolio?.candidates).toHaveLength(10);
    expect(result.receipt.status).toBe("generated");
    expect(result.portfolio?.candidates.map((candidate) => candidate.rank)).toEqual(
      Array.from({ length: 10 }, (_, index) => index + 1),
    );
    expect(result.portfolio?.candidates[0].dependencyRefs).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^candidate-input:/u),
        expect.stringMatching(/^taxonomy:/u),
        expect.stringMatching(/^metric:/u),
        expect.stringMatching(/^evidence-rule:/u),
      ]),
    );
    expect(result.portfolio?.candidates[0].inferences[0].statement).toMatch(
      /evidence kinds (?:portfolio_scope|source_provenance|intake_quality|recovery_health|portfolio_diagnosis|seat_capacity|work_packet|ptp_risk|repayment_forecast|compliance_signal)/u,
    );
    expect(dbMock.caioOperatingQuestionPortfolio.create).toHaveBeenCalledOnce();
    expect(
      dbMock.caioOperatingQuestionGenerationReceipt.create,
    ).toHaveBeenCalledOnce();
    expect(dbMock.caioQuestionSelectionReceipt.create).not.toHaveBeenCalled();
    expect(dbMock.opportunity.findFirst).toHaveBeenCalledWith({
      where: { id: "portfolio-1", workspaceId: WORKSPACE_ID },
      select: { id: true, workspaceId: true },
    });
    expect(dbMock.observationSourceRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1", workspaceId: WORKSPACE_ID },
      }),
    );
    expect(dbMock.observationSourceRun.findMany).toHaveBeenCalledOnce();
  });

  it("rejects Pack evidence-kind drift from Core source truth before writes", async () => {
    const drifted = packOperatingInput();
    drifted.evidenceBindings[0].evidenceKind = "source_provenance";
    drifted.evidenceApplicabilityRules[0].acceptedEvidenceKinds = [
      "source_provenance",
    ];

    await expect(
      generateCaioOperatingQuestionPortfolioFromPackInput({
        interfaceDescriptor: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
        packOperatingInput: drifted,
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_USER_ID,
        generationKey: "generation:synthetic-caio:pack-kind-drift",
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        auditRefs: ["audit:question-generation:pack-kind-drift"],
        now: NOW,
      }),
    ).rejects.toThrow("pack_operating_input_evidence_kind_mismatch");
    expect(dbMock.caioOperatingQuestionPortfolio.create).not.toHaveBeenCalled();
    expect(
      dbMock.caioOperatingQuestionGenerationReceipt.create,
    ).not.toHaveBeenCalled();
  });

  it.each([
    ["PARTIAL", "PARTIAL_SUCCESS"],
    ["FAILED", "FAILURE"],
  ])(
    "rejects a %s Pack evidence snapshot before writes",
    async (status, outcome) => {
      dbMock.observationSourceRun.findFirst.mockResolvedValue({
        ...observationRun(),
        status,
        outcome,
      });

      await expect(
        generateCaioOperatingQuestionPortfolioFromPackInput({
          interfaceDescriptor: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
          packOperatingInput: packOperatingInput(),
          workspaceId: WORKSPACE_ID,
          actorUserId: OWNER_USER_ID,
          generationKey: `generation:synthetic-caio:snapshot-${status.toLowerCase()}`,
          generatorRef: "generator:caio-operating-question",
          modelRef: "model:synthetic-local",
          auditRefs: [`audit:question-generation:snapshot-${status.toLowerCase()}`],
          now: NOW,
        }),
      ).rejects.toThrow("observation_evidence_outcome_mismatch");
      expect(
        dbMock.caioOperatingQuestionPortfolio.create,
      ).not.toHaveBeenCalled();
      expect(
        dbMock.caioOperatingQuestionGenerationReceipt.create,
      ).not.toHaveBeenCalled();
    },
  );

  it.each(["missing", "duplicate"] as const)(
    "rejects a %s resolved G0 trace for an evidence run",
    async (mode) => {
      trustedContextMock.mockResolvedValueOnce(
        trustedInitialization((assessmentInput) => {
          const target = assessmentInput.evidenceTraces[0];
          if (mode === "missing") {
            assessmentInput.evidenceTraces =
              assessmentInput.evidenceTraces.slice(1);
          } else {
            assessmentInput.evidenceTraces = [
              ...assessmentInput.evidenceTraces,
              {
                ...target,
                evidenceRef: `${target.evidenceRef}:duplicate`,
              },
            ];
          }
        }),
      );

      await expect(
        generateCaioOperatingQuestionPortfolioFromPackInput({
          interfaceDescriptor: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
          packOperatingInput: packOperatingInput(),
          workspaceId: WORKSPACE_ID,
          actorUserId: OWNER_USER_ID,
          generationKey: `generation:synthetic-caio:trace-${mode}`,
          generatorRef: "generator:caio-operating-question",
          modelRef: "model:synthetic-local",
          auditRefs: [`audit:question-generation:trace-${mode}`],
          now: NOW,
        }),
      ).rejects.toThrow("pack_operating_input_evidence_scope_invalid");
      expect(
        dbMock.caioOperatingQuestionPortfolio.create,
      ).not.toHaveBeenCalled();
    },
  );

  it("rejects a trace whose business evidence is absent from its source run", async () => {
    dbMock.observationSourceRun.findMany.mockImplementationOnce(
      async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id, index) => {
          const run = observationRun(id);
          return index === 0
            ? {
                ...run,
                evidenceRefs: JSON.stringify(["opportunity:portfolio-1"]),
              }
            : run;
        }),
    );

    await expect(
      generateCaioOperatingQuestionPortfolioFromPackInput({
        interfaceDescriptor: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
        packOperatingInput: packOperatingInput(),
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_USER_ID,
        generationKey: "generation:synthetic-caio:trace-business-ref-missing",
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        auditRefs: ["audit:question-generation:trace-business-ref-missing"],
        now: NOW,
      }),
    ).rejects.toThrow("pack_operating_input_evidence_scope_invalid");
    expect(dbMock.caioOperatingQuestionPortfolio.create).not.toHaveBeenCalled();
  });

  it.each(["stale", "unknown"] as const)(
    "records canonical insufficient evidence when one Pack input is %s",
    async (freshness) => {
      dbMock.$queryRaw.mockResolvedValueOnce([]);
      dbMock.observationSourceRun.findMany.mockImplementationOnce(
        async ({ where }: { where: { id: { in: string[] } } }) =>
          where.id.in.map((id, index) => {
            const run = observationRun(id);
            if (index !== 0) return run;
            return freshness === "stale"
              ? {
                  ...run,
                  source: { ...run.source, freshnessSlaMinutes: 15 },
                }
              : { ...run, freshness: "UNKNOWN" };
          }),
      );

      const result =
        await generateCaioOperatingQuestionPortfolioFromPackInput({
          interfaceDescriptor: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
          packOperatingInput: packOperatingInput(),
          workspaceId: WORKSPACE_ID,
          actorUserId: OWNER_USER_ID,
          generationKey: `generation:synthetic-caio:${freshness}`,
          generatorRef: "generator:caio-operating-question",
          modelRef: "model:synthetic-local",
          auditRefs: [`audit:question-generation:${freshness}`],
          now: NOW,
        });

      expect(result.portfolio).toBeNull();
      expect(result.receipt.status).toBe("insufficient_evidence");
      expect(
        dbMock.caioOperatingQuestionPortfolio.create,
      ).not.toHaveBeenCalled();
      expect(
        dbMock.caioOperatingQuestionGenerationReceipt.create,
      ).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ["2026-07-23T06:00:00.000Z", "insufficient_evidence"],
    ["2026-07-23T06:00:00.001Z", "generated"],
  ] as const)(
    "uses authoritative capturedAt %s instead of a newer run timestamp",
    async (capturedAt, expectedStatus) => {
      trustedContextMock.mockResolvedValueOnce(
        trustedInitialization((assessmentInput) => {
          assessmentInput.evidenceTraces = assessmentInput.evidenceTraces.map(
            (trace) => ({ ...trace, capturedAt }),
          );
        }),
      );
      dbMock.$queryRaw.mockResolvedValueOnce([]);
      dbMock.observationSourceRun.findMany.mockImplementationOnce(
        async ({ where }: { where: { id: { in: string[] } } }) =>
          where.id.in.map((id) => ({
            ...observationRun(id),
            observedAt: new Date("2026-07-23T08:59:00.000Z"),
            source: {
              ...observationRun(id).source,
              freshnessSlaMinutes: 180,
            },
          })),
      );

      const result = await generateCaioOperatingQuestionPortfolioFromPackInput({
        interfaceDescriptor: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
        packOperatingInput: packOperatingInput(),
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_USER_ID,
        generationKey: `generation:synthetic-caio:captured-at:${capturedAt}`,
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        auditRefs: [`audit:question-generation:captured-at:${capturedAt}`],
        now: NOW,
      });

      expect(result.receipt.status).toBe(expectedStatus);
      expect(result.portfolio === null).toBe(
        expectedStatus === "insufficient_evidence",
      );
    },
  );

  it("rejects Core evidence runs whose source no longer matches the accepted G0 trace", async () => {
    dbMock.observationSourceRun.findMany.mockImplementationOnce(
      async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id, index) => {
          const run = observationRun(id);
          if (index !== 0) {
            return run;
          }
          return {
            ...run,
            sourceId: "source:replacement",
            source: { ...run.source, id: "source:replacement" },
          };
        }),
    );

    await expect(
      generateCaioOperatingQuestionPortfolioFromPackInput({
        interfaceDescriptor: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
        packOperatingInput: packOperatingInput(),
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_USER_ID,
        generationKey: "generation:synthetic-caio:source-drift",
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        auditRefs: ["audit:question-generation:source-drift"],
        now: NOW,
      }),
    ).rejects.toThrow("pack_operating_input_evidence_scope_invalid");
    expect(dbMock.caioOperatingQuestionPortfolio.create).not.toHaveBeenCalled();
    expect(
      dbMock.caioOperatingQuestionGenerationReceipt.create,
    ).not.toHaveBeenCalled();
  });

  it("runs the authenticated production mount through the mounted Pack provider into the canonical store", async () => {
    dbMock.$queryRaw.mockResolvedValueOnce([]);
    const test = productionGenerationMount(packOperatingInput());

    const response = await test.mount.handle(
      productionGenerationRequest("generation:production-mount:exact-ten"),
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      replayed: false,
      receipt: { status: "generated", authorityEffect: "none" },
      portfolio: {
        workspaceRef: `workspace:${WORKSPACE_ID}`,
        candidates: expect.arrayContaining([
          expect.objectContaining({
            dependencyRefs: expect.arrayContaining([
              expect.stringMatching(/^candidate-input:/u),
              expect.stringMatching(/^taxonomy:/u),
              expect.stringMatching(/^metric:/u),
              expect.stringMatching(/^evidence-rule:/u),
            ]),
          }),
        ]),
      },
    });
    expect(
      (response.body as { portfolio: { candidates: unknown[] } }).portfolio
        .candidates,
    ).toHaveLength(10);
    expect(test.resolveOperatingInput).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        workspaceRef: `workspace:${WORKSPACE_ID}`,
        portfolioRef: "opportunity:portfolio-1",
        actorUserRef: `user:${PRODUCTION_OWNER_USER_ID}`,
      }),
    );
    expect(dbMock.caioOperatingQuestionPortfolio.create).toHaveBeenCalledOnce();
    expect(
      dbMock.caioOperatingQuestionGenerationReceipt.create,
    ).toHaveBeenCalledOnce();
  });

  it("waits for the canonical transaction to commit before settling a cancelled request", async () => {
    dbMock.$queryRaw.mockResolvedValueOnce([]);
    let markCallbackFinished!: () => void;
    const callbackFinished = new Promise<void>((resolve) => {
      markCallbackFinished = resolve;
    });
    let releaseCommit!: () => void;
    const commitReleased = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    let markTransactionSettled!: () => void;
    const transactionSettled = new Promise<void>((resolve) => {
      markTransactionSettled = resolve;
    });
    dbMock.$transaction.mockImplementationOnce(
      async (operation: (tx: typeof dbMock) => Promise<unknown>) => {
        try {
          const result = await operation(dbMock);
          markCallbackFinished();
          await commitReleased;
          return result;
        } finally {
          markTransactionSettled();
        }
      },
    );
    const controller = new AbortController();
    const test = productionGenerationMount(packOperatingInput());
    const pendingResponse = test.mount.handle({
      ...productionGenerationRequest(
        "generation:production-mount:commit-barrier",
      ),
      signal: controller.signal,
    });
    let responseSettled = false;
    void pendingResponse.finally(() => {
      responseSettled = true;
    });

    try {
      await callbackFinished;
      controller.abort();
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(responseSettled).toBe(false);
      releaseCommit();
      await expect(pendingResponse).resolves.toMatchObject({
        status: 200,
        body: {
          replayed: false,
          receipt: { status: "generated" },
        },
      });
      expect(
        dbMock.caioOperatingQuestionPortfolio.create,
      ).toHaveBeenCalledOnce();
      expect(
        dbMock.caioOperatingQuestionGenerationReceipt.create,
      ).toHaveBeenCalledOnce();
    } finally {
      releaseCommit();
      await Promise.allSettled([pendingResponse, transactionSettled]);
    }
  });

  it("records canonical insufficient evidence through the production mount", async () => {
    dbMock.$queryRaw.mockResolvedValueOnce([]);
    const test = productionGenerationMount(packOperatingInput(9));

    const response = await test.mount.handle(
      productionGenerationRequest("generation:production-mount:insufficient"),
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      replayed: false,
      receipt: {
        status: "insufficient_evidence",
        gapCodes: expect.arrayContaining(["candidate_count_not_ten"]),
      },
      portfolio: null,
    });
    expect(dbMock.caioOperatingQuestionPortfolio.create).not.toHaveBeenCalled();
    expect(
      dbMock.caioOperatingQuestionGenerationReceipt.create,
    ).toHaveBeenCalledOnce();
  });

  it("replays a production generation key even though the gateway request id changes", async () => {
    dbMock.$queryRaw.mockResolvedValueOnce([]);
    const test = productionGenerationMount(packOperatingInput());
    const request = productionGenerationRequest(
      "generation:production-mount:replay",
    );

    const first = await test.mount.handle(request);
    expect(first.status).toBe(200);
    const firstBody = first.body as {
      receipt: { receiptId: string; gateReceiptRef: string; assessmentRef: string; sequence: number };
      portfolio: { portfolioId: string; sequence: number };
    };
    const portfolioData =
      dbMock.caioOperatingQuestionPortfolio.create.mock.calls[0][0].data;
    const receiptData =
      dbMock.caioOperatingQuestionGenerationReceipt.create.mock.calls[0][0]
        .data;
    dbMock.caioOperatingQuestionGenerationReceipt.findFirst.mockResolvedValue(
      receiptData,
    );
    dbMock.caioOperatingQuestionPortfolio.findFirst.mockResolvedValue(
      portfolioData,
    );
    dbMock.caioOperatingQuestionGenerationReceipt.findUnique.mockResolvedValue(
      receiptData,
    );
    dbMock.$queryRaw.mockResolvedValueOnce([
      {
        workspaceId: WORKSPACE_ID,
        initializationGateReceiptId: firstBody.receipt.gateReceiptRef,
        initializationAssessmentId: firstBody.receipt.assessmentRef,
        currentGenerationReceiptId: firstBody.receipt.receiptId,
        currentPortfolioId: firstBody.portfolio.portfolioId,
        generationSequence: firstBody.receipt.sequence,
        portfolioSequence: firstBody.portfolio.sequence,
        version: 1,
        updatedAt: NOW,
      },
    ]);

    const replay = await test.mount.handle(request);

    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({
      replayed: true,
      receipt: { receiptId: firstBody.receipt.receiptId },
      portfolio: { portfolioId: firstBody.portfolio.portfolioId },
    });
    expect(dbMock.caioOperatingQuestionPortfolio.create).toHaveBeenCalledOnce();
    expect(
      dbMock.caioOperatingQuestionGenerationReceipt.create,
    ).toHaveBeenCalledOnce();
  });

  it("rejects mounted Pack workspace drift before entering the canonical transaction", async () => {
    const test = productionGenerationMount(
      packOperatingInput(10, { workspaceRef: "workspace:other" }),
    );

    const response = await test.mount.handle(
      productionGenerationRequest("generation:production-mount:wrong-workspace"),
    );

    expect(response.status).toBe(403);
    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(dbMock.caioOperatingQuestionPortfolio.create).not.toHaveBeenCalled();
  });

  it("rejects generation when no current accepted G0 can be reloaded", async () => {
    const missingG0 = new CaioInitializationGateStoreError(
      "accepted_gate_not_found",
    );
    trustedContextMock.mockRejectedValueOnce(missingG0);
    const test = productionGenerationMount(packOperatingInput());

    const response = await test.mount.handle(
      productionGenerationRequest("generation:production-mount:no-g0"),
    );

    expect(response.status).toBe(400);
    expect(dbMock.caioOperatingQuestionPortfolio.create).not.toHaveBeenCalled();
    expect(
      dbMock.caioOperatingQuestionGenerationReceipt.create,
    ).not.toHaveBeenCalled();
  });

  it("rejects descriptor drift before generation writes", async () => {
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
        auditRefs: ["audit:question-generation:pack-drift"],
        now: NOW,
      }),
    ).rejects.toThrow("pack_interface_descriptor_invalid");
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects external question candidates before entering the transaction", async () => {
    await expect(
      generateCaioOperatingQuestionPortfolioFromPackInput({
        interfaceDescriptor: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
        packOperatingInput: packOperatingInput(),
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_USER_ID,
        generationKey: "generation:synthetic-caio:external-candidates",
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        candidates: Array.from({ length: 10 }, (_, index) =>
          syntheticOperatingQuestionCandidate(index),
        ),
        auditRefs: ["audit:question-generation:external-candidates"],
        now: NOW,
      } as Parameters<
        typeof generateCaioOperatingQuestionPortfolioFromPackInput
      >[0]),
    ).rejects.toThrow("pack_external_candidates_forbidden");
    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(dbMock.caioOperatingQuestionPortfolio.create).not.toHaveBeenCalled();
  });

  it.each([
    ["question", "Which question should Core accept?"],
    ["questionText", "Which question should Core accept?"],
    ["scores", { businessValue: 100 }],
  ])(
    "rejects external %s before entering the transaction",
    async (field, value) => {
      await expect(
        generateCaioOperatingQuestionPortfolioFromPackInput({
          interfaceDescriptor: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
          packOperatingInput: packOperatingInput(),
          workspaceId: WORKSPACE_ID,
          actorUserId: OWNER_USER_ID,
          generationKey: `generation:synthetic-caio:external-${field}`,
          generatorRef: "generator:caio-operating-question",
          modelRef: "model:synthetic-local",
          auditRefs: [`audit:question-generation:external-${field}`],
          now: NOW,
          [field]: value,
        } as Parameters<
          typeof generateCaioOperatingQuestionPortfolioFromPackInput
        >[0]),
      ).rejects.toThrow("pack_external_question_payload_forbidden");
      expect(dbMock.$transaction).not.toHaveBeenCalled();
    },
  );

  it("records insufficient evidence when fewer than ten semantic inputs are eligible", async () => {
    dbMock.$queryRaw.mockResolvedValueOnce([]);

    const result = await generateCaioOperatingQuestionPortfolioFromPackInput({
      interfaceDescriptor: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
      packOperatingInput: packOperatingInput(9),
      workspaceId: WORKSPACE_ID,
      actorUserId: OWNER_USER_ID,
      generationKey: "generation:synthetic-caio:pack-insufficient",
      generatorRef: "generator:caio-operating-question",
      modelRef: "model:synthetic-local",
      auditRefs: ["audit:question-generation:pack-insufficient"],
      now: NOW,
    });

    expect(result.portfolio).toBeNull();
    expect(result.receipt.status).toBe("insufficient_evidence");
    expect(result.receipt.gapCodes).toContain("candidate_count_not_ten");
    expect(dbMock.caioOperatingQuestionPortfolio.create).not.toHaveBeenCalled();
    expect(
      dbMock.caioOperatingQuestionGenerationReceipt.create,
    ).toHaveBeenCalledOnce();
  });

  it("replays the same semantic request and rejects generation-key semantic drift", async () => {
    dbMock.$queryRaw.mockResolvedValueOnce([]);
    const packInput = packOperatingInput();
    const request = {
      interfaceDescriptor: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
      packOperatingInput: packInput,
      workspaceId: WORKSPACE_ID,
      actorUserId: OWNER_USER_ID,
      generationKey: "generation:synthetic-caio:pack-replay",
      generatorRef: "generator:caio-operating-question",
      modelRef: "model:synthetic-local",
      auditRefs: ["audit:question-generation:pack-replay"],
      now: NOW,
    };

    const first = await generateCaioOperatingQuestionPortfolioFromPackInput(
      request,
    );
    expect(first.replayed).toBe(false);
    expect(first.portfolio).not.toBeNull();

    const portfolioData =
      dbMock.caioOperatingQuestionPortfolio.create.mock.calls[0][0].data;
    const receiptData =
      dbMock.caioOperatingQuestionGenerationReceipt.create.mock.calls[0][0]
        .data;
    const head = {
      workspaceId: WORKSPACE_ID,
      initializationGateReceiptId: first.receipt.gateReceiptRef,
      initializationAssessmentId: first.receipt.assessmentRef,
      currentGenerationReceiptId: first.receipt.receiptId,
      currentPortfolioId: first.portfolio?.portfolioId ?? null,
      generationSequence: first.receipt.sequence,
      portfolioSequence: first.portfolio?.sequence ?? 0,
      version: 1,
      updatedAt: NOW,
    };
    dbMock.caioOperatingQuestionGenerationReceipt.findFirst.mockResolvedValue(
      receiptData,
    );
    dbMock.caioOperatingQuestionPortfolio.findFirst.mockResolvedValue(
      portfolioData,
    );
    dbMock.caioOperatingQuestionGenerationReceipt.findUnique.mockResolvedValue(
      receiptData,
    );
    dbMock.$queryRaw.mockResolvedValueOnce([head]);

    const reorderedInput = structuredClone(packInput);
    reorderedInput.taxonomy.reverse();
    reorderedInput.metrics.reverse();
    reorderedInput.evidenceApplicabilityRules.reverse();
    reorderedInput.candidateInputs.reverse();
    reorderedInput.evidenceBindings.reverse();
    const replay = await generateCaioOperatingQuestionPortfolioFromPackInput({
      ...request,
      packOperatingInput: reorderedInput,
    });
    expect(replay.replayed).toBe(true);
    expect(replay.receipt.receiptId).toBe(first.receipt.receiptId);
    expect(dbMock.caioOperatingQuestionPortfolio.create).toHaveBeenCalledOnce();
    expect(
      dbMock.caioOperatingQuestionGenerationReceipt.create,
    ).toHaveBeenCalledOnce();

    const changedInput = structuredClone(packInput);
    changedInput.candidateInputs[0].rationale =
      "A changed semantic rationale must not overwrite the prior request.";
    dbMock.$queryRaw.mockResolvedValueOnce([head]);
    await expect(
      generateCaioOperatingQuestionPortfolioFromPackInput({
        ...request,
        packOperatingInput: changedInput,
      }),
    ).rejects.toThrow("generation_key_payload_conflict");
    expect(dbMock.caioOperatingQuestionPortfolio.create).toHaveBeenCalledOnce();
    expect(
      dbMock.caioOperatingQuestionGenerationReceipt.create,
    ).toHaveBeenCalledOnce();
  });

  it("retries a concurrent generation-key winner and replays its canonical receipt", async () => {
    let persistedPortfolio: Record<string, unknown> | null = null;
    let persistedReceipt: Record<string, unknown> | null = null;

    dbMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockImplementationOnce(async () => {
        if (!persistedPortfolio || !persistedReceipt) {
          throw new Error("concurrent generation fixture was not persisted");
        }
        return [
          {
            workspaceId: WORKSPACE_ID,
            initializationGateReceiptId:
              persistedReceipt.initializationGateReceiptId,
            initializationAssessmentId:
              persistedReceipt.initializationAssessmentId,
            currentGenerationReceiptId: persistedReceipt.id,
            currentPortfolioId: persistedPortfolio.id,
            generationSequence: persistedReceipt.sequence,
            portfolioSequence: persistedPortfolio.sequence,
            version: 1,
            updatedAt: NOW,
          },
        ];
      });
    dbMock.caioOperatingQuestionPortfolio.create.mockImplementationOnce(
      async ({ data }) => {
        persistedPortfolio = data;
        return data;
      },
    );
    dbMock.caioOperatingQuestionGenerationReceipt.create.mockImplementationOnce(
      async ({ data }) => {
        persistedReceipt = data;
        throw Object.assign(new Error("concurrent generation winner"), {
          code: "P2002",
        });
      },
    );
    dbMock.caioOperatingQuestionGenerationReceipt.findFirst.mockImplementationOnce(
      async () => persistedReceipt,
    );
    dbMock.caioOperatingQuestionPortfolio.findFirst.mockImplementationOnce(
      async () => persistedPortfolio,
    );
    dbMock.caioOperatingQuestionGenerationReceipt.findUnique
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async () => persistedReceipt);

    try {
      const result = await generateCaioOperatingQuestionPortfolio({
        workspaceId: WORKSPACE_ID,
        actorUserId: OWNER_USER_ID,
        generationKey: "generation:synthetic-caio:concurrent-winner",
        generatorRef: "generator:caio-operating-question",
        modelRef: "model:synthetic-local",
        candidates: Array.from({ length: 10 }, (_, index) =>
          syntheticOperatingQuestionCandidate(index),
        ),
        auditRefs: ["audit:question-generation:concurrent-winner"],
        now: NOW,
      });

      expect(result.replayed).toBe(true);
      expect(dbMock.$transaction).toHaveBeenCalledTimes(2);
      expect(
        dbMock.caioOperatingQuestionPortfolio.create,
      ).toHaveBeenCalledOnce();
      expect(
        dbMock.caioOperatingQuestionGenerationReceipt.create,
      ).toHaveBeenCalledOnce();
    } finally {
      dbMock.caioOperatingQuestionGenerationReceipt.findFirst.mockReset();
      dbMock.caioOperatingQuestionPortfolio.findFirst.mockReset();
      dbMock.caioOperatingQuestionGenerationReceipt.findUnique.mockReset();
    }
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

  it("validates a historical v1 portfolio through the CEO selection chain", async () => {
    const historical = historicalGeneratedState();
    dbMock.$queryRaw
      .mockResolvedValueOnce([
        {
          workspaceId: WORKSPACE_ID,
          initializationGateReceiptId: historical.portfolio.gateReceiptRef,
          initializationAssessmentId: historical.portfolio.assessmentRef,
          currentGenerationReceiptId: historical.receipt.receiptId,
          currentPortfolioId: historical.portfolio.portfolioId,
          generationSequence: historical.receipt.sequence,
          portfolioSequence: historical.portfolio.sequence,
          version: 1,
          updatedAt: NOW,
        },
      ])
      .mockResolvedValueOnce([]);
    dbMock.caioPrincipalBinding.findFirst.mockResolvedValue({
      id: "binding:ceo:synthetic-caio",
    });
    dbMock.caioOperatingQuestionPortfolio.findFirst.mockResolvedValue(
      portfolioRow(historical.portfolio),
    );
    const selectedQuestionId = historical.portfolio.candidates[0].questionId;

    const result = await selectCaioOperatingQuestions({
      workspaceId: WORKSPACE_ID,
      expectedPortfolioId: historical.portfolio.portfolioId,
      actorUserId: OWNER_USER_ID,
      ceoPrincipalRef: CEO_REF,
      idempotencyKey: "selection:synthetic-caio:historical-v1",
      selections: [
        {
          questionId: selectedQuestionId,
          questionOverride: null,
          goal: "Validate the historical governed question",
          successMetrics: [
            { metricKey: "metric:historical-selection", target: "improve" },
          ],
          priority: 1,
          implementationScopeRefs: ["scope:historical-selection"],
          ownerRef: "role:operating-owner",
          reviewerRef: "role:independent-reviewer",
          startsAt: "2026-07-24T00:00:00.000Z",
          endsAt: "2026-08-23T00:00:00.000Z",
          prohibitedActions: ["external_send_without_review"],
        },
      ],
      reasonCodes: ["ceo_historical_priority_reviewed"],
      evidenceRefs: [historical.portfolio.evidenceRefs[0]],
      now: NOW,
    });

    expect(result.receipt.selectedQuestionIds).toEqual([selectedQuestionId]);
    expect(result.receipt.authorityEffect).toBe("none");
    expect(dbMock.caioQuestionSelectionReceipt.create).toHaveBeenCalledOnce();
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
