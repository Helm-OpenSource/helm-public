import { IdentityMatchStatus, MembershipStatus, MemoryStatus } from "@prisma/client";
import { subDays } from "date-fns";
import { PAYMENT_WEBHOOK_CALLBACK_STATUS } from "@/lib/auth/payment-webhook-callback-types";
import type { PaymentWebhookCallbackStatus } from "@/lib/auth/payment-webhook-callback-types";
import { BILLING_WEBHOOK_GOVERNANCE_AUDIT_ACTION_TYPES } from "@/lib/auth/payment-webhook-governance";
import {
  AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES,
  AUTH_SESSION_REVOKE_SCOPES,
  AUTH_SESSION_SCOPE_REVOKED_AUDIT_ACTION,
  AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION,
  buildAuthSessionRevokeConsistencySummary,
  buildAuthSessionRevokePreviewVsExecutedDelta,
  buildAuthSessionRevokeScopePreview,
  type AuthSessionRevokeConsistencyItem,
  type AuthSessionRevokeScopeExecutionDeltaItem,
  type AuthSessionRevokeScope,
  type AuthSessionRevokeScopePreviewItem,
} from "@/lib/auth/session";
import {
  buildAuthSessionAnomalyInventorySummary,
  listAuthSessionAnomalyScopes,
  hasAuthSessionMissingSourcePage,
  hasAuthSessionMissingWorkspaceSwitchMarker,
  hasAuthSessionProviderSourceMismatch,
  hasAuthSessionWorkspaceMembershipMismatch,
  isAuthSessionExpiringSoon,
  isAuthSessionStale,
  type AuthSessionAnomalyScope,
} from "@/lib/auth/session-governance";
import { db } from "@/lib/db";
export {
  canExportWorkspaceAdminSupportPack as canExportAdminSupportPack,
  getAdminSupportPackExportDeniedMessage,
} from "@/lib/auth/settings-governance";
import { safeParseJson } from "@/lib/utils";
import { getEnabledFeatureFlagCount, parseWorkspaceFeatureFlags } from "@/lib/workspace-ops";

export const ORG_ADMIN_AUDIT_ACTION_TYPES = [
  "ORGANIZATION_CREATED",
  "ORGANIZATION_MEMBER_ADDED",
  "ORGANIZATION_MEMBER_LIFECYCLE_UPDATED",
  "ORGANIZATION_MEMBER_ROLE_UPDATED",
  "ORGANIZATION_OWNERSHIP_TRANSFERRED",
] as const;

export const MEMBERSHIP_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "ORGANIZATION_MEMBER_ADDED",
  "ORGANIZATION_MEMBER_LIFECYCLE_UPDATED",
  "ORGANIZATION_MEMBER_ROLE_UPDATED",
  "ORGANIZATION_OWNERSHIP_TRANSFERRED",
] as const;

export const AUTH_SESSION_AUDIT_ACTION_TYPES = [
  "AUTH_SESSION_CREATED",
  "AUTH_SESSION_ROTATED",
  "AUTH_SESSION_REVOKED",
  AUTH_SESSION_SCOPE_REVOKED_AUDIT_ACTION,
  AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION,
  "AUTH_SESSION_WORKSPACE_SWITCHED",
] as const;

export const MEMORY_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "MEMORY_SUMMARY_EXPORTED",
  "MEMORY_FACT_CREATED",
  "MEMORY_ADDED",
  "MEMORY_CORRECTED",
  "MEMORY_DELETED",
  "MEMORY_FACT_CONFIRMED",
  "MEMORY_FACT_CORRECTED",
  "MEMORY_FACT_INVALIDATED",
  "MEMORY_FACT_DELETED",
  "COMMITMENT_CREATED",
  "COMMITMENT_STATUS_UPDATED",
  "BLOCKER_CREATED",
  "BLOCKER_RESOLVED",
  "BLOCKER_STATUS_UPDATED",
  "MEETING_MEMORY_PROCESSED",
] as const;

export const CONNECTOR_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "CONNECTOR_CONNECTED",
  "CONNECTOR_SYNC_COMPLETED",
  "CONNECTOR_DISCONNECTED",
  "DINGTALK_OAUTH_CALLBACK_SUCCEEDED",
  "DINGTALK_OAUTH_CALLBACK_FAILED",
  "DINGTALK_OAUTH_CALLBACK_UNRESOLVED",
  "DINGTALK_OAUTH_CALLBACK_MISMATCH",
  "DINGTALK_READONLY_INGEST_SUCCEEDED",
  "DINGTALK_READONLY_INGEST_PARTIAL",
  "DINGTALK_READONLY_INGEST_FAILED",
  "DINGTALK_READONLY_INGEST_UNRESOLVED",
  "FEISHU_OAUTH_CALLBACK_SUCCEEDED",
  "FEISHU_OAUTH_CALLBACK_FAILED",
  "FEISHU_OAUTH_CALLBACK_UNRESOLVED",
  "FEISHU_OAUTH_CALLBACK_MISMATCH",
  "FEISHU_READONLY_INGEST_SUCCEEDED",
  "FEISHU_READONLY_INGEST_PARTIAL",
  "FEISHU_READONLY_INGEST_FAILED",
  "FEISHU_READONLY_INGEST_UNRESOLVED",
] as const;

export const IMPORT_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "CSV_IMPORT_COMPLETED",
  "CRM_IMPORT_COMPLETED",
  "IMPORT_WARMUP_COMPLETED",
  "IMPORT_CONFLICT_RESOLVED",
  "IMPORT_SOURCE_CONNECTED",
  "IMPORT_SOURCE_DISCONNECTED",
] as const;

export const WORKSPACE_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "WORKSPACE_OPERATIONAL_CONTROLS_UPDATED",
  "WORKSPACE_SETUP_COMPLETED",
  "POLICY_UPDATED",
  "POLICY_RESTORED_DEFAULTS",
] as const;

export const WORKSPACE_DATA_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "CONTACT_CREATED",
  "MEETING_CREATED",
  "OPPORTUNITY_CREATED",
  "OPPORTUNITY_UPDATED",
  "OPPORTUNITY_STAGE_CHANGED",
  "OPPORTUNITY_NEXT_ACTION_UPDATED",
  "OPPORTUNITY_OWNER_CHANGED",
  "OPPORTUNITY_BULK_UPDATED",
  "THREAD_LINKED_TO_OPPORTUNITY",
  "THREAD_UPGRADED_TO_OPPORTUNITY",
  "THREAD_REMINDER_SET",
  "CONTACT_LINKED_TO_OPPORTUNITY",
  "CONTACT_MERGED",
  "CONTACT_ARCHIVED",
  "COMPANY_QUICK_OPPORTUNITY_CREATED",
] as const;

export const INTERNAL_ACTION_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "CUSTOMER_SUCCESS_INTERNAL_ACTION_APPROVED",
  "CUSTOMER_SUCCESS_INTERNAL_ACTION_EXECUTED",
] as const;

export const ACTION_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "AI_GENERATED_ACTION",
  "ACTION_EXECUTED",
  "APPROVAL_APPROVED",
  "APPROVAL_REJECTED",
  "APPROVAL_CONVERTED_TO_MANUAL",
  "POLICY_AUTO_EXECUTE_ENABLED",
  "MEETING_ACTION_ITEMS_GENERATED",
  "MEETING_ACTION_ITEM_UPDATED",
  "HELM_V2_HUMAN_ACTION_EXECUTION_READY",
  "HELM_V2_HUMAN_ACTION_EXECUTION_ACKNOWLEDGED",
  "HELM_V2_OFFICIAL_WRITE_INTENT_CREATED",
  "HELM_V2_LIMITED_AUTO_INTENT_SYNCED",
  "HELM_V2_OFFICIAL_FOLLOWTHROUGH_SYNCED",
  "HELM_V2_OFFICIAL_FOLLOWTHROUGH_UPDATED",
  "HELM_V2_LIMITED_AUTO_EXECUTED",
  "HELM_V2_LIMITED_AUTO_REVIEWED",
  "HELM_V2_OFFICIAL_WRITE_INTENT_REVIEWED",
  "HELM_V2_OFFICIAL_WRITE_ATTEMPTED",
  "HELM_V2_OFFICIAL_WRITE_ACKNOWLEDGED",
] as const;

export const INSIGHT_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "WEEKLY_REPORT_GENERATED",
  "RECOMMENDATION_FEEDBACK_SUBMITTED",
  "STRATEGY_SUGGESTION_ACCEPTED",
  "STRATEGY_SUGGESTION_DISMISSED",
] as const;

export const BILLING_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "BILLING_CHECKOUT_CREATED",
  "BILLING_PORTAL_OPENED",
  "BILLING_STATUS_SYNCED",
] as const;

export const CONTRIBUTION_REGISTRY_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "WORKER_PUBLISHER_PROFILE_CREATED",
  "WORKER_PUBLISHER_PROFILE_STATUS_UPDATED",
  "SALES_REFERRAL_CREATED",
  "SALES_REFERRAL_STATUS_UPDATED",
  "CUSTOM_ENGAGEMENT_CREATED",
  "CUSTOM_ENGAGEMENT_STATUS_UPDATED",
  "BENEFICIARY_PAYOUT_PROFILE_CREATED",
  "BENEFICIARY_PAYOUT_PROFILE_STATUS_UPDATED",
] as const;

