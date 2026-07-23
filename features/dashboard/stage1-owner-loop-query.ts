import "server-only";

import { Prisma, WorkspaceRole } from "@prisma/client";
import { db } from "@/lib/db";
import {
  buildStage1OwnerLoopReadout,
  type Stage1OwnerLoopReadout,
} from "@/features/dashboard/stage1-owner-loop-readout";
import { loadCurrentAcceptedCaioInitializationContextForRead } from "@/lib/stage1-owner-loop/caio-initialization-gate-store.service";

const OWNER_LOOP_READ_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

export async function getWorkspaceStage1OwnerLoopReadout(input: {
  workspaceId: string;
  membershipRole: WorkspaceRole;
  now?: Date;
}): Promise<Stage1OwnerLoopReadout | null> {
  // This is the CEO-facing aggregate. Returning null before touching the
  // database keeps it unavailable to non-owners even if a caller wires it into
  // another surface accidentally.
  if (input.membershipRole !== WorkspaceRole.OWNER) return null;
  const now = input.now ?? new Date();

  let readModelRows: Awaited<ReturnType<typeof loadOwnerLoopRows>>;
  try {
    readModelRows = await db.$transaction(
      (tx) => loadOwnerLoopRows(tx, input.workspaceId, now),
      OWNER_LOOP_READ_TRANSACTION_OPTIONS,
    );
  } catch (error) {
    if (!isMissingOwnerLoopSchema(error)) throw error;
    console.warn("stage1-owner-loop-query: additive schema unavailable");
    return null;
  }

  return buildStage1OwnerLoopReadout({
    now,
    ...readModelRows,
  });
}

async function loadOwnerLoopRows(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  now: Date,
) {
  const [
    programs,
    sources,
    decisions,
    decisionStatusCounts,
    supervisionSignals,
    supervisionCounts,
    workPacketReceipts,
    currentG0Context,
    operatingQuestionHead,
    questionSelectionHead,
  ] = await Promise.all([
    tx.enterpriseObservationProgram.findMany({
      where: { workspaceId },
      select: { status: true, startsAt: true, expiresAt: true },
    }),
    tx.observationSource.findMany({
      where: { workspaceId },
      select: {
        id: true,
        sourceKey: true,
        sourceKind: true,
        status: true,
        freshnessSlaMinutes: true,
        lastObservedAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    }),
    tx.decisionRecord.findMany({
      where: { workspaceId },
      select: {
        id: true,
        decisionKey: true,
        businessQuestion: true,
        status: true,
        riskLevel: true,
        ownerRef: true,
        validUntil: true,
        updatedAt: true,
        workPacketClaim: {
          select: {
            actionItem: {
              select: {
                status: true,
                dueDate: true,
                executionReceipt: {
                  select: {
                    verificationState: true,
                    qualityScore: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 5,
    }),
    tx.decisionRecord.groupBy({
      by: ["status"],
      where: { workspaceId },
      _count: { _all: true },
    }),
    tx.supervisionSignalRecord.findMany({
      where: {
        workspaceId,
        status: { in: ["open", "acknowledged", "routed"] },
      },
      select: {
        id: true,
        signalKey: true,
        observedFact: true,
        severity: true,
        status: true,
        recommendedRoute: true,
        deadlineOrSla: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 5,
    }),
    tx.supervisionSignalRecord.groupBy({
      by: ["status", "severity"],
      where: { workspaceId },
      _count: { _all: true },
    }),
    tx.decisionWorkPacketClaim.findMany({
      where: { workspaceId },
      select: {
        decisionRecord: { select: { status: true } },
        actionItem: {
          select: {
            status: true,
            executionReceipt: {
              select: { verificationState: true, qualityScore: true },
            },
          },
        },
      },
    }),
    loadCurrentAcceptedCaioInitializationContextForRead(tx, {
      workspaceId,
      at: now,
    }),
    tx.caioOperatingQuestionPortfolioHead.findUnique({
      where: { workspaceId },
      include: {
        currentGenerationReceipt: true,
        currentPortfolio: true,
      },
    }),
    tx.caioQuestionSelectionHead.findUnique({
      where: { workspaceId },
      include: {
        currentReceipt: {
          include: {
            decisionBindings: {
              include: {
                implementationPlan: true,
              },
              orderBy: { questionId: "asc" },
            },
          },
        },
      },
    }),
  ]);

  return {
    programs,
    sources,
    decisions,
    decisionStatusCounts,
    supervisionSignals,
    supervisionCounts,
    workPacketReceipts,
    currentG0Context,
    operatingQuestionHead,
    questionSelectionHead,
  };
}

function isMissingOwnerLoopSchema(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2021",
  );
}
