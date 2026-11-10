import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { bindScope, createPayerAccount, resolvePayerForWorkspaceInTransaction, revokeBinding } from "./payer-accounts";

function member(workspaceId: string, role = "BILLING_ADMIN", extra: Record<string, unknown> = {}) {
  return { workspaceId, userId: "actor", role, status: "ACTIVE", accessScope: null, workspaceStatus: "ACTIVE", ...extra };
}
function fake(options: { members?: Array<Record<string, unknown>>; payerRows?: Array<Record<string, unknown>>;
  resolveRows?: Array<Record<string, unknown>>; createError?: unknown } = {}) {
  const members = options.members ?? [member("ws-a"), member("ws-gov")];
  const client = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join("?");
      if (sql.includes("FROM Workspace w JOIN Membership")) return members;
      if (sql.includes("FROM PayerAccount")) return options.payerRows ?? [{ id: "payer-1", kind: "enterprise_contract",
        status: "active", version: 1, governingWorkspaceId: "ws-gov" }];
      return options.resolveRows ?? [];
    }),
    payerAccount: {
      create: vi.fn(async ({ data }) => ({ id: "payer-1", billingMode: "off", version: 1, ...data })),
      findUnique: vi.fn(async () => ({ id: "payer-1", governingWorkspaceId: "ws-gov" })),
    },
    payerScopeBinding: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => ({ id: "binding-1", payerAccountId: "payer-1", scopeKind: "workspace", scopeRef: "ws-a", state: "active" })),
      findUniqueOrThrow: vi.fn(async () => ({ id: "binding-1", payerAccountId: "payer-1", version: 2, state: "revoked" })),
      create: vi.fn(async ({ data }) => {
        if (options.createError) throw options.createError;
        return { id: "binding-1", version: 1, ...data };
      }),
    },
    auditLog: { create: vi.fn(async ({ data }) => ({ id: "audit", ...data })) },
    $executeRaw: vi.fn(async () => 1),
    $transaction: vi.fn(async (run) => run(client)),
  };
  return { client: client as unknown as PrismaClient, mock: client };
}
const bind = { actorUserId: "actor", payerAccountId: "payer-1", expectedPayerVersion: 1, scopeKind: "workspace" as const,
  scopeRef: "ws-a", evidenceRef: "contract:2026-11/annex-a" };
const create = { actorUserId: "actor", workspaceId: "ws-gov", kind: "enterprise_contract" as const, contractSubjectRef: "subject-1" };