export const PARTICIPANT_PORTAL_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "CONTRIBUTOR_PORTAL_ACCESS_ISSUED",
  "CONTRIBUTOR_PORTAL_ACCESS_STATUS_UPDATED",
  "CONTRIBUTOR_PORTAL_ONBOARDED",
  "CONTRIBUTOR_PORTAL_PROFILE_UPDATED",
] as const;

export const PROGRAM_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "PROGRAM_APPLICATION_SUBMITTED",
  "PROGRAM_APPLICATION_REVIEWED",
  "PROGRAM_APPLICATION_INVITE_ISSUED",
] as const;

export const ORGANIZATION_SUPPORT_PACK_EXPORTED = "ORGANIZATION_SUPPORT_PACK_EXPORTED";

export const SETTLEMENT_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "SETTLEMENT_BATCH_CREATED",
  "SETTLEMENT_BATCH_APPROVED",
  "SETTLEMENT_BATCH_EXPORTED",
  "SETTLEMENT_LINE_MARKED_PAID",
  "SETTLEMENT_LINE_REVERSED",
  "SETTLEMENT_BATCH_CLOSED",
] as const;

export const DATA_EXPORT_AUDIT_ACTION_TYPES = [
  "MEMORY_SUMMARY_EXPORTED",
  ...SETTLEMENT_GOVERNANCE_AUDIT_ACTION_TYPES,
  ORGANIZATION_SUPPORT_PACK_EXPORTED,
] as const;

export const DATA_DELETE_AUDIT_ACTION_TYPES = [
  "MEMORY_DELETED",
  "MEMORY_FACT_DELETED",
] as const;

export const RETENTION_GOVERNANCE_AUDIT_ACTION_TYPES = [
  "WORKSPACE_OPERATIONAL_CONTROLS_UPDATED",
] as const;

export const DATA_GOVERNANCE_AUDIT_ACTION_TYPES = [
  ...AUTH_SESSION_AUDIT_ACTION_TYPES,
  ...MEMORY_GOVERNANCE_AUDIT_ACTION_TYPES,
  ...BILLING_GOVERNANCE_AUDIT_ACTION_TYPES,
  ...BILLING_WEBHOOK_GOVERNANCE_AUDIT_ACTION_TYPES,
  ...CONTRIBUTION_REGISTRY_GOVERNANCE_AUDIT_ACTION_TYPES,
  ...PARTICIPANT_PORTAL_GOVERNANCE_AUDIT_ACTION_TYPES,
  ...CONNECTOR_GOVERNANCE_AUDIT_ACTION_TYPES,
  ...IMPORT_GOVERNANCE_AUDIT_ACTION_TYPES,
  ...WORKSPACE_GOVERNANCE_AUDIT_ACTION_TYPES,
  ...WORKSPACE_DATA_GOVERNANCE_AUDIT_ACTION_TYPES,
  ...INTERNAL_ACTION_GOVERNANCE_AUDIT_ACTION_TYPES,
  ...ACTION_GOVERNANCE_AUDIT_ACTION_TYPES,
  ...INSIGHT_GOVERNANCE_AUDIT_ACTION_TYPES,
  ...SETTLEMENT_GOVERNANCE_AUDIT_ACTION_TYPES,
  ...PROGRAM_GOVERNANCE_AUDIT_ACTION_TYPES,
  ORGANIZATION_SUPPORT_PACK_EXPORTED,
] as const;

type GovernanceAuditRecord = {
  id: string;
  actor: string;
  actionType: string;
  summary: string;
  targetType: string;
  targetId: string;
  createdAt: Date;
  payload: unknown;
  sourcePage: string | null;
};

type GovernanceAuditMarker = {
  createdAt: Date;
  actionType: string;
  summary: string;
  actor: string;
  targetType: string;
  targetId: string;
  sourcePage: string | null;
} | null;

type WebhookCallbackMarker = {
  recordedAt: Date;
  governanceStatus: string;
  summary: string;
  provider: string;
  callbackMode: string;
  resolutionSource: string | null;
  hintSource: string | null;
  hintWorkspaceId: string | null;
  workspaceScoped: boolean;
} | null;

type AuthSessionAnomalyMarker = {
  recordedAt: Date;
  sessionId: string;
  activeWorkspaceId: string | null;
  sourcePage: string | null;
  providerType: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
  anomalyScopes: AuthSessionAnomalyScope[];
} | null;

const AUTH_CONTROL_CONSISTENCY_OVERVIEW_STATUSES = {
  CLEAR: "CLEAR",
  REVIEW_ONLY: "REVIEW_ONLY",
  ACTIONABLE: "ACTIONABLE",
  DRIFT: "DRIFT",
} as const;

type AuthControlConsistencyOverviewStatus =
  (typeof AUTH_CONTROL_CONSISTENCY_OVERVIEW_STATUSES)[keyof typeof AUTH_CONTROL_CONSISTENCY_OVERVIEW_STATUSES];

const AUTH_CONTROL_FOLLOW_THROUGH_STATUSES = {
  CLEAR: "CLEAR",
  PENDING: "PENDING",
  CURRENT: "CURRENT",
  STALE: "STALE",
} as const;

type AuthControlFollowThroughStatus =
  (typeof AUTH_CONTROL_FOLLOW_THROUGH_STATUSES)[keyof typeof AUTH_CONTROL_FOLLOW_THROUGH_STATUSES];

type AuthControlConsistencyOverview = {
  consistencyStatus: AuthControlConsistencyOverviewStatus;
  followThroughStatus: AuthControlFollowThroughStatus;
  reviewOnlyScopeCount: number;
  bulkRevocableScopeCount: number;
  driftScopeCount: number;
  currentSessionProtectedScopeCount: number;
  latestDetectedAt: Date | null;
  latestMarkerScopeCount: number;
  latestFollowThroughActionType: string | null;
  latestFollowThroughRecordedAt: Date | null;
  latestFollowThroughSourcePage: string | null;
};

type LatestAuthSessionAnomalyFollowThroughSummary = {
  status: AuthControlConsistencyOverviewStatus;
  followThroughStatus: AuthControlFollowThroughStatus;
  reviewOnlyScopeCount: number;
  bulkRevocableScopeCount: number;
  driftScopeCount: number;
  currentSessionProtectedScopeCount: number;
  latestMarkerRecordedAt: Date | null;
  latestMarkerScopeCount: number;
  latestFollowThroughActionType: string | null;
  latestFollowThroughRecordedAt: Date | null;
  latestFollowThroughSourcePage: string | null;
};

type LatestMarkerCoverageSummary = {
  status: AuthControlConsistencyOverviewStatus;
  followThroughStatus: AuthControlFollowThroughStatus;
  stillDetectedScopeCount: number;
  resolvedScopeCount: number;
  newlyDetectedScopeCount: number;
  reviewOnlyScopeCount: number;
  bulkRevocableScopeCount: number;
  driftScopeCount: number;
  currentSessionProtectedScopeCount: number;
  latestMarkerRecordedAt: Date | null;
  latestMarkerScopeCount: number;
  latestFollowThroughActionType: string | null;
  latestFollowThroughRecordedAt: Date | null;
  latestFollowThroughSourcePage: string | null;
};

type RevokeExecutionAggregateSummary = {
  status: AuthControlConsistencyOverviewStatus;
  liveEligibleSessionCount: number;
  lastExecutedEligibleSessionCount: number;
  lastExecutedRevokedSessionCount: number;
  executionShortfallCount: number;
  previewEligibleDeltaCount: number;
  reviewOnlyScopeCount: number;
  bulkRevocableScopeCount: number;
  driftScopeCount: number;
  currentSessionProtectedScopeCount: number;
  latestExecutedAt: Date | null;
};

type DataGovernanceClosure = {
  exportScopedToWorkspace: boolean;
  deleteScopedToWorkspace: boolean;
  retentionScopedToWorkspace: boolean;
  supportPackScopedToWorkspace: boolean;
  sensitiveWriteTenantOwnershipGuarded: boolean;
  latestExportOwner: string | null;
  latestDeleteOwner: string | null;
  latestRetentionOwner: string | null;
  latestSupportPackOwner: string | null;
  latestExportSourcePage: string | null;
  latestDeleteSourcePage: string | null;
  latestRetentionSourcePage: string | null;
  latestSupportPackSourcePage: string | null;
};

function mapAuditRecord(input: {
  id: string;
  actor: string;
  actionType: string;
  summary: string;
  targetType: string;
  targetId: string;
  createdAt: Date;
  payload: string | null;
  sourcePage: string | null;
}): GovernanceAuditRecord {
  return {
    id: input.id,
    actor: input.actor,
    actionType: input.actionType,
    summary: input.summary,
    targetType: input.targetType,
    targetId: input.targetId,
    createdAt: input.createdAt,
    payload: safeParseJson(input.payload, null),
    sourcePage: input.sourcePage,
  };
}

function countAuditActions(workspaceId: string, actionTypes: readonly string[], thirtyDaysAgo: Date) {
  return db.auditLog.count({
    where: {
      workspaceId,
      actionType: { in: [...actionTypes] },
      createdAt: { gte: thirtyDaysAgo },
    },
  });
}

