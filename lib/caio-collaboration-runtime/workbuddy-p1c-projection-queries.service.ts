import "server-only";

import {
  WorkBuddyCollaborationError,
} from "@/lib/caio-collaboration/contracts";
import type {
  WorkBuddyP1cProjectionQueries,
} from "@/lib/caio-collaboration/readonly-handlers";
import { db } from "@/lib/db";
import {
  validateCaioOperatingQuestionPortfolio,
  type CaioOperatingQuestionPortfolio,
} from "@/lib/stage1-owner-loop/caio-operating-question";
import {
  validateCaioQuestionSelectionReceipt,
  validateCaioQuestionSelectionReceiptAgainstPortfolio,
  type CaioQuestionSelectionReceipt,
} from "@/lib/stage1-owner-loop/caio-question-selection";

type ProcessingDisposition =
  | "prohibited"
  | "local_only"
  | "remote_projected";

type ProjectionCatalogRow = Readonly<{
  processingDisposition: string;
  inventoryStatus: string;
  classificationStatus: string;
  authorizationStatus: string;
  connectionStatus: string;
  initializationStatus: string;
  authorizationRef: string | null;
  authorizationValidFrom: Date | null;
  authorizationValidUntil: Date | null;
  freshnessSlaMinutes: number;
}>;

export type WorkBuddyProjectionCatalogEvidenceRow =
  ProjectionCatalogRow &
    Readonly<{
      id: string;
      evidenceRefs: string;
    }>;

export type WorkBuddyProjectionObservationRun = Readonly<{
  status: string;
  outcome: string;
  freshness: string;
  observedAt: Date | null;
  summaryHash: string | null;
  completenessPercent: number | null;
  authorizationVersion: number;
  windowStart: Date;
  windowEnd: Date;
  source: Readonly<{
    status: string;
    authorizationRef: string;
    freshnessSlaMinutes: number;
    lastObservedAt: Date | null;
    catalogEntry: ProjectionCatalogRow | null;
    program: Readonly<{
      status: string;
      authorizationRef: string;
      authorizationVersion: number;
      startsAt: Date;
      expiresAt: Date;
      revokedAt: Date | null;
    }>;
  }>;
}>;

export type WorkBuddyProjectionObservationEvidenceRun = Omit<
  WorkBuddyProjectionObservationRun,
  "source"
> &
  Readonly<{
    id: string;
    sourceId: string;
    evidenceRefs: string | null;
    createdAt: Date;
    source: Omit<
      WorkBuddyProjectionObservationRun["source"],
      "catalogEntry"
    > &
      Readonly<{
        catalogEntry:
          | (ProjectionCatalogRow & Readonly<{ id: string }>)
          | null;
      }>;
  }>;

function parseJson<T>(value: string, message: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new WorkBuddyCollaborationError(
      "PROJECTION_BLOCKED",
      message,
    );
  }
}

function parseStringArray(value: string, message: string): string[] {
  const parsed = parseJson<unknown>(value, message);
  if (
    !Array.isArray(parsed) ||
    parsed.some((item) => typeof item !== "string")
  ) {
    throw new WorkBuddyCollaborationError(
      "PROJECTION_BLOCKED",
      message,
    );
  }
  return parsed;
}

function parsePortfolio(row: {
  id: string;
  workspaceId: string;
  sequence: number;
  portfolioJson: string;
  contentHash: string;
  authorityEffect: string;
  generatedAt: Date;
}): CaioOperatingQuestionPortfolio {
  const portfolio = parseJson<CaioOperatingQuestionPortfolio>(
    row.portfolioJson,
    "The canonical P1C portfolio is not valid JSON.",
  );
  const validation = validateCaioOperatingQuestionPortfolio(portfolio);
  if (
    !validation.valid ||
    portfolio.portfolioId !== row.id ||
    portfolio.workspaceRef !== `workspace:${row.workspaceId}` ||
    portfolio.sequence !== row.sequence ||
    portfolio.contentHash !== row.contentHash ||
    portfolio.authorityEffect !== row.authorityEffect ||
    portfolio.generatedAt !== row.generatedAt.toISOString()
  ) {
    throw new WorkBuddyCollaborationError(
      "PROJECTION_BLOCKED",
      "The canonical P1C portfolio failed integrity validation.",
    );
  }
  return portfolio;
}

