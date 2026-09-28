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
