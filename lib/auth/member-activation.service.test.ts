import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const mocks = vi.hoisted(() => {
  const token = { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() };
  const tx = { $queryRaw: vi.fn(), authSession: { findUnique: vi.fn(), updateMany: vi.fn() }, membership: { findUnique: vi.fn() }, user: { findUnique: vi.fn(), updateMany: vi.fn() }, memberActivationToken: token };
  return { tx, db: { memberActivationToken: token, user: { findUnique: vi.fn() }, $transaction: vi.fn() }, audit: vi.fn(), hash: vi.fn(), verify: vi.fn() };
});
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.audit }));
vi.mock("./formal-auth", () => ({ hashPassword: mocks.hash, verifyPassword: mocks.verify }));
import { consumeMemberActivation, issueMemberActivation } from "./member-activation.service";
const now = new Date("2026-01-01T00:00:00Z");
const rawToken = Buffer.alloc(32, 2).toString("base64url");
const member = () => ({ id: "m1", userId: "u1", workspaceId: "w1", status: "INVITED", updatedAt: now, user: { email: "member@example.com", passwordHash: null, memberships: [{ id: "m1", userId: "u1", workspaceId: "w1", status: "INVITED" }] } });
const row = () => ({ id: "t1", userId: "u1", membershipId: "m1", workspaceId: "w1", issuedByUserId: "admin", issuedBySessionId: "s1", membershipUpdatedAt: now, emailHash: createHash("sha256").update("member@example.com").digest("hex"), consumedAt: null, revokedAt: null, expiresAt: new Date(now.getTime()+60000) });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("HELM_AUTH_MEMBER_ACTIVATION_ENABLED", "true");
  mocks.db.$transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
  mocks.tx.$queryRaw.mockResolvedValue([{ now }]);
  mocks.tx.authSession.findUnique.mockResolvedValue({ userId: "admin", activeWorkspaceId: "w1", providerType: "PASSWORD", revokedAt: null, expiresAt: new Date(now.getTime()+60000) });
  mocks.tx.membership.findUnique.mockImplementation(async (args: {where: {id?: string}}) => args.where.id ? member() : { role: "OWNER", status: "ACTIVE", workspaceId: "w1", workspace: { status: "ACTIVE" } });
  mocks.tx.memberActivationToken.findUnique.mockImplementation(async () => row());
  mocks.tx.memberActivationToken.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.user.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.authSession.updateMany.mockResolvedValue({ count: 2 });
  mocks.hash.mockReturnValue("hashed-password"); mocks.verify.mockReturnValue(true);
  mocks.db.user.findUnique.mockResolvedValue({ passwordHash: "old-admin-hash" });
  mocks.tx.user.findUnique.mockResolvedValue({ passwordHash: "old-admin-hash" });
  mocks.tx.memberActivationToken.create.mockImplementation(async ({ data }) => ({ ...data, id: "t2" }));
});
afterEach(() => vi.unstubAllEnvs());
describe("first-password activation service", () => {
  it("writes password, token claim, global session revocation and audit in one serializable transaction", async () => {
    expect(await consumeMemberActivation({ token: rawToken, password: "newPassword9" })).toEqual({ ok: true });
    expect(mocks.db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.tx.authSession.updateMany).toHaveBeenCalledWith({ where: { userId: "u1", revokedAt: null }, data: { revokedAt: now } });
    expect(mocks.tx.user.updateMany.mock.calls[0][0].data).not.toHaveProperty("emailVerifiedAt");
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ actionType: "MEMBER_ACTIVATION_CONSUMED" }), { client: mocks.tx });
  });
  it.each(["expired", "consumed", "revoked", "changedMembership", "changedEmail", "issuerRevoked", "otherWorkspace"])("rejects %s before password write", async reason => {
    const value = row();
    if (reason === "expired") value.expiresAt = now;
    if (reason === "consumed") Object.assign(value, { consumedAt: now });
    if (reason === "revoked") Object.assign(value, { revokedAt: now });
    if (reason === "changedMembership") value.membershipUpdatedAt = new Date(0);
    if (reason === "changedEmail") value.emailHash = "wrong";
    mocks.tx.memberActivationToken.findUnique.mockResolvedValue(value);
    if (reason === "issuerRevoked") mocks.tx.authSession.findUnique.mockResolvedValue(null);
    if (reason === "otherWorkspace") mocks.tx.membership.findUnique.mockImplementation(async args => args.where.id ? { ...member(), user: { ...member().user, memberships: [...member().user.memberships, { id: "m2", userId: "u1", workspaceId: "w2", status: "INVITED" }] } } : { role: "OWNER", status: "ACTIVE", workspaceId: "w1", workspace: { status: "ACTIVE" } });
    await expect(consumeMemberActivation({ token: rawToken, password: "newPassword9" })).rejects.toThrow("unavailable");
    expect(mocks.tx.user.updateMany).not.toHaveBeenCalled();
  });
  it("rejects a concurrent consumed claim without changing password", async () => {
    mocks.tx.memberActivationToken.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(consumeMemberActivation({ token: rawToken, password: "newPassword9" })).rejects.toThrow();
    expect(mocks.tx.user.updateMany).not.toHaveBeenCalled();
  });
  it("propagates audit failure so the surrounding transaction must roll back", async () => {
    mocks.audit.mockRejectedValue(new Error("audit unavailable"));
    await expect(consumeMemberActivation({ token: rawToken, password: "newPassword9" })).rejects.toThrow();
  });
  it("issues only a hashed token and returns raw material once", async () => {
    const result = await issueMemberActivation({ issuerUserId: "admin", issuerSessionId: "s1", workspaceId: "w1", membershipId: "m1", password: "adminPassword9" });
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const persisted = JSON.stringify(mocks.tx.memberActivationToken.create.mock.calls);
    expect(persisted).not.toContain(result.token);
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(result.token);
  });
  it("is disabled by default before any lookup", async () => {
    vi.stubEnv("HELM_AUTH_MEMBER_ACTIVATION_ENABLED", "false");
    await expect(consumeMemberActivation({ token: rawToken, password: "newPassword9" })).rejects.toThrow();
    expect(mocks.tx.memberActivationToken.findUnique).not.toHaveBeenCalled();
  });
});
