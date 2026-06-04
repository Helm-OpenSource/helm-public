"use server";

import {
  ActorType,
  CustomEngagementType,
  ProgramApplicationStatus,
  PublisherProfileStatus,
  RevenueBeneficiaryType,
  SalesReferralStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { issueParticipantPortalInvite } from "@/lib/auth/participant-portal-access";
import { getCurrentMembership, getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { normalizeEmailAddress } from "@/lib/auth/formal-auth";
import {
  canManageProgramApplications,
  getProgramApplicationManagementDeniedMessage,
} from "@/lib/auth/commercial-governance";
import { buildProgramApplicationCapabilityDecisionTrace } from "@/lib/capability-decision-trace";
import {
  getProgramApplicationLifecycleDeniedMessage,
  ProgramApplicationLifecycleError,
  recordProgramApplicationInvite,
  submitProgramApplicationRecord,
  updateProgramApplicationReviewRecord,
} from "@/lib/auth/program-applications";
import { ensureWorkspaceManualSettlementFoundation } from "@/lib/billing/manual-settlement";
import { resolveUiLocale, supportedUiLocales } from "@/lib/i18n/config";
import { db } from "@/lib/db";
import {
  assertHelmReservedWorkspaceAccess,
  resolveHelmReservedWorkspace,
} from "@/lib/workspace-reserved";

const optionalTextField = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().max(max).optional());

const optionalWebsiteField = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol;
}, z.string().url().max(240).optional());

const submitProgramApplicationSchema = z.object({
  programId: z.string().min(1),
  termsVersionId: z.string().min(1),
  applicantName: z.string().trim().min(2).max(80),
  applicantEmail: z.string().email(),
  applicantOrganization: optionalTextField(120),
  roleTitle: optionalTextField(120),
  website: optionalWebsiteField,
  regionLabel: optionalTextField(80),
  background: optionalTextField(1000),
  contributionPlan: optionalTextField(1000),
  termsAccepted: z.boolean().refine((value) => value === true),
  locale: z.enum(supportedUiLocales).optional(),
});

const reviewProgramApplicationSchema = z.object({
  applicationId: z.string().min(1),
  status: z.enum(["SUBMITTED", "ACCEPTED", "REJECTED", "WAITLISTED", "INVITED"]),
  internalNotes: optionalTextField(480),
  recommendedBeneficiaryType: z
    .enum(["WORKER_PUBLISHER", "SALES_REFERRAL", "CUSTOM_SERVICES"])
    .nullable()
    .optional(),
  locale: z.enum(supportedUiLocales).optional(),
});

const issueProgramApplicationInviteSchema = z.object({
  applicationId: z.string().min(1),
  inviteEmail: z.string().email().optional(),
  displayName: optionalTextField(80),
  internalNotes: optionalTextField(480),
  recommendedBeneficiaryType: z
    .enum(["WORKER_PUBLISHER", "SALES_REFERRAL", "CUSTOM_SERVICES"])
    .nullable()
    .optional(),
  locale: z.enum(supportedUiLocales).optional(),
});

function buildApplicationRegistryKey(prefix: string, label: string, applicationId: string) {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || prefix;
  return `${prefix}_${base}_${applicationId.slice(-8)}`;
}

