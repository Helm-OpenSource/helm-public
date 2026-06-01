import { ActorType, ParticipantPortalAccessStatus, Prisma, RevenueBeneficiaryType } from "@prisma/client";
import { normalizeEmailAddress } from "@/lib/auth/formal-auth";
import {
  beneficiarySupportsParticipantPortal,
  generateParticipantPortalToken,
  hashParticipantPortalToken,
} from "@/lib/auth/participant-portal";
import {
  getParticipantPortalInviteIssuanceDeniedMessage,
  getParticipantPortalInviteStateCopy,
  resolveParticipantPortalInviteIssuanceState,
  resolveParticipantPortalInviteState,
} from "@/lib/auth/participant-portal-invite-state";
import { assertWorkspaceReservedParticipantPortalServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { isOperationalHelmReservedWorkspace } from "@/lib/workspace-reserved";

type ResolveParticipantBeneficiaryInput = {
  workspaceId: string;
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryId: string;
};

export async function resolveParticipantBeneficiaryRecord(
  input: ResolveParticipantBeneficiaryInput,
) {
  if (!beneficiarySupportsParticipantPortal(input.beneficiaryType)) {
    throw new Error("Unsupported participant beneficiary type");
  }

  if (input.beneficiaryType === RevenueBeneficiaryType.WORKER_PUBLISHER) {
    const record = await db.workerPublisherProfile.findFirst({
      where: {
        id: input.beneficiaryId,
        workspaceId: input.workspaceId,
      },
    });

    if (!record) {
      throw new Error("Worker publisher profile not found");
    }

    return {
      beneficiaryReference: record.publisherKey,
      workerPublisherProfileId: record.id,
      salesReferralId: null,
      customEngagementId: null,
      defaultDisplayName: record.displayName,
      defaultContact: record.contactEmail ?? null,
    };
  }

  if (input.beneficiaryType === RevenueBeneficiaryType.SALES_REFERRAL) {
    const record = await db.salesReferral.findFirst({
      where: {
        id: input.beneficiaryId,
        workspaceId: input.workspaceId,
      },
    });

    if (!record) {
      throw new Error("Sales referral not found");
    }

    return {
      beneficiaryReference: record.referralKey,
      workerPublisherProfileId: null,
      salesReferralId: record.id,
      customEngagementId: null,
      defaultDisplayName: record.beneficiaryLabel,
      defaultContact: record.beneficiaryContact ?? null,
    };
  }

  const record = await db.customEngagement.findFirst({
    where: {
      id: input.beneficiaryId,
      workspaceId: input.workspaceId,
    },
  });

  if (!record) {
    throw new Error("Custom engagement not found");
  }

  return {
    beneficiaryReference: record.engagementKey,
    workerPublisherProfileId: null,
    salesReferralId: null,
    customEngagementId: record.id,
    defaultDisplayName: record.beneficiaryLabel,
    defaultContact: null,
  };
}

export async function issueParticipantPortalInvite(input: {
  workspaceId: string;
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryId: string;
  inviteEmail: string;
  displayName?: string | null;
  notes?: string | null;
  now?: Date;
  governance?: {
    userId?: string | null;
    actorType?: ActorType | null;
    english?: boolean;
  };
}) {
  await assertWorkspaceReservedParticipantPortalServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.governance?.userId,
    actorType: input.governance?.actorType,
    english: input.governance?.english ?? false,
  });

  const beneficiary = await resolveParticipantBeneficiaryRecord({
    workspaceId: input.workspaceId,
    beneficiaryType: input.beneficiaryType,
    beneficiaryId: input.beneficiaryId,
  });
  const inviteToken = generateParticipantPortalToken();
  const inviteTokenHash = hashParticipantPortalToken(inviteToken);
  const inviteEmail = normalizeEmailAddress(input.inviteEmail);
  const now = input.now ?? new Date();
  const uniqueParticipantPortalAccessWhere = {
    workspaceId_beneficiaryType_beneficiaryReference: {
      workspaceId: input.workspaceId,
      beneficiaryType: input.beneficiaryType,
      beneficiaryReference: beneficiary.beneficiaryReference,
    },
  } as const;
  const existingAccess = await db.participantPortalAccess.findUnique({
    where: uniqueParticipantPortalAccessWhere,
  });
  const issuanceState = resolveParticipantPortalInviteIssuanceState({
    access: existingAccess,
  });

  if (
    issuanceState === "blocked_active_access" ||
    issuanceState === "blocked_suspended_access"
  ) {
    throw new Error(
      getParticipantPortalInviteIssuanceDeniedMessage(
        issuanceState,
        input.governance?.english ?? false,
      ),
    );
  }

  const displayName = input.displayName?.trim() || beneficiary.defaultDisplayName;
  const normalizedNotes = input.notes?.trim() || undefined;
  const reissuePatch = {
    inviteEmail,
    displayName,
    contact: beneficiary.defaultContact,
    inviteTokenHash,
    lastInviteIssuedAt: now,
    notes: normalizedNotes,
    workerPublisherProfileId: beneficiary.workerPublisherProfileId,
    salesReferralId: beneficiary.salesReferralId,
    customEngagementId: beneficiary.customEngagementId,
    status: ParticipantPortalAccessStatus.INVITED,
    userId: null,
    termsAcceptedAt: null,
    activatedAt: null,
    suspendedAt: null,
    archivedAt: null,
  } satisfies Prisma.ParticipantPortalAccessUncheckedUpdateInput;

  const createData = {
    workspaceId: input.workspaceId,
    beneficiaryType: input.beneficiaryType,
    beneficiaryReference: beneficiary.beneficiaryReference,
    inviteEmail,
    displayName,
    contact: beneficiary.defaultContact,
    inviteTokenHash,
    lastInviteIssuedAt: now,
    notes: normalizedNotes ?? null,
    workerPublisherProfileId: beneficiary.workerPublisherProfileId,
    salesReferralId: beneficiary.salesReferralId,
    customEngagementId: beneficiary.customEngagementId,
  } satisfies Prisma.ParticipantPortalAccessUncheckedCreateInput;

  let access;
  if (!existingAccess) {
    try {
      access = await db.participantPortalAccess.create({
        data: createData,
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }

      const concurrentAccess = await db.participantPortalAccess.findUnique({
        where: uniqueParticipantPortalAccessWhere,
      });
      const concurrentIssuanceState = resolveParticipantPortalInviteIssuanceState({
        access: concurrentAccess,
      });

      if (
        concurrentIssuanceState === "blocked_active_access" ||
        concurrentIssuanceState === "blocked_suspended_access"
      ) {
        throw new Error(
          getParticipantPortalInviteIssuanceDeniedMessage(
            concurrentIssuanceState,
            input.governance?.english ?? false,
          ),
        );
      }

      if (!concurrentAccess) {
        throw error;
      }

      access = await db.participantPortalAccess.update({
        where: { id: concurrentAccess.id },
        data: reissuePatch,
      });
    }
  } else {
    access = await db.participantPortalAccess.update({
      where: { id: existingAccess.id },
      data: reissuePatch,
    });
  }

  return {
    access,
    inviteToken,
    issuanceState,
  };
}

