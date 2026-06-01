import {
  AccessState,
  MembershipStatus,
  WorkerEntitlementStatus,
  WorkerEntitlementType,
  WorkspaceRole,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  dbMock,
  writeAuditLogMock,
  logEventMock,
  ensureWorkspaceCommercialFoundationMock,
  getWorkspaceBillingSnapshotMock,
} = vi.hoisted(() => ({
  dbMock: {
    workspace: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    membership: {
      create: vi.fn(),
    },
    policyRule: {
      count: vi.fn(),
      createMany: vi.fn(),
    },
    budgetRule: {
      count: vi.fn(),
      createMany: vi.fn(),
    },
  },
  writeAuditLogMock: vi.fn(),
  logEventMock: vi.fn(),
  ensureWorkspaceCommercialFoundationMock: vi.fn(),
  getWorkspaceBillingSnapshotMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: logEventMock,
}));

vi.mock("@/lib/billing/foundation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing/foundation")>(
    "@/lib/billing/foundation",
  );

  return {
    ...actual,
    ensureWorkspaceCommercialFoundation: ensureWorkspaceCommercialFoundationMock,
    getWorkspaceBillingSnapshot: getWorkspaceBillingSnapshotMock,
  };
});

import {
  buildTrialOnboardingSurfaceData,
  createSelfServeTrialOrganization,
} from "@/lib/auth/trial-onboarding";

describe("trial onboarding helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.workspace.findUnique.mockResolvedValue(null);
    dbMock.workspace.create.mockResolvedValue({
      id: "workspace-1",
      name: "Acme Helm",
      defaultLocale: "zh-CN",
    });
    dbMock.membership.create.mockResolvedValue({
      id: "membership-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.ACTIVE,
    });
    dbMock.policyRule.count.mockResolvedValue(0);
    dbMock.budgetRule.count.mockResolvedValue(0);
    dbMock.policyRule.createMany.mockResolvedValue({ count: 8 });
    dbMock.budgetRule.createMany.mockResolvedValue({ count: 2 });
    ensureWorkspaceCommercialFoundationMock.mockResolvedValue(AccessState.TRIALING);
  });

  it("creates a self-serve trial organization with owner membership and billing foundation", async () => {
    const result = await createSelfServeTrialOrganization({
      user: {
        id: "user-1",
        email: "hello@acme.com",
        name: "Tommy",
        title: "Founder",
      },
      organizationName: "Acme Helm",
      locale: "zh-CN",
    });

    expect(dbMock.workspace.create).toHaveBeenCalledTimes(1);
    expect(dbMock.membership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "workspace-1",
          userId: "user-1",
          role: WorkspaceRole.OWNER,
          status: MembershipStatus.ACTIVE,
        }),
      }),
    );
    expect(dbMock.policyRule.createMany).toHaveBeenCalledTimes(1);
    expect(dbMock.budgetRule.createMany).toHaveBeenCalledTimes(1);
    expect(ensureWorkspaceCommercialFoundationMock).toHaveBeenCalledWith("workspace-1");
    expect(writeAuditLogMock).toHaveBeenCalledTimes(1);
    expect(logEventMock).toHaveBeenCalledTimes(1);
    expect(result.workspace.id).toBe("workspace-1");
  });

  it("builds a trial-first onboarding summary with seats, workers, and upgrade path", async () => {
    getWorkspaceBillingSnapshotMock.mockResolvedValue({
      memberships: [
        {
          workspaceId: "workspace-1",
          status: MembershipStatus.ACTIVE,
          role: WorkspaceRole.OWNER,
        },
      ],
      workerEntitlements: [
        {
          id: "ent-1",
          workerKey: "meeting_os_worker",
          entitlementType: WorkerEntitlementType.INCLUDED,
          status: WorkerEntitlementStatus.ACTIVE,
          effectiveFrom: new Date("2026-03-31T00:00:00Z"),
          effectiveTo: null,
          internalLimit: null,
        },
        {
          id: "ent-2",
          workerKey: "review_memory_worker",
          entitlementType: WorkerEntitlementType.INCLUDED,
          status: WorkerEntitlementStatus.ACTIVE,
          effectiveFrom: new Date("2026-03-31T00:00:00Z"),
          effectiveTo: null,
          internalLimit: null,
        },
      ],
      trialState: {
        trialEndsAt: new Date("2026-04-30T00:00:00Z"),
        graceEndsAt: new Date("2026-05-07T00:00:00Z"),
      },
      trialCollaboratorSeats: 2,
    });

    const summary = await buildTrialOnboardingSurfaceData({
      workspaceId: "workspace-1",
      role: WorkspaceRole.OWNER,
      locale: "zh-CN",
      accessState: AccessState.TRIALING,
      organizationName: "Acme Helm",
    });

    expect(summary.roleLabel).toBe("组织所有者");
    expect(summary.currentJudgement).toContain("试用中");
    expect(summary.seatSummary).toContain("2 个试用协作席位");
    expect(summary.includedWorkers).toHaveLength(2);
    expect(summary.nextSteps).toHaveLength(3);
    expect(summary.purchasePath).toContain("智能设置");
  });

  it("keeps read-only messaging narrow and restore-first instead of crippling the product", async () => {
    getWorkspaceBillingSnapshotMock.mockResolvedValue({
      memberships: [
        {
          workspaceId: "workspace-1",
          status: MembershipStatus.ACTIVE,
          role: WorkspaceRole.OWNER,
        },
      ],
      workerEntitlements: [
        {
          id: "ent-1",
          workerKey: "meeting_os_worker",
          entitlementType: WorkerEntitlementType.INCLUDED,
          status: WorkerEntitlementStatus.ACTIVE,
          effectiveFrom: new Date("2026-03-31T00:00:00Z"),
          effectiveTo: null,
          internalLimit: null,
        },
      ],
      trialState: {
        trialEndsAt: new Date("2026-04-30T00:00:00Z"),
        graceEndsAt: new Date("2026-05-07T00:00:00Z"),
      },
      trialCollaboratorSeats: 2,
    });

    const summary = await buildTrialOnboardingSurfaceData({
      workspaceId: "workspace-1",
      role: WorkspaceRole.OWNER,
      locale: "en-US",
      accessState: AccessState.READ_ONLY,
      organizationName: "Acme Helm",
    });

    expect(summary.lifecycleSummary).toContain("read-only");
    expect(summary.purchasePath).toContain("restore access");
    expect(summary.boundaryNote).toContain("not");
    expect(summary.nextSteps[0]?.title).toContain("Restore");
  });
});
