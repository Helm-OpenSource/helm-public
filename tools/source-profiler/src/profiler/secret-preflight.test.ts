import { describe, it, expect } from "vitest";
import { isSecretFilename, scanContentForSecrets } from "./secret-preflight";

describe("isSecretFilename", () => {
  it("flags env files and key material by name", () => {
    expect(isSecretFilename("app/.env")).toBe(true);
    expect(isSecretFilename("config/.env.production")).toBe(true);
    expect(isSecretFilename("certs/server.pem")).toBe(true);
    expect(isSecretFilename("src/index.ts")).toBe(false);
  });
});

describe("scanContentForSecrets", () => {
  it("detects an assigned secret literal", () => {
    const findings = scanContentForSecrets('const apiKey = "abcd1234efgh5678";');
    expect(findings.map((f) => f.rule)).toContain("assigned_secret");
  });

  it("detects a url-embedded credential and connection string", () => {
    // Assembled from fragments so the committed source contains no contiguous
    // credential literal (which the public-release guard would flag); the
    // runtime value is still a full credential string under test.
    const pgUrl = ["postgres", "://", "user", ":", "pw0", "@db.example/app"].join("");
    const httpUrl = ["https", "://", "u", ":", "pw1", "@host/x"].join("");
    const findings = scanContentForSecrets(`DB=${pgUrl}\nX=${httpUrl}`);
    const rules = findings.map((f) => f.rule);
    expect(rules).toContain("connection_string");
    expect(rules).toContain("url_embedded_credential");
  });

  it("returns no findings for clean structural code", () => {
    const findings = scanContentForSecrets(
      "export type Deal = { id: number; amount: number; stage: string };",
    );
    expect(findings).toHaveLength(0);
  });

  it("honors extra patterns", () => {
    const findings = scanContentForSecrets("INTERNAL_MARKER_XYZ", {
      extraPatterns: ["INTERNAL_MARKER_[A-Z]+"],
    });
    expect(findings.some((f) => f.rule.startsWith("custom_"))).toBe(true);
  });
});
