import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  hasMissingIdentityFields,
  resolvePostLoginRedirectPath,
  shouldRequireFirstLoginIdentityCompletion,
} from "@/lib/auth/first-login-identity-completion";

describe("first-login identity completion", () => {
  it("requires completion only on first login when password or identity fields are missing", () => {
    expect(
      shouldRequireFirstLoginIdentityCompletion({
        email: "member@example.com",
        phone: "+8613800000000",
        passwordHash: "hashed",
        lastLoginAt: null,
      }),
    ).toBe(false);

    expect(
      shouldRequireFirstLoginIdentityCompletion({
        email: "member@example.com",
        phone: null,
        passwordHash: "hashed",
        lastLoginAt: null,
      }),
    ).toBe(true);

    expect(
      shouldRequireFirstLoginIdentityCompletion({
        email: "member@example.com",
        phone: "+8613800000000",
        passwordHash: null,
        lastLoginAt: null,
      }),
    ).toBe(true);

    expect(
      shouldRequireFirstLoginIdentityCompletion({
        email: "member@example.com",
        phone: null,
        passwordHash: null,
        lastLoginAt: new Date("2026-05-07T00:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("detects identity gaps through normalized email/phone checks", () => {
    expect(
      hasMissingIdentityFields({
        email: "member@example.com",
        phone: "13800000000",
      }),
    ).toBe(false);
    expect(
      hasMissingIdentityFields({
        email: "member@example.com",
        phone: null,
      }),
    ).toBe(true);
  });

  it("keeps post-login redirect behavior aligned with setup/dashboard split", () => {
    expect(
      resolvePostLoginRedirectPath({
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
        workspace: {
          profileType: null,
          defaultLocale: "zh-CN",
          pilotMode: true,
          dataRetentionDays: 90,
          captureConsentRequired: true,
          featureFlagsJson: null,
          configuration: null,
        },
      }),
    ).toBe("/setup");

    expect(
      resolvePostLoginRedirectPath({
        role: WorkspaceRole.MEMBER,
        status: MembershipStatus.ACTIVE,
        workspace: {
          profileType: "销售负责人",
          defaultLocale: "zh-CN",
          pilotMode: true,
          dataRetentionDays: 90,
          captureConsentRequired: true,
          featureFlagsJson: null,
          configuration: null,
        },
      }),
    ).toBe("/dashboard");

    expect(
      resolvePostLoginRedirectPath({
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
        workspace: {
          profileType: null,
          defaultLocale: "zh-CN",
          pilotMode: true,
          dataRetentionDays: 90,
          captureConsentRequired: true,
          featureFlagsJson: null,
          configuration: JSON.stringify({ demoMode: "founder" }),
        },
      }),
    ).toBe("/dashboard");
  });
});