function buildApplicationRegistryNotes(input: {
  partnerProgramTitle: string;
  applicantEmail: string;
  applicantOrganization: string | null;
  roleTitle: string | null;
  regionLabel: string | null;
  background: string | null;
  contributionPlan: string | null;
}) {
  return [
    `Program application source: ${input.partnerProgramTitle}`,
    `Applicant email: ${input.applicantEmail}`,
    input.applicantOrganization ? `Organization: ${input.applicantOrganization}` : null,
    input.roleTitle ? `Role: ${input.roleTitle}` : null,
    input.regionLabel ? `Region: ${input.regionLabel}` : null,
    input.background ? `Background: ${input.background}` : null,
    input.contributionPlan ? `Contribution plan: ${input.contributionPlan}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function buildAbsolutePortalUrl(pathname: string) {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}${pathname}`;
}

async function ensureProgramApplicationBeneficiary(input: {
  workspaceId: string;
  application: {
    id: string;
    applicantName: string;
    applicantEmail: string;
    applicantOrganization: string | null;
    roleTitle: string | null;
    regionLabel: string | null;
    background: string | null;
    contributionPlan: string | null;
    partnerProgram: { title: string };
    workerPublisherProfileId: string | null;
    salesReferralId: string | null;
    customEngagementId: string | null;
  };
  recommendedBeneficiaryType: RevenueBeneficiaryType;
}) {
  const notes = buildApplicationRegistryNotes({
    partnerProgramTitle: input.application.partnerProgram.title,
    applicantEmail: input.application.applicantEmail,
    applicantOrganization: input.application.applicantOrganization,
    roleTitle: input.application.roleTitle,
    regionLabel: input.application.regionLabel,
    background: input.application.background,
    contributionPlan: input.application.contributionPlan,
  });

  if (input.recommendedBeneficiaryType === RevenueBeneficiaryType.WORKER_PUBLISHER) {
    if (input.application.workerPublisherProfileId) {
      return {
        beneficiaryId: input.application.workerPublisherProfileId,
        patch: {},
      };
    }

    const profile = await db.workerPublisherProfile.create({
      data: {
        workspaceId: input.workspaceId,
        publisherKey: buildApplicationRegistryKey(
          "publisher",
          input.application.applicantOrganization ?? input.application.applicantName,
          input.application.id,
        ),
        displayName: input.application.applicantOrganization ?? input.application.applicantName,
        contactEmail: input.application.applicantEmail,
        status: PublisherProfileStatus.ACTIVE,
        notes,
      },
      select: { id: true },
    });

    return {
      beneficiaryId: profile.id,
      patch: {
        workerPublisherProfileId: profile.id,
      },
    };
  }

  if (input.recommendedBeneficiaryType === RevenueBeneficiaryType.SALES_REFERRAL) {
    if (input.application.salesReferralId) {
      return {
        beneficiaryId: input.application.salesReferralId,
        patch: {},
      };
    }

    const referral = await db.salesReferral.create({
      data: {
        workspaceId: input.workspaceId,
        referralKey: buildApplicationRegistryKey(
          "referral",
          input.application.applicantName,
          input.application.id,
        ),
        beneficiaryLabel: input.application.applicantName,
        beneficiaryContact: input.application.applicantEmail,
        status: SalesReferralStatus.ACTIVE,
        notes,
      },
      select: { id: true },
    });

    return {
      beneficiaryId: referral.id,
      patch: {
        salesReferralId: referral.id,
      },
    };
  }

  if (input.application.customEngagementId) {
    return {
      beneficiaryId: input.application.customEngagementId,
      patch: {},
    };
  }

  const engagement = await db.customEngagement.create({
    data: {
      workspaceId: input.workspaceId,
      engagementKey: buildApplicationRegistryKey(
        "engagement",
        input.application.applicantOrganization ?? input.application.applicantName,
        input.application.id,
      ),
      engagementType: CustomEngagementType.IMPLEMENTATION,
      label: input.application.applicantOrganization ?? input.application.applicantName,
      beneficiaryLabel: input.application.applicantOrganization ?? input.application.applicantName,
      status: "ACTIVE",
      notes,
    },
    select: { id: true },
  });

  return {
    beneficiaryId: engagement.id,
    patch: {
      customEngagementId: engagement.id,
    },
  };
}

export async function submitProgramApplicationAction(
  input: z.infer<typeof submitProgramApplicationSchema>,
) {
  const locale = resolveUiLocale(input.locale);
  const english = locale === "en-US";
  const parsed = submitProgramApplicationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english
        ? "Please complete the application fields and confirm the current program terms."
        : "请完整填写申请资料，并确认当前 program 条款。",
    };
  }

  const program = await db.partnerProgram.findUnique({
    where: { id: parsed.data.programId },
    include: {
      termsVersions: {
        where: { id: parsed.data.termsVersionId },
        take: 1,
      },
    },
  });

  if (!program || program.termsVersions.length === 0) {
    return {
      ok: false,
      error: english ? "This program or terms version is no longer available." : "当前 program 或 terms 版本已不可用。",
    };
  }

  if (program.status !== "ACTIVE") {
    return {
      ok: false,
      error: getProgramApplicationLifecycleDeniedMessage(
        "PROGRAM_NOT_ACCEPTING_APPLICATIONS",
        english,
      ),
    };
  }

  const reservedWorkspace = await resolveHelmReservedWorkspace();
  if (!reservedWorkspace || program.workspaceId !== reservedWorkspace.id) {
    return {
      ok: false,
      error:
        english
          ? "This program is no longer available from the Helm reserved host workspace."
          : "当前 program 已不再从 Helm 自留 host workspace 对外开放。",
    };
  }

  const applicantEmail = normalizeEmailAddress(parsed.data.applicantEmail);

  let application;
  try {
    application = await submitProgramApplicationRecord({
      workspaceId: program.workspaceId,
      partnerProgramId: program.id,
      programTermsVersionId: parsed.data.termsVersionId,
      applicantName: parsed.data.applicantName,
      applicantEmail,
      applicantOrganization: parsed.data.applicantOrganization,
      roleTitle: parsed.data.roleTitle,
      website: parsed.data.website,
      regionLabel: parsed.data.regionLabel,
      background: parsed.data.background,
      contributionPlan: parsed.data.contributionPlan,
      termsAcceptedAt: new Date(),
      governance: {
        english,
      },
    });
  } catch (error) {
    if (error instanceof ProgramApplicationLifecycleError) {
      return {
        ok: false,
        error: getProgramApplicationLifecycleDeniedMessage(error.code, english),
      };
    }

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to submit the application."
            : "提交申请失败。",
    };
  }

  await logEvent({
    workspaceId: program.workspaceId,
    eventName: "program_application_submitted",
    eventCategory: "program_catalog",
    targetType: "ProgramApplication",
    targetId: application.id,
    metadata: {
      partnerProgramId: program.id,
      programKey: program.programKey,
      programType: program.programType,
    },
    sourcePage: `/programs/${program.slug}`,
  });

  await writeAuditLog({
    workspaceId: program.workspaceId,
    userId: null,
    actor: parsed.data.applicantName,
    actorType: ActorType.SYSTEM,
    actionType: "PROGRAM_APPLICATION_SUBMITTED",
    targetType: "ProgramApplication",
    targetId: application.id,
    summary: english
      ? `Program application submitted for ${program.title}`
      : `已提交 ${program.title} 的 program 申请`,
    payload: {
      partnerProgramId: program.id,
      partnerProgramSlug: program.slug,
      applicantEmail,
      status: application.status,
    },
    sourcePage: `/programs/${program.slug}`,
  });

  revalidatePath("/settings");
  revalidatePath("/programs");
  revalidatePath(`/programs/${program.slug}`);

  return {
    ok: true,
    applicationId: application.id,
  };
}

