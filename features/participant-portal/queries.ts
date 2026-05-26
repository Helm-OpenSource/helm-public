import { ParticipantPortalAccessStatus, RevenueBeneficiaryType, RevenueLedgerStatus, RevenueSourceType } from "@prisma/client";
import {
  buildParticipantPortalInviteExpiresAt,
  resolvePreferredParticipantAccess,
} from "@/lib/auth/participant-portal";
import {
  type ParticipantPortalInviteState,
  resolveParticipantPortalInviteState,
} from "@/lib/auth/participant-portal-invite-state";
import { db } from "@/lib/db";
import { isOperationalHelmReservedWorkspace } from "@/lib/workspace-reserved";

async function getParticipantPortalInviteAccessByToken(tokenHash: string) {
  return db.participantPortalAccess.findUnique({
    where: { inviteTokenHash: tokenHash },
    include: {
      workspace: true,
      workerPublisherProfile: true,
      salesReferral: true,
      customEngagement: true,
    },
  });
}

type ParticipantPortalInviteAccess = NonNullable<
  Awaited<ReturnType<typeof getParticipantPortalInviteAccessByToken>>
>;
type ParticipantPortalInvitePayoutProfile = Awaited<
  ReturnType<typeof db.beneficiaryPayoutProfile.findUnique>
>;
type ParticipantPortalInviteParticipantClassLabel = ReturnType<
  typeof resolveParticipantClassLabel
>;

export type ParticipantPortalInvitePreview =
  | {
      state: Exclude<ParticipantPortalInviteState, "usable">;
      inviteExpiresAt: Date | null;
    }
  | {
      state: "usable";
      access: ParticipantPortalInviteAccess;
      payoutProfile: ParticipantPortalInvitePayoutProfile;
      inviteExpiresAt: Date;
      participantClassLabel: ParticipantPortalInviteParticipantClassLabel;
    };
export type ParticipantPortalData = Awaited<ReturnType<typeof getParticipantPortalData>>;

function buildParticipantAccessWhere(access: {
  beneficiaryType: RevenueBeneficiaryType;
  workerPublisherProfileId: string | null;
  salesReferralId: string | null;
  customEngagementId: string | null;
}) {
  if (access.beneficiaryType === RevenueBeneficiaryType.WORKER_PUBLISHER && access.workerPublisherProfileId) {
    return { workerPublisherProfileId: access.workerPublisherProfileId };
  }

  if (access.beneficiaryType === RevenueBeneficiaryType.SALES_REFERRAL && access.salesReferralId) {
    return { salesReferralId: access.salesReferralId };
  }

  if (access.beneficiaryType === RevenueBeneficiaryType.CUSTOM_SERVICES && access.customEngagementId) {
    return { customEngagementId: access.customEngagementId };
  }

  return null;
}

function resolveParticipantClassLabel(beneficiaryType: RevenueBeneficiaryType) {
  if (beneficiaryType === RevenueBeneficiaryType.WORKER_PUBLISHER) {
    return { zh: "能力贡献方", en: "Worker contributor" };
  }

  if (beneficiaryType === RevenueBeneficiaryType.SALES_REFERRAL) {
    return { zh: "销售转介绍方", en: "Sales referrer" };
  }

  return { zh: "定制交付伙伴", en: "Custom partner" };
}

