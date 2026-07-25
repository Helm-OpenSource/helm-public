import "server-only";

import {
  MembershipStatus,
  WorkspaceRole,
} from "@prisma/client";
import {
  buildModelEgressOwnerReadout,
  type ModelEgressOwnerReadout,
} from "@/features/dashboard/model-egress-readout";
import { db } from "@/lib/db";

export async function getWorkspaceModelEgressOwnerReadout(input: {
  workspaceId: string;
  actorUserId: string;
  now?: Date;
}): Promise<ModelEgressOwnerReadout | null> {
  const membership = await db.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
      },
    },
    select: {
      role: true,
      status: true,
    },
  });
  if (
    !membership ||
    membership.role !== WorkspaceRole.OWNER ||
    membership.status !== MembershipStatus.ACTIVE
  ) {
    return null;
  }
  const now = input.now ?? new Date();

  try {
    const [
      policyTotal,
      activePolicyCount,
      readinessTotal,
      readyReadinessCount,
      rawCredentialViolationCount,
      decisionTotal,
      allowedDecisionCount,
      blockedDecisionCount,
      claimedDispatchCount,
      inDoubtDispatchCount,
      terminalOutcomeCounts,
      policies,
      readiness,
      decisions,
    ] = await Promise.all([
      db.tenantModelRoutePolicy.count({
        where: { workspaceId: input.workspaceId },
      }),
      db.tenantModelRoutePolicy.count({
        where: {
          workspaceId: input.workspaceId,
          status: "ACTIVE",
          validFrom: { lte: now },
          validUntil: { gt: now },
          revokedAt: null,
        },
      }),
      db.providerAdapterReadinessReceipt.count({
        where: { workspaceId: input.workspaceId },
      }),
      db.providerAdapterReadinessReceipt.count({
        where: {
          workspaceId: input.workspaceId,
          adapterRegistered: true,
          credentialConfigured: true,
          modelProbeStatus: "READY",
          expiresAt: { gt: now },
          rawCredentialIncluded: false,
        },
      }),
      db.providerAdapterReadinessReceipt.count({
        where: {
          workspaceId: input.workspaceId,
          rawCredentialIncluded: true,
        },
      }),
      db.modelRouteDecision.count({
        where: { workspaceId: input.workspaceId },
      }),
      db.modelRouteDecision.count({
        where: {
          workspaceId: input.workspaceId,
          decision: "ALLOWED",
        },
      }),
      db.modelRouteDecision.count({
        where: {
          workspaceId: input.workspaceId,
          decision: { not: "ALLOWED" },
        },
      }),
      db.modelRouteDecision.count({
        where: {
          workspaceId: input.workspaceId,
          dispatchClaimedAt: { not: null },
        },
      }),
      db.modelRouteDecision.count({
        where: {
          workspaceId: input.workspaceId,
          dispatchClaimedAt: { not: null },
          egressReceipts: { none: { sequence: 2 } },
        },
      }),
      db.modelEgressReceipt.groupBy({
        by: ["outcome"],
        where: { workspaceId: input.workspaceId, sequence: 2 },
        _count: { _all: true },
      }),
      db.tenantModelRoutePolicy.findMany({
        where: { workspaceId: input.workspaceId },
        select: {
          id: true,
          policyKey: true,
          revision: true,
          status: true,
          validFrom: true,
          validUntil: true,
          activatedAt: true,
          revokedAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 10,
      }),
      db.providerAdapterReadinessReceipt.findMany({
        where: { workspaceId: input.workspaceId },
        select: {
          id: true,
          provider: true,
          modelId: true,
          modelVersion: true,
          adapterKey: true,
          deploymentForm: true,
          jurisdiction: true,
          region: true,
          adapterRegistered: true,
          credentialConfigured: true,
          modelProbeStatus: true,
          expiresAt: true,
          rawCredentialIncluded: true,
          checkedAt: true,
        },
        orderBy: [{ checkedAt: "desc" }, { id: "asc" }],
        take: 10,
      }),
      db.modelRouteDecision.findMany({
        where: { workspaceId: input.workspaceId },
        select: {
          id: true,
          taskClass: true,
          sensitivity: true,
          processingDisposition: true,
          routeRef: true,
          adapterReadinessState: true,
          catalogVisibilityState: true,
          decision: true,
          reasonCodes: true,
          dispatchClaimedAt: true,
          validUntil: true,
          createdAt: true,
          egressReceipts: {
            where: { sequence: 2 },
            select: {
              sequence: true,
              phase: true,
              outcome: true,
              finishedAt: true,
              latencyMs: true,
              costBand: true,
              errorCode: true,
              recordedAt: true,
            },
            take: 1,
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 10,
      }),
    ]);

    return buildModelEgressOwnerReadout({
      now,
      metrics: {
        policyTotal,
        activePolicyCount,
        readinessTotal,
        readyReadinessCount,
        rawCredentialViolationCount,
        decisionTotal,
        allowedDecisionCount,
        blockedDecisionCount,
        claimedDispatchCount,
        inDoubtDispatchCount,
      },
      terminalOutcomeCounts,
      policies,
      readiness,
      decisions,
    });
  } catch (error) {
    if (!isMissingModelEgressSchema(error)) throw error;
    console.warn("model-egress-query: additive schema unavailable");
    return null;
  }
}

function isMissingModelEgressSchema(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "P2021" || error.code === "P2022"),
  );
}
