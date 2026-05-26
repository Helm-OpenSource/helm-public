import {
  AccessState,
  MembershipStatus,
  UsageType,
  WorkerEntitlementStatus,
  WorkerEntitlementType,
} from "@prisma/client";
import { addDays, subDays } from "date-fns";
import {
  FIRST_PARTY_CORE_WORKERS,
  FUTURE_ADD_ON_WORKERS,
} from "@/lib/billing/add-on-worker-commercial";
import {
  getBlockedProcessingMessage,
  type HighCostProcessingOperationKey,
} from "@/lib/billing/lifecycle-boundary";
import { getDefaultPaymentProvider } from "@/lib/billing/payment-provider-resolver";
import { findMembershipsWithExistingUsers } from "@/lib/auth/membership-with-user";
import { db } from "@/lib/db";

export const HELM_TEAM_PLAN = "helm_team_v1";
export const BILLING_CURRENCY = "CNY";
export const ORGANIZATION_BASE_FEE_CENTS = 19_900;
export const ADDITIONAL_ACTIVE_SEAT_PRICE_CENTS = 9_900;
export const INCLUDED_ADMIN_SEATS = 1;
export const TRIAL_COLLABORATOR_SEATS = 2;
export const TRIAL_DURATION_DAYS = 30;
export const GRACE_DURATION_DAYS = 7;
const REQUIRED_WORKER_KEYS = [
  ...FIRST_PARTY_CORE_WORKERS.map((worker) => worker.key),
  ...FUTURE_ADD_ON_WORKERS.map((worker) => worker.key),
];

export const BLOCKED_NEW_PROCESSING_STATES = [AccessState.GRACE, AccessState.READ_ONLY, AccessState.CANCELED] as const;

export type BillingAccessState = AccessState;

export type UsageSummaryRow = {
  usageType: UsageType;
  quantity: number;
};

export function buildTrialWindow(now = new Date()) {
  return {
    trialStartedAt: now,
    trialEndsAt: addDays(now, TRIAL_DURATION_DAYS),
    graceEndsAt: addDays(now, TRIAL_DURATION_DAYS + GRACE_DURATION_DAYS),
  };
}

