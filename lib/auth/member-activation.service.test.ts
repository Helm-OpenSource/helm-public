import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const mocks = vi.hoisted(() => {
  const token = { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() };
  const tx = { $queryRaw: vi.fn(), authSession: { findUnique: vi.fn(), updateMany: vi.fn() }, membership: { findUnique: vi.fn() }, user: { findUnique: vi.fn(), updateMany: vi.fn() }, memberActivationToken: token };
  return { tx, db: { memberActivationToken: token, user: { findUnique: vi.fn() }, $transaction: vi.fn() }, authority: vi.fn(), audit: vi.fn(), hash: vi.fn(), verify: vi.fn() };
});
vi.mock("server-only", () => ({}));
vi.mock("./member-activation-authority", () => ({ authorizeMemberActivation: mocks.authority }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.audit }));
vi.mock("./formal-auth", () => ({ hashPassword: mocks.hash, verifyPassword: mocks.verify }));
import { consumeMemberActivation, issueMemberActivation } from "./member-activation.service";
import { MemberActivationError, type MemberActivationFailureCode } from "./member-activation-error";
const now = new Date("2026-01-01T00:00:00Z");
const rawToken = Buffer.alloc(32, 2).toString("base64url");
const member = () => ({ id: "m1", userId: "u1", workspaceId: "w1", status: "INVITED", updatedAt: now, user: { email: "member@example.com", passwordHash: null, memberships: [{ id: "m1", userId: "u1", workspaceId: "w1", status: "INVITED" }] } });
const row = () => ({ id: "t1", userId: "u1", membershipId: "m1", workspaceId: "w1", issuerWorkspaceId: "w1", authorityBindingRef: null, authorityBindingVersion: null, issuedByUserId: "admin", issuedBySessionId: "s1", membershipUpdatedAt: now, emailHash: createHash("sha256").update("member@example.com").digest("hex"), consumedAt: null, revokedAt: null, expiresAt: new Date(now.getTime()+60000) });
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
  it("rejects issuance when the caller approval snapshot changed before the transaction", async () => {
    vi.stubEnv("HELM_ORGANIZATION_CREATION_MODE", "governed");
    mocks.authority.mockResolvedValue({ bindingRef: "registration", bindingVersion: 3 });
    await expect(issueMemberActivation({ issuerUserId: "admin", issuerSessionId: "s1", workspaceId: "w1", membershipId: "m1", password: "adminPassword9", expectedAuthorityBinding: { bindingRef: "registration", bindingVersion: 2 } })).rejects.toThrow();
    expect(mocks.tx.memberActivationToken.create).not.toHaveBeenCalled();
    expect(mocks.tx.memberActivationToken.updateMany).not.toHaveBeenCalled();
  });
  it.each(["", "reference with spaces", "https://example.com/credential", "x".repeat(129), null, 123])("rejects malformed issuance evidence %s before DB reads", async evidenceRef => {
    await expect(issueMemberActivation({ issuerUserId: "admin", issuerSessionId: "s1", workspaceId: "w1", membershipId: "m1", password: "adminPassword9", evidenceRef: evidenceRef as never })).rejects.toThrow();
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
  it("records a bounded evidence reference in the issuance transaction audit", async () => {
    await issueMemberActivation({ issuerUserId: "admin", issuerSessionId: "s1", workspaceId: "w1", membershipId: "m1", password: "adminPassword9", evidenceRef: "review:approved-123" });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ actionType: "MEMBER_ACTIVATION_ISSUED", payload: expect.objectContaining({ evidenceRef: "review:approved-123" }) }), { client: mocks.tx });
  });
  it("propagates issuance audit failure to roll back the enclosing transaction", async () => {
    mocks.audit.mockRejectedValue(new Error("audit fault"));
    await expect(issueMemberActivation({ issuerUserId: "admin", issuerSessionId: "s1", workspaceId: "w1", membershipId: "m1", password: "adminPassword9", evidenceRef: "review:approved-123" })).rejects.toThrow("audit fault");
  });
  it("requires same-workspace approval in governed mode", async () => {
    vi.stubEnv("HELM_ORGANIZATION_CREATION_MODE", "governed");
    mocks.authority.mockResolvedValue({ bindingRef: "registration", bindingVersion: 2 });
    const result = await issueMemberActivation({ issuerUserId: "admin", issuerSessionId: "s1", workspaceId: "w1", membershipId: "m1", password: "adminPassword9" });
    expect(result.activationId).toBe("t2");
    expect(mocks.authority).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ phase: "issue", issuerWorkspaceId: "w1", targetWorkspaceId: "w1" }));
    // A legacy unbound token may not become an approved credential implicitly.
    await expect(consumeMemberActivation({ token: rawToken, password: "newPassword9" })).rejects.toThrow();
    expect(mocks.tx.user.updateMany).not.toHaveBeenCalled();
  });
  it.each(["approved", "revoked", "changedBinding"])("rechecks cross-workspace authority for %s", async mode => {
    const value = { ...row(), issuerWorkspaceId: "platform", authorityBindingRef: "registration", authorityBindingVersion: BigInt(2) };
    mocks.tx.memberActivationToken.findUnique.mockResolvedValue(value);
    mocks.tx.authSession.findUnique.mockResolvedValue({ userId: "admin", activeWorkspaceId: "platform", providerType: "PASSWORD", revokedAt: null, expiresAt: new Date(now.getTime()+60000) });
    mocks.tx.membership.findUnique.mockImplementation(async args => args.where.id ? member() : { role: "OWNER", status: "ACTIVE", workspaceId: "platform", workspace: { status: "ACTIVE" } });
    if (mode === "revoked") mocks.authority.mockRejectedValue(new Error("revoked"));
    else mocks.authority.mockResolvedValue({ bindingRef: "registration", bindingVersion: mode === "changedBinding" ? 3 : 2 });
    const result = consumeMemberActivation({ token: rawToken, password: "newPassword9" });
    if (mode === "approved") await expect(result).resolves.toEqual({ ok: true });
    else { await expect(result).rejects.toThrow(); expect(mocks.tx.user.updateMany).not.toHaveBeenCalled(); }
    expect(mocks.authority).toHaveBeenCalledWith(mocks.tx, { phase: "consume", issuerWorkspaceId: "platform", issuerUserId: "admin", issuerSessionId: "s1", targetWorkspaceId: "w1", targetMembershipId: "m1", targetUserId: "u1" });
  });
  it("is disabled by default before any lookup", async () => {
    vi.stubEnv("HELM_AUTH_MEMBER_ACTIVATION_ENABLED", "false");
    await expect(consumeMemberActivation({ token: rawToken, password: "newPassword9" })).rejects.toThrow();
    expect(mocks.tx.memberActivationToken.findUnique).not.toHaveBeenCalled();
  });
});
describe("first-password activation failure codes", () => {
  const issueInput = { issuerUserId: "admin", issuerSessionId: "s1", workspaceId: "w1", membershipId: "m1", password: "adminPassword9" };
  const expectCode = async (promise: Promise<unknown>, code: MemberActivationFailureCode) => {
    const err = await promise.then(() => { throw new Error("expected rejection"); }, (e: unknown) => e);
    expect(err instanceof MemberActivationError && err.code === code).toBe(true);
    expect((err as Error).message).toBe("Member activation unavailable");
  };
  const governedCrossWorkspace = () => {
    mocks.tx.memberActivationToken.findUnique.mockResolvedValue({ ...row(), issuerWorkspaceId: "platform", authorityBindingRef: "registration", authorityBindingVersion: BigInt(2) });
    mocks.tx.authSession.findUnique.mockResolvedValue({ userId: "admin", activeWorkspaceId: "platform", providerType: "PASSWORD", revokedAt: null, expiresAt: new Date(now.getTime()+60000) });
    mocks.tx.membership.findUnique.mockImplementation(async (args: {where: {id?: string}}) => args.where.id ? member() : { role: "OWNER", status: "ACTIVE", workspaceId: "platform", workspace: { status: "ACTIVE" } });
  };
  it("activation_disabled", async () => { vi.stubEnv("HELM_AUTH_MEMBER_ACTIVATION_ENABLED", "false"); await expectCode(issueMemberActivation(issueInput), "activation_disabled"); });
  it("evidence_ref_invalid", async () => expectCode(issueMemberActivation({ ...issueInput, evidenceRef: "has spaces" }), "evidence_ref_invalid"));
  it("issuer_password_format", async () => expectCode(issueMemberActivation({ ...issueInput, password: "short" }), "issuer_password_format"));
  it("issuer_credential_missing", async () => { mocks.db.user.findUnique.mockResolvedValue({ passwordHash: null }); await expectCode(issueMemberActivation(issueInput), "issuer_credential_missing"); expect(mocks.verify).not.toHaveBeenCalled(); });
  it("issuer_password_mismatch", async () => { mocks.verify.mockReturnValue(false); await expectCode(issueMemberActivation(issueInput), "issuer_password_mismatch"); expect(mocks.db.$transaction).not.toHaveBeenCalled(); });
  it("clock_unavailable", async () => { mocks.tx.$queryRaw.mockResolvedValue([{ now: "not-a-date" }]); await expectCode(issueMemberActivation(issueInput), "clock_unavailable"); });
  it("issuer_session_invalid", async () => { mocks.tx.authSession.findUnique.mockResolvedValue(null); await expectCode(issueMemberActivation(issueInput), "issuer_session_invalid"); });
  it("issuer_membership_invalid", async () => {
    mocks.tx.membership.findUnique.mockImplementation(async (args: {where: {id?: string}}) => args.where.id ? member() : { role: "MEMBER", status: "ACTIVE", workspaceId: "w1", workspace: { status: "ACTIVE" } });
    await expectCode(issueMemberActivation(issueInput), "issuer_membership_invalid");
  });
  it("issuer_changed", async () => { mocks.tx.user.findUnique.mockResolvedValue({ passwordHash: "rotated-admin-hash" }); await expectCode(issueMemberActivation(issueInput), "issuer_changed"); });
  it("target_membership_invalid", async () => {
    mocks.tx.membership.findUnique.mockImplementation(async (args: {where: {id?: string}}) => args.where.id ? null : { role: "OWNER", status: "ACTIVE", workspaceId: "w1", workspace: { status: "ACTIVE" } });
    await expectCode(issueMemberActivation(issueInput), "target_membership_invalid");
  });
  it("target_already_activated", async () => {
    mocks.tx.membership.findUnique.mockImplementation(async (args: {where: {id?: string}}) => args.where.id ? { ...member(), user: { ...member().user, passwordSetAt: now } } : { role: "OWNER", status: "ACTIVE", workspaceId: "w1", workspace: { status: "ACTIVE" } });
    await expectCode(issueMemberActivation(issueInput), "target_already_activated");
  });
  it("authority_binding_mismatch on issue", async () => {
    vi.stubEnv("HELM_ORGANIZATION_CREATION_MODE", "governed");
    mocks.authority.mockResolvedValue({ bindingRef: "registration", bindingVersion: 3 });
    await expectCode(issueMemberActivation({ ...issueInput, expectedAuthorityBinding: { bindingRef: "registration", bindingVersion: 2 } }), "authority_binding_mismatch");
  });
  it("authority_binding_mismatch on consume (changed binding and legacy-unbound token)", async () => {
    governedCrossWorkspace();
    mocks.authority.mockResolvedValue({ bindingRef: "registration", bindingVersion: 3 });
    await expectCode(consumeMemberActivation({ token: rawToken, password: "newPassword9" }), "authority_binding_mismatch");
    mocks.tx.memberActivationToken.findUnique.mockResolvedValue({ ...row(), authorityBindingVersion: BigInt(2) });
    mocks.tx.authSession.findUnique.mockResolvedValue({ userId: "admin", activeWorkspaceId: "w1", providerType: "PASSWORD", revokedAt: null, expiresAt: new Date(now.getTime()+60000) });
    mocks.tx.membership.findUnique.mockImplementation(async (args: {where: {id?: string}}) => args.where.id ? member() : { role: "OWNER", status: "ACTIVE", workspaceId: "w1", workspace: { status: "ACTIVE" } });
    await expectCode(consumeMemberActivation({ token: rawToken, password: "newPassword9" }), "authority_binding_mismatch");
    expect(mocks.tx.user.updateMany).not.toHaveBeenCalled();
  });
  it("passes an authorizer's own error through unchanged", async () => {
    governedCrossWorkspace();
    const own = Object.assign(new Error("binding required"), { code: "enterprise_binding_required" });
    mocks.authority.mockRejectedValue(own);
    await expect(consumeMemberActivation({ token: rawToken, password: "newPassword9" })).rejects.toBe(own);
  });
  it("password_policy", async () => expectCode(consumeMemberActivation({ token: rawToken, password: "lettersonly" }), "password_policy"));
  it("token_invalid (malformed and unknown)", async () => {
    await expectCode(consumeMemberActivation({ token: "short", password: "newPassword9" }), "token_invalid");
    mocks.tx.memberActivationToken.findUnique.mockResolvedValue(null);
    await expectCode(consumeMemberActivation({ token: rawToken, password: "newPassword9" }), "token_invalid");
    expect(mocks.hash).not.toHaveBeenCalled();
  });
  it("token_consumed", async () => { mocks.tx.memberActivationToken.findUnique.mockResolvedValue({ ...row(), consumedAt: now }); await expectCode(consumeMemberActivation({ token: rawToken, password: "newPassword9" }), "token_consumed"); });
  it("token_revoked", async () => { mocks.tx.memberActivationToken.findUnique.mockResolvedValue({ ...row(), revokedAt: now }); await expectCode(consumeMemberActivation({ token: rawToken, password: "newPassword9" }), "token_revoked"); });
  it("token_expired", async () => { mocks.tx.memberActivationToken.findUnique.mockResolvedValue({ ...row(), expiresAt: now }); await expectCode(consumeMemberActivation({ token: rawToken, password: "newPassword9" }), "token_expired"); });
  it("target_drifted", async () => { mocks.tx.memberActivationToken.findUnique.mockResolvedValue({ ...row(), emailHash: "wrong" }); await expectCode(consumeMemberActivation({ token: rawToken, password: "newPassword9" }), "target_drifted"); });
  it("claim_conflict (token claim and password write races)", async () => {
    mocks.tx.memberActivationToken.updateMany.mockResolvedValueOnce({ count: 0 });
    await expectCode(consumeMemberActivation({ token: rawToken, password: "newPassword9" }), "claim_conflict");
    mocks.tx.user.updateMany.mockResolvedValueOnce({ count: 0 });
    await expectCode(consumeMemberActivation({ token: rawToken, password: "newPassword9" }), "claim_conflict");
  });
});
