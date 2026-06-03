import { PaymentProvider } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  audit: {
    writeAuditLog: vi.fn(),
  },
  db: {
    workspace: {
      findUnique: vi.fn(),
    },
    billingAccount: {
      update: vi.fn(),
    },
  },
  foundation: {
    ensureWorkspaceCommercialFoundation: vi.fn(),
    getWorkspaceBillingSnapshot: vi.fn(),
    syncWorkspaceAccessState: vi.fn(),
  },
  serviceGovernance: {
    assertWorkspaceBillingServiceAccess: vi.fn(),
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.audit.writeAuditLog,
}));

vi.mock("@/lib/db", () => ({
  db: mocks.db,
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceBillingServiceAccess:
    mocks.serviceGovernance.assertWorkspaceBillingServiceAccess,
}));

vi.mock("@/lib/billing/foundation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/foundation")>();
  return {
    ...actual,
    ensureWorkspaceCommercialFoundation: mocks.foundation.ensureWorkspaceCommercialFoundation,
    getWorkspaceBillingSnapshot: mocks.foundation.getWorkspaceBillingSnapshot,
    syncWorkspaceAccessState: mocks.foundation.syncWorkspaceAccessState,
  };
});

import {
  createWorkspaceBillingPortalSession,
  createWorkspaceCheckoutSession,
} from "@/lib/billing/integration";

function mockWorkspace(
  defaultLocale: string,
  billingAccountOverrides: Record<string, unknown> = {},
) {
  mocks.db.workspace.findUnique.mockResolvedValue({
    id: "workspace-1",
    name: "Helm Demo Workspace",
    defaultLocale,
    billingAccount: {
      id: "billing-account-1",
      workspaceId: "workspace-1",
      paymentProvider: null,
      paymentCustomerId: null,
      paymentSubscriptionId: null,
      paymentSubscriptionStatus: null,
      currentPlan: "HELM_TEAM",
      baseFeeCents: 990000,
      activeSeatPriceCents: 99000,
      includedAdminSeats: 3,
      ...billingAccountOverrides,
    },
    trialState: {
      status: "TRIAL_ACTIVE",
    },
    memberships: [],
  });
}

describe("billing integration copy", () => {
  const envSnapshot = {
    APP_URL: process.env.APP_URL,
    STRIPE_HELM_ACTIVE_SEAT_PRICE_ID: process.env.STRIPE_HELM_ACTIVE_SEAT_PRICE_ID,
    STRIPE_HELM_TEAM_PRICE_ID: process.env.STRIPE_HELM_TEAM_PRICE_ID,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
    mocks.foundation.getWorkspaceBillingSnapshot.mockResolvedValue({
      accessState: "TRIAL_ACTIVE",
      activeSeatCount: 3,
    });
  });

  it("localizes unavailable payment-rail errors for Chinese workspaces", async () => {
    mockWorkspace("zh-CN");

    await expect(
      createWorkspaceCheckoutSession({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorName: "Billing owner",
        fallbackEmail: "owner@example.cn",
        locale: "zh-CN",
        paymentProvider: PaymentProvider.STRIPE,
      }),
    ).rejects.toThrow("当前组织不能使用所请求的支付通道");

    expect(mocks.serviceGovernance.assertWorkspaceBillingServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: "USER",
      english: false,
      scope: "checkout",
    });
    expect(mocks.audit.writeAuditLog).not.toHaveBeenCalled();
  });

  it("preserves unavailable payment-rail English copy for English workspaces", async () => {
    mockWorkspace("en-US");

    await expect(
      createWorkspaceCheckoutSession({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorName: "Billing owner",
        fallbackEmail: "owner@example.com",
        locale: "en-US",
        paymentProvider: PaymentProvider.ALIPAY,
      }),
    ).rejects.toThrow("This organization cannot use the requested payment rail");

    expect(mocks.serviceGovernance.assertWorkspaceBillingServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: "USER",
      english: true,
      scope: "checkout",
    });
    expect(mocks.audit.writeAuditLog).not.toHaveBeenCalled();
  });

  it("localizes billing portal missing-customer errors for Chinese workspaces", async () => {
    process.env.APP_URL = "https://helm.example.com";
    process.env.STRIPE_HELM_ACTIVE_SEAT_PRICE_ID = "price_seat";
    process.env.STRIPE_HELM_TEAM_PRICE_ID = "price_team";
    process.env.STRIPE_SECRET_KEY = "sk_test";
    mockWorkspace("zh-CN", {
      paymentProvider: PaymentProvider.STRIPE,
      paymentSubscriptionStatus: "active",
    });

    await expect(
      createWorkspaceBillingPortalSession({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorName: "Billing owner",
        english: false,
      }),
    ).rejects.toThrow("当前组织还没有可管理的付费客户，请先完成订阅购买。");

    expect(mocks.serviceGovernance.assertWorkspaceBillingServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: "USER",
      english: false,
      scope: "portal",
    });
    expect(mocks.audit.writeAuditLog).not.toHaveBeenCalled();
  });

  it("preserves billing portal missing-customer English copy for English workspaces", async () => {
    process.env.APP_URL = "https://helm.example.com";
    process.env.STRIPE_HELM_ACTIVE_SEAT_PRICE_ID = "price_seat";
    process.env.STRIPE_HELM_TEAM_PRICE_ID = "price_team";
    process.env.STRIPE_SECRET_KEY = "sk_test";
    mockWorkspace("en-US", {
      paymentProvider: PaymentProvider.STRIPE,
    });

    await expect(
      createWorkspaceBillingPortalSession({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorName: "Billing owner",
        english: true,
      }),
    ).rejects.toThrow(
      "This organization does not have a live billing customer yet. Start checkout first.",
    );

    expect(mocks.serviceGovernance.assertWorkspaceBillingServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: "USER",
      english: true,
      scope: "portal",
    });
    expect(mocks.audit.writeAuditLog).not.toHaveBeenCalled();
  });
});
