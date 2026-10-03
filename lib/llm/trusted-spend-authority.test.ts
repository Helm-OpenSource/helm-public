import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalAuthorityJson, readSignedAuthority, computeMaximumCharge, monthAt } from "./trusted-spend-authority";

const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const envelope = { schema: "helm.spend-authority/v1", workspaceId: "synthetic-workspace", ref: "period:one", kind: "period", version: "v1", issuerGrantId: "issuer:one", approverId: "synthetic-owner", status: "approved", sourceReceiptHash: `sha256:${"a".repeat(64)}`, issuedAt: "2026-01-01T00:00:00.000Z", validFrom: "2026-01-01T00:00:00.000Z", validUntil: "2027-01-01T00:00:00.000Z", payload: { algorithm: "calendar-month-v1", timezone: "Asia/Shanghai" } };
const signed = (value: unknown) => { const json = canonicalAuthorityJson(value); return { json, signature: sign(null, Buffer.from(json), keys.privateKey).toString("base64") }; };
const price = { billing: "input-output-only-v1", provider: "synthetic", model: "synthetic-model", sku: "text-only", currency: "CNY", input: { numerator: "1", denominator: "3", ceiling: "100" }, output: { numerator: "2", denominator: "3", ceiling: "50" } };

describe("signed immutable spend metadata contracts", () => {
  it("requires key verification and preserves signed identity in exact canonical bytes", () => {
    const s = signed(envelope);
    expect(readSignedAuthority(s.json, s.signature, publicKey)).toEqual(envelope);
    expect(() => readSignedAuthority(s.json + " ", s.signature, publicKey)).toThrow();
    expect(() => readSignedAuthority(s.json, s.signature, generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString())).toThrow();
    expect(() => readSignedAuthority(JSON.stringify({ ...envelope, injected: true }), s.signature, publicKey)).toThrow();
  });
  it("rejects signed unknown dimensions and non-integer FX, retaining conservative rounding", () => {
    expect(computeMaximumCharge(price, { numerator: "1", denominator: "7", from: "CNY", to: "USD" }, BigInt(3), BigInt(2))).toBe(BigInt(1));
    expect(() => computeMaximumCharge({ ...price, reasoning: true }, null, BigInt(1), BigInt(1))).toThrow();
    expect(() => computeMaximumCharge(price, { numerator: "0.14", denominator: "1", from: "CNY", to: "USD" }, BigInt(1), BigInt(1))).toThrow();
    expect(() => computeMaximumCharge(price, null, BigInt(1), BigInt(1))).toThrow();
    expect(() => computeMaximumCharge(price, { numerator: "1", denominator: "7", from: "CNY", to: "USD" }, BigInt(101), BigInt(1))).toThrow();
  });
  it.each(["\n", "\r\n"])("rejects terminal whitespace in signed references %j", (tail) => {
    const sample=signed({...envelope,ref:envelope.ref+tail});
    expect(()=>readSignedAuthority(sample.json,sample.signature,publicKey)).toThrow("ref_invalid");
  });
  it.each(["\n", "\r\n"])("rejects terminal whitespace in signed source digests %j", (tail) => {
    const sample=signed({...envelope,sourceReceiptHash:envelope.sourceReceiptHash+tail});
    expect(()=>readSignedAuthority(sample.json,sample.signature,publicKey)).toThrow("source_receipt_invalid");
  });
  it.each(["\n", "\r\n"])("rejects terminal whitespace in integer rate and FX %j", (tail) => {
    expect(()=>computeMaximumCharge({...price,input:{...price.input,numerator:"1"+tail}}, {from:"CNY",to:"USD",numerator:"1",denominator:"7"},BigInt(1),BigInt(1))).toThrow("integer_invalid");
    expect(()=>computeMaximumCharge(price, {from:"CNY",to:"USD",numerator:"1",denominator:"7"+tail},BigInt(1),BigInt(1))).toThrow("integer_invalid");
  });
  it("uses explicitly issued month policy across local midnight and DST", () => {
    expect(monthAt(new Date("2026-03-31T16:00:00.000Z"), "Asia/Shanghai")).toBe("2026-04");
    expect(monthAt(new Date("2026-03-08T07:00:00.000Z"), "America/New_York")).toBe("2026-03");
    expect(() => monthAt(new Date(), "untrusted-zone")).toThrow();
  });
});
