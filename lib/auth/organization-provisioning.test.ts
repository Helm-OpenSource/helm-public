import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ foundation: vi.fn(), audit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/billing/foundation", () => ({ ensureWorkspaceCommercialFoundation: mocks.foundation }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.audit }));
import { provisionInvitedOrganization } from "./organization-provisioning";
const input = { workspaceId: "new-workspace", name: "Synthetic company", slug: "synthetic-company", ownerEmail: "new@example.com", ownerName: "New owner", actorUserId: "operator", actorWorkspaceId: "platform", commandId: "command", evidenceRef: "evidence" };
const fixture = () => ({
  membership: { findUnique: vi.fn().mockResolvedValue({ status: "ACTIVE", role: "OWNER", workspace: { status: "ACTIVE" } }), create: vi.fn().mockResolvedValue({ id: "member" }) },
  workspace: { create: vi.fn().mockResolvedValue({ id: input.workspaceId }) },
  user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "new-user" }) },
});
beforeEach(() => vi.resetAllMocks());
describe("governed organization primitive", () => {
  it("uses the supplied transaction for foundation and audit, with an invited owner only", async () => {
    const tx = fixture();
    expect(await provisionInvitedOrganization(tx as never, input)).toEqual({ workspaceId: input.workspaceId, userId: "new-user", membershipId: "member" });
    expect(tx.membership.create).toHaveBeenCalledWith({ data: { workspaceId: input.workspaceId, userId: "new-user", role: "OWNER", status: "INVITED" } });
    expect(mocks.foundation).toHaveBeenCalledWith(input.workspaceId, expect.any(Date), tx);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "platform", actionType: "ORGANIZATION_PROVISIONED" }), { client: tx });
  });
  it("rejects existing email without workspace writes", async () => {
    const tx = fixture(); tx.user.findUnique.mockResolvedValue({ id: "existing" });
    await expect(provisionInvitedOrganization(tx as never, input)).rejects.toThrow();
    expect(tx.workspace.create).not.toHaveBeenCalled();
  });
  it("rejects nontransaction client and unprivileged actor", async () => {
    await expect(provisionInvitedOrganization({ $transaction: vi.fn() } as never, input)).rejects.toThrow();
    const tx = fixture(); tx.membership.findUnique.mockResolvedValue({ status: "ACTIVE", role: "MEMBER", workspace: { status: "ACTIVE" } });
    await expect(provisionInvitedOrganization(tx as never, input)).rejects.toThrow();
    expect(tx.workspace.create).not.toHaveBeenCalled();
  });
  it("propagates foundation and audit failures to the outer transaction", async () => {
    const tx = fixture(); mocks.foundation.mockRejectedValueOnce(new Error("foundation"));
    await expect(provisionInvitedOrganization(tx as never, input)).rejects.toThrow("foundation");
    mocks.audit.mockRejectedValueOnce(new Error("audit"));
    await expect(provisionInvitedOrganization(tx as never, input)).rejects.toThrow("audit");
  });
});
