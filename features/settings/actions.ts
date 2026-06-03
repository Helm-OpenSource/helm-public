"use server";

import {
  ActorType,
  ConnectorProvider,
  CustomEngagementStatus,
  CustomEngagementType,
  MembershipStatus,
  PayoutProfileStatus,
  PublisherProfileStatus,
  SalesReferralStatus,
  SettlementLineStatus,
  WorkspaceClass,
  WorkspaceRole,
  WorkspaceStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { logEvent } from "@/lib/analytics";
import {
  canManageWorkspaceBilling,
  canManageContributionRegistry,
  canManageManualSettlement,
  getBillingManagementDeniedMessage,
  getContributionRegistryManagementDeniedMessage,
  getManualSettlementManagementDeniedMessage,
} from "@/lib/auth/commercial-governance";
import {
  canManageWorkspaceGovernedActions,
  canReviewWorkspaceGovernedActions,
  getGovernedActionManagementDeniedMessage,
  getGovernedActionReviewDeniedMessage,
} from "@/lib/auth/action-governance";
import {
  canManageWorkspaceMembers,
  canManageWorkspaceOperationalControls,
  canManageWorkspacePolicies,
  canManageWorkspaceSetup,
  getMembershipManagementDeniedMessage,
  getWorkspaceGovernanceDeniedMessage,
} from "@/lib/auth/settings-governance";
import { writeAuditLog } from "@/lib/audit";
import { ensureWorkspaceCommercialFoundation } from "@/lib/billing/foundation";
import { ensureWorkspaceRevenueAttributionFoundation } from "@/lib/billing/revenue-attribution";
import {
  approveSettlementBatch,
  buildManualSettlementCapabilityDecisionTrace,
  buildSettlementBatchCsv,
  closeSettlementBatch,
  createSettlementBatchForPeriod,
  ensureWorkspaceManualSettlementFoundation,
  markSettlementBatchExported,
  markSettlementBatchLinePaid,
  reverseSettlementBatchLine,
} from "@/lib/billing/manual-settlement";
import {
  buildSettlementBatchActionFeedback,
  buildSettlementLineActionFeedback,
} from "@/lib/billing/manual-settlement-feedback";
import {
  createWorkspaceBillingPortalSession,
  createWorkspaceCheckoutSession,
  syncWorkspacePaymentStatus,
} from "@/lib/billing/integration";
import { policyDefaults } from "@/data/constants";
import {
  AUTH_SESSION_REVOKE_SCOPES,
  getCurrentMembership,
  getCurrentWorkspace,
  getSessionId,
  requireCurrentUser,
  rotateCurrentAuthSession,
  revokeWorkspaceAuthSessionsByScope,
  revokeWorkspaceAuthSessionById,
  setActiveWorkspace,
} from "@/lib/auth/session";
import { db } from "@/lib/db";
import { recordPolicyChangedDelta } from "@/lib/evolution/delta-event.service";
import { refreshEvolutionState } from "@/lib/evolution/pattern-detection.service";
import {
  acceptSkillSuggestion,
  approveSkillFormalReview,
  deferSkillFormalReview,
  dismissSkillSuggestion,
  queueSkillFormalReview,
  rejectSkillFormalReview,
  returnSkillFormalReviewForHardening,
} from "@/lib/evolution/skill-suggestion.service";
import { acceptStrategySuggestion, dismissStrategySuggestion } from "@/lib/evolution/strategy-suggestion.service";
import { normalizeEmailAddress, normalizePhoneNumber } from "@/lib/auth/formal-auth";
import { getSettingsData } from "@/features/settings/queries";
import {
  acknowledgeTenantResourceGuardedWritePilot,
  requestTenantResourceGuardedWritePilot,
  reviewTenantResourceGuardedWritePilot,
} from "@/lib/tenant-resources/guarded-write-pilot-runtime";
import {
  reviewTenantResourceManualProof,
  startTenantResourceManualProofReview,
  submitTenantResourceManualProof,
  withdrawTenantResourceManualProof,
} from "@/lib/tenant-resources/manual-proof-runtime";
import {
  validateMembershipStatusTransition,
  validateMembershipRoleTransition,
  validateOwnershipTransfer,
} from "@/lib/auth/membership-lifecycle";
import { findFirstMembershipWithExistingUser } from "@/lib/auth/membership-with-user";
import { buildMemberDefinitionDraft, type MemberDefinitionDraft } from "@/lib/definitions/member-definition";
import {
  ROLE_PRESET_KEYS,
  getRolePresetDefinition,
  localizeRolePreset,
  suggestRolePresetKeyFromText,
} from "@/lib/definitions/role-presets";
import { resolveUiLocale, UI_LOCALE_COOKIE } from "@/lib/i18n/config";
import {
  fetchDingTalkAppAccessToken,
  getDingTalkAppMessageConfig,
  parseDingTalkConnectorMetadata,
} from "@/lib/connectors/dingtalk";
import { sendDingTalkInviteMessage } from "@/lib/connectors/dingtalk-directory-invite";
import { getLatestDingTalkDirectoryInviteDryRunSnapshot } from "@/lib/connectors/dingtalk-directory-invite-snapshot";
import { safeParseJson } from "@/lib/utils";
import { defaultWorkspaceFeatureFlags, serializeWorkspaceFeatureFlags } from "@/lib/workspace-ops";
import {
  assertHelmReservedWorkspaceAccess,
  getHelmReservedWorkspaceDeniedMessage,
  type HelmReservedWorkspaceSurface,
} from "@/lib/workspace-reserved";

const policySchema = z.object({
  id: z.string(),
  mode: z.enum(["SUGGEST_ONLY", "REQUIRES_APPROVAL", "AUTO_WITHIN_THRESHOLD", "FORBIDDEN"]),
  riskThreshold: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  enabled: z.boolean(),
});

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(60),
});

const optionalTextField = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().max(max).optional());

const optionalMemberIdentifierField = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().max(191).optional());

function resolveMemberIdentifier(rawValue: string | null | undefined) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) {
    return { normalizedEmail: null, normalizedPhone: null };
  }

  const emailCandidate = z.string().email().safeParse(raw).success
    ? normalizeEmailAddress(raw)
    : null;
  const phoneCandidate = emailCandidate ? null : normalizePhoneNumber(raw);
  return {
    normalizedEmail: emailCandidate,
    normalizedPhone: phoneCandidate,
  };
}

const DINGTALK_USER_BY_MOBILE_URL = "https://oapi.dingtalk.com/topapi/v2/user/getbymobile";

function normalizeNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toDingTalkMobileLookupValue(normalizedPhone: string) {
  if (!normalizedPhone) {
    return null;
  }

  const digits = normalizedPhone.replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }

  if (digits.length === 13 && digits.startsWith("86")) {
    return digits.slice(2);
  }

  return digits;
}

async function resolveDingTalkUserIdFromConnectorHistory(userId: string) {
  const connectors = await db.connector.findMany({
    where: {
      userId,
      provider: ConnectorProvider.DINGTALK,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      metadata: true,
    },
  });

  for (const connector of connectors) {
    const metadata = parseDingTalkConnectorMetadata(connector.metadata);
    const callbackUserId = normalizeNonEmptyString(metadata.lastCallbackResult?.providerUserId);
    if (callbackUserId) {
      return callbackUserId;
    }
  }

  return null;
}

async function resolveDingTalkUserIdByMobile(normalizedPhone: string) {
  const mobile = toDingTalkMobileLookupValue(normalizedPhone);
  if (!mobile) {
    return null;
  }

  try {
    const token = await fetchDingTalkAppAccessToken();
    const url = new URL(DINGTALK_USER_BY_MOBILE_URL);
    url.searchParams.set("access_token", token.accessToken);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mobile,
      }),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const errcode =
      typeof payload.errcode === "number"
        ? payload.errcode
        : typeof payload.errcode === "string"
          ? Number(payload.errcode)
          : -1;
    if (!response.ok || errcode !== 0) {
      return null;
    }

    const result =
      payload.result && typeof payload.result === "object"
        ? (payload.result as Record<string, unknown>)
        : {};
    return normalizeNonEmptyString(result.userid) ?? null;
  } catch (error) {
    console.error("[settings] resolve dingtalk user id by mobile failed", error);
    return null;
  }
}

async function resolveDingTalkUserIdFromAnyDryRunSnapshot(input: {
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  fallbackPhone: string | null;
}) {
  const candidatePhone = input.normalizedPhone ?? input.fallbackPhone;
  const snapshots = await db.dingTalkDirectoryInviteSnapshot.findMany({
    where: {
      dryRun: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 24,
    select: {
      detailsJson: true,
    },
  });

  for (const snapshot of snapshots) {
    const details = safeParseJson<unknown>(snapshot.detailsJson, []);
    if (!Array.isArray(details)) {
      continue;
    }

    if (candidatePhone) {
      const matchedByPhone = details.find((item) => {
        if (!item || typeof item !== "object") {
          return false;
        }
        const detail = item as Record<string, unknown>;
        const detailPhone = normalizePhoneNumber(
          normalizeNonEmptyString(detail.normalizedPhone) ?? normalizeNonEmptyString(detail.mobile) ?? "",
        );
        return detailPhone === candidatePhone;
      });
      if (matchedByPhone && typeof matchedByPhone === "object") {
        const detail = matchedByPhone as Record<string, unknown>;
        const userId = normalizeNonEmptyString(detail.dingtalkUserId);
        if (userId) {
          return userId;
        }
      }
    }

    if (input.normalizedEmail) {
      const matchedByEmail = details.find((item) => {
        if (!item || typeof item !== "object") {
          return false;
        }
        const detail = item as Record<string, unknown>;
        const placeholderEmail = normalizeNonEmptyString(detail.placeholderEmail);
        const detailEmail = placeholderEmail ? normalizeEmailAddress(placeholderEmail) : null;
        return detailEmail === input.normalizedEmail;
      });
      if (matchedByEmail && typeof matchedByEmail === "object") {
        const detail = matchedByEmail as Record<string, unknown>;
        const userId = normalizeNonEmptyString(detail.dingtalkUserId);
        if (userId) {
          return userId;
        }
      }
    }
  }

  return null;
}

const membershipSchema = z.object({
  email: optionalMemberIdentifierField,
  name: optionalTextField(40),
  role: z.enum(["OWNER", "BILLING_ADMIN", "ADMIN", "OPERATOR", "REVIEWER", "MEMBER"]),
  title: optionalTextField(60),
  rolePresetKey: z.enum(ROLE_PRESET_KEYS).optional(),
}).superRefine((value, ctx) => {
  const raw = value.email?.trim() ?? "";
  if (!raw) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "member identifier is required",
      path: ["email"],
    });
    return;
  }

  const { normalizedEmail, normalizedPhone } = resolveMemberIdentifier(raw);
  if (!normalizedEmail && !normalizedPhone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "member identifier must be a valid email or phone number",
      path: ["email"],
    });
  }
});

const membershipLifecycleSchema = z.object({
  membershipId: z.string().min(1),
  nextStatus: z.enum(["ACTIVE", "INVITED", "INACTIVE"]),
});

const membershipRoleSchema = z.object({
  membershipId: z.string().min(1),
  nextRole: z.enum(["OWNER", "BILLING_ADMIN", "ADMIN", "OPERATOR", "REVIEWER", "MEMBER"]),
});

const memberGoalProfileSchema = z.object({
  membershipId: z.string().min(1),
  goalTitle: optionalTextField(120),
  goalDescription: optionalTextField(1200),
  goalItems: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
  jobResponsibilities: optionalTextField(1200),
});

const ownershipTransferSchema = z.object({
  membershipId: z.string().min(1),
});

const switchWorkspaceSchema = z.object({
  workspaceId: z.string().min(1),
});

const authSessionRevokeSchema = z.object({
  sessionId: z.string().min(1),
});

const authSessionRevokeScopeSchema = z.object({
  scope: z.enum([
    AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
    AUTH_SESSION_REVOKE_SCOPES.LEGACY_PROVIDER,
    AUTH_SESSION_REVOKE_SCOPES.MISSING_SOURCE_PAGE,
    AUTH_SESSION_REVOKE_SCOPES.MISSING_WORKSPACE_SWITCH_MARKER,
    AUTH_SESSION_REVOKE_SCOPES.PROVIDER_SOURCE_MISMATCH,
    AUTH_SESSION_REVOKE_SCOPES.WORKSPACE_MEMBERSHIP_MISMATCH,
    AUTH_SESSION_REVOKE_SCOPES.OTHER_ACTIVE,
  ]),
});

const memberDefinitionDraftSchema = z.object({
  rolePresetKey: z.enum(ROLE_PRESET_KEYS),
  title: optionalTextField(60),
  customNotes: optionalTextField(240),
});

const memberDefinitionAcceptSchema = z.object({
  rolePresetKey: z.enum(ROLE_PRESET_KEYS),
  title: optionalTextField(60),
  customNotes: optionalTextField(240),
  mission: z.string().trim().min(1).max(600),
  ownedOutcomes: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
  mainJudgements: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
  handoffEdges: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
  successSignals: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
  boundaryNotes: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
});

