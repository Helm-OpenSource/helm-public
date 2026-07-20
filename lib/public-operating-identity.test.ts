import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePublicOperatingIdentity } from "@/lib/public-operating-identity";

describe("resolvePublicOperatingIdentity", () => {
  it("keeps the public Core default tenant-neutral and unverified", () => {
    expect(resolvePublicOperatingIdentity({})).toEqual({
      productBrand: "Helm",
      operatorDisplayName: "Helm deployment operator",
      legalName: null,
      legalRegistrationVerified: false,
    });
  });

  it("accepts a deployment display name without presenting an unverified legal name", () => {
    expect(
      resolvePublicOperatingIdentity({
        HELM_PUBLIC_OPERATOR_DISPLAY_NAME: "  Example operator  ",
        HELM_PUBLIC_OPERATOR_LEGAL_NAME: "Example Operator Co., Ltd.",
        HELM_PUBLIC_OPERATOR_REGISTRATION_VERIFIED: "false",
      }),
    ).toEqual({
      productBrand: "Helm",
      operatorDisplayName: "Example operator",
      legalName: null,
      legalRegistrationVerified: false,
    });
  });

  it("exposes a legal name only after an exact verified declaration", () => {
    expect(
      resolvePublicOperatingIdentity({
        HELM_PUBLIC_OPERATOR_DISPLAY_NAME: "Example operator",
        HELM_PUBLIC_OPERATOR_LEGAL_NAME: "Example Operator Co., Ltd.",
        HELM_PUBLIC_OPERATOR_REGISTRATION_VERIFIED: "true",
      }),
    ).toEqual({
      productBrand: "Helm",
      operatorDisplayName: "Example operator",
      legalName: "Example Operator Co., Ltd.",
      legalRegistrationVerified: true,
    });
  });

  it("fails closed on ambiguous verification or a missing verified legal name", () => {
    expect(() =>
      resolvePublicOperatingIdentity({
        HELM_PUBLIC_OPERATOR_REGISTRATION_VERIFIED: "1",
      }),
    ).toThrow("HELM_PUBLIC_OPERATOR_REGISTRATION_VERIFIED must be true or false");

    expect(() =>
      resolvePublicOperatingIdentity({
        HELM_PUBLIC_OPERATOR_REGISTRATION_VERIFIED: " true ",
      }),
    ).toThrow("HELM_PUBLIC_OPERATOR_REGISTRATION_VERIFIED must be true or false");

    expect(() =>
      resolvePublicOperatingIdentity({
        HELM_PUBLIC_OPERATOR_REGISTRATION_VERIFIED: "true",
      }),
    ).toThrow("HELM_PUBLIC_OPERATOR_LEGAL_NAME is required");
  });

  it("bounds public identity values", () => {
    expect(() =>
      resolvePublicOperatingIdentity({
        HELM_PUBLIC_OPERATOR_DISPLAY_NAME: "x".repeat(121),
      }),
    ).toThrow("HELM_PUBLIC_OPERATOR_DISPLAY_NAME exceeds 120 characters");

    expect(() =>
      resolvePublicOperatingIdentity({
        HELM_PUBLIC_OPERATOR_LEGAL_NAME: "Example\nOperator Co., Ltd.",
      }),
    ).toThrow("HELM_PUBLIC_OPERATOR_LEGAL_NAME contains control characters");
  });
});

describe("public legal routes", () => {
  it("use the shared server-side operating identity and include a privacy route", () => {
    const termsPath = path.join(process.cwd(), "app/terms/page.tsx");
    const privacyPath = path.join(process.cwd(), "app/privacy/page.tsx");
    const serverAdapterPath = path.join(
      process.cwd(),
      "lib/public-operating-identity.server.ts",
    );

    expect(existsSync(privacyPath)).toBe(true);
    expect(existsSync(serverAdapterPath)).toBe(true);
    expect(readFileSync(serverAdapterPath, "utf8")).toContain('import "server-only"');

    for (const filePath of [termsPath, privacyPath]) {
      const source = readFileSync(filePath, "utf8");
      expect(source).toContain("getPublicOperatingIdentity");
      expect(source).not.toContain("process.env.HELM_PUBLIC_OPERATOR_");
    }
  });
});
