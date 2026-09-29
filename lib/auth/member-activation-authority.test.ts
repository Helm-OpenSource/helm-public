import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const context = { phase: "issue" as const, issuerWorkspaceId: "platform", issuerUserId: "actor", issuerSessionId: "session", targetWorkspaceId: "target", targetMembershipId: "member", targetUserId: "user" };
beforeEach(() => { vi.resetModules(); Reflect.deleteProperty(globalThis, Symbol.for("helm.member-activation-authority")); });
describe("controlled member activation authority", () => {
  it("fails closed without a registered verifier", async () => {
    const { authorizeMemberActivation } = await import("./member-activation-authority");
    await expect(authorizeMemberActivation({} as never, context)).rejects.toThrow();
  });
  it("passes the same transaction and exact immutable scope to the verifier", async () => {
    const { registerMemberActivationAuthority, authorizeMemberActivation } = await import("./member-activation-authority");
    const fn = vi.fn().mockResolvedValue({ bindingRef: "registration", bindingVersion: 2 });
    registerMemberActivationAuthority(fn);
    const tx = {} as never;
    expect(await authorizeMemberActivation(tx, context)).toEqual({ bindingRef: "registration", bindingVersion: 2 });
    expect(fn).toHaveBeenCalledWith(tx, context);
    expect(() => registerMemberActivationAuthority(vi.fn())).toThrow();
  });
  it.each([undefined, 123, null])("rejects a nonstring binding reference %s", async bindingRef => {
    const { registerMemberActivationAuthority, authorizeMemberActivation } = await import("./member-activation-authority");
    registerMemberActivationAuthority(vi.fn().mockResolvedValue({ bindingRef, bindingVersion: 1 }));
    await expect(authorizeMemberActivation({} as never, context)).rejects.toThrow();
  });
  it("rejects incomplete or invalid approval bindings", async () => {
    const { registerMemberActivationAuthority, authorizeMemberActivation } = await import("./member-activation-authority");
    registerMemberActivationAuthority(vi.fn().mockResolvedValue({ bindingRef: "", bindingVersion: 0 }));
    await expect(authorizeMemberActivation({} as never, context)).rejects.toThrow();
  });
});
describe("member activation authority failure codes", () => {
  // resetModules gives each test a fresh error module, so import it alongside the module under test.
  const load = async () => ({ ...(await import("./member-activation-authority")), ...(await import("./member-activation-error")) });
  it("tags an unregistered authority as authority_unavailable with the unchanged message", async () => {
    const { authorizeMemberActivation, MemberActivationError } = await load();
    const err = await authorizeMemberActivation({} as never, context).catch(e => e);
    expect(err instanceof MemberActivationError && err.code === "authority_unavailable").toBe(true);
    expect(err.message).toBe("Member activation unavailable");
  });
  it.each([null, { bindingRef: "", bindingVersion: 1 }, { bindingRef: "ok", bindingVersion: 0 }])("tags an invalid authority result %j as authority_result_invalid", async value => {
    const { registerMemberActivationAuthority, authorizeMemberActivation, MemberActivationError } = await load();
    registerMemberActivationAuthority(vi.fn().mockResolvedValue(value));
    const err = await authorizeMemberActivation({} as never, context).catch(e => e);
    expect(err instanceof MemberActivationError && err.code === "authority_result_invalid").toBe(true);
    expect(err.message).toBe("Member activation unavailable");
  });
  it("propagates the authorizer's own error unchanged, preserving its code", async () => {
    const { registerMemberActivationAuthority, authorizeMemberActivation, MemberActivationError } = await load();
    const own = Object.assign(new Error("binding required"), { code: "enterprise_binding_required" });
    registerMemberActivationAuthority(vi.fn().mockRejectedValue(own));
    const err = await authorizeMemberActivation({} as never, context).catch(e => e);
    expect(err).toBe(own);
    expect(err instanceof MemberActivationError).toBe(false);
    expect(err.code).toBe("enterprise_binding_required");
  });
});