describe("payer accounts", () => {
  it("creates an enterprise payer without choosing a billing mode, auditing in the same transaction", async () => {
    const { client, mock } = fake();
    const account = await createPayerAccount(client, create);
    expect(mock.payerAccount.create.mock.calls[0][0].data).not.toHaveProperty("billingMode");
    expect(account.billingMode).toBe("off");
    expect(mock.auditLog.create).toHaveBeenCalledTimes(1);
    expect(mock.auditLog.create.mock.calls[0][0].data.actionType).toBe("BILLING_PAYER_ACCOUNT_CREATED");
  });
  it.each([
    [{ kind: "consumer" }, "payer_kind_not_enabled"], [{ kind: "wallet" }, "payer_kind_invalid"],
    [{ currency: "USD" }, "payer_currency_not_supported"], [{ contractSubjectRef: " x" }, "payer_contract_subject_invalid"],
    [{ workspaceId: "" }, "payer_workspace_invalid"],
  ])("refuses %o before IO", async (patch, code) => {
    const { client, mock } = fake();
    await expect(createPayerAccount(client, { ...create, ...patch } as typeof create)).rejects.toThrow(code);
    expect(mock.$transaction).not.toHaveBeenCalled();
  });
  it.each(["MEMBER", "ADMIN", "OPERATOR", "REVIEWER"])("refuses %s as binder", async role => {
    const { client, mock } = fake({ members: [member("ws-a", role), member("ws-gov")] });
    await expect(bindScope(client, bind)).rejects.toThrow("payer_binding_forbidden");
    expect(mock.payerScopeBinding.create).not.toHaveBeenCalled();
  });
  it("requires billing authority on the payer side as well as the bound workspace", async () => {
    const { client } = fake({ members: [member("ws-a")] });
    await expect(bindScope(client, bind)).rejects.toThrow("payer_binding_forbidden");
  });
  it.each([{ status: "INACTIVE" }, { workspaceStatus: "SUSPENDED" }, { accessScope: "external" }, { workspaceId: "WS-A" }])(
    "refuses non-current authority %o", async extra => {
      const { client } = fake({ members: [member("ws-a", "OWNER", extra), member("ws-gov")] });
      await expect(bindScope(client, bind)).rejects.toThrow("payer_binding_forbidden");
    });
  it("binds with an optimistic payer version and audits both workspaces", async () => {
    const { client, mock } = fake();
    const binding = await bindScope(client, bind);
    expect(binding).toMatchObject({ scopeRef: "ws-a", activeScopeRef: "ws-a", authorizedByUserId: "actor" });
    const [sql, ...values] = mock.$executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(sql.join("?")).toContain("WHERE id = ? AND version = ?"); expect(values).toEqual(["payer-1", 1]);
    expect(mock.auditLog.create.mock.calls.map(c => c[0].data.workspaceId).sort()).toEqual(["ws-a", "ws-gov"]);
  });
  it("refuses a stale payer version and a non-enabled scope kind", async () => {
    await expect(bindScope(fake().client, { ...bind, expectedPayerVersion: 2 })).rejects.toThrow("payer_version_conflict");
    await expect(bindScope(fake().client, { ...bind, scopeKind: "consumer_principal" })).rejects.toThrow("payer_scope_kind_not_enabled");
    await expect(bindScope(fake().client, { ...bind, expectedPayerVersion: 0 })).rejects.toThrow("payer_version_invalid");
  });
  it("refuses a suspended payer", async () => {
    const { client } = fake({ payerRows: [{ id: "payer-1", kind: "enterprise_contract", status: "suspended", version: 1, governingWorkspaceId: "ws-gov" }] });
    await expect(bindScope(client, bind)).rejects.toThrow("payer_account_unavailable");
  });
  it("maps a unique-key race to an explicit already-bound error", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" });
    await expect(bindScope(fake({ createError: error }).client, bind)).rejects.toThrow("payer_scope_already_bound");
  });
  it("revokes by conditional version update and releases the active key", async () => {
    const { client, mock } = fake();
    await revokeBinding(client, { actorUserId: "actor", bindingId: "binding-1", expectedVersion: 1, evidenceRef: "ticket-1" });
    const [sql, ...values] = mock.$executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(sql.join("?")).toMatch(/activeScopeRef = NULL[\s\S]*WHERE id = \? AND version = \? AND state = 'active'/);
    expect(values).toEqual(["actor", "binding-1", 1]);
  });
  it("reports a lost revoke race as a version conflict", async () => {
    const { client, mock } = fake();
    mock.$executeRaw.mockResolvedValueOnce(0);
    await expect(revokeBinding(client, { actorUserId: "actor", bindingId: "binding-1", expectedVersion: 1, evidenceRef: "t" }))
      .rejects.toThrow("payer_version_conflict");
  });
  it("refuses revoke by a non-admin on both sides", async () => {
    const { client } = fake({ members: [member("ws-a", "MEMBER")] });
    await expect(revokeBinding(client, { actorUserId: "actor", bindingId: "binding-1", expectedVersion: 1, evidenceRef: "t" }))
      .rejects.toThrow("payer_binding_forbidden");
  });
  it("resolves only an exact active binding and fails closed otherwise", async () => {
    const row = { bindingId: "binding-1", bindingVersion: 1, scopeRef: "ws-a", payerAccountId: "payer-1", status: "active", billingMode: "off", currency: "CNY" };
    const tx = (rows: unknown[]) => fake({ resolveRows: rows as Array<Record<string, unknown>> }).client as unknown as Prisma.TransactionClient;
    await expect(resolvePayerForWorkspaceInTransaction(tx([row]), "ws-a")).resolves.toEqual({ payerAccountId: "payer-1",
      bindingId: "binding-1", bindingVersion: 1, scopeKind: "workspace", scopeRef: "ws-a", billingMode: "off", currency: "CNY" });
    await expect(resolvePayerForWorkspaceInTransaction(tx([]), "ws-a")).rejects.toThrow("payer_unresolved");
    await expect(resolvePayerForWorkspaceInTransaction(tx([row]), "WS-A")).rejects.toThrow("payer_unresolved");
    await expect(resolvePayerForWorkspaceInTransaction(tx([row, row]), "ws-a")).rejects.toThrow("payer_unresolved");
    await expect(resolvePayerForWorkspaceInTransaction(tx([{ ...row, status: "closed" }]), "ws-a")).rejects.toThrow("payer_account_unavailable");
    await expect(resolvePayerForWorkspaceInTransaction(tx([row]), "")).rejects.toThrow("payer_unresolved");
  });
});