function resolveStatusTimestampPatch(status: ParticipantPortalAccessStatus, now: Date) {
  return {
    activatedAt: status === ParticipantPortalAccessStatus.ACTIVE ? now : undefined,
    suspendedAt: status === ParticipantPortalAccessStatus.SUSPENDED ? now : undefined,
    archivedAt: status === ParticipantPortalAccessStatus.ARCHIVED ? now : undefined,
  };
}

export async function updateParticipantPortalAccessStatusRecord(input: {
  workspaceId: string;
  accessId: string;
  status: ParticipantPortalAccessStatus;
  now?: Date;
  governance?: {
    userId?: string | null;
    actorType?: ActorType | null;
    english?: boolean;
  };
}) {
  await assertWorkspaceReservedParticipantPortalServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.governance?.userId,
    actorType: input.governance?.actorType,
    english: input.governance?.english ?? false,
  });

  const access = await db.participantPortalAccess.findFirst({
    where: {
      id: input.accessId,
      workspaceId: input.workspaceId,
    },
  });

  if (!access) {
    throw new Error("Participant access not found");
  }

  const now = input.now ?? new Date();
  return db.participantPortalAccess.update({
    where: { id: access.id },
    data: {
      status: input.status,
      ...resolveStatusTimestampPatch(input.status, now),
    },
  });
}

