import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceGovernanceMock } = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceBillingServiceAccess: vi.fn(),
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceBillingServiceAccess: serviceGovernanceMock.assertWorkspaceBillingServiceAccess,
}));

import {
  createWorkspaceBillingPortalSession,
  createWorkspaceCheckoutSession,
  syncWorkspacePaymentStatus,
  syncWorkspacePaymentStatusFromCallbackEvent,
} from "@/lib/billing/integration";

describe("billing integration service governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.HELM_FINANCIAL_ACTIONS_ENABLED;
  });

  it("stops hosted billing operations before service or provider access", async () => {
    process.env.HELM_FINANCIAL_ACTIONS_ENABLED = "false";
    serviceGovernanceMock.assertWorkspaceBillingServiceAccess.mockRejectedValue(
      new Error("unexpected_service_access"),
    );

    await expect(
      createWorkspaceCheckoutSession({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorName: "Billing owner",
        fallbackEmail: "owner@example.com",
        locale: "en-US",
      }),
    ).rejects.toThrow("deployment_capability_disabled:financial_action");
    await expect(
      createWorkspaceBillingPortalSession({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorName: "Billing owner",
        english: true,
      }),
    ).rejects.toThrow("deployment_capability_disabled:financial_action");
    await expect(
      syncWorkspacePaymentStatus({
        workspaceId: "workspace-1",
        actorName: "Billing owner",
        actorType: "USER",
        userId: "user-1",
        english: true,
      }),
    ).rejects.toThrow("deployment_capability_disabled:financial_action");

    expect(serviceGovernanceMock.assertWorkspaceBillingServiceAccess).not.toHaveBeenCalled();
  });

  it("stops direct payment callback persistence before billing context access", async () => {
    process.env.HELM_FINANCIAL_ACTIONS_ENABLED = "false";

    await expect(
      syncWorkspacePaymentStatusFromCallbackEvent({
        workspaceId: "workspace-1",
        event: {
          provider: "ALIPAY",
          eventType: "PAYMENT_SUCCEEDED",
          checkoutSessionId: "order-1",
        },
      }),
    ).rejects.toThrow("deployment_capability_disabled:financial_action");

    expect(serviceGovernanceMock.assertWorkspaceBillingServiceAccess).not.toHaveBeenCalled();
  });

  it("re-checks checkout capability before creating a hosted checkout session", async () => {
    serviceGovernanceMock.assertWorkspaceBillingServiceAccess.mockRejectedValueOnce(
      new Error("Only owner or billing admin can start organization checkout"),
    );

    await expect(
      createWorkspaceCheckoutSession({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorName: "Billing owner",
        fallbackEmail: "owner@example.com",
        locale: "en-US",
      }),
    ).rejects.toThrow("Only owner or billing admin can start organization checkout");

    expect(serviceGovernanceMock.assertWorkspaceBillingServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: "USER",
      english: true,
      scope: "checkout",
    });
  });

  it("re-checks portal capability before opening billing portal", async () => {
    serviceGovernanceMock.assertWorkspaceBillingServiceAccess.mockRejectedValueOnce(
      new Error("Only owner or billing admin can open the billing portal"),
    );

    await expect(
      createWorkspaceBillingPortalSession({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorName: "Billing owner",
        english: true,
      }),
    ).rejects.toThrow("Only owner or billing admin can open the billing portal");
  });

  it("re-checks manual refresh capability before syncing billing state", async () => {
    serviceGovernanceMock.assertWorkspaceBillingServiceAccess.mockRejectedValueOnce(
      new Error("Only owner or billing admin can refresh billing status"),
    );

    await expect(
      syncWorkspacePaymentStatus({
        workspaceId: "workspace-1",
        actorName: "Billing owner",
        actorType: "USER",
        userId: "user-1",
        english: true,
      }),
    ).rejects.toThrow("Only owner or billing admin can refresh billing status");
  });
});