export function resolveAccessStateFromDates(input: {
  trialEndsAt: Date;
  graceEndsAt: Date;
  status: AccessState;
  billingPeriodEndsAt?: Date | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  if (input.status === AccessState.ACTIVE) {
    const activeWindowEndsAt = input.billingPeriodEndsAt ?? input.trialEndsAt;

    if (now >= input.graceEndsAt) {
      return AccessState.READ_ONLY;
    }

    if (now >= activeWindowEndsAt) {
      return AccessState.GRACE;
    }

    return AccessState.ACTIVE;
  }

  if (input.status === AccessState.READ_ONLY) {
    return AccessState.READ_ONLY;
  }

  if (input.status === AccessState.GRACE || input.status === AccessState.CANCELED) {
    return now >= input.graceEndsAt ? AccessState.READ_ONLY : AccessState.GRACE;
  }

  if (now >= input.graceEndsAt) {
    return AccessState.READ_ONLY;
  }

  if (now >= input.trialEndsAt) {
    return AccessState.GRACE;
  }

  return AccessState.TRIALING;
}

export function blocksNewProcessing(state: AccessState) {
  return BLOCKED_NEW_PROCESSING_STATES.includes(state as (typeof BLOCKED_NEW_PROCESSING_STATES)[number]);
}

function hasCompleteWorkerEntitlementFoundation(
  entitlements: Array<{
    workerKey: string;
    entitlementType: WorkerEntitlementType;
    status: WorkerEntitlementStatus;
  }>,
) {
  const byWorkerKey = new Map(entitlements.map((entitlement) => [entitlement.workerKey, entitlement]));

  for (const worker of FIRST_PARTY_CORE_WORKERS) {
    const entitlement = byWorkerKey.get(worker.key);
    if (
      !entitlement ||
      entitlement.entitlementType !== WorkerEntitlementType.INCLUDED ||
      entitlement.status !== WorkerEntitlementStatus.ACTIVE
    ) {
      return false;
    }
  }

  for (const worker of FUTURE_ADD_ON_WORKERS) {
    const entitlement = byWorkerKey.get(worker.key);
    if (
      !entitlement ||
      entitlement.entitlementType !== worker.entitlementType ||
      entitlement.status !== worker.defaultStatus
    ) {
      return false;
    }
  }

  return true;
}

export async function ensureWorkspaceCommercialFoundation(workspaceId: string, now = new Date()) {
  const [workspace, billingAccount, trialState, workerEntitlements] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, defaultLocale: true },
    }),
    db.billingAccount.findUnique({
      where: { workspaceId },
      select: { id: true },
    }),
    db.trialState.findUnique({
      where: { workspaceId },
      select: { workspaceId: true },
    }),
    db.workerEntitlement.findMany({
      where: {
        workspaceId,
        workerKey: {
          in: REQUIRED_WORKER_KEYS,
        },
      },
      select: {
        workerKey: true,
        entitlementType: true,
        status: true,
      },
    }),
  ]);

  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} does not exist`);
  }

  if (
    billingAccount &&
    trialState &&
    hasCompleteWorkerEntitlementFoundation(workerEntitlements)
  ) {
    return syncWorkspaceAccessState(workspaceId, now);
  }

  const window = buildTrialWindow(now);

  await db.billingAccount.upsert({
    where: { workspaceId },
    update: {},
    create: {
      workspaceId,
      currentPlan: HELM_TEAM_PLAN,
      currency: BILLING_CURRENCY,
      billingStatus: AccessState.TRIALING,
      paymentProvider: getDefaultPaymentProvider(workspace.defaultLocale),
      baseFeeCents: ORGANIZATION_BASE_FEE_CENTS,
      activeSeatPriceCents: ADDITIONAL_ACTIVE_SEAT_PRICE_CENTS,
      includedAdminSeats: INCLUDED_ADMIN_SEATS,
    },
  });

  await db.trialState.upsert({
    where: { workspaceId },
    update: {},
    create: {
      workspaceId,
      trialStartedAt: window.trialStartedAt,
      trialEndsAt: window.trialEndsAt,
      graceEndsAt: window.graceEndsAt,
      status: AccessState.TRIALING,
    },
  });

  await Promise.all(
    FIRST_PARTY_CORE_WORKERS.map((worker) =>
      db.workerEntitlement.upsert({
        where: {
          workspaceId_workerKey: {
            workspaceId,
            workerKey: worker.key,
          },
        },
        update: {
          entitlementType: WorkerEntitlementType.INCLUDED,
          status: WorkerEntitlementStatus.ACTIVE,
        },
        create: {
          workspaceId,
          workerKey: worker.key,
          entitlementType: WorkerEntitlementType.INCLUDED,
          status: WorkerEntitlementStatus.ACTIVE,
          effectiveFrom: now,
        },
      }),
    ),
  );

  await Promise.all(
    FUTURE_ADD_ON_WORKERS.map((worker) =>
      db.workerEntitlement.upsert({
        where: {
          workspaceId_workerKey: {
            workspaceId,
            workerKey: worker.key,
          },
        },
        update: {},
        create: {
          workspaceId,
          workerKey: worker.key,
          entitlementType: worker.entitlementType,
          status: worker.defaultStatus,
          effectiveFrom: now,
        },
      }),
    ),
  );

  return syncWorkspaceAccessState(workspaceId, now);
}

export async function syncWorkspaceAccessState(workspaceId: string, now = new Date()) {
  const [trialState, billingAccount] = await Promise.all([
    db.trialState.findUnique({
      where: { workspaceId },
    }),
    db.billingAccount.findUnique({
      where: { workspaceId },
      select: {
        billingPeriodEndsAt: true,
      },
    }),
  ]);

  if (!trialState) {
    return null;
  }

  const nextStatus = resolveAccessStateFromDates({
    trialEndsAt: trialState.trialEndsAt,
    graceEndsAt: trialState.graceEndsAt,
    status: trialState.status,
    billingPeriodEndsAt: billingAccount?.billingPeriodEndsAt ?? null,
    now,
  });

  if (nextStatus !== trialState.status) {
    await db.trialState.update({
      where: { workspaceId },
      data: { status: nextStatus },
    });
  }

  await db.billingAccount.updateMany({
    where: {
      workspaceId,
      billingStatus: {
        not: nextStatus,
      },
    },
    data: {
      billingStatus: nextStatus,
    },
  });

  return nextStatus;
}

export async function ensureWorkspaceProcessingAllowed(input: {
  workspaceId: string;
  english: boolean;
  operation?: HighCostProcessingOperationKey;
}) {
  await ensureWorkspaceCommercialFoundation(input.workspaceId);
  const state = await syncWorkspaceAccessState(input.workspaceId);
  if (state && blocksNewProcessing(state)) {
    throw new Error(
      getBlockedProcessingMessage({
        state,
        english: input.english,
        operation: input.operation,
      }),
    );
  }
}

export async function recordUsageLedgerEntry(input: {
  workspaceId: string;
  userId?: string | null;
  usageType: UsageType;
  quantity?: number;
  sourcePage?: string | null;
  metadata?: Record<string, unknown> | null;
  recordedAt?: Date;
}) {
  return db.usageLedger.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId ?? undefined,
      usageType: input.usageType,
      quantity: input.quantity ?? 1,
      sourcePage: input.sourcePage ?? undefined,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      recordedAt: input.recordedAt ?? new Date(),
    },
  });
}

export async function getWorkspaceUsageSummary(workspaceId: string, lookbackDays = 30) {
  const rows = await db.usageLedger.findMany({
    where: {
      workspaceId,
      recordedAt: {
        gte: subDays(new Date(), lookbackDays),
      },
    },
    select: {
      usageType: true,
      quantity: true,
    },
  });

  const summary = rows.reduce((acc, row) => {
    acc.set(row.usageType, (acc.get(row.usageType) ?? 0) + row.quantity);
    return acc;
  }, new Map<UsageType, number>());

  return Array.from(summary.entries())
    .map(([usageType, quantity]) => ({ usageType, quantity }))
    .sort((left, right) => right.quantity - left.quantity);
}

export async function getWorkspaceBillingSnapshot(workspaceId: string) {
  await ensureWorkspaceCommercialFoundation(workspaceId);
  const accessState = await syncWorkspaceAccessState(workspaceId);

  const [billingAccount, trialState, activeSeatCount, memberships, workerEntitlements, usageSummary] = await Promise.all([
    db.billingAccount.findUnique({
      where: { workspaceId },
    }),
    db.trialState.findUnique({
      where: { workspaceId },
    }),
    db.membership.count({
      where: {
        workspaceId,
        status: MembershipStatus.ACTIVE,
      },
    }),
    findMembershipsWithExistingUsers({
      where: { workspaceId },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
    db.workerEntitlement.findMany({
      where: { workspaceId },
      orderBy: [{ entitlementType: "asc" }, { workerKey: "asc" }],
    }),
    getWorkspaceUsageSummary(workspaceId),
  ]);

  return {
    accessState: accessState ?? AccessState.TRIALING,
    billingAccount,
    trialState,
    activeSeatCount,
    trialCollaboratorSeats: TRIAL_COLLABORATOR_SEATS,
    memberships,
    workerEntitlements,
    usageSummary,
  };
}