function findLatestAuditMarker(workspaceId: string, actionTypes: readonly string[]) {
  return db.auditLog.findFirst({
    where: {
      workspaceId,
      actionType: { in: [...actionTypes] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      actionType: true,
      summary: true,
      actor: true,
      targetType: true,
      targetId: true,
      sourcePage: true,
    },
  });
}

function findLatestWebhookCallbackMarker(input: {
  workspaceScoped: boolean;
  where: {
    workspaceId?: string | null;
    hintWorkspaceId?: string | null;
    governanceStatus?: PaymentWebhookCallbackStatus;
    duplicateReceptionCount?: { gt: number };
    actionType?: string;
  };
}) {
  return db.paymentWebhookCallbackEvent
    .findFirst({
      where: input.where,
      orderBy: { updatedAt: "desc" },
      select: {
        provider: true,
        callbackMode: true,
        governanceStatus: true,
        actionType: true,
        summary: true,
        resolutionSource: true,
        hintSource: true,
        hintWorkspaceId: true,
        processedAt: true,
        lastDuplicateAt: true,
        updatedAt: true,
      },
    })
    .then((item) =>
      item
        ? {
            recordedAt: item.lastDuplicateAt ?? item.processedAt ?? item.updatedAt,
            governanceStatus: item.governanceStatus,
            summary: item.summary,
            provider: item.provider,
            callbackMode: item.callbackMode,
            resolutionSource: item.resolutionSource ?? null,
            hintSource: item.hintSource ?? null,
            hintWorkspaceId: item.hintWorkspaceId ?? null,
            workspaceScoped: input.workspaceScoped,
          }
        : null,
    );
}

function findLatestIdentityMatchMarker(workspaceId: string) {
  return db.identityMatch.findFirst({
    where: {
      workspaceId,
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      status: true,
      matchReason: true,
      externalType: true,
      externalId: true,
      internalObjectType: true,
      internalObjectId: true,
      matchScore: true,
    },
  });
}

function buildLatestAuthSessionAnomalyMarker(
  activeAuthSessions: Array<{
    id: string;
    activeWorkspaceId: string | null;
    sourcePage: string | null;
    providerType: string | null;
    lastSeenAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
      memberships: Array<{
        workspaceId: string;
        status: MembershipStatus;
      }>;
    };
    lastWorkspaceSwitchAt: Date | null;
    expiresAt: Date;
  }>,
  now: Date,
): AuthSessionAnomalyMarker {
  const latestAnomalousSession = activeAuthSessions.find(
    (session) => listAuthSessionAnomalyScopes(session, now).length > 0,
  );

  if (!latestAnomalousSession) {
    return null;
  }

  return {
    recordedAt: latestAnomalousSession.lastSeenAt,
    sessionId: latestAnomalousSession.id,
    activeWorkspaceId: latestAnomalousSession.activeWorkspaceId,
    sourcePage: latestAnomalousSession.sourcePage,
    providerType: latestAnomalousSession.providerType,
    user: {
      id: latestAnomalousSession.user.id,
      name: latestAnomalousSession.user.name,
      email: latestAnomalousSession.user.email,
    },
    anomalyScopes: listAuthSessionAnomalyScopes(latestAnomalousSession, now),
  };
}

async function listWorkspaceActiveAuthSessions(workspaceId: string, now: Date) {
  const authSessions = await db.authSession.findMany({
    where: {
      activeWorkspaceId: workspaceId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    select: {
      id: true,
      userId: true,
      activeWorkspaceId: true,
      sourcePage: true,
      providerType: true,
      createdAt: true,
      lastSeenAt: true,
      lastWorkspaceSwitchAt: true,
      expiresAt: true,
    },
    orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
  });
  const userIds = [...new Set(authSessions.map((item) => item.userId).filter(Boolean))];
  if (userIds.length === 0) {
    return [] as Array<{
      id: string;
      activeWorkspaceId: string;
      sourcePage: string | null;
      providerType: string | null;
      createdAt: Date;
      lastSeenAt: Date;
      lastWorkspaceSwitchAt: Date | null;
      expiresAt: Date;
      user: {
        id: string;
        name: string;
        email: string;
        memberships: Array<{
          workspaceId: string;
          status: MembershipStatus;
        }>;
      };
    }>;
  }

  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      name: true,
      email: true,
      memberships: {
        where: { workspaceId },
        select: {
          workspaceId: true,
          status: true,
        },
      },
    },
  });
  const userById = new Map(users.map((item) => [item.id, item]));
  const activeAuthSessions = authSessions.flatMap((authSession) => {
    const user = userById.get(authSession.userId);
    if (!user) {
      return [];
    }

    return [
      {
        id: authSession.id,
        activeWorkspaceId: authSession.activeWorkspaceId,
        sourcePage: authSession.sourcePage,
        providerType: authSession.providerType,
        createdAt: authSession.createdAt,
        lastSeenAt: authSession.lastSeenAt,
        lastWorkspaceSwitchAt: authSession.lastWorkspaceSwitchAt,
        expiresAt: authSession.expiresAt,
        user,
      },
    ];
  });

  if (activeAuthSessions.length !== authSessions.length) {
    console.warn("[org-admin-governance] skipped auth sessions with missing user references", {
      workspaceId,
      skippedCount: authSessions.length - activeAuthSessions.length,
    });
  }

  return activeAuthSessions;
}

function isAuthSessionRevokeScope(value: unknown): value is AuthSessionRevokeScope {
  return (
    typeof value === "string" &&
    Object.values(AUTH_SESSION_REVOKE_SCOPES).includes(value as AuthSessionRevokeScope)
  );
}

function summarizeScopedSessionRevokeAudits(auditRows: Array<{ createdAt: Date; payload: string | null }>) {
  const scopeOrder = Object.values(AUTH_SESSION_REVOKE_SCOPES);
  const summaryByScope = new Map<
    AuthSessionRevokeScope,
    {
      scope: AuthSessionRevokeScope;
      actionCount: number;
      revokedSessionCount: number;
    }
  >();
  let scopeRevokedSessionCount30d = 0;

  for (const auditRow of auditRows) {
    const payload = safeParseJson(auditRow.payload, null);
    if (!payload || typeof payload !== "object") {
      continue;
    }

    const rawPayload = payload as Record<string, unknown>;
    const scope = rawPayload.scope;
    if (!isAuthSessionRevokeScope(scope)) {
      continue;
    }

    const revokedCount =
      typeof rawPayload.revokedCount === "number" && Number.isFinite(rawPayload.revokedCount)
        ? Math.max(0, rawPayload.revokedCount)
        : 0;

    const existing = summaryByScope.get(scope) ?? {
      scope,
      actionCount: 0,
      revokedSessionCount: 0,
    };
    existing.actionCount += 1;
    existing.revokedSessionCount += revokedCount;
    scopeRevokedSessionCount30d += revokedCount;
    summaryByScope.set(scope, existing);
  }

  return {
    scopeRevokeActionCount30d: auditRows.length,
    scopeRevokedSessionCount30d,
    revokeScopeSummary30d: scopeOrder
      .map((scope) => summaryByScope.get(scope))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  };
}

function buildDataGovernanceClosure(input: {
  latestExportAudit: GovernanceAuditMarker;
  latestDeleteAudit: GovernanceAuditMarker;
  latestRetentionAudit: GovernanceAuditMarker;
  latestSupportPackAudit: GovernanceAuditMarker;
  workspaceIsolationAssertions: {
    memoryExportScopedToWorkspace: boolean;
    supportPackExportScopedToWorkspace: boolean;
    deleteActionsScopedToWorkspace: boolean;
    retentionControlsScopedToWorkspace: boolean;
    sensitiveWriteRoutesRequireTenantOwnership: boolean;
  };
}): DataGovernanceClosure {
  return {
    exportScopedToWorkspace: input.workspaceIsolationAssertions.memoryExportScopedToWorkspace,
    deleteScopedToWorkspace: input.workspaceIsolationAssertions.deleteActionsScopedToWorkspace,
    retentionScopedToWorkspace: input.workspaceIsolationAssertions.retentionControlsScopedToWorkspace,
    supportPackScopedToWorkspace: input.workspaceIsolationAssertions.supportPackExportScopedToWorkspace,
    sensitiveWriteTenantOwnershipGuarded:
      input.workspaceIsolationAssertions.sensitiveWriteRoutesRequireTenantOwnership,
    latestExportOwner: input.latestExportAudit?.actor ?? null,
    latestDeleteOwner: input.latestDeleteAudit?.actor ?? null,
    latestRetentionOwner: input.latestRetentionAudit?.actor ?? null,
    latestSupportPackOwner: input.latestSupportPackAudit?.actor ?? null,
    latestExportSourcePage: input.latestExportAudit?.sourcePage ?? null,
    latestDeleteSourcePage: input.latestDeleteAudit?.sourcePage ?? null,
    latestRetentionSourcePage: input.latestRetentionAudit?.sourcePage ?? null,
    latestSupportPackSourcePage: input.latestSupportPackAudit?.sourcePage ?? null,
  };
}

