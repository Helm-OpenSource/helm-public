import {
  ActorType,
  MembershipStatus,
  ParticipantPortalAccessStatus,
  ProgramApplicationStatus,
  ProgramTermsVersionStatus,
  RecordSource,
  UsageType,
  WorkspaceRole,
} from "@prisma/client";
import { subDays } from "date-fns";
import { buildWorkerCommercialWiringView } from "@/lib/billing/add-on-worker-commercial";
import { getWorkspaceBillingSnapshot } from "@/lib/billing/foundation";
import { getChinaRenewRestoreSummary } from "@/lib/billing/china-renew-restore";
import { getBillingOverviewActionState } from "@/lib/billing/integration";
import { getLifecycleBoundarySummary } from "@/lib/billing/lifecycle-boundary";
import {
  buildInternalUsageOpsSummary,
  buildMembershipLifecycleSummary,
  buildRevenueAttributionOpsSummary,
  buildRevenueRuleOpsSummary,
  buildSettlementLineOpsSummary,
  buildWorkerEntitlementOpsSummary,
} from "@/lib/billing/ops-summary";
import {
  canManageContributionRegistry,
  canManageManualSettlement,
  canManageParticipantPortal,
  canManageProgramApplications,
  canManageWorkspaceBilling,
  canReadContributionRegistry,
} from "@/lib/auth/commercial-governance";
import {
  canManageWorkspaceConnectors,
  canManageWorkspaceImports,
  canResolveWorkspaceImportConflicts,
} from "@/lib/auth/import-governance";
import {
  canManageWorkspaceGovernedActions,
  canReviewWorkspaceGovernedActions,
} from "@/lib/auth/action-governance";
import {
  WORKSPACE_CAPABILITIES,
  type WorkspaceCapability,
} from "@/lib/auth/authorization";
import { canManageWorkspaceInsights } from "@/lib/auth/insight-governance";
import { getOrgAdminGovernanceSummary } from "@/lib/auth/org-admin-governance";
import {
  canExportWorkspaceAdminSupportPack,
  canManageWorkspaceMembers,
  canManageWorkspaceOperationalControls,
  canManageWorkspacePolicies,
  canManageWorkspaceSetup,
  canReadWorkspaceAdminAudit,
} from "@/lib/auth/settings-governance";
import {
  canManageWorkspaceInternalActions,
  canManageWorkspaceRecords,
} from "@/lib/auth/workspace-data-governance";
import { buildPayoutRailReadinessSummary } from "@/lib/billing/payout-rail-readiness";
import { buildPayoutRailPilotCohortSummary } from "@/lib/billing/payout-rail-pilot-cohort";
import { buildSettlementExceptionSummary } from "@/lib/billing/settlement-exceptions";
import { buildSettlementOpsProofPackSummary } from "@/lib/billing/settlement-ops-proof-pack";
import { parseDingTalkConnectorMetadata } from "@/lib/connectors/dingtalk";
import { getLatestDingTalkDirectoryInviteDryRunSnapshot } from "@/lib/connectors/dingtalk-directory-invite-snapshot";
import { parseFeishuConnectorMetadata } from "@/lib/connectors/feishu";
import { parseWeComConnectorMetadata } from "@/lib/connectors/wecom";
import {
  beneficiarySupportsPayoutProfile,
  getWorkspaceManualSettlementSnapshot,
} from "@/lib/billing/manual-settlement";
import { ensureWorkspaceProgramCatalogFoundation } from "@/lib/billing/program-catalog";
import { getWorkspaceRevenueAttributionSnapshot } from "@/lib/billing/revenue-attribution";
import { resolveWorkspacePaymentRail } from "@/lib/billing/payment-provider-resolver";
import { findMembershipsWithExistingUsers } from "@/lib/auth/membership-with-user";
import { getSessionId } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  getFormalSkillReviewQueue,
  getOpenSkillSuggestions,
  getRecentFormalReviewDecisions,
  getRecentSkillAdoptions,
} from "@/lib/evolution/skill-suggestion.service";
import {
  buildCapabilityDecisionOperatorReadout,
} from "@/lib/capability-decision-trace";
import { buildTenantResourceGovernedLoop } from "@/lib/tenant-resources/governed-loop";
import { buildTenantResourceEvidenceDetail } from "@/lib/tenant-resources/evidence-detail";
import { buildTenantExtensionResourceAdoptionReadouts } from "@/lib/tenant-resources/extension-adoption";
import { toTenantResourceExtensionManifestInput } from "@/lib/tenant-resources/extension-manifest";
import {
  buildTenantResourceGuardedWriteEvaluation,
} from "@/lib/tenant-resources/guarded-write-evaluation";
import { buildTenantResourceGuardedWritePilotReadouts } from "@/lib/tenant-resources/guarded-write-pilot";
import { listTenantResourceGuardedWritePilotRecords } from "@/lib/tenant-resources/guarded-write-pilot-runtime";
import { buildTenantResourcePolicyReadout } from "@/lib/tenant-resources/policy-readout";
import type { TenantResourceReadiness } from "@/lib/tenant-resources/readiness";
import { buildTenantResourceReadiness } from "@/lib/tenant-resources/readiness";
import { listTenantResourceManualProofRecords } from "@/lib/tenant-resources/manual-proof-runtime";
import { safeParseJson } from "@/lib/utils";
import { isOperationalHelmReservedWorkspace } from "@/lib/workspace-reserved";

const emptyRevenueRuleSummary = {
  totalRuleCount: 0,
  recurringRuleCount: 0,
  oneTimeRuleCount: 0,
  percentRuleCount: 0,
  fixedAmountRuleCount: 0,
  reversalBackedRuleCount: 0,
  sourceTypeCount: 0,
};

const emptyRevenueAttributionSummary = {
  sourceTypeCount: 0,
  beneficiaryPendingAmountCents: 0,
  pendingCount: 0,
  approvedCount: 0,
  paidCount: 0,
  reversedCount: 0,
  pendingPayableAmountCents: 0,
  approvedPayableAmountCents: 0,
  paidPayableAmountCents: 0,
  reversedPayableAmountCents: 0,
};

const emptySettlementSummary = {
  totalLineCount: 0,
  beneficiaryCount: 0,
  sourceTypeCount: 0,
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
  missingProfileCount: 0,
};

const emptyPayoutRailReadiness = buildPayoutRailReadinessSummary({
  payoutProfiles: [],
  settlementBatches: [],
  currentBatch: null,
  participantPortalAccesses: [],
});

const emptySettlementOpsProofPack = buildSettlementOpsProofPackSummary({
  payoutEntries: [],
  payoutProfiles: [],
  participantPortalAccesses: [],
  settlementBatches: [],
});

const emptySettlementExceptionSummary = buildSettlementExceptionSummary({
  currentBatch: null,
  settlementBatches: [],
  payoutProfiles: [],
  participantPortalAccesses: [],
});

const emptyPayoutRailPilotCohort = buildPayoutRailPilotCohortSummary({
  paymentRegion: "CN",
  payoutRailReadiness: emptyPayoutRailReadiness,
  settlementExceptionSummary: emptySettlementExceptionSummary,
  payoutEntries: [],
  payoutProfiles: [],
  participantPortalAccesses: [],
  settlementBatches: [],
});

const isDefined = <T,>(value: T | undefined): value is T => value !== undefined;

const organizationAuditActionTypes = [
  "ORGANIZATION_CREATED",
  "ORGANIZATION_MEMBER_ADDED",
  "ORGANIZATION_MEMBER_LIFECYCLE_UPDATED",
  "ORGANIZATION_MEMBER_ROLE_UPDATED",
  "ORGANIZATION_OWNERSHIP_TRANSFERRED",
];

const dingtalkDirectoryInviteAuditActionTypes = [
  "DINGTALK_DIRECTORY_INVITE_SYNC_SUCCEEDED",
  "DINGTALK_DIRECTORY_INVITE_SYNC_PARTIAL",
] as const;

