// lib/member-mcp/contract.ts
// Member MCP P0 contract: the in-app MCP entry through which a workspace
// member's own AI client (Codex, QwenWork, Claude Code, WorkBuddy) reads that
// member's CAIO brief and prompt queue. Pure judgment only: no IO, no clock.
//
// P0 boundary (owner ruling 2026-09-29, staff-connect spec P0):
// - read-only; the only rows written are the connection's own lifecycle,
//   usage and rate-limit metadata, plus audit logs;
// - every tool reads records that belong to the calling member (their own
//   membership, prompts addressed to them). Reads of other people's or
//   business objects go through the Member Gateway seven-way intersection
//   (decideMemberReadSurface) from P1 on and are not expressible here;
// - scopes for responding, signals, field reports and tasks exist in the
//   closed set so tokens can be reasoned about, but none is issuable in P0.

import { WorkspaceRole } from "@prisma/client";
import {
  WORKSPACE_CAPABILITIES,
  workspaceRoleHasCapability,
} from "@/lib/auth/authorization";

export {
  MEMBER_MCP_CLIENT_LABELS,
  MEMBER_MCP_CLIENT_TYPES,
  type MemberMcpClientType,
} from "@/lib/member-mcp/client-types";
import { MEMBER_MCP_CLIENT_TYPES, type MemberMcpClientType } from "@/lib/member-mcp/client-types";

export const MEMBER_MCP_SCOPES = [
  "member:brief:read",
  "member:prompt:read",
  "member:prompt:respond",
  "member:signal:write",
  "member:report:write",
  "member:task:read",
  "member:task:receipt",
] as const;

export type MemberMcpScope = (typeof MEMBER_MCP_SCOPES)[number];

export const MEMBER_MCP_P0_ISSUABLE_SCOPES = [
  "member:brief:read",
  "member:prompt:read",
] as const satisfies readonly MemberMcpScope[];

// P1a (2026-09-29): candidate writes — work signals and field reports. Both
// land as append-only, untrusted-tainted MemberWorkSignalReceipt rows and
// grant no authority. Issued only when the member explicitly asks for write
// access; the approver sees the scopes before approving.
export const MEMBER_MCP_P1A_WRITE_SCOPES = [
  "member:signal:write",
  "member:report:write",
] as const satisfies readonly MemberMcpScope[];

// P1b (2026-09-29): responding to CAIO prompts (asynchronous registration,
// see response-contract.ts). Rides the same explicit write opt-in as P1a.
export const MEMBER_MCP_P1B_RESPOND_SCOPES = [
  "member:prompt:respond",
] as const satisfies readonly MemberMcpScope[];

// P2 (2026-09-29): the Stage 1 work packets an owner dispatched to the member
// (PR #426's executor grant) and the member's reports on them. A report is an
// untrusted candidate signal; packets close only through the Stage 1 chain
// (see task-contract.ts). `member:task:receipt` is the frozen P0 scope name
// for "report on my task". Separate opt-in from the P1 writes.
export const MEMBER_MCP_P2_TASK_SCOPES = [
  "member:task:read",
  "member:task:receipt",
] as const satisfies readonly MemberMcpScope[];

export function memberMcpScopesForRequest(includeWrite: boolean, includeTasks = false): MemberMcpScope[] {
  return [
    ...MEMBER_MCP_P0_ISSUABLE_SCOPES,
    ...(includeWrite ? [...MEMBER_MCP_P1A_WRITE_SCOPES, ...MEMBER_MCP_P1B_RESPOND_SCOPES] : []),
    ...(includeTasks ? MEMBER_MCP_P2_TASK_SCOPES : []),
  ];
}

export const MEMBER_MCP_TOKEN_PREFIX = "hmm_";
export const MEMBER_MCP_TOKEN_TTL_DAYS = 30;
export const MEMBER_MCP_CLAIM_WINDOW_DAYS = 7;
export const MEMBER_MCP_RATE_LIMIT_PER_MINUTE = 60;
export const MEMBER_MCP_MAX_OPEN_CONNECTIONS_PER_MEMBER = 5;
export const MEMBER_MCP_ENDPOINT_PATH = "/api/mcp/member";

// Stored lifecycle states. "expired" and "claim_expired" are derived from the
// clock, never stored, so a lapsed row needs no sweeper write.
export const MEMBER_MCP_STORED_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "active",
  "revoked",
] as const;

export type MemberMcpStoredStatus = (typeof MEMBER_MCP_STORED_STATUSES)[number];

export type MemberMcpEffectiveStatus =
  | MemberMcpStoredStatus
  | "expired"
  | "claim_expired";

export function effectiveMemberConnectionStatus(
  row: {
    status: string;
    claimDeadlineAt: Date | null;
    expiresAt: Date | null;
  },
  now: Date,
): MemberMcpEffectiveStatus | null {
  const status = (MEMBER_MCP_STORED_STATUSES as readonly string[]).includes(row.status)
    ? (row.status as MemberMcpStoredStatus)
    : null;
  if (status === "approved") {
    return row.claimDeadlineAt && row.claimDeadlineAt.getTime() > now.getTime()
      ? "approved"
      : "claim_expired";
  }
  if (status === "active") {
    return row.expiresAt && row.expiresAt.getTime() > now.getTime() ? "active" : "expired";
  }
  return status;
}

