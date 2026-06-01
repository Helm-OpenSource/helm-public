import { ActorType, WorkspaceClass, WorkspaceRole, WorkspaceStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { importGovernanceMock, dbMock } = vi.hoisted(() => ({
  importGovernanceMock: {
    getWorkspaceRoleForUser: vi.fn(),
  },
  dbMock: {
    workspace: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/import-governance", () => ({
  getWorkspaceRoleForUser: importGovernanceMock.getWorkspaceRoleForUser,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  assertWorkspaceBillingServiceAccess,
  assertWorkspaceCaptureServiceAccess,
  assertWorkspaceContributionRegistryServiceAccess,
  assertWorkspaceGovernedActionManagementServiceAccess,
  assertWorkspaceGovernedActionReviewServiceAccess,
  assertWorkspaceInsightServiceAccess,
  assertWorkspaceManualSettlementServiceAccess,
  assertWorkspaceMemoryServiceAccess,
  assertWorkspacePolicyServiceAccess,
  assertWorkspaceReservedCommercialRegistryServiceAccess,
  assertWorkspaceReservedManualSettlementServiceAccess,
  assertWorkspaceReservedParticipantPortalServiceAccess,
  assertWorkspaceReservedProgramApplicationServiceAccess,
  isWorkspaceServiceGovernanceError,
  shouldEnforceWorkspaceServiceGovernance,
} from "@/lib/auth/service-governance";

describe("service governance helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    importGovernanceMock.getWorkspaceRoleForUser.mockResolvedValue(null);
    dbMock.workspace.findUnique.mockResolvedValue({
      status: WorkspaceStatus.ACTIVE,
      workspaceClass: WorkspaceClass.HELM_RESERVED,
      systemKey: "helm_reserved_primary",
    });
  });

  it("only enforces governance for user-initiated service mutations", () => {
    expect(shouldEnforceWorkspaceServiceGovernance({ userId: "user-1", actorType: ActorType.USER })).toBe(true);
    expect(shouldEnforceWorkspaceServiceGovernance({ userId: "user-1", actorType: null })).toBe(true);
    expect(shouldEnforceWorkspaceServiceGovernance({ userId: "user-1", actorType: ActorType.SYSTEM })).toBe(false);
    expect(shouldEnforceWorkspaceServiceGovernance({ userId: null, actorType: ActorType.USER })).toBe(false);
  });

  it("re-reads the authoritative workspace role before allowing billing services", async () => {
    importGovernanceMock.getWorkspaceRoleForUser.mockResolvedValueOnce(WorkspaceRole.BILLING_ADMIN);

    await expect(
      assertWorkspaceBillingServiceAccess({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorType: ActorType.USER,
        english: true,
        scope: "checkout",
      }),
    ).resolves.toBe(WorkspaceRole.BILLING_ADMIN);

    expect(importGovernanceMock.getWorkspaceRoleForUser).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
    });
  });

  it("rejects user-initiated insight and capture services when the authoritative role lacks capability", async () => {
    importGovernanceMock.getWorkspaceRoleForUser
      .mockResolvedValueOnce(WorkspaceRole.MEMBER)
      .mockResolvedValueOnce(WorkspaceRole.REVIEWER);

    await expect(
      assertWorkspaceInsightServiceAccess({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toMatchObject({
      message: "Only owner, admin, or operator can generate tenant-scoped reports or record recommendation feedback.",
    });

    await expect(
      assertWorkspaceCaptureServiceAccess({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorType: ActorType.USER,
        english: false,
      }),
    ).rejects.toMatchObject({
      message: "只有组织负责人、管理员或运营角色可以启动、导入或处理租户范围内的记录会话。",
    });
  });

  it("re-checks memory and manual-settlement services against the authoritative role", async () => {
    importGovernanceMock.getWorkspaceRoleForUser
      .mockResolvedValueOnce(WorkspaceRole.REVIEWER)
      .mockResolvedValueOnce(WorkspaceRole.MEMBER);

    await expect(
      assertWorkspaceMemoryServiceAccess({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).resolves.toBe(WorkspaceRole.REVIEWER);

    await expect(
      assertWorkspaceManualSettlementServiceAccess({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toMatchObject({
      message: "Only owner, billing admin or admin can manage manual settlement",
    });
  });

  it("re-checks contribution-registry services against the authoritative role", async () => {
    importGovernanceMock.getWorkspaceRoleForUser
      .mockResolvedValueOnce(WorkspaceRole.ADMIN)
      .mockResolvedValueOnce(WorkspaceRole.OPERATOR);

    await expect(
      assertWorkspaceContributionRegistryServiceAccess({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).resolves.toBe(WorkspaceRole.ADMIN);

    await expect(
      assertWorkspaceContributionRegistryServiceAccess({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorType: ActorType.USER,
        english: false,
      }),
    ).rejects.toMatchObject({
      message: "只有组织负责人、计费管理员或管理员可以管理贡献方登记记录",
    });
  });

  it("requires the Helm reserved host workspace for first-party commercial service seams", async () => {
    importGovernanceMock.getWorkspaceRoleForUser
      .mockResolvedValueOnce(WorkspaceRole.ADMIN)
      .mockResolvedValueOnce(WorkspaceRole.BILLING_ADMIN)
      .mockResolvedValueOnce(WorkspaceRole.ADMIN)
      .mockResolvedValueOnce(WorkspaceRole.ADMIN);
    dbMock.workspace.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        status: WorkspaceStatus.ACTIVE,
        workspaceClass: WorkspaceClass.CUSTOMER,
        systemKey: "customer_workspace",
      })
      .mockResolvedValueOnce({
        status: WorkspaceStatus.ACTIVE,
        workspaceClass: WorkspaceClass.HELM_RESERVED,
        systemKey: "helm_reserved_primary",
      })
      .mockResolvedValueOnce({
        status: WorkspaceStatus.ACTIVE,
        workspaceClass: WorkspaceClass.HELM_RESERVED,
        systemKey: "helm_reserved_primary",
      });

    await expect(
      assertWorkspaceReservedCommercialRegistryServiceAccess({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toMatchObject({
      message:
        "Contributor registry, settlement, program host, and participant portal operations stay reserved for the Helm internal operating workspace.",
    });

    await expect(
      assertWorkspaceReservedManualSettlementServiceAccess({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorType: ActorType.USER,
        english: false,
      }),
    ).rejects.toMatchObject({
      message: "贡献方登记、结算、program host 和参与者门户运营只保留给 Helm 自留经营工作区。",
    });

    await expect(
      assertWorkspaceReservedParticipantPortalServiceAccess({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).resolves.toBe(WorkspaceRole.ADMIN);

    await expect(
      assertWorkspaceReservedProgramApplicationServiceAccess({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).resolves.toBe(WorkspaceRole.ADMIN);
  });

  it("still enforces reserved ownership for system-triggered portal writes", async () => {
    dbMock.workspace.findUnique.mockResolvedValueOnce(null);

    await expect(
      assertWorkspaceReservedParticipantPortalServiceAccess({
        workspaceId: "workspace-1",
        userId: null,
        actorType: ActorType.SYSTEM,
        english: true,
      }),
    ).rejects.toMatchObject({
      message: "Participant portal access stays anchored to the Helm reserved host workspace.",
    });

    expect(importGovernanceMock.getWorkspaceRoleForUser).not.toHaveBeenCalled();
  });

  it("distinguishes governed-action manage, review, and policy service capabilities", async () => {
    importGovernanceMock.getWorkspaceRoleForUser
      .mockResolvedValueOnce(WorkspaceRole.OPERATOR)
      .mockResolvedValueOnce(WorkspaceRole.REVIEWER)
      .mockResolvedValueOnce(WorkspaceRole.REVIEWER);

    await expect(
      assertWorkspaceGovernedActionManagementServiceAccess({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).resolves.toBe(WorkspaceRole.OPERATOR);

    await expect(
      assertWorkspaceGovernedActionReviewServiceAccess({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorType: ActorType.USER,
        english: false,
      }),
    ).resolves.toBe(WorkspaceRole.REVIEWER);

    await expect(
      assertWorkspacePolicyServiceAccess({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toMatchObject({
      message: "Only owner or admin can change workspace governance controls",
    });
  });

  it("bypasses service governance for system-initiated flows", async () => {
    await expect(
      assertWorkspaceBillingServiceAccess({
        workspaceId: "workspace-1",
        userId: null,
        actorType: ActorType.SYSTEM,
        english: true,
      }),
    ).resolves.toBeNull();

    expect(importGovernanceMock.getWorkspaceRoleForUser).not.toHaveBeenCalled();
  });

  it("exposes a stable error classifier", async () => {
    await expect(
      assertWorkspaceBillingServiceAccess({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toSatisfy((error: unknown) => isWorkspaceServiceGovernanceError(error));
  });
});
