import { ActorType, RevenueBeneficiaryType, RevenueLedgerStatus, SettlementBatchStatus, SettlementLineStatus } from "@prisma/client";
import { assertWorkspaceReservedManualSettlementServiceAccess } from "@/lib/auth/service-governance";
import { BILLING_CURRENCY } from "@/lib/billing/foundation";
import { reverseRevenueAttributionEntry, ensureWorkspaceRevenueAttributionFoundation } from "@/lib/billing/revenue-attribution";
import {
  canApproveSettlementBatch,
  canCloseSettlementBatch,
  canExportSettlementBatch,
  canMarkSettlementLinePaid,
  canReverseSettlementLine,
} from "@/lib/billing/settlement-posture";
import { db } from "@/lib/db";

export { buildManualSettlementCapabilityDecisionTrace } from "@/lib/capability-decision-trace";

export const MANUAL_SETTLEMENT_SUPPORTED_BENEFICIARY_TYPES = new Set<RevenueBeneficiaryType>([
  RevenueBeneficiaryType.WORKER_PUBLISHER,
  RevenueBeneficiaryType.SALES_REFERRAL,
  RevenueBeneficiaryType.CUSTOM_SERVICES,
]);

export type SettlementPeriodWindow = {
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
};

export function beneficiarySupportsPayoutProfile(beneficiaryType: RevenueBeneficiaryType) {
  return MANUAL_SETTLEMENT_SUPPORTED_BENEFICIARY_TYPES.has(beneficiaryType);
}

