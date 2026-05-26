import { ParticipantPortalAccessStatus, RevenueBeneficiaryType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceGovernanceMock, dbMock } = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceReservedParticipantPortalServiceAccess: vi.fn(),
  },
  dbMock: {
    workerPublisherProfile: {
      findFirst: vi.fn(),
    },
    salesReferral: {
      findFirst: vi.fn(),
    },
    customEngagement: {
      findFirst: vi.fn(),
    },
    participantPortalAccess: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    beneficiaryPayoutProfile: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceReservedParticipantPortalServiceAccess:
    serviceGovernanceMock.assertWorkspaceReservedParticipantPortalServiceAccess,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  completeParticipantPortalOnboardingRecord,
  issueParticipantPortalInvite,
  updateParticipantPortalAccessStatusRecord,
  updateParticipantPortalProfileRecord,
} from "@/lib/auth/participant-portal-access";

describe("participant portal access governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-checks reserved participant-portal access before issuing invites", async () => {
    serviceGovernanceMock.assertWorkspaceReservedParticipantPortalServiceAccess.mockRejectedValueOnce(
      new Error("Participant portal access stays anchored to the Helm reserved host workspace."),
    );

    await expect(
      issueParticipantPortalInvite({
        workspaceId: "workspace-1",
        beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
        beneficiaryId: "beneficiary-1",
        inviteEmail: "portal@example.com",
        governance: {
          userId: "user-1",
          actorType: "USER",
          english: true,
        },
      }),
    ).rejects.toThrow("Participant portal access stays anchored to the Helm reserved host workspace.");

    expect(serviceGovernanceMock.assertWorkspaceReservedParticipantPortalServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: "USER",
      english: true,
    });
    expect(dbMock.workerPublisherProfile.findFirst).not.toHaveBeenCalled();
    expect(dbMock.participantPortalAccess.findUnique).not.toHaveBeenCalled();
    expect(dbMock.participantPortalAccess.create).not.toHaveBeenCalled();
  });

  it("re-checks reserved participant-portal access before updating access status", async () => {
    serviceGovernanceMock.assertWorkspaceReservedParticipantPortalServiceAccess.mockRejectedValueOnce(
      new Error("Participant portal access stays anchored to the Helm reserved host workspace."),
    );

    await expect(
      updateParticipantPortalAccessStatusRecord({
        workspaceId: "workspace-1",
        accessId: "access-1",
        status: ParticipantPortalAccessStatus.SUSPENDED,
        governance: {
          userId: "user-1",
          actorType: "USER",
          english: true,
        },
      }),
    ).rejects.toThrow("Participant portal access stays anchored to the Helm reserved host workspace.");

    expect(dbMock.participantPortalAccess.findFirst).not.toHaveBeenCalled();
    expect(dbMock.participantPortalAccess.update).not.toHaveBeenCalled();
  });

  it("re-checks reserved host ownership before onboarding writes", async () => {
    dbMock.participantPortalAccess.findUnique.mockResolvedValueOnce({
      id: "access-1",
      workspaceId: "workspace-1",
      workspace: { id: "workspace-1" },
      inviteEmail: "portal@example.com",
    });
    serviceGovernanceMock.assertWorkspaceReservedParticipantPortalServiceAccess.mockRejectedValueOnce(
      new Error("Participant portal access stays anchored to the Helm reserved host workspace."),
    );

    await expect(
      completeParticipantPortalOnboardingRecord({
        token: "valid-token-123456",
        displayName: "Portal User",
        payoutMethodLabel: "Bank transfer",
        invoiceRequired: false,
        english: true,
      }),
    ).rejects.toThrow("Participant portal access stays anchored to the Helm reserved host workspace.");

    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
    expect(dbMock.beneficiaryPayoutProfile.upsert).not.toHaveBeenCalled();
  });

  it("blocks onboarding writes once the invite is no longer usable", async () => {
    dbMock.participantPortalAccess.findUnique.mockResolvedValueOnce({
      id: "access-1",
      workspaceId: "workspace-1",
      workspace: {
        id: "workspace-1",
        workspaceClass: "HELM_RESERVED",
        systemKey: "helm_reserved_primary",
        status: "ACTIVE",
      },
      inviteEmail: "portal@example.com",
      lastInviteIssuedAt: new Date("2026-04-20T00:00:00.000Z"),
      status: ParticipantPortalAccessStatus.ACTIVE,
    });
    serviceGovernanceMock.assertWorkspaceReservedParticipantPortalServiceAccess.mockResolvedValueOnce(undefined);

    await expect(
      completeParticipantPortalOnboardingRecord({
        token: "valid-token-123456",
        displayName: "Portal User",
        payoutMethodLabel: "Bank transfer",
        invoiceRequired: false,
        english: true,
      }),
    ).rejects.toThrow("This portal invite is no longer active. Ask the Helm team to issue a new invite.");

    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
    expect(dbMock.beneficiaryPayoutProfile.upsert).not.toHaveBeenCalled();
  });

  it("re-checks reserved host ownership before participant self-profile writes", async () => {
    dbMock.participantPortalAccess.findFirst.mockResolvedValueOnce({
      id: "access-1",
      workspaceId: "workspace-1",
      workspace: { id: "workspace-1" },
      beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
      beneficiaryReference: "publisher-1",
      workerPublisherProfileId: "profile-1",
      salesReferralId: null,
      customEngagementId: null,
    });
    serviceGovernanceMock.assertWorkspaceReservedParticipantPortalServiceAccess.mockRejectedValueOnce(
      new Error("Participant portal access stays anchored to the Helm reserved host workspace."),
    );

    await expect(
      updateParticipantPortalProfileRecord({
        accessId: "access-1",
        currentUserId: "user-1",
        displayName: "Portal User",
        payoutMethodLabel: "Bank transfer",
        invoiceRequired: false,
        english: true,
      }),
    ).rejects.toThrow("Participant portal access stays anchored to the Helm reserved host workspace.");

    expect(dbMock.user.update).not.toHaveBeenCalled();
    expect(dbMock.beneficiaryPayoutProfile.upsert).not.toHaveBeenCalled();
  });

  it("blocks invite reissue once the participant portal access is already active", async () => {
    serviceGovernanceMock.assertWorkspaceReservedParticipantPortalServiceAccess.mockResolvedValueOnce(undefined);
    dbMock.workerPublisherProfile.findFirst.mockResolvedValueOnce({
      id: "beneficiary-1",
      publisherKey: "publisher-1",
      displayName: "Publisher One",
      contactEmail: "publisher@example.com",
    });
    dbMock.participantPortalAccess.findUnique.mockResolvedValueOnce({
      id: "access-1",
      status: ParticipantPortalAccessStatus.ACTIVE,
    });

    await expect(
      issueParticipantPortalInvite({
        workspaceId: "workspace-1",
        beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
        beneficiaryId: "beneficiary-1",
        inviteEmail: "portal@example.com",
        governance: {
          userId: "user-1",
          actorType: "USER",
          english: true,
        },
      }),
    ).rejects.toThrow(
      "This participant portal access is already active. Do not reissue an invite; use the existing portal access.",
    );

    expect(dbMock.participantPortalAccess.create).not.toHaveBeenCalled();
    expect(dbMock.participantPortalAccess.update).not.toHaveBeenCalled();
  });

  it("reopens archived access as a fresh invited-only portal invite", async () => {
    const issuedAt = new Date("2026-04-20T00:00:00.000Z");
    serviceGovernanceMock.assertWorkspaceReservedParticipantPortalServiceAccess.mockResolvedValueOnce(undefined);
    dbMock.workerPublisherProfile.findFirst.mockResolvedValueOnce({
      id: "beneficiary-1",
      publisherKey: "publisher-1",
      displayName: "Publisher One",
      contactEmail: "publisher@example.com",
    });
    dbMock.participantPortalAccess.findUnique.mockResolvedValueOnce({
      id: "access-1",
      status: ParticipantPortalAccessStatus.ARCHIVED,
      inviteEmail: "old@example.com",
    });
    dbMock.participantPortalAccess.update.mockResolvedValueOnce({
      id: "access-1",
      status: ParticipantPortalAccessStatus.INVITED,
      inviteEmail: "portal@example.com",
    });

    const result = await issueParticipantPortalInvite({
      workspaceId: "workspace-1",
      beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
      beneficiaryId: "beneficiary-1",
      inviteEmail: "portal@example.com",
      displayName: "Publisher One",
      notes: "Fresh invite after archive",
      now: issuedAt,
      governance: {
        userId: "user-1",
        actorType: "USER",
        english: true,
      },
    });

    expect(result.issuanceState).toBe("reissue_archived_access");
    expect(dbMock.participantPortalAccess.create).not.toHaveBeenCalled();
    expect(dbMock.participantPortalAccess.update).toHaveBeenCalledWith({
      where: { id: "access-1" },
      data: expect.objectContaining({
        status: ParticipantPortalAccessStatus.INVITED,
        inviteEmail: "portal@example.com",
        displayName: "Publisher One",
        notes: "Fresh invite after archive",
        userId: null,
        termsAcceptedAt: null,
        activatedAt: null,
        suspendedAt: null,
        archivedAt: null,
        lastInviteIssuedAt: issuedAt,
      }),
    });
  });
});
