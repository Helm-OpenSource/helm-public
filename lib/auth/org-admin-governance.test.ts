import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipStatus, WorkspaceRole } from "@prisma/client";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    workspace: {
      findUnique: vi.fn(),
    },
    membership: {
      findMany: vi.fn(),
    },
    authSession: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    memoryEntry: {
      count: vi.fn(),
    },
    memoryFact: {
      count: vi.fn(),
    },
    identityMatch: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    paymentWebhookCallbackEvent: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  AUTH_SESSION_AUDIT_ACTION_TYPES,
  BILLING_GOVERNANCE_AUDIT_ACTION_TYPES,
  buildOrgAdminSupportPack,
  canExportAdminSupportPack,
  CONNECTOR_GOVERNANCE_AUDIT_ACTION_TYPES,
  CONTRIBUTION_REGISTRY_GOVERNANCE_AUDIT_ACTION_TYPES,
  DATA_DELETE_AUDIT_ACTION_TYPES,
  DATA_EXPORT_AUDIT_ACTION_TYPES,
  DATA_GOVERNANCE_AUDIT_ACTION_TYPES,
  ACTION_GOVERNANCE_AUDIT_ACTION_TYPES,
  IMPORT_GOVERNANCE_AUDIT_ACTION_TYPES,
  INTERNAL_ACTION_GOVERNANCE_AUDIT_ACTION_TYPES,
  MEMBERSHIP_GOVERNANCE_AUDIT_ACTION_TYPES,
  MEMORY_GOVERNANCE_AUDIT_ACTION_TYPES,
  ORGANIZATION_SUPPORT_PACK_EXPORTED,
  ORG_ADMIN_AUDIT_ACTION_TYPES,
  PARTICIPANT_PORTAL_GOVERNANCE_AUDIT_ACTION_TYPES,
  PROGRAM_GOVERNANCE_AUDIT_ACTION_TYPES,
  RETENTION_GOVERNANCE_AUDIT_ACTION_TYPES,
  SETTLEMENT_GOVERNANCE_AUDIT_ACTION_TYPES,
  WORKSPACE_DATA_GOVERNANCE_AUDIT_ACTION_TYPES,
  WORKSPACE_GOVERNANCE_AUDIT_ACTION_TYPES,
} from "@/lib/auth/org-admin-governance";
import {
  AUTH_SESSION_REVOKE_SCOPES,
  AUTH_SESSION_SCOPE_REVOKED_AUDIT_ACTION,
  AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION,
} from "@/lib/auth/session";
import { BILLING_WEBHOOK_GOVERNANCE_AUDIT_ACTION_TYPES } from "@/lib/auth/payment-webhook-governance";

function sameActionTypes(actual: readonly string[], expected: readonly string[]) {
  return (
    actual.length === expected.length &&
    actual.every((actionType) => expected.includes(actionType))
  );
}

function resolveAuditCount(where: { actionType?: string | { in: string[] } }) {
  if (typeof where.actionType === "string") {
    if (where.actionType === "AUTH_SESSION_ROTATED") return 1;
    if (where.actionType === AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION) return 1;
    if (where.actionType === ORGANIZATION_SUPPORT_PACK_EXPORTED) return 1;
    if (where.actionType === "CONNECTOR_CONNECTED") return 2;
    if (where.actionType === "CONNECTOR_SYNC_COMPLETED") return 3;
    if (where.actionType === "CONNECTOR_DISCONNECTED") return 1;
    if (where.actionType === "CSV_IMPORT_COMPLETED") return 1;
    if (where.actionType === "CRM_IMPORT_COMPLETED") return 4;
    if (where.actionType === "IMPORT_WARMUP_COMPLETED") return 2;
    if (where.actionType === "IMPORT_CONFLICT_RESOLVED") return 3;
    if (where.actionType === "IMPORT_SOURCE_CONNECTED") return 1;
    if (where.actionType === "IMPORT_SOURCE_DISCONNECTED") return 1;
    return 0;
  }

  const actionTypes = where.actionType?.in ?? [];

  if (sameActionTypes(actionTypes, MEMBERSHIP_GOVERNANCE_AUDIT_ACTION_TYPES)) return 4;
  if (sameActionTypes(actionTypes, DATA_GOVERNANCE_AUDIT_ACTION_TYPES)) return 16;
  if (sameActionTypes(actionTypes, ORG_ADMIN_AUDIT_ACTION_TYPES)) return 5;
  if (sameActionTypes(actionTypes, WORKSPACE_GOVERNANCE_AUDIT_ACTION_TYPES)) return 1;
  if (sameActionTypes(actionTypes, WORKSPACE_DATA_GOVERNANCE_AUDIT_ACTION_TYPES)) return 9;
  if (sameActionTypes(actionTypes, INTERNAL_ACTION_GOVERNANCE_AUDIT_ACTION_TYPES)) return 2;
  if (sameActionTypes(actionTypes, ACTION_GOVERNANCE_AUDIT_ACTION_TYPES)) return 11;
  if (
    sameActionTypes(
      actionTypes,
      MEMORY_GOVERNANCE_AUDIT_ACTION_TYPES.filter((item) => item === "MEMORY_SUMMARY_EXPORTED"),
    )
  ) {
    return 2;
  }
  if (
    sameActionTypes(
      actionTypes,
      MEMORY_GOVERNANCE_AUDIT_ACTION_TYPES.filter((item) => item !== "MEMORY_SUMMARY_EXPORTED"),
    )
  ) {
    return 3;
  }
  if (sameActionTypes(actionTypes, AUTH_SESSION_AUDIT_ACTION_TYPES)) return 7;
  if (sameActionTypes(actionTypes, DATA_EXPORT_AUDIT_ACTION_TYPES)) return 4;
  if (sameActionTypes(actionTypes, DATA_DELETE_AUDIT_ACTION_TYPES)) return 2;
  if (sameActionTypes(actionTypes, RETENTION_GOVERNANCE_AUDIT_ACTION_TYPES)) return 1;
  if (sameActionTypes(actionTypes, BILLING_GOVERNANCE_AUDIT_ACTION_TYPES)) return 3;
  if (sameActionTypes(actionTypes, BILLING_WEBHOOK_GOVERNANCE_AUDIT_ACTION_TYPES)) return 5;
  if (sameActionTypes(actionTypes, CONTRIBUTION_REGISTRY_GOVERNANCE_AUDIT_ACTION_TYPES)) return 8;
  if (sameActionTypes(actionTypes, PARTICIPANT_PORTAL_GOVERNANCE_AUDIT_ACTION_TYPES)) return 4;
  if (sameActionTypes(actionTypes, PROGRAM_GOVERNANCE_AUDIT_ACTION_TYPES)) return 5;
  if (sameActionTypes(actionTypes, SETTLEMENT_GOVERNANCE_AUDIT_ACTION_TYPES)) return 6;
  if (
    sameActionTypes(
      actionTypes,
      SETTLEMENT_GOVERNANCE_AUDIT_ACTION_TYPES.filter((item) => item === "SETTLEMENT_BATCH_EXPORTED"),
    )
  ) {
    return 1;
  }
  if (sameActionTypes(actionTypes, CONNECTOR_GOVERNANCE_AUDIT_ACTION_TYPES)) return 6;
  if (sameActionTypes(actionTypes, IMPORT_GOVERNANCE_AUDIT_ACTION_TYPES)) return 7;

  return 0;
}

