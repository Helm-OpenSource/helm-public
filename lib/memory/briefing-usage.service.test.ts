import { ObjectType, type Prisma, type BriefingSnapshot, type UsageLedger, type LLMWorkflowOperation } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { getAcceptedBriefing, persistAcceptedBriefingInTransaction, readBriefingUsageReceipt } from "./briefing-usage.service";

const operation = { id: "operation-1", workspaceId: "workspace-1", actorUserId: "actor-1", kind: "briefing",
  sourceType: "meeting", sourceId: "meeting-1", slot: "pre_meeting_brief", generation: 1, status: "prepared" } as LLMWorkflowOperation;
const data = { workspaceId: operation.workspaceId, objectType: ObjectType.MEETING, objectId: operation.sourceId,
  snapshotType: operation.slot, content: JSON.stringify({ summary: "Accepted synthetic briefing",
    generationMode: "llm_enhanced", llmMeta: { success: true, fallbackUsed: false } }) };
const input = { operationId: operation.id, actorUserId: operation.actorUserId!, sourcePage: "/meetings/meeting-1", data };
function fixture() {
  const snapshots: BriefingSnapshot[] = [], rows: UsageLedger[] = [];
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: operation.id }]),
    lLMWorkflowOperation: { findUnique: vi.fn(async () => operation) },
    usageLedger: { findUnique: vi.fn(async ({ where }) => rows.find(row => row.operationKey === where.workspaceId_operationKey.operationKey) ?? null),
      create: vi.fn(async ({ data: value }) => { const row = { id: "usage-1", createdAt: new Date(), ...value }; rows.push(row); return row; }) },
    briefingSnapshot: { findUnique: vi.fn(async ({ where }) => snapshots.find(row => row.id === where.id) ?? null),
      findFirst: vi.fn(async () => snapshots.at(-1) ?? null), updateMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async ({ data: value }) => { const row = { id: "snapshot-1", generatedAt: new Date(), expiresAt: null, ...value }; snapshots.push(row); return row; }) },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, mock: tx, snapshots, rows };
}
describe("accepted briefing usage binding", () => {
  it("persists once inside the caller transaction and reads original provenance after restart", async () => {
    const { tx, mock, rows, snapshots } = fixture();
    const first = await persistAcceptedBriefingInTransaction(tx, input);
    const replay = await persistAcceptedBriefingInTransaction(tx, { ...input, sourcePage: "/different-page" });
    expect(replay.snapshot.id).toBe(first.snapshot.id); expect(rows).toHaveLength(1); expect(snapshots).toHaveLength(1);
    expect(mock.briefingSnapshot.create).toHaveBeenCalledOnce();
    const cached = await getAcceptedBriefing(tx, operation.workspaceId, operation.id);
    expect(cached?.usageReceipt).toMatchObject({ actorUserId: "actor-1", sourcePage: input.sourcePage, snapshotId: first.snapshot.id });
    expect(await readBriefingUsageReceipt(tx, first.snapshot)).toEqual(first.usageReceipt);
  });
  it("fails closed on same operation with different accepted content", async () => {
    const { tx } = fixture(); await persistAcceptedBriefingInTransaction(tx, input);
    await expect(persistAcceptedBriefingInTransaction(tx, { ...input, data: { ...data,
      content: data.content.replace("Accepted", "Changed") } })).rejects.toThrow("briefing_usage_conflict");
  });
  it.each(["workspaceId", "actorUserId", "kind", "sourceId", "slot"])("rejects mismatched operation %s", async field => {
    const { tx, mock } = fixture(); mock.lLMWorkflowOperation.findUnique.mockResolvedValue({ ...operation, [field]: "wrong" });
    await expect(persistAcceptedBriefingInTransaction(tx, input)).rejects.toThrow("briefing_operation_mismatch");
    expect(mock.briefingSnapshot.create).not.toHaveBeenCalled();
  });
  it.each(["parse", "pii", "disabled"])("does not observe %s fallback as fulfillment", async reason => {
    const { tx, mock } = fixture();
    await expect(persistAcceptedBriefingInTransaction(tx, { ...input, data: { ...data,
      content: JSON.stringify({ generationMode: "fallback", llmMeta: { success: false, fallbackUsed: true, fallbackReason: reason } }) } }))
      .rejects.toThrow("briefing_output_not_accepted");
    expect(mock.usageLedger.create).not.toHaveBeenCalled(); expect(mock.briefingSnapshot.create).not.toHaveBeenCalled();
  });
  it("rejects dangling, modified or cross-workspace cached bindings; leaves legacy unbound", async () => {
    const { tx, rows } = fixture(); const result = await persistAcceptedBriefingInTransaction(tx, input);
    await expect(readBriefingUsageReceipt(tx, { ...result.snapshot, content: result.snapshot.content.replace("Accepted", "Tampered") }))
      .rejects.toThrow("briefing_usage_binding_invalid");
    await expect(readBriefingUsageReceipt(tx, { ...result.snapshot, workspaceId: "other" })).rejects.toThrow("briefing_usage_binding_invalid");
    rows.length = 0;
    await expect(readBriefingUsageReceipt(tx, result.snapshot)).rejects.toThrow("briefing_usage_binding_invalid");
    expect(await readBriefingUsageReceipt(tx, { ...result.snapshot, content: data.content })).toBeNull();
  });
  it.each([null, {}, { schema: "helm.briefing-usage/v1", operationId: "" }])("refuses malformed cached pointer %j", async usageObservation => {
    const { tx } = fixture(); const result = await persistAcceptedBriefingInTransaction(tx, input);
    await expect(readBriefingUsageReceipt(tx, { ...result.snapshot,
      content: JSON.stringify({ llmMeta: { usageObservation } }) })).rejects.toThrow("briefing_usage_binding_invalid");
  });
  it("preserves unstructured historical snapshot reads without inventing a usage receipt", async () => {
    const { tx } = fixture(); const result = await persistAcceptedBriefingInTransaction(tx, input);
    expect(await readBriefingUsageReceipt(tx, { ...result.snapshot, content: "Legacy briefing text" })).toBeNull();
  });
});