function parseSelection(
  row: {
    id: string;
    workspaceId: string;
    portfolioId: string;
    sequence: number;
    receiptJson: string;
    contentHash: string;
    authorityEffect: string;
    workPacketEffect: string;
    selectedQuestionIds: string;
    selectedAt: Date;
  },
  portfolio: CaioOperatingQuestionPortfolio,
): CaioQuestionSelectionReceipt {
  const receipt = parseJson<CaioQuestionSelectionReceipt>(
    row.receiptJson,
    "The canonical P1C selection receipt is not valid JSON.",
  );
  const validation = validateCaioQuestionSelectionReceipt(receipt);
  const context =
    validateCaioQuestionSelectionReceiptAgainstPortfolio(
      receipt,
      portfolio,
    );
  if (
    !validation.valid ||
    !context.valid ||
    receipt.receiptId !== row.id ||
    receipt.workspaceRef !== `workspace:${row.workspaceId}` ||
    receipt.portfolioRef !== row.portfolioId ||
    receipt.sequence !== row.sequence ||
    receipt.contentHash !== row.contentHash ||
    receipt.authorityEffect !== row.authorityEffect ||
    receipt.workPacketEffect !== row.workPacketEffect ||
    receipt.selectedAt !== row.selectedAt.toISOString() ||
    JSON.stringify(receipt.selectedQuestionIds) !==
      JSON.stringify(
        parseStringArray(
          row.selectedQuestionIds,
          "The canonical P1C selection index is invalid.",
        ),
      )
  ) {
    throw new WorkBuddyCollaborationError(
      "PROJECTION_BLOCKED",
      "The canonical P1C selection receipt failed integrity validation.",
    );
  }
  return receipt;
}

function normalizeStatus(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]*$/.test(normalized)) {
    throw new WorkBuddyCollaborationError(
      "PROJECTION_BLOCKED",
      "A canonical lifecycle status cannot be projected safely.",
    );
  }
  return normalized;
}

export function resolveWorkBuddyCandidateProcessingDisposition(input: {
  evidenceRefs: readonly string[];
  dispositionsByEvidenceRef: ReadonlyMap<
    string,
    readonly ProcessingDisposition[]
  >;
}): ProcessingDisposition {
  if (input.evidenceRefs.length === 0) return "local_only";
  let sawLocalOnly = false;
  for (const evidenceRef of input.evidenceRefs) {
    const dispositions =
      input.dispositionsByEvidenceRef.get(evidenceRef);
    if (!dispositions || dispositions.length === 0) {
      sawLocalOnly = true;
      continue;
    }
    if (dispositions.includes("prohibited")) return "prohibited";
    if (!dispositions.every((value) => value === "remote_projected")) {
      sawLocalOnly = true;
    }
  }
  return sawLocalOnly ? "local_only" : "remote_projected";
}

function normalizeProcessingDisposition(
  value: string,
): ProcessingDisposition {
  const normalized = value.trim().toLowerCase();
  if (normalized === "remote_projected") {
    return "remote_projected";
  }
  if (normalized === "prohibited") return "prohibited";
  return "local_only";
}

function isCurrentAuthorization(
  catalog: ProjectionCatalogRow,
  evaluatedAt: Date,
): boolean {
  return (
    catalog.inventoryStatus === "INVENTORIED" &&
    catalog.classificationStatus === "CLASSIFIED" &&
    catalog.authorizationStatus === "AUTHORIZED" &&
    catalog.connectionStatus === "CONNECTED" &&
    catalog.initializationStatus === "INITIALIZED" &&
    catalog.authorizationRef !== null &&
    catalog.authorizationValidFrom !== null &&
    catalog.authorizationValidUntil !== null &&
    catalog.authorizationValidFrom.getTime() <=
      evaluatedAt.getTime() &&
    catalog.authorizationValidUntil.getTime() >
      evaluatedAt.getTime() &&
    Number.isSafeInteger(catalog.freshnessSlaMinutes) &&
    catalog.freshnessSlaMinutes > 0
  );
}

