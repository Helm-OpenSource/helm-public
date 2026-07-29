import "server-only";

import { Prisma } from "@prisma/client";

import {
  type WorkBuddyAuthorizationQueries,
  type WorkBuddyAuthorizationSnapshot,
  type WorkBuddyAuthorizationSnapshotQuery,
  type WorkBuddyCurrentMandateSnapshot,
} from "@/lib/caio-collaboration/authorization.service";
import {
  workspaceRoleHasCapability,
} from "@/lib/auth/authorization";
import { db } from "@/lib/db";

type QueryClient = Prisma.TransactionClient | typeof db;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

async function loadCurrentMandate(
  client: QueryClient,
  workspaceId: string,
  at: Date,
): Promise<WorkBuddyCurrentMandateSnapshot | null> {
  const claim = await client.caioActiveMandateClaim.findUnique({
    where: { workspaceId },
    include: {
      mandateRecord: {
        include: {
          guardianStops: {
            where: { resumedAt: null },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });
  const mandate = claim?.mandateRecord;
  if (
    !mandate ||
    mandate.workspaceId !== workspaceId ||
    mandate.status !== "active" ||
    mandate.validFrom.getTime() > at.getTime() ||
    mandate.validUntil.getTime() <= at.getTime() ||
    mandate.emergencyStopRef !== null ||
    mandate.guardianStops.length > 0
  ) {
    return null;
  }
  return Object.freeze({
    mandateRef: mandate.id,
    ceoRef: mandate.ceoRef,
    status: "CURRENT" as const,
  });
}

export async function loadPrismaWorkBuddyAuthorizationSnapshot(
  client: QueryClient,
  query: WorkBuddyAuthorizationSnapshotQuery,
): Promise<WorkBuddyAuthorizationSnapshot> {
  const checkedAt = new Date(query.checkedAt);
  if (!Number.isFinite(checkedAt.getTime())) {
    return Object.freeze({
      membership: null,
      hasCapability: false,
      mandate: null,
      binding: null,
    });
  }
  const membership = await client.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: query.workspaceId,
        userId: query.actorUserId,
      },
    },
    select: { status: true, role: true },
  });
  const membershipSnapshot = membership
    ? Object.freeze({
        status: membership.status,
        role: membership.role,
      })
    : null;
  const mandate = await loadCurrentMandate(
    client,
    query.workspaceId,
    checkedAt,
  );
  const bindingRow = mandate
    ? await client.caioPrincipalBinding.findFirst({
        where: {
          workspaceId: query.workspaceId,
          userId: query.actorUserId,
          principalRef: mandate.ceoRef,
          principalKind: "ceo",
          revokedAt: null,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      })
    : null;
  const binding = bindingRow
    ? Object.freeze({
        bindingRef: bindingRow.id,
        actorUserId: bindingRow.userId,
        principalKind: "CEO" as const,
        ceoRef: bindingRow.principalRef,
        status: "LIVE" as const,
      })
    : null;
  return Object.freeze({
    membership: membershipSnapshot,
    hasCapability:
      membership?.status === "ACTIVE" &&
      workspaceRoleHasCapability(
        membership.role,
        query.capability,
      ),
    mandate,
    binding,
  });
}

export function createPrismaWorkBuddyAuthorizationQueries(): WorkBuddyAuthorizationQueries {
  return Object.freeze({
    async loadAuthorizationSnapshot(
      query: Parameters<
        WorkBuddyAuthorizationQueries["loadAuthorizationSnapshot"]
      >[0],
    ) {
      return db.$transaction(
        (tx) =>
          loadPrismaWorkBuddyAuthorizationSnapshot(tx, query),
        TRANSACTION_OPTIONS,
      );
    },
  });
}