export async function completeParticipantPortalOnboardingRecord(input: {
  token: string;
  displayName: string;
  legalName?: string | null;
  contact?: string | null;
  payoutMethodLabel: string;
  payoutDetailsReference?: string | null;
  invoiceRequired: boolean;
  notes?: string | null;
  now?: Date;
  english: boolean;
}) {
  const access = await db.participantPortalAccess.findUnique({
    where: {
      inviteTokenHash: hashParticipantPortalToken(input.token),
    },
    include: {
      workspace: true,
    },
  });

  if (!access) {
    throw new Error("Participant portal invitation not found");
  }

  await assertWorkspaceReservedParticipantPortalServiceAccess({
    workspaceId: access.workspaceId,
    english: input.english,
  });

  const now = input.now ?? new Date();
  const inviteState = resolveParticipantPortalInviteState({
    access,
    workspaceAllowed: isOperationalHelmReservedWorkspace(access.workspace),
    now,
  });

  if (inviteState !== "usable") {
    throw new Error(getParticipantPortalInviteStateCopy(inviteState, input.english).errorMessage);
  }

  const normalizedInviteEmail = normalizeEmailAddress(access.inviteEmail);
  const user =
    (await db.user.findUnique({
      where: { email: normalizedInviteEmail },
    })) ??
    (await db.user.create({
      data: {
        email: normalizedInviteEmail,
        name: input.displayName,
      },
    }));

  await db.user.update({
    where: { id: user.id },
    data: {
      name: input.displayName,
      lastLoginAt: now,
    },
  });

  const updatedAccess = await db.participantPortalAccess.update({
    where: { id: access.id },
    data: {
      userId: user.id,
      displayName: input.displayName,
      contact: input.contact ?? access.contact,
      termsAcceptedAt: access.termsAcceptedAt ?? now,
      status: ParticipantPortalAccessStatus.ACTIVE,
      activatedAt: access.activatedAt ?? now,
    },
  });

  await db.beneficiaryPayoutProfile.upsert({
    where: {
      workspaceId_beneficiaryType_beneficiaryReference: {
        workspaceId: access.workspaceId,
        beneficiaryType: access.beneficiaryType,
        beneficiaryReference: access.beneficiaryReference,
      },
    },
    update: {
      displayName: input.displayName,
      legalName: input.legalName,
      contact: input.contact,
      payoutMethodLabel: input.payoutMethodLabel,
      payoutDetailsReference: input.payoutDetailsReference,
      invoiceRequired: input.invoiceRequired,
      notes: input.notes,
    },
    create: {
      workspaceId: access.workspaceId,
      beneficiaryType: access.beneficiaryType,
      beneficiaryReference: access.beneficiaryReference,
      displayName: input.displayName,
      legalName: input.legalName,
      contact: input.contact,
      payoutMethodLabel: input.payoutMethodLabel,
      payoutDetailsReference: input.payoutDetailsReference,
      invoiceRequired: input.invoiceRequired,
      notes: input.notes,
      workerPublisherProfileId: access.workerPublisherProfileId,
      salesReferralId: access.salesReferralId,
      customEngagementId: access.customEngagementId,
    },
  });

  return {
    access: updatedAccess,
    user,
    normalizedInviteEmail,
  };
}

export async function updateParticipantPortalProfileRecord(input: {
  accessId: string;
  currentUserId: string;
  displayName: string;
  legalName?: string | null;
  contact?: string | null;
  payoutMethodLabel: string;
  payoutDetailsReference?: string | null;
  invoiceRequired: boolean;
  notes?: string | null;
  english: boolean;
}) {
  const access = await db.participantPortalAccess.findFirst({
    where: {
      id: input.accessId,
      userId: input.currentUserId,
    },
    include: {
      workspace: true,
    },
  });

  if (!access) {
    throw new Error("Participant access not found");
  }

  await assertWorkspaceReservedParticipantPortalServiceAccess({
    workspaceId: access.workspaceId,
    english: input.english,
  });

  await db.user.update({
    where: { id: input.currentUserId },
    data: {
      name: input.displayName,
    },
  });

  const updatedAccess = await db.participantPortalAccess.update({
    where: { id: access.id },
    data: {
      displayName: input.displayName,
      contact: input.contact ?? null,
    },
  });

  await db.beneficiaryPayoutProfile.upsert({
    where: {
      workspaceId_beneficiaryType_beneficiaryReference: {
        workspaceId: access.workspaceId,
        beneficiaryType: access.beneficiaryType,
        beneficiaryReference: access.beneficiaryReference,
      },
    },
    update: {
      displayName: input.displayName,
      legalName: input.legalName,
      contact: input.contact,
      payoutMethodLabel: input.payoutMethodLabel,
      payoutDetailsReference: input.payoutDetailsReference,
      invoiceRequired: input.invoiceRequired,
      notes: input.notes,
    },
    create: {
      workspaceId: access.workspaceId,
      beneficiaryType: access.beneficiaryType,
      beneficiaryReference: access.beneficiaryReference,
      displayName: input.displayName,
      legalName: input.legalName,
      contact: input.contact,
      payoutMethodLabel: input.payoutMethodLabel,
      payoutDetailsReference: input.payoutDetailsReference,
      invoiceRequired: input.invoiceRequired,
      notes: input.notes,
      workerPublisherProfileId: access.workerPublisherProfileId,
      salesReferralId: access.salesReferralId,
      customEngagementId: access.customEngagementId,
    },
  });

  return updatedAccess;
}
