import { describe, expect, it } from "vitest";
import { ParticipantPortalAccessStatus, RevenueBeneficiaryType, WorkspaceRole } from "@prisma/client";
import {
  buildParticipantPortalInviteExpiresAt,
  beneficiarySupportsParticipantPortal,
  canManageParticipantPortal,
  generateParticipantPortalToken,
  hashParticipantPortalToken,
  isParticipantPortalInviteExpired,
  isParticipantPortalInviteUsable,
  resolvePreferredParticipantAccess,
} from "@/lib/auth/participant-portal";
import {
  getParticipantPortalInviteIssuanceDeniedMessage,
  resolveParticipantPortalInviteIssuanceState,
  resolveParticipantPortalInviteState,
} from "@/lib/auth/participant-portal-invite-state";

describe("participant portal helpers", () => {
  it("supports only beneficiary types intended for external participation", () => {
    expect(beneficiarySupportsParticipantPortal(RevenueBeneficiaryType.WORKER_PUBLISHER)).toBe(true);
    expect(beneficiarySupportsParticipantPortal(RevenueBeneficiaryType.SALES_REFERRAL)).toBe(true);
    expect(beneficiarySupportsParticipantPortal(RevenueBeneficiaryType.CUSTOM_SERVICES)).toBe(true);
    expect(beneficiarySupportsParticipantPortal(RevenueBeneficiaryType.PLATFORM)).toBe(false);
  });

  it("keeps participant portal management on narrow admin roles", () => {
    expect(canManageParticipantPortal(WorkspaceRole.OWNER)).toBe(true);
    expect(canManageParticipantPortal(WorkspaceRole.BILLING_ADMIN)).toBe(true);
    expect(canManageParticipantPortal(WorkspaceRole.ADMIN)).toBe(true);
    expect(canManageParticipantPortal(WorkspaceRole.MEMBER)).toBe(false);
  });

  it("generates stable token hashes and prefers active access", () => {
    const token = generateParticipantPortalToken();
    expect(token.length).toBeGreaterThan(20);
    expect(hashParticipantPortalToken(token)).toBe(hashParticipantPortalToken(token));

    const access = resolvePreferredParticipantAccess(
      [
        { id: "archived", status: ParticipantPortalAccessStatus.ARCHIVED },
        { id: "active", status: ParticipantPortalAccessStatus.ACTIVE },
        { id: "invited", status: ParticipantPortalAccessStatus.INVITED },
      ],
      undefined,
    );

    expect(access?.id).toBe("active");
  });

  it("expires invite tokens after the fixed invite window", () => {
    const issuedAt = new Date("2026-04-01T00:00:00.000Z");
    const expiresAt = buildParticipantPortalInviteExpiresAt(issuedAt);

    expect(expiresAt.toISOString()).toBe("2026-04-15T00:00:00.000Z");
    expect(
      isParticipantPortalInviteExpired({
        lastInviteIssuedAt: issuedAt,
        now: new Date("2026-04-14T23:59:59.000Z"),
      }),
    ).toBe(false);
    expect(
      isParticipantPortalInviteExpired({
        lastInviteIssuedAt: issuedAt,
        now: expiresAt,
      }),
    ).toBe(true);
  });

  it("treats only invited and unexpired accesses as usable invite tokens", () => {
    expect(
      isParticipantPortalInviteUsable({
        status: ParticipantPortalAccessStatus.INVITED,
        lastInviteIssuedAt: new Date("2026-04-10T00:00:00.000Z"),
        now: new Date("2026-04-20T00:00:00.000Z"),
      }),
    ).toBe(true);

    expect(
      isParticipantPortalInviteUsable({
        status: ParticipantPortalAccessStatus.ACTIVE,
        lastInviteIssuedAt: new Date("2026-04-10T00:00:00.000Z"),
        now: new Date("2026-04-20T00:00:00.000Z"),
      }),
    ).toBe(false);

    expect(
      isParticipantPortalInviteUsable({
        status: ParticipantPortalAccessStatus.INVITED,
        lastInviteIssuedAt: new Date("2026-04-01T00:00:00.000Z"),
        now: new Date("2026-04-20T00:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("resolves explicit invite states instead of folding every failure into null", () => {
    expect(
      resolveParticipantPortalInviteState({
        access: null,
        workspaceAllowed: false,
      }),
    ).toBe("not_found");

    expect(
      resolveParticipantPortalInviteState({
        access: {
          status: ParticipantPortalAccessStatus.INVITED,
          lastInviteIssuedAt: new Date("2026-04-10T00:00:00.000Z"),
        },
        workspaceAllowed: false,
      }),
    ).toBe("invalid_host");

    expect(
      resolveParticipantPortalInviteState({
        access: {
          status: ParticipantPortalAccessStatus.INVITED,
          lastInviteIssuedAt: new Date("2026-04-01T00:00:00.000Z"),
        },
        workspaceAllowed: true,
        now: new Date("2026-04-20T00:00:00.000Z"),
      }),
    ).toBe("expired");

    expect(
      resolveParticipantPortalInviteState({
        access: {
          status: ParticipantPortalAccessStatus.ACTIVE,
          lastInviteIssuedAt: new Date("2026-04-10T00:00:00.000Z"),
        },
        workspaceAllowed: true,
      }),
    ).toBe("already_used");

    expect(
      resolveParticipantPortalInviteState({
        access: {
          status: ParticipantPortalAccessStatus.SUSPENDED,
          lastInviteIssuedAt: new Date("2026-04-10T00:00:00.000Z"),
        },
        workspaceAllowed: true,
      }),
    ).toBe("suspended");

    expect(
      resolveParticipantPortalInviteState({
        access: {
          status: ParticipantPortalAccessStatus.ARCHIVED,
          lastInviteIssuedAt: new Date("2026-04-10T00:00:00.000Z"),
        },
        workspaceAllowed: true,
      }),
    ).toBe("archived");
  });

  it("keeps invite issuance semantics explicit for invited, archived, active, and suspended access", () => {
    expect(
      resolveParticipantPortalInviteIssuanceState({
        access: null,
      }),
    ).toBe("issue_fresh_access");

    expect(
      resolveParticipantPortalInviteIssuanceState({
        access: {
          status: ParticipantPortalAccessStatus.INVITED,
        },
      }),
    ).toBe("reissue_existing_invite");

    expect(
      resolveParticipantPortalInviteIssuanceState({
        access: {
          status: ParticipantPortalAccessStatus.ARCHIVED,
        },
      }),
    ).toBe("reissue_archived_access");

    expect(
      resolveParticipantPortalInviteIssuanceState({
        access: {
          status: ParticipantPortalAccessStatus.ACTIVE,
        },
      }),
    ).toBe("blocked_active_access");

    expect(
      resolveParticipantPortalInviteIssuanceState({
        access: {
          status: ParticipantPortalAccessStatus.SUSPENDED,
        },
      }),
    ).toBe("blocked_suspended_access");

    expect(
      getParticipantPortalInviteIssuanceDeniedMessage("blocked_active_access", true),
    ).toContain("already active");
    expect(
      getParticipantPortalInviteIssuanceDeniedMessage("blocked_suspended_access", false),
    ).toContain("已暂停");
  });
});