type DingTalkDirectoryInviteDryRunDetail = {
  dingtalkUserId: string;
  unionId: string | null;
  name: string;
  mobile: string | null;
  normalizedPhone: string | null;
  title: string | null;
  jobNumber: string | null;
  deptIds: number[];
  isLeader: boolean;
  placeholderEmail: string | null;
  userResolution:
    | "REUSED_BY_PHONE"
    | "REUSED_BY_PLACEHOLDER_EMAIL"
    | "CREATED_PLACEHOLDER_EMAIL"
    | "UNRESOLVED";
  membershipStatus:
    | "ACTIVE_KEPT"
    | "INVITED_UPSERTED"
    | "DRY_RUN_SIMULATED"
    | "SKIPPED";
  messageStatus: "SENT" | "DRY_RUN_SIMULATED" | "FAILED" | "SKIPPED";
  note: string | null;
};

type DingTalkDirectoryInviteDryRunSummary = {
  recordedAt: Date;
  processed: number;
  createdUsers: number;
  reusedUsers: number;
  upsertedMemberships: number;
  sentMessages: number;
  skipped: number;
  skippedNoMobile: number;
  nameCollisionResolved: number;
  errors: string[];
  details: DingTalkDirectoryInviteDryRunDetail[];
};

type GoalProfileMembership = {
  goalTitle: string | null;
  goalDescription: string | null;
  goalItemsJson: string | null;
  jobResponsibilities: string | null;
};

export function maskMembershipGoalProfileFields<T extends GoalProfileMembership>(
  memberships: T[],
  canManageMembers: boolean,
): T[] {
  if (canManageMembers) {
    return memberships;
  }

  return memberships.map((membership) => ({
    ...membership,
    goalTitle: null,
    goalDescription: null,
    goalItemsJson: null,
    jobResponsibilities: null,
  }));
}

function toNonNegativeInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return value > 0 ? Math.trunc(value) : 0;
}

export function parseDingTalkDirectoryInviteDryRunSummary(input: {
  payload: unknown;
  createdAt: Date;
}): DingTalkDirectoryInviteDryRunSummary | null {
  if (!input.payload || typeof input.payload !== "object") {
    return null;
  }
  const payload = input.payload as Record<string, unknown>;
  const explicitDryRun = payload.dryRun === true || payload.dryRun === "true";
  const resultLike =
    payload.result && typeof payload.result === "object"
      ? (payload.result as Record<string, unknown>)
      : payload;
  const hasDirectoryInviteMarker =
    payload.action === "DIRECTORY_INVITE_SYNC" ||
    payload.targetId === "DINGTALK_DIRECTORY_INVITE_SYNC";
  const hasProcessedCounters =
    typeof resultLike.processed === "number" ||
    typeof resultLike.createdUsers === "number" ||
    typeof resultLike.upsertedMemberships === "number";

  if (!explicitDryRun && !hasDirectoryInviteMarker && !hasProcessedCounters) {
    return null;
  }

  const errors = Array.isArray(resultLike.errors)
    ? resultLike.errors
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];

  const rawDetails = Array.isArray(resultLike.details)
    ? resultLike.details
    : Array.isArray(payload.details)
      ? payload.details
      : [];

  const details = rawDetails
        .map((raw) => {
          if (!raw || typeof raw !== "object") {
            return null;
          }
          const value = raw as Record<string, unknown>;
          return {
            dingtalkUserId:
              typeof value.dingtalkUserId === "string" ? value.dingtalkUserId : "",
            unionId: typeof value.unionId === "string" ? value.unionId : null,
            name: typeof value.name === "string" ? value.name : "未命名成员",
            mobile: typeof value.mobile === "string" ? value.mobile : null,
            normalizedPhone:
              typeof value.normalizedPhone === "string"
                ? value.normalizedPhone
                : null,
            title: typeof value.title === "string" ? value.title : null,
            jobNumber:
              typeof value.jobNumber === "string" ? value.jobNumber : null,
            deptIds: Array.isArray(value.deptIds)
              ? value.deptIds
                  .map((item) =>
                    typeof item === "number" && Number.isFinite(item)
                      ? Math.trunc(item)
                      : null,
                  )
                  .filter((item): item is number => item !== null && item > 0)
              : [],
            isLeader: value.isLeader === true,
            placeholderEmail:
              typeof value.placeholderEmail === "string"
                ? value.placeholderEmail
                : null,
            userResolution:
              value.userResolution === "REUSED_BY_PHONE" ||
              value.userResolution === "REUSED_BY_PLACEHOLDER_EMAIL" ||
              value.userResolution === "CREATED_PLACEHOLDER_EMAIL" ||
              value.userResolution === "UNRESOLVED"
                ? value.userResolution
                : "UNRESOLVED",
            membershipStatus:
              value.membershipStatus === "ACTIVE_KEPT" ||
              value.membershipStatus === "INVITED_UPSERTED" ||
              value.membershipStatus === "DRY_RUN_SIMULATED" ||
              value.membershipStatus === "SKIPPED"
                ? value.membershipStatus
                : "SKIPPED",
            messageStatus:
              value.messageStatus === "SENT" ||
              value.messageStatus === "DRY_RUN_SIMULATED" ||
              value.messageStatus === "FAILED" ||
              value.messageStatus === "SKIPPED"
                ? value.messageStatus
                : "SKIPPED",
            note: typeof value.note === "string" ? value.note : null,
          } satisfies DingTalkDirectoryInviteDryRunDetail;
        })
        .filter(
          (item): item is DingTalkDirectoryInviteDryRunDetail => item !== null,
        )
    ;

  return {
    recordedAt: input.createdAt,
    processed: toNonNegativeInteger(resultLike.processed),
    createdUsers: toNonNegativeInteger(resultLike.createdUsers),
    reusedUsers: toNonNegativeInteger(resultLike.reusedUsers),
    upsertedMemberships: toNonNegativeInteger(resultLike.upsertedMemberships),
    sentMessages: toNonNegativeInteger(resultLike.sentMessages),
    skipped: toNonNegativeInteger(resultLike.skipped),
    skippedNoMobile: toNonNegativeInteger(resultLike.skippedNoMobile),
    nameCollisionResolved: toNonNegativeInteger(resultLike.nameCollisionResolved),
    errors,
    details,
  };
}

function requiredCapabilityForTenantResource(
  resource: TenantResourceReadiness,
): WorkspaceCapability | null {
  if (resource.source.sourceKind === "connector") {
    return WORKSPACE_CAPABILITIES.MANAGE_CONNECTORS;
  }
  if (resource.source.sourceKind === "import_source") {
    return WORKSPACE_CAPABILITIES.MANAGE_IMPORTS;
  }
  if (resource.source.sourceKind === "capture_session") {
    return WORKSPACE_CAPABILITIES.MANAGE_CAPTURE_SESSIONS;
  }
  if (resource.source.sourceKind === "workspace_solution_extension") {
    return WORKSPACE_CAPABILITIES.REVIEW_GOVERNED_ACTIONS;
  }

  return null;
}