export async function reviewProgramApplicationAction(
  input: z.infer<typeof reviewProgramApplicationSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const locale = resolveUiLocale(input.locale);
  const english = locale === "en-US";
  const parsed = reviewProgramApplicationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Invalid application review payload." : "申请审核参数错误。",
    };
  }

  const capabilityDecisionTrace = buildProgramApplicationCapabilityDecisionTrace({
    actorUserId: user.id,
    workspace,
    membershipRole: membership.role,
    action: "review_application",
  });

  if (!canManageProgramApplications(membership.role)) {
    return {
      ok: false,
      error: getProgramApplicationManagementDeniedMessage(english),
      capabilityDecisionTrace,
    };
  }

  try {
    assertHelmReservedWorkspaceAccess(workspace, english, "program_applications");
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : getProgramApplicationManagementDeniedMessage(english),
      capabilityDecisionTrace,
    };
  }

  const application = await db.programApplication.findFirst({
    where: {
      id: parsed.data.applicationId,
      workspaceId: workspace.id,
    },
    include: {
      partnerProgram: true,
      programTermsVersion: true,
    },
  });

  if (!application) {
    return {
      ok: false,
      error: english ? "Application not found." : "没有找到对应的申请。",
      capabilityDecisionTrace,
    };
  }

  const now = new Date();
  const reviewedStatus = parsed.data.status;
  const recommendedBeneficiaryType =
    parsed.data.recommendedBeneficiaryType === null
      ? null
      : (parsed.data.recommendedBeneficiaryType as RevenueBeneficiaryType | undefined);

  if (reviewedStatus === ProgramApplicationStatus.INVITED) {
    return {
      ok: false,
      error: english
        ? "Use invite issuance to move an application into invited status."
        : "请通过邀请发放把申请推进到已邀请状态。",
      capabilityDecisionTrace,
    };
  }

  try {
    await updateProgramApplicationReviewRecord({
      workspaceId: workspace.id,
      applicationId: application.id,
      status: reviewedStatus,
      internalNotes: parsed.data.internalNotes,
      recommendedBeneficiaryType,
      reviewedAt: now,
      reviewedByUserId: user.id,
      governance: {
        userId: user.id,
        actorType: ActorType.USER,
        english,
      },
    });
  } catch (error) {
    if (error instanceof ProgramApplicationLifecycleError) {
      return {
        ok: false,
        error: getProgramApplicationLifecycleDeniedMessage(error.code, english),
        capabilityDecisionTrace,
      };
    }

    return {
      ok: false,
      error:
        error instanceof Error ? error.message : english ? "Failed to save the review." : "保存审核失败。",
      capabilityDecisionTrace,
    };
  }

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "PROGRAM_APPLICATION_REVIEWED",
    targetType: "ProgramApplication",
    targetId: application.id,
    summary: english
      ? `Reviewed ${application.partnerProgram.title} application from ${application.applicantName}`
      : `已审核 ${application.applicantName} 的 ${application.partnerProgram.title} 申请`,
    payload: {
      status: reviewedStatus,
      programKey: application.partnerProgram.programKey,
      termsVersion: application.programTermsVersion.versionKey,
      recommendedBeneficiaryType: recommendedBeneficiaryType ?? null,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");

  return {
    ok: true,
    capabilityDecisionTrace,
  };
}