function catalogDispositionForProjection(
  catalog: ProjectionCatalogRow,
  evaluatedAt: Date,
): ProcessingDisposition {
  const configured = normalizeProcessingDisposition(
    catalog.processingDisposition,
  );
  if (configured === "prohibited") return configured;
  if (
    configured !== "remote_projected" ||
    !isCurrentAuthorization(catalog, evaluatedAt)
  ) {
    return "local_only";
  }
  return "remote_projected";
}

export function classifyObservationRunEvidenceDisposition(input: {
  run: WorkBuddyProjectionObservationRun;
  evaluatedAt: Date;
}): ProcessingDisposition {
  const { run, evaluatedAt } = input;
  const catalog = run.source.catalogEntry;
  if (!catalog) return "local_only";
  const configured = catalogDispositionForProjection(
    catalog,
    evaluatedAt,
  );
  if (configured !== "remote_projected") return configured;

  const observedAt = run.observedAt?.getTime() ?? Number.NaN;
  const evaluatedAtMs = evaluatedAt.getTime();
  const sourceSlaMs =
    run.source.freshnessSlaMinutes * 60_000;
  const catalogSlaMs = catalog.freshnessSlaMinutes * 60_000;
  const program = run.source.program;
  const valid =
    run.status === "SUCCEEDED" &&
    run.outcome === "SUCCESS" &&
    run.freshness === "FRESH" &&
    run.summaryHash !== null &&
    run.summaryHash.trim().length > 0 &&
    run.completenessPercent === 100 &&
    run.source.status === "ACTIVE" &&
    run.source.authorizationRef === program.authorizationRef &&
    catalog.authorizationRef === program.authorizationRef &&
    program.status === "ACTIVE" &&
    program.revokedAt === null &&
    program.startsAt.getTime() <= evaluatedAtMs &&
    program.expiresAt.getTime() > evaluatedAtMs &&
    run.authorizationVersion === program.authorizationVersion &&
    program.startsAt.getTime() <= run.windowStart.getTime() &&
    run.windowStart.getTime() <= run.windowEnd.getTime() &&
    run.windowEnd.getTime() <= program.expiresAt.getTime() &&
    Number.isFinite(observedAt) &&
    observedAt >= run.windowEnd.getTime() &&
    observedAt <= evaluatedAtMs &&
    run.source.lastObservedAt !== null &&
    run.source.lastObservedAt.getTime() >= observedAt &&
    Number.isSafeInteger(run.source.freshnessSlaMinutes) &&
    run.source.freshnessSlaMinutes > 0 &&
    evaluatedAtMs - observedAt <=
      Math.min(sourceSlaMs, catalogSlaMs);
  return valid ? "remote_projected" : "local_only";
}

function isLaterObservationRun(
  candidate: WorkBuddyProjectionObservationEvidenceRun,
  incumbent: WorkBuddyProjectionObservationEvidenceRun,
): boolean {
  const candidateCreatedAt = candidate.createdAt.getTime();
  const incumbentCreatedAt = incumbent.createdAt.getTime();
  if (candidateCreatedAt !== incumbentCreatedAt) {
    return candidateCreatedAt > incumbentCreatedAt;
  }
  return candidate.id.localeCompare(incumbent.id) > 0;
}