function getReservedWorkspaceActionError(
  workspace: Awaited<ReturnType<typeof getCurrentWorkspace>>,
  english: boolean,
  surface: HelmReservedWorkspaceSurface,
) {
  try {
    assertHelmReservedWorkspaceAccess(workspace, english, surface);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : getHelmReservedWorkspaceDeniedMessage(english, surface);
  }
}

const billingCheckoutSchema = z.object({
  provider: z.enum(["STRIPE", "ALIPAY", "WECHAT_PAY"]).optional(),
});

const optionalEmailField = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().email().max(120).optional());

const optionalCurrencyAmountField = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 100) : value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN;
}, z.number().int().min(0).max(500_000_000).optional());

const workerPublisherProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  publisherKey: optionalTextField(64),
  contactEmail: optionalEmailField,
  notes: optionalTextField(240),
});

const workerPublisherProfileStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

const salesReferralSchema = z.object({
  beneficiaryLabel: z.string().trim().min(2).max(80),
  referralKey: optionalTextField(64),
  beneficiaryContact: optionalTextField(120),
  notes: optionalTextField(240),
});

const salesReferralStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE", "CANCELED"]),
});

const customEngagementSchema = z.object({
  engagementType: z.enum(["IMPLEMENTATION", "MAINTENANCE"]),
  label: z.string().trim().min(2).max(80),
  engagementKey: optionalTextField(64),
  beneficiaryLabel: z.string().trim().min(2).max(80),
  contractValue: optionalCurrencyAmountField,
  notes: optionalTextField(240),
});

const customEngagementStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELED"]),
});

const payoutProfileSchema = z.object({
  beneficiaryType: z.enum(["WORKER_PUBLISHER", "SALES_REFERRAL", "CUSTOM_SERVICES"]),
  beneficiaryId: z.string().min(1),
  displayName: z.string().trim().min(2).max(80),
  legalName: optionalTextField(120),
  contact: optionalTextField(120),
  payoutMethodLabel: z.string().trim().min(2).max(60),
  payoutDetailsReference: optionalTextField(240),
  invoiceRequired: z.boolean(),
  notes: optionalTextField(240),
});

const payoutProfileStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

const settlementBatchSchema = z.object({
  periodLabel: z.string().trim().regex(/^\d{4}-\d{2}$/),
  notes: optionalTextField(240),
});

const settlementBatchActionSchema = z.object({
  batchId: z.string().min(1),
});

const settlementLinePaidSchema = z.object({
  lineId: z.string().min(1),
  notes: optionalTextField(240),
});

const settlementLineReverseSchema = z.object({
  lineId: z.string().min(1),
  reason: z.string().trim().min(2).max(240),
});

function slugifyWorkspaceName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "helm-team";
}

function slugifyRegistryKey(value: string, fallback: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64) || fallback
  );
}

