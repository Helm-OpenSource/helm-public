import { WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  decideMemberConnectionApproval,
  effectiveMemberConnectionStatus,
  memberMcpProviderRef,
  memberRefForUser,
  normalizeDeviceLabel,
  parseStoredMemberMcpScopes,
  readMemberMcpWorkspaceFlags,
} from "@/lib/member-mcp/contract";

const now = new Date("2026-09-29T08:00:00.000Z");
const later = new Date("2026-09-30T08:00:00.000Z");
const earlier = new Date("2026-09-28T08:00:00.000Z");

const approver = (overrides: Partial<Parameters<typeof decideMemberConnectionApproval>[0]> = {}) => ({
  userId: "u-approver",
  role: WorkspaceRole.OPERATOR,
  membershipActive: true,
  grantedGroupTags: [] as string[],
  ...overrides,
});
const target = (overrides: Partial<Parameters<typeof decideMemberConnectionApproval>[1]> = {}) => ({
  userId: "u-seat",
  groupTag: "深圳汉普组",
  membershipActive: true,
  role: WorkspaceRole.OPERATOR as WorkspaceRole | null,
  ...overrides,
});

describe("decideMemberConnectionApproval", () => {
  it("lets owners and admins approve anyone", () => {
    expect(decideMemberConnectionApproval(approver({ role: WorkspaceRole.OWNER }), target())).toEqual({ allowed: true, basis: "workspace_capability" });
    expect(decideMemberConnectionApproval(approver({ role: WorkspaceRole.ADMIN }), target({ groupTag: null }))).toEqual({ allowed: true, basis: "workspace_capability" });
  });

  it("does not infer a supervisor from role or a shared groupTag", () => {
    // Production: group-tagged members are frontline OPERATOR seats.
    expect(decideMemberConnectionApproval(approver(), target())).toEqual({ allowed: false, reason: "no_authority" });
    expect(decideMemberConnectionApproval(approver({ role: WorkspaceRole.REVIEWER }), target())).toEqual({ allowed: false, reason: "no_authority" });
    expect(decideMemberConnectionApproval(approver({ role: WorkspaceRole.BILLING_ADMIN }), target())).toEqual({ allowed: false, reason: "no_authority" });
  });

  it("lets a designated supervisor approve only their granted groups", () => {
    const supervisor = approver({ grantedGroupTags: ["深圳汉普组"] });
    expect(decideMemberConnectionApproval(supervisor, target())).toEqual({ allowed: true, basis: "group_grant" });
    expect(decideMemberConnectionApproval(supervisor, target({ groupTag: "江西融凡组" }))).toEqual({ allowed: false, reason: "no_authority" });
    expect(decideMemberConnectionApproval(supervisor, target({ groupTag: null }))).toEqual({ allowed: false, reason: "no_authority" });
    expect(decideMemberConnectionApproval(supervisor, target({ groupTag: "  " }))).toEqual({ allowed: false, reason: "no_authority" });
  });

  it("never lets a group grant reach an owner or admin carrying the same tag", () => {
    const supervisor = approver({ grantedGroupTags: ["深圳汉普组"] });
    expect(decideMemberConnectionApproval(supervisor, target({ role: WorkspaceRole.ADMIN }))).toEqual({ allowed: false, reason: "no_authority" });
    expect(decideMemberConnectionApproval(supervisor, target({ role: WorkspaceRole.OWNER }), "close")).toEqual({ allowed: false, reason: "no_authority" });
    expect(decideMemberConnectionApproval(supervisor, target({ role: WorkspaceRole.REVIEWER }))).toEqual({ allowed: true, basis: "group_grant" });
  });

  it("forbids self-approval except for the owner", () => {
    expect(decideMemberConnectionApproval(approver({ role: WorkspaceRole.ADMIN }), target({ userId: "u-approver" }))).toEqual({ allowed: false, reason: "self_approval" });
    expect(decideMemberConnectionApproval(approver({ grantedGroupTags: ["深圳汉普组"] }), target({ userId: "u-approver" }))).toEqual({ allowed: false, reason: "self_approval" });
    expect(decideMemberConnectionApproval(approver({ role: WorkspaceRole.OWNER }), target({ userId: "u-approver" }))).toEqual({ allowed: true, basis: "workspace_capability" });
  });

  it("denies when either membership is not active", () => {
    expect(decideMemberConnectionApproval(approver({ role: WorkspaceRole.OWNER, membershipActive: false }), target())).toEqual({ allowed: false, reason: "approver_inactive" });
    expect(decideMemberConnectionApproval(approver({ role: WorkspaceRole.OWNER }), target({ membershipActive: false }))).toEqual({ allowed: false, reason: "target_inactive" });
  });

  it("still lets approvers close access for a member who has left", () => {
    const departed = target({ membershipActive: false });
    expect(decideMemberConnectionApproval(approver({ role: WorkspaceRole.ADMIN }), departed, "close")).toEqual({ allowed: true, basis: "workspace_capability" });
    expect(decideMemberConnectionApproval(approver({ grantedGroupTags: ["深圳汉普组"] }), departed, "close")).toEqual({ allowed: true, basis: "group_grant" });
    expect(decideMemberConnectionApproval(approver(), departed, "close")).toEqual({ allowed: false, reason: "no_authority" });
    expect(decideMemberConnectionApproval(approver({ role: WorkspaceRole.ADMIN, membershipActive: false }), departed, "close")).toEqual({ allowed: false, reason: "approver_inactive" });
  });
});