export function resolveSettlementPeriodWindow(periodLabel: string): SettlementPeriodWindow {
  const trimmed = periodLabel.trim();
  const match = /^(\d{4})-(\d{2})$/.exec(trimmed);

  if (!match) {
    throw new Error("Settlement period must use YYYY-MM");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Settlement period must use a valid YYYY-MM month");
  }

  return {
    periodLabel: trimmed,
    periodStart: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
    periodEnd: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

export function buildSettlementBatchKey(periodLabel: string) {
  return `settlement_${periodLabel.replace(/[^0-9]+/g, "_")}`;
}

export function escapeSettlementCsvCell(value: string | number | null | undefined) {
  const stringValue = value === null || value === undefined ? "" : String(value);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }

  return stringValue;
}

export function buildSettlementBatchCsv(input: {
  batchKey: string;
  periodLabel: string;
  currency: string;
  rows: Array<{
    beneficiaryLabel: string;
    beneficiaryType: RevenueBeneficiaryType;
    sourceType: string;
    amountCents: number;
    currency: string;
    status: SettlementLineStatus;
    notes: string | null;
    reference: string | null;
  }>;
}) {
  const header = [
    "batch_key",
    "period",
    "beneficiary",
    "beneficiary_type",
    "source_type",
    "amount_minor",
    "currency",
    "status",
    "notes",
    "reference",
  ];

  const rows = input.rows.map((row) =>
    [
      input.batchKey,
      input.periodLabel,
      row.beneficiaryLabel,
      row.beneficiaryType,
      row.sourceType,
      row.amountCents,
      row.currency,
      row.status,
      row.notes,
      row.reference,
    ]
      .map(escapeSettlementCsvCell)
      .join(","),
  );

  return [header.join(","), ...rows].join("\n");
}

export { canMarkSettlementLinePaid, canReverseSettlementLine };

function appendSettlementNote(current: string | null | undefined, addition: string) {
  if (!current?.trim()) {
    return addition;
  }

  if (current.includes(addition)) {
    return current;
  }

  return `${current}\n${addition}`;
}

function getPayoutProfileReference(input: {
  beneficiaryType: RevenueBeneficiaryType;
  workerPublisherProfile?: { publisherKey: string } | null;
  salesReferral?: { referralKey: string } | null;
  customEngagement?: { engagementKey: string } | null;
}) {
  if (input.beneficiaryType === RevenueBeneficiaryType.WORKER_PUBLISHER) {
    return input.workerPublisherProfile?.publisherKey ?? null;
  }

  if (input.beneficiaryType === RevenueBeneficiaryType.SALES_REFERRAL) {
    return input.salesReferral?.referralKey ?? null;
  }

  if (input.beneficiaryType === RevenueBeneficiaryType.CUSTOM_SERVICES) {
    return input.customEngagement?.engagementKey ?? null;
  }

  return null;
}

function getMatchingPayoutProfileId(input: {
  payoutLedger: {
    beneficiaryType: RevenueBeneficiaryType;
    workerPublisherProfileId: string | null;
    salesReferralId: string | null;
    customEngagementId: string | null;
    workerPublisherProfile?: { publisherKey: string } | null;
    salesReferral?: { referralKey: string } | null;
    customEngagement?: { engagementKey: string } | null;
  };
}) {
  const beneficiaryReference = getPayoutProfileReference({
    beneficiaryType: input.payoutLedger.beneficiaryType,
    workerPublisherProfile: input.payoutLedger.workerPublisherProfile,
    salesReferral: input.payoutLedger.salesReferral,
    customEngagement: input.payoutLedger.customEngagement,
  });

  if (!beneficiaryReference || !beneficiarySupportsPayoutProfile(input.payoutLedger.beneficiaryType)) {
    return null;
  }

  return `${input.payoutLedger.beneficiaryType}:${beneficiaryReference}`;
}

export async function ensureWorkspaceManualSettlementFoundation(workspaceId: string) {
  await ensureWorkspaceRevenueAttributionFoundation(workspaceId);
}

export async function createSettlementBatchForPeriod(input: {
  workspaceId: string;
  periodLabel: string;
  notes?: string | null;
  currency?: string | null;
  now?: Date;
  actorUserId?: string | null;
  actorType?: ActorType | null;
  english?: boolean;
}) {
  await assertWorkspaceReservedManualSettlementServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  await ensureWorkspaceManualSettlementFoundation(input.workspaceId);
  const period = resolveSettlementPeriodWindow(input.periodLabel);
  const batchKey = buildSettlementBatchKey(period.periodLabel);

  const existingBatch = await db.settlementBatch.findUnique({
    where: {
      workspaceId_batchKey: {
        workspaceId: input.workspaceId,
        batchKey,
      },
    },
    select: { id: true },
  });

  if (existingBatch) {
    throw new Error("Settlement batch already exists for this period");
  }

  const eligiblePayouts = await db.payoutLedger.findMany({
    where: {
      workspaceId: input.workspaceId,
      beneficiaryType: {
        in: [
          RevenueBeneficiaryType.WORKER_PUBLISHER,
          RevenueBeneficiaryType.SALES_REFERRAL,
          RevenueBeneficiaryType.CUSTOM_SERVICES,
        ],
      },
      status: {
        in: [RevenueLedgerStatus.PENDING, RevenueLedgerStatus.APPROVED],
      },
      OR: [{ payableAfter: null }, { payableAfter: { lte: period.periodEnd } }],
      settlementBatchLine: null,
    },
    include: {
      workerPublisherProfile: {
        select: {
          publisherKey: true,
        },
      },
      salesReferral: {
        select: {
          referralKey: true,
        },
      },
      customEngagement: {
        select: {
          engagementKey: true,
        },
      },
      revenueAttributionLedger: {
        select: {
          sourceType: true,
          sourceReference: true,
        },
      },
    },
    orderBy: [{ payableAfter: "asc" }, { createdAt: "asc" }],
  });

  const payoutProfiles = await db.beneficiaryPayoutProfile.findMany({
    where: { workspaceId: input.workspaceId },
    select: {
      id: true,
      beneficiaryType: true,
      beneficiaryReference: true,
    },
  });
  const payoutProfileLookup = new Map(
    payoutProfiles.map((profile) => [`${profile.beneficiaryType}:${profile.beneficiaryReference}`, profile.id]),
  );

  return db.$transaction(async (tx) => {
    const batch = await tx.settlementBatch.create({
      data: {
        workspaceId: input.workspaceId,
        batchKey,
        periodLabel: period.periodLabel,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        currency: input.currency ?? BILLING_CURRENCY,
        status: SettlementBatchStatus.DRAFT,
        notes: input.notes ?? null,
      },
    });

    for (const payout of eligiblePayouts) {
      const profileKey = getMatchingPayoutProfileId({ payoutLedger: payout });

      await tx.settlementBatchLine.create({
        data: {
          workspaceId: input.workspaceId,
          settlementBatchId: batch.id,
          payoutLedgerId: payout.id,
          beneficiaryType: payout.beneficiaryType,
          beneficiaryLabel: payout.beneficiaryLabel,
          sourceType: payout.revenueAttributionLedger.sourceType,
          amountCents: payout.payableAmountCents,
          currency: payout.currency,
          status:
            payout.status === RevenueLedgerStatus.APPROVED
              ? SettlementLineStatus.APPROVED
              : SettlementLineStatus.PENDING,
          notes: payout.notes,
          reference: payout.revenueAttributionLedger.sourceReference ?? null,
          approvedAt: payout.status === RevenueLedgerStatus.APPROVED ? payout.approvedAt : null,
          beneficiaryPayoutProfileId: profileKey ? payoutProfileLookup.get(profileKey) ?? undefined : undefined,
        },
      });
    }

    return tx.settlementBatch.findUniqueOrThrow({
      where: { id: batch.id },
      include: {
        lines: {
          include: {
            payoutLedger: {
              include: {
                revenueAttributionLedger: true,
              },
            },
            beneficiaryPayoutProfile: true,
          },
          orderBy: [{ beneficiaryLabel: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  });
}

export async function approveSettlementBatch(input: {
  workspaceId: string;
  batchId: string;
  approvedAt?: Date;
  actorUserId?: string | null;
  actorType?: ActorType | null;
  english?: boolean;
}) {
  await assertWorkspaceReservedManualSettlementServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const approvedAt = input.approvedAt ?? new Date();
  const batch = await db.settlementBatch.findFirst({
    where: {
      id: input.batchId,
      workspaceId: input.workspaceId,
    },
    include: {
      lines: {
        include: {
          payoutLedger: true,
        },
      },
    },
  });

  if (!batch) {
    throw new Error("Settlement batch not found");
  }

  if (batch.status === SettlementBatchStatus.CLOSED) {
    throw new Error("Closed settlement batches cannot be approved again");
  }

  if (!canApproveSettlementBatch(batch.status)) {
    throw new Error("Only draft settlement batches can be approved");
  }

  return db.$transaction(async (tx) => {
    await tx.settlementBatch.update({
      where: { id: batch.id },
      data: {
        status: SettlementBatchStatus.APPROVED,
        approvedAt,
      },
    });

    for (const line of batch.lines) {
      if (line.status === SettlementLineStatus.PENDING) {
        await tx.settlementBatchLine.update({
          where: { id: line.id },
          data: {
            status: SettlementLineStatus.APPROVED,
            approvedAt,
          },
        });
      }

      if (line.payoutLedger.status === RevenueLedgerStatus.PENDING) {
        await tx.payoutLedger.update({
          where: { id: line.payoutLedgerId },
          data: {
            status: RevenueLedgerStatus.APPROVED,
            approvedAt,
          },
        });
      }
    }

    return tx.settlementBatch.findUniqueOrThrow({
      where: { id: batch.id },
      include: {
        lines: true,
      },
    });
  });
}

export async function markSettlementBatchExported(input: {
  workspaceId: string;
  batchId: string;
  exportedAt?: Date;
  actorUserId?: string | null;
  actorType?: ActorType | null;
  english?: boolean;
}) {
  await assertWorkspaceReservedManualSettlementServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const exportedAt = input.exportedAt ?? new Date();
  const batch = await db.settlementBatch.findFirst({
    where: {
      id: input.batchId,
      workspaceId: input.workspaceId,
    },
    include: {
      lines: {
        include: {
          payoutLedger: true,
        },
      },
    },
  });

  if (!batch) {
    throw new Error("Settlement batch not found");
  }

  if (batch.status === SettlementBatchStatus.CLOSED) {
    throw new Error("Closed settlement batches cannot be exported");
  }

  if (batch.status === SettlementBatchStatus.DRAFT) {
    throw new Error("Settlement batch must be approved before export");
  }

  if (!canExportSettlementBatch(batch.status)) {
    throw new Error("Settlement batch is already exported");
  }

  return db.$transaction(async (tx) => {
    await tx.settlementBatch.update({
      where: { id: batch.id },
      data: {
        status: SettlementBatchStatus.EXPORTED,
        exportedAt,
      },
    });

    for (const line of batch.lines) {
      if (line.status === SettlementLineStatus.PAID || line.status === SettlementLineStatus.REVERSED) {
        continue;
      }

      await tx.settlementBatchLine.update({
        where: { id: line.id },
        data: {
          status: SettlementLineStatus.EXPORTED,
          exportedAt,
        },
      });

      await tx.payoutLedger.update({
        where: { id: line.payoutLedgerId },
        data: {
          notes: appendSettlementNote(
            line.payoutLedger.notes,
            `Exported in settlement batch ${batch.batchKey} at ${exportedAt.toISOString()}`,
          ),
        },
      });
    }

    return tx.settlementBatch.findUniqueOrThrow({
      where: { id: batch.id },
      include: {
        lines: true,
      },
    });
  });
}

export async function markSettlementBatchLinePaid(input: {
  workspaceId: string;
  lineId: string;
  paidAt?: Date;
  notes?: string | null;
  actorUserId?: string | null;
  actorType?: ActorType | null;
  english?: boolean;
}) {
  await assertWorkspaceReservedManualSettlementServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const paidAt = input.paidAt ?? new Date();
  const line = await db.settlementBatchLine.findFirst({
    where: {
      id: input.lineId,
      workspaceId: input.workspaceId,
    },
    include: {
      payoutLedger: true,
    },
  });

  if (!line) {
    throw new Error("Settlement batch line not found");
  }

  if (line.status === SettlementLineStatus.PAID) {
    throw new Error("Settlement batch line is already marked paid");
  }

  if (line.status === SettlementLineStatus.REVERSED) {
    throw new Error("Reversed settlement lines cannot be marked paid");
  }

  if (!canMarkSettlementLinePaid(line.status)) {
    throw new Error("Only exported settlement lines can be marked paid");
  }

  return db.$transaction(async (tx) => {
    await tx.settlementBatchLine.update({
      where: { id: line.id },
      data: {
        status: SettlementLineStatus.PAID,
        paidAt,
        notes: input.notes ?? line.notes,
      },
    });

    await tx.payoutLedger.update({
      where: { id: line.payoutLedgerId },
      data: {
        status: RevenueLedgerStatus.PAID,
        paidAt,
        notes: input.notes ?? line.payoutLedger.notes,
      },
    });
  });
}

export async function reverseSettlementBatchLine(input: {
  workspaceId: string;
  lineId: string;
  reason: string;
  reversedAt?: Date;
  actorUserId?: string | null;
  actorType?: ActorType | null;
  english?: boolean;
}) {
  await assertWorkspaceReservedManualSettlementServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const reversedAt = input.reversedAt ?? new Date();
  const line = await db.settlementBatchLine.findFirst({
    where: {
      id: input.lineId,
      workspaceId: input.workspaceId,
    },
    include: {
      payoutLedger: true,
    },
  });

  if (!line) {
    throw new Error("Settlement batch line not found");
  }

  if (!canReverseSettlementLine(line.status)) {
    if (line.status === SettlementLineStatus.REVERSED) {
      throw new Error("Settlement batch line is already reversed");
    }

    throw new Error("Only exported or paid settlement lines can be reversed");
  }

  if (line.payoutLedger.status !== RevenueLedgerStatus.REVERSED) {
    await reverseRevenueAttributionEntry({
      attributionId: line.payoutLedger.revenueAttributionLedgerId,
      reason: input.reason,
      reversedAt,
      governance: {
        userId: input.actorUserId,
        actorType: input.actorType,
        english: input.english,
      },
    });
  }

  return db.settlementBatchLine.update({
    where: { id: line.id },
    data: {
      status: SettlementLineStatus.REVERSED,
      reversedAt,
      notes: appendSettlementNote(line.notes, input.reason),
    },
  });
}

export async function closeSettlementBatch(input: {
  workspaceId: string;
  batchId: string;
  closedAt?: Date;
  actorUserId?: string | null;
  actorType?: ActorType | null;
  english?: boolean;
}) {
  await assertWorkspaceReservedManualSettlementServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const closedAt = input.closedAt ?? new Date();
  const batch = await db.settlementBatch.findFirst({
    where: {
      id: input.batchId,
      workspaceId: input.workspaceId,
    },
    include: {
      lines: true,
    },
  });

  if (!batch) {
    throw new Error("Settlement batch not found");
  }

  if (batch.status === SettlementBatchStatus.CLOSED) {
    throw new Error("Settlement batch is already closed");
  }

  if (batch.status !== SettlementBatchStatus.EXPORTED) {
    throw new Error("Only exported settlement batches can be closed");
  }

  if (
    !canCloseSettlementBatch({
      status: batch.status,
      lineStatuses: batch.lines.map((line) => line.status),
    })
  ) {
    throw new Error("Only fully settled or reversed exported batches can be closed");
  }

  return db.settlementBatch.update({
    where: { id: batch.id },
    data: {
      status: SettlementBatchStatus.CLOSED,
      closedAt,
    },
  });
}

export async function getWorkspaceManualSettlementSnapshot(workspaceId: string) {
  await ensureWorkspaceManualSettlementFoundation(workspaceId);

  const [payoutProfiles, settlementBatches] = await Promise.all([
    db.beneficiaryPayoutProfile.findMany({
      where: { workspaceId },
      orderBy: [{ status: "asc" }, { beneficiaryType: "asc" }, { displayName: "asc" }],
    }),
    db.settlementBatch.findMany({
      where: { workspaceId },
      include: {
        lines: {
          include: {
            payoutLedger: {
              include: {
                revenueAttributionLedger: true,
              },
            },
            beneficiaryPayoutProfile: true,
          },
          orderBy: [{ status: "asc" }, { beneficiaryLabel: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 6,
    }),
  ]);

  const currentBatch =
    settlementBatches.find((batch) => batch.status !== SettlementBatchStatus.CLOSED) ?? settlementBatches[0] ?? null;

  return {
    payoutProfiles,
    settlementBatches,
    currentBatch,
  };
}
