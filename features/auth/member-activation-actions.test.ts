import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), issue: vi.fn(), consume: vi.fn(), lock: vi.fn(), failed: vi.fn(), clear: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentWorkspaceSession: mocks.session }));
vi.mock("@/lib/auth/member-activation.service", () => ({ issueMemberActivation: mocks.issue, consumeMemberActivation: mocks.consume }));
vi.mock("@/lib/auth/login-rate-limit.service", () => ({ getLoginLockStatus: mocks.lock, recordFailedLogin: mocks.failed, clearFailedLogins: mocks.clear }));
import { issueMemberActivationAction, consumeMemberActivationAction } from "./member-activation-actions";
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("HELM_AUTH_MEMBER_ACTIVATION_ENABLED", "true"); mocks.session.mockResolvedValue({ user: { id: "actor" }, workspace: { id: "scope" }, authSessionId: "session" }); mocks.lock.mockResolvedValue({ locked: false }); mocks.issue.mockResolvedValue({ token: "synthetic", activationId: "id", expiresAt: "date" }); });
afterEach(() => vi.unstubAllEnvs());
describe("activation server action boundary", () => {
  it("derives authority from the session", async () => {
    expect((await issueMemberActivationAction({ membershipId: "member", password: "password9" })).ok).toBe(true);
    expect(mocks.issue).toHaveBeenCalledWith({ membershipId: "member", password: "password9", issuerUserId: "actor", issuerSessionId: "session", workspaceId: "scope" });
  });
  it("rejects caller-supplied authority", async () => {
    const forged = { membershipId: "member", password: "password9", workspaceId: "other" };
    expect((await issueMemberActivationAction(forged)).ok).toBe(false);
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("does not touch authentication or DB when issuance is disabled", async () => {
    vi.stubEnv("HELM_AUTH_MEMBER_ACTIVATION_ENABLED", "false");
    expect((await issueMemberActivationAction({ membershipId: "member", password: "password9" })).ok).toBe(false);
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("honors password retry lockout", async () => {
    mocks.lock.mockResolvedValue({ locked: true });
    expect((await issueMemberActivationAction({ membershipId: "member", password: "password9" })).ok).toBe(false);
    expect(mocks.issue).not.toHaveBeenCalled();
  });
  it("never returns service exception details", async () => {
    mocks.consume.mockRejectedValue(new Error("sensitive database diagnostics"));
    const result = await consumeMemberActivationAction({ token: "x".repeat(43), password: "password9" });
    expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain("diagnostics");
  });
});