export function resolveWorkBuddyEvidenceDispositions(input: {
  catalogRows: readonly WorkBuddyProjectionCatalogEvidenceRow[];
  runRows: readonly WorkBuddyProjectionObservationEvidenceRun[];
  evaluatedAt: Date;
}): ReadonlyMap<string, readonly ProcessingDisposition[]> {
  const latestRunByCatalogAndEvidence = new Map<
    string,
    Map<string, WorkBuddyProjectionObservationEvidenceRun>
  >();
  for (const run of input.runRows) {
    const catalogEntryId = run.source.catalogEntry?.id;
    if (!catalogEntryId || !run.evidenceRefs) continue;
    const evidenceRefs = parseStringArray(
      run.evidenceRefs,
      "An observation-run evidence index is invalid.",
    );
    const byEvidence =
      latestRunByCatalogAndEvidence.get(catalogEntryId) ??
      new Map<
        string,
        WorkBuddyProjectionObservationEvidenceRun
      >();
    for (const evidenceRef of evidenceRefs) {
      const incumbent = byEvidence.get(evidenceRef);
      if (
        !incumbent ||
        isLaterObservationRun(run, incumbent)
      ) {
        byEvidence.set(evidenceRef, run);
      }
    }
    latestRunByCatalogAndEvidence.set(catalogEntryId, byEvidence);
  }

  const result = new Map<string, ProcessingDisposition[]>();
  for (const catalog of input.catalogRows) {
    const catalogDisposition = catalogDispositionForProjection(
      catalog,
      input.evaluatedAt,
    );
    const latestRuns =
      latestRunByCatalogAndEvidence.get(catalog.id) ??
      new Map<string, WorkBuddyProjectionObservationEvidenceRun>();
    const evidenceRefs = new Set([
      ...parseStringArray(
        catalog.evidenceRefs,
        "A data-asset evidence index is invalid.",
      ),
      ...latestRuns.keys(),
    ]);
    for (const evidenceRef of evidenceRefs) {
      const latestRun = latestRuns.get(evidenceRef) ?? null;
      const disposition =
        catalogDisposition === "remote_projected" && latestRun
          ? classifyObservationRunEvidenceDisposition({
              run: latestRun,
              evaluatedAt: input.evaluatedAt,
            })
          : catalogDisposition === "prohibited"
            ? "prohibited"
            : "local_only";
      const current = result.get(evidenceRef) ?? [];
      current.push(disposition);
      result.set(evidenceRef, current);
    }
  }
  return result;
}

async function loadEvidenceDispositions(
  workspaceId: string,
  evaluatedAt: Date,
): Promise<ReadonlyMap<string, readonly ProcessingDisposition[]>> {
  const [catalogRows, runRows] = await db.$transaction(
    async (tx) =>
      Promise.all([
        tx.dataAssetCatalogEntry.findMany({
          where: { workspaceId },
          select: {
            id: true,
            processingDisposition: true,
            inventoryStatus: true,
            classificationStatus: true,
            authorizationStatus: true,
            connectionStatus: true,
            initializationStatus: true,
            authorizationRef: true,
            authorizationValidFrom: true,
            authorizationValidUntil: true,
            freshnessSlaMinutes: true,
            evidenceRefs: true,
          },
        }),
        tx.observationSourceRun.findMany({
          where: {
            workspaceId,
            evidenceRefs: { not: null },
          },
          select: {
            id: true,
            sourceId: true,
            status: true,
            outcome: true,
            freshness: true,
            observedAt: true,
            summaryHash: true,
            completenessPercent: true,
            authorizationVersion: true,
            windowStart: true,
            windowEnd: true,
            evidenceRefs: true,
            createdAt: true,
            source: {
              select: {
                status: true,
                authorizationRef: true,
                freshnessSlaMinutes: true,
                lastObservedAt: true,
                catalogEntry: {
                  select: {
                    id: true,
                    processingDisposition: true,
                    inventoryStatus: true,
                    classificationStatus: true,
                    authorizationStatus: true,
                    connectionStatus: true,
                    initializationStatus: true,
                    authorizationRef: true,
                    authorizationValidFrom: true,
                    authorizationValidUntil: true,
                    freshnessSlaMinutes: true,
                  },
                },
                program: {
                  select: {
                    status: true,
                    authorizationRef: true,
                    authorizationVersion: true,
                    startsAt: true,
                    expiresAt: true,
                    revokedAt: true,
                  },
                },
              },
            },
          },
        }),
      ]),
    { isolationLevel: "RepeatableRead" },
  );
  return resolveWorkBuddyEvidenceDispositions({
    catalogRows,
    runRows,
    evaluatedAt,
  });
}

