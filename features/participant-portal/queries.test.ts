import { ParticipantPortalAccessStatus, RevenueBeneficiaryType, WorkspaceClass, WorkspaceStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashParticipantPortalToken } from "@/lib/auth/participant-portal";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    participantPortalAccess: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    beneficiaryPayoutProfile: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    revenueAttributionLedger: {
      findMany: vi.fn(),
    },
    payoutLedger: {
      findMany: vi.fn(),
    },
    settlementBatchLine: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  getParticipantPortalData,
  getParticipantPortalInvitePreview,
} from "@/features/participant-portal/queries";

describe("participant portal reserved host queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.beneficiaryPayoutProfile.findUnique.mockResolvedValue(null);
    dbMock.revenueAttributionLedger.findMany.mockResolvedValue([]);
    dbMock.payoutLedger.findMany.mockResolvedValue([]);
    dbMock.settlementBatchLine.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides invite previews that do not belong to the reserved host workspace", async () => {
    const token = "reserved-host-preview-token";

    dbMock.participantPortalAccess.findUnique.mockResolvedValue({
      id: "access-1",
        workspaceId: "workspace-1",
        beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
        beneficiaryReference: "publisher-1",
        lastInviteIssuedAt: new Date("2026-04-20T00:00:00.000Z"),
        status: ParticipantPortalAccessStatus.INVITED,
        workspace: {
          id: "workspace-1",
          status: WorkspaceStatus.ACTIVE,
        workspaceClass: WorkspaceClass.CUSTOMER,
        systemKey: null,
      },
    });

    await expect(getParticipantPortalInvitePreview(token)).resolves.toMatchObject({
      state: "invalid_host",
      inviteExpiresAt: null,
    });
    expect(dbMock.participantPortalAccess.findUnique).toHaveBeenCalledWith({
      where: { inviteTokenHash: hashParticipantPortalToken(token) },
      include: {
        workspace: true,
        workerPublisherProfile: true,
        salesReferral: true,
        customEngagement: true,
      },
    });
    expect(dbMock.beneficiaryPayoutProfile.findUnique).not.toHaveBeenCalled();
  });

  it("hides invite previews once the invite is no longer in invited posture", async () => {
    const token = "used-portal-token";

    dbMock.participantPortalAccess.findUnique.mockResolvedValue({
      id: "access-1",
      workspaceId: "workspace-reserved",
      beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
      beneficiaryReference: "publisher-1",
      lastInviteIssuedAt: new Date("2026-04-20T00:00:00.000Z"),
      status: ParticipantPortalAccessStatus.ACTIVE,
      workspace: {
        id: "workspace-reserved",
        status: WorkspaceStatus.ACTIVE,
        workspaceClass: WorkspaceClass.HELM_RESERVED,
        systemKey: "helm_reserved_primary",
      },
    });

    await expect(getParticipantPortalInvitePreview(token)).resolves.toMatchObject({
      state: "already_used",
      inviteExpiresAt: null,
    });
    expect(dbMock.beneficiaryPayoutProfile.findUnique).not.toHaveBeenCalled();
  });

  it("hides invite previews once the invite has expired", async () => {
    const token = "expired-portal-token";

    dbMock.participantPortalAccess.findUnique.mockResolvedValue({
      id: "access-1",
      workspaceId: "workspace-reserved",
      beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
      beneficiaryReference: "publisher-1",
      lastInviteIssuedAt: new Date("2026-04-01T00:00:00.000Z"),
      status: ParticipantPortalAccessStatus.INVITED,
      workspace: {
        id: "workspace-reserved",
        status: WorkspaceStatus.ACTIVE,
        workspaceClass: WorkspaceClass.HELM_RESERVED,
        systemKey: "helm_reserved_primary",
      },
    });

    await expect(getParticipantPortalInvitePreview(token)).resolves.toMatchObject({
      state: "expired",
    });
    expect(dbMock.beneficiaryPayoutProfile.findUnique).not.toHaveBeenCalled();
  });

  it("returns suspended state instead of reusing the generic inactive copy", async () => {
    const token = "suspended-portal-token";

    dbMock.participantPortalAccess.findUnique.mockResolvedValue({
      id: "access-1",
      workspaceId: "workspace-reserved",
      beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
      beneficiaryReference: "publisher-1",
      lastInviteIssuedAt: new Date("2026-04-20T00:00:00.000Z"),
      status: ParticipantPortalAccessStatus.SUSPENDED,
      workspace: {
        id: "workspace-reserved",
        status: WorkspaceStatus.ACTIVE,
        workspaceClass: WorkspaceClass.HELM_RESERVED,
        systemKey: "helm_reserved_primary",
      },
    });

    await expect(getParticipantPortalInvitePreview(token)).resolves.toMatchObject({
      state: "suspended",
      inviteExpiresAt: null,
    });
  });

  it("returns the invite expiry for usable reserved-host previews", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T00:00:00.000Z"));

    const token = "fresh-portal-token";

    dbMock.participantPortalAccess.findUnique.mockResolvedValue({
      id: "access-1",
      workspaceId: "workspace-reserved",
      beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
      beneficiaryReference: "publisher-1",
      lastInviteIssuedAt: new Date("2026-04-20T00:00:00.000Z"),
      status: ParticipantPortalAccessStatus.INVITED,
      workspace: {
        id: "workspace-reserved",
        status: WorkspaceStatus.ACTIVE,
        workspaceClass: WorkspaceClass.HELM_RESERVED,
        systemKey: "helm_reserved_primary",
      },
      workerPublisherProfile: null,
      salesReferral: null,
      customEngagement: null,
    });

    const result = await getParticipantPortalInvitePreview(token);

    expect(result?.state).toBe("usable");
    if (result.state !== "usable") {
      throw new Error("Expected a usable participant portal invite preview");
    }

    expect(result.inviteExpiresAt.toISOString()).toBe("2026-05-04T00:00:00.000Z");
  });

  it("filters participant portal data down to the reserved host workspace", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Portal User",
      email: "portal@example.com",
    });
    dbMock.participantPortalAccess.findMany.mockResolvedValue([
      {
        id: "access-customer",
        workspaceId: "workspace-customer",
        userId: "user-1",
        beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
        workerPublisherProfileId: "publisher-customer",
        salesReferralId: null,
        customEngagementId: null,
        beneficiaryReference: "publisher-customer",
        status: ParticipantPortalAccessStatus.ACTIVE,
        workspace: {
          id: "workspace-customer",
          name: "Customer workspace",
          defaultLocale: "zh-CN",
          status: WorkspaceStatus.ACTIVE,
          workspaceClass: WorkspaceClass.CUSTOMER,
          systemKey: null,
        },
      },
      {
        id: "access-reserved",
        workspaceId: "workspace-reserved",
        userId: "user-1",
        beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
        workerPublisherProfileId: "publisher-reserved",
        salesReferralId: null,
        customEngagementId: null,
        beneficiaryReference: "publisher-reserved",
        status: ParticipantPortalAccessStatus.ACTIVE,
        workspace: {
          id: "workspace-reserved",
          name: "Helm reserved workspace",
          defaultLocale: "zh-CN",
          status: WorkspaceStatus.ACTIVE,
          workspaceClass: WorkspaceClass.HELM_RESERVED,
          systemKey: "helm_reserved_primary",
        },
      },
    ]);

    const result = await getParticipantPortalData({ userId: "user-1" });

    expect(result?.accesses).toHaveLength(1);
    expect(result?.accesses[0]?.id).toBe("access-reserved");
    expect(result?.currentAccess?.id).toBe("access-reserved");
    expect(result?.currentAccess?.workspace.id).toBe("workspace-reserved");
    expect(dbMock.revenueAttributionLedger.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-reserved",
        workerPublisherProfileId: "publisher-reserved",
      },
      select: {
        id: true,
        sourceType: true,
        sourceLabel: true,
        sourceReference: true,
        grossAmountCents: true,
        attributedAmountCents: true,
        currency: true,
        status: true,
        recognizedAt: true,
        reversalReason: true,
      },
      orderBy: [{ recognizedAt: "desc" }, { createdAt: "desc" }],
    });
  });
});
