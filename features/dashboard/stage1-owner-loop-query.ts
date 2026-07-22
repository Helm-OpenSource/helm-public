import "server-only";

import { WorkspaceRole } from "@prisma/client";
import { db } from "@/lib/db";
import {
  buildStage1OwnerLoopReadout,
  type Stage1OwnerLoopReadout,
} from "@/features/dashboard/stage1-owner-loop-readout";

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
    readModelRows = await loadOwnerLoopRows(input.workspaceId);
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

async function loadOwnerLoopRows(workspaceId: string) {
  const [
    programs,
    sources,
    decisions,
    decisionStatusCounts,
    supervisionSignals,
    supervisionCounts,
    workPacketReceipts,
  ] = await Promise.all([
    db.enterpriseObservationProgram.findMany({
      where: { workspaceId },
      select: { status: true, startsAt: true, expiresAt: true },
    }),
    db.observationSource.findMany({
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
    db.decisionRecord.findMany({
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
    db.decisionRecord.groupBy({
      by: ["status"],
      where: { workspaceId },
      _count: { _all: true },
    }),
    db.supervisionSignalRecord.findMany({
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
    db.supervisionSignalRecord.groupBy({
      by: ["status", "severity"],
      where: { workspaceId },
      _count: { _all: true },
    }),
    db.decisionWorkPacketClaim.findMany({
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
  ]);

  return {
    programs,
    sources,
    decisions,
    decisionStatusCounts,
    supervisionSignals,
    supervisionCounts,
    workPacketReceipts,
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
