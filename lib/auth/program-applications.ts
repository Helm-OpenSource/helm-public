import {
  ActorType,
  PartnerProgramStatus,
  ProgramApplicationStatus,
  ProgramTermsVersionStatus,
  RevenueBeneficiaryType,
} from "@prisma/client";
import { normalizeEmailAddress } from "@/lib/auth/formal-auth";
import { assertWorkspaceReservedProgramApplicationServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
export {
  canManageProgramApplications,
  getProgramApplicationManagementDeniedMessage,
} from "@/lib/auth/commercial-governance";

export const ACTIVE_PROGRAM_APPLICATION_STATUSES = [
  ProgramApplicationStatus.SUBMITTED,
  ProgramApplicationStatus.ACCEPTED,
  ProgramApplicationStatus.WAITLISTED,
  ProgramApplicationStatus.INVITED,
] as const;

export type ProgramApplicationLifecycleErrorCode =
  | "PROGRAM_NOT_FOUND"
  | "PROGRAM_TERMS_NOT_ACTIVE"
  | "PROGRAM_NOT_ACCEPTING_APPLICATIONS"
  | "ACTIVE_APPLICATION_EXISTS"
  | "APPLICATION_NOT_FOUND"
  | "REVIEW_WRITE_LOCKED_AFTER_INVITE"
  | "INVITE_REQUIRES_ACCEPTED_OR_INVITED_APPLICATION";

export class ProgramApplicationLifecycleError extends Error {
  code: ProgramApplicationLifecycleErrorCode;

  constructor(code: ProgramApplicationLifecycleErrorCode) {
    super(code);
    this.name = "ProgramApplicationLifecycleError";
    this.code = code;
  }
}

export function getProgramApplicationLifecycleDeniedMessage(
  code: ProgramApplicationLifecycleErrorCode,
  english: boolean,
) {
  switch (code) {
    case "PROGRAM_NOT_FOUND":
      return english ? "This program is no longer available." : "当前 program 已不可用。";
    case "PROGRAM_TERMS_NOT_ACTIVE":
      return english
        ? "Current program terms are not available for application yet."
        : "当前 program 条款版本尚未开放申请。";
    case "PROGRAM_NOT_ACCEPTING_APPLICATIONS":
      return english
        ? "This program is visible for reference, but new applications are paused right now."
        : "当前 program 仅供查看，新的申请入口已暂停。";
    case "ACTIVE_APPLICATION_EXISTS":
      return english
        ? "An active application already exists for this email and program."
        : "这个邮箱在当前 program 下已经有一条进行中的申请。";
    case "APPLICATION_NOT_FOUND":
      return english ? "Application not found." : "没有找到对应的申请。";
    case "REVIEW_WRITE_LOCKED_AFTER_INVITE":
      return english
        ? "Invite issuance owns the invited posture. Use invite or participant portal lifecycle actions instead of review writes."
        : "进入 invited 姿态后，后续应通过 invite issuance 或 participant portal 生命周期动作推进，而不是继续走审核写入。";
    case "INVITE_REQUIRES_ACCEPTED_OR_INVITED_APPLICATION":
      return english
        ? "Only accepted applications can enter invite issuance. Reissue stays available only after invite posture already exists."
        : "只有已接受的申请才能进入邀请发放；只有已经处于 invited 姿态的记录才允许重发邀请。";
  }
}

async function assertProgramApplicationSubmissionLifecycle(input: {
  workspaceId: string;
  partnerProgramId: string;
  programTermsVersionId: string;
  applicantEmail: string;
}) {
  const program = await db.partnerProgram.findFirst({
    where: {
      id: input.partnerProgramId,
      workspaceId: input.workspaceId,
    },
    select: {
      status: true,
      termsVersions: {
        where: {
          id: input.programTermsVersionId,
          status: ProgramTermsVersionStatus.ACTIVE,
        },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!program) {
    throw new ProgramApplicationLifecycleError("PROGRAM_NOT_FOUND");
  }

  if (program.status !== PartnerProgramStatus.ACTIVE) {
    throw new ProgramApplicationLifecycleError("PROGRAM_NOT_ACCEPTING_APPLICATIONS");
  }

  if (program.termsVersions.length === 0) {
    throw new ProgramApplicationLifecycleError("PROGRAM_TERMS_NOT_ACTIVE");
  }

  const applicantEmail = normalizeEmailAddress(input.applicantEmail);
  const existing = await db.programApplication.findFirst({
    where: {
      workspaceId: input.workspaceId,
      partnerProgramId: input.partnerProgramId,
      applicantEmail,
      status: {
        in: [...ACTIVE_PROGRAM_APPLICATION_STATUSES],
      },
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw new ProgramApplicationLifecycleError("ACTIVE_APPLICATION_EXISTS");
  }

  return {
    applicantEmail,
  };
}

export async function updateProgramApplicationReviewRecord(input: {
  workspaceId: string;
  applicationId: string;
  status: ProgramApplicationStatus;
  internalNotes?: string | null;
  recommendedBeneficiaryType?: RevenueBeneficiaryType | null;
  reviewedAt: Date;
  reviewedByUserId: string;
  governance?: {
    userId?: string | null;
    actorType?: ActorType | null;
    english?: boolean;
  };
}) {
  await assertWorkspaceReservedProgramApplicationServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.governance?.userId,
    actorType: input.governance?.actorType,
    english: input.governance?.english ?? false,
  });

  const current = await db.programApplication.findFirst({
    where: {
      id: input.applicationId,
      workspaceId: input.workspaceId,
    },
    select: {
      id: true,
      status: true,
      participantPortalAccessId: true,
    },
  });

  if (!current) {
    throw new ProgramApplicationLifecycleError("APPLICATION_NOT_FOUND");
  }

  if (
    current.status === ProgramApplicationStatus.INVITED ||
    current.participantPortalAccessId !== null
  ) {
    throw new ProgramApplicationLifecycleError("REVIEW_WRITE_LOCKED_AFTER_INVITE");
  }

  return db.programApplication.update({
    where: { id: current.id },
    data: {
      status: input.status,
      internalNotes: input.internalNotes,
      recommendedBeneficiaryType: input.recommendedBeneficiaryType,
      reviewedAt: input.status === ProgramApplicationStatus.SUBMITTED ? null : input.reviewedAt,
      invitedAt: input.status === ProgramApplicationStatus.SUBMITTED ? null : undefined,
      reviewedByUserId: input.status === ProgramApplicationStatus.SUBMITTED ? null : input.reviewedByUserId,
    },
  });
}

export async function submitProgramApplicationRecord(input: {
  workspaceId: string;
  partnerProgramId: string;
  programTermsVersionId: string;
  applicantName: string;
  applicantEmail: string;
  applicantOrganization?: string | null;
  roleTitle?: string | null;
  website?: string | null;
  regionLabel?: string | null;
  background?: string | null;
  contributionPlan?: string | null;
  termsAcceptedAt: Date;
  governance?: {
    userId?: string | null;
    actorType?: ActorType | null;
    english?: boolean;
  };
}) {
  await assertWorkspaceReservedProgramApplicationServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.governance?.userId,
    actorType: input.governance?.actorType,
    english: input.governance?.english ?? false,
  });

  const submission = await assertProgramApplicationSubmissionLifecycle({
    workspaceId: input.workspaceId,
    partnerProgramId: input.partnerProgramId,
    programTermsVersionId: input.programTermsVersionId,
    applicantEmail: input.applicantEmail,
  });

  return db.programApplication.create({
    data: {
      workspaceId: input.workspaceId,
      partnerProgramId: input.partnerProgramId,
      programTermsVersionId: input.programTermsVersionId,
      applicantName: input.applicantName,
      applicantEmail: submission.applicantEmail,
      applicantOrganization: input.applicantOrganization,
      roleTitle: input.roleTitle,
      website: input.website,
      regionLabel: input.regionLabel,
      background: input.background,
      contributionPlan: input.contributionPlan,
      termsAcceptedAt: input.termsAcceptedAt,
      status: ProgramApplicationStatus.SUBMITTED,
    },
  });
}

export async function recordProgramApplicationInvite(input: {
  workspaceId: string;
  applicationId: string;
  internalNotes?: string | null;
  recommendedBeneficiaryType: RevenueBeneficiaryType;
  participantPortalAccessId: string;
  invitedAt: Date;
  reviewedByUserId: string;
  workerPublisherProfileId?: string | null;
  salesReferralId?: string | null;
  customEngagementId?: string | null;
  governance?: {
    userId?: string | null;
    actorType?: ActorType | null;
    english?: boolean;
  };
}) {
  await assertWorkspaceReservedProgramApplicationServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.governance?.userId,
    actorType: input.governance?.actorType,
    english: input.governance?.english ?? false,
  });

  const current = await db.programApplication.findFirst({
    where: {
      id: input.applicationId,
      workspaceId: input.workspaceId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!current) {
    throw new ProgramApplicationLifecycleError("APPLICATION_NOT_FOUND");
  }

  if (
    current.status !== ProgramApplicationStatus.ACCEPTED &&
    current.status !== ProgramApplicationStatus.INVITED
  ) {
    throw new ProgramApplicationLifecycleError("INVITE_REQUIRES_ACCEPTED_OR_INVITED_APPLICATION");
  }

  return db.programApplication.update({
    where: { id: current.id },
    data: {
      status: ProgramApplicationStatus.INVITED,
      invitedAt: input.invitedAt,
      reviewedAt: input.invitedAt,
      reviewedByUserId: input.reviewedByUserId,
      internalNotes: input.internalNotes,
      recommendedBeneficiaryType: input.recommendedBeneficiaryType,
      participantPortalAccessId: input.participantPortalAccessId,
      workerPublisherProfileId: input.workerPublisherProfileId,
      salesReferralId: input.salesReferralId,
      customEngagementId: input.customEngagementId,
    },
  });
}
