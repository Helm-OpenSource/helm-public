import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { billingServiceGrantHash, billingServiceKeyFingerprint } from "./service-auth";
import { buildBillingServiceGrant, type GrantIssueInput, parseBillingServiceGrantArgs } from "./service-grant-issuance";

const pair = generateKeyPairSync("ed25519");
const publicPem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
const privatePem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const input = (patch: Partial<GrantIssueInput> = {}): GrantIssueInput => ({ grantId: "synthetic-grant-1", issuerRef: "synthetic-issuer",
  scopes: ["settle", "quote", "reserve", "release"], publicKeyText: publicPem, approvalRef: "approval:synthetic",
  createdBy: "operator:synthetic", validFrom: "2026-11-12T00:00:00.000Z", validUntil: "2027-11-12T00:00:00.000Z", ...patch });
const code = (fn: () => unknown) => { try { fn(); return "ok"; } catch (error) { return (error as { code?: string }).code; } };

describe("buildBillingServiceGrant", () => {
  it("builds the canonical row whose pin is the verifier's content hash", () => {
    const { row, pin } = buildBillingServiceGrant(input());
    expect(row.scopesJson).toBe('["quote","release","reserve","settle"]');
    expect(row.publicKeyPem).toBe(publicPem);
    expect(row.keyFingerprint).toBe(billingServiceKeyFingerprint(pair.publicKey));
    expect(row.contentHash).toBe(billingServiceGrantHash(row));
    expect(pin).toEqual({ "synthetic-grant-1": row.contentHash });
  });

  it("stores the re-exported PEM, so CRLF or surrounding blanks give the same row", () => {
    const messy = `\n  ${publicPem.replaceAll("\n", "\r\n")}\r\n`;
    expect(buildBillingServiceGrant(input({ publicKeyText: messy })).row).toEqual(buildBillingServiceGrant(input()).row);
  });

  it("refuses private keys, other key types and multi-block files before deriving anything", () => {
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ type: "spki", format: "pem" }).toString();
    for (const text of [privatePem, publicPem + privatePem, `${publicPem}-----END PRIVATE KEY-----\n`, privatePem + publicPem, rsa, publicPem + publicPem, "", "not a key",
      publicPem.replace("BEGIN PUBLIC KEY", "BEGIN PUBLIC KEYS")]) {
      expect(code(() => buildBillingServiceGrant(input({ publicKeyText: text })))).toBe("public_key_invalid");
    }
  });

  it("refuses ids, issuers, refs, scopes and instants the table or verifier would not accept", () => {
    for (const patch of [{ grantId: "ab" }, { grantId: "Upper-case" }, { issuerRef: "issuer a" }, { issuerRef: "issuer\n" },
      { approvalRef: "" }, { createdBy: " operator" }, { scopes: [] }, { scopes: ["quote", "quote"] }, { scopes: ["quote", "admin"] },
      { scopes: ["resolve-unknown", "settle"] }, { validFrom: "2026-11-12T00:00:00Z" }, { validFrom: "2026-11-12T00:00:00.000+08:00" },
      { validFrom: "2026-02-30T00:00:00.000Z" }, { validUntil: "2026-11-12T00:00:00.000Z" }, { validUntil: "2026-11-11T00:00:00.000Z" }]) {
      expect(code(() => buildBillingServiceGrant(input(patch)))).toBe("input_invalid");
    }
    expect(buildBillingServiceGrant(input({ scopes: ["resolve-unknown"] })).row.scopesJson).toBe('["resolve-unknown"]');
    expect(buildBillingServiceGrant(input({ scopes: ["quote", "balance-status"] })).row.scopesJson).toBe('["balance-status","quote"]');
  });
});

describe("parseBillingServiceGrantArgs", () => {
  const issue = ["issue", "--grant-id=g-1", "--issuer=i", "--scopes=quote,reserve", "--public-key-file=k.pem",
    "--approval-ref=a", "--created-by=c", "--valid-from=f", "--valid-until=u"];
  it("defaults to a dry run and needs --apply to write", () => {
    expect(parseBillingServiceGrantArgs(issue)).toMatchObject({ operation: "issue", apply: false, publicKeyFile: "k.pem",
      input: { scopes: ["quote", "reserve"] } });
    expect(parseBillingServiceGrantArgs([...issue, "--apply"]).apply).toBe(true);
    expect(parseBillingServiceGrantArgs(["revoke", "--grant-id=g-1", "--revoked-by=r"])).toEqual({ operation: "revoke",
      apply: false, grantId: "g-1", revokedBy: "r" });
  });
  it("refuses unknown operations, flags, missing values and a private-key flag", () => {
    for (const argv of [[], ["rotate"], issue.slice(0, -1), [...issue, "extra"], [...issue, "--private-key-file=k"],
      ["revoke", "--grant-id=g-1"], [...issue, "--revoked-by=r"]]) {
      expect(code(() => parseBillingServiceGrantArgs(argv))).toBe("usage");
    }
  });
});
