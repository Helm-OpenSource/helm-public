import { describe, expect, it } from "vitest";
import { assertActivationTarget, assertActivationIssuer, activationTokenDigest, requireMemberActivationEnabled } from "./member-activation-policy";
import { MemberActivationError } from "./member-activation-error";
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
describe("member activation policy failure codes", () => {
  const codeOf = (fn: () => unknown) => { try { fn(); } catch (e) { expect(e).toBeInstanceOf(MemberActivationError); expect((e as Error).message).toBe("Member activation unavailable"); return (e as MemberActivationError).code; } throw new Error("expected a throw"); };
  it("names the failing target clause", () => {
    expect(codeOf(() => assertActivationTarget(null, null, [], "w1"))).toBe("target_membership_invalid");
    expect(codeOf(() => assertActivationTarget(target, null, [target], "w2"))).toBe("target_membership_invalid");
    expect(codeOf(() => assertActivationTarget(target, null, [target, { ...target, id: "m2", workspaceId: "w2" }], "w1"))).toBe("target_membership_invalid");
    expect(codeOf(() => assertActivationTarget(target, "hash", [target], "w1"))).toBe("target_already_activated");
  });
  it("names issuer, token-format and disabled failures", () => {
    expect(codeOf(() => assertActivationIssuer({ role: "MEMBER", status: "ACTIVE", workspaceId: "w1" }, "PASSWORD", "ACTIVE", "w1"))).toBe("issuer_membership_invalid");
    expect(codeOf(() => activationTokenDigest("short"))).toBe("token_invalid");
    const prior = process.env.HELM_AUTH_MEMBER_ACTIVATION_ENABLED;
    process.env.HELM_AUTH_MEMBER_ACTIVATION_ENABLED = "false";
    try { expect(codeOf(() => requireMemberActivationEnabled())).toBe("activation_disabled"); }
    finally { if (prior === undefined) delete process.env.HELM_AUTH_MEMBER_ACTIVATION_ENABLED; else process.env.HELM_AUTH_MEMBER_ACTIVATION_ENABLED = prior; }
  });
});
