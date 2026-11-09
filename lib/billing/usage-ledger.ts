import "server-only";
import { createHash } from "node:crypto";
import { Prisma, UsageType, type PrismaClient, type WorkspaceRole } from "@prisma/client";
import { canManageWorkspaceBilling } from "@/lib/auth/billing-governance";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";

export type IdempotentUsageInput = {
  workspaceId: string; userId?: string | null; usageType: UsageType; operationKey: string;
  quantity?: number; sourcePage?: string | null; metadata?: Record<string, unknown> | null; recordedAt?: Date;
};
export type UsageCorrectionInput = {
  workspaceId: string; actorUserId: string; entryId: string; operationKey: string;
  reasonCode: "duplicate_operation" | "invalid_measurement" | "operator_correction";
};

const reasons = ["duplicate_operation", "invalid_measurement", "operator_correction"];
function fail(code: string): never { throw new Error(code); }
function reference(value: string, code: string) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/.test(value)) fail(code);
}
function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) return fail("usage_metadata_invalid");
    return `[${value.map(canonical).join(",")}]`;
  }
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return fail("usage_metadata_invalid");
}
function payload(input: IdempotentUsageInput, reversalOfId: string | null = null) {
  reference(input.operationKey, "usage_operation_key_invalid");
  reference(input.workspaceId, "usage_workspace_invalid");
  if (input.userId != null) reference(input.userId, "usage_user_invalid");
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || Math.abs(quantity) > 2147483647 ||
      (reversalOfId ? quantity >= 0 : quantity <= 0)) fail("usage_quantity_invalid");
  if (!Object.values(UsageType).includes(input.usageType)) fail("usage_type_invalid");
  if (input.sourcePage != null && (typeof input.sourcePage !== "string" || input.sourcePage.length > 191)) fail("usage_source_page_invalid");
  if (input.recordedAt !== undefined && (!(input.recordedAt instanceof Date) ||
      !Number.isFinite(input.recordedAt.getTime()) || !/^\d{4}-/.test(input.recordedAt.toISOString()))) fail("usage_recorded_at_invalid");
  let metadata: string | null;
  try { metadata = input.metadata == null ? null : canonical(input.metadata); }
  catch { return fail("usage_metadata_invalid"); }
  if (metadata !== null && Buffer.byteLength(metadata) > 16384) fail("usage_metadata_invalid");
  const basis = { workspaceId: input.workspaceId, userId: input.userId ?? null, usageType: input.usageType,
    quantity, sourcePage: input.sourcePage ?? null, metadata, recordedAt: input.recordedAt?.toISOString() ?? null,
    operationKey: input.operationKey, reversalOfId };
  return { ...basis, recordedAt: input.recordedAt ?? new Date(),
    contentHash: createHash("sha256").update(canonical(basis)).digest("hex") };
}
type UsageData = ReturnType<typeof payload>;
async function persist(tx: Prisma.TransactionClient, data: UsageData) {
  const existing = await tx.usageLedger.findUnique({
    where: { workspaceId_operationKey: { workspaceId: data.workspaceId, operationKey: data.operationKey } },
  });
  if (existing) {
    if (existing.workspaceId !== data.workspaceId || existing.operationKey !== data.operationKey ||
        existing.contentHash !== data.contentHash) fail("usage_operation_conflict");
    return existing;
  }
  if (data.reversalOfId && await tx.usageLedger.findUnique({ where: { reversalOfId: data.reversalOfId } })) {
    fail("usage_entry_already_reversed");
  }
  return tx.usageLedger.create({ data });
}
function transaction<T>(client: PrismaClient, run: (tx: Prisma.TransactionClient) => Promise<T>) {
  return runWithWriteConflictRetry(() => client.$transaction(run, { maxWait: 5000, timeout: 10000 }), {
    isConflict: error => error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034"),
  });
}

/** Observation only: no provider invocation, amount calculation, invoice or payment. */
export async function recordIdempotentUsage(input: IdempotentUsageInput, client: PrismaClient) {
  const data = payload(input);
  return transaction(client, tx => persist(tx, data));
}

export async function reverseUsageLedgerEntry(input: UsageCorrectionInput, client: PrismaClient) {
  reference(input.workspaceId, "usage_workspace_invalid");
  reference(input.actorUserId, "usage_correction_forbidden");
  reference(input.entryId, "usage_entry_unavailable");
  reference(input.operationKey, "usage_operation_key_invalid");
  if (!reasons.includes(input.reasonCode)) fail("usage_correction_reason_invalid");
  return transaction(client, async tx => {
    // Lock current authority, not a caller-supplied role. Revocation and correction serialize.
    const [member] = await tx.$queryRaw<Array<{ workspaceId: string; userId: string; role: WorkspaceRole;
      status: string; accessScope: string | null; workspaceStatus: string }>>`
      SELECT m.workspaceId, m.userId, m.role, m.status, m.accessScope, w.status AS workspaceStatus
      FROM Workspace w JOIN Membership m ON m.workspaceId = w.id JOIN User u ON u.id = m.userId
      WHERE w.id = ${input.workspaceId} AND m.userId = ${input.actorUserId}
        AND CAST(w.id AS BINARY) = CAST(${input.workspaceId} AS BINARY)
        AND CAST(m.userId AS BINARY) = CAST(${input.actorUserId} AS BINARY) FOR UPDATE`;
    if (!member || member.workspaceId !== input.workspaceId || member.userId !== input.actorUserId ||
        member.status !== "ACTIVE" || member.workspaceStatus !== "ACTIVE" ||
        (member.accessScope !== null && member.accessScope !== "") || !canManageWorkspaceBilling(member.role)) {
      fail("usage_correction_forbidden");
    }
    const original = await tx.usageLedger.findUnique({ where: { id: input.entryId } });
    if (!original || original.id !== input.entryId || original.workspaceId !== input.workspaceId) fail("usage_entry_unavailable");
    if (!original.operationKey || !original.contentHash || original.reversalOfId || original.quantity <= 0) fail("usage_entry_not_reversible");
    return persist(tx, payload({ workspaceId: input.workspaceId, userId: input.actorUserId,
      usageType: original.usageType, quantity: -original.quantity, operationKey: input.operationKey,
      recordedAt: original.recordedAt, sourcePage: original.sourcePage,
      metadata: { schema: "helm.usage-correction/v1", reasonCode: input.reasonCode, originalEntryId: original.id },
    }, original.id));
  });
}