export async function getSettingsData(workspaceId: string, userId: string) {
  const sevenDaysAgo = subDays(new Date(), 7);
  const billingSnapshot = await getWorkspaceBillingSnapshot(workspaceId);
  const currentAuthSessionId = await getSessionId();

  const [
    workspace,
    policies,
    budgets,
    memberships,
    notifications,
    connectorRows,
    skillSuggestions,
    recentSkillAdoptions,
    strategySuggestions,
    recentStrategyAdoptions,
    recentAuditCount,
    pendingApprovalCount,
    llmFallbackCount,
    externalThreadCount,
    unboundThreadCount,
    importedSignalCount,
    importSources,
    contactsWithEmail,
    recentImportEvents,
    userOrganizations,
    recentDingTalkIngestionRows,
    recentImportJobs,
    workspaceSolutionExtensions,
    recentCaptureSessions,
    tenantResourceManualProofRecords,
    tenantResourceGuardedWritePilotRecords,
  ] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        billingAccount: true,
        trialState: true,
        workerEntitlements: {
          orderBy: [{ entitlementType: "asc" }, { workerKey: "asc" }],
        },
      },
    }),
    db.policyRule.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    }),
    db.budgetRule.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    }),
    findMembershipsWithExistingUsers({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    }),
    db.notification.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.connector.findMany({
      where: { workspaceId },
      select: {
        id: true,
        workspaceId: true,
        provider: true,
        status: true,
        externalAccountEmail: true,
        manualSendEnabled: true,
        lastSyncedAt: true,
        lastSyncStatus: true,
        lastSyncMessage: true,
        tokenExpiresAt: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getOpenSkillSuggestions(workspaceId),
    getRecentSkillAdoptions(workspaceId, 4),
    db.strategySuggestion.findMany({
      where: {
        workspaceId,
        status: "OPEN",
      },
      orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    db.strategySuggestion.findMany({
      where: {
        workspaceId,
        status: "ACCEPTED",
        appliedAt: { not: null },
      },
      select: {
        id: true,
        title: true,
        targetPolicyKey: true,
        appliedEffectSummary: true,
        appliedAt: true,
        confirmedAt: true,
      },
      orderBy: [{ appliedAt: "desc" }, { confirmedAt: "desc" }],
      take: 4,
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    }),
    db.approvalTask.count({
      where: {
        workspaceId,
        status: "PENDING",
      },
    }),
    db.lLMCallLog.count({
      where: {
        workspaceId,
        fallbackReason: { not: null },
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    }),
    db.emailThread.count({
      where: {
        workspaceId,
        source: {
          in: [RecordSource.GMAIL, RecordSource.IMPORT],
        },
      },
    }),
    db.emailThread.count({
      where: {
        workspaceId,
        source: {
          in: [RecordSource.GMAIL, RecordSource.IMPORT],
        },
        contactId: null,
        companyId: null,
        opportunityId: null,
      },
    }),
    db.memoryEntry.count({
      where: {
        workspaceId,
        source: "CSV 导入",
      },
    }),
    db.importSource.findMany({
      where: {
        workspaceId,
        sourceType: {
          in: ["HUBSPOT", "SALESFORCE"],
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.contact.findMany({
      where: {
        workspaceId,
        email: { not: null },
      },
      select: {
        email: true,
      },
    }),
    db.eventLog.findMany({
      where: {
        workspaceId,
        eventName: "csv_import_completed",
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
    }),
    db.membership.findMany({
      where: {
        userId,
        status: {
          not: MembershipStatus.INACTIVE,
        },
      },
      include: {
        workspace: {
          include: {
            billingAccount: true,
            trialState: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.connectorIngestionRecord.findMany({
      where: {
        workspaceId,
        objectRefs: {
          contains: "\"provider\":\"DINGTALK\"",
        },
      },
      select: {
        id: true,
        sourceScope: true,
        sourceType: true,
        sourceId: true,
        sourceSummary: true,
        draftPayload: true,
        evidenceRef: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
    }),
    db.importJob.findMany({
      where: { workspaceId },
      select: {
        id: true,
        sourceId: true,
        status: true,
        totalRecords: true,
        successRecords: true,
        failedRecords: true,
        warningRecords: true,
        finishedAt: true,
        errorSummary: true,
        startedAt: true,
      },
      orderBy: [{ startedAt: "desc" }],
      take: 24,
    }),
    db.workspaceSolutionExtension.findMany({
      where: { workspaceId },
      select: {
        id: true,
        workspaceId: true,
        extensionKey: true,
        kind: true,
        status: true,
        version: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 24,
    }),
    db.captureSession.findMany({
      where: { workspaceId },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        status: true,
        sourceType: true,
        transcriptStatus: true,
        processingStatus: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 12,
    }),
    listTenantResourceManualProofRecords(workspaceId),
    listTenantResourceGuardedWritePilotRecords(workspaceId),
  ]);

  const duplicateEmailCount = Array.from(
    contactsWithEmail.reduce((acc, contact) => {
      const email = String(contact.email ?? "").trim().toLowerCase();
      if (!email) return acc;
      acc.set(email, (acc.get(email) ?? 0) + 1);
      return acc;
    }, new Map<string, number>()).values(),
  ).filter((count) => count > 1).length;
  const connectors = connectorRows.map((connector) => {
    const dingtalkMetadata =
      connector.provider === "DINGTALK"
        ? parseDingTalkConnectorMetadata(connector.metadata)
        : null;
    const feishuMetadata =
      connector.provider === "FEISHU"
        ? parseFeishuConnectorMetadata(connector.metadata)
        : null;
    const wecomMetadata =
      connector.provider === "WECOM"
        ? parseWeComConnectorMetadata(connector.metadata)
        : null;

    return {
      id: connector.id,
      provider: connector.provider,
      status: connector.status,
      externalAccountEmail: connector.externalAccountEmail,
      lastSyncedAt: connector.lastSyncedAt,
      lastSyncStatus: connector.lastSyncStatus,
      lastSyncMessage: connector.lastSyncMessage,
      createdAt: connector.createdAt,
      user: connector.user,
      lastCallbackResult:
        dingtalkMetadata?.lastCallbackResult ??
        feishuMetadata?.lastCallbackResult ??
        wecomMetadata?.lastCallbackResult ??
        null,
      lastIngestResult:
        dingtalkMetadata?.lastIngestResult ??
        feishuMetadata?.lastIngestResult ??
        wecomMetadata?.lastIngestResult ??
        null,
      calendarRegistry:
        connector.provider === "WECOM" ? wecomMetadata?.calendarRegistry ?? null : null,
    };
  });

  const connectorMetadataDryRunSummary =
    connectorRows
      .filter((connector) => connector.provider === "DINGTALK")
      .map((connector) => {
        const metadata = parseDingTalkConnectorMetadata(connector.metadata);
        const snapshot = metadata.lastDirectoryInviteDryRunSnapshot;
        if (!snapshot) {
          return null;
        }
        const recordedAt = new Date(snapshot.recordedAt);
        return parseDingTalkDirectoryInviteDryRunSummary({
          createdAt: Number.isNaN(recordedAt.getTime()) ? connector.updatedAt : recordedAt,
          payload: {
            dryRun: true,
            result: {
              processed: snapshot.processed,
              createdUsers: snapshot.createdUsers,
              reusedUsers: snapshot.reusedUsers,
              upsertedMemberships: snapshot.upsertedMemberships,
              sentMessages: snapshot.sentMessages,
              skipped: snapshot.skipped,
              skippedNoMobile: snapshot.skippedNoMobile,
              nameCollisionResolved: snapshot.nameCollisionResolved,
              errors: snapshot.errors,
              details: snapshot.details,
            },
          },
        });
      })
      .find((item) => item !== null) ?? null;

  const recentImportFailures = recentImportEvents.reduce((sum, event) => {
    const metadata = safeParseJson<Record<string, unknown>>(event.metadata, {});
    return sum + Number(metadata.failedCount ?? 0);
  }, 0);
  const dingtalkIngestionPreview = recentDingTalkIngestionRows.map((row) => {
    const draftPayload = safeParseJson<Record<string, unknown>>(row.draftPayload, {});
    const subject =
      draftPayload.subject && typeof draftPayload.subject === "object"
        ? (draftPayload.subject as Record<string, unknown>)
        : {};
    return {
      id: row.id,
      createdAt: row.createdAt,
      sourceScope: row.sourceScope,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      scope: typeof draftPayload.scope === "string" ? draftPayload.scope : null,
      subjectUserId:
        typeof subject.userId === "string" && subject.userId.trim()
          ? subject.userId.trim()
          : null,
      subjectUnionId:
        typeof subject.unionId === "string" && subject.unionId.trim()
          ? subject.unionId.trim()
          : null,
      sourceSummary: row.sourceSummary,
      evidenceRef: row.evidenceRef,
    };
  });

  const connectorErrorCount = connectors.filter(
    (connector) => connector.status === "ERROR" || /失败|异常/.test(connector.lastSyncStatus ?? ""),
  ).length;
  const connectedConnectorCount = connectors.filter((connector) => connector.status === "CONNECTED").length;
  const crmSourceErrorCount = importSources.filter((source) => source.status === "ERROR").length;
  const connectedCrmSourceCount = importSources.filter((source) => source.status === "CONNECTED").length;
  const approvalProtectedActions = policies.filter((policy) => policy.mode === "REQUIRES_APPROVAL").length;
  const membershipLifecycle = buildMembershipLifecycleSummary({
    memberships: billingSnapshot.memberships,
    includedAdminSeats: workspace?.billingAccount?.includedAdminSeats ?? 1,
    trialCollaboratorSeats: billingSnapshot.trialCollaboratorSeats,
  });
  const workerEntitlementSummary = buildWorkerEntitlementOpsSummary(billingSnapshot.workerEntitlements);
  const workerCommercialOverview = billingSnapshot.workerEntitlements.map((entitlement) => ({
    id: entitlement.id,
    entitlementType: entitlement.entitlementType,
    status: entitlement.status,
    effectiveFrom: entitlement.effectiveFrom,
    effectiveTo: entitlement.effectiveTo,
    internalLimit: entitlement.internalLimit,
    ...buildWorkerCommercialWiringView(entitlement),
  }));
  const internalUsageOverview = buildInternalUsageOpsSummary(billingSnapshot.usageSummary);
  const lifecycleBoundarySummary = getLifecycleBoundarySummary(
    billingSnapshot.accessState,
    workspace?.defaultLocale === "en-US",
  );
  const activeSeatCount = membershipLifecycle.activeSeatCount;
  const invitedSeatCount = membershipLifecycle.invitedSeatCount;
  const additionalBillableSeats = membershipLifecycle.additionalBillableSeats;
  const paymentRail = resolveWorkspacePaymentRail({
    defaultLocale: workspace?.defaultLocale ?? null,
    paymentProvider: workspace?.billingAccount?.paymentProvider ?? null,
    paymentCustomerId: workspace?.billingAccount?.paymentCustomerId ?? null,
    paymentSubscriptionId: workspace?.billingAccount?.paymentSubscriptionId ?? null,
    paymentSubscriptionStatus: workspace?.billingAccount?.paymentSubscriptionStatus ?? null,
  });
  const billingActionState = getBillingOverviewActionState({
    accessState: billingSnapshot.accessState,
    checkoutConfigured: paymentRail.checkoutConfigured,
    portalConfigured: paymentRail.portalConfigured,
    lifecycleSourceConnected: paymentRail.lifecycleSourceConnected,
    billingPortalMode: paymentRail.billingPortalMode,
    paymentCustomerId: workspace?.billingAccount?.paymentCustomerId ?? null,
    paymentSubscriptionStatus: workspace?.billingAccount?.paymentSubscriptionStatus ?? null,
  });
  const chinaRenewRestoreSummary =
    paymentRail.region === "CN"
      ? getChinaRenewRestoreSummary({
          accessState: billingSnapshot.accessState,
          english: workspace?.defaultLocale === "en-US",
        })
      : null;
  const paymentProviderOptions = paymentRail.availableProviders.map((provider) => {
    const providerRail = resolveWorkspacePaymentRail({
      defaultLocale: workspace?.defaultLocale ?? null,
      paymentProvider: provider,
      paymentCustomerId:
        workspace?.billingAccount?.paymentProvider === provider
          ? workspace?.billingAccount?.paymentCustomerId ?? null
          : null,
      paymentSubscriptionId:
        workspace?.billingAccount?.paymentProvider === provider
          ? workspace?.billingAccount?.paymentSubscriptionId ?? null
          : null,
      paymentSubscriptionStatus:
        workspace?.billingAccount?.paymentProvider === provider
          ? workspace?.billingAccount?.paymentSubscriptionStatus ?? null
          : null,
    });
    const providerActionState = getBillingOverviewActionState({
      accessState: billingSnapshot.accessState,
      checkoutConfigured: providerRail.checkoutConfigured,
      portalConfigured: providerRail.portalConfigured,
      lifecycleSourceConnected: providerRail.lifecycleSourceConnected,
      billingPortalMode: providerRail.billingPortalMode,
      paymentCustomerId:
        workspace?.billingAccount?.paymentProvider === provider
          ? workspace?.billingAccount?.paymentCustomerId ?? null
          : null,
      paymentSubscriptionStatus: workspace?.billingAccount?.paymentSubscriptionStatus ?? null,
    });

    return {
      provider,
      checkoutMode: providerRail.checkoutMode,
      integrationStage: providerRail.integrationStage,
      checkoutReady: providerActionState.checkoutReady,
      lifecycleSourceConnected: providerRail.lifecycleSourceConnected,
      current: paymentRail.provider === provider,
    };
  });

  const organizations = await Promise.all(
    userOrganizations.map(async (membership) => {
      const summary = await getWorkspaceBillingSnapshot(membership.workspaceId);
      const memberCount = await db.membership.count({
        where: {
          workspaceId: membership.workspaceId,
          status: {
            not: MembershipStatus.INACTIVE,
          },
        },
      });

      return {
        workspaceId: membership.workspaceId,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        role: membership.role,
        membershipStatus: membership.status,
        workspaceStatus: membership.workspace.status,
        accessState: summary.accessState,
        memberCount,
      };
    }),
  );
  const activeMembership =
    userOrganizations.find((membership) => membership.workspaceId === workspaceId) ??
    userOrganizations[0] ??
    null;
  const canManageMembers = canManageWorkspaceMembers(activeMembership?.role);
  const billingManagementEnabled = canManageWorkspaceBilling(activeMembership?.role);
  const policyManagementEnabled = canManageWorkspacePolicies(activeMembership?.role);
  const workspaceSetupManagementEnabled = canManageWorkspaceSetup(activeMembership?.role);
  const operationalControlsEnabled = canManageWorkspaceOperationalControls(activeMembership?.role);
  const connectorManagementEnabled = canManageWorkspaceConnectors(activeMembership?.role);
  const importManagementEnabled = canManageWorkspaceImports(activeMembership?.role);
  const importConflictResolutionEnabled = canResolveWorkspaceImportConflicts(activeMembership?.role);
  const governedActionManagementEnabled = canManageWorkspaceGovernedActions(
    activeMembership?.role,
  );
  const governedActionReviewEnabled = canReviewWorkspaceGovernedActions(
    activeMembership?.role,
  );
  const insightManagementEnabled = canManageWorkspaceInsights(activeMembership?.role);
  const workspaceRecordManagementEnabled = canManageWorkspaceRecords(activeMembership?.role);
  const workspaceInternalActionManagementEnabled = canManageWorkspaceInternalActions(
    activeMembership?.role,
  );
  const organizationAuditReadable = canReadWorkspaceAdminAudit(activeMembership?.role);
  const organizationSupportPackExportEnabled = canExportWorkspaceAdminSupportPack(activeMembership?.role);
  const activeOwnerCount = memberships.filter(
    (membership) =>
      membership.role === WorkspaceRole.OWNER && membership.status !== MembershipStatus.INACTIVE,
  ).length;
  const reservedWorkspace = isOperationalHelmReservedWorkspace(workspace);
  const membershipsWithVisibility = maskMembershipGoalProfileFields(
    memberships,
    canManageMembers,
  );
  const contributionRegistryReadable = reservedWorkspace && canReadContributionRegistry(activeMembership?.role);
  const contributionRegistryManagementEnabled =
    reservedWorkspace && canManageContributionRegistry(activeMembership?.role);
  const manualSettlementManagementEnabled =
    reservedWorkspace && canManageManualSettlement(activeMembership?.role);
  const participantPortalManagementEnabled =
    reservedWorkspace && canManageParticipantPortal(activeMembership?.role);
  const programApplicationManagementEnabled =
    reservedWorkspace && canManageProgramApplications(activeMembership?.role);
  const reservedCommercialReadable = contributionRegistryReadable;
  const reservedFormalSkillGovernanceReadable = reservedWorkspace;
  const english = workspace?.defaultLocale === "en-US";
  const formalSkillReviewQueue = reservedFormalSkillGovernanceReadable
    ? await getFormalSkillReviewQueue(workspaceId, 6)
    : [];
  const recentFormalReviewDecisions = reservedFormalSkillGovernanceReadable
    ? await getRecentFormalReviewDecisions(workspaceId, 6)
    : [];
  const organizationGovernance = organizationAuditReadable
    ? await getOrgAdminGovernanceSummary(workspaceId, {
        currentAuthSessionId,
      })
    : null;
  const recentOrganizationAudit = organizationAuditReadable
    ? await db.auditLog.findMany({
        where: {
          workspaceId,
          actionType: {
            in: organizationAuditActionTypes,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      })
    : [];
  const latestSnapshotTableDryRunSummary = connectorManagementEnabled
    ? await getLatestDingTalkDirectoryInviteDryRunSnapshot(workspaceId)
    : null;
  const recentDingTalkDirectoryInviteDryRunUsages = connectorManagementEnabled
    ? await db.usageLedger.findMany({
        where: {
          workspaceId,
          usageType: UsageType.CONNECTOR_SYNC,
        },
        orderBy: { recordedAt: "desc" },
        take: 24,
      })
    : [];
  const usageDryRunSummary =
    recentDingTalkDirectoryInviteDryRunUsages
      .map((item) =>
        parseDingTalkDirectoryInviteDryRunSummary({
          payload: safeParseJson(item.metadata, null),
          createdAt: item.recordedAt,
        }),
      )
      .find((item) => item !== null) ?? null;
  const recentDingTalkDirectoryInviteAudits = connectorManagementEnabled
    ? await db.auditLog.findMany({
        where: {
          workspaceId,
          actionType: {
            in: [...dingtalkDirectoryInviteAuditActionTypes],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      })
    : [];
  const auditDryRunSummary =
    recentDingTalkDirectoryInviteAudits
      .map((item) =>
        parseDingTalkDirectoryInviteDryRunSummary({
          payload: safeParseJson(item.payload, null),
          createdAt: item.createdAt,
        }),
      )
      .find((item) => item !== null) ?? null;
  const dingtalkDirectoryInviteDryRunCandidates = [
    latestSnapshotTableDryRunSummary,
    usageDryRunSummary,
    auditDryRunSummary,
    connectorMetadataDryRunSummary,
  ].filter(
    (
      item,
    ): item is NonNullable<
      typeof usageDryRunSummary
    > => Boolean(item && item.recordedAt instanceof Date && !Number.isNaN(item.recordedAt.getTime())),
  );
  const dingtalkDirectoryInviteDryRun =
    dingtalkDirectoryInviteDryRunCandidates
      .sort((left, right) => right.recordedAt.getTime() - left.recordedAt.getTime())
      .find((item) => item.details.length > 0) ??
    dingtalkDirectoryInviteDryRunCandidates[0] ??
    null;
  if (reservedCommercialReadable) {
    await ensureWorkspaceProgramCatalogFoundation(workspaceId, undefined, {
      userId,
      actorType: ActorType.USER,
      english,
    });
  }
  const revenueAttributionSnapshot = reservedCommercialReadable
    ? await getWorkspaceRevenueAttributionSnapshot(workspaceId, {
        userId,
        actorType: ActorType.USER,
        english,
      })
    : {
        workerPublisherProfiles: [],
        salesReferrals: [],
        customEngagements: [],
        revenueRules: [],
        revenueAttributionEntries: [],
        payoutEntries: [],
      };
  const manualSettlementSnapshot = reservedCommercialReadable
    ? await getWorkspaceManualSettlementSnapshot(workspaceId)
    : {
        payoutProfiles: [],
        settlementBatches: [],
        currentBatch: null,
      };
  const participantPortalAccesses = reservedCommercialReadable
    ? await db.participantPortalAccess.findMany({
        where: {
          workspaceId,
          status: {
            in: [
              ParticipantPortalAccessStatus.INVITED,
              ParticipantPortalAccessStatus.ACTIVE,
              ParticipantPortalAccessStatus.SUSPENDED,
              ParticipantPortalAccessStatus.ARCHIVED,
            ],
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ lastInviteIssuedAt: "desc" }, { createdAt: "desc" }],
      })
    : [];
  const partnerPrograms = reservedCommercialReadable
    ? await db.partnerProgram.findMany({
        where: { workspaceId },
        include: {
          termsVersions: {
            where: {
              status: {
                in: [ProgramTermsVersionStatus.ACTIVE, ProgramTermsVersionStatus.SUPERSEDED],
              },
            },
            orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
          },
          applications: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const programApplications = reservedCommercialReadable
    ? await db.programApplication.findMany({
        where: { workspaceId },
        include: {
          partnerProgram: {
            select: {
              id: true,
              programKey: true,
              slug: true,
              title: true,
            },
          },
          programTermsVersion: {
            select: {
              id: true,
              versionKey: true,
              title: true,
            },
          },
          reviewedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          participantPortalAccess: {
            select: {
              id: true,
              status: true,
              inviteEmail: true,
              lastInviteIssuedAt: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          workerPublisherProfile: {
            select: {
              id: true,
              displayName: true,
              publisherKey: true,
            },
          },
          salesReferral: {
            select: {
              id: true,
              beneficiaryLabel: true,
              referralKey: true,
            },
          },
          customEngagement: {
            select: {
              id: true,
              label: true,
              engagementKey: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      })
    : [];
  const extensionManifestInputs = workspaceSolutionExtensions
    .map((extension) => toTenantResourceExtensionManifestInput(extension.extensionKey))
    .filter(isDefined);
  const tenantResourceReadiness = buildTenantResourceReadiness({
    connectors: connectorRows.map((connector) => ({
      id: connector.id,
      workspaceId: connector.workspaceId,
      provider: connector.provider,
      status: connector.status,
      externalAccountEmail: connector.externalAccountEmail,
      manualSendEnabled: connector.manualSendEnabled,
      lastSyncedAt: connector.lastSyncedAt,
      lastSyncStatus: connector.lastSyncStatus,
      lastSyncMessage: connector.lastSyncMessage,
      tokenExpiresAt: connector.tokenExpiresAt,
      updatedAt: connector.updatedAt,
    })),
    importSources,
    importJobs: recentImportJobs,
    extensions: workspaceSolutionExtensions.map((extension) => ({
      id: extension.id,
      workspaceId: extension.workspaceId,
      extensionKey: extension.extensionKey,
      kind: extension.kind,
      status: extension.status,
      version: extension.version,
      updatedAt: extension.updatedAt,
    })),
    extensionManifests: extensionManifestInputs,
    captureSessions: recentCaptureSessions.map((session) => ({
      id: session.id,
      workspaceId: session.workspaceId,
      title: session.title,
      status: session.status,
      sourceType: session.sourceType,
      transcriptStatus: session.transcriptStatus,
      processingStatus: session.processingStatus,
      updatedAt: session.updatedAt,
    })),
  });
  const tenantResourceLoops = tenantResourceReadiness.resources.map((resource) =>
    buildTenantResourceGovernedLoop({
      actorUserId: userId,
      activeWorkspaceId: workspaceId,
      membershipRole: activeMembership?.role ?? null,
      workspaceClass: workspace?.workspaceClass ?? null,
      resource,
      requestedEffectMode: resource.governance.allowedEffectModes.at(-1) ?? "read_only",
      requiredCapability: requiredCapabilityForTenantResource(resource),
      now: new Date(tenantResourceReadiness.generatedAt),
      signal: {
        signalId: `settings-resource-evidence:${resource.resourceKey}`,
        title: `${resource.resourceName} evidence detail`,
        objectType: "TenantResource",
        objectRef: resource.resourceKey,
        summary: resource.readiness.operatorNextMove,
        evidenceRefs: resource.evidenceRefs,
      },
    }),
  );
  const tenantResourceCapabilityReadouts = tenantResourceLoops.map((loop) => ({
    resourceKey: loop.resourceIdentity,
    ...buildCapabilityDecisionOperatorReadout(loop.capabilityTrace),
  }));
  const resourcesByKey = new Map(
    tenantResourceReadiness.resources.map((resource) => [resource.resourceKey, resource]),
  );
  const tenantResourceExtensionAdoptionReadouts =
    buildTenantExtensionResourceAdoptionReadouts({
      readiness: tenantResourceReadiness,
      extensionManifests: extensionManifestInputs,
    });
  const extensionAdoptionByResourceKey = new Map(
    tenantResourceExtensionAdoptionReadouts.map((readout) => [readout.resourceKey, readout]),
  );
  const tenantResourceEvidenceDetails = tenantResourceLoops
    .map((loop) => {
      const resource = resourcesByKey.get(loop.resourceIdentity);
      return resource
        ? buildTenantResourceEvidenceDetail({
            resource,
            loop,
            manualProofRecords: tenantResourceManualProofRecords,
            extensionAdoptionReadout:
              extensionAdoptionByResourceKey.get(resource.resourceKey) ?? null,
          })
        : undefined;
    })
    .filter(isDefined);
  const tenantResourcePolicyReadout = buildTenantResourcePolicyReadout({
    readiness: tenantResourceReadiness,
  });
  const tenantResourceGuardedWriteEvaluation = buildTenantResourceGuardedWriteEvaluation({
    readiness: tenantResourceReadiness,
    evidenceDetails: tenantResourceEvidenceDetails,
    policyReadout: tenantResourcePolicyReadout,
  });
  const tenantResourceGuardedWritePilotReadouts =
    buildTenantResourceGuardedWritePilotReadouts({
      evidenceDetails: tenantResourceEvidenceDetails,
      guardedWriteEvaluation: tenantResourceGuardedWriteEvaluation,
      records: tenantResourceGuardedWritePilotRecords,
    });
  const revenueRuleSummary = reservedCommercialReadable
    ? buildRevenueRuleOpsSummary(revenueAttributionSnapshot.revenueRules)
    : emptyRevenueRuleSummary;
  const revenueAttributionSummary = reservedCommercialReadable
    ? buildRevenueAttributionOpsSummary(
        revenueAttributionSnapshot.revenueAttributionEntries,
        revenueAttributionSnapshot.payoutEntries,
      )
    : emptyRevenueAttributionSummary;
  const settlementSummary =
    reservedCommercialReadable && manualSettlementSnapshot.currentBatch
      ? buildSettlementLineOpsSummary(
          manualSettlementSnapshot.currentBatch.lines.map((line) => ({
            sourceType: line.sourceType,
            amountCents: line.amountCents,
            status: line.status,
            hasPayoutProfile:
              !beneficiarySupportsPayoutProfile(line.beneficiaryType) || line.beneficiaryPayoutProfile !== null,
            beneficiaryKey: `${line.beneficiaryType}:${line.beneficiaryLabel}`,
          })),
        )
      : emptySettlementSummary;
  const payoutRailReadiness = reservedCommercialReadable
    ? buildPayoutRailReadinessSummary({
        payoutProfiles: manualSettlementSnapshot.payoutProfiles,
        settlementBatches: manualSettlementSnapshot.settlementBatches,
        currentBatch: manualSettlementSnapshot.currentBatch,
        participantPortalAccesses,
      })
    : emptyPayoutRailReadiness;
  const settlementOpsProofPack = reservedCommercialReadable
    ? buildSettlementOpsProofPackSummary({
        payoutEntries: revenueAttributionSnapshot.payoutEntries,
        payoutProfiles: manualSettlementSnapshot.payoutProfiles,
        participantPortalAccesses,
        settlementBatches: manualSettlementSnapshot.settlementBatches,
      })
    : emptySettlementOpsProofPack;
  const settlementExceptionSummary = reservedCommercialReadable
    ? buildSettlementExceptionSummary({
        currentBatch: manualSettlementSnapshot.currentBatch,
        settlementBatches: manualSettlementSnapshot.settlementBatches,
        payoutProfiles: manualSettlementSnapshot.payoutProfiles,
        participantPortalAccesses,
      })
    : emptySettlementExceptionSummary;
  const payoutRailPilotCohort = reservedCommercialReadable
    ? buildPayoutRailPilotCohortSummary({
        paymentRegion: paymentRail.region,
        payoutRailReadiness,
        settlementExceptionSummary,
        payoutEntries: revenueAttributionSnapshot.payoutEntries,
        payoutProfiles: manualSettlementSnapshot.payoutProfiles,
        participantPortalAccesses,
        settlementBatches: manualSettlementSnapshot.settlementBatches,
      })
    : emptyPayoutRailPilotCohort;
  const programApplicationSummary = programApplications.reduce(
    (summary, application) => {
      summary.totalCount += 1;

      if (application.status === ProgramApplicationStatus.SUBMITTED) {
        summary.submittedCount += 1;
      } else if (application.status === ProgramApplicationStatus.ACCEPTED) {
        summary.acceptedCount += 1;
      } else if (application.status === ProgramApplicationStatus.REJECTED) {
        summary.rejectedCount += 1;
      } else if (application.status === ProgramApplicationStatus.WAITLISTED) {
        summary.waitlistedCount += 1;
      } else if (application.status === ProgramApplicationStatus.INVITED) {
        summary.invitedCount += 1;
      }

      if (
        application.status === ProgramApplicationStatus.ACCEPTED &&
        !application.participantPortalAccess
      ) {
        summary.readyForInviteCount += 1;
      }

      return summary;
    },
    {
      totalCount: 0,
      submittedCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      waitlistedCount: 0,
      invitedCount: 0,
      readyForInviteCount: 0,
    },
  );

  return {
    workspace,
    policies,
    budgets,
    memberships: membershipsWithVisibility,
    notifications,
    connectors,
    tenantResourceReadiness,
    tenantResourceCapabilityReadouts,
    tenantResourceEvidenceDetails,
    tenantResourcePolicyReadout,
    tenantResourceGuardedWriteEvaluation,
    tenantResourceGuardedWritePilotReadouts,
    dingtalkIngestionPreview,
    importSources,
    organizations,
    skillSuggestions,
    formalSkillReviewQueue,
    recentFormalReviewDecisions,
    recentSkillAdoptions,
    strategySuggestions,
    recentStrategyAdoptions,
    organizationSummary: {
      activeWorkspaceId: workspaceId,
      currentAuthSessionId,
      currentUserId: userId,
      activeMembershipRole: activeMembership?.role ?? "OWNER",
      canManageMembers,
      canManageBilling: billingManagementEnabled,
      canManageContributionRegistry: contributionRegistryManagementEnabled,
      canManageManualSettlement: manualSettlementManagementEnabled,
      canManageParticipantPortal: participantPortalManagementEnabled,
      canManagePolicies: policyManagementEnabled,
      canManageWorkspaceSetup: workspaceSetupManagementEnabled,
      canManageOperationalControls: operationalControlsEnabled,
      canManageProgramApplications: programApplicationManagementEnabled,
      canManageConnectors: connectorManagementEnabled,
      canManageImports: importManagementEnabled,
      canResolveImportConflicts: importConflictResolutionEnabled,
      canManageGovernedActions: governedActionManagementEnabled,
      canReviewGovernedActions: governedActionReviewEnabled,
      canManageInsights: insightManagementEnabled,
      canManageWorkspaceRecords: workspaceRecordManagementEnabled,
      canManageInternalActions: workspaceInternalActionManagementEnabled,
      canReadOrganizationAudit: organizationAuditReadable,
      canExportOrganizationSupportPack: organizationSupportPackExportEnabled,
      activeOwnerCount,
      reservedWorkspace,
      reservedCommercialReadable,
      reservedFormalSkillGovernanceReadable,
      contributionRegistryReadable,
      activeSeatCount,
      invitedSeatCount,
      inactiveSeatCount: membershipLifecycle.inactiveSeatCount,
      currentState: billingSnapshot.accessState,
      workspaceStatus: workspace?.status ?? "ACTIVE",
      selfServeTrialWorkspace: String(workspace?.configuration ?? "").includes("\"onboardingMode\":\"self-serve-trial-v1\""),
    },
    organizationAudit: recentOrganizationAudit.map((item) => ({
      id: item.id,
      actor: item.actor,
      actionType: item.actionType,
      summary: item.summary,
      targetType: item.targetType,
      targetId: item.targetId,
      createdAt: item.createdAt,
      payload: safeParseJson(item.payload, null),
    })),
    dingtalkDirectoryInviteDryRun,
    organizationGovernance,
    lifecycleBoundarySummary,
    chinaRenewRestoreSummary,
    billingOverview: {
      currentPlan: workspace?.billingAccount?.currentPlan ?? "helm_team_v1",
      currency: workspace?.billingAccount?.currency ?? "CNY",
      baseFeeCents: workspace?.billingAccount?.baseFeeCents ?? 0,
      activeSeatPriceCents: workspace?.billingAccount?.activeSeatPriceCents ?? 0,
      includedAdminSeats: workspace?.billingAccount?.includedAdminSeats ?? 1,
      trialStartedAt: workspace?.trialState?.trialStartedAt ?? null,
      trialEndsAt: workspace?.trialState?.trialEndsAt ?? null,
      graceEndsAt: workspace?.trialState?.graceEndsAt ?? null,
      currentState: billingSnapshot.accessState,
      activeSeatCount,
      trialCollaboratorSeats: billingSnapshot.trialCollaboratorSeats,
      additionalBillableSeats,
      paymentConfigured: paymentRail.checkoutConfigured,
      paymentProvider: paymentRail.provider,
      paymentRegion: paymentRail.region,
      checkoutMode: paymentRail.checkoutMode,
      billingPortalMode: paymentRail.billingPortalMode,
      callbackMode: paymentRail.callbackMode,
      lifecycleMappingMode: paymentRail.lifecycleMappingMode,
      lifecycleSource: paymentRail.lifecycleSource,
      paymentRailStage: paymentRail.integrationStage,
      lifecycleSourceConnected: paymentRail.lifecycleSourceConnected,
      availableProviders: paymentRail.availableProviders,
      providerOptions: paymentProviderOptions,
      paymentCustomerId: workspace?.billingAccount?.paymentCustomerId ?? null,
      paymentSubscriptionId: workspace?.billingAccount?.paymentSubscriptionId ?? null,
      paymentSubscriptionStatus: workspace?.billingAccount?.paymentSubscriptionStatus ?? null,
      paymentCheckoutCompletedAt: workspace?.billingAccount?.paymentCheckoutCompletedAt ?? null,
      billingPeriodEndsAt: workspace?.billingAccount?.billingPeriodEndsAt ?? null,
      lastPaymentSyncAt: workspace?.billingAccount?.lastPaymentSyncAt ?? null,
      checkoutReady: billingActionState.checkoutReady,
      portalReady: billingActionState.portalReady,
      refreshReady: billingActionState.refreshReady,
    },
    seatSummary: membershipLifecycle,
    workerEntitlements: billingSnapshot.workerEntitlements,
    workerCommercialOverview,
    workerEntitlementSummary,
    usageSummary: billingSnapshot.usageSummary,
    internalUsageOverview,
    workerPublisherProfiles: revenueAttributionSnapshot.workerPublisherProfiles.map((profile) => ({
      id: profile.id,
      publisherKey: profile.publisherKey,
      displayName: profile.displayName,
      contactEmail: profile.contactEmail,
      status: profile.status,
      notes: profile.notes,
      createdAt: profile.createdAt,
    })),
    salesReferrals: revenueAttributionSnapshot.salesReferrals.map((referral) => ({
      id: referral.id,
      referralKey: referral.referralKey,
      beneficiaryLabel: referral.beneficiaryLabel,
      beneficiaryContact: referral.beneficiaryContact,
      status: referral.status,
      effectiveFrom: referral.effectiveFrom,
      effectiveTo: referral.effectiveTo,
      notes: referral.notes,
      createdAt: referral.createdAt,
    })),
    customEngagements: revenueAttributionSnapshot.customEngagements.map((engagement) => ({
      id: engagement.id,
      engagementKey: engagement.engagementKey,
      engagementType: engagement.engagementType,
      label: engagement.label,
      beneficiaryLabel: engagement.beneficiaryLabel,
      contractValueCents: engagement.contractValueCents,
      currency: engagement.currency,
      status: engagement.status,
      effectiveFrom: engagement.effectiveFrom,
      effectiveTo: engagement.effectiveTo,
      notes: engagement.notes,
      createdAt: engagement.createdAt,
    })),
    revenueRules: revenueAttributionSnapshot.revenueRules.map((rule) => ({
      id: rule.id,
      ruleKey: rule.ruleKey,
      name: rule.name,
      sourceType: rule.sourceType,
      beneficiaryType: rule.beneficiaryType,
      beneficiaryLabel: rule.beneficiaryLabel,
      cadence: rule.cadence,
      valueType: rule.valueType,
      percentBps: rule.percentBps,
      fixedAmountCents: rule.fixedAmountCents,
      currency: rule.currency,
      reverseOnCancel: rule.reverseOnCancel,
      workerKey: rule.workerKey,
      notes: rule.notes,
      status: rule.status,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      workerPublisherProfileId: rule.workerPublisherProfileId,
      salesReferralId: rule.salesReferralId,
      customEngagementId: rule.customEngagementId,
    })),
    revenueRuleSummary,
    revenueAttributionEntries: revenueAttributionSnapshot.revenueAttributionEntries.map((entry) => ({
      id: entry.id,
      sourceType: entry.sourceType,
      beneficiaryType: entry.beneficiaryType,
      sourceLabel: entry.sourceLabel,
      sourceReference: entry.sourceReference,
      beneficiaryLabel: entry.beneficiaryLabel,
      grossAmountCents: entry.grossAmountCents,
      attributedAmountCents: entry.attributedAmountCents,
      currency: entry.currency,
      status: entry.status,
      recognizedAt: entry.recognizedAt,
      reversalReason: entry.reversalReason,
      revenueRuleId: entry.revenueRuleId,
      ruleKey: entry.revenueRule?.ruleKey ?? null,
      ruleName: entry.revenueRule?.name ?? null,
      ruleCadence: entry.revenueRule?.cadence ?? null,
      ruleValueType: entry.revenueRule?.valueType ?? null,
      ruleReverseOnCancel: entry.revenueRule?.reverseOnCancel ?? null,
      workerPublisherProfileId: entry.workerPublisherProfileId,
      salesReferralId: entry.salesReferralId,
      customEngagementId: entry.customEngagementId,
    })),
    payoutEntries: revenueAttributionSnapshot.payoutEntries.map((entry) => ({
      id: entry.id,
      beneficiaryType: entry.beneficiaryType,
      beneficiaryLabel: entry.beneficiaryLabel,
      payableAmountCents: entry.payableAmountCents,
      currency: entry.currency,
      status: entry.status,
      payableAfter: entry.payableAfter,
      approvedAt: entry.approvedAt,
      paidAt: entry.paidAt,
      reversedAt: entry.reversedAt,
      notes: entry.notes,
      revenueAttributionLedgerId: entry.revenueAttributionLedgerId,
      sourceType: entry.revenueAttributionLedger.sourceType,
      revenueRuleId: entry.revenueAttributionLedger.revenueRuleId,
      ruleKey: entry.revenueAttributionLedger.revenueRule?.ruleKey ?? null,
      ruleCadence: entry.revenueAttributionLedger.revenueRule?.cadence ?? null,
      ruleReverseOnCancel: entry.revenueAttributionLedger.revenueRule?.reverseOnCancel ?? null,
      workerPublisherProfileId: entry.workerPublisherProfileId,
      salesReferralId: entry.salesReferralId,
      customEngagementId: entry.customEngagementId,
    })),
    revenueAttributionSummary,
    beneficiaryPayoutProfiles: manualSettlementSnapshot.payoutProfiles.map((profile) => ({
      id: profile.id,
      beneficiaryType: profile.beneficiaryType,
      beneficiaryReference: profile.beneficiaryReference,
      displayName: profile.displayName,
      legalName: profile.legalName,
      contact: profile.contact,
      payoutMethodLabel: profile.payoutMethodLabel,
      payoutDetailsReference: profile.payoutDetailsReference,
      invoiceRequired: profile.invoiceRequired,
      status: profile.status,
      notes: profile.notes,
      workerPublisherProfileId: profile.workerPublisherProfileId,
      salesReferralId: profile.salesReferralId,
      customEngagementId: profile.customEngagementId,
      createdAt: profile.createdAt,
    })),
    participantPortalAccesses: participantPortalAccesses.map((access) => ({
      id: access.id,
      beneficiaryType: access.beneficiaryType,
      beneficiaryReference: access.beneficiaryReference,
      inviteEmail: access.inviteEmail,
      displayName: access.displayName,
      contact: access.contact,
      status: access.status,
      termsAcceptedAt: access.termsAcceptedAt,
      lastInviteIssuedAt: access.lastInviteIssuedAt,
      activatedAt: access.activatedAt,
      suspendedAt: access.suspendedAt,
      archivedAt: access.archivedAt,
      notes: access.notes,
      workerPublisherProfileId: access.workerPublisherProfileId,
      salesReferralId: access.salesReferralId,
      customEngagementId: access.customEngagementId,
      user: access.user,
    })),
    partnerPrograms: partnerPrograms.map((program) => ({
      id: program.id,
      programKey: program.programKey,
      slug: program.slug,
      title: program.title,
      summary: program.summary,
      status: program.status,
      programType: program.programType,
      beneficiaryType: program.beneficiaryType,
      audienceSummary: program.audienceSummary,
      contributionSummary: program.contributionSummary,
      revenueSummary: program.revenueSummary,
      settlementSummary: program.settlementSummary,
      boundarySummary: program.boundarySummary,
      applicationCount: program.applications.length,
      activeTermsVersion: program.termsVersions[0]
        ? {
            id: program.termsVersions[0].id,
            versionKey: program.termsVersions[0].versionKey,
            title: program.termsVersions[0].title,
            effectiveFrom: program.termsVersions[0].effectiveFrom,
            publishedAt: program.termsVersions[0].publishedAt,
            status: program.termsVersions[0].status,
          }
        : null,
    })),
    programApplications: programApplications.map((application) => ({
      id: application.id,
      applicantName: application.applicantName,
      applicantEmail: application.applicantEmail,
      applicantOrganization: application.applicantOrganization,
      roleTitle: application.roleTitle,
      website: application.website,
      regionLabel: application.regionLabel,
      background: application.background,
      contributionPlan: application.contributionPlan,
      status: application.status,
      termsAcceptedAt: application.termsAcceptedAt,
      internalNotes: application.internalNotes,
      recommendedBeneficiaryType:
        application.recommendedBeneficiaryType === "WORKER_PUBLISHER" ||
        application.recommendedBeneficiaryType === "SALES_REFERRAL" ||
        application.recommendedBeneficiaryType === "CUSTOM_SERVICES"
          ? application.recommendedBeneficiaryType
          : null,
      reviewedAt: application.reviewedAt,
      invitedAt: application.invitedAt,
      createdAt: application.createdAt,
      workerPublisherProfileId: application.workerPublisherProfileId,
      salesReferralId: application.salesReferralId,
      customEngagementId: application.customEngagementId,
      partnerProgram: application.partnerProgram,
      programTermsVersion: application.programTermsVersion,
      reviewedByUser: application.reviewedByUser,
      participantPortalAccess: application.participantPortalAccess
        ? {
            id: application.participantPortalAccess.id,
            status: application.participantPortalAccess.status,
            inviteEmail: application.participantPortalAccess.inviteEmail,
            lastInviteIssuedAt: application.participantPortalAccess.lastInviteIssuedAt,
            user: application.participantPortalAccess.user,
          }
        : null,
      linkedBeneficiary:
        application.workerPublisherProfile
          ? {
              type: "WORKER_PUBLISHER" as const,
              id: application.workerPublisherProfile.id,
              label: application.workerPublisherProfile.displayName,
              reference: application.workerPublisherProfile.publisherKey,
            }
          : application.salesReferral
            ? {
                type: "SALES_REFERRAL" as const,
                id: application.salesReferral.id,
                label: application.salesReferral.beneficiaryLabel,
                reference: application.salesReferral.referralKey,
              }
            : application.customEngagement
              ? {
                  type: "CUSTOM_SERVICES" as const,
                  id: application.customEngagement.id,
                  label: application.customEngagement.label,
                  reference: application.customEngagement.engagementKey,
                }
              : null,
    })),
    programApplicationSummary,
    settlementBatches: manualSettlementSnapshot.settlementBatches.map((batch) => ({
      id: batch.id,
      batchKey: batch.batchKey,
      periodLabel: batch.periodLabel,
      periodStart: batch.periodStart,
      periodEnd: batch.periodEnd,
      currency: batch.currency,
      status: batch.status,
      notes: batch.notes,
      approvedAt: batch.approvedAt,
      exportedAt: batch.exportedAt,
      closedAt: batch.closedAt,
      lineCount: batch.lines.length,
      totalAmountCents: batch.lines.reduce((sum, line) => sum + line.amountCents, 0),
    })),
    currentSettlementBatch: manualSettlementSnapshot.currentBatch
      ? {
          id: manualSettlementSnapshot.currentBatch.id,
          batchKey: manualSettlementSnapshot.currentBatch.batchKey,
          periodLabel: manualSettlementSnapshot.currentBatch.periodLabel,
          periodStart: manualSettlementSnapshot.currentBatch.periodStart,
          periodEnd: manualSettlementSnapshot.currentBatch.periodEnd,
          currency: manualSettlementSnapshot.currentBatch.currency,
          status: manualSettlementSnapshot.currentBatch.status,
          notes: manualSettlementSnapshot.currentBatch.notes,
          approvedAt: manualSettlementSnapshot.currentBatch.approvedAt,
          exportedAt: manualSettlementSnapshot.currentBatch.exportedAt,
          closedAt: manualSettlementSnapshot.currentBatch.closedAt,
          lines: manualSettlementSnapshot.currentBatch.lines.map((line) => ({
            id: line.id,
            payoutLedgerId: line.payoutLedgerId,
            revenueAttributionLedgerId: line.payoutLedger.revenueAttributionLedgerId,
            beneficiaryType: line.beneficiaryType,
            beneficiaryLabel: line.beneficiaryLabel,
            sourceType: line.sourceType,
            amountCents: line.amountCents,
            currency: line.currency,
            status: line.status,
            notes: line.notes,
            reference: line.reference,
            approvedAt: line.approvedAt,
            exportedAt: line.exportedAt,
            paidAt: line.paidAt,
            reversedAt: line.reversedAt,
            beneficiaryPayoutProfileId: line.beneficiaryPayoutProfileId,
            payoutProfileRequired: beneficiarySupportsPayoutProfile(line.beneficiaryType),
            payoutProfile: line.beneficiaryPayoutProfile
              ? {
                  id: line.beneficiaryPayoutProfile.id,
                  displayName: line.beneficiaryPayoutProfile.displayName,
                  status: line.beneficiaryPayoutProfile.status,
                }
              : null,
          })),
        }
      : null,
    settlementSummary,
    payoutRailReadiness,
    payoutRailPilotCohort,
    settlementOpsProofPack,
    settlementExceptionSummary,
    governanceSummary: {
      auditEvents7d: recentAuditCount,
      pendingApprovals: pendingApprovalCount,
      llmFallbacks7d: llmFallbackCount,
      approvalProtectedActions,
      acceptedSkillSuggestionCount: recentSkillAdoptions.length,
      acceptedStrategyCount: recentStrategyAdoptions.length,
      formalReviewQueueCount: formalSkillReviewQueue.length,
      formalReviewDecisionCount: recentFormalReviewDecisions.length,
    },
    integrationSummary: {
      connectedConnectorCount: connectedConnectorCount + connectedCrmSourceCount,
      connectorErrorCount: connectorErrorCount + crmSourceErrorCount,
      externalThreadCount,
      unboundThreadCount,
      importedSignalCount,
      duplicateEmailCount,
      recentImportFailures,
    },
  };
}
