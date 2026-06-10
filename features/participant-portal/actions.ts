"use server";

import { ActorType, ParticipantPortalAccessStatus } from "@prisma/client";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logEvent } from "@/lib/analytics";
import {
  canManageParticipantPortal,
  getParticipantPortalManagementDeniedMessage,
  hashParticipantPortalToken,
} from "@/lib/auth/participant-portal";
import { buildParticipantPortalCapabilityDecisionTrace } from "@/lib/capability-decision-trace";
import {
  getParticipantPortalInviteStateCopy,
  resolveParticipantPortalInviteState,
} from "@/lib/auth/participant-portal-invite-state";
import {
  completeParticipantPortalOnboardingRecord,
  issueParticipantPortalInvite,
  updateParticipantPortalAccessStatusRecord,
  updateParticipantPortalProfileRecord,
} from "@/lib/auth/participant-portal-access";
import { AUTH_SESSION_PROVIDER_TYPES } from "@/lib/auth/provider-seam";
import { getCurrentMembership, getCurrentUser, getCurrentWorkspace, requireCurrentUser, createSession } from "@/lib/auth/session";
import { normalizeEmailAddress } from "@/lib/auth/formal-auth";
import { resolveUiLocale, supportedUiLocales } from "@/lib/i18n/config";
import { ensureWorkspaceManualSettlementFoundation } from "@/lib/billing/manual-settlement";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { assertHelmReservedWorkspaceAccess, isOperationalHelmReservedWorkspace } from "@/lib/workspace-reserved";

const optionalTextField = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().max(max).optional());

const participantInviteSchema = z.object({
  beneficiaryType: z.enum(["WORKER_PUBLISHER", "SALES_REFERRAL", "CUSTOM_SERVICES"]),
  beneficiaryId: z.string().min(1),
  inviteEmail: z.string().email(),
  displayName: optionalTextField(80),
  notes: optionalTextField(240),
});

const participantAccessStatusSchema = z.object({
  accessId: z.string().min(1),
  status: z.enum(["INVITED", "ACTIVE", "SUSPENDED", "ARCHIVED"]),
});

const participantOnboardingSchema = z.object({
  token: z.string().trim().min(12),
  displayName: z.string().trim().min(2).max(80),
  legalName: optionalTextField(120),
  contact: optionalTextField(120),
  payoutMethodLabel: z.string().trim().min(2).max(60),
  payoutDetailsReference: optionalTextField(240),
  invoiceRequired: z.boolean(),
  notes: optionalTextField(240),
  termsAccepted: z.literal(true),
  locale: z.enum(supportedUiLocales).optional(),
});

const participantProfileSchema = z.object({
  accessId: z.string().min(1),
  displayName: z.string().trim().min(2).max(80),
  legalName: optionalTextField(120),
  contact: optionalTextField(120),
  payoutMethodLabel: z.string().trim().min(2).max(60),
  payoutDetailsReference: optionalTextField(240),
  invoiceRequired: z.boolean(),
  notes: optionalTextField(240),
  locale: z.enum(supportedUiLocales).optional(),
});