// A connection that still occupies one of the member's slots.
export function isOpenMemberConnectionStatus(status: MemberMcpEffectiveStatus | null) {
  return status === "requested" || status === "approved" || status === "active";
}

export function memberRefForUser(userId: string) {
  return userId;
}

// Runtime gate: the deployment env switch AND the workspace flag must both be
// on. Approved clients are the tenant egress allowlist: a client type not on
// it can neither be requested nor served (spec §8.2 provider_not_approved).
export type MemberMcpWorkspaceFlags = {
  enabled: boolean;
  approvedClients: MemberMcpClientType[];
  // Allowed field-report metric keys (tenant quick-check template ids, which
  // Core cannot know). Empty means field reports carry text only.
  fieldReportMetricKeys: string[];
};

const METRIC_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,79}$/;

export function readMemberMcpWorkspaceFlags(
  featureFlagsJson: string | null | undefined,
  env: Readonly<Record<string, string | undefined>> = process.env,
): MemberMcpWorkspaceFlags {
  let flags: unknown = null;
  try {
    flags = JSON.parse(featureFlagsJson ?? "{}");
  } catch {
    flags = null;
  }
  const record = flags && typeof flags === "object" ? (flags as Record<string, unknown>) : {};
  const approved = Array.isArray(record.memberMcpApprovedClients)
    ? record.memberMcpApprovedClients.filter((value): value is MemberMcpClientType =>
        (MEMBER_MCP_CLIENT_TYPES as readonly unknown[]).includes(value),
      )
    : [];
  const metricKeys = Array.isArray(record.memberMcpFieldReportMetricKeys)
    ? record.memberMcpFieldReportMetricKeys.filter(
        (value): value is string => typeof value === "string" && METRIC_KEY_PATTERN.test(value),
      )
    : [];
  return {
    enabled: env.HELM_MEMBER_MCP_ENABLED === "true" && record.memberMcp === true,
    approvedClients: [...new Set(approved)],
    fieldReportMetricKeys: [...new Set(metricKeys)],
  };
}

export function memberMcpProviderRef(
  clientType: string,
  approvedClients: readonly MemberMcpClientType[],
): string | null {
  return (approvedClients as readonly string[]).includes(clientType)
    ? `member-mcp-client:${clientType}`
    : null;
}

// Approval authority. Workspace-wide approval comes from the capability
// matrix (OWNER, ADMIN). A supervisor is designated explicitly per groupTag
// (MemberAgentApproverGrant); roles cannot imply it because in production the
// group-tagged members are frontline OPERATOR seats. Nobody but OWNER approves
// their own request. Anything unproven is a denial.
export type MemberConnectionApprover = {
  userId: string;
  role: WorkspaceRole;
  membershipActive: boolean;
  grantedGroupTags: readonly string[];
};

export type MemberConnectionApprovalTarget = {
  userId: string;
  groupTag: string | null;
  membershipActive: boolean;
};

export type MemberConnectionApprovalDecision =
  | { allowed: true; basis: "workspace_capability" | "group_grant" }
  | {
      allowed: false;
      reason:
        | "approver_inactive"
        | "target_inactive"
        | "self_approval"
        | "no_authority";
    };

// purpose "approve" grants access and requires the target to be an active
// member; "close" (reject a pending request, revoke a connection) removes
// access and must stay possible after the member has left.
export function decideMemberConnectionApproval(
  approver: MemberConnectionApprover,
  target: MemberConnectionApprovalTarget,
  purpose: "approve" | "close" = "approve",
): MemberConnectionApprovalDecision {
  if (!approver.membershipActive) return { allowed: false, reason: "approver_inactive" };
  if (purpose === "approve" && !target.membershipActive) return { allowed: false, reason: "target_inactive" };
  if (approver.userId === target.userId && approver.role !== WorkspaceRole.OWNER) {
    return { allowed: false, reason: "self_approval" };
  }
  if (
    workspaceRoleHasCapability(
      approver.role,
      WORKSPACE_CAPABILITIES.APPROVE_MEMBER_AGENT_CONNECTIONS,
    )
  ) {
    return { allowed: true, basis: "workspace_capability" };
  }
  const tag = target.groupTag?.trim();
  if (tag && approver.grantedGroupTags.some((granted) => granted.trim() === tag)) {
    return { allowed: true, basis: "group_grant" };
  }
  return { allowed: false, reason: "no_authority" };
}

export function canManageMemberApproverGrants(role: WorkspaceRole) {
  return workspaceRoleHasCapability(
    role,
    WORKSPACE_CAPABILITIES.APPROVE_MEMBER_AGENT_CONNECTIONS,
  );
}

export function normalizeDeviceLabel(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 80) return null;
  // Printable text only: no control characters in something shown to approvers.
  return /[\u0000-\u001f\u007f]/.test(trimmed) ? null : trimmed;
}

export function normalizeGroupTag(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= 60 ? trimmed : null;
}

export function parseStoredMemberMcpScopes(value: string): MemberMcpScope[] {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return [
    ...new Set(
      parsed.filter((item): item is MemberMcpScope =>
        (MEMBER_MCP_SCOPES as readonly unknown[]).includes(item),
      ),
    ),
  ];
}