describe("effectiveMemberConnectionStatus", () => {
  it("derives claim and token expiry from the clock", () => {
    expect(effectiveMemberConnectionStatus({ status: "approved", claimDeadlineAt: later, expiresAt: null }, now)).toBe("approved");
    expect(effectiveMemberConnectionStatus({ status: "approved", claimDeadlineAt: earlier, expiresAt: null }, now)).toBe("claim_expired");
    expect(effectiveMemberConnectionStatus({ status: "approved", claimDeadlineAt: null, expiresAt: null }, now)).toBe("claim_expired");
    expect(effectiveMemberConnectionStatus({ status: "active", claimDeadlineAt: null, expiresAt: later }, now)).toBe("active");
    expect(effectiveMemberConnectionStatus({ status: "active", claimDeadlineAt: null, expiresAt: now }, now)).toBe("expired");
    expect(effectiveMemberConnectionStatus({ status: "revoked", claimDeadlineAt: null, expiresAt: later }, now)).toBe("revoked");
    expect(effectiveMemberConnectionStatus({ status: "bogus", claimDeadlineAt: null, expiresAt: null }, now)).toBeNull();
  });
});

describe("readMemberMcpWorkspaceFlags", () => {
  const on = { HELM_MEMBER_MCP_ENABLED: "true" };
  it("requires both the env switch and the workspace flag", () => {
    const json = JSON.stringify({ memberMcp: true, memberMcpApprovedClients: ["claude_code"] });
    expect(readMemberMcpWorkspaceFlags(json, on).enabled).toBe(true);
    expect(readMemberMcpWorkspaceFlags(json, {}).enabled).toBe(false);
    expect(readMemberMcpWorkspaceFlags(JSON.stringify({ memberMcp: "true" }), on).enabled).toBe(false);
    expect(readMemberMcpWorkspaceFlags("not json", on)).toEqual({ enabled: false, approvedClients: [], contentClassification: null });
    expect(readMemberMcpWorkspaceFlags(null, on)).toEqual({ enabled: false, approvedClients: [], contentClassification: null });
  });

  it("keeps only known client types on the approved list", () => {
    const json = JSON.stringify({ memberMcp: true, memberMcpApprovedClients: ["codex", "cursor", "codex", 7] });
    expect(readMemberMcpWorkspaceFlags(json, on).approvedClients).toEqual(["codex"]);
  });
});

describe("content classification policy", () => {
  const on = { HELM_MEMBER_MCP_ENABLED: "true" };
  const flags = (value: unknown) => readMemberMcpWorkspaceFlags(JSON.stringify({ memberMcp: true, memberMcpContentClassification: value }), on);
  it("accepts only a complete, closed-set classification with a strict instant", () => {
    expect(flags({ sensitivity: "internal", processingDisposition: "remote_projected", classifiedAt: "2026-09-29T12:00:00.000Z" }).contentClassification)
      .toEqual({ sensitivity: "internal", processingDisposition: "remote_projected", classifiedAt: "2026-09-29T12:00:00.000Z" });
    expect(flags(undefined).contentClassification).toBeNull();
    expect(flags({ sensitivity: "secret", processingDisposition: "remote_projected", classifiedAt: "2026-09-29T12:00:00.000Z" }).contentClassification).toBeNull();
    expect(flags({ sensitivity: "internal", processingDisposition: "anywhere", classifiedAt: "2026-09-29T12:00:00.000Z" }).contentClassification).toBeNull();
    expect(flags({ sensitivity: "internal", processingDisposition: "local_only", classifiedAt: "yesterday" }).contentClassification).toBeNull();
  });
});

describe("memberRefForUser", () => {
  it("uses the Stage 1 user: namespace", () => {
    expect(memberRefForUser("abc")).toBe("user:abc");
  });
});

describe("memberMcpProviderRef", () => {
  it("is null for a client type off the approved list", () => {
    expect(memberMcpProviderRef("codex", ["codex"])).toBe("member-mcp-client:codex");
    expect(memberMcpProviderRef("qwenwork", ["codex"])).toBeNull();
    expect(memberMcpProviderRef("codex", [])).toBeNull();
  });
});

describe("input normalizers", () => {
  it("normalizes device labels and rejects control characters", () => {
    expect(normalizeDeviceLabel("  办公室   MacBook ")).toBe("办公室 MacBook");
    expect(normalizeDeviceLabel("x")).toBeNull();
    expect(normalizeDeviceLabel("a\u0007b")).toBeNull();
    expect(normalizeDeviceLabel("a".repeat(81))).toBeNull();
  });

  it("drops unknown stored scopes", () => {
    expect(parseStoredMemberMcpScopes('["member:brief:read","admin:all","member:brief:read"]')).toEqual(["member:brief:read"]);
    expect(parseStoredMemberMcpScopes("{")).toEqual([]);
  });
});