function buildPortalStatusBreakdown(input: {
  payoutEntries: Array<{
    id: string;
    payableAmountCents: number;
    status: RevenueLedgerStatus;
  }>;
  settlementLines: Array<{
    payoutLedgerId: string;
    amountCents: number;
    status: "PENDING" | "APPROVED" | "EXPORTED" | "PAID" | "REVERSED";
  }>;
}) {
  const settlementLineMap = new Map(input.settlementLines.map((line) => [line.payoutLedgerId, line]));
  const summary = {
    pendingCount: 0,
    approvedCount: 0,
    exportedCount: 0,
    paidCount: 0,
    reversedCount: 0,
    pendingAmountCents: 0,
    approvedAmountCents: 0,
    exportedAmountCents: 0,
    paidAmountCents: 0,
    reversedAmountCents: 0,
  };

  for (const payout of input.payoutEntries) {
    const settlementLine = settlementLineMap.get(payout.id);
    const amount = settlementLine?.amountCents ?? payout.payableAmountCents;
    const status =
      settlementLine?.status ??
      (payout.status === RevenueLedgerStatus.PENDING
        ? "PENDING"
        : payout.status === RevenueLedgerStatus.APPROVED
          ? "APPROVED"
          : payout.status === RevenueLedgerStatus.PAID
            ? "PAID"
            : "REVERSED");

    if (status === "PENDING") {
      summary.pendingCount += 1;
      summary.pendingAmountCents += amount;
    } else if (status === "APPROVED") {
      summary.approvedCount += 1;
      summary.approvedAmountCents += amount;
    } else if (status === "EXPORTED") {
      summary.exportedCount += 1;
      summary.exportedAmountCents += amount;
    } else if (status === "PAID") {
      summary.paidCount += 1;
      summary.paidAmountCents += amount;
    } else {
      summary.reversedCount += 1;
      summary.reversedAmountCents += amount;
    }
  }

  return summary;
}

export async function getParticipantPortalInvitePreview(
  token: string,
): Promise<ParticipantPortalInvitePreview> {
  const { hashParticipantPortalToken } = await import("@/lib/auth/participant-portal");
  const tokenHash = hashParticipantPortalToken(token);

  const access = await getParticipantPortalInviteAccessByToken(tokenHash);

  const inviteState = resolveParticipantPortalInviteState({
    access,
    workspaceAllowed: access ? isOperationalHelmReservedWorkspace(access.workspace) : false,
  });

  if (inviteState !== "usable") {
    return {
      state: inviteState,
      inviteExpiresAt:
        access && inviteState === "expired"
          ? buildParticipantPortalInviteExpiresAt(access.lastInviteIssuedAt)
          : null,
    } as const;
  }

  if (!access) {
    throw new Error("Participant portal invite resolved to usable without an access record");
  }

  const payoutProfile = await db.beneficiaryPayoutProfile.findUnique({
    where: {
      workspaceId_beneficiaryType_beneficiaryReference: {
        workspaceId: access.workspaceId,
        beneficiaryType: access.beneficiaryType,
        beneficiaryReference: access.beneficiaryReference,
      },
    },
  });

  return {
    state: "usable",
    access,
    payoutProfile,
    inviteExpiresAt: buildParticipantPortalInviteExpiresAt(access.lastInviteIssuedAt),
    participantClassLabel: resolveParticipantClassLabel(access.beneficiaryType),
  } as const;
}