function resolvePaymentWebhookCallbackCount(where: {
  workspaceId?: string | null;
  hintWorkspaceId?: string | null;
  governanceStatus?: string;
  duplicateReceptionCount?: { gt: number };
}) {
  if (where.workspaceId === "workspace-1" && where.duplicateReceptionCount?.gt === 0) {
    return 2;
  }

  if (
    where.workspaceId === null &&
    where.hintWorkspaceId === "workspace-1" &&
    where.governanceStatus === "VERIFICATION_FAILED"
  ) {
    return 2;
  }

  if (
    where.workspaceId === null &&
    where.hintWorkspaceId === "workspace-1" &&
    where.governanceStatus === "UNRESOLVED"
  ) {
    return 3;
  }

  if (where.workspaceId === "workspace-1" && where.governanceStatus === "EXCEPTION") {
    return 1;
  }

  return 0;
}

function resolvePaymentWebhookCallbackMarker(where: {
  workspaceId?: string | null;
  hintWorkspaceId?: string | null;
  governanceStatus?: string;
  duplicateReceptionCount?: { gt: number };
  actionType?: string;
}) {
  if (where.workspaceId === "workspace-1" && where.actionType === "BILLING_WEBHOOK_TENANCY_HINT_FALLBACK") {
    return {
      provider: "ALIPAY",
      callbackMode: "ALIPAY_NOTIFY",
      governanceStatus: "RESOLVED",
      actionType: "BILLING_WEBHOOK_TENANCY_HINT_FALLBACK",
      summary: "Alipay callback resolved workspace via fallback hint alipay.passback_params",
      resolutionSource: "alipay.passback_params",
      hintSource: "alipay.passback_params",
      hintWorkspaceId: "workspace-1",
      processedAt: new Date("2026-04-05T03:39:00Z"),
      lastDuplicateAt: null,
      updatedAt: new Date("2026-04-05T03:39:00Z"),
    };
  }

  if (where.workspaceId === "workspace-1" && where.actionType === "BILLING_WEBHOOK_TENANCY_HINT_MISMATCH") {
    return {
      provider: "STRIPE",
      callbackMode: "STRIPE_WEBHOOK",
      governanceStatus: "RESOLVED",
      actionType: "BILLING_WEBHOOK_TENANCY_HINT_MISMATCH",
      summary: "Stripe callback kept authoritative tenant mapping stripe.subscription_id after hint mismatch",
      resolutionSource: "stripe.subscription_id",
      hintSource: "stripe.metadata.workspace_id",
      hintWorkspaceId: "workspace-1",
      processedAt: new Date("2026-04-05T03:40:00Z"),
      lastDuplicateAt: null,
      updatedAt: new Date("2026-04-05T03:40:00Z"),
    };
  }

  if (where.workspaceId === "workspace-1" && where.duplicateReceptionCount?.gt === 0) {
    return {
      provider: "STRIPE",
      callbackMode: "STRIPE_WEBHOOK",
      governanceStatus: "RESOLVED",
      summary: "Detected duplicate Stripe callback chain after tenant mapping",
      resolutionSource: "stripe.subscription_id",
      hintSource: null,
      hintWorkspaceId: null,
      processedAt: new Date("2026-04-05T03:41:00Z"),
      lastDuplicateAt: new Date("2026-04-05T03:42:00Z"),
      updatedAt: new Date("2026-04-05T03:42:00Z"),
    };
  }

  if (
    where.workspaceId === null &&
    where.hintWorkspaceId === "workspace-1" &&
    where.governanceStatus === "VERIFICATION_FAILED"
  ) {
    return {
      provider: "ALIPAY",
      callbackMode: "ALIPAY_NOTIFY",
      governanceStatus: "VERIFICATION_FAILED",
      summary: "Alipay callback failed verification after workspace hint",
      resolutionSource: null,
      hintSource: "alipay.passback_params",
      hintWorkspaceId: "workspace-1",
      processedAt: new Date("2026-04-05T03:43:00Z"),
      lastDuplicateAt: null,
      updatedAt: new Date("2026-04-05T03:43:00Z"),
    };
  }

  if (
    where.workspaceId === null &&
    where.hintWorkspaceId === "workspace-1" &&
    where.governanceStatus === "UNRESOLVED"
  ) {
    return {
      provider: "WECHAT_PAY",
      callbackMode: "WECHAT_PAY_NOTIFY",
      governanceStatus: "UNRESOLVED",
      summary: "WeChat callback remained unresolved after tenant hint",
      resolutionSource: null,
      hintSource: "wechat.out_trade_no",
      hintWorkspaceId: "workspace-1",
      processedAt: new Date("2026-04-05T03:44:00Z"),
      lastDuplicateAt: null,
      updatedAt: new Date("2026-04-05T03:44:00Z"),
    };
  }

  if (where.workspaceId === "workspace-1" && where.governanceStatus === "EXCEPTION") {
    return {
      provider: "STRIPE",
      callbackMode: "STRIPE_WEBHOOK",
      governanceStatus: "EXCEPTION",
      summary: "Stripe callback mapped to workspace but failed during billing sync",
      resolutionSource: "stripe.customer_id",
      hintSource: "stripe.metadata.workspace_id",
      hintWorkspaceId: "workspace-1",
      processedAt: new Date("2026-04-05T03:45:00Z"),
      lastDuplicateAt: null,
      updatedAt: new Date("2026-04-05T03:45:00Z"),
    };
  }

  return null;
}