async function buildAbsolutePortalUrl(pathname: string) {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}${pathname}`;
}

export async function issueParticipantPortalAccessAction(input: z.infer<typeof participantInviteSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = participantInviteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Please provide beneficiary type and invite email" : "请填写受益方类型和邀请邮箱",
    };
  }

  const capabilityDecisionTrace = buildParticipantPortalCapabilityDecisionTrace({
    actorUserId: user.id,
    workspace,
    membershipRole: membership.role,
    action: "issue_access",
  });

  if (!canManageParticipantPortal(membership.role)) {
    return {
      ok: false,
      error: getParticipantPortalManagementDeniedMessage(english),
      capabilityDecisionTrace,
    };
  }

  try {
    assertHelmReservedWorkspaceAccess(workspace, english, "participant_portal");
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : getParticipantPortalManagementDeniedMessage(english),
      capabilityDecisionTrace,
    };
  }

  await ensureWorkspaceManualSettlementFoundation(workspace.id);

  try {
    const { access, inviteToken, issuanceState } = await issueParticipantPortalInvite({
      workspaceId: workspace.id,
      beneficiaryType: parsed.data.beneficiaryType,
      beneficiaryId: parsed.data.beneficiaryId,
      inviteEmail: parsed.data.inviteEmail,
      displayName: parsed.data.displayName,
      notes: parsed.data.notes,
      now: new Date(),
      governance: {
        userId: user.id,
        actorType: ActorType.USER,
        english,
      },
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "CONTRIBUTOR_PORTAL_ACCESS_ISSUED",
      targetType: "ParticipantPortalAccess",
      targetId: access.id,
      summary:
        issuanceState === "issue_fresh_access"
          ? english
            ? `Issued participant portal access for ${access.displayName}`
            : `已为 ${access.displayName} 发放贡献方门户访问`
          : issuanceState === "reissue_archived_access"
            ? english
              ? `Reopened archived participant portal access for ${access.displayName}`
              : `已重新启用 ${access.displayName} 的归档贡献方门户访问`
            : english
              ? `Reissued participant portal invite for ${access.displayName}`
              : `已为 ${access.displayName} 重新发放贡献方门户邀请`,
      payload: {
        beneficiaryType: access.beneficiaryType,
        inviteEmail: access.inviteEmail,
        status: access.status,
        issuanceState,
      },
      sourcePage: "/settings",
    });

    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName: "participant_portal_access_issued",
      eventCategory: "settings",
      targetType: "ParticipantPortalAccess",
      targetId: access.id,
      metadata: {
        beneficiaryType: access.beneficiaryType,
        inviteEmail: access.inviteEmail,
        issuanceState,
      },
      sourcePage: "/settings",
    });

    revalidatePath("/settings");

    return {
      ok: true,
      accessId: access.id,
      inviteUrl: await buildAbsolutePortalUrl(`/portal/access/${inviteToken}`),
      issuanceState,
      capabilityDecisionTrace,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to issue participant portal access"
            : "发放贡献方门户访问失败",
      capabilityDecisionTrace,
    };
  }
}

export async function updateParticipantPortalAccessStatusAction(
  input: z.infer<typeof participantAccessStatusSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = participantAccessStatusSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid participant access update" : "门户访问更新参数错误" };
  }

  const capabilityDecisionTrace = buildParticipantPortalCapabilityDecisionTrace({
    actorUserId: user.id,
    workspace,
    membershipRole: membership.role,
    action: "update_access_status",
  });

  if (!canManageParticipantPortal(membership.role)) {
    return {
      ok: false,
      error: getParticipantPortalManagementDeniedMessage(english),
      capabilityDecisionTrace,
    };
  }

  try {
    assertHelmReservedWorkspaceAccess(workspace, english, "participant_portal");
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : getParticipantPortalManagementDeniedMessage(english),
      capabilityDecisionTrace,
    };
  }

  const access = await db.participantPortalAccess.findFirst({
    where: {
      id: parsed.data.accessId,
      workspaceId: workspace.id,
    },
  });

  if (!access) {
    return {
      ok: false,
      error: english ? "Participant access not found" : "没有找到对应的门户访问记录",
      capabilityDecisionTrace,
    };
  }

  await updateParticipantPortalAccessStatusRecord({
    workspaceId: workspace.id,
    accessId: access.id,
    status: parsed.data.status as ParticipantPortalAccessStatus,
    governance: {
      userId: user.id,
      actorType: ActorType.USER,
      english,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "CONTRIBUTOR_PORTAL_ACCESS_STATUS_UPDATED",
    targetType: "ParticipantPortalAccess",
    targetId: access.id,
    summary: english
      ? `Updated participant portal access for ${access.displayName}`
      : `已更新 ${access.displayName} 的贡献方门户访问状态`,
    payload: {
      status: parsed.data.status,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  revalidatePath("/portal");
  return { ok: true, capabilityDecisionTrace };
}

export async function completeParticipantPortalOnboardingAction(
  input: z.infer<typeof participantOnboardingSchema>,
) {
  const locale = resolveUiLocale(input.locale);
  const english = locale === "en-US";
  const parsed = participantOnboardingSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english
        ? "Please complete profile, payout details, and contribution terms acknowledgement."
        : "请完整填写资料、结算方式，并确认贡献方条款",
    };
  }

  const access = await db.participantPortalAccess.findUnique({
    where: {
      inviteTokenHash: hashParticipantPortalToken(parsed.data.token),
    },
    include: {
      workspace: true,
    },
  });

  const inviteState = resolveParticipantPortalInviteState({
    access,
    workspaceAllowed: access ? isOperationalHelmReservedWorkspace(access.workspace) : false,
  });

  if (inviteState !== "usable") {
    return {
      ok: false,
      error: getParticipantPortalInviteStateCopy(inviteState, english).errorMessage,
    };
  }

  if (!access) {
    return {
      ok: false,
      error: getParticipantPortalInviteStateCopy("not_found", english).errorMessage,
    };
  }

  const currentUser = await getCurrentUser();
  const normalizedInviteEmail = normalizeEmailAddress(access.inviteEmail);

  if (currentUser && currentUser.email !== normalizedInviteEmail) {
    return {
      ok: false,
      error: english
        ? "Another account is already signed in. Sign out first before accepting this portal access."
        : "当前已有另一个账号登录，请先退出再接受这个门户访问邀请。",
    };
  }

  const { user } = await completeParticipantPortalOnboardingRecord({
    token: parsed.data.token,
    displayName: parsed.data.displayName,
    legalName: parsed.data.legalName,
    contact: parsed.data.contact,
    payoutMethodLabel: parsed.data.payoutMethodLabel,
    payoutDetailsReference: parsed.data.payoutDetailsReference,
    invoiceRequired: parsed.data.invoiceRequired,
    notes: parsed.data.notes,
    now: new Date(),
    english,
  });

  await createSession({
    userId: user.id,
    email: user.email,
    sourcePage: "/portal/access",
    providerType: AUTH_SESSION_PROVIDER_TYPES.PARTICIPANT_PORTAL,
  });

  await writeAuditLog({
    workspaceId: access.workspaceId,
    userId: user.id,
    actor: parsed.data.displayName,
    actorType: ActorType.USER,
    actionType: "CONTRIBUTOR_PORTAL_ONBOARDED",
    targetType: "ParticipantPortalAccess",
    targetId: access.id,
    summary: english
      ? `Participant portal onboarding completed for ${parsed.data.displayName}`
      : `已完成 ${parsed.data.displayName} 的贡献方门户开通`,
    payload: {
      beneficiaryType: access.beneficiaryType,
      inviteEmail: normalizedInviteEmail,
    },
    sourcePage: "/portal/access",
  });

  revalidatePath("/portal");
  revalidatePath("/settings");
  return {
    ok: true,
    redirectTo: `/portal?access=${access.id}`,
  };
}

export async function updateParticipantPortalProfileAction(
  input: z.infer<typeof participantProfileSchema>,
) {
  const currentUser = await requireCurrentUser();
  const parsed = participantProfileSchema.safeParse(input);
  const locale = resolveUiLocale(input.locale);
  const english = locale === "en-US";

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Please complete the payout profile fields" : "请完整填写结算资料",
    };
  }

  const access = await db.participantPortalAccess.findFirst({
    where: {
      id: parsed.data.accessId,
      userId: currentUser.id,
    },
    include: {
      workspace: true,
    },
  });

  if (!access) {
    return {
      ok: false,
      error: english ? "You do not have access to this participant scope" : "你当前没有权限修改这个贡献方范围",
    };
  }

  try {
    assertHelmReservedWorkspaceAccess(access.workspace, english, "participant_portal");
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "You do not have access to this participant scope"
            : "你当前没有权限修改这个贡献方范围",
    };
  }

  if (access.status === ParticipantPortalAccessStatus.ARCHIVED) {
    return {
      ok: false,
      error: english ? "Archived participant access cannot be updated" : "已归档的贡献方访问不能再更新资料",
    };
  }

  await updateParticipantPortalProfileRecord({
    accessId: access.id,
    currentUserId: currentUser.id,
    displayName: parsed.data.displayName,
    legalName: parsed.data.legalName,
    contact: parsed.data.contact,
    payoutMethodLabel: parsed.data.payoutMethodLabel,
    payoutDetailsReference: parsed.data.payoutDetailsReference,
    invoiceRequired: parsed.data.invoiceRequired,
    notes: parsed.data.notes,
    english,
  });

  await writeAuditLog({
    workspaceId: access.workspaceId,
    userId: currentUser.id,
    actor: parsed.data.displayName,
    actorType: ActorType.USER,
    actionType: "CONTRIBUTOR_PORTAL_PROFILE_UPDATED",
    targetType: "ParticipantPortalAccess",
    targetId: access.id,
    summary: english
      ? `Updated participant portal profile for ${parsed.data.displayName}`
      : `已更新 ${parsed.data.displayName} 的贡献方门户资料`,
    payload: {
      beneficiaryType: access.beneficiaryType,
      beneficiaryReference: access.beneficiaryReference,
      invoiceRequired: parsed.data.invoiceRequired,
    },
    sourcePage: "/portal",
  });

  revalidatePath("/portal");
  revalidatePath("/settings");
  return { ok: true };
}
