import { ActorType, WorkspaceClass, WorkspaceStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { billingFoundationMock, serviceGovernanceMock, dbMock } = vi.hoisted(() => ({
  billingFoundationMock: {
    ensureWorkspaceCommercialFoundation: vi.fn(),
  },
  serviceGovernanceMock: {
    assertWorkspaceReservedCommercialRegistryServiceAccess: vi.fn(),
  },
  dbMock: {
    workspace: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    workerPublisherProfile: {
      upsert: vi.fn(),
    },
    revenueRule: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    revenueAttributionLedger: {
      findUnique: vi.fn(),
    },
    partnerProgram: {
      upsert: vi.fn(),
    },
    programTermsVersion: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/billing/foundation", () => ({
  BILLING_CURRENCY: "usd",
  ensureWorkspaceCommercialFoundation: billingFoundationMock.ensureWorkspaceCommercialFoundation,
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceReservedCommercialRegistryServiceAccess:
    serviceGovernanceMock.assertWorkspaceReservedCommercialRegistryServiceAccess,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  ensureWorkspaceRevenueAttributionFoundation,
  getWorkspaceRevenueAttributionSnapshot,
  recordRevenueAttribution,
  reverseRevenueAttributionEntry,
} from "@/lib/billing/revenue-attribution";
import {
  ensureWorkspaceProgramCatalogFoundation,
  resolveProgramCatalogWorkspace,
} from "@/lib/billing/program-catalog";

describe("billing foundation service governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceGovernanceMock.assertWorkspaceReservedCommercialRegistryServiceAccess.mockResolvedValue("ADMIN");
    billingFoundationMock.ensureWorkspaceCommercialFoundation.mockResolvedValue(undefined);
    dbMock.workspace.findMany.mockResolvedValue([]);
    dbMock.workspace.findUnique.mockResolvedValue(null);
    dbMock.workerPublisherProfile.upsert.mockResolvedValue({ id: "publisher-1" });
    dbMock.revenueRule.upsert.mockResolvedValue({});
    dbMock.revenueRule.findMany.mockResolvedValue([]);
    dbMock.revenueRule.findFirst.mockResolvedValue({
      id: "rule-1",
      status: "ACTIVE",
      valueType: "FIXED_PERCENT",
      percentBps: 10_000,
      fixedAmountCents: null,
      currency: "usd",
      reverseOnCancel: true,
      workerPublisherProfileId: null,
      salesReferralId: null,
      customEngagementId: null,
      beneficiaryType: "PLATFORM",
      beneficiaryLabel: "Helm platform",
      sourceType: "ORGANIZATION_BASE_FEE",
    });
    dbMock.revenueAttributionLedger.findUnique.mockResolvedValue({
      id: "attr-1",
      workspaceId: "workspace-1",
      status: "PENDING",
      revenueRuleId: "rule-1",
      sourceType: "ORGANIZATION_BASE_FEE",
      beneficiaryType: "PLATFORM",
      sourceLabel: "Revenue line",
      sourceReference: null,
      beneficiaryLabel: "Helm platform",
      grossAmountCents: 1000,
      attributedAmountCents: 1000,
      currency: "usd",
      metadata: null,
      workerPublisherProfileId: null,
      salesReferralId: null,
      customEngagementId: null,
      revenueRule: { reverseOnCancel: true },
      payoutEntry: null,
    });
    dbMock.partnerProgram.upsert.mockResolvedValue({ id: "program-1" });
    dbMock.programTermsVersion.upsert.mockResolvedValue({});
    dbMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
  });

  it("re-checks contribution-registry capability before revenue-attribution foundation writes", async () => {
    serviceGovernanceMock.assertWorkspaceReservedCommercialRegistryServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, billing admin or admin can manage contributor registry records"),
    );

    await expect(
      ensureWorkspaceRevenueAttributionFoundation("workspace-1", undefined, {
        userId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toThrow("Only owner, billing admin or admin can manage contributor registry records");

    expect(serviceGovernanceMock.assertWorkspaceReservedCommercialRegistryServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: ActorType.USER,
      english: true,
    });
    expect(billingFoundationMock.ensureWorkspaceCommercialFoundation).not.toHaveBeenCalled();
    expect(dbMock.workerPublisherProfile.upsert).not.toHaveBeenCalled();
  });

  it("threads contribution-registry governance through revenue-attribution snapshot bootstrapping", async () => {
    serviceGovernanceMock.assertWorkspaceReservedCommercialRegistryServiceAccess.mockRejectedValueOnce(
      new Error("只有 owner、计费管理员或管理员可以管理贡献方登记记录"),
    );

    await expect(
      getWorkspaceRevenueAttributionSnapshot("workspace-1", {
        userId: "user-1",
        actorType: ActorType.USER,
        english: false,
      }),
    ).rejects.toThrow("只有 owner、计费管理员或管理员可以管理贡献方登记记录");

    expect(dbMock.workerPublisherProfile.upsert).not.toHaveBeenCalled();
  });

  it("re-checks contribution-registry capability before program-catalog foundation writes", async () => {
    serviceGovernanceMock.assertWorkspaceReservedCommercialRegistryServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, billing admin or admin can manage contributor registry records"),
    );

    await expect(
      ensureWorkspaceProgramCatalogFoundation("workspace-1", undefined, {
        userId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toThrow("Only owner, billing admin or admin can manage contributor registry records");

    expect(dbMock.partnerProgram.upsert).not.toHaveBeenCalled();
    expect(dbMock.programTermsVersion.upsert).not.toHaveBeenCalled();
  });

  it("keeps bootstrap foundations available for non-user flows", async () => {
    await ensureWorkspaceRevenueAttributionFoundation("workspace-1");
    await ensureWorkspaceProgramCatalogFoundation("workspace-1");

    expect(serviceGovernanceMock.assertWorkspaceReservedCommercialRegistryServiceAccess).toHaveBeenNthCalledWith(1, {
      workspaceId: "workspace-1",
      userId: undefined,
      actorType: undefined,
      english: false,
    });
    expect(serviceGovernanceMock.assertWorkspaceReservedCommercialRegistryServiceAccess).toHaveBeenNthCalledWith(2, {
      workspaceId: "workspace-1",
      userId: undefined,
      actorType: undefined,
      english: false,
    });
    expect(billingFoundationMock.ensureWorkspaceCommercialFoundation).toHaveBeenCalledWith(
      "workspace-1",
      expect.any(Date),
    );
    expect(dbMock.workerPublisherProfile.upsert).toHaveBeenCalled();
    expect(dbMock.partnerProgram.upsert).toHaveBeenCalled();
  });

  it("re-checks contribution-registry capability before revenue attribution ledger writes", async () => {
    serviceGovernanceMock.assertWorkspaceReservedCommercialRegistryServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, billing admin or admin can manage contributor registry records"),
    );

    await expect(
      recordRevenueAttribution({
        workspaceId: "workspace-1",
        ruleKey: "platform_org_base_recurring_percent",
        sourceLabel: "checkout",
        grossAmountCents: 1200,
        governance: {
          userId: "user-1",
          actorType: ActorType.USER,
          english: true,
        },
      }),
    ).rejects.toThrow("Only owner, billing admin or admin can manage contributor registry records");

    expect(dbMock.revenueRule.findFirst).not.toHaveBeenCalled();
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("re-checks contribution-registry capability before revenue attribution reversal writes", async () => {
    serviceGovernanceMock.assertWorkspaceReservedCommercialRegistryServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, billing admin or admin can manage contributor registry records"),
    );

    await expect(
      reverseRevenueAttributionEntry({
        attributionId: "attr-1",
        reason: "reverse",
        governance: {
          userId: "user-1",
          actorType: ActorType.USER,
          english: true,
        },
      }),
    ).rejects.toThrow("Only owner, billing admin or admin can manage contributor registry records");

    expect(dbMock.revenueAttributionLedger.findUnique).toHaveBeenCalledWith({
      where: { id: "attr-1" },
      include: {
        revenueRule: true,
        payoutEntry: true,
      },
    });
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("keeps the public program catalog unavailable when no reserved host workspace exists", async () => {
    await expect(resolveProgramCatalogWorkspace()).resolves.toBeNull();

    expect(dbMock.partnerProgram.upsert).not.toHaveBeenCalled();
    expect(dbMock.programTermsVersion.upsert).not.toHaveBeenCalled();
  });

  it("bootstraps the public program catalog from the Helm reserved host workspace", async () => {
    dbMock.workspace.findUnique.mockResolvedValue({
      id: "workspace-1",
      name: "Helm founder demo",
      slug: "helm-founder-demo",
      status: WorkspaceStatus.ACTIVE,
      defaultLocale: "zh-CN",
      workspaceClass: WorkspaceClass.HELM_RESERVED,
      systemKey: "helm_reserved_primary",
    });

    await expect(resolveProgramCatalogWorkspace()).resolves.toMatchObject({
      id: "workspace-1",
      slug: "helm-founder-demo",
    });

    expect(dbMock.partnerProgram.upsert).toHaveBeenCalled();
    expect(dbMock.programTermsVersion.upsert).toHaveBeenCalled();
  });

  it("rejects mismatched system workspaces even if the system key exists", async () => {
    dbMock.workspace.findUnique.mockResolvedValue({
      id: "workspace-1",
      name: "Customer workspace",
      slug: "alpha",
      status: WorkspaceStatus.ACTIVE,
      defaultLocale: "zh-CN",
      workspaceClass: WorkspaceClass.CUSTOMER,
      systemKey: "helm_reserved_primary",
    });

    await expect(resolveProgramCatalogWorkspace()).resolves.toBeNull();

    expect(dbMock.partnerProgram.upsert).not.toHaveBeenCalled();
    expect(dbMock.programTermsVersion.upsert).not.toHaveBeenCalled();
  });
});