async function resolveWorkspaceLoginEntryUrl() {
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    try {
      return new URL("/login", appUrl).toString();
    } catch {
      // Fall through to header-derived origin.
    }
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (!host) {
    return "http://localhost:3000/login";
  }

  const protocol =
    headerStore.get("x-forwarded-proto") ??
    (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}/login`;
}

function buildDingTalkMemberInviteUrl(input: {
  loginUrl: string;
  workspaceId: string;
  workspaceName: string;
  title?: string | null;
}) {
  const loginEntryUrl = new URL(input.loginUrl);
  const url = new URL("/api/public-auth/dingtalk/start", loginEntryUrl.origin);
  url.searchParams.set("org", input.workspaceName);
  url.searchParams.set("ws", input.workspaceId);
  if (input.title?.trim()) {
    url.searchParams.set("title", input.title.trim());
  }
  return url.toString();
}

function buildPhonePlaceholderEmail(normalizedPhone: string, suffix = 0) {
  const digits = normalizedPhone.replace(/[^\d]/g, "") || "member";
  const serial = suffix > 0 ? `.${suffix}` : "";
  return `member.${digits}${serial}@placeholder.helm.local`;
}

async function resolveUniquePhonePlaceholderEmail(normalizedPhone: string) {
  let suffix = 0;
  while (suffix < 1000) {
    const candidate = buildPhonePlaceholderEmail(normalizedPhone, suffix);
    const existing = await db.user.findUnique({
      where: { email: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
    suffix += 1;
  }

  return `member.${Date.now()}@placeholder.helm.local`;
}

async function resolveDingTalkInviteTargetUserId(input: {
  workspaceId: string;
  memberUserId: string;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  fallbackPhone: string | null;
}) {
  const snapshot = await getLatestDingTalkDirectoryInviteDryRunSnapshot(input.workspaceId);

  const candidatePhone = input.normalizedPhone ?? input.fallbackPhone;
  if (snapshot) {
    if (candidatePhone) {
      const byPhone = snapshot.details.find((item) => {
        const detailPhone = normalizePhoneNumber(item.normalizedPhone ?? item.mobile ?? "");
        return detailPhone === candidatePhone;
      });
      if (byPhone?.dingtalkUserId?.trim()) {
        return byPhone.dingtalkUserId.trim();
      }
    }

    if (input.normalizedEmail) {
      const byEmail = snapshot.details.find((item) => {
        const detailEmail = item.placeholderEmail
          ? normalizeEmailAddress(item.placeholderEmail)
          : null;
        return detailEmail === input.normalizedEmail;
      });
      if (byEmail?.dingtalkUserId?.trim()) {
        return byEmail.dingtalkUserId.trim();
      }
    }
  }

  const byConnectorHistory = await resolveDingTalkUserIdFromConnectorHistory(input.memberUserId);
  if (byConnectorHistory) {
    return byConnectorHistory;
  }

  const byAnySnapshot = await resolveDingTalkUserIdFromAnyDryRunSnapshot({
    normalizedEmail: input.normalizedEmail,
    normalizedPhone: input.normalizedPhone,
    fallbackPhone: input.fallbackPhone,
  });
  if (byAnySnapshot) {
    return byAnySnapshot;
  }

  if (candidatePhone) {
    const byMobile = await resolveDingTalkUserIdByMobile(candidatePhone);
    if (byMobile) {
      return byMobile;
    }
  }

  return null;
}

async function getUniqueWorkspaceSlug(baseName: string) {
  const base = slugifyWorkspaceName(baseName);
  let slug = base;
  let index = 1;

  while (await db.workspace.findUnique({ where: { slug }, select: { id: true } })) {
    index += 1;
    slug = `${base}-${index}`;
  }

  return slug;
}

async function resolveWorkerPublisherKey(workspaceId: string, requestedKey: string | undefined, displayName: string) {
  const preferredKey = slugifyRegistryKey(requestedKey ?? displayName, "publisher");

  if (requestedKey) {
    const existing = await db.workerPublisherProfile.findUnique({
      where: {
        workspaceId_publisherKey: {
          workspaceId,
          publisherKey: preferredKey,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Worker publisher key already exists in this organization");
    }

    return preferredKey;
  }

  let key = preferredKey;
  let index = 1;

  while (
    await db.workerPublisherProfile.findUnique({
      where: {
        workspaceId_publisherKey: {
          workspaceId,
          publisherKey: key,
        },
      },
      select: { id: true },
    })
  ) {
    index += 1;
    key = `${preferredKey}_${index}`;
  }

  return key;
}

async function resolveSalesReferralKey(workspaceId: string, requestedKey: string | undefined, beneficiaryLabel: string) {
  const preferredKey = slugifyRegistryKey(requestedKey ?? beneficiaryLabel, "referral");

  if (requestedKey) {
    const existing = await db.salesReferral.findUnique({
      where: {
        workspaceId_referralKey: {
          workspaceId,
          referralKey: preferredKey,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Sales referral key already exists in this organization");
    }

    return preferredKey;
  }

  let key = preferredKey;
  let index = 1;

  while (
    await db.salesReferral.findUnique({
      where: {
        workspaceId_referralKey: {
          workspaceId,
          referralKey: key,
        },
      },
      select: { id: true },
    })
  ) {
    index += 1;
    key = `${preferredKey}_${index}`;
  }

  return key;
}

async function resolveCustomEngagementKey(workspaceId: string, requestedKey: string | undefined, label: string) {
  const preferredKey = slugifyRegistryKey(requestedKey ?? label, "engagement");

  if (requestedKey) {
    const existing = await db.customEngagement.findUnique({
      where: {
        workspaceId_engagementKey: {
          workspaceId,
          engagementKey: preferredKey,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Custom engagement key already exists in this organization");
    }

    return preferredKey;
  }

  let key = preferredKey;
  let index = 1;

  while (
    await db.customEngagement.findUnique({
      where: {
        workspaceId_engagementKey: {
          workspaceId,
          engagementKey: key,
        },
      },
      select: { id: true },
    })
  ) {
    index += 1;
    key = `${preferredKey}_${index}`;
  }

  return key;
}

async function resolvePayoutProfileBeneficiary(input: {
  workspaceId: string;
  beneficiaryType: "WORKER_PUBLISHER" | "SALES_REFERRAL" | "CUSTOM_SERVICES";
  beneficiaryId: string;
}) {
  if (input.beneficiaryType === "WORKER_PUBLISHER") {
    const record = await db.workerPublisherProfile.findFirst({
      where: {
        id: input.beneficiaryId,
        workspaceId: input.workspaceId,
      },
      select: {
        id: true,
        publisherKey: true,
        displayName: true,
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
    };
  }

  if (input.beneficiaryType === "SALES_REFERRAL") {
    const record = await db.salesReferral.findFirst({
      where: {
        id: input.beneficiaryId,
        workspaceId: input.workspaceId,
      },
      select: {
        id: true,
        referralKey: true,
        beneficiaryLabel: true,
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
    };
  }

  const record = await db.customEngagement.findFirst({
    where: {
      id: input.beneficiaryId,
      workspaceId: input.workspaceId,
    },
    select: {
      id: true,
      engagementKey: true,
      beneficiaryLabel: true,
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
  };
}

function getMembershipLifecycleGuardMessage(
  code:
    | "LAST_OWNER_GUARD"
    | "OWNER_CANNOT_RETURN_TO_INVITED"
    | "ACTIVE_TO_INVITED_NOT_ALLOWED"
    | "INVITED_TO_ACTIVE_NOT_ALLOWED",
  english: boolean,
) {
  switch (code) {
    case "LAST_OWNER_GUARD":
      return english
        ? "Transfer ownership before deactivating the last active owner."
        : "停用最后一个活跃负责人前，请先完成所有权转移。";
    case "OWNER_CANNOT_RETURN_TO_INVITED":
      return english
        ? "Owner memberships must stay active or inactive. Transfer ownership before moving this member back to invited."
        : "负责人角色只能保持活跃或非活跃。要回到已邀请状态，请先完成所有权转移。";
    case "ACTIVE_TO_INVITED_NOT_ALLOWED":
      return english
        ? "Active members cannot be moved directly back to invited. Set them inactive first."
        : "活跃成员不能直接回到已邀请，请先设为非活跃。";
    case "INVITED_TO_ACTIVE_NOT_ALLOWED":
      return english
        ? "Invited memberships become active only after the user enters the organization."
        : "已邀请成员只有在用户真正进入组织后才会转为活跃。";
  }
}

function getOwnershipTransferGuardMessage(
  code: "OWNER_REQUIRED" | "TARGET_ALREADY_OWNER" | "TARGET_MUST_BE_ACTIVE" | "SELF_TRANSFER_NOT_ALLOWED",
  english: boolean,
) {
  switch (code) {
    case "OWNER_REQUIRED":
      return english
        ? "Only the current owner can transfer organization ownership."
        : "只有当前负责人可以转移组织所有权。";
    case "SELF_TRANSFER_NOT_ALLOWED":
      return english ? "Choose another active member as the next owner." : "请选择另一位活跃成员作为新负责人。";
    case "TARGET_ALREADY_OWNER":
      return english ? "This member is already an owner." : "该成员已经是负责人。";
    case "TARGET_MUST_BE_ACTIVE":
      return english
        ? "Ownership can only be transferred to an active member."
        : "组织所有权只能转移给活跃成员。";
  }
}

function getMembershipRoleGuardMessage(
  code: "DIRECT_OWNER_ASSIGNMENT_NOT_ALLOWED" | "LAST_OWNER_ROLE_CHANGE_GUARD",
  english: boolean,
) {
  switch (code) {
    case "DIRECT_OWNER_ASSIGNMENT_NOT_ALLOWED":
      return english
        ? "Use ownership transfer instead of assigning owner through the generic role-change path."
        : "不要通过通用角色切换直接指定负责人，请使用所有权转移。";
    case "LAST_OWNER_ROLE_CHANGE_GUARD":
      return english
        ? "Transfer ownership before changing the last active owner into another role."
        : "修改最后一个活跃负责人的角色前，请先完成所有权转移。";
  }
}

export async function createOrganizationAction(input: z.infer<typeof organizationSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const english = workspace.defaultLocale === "en-US";
  const parsed = organizationSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Please enter an organization name" : "请输入组织名称" };
  }

  const slug = await getUniqueWorkspaceSlug(parsed.data.name);

  const nextWorkspace = await db.workspace.create({
    data: {
      name: parsed.data.name,
      slug,
      status: WorkspaceStatus.ACTIVE,
      workspaceClass: WorkspaceClass.CUSTOMER,
      systemKey: null,
      description: english ? "New Helm organization workspace" : "新的 Helm 组织工作区",
      profileType: workspace.profileType,
      defaultLocale: workspace.defaultLocale,
      pilotMode: true,
      captureConsentRequired: true,
      dataRetentionDays: workspace.dataRetentionDays ?? 90,
      featureFlagsJson: workspace.featureFlagsJson ?? serializeWorkspaceFeatureFlags(defaultWorkspaceFeatureFlags),
      llmBudgetTier: workspace.llmBudgetTier ?? "pilot",
      llmEnabled: workspace.llmEnabled ?? true,
      defaultLLMProvider: workspace.defaultLLMProvider,
      defaultLLMModel: workspace.defaultLLMModel,
      extractionModel: workspace.extractionModel,
      briefingModel: workspace.briefingModel,
      reasoningModel: workspace.reasoningModel,
      configuration: workspace.configuration,
    },
  });

  await db.membership.create({
    data: {
      workspaceId: nextWorkspace.id,
      userId: user.id,
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.ACTIVE,
      title: user.title,
      persona: user.title,
    },
  });

  await ensureWorkspaceCommercialFoundation(nextWorkspace.id);
  await setActiveWorkspace(nextWorkspace.id);

  const cookieStore = await cookies();
  cookieStore.set(UI_LOCALE_COOKIE, resolveUiLocale(nextWorkspace.defaultLocale), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });

  await writeAuditLog({
    workspaceId: nextWorkspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "ORGANIZATION_CREATED",
    targetType: "Workspace",
    targetId: nextWorkspace.id,
    summary: english ? `Created organization ${nextWorkspace.name}` : `创建组织：${nextWorkspace.name}`,
    sourcePage: "/settings",
  });

  await logEvent({
    workspaceId: nextWorkspace.id,
    userId: user.id,
    eventName: "organization_created",
    eventCategory: "settings",
    targetType: "Workspace",
    targetId: nextWorkspace.id,
    metadata: {
      workspaceName: nextWorkspace.name,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, workspaceId: nextWorkspace.id };
}

export async function addOrganizationMemberAction(input: z.infer<typeof membershipSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = membershipSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Please provide member email or phone and role" : "请填写成员邮箱或手机号和角色" };
  }

  if (!canManageWorkspaceMembers(membership.role)) {
    return { ok: false, error: english ? "Only owner, billing admin or admin can manage organization members" : "只有组织负责人、计费管理员或管理员可以管理组织成员" };
  }

  const rawIdentifier = String(parsed.data.email ?? "").trim();
  const { normalizedEmail, normalizedPhone } = resolveMemberIdentifier(rawIdentifier);
  if (!normalizedEmail && !normalizedPhone) {
    return {
      ok: false,
      error: english
        ? "Please enter a valid member email or phone number"
        : "请填写有效的成员邮箱或手机号",
    };
  }
  const locale = resolveUiLocale(workspace.defaultLocale);
  const resolvedRolePresetKey =
    parsed.data.rolePresetKey ??
    suggestRolePresetKeyFromText(parsed.data.title, workspace.profileType, workspace.description);
  const localizedRolePreset = localizeRolePreset(getRolePresetDefinition(resolvedRolePresetKey), locale);
  const memberDefinitionDraft = buildMemberDefinitionDraft({
    locale,
    workspaceName: workspace.name,
    workspaceProfileType: workspace.profileType,
    focusAreasJson: workspace.focusAreas,
    rolePresetKey: resolvedRolePresetKey,
    title: parsed.data.title,
    persona: parsed.data.title ?? localizedRolePreset.label,
  });

  const existingUser = normalizedEmail
    ? await db.user.findUnique({
        where: { email: normalizedEmail },
      })
    : await db.user.findUnique({
        where: { phone: normalizedPhone ?? undefined },
      });

  const fallbackEmailForPhone = !normalizedEmail && normalizedPhone
    ? await resolveUniquePhonePlaceholderEmail(normalizedPhone)
    : null;

  const memberUser =
    existingUser ??
    (await db.user.create({
      data: {
        email: normalizedEmail ?? fallbackEmailForPhone ?? `member.${Date.now()}@placeholder.helm.local`,
        phone: normalizedPhone ?? undefined,
        name:
          parsed.data.name ||
          (normalizedEmail
            ? normalizedEmail.split("@")[0]
            : (normalizedPhone ?? "").slice(-4).padStart(4, "0")),
        title: parsed.data.title ?? null,
      },
    }));

  if (normalizedPhone && !memberUser.phone) {
    await db.user.update({
      where: { id: memberUser.id },
      data: { phone: normalizedPhone },
    });
  }

  const existingMembership = await db.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: memberUser.id,
      },
    },
    select: {
      status: true,
      joinedAt: true,
    },
  });

  const membershipStatus =
    existingMembership?.status === MembershipStatus.ACTIVE
      ? MembershipStatus.ACTIVE
      : MembershipStatus.INVITED;

  const savedMembership = await db.membership.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: memberUser.id,
      },
    },
    update: {
      role: parsed.data.role,
      status: membershipStatus,
      title: parsed.data.title ?? undefined,
      persona: parsed.data.title ?? localizedRolePreset.label,
      rolePresetKey: resolvedRolePresetKey,
      definitionDraftJson: JSON.stringify(memberDefinitionDraft),
    },
    create: {
      workspaceId: workspace.id,
      userId: memberUser.id,
      role: parsed.data.role,
      status: membershipStatus,
      title: parsed.data.title ?? undefined,
      persona: parsed.data.title ?? localizedRolePreset.label,
      rolePresetKey: resolvedRolePresetKey,
      definitionDraftJson: JSON.stringify(memberDefinitionDraft),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "ORGANIZATION_MEMBER_ADDED",
    targetType: "Membership",
    targetId: `${workspace.id}:${memberUser.id}`,
    summary: english
      ? `Added ${memberUser.email} to ${workspace.name} as ${parsed.data.role.toLowerCase()}`
      : `已将 ${memberUser.email} 加入 ${workspace.name}，角色为 ${parsed.data.role}`,
    payload: {
      email: memberUser.email,
      role: parsed.data.role,
      status: membershipStatus,
      rolePresetKey: resolvedRolePresetKey,
    },
    sourcePage: "/settings",
  });

  let inviteDispatch:
    | {
        attempted: boolean;
        sent: boolean;
        channel: "DINGTALK";
        reason?:
          | "not_configured"
          | "target_unresolved"
          | "send_failed";
        dingtalkUserId?: string | null;
        inviteUrl?: string | null;
        deliveryNote?: string | null;
      }
    | undefined;

  if (savedMembership.status === MembershipStatus.INVITED) {
    const loginUrl = await resolveWorkspaceLoginEntryUrl();
    const inviteUrl = buildDingTalkMemberInviteUrl({
      loginUrl,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      title: parsed.data.title ?? null,
    });
    const dingtalkUserId = await resolveDingTalkInviteTargetUserId({
      workspaceId: workspace.id,
      memberUserId: memberUser.id,
      normalizedEmail,
      normalizedPhone,
      fallbackPhone: memberUser.phone,
    });
    const appConfig = getDingTalkAppMessageConfig();

    if (!appConfig.agentId) {
      inviteDispatch = {
        attempted: false,
        sent: false,
        channel: "DINGTALK",
        reason: "not_configured",
        inviteUrl,
        dingtalkUserId,
      };
    } else if (!dingtalkUserId) {
      inviteDispatch = {
        attempted: false,
        sent: false,
        channel: "DINGTALK",
        reason: "target_unresolved",
        inviteUrl,
        dingtalkUserId: null,
      };
    } else {
      try {
        const token = await fetchDingTalkAppAccessToken();
        const receipt = await sendDingTalkInviteMessage({
          accessToken: token.accessToken,
          agentId: appConfig.agentId,
          dingtalkUserId,
          workspaceName: workspace.name,
          inviteUrl,
          roleLabel: savedMembership.role,
          title: savedMembership.title,
        });
        inviteDispatch = {
          attempted: true,
          sent: true,
          channel: "DINGTALK",
          dingtalkUserId,
          inviteUrl,
          deliveryNote: receipt.deliveryNote,
        };
      } catch (error) {
        console.error("[settings] failed to send organization member invite via dingtalk", error);
        inviteDispatch = {
          attempted: true,
          sent: false,
          channel: "DINGTALK",
          reason: "send_failed",
          dingtalkUserId,
          inviteUrl,
        };
      }
    }
  }

  revalidatePath("/settings");
  revalidatePath("/setup");
  return {
    ok: true,
    member: {
      id: savedMembership.id,
      role: savedMembership.role,
      status: savedMembership.status,
      joinedAt:
        savedMembership.status === MembershipStatus.ACTIVE
          ? savedMembership.joinedAt
          : existingMembership?.joinedAt ?? null,
      title: savedMembership.title,
      rolePresetKey: savedMembership.rolePresetKey,
      user: {
        id: memberUser.id,
        name: memberUser.name,
        email: memberUser.email,
      },
    },
    inviteDispatch,
  };
}

export async function updateOrganizationMembershipLifecycleAction(
  input: z.infer<typeof membershipLifecycleSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = membershipLifecycleSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid membership lifecycle update" : "成员状态参数错误" };
  }

  if (!canManageWorkspaceMembers(membership.role)) {
    return { ok: false, error: getMembershipManagementDeniedMessage(english) };
  }

  const targetMembership = await findFirstMembershipWithExistingUser({
    where: {
      id: parsed.data.membershipId,
      workspaceId: workspace.id,
    },
  });

  if (!targetMembership) {
    return { ok: false, error: english ? "Team member not found" : "没有找到该团队成员" };
  }

  const activeOwnerCount = await db.membership.count({
    where: {
      workspaceId: workspace.id,
      role: WorkspaceRole.OWNER,
      status: {
        not: MembershipStatus.INACTIVE,
      },
    },
  });

  const guard = validateMembershipStatusTransition({
    currentStatus: targetMembership.status,
    nextStatus: parsed.data.nextStatus,
    targetRole: targetMembership.role,
    activeOwnerCount,
  });

  if (!guard.ok) {
    return { ok: false, error: getMembershipLifecycleGuardMessage(guard.code, english) };
  }

  if (targetMembership.status === parsed.data.nextStatus) {
    return { ok: true, status: targetMembership.status };
  }

  const nextJoinedAt =
    parsed.data.nextStatus === MembershipStatus.ACTIVE && targetMembership.status !== MembershipStatus.ACTIVE
      ? new Date()
      : targetMembership.joinedAt;

  const updatedMembership = await db.membership.update({
    where: { id: targetMembership.id },
    data: {
      status: parsed.data.nextStatus,
      joinedAt: nextJoinedAt,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "ORGANIZATION_MEMBER_LIFECYCLE_UPDATED",
    targetType: "Membership",
    targetId: targetMembership.id,
    summary: english
      ? `Updated ${targetMembership.user.email} from ${targetMembership.status.toLowerCase()} to ${updatedMembership.status.toLowerCase()}`
      : `已将 ${targetMembership.user.email} 从 ${targetMembership.status} 更新为 ${updatedMembership.status}`,
    payload: {
      previousStatus: targetMembership.status,
      nextStatus: updatedMembership.status,
      targetRole: targetMembership.role,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/setup");

  return {
    ok: true,
    status: updatedMembership.status,
  };
}

export async function updateOrganizationMembershipRoleAction(input: z.infer<typeof membershipRoleSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = membershipRoleSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid membership role update" : "成员角色参数错误" };
  }

  if (!canManageWorkspaceMembers(membership.role)) {
    return { ok: false, error: getMembershipManagementDeniedMessage(english) };
  }

  const targetMembership = await findFirstMembershipWithExistingUser({
    where: {
      id: parsed.data.membershipId,
      workspaceId: workspace.id,
    },
  });

  if (!targetMembership) {
    return { ok: false, error: english ? "Team member not found" : "没有找到该团队成员" };
  }

  const activeOwnerCount = await db.membership.count({
    where: {
      workspaceId: workspace.id,
      role: WorkspaceRole.OWNER,
      status: {
        not: MembershipStatus.INACTIVE,
      },
    },
  });

  const guard = validateMembershipRoleTransition({
    currentRole: targetMembership.role,
    nextRole: parsed.data.nextRole,
    currentStatus: targetMembership.status,
    activeOwnerCount,
  });

  if (!guard.ok) {
    return { ok: false, error: getMembershipRoleGuardMessage(guard.code, english) };
  }

  if (targetMembership.role === parsed.data.nextRole) {
    return { ok: true, role: targetMembership.role };
  }

  const updatedMembership = await db.membership.update({
    where: { id: targetMembership.id },
    data: {
      role: parsed.data.nextRole,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "ORGANIZATION_MEMBER_ROLE_UPDATED",
    targetType: "Membership",
    targetId: targetMembership.id,
    summary: english
      ? `Updated ${targetMembership.user.email} from ${targetMembership.role.toLowerCase()} to ${updatedMembership.role.toLowerCase()}`
      : `已将 ${targetMembership.user.email} 的角色从 ${targetMembership.role} 更新为 ${updatedMembership.role}`,
    payload: {
      previousRole: targetMembership.role,
      nextRole: updatedMembership.role,
      membershipStatus: targetMembership.status,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/setup");

  return {
    ok: true,
    role: updatedMembership.role,
  };
}

export async function updateOrganizationMemberGoalProfileAction(
  input: z.infer<typeof memberGoalProfileSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = memberGoalProfileSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Invalid member goal profile payload" : "成员目标信息参数错误",
    };
  }

  if (!canManageWorkspaceMembers(membership.role)) {
    return { ok: false, error: getMembershipManagementDeniedMessage(english) };
  }

  const targetMembership = await findFirstMembershipWithExistingUser({
    where: {
      id: parsed.data.membershipId,
      workspaceId: workspace.id,
    },
  });

  if (!targetMembership) {
    return { ok: false, error: english ? "Team member not found" : "没有找到该团队成员" };
  }

  const goalItems = (parsed.data.goalItems ?? [])
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 10);
  const goalItemsJson = goalItems.length > 0 ? JSON.stringify(goalItems) : null;

  const updatedMembership = await db.membership.update({
    where: { id: targetMembership.id },
    data: {
      goalTitle: parsed.data.goalTitle ?? null,
      goalDescription: parsed.data.goalDescription ?? null,
      goalItemsJson,
      jobResponsibilities: parsed.data.jobResponsibilities ?? null,
    },
    select: {
      id: true,
      goalTitle: true,
      goalDescription: true,
      goalItemsJson: true,
      jobResponsibilities: true,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "ORGANIZATION_MEMBER_GOAL_PROFILE_UPDATED",
    targetType: "Membership",
    targetId: targetMembership.id,
    summary: english
      ? `Updated member goal profile for ${targetMembership.user.email}`
      : `已更新 ${targetMembership.user.email} 的成员目标信息`,
    payload: {
      goalTitleLength: parsed.data.goalTitle?.length ?? 0,
      goalDescriptionLength: parsed.data.goalDescription?.length ?? 0,
      goalItemCount: goalItems.length,
      jobResponsibilitiesLength: parsed.data.jobResponsibilities?.length ?? 0,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");

  return {
    ok: true,
    member: updatedMembership,
  };
}

export async function transferOrganizationOwnershipAction(
  input: z.infer<typeof ownershipTransferSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = ownershipTransferSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid ownership transfer target" : "所有权转移参数错误" };
  }

  const targetMembership = await findFirstMembershipWithExistingUser({
    where: {
      id: parsed.data.membershipId,
      workspaceId: workspace.id,
    },
  });

  if (!targetMembership) {
    return { ok: false, error: english ? "Team member not found" : "没有找到该团队成员" };
  }

  const guard = validateOwnershipTransfer({
    actorRole: membership.role,
    actorUserId: membership.userId,
    targetUserId: targetMembership.userId,
    targetRole: targetMembership.role,
    targetStatus: targetMembership.status,
  });

  if (!guard.ok) {
    return { ok: false, error: getOwnershipTransferGuardMessage(guard.code, english) };
  }

  await db.$transaction([
    db.membership.update({
      where: { id: targetMembership.id },
      data: {
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    }),
    db.membership.update({
      where: { id: membership.id },
      data: {
        role: WorkspaceRole.ADMIN,
      },
    }),
  ]);

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "ORGANIZATION_OWNERSHIP_TRANSFERRED",
    targetType: "Membership",
    targetId: targetMembership.id,
    summary: english
      ? `Transferred ownership to ${targetMembership.user.email}`
      : `已将组织所有权转移给 ${targetMembership.user.email}`,
    payload: {
      previousOwnerUserId: membership.userId,
      nextOwnerUserId: targetMembership.userId,
      previousOwnerRoleAfterTransfer: WorkspaceRole.ADMIN,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/setup");

  return { ok: true };
}

export async function switchOrganizationAction(input: z.infer<typeof switchWorkspaceSchema>) {
  const user = await requireCurrentUser();
  const currentWorkspace = await getCurrentWorkspace();
  const english = currentWorkspace.defaultLocale === "en-US";
  const parsed = switchWorkspaceSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid workspace" : "工作区参数无效" };
  }

  const membership = await db.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: parsed.data.workspaceId,
        userId: user.id,
      },
    },
    include: {
      workspace: true,
    },
  });

  if (!membership || membership.status === MembershipStatus.INACTIVE) {
    return { ok: false, error: english ? "Workspace unavailable" : "当前无法切换到该工作区" };
  }

  await ensureWorkspaceCommercialFoundation(membership.workspaceId);
  await setActiveWorkspace(membership.workspaceId);

  const cookieStore = await cookies();
  cookieStore.set(UI_LOCALE_COOKIE, resolveUiLocale(membership.workspace.defaultLocale), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/meetings");
  revalidatePath("/approvals");
  revalidatePath("/memory");
  revalidatePath("/diagnostics");
  return { ok: true };
}

export async function revokeOrganizationAuthSessionAction(
  input: z.infer<typeof authSessionRevokeSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const currentSessionId = await getSessionId();
  const english = workspace.defaultLocale === "en-US";
  const parsed = authSessionRevokeSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid auth session revoke request" : "会话撤销参数错误" };
  }

  if (!canManageWorkspaceMembers(membership.role)) {
    return { ok: false, error: getMembershipManagementDeniedMessage(english) };
  }

  if (parsed.data.sessionId === currentSessionId) {
    return {
      ok: false,
      error: english
        ? "Use sign out for the current session. Org-admin can revoke other sessions only."
        : "当前会话请直接退出登录；org-admin 只允许撤销其他会话。",
    };
  }

  const result = await revokeWorkspaceAuthSessionById({
    sessionId: parsed.data.sessionId,
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    sourcePage: "/settings",
  });

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "UNAVAILABLE"
          ? english
            ? "This auth session is already unavailable."
            : "这个会话已经不可用。"
          : english
            ? "Auth session not found in this organization."
            : "当前组织下没有找到这个会话。",
    };
  }

  revalidatePath("/settings");
  return { ok: true };
}

export async function revokeOrganizationAuthSessionsByScopeAction(
  input: z.infer<typeof authSessionRevokeScopeSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const currentSessionId = await getSessionId();
  const english = workspace.defaultLocale === "en-US";
  const parsed = authSessionRevokeScopeSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Invalid auth session scope revoke request" : "会话批量撤销参数错误",
    };
  }

  if (!canManageWorkspaceMembers(membership.role)) {
    return { ok: false, error: getMembershipManagementDeniedMessage(english) };
  }

  const result = await revokeWorkspaceAuthSessionsByScope({
    scope: parsed.data.scope,
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    currentSessionId,
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");

  return {
    ok: true,
    revokedCount: result.revokedCount,
  };
}

export async function rotateCurrentOrganizationAuthSessionAction() {
  const workspace = await getCurrentWorkspace();
  const english = workspace.defaultLocale === "en-US";

  const result = await rotateCurrentAuthSession({
    sourcePage: "/settings",
  });

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "UNAVAILABLE"
          ? english
            ? "Current auth session is no longer available."
            : "当前会话已经不可用。"
          : english
            ? "Current auth session was not found."
            : "未找到当前会话。",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createWorkerPublisherProfileAction(input: z.infer<typeof workerPublisherProfileSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = workerPublisherProfileSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Please provide a valid publisher display name" : "请填写有效的发布方名称",
    };
  }

  if (!canManageContributionRegistry(membership.role)) {
    return {
      ok: false,
      error: getContributionRegistryManagementDeniedMessage(english),
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "commercial_registry",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError };
  }

  try {
    await ensureWorkspaceRevenueAttributionFoundation(workspace.id, undefined, {
      userId: user.id,
      actorType: ActorType.USER,
      english,
    });

    const publisherKey = await resolveWorkerPublisherKey(
      workspace.id,
      parsed.data.publisherKey,
      parsed.data.displayName,
    );

    const profile = await db.workerPublisherProfile.create({
      data: {
        workspaceId: workspace.id,
        publisherKey,
        displayName: parsed.data.displayName,
        contactEmail: parsed.data.contactEmail ?? null,
        notes: parsed.data.notes ?? null,
        status: PublisherProfileStatus.ACTIVE,
      },
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "WORKER_PUBLISHER_PROFILE_CREATED",
      targetType: "WorkerPublisherProfile",
      targetId: profile.id,
      summary: english
        ? `Created worker publisher profile: ${profile.displayName}`
        : `已创建执行发布方：${profile.displayName}`,
      payload: {
        publisherKey: profile.publisherKey,
        contactEmail: profile.contactEmail,
      },
      sourcePage: "/settings",
    });

    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName: "worker_publisher_profile_created",
      eventCategory: "billing",
      targetType: "WorkerPublisherProfile",
      targetId: profile.id,
      metadata: {
        publisherKey: profile.publisherKey,
        displayName: profile.displayName,
      },
      sourcePage: "/settings",
    });

    revalidatePath("/settings");
    return { ok: true, id: profile.id };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to create the worker publisher profile"
            : "创建执行发布方失败",
    };
  }
}

export async function updateWorkerPublisherProfileStatusAction(
  input: z.infer<typeof workerPublisherProfileStatusSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = workerPublisherProfileStatusSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid publisher status update" : "发布方状态参数错误" };
  }

  if (!canManageContributionRegistry(membership.role)) {
    return {
      ok: false,
      error: getContributionRegistryManagementDeniedMessage(english),
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "commercial_registry",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError };
  }

  const profile = await db.workerPublisherProfile.findFirst({
    where: {
      id: parsed.data.id,
      workspaceId: workspace.id,
    },
  });

  if (!profile) {
    return { ok: false, error: english ? "Publisher profile not found" : "没有找到该发布方记录" };
  }

  const updated = await db.workerPublisherProfile.update({
    where: { id: profile.id },
    data: { status: parsed.data.status },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "WORKER_PUBLISHER_PROFILE_STATUS_UPDATED",
    targetType: "WorkerPublisherProfile",
    targetId: updated.id,
    summary: english
      ? `Updated worker publisher status: ${updated.displayName} -> ${updated.status.toLowerCase()}`
      : `已更新执行发布方状态：${updated.displayName} -> ${updated.status}`,
    payload: {
      status: updated.status,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function createSalesReferralAction(input: z.infer<typeof salesReferralSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = salesReferralSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Please provide a valid sales referral label" : "请填写有效的销售转介绍名称",
    };
  }

  if (!canManageContributionRegistry(membership.role)) {
    return {
      ok: false,
      error: getContributionRegistryManagementDeniedMessage(english),
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "commercial_registry",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError };
  }

  try {
    await ensureWorkspaceRevenueAttributionFoundation(workspace.id, undefined, {
      userId: user.id,
      actorType: ActorType.USER,
      english,
    });

    const referralKey = await resolveSalesReferralKey(
      workspace.id,
      parsed.data.referralKey,
      parsed.data.beneficiaryLabel,
    );

    const referral = await db.salesReferral.create({
      data: {
        workspaceId: workspace.id,
        referralKey,
        beneficiaryLabel: parsed.data.beneficiaryLabel,
        beneficiaryContact: parsed.data.beneficiaryContact ?? null,
        notes: parsed.data.notes ?? null,
        status: SalesReferralStatus.ACTIVE,
      },
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "SALES_REFERRAL_CREATED",
      targetType: "SalesReferral",
      targetId: referral.id,
      summary: english
        ? `Created sales referral: ${referral.beneficiaryLabel}`
        : `已创建销售转介绍记录：${referral.beneficiaryLabel}`,
      payload: {
        referralKey: referral.referralKey,
        beneficiaryContact: referral.beneficiaryContact,
      },
      sourcePage: "/settings",
    });

    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName: "sales_referral_created",
      eventCategory: "billing",
      targetType: "SalesReferral",
      targetId: referral.id,
      metadata: {
        referralKey: referral.referralKey,
        beneficiaryLabel: referral.beneficiaryLabel,
      },
      sourcePage: "/settings",
    });

    revalidatePath("/settings");
    return { ok: true, id: referral.id };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to create the sales referral"
            : "创建销售转介绍记录失败",
    };
  }
}

export async function updateSalesReferralStatusAction(input: z.infer<typeof salesReferralStatusSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = salesReferralStatusSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid referral status update" : "转介绍状态参数错误" };
  }

  if (!canManageContributionRegistry(membership.role)) {
    return {
      ok: false,
      error: getContributionRegistryManagementDeniedMessage(english),
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "commercial_registry",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError };
  }

  const referral = await db.salesReferral.findFirst({
    where: {
      id: parsed.data.id,
      workspaceId: workspace.id,
    },
  });

  if (!referral) {
    return { ok: false, error: english ? "Sales referral not found" : "没有找到该销售转介绍记录" };
  }

  const updated = await db.salesReferral.update({
    where: { id: referral.id },
    data: { status: parsed.data.status },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "SALES_REFERRAL_STATUS_UPDATED",
    targetType: "SalesReferral",
    targetId: updated.id,
    summary: english
      ? `Updated sales referral status: ${updated.beneficiaryLabel} -> ${updated.status.toLowerCase()}`
      : `已更新销售转介绍状态：${updated.beneficiaryLabel} -> ${updated.status}`,
    payload: {
      status: updated.status,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function createCustomEngagementAction(input: z.infer<typeof customEngagementSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = customEngagementSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Please provide valid custom engagement details" : "请填写有效的定制服务信息",
    };
  }

  if (!canManageContributionRegistry(membership.role)) {
    return {
      ok: false,
      error: getContributionRegistryManagementDeniedMessage(english),
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "commercial_registry",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError };
  }

  try {
    await ensureWorkspaceRevenueAttributionFoundation(workspace.id, undefined, {
      userId: user.id,
      actorType: ActorType.USER,
      english,
    });

    const engagementKey = await resolveCustomEngagementKey(
      workspace.id,
      parsed.data.engagementKey,
      parsed.data.label,
    );

    const engagement = await db.customEngagement.create({
      data: {
        workspaceId: workspace.id,
        engagementKey,
        engagementType:
          parsed.data.engagementType === "IMPLEMENTATION"
            ? CustomEngagementType.IMPLEMENTATION
            : CustomEngagementType.MAINTENANCE,
        label: parsed.data.label,
        beneficiaryLabel: parsed.data.beneficiaryLabel,
        contractValueCents: parsed.data.contractValue ?? null,
        notes: parsed.data.notes ?? null,
        status: CustomEngagementStatus.ACTIVE,
      },
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "CUSTOM_ENGAGEMENT_CREATED",
      targetType: "CustomEngagement",
      targetId: engagement.id,
      summary: english
        ? `Created custom engagement: ${engagement.label}`
        : `已创建定制服务：${engagement.label}`,
      payload: {
        engagementKey: engagement.engagementKey,
        engagementType: engagement.engagementType,
        contractValueCents: engagement.contractValueCents,
      },
      sourcePage: "/settings",
    });

    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName: "custom_engagement_created",
      eventCategory: "billing",
      targetType: "CustomEngagement",
      targetId: engagement.id,
      metadata: {
        engagementKey: engagement.engagementKey,
        engagementType: engagement.engagementType,
        beneficiaryLabel: engagement.beneficiaryLabel,
      },
      sourcePage: "/settings",
    });

    revalidatePath("/settings");
    return { ok: true, id: engagement.id };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to create the custom engagement"
            : "创建定制服务失败",
    };
  }
}

export async function updateCustomEngagementStatusAction(
  input: z.infer<typeof customEngagementStatusSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = customEngagementStatusSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid engagement status update" : "定制服务状态参数错误" };
  }

  if (!canManageContributionRegistry(membership.role)) {
    return {
      ok: false,
      error: getContributionRegistryManagementDeniedMessage(english),
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "commercial_registry",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError };
  }

  const engagement = await db.customEngagement.findFirst({
    where: {
      id: parsed.data.id,
      workspaceId: workspace.id,
    },
  });

  if (!engagement) {
    return { ok: false, error: english ? "Custom engagement not found" : "没有找到该定制服务" };
  }

  const updated = await db.customEngagement.update({
    where: { id: engagement.id },
    data: { status: parsed.data.status },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "CUSTOM_ENGAGEMENT_STATUS_UPDATED",
    targetType: "CustomEngagement",
    targetId: updated.id,
    summary: english
      ? `Updated custom engagement status: ${updated.label} -> ${updated.status.toLowerCase()}`
      : `已更新定制服务状态：${updated.label} -> ${updated.status}`,
    payload: {
      status: updated.status,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function createBeneficiaryPayoutProfileAction(input: z.infer<typeof payoutProfileSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = payoutProfileSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Please provide a valid beneficiary payout profile" : "请填写有效的受益方结算资料",
    };
  }

  if (!canManageManualSettlement(membership.role)) {
    return {
      ok: false,
      error: getManualSettlementManagementDeniedMessage(english, "registry"),
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "commercial_registry",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError };
  }

  try {
    await ensureWorkspaceManualSettlementFoundation(workspace.id);
    const resolved = await resolvePayoutProfileBeneficiary({
      workspaceId: workspace.id,
      beneficiaryType: parsed.data.beneficiaryType,
      beneficiaryId: parsed.data.beneficiaryId,
    });

    const profile = await db.beneficiaryPayoutProfile.create({
      data: {
        workspaceId: workspace.id,
        beneficiaryType: parsed.data.beneficiaryType,
        beneficiaryReference: resolved.beneficiaryReference,
        displayName: parsed.data.displayName || resolved.defaultDisplayName,
        legalName: parsed.data.legalName ?? null,
        contact: parsed.data.contact ?? null,
        payoutMethodLabel: parsed.data.payoutMethodLabel,
        payoutDetailsReference: parsed.data.payoutDetailsReference ?? null,
        invoiceRequired: parsed.data.invoiceRequired,
        status: PayoutProfileStatus.ACTIVE,
        notes: parsed.data.notes ?? null,
        workerPublisherProfileId: resolved.workerPublisherProfileId,
        salesReferralId: resolved.salesReferralId,
        customEngagementId: resolved.customEngagementId,
      },
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "BENEFICIARY_PAYOUT_PROFILE_CREATED",
      targetType: "BeneficiaryPayoutProfile",
      targetId: profile.id,
      summary: english
        ? `Created beneficiary payout profile: ${profile.displayName}`
        : `已创建受益方结算资料：${profile.displayName}`,
      payload: {
        beneficiaryType: profile.beneficiaryType,
        beneficiaryReference: profile.beneficiaryReference,
        payoutMethodLabel: profile.payoutMethodLabel,
        invoiceRequired: profile.invoiceRequired,
      },
      sourcePage: "/settings",
    });

    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName: "beneficiary_payout_profile_created",
      eventCategory: "billing",
      targetType: "BeneficiaryPayoutProfile",
      targetId: profile.id,
      metadata: {
        beneficiaryType: profile.beneficiaryType,
        beneficiaryReference: profile.beneficiaryReference,
      },
      sourcePage: "/settings",
    });

    revalidatePath("/settings");
    return { ok: true, id: profile.id };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to create beneficiary payout profile"
            : "创建受益方结算资料失败",
    };
  }
}

export async function updateBeneficiaryPayoutProfileStatusAction(
  input: z.infer<typeof payoutProfileStatusSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = payoutProfileStatusSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid payout profile status update" : "结算资料状态参数错误" };
  }

  if (!canManageManualSettlement(membership.role)) {
    return {
      ok: false,
      error: getManualSettlementManagementDeniedMessage(english, "registry"),
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "commercial_registry",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError };
  }

  const profile = await db.beneficiaryPayoutProfile.findFirst({
    where: {
      id: parsed.data.id,
      workspaceId: workspace.id,
    },
  });

  if (!profile) {
    return { ok: false, error: english ? "Beneficiary payout profile not found" : "没有找到该受益方结算资料" };
  }

  const updated = await db.beneficiaryPayoutProfile.update({
    where: { id: profile.id },
    data: {
      status: parsed.data.status,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "BENEFICIARY_PAYOUT_PROFILE_STATUS_UPDATED",
    targetType: "BeneficiaryPayoutProfile",
    targetId: updated.id,
    summary: english
      ? `Updated payout profile status: ${updated.displayName} -> ${updated.status.toLowerCase()}`
      : `已更新结算资料状态：${updated.displayName} -> ${updated.status}`,
    payload: {
      status: updated.status,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function createSettlementBatchAction(input: z.infer<typeof settlementBatchSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = settlementBatchSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Please provide a valid settlement period" : "请填写有效的结算周期" };
  }

  const capabilityDecisionTrace = buildManualSettlementCapabilityDecisionTrace({
    actorUserId: user.id,
    actorType: ActorType.USER,
    workspace,
    membershipRole: membership.role,
    operation: "create_batch",
  });

  if (!canManageManualSettlement(membership.role)) {
    return {
      ok: false,
      error: getManualSettlementManagementDeniedMessage(english),
      capabilityDecisionTrace,
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "commercial_registry",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError, capabilityDecisionTrace };
  }

  try {
    const batch = await createSettlementBatchForPeriod({
      workspaceId: workspace.id,
      periodLabel: parsed.data.periodLabel,
      notes: parsed.data.notes ?? null,
      actorUserId: user.id,
      actorType: ActorType.USER,
      english,
    });
    const feedback = buildSettlementBatchActionFeedback({
      kind: "created",
      batchId: batch.id,
      batchKey: batch.batchKey,
      periodLabel: batch.periodLabel,
      status: batch.status,
      lineCount: batch.lines.length,
      actorName: user.name,
      english,
      sourcePage: "/settings",
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "SETTLEMENT_BATCH_CREATED",
      targetType: "SettlementBatch",
      targetId: batch.id,
      summary: feedback.summary,
      payload: feedback.payload,
      sourcePage: "/settings",
    });

    revalidatePath("/settings");
    return {
      ok: true,
      id: batch.id,
      result: feedback.result,
      message: feedback.operatorMessage,
      capabilityDecisionTrace,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : english ? "Failed to create settlement batch" : "创建结算批次失败",
      capabilityDecisionTrace,
    };
  }
}

export async function approveSettlementBatchAction(input: z.infer<typeof settlementBatchActionSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = settlementBatchActionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid settlement batch input" : "结算批次参数错误" };
  }

  const capabilityDecisionTrace = buildManualSettlementCapabilityDecisionTrace({
    actorUserId: user.id,
    actorType: ActorType.USER,
    workspace,
    membershipRole: membership.role,
    operation: "approve_batch",
  });

  if (!canManageManualSettlement(membership.role)) {
    return {
      ok: false,
      error: getManualSettlementManagementDeniedMessage(english),
      capabilityDecisionTrace,
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "commercial_registry",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError, capabilityDecisionTrace };
  }

  try {
    const batch = await approveSettlementBatch({
      workspaceId: workspace.id,
      batchId: parsed.data.batchId,
      actorUserId: user.id,
      actorType: ActorType.USER,
      english,
    });
    const feedback = buildSettlementBatchActionFeedback({
      kind: "approved",
      batchId: batch.id,
      batchKey: batch.batchKey,
      periodLabel: batch.periodLabel,
      status: batch.status,
      lineCount: batch.lines.length,
      actorName: user.name,
      english,
      sourcePage: "/settings",
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "SETTLEMENT_BATCH_APPROVED",
      targetType: "SettlementBatch",
      targetId: batch.id,
      summary: feedback.summary,
      payload: feedback.payload,
      sourcePage: "/settings",
    });

    revalidatePath("/settings");
    return { ok: true, result: feedback.result, message: feedback.operatorMessage, capabilityDecisionTrace };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : english ? "Failed to approve settlement batch" : "批准结算批次失败",
      capabilityDecisionTrace,
    };
  }
}

export async function exportSettlementBatchCsvAction(input: z.infer<typeof settlementBatchActionSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = settlementBatchActionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid settlement batch input" : "结算批次参数错误" };
  }

  const capabilityDecisionTrace = buildManualSettlementCapabilityDecisionTrace({
    actorUserId: user.id,
    actorType: ActorType.USER,
    workspace,
    membershipRole: membership.role,
    operation: "export_batch",
  });

  if (!canManageManualSettlement(membership.role)) {
    return {
      ok: false,
      error: getManualSettlementManagementDeniedMessage(english),
      capabilityDecisionTrace,
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "commercial_registry",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError, capabilityDecisionTrace };
  }

  try {
    const batch = await markSettlementBatchExported({
      workspaceId: workspace.id,
      batchId: parsed.data.batchId,
      actorUserId: user.id,
      actorType: ActorType.USER,
      english,
    });
    const feedback = buildSettlementBatchActionFeedback({
      kind: "exported",
      batchId: batch.id,
      batchKey: batch.batchKey,
      periodLabel: batch.periodLabel,
      status: batch.status,
      lineCount: batch.lines.length,
      actorName: user.name,
      english,
      sourcePage: "/settings",
    });

    const csv = buildSettlementBatchCsv({
      batchKey: batch.batchKey,
      periodLabel: batch.periodLabel,
      currency: batch.currency,
      rows: batch.lines.map((line) => ({
        beneficiaryLabel: line.beneficiaryLabel,
        beneficiaryType: line.beneficiaryType,
        sourceType: line.sourceType,
        amountCents: line.amountCents,
        currency: line.currency,
        status: line.status,
        notes: line.notes,
        reference: line.reference,
      })),
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "SETTLEMENT_BATCH_EXPORTED",
      targetType: "SettlementBatch",
      targetId: batch.id,
      summary: feedback.summary,
      payload: feedback.payload,
      sourcePage: "/settings",
    });

    revalidatePath("/settings");
    return {
      ok: true,
      result: feedback.result,
      message: feedback.operatorMessage,
      filename: `${batch.batchKey}.csv`,
      csv,
      capabilityDecisionTrace,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : english ? "Failed to export settlement batch" : "导出结算批次失败",
      capabilityDecisionTrace,
    };
  }
}

export async function markSettlementLinePaidAction(input: z.infer<typeof settlementLinePaidSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = settlementLinePaidSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid settlement line input" : "结算话术参数错误" };
  }

  const capabilityDecisionTrace = buildManualSettlementCapabilityDecisionTrace({
    actorUserId: user.id,
    actorType: ActorType.USER,
    workspace,
    membershipRole: membership.role,
    operation: "mark_line_paid",
  });

  if (!canManageManualSettlement(membership.role)) {
    return {
      ok: false,
      error: getManualSettlementManagementDeniedMessage(english),
      capabilityDecisionTrace,
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "commercial_registry",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError, capabilityDecisionTrace };
  }

  try {
    await markSettlementBatchLinePaid({
      workspaceId: workspace.id,
      lineId: parsed.data.lineId,
      notes: parsed.data.notes ?? null,
      actorUserId: user.id,
      actorType: ActorType.USER,
      english,
    });
    const feedback = buildSettlementLineActionFeedback({
      kind: "marked_paid",
      lineId: parsed.data.lineId,
      lineStatus: SettlementLineStatus.PAID,
      actorName: user.name,
      english,
      sourcePage: "/settings",
      notes: parsed.data.notes ?? null,
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "SETTLEMENT_LINE_MARKED_PAID",
      targetType: "SettlementBatchLine",
      targetId: parsed.data.lineId,
      summary: feedback.summary,
      payload: feedback.payload,
      sourcePage: "/settings",
    });

    revalidatePath("/settings");
    return { ok: true, result: feedback.result, message: feedback.operatorMessage, capabilityDecisionTrace };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : english ? "Failed to mark settlement line paid" : "标记结算话术为 paid 失败",
      capabilityDecisionTrace,
    };
  }
}

export async function reverseSettlementLineAction(input: z.infer<typeof settlementLineReverseSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = settlementLineReverseSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid settlement reversal input" : "结算冲回参数错误" };
  }

  const capabilityDecisionTrace = buildManualSettlementCapabilityDecisionTrace({
    actorUserId: user.id,
    actorType: ActorType.USER,
    workspace,
    membershipRole: membership.role,
    operation: "reverse_line",
  });

  if (!canManageManualSettlement(membership.role)) {
    return {
      ok: false,
      error: getManualSettlementManagementDeniedMessage(english),
      capabilityDecisionTrace,
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "commercial_registry",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError, capabilityDecisionTrace };
  }

  try {
    await reverseSettlementBatchLine({
      workspaceId: workspace.id,
      lineId: parsed.data.lineId,
      reason: parsed.data.reason,
      actorUserId: user.id,
      actorType: ActorType.USER,
      english,
    });
    const feedback = buildSettlementLineActionFeedback({
      kind: "reversed",
      lineId: parsed.data.lineId,
      lineStatus: SettlementLineStatus.REVERSED,
      actorName: user.name,
      english,
      sourcePage: "/settings",
      reason: parsed.data.reason,
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "SETTLEMENT_LINE_REVERSED",
      targetType: "SettlementBatchLine",
      targetId: parsed.data.lineId,
      summary: feedback.summary,
      payload: feedback.payload,
      sourcePage: "/settings",
    });

    revalidatePath("/settings");
    return { ok: true, result: feedback.result, message: feedback.operatorMessage, capabilityDecisionTrace };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : english ? "Failed to reverse settlement line" : "冲回结算话术失败",
      capabilityDecisionTrace,
    };
  }
}

export async function closeSettlementBatchAction(input: z.infer<typeof settlementBatchActionSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = settlementBatchActionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid settlement batch input" : "结算批次参数错误" };
  }

  const capabilityDecisionTrace = buildManualSettlementCapabilityDecisionTrace({
    actorUserId: user.id,
    actorType: ActorType.USER,
    workspace,
    membershipRole: membership.role,
    operation: "close_batch",
  });

  if (!canManageManualSettlement(membership.role)) {
    return {
      ok: false,
      error: getManualSettlementManagementDeniedMessage(english),
      capabilityDecisionTrace,
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "commercial_registry",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError, capabilityDecisionTrace };
  }

  try {
    const batch = await closeSettlementBatch({
      workspaceId: workspace.id,
      batchId: parsed.data.batchId,
      actorUserId: user.id,
      actorType: ActorType.USER,
      english,
    });
    const feedback = buildSettlementBatchActionFeedback({
      kind: "closed",
      batchId: batch.id,
      batchKey: batch.batchKey,
      periodLabel: batch.periodLabel,
      status: batch.status,
      actorName: user.name,
      english,
      sourcePage: "/settings",
    });

    await writeAuditLog({
      workspaceId: workspace.id,
      userId: user.id,
      actor: user.name,
      actorType: ActorType.USER,
      actionType: "SETTLEMENT_BATCH_CLOSED",
      targetType: "SettlementBatch",
      targetId: batch.id,
      summary: feedback.summary,
      payload: feedback.payload,
      sourcePage: "/settings",
    });

    revalidatePath("/settings");
    return { ok: true, result: feedback.result, message: feedback.operatorMessage, capabilityDecisionTrace };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : english ? "Failed to close settlement batch" : "关闭结算批次失败",
      capabilityDecisionTrace,
    };
  }
}

export async function createBillingCheckoutAction(input?: z.infer<typeof billingCheckoutSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = billingCheckoutSchema.safeParse(input ?? {});

  if (!canManageWorkspaceBilling(membership.role)) {
    return {
      ok: false,
      error: getBillingManagementDeniedMessage(english, "checkout"),
    };
  }

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Invalid payment provider" : "支付提供方参数错误",
    };
  }

  try {
    const headerStore = await headers();
    const url = await createWorkspaceCheckoutSession({
      workspaceId: workspace.id,
      userId: user.id,
      actorName: user.name,
      fallbackEmail: user.email,
      locale: workspace.defaultLocale,
      paymentProvider: parsed.data.provider,
      clientIp:
        headerStore.get("x-forwarded-for") ??
        headerStore.get("x-real-ip") ??
        null,
      userAgent: headerStore.get("user-agent"),
    });

    return { ok: true, url };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to create billing checkout"
            : "创建订阅购买入口失败",
    };
  }
}

export async function createBillingPortalAction() {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceBilling(membership.role)) {
    return {
      ok: false,
      error: getBillingManagementDeniedMessage(english, "portal"),
    };
  }

  try {
    const url = await createWorkspaceBillingPortalSession({
      workspaceId: workspace.id,
      userId: user.id,
      actorName: user.name,
      english,
    });

    return { ok: true, url };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to open the billing portal"
            : "打开订阅管理入口失败",
    };
  }
}

export async function refreshBillingStatusAction() {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceBilling(membership.role)) {
    return {
      ok: false,
      error: getBillingManagementDeniedMessage(english, "refresh"),
    };
  }

  try {
    const result = await syncWorkspacePaymentStatus({
      workspaceId: workspace.id,
      actorName: user.name,
      actorType: ActorType.USER,
      userId: user.id,
      sourcePage: "/settings",
      english,
    });

    if (!result.lifecycleSourceConnected) {
      return {
        ok: false,
        error:
          result.message ??
          (english
            ? "This payment rail has not connected live lifecycle sync yet"
            : "当前支付通道还没有接通实时订阅状态同步"),
      };
    }

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/approvals");
    revalidatePath("/memory");
    revalidatePath("/diagnostics");

    return {
      ok: true,
      accessState: result.accessState,
      providerStatus: result.providerStatus,
      message: result.message,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to refresh billing status"
            : "刷新订阅状态失败",
    };
  }
}

export async function updatePolicyRuleAction(input: z.infer<typeof policySchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: english ? "Invalid policy input" : "策略参数错误" };
  if (!canManageWorkspacePolicies(membership.role)) {
    return { ok: false, error: getWorkspaceGovernanceDeniedMessage(english) };
  }

  const previous = await db.policyRule.findUnique({
    where: { id: parsed.data.id },
  });

  const policy = await db.policyRule.update({
    where: { id: parsed.data.id },
    data: parsed.data,
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "POLICY_UPDATED",
    targetType: "PolicyRule",
    targetId: policy.id,
    summary: english ? `Updated policy: ${policy.name}` : `更新策略：${policy.name}`,
    payload: parsed.data,
  });

  await logEvent({
    workspaceId: workspace.id,
    userId: user.id,
    eventName: "policy_rule_changed",
    eventCategory: "policy",
    targetType: "PolicyRule",
    targetId: policy.id,
    metadata: {
      policyName: policy.name,
      actionType: policy.actionType,
      before: previous
        ? {
            mode: previous.mode,
            riskThreshold: previous.riskThreshold,
            enabled: previous.enabled,
          }
        : null,
      after: {
        mode: policy.mode,
        riskThreshold: policy.riskThreshold,
        enabled: policy.enabled,
      },
    },
    sourcePage: "/settings",
  });

  try {
    await recordPolicyChangedDelta({
      workspaceId: workspace.id,
      actorId: user.id,
      actorType: ActorType.USER,
      sourcePage: "/settings",
      policyRuleId: policy.id,
      actionType: policy.actionType,
      policyName: policy.name,
      before: previous
        ? {
            mode: previous.mode,
            riskThreshold: previous.riskThreshold,
            enabled: previous.enabled,
          }
        : null,
      after: {
        mode: policy.mode,
        riskThreshold: policy.riskThreshold,
        enabled: policy.enabled,
      },
    });

    await refreshEvolutionState({
      workspaceId: workspace.id,
      actorId: user.id,
      actorType: ActorType.USER,
      sourcePage: "/settings",
      trigger: "policy_updated",
    });
  } catch (error) {
    console.error("policy evolution refresh failed", error);
  }

  revalidatePath("/settings");
  return { ok: true };
}

export async function restoreDefaultPoliciesAction() {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspacePolicies(membership.role)) {
    return { ok: false, error: getWorkspaceGovernanceDeniedMessage(english) };
  }

  await Promise.all(
    Object.entries(policyDefaults).map(([actionType, defaults]) =>
      db.policyRule.updateMany({
        where: {
          workspaceId: workspace.id,
          actionType: actionType as keyof typeof policyDefaults,
        },
        data: {
          mode: defaults.mode,
          riskThreshold: defaults.riskThreshold,
          enabled: true,
        },
      }),
    ),
  );

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "POLICY_RESTORED_DEFAULTS",
    targetType: "Workspace",
    targetId: workspace.id,
    summary: english ? "Restored default policy settings" : "已恢复默认策略配置",
  });

  revalidatePath("/settings");
  return { ok: true };
}

const workspaceSetupSchema = z.object({
  profileType: z.string(),
  connectedSources: z.array(z.string()),
  focusAreas: z.array(z.string()),
  defaultStrategies: z.array(z.string()),
  defaultLocale: z.enum(["zh-CN", "en-US"]),
  pilotMode: z.boolean(),
  captureConsentRequired: z.boolean(),
  featureFlags: z.object({
    multilingualUi: z.boolean(),
    diagnosticsCenter: z.boolean(),
    crmFirstImports: z.boolean(),
    captureAudio: z.boolean(),
    llmEnhancement: z.boolean(),
    evolutionSignals: z.boolean(),
  }),
});

export async function updateWorkspaceSetupAction(input: z.infer<typeof workspaceSetupSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = workspaceSetupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: english ? "Setup input is incomplete" : "初始化信息不完整" };
  if (!canManageWorkspaceSetup(membership.role)) {
    return { ok: false, error: getWorkspaceGovernanceDeniedMessage(english) };
  }

  const nextLocale = resolveUiLocale(parsed.data.defaultLocale);

  await db.workspace.update({
    where: { id: workspace.id },
    data: {
      profileType: parsed.data.profileType,
      connectedSources: JSON.stringify(
        parsed.data.connectedSources.map((name) => ({
          name,
          status: "connected",
        })),
      ),
      focusAreas: JSON.stringify(parsed.data.focusAreas),
      defaultStrategies: JSON.stringify(parsed.data.defaultStrategies),
      defaultLocale: nextLocale,
      pilotMode: parsed.data.pilotMode,
      captureConsentRequired: parsed.data.captureConsentRequired,
      featureFlagsJson: serializeWorkspaceFeatureFlags({
        ...defaultWorkspaceFeatureFlags,
        ...parsed.data.featureFlags,
      }),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(UI_LOCALE_COOKIE, nextLocale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "WORKSPACE_SETUP_COMPLETED",
    targetType: "Workspace",
    targetId: workspace.id,
    summary: english ? "Completed initial workspace setup" : "完成首次初始化配置",
    payload: parsed.data,
  });

  revalidatePath("/setup");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function generateCurrentMemberDefinitionDraftAction(
  input: z.infer<typeof memberDefinitionDraftSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const locale = resolveUiLocale(workspace.defaultLocale);
  const english = locale === "en-US";
  const parsed = memberDefinitionDraftSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Definition input is incomplete" : "定义输入不完整" };
  }

  const localizedRolePreset = localizeRolePreset(
    getRolePresetDefinition(parsed.data.rolePresetKey),
    locale,
  );
  const draft = buildMemberDefinitionDraft({
    locale,
    workspaceName: workspace.name,
    workspaceProfileType: workspace.profileType,
    focusAreasJson: workspace.focusAreas,
    rolePresetKey: parsed.data.rolePresetKey,
    title: parsed.data.title,
    persona: membership.persona ?? localizedRolePreset.label,
    customNotes: parsed.data.customNotes,
  });

  await db.membership.update({
    where: { id: membership.id },
    data: {
      title: parsed.data.title ?? membership.title,
      persona: parsed.data.title ?? membership.persona ?? localizedRolePreset.label,
      rolePresetKey: parsed.data.rolePresetKey,
      definitionDraftJson: JSON.stringify(draft),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "MEMBER_DEFINITION_DRAFT_GENERATED",
    targetType: "Membership",
    targetId: membership.id,
    summary: english
      ? `Generated a member definition draft for ${user.email}`
      : `为 ${user.email} 生成了成员定义草稿`,
    payload: {
      rolePresetKey: parsed.data.rolePresetKey,
      title: parsed.data.title ?? null,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  revalidatePath("/setup");
  return { ok: true, draft };
}

export async function saveCurrentMemberDefinitionDraftAction(
  input: z.infer<typeof memberDefinitionAcceptSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const locale = resolveUiLocale(workspace.defaultLocale);
  const english = locale === "en-US";
  const parsed = memberDefinitionAcceptSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Definition draft is incomplete" : "定义草稿还不完整" };
  }

  const localizedRolePreset = localizeRolePreset(
    getRolePresetDefinition(parsed.data.rolePresetKey),
    locale,
  );
  const draft: MemberDefinitionDraft = {
    version: 1,
    locale,
    rolePresetKey: parsed.data.rolePresetKey,
    roleLabel: localizedRolePreset.label,
    title: parsed.data.title ?? null,
    mission: parsed.data.mission,
    ownedOutcomes: parsed.data.ownedOutcomes,
    mainJudgements: parsed.data.mainJudgements,
    handoffEdges: parsed.data.handoffEdges,
    successSignals: parsed.data.successSignals,
    boundaryNotes: parsed.data.boundaryNotes,
    customNotes: parsed.data.customNotes ?? null,
    sourceContext: {
      workspaceName: workspace.name,
      workspaceProfileType: workspace.profileType ?? null,
      focusAreas: safeParseJson<string[]>(workspace.focusAreas, []).filter(Boolean),
    },
  };

  await db.membership.update({
    where: { id: membership.id },
    data: {
      title: parsed.data.title ?? membership.title,
      persona: parsed.data.title ?? membership.persona ?? localizedRolePreset.label,
      rolePresetKey: parsed.data.rolePresetKey,
      definitionDraftJson: JSON.stringify(draft),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "MEMBER_DEFINITION_DRAFT_SAVED",
    targetType: "Membership",
    targetId: membership.id,
    summary: english
      ? `Saved a member definition draft for ${user.email}`
      : `保存了 ${user.email} 的成员定义草稿`,
    payload: {
      rolePresetKey: parsed.data.rolePresetKey,
      title: parsed.data.title ?? null,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  revalidatePath("/setup");
  revalidatePath("/dashboard");
  return { ok: true, draft };
}

export async function acceptCurrentMemberDefinitionAction(
  input: z.infer<typeof memberDefinitionAcceptSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const locale = resolveUiLocale(workspace.defaultLocale);
  const english = locale === "en-US";
  const parsed = memberDefinitionAcceptSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Definition input is incomplete" : "定义输入不完整" };
  }

  const localizedRolePreset = localizeRolePreset(
    getRolePresetDefinition(parsed.data.rolePresetKey),
    locale,
  );
  const acceptedDefinition = {
    version: 1 as const,
    locale,
    rolePresetKey: parsed.data.rolePresetKey,
    roleLabel: localizedRolePreset.label,
    title: parsed.data.title ?? null,
    mission: parsed.data.mission,
    ownedOutcomes: parsed.data.ownedOutcomes,
    mainJudgements: parsed.data.mainJudgements,
    handoffEdges: parsed.data.handoffEdges,
    successSignals: parsed.data.successSignals,
    boundaryNotes: parsed.data.boundaryNotes,
    customNotes: parsed.data.customNotes ?? null,
    acceptedAt: new Date().toISOString(),
    sourceContext: {
      workspaceName: workspace.name,
      workspaceProfileType: workspace.profileType ?? null,
      focusAreas: safeParseJson<string[]>(workspace.focusAreas, []).filter(Boolean),
    },
  };

  await db.membership.update({
    where: { id: membership.id },
    data: {
      title: parsed.data.title ?? membership.title,
      persona: parsed.data.title ?? membership.persona ?? localizedRolePreset.label,
      rolePresetKey: parsed.data.rolePresetKey,
      definitionDraftJson: JSON.stringify(acceptedDefinition),
      definitionAcceptedJson: JSON.stringify(acceptedDefinition),
      definitionAcceptedAt: new Date(),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "MEMBER_DEFINITION_ACCEPTED",
    targetType: "Membership",
    targetId: membership.id,
    summary: english
      ? `Accepted the active member definition for ${user.email}`
      : `已接受 ${user.email} 的成员定义`,
    payload: {
      rolePresetKey: parsed.data.rolePresetKey,
      title: parsed.data.title ?? null,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  revalidatePath("/setup");
  revalidatePath("/dashboard");
  return { ok: true };
}

const strategySuggestionSchema = z.object({
  id: z.string(),
});

const skillSuggestionSchema = z.object({
  id: z.string(),
});

const formalReviewDecisionSchema = z.object({
  id: z.string(),
  note: optionalTextField(400),
  checklist: z.object({
    catalogPatchReady: z.boolean(),
    testsReady: z.boolean(),
    guardsReady: z.boolean(),
    docsReady: z.boolean(),
    boundaryConfirmed: z.boolean(),
  }),
});

export async function acceptStrategySuggestionAction(input: z.infer<typeof strategySuggestionSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const parsed = strategySuggestionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: workspace.defaultLocale === "en-US" ? "Invalid strategy suggestion input" : "策略建议参数错误" };
  }

  if (!canManageWorkspacePolicies(membership.role)) {
    return {
      ok: false,
      error: getWorkspaceGovernanceDeniedMessage(workspace.defaultLocale === "en-US"),
    };
  }

  try {
    await acceptStrategySuggestion({
      workspaceId: workspace.id,
      suggestionId: parsed.data.id,
      userId: user.id,
      actorName: user.name,
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/approvals");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : workspace.defaultLocale === "en-US" ? "Failed to accept the strategy suggestion" : "采纳策略建议失败" };
  }
}

export async function dismissStrategySuggestionAction(input: z.infer<typeof strategySuggestionSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const parsed = strategySuggestionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: workspace.defaultLocale === "en-US" ? "Invalid strategy suggestion input" : "策略建议参数错误" };
  }

  if (!canManageWorkspacePolicies(membership.role)) {
    return {
      ok: false,
      error: getWorkspaceGovernanceDeniedMessage(workspace.defaultLocale === "en-US"),
    };
  }

  try {
    await dismissStrategySuggestion({
      workspaceId: workspace.id,
      suggestionId: parsed.data.id,
      userId: user.id,
      actorName: user.name,
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/approvals");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : workspace.defaultLocale === "en-US" ? "Failed to dismiss the strategy suggestion" : "忽略策略建议失败" };
  }
}

export async function acceptSkillSuggestionAction(input: z.infer<typeof skillSuggestionSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const parsed = skillSuggestionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: workspace.defaultLocale === "en-US" ? "Invalid skill suggestion input" : "候选能力建议参数错误" };
  }

  if (!canManageWorkspacePolicies(membership.role)) {
    return {
      ok: false,
      error: getWorkspaceGovernanceDeniedMessage(workspace.defaultLocale === "en-US"),
    };
  }

  try {
    await acceptSkillSuggestion({
      workspaceId: workspace.id,
      suggestionId: parsed.data.id,
      userId: user.id,
      actorName: user.name,
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/approvals");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : workspace.defaultLocale === "en-US" ? "Failed to accept the skill suggestion" : "采纳候选能力建议失败" };
  }
}

export async function dismissSkillSuggestionAction(input: z.infer<typeof skillSuggestionSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const parsed = skillSuggestionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: workspace.defaultLocale === "en-US" ? "Invalid skill suggestion input" : "候选能力建议参数错误" };
  }

  if (!canManageWorkspacePolicies(membership.role)) {
    return {
      ok: false,
      error: getWorkspaceGovernanceDeniedMessage(workspace.defaultLocale === "en-US"),
    };
  }

  try {
    await dismissSkillSuggestion({
      workspaceId: workspace.id,
      suggestionId: parsed.data.id,
      userId: user.id,
      actorName: user.name,
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/approvals");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : workspace.defaultLocale === "en-US" ? "Failed to dismiss the skill suggestion" : "忽略候选能力建议失败" };
  }
}

export async function queueSkillFormalReviewAction(input: z.infer<typeof skillSuggestionSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = skillSuggestionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid skill formal review input" : "正式评审参数错误" };
  }

  if (!canManageWorkspacePolicies(membership.role)) {
    return {
      ok: false,
      error: getWorkspaceGovernanceDeniedMessage(english),
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "skill_formal_review",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError };
  }

  try {
    await queueSkillFormalReview({
      workspaceId: workspace.id,
      suggestionId: parsed.data.id,
      userId: user.id,
      actorName: user.name,
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/approvals");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : english ? "Failed to queue formal review" : "加入正式评审队列失败" };
  }
}

export async function returnSkillFormalReviewForHardeningAction(
  input: z.infer<typeof skillSuggestionSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = skillSuggestionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid formal review return input" : "正式评审退回参数错误" };
  }

  if (!canManageWorkspacePolicies(membership.role)) {
    return {
      ok: false,
      error: getWorkspaceGovernanceDeniedMessage(english),
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "skill_formal_review",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError };
  }

  try {
    await returnSkillFormalReviewForHardening({
      workspaceId: workspace.id,
      suggestionId: parsed.data.id,
      userId: user.id,
      actorName: user.name,
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/approvals");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : english ? "Failed to return the formal review item for hardening" : "退回 hardening 失败" };
  }
}

export async function approveSkillFormalReviewAction(
  input: z.infer<typeof formalReviewDecisionSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = formalReviewDecisionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid formal review approval input" : "正式评审批准参数错误" };
  }

  if (!canManageWorkspacePolicies(membership.role)) {
    return {
      ok: false,
      error: getWorkspaceGovernanceDeniedMessage(english),
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "skill_formal_review",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError };
  }

  try {
    await approveSkillFormalReview({
      workspaceId: workspace.id,
      suggestionId: parsed.data.id,
      userId: user.id,
      actorName: user.name,
      reviewNote: parsed.data.note,
      checklist: parsed.data.checklist,
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/approvals");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : english ? "Failed to approve formal review" : "批准正式评审失败" };
  }
}

export async function deferSkillFormalReviewAction(
  input: z.infer<typeof formalReviewDecisionSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = formalReviewDecisionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid formal review defer input" : "正式评审延后参数错误" };
  }

  if (!canManageWorkspacePolicies(membership.role)) {
    return {
      ok: false,
      error: getWorkspaceGovernanceDeniedMessage(english),
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "skill_formal_review",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError };
  }

  try {
    await deferSkillFormalReview({
      workspaceId: workspace.id,
      suggestionId: parsed.data.id,
      userId: user.id,
      actorName: user.name,
      reviewNote: parsed.data.note,
      checklist: parsed.data.checklist,
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/approvals");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : english ? "Failed to defer formal review" : "defer 正式评审失败" };
  }
}

export async function rejectSkillFormalReviewAction(
  input: z.infer<typeof formalReviewDecisionSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = formalReviewDecisionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid formal review reject input" : "正式评审 reject 参数错误" };
  }

  if (!canManageWorkspacePolicies(membership.role)) {
    return {
      ok: false,
      error: getWorkspaceGovernanceDeniedMessage(english),
    };
  }

  const reservedWorkspaceError = getReservedWorkspaceActionError(
    workspace,
    english,
    "skill_formal_review",
  );
  if (reservedWorkspaceError) {
    return { ok: false, error: reservedWorkspaceError };
  }

  try {
    await rejectSkillFormalReview({
      workspaceId: workspace.id,
      suggestionId: parsed.data.id,
      userId: user.id,
      actorName: user.name,
      reviewNote: parsed.data.note,
      checklist: parsed.data.checklist,
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/approvals");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : english ? "Failed to reject formal review" : "reject 正式评审失败" };
  }
}

const workspaceOperationalControlsSchema = z.object({
  defaultLocale: z.enum(["zh-CN", "en-US"]),
  pilotMode: z.boolean(),
  captureConsentRequired: z.boolean(),
  dataRetentionDays: z.number().int().min(7).max(365),
  featureFlags: z.object({
    multilingualUi: z.boolean(),
    diagnosticsCenter: z.boolean(),
    crmFirstImports: z.boolean(),
    captureAudio: z.boolean(),
    llmEnhancement: z.boolean(),
    evolutionSignals: z.boolean(),
  }),
});

export async function updateWorkspaceOperationalControlsAction(
  input: z.infer<typeof workspaceOperationalControlsSchema>,
) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const parsed = workspaceOperationalControlsSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: workspace.defaultLocale === "en-US" ? "Invalid pilot operations input" : "试点设置参数错误" };
  }

  if (!canManageWorkspaceOperationalControls(membership.role)) {
    return {
      ok: false,
      error: getWorkspaceGovernanceDeniedMessage(workspace.defaultLocale === "en-US"),
    };
  }

  const current = await db.workspace.findUnique({
    where: { id: workspace.id },
    select: {
      defaultLocale: true,
      pilotMode: true,
      captureConsentRequired: true,
      dataRetentionDays: true,
      featureFlagsJson: true,
    },
  });

  const nextLocale = resolveUiLocale(parsed.data.defaultLocale);

  await db.workspace.update({
    where: { id: workspace.id },
    data: {
      defaultLocale: nextLocale,
      pilotMode: parsed.data.pilotMode,
      captureConsentRequired: parsed.data.captureConsentRequired,
      dataRetentionDays: parsed.data.dataRetentionDays,
      featureFlagsJson: serializeWorkspaceFeatureFlags({
        ...defaultWorkspaceFeatureFlags,
        ...parsed.data.featureFlags,
      }),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(UI_LOCALE_COOKIE, nextLocale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "WORKSPACE_OPERATIONAL_CONTROLS_UPDATED",
    targetType: "Workspace",
    targetId: workspace.id,
    summary:
      workspace.defaultLocale === "en-US"
        ? `Updated pilot controls: locale=${nextLocale}, pilot=${parsed.data.pilotMode ? "on" : "off"}`
        : `更新试点运营配置：语言=${nextLocale}，pilot=${parsed.data.pilotMode ? "开启" : "关闭"}`,
    payload: {
      before: current,
      after: parsed.data,
    },
  });

  await logEvent({
    workspaceId: workspace.id,
    userId: user.id,
    eventName: "workspace_operational_controls_updated",
    eventCategory: "settings",
    targetType: "Workspace",
    targetId: workspace.id,
    metadata: {
      locale: nextLocale,
      pilotMode: parsed.data.pilotMode,
      captureConsentRequired: parsed.data.captureConsentRequired,
      dataRetentionDays: parsed.data.dataRetentionDays,
      featureFlags: parsed.data.featureFlags,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  revalidatePath("/diagnostics");
  revalidatePath("/dashboard");
  revalidatePath("/imports");
  revalidatePath("/imports/crm");
  revalidatePath("/capture");

  return { ok: true };
}

async function requireTenantResourceProofSession(mode: "manage" | "review") {
  const [user, workspace, membership] = await Promise.all([
    requireCurrentUser(),
    getCurrentWorkspace(),
    getCurrentMembership(),
  ]);
  const english = workspace.defaultLocale === "en-US";
  const allowed =
    mode === "manage"
      ? canManageWorkspaceGovernedActions(membership.role)
      : canReviewWorkspaceGovernedActions(membership.role);

  if (!allowed) {
    return {
      ok: false as const,
      error:
        mode === "manage"
          ? getGovernedActionManagementDeniedMessage(english)
          : getGovernedActionReviewDeniedMessage(english),
    };
  }

  return {
    ok: true as const,
    user,
    workspace,
    membership,
    english,
  };
}

async function resolveTenantResourceEvidenceDetail(
  workspaceId: string,
  userId: string,
  resourceKey: string,
) {
  const settingsData = await getSettingsData(workspaceId, userId);
  return (
    settingsData.tenantResourceEvidenceDetails.find(
      (detail) => detail.resource.resourceKey === resourceKey,
    ) ?? null
  );
}

function revalidateTenantResourceGovernancePaths() {
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/operating");
  revalidatePath("/approvals");
}

const submitTenantResourceManualProofSchema = z.object({
  resourceKey: z.string().trim().min(1),
  note: z.string().trim().min(12).max(1000),
});

export async function submitTenantResourceManualProofAction(
  input: z.infer<typeof submitTenantResourceManualProofSchema>,
) {
  const session = await requireTenantResourceProofSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const parsed = submitTenantResourceManualProofSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: session.english ? "Invalid proof submission" : "proof 提交参数不合法",
    };
  }

  const detail = await resolveTenantResourceEvidenceDetail(
    session.workspace.id,
    session.user.id,
    parsed.data.resourceKey,
  );
  if (!detail) {
    return {
      ok: false,
      error: session.english ? "Tenant resource detail not found" : "租户资源明细不存在",
    };
  }

  if (
    !["awaiting_submission", "rejected", "withdrawn", "expired"].includes(
      detail.manualProof.lifecycle.status,
    )
  ) {
    return {
      ok: false,
      error:
        session.english
          ? "Manual proof is not requestable for this resource posture"
          : "当前资源姿态下不能提交人工 proof",
    };
  }

  try {
    await submitTenantResourceManualProof({
      workspaceId: session.workspace.id,
      actorUserId: session.user.id,
      actorName: session.user.name,
      resourceKey: detail.resource.resourceKey,
      resourceName: detail.resource.resourceName,
      provider: detail.resource.provider,
      actionRef: detail.manualProof.lifecycle.actionRef,
      evidenceRefs: detail.evidenceItems.map((item) => item.evidenceRef),
      note: parsed.data.note,
      sourcePage: "/settings?tab=connectors",
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : session.english
            ? "Manual proof submission failed"
            : "人工 proof 提交失败",
    };
  }

  revalidateTenantResourceGovernancePaths();
  return { ok: true };
}

const startTenantResourceManualProofReviewSchema = z.object({
  proofId: z.string().trim().min(1),
});

export async function startTenantResourceManualProofReviewAction(
  input: z.infer<typeof startTenantResourceManualProofReviewSchema>,
) {
  const session = await requireTenantResourceProofSession("review");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const parsed = startTenantResourceManualProofReviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: session.english ? "Invalid review request" : "复核请求参数不合法",
    };
  }

  try {
    await startTenantResourceManualProofReview({
      workspaceId: session.workspace.id,
      reviewerId: session.user.id,
      reviewerName: session.user.name,
      proofId: parsed.data.proofId,
      sourcePage: "/settings?tab=connectors",
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : session.english
            ? "Manual proof review could not start"
            : "无法开始人工 proof 复核",
    };
  }

  revalidateTenantResourceGovernancePaths();
  return { ok: true };
}

const reviewTenantResourceManualProofSchema = z.object({
  proofId: z.string().trim().min(1),
  mode: z.enum(["accept", "reject"]),
  note: z.string().trim().max(1000).optional(),
});

export async function reviewTenantResourceManualProofAction(
  input: z.infer<typeof reviewTenantResourceManualProofSchema>,
) {
  const session = await requireTenantResourceProofSession("review");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const parsed = reviewTenantResourceManualProofSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: session.english ? "Invalid proof review" : "proof 复核参数不合法",
    };
  }

  if (
    parsed.data.mode === "reject" &&
    (!parsed.data.note || parsed.data.note.trim().length < 8)
  ) {
    return {
      ok: false,
      error:
        session.english
          ? "Rejecting proof requires a short reason"
          : "拒绝 proof 时需要填写简短原因",
    };
  }

  try {
    await reviewTenantResourceManualProof({
      workspaceId: session.workspace.id,
      reviewerId: session.user.id,
      reviewerName: session.user.name,
      proofId: parsed.data.proofId,
      mode: parsed.data.mode,
      note: parsed.data.note,
      sourcePage: "/settings?tab=connectors",
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : session.english
            ? "Manual proof review failed"
            : "人工 proof 复核失败",
    };
  }

  revalidateTenantResourceGovernancePaths();
  return { ok: true };
}

const withdrawTenantResourceManualProofSchema = z.object({
  proofId: z.string().trim().min(1),
  note: z.string().trim().max(1000).optional(),
});

export async function withdrawTenantResourceManualProofAction(
  input: z.infer<typeof withdrawTenantResourceManualProofSchema>,
) {
  const session = await requireTenantResourceProofSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const parsed = withdrawTenantResourceManualProofSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: session.english ? "Invalid proof withdrawal" : "proof 撤回参数不合法",
    };
  }

  try {
    await withdrawTenantResourceManualProof({
      workspaceId: session.workspace.id,
      actorUserId: session.user.id,
      actorName: session.user.name,
      proofId: parsed.data.proofId,
      note: parsed.data.note,
      sourcePage: "/settings?tab=connectors",
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : session.english
            ? "Manual proof withdrawal failed"
            : "人工 proof 撤回失败",
    };
  }

  revalidateTenantResourceGovernancePaths();
  return { ok: true };
}

const requestTenantResourceGuardedWritePilotSchema = z.object({
  resourceKey: z.string().trim().min(1),
  note: z.string().trim().max(1000).optional(),
});

export async function requestTenantResourceGuardedWritePilotAction(
  input: z.infer<typeof requestTenantResourceGuardedWritePilotSchema>,
) {
  const session = await requireTenantResourceProofSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const parsed = requestTenantResourceGuardedWritePilotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: session.english ? "Invalid pilot request" : "试点请求参数不合法",
    };
  }

  const settingsData = await getSettingsData(session.workspace.id, session.user.id);
  const detail =
    settingsData.tenantResourceEvidenceDetails.find(
      (item) => item.resource.resourceKey === parsed.data.resourceKey,
    ) ?? null;
  const pilot =
    settingsData.tenantResourceGuardedWritePilotReadouts.find(
      (item) => item.resourceKey === parsed.data.resourceKey,
    ) ?? null;

  if (!detail || !pilot) {
    return {
      ok: false,
      error:
        session.english ? "Tenant resource pilot detail not found" : "租户资源试点明细不存在",
    };
  }

  if (!pilot.requestable || !pilot.proofId) {
    return {
      ok: false,
      error:
        session.english
          ? "Guarded write pilot is not requestable for this resource"
          : "当前资源还不能发起受控写回试点",
    };
  }

  try {
    await requestTenantResourceGuardedWritePilot({
      workspaceId: session.workspace.id,
      actorUserId: session.user.id,
      actorName: session.user.name,
      resourceKey: detail.resource.resourceKey,
      resourceName: detail.resource.resourceName,
      provider: detail.resource.provider,
      actionRef: detail.manualProof.lifecycle.actionRef,
      proofId: pilot.proofId,
      evidenceRefs: detail.evidenceItems.map((item) => item.evidenceRef),
      note: parsed.data.note,
      sourcePage: "/settings?tab=connectors",
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : session.english
            ? "Pilot request failed"
            : "试点请求失败",
    };
  }

  revalidateTenantResourceGovernancePaths();
  return { ok: true };
}

const reviewTenantResourceGuardedWritePilotSchema = z.object({
  pilotId: z.string().trim().min(1),
  mode: z.enum(["approve", "reject"]),
  note: z.string().trim().max(1000).optional(),
});

export async function reviewTenantResourceGuardedWritePilotAction(
  input: z.infer<typeof reviewTenantResourceGuardedWritePilotSchema>,
) {
  const session = await requireTenantResourceProofSession("review");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const parsed = reviewTenantResourceGuardedWritePilotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: session.english ? "Invalid pilot review" : "试点复核参数不合法",
    };
  }

  if (
    parsed.data.mode === "reject" &&
    (!parsed.data.note || parsed.data.note.trim().length < 8)
  ) {
    return {
      ok: false,
      error:
        session.english
          ? "Rejecting the pilot requires a short reason"
          : "拒绝试点时需要填写简短原因",
    };
  }

  try {
    await reviewTenantResourceGuardedWritePilot({
      workspaceId: session.workspace.id,
      reviewerId: session.user.id,
      reviewerName: session.user.name,
      pilotId: parsed.data.pilotId,
      mode: parsed.data.mode,
      note: parsed.data.note,
      sourcePage: "/settings?tab=connectors",
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : session.english
            ? "Pilot review failed"
            : "试点复核失败",
    };
  }

  revalidateTenantResourceGovernancePaths();
  return { ok: true };
}

const acknowledgeTenantResourceGuardedWritePilotSchema = z.object({
  pilotId: z.string().trim().min(1),
  note: z.string().trim().max(1000).optional(),
});

export async function acknowledgeTenantResourceGuardedWritePilotAction(
  input: z.infer<typeof acknowledgeTenantResourceGuardedWritePilotSchema>,
) {
  const session = await requireTenantResourceProofSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const parsed = acknowledgeTenantResourceGuardedWritePilotSchema.safeParse(
    input,
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: session.english ? "Invalid pilot 已确认" : "试点确认参数不合法",
    };
  }

  try {
    await acknowledgeTenantResourceGuardedWritePilot({
      workspaceId: session.workspace.id,
      actorUserId: session.user.id,
      actorName: session.user.name,
      pilotId: parsed.data.pilotId,
      note: parsed.data.note,
      sourcePage: "/settings?tab=connectors",
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : session.english
            ? "Pilot 已确认 failed"
            : "试点确认失败",
    };
  }

  revalidateTenantResourceGovernancePaths();
  return { ok: true };
}