export async function issueProgramApplicationInviteAction(
  input: z.infer<typeof issueProgramApplicationInviteSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const locale = resolveUiLocale(input.locale);
  const english = locale === "en-US";
  const parsed = issueProgramApplicationInviteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Invalid invite issuance payload." : "邀请发放参数错误。",
    };
  }

  const capabilityDecisionTrace = buildProgramApplicationCapabilityDecisionTrace({
    actorUserId: user.id,
    workspace,
    membershipRole: membership.role,
    action: "issue_invite",
  });

  if (!canManageProgramApplications(membership.role)) {
    return {
      ok: false,
      error: getProgramApplicationManagementDeniedMessage(english),
      capabilityDecisionTrace,
    };
  }

  try {
    assertHelmReservedWorkspaceAccess(workspace, english, "program_applications");
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : getProgramApplicationManagementDeniedMessage(english),
      capabilityDecisionTrace,
    };
  }

  await ensureWorkspaceManualSettlementFoundation(workspace.id);

  const application = await db.programApplication.findFirst({
    where: {
      id: parsed.data.applicationId,
      workspaceId: workspace.id,
    },
    include: {
      partnerProgram: true,
      participantPortalAccess: {
        select: {
          id: true,
          status: true,
          inviteEmail: true,
        },
      },
    },
  });

  if (!application) {
    return {
      ok: false,
      error: english ? "Application not found." : "没有找到对应的申请。",
      capabilityDecisionTrace,
    };
  }

  if (
    application.status !== ProgramApplicationStatus.ACCEPTED &&
    application.status !== ProgramApplicationStatus.INVITED
  ) {
    return {
      ok: false,
      error: english
        ? "Only accepted applications can move into invite issuance."
        : "只有已接受的申请才能进入邀请发放。",
      capabilityDecisionTrace,
    };
  }

  const recommendedBeneficiaryType =
    parsed.data.recommendedBeneficiaryType === "WORKER_PUBLISHER" ||
    parsed.data.recommendedBeneficiaryType === "SALES_REFERRAL" ||
    parsed.data.recommendedBeneficiaryType === "CUSTOM_SERVICES"
      ? (parsed.data.recommendedBeneficiaryType as RevenueBeneficiaryType)
      : application.recommendedBeneficiaryType === RevenueBeneficiaryType.WORKER_PUBLISHER ||
          application.recommendedBeneficiaryType === RevenueBeneficiaryType.SALES_REFERRAL ||
          application.recommendedBeneficiaryType === RevenueBeneficiaryType.CUSTOM_SERVICES
        ? application.recommendedBeneficiaryType
        : null;

  if (!recommendedBeneficiaryType) {
    return {
      ok: false,
      error: english
        ? "Set a recommended beneficiary line before issuing the invite."
        : "请先给申请设置推荐收益线，再发放邀请。",
      capabilityDecisionTrace,
    };
  }

  const { beneficiaryId, patch } = await ensureProgramApplicationBeneficiary({
    workspaceId: workspace.id,
    application,
    recommendedBeneficiaryType,
  });

  const inviteEmail = parsed.data.inviteEmail
    ? normalizeEmailAddress(parsed.data.inviteEmail)
    : application.applicantEmail;
  const inviteDisplayName = parsed.data.displayName ?? application.applicantName;
  const inviteNotes =
    parsed.data.internalNotes ??
    application.internalNotes ??
    (english
      ? `Invite issued from ${application.partnerProgram.title} application review queue.`
      : `这个邀请来自 ${application.partnerProgram.title} 的申请审核队列。`);
  const now = new Date();
  const { access, inviteToken, issuanceState } = await issueParticipantPortalInvite({
    workspaceId: workspace.id,
    beneficiaryType: recommendedBeneficiaryType,
    beneficiaryId,
    inviteEmail,
    displayName: inviteDisplayName,
    notes: inviteNotes,
    now,
    governance: {
      userId: user.id,
      actorType: ActorType.USER,
      english,
    },
  });

  try {
    await recordProgramApplicationInvite({
      workspaceId: workspace.id,
      applicationId: application.id,
      internalNotes: parsed.data.internalNotes ?? application.internalNotes,
      recommendedBeneficiaryType,
      participantPortalAccessId: access.id,
      invitedAt: now,
      reviewedByUserId: user.id,
      workerPublisherProfileId: patch.workerPublisherProfileId,
      salesReferralId: patch.salesReferralId,
      customEngagementId: patch.customEngagementId,
      governance: {
        userId: user.id,
        actorType: ActorType.USER,
        english,
      },
    });
  } catch (error) {
    if (error instanceof ProgramApplicationLifecycleError) {
      return {
        ok: false,
        error: getProgramApplicationLifecycleDeniedMessage(error.code, english),
        capabilityDecisionTrace,
      };
    }

    return {
      ok: false,
      error:
        error instanceof Error ? error.message : english ? "Failed to issue the invite." : "发放邀请失败。",
      capabilityDecisionTrace,
    };
  }

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "PROGRAM_APPLICATION_INVITE_ISSUED",
    targetType: "ProgramApplication",
    targetId: application.id,
    summary:
      issuanceState === "issue_fresh_access"
        ? english
          ? `Issued participant invite for ${application.applicantName}`
          : `已为 ${application.applicantName} 发放参与邀请`
        : issuanceState === "reissue_archived_access"
          ? english
            ? `Reopened archived participant access for ${application.applicantName}`
            : `已为 ${application.applicantName} 重新启用归档的门户访问`
          : english
            ? `Reissued participant invite for ${application.applicantName}`
            : `已为 ${application.applicantName} 重新发放参与邀请`,
    payload: {
      programKey: application.partnerProgram.programKey,
      beneficiaryType: recommendedBeneficiaryType,
      participantPortalAccessId: access.id,
      inviteEmail,
      issuanceState,
    },
    sourcePage: "/settings",
  });

  await logEvent({
    workspaceId: workspace.id,
    userId: user.id,
    eventName: "program_application_invite_issued",
    eventCategory: "program_catalog",
    targetType: "ProgramApplication",
    targetId: application.id,
    metadata: {
      programKey: application.partnerProgram.programKey,
      beneficiaryType: recommendedBeneficiaryType,
      participantPortalAccessId: access.id,
      issuanceState,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  revalidatePath("/portal");

  return {
    ok: true,
    accessId: access.id,
    inviteUrl: await buildAbsolutePortalUrl(`/portal/access/${inviteToken}`),
    issuanceState,
    capabilityDecisionTrace,
  };
}