function resolveAuditMarker(where: { actionType?: string | { in: string[] } }) {
  if (typeof where.actionType === "string") {
    return null;
  }

  const actionTypes = where.actionType?.in ?? [];

  if (sameActionTypes(actionTypes, MEMBERSHIP_GOVERNANCE_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-05T02:00:00Z"),
      actionType: "ORGANIZATION_MEMBER_ROLE_UPDATED",
      summary: "Updated member role",
      actor: "Owner",
      targetType: "Membership",
      targetId: "membership-1",
      sourcePage: "/settings",
    };
  }

  if (sameActionTypes(actionTypes, WORKSPACE_GOVERNANCE_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-02T03:00:00Z"),
      actionType: "WORKSPACE_OPERATIONAL_CONTROLS_UPDATED",
      summary: "Updated retention controls",
      actor: "Owner",
      targetType: "Workspace",
      targetId: "workspace-1",
      sourcePage: "/settings",
    };
  }

  if (sameActionTypes(actionTypes, WORKSPACE_DATA_GOVERNANCE_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-05T03:58:00Z"),
      actionType: "THREAD_UPGRADED_TO_OPPORTUNITY",
      summary: "Thread upgraded into opportunity",
      actor: "Owner",
      targetType: "EmailThread",
      targetId: "thread-1",
      sourcePage: "/inbox",
    };
  }

  if (sameActionTypes(actionTypes, INTERNAL_ACTION_GOVERNANCE_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-05T03:59:00Z"),
      actionType: "CUSTOMER_SUCCESS_INTERNAL_ACTION_EXECUTED",
      summary: "Executed internal action",
      actor: "Owner",
      targetType: "CustomerSuccessAction",
      targetId: "cs-action-1",
      sourcePage: "/customer-success",
    };
  }

  if (sameActionTypes(actionTypes, ACTION_GOVERNANCE_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-05T04:02:00Z"),
      actionType: "HELM_V2_OFFICIAL_WRITE_ACKNOWLEDGED",
      summary: "Acknowledged official write intent",
      actor: "Owner",
      targetType: "ArtifactBundle",
      targetId: "artifact-1",
      sourcePage: "/meetings/meeting-1",
    };
  }

  if (sameActionTypes(actionTypes, AUTH_SESSION_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-05T01:46:00Z"),
      actionType: AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION,
      summary: "Realigned active workspace from membership posture",
      actor: "Owner",
      targetType: "AuthSession",
      targetId: "session-1",
      sourcePage: "/auth/session",
    };
  }

  if (sameActionTypes(actionTypes, [AUTH_SESSION_SCOPE_REVOKED_AUDIT_ACTION])) {
    return {
      createdAt: new Date("2026-04-05T01:45:00Z"),
      actionType: AUTH_SESSION_SCOPE_REVOKED_AUDIT_ACTION,
      summary: "Revoked 2 stale active auth sessions",
      actor: "Owner",
      targetType: "Workspace",
      targetId: "workspace-1",
      sourcePage: "/settings",
    };
  }

  if (sameActionTypes(actionTypes, [AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION])) {
    return {
      createdAt: new Date("2026-04-05T01:46:00Z"),
      actionType: AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION,
      summary: "Realigned active workspace from membership posture",
      actor: "Owner",
      targetType: "AuthSession",
      targetId: "session-1",
      sourcePage: "/auth/session",
    };
  }

  if (
    sameActionTypes(actionTypes, [
      "AUTH_SESSION_ROTATED",
      AUTH_SESSION_SCOPE_REVOKED_AUDIT_ACTION,
      AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION,
    ])
  ) {
    return {
      createdAt: new Date("2026-04-05T01:46:00Z"),
      actionType: AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION,
      summary: "Realigned active workspace from membership posture",
      actor: "Owner",
      targetType: "AuthSession",
      targetId: "session-1",
      sourcePage: "/auth/session",
    };
  }

  if (sameActionTypes(actionTypes, [ORGANIZATION_SUPPORT_PACK_EXPORTED])) {
    return {
      createdAt: new Date("2026-04-05T02:30:00Z"),
      actionType: "ORGANIZATION_SUPPORT_PACK_EXPORTED",
      summary: "Exported org-admin support pack",
      actor: "Owner",
      targetType: "Workspace",
      targetId: "workspace-1",
      sourcePage: "/settings",
    };
  }

  if (sameActionTypes(actionTypes, DATA_EXPORT_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-05T03:00:00Z"),
      actionType: "MEMORY_SUMMARY_EXPORTED",
      summary: "Exported memory summary",
      actor: "Owner",
      targetType: "Workspace",
      targetId: "workspace-1",
      sourcePage: "/memory",
    };
  }

  if (sameActionTypes(actionTypes, DATA_DELETE_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-04T03:00:00Z"),
      actionType: "MEMORY_FACT_DELETED",
      summary: "Deleted memory fact",
      actor: "Owner",
      targetType: "MemoryFact",
      targetId: "fact-1",
      sourcePage: "/memory",
    };
  }

  if (sameActionTypes(actionTypes, RETENTION_GOVERNANCE_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-02T03:00:00Z"),
      actionType: "WORKSPACE_OPERATIONAL_CONTROLS_UPDATED",
      summary: "Updated retention controls",
      actor: "Owner",
      targetType: "Workspace",
      targetId: "workspace-1",
      sourcePage: "/settings",
    };
  }

  if (sameActionTypes(actionTypes, BILLING_GOVERNANCE_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-05T03:30:00Z"),
      actionType: "BILLING_STATUS_SYNCED",
      summary: "Synchronized billing status",
      actor: "Owner",
      targetType: "BillingAccount",
      targetId: "billing-1",
      sourcePage: "/settings",
    };
  }

  if (sameActionTypes(actionTypes, BILLING_WEBHOOK_GOVERNANCE_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-05T03:40:00Z"),
      actionType: "BILLING_WEBHOOK_TENANCY_HINT_MISMATCH",
      summary: "Kept authoritative workspace after webhook hint mismatch",
      actor: "Stripe callback",
      targetType: "Workspace",
      targetId: "workspace-1",
      sourcePage: "/api/billing/stripe/webhook",
    };
  }

  if (sameActionTypes(actionTypes, CONTRIBUTION_REGISTRY_GOVERNANCE_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-05T03:45:00Z"),
      actionType: "BENEFICIARY_PAYOUT_PROFILE_STATUS_UPDATED",
      summary: "Updated payout profile status",
      actor: "Owner",
      targetType: "BeneficiaryPayoutProfile",
      targetId: "payout-1",
      sourcePage: "/settings",
    };
  }

  if (sameActionTypes(actionTypes, PARTICIPANT_PORTAL_GOVERNANCE_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-05T03:50:00Z"),
      actionType: "CONTRIBUTOR_PORTAL_PROFILE_UPDATED",
      summary: "Updated participant portal profile",
      actor: "Owner",
      targetType: "ParticipantPortalAccess",
      targetId: "portal-1",
      sourcePage: "/settings",
    };
  }

  if (sameActionTypes(actionTypes, PROGRAM_GOVERNANCE_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-05T03:52:00Z"),
      actionType: "PROGRAM_APPLICATION_SUBMITTED",
      summary: "Submitted partner program application",
      actor: "Owner",
      targetType: "ProgramApplication",
      targetId: "application-1",
      sourcePage: "/settings",
    };
  }

  if (sameActionTypes(actionTypes, SETTLEMENT_GOVERNANCE_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-05T03:55:00Z"),
      actionType: "SETTLEMENT_BATCH_CLOSED",
      summary: "Closed settlement batch",
      actor: "Owner",
      targetType: "SettlementBatch",
      targetId: "settlement-1",
      sourcePage: "/settings",
    };
  }

  if (sameActionTypes(actionTypes, CONNECTOR_GOVERNANCE_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-05T04:00:00Z"),
      actionType: "CONNECTOR_SYNC_COMPLETED",
      summary: "Completed Gmail connector sync",
      actor: "Owner",
      targetType: "Connector",
      targetId: "connector-1",
      sourcePage: "/settings",
    };
  }

  if (sameActionTypes(actionTypes, IMPORT_GOVERNANCE_AUDIT_ACTION_TYPES)) {
    return {
      createdAt: new Date("2026-04-05T05:00:00Z"),
      actionType: "CRM_IMPORT_COMPLETED",
      summary: "Completed CRM import",
      actor: "Owner",
      targetType: "ImportJob",
      targetId: "import-1",
      sourcePage: "/imports",
    };
  }

  if (sameActionTypes(actionTypes, ["IMPORT_CONFLICT_RESOLVED"])) {
    return {
      createdAt: new Date("2026-04-05T06:00:00Z"),
      actionType: "IMPORT_CONFLICT_RESOLVED",
      summary: "Resolved import conflict",
      actor: "Owner",
      targetType: "ImportConflict",
      targetId: "conflict-1",
      sourcePage: "/imports/conflicts",
    };
  }

  return null;
}