export function createPrismaWorkBuddyP1cProjectionQueries(input?: {
  now?: () => string;
}): WorkBuddyP1cProjectionQueries {
  const now = input?.now ?? (() => new Date().toISOString());
  return Object.freeze({
    async loadP1cProjectionSource(
      input: Parameters<
        WorkBuddyP1cProjectionQueries["loadP1cProjectionSource"]
      >[0],
    ) {
      const row = input.portfolioRef
        ? await db.caioOperatingQuestionPortfolio.findFirst({
            where: {
              id: input.portfolioRef,
              workspaceId: input.workspaceId,
            },
          })
        : input.portfolioSequence !== undefined
          ? await db.caioOperatingQuestionPortfolio.findFirst({
              where: {
                workspaceId: input.workspaceId,
                sequence: input.portfolioSequence,
              },
            })
        : (
            await db.caioOperatingQuestionPortfolioHead.findUnique({
              where: { workspaceId: input.workspaceId },
              include: { currentPortfolio: true },
            })
          )?.currentPortfolio;
      if (!row) return null;

      const portfolio = parsePortfolio(row);
      const selectionRow =
        await db.caioQuestionSelectionReceipt.findFirst({
          where: {
            workspaceId: input.workspaceId,
            portfolioId: portfolio.portfolioId,
          },
          orderBy: [{ sequence: "desc" }, { id: "desc" }],
        });
      const selection = selectionRow
        ? parseSelection(selectionRow, portfolio)
        : null;
      const evaluatedAt = new Date(now());
      if (!Number.isFinite(evaluatedAt.getTime())) {
        throw new WorkBuddyCollaborationError(
          "PROJECTION_BLOCKED",
          "The P1C projection evaluation time is invalid.",
        );
      }
      const dispositions = await loadEvidenceDispositions(
        input.workspaceId,
        evaluatedAt,
      );
      const bindings = selection
        ? await db.caioOperatingQuestionDecisionBinding.findMany({
            where: {
              workspaceId: input.workspaceId,
              portfolioId: portfolio.portfolioId,
              selectionReceiptId: selection.receiptId,
            },
            include: {
              decisionRecord: {
                include: {
                  workPacketClaim: {
                    include: {
                      actionItem: {
                        include: {
                          approvalTask: true,
                          executionReceipt: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          })
        : [];
      const bindingByQuestion = new Map(
        bindings.map((binding) => [binding.questionId, binding]),
      );

      return {
        workspaceId: input.workspaceId,
        portfolio: {
          portfolioRef: portfolio.portfolioId,
          sequence: portfolio.sequence,
          generatedAt: portfolio.generatedAt,
          questions: portfolio.candidates.map((candidate) => ({
            questionRef: candidate.questionId,
            rank: candidate.rank,
            title: candidate.title,
            question: candidate.question,
            businessDomain: candidate.businessDomain,
            evidenceCount: candidate.evidenceRefs.length,
            processingDisposition:
              resolveWorkBuddyCandidateProcessingDisposition({
                evidenceRefs: candidate.evidenceRefs,
                dispositionsByEvidenceRef: dispositions,
              }),
            contentHash: candidate.contentHash,
          })),
        },
        selection: selection
          ? {
              selectionReceiptRef: selection.receiptId,
              sequence: selection.sequence,
              selectedQuestionRefs: selection.selectedQuestionIds,
            }
          : null,
        followThrough: portfolio.candidates
          .map((candidate) => {
            const binding = bindingByQuestion.get(candidate.questionId);
            if (!binding) return null;
            const decision = binding.decisionRecord;
            const action =
              decision.workPacketClaim?.actionItem ?? null;
            const approval =
              action?.approvalTask?.autoExecute === false
                ? action.approvalTask
                : null;
            const execution = action?.executionReceipt ?? null;
            return {
              questionRef: candidate.questionId,
              decisionRecord: {
                ref: decision.id,
                status: normalizeStatus(decision.status),
                validUntil: decision.validUntil?.toISOString() ?? null,
              },
              actionItem: action
                ? {
                    ref: action.id,
                    status: normalizeStatus(action.status),
                    riskLevel: normalizeStatus(action.riskLevel),
                  }
                : null,
              approvalTask: approval
                ? {
                    ref: approval.id,
                    status: normalizeStatus(approval.status),
                    autoExecute: false as const,
                  }
                : null,
              executionReceipt: execution
                ? {
                    ref: execution.id,
                    status: normalizeStatus(execution.outcome),
                  }
                : null,
            };
          })
          .filter((item) => item !== null),
      };
    },
  });
}