export async function getParticipantPortalData(input: {
  userId: string;
  selectedAccessId?: string;
}) {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    return null;
  }

  const accesses = await db.participantPortalAccess.findMany({
    where: {
      userId: input.userId,
      status: {
        in: [
          ParticipantPortalAccessStatus.ACTIVE,
          ParticipantPortalAccessStatus.INVITED,
          ParticipantPortalAccessStatus.SUSPENDED,
          ParticipantPortalAccessStatus.ARCHIVED,
        ],
      },
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          defaultLocale: true,
          status: true,
          workspaceClass: true,
          systemKey: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  const reservedAccesses = accesses.filter((access) =>
    isOperationalHelmReservedWorkspace(access.workspace),
  );

  const currentAccess = resolvePreferredParticipantAccess(reservedAccesses, input.selectedAccessId);

  if (!currentAccess) {
    return {
      user,
      accesses: reservedAccesses,
      currentAccess: null,
      payoutProfile: null,
      attributedRevenueSummary: {
        lineCount: 0,
        totalAmountCents: 0,
      },
      payoutSummary: {
        totalAmountCents: 0,
      },
      statusBreakdown: buildPortalStatusBreakdown({ payoutEntries: [], settlementLines: [] }),
      sourceBreakdown: [] as Array<{
        sourceType: RevenueSourceType;
        lineCount: number;
        totalAmountCents: number;
      }>,
      attributionEntries: [],
      payoutEntries: [],
    };
  }

  const payoutProfile = await db.beneficiaryPayoutProfile.findUnique({
    where: {
      workspaceId_beneficiaryType_beneficiaryReference: {
        workspaceId: currentAccess.workspaceId,
        beneficiaryType: currentAccess.beneficiaryType,
        beneficiaryReference: currentAccess.beneficiaryReference,
      },
    },
  });

  const accessWhere = buildParticipantAccessWhere(currentAccess);

  if (!accessWhere) {
    return {
      user,
      accesses: reservedAccesses,
      currentAccess: {
        ...currentAccess,
        participantClassLabel: resolveParticipantClassLabel(currentAccess.beneficiaryType),
      },
      payoutProfile,
      attributedRevenueSummary: {
        lineCount: 0,
        totalAmountCents: 0,
      },
      payoutSummary: {
        totalAmountCents: 0,
      },
      statusBreakdown: buildPortalStatusBreakdown({ payoutEntries: [], settlementLines: [] }),
      sourceBreakdown: [] as Array<{
        sourceType: RevenueSourceType;
        lineCount: number;
        totalAmountCents: number;
      }>,
      attributionEntries: [],
      payoutEntries: [],
    };
  }

  const [attributionEntries, payoutEntries] = await Promise.all([
    db.revenueAttributionLedger.findMany({
      where: {
        workspaceId: currentAccess.workspaceId,
        ...accessWhere,
      },
      select: {
        id: true,
        sourceType: true,
        sourceLabel: true,
        sourceReference: true,
        grossAmountCents: true,
        attributedAmountCents: true,
        currency: true,
        status: true,
        recognizedAt: true,
        reversalReason: true,
      },
      orderBy: [{ recognizedAt: "desc" }, { createdAt: "desc" }],
    }),
    db.payoutLedger.findMany({
      where: {
        workspaceId: currentAccess.workspaceId,
        ...accessWhere,
      },
      select: {
        id: true,
        payableAmountCents: true,
        currency: true,
        status: true,
        payableAfter: true,
        approvedAt: true,
        paidAt: true,
        reversedAt: true,
        notes: true,
        revenueAttributionLedger: {
          select: {
            sourceType: true,
            sourceLabel: true,
            sourceReference: true,
          },
        },
      },
      orderBy: [{ payableAfter: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const settlementLines = payoutEntries.length
    ? await db.settlementBatchLine.findMany({
        where: {
          workspaceId: currentAccess.workspaceId,
          payoutLedgerId: {
            in: payoutEntries.map((entry) => entry.id),
          },
        },
        select: {
          payoutLedgerId: true,
          amountCents: true,
          status: true,
          settlementBatch: {
            select: {
              batchKey: true,
              periodLabel: true,
            },
          },
        },
      })
    : [];

  const attributedRevenueSummary = {
    lineCount: attributionEntries.length,
    totalAmountCents: attributionEntries.reduce((sum, entry) => sum + entry.attributedAmountCents, 0),
  };

  const payoutSummary = {
    totalAmountCents: payoutEntries.reduce((sum, entry) => sum + entry.payableAmountCents, 0),
  };

  const statusBreakdown = buildPortalStatusBreakdown({ payoutEntries, settlementLines });
  const sourceBreakdown = Object.values(
    attributionEntries.reduce<Record<string, { sourceType: RevenueSourceType; lineCount: number; totalAmountCents: number }>>(
      (acc, entry) => {
        const current = acc[entry.sourceType] ?? {
          sourceType: entry.sourceType,
          lineCount: 0,
          totalAmountCents: 0,
        };
        current.lineCount += 1;
        current.totalAmountCents += entry.attributedAmountCents;
        acc[entry.sourceType] = current;
        return acc;
      },
      {},
    ),
  );

  return {
    user,
    accesses: reservedAccesses,
    currentAccess: {
      ...currentAccess,
      participantClassLabel: resolveParticipantClassLabel(currentAccess.beneficiaryType),
    },
    payoutProfile,
    attributedRevenueSummary,
    payoutSummary,
    statusBreakdown,
    sourceBreakdown,
    attributionEntries,
    payoutEntries: payoutEntries.map((entry) => ({
      ...entry,
      settlementLine: settlementLines.find((line) => line.payoutLedgerId === entry.id) ?? null,
    })),
  };
}
