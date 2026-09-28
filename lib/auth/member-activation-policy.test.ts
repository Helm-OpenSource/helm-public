import { describe, expect, it } from "vitest";
import { assertActivationTarget, assertActivationIssuer, activationTokenDigest } from "./member-activation-policy";
const target = { id: "m1", workspaceId: "w1", userId: "u1", status: "INVITED" };
describe("member activation scope", () => {
  it("admits an exclusive invited passwordless identity", () => expect(() => assertActivationTarget(target, null, [target], "w1")).not.toThrow());
  it.each(["INVITED", "ACTIVE"])("rejects another workspace %s identity", status => {
    expect(() => assertActivationTarget(target, null, [target, { ...target, id: "m2", workspaceId: "w2", status }], "w1")).toThrow();
  });
  it("rejects existing passwords, inactive and mismatched targets", () => {
    expect(() => assertActivationTarget(target, "hash", [target], "w1")).toThrow();
    expect(() => assertActivationTarget({ ...target, status: "INACTIVE" }, null, [target], "w1")).toThrow();
    expect(() => assertActivationTarget(target, null, [target], "w2")).toThrow();
  });
  it("requires active owner/admin and a current password session", () => {
    const issuer = { role: "OWNER", status: "ACTIVE", workspaceId: "w1" };
    expect(() => assertActivationIssuer(issuer, "PASSWORD", "ACTIVE", "w1")).not.toThrow();
    for (const provider of [null, "EMAIL_ENTRY", "PHONE_CODE"]) expect(() => assertActivationIssuer(issuer, provider, "ACTIVE", "w1")).toThrow();
    expect(() => assertActivationIssuer({ ...issuer, role: "MEMBER" }, "PASSWORD", "ACTIVE", "w1")).toThrow();
    expect(() => assertActivationIssuer({ ...issuer, status: "INACTIVE" }, "PASSWORD", "ACTIVE", "w1")).toThrow();
  });
  it("hashes only canonical high entropy token input", () => {
    const token = Buffer.alloc(32, 1).toString("base64url");
    expect(activationTokenDigest(token)).toMatch(/^[a-f0-9]{64}$/);
    for (const bad of ["", "short", token + "=", "x".repeat(44)]) expect(() => activationTokenDigest(bad)).toThrow();
  });
});