function resolveLatestAuthSessionFollowThroughMarker(input: {
  latestScopedSessionRevokeAudit: GovernanceAuditMarker;
  latestWorkspaceRealignmentAudit: GovernanceAuditMarker;
  latestAuthSessionAnomalyFollowThroughAudit: GovernanceAuditMarker;
}) {
  return [
    input.latestScopedSessionRevokeAudit,
    input.latestWorkspaceRealignmentAudit,
    input.latestAuthSessionAnomalyFollowThroughAudit,
  ]
    .filter((marker): marker is NonNullable<typeof marker> => Boolean(marker))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;
}

function resolveAuthControlFollowThroughStatus(input: {
  latestDetectedAt: Date | null;
  latestFollowThroughMarker: GovernanceAuditMarker;
}) {
  if (!input.latestDetectedAt) {
    return AUTH_CONTROL_FOLLOW_THROUGH_STATUSES.CLEAR;
  }

  if (!input.latestFollowThroughMarker) {
    return AUTH_CONTROL_FOLLOW_THROUGH_STATUSES.PENDING;
  }

  if (input.latestFollowThroughMarker.createdAt.getTime() < input.latestDetectedAt.getTime()) {
    return AUTH_CONTROL_FOLLOW_THROUGH_STATUSES.STALE;
  }

  return AUTH_CONTROL_FOLLOW_THROUGH_STATUSES.CURRENT;
}

function resolveAuthControlConsistencyStatus(input: {
  reviewOnlyScopeCount: number;
  bulkRevocableScopeCount: number;
  driftScopeCount: number;
  currentSessionProtectedScopeCount: number;
}): AuthControlConsistencyOverviewStatus {
  if (input.driftScopeCount > 0) {
    return AUTH_CONTROL_CONSISTENCY_OVERVIEW_STATUSES.DRIFT;
  }
  if (input.bulkRevocableScopeCount > 0) {
    return AUTH_CONTROL_CONSISTENCY_OVERVIEW_STATUSES.ACTIONABLE;
  }
  if (input.reviewOnlyScopeCount > 0 || input.currentSessionProtectedScopeCount > 0) {
    return AUTH_CONTROL_CONSISTENCY_OVERVIEW_STATUSES.REVIEW_ONLY;
  }

  return AUTH_CONTROL_CONSISTENCY_OVERVIEW_STATUSES.CLEAR;
}

