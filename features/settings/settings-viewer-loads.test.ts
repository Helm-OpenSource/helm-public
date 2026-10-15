import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceRole } from "@prisma/client";

// Behavioural check of getSettingsData's viewer gating (object-first wave 4 and
// the owner decision on #467): members load only the light view, reviewers add
// the policy rows and nothing else, admins keep every load. Every db call is
// recorded through a proxy so a new ungated load shows up here.

const { dbCalls, serviceMocks } = vi.hoisted(() => ({
  dbCalls: [] as string[],
  serviceMocks: {
    getWorkspaceBillingSnapshot: vi.fn(),
    getOpenSkillSuggestions: vi.fn(),
    getRecentSkillAdoptions: vi.fn(),
    getFormalSkillReviewQueue: vi.fn(),
    getRecentFormalReviewDecisions: vi.fn(),
    listTenantResourceManualProofRecords: vi.fn(),
    listTenantResourceGuardedWritePilotRecords: vi.fn(),
    getOrgAdminGovernanceSummary: vi.fn(),
    getLatestDingTalkDirectoryInviteDryRunSnapshot: vi.fn(),
    findMembershipsWithExistingUsers: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => {
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_target, method: string) => async () => {
          dbCalls.push(`${name}.${method}`);
          if (name === "workspace" && method === "findUnique") {
            return {
              id: "workspace-1",
              name: "Atlas 团队",
              slug: "atlas",
              status: "ACTIVE",
              defaultLocale: "zh-CN",
              configuration: null,
              workspaceClass: null,
              billingAccount: null,
              trialState: null,
              workerEntitlements: [],
            };
          }
          if (name === "membership" && method === "findMany") {
            return [
              {
                workspaceId: "workspace-1",
                role: currentRole,
                status: "ACTIVE",
                workspace: {
                  name: "Atlas 团队",
                  slug: "atlas",
                  status: "ACTIVE",
                  billingAccount: null,
                  trialState: null,
                },
              },
            ];
          }
          if (method === "count") return 0;
          if (method === "findMany") return [];
          return null;
        },
      },
    );
  return { db: new Proxy({}, { get: (_target, name: string) => model(name) }) };
});
vi.mock("@/lib/billing/foundation", () => ({
  TRIAL_COLLABORATOR_SEATS: 2,
  getWorkspaceBillingSnapshot: serviceMocks.getWorkspaceBillingSnapshot,
}));
vi.mock("@/lib/auth/session", () => ({ getSessionId: async () => "session-1" }));
vi.mock("@/lib/auth/membership-with-user", () => ({
  findMembershipsWithExistingUsers: serviceMocks.findMembershipsWithExistingUsers,
}));
vi.mock("@/lib/evolution/skill-suggestion.service", () => ({
  getOpenSkillSuggestions: serviceMocks.getOpenSkillSuggestions,
  getRecentSkillAdoptions: serviceMocks.getRecentSkillAdoptions,
  getFormalSkillReviewQueue: serviceMocks.getFormalSkillReviewQueue,
  getRecentFormalReviewDecisions: serviceMocks.getRecentFormalReviewDecisions,
}));
vi.mock("@/lib/tenant-resources/manual-proof-runtime", () => ({
  listTenantResourceManualProofRecords: serviceMocks.listTenantResourceManualProofRecords,
}));
vi.mock("@/lib/tenant-resources/guarded-write-pilot-runtime", () => ({
  listTenantResourceGuardedWritePilotRecords:
    serviceMocks.listTenantResourceGuardedWritePilotRecords,
}));
vi.mock("@/lib/auth/org-admin-governance", () => ({
  getOrgAdminGovernanceSummary: serviceMocks.getOrgAdminGovernanceSummary,
}));
vi.mock("@/lib/connectors/dingtalk-directory-invite-snapshot", () => ({
  getLatestDingTalkDirectoryInviteDryRunSnapshot:
    serviceMocks.getLatestDingTalkDirectoryInviteDryRunSnapshot,
}));

let currentRole: WorkspaceRole = WorkspaceRole.MEMBER;

import { getSettingsData } from "@/features/settings/queries";

const lightViewDbCalls = [
  "membership.count",
  "membership.findMany",
  "notification.findMany",
  "workspace.findUnique",
];

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort();
}

async function loadAs(role: WorkspaceRole) {
  currentRole = role;
  return getSettingsData("workspace-1", "user-1", { role, accessState: "ACTIVE" });
}