describe("org admin governance support pack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps support-pack export on admin-class roles only", () => {
    expect(canExportAdminSupportPack(WorkspaceRole.OWNER)).toBe(true);
    expect(canExportAdminSupportPack(WorkspaceRole.BILLING_ADMIN)).toBe(true);
    expect(canExportAdminSupportPack(WorkspaceRole.ADMIN)).toBe(true);
    expect(canExportAdminSupportPack(WorkspaceRole.OPERATOR)).toBe(false);
    expect(canExportAdminSupportPack(WorkspaceRole.MEMBER)).toBe(false);
  });

  it("builds a tenant-scoped governance snapshot", async () => {
    dbMock.workspace.findUnique.mockResolvedValue({
      id: "workspace-1",
      name: "Helm Org",
      slug: "helm-org",
      status: "ACTIVE",
      defaultLocale: "zh-CN",
      pilotMode: true,
      captureConsentRequired: true,
      dataRetentionDays: 90,
      featureFlagsJson: JSON.stringify({
        multilingualUi: true,
        diagnosticsCenter: true,
      }),
      updatedAt: new Date("2026-04-05T00:00:00Z"),
    });
    dbMock.membership.findMany.mockResolvedValue([
      { role: "OWNER", status: "ACTIVE" },
      { role: "ADMIN", status: "ACTIVE" },
      { role: "BILLING_ADMIN", status: "INVITED" },
      { role: "REVIEWER", status: "INACTIVE" },
    ]);
    const now = new Date();
    dbMock.authSession.findMany.mockResolvedValue([
      {
        id: "session-1",
        userId: "user-1",
        activeWorkspaceId: "workspace-1",
        sourcePage: "/login",
        providerType: "PASSWORD",
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        lastSeenAt: new Date(now.getTime() - 60 * 60 * 1000),
        lastWorkspaceSwitchAt: new Date(now.getTime() - 90 * 60 * 1000),
        expiresAt: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      },
      {
        id: "session-3",
        userId: "user-3",
        activeWorkspaceId: "workspace-1",
        sourcePage: "/login",
        providerType: "PARTICIPANT_PORTAL",
        createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
        lastSeenAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        lastWorkspaceSwitchAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
        expiresAt: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
      },
      {
        id: "session-2",
        userId: "user-2",
        activeWorkspaceId: "workspace-1",
        sourcePage: null,
        providerType: null,
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        lastSeenAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
        lastWorkspaceSwitchAt: null,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    ]);
    dbMock.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        name: "Owner",
        email: "owner@example.com",
        memberships: [{ workspaceId: "workspace-1", status: MembershipStatus.ACTIVE }],
      },
      {
        id: "user-2",
        name: "Legacy User",
        email: "legacy@example.com",
        memberships: [],
      },
      {
        id: "user-3",
        name: "Portal User",
        email: "portal@example.com",
        memberships: [{ workspaceId: "workspace-1", status: MembershipStatus.ACTIVE }],
      },
    ]);
    dbMock.auditLog.findMany
      .mockResolvedValueOnce([
        {
          id: "audit-1",
          actor: "Owner",
          actionType: "ORGANIZATION_MEMBER_ROLE_UPDATED",
          summary: "Updated member role",
          targetType: "Membership",
          targetId: "membership-1",
          createdAt: new Date("2026-04-05T02:00:00Z"),
          payload: JSON.stringify({ nextRole: "ADMIN" }),
          sourcePage: "/settings",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "audit-2",
          actor: "Owner",
          actionType: "MEMORY_SUMMARY_EXPORTED",
          summary: "Exported memory summary",
          targetType: "Workspace",
          targetId: "workspace-1",
          createdAt: new Date("2026-04-05T03:00:00Z"),
          payload: JSON.stringify({ exportedCount: 4 }),
          sourcePage: "/memory",
        },
      ])
      .mockResolvedValueOnce([
        {
          createdAt: new Date("2026-04-05T01:45:00Z"),
          payload: JSON.stringify({
            scope: AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
            previewEligibleSessionCount: 2,
            revokedCount: 2,
          }),
        },
        {
          createdAt: new Date("2026-04-05T01:44:00Z"),
          payload: JSON.stringify({
            scope: AUTH_SESSION_REVOKE_SCOPES.LEGACY_PROVIDER,
            previewEligibleSessionCount: 1,
            revokedCount: 1,
          }),
        },
      ]);
    dbMock.auditLog.count.mockImplementation(({ where }: { where: { actionType?: string | { in: string[] } } }) =>
      Promise.resolve(resolveAuditCount(where)),
    );
    dbMock.auditLog.findFirst.mockImplementation(
      ({ where }: { where: { actionType?: string | { in: string[] } } }) =>
        Promise.resolve(resolveAuditMarker(where)),
    );
    dbMock.memoryEntry.count.mockResolvedValue(2);
    dbMock.memoryFact.count.mockResolvedValue(1);
    dbMock.paymentWebhookCallbackEvent.count.mockImplementation(
      ({ where }: { where: { workspaceId?: string | null; hintWorkspaceId?: string | null; governanceStatus?: string; duplicateReceptionCount?: { gt: number } } }) =>
        Promise.resolve(resolvePaymentWebhookCallbackCount(where)),
    );
    dbMock.paymentWebhookCallbackEvent.findFirst.mockImplementation(
      ({ where }: { where: { workspaceId?: string | null; hintWorkspaceId?: string | null; governanceStatus?: string; duplicateReceptionCount?: { gt: number } } }) =>
        Promise.resolve(resolvePaymentWebhookCallbackMarker(where)),
    );
    dbMock.identityMatch.count.mockImplementation(
      ({ where }: { where: { workspaceId: string; createdAt?: { gte: Date }; status?: string } }) =>
        Promise.resolve(where.status === "NEEDS_REVIEW" ? 2 : 6),
    );
    dbMock.identityMatch.findFirst.mockResolvedValue({
      createdAt: new Date("2026-04-05T03:32:00Z"),
      status: "NEEDS_REVIEW",
      matchReason: "Company name matched but needs human review",
      externalType: "COMPANY",
      externalId: "hub-company-1",
      internalObjectType: "Company",
      internalObjectId: "company-1",
      matchScore: 68,
    });

    const pack = await buildOrgAdminSupportPack("workspace-1", {
      currentAuthSessionId: "session-2",
    });

    expect(pack.version).toBe("v1");
    expect(pack.workspaceId).toBe("workspace-1");
    expect(pack.summary.membershipSummary.activeSeatCount).toBe(2);
    expect(pack.summary.membershipSummary.invitedSeatCount).toBe(1);
    expect(pack.summary.authSessionSummary.activeSessionCount).toBe(3);
    expect(pack.summary.authSessionSummary.expiringSoonSessionCount).toBe(1);
    expect(pack.summary.authSessionSummary.staleActiveSessionCount).toBe(1);
    expect(pack.summary.authSessionSummary.legacyProviderSessionCount).toBe(1);
    expect(pack.summary.authSessionSummary.missingSourcePageSessionCount).toBe(1);
    expect(pack.summary.authSessionSummary.missingWorkspaceSwitchMarkerSessionCount).toBe(1);
    expect(pack.summary.authSessionSummary.providerSourceMismatchSessionCount).toBe(1);
    expect(pack.summary.authSessionSummary.workspaceMembershipMismatchSessionCount).toBe(1);
    expect(pack.summary.authSessionSummary.rotatedSessionCount30d).toBe(1);
    expect(pack.summary.authSessionSummary.realignedSessionCount30d).toBe(1);
    expect(pack.summary.authSessionSummary.scopeRevokeActionCount30d).toBe(2);
    expect(pack.summary.authSessionSummary.scopeRevokedSessionCount30d).toBe(3);
    expect(pack.summary.authSessionSummary.revokeScopeSummary30d).toEqual([
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
        actionCount: 1,
        revokedSessionCount: 2,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.LEGACY_PROVIDER,
        actionCount: 1,
        revokedSessionCount: 1,
      },
    ]);
    expect(pack.summary.authSessionSummary.liveRevokeScopeSummary).toEqual([
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
        eligibleSessionCount: 0,
        currentSessionProtected: true,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.LEGACY_PROVIDER,
        eligibleSessionCount: 0,
        currentSessionProtected: true,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.MISSING_SOURCE_PAGE,
        eligibleSessionCount: 0,
        currentSessionProtected: true,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.MISSING_WORKSPACE_SWITCH_MARKER,
        eligibleSessionCount: 0,
        currentSessionProtected: true,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.PROVIDER_SOURCE_MISMATCH,
        eligibleSessionCount: 1,
        currentSessionProtected: false,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.WORKSPACE_MEMBERSHIP_MISMATCH,
        eligibleSessionCount: 0,
        currentSessionProtected: true,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.OTHER_ACTIVE,
        eligibleSessionCount: 2,
        currentSessionProtected: true,
      },
    ]);
    expect(pack.summary.authSessionSummary.anomalyInventorySummary).toEqual([
      {
        scope: "EXPIRING_SOON",
        activeSessionCount: 1,
        managementMode: "REVIEW_ONLY",
        revocableSessionCount: 0,
        currentSessionProtected: true,
        latestDetectedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      },
      {
        scope: "STALE_ACTIVE",
        activeSessionCount: 1,
        managementMode: "BULK_REVOKE",
        revocableSessionCount: 0,
        currentSessionProtected: true,
        latestDetectedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      },
      {
        scope: "LEGACY_PROVIDER",
        activeSessionCount: 1,
        managementMode: "BULK_REVOKE",
        revocableSessionCount: 0,
        currentSessionProtected: true,
        latestDetectedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      },
      {
        scope: "MISSING_SOURCE_PAGE",
        activeSessionCount: 1,
        managementMode: "BULK_REVOKE",
        revocableSessionCount: 0,
        currentSessionProtected: true,
        latestDetectedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      },
      {
        scope: "MISSING_WORKSPACE_SWITCH_MARKER",
        activeSessionCount: 1,
        managementMode: "BULK_REVOKE",
        revocableSessionCount: 0,
        currentSessionProtected: true,
        latestDetectedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      },
      {
        scope: "PROVIDER_SOURCE_MISMATCH",
        activeSessionCount: 1,
        managementMode: "BULK_REVOKE",
        revocableSessionCount: 1,
        currentSessionProtected: false,
        latestDetectedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
      {
        scope: "WORKSPACE_MEMBERSHIP_MISMATCH",
        activeSessionCount: 1,
        managementMode: "BULK_REVOKE",
        revocableSessionCount: 0,
        currentSessionProtected: true,
        latestDetectedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      },
    ]);
    expect(pack.summary.authSessionSummary.currentSessionReviewScopeSummary).toEqual([
      AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
      AUTH_SESSION_REVOKE_SCOPES.LEGACY_PROVIDER,
      AUTH_SESSION_REVOKE_SCOPES.MISSING_SOURCE_PAGE,
      AUTH_SESSION_REVOKE_SCOPES.MISSING_WORKSPACE_SWITCH_MARKER,
      AUTH_SESSION_REVOKE_SCOPES.WORKSPACE_MEMBERSHIP_MISMATCH,
    ]);
    expect(pack.summary.authSessionSummary.previewVsExecutedScopeSummary).toEqual([
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
        liveEligibleSessionCount: 0,
        currentSessionProtected: true,
        lastExecutedAt: new Date("2026-04-05T01:45:00Z"),
        lastExecutedEligibleSessionCount: 2,
        lastExecutedRevokedSessionCount: 2,
        lastExecutionShortfallCount: 0,
        previewEligibleDeltaCount: -2,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.LEGACY_PROVIDER,
        liveEligibleSessionCount: 0,
        currentSessionProtected: true,
        lastExecutedAt: new Date("2026-04-05T01:44:00Z"),
        lastExecutedEligibleSessionCount: 1,
        lastExecutedRevokedSessionCount: 1,
        lastExecutionShortfallCount: 0,
        previewEligibleDeltaCount: -1,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.MISSING_SOURCE_PAGE,
        liveEligibleSessionCount: 0,
        currentSessionProtected: true,
        lastExecutedAt: null,
        lastExecutedEligibleSessionCount: null,
        lastExecutedRevokedSessionCount: null,
        lastExecutionShortfallCount: null,
        previewEligibleDeltaCount: null,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.MISSING_WORKSPACE_SWITCH_MARKER,
        liveEligibleSessionCount: 0,
        currentSessionProtected: true,
        lastExecutedAt: null,
        lastExecutedEligibleSessionCount: null,
        lastExecutedRevokedSessionCount: null,
        lastExecutionShortfallCount: null,
        previewEligibleDeltaCount: null,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.PROVIDER_SOURCE_MISMATCH,
        liveEligibleSessionCount: 1,
        currentSessionProtected: false,
        lastExecutedAt: null,
        lastExecutedEligibleSessionCount: null,
        lastExecutedRevokedSessionCount: null,
        lastExecutionShortfallCount: null,
        previewEligibleDeltaCount: null,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.WORKSPACE_MEMBERSHIP_MISMATCH,
        liveEligibleSessionCount: 0,
        currentSessionProtected: true,
        lastExecutedAt: null,
        lastExecutedEligibleSessionCount: null,
        lastExecutedRevokedSessionCount: null,
        lastExecutionShortfallCount: null,
        previewEligibleDeltaCount: null,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.OTHER_ACTIVE,
        liveEligibleSessionCount: 2,
        currentSessionProtected: true,
        lastExecutedAt: null,
        lastExecutedEligibleSessionCount: null,
        lastExecutedRevokedSessionCount: null,
        lastExecutionShortfallCount: null,
        previewEligibleDeltaCount: null,
      },
    ]);
    expect(pack.summary.authSessionSummary.revokeConsistencySummary).toEqual([
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
        status: "DRIFT",
        liveEligibleSessionCount: 0,
        currentSessionProtected: true,
        lastExecutedAt: new Date("2026-04-05T01:45:00Z"),
        previewEligibleDeltaCount: -2,
        lastExecutionShortfallCount: 0,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.LEGACY_PROVIDER,
        status: "DRIFT",
        liveEligibleSessionCount: 0,
        currentSessionProtected: true,
        lastExecutedAt: new Date("2026-04-05T01:44:00Z"),
        previewEligibleDeltaCount: -1,
        lastExecutionShortfallCount: 0,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.MISSING_SOURCE_PAGE,
        status: "REVIEW_ONLY",
        liveEligibleSessionCount: 0,
        currentSessionProtected: true,
        lastExecutedAt: null,
        previewEligibleDeltaCount: null,
        lastExecutionShortfallCount: null,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.MISSING_WORKSPACE_SWITCH_MARKER,
        status: "REVIEW_ONLY",
        liveEligibleSessionCount: 0,
        currentSessionProtected: true,
        lastExecutedAt: null,
        previewEligibleDeltaCount: null,
        lastExecutionShortfallCount: null,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.PROVIDER_SOURCE_MISMATCH,
        status: "REVOCABLE",
        liveEligibleSessionCount: 1,
        currentSessionProtected: false,
        lastExecutedAt: null,
        previewEligibleDeltaCount: null,
        lastExecutionShortfallCount: null,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.WORKSPACE_MEMBERSHIP_MISMATCH,
        status: "REVIEW_ONLY",
        liveEligibleSessionCount: 0,
        currentSessionProtected: true,
        lastExecutedAt: null,
        previewEligibleDeltaCount: null,
        lastExecutionShortfallCount: null,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.OTHER_ACTIVE,
        status: "REVOCABLE",
        liveEligibleSessionCount: 2,
        currentSessionProtected: true,
        lastExecutedAt: null,
        previewEligibleDeltaCount: null,
        lastExecutionShortfallCount: null,
      },
    ]);
    expect(pack.summary.authSessionSummary.latestAnomalyMarker).toEqual({
      recordedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      sessionId: "session-3",
      activeWorkspaceId: "workspace-1",
      sourcePage: "/login",
      providerType: "PARTICIPANT_PORTAL",
      user: {
        id: "user-3",
        name: "Portal User",
        email: "portal@example.com",
      },
      anomalyScopes: [AUTH_SESSION_REVOKE_SCOPES.PROVIDER_SOURCE_MISMATCH],
    });
    expect(pack.summary.authSessionSummary.authControlConsistencyOverview).toEqual({
      consistencyStatus: "DRIFT",
      followThroughStatus: "STALE",
      reviewOnlyScopeCount: 4,
      bulkRevocableScopeCount: 2,
      driftScopeCount: 2,
      currentSessionProtectedScopeCount: 7,
      latestDetectedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      latestMarkerScopeCount: 1,
      latestFollowThroughActionType: "AUTH_SESSION_WORKSPACE_REALIGNED",
      latestFollowThroughRecordedAt: new Date("2026-04-05T01:46:00Z"),
      latestFollowThroughSourcePage: "/auth/session",
    });
    expect(pack.summary.authSessionSummary.latestAnomalyFollowThroughSummary).toEqual({
      status: "ACTIONABLE",
      followThroughStatus: "STALE",
      reviewOnlyScopeCount: 0,
      bulkRevocableScopeCount: 1,
      driftScopeCount: 0,
      currentSessionProtectedScopeCount: 0,
      latestMarkerRecordedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      latestMarkerScopeCount: 1,
      latestFollowThroughActionType: "AUTH_SESSION_WORKSPACE_REALIGNED",
      latestFollowThroughRecordedAt: new Date("2026-04-05T01:46:00Z"),
      latestFollowThroughSourcePage: "/auth/session",
    });
    expect(pack.summary.authSessionSummary.latestMarkerCoverageSummary).toEqual({
      status: "ACTIONABLE",
      followThroughStatus: "STALE",
      stillDetectedScopeCount: 1,
      resolvedScopeCount: 0,
      newlyDetectedScopeCount: 6,
      reviewOnlyScopeCount: 0,
      bulkRevocableScopeCount: 1,
      driftScopeCount: 0,
      currentSessionProtectedScopeCount: 0,
      latestMarkerRecordedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      latestMarkerScopeCount: 1,
      latestFollowThroughActionType: "AUTH_SESSION_WORKSPACE_REALIGNED",
      latestFollowThroughRecordedAt: new Date("2026-04-05T01:46:00Z"),
      latestFollowThroughSourcePage: "/auth/session",
    });
    expect(pack.summary.authSessionSummary.revokeExecutionAggregateSummary).toEqual({
      status: "DRIFT",
      liveEligibleSessionCount: 3,
      lastExecutedEligibleSessionCount: 3,
      lastExecutedRevokedSessionCount: 3,
      executionShortfallCount: 0,
      previewEligibleDeltaCount: -3,
      reviewOnlyScopeCount: 3,
      bulkRevocableScopeCount: 2,
      driftScopeCount: 2,
      currentSessionProtectedScopeCount: 6,
      latestExecutedAt: new Date("2026-04-05T01:45:00Z"),
    });
    expect(
      pack.summary.authSessionSummary.recentActiveSessions.find((session) => session.id === "session-1")
        ?.providerType,
    ).toBe("PASSWORD");
    expect(
      pack.summary.authSessionSummary.recentActiveSessions.find((session) => session.id === "session-2")
        ?.isMissingSourcePage,
    ).toBe(true);
    expect(
      pack.summary.authSessionSummary.recentActiveSessions.find((session) => session.id === "session-2")
        ?.hasMissingWorkspaceSwitchMarker,
    ).toBe(true);
    expect(
      pack.summary.authSessionSummary.recentActiveSessions.find((session) => session.id === "session-2")
        ?.hasWorkspaceMembershipMismatch,
    ).toBe(true);
    expect(
      pack.summary.authSessionSummary.recentActiveSessions.find((session) => session.id === "session-3")
        ?.hasProviderSourceMismatch,
    ).toBe(true);
    expect(pack.summary.dataGovernanceSummary.orgAdminAuditCount30d).toBe(5);
    expect(pack.summary.dataGovernanceSummary.membershipActionCount30d).toBe(4);
    expect(pack.summary.dataGovernanceSummary.workspaceGovernanceActionCount30d).toBe(1);
    expect(pack.summary.dataGovernanceSummary.workspaceDataActionCount30d).toBe(9);
    expect(pack.summary.dataGovernanceSummary.internalActionCount30d).toBe(2);
    expect(pack.summary.dataGovernanceSummary.actionGovernanceActionCount30d).toBe(11);
    expect(pack.summary.dataGovernanceSummary.memoryExportCount30d).toBe(2);
    expect(pack.summary.dataGovernanceSummary.memoryMutationCount30d).toBe(3);
    expect(pack.summary.dataGovernanceSummary.authSessionEventCount30d).toBe(7);
    expect(pack.summary.dataGovernanceSummary.supportPackExportCount30d).toBe(1);
    expect(pack.summary.dataGovernanceSummary.exportActionCount30d).toBe(4);
    expect(pack.summary.dataGovernanceSummary.deleteActionCount30d).toBe(2);
    expect(pack.summary.dataGovernanceSummary.retentionUpdateCount30d).toBe(1);
    expect(pack.summary.dataGovernanceSummary.billingActionCount30d).toBe(3);
    expect(pack.summary.dataGovernanceSummary.billingWebhookResolutionCount30d).toBe(5);
    expect(pack.summary.dataGovernanceSummary.billingWebhookHintFallbackCount30d).toBe(0);
    expect(pack.summary.dataGovernanceSummary.billingWebhookHintMismatchCount30d).toBe(0);
    expect(pack.summary.dataGovernanceSummary.billingWebhookDuplicateChainCount30d).toBe(2);
    expect(pack.summary.dataGovernanceSummary.billingWebhookVerificationFailureHintCount30d).toBe(2);
    expect(pack.summary.dataGovernanceSummary.billingWebhookUnresolvedHintCount30d).toBe(3);
    expect(pack.summary.dataGovernanceSummary.billingWebhookMappedExceptionCount30d).toBe(1);
    expect(pack.summary.dataGovernanceSummary.contributionRegistryActionCount30d).toBe(8);
    expect(pack.summary.dataGovernanceSummary.participantPortalActionCount30d).toBe(4);
    expect(pack.summary.dataGovernanceSummary.programActionCount30d).toBe(5);
    expect(pack.summary.dataGovernanceSummary.settlementActionCount30d).toBe(6);
    expect(pack.summary.dataGovernanceSummary.settlementBatchExportCount30d).toBe(1);
    expect(pack.summary.dataGovernanceSummary.connectorActionCount30d).toBe(6);
    expect(pack.summary.dataGovernanceSummary.connectorConnectionCount30d).toBe(2);
    expect(pack.summary.dataGovernanceSummary.connectorSyncCount30d).toBe(3);
    expect(pack.summary.dataGovernanceSummary.connectorDisconnectCount30d).toBe(1);
    expect(pack.summary.dataGovernanceSummary.importActionCount30d).toBe(7);
    expect(pack.summary.dataGovernanceSummary.csvImportCount30d).toBe(1);
    expect(pack.summary.dataGovernanceSummary.crmImportCount30d).toBe(4);
    expect(pack.summary.dataGovernanceSummary.importWarmupCount30d).toBe(2);
    expect(pack.summary.dataGovernanceSummary.importConflictResolutionCount30d).toBe(3);
    expect(pack.summary.dataGovernanceSummary.importSourceConnectionCount30d).toBe(1);
    expect(pack.summary.dataGovernanceSummary.importSourceDisconnectCount30d).toBe(1);
    expect(pack.summary.dataGovernanceSummary.identityMatchWriteCount30d).toBe(6);
    expect(pack.summary.dataGovernanceSummary.identityMatchNeedsReviewCount30d).toBe(2);
    expect(pack.summary.governanceFollowThrough.latestMembershipAudit?.actionType).toBe(
      "ORGANIZATION_MEMBER_ROLE_UPDATED",
    );
    expect(pack.summary.governanceFollowThrough.latestWorkspaceGovernanceAudit?.actionType).toBe(
      "WORKSPACE_OPERATIONAL_CONTROLS_UPDATED",
    );
    expect(pack.summary.governanceFollowThrough.latestWorkspaceDataAudit?.actionType).toBe(
      "THREAD_UPGRADED_TO_OPPORTUNITY",
    );
    expect(pack.summary.governanceFollowThrough.latestInternalActionAudit?.actionType).toBe(
      "CUSTOMER_SUCCESS_INTERNAL_ACTION_EXECUTED",
    );
    expect(pack.summary.governanceFollowThrough.latestActionGovernanceAudit?.actionType).toBe(
      "HELM_V2_OFFICIAL_WRITE_ACKNOWLEDGED",
    );
    expect(pack.summary.governanceFollowThrough.latestAuthSessionAudit?.actionType).toBe(
      AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION,
    );
    expect(pack.summary.governanceFollowThrough.latestWorkspaceRealignmentAudit?.actionType).toBe(
      AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION,
    );
    expect(pack.summary.governanceFollowThrough.latestScopedSessionRevokeAudit?.actionType).toBe(
      AUTH_SESSION_SCOPE_REVOKED_AUDIT_ACTION,
    );
    expect(
      pack.summary.governanceFollowThrough.latestAuthSessionAnomalyFollowThroughAudit?.actionType,
    ).toBe(AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION);
    expect(pack.summary.governanceFollowThrough.latestSupportPackAudit?.actionType).toBe(
      "ORGANIZATION_SUPPORT_PACK_EXPORTED",
    );
    expect(pack.summary.governanceFollowThrough.latestExportAudit?.actionType).toBe("MEMORY_SUMMARY_EXPORTED");
    expect(pack.summary.governanceFollowThrough.latestDeleteAudit?.actionType).toBe("MEMORY_FACT_DELETED");
    expect(pack.summary.governanceFollowThrough.latestRetentionAudit?.actionType).toBe(
      "WORKSPACE_OPERATIONAL_CONTROLS_UPDATED",
    );
    expect(pack.summary.governanceFollowThrough.latestBillingAudit?.actionType).toBe("BILLING_STATUS_SYNCED");
    expect(pack.summary.governanceFollowThrough.latestBillingWebhookGovernanceAudit?.actionType).toBe(
      "BILLING_WEBHOOK_TENANCY_HINT_MISMATCH",
    );
    expect(pack.summary.governanceFollowThrough.latestBillingWebhookHintFallback?.resolutionSource).toBe(
      "alipay.passback_params",
    );
    expect(pack.summary.governanceFollowThrough.latestBillingWebhookHintMismatch?.hintSource).toBe(
      "stripe.metadata.workspace_id",
    );
    expect(pack.summary.governanceFollowThrough.latestBillingWebhookDuplicateCallback?.summary).toBe(
      "Detected duplicate Stripe callback chain after tenant mapping",
    );
    expect(
      pack.summary.governanceFollowThrough.latestBillingWebhookVerificationFailureHint?.governanceStatus,
    ).toBe("VERIFICATION_FAILED");
    expect(pack.summary.governanceFollowThrough.latestBillingWebhookUnresolvedHint?.workspaceScoped).toBe(
      false,
    );
    expect(pack.summary.governanceFollowThrough.latestBillingWebhookMappedException?.resolutionSource).toBe(
      "stripe.customer_id",
    );
    expect(pack.summary.governanceFollowThrough.latestContributionRegistryAudit?.actionType).toBe(
      "BENEFICIARY_PAYOUT_PROFILE_STATUS_UPDATED",
    );
    expect(pack.summary.governanceFollowThrough.latestParticipantPortalAudit?.actionType).toBe(
      "CONTRIBUTOR_PORTAL_PROFILE_UPDATED",
    );
    expect(pack.summary.governanceFollowThrough.latestProgramAudit?.actionType).toBe(
      "PROGRAM_APPLICATION_SUBMITTED",
    );
    expect(pack.summary.governanceFollowThrough.latestSettlementAudit?.actionType).toBe(
      "SETTLEMENT_BATCH_CLOSED",
    );
    expect(pack.summary.governanceFollowThrough.latestConnectorAudit?.actionType).toBe(
      "CONNECTOR_SYNC_COMPLETED",
    );
    expect(pack.summary.governanceFollowThrough.latestImportAudit?.actionType).toBe(
      "CRM_IMPORT_COMPLETED",
    );
    expect(pack.summary.governanceFollowThrough.latestConflictResolutionAudit?.actionType).toBe(
      "IMPORT_CONFLICT_RESOLVED",
    );
    expect(pack.summary.governanceFollowThrough.latestIdentityMatch?.status).toBe("NEEDS_REVIEW");
    expect(pack.summary.governanceFollowThrough.latestIdentityMatch?.externalType).toBe("COMPANY");
    expect(pack.summary.governanceFollowThrough.latestExportAudit?.actor).toBe("Owner");
    expect(pack.summary.dataGovernanceClosure.exportScopedToWorkspace).toBe(true);
    expect(pack.summary.dataGovernanceClosure.deleteScopedToWorkspace).toBe(true);
    expect(pack.summary.dataGovernanceClosure.retentionScopedToWorkspace).toBe(true);
    expect(pack.summary.dataGovernanceClosure.supportPackScopedToWorkspace).toBe(true);
    expect(pack.summary.dataGovernanceClosure.sensitiveWriteTenantOwnershipGuarded).toBe(true);
    expect(pack.summary.dataGovernanceClosure.latestExportOwner).toBe("Owner");
    expect(pack.summary.dataGovernanceClosure.latestDeleteOwner).toBe("Owner");
    expect(pack.summary.dataGovernanceClosure.latestRetentionOwner).toBe("Owner");
    expect(pack.summary.dataGovernanceClosure.latestSupportPackOwner).toBe("Owner");
    expect(pack.summary.dataGovernanceClosure.latestExportSourcePage).toBe("/memory");
    expect(pack.summary.dataGovernanceClosure.latestDeleteSourcePage).toBe("/memory");
    expect(pack.summary.dataGovernanceClosure.latestRetentionSourcePage).toBe("/settings");
    expect(pack.summary.dataGovernanceClosure.latestSupportPackSourcePage).toBe("/settings");
    expect(pack.summary.workspaceIsolationAssertions.memoryExportScopedToWorkspace).toBe(true);
    expect(pack.summary.workspaceIsolationAssertions.supportPackExportScopedToWorkspace).toBe(true);
    expect(pack.summary.workspaceIsolationAssertions.deleteActionsScopedToWorkspace).toBe(true);
    expect(pack.summary.workspaceIsolationAssertions.retentionControlsScopedToWorkspace).toBe(true);
    expect(pack.summary.workspaceIsolationAssertions.sensitiveWriteRoutesRequireTenantOwnership).toBe(true);
    expect(pack.summary.workspaceIsolationAssertions.billingWebhookTenantMappingScopedToWorkspace).toBe(true);
    expect(pack.summary.workspaceIsolationAssertions.unresolvedWebhookCallbacksRemainOutsideWorkspaceAudit).toBe(
      true,
    );
    expect(pack.summary.recentOrgAdminAudit[0]?.actionType).toBe("ORGANIZATION_MEMBER_ROLE_UPDATED");
    expect(pack.summary.recentDataGovernanceAudit[0]?.actionType).toBe("MEMORY_SUMMARY_EXPORTED");
    expect(pack.summary.boundaryNotes.length).toBeGreaterThan(0);
    expect(pack.summary.boundaryNotes).toContain(
      "Webhook tenancy governance only records callbacks once tenant mapping is asserted; unresolved external callbacks remain outside workspace-scoped support-pack truth.",
    );
    expect(pack.summary.boundaryNotes).toContain(
      "Webhook verification failures with workspace hints remain external anomaly signals until authenticity and tenant mapping are both asserted.",
    );
    expect(pack.summary.boundaryNotes).toContain(
      "Webhook duplicate chains and mapped callback exceptions are tenant-scoped follow-through signals; hinted unresolved callbacks remain external boundary signals, not workspace audit truth.",
    );
    expect(pack.summary.boundaryNotes).toContain(
      "Identity-match records remain tenant-scoped import follow-through truth and do not broaden execution or tenant-admin authority.",
    );
  });

  it("treats /portal/access as a valid participant-portal source and checks membership against active workspace", async () => {
    dbMock.workspace.findUnique.mockResolvedValue({
      id: "workspace-1",
      name: "Helm Org",
      slug: "helm-org",
      status: "ACTIVE",
      defaultLocale: "en-US",
      pilotMode: true,
      captureConsentRequired: true,
      dataRetentionDays: 90,
      featureFlagsJson: JSON.stringify({}),
      updatedAt: new Date("2026-04-05T00:00:00Z"),
    });
    dbMock.membership.findMany.mockResolvedValue([{ role: "OWNER", status: "ACTIVE" }]);
    const now = new Date();
    dbMock.authSession.findMany.mockResolvedValue([
      {
        id: "portal-access-valid",
        userId: "user-1",
        activeWorkspaceId: "workspace-1",
        sourcePage: "/portal/access",
        providerType: "PARTICIPANT_PORTAL",
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        lastSeenAt: new Date(now.getTime() - 60 * 60 * 1000),
        lastWorkspaceSwitchAt: new Date(now.getTime() - 90 * 60 * 1000),
        expiresAt: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      },
      {
        id: "wrong-workspace-membership",
        userId: "user-2",
        activeWorkspaceId: "workspace-1",
        sourcePage: "/login",
        providerType: "PASSWORD",
        createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
        lastSeenAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        lastWorkspaceSwitchAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        expiresAt: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000),
      },
    ]);
    dbMock.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        name: "Portal User",
        email: "portal@example.com",
        memberships: [{ workspaceId: "workspace-1", status: MembershipStatus.ACTIVE }],
      },
      {
        id: "user-2",
        name: "Wrong Workspace",
        email: "wrong@example.com",
        memberships: [{ workspaceId: "workspace-2", status: MembershipStatus.ACTIVE }],
      },
    ]);
    dbMock.auditLog.findMany.mockResolvedValue([]);
    dbMock.auditLog.count.mockImplementation(({ where }: { where: { actionType?: string | { in: string[] } } }) =>
      Promise.resolve(resolveAuditCount(where)),
    );
    dbMock.auditLog.findFirst.mockImplementation(
      ({ where }: { where: { actionType?: string | { in: string[] } } }) =>
        Promise.resolve(resolveAuditMarker(where)),
    );
    dbMock.memoryEntry.count.mockResolvedValue(0);
    dbMock.memoryFact.count.mockResolvedValue(0);
    dbMock.paymentWebhookCallbackEvent.count.mockImplementation(
      ({ where }: { where: { workspaceId?: string | null; hintWorkspaceId?: string | null; governanceStatus?: string; duplicateReceptionCount?: { gt: number } } }) =>
        Promise.resolve(resolvePaymentWebhookCallbackCount(where)),
    );
    dbMock.paymentWebhookCallbackEvent.findFirst.mockImplementation(
      ({ where }: { where: { workspaceId?: string | null; hintWorkspaceId?: string | null; governanceStatus?: string; duplicateReceptionCount?: { gt: number } } }) =>
        Promise.resolve(resolvePaymentWebhookCallbackMarker(where)),
    );
    dbMock.identityMatch.count.mockResolvedValue(0);
    dbMock.identityMatch.findFirst.mockResolvedValue(null);

    const pack = await buildOrgAdminSupportPack("workspace-1", {
      currentAuthSessionId: "portal-access-valid",
    });

    expect(pack.summary.authSessionSummary.providerSourceMismatchSessionCount).toBe(0);
    expect(pack.summary.authSessionSummary.missingWorkspaceSwitchMarkerSessionCount).toBe(0);
    expect(pack.summary.authSessionSummary.workspaceMembershipMismatchSessionCount).toBe(1);
    expect(
      pack.summary.authSessionSummary.recentActiveSessions.find(
        (session) => session.id === "portal-access-valid",
      )?.hasProviderSourceMismatch,
    ).toBe(false);
    expect(
      pack.summary.authSessionSummary.recentActiveSessions.find(
        (session) => session.id === "wrong-workspace-membership",
      )?.hasWorkspaceMembershipMismatch,
    ).toBe(true);
    expect(
      pack.summary.authSessionSummary.recentActiveSessions.find(
        (session) => session.id === "portal-access-valid",
      )?.hasMissingWorkspaceSwitchMarker,
    ).toBe(false);
    expect(pack.summary.authSessionSummary.currentSessionReviewScopeSummary).toEqual([]);
    expect(pack.summary.authSessionSummary.latestAnomalyMarker?.sessionId).toBe(
      "wrong-workspace-membership",
    );
    expect(pack.summary.authSessionSummary.latestAnomalyFollowThroughSummary).toEqual({
      status: "ACTIONABLE",
      followThroughStatus: "STALE",
      reviewOnlyScopeCount: 0,
      bulkRevocableScopeCount: 1,
      driftScopeCount: 0,
      currentSessionProtectedScopeCount: 0,
      latestMarkerRecordedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      latestMarkerScopeCount: 1,
      latestFollowThroughActionType: "AUTH_SESSION_WORKSPACE_REALIGNED",
      latestFollowThroughRecordedAt: new Date("2026-04-05T01:46:00.000Z"),
      latestFollowThroughSourcePage: "/auth/session",
    });
    expect(pack.summary.authSessionSummary.latestMarkerCoverageSummary).toEqual({
      status: "ACTIONABLE",
      followThroughStatus: "STALE",
      stillDetectedScopeCount: 1,
      resolvedScopeCount: 0,
      newlyDetectedScopeCount: 0,
      reviewOnlyScopeCount: 0,
      bulkRevocableScopeCount: 1,
      driftScopeCount: 0,
      currentSessionProtectedScopeCount: 0,
      latestMarkerRecordedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      latestMarkerScopeCount: 1,
      latestFollowThroughActionType: "AUTH_SESSION_WORKSPACE_REALIGNED",
      latestFollowThroughRecordedAt: new Date("2026-04-05T01:46:00.000Z"),
      latestFollowThroughSourcePage: "/auth/session",
    });
    expect(pack.summary.authSessionSummary.revokeExecutionAggregateSummary).toMatchObject({
      status: "ACTIONABLE",
      liveEligibleSessionCount: 2,
      lastExecutedEligibleSessionCount: 0,
      lastExecutedRevokedSessionCount: 0,
      executionShortfallCount: 0,
      previewEligibleDeltaCount: 0,
      reviewOnlyScopeCount: 0,
      bulkRevocableScopeCount: 2,
      driftScopeCount: 0,
      currentSessionProtectedScopeCount: 1,
      latestExecutedAt: null,
    });
  });
});