function buildAuthControlConsistencyOverview(input: {
  anomalyInventorySummary: Array<{
    scope: AuthSessionAnomalyScope;
    activeSessionCount: number;
    managementMode: "REVIEW_ONLY" | "BULK_REVOKE";
    revocableSessionCount: number;
    currentSessionProtected: boolean;
    latestDetectedAt: Date | null;
  }>;
  liveRevokeScopeSummary: AuthSessionRevokeScopePreviewItem[];
  revokeConsistencySummary: AuthSessionRevokeConsistencyItem[];
  latestAnomalyMarker: AuthSessionAnomalyMarker;
  latestScopedSessionRevokeAudit: GovernanceAuditMarker;
  latestWorkspaceRealignmentAudit: GovernanceAuditMarker;
  latestAuthSessionAnomalyFollowThroughAudit: GovernanceAuditMarker;
}): AuthControlConsistencyOverview {
  const reviewOnlyScopeSet = new Set<string>();
  const bulkRevocableScopeSet = new Set<string>();
  const driftScopeSet = new Set<string>();
  const currentSessionProtectedScopeSet = new Set<string>();

  for (const item of input.anomalyInventorySummary) {
    if (item.activeSessionCount > 0 && item.managementMode === "REVIEW_ONLY") {
      reviewOnlyScopeSet.add(item.scope);
    }
    if (item.currentSessionProtected) {
      currentSessionProtectedScopeSet.add(item.scope);
    }
  }

  for (const item of input.liveRevokeScopeSummary) {
    if (item.eligibleSessionCount > 0) {
      bulkRevocableScopeSet.add(item.scope);
    }
    if (item.currentSessionProtected) {
      currentSessionProtectedScopeSet.add(item.scope);
    }
  }

  for (const item of input.revokeConsistencySummary) {
    if (item.status === AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.REVIEW_ONLY) {
      reviewOnlyScopeSet.add(item.scope);
    }
    if (item.status === AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.REVOCABLE) {
      bulkRevocableScopeSet.add(item.scope);
    }
    if (item.status === AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.DRIFT) {
      driftScopeSet.add(item.scope);
    }
    if (item.currentSessionProtected) {
      currentSessionProtectedScopeSet.add(item.scope);
    }
  }

  const latestDetectedAt =
    input.latestAnomalyMarker?.recordedAt ??
    input.anomalyInventorySummary
      .map((item) => item.latestDetectedAt)
      .filter((value): value is Date => value instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ??
    null;

  const latestFollowThroughMarker = resolveLatestAuthSessionFollowThroughMarker({
    latestScopedSessionRevokeAudit: input.latestScopedSessionRevokeAudit,
    latestWorkspaceRealignmentAudit: input.latestWorkspaceRealignmentAudit,
    latestAuthSessionAnomalyFollowThroughAudit:
      input.latestAuthSessionAnomalyFollowThroughAudit,
  });

  const followThroughStatus = resolveAuthControlFollowThroughStatus({
    latestDetectedAt,
    latestFollowThroughMarker,
  });

  return {
    consistencyStatus: resolveAuthControlConsistencyStatus({
      reviewOnlyScopeCount: reviewOnlyScopeSet.size,
      bulkRevocableScopeCount: bulkRevocableScopeSet.size,
      driftScopeCount: driftScopeSet.size,
      currentSessionProtectedScopeCount: currentSessionProtectedScopeSet.size,
    }),
    followThroughStatus,
    reviewOnlyScopeCount: reviewOnlyScopeSet.size,
    bulkRevocableScopeCount: bulkRevocableScopeSet.size,
    driftScopeCount: driftScopeSet.size,
    currentSessionProtectedScopeCount: currentSessionProtectedScopeSet.size,
    latestDetectedAt,
    latestMarkerScopeCount: input.latestAnomalyMarker?.anomalyScopes.length ?? 0,
    latestFollowThroughActionType: latestFollowThroughMarker?.actionType ?? null,
    latestFollowThroughRecordedAt: latestFollowThroughMarker?.createdAt ?? null,
    latestFollowThroughSourcePage: latestFollowThroughMarker?.sourcePage ?? null,
  };
}

function buildLatestAuthSessionAnomalyFollowThroughSummary(input: {
  anomalyInventorySummary: Array<{
    scope: AuthSessionAnomalyScope;
    activeSessionCount: number;
    managementMode: "REVIEW_ONLY" | "BULK_REVOKE";
    revocableSessionCount: number;
    currentSessionProtected: boolean;
    latestDetectedAt: Date | null;
  }>;
  liveRevokeScopeSummary: AuthSessionRevokeScopePreviewItem[];
  revokeConsistencySummary: AuthSessionRevokeConsistencyItem[];
  latestAnomalyMarker: AuthSessionAnomalyMarker;
  latestScopedSessionRevokeAudit: GovernanceAuditMarker;
  latestWorkspaceRealignmentAudit: GovernanceAuditMarker;
  latestAuthSessionAnomalyFollowThroughAudit: GovernanceAuditMarker;
}): LatestAuthSessionAnomalyFollowThroughSummary {
  const latestMarkerScopeSet = new Set(input.latestAnomalyMarker?.anomalyScopes ?? []);
  const reviewOnlyScopeSet = new Set<AuthSessionAnomalyScope>();
  const bulkRevocableScopeSet = new Set<AuthSessionAnomalyScope>();
  const driftScopeSet = new Set<AuthSessionAnomalyScope>();
  const currentSessionProtectedScopeSet = new Set<AuthSessionAnomalyScope>();

  for (const item of input.anomalyInventorySummary) {
    if (!latestMarkerScopeSet.has(item.scope)) {
      continue;
    }

    if (item.activeSessionCount > 0 && item.managementMode === "REVIEW_ONLY") {
      reviewOnlyScopeSet.add(item.scope);
    }
    if (item.currentSessionProtected) {
      currentSessionProtectedScopeSet.add(item.scope);
    }
  }

  for (const item of input.liveRevokeScopeSummary) {
    if (!latestMarkerScopeSet.has(item.scope as AuthSessionAnomalyScope)) {
      continue;
    }

    if (item.eligibleSessionCount > 0) {
      bulkRevocableScopeSet.add(item.scope as AuthSessionAnomalyScope);
    }
    if (item.currentSessionProtected) {
      currentSessionProtectedScopeSet.add(item.scope as AuthSessionAnomalyScope);
    }
  }

  for (const item of input.revokeConsistencySummary) {
    if (!latestMarkerScopeSet.has(item.scope as AuthSessionAnomalyScope)) {
      continue;
    }

    if (item.status === AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.REVIEW_ONLY) {
      reviewOnlyScopeSet.add(item.scope as AuthSessionAnomalyScope);
    }
    if (item.status === AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.REVOCABLE) {
      bulkRevocableScopeSet.add(item.scope as AuthSessionAnomalyScope);
    }
    if (item.status === AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.DRIFT) {
      driftScopeSet.add(item.scope as AuthSessionAnomalyScope);
    }
    if (item.currentSessionProtected) {
      currentSessionProtectedScopeSet.add(item.scope as AuthSessionAnomalyScope);
    }
  }

  const latestFollowThroughMarker = resolveLatestAuthSessionFollowThroughMarker({
    latestScopedSessionRevokeAudit: input.latestScopedSessionRevokeAudit,
    latestWorkspaceRealignmentAudit: input.latestWorkspaceRealignmentAudit,
    latestAuthSessionAnomalyFollowThroughAudit:
      input.latestAuthSessionAnomalyFollowThroughAudit,
  });

  const status = resolveAuthControlConsistencyStatus({
    reviewOnlyScopeCount: reviewOnlyScopeSet.size,
    bulkRevocableScopeCount: bulkRevocableScopeSet.size,
    driftScopeCount: driftScopeSet.size,
    currentSessionProtectedScopeCount: currentSessionProtectedScopeSet.size,
  });

  return {
    status,
    followThroughStatus: resolveAuthControlFollowThroughStatus({
      latestDetectedAt: input.latestAnomalyMarker?.recordedAt ?? null,
      latestFollowThroughMarker,
    }),
    reviewOnlyScopeCount: reviewOnlyScopeSet.size,
    bulkRevocableScopeCount: bulkRevocableScopeSet.size,
    driftScopeCount: driftScopeSet.size,
    currentSessionProtectedScopeCount: currentSessionProtectedScopeSet.size,
    latestMarkerRecordedAt: input.latestAnomalyMarker?.recordedAt ?? null,
    latestMarkerScopeCount: input.latestAnomalyMarker?.anomalyScopes.length ?? 0,
    latestFollowThroughActionType: latestFollowThroughMarker?.actionType ?? null,
    latestFollowThroughRecordedAt: latestFollowThroughMarker?.createdAt ?? null,
    latestFollowThroughSourcePage: latestFollowThroughMarker?.sourcePage ?? null,
  };
}

function buildLatestMarkerCoverageSummary(input: {
  anomalyInventorySummary: Array<{
    scope: AuthSessionAnomalyScope;
    activeSessionCount: number;
    managementMode: "REVIEW_ONLY" | "BULK_REVOKE";
    revocableSessionCount: number;
    currentSessionProtected: boolean;
    latestDetectedAt: Date | null;
  }>;
  liveRevokeScopeSummary: AuthSessionRevokeScopePreviewItem[];
  revokeConsistencySummary: AuthSessionRevokeConsistencyItem[];
  latestAnomalyMarker: AuthSessionAnomalyMarker;
  latestScopedSessionRevokeAudit: GovernanceAuditMarker;
  latestWorkspaceRealignmentAudit: GovernanceAuditMarker;
  latestAuthSessionAnomalyFollowThroughAudit: GovernanceAuditMarker;
}): LatestMarkerCoverageSummary {
  const latestMarkerScopeSet = new Set(input.latestAnomalyMarker?.anomalyScopes ?? []);
  const currentActiveScopeSet = new Set<AuthSessionAnomalyScope>(
    input.anomalyInventorySummary
      .filter((item) => item.activeSessionCount > 0)
      .map((item) => item.scope),
  );
  const stillDetectedScopeSet = new Set<AuthSessionAnomalyScope>();
  const resolvedScopeSet = new Set<AuthSessionAnomalyScope>();
  const newlyDetectedScopeSet = new Set<AuthSessionAnomalyScope>();
  const reviewOnlyScopeSet = new Set<AuthSessionAnomalyScope>();
  const bulkRevocableScopeSet = new Set<AuthSessionAnomalyScope>();
  const driftScopeSet = new Set<AuthSessionAnomalyScope>();
  const currentSessionProtectedScopeSet = new Set<AuthSessionAnomalyScope>();

  for (const scope of latestMarkerScopeSet) {
    if (currentActiveScopeSet.has(scope)) {
      stillDetectedScopeSet.add(scope);
    } else {
      resolvedScopeSet.add(scope);
    }
  }

  for (const scope of currentActiveScopeSet) {
    if (!latestMarkerScopeSet.has(scope)) {
      newlyDetectedScopeSet.add(scope);
    }
  }

  for (const item of input.anomalyInventorySummary) {
    if (!stillDetectedScopeSet.has(item.scope)) {
      continue;
    }

    if (item.activeSessionCount > 0 && item.managementMode === "REVIEW_ONLY") {
      reviewOnlyScopeSet.add(item.scope);
    }
    if (item.currentSessionProtected) {
      currentSessionProtectedScopeSet.add(item.scope);
    }
  }

  for (const item of input.liveRevokeScopeSummary) {
    const scope = item.scope as AuthSessionAnomalyScope;
    if (!stillDetectedScopeSet.has(scope)) {
      continue;
    }

    if (item.eligibleSessionCount > 0) {
      bulkRevocableScopeSet.add(scope);
    }
    if (item.currentSessionProtected) {
      currentSessionProtectedScopeSet.add(scope);
    }
  }

  for (const item of input.revokeConsistencySummary) {
    const scope = item.scope as AuthSessionAnomalyScope;
    if (!stillDetectedScopeSet.has(scope)) {
      continue;
    }

    if (item.status === AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.REVIEW_ONLY) {
      reviewOnlyScopeSet.add(scope);
    }
    if (item.status === AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.REVOCABLE) {
      bulkRevocableScopeSet.add(scope);
    }
    if (item.status === AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.DRIFT) {
      driftScopeSet.add(scope);
    }
    if (item.currentSessionProtected) {
      currentSessionProtectedScopeSet.add(scope);
    }
  }

  const latestFollowThroughMarker = resolveLatestAuthSessionFollowThroughMarker({
    latestScopedSessionRevokeAudit: input.latestScopedSessionRevokeAudit,
    latestWorkspaceRealignmentAudit: input.latestWorkspaceRealignmentAudit,
    latestAuthSessionAnomalyFollowThroughAudit:
      input.latestAuthSessionAnomalyFollowThroughAudit,
  });

  return {
    status: resolveAuthControlConsistencyStatus({
      reviewOnlyScopeCount: reviewOnlyScopeSet.size,
      bulkRevocableScopeCount: bulkRevocableScopeSet.size,
      driftScopeCount: driftScopeSet.size,
      currentSessionProtectedScopeCount: currentSessionProtectedScopeSet.size,
    }),
    followThroughStatus: resolveAuthControlFollowThroughStatus({
      latestDetectedAt: input.latestAnomalyMarker?.recordedAt ?? null,
      latestFollowThroughMarker,
    }),
    stillDetectedScopeCount: stillDetectedScopeSet.size,
    resolvedScopeCount: resolvedScopeSet.size,
    newlyDetectedScopeCount: newlyDetectedScopeSet.size,
    reviewOnlyScopeCount: reviewOnlyScopeSet.size,
    bulkRevocableScopeCount: bulkRevocableScopeSet.size,
    driftScopeCount: driftScopeSet.size,
    currentSessionProtectedScopeCount: currentSessionProtectedScopeSet.size,
    latestMarkerRecordedAt: input.latestAnomalyMarker?.recordedAt ?? null,
    latestMarkerScopeCount: input.latestAnomalyMarker?.anomalyScopes.length ?? 0,
    latestFollowThroughActionType: latestFollowThroughMarker?.actionType ?? null,
    latestFollowThroughRecordedAt: latestFollowThroughMarker?.createdAt ?? null,
    latestFollowThroughSourcePage: latestFollowThroughMarker?.sourcePage ?? null,
  };
}

function buildRevokeExecutionAggregateSummary(input: {
  previewVsExecutedScopeSummary: AuthSessionRevokeScopeExecutionDeltaItem[];
  revokeConsistencySummary: AuthSessionRevokeConsistencyItem[];
}): RevokeExecutionAggregateSummary {
  let liveEligibleSessionCount = 0;
  let lastExecutedEligibleSessionCount = 0;
  let lastExecutedRevokedSessionCount = 0;
  let executionShortfallCount = 0;
  let previewEligibleDeltaCount = 0;
  let latestExecutedAt: Date | null = null;
  let reviewOnlyScopeCount = 0;
  let bulkRevocableScopeCount = 0;
  let driftScopeCount = 0;
  let currentSessionProtectedScopeCount = 0;

  for (const item of input.previewVsExecutedScopeSummary) {
    liveEligibleSessionCount += item.liveEligibleSessionCount;
    lastExecutedEligibleSessionCount += item.lastExecutedEligibleSessionCount ?? 0;
    lastExecutedRevokedSessionCount += item.lastExecutedRevokedSessionCount ?? 0;
    executionShortfallCount += item.lastExecutionShortfallCount ?? 0;
    previewEligibleDeltaCount += item.previewEligibleDeltaCount ?? 0;

    if (!latestExecutedAt || (item.lastExecutedAt && item.lastExecutedAt > latestExecutedAt)) {
      latestExecutedAt = item.lastExecutedAt ?? latestExecutedAt;
    }
  }

  for (const item of input.revokeConsistencySummary) {
    if (item.status === AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.REVIEW_ONLY) {
      reviewOnlyScopeCount += 1;
    }
    if (item.status === AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.REVOCABLE) {
      bulkRevocableScopeCount += 1;
    }
    if (item.status === AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.DRIFT) {
      driftScopeCount += 1;
    }
    if (item.currentSessionProtected) {
      currentSessionProtectedScopeCount += 1;
    }
  }

  return {
    status: resolveAuthControlConsistencyStatus({
      reviewOnlyScopeCount,
      bulkRevocableScopeCount,
      driftScopeCount,
      currentSessionProtectedScopeCount,
    }),
    liveEligibleSessionCount,
    lastExecutedEligibleSessionCount,
    lastExecutedRevokedSessionCount,
    executionShortfallCount,
    previewEligibleDeltaCount,
    reviewOnlyScopeCount,
    bulkRevocableScopeCount,
    driftScopeCount,
    currentSessionProtectedScopeCount,
    latestExecutedAt,
  };
}

export async function getOrgAdminGovernanceSummary(
  workspaceId: string,
  options?: { currentAuthSessionId?: string | null },
) {
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      defaultLocale: true,
      pilotMode: true,
      captureConsentRequired: true,
      dataRetentionDays: true,
      featureFlagsJson: true,
      updatedAt: true,
    },
  });

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const [
    memberships,
    activeAuthSessions,
    recentOrgAdminAudit,
    recentDataGovernanceAudit,
    membershipActionCount30d,
    dataGovernanceAuditCount30d,
    orgAdminAuditCount30d,
    workspaceGovernanceActionCount30d,
    workspaceDataActionCount30d,
    internalActionCount30d,
    actionGovernanceActionCount30d,
    insightGovernanceActionCount30d,
    memoryExportCount30d,
    memoryMutationCount30d,
    authSessionEventCount30d,
    rotatedSessionCount30d,
    realignedSessionCount30d,
    supportPackExportCount30d,
    exportActionCount30d,
    deleteActionCount30d,
    retentionUpdateCount30d,
    billingActionCount30d,
    billingWebhookResolutionCount30d,
    billingWebhookHintFallbackCount30d,
    billingWebhookHintMismatchCount30d,
    billingWebhookDuplicateChainCount30d,
    billingWebhookVerificationFailureHintCount30d,
    billingWebhookUnresolvedHintCount30d,
    billingWebhookMappedExceptionCount30d,
    contributionRegistryActionCount30d,
    participantPortalActionCount30d,
    programActionCount30d,
    settlementActionCount30d,
    settlementBatchExportCount30d,
    connectorActionCount30d,
    connectorConnectionCount30d,
    connectorSyncCount30d,
    connectorDisconnectCount30d,
    importActionCount30d,
    csvImportCount30d,
    crmImportCount30d,
    importWarmupCount30d,
    importConflictResolutionCount30d,
    importSourceConnectionCount30d,
    importSourceDisconnectCount30d,
    identityMatchWriteCount30d,
    identityMatchNeedsReviewCount30d,
    scopedSessionRevokeAudits30d,
    latestMembershipAudit,
    latestWorkspaceGovernanceAudit,
    latestWorkspaceDataAudit,
    latestInternalActionAudit,
    latestActionGovernanceAudit,
    latestInsightGovernanceAudit,
    latestAuthSessionAudit,
    latestSupportPackAudit,
    latestExportAudit,
    latestDeleteAudit,
    latestRetentionAudit,
    latestBillingAudit,
    latestBillingWebhookGovernanceAudit,
    latestBillingWebhookHintFallback,
    latestBillingWebhookHintMismatch,
    latestBillingWebhookDuplicateCallback,
    latestBillingWebhookVerificationFailureHint,
    latestBillingWebhookUnresolvedHint,
    latestBillingWebhookMappedException,
    latestContributionRegistryAudit,
    latestParticipantPortalAudit,
    latestProgramAudit,
    latestSettlementAudit,
    latestConnectorAudit,
    latestImportAudit,
    latestConflictResolutionAudit,
    latestIdentityMatch,
    latestScopedSessionRevokeAudit,
    latestWorkspaceRealignmentAudit,
    latestAuthSessionAnomalyFollowThroughAudit,
    softDeletedMemoryEntryCount,
    invalidMemoryFactCount,
  ] = await Promise.all([
    db.membership.findMany({
      where: { workspaceId },
      select: {
        role: true,
        status: true,
      },
    }),
    listWorkspaceActiveAuthSessions(workspaceId, now),
    db.auditLog.findMany({
      where: {
        workspaceId,
        actionType: { in: [...ORG_ADMIN_AUDIT_ACTION_TYPES] },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.auditLog.findMany({
      where: {
        workspaceId,
        actionType: { in: [...DATA_GOVERNANCE_AUDIT_ACTION_TYPES] },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    countAuditActions(workspaceId, MEMBERSHIP_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(workspaceId, DATA_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(workspaceId, ORG_ADMIN_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(workspaceId, WORKSPACE_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(workspaceId, WORKSPACE_DATA_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(workspaceId, INTERNAL_ACTION_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(workspaceId, ACTION_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(workspaceId, INSIGHT_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(
      workspaceId,
      MEMORY_GOVERNANCE_AUDIT_ACTION_TYPES.filter((item) => item === "MEMORY_SUMMARY_EXPORTED"),
      thirtyDaysAgo,
    ),
    countAuditActions(
      workspaceId,
      MEMORY_GOVERNANCE_AUDIT_ACTION_TYPES.filter((item) => item !== "MEMORY_SUMMARY_EXPORTED"),
      thirtyDaysAgo,
    ),
    countAuditActions(workspaceId, AUTH_SESSION_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: "AUTH_SESSION_ROTATED",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION,
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: ORGANIZATION_SUPPORT_PACK_EXPORTED,
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    countAuditActions(workspaceId, DATA_EXPORT_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(workspaceId, DATA_DELETE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(workspaceId, RETENTION_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(workspaceId, BILLING_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(workspaceId, BILLING_WEBHOOK_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: "BILLING_WEBHOOK_TENANCY_HINT_FALLBACK",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: "BILLING_WEBHOOK_TENANCY_HINT_MISMATCH",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.paymentWebhookCallbackEvent.count({
      where: {
        workspaceId,
        duplicateReceptionCount: { gt: 0 },
        lastReceivedAt: { gte: thirtyDaysAgo },
      },
    }),
    db.paymentWebhookCallbackEvent.count({
      where: {
        workspaceId: null,
        hintWorkspaceId: workspaceId,
        governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.VERIFICATION_FAILED,
        processedAt: { gte: thirtyDaysAgo },
      },
    }),
    db.paymentWebhookCallbackEvent.count({
      where: {
        workspaceId: null,
        hintWorkspaceId: workspaceId,
        governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.UNRESOLVED,
        processedAt: { gte: thirtyDaysAgo },
      },
    }),
    db.paymentWebhookCallbackEvent.count({
      where: {
        workspaceId,
        governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.EXCEPTION,
        processedAt: { gte: thirtyDaysAgo },
      },
    }),
    countAuditActions(workspaceId, CONTRIBUTION_REGISTRY_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(workspaceId, PARTICIPANT_PORTAL_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(workspaceId, PROGRAM_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(workspaceId, SETTLEMENT_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    countAuditActions(
      workspaceId,
      SETTLEMENT_GOVERNANCE_AUDIT_ACTION_TYPES.filter((item) => item === "SETTLEMENT_BATCH_EXPORTED"),
      thirtyDaysAgo,
    ),
    countAuditActions(workspaceId, CONNECTOR_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: "CONNECTOR_CONNECTED",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: "CONNECTOR_SYNC_COMPLETED",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: "CONNECTOR_DISCONNECTED",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    countAuditActions(workspaceId, IMPORT_GOVERNANCE_AUDIT_ACTION_TYPES, thirtyDaysAgo),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: "CSV_IMPORT_COMPLETED",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: "CRM_IMPORT_COMPLETED",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: "IMPORT_WARMUP_COMPLETED",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: "IMPORT_CONFLICT_RESOLVED",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: "IMPORT_SOURCE_CONNECTED",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: "IMPORT_SOURCE_DISCONNECTED",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.identityMatch.count({
      where: {
        workspaceId,
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.identityMatch.count({
      where: {
        workspaceId,
        createdAt: { gte: thirtyDaysAgo },
        status: IdentityMatchStatus.NEEDS_REVIEW,
      },
    }),
    db.auditLog.findMany({
      where: {
        workspaceId,
        actionType: AUTH_SESSION_SCOPE_REVOKED_AUDIT_ACTION,
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        payload: true,
      },
    }),
    findLatestAuditMarker(workspaceId, MEMBERSHIP_GOVERNANCE_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, WORKSPACE_GOVERNANCE_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, WORKSPACE_DATA_GOVERNANCE_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, INTERNAL_ACTION_GOVERNANCE_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, ACTION_GOVERNANCE_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, INSIGHT_GOVERNANCE_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, AUTH_SESSION_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, [ORGANIZATION_SUPPORT_PACK_EXPORTED]),
    findLatestAuditMarker(workspaceId, DATA_EXPORT_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, DATA_DELETE_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, RETENTION_GOVERNANCE_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, BILLING_GOVERNANCE_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, BILLING_WEBHOOK_GOVERNANCE_AUDIT_ACTION_TYPES),
    findLatestWebhookCallbackMarker({
      workspaceScoped: true,
      where: {
        workspaceId,
        actionType: "BILLING_WEBHOOK_TENANCY_HINT_FALLBACK",
      },
    }),
    findLatestWebhookCallbackMarker({
      workspaceScoped: true,
      where: {
        workspaceId,
        actionType: "BILLING_WEBHOOK_TENANCY_HINT_MISMATCH",
      },
    }),
    findLatestWebhookCallbackMarker({
      workspaceScoped: true,
      where: {
        workspaceId,
        duplicateReceptionCount: { gt: 0 },
      },
    }),
    findLatestWebhookCallbackMarker({
      workspaceScoped: false,
      where: {
        workspaceId: null,
        hintWorkspaceId: workspaceId,
        governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.VERIFICATION_FAILED,
      },
    }),
    findLatestWebhookCallbackMarker({
      workspaceScoped: false,
      where: {
        workspaceId: null,
        hintWorkspaceId: workspaceId,
        governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.UNRESOLVED,
      },
    }),
    findLatestWebhookCallbackMarker({
      workspaceScoped: true,
      where: {
        workspaceId,
        governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.EXCEPTION,
      },
    }),
    findLatestAuditMarker(workspaceId, CONTRIBUTION_REGISTRY_GOVERNANCE_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, PARTICIPANT_PORTAL_GOVERNANCE_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, PROGRAM_GOVERNANCE_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, SETTLEMENT_GOVERNANCE_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, CONNECTOR_GOVERNANCE_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, IMPORT_GOVERNANCE_AUDIT_ACTION_TYPES),
    findLatestAuditMarker(workspaceId, ["IMPORT_CONFLICT_RESOLVED"]),
    findLatestIdentityMatchMarker(workspaceId),
    findLatestAuditMarker(workspaceId, [AUTH_SESSION_SCOPE_REVOKED_AUDIT_ACTION]),
    findLatestAuditMarker(workspaceId, [AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION]),
    findLatestAuditMarker(workspaceId, [
      "AUTH_SESSION_ROTATED",
      AUTH_SESSION_SCOPE_REVOKED_AUDIT_ACTION,
      AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION,
    ]),
    db.memoryEntry.count({
      where: {
        workspaceId,
        deletedAt: { not: null },
      },
    }),
    db.memoryFact.count({
      where: {
        workspaceId,
        status: MemoryStatus.INVALID,
      },
    }),
  ]);

  const activeSeatCount = memberships.filter((item) => item.status === "ACTIVE").length;
  const invitedSeatCount = memberships.filter((item) => item.status === "INVITED").length;
  const inactiveSeatCount = memberships.filter((item) => item.status === "INACTIVE").length;
  const ownerCount = memberships.filter((item) => item.role === "OWNER" && item.status !== "INACTIVE").length;
  const billingAdminCount = memberships.filter(
    (item) => item.role === "BILLING_ADMIN" && item.status !== "INACTIVE",
  ).length;
  const adminCount = memberships.filter((item) => item.role === "ADMIN" && item.status !== "INACTIVE").length;
  const operationalReviewerCount = memberships.filter(
    (item) => (item.role === "OPERATOR" || item.role === "REVIEWER") && item.status !== "INACTIVE",
  ).length;
  const featureFlags = parseWorkspaceFeatureFlags(workspace.featureFlagsJson);
  const activeSessionCount = activeAuthSessions.length;
  const expiringSoonSessionCount = activeAuthSessions.filter((session) =>
    isAuthSessionExpiringSoon(session, now),
  ).length;
  const staleActiveSessionCount = activeAuthSessions.filter((session) =>
    isAuthSessionStale(session, now),
  ).length;
  const legacyProviderSessionCount = activeAuthSessions.filter((session) => !session.providerType).length;
  const missingSourcePageSessionCount = activeAuthSessions.filter((session) =>
    hasAuthSessionMissingSourcePage(session),
  ).length;
  const missingWorkspaceSwitchMarkerSessionCount = activeAuthSessions.filter((session) =>
    hasAuthSessionMissingWorkspaceSwitchMarker(session),
  ).length;
  const providerSourceMismatchSessionCount = activeAuthSessions.filter((session) =>
    hasAuthSessionProviderSourceMismatch(session),
  ).length;
  const workspaceMembershipMismatchSessionCount = activeAuthSessions.filter((session) =>
    hasAuthSessionWorkspaceMembershipMismatch(session),
  ).length;
  const recentActiveSessions = activeAuthSessions.slice(0, 6);
  const latestAuthSessionAnomalyMarker = buildLatestAuthSessionAnomalyMarker(activeAuthSessions, now);
  const {
    scopeRevokeActionCount30d,
    scopeRevokedSessionCount30d,
    revokeScopeSummary30d,
  } = summarizeScopedSessionRevokeAudits(scopedSessionRevokeAudits30d);
  const {
    liveRevokeScopeSummary,
    currentSessionReviewScopeSummary,
  } = buildAuthSessionRevokeScopePreview({
    authSessions: activeAuthSessions,
    currentSessionId: options?.currentAuthSessionId ?? null,
    now,
  });
  const previewVsExecutedScopeSummary = buildAuthSessionRevokePreviewVsExecutedDelta({
    liveRevokeScopeSummary,
    scopedSessionRevokeAudits: scopedSessionRevokeAudits30d,
  });
  const anomalyInventorySummary = buildAuthSessionAnomalyInventorySummary({
    authSessions: activeAuthSessions,
    currentSessionId: options?.currentAuthSessionId ?? null,
    now,
  });
  const revokeConsistencySummary = buildAuthSessionRevokeConsistencySummary({
    previewVsExecutedScopeSummary,
  });
  const authControlConsistencyOverview = buildAuthControlConsistencyOverview({
    anomalyInventorySummary,
    liveRevokeScopeSummary,
    revokeConsistencySummary,
    latestAnomalyMarker: latestAuthSessionAnomalyMarker,
    latestScopedSessionRevokeAudit: latestScopedSessionRevokeAudit as GovernanceAuditMarker,
    latestWorkspaceRealignmentAudit:
      latestWorkspaceRealignmentAudit as GovernanceAuditMarker,
    latestAuthSessionAnomalyFollowThroughAudit:
      latestAuthSessionAnomalyFollowThroughAudit as GovernanceAuditMarker,
  });
  const latestAnomalyFollowThroughSummary =
    buildLatestAuthSessionAnomalyFollowThroughSummary({
      anomalyInventorySummary,
      liveRevokeScopeSummary,
      revokeConsistencySummary,
      latestAnomalyMarker: latestAuthSessionAnomalyMarker,
      latestScopedSessionRevokeAudit:
        latestScopedSessionRevokeAudit as GovernanceAuditMarker,
      latestWorkspaceRealignmentAudit:
        latestWorkspaceRealignmentAudit as GovernanceAuditMarker,
      latestAuthSessionAnomalyFollowThroughAudit:
        latestAuthSessionAnomalyFollowThroughAudit as GovernanceAuditMarker,
    });
  const latestMarkerCoverageSummary = buildLatestMarkerCoverageSummary({
    anomalyInventorySummary,
    liveRevokeScopeSummary,
    revokeConsistencySummary,
    latestAnomalyMarker: latestAuthSessionAnomalyMarker,
    latestScopedSessionRevokeAudit: latestScopedSessionRevokeAudit as GovernanceAuditMarker,
    latestWorkspaceRealignmentAudit:
      latestWorkspaceRealignmentAudit as GovernanceAuditMarker,
    latestAuthSessionAnomalyFollowThroughAudit:
      latestAuthSessionAnomalyFollowThroughAudit as GovernanceAuditMarker,
  });
  const revokeExecutionAggregateSummary = buildRevokeExecutionAggregateSummary({
    previewVsExecutedScopeSummary,
    revokeConsistencySummary,
  });
  const workspaceIsolationAssertions = {
    memoryExportScopedToWorkspace: true,
    supportPackExportScopedToWorkspace: true,
    deleteActionsScopedToWorkspace: true,
    retentionControlsScopedToWorkspace: true,
    sensitiveWriteRoutesRequireTenantOwnership: true,
    billingWebhookTenantMappingScopedToWorkspace: true,
    unresolvedWebhookCallbacksRemainOutsideWorkspaceAudit: true,
  } as const;
  const dataGovernanceClosure = buildDataGovernanceClosure({
    latestExportAudit: latestExportAudit as GovernanceAuditMarker,
    latestDeleteAudit: latestDeleteAudit as GovernanceAuditMarker,
    latestRetentionAudit: latestRetentionAudit as GovernanceAuditMarker,
    latestSupportPackAudit: latestSupportPackAudit as GovernanceAuditMarker,
    workspaceIsolationAssertions,
  });

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      status: workspace.status,
      defaultLocale: workspace.defaultLocale,
      pilotMode: workspace.pilotMode,
      captureConsentRequired: workspace.captureConsentRequired,
      dataRetentionDays: workspace.dataRetentionDays,
      featureFlagCount: getEnabledFeatureFlagCount(featureFlags),
      updatedAt: workspace.updatedAt,
    },
    membershipSummary: {
      activeSeatCount,
      invitedSeatCount,
      inactiveSeatCount,
      ownerCount,
      billingAdminCount,
      adminCount,
      operationalReviewerCount,
    },
    authSessionSummary: {
      activeSessionCount,
      expiringSoonSessionCount,
      staleActiveSessionCount,
      legacyProviderSessionCount,
      missingSourcePageSessionCount,
      missingWorkspaceSwitchMarkerSessionCount,
      providerSourceMismatchSessionCount,
      workspaceMembershipMismatchSessionCount,
      rotatedSessionCount30d,
      realignedSessionCount30d,
      scopeRevokeActionCount30d,
      scopeRevokedSessionCount30d,
      revokeScopeSummary30d,
      liveRevokeScopeSummary,
      previewVsExecutedScopeSummary,
      anomalyInventorySummary,
      revokeConsistencySummary,
      currentSessionReviewScopeSummary,
      authControlConsistencyOverview,
      latestAnomalyFollowThroughSummary,
      latestMarkerCoverageSummary,
      revokeExecutionAggregateSummary,
      latestAnomalyMarker: latestAuthSessionAnomalyMarker,
      recentActiveSessions: recentActiveSessions.map((session) => ({
        id: session.id,
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
        },
        sourcePage: session.sourcePage,
        providerType: session.providerType,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        lastWorkspaceSwitchAt: session.lastWorkspaceSwitchAt,
        expiresAt: session.expiresAt,
        isExpiringSoon: isAuthSessionExpiringSoon(session, now),
        isStale: isAuthSessionStale(session, now),
        isLegacyProvider: !session.providerType,
        isMissingSourcePage: hasAuthSessionMissingSourcePage(session),
        hasMissingWorkspaceSwitchMarker: hasAuthSessionMissingWorkspaceSwitchMarker(session),
        hasProviderSourceMismatch: hasAuthSessionProviderSourceMismatch(session),
        hasWorkspaceMembershipMismatch: hasAuthSessionWorkspaceMembershipMismatch(session),
      })),
    },
    dataGovernanceSummary: {
      orgAdminAuditCount30d,
      dataGovernanceAuditCount30d,
      membershipActionCount30d,
      workspaceGovernanceActionCount30d,
      workspaceDataActionCount30d,
      internalActionCount30d,
      actionGovernanceActionCount30d,
      insightGovernanceActionCount30d,
      memoryExportCount30d,
      memoryMutationCount30d,
      authSessionEventCount30d,
      supportPackExportCount30d,
      exportActionCount30d,
      deleteActionCount30d,
      retentionUpdateCount30d,
      billingActionCount30d,
      billingWebhookResolutionCount30d,
      billingWebhookHintFallbackCount30d,
      billingWebhookHintMismatchCount30d,
      billingWebhookDuplicateChainCount30d,
      billingWebhookVerificationFailureHintCount30d,
      billingWebhookUnresolvedHintCount30d,
      billingWebhookMappedExceptionCount30d,
      contributionRegistryActionCount30d,
      participantPortalActionCount30d,
      programActionCount30d,
      settlementActionCount30d,
      settlementBatchExportCount30d,
      connectorActionCount30d,
      connectorConnectionCount30d,
      connectorSyncCount30d,
      connectorDisconnectCount30d,
      importActionCount30d,
      csvImportCount30d,
      crmImportCount30d,
      importWarmupCount30d,
      importConflictResolutionCount30d,
      importSourceConnectionCount30d,
      importSourceDisconnectCount30d,
      identityMatchWriteCount30d,
      identityMatchNeedsReviewCount30d,
      softDeletedMemoryEntryCount,
      invalidMemoryFactCount,
    },
    governanceFollowThrough: {
      latestMembershipAudit: latestMembershipAudit as GovernanceAuditMarker,
      latestWorkspaceGovernanceAudit: latestWorkspaceGovernanceAudit as GovernanceAuditMarker,
      latestWorkspaceDataAudit: latestWorkspaceDataAudit as GovernanceAuditMarker,
      latestInternalActionAudit: latestInternalActionAudit as GovernanceAuditMarker,
      latestActionGovernanceAudit: latestActionGovernanceAudit as GovernanceAuditMarker,
      latestInsightGovernanceAudit: latestInsightGovernanceAudit as GovernanceAuditMarker,
      latestAuthSessionAudit: latestAuthSessionAudit as GovernanceAuditMarker,
      latestSupportPackAudit: latestSupportPackAudit as GovernanceAuditMarker,
      latestExportAudit: latestExportAudit as GovernanceAuditMarker,
      latestDeleteAudit: latestDeleteAudit as GovernanceAuditMarker,
      latestRetentionAudit: latestRetentionAudit as GovernanceAuditMarker,
      latestBillingAudit: latestBillingAudit as GovernanceAuditMarker,
      latestBillingWebhookGovernanceAudit:
        latestBillingWebhookGovernanceAudit as GovernanceAuditMarker,
      latestBillingWebhookHintFallback:
        latestBillingWebhookHintFallback as WebhookCallbackMarker,
      latestBillingWebhookHintMismatch:
        latestBillingWebhookHintMismatch as WebhookCallbackMarker,
      latestBillingWebhookDuplicateCallback:
        latestBillingWebhookDuplicateCallback as WebhookCallbackMarker,
      latestBillingWebhookVerificationFailureHint:
        latestBillingWebhookVerificationFailureHint as WebhookCallbackMarker,
      latestBillingWebhookUnresolvedHint:
        latestBillingWebhookUnresolvedHint as WebhookCallbackMarker,
      latestBillingWebhookMappedException:
        latestBillingWebhookMappedException as WebhookCallbackMarker,
      latestContributionRegistryAudit: latestContributionRegistryAudit as GovernanceAuditMarker,
      latestParticipantPortalAudit: latestParticipantPortalAudit as GovernanceAuditMarker,
      latestProgramAudit: latestProgramAudit as GovernanceAuditMarker,
      latestSettlementAudit: latestSettlementAudit as GovernanceAuditMarker,
      latestConnectorAudit: latestConnectorAudit as GovernanceAuditMarker,
      latestImportAudit: latestImportAudit as GovernanceAuditMarker,
      latestConflictResolutionAudit: latestConflictResolutionAudit as GovernanceAuditMarker,
      latestIdentityMatch: latestIdentityMatch
        ? {
            recordedAt: latestIdentityMatch.createdAt,
            status: latestIdentityMatch.status,
            reason: latestIdentityMatch.matchReason,
            externalType: latestIdentityMatch.externalType,
            externalId: latestIdentityMatch.externalId,
            internalObjectType: latestIdentityMatch.internalObjectType,
            internalObjectId: latestIdentityMatch.internalObjectId,
            matchScore: latestIdentityMatch.matchScore,
          }
        : null,
      latestScopedSessionRevokeAudit: latestScopedSessionRevokeAudit as GovernanceAuditMarker,
      latestWorkspaceRealignmentAudit:
        latestWorkspaceRealignmentAudit as GovernanceAuditMarker,
      latestAuthSessionAnomalyFollowThroughAudit:
        latestAuthSessionAnomalyFollowThroughAudit as GovernanceAuditMarker,
    },
    dataGovernanceClosure,
    workspaceIsolationAssertions,
    recentOrgAdminAudit: recentOrgAdminAudit.map(mapAuditRecord),
    recentDataGovernanceAudit: recentDataGovernanceAudit.map(mapAuditRecord),
    boundaryNotes: [
      "Support pack is tenant-scoped to the active workspace only.",
      "This export is audit-oriented and does not expand execution authority.",
      "Retention, export, delete, and session posture remain review-first governance controls.",
      "Auth-session anomaly readout is operator-facing review truth, not an enterprise IAM or security platform.",
      "Entry-source truth stays on the auth session record; action-source truth for rotate/revoke audits is tracked separately for operator review.",
      "Workspace-switch marker gaps are session-governance anomalies, not implicit proof of tenant isolation failure.",
      "Sensitive write routes are expected to assert workspace ownership before execution; provider webhooks remain external callback exceptions.",
      "Webhook tenancy governance only records callbacks once tenant mapping is asserted; unresolved external callbacks remain outside workspace-scoped support-pack truth.",
      "Webhook verification failures with workspace hints remain external anomaly signals until authenticity and tenant mapping are both asserted.",
      "Webhook duplicate chains and mapped callback exceptions are tenant-scoped follow-through signals; hinted unresolved callbacks remain external boundary signals, not workspace audit truth.",
      "Membership, workspace governance, auth-session, and support-pack follow-through remain tenant-scoped audit truth, not a broader tenant-admin platform.",
      "Workspace record writes and internal customer-success actions remain tenant-scoped governance signals, not execution-authority expansion.",
      "Governed action generation, approval review, official follow-through, and action execution remain tenant-scoped audit signals under review-first controls; they do not expand execution authority.",
      "Weekly report generation, recommendation feedback, and strategy-suggestion adoption remain tenant-scoped insight governance truth, not a broader BI or recommendation platform.",
      "Billing, registry, participant-portal, program-governance, and settlement follow-through remain tenant-scoped governance readouts, not a finance or marketplace platform.",
      "Connector and import ingress remain tenant-scoped and review-first; they do not imply workflow or execution authority.",
      "Identity-match records remain tenant-scoped import follow-through truth and do not broaden execution or tenant-admin authority.",
      "Capability coverage still follows fixed roles and does not imply full tenant-admin platform breadth.",
    ],
  };
}

export async function buildOrgAdminSupportPack(
  workspaceId: string,
  options?: { currentAuthSessionId?: string | null },
) {
  const generatedAt = new Date();
  const summary = await getOrgAdminGovernanceSummary(workspaceId, options);

  return {
    version: "v1",
    generatedAt,
    workspaceId,
    summary,
  };
}