describe("settings data loads by viewer", () => {
  beforeEach(() => {
    dbCalls.length = 0;
    vi.clearAllMocks();
    serviceMocks.getWorkspaceBillingSnapshot.mockResolvedValue({
      accessState: "ACTIVE",
      billingAccount: null,
      trialState: null,
      activeSeatCount: 1,
      trialCollaboratorSeats: 2,
      memberships: [],
      workerEntitlements: [],
      usageSummary: [],
    });
    serviceMocks.getOpenSkillSuggestions.mockResolvedValue([]);
    serviceMocks.getRecentSkillAdoptions.mockResolvedValue([]);
    serviceMocks.getFormalSkillReviewQueue.mockResolvedValue([]);
    serviceMocks.getRecentFormalReviewDecisions.mockResolvedValue([]);
    serviceMocks.listTenantResourceManualProofRecords.mockResolvedValue([]);
    serviceMocks.listTenantResourceGuardedWritePilotRecords.mockResolvedValue([]);
    serviceMocks.getOrgAdminGovernanceSummary.mockResolvedValue(null);
    serviceMocks.getLatestDingTalkDirectoryInviteDryRunSnapshot.mockResolvedValue(null);
    serviceMocks.findMembershipsWithExistingUsers.mockResolvedValue([
      {
        id: "membership-1",
        workspaceId: "workspace-1",
        userId: "user-1",
        role: WorkspaceRole.MEMBER,
        status: "ACTIVE",
        title: null,
        groupTag: null,
        goalTitle: null,
        goalDescription: null,
        goalItemsJson: null,
        jobResponsibilities: null,
        persona: null,
        rolePresetKey: null,
        definitionDraftJson: null,
        definitionAcceptedJson: null,
        definitionAcceptedAt: null,
        joinedAt: new Date("2026-10-01T00:00:00Z"),
        createdAt: new Date("2026-10-01T00:00:00Z"),
        updatedAt: new Date("2026-10-01T00:00:00Z"),
        user: {
          id: "user-1",
          email: "member@atlas.test",
          name: "林舟",
          phone: "secret-phone",
          passwordHash: "secret-hash",
          lastLoginAt: new Date("2026-10-15T00:00:00Z"),
        },
      },
    ]);
  });

  const workspaceWideServices = [
    "getWorkspaceBillingSnapshot",
    "getOpenSkillSuggestions",
    "getRecentSkillAdoptions",
    "listTenantResourceManualProofRecords",
    "listTenantResourceGuardedWritePilotRecords",
  ] as const;

  it("members load only the light view: no rules, no workspace-wide loads", async () => {
    const data = await loadAs(WorkspaceRole.MEMBER);

    expect(uniqueSorted(dbCalls)).toEqual(lightViewDbCalls);
    for (const name of workspaceWideServices) {
      expect(serviceMocks[name], name).not.toHaveBeenCalled();
    }
    expect(data.organizationSummary.settingsAdminView).toBe(false);
    expect(data.organizationSummary.policyRulesReadable).toBe(false);
    expect(data.policies).toEqual([]);
    expect(data.organizationSummary.currentState).toBe("ACTIVE");
  });

  it("reviewers add the policy rows and nothing else", async () => {
    const data = await loadAs(WorkspaceRole.REVIEWER);

    expect(uniqueSorted(dbCalls)).toEqual(
      uniqueSorted([...lightViewDbCalls, "policyRule.findMany"]),
    );
    for (const name of workspaceWideServices) {
      expect(serviceMocks[name], name).not.toHaveBeenCalled();
    }
    expect(data.organizationSummary.settingsAdminView).toBe(false);
    expect(data.organizationSummary.policyRulesReadable).toBe(true);
  });

  it("admins keep the workspace-wide loads", async () => {
    const data = await loadAs(WorkspaceRole.ADMIN);

    for (const call of [
      "policyRule.findMany",
      "budgetRule.findMany",
      "connector.findMany",
      "contact.findMany",
      "importSource.findMany",
      "auditLog.count",
    ]) {
      expect(dbCalls, call).toContain(call);
    }
    for (const name of workspaceWideServices) {
      expect(serviceMocks[name], name).toHaveBeenCalled();
    }
    expect(data.organizationSummary.settingsAdminView).toBe(true);
  });

  it("never returns the full User row to the client", async () => {
    for (const role of [WorkspaceRole.MEMBER, WorkspaceRole.ADMIN]) {
      const data = await loadAs(role);
      expect(data.memberships).toHaveLength(1);
      expect(data.memberships[0].user).toEqual({
        id: "user-1",
        name: "林舟",
        email: "member@atlas.test",
      });
      expect(JSON.stringify(data.memberships)).not.toContain("secret-hash");
      expect(JSON.stringify(data.memberships)).not.toContain("secret-phone");
    }
  });
});
