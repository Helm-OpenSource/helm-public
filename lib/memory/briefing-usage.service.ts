import "server-only";
import { createHash } from "node:crypto";
import { UsageType, type Prisma, type BriefingSnapshot } from "@prisma/client";
import { recordIdempotentUsageInTransaction } from "@/lib/billing/usage-ledger";

type Reader = Pick<Prisma.TransactionClient, "usageLedger" | "lLMWorkflowOperation" | "briefingSnapshot">;
type Input = { operationId: string; actorUserId: string; sourcePage?: string | null;
  data: Prisma.BriefingSnapshotUncheckedCreateInput };
const schema = "helm.briefing-usage/v1";
const key = (operationId: string) => `briefing:${operationId}`;
const hash = (content: string) => createHash("sha256").update(content).digest("hex");
const operationSelect = { id: true, workspaceId: true, actorUserId: true, kind: true, sourceType: true,
  sourceId: true, slot: true, generation: true, status: true } as const;
function fail(code: string): never { throw new Error(code); }
function parse(content: string) {
  try { return JSON.parse(content) as { generationMode?: string; llmMeta?: Record<string, unknown> }; }
  catch { return fail("briefing_usage_binding_invalid"); }
}
function pointer(snapshot: BriefingSnapshot): string | null {
  let payload: ReturnType<typeof parse>;
  try { payload = JSON.parse(snapshot.content); } catch { return null; } // Historical plain-text snapshots are unbound.
  const value = payload?.llmMeta?.usageObservation;
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || !("schema" in value) || value.schema !== schema ||
      !("operationId" in value) || typeof value.operationId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,181}$/.test(value.operationId)) fail("briefing_usage_binding_invalid");
  return value.operationId;
}

/** This receipt is read from persisted business/usage bindings, never request fields. */
export async function readBriefingUsageReceipt(client: Reader, snapshot: BriefingSnapshot) {
  const operationId = pointer(snapshot);
  if (!operationId) return null;
  const operation = await client.lLMWorkflowOperation.findUnique({ where: { id: operationId }, select: operationSelect });
  const row = await client.usageLedger.findUnique({ where: {
    workspaceId_operationKey: { workspaceId: snapshot.workspaceId, operationKey: key(operationId) },
  } });
  if (!operation || operation.id !== operationId || operation.workspaceId !== snapshot.workspaceId ||
      !operation.actorUserId || operation.kind !== "briefing" || operation.sourceType !== snapshot.objectType.toLowerCase() ||
      operation.sourceId !== snapshot.objectId || operation.slot !== snapshot.snapshotType || operation.generation !== 1 ||
      !row || row.workspaceId !== snapshot.workspaceId || row.operationKey !== key(operationId) ||
      row.usageType !== UsageType.BRIEFING_GENERATION || row.quantity !== 1 || row.reversalOfId || !row.contentHash ||
      (row.userId !== null && row.userId !== operation.actorUserId) ||
      row.recordedAt.getTime() !== snapshot.generatedAt.getTime()) fail("briefing_usage_binding_invalid");
  const expected = { schema, operationId, actorUserId: operation.actorUserId, sourceType: operation.sourceType,
    sourceId: operation.sourceId, slot: operation.slot, generation: operation.generation,
    snapshotId: snapshot.id, contentHash: hash(snapshot.content) };
  let metadata: Record<string, unknown>;
  try { metadata = JSON.parse(row.metadata ?? "null"); } catch { return fail("briefing_usage_binding_invalid"); }
  if (!metadata || Object.keys(metadata).length !== Object.keys(expected).length ||
      Object.entries(expected).some(([name, value]) => metadata[name] !== value)) fail("briefing_usage_binding_invalid");
  return { entryId: row.id, operationId, snapshotId: snapshot.id, actorUserId: operation.actorUserId, sourcePage: row.sourcePage };
}

export async function getAcceptedBriefing(client: Reader, workspaceId: string, operationId: string) {
  const row = await client.usageLedger.findUnique({ where: { workspaceId_operationKey: { workspaceId, operationKey: key(operationId) } } });
  if (!row) return null;
  let snapshotId: unknown;
  try { snapshotId = JSON.parse(row.metadata ?? "null")?.snapshotId; } catch { return fail("briefing_usage_binding_invalid"); }
  if (typeof snapshotId !== "string") fail("briefing_usage_binding_invalid");
  const snapshot = await client.briefingSnapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot || snapshot.id !== snapshotId || snapshot.workspaceId !== workspaceId || pointer(snapshot) !== operationId) {
    fail("briefing_usage_binding_invalid");
  }
  const usageReceipt = await readBriefingUsageReceipt(client, snapshot);
  if (!usageReceipt) fail("briefing_usage_binding_invalid");
  return { snapshot, usageReceipt };
}

/** Called only after structured output acceptance; owns neither provider cost nor transaction lifecycle. */
export async function persistAcceptedBriefingInTransaction(tx: Prisma.TransactionClient, input: Input) {
  const payload = parse(input.data.content);
  if (payload?.generationMode !== "llm_enhanced" || payload.llmMeta?.success !== true || payload.llmMeta.fallbackUsed !== false) {
    fail("briefing_output_not_accepted");
  }
  const [locked] = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM LLMWorkflowOperation WHERE id=${input.operationId}
      AND CAST(id AS BINARY)=CAST(${input.operationId} AS BINARY) FOR UPDATE`;
  const operation = await tx.lLMWorkflowOperation.findUnique({ where: { id: input.operationId }, select: operationSelect });
  if (locked?.id !== input.operationId || !operation || operation.id !== input.operationId ||
      operation.workspaceId !== input.data.workspaceId || operation.actorUserId !== input.actorUserId ||
      operation.kind !== "briefing" || operation.status !== "prepared" || operation.generation !== 1 ||
      operation.sourceType !== input.data.objectType.toLowerCase() || operation.sourceId !== input.data.objectId ||
      operation.slot !== input.data.snapshotType) fail("briefing_operation_mismatch");
  const content = JSON.stringify({ ...payload, llmMeta: { ...payload.llmMeta, usageObservation: { schema, operationId: operation.id } } });
  const existing = await getAcceptedBriefing(tx, input.data.workspaceId, operation.id);
  if (existing) {
    if (existing.snapshot.content !== content) fail("briefing_usage_conflict");
    return existing;
  }
  const scope = { workspaceId: input.data.workspaceId, objectType: input.data.objectType,
    objectId: input.data.objectId, snapshotType: input.data.snapshotType };
  const latest = await tx.briefingSnapshot.findFirst({ where: scope, orderBy: { generatedAt: "desc" } });
  await tx.briefingSnapshot.updateMany({ where: { ...scope, expiresAt: null }, data: { expiresAt: new Date() } });
  const snapshot = await tx.briefingSnapshot.create({ data: { ...input.data, content, version: (latest?.version ?? 0) + 1 } });
  const row = await recordIdempotentUsageInTransaction(tx, { workspaceId: operation.workspaceId, userId: operation.actorUserId,
    usageType: UsageType.BRIEFING_GENERATION, operationKey: key(operation.id), sourcePage: input.sourcePage,
    recordedAt: snapshot.generatedAt, metadata: { schema, operationId: operation.id, actorUserId: operation.actorUserId,
      sourceType: operation.sourceType, sourceId: operation.sourceId, slot: operation.slot, generation: operation.generation,
      snapshotId: snapshot.id, contentHash: hash(snapshot.content) } });
  return { snapshot, usageReceipt: { entryId: row.id, operationId: operation.id, snapshotId: snapshot.id,
    actorUserId: input.actorUserId, sourcePage: row.sourcePage } };
}
