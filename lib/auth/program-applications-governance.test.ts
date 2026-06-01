import {
  PartnerProgramStatus,
  ProgramApplicationStatus,
  RevenueBeneficiaryType,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceGovernanceMock, dbMock } = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceReservedProgramApplicationServiceAccess: vi.fn(),
  },
  dbMock: {
    partnerProgram: {
      findFirst: vi.fn(),
    },
    programApplication: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceReservedProgramApplicationServiceAccess:
    serviceGovernanceMock.assertWorkspaceReservedProgramApplicationServiceAccess,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  recordProgramApplicationInvite,
  submitProgramApplicationRecord,
  updateProgramApplicationReviewRecord,
} from "@/lib/auth/program-applications";

describe("program application governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-checks reserved program-application access before review writes", async () => {
    serviceGovernanceMock.assertWorkspaceReservedProgramApplicationServiceAccess.mockRejectedValueOnce(
      new Error("Program application review and invite issuance stay reserved for the Helm internal operating workspace."),
    );

    await expect(
      updateProgramApplicationReviewRecord({
        workspaceId: "workspace-1",
        applicationId: "application-1",
        status: ProgramApplicationStatus.ACCEPTED,
        reviewedAt: new Date("2026-04-20T00:00:00.000Z"),
        reviewedByUserId: "user-1",
        governance: {
          userId: "user-1",
          actorType: "USER",
          english: true,
        },
      }),
    ).rejects.toThrow(
      "Program application review and invite issuance stay reserved for the Helm internal operating workspace.",
    );

    expect(dbMock.programApplication.create).not.toHaveBeenCalled();
  });

  it("re-checks reserved program host ownership before public submission writes", async () => {
    serviceGovernanceMock.assertWorkspaceReservedProgramApplicationServiceAccess.mockRejectedValueOnce(
      new Error("Program application review and invite issuance stay reserved for the Helm internal operating workspace."),
    );

    await expect(
      submitProgramApplicationRecord({
        workspaceId: "workspace-1",
        partnerProgramId: "program-1",
        programTermsVersionId: "terms-1",
        applicantName: "Applicant",
        applicantEmail: "applicant@example.com",
        termsAcceptedAt: new Date("2026-04-20T00:00:00.000Z"),
        governance: {
          english: true,
        },
      }),
    ).rejects.toThrow(
      "Program application review and invite issuance stay reserved for the Helm internal operating workspace.",
    );

    expect(dbMock.programApplication.update).not.toHaveBeenCalled();
  });

  it("re-checks reserved program-application access before invite writes", async () => {
    serviceGovernanceMock.assertWorkspaceReservedProgramApplicationServiceAccess.mockRejectedValueOnce(
      new Error("Program application review and invite issuance stay reserved for the Helm internal operating workspace."),
    );

    await expect(
      recordProgramApplicationInvite({
        workspaceId: "workspace-1",
        applicationId: "application-1",
        recommendedBeneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
        participantPortalAccessId: "access-1",
        invitedAt: new Date("2026-04-20T00:00:00.000Z"),
        reviewedByUserId: "user-1",
        governance: {
          userId: "user-1",
          actorType: "USER",
          english: true,
        },
      }),
    ).rejects.toThrow(
      "Program application review and invite issuance stay reserved for the Helm internal operating workspace.",
    );

    expect(dbMock.programApplication.update).not.toHaveBeenCalled();
  });

  it("blocks public submission when the program is paused", async () => {
    serviceGovernanceMock.assertWorkspaceReservedProgramApplicationServiceAccess.mockResolvedValueOnce(
      undefined,
    );
    dbMock.partnerProgram.findFirst.mockResolvedValueOnce({
      status: PartnerProgramStatus.PAUSED,
      termsVersions: [{ id: "terms-1" }],
    });

    await expect(
      submitProgramApplicationRecord({
        workspaceId: "workspace-1",
        partnerProgramId: "program-1",
        programTermsVersionId: "terms-1",
        applicantName: "Applicant",
        applicantEmail: "applicant@example.com",
        termsAcceptedAt: new Date("2026-04-20T00:00:00.000Z"),
        governance: {
          english: true,
        },
      }),
    ).rejects.toMatchObject({
      code: "PROGRAM_NOT_ACCEPTING_APPLICATIONS",
    });

    expect(dbMock.programApplication.create).not.toHaveBeenCalled();
  });

  it("blocks duplicate active applications inside the service seam", async () => {
    serviceGovernanceMock.assertWorkspaceReservedProgramApplicationServiceAccess.mockResolvedValueOnce(
      undefined,
    );
    dbMock.partnerProgram.findFirst.mockResolvedValueOnce({
      status: PartnerProgramStatus.ACTIVE,
      termsVersions: [{ id: "terms-1" }],
    });
    dbMock.programApplication.findFirst.mockResolvedValueOnce({
      id: "application-existing",
    });

    await expect(
      submitProgramApplicationRecord({
        workspaceId: "workspace-1",
        partnerProgramId: "program-1",
        programTermsVersionId: "terms-1",
        applicantName: "Applicant",
        applicantEmail: "Applicant@Example.com",
        termsAcceptedAt: new Date("2026-04-20T00:00:00.000Z"),
        governance: {
          english: true,
        },
      }),
    ).rejects.toMatchObject({
      code: "ACTIVE_APPLICATION_EXISTS",
    });

    expect(dbMock.programApplication.create).not.toHaveBeenCalled();
  });

  it("locks review writes after invited posture already exists", async () => {
    serviceGovernanceMock.assertWorkspaceReservedProgramApplicationServiceAccess.mockResolvedValueOnce(
      undefined,
    );
    dbMock.programApplication.findFirst.mockResolvedValueOnce({
      id: "application-1",
      status: ProgramApplicationStatus.INVITED,
      participantPortalAccessId: "access-1",
    });

    await expect(
      updateProgramApplicationReviewRecord({
        workspaceId: "workspace-1",
        applicationId: "application-1",
        status: ProgramApplicationStatus.ACCEPTED,
        reviewedAt: new Date("2026-04-20T00:00:00.000Z"),
        reviewedByUserId: "user-1",
        governance: {
          userId: "user-1",
          actorType: "USER",
          english: true,
        },
      }),
    ).rejects.toMatchObject({
      code: "REVIEW_WRITE_LOCKED_AFTER_INVITE",
    });

    expect(dbMock.programApplication.update).not.toHaveBeenCalled();
  });

  it("blocks invite writes before an application reaches accepted posture", async () => {
    serviceGovernanceMock.assertWorkspaceReservedProgramApplicationServiceAccess.mockResolvedValueOnce(
      undefined,
    );
    dbMock.programApplication.findFirst.mockResolvedValueOnce({
      id: "application-1",
      status: ProgramApplicationStatus.REJECTED,
    });

    await expect(
      recordProgramApplicationInvite({
        workspaceId: "workspace-1",
        applicationId: "application-1",
        recommendedBeneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
        participantPortalAccessId: "access-1",
        invitedAt: new Date("2026-04-20T00:00:00.000Z"),
        reviewedByUserId: "user-1",
        governance: {
          userId: "user-1",
          actorType: "USER",
          english: true,
        },
      }),
    ).rejects.toMatchObject({
      code: "INVITE_REQUIRES_ACCEPTED_OR_INVITED_APPLICATION",
    });

    expect(dbMock.programApplication.update).not.toHaveBeenCalled();
  });
});
