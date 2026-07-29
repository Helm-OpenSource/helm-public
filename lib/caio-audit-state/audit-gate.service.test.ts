import { describe, expect, it } from "vitest";

import {
  CaioAuditQueueFullError,
  CaioAuditQueueKeyUnavailableError,
  type CaioMinimalAuditReceipt,
} from "@/lib/caio-audit-state/audit-state-contracts";
import {
  computeEmergencyEntryId,
  createCaioAuditGate,
  type CaioAuditPrimaryStorePort,
} from "@/lib/caio-audit-state/audit-gate.service";
import type { CaioEmergencyQueuePort } from "@/lib/caio-audit-state/emergency-queue";

function receipt(requestId: string, overrides: Partial<CaioMinimalAuditReceipt> = {}): CaioMinimalAuditReceipt {
  return {
    requestId,
    client: "workbuddy",
    workspace: "ws-gate",
    modelAlias: "caio-default",
    inputHash: `sha256:${"c".repeat(64)}`,
    policyVersion: "policy-v3",
    ...overrides,
  };
}

interface StoredRow {
  receiptId: string;
  receipt: CaioMinimalAuditReceipt;
  persistedVia: string;
}

function createInMemoryPrimaryStore(options: {
  failWrites?: () => boolean;
  failOnRequestId?: string;
} = {}) {
  const rows = new Map<string, StoredRow>();
  let sequence = 0;
  const store: CaioAuditPrimaryStorePort = {
    async persist({ receipt: candidate, persistedVia }) {
      if (options.failWrites?.()) {
        throw new Error("primary store write failed");
      }
      if (options.failOnRequestId === candidate.requestId) {
        throw new Error(`primary store failed on ${candidate.requestId}`);
      }
      const key = `${candidate.workspace}:${candidate.requestId}`;
      const existing = rows.get(key);
      if (existing) {
        const same =
          existing.receipt.client === candidate.client &&
          existing.receipt.modelAlias === candidate.modelAlias &&
          existing.receipt.inputHash === candidate.inputHash &&
          existing.receipt.policyVersion === candidate.policyVersion;
        return same
          ? { outcome: "replayed", receiptId: existing.receiptId }
          : { outcome: "conflict" };
      }
      sequence += 1;
      const row: StoredRow = {
        receiptId: `receipt-${sequence}`,
        receipt: candidate,
        persistedVia,
      };
      rows.set(key, row);
      return { outcome: "persisted", receiptId: row.receiptId };
    },
  };
  return { store, rows };
}

function createInMemoryQueue(options: {
  maxEntries?: number;
  keyUnavailable?: () => boolean;
} = {}) {
  const entries = new Map<string, CaioMinimalAuditReceipt>();
  const queue: CaioEmergencyQueuePort = {
    async append({ entryId, receipt: candidate }) {
      if (options.keyUnavailable?.()) {
        throw new CaioAuditQueueKeyUnavailableError("kms offline");
      }
      if (entries.has(entryId)) {
        return { entryId, deduplicated: true };
      }
      if (entries.size >= (options.maxEntries ?? Infinity)) {
        throw new CaioAuditQueueFullError("cap reached");
      }
      entries.set(entryId, candidate);
      return { entryId, deduplicated: false };
    },
    async list() {
      return [...entries.entries()].map(([entryId, stored]) => ({
        entryId,
        receipt: stored,
      }));
    },
    async remove(entryId) {
      entries.delete(entryId);
    },
    async size() {
      return entries.size;
    },
  };
  return { queue, entries };
}

describe("caio audit gate", () => {
  it("persists to the primary store before allowing dispatch", async () => {
    const { store, rows } = createInMemoryPrimaryStore();
    const { queue } = createInMemoryQueue();
    const gate = createCaioAuditGate({ primaryStore: store, emergencyQueue: queue });

    const result = await gate.claimDispatch(receipt("req-1"));
    expect(result).toMatchObject({ allowed: true, persistedVia: "primary" });
    expect(rows.size).toBe(1);
    expect([...rows.values()][0]!.persistedVia).toBe("primary");
    expect(await gate.getReadiness()).toBe("ready");
  });

  it("is idempotent for a duplicate requestId with identical content and conflicts on different content", async () => {
    const { store } = createInMemoryPrimaryStore();
    const { queue } = createInMemoryQueue();
    const gate = createCaioAuditGate({ primaryStore: store, emergencyQueue: queue });

    const first = await gate.claimDispatch(receipt("req-1"));
    const replay = await gate.claimDispatch(receipt("req-1"));
    expect(first.allowed && replay.allowed).toBe(true);
    if (first.allowed && replay.allowed) {
      expect(replay.receiptId).toBe(first.receiptId);
    }

    const conflict = await gate.claimDispatch(
      receipt("req-1", { inputHash: `sha256:${"d".repeat(64)}` }),
    );
    expect(conflict.allowed).toBe(false);
    if (!conflict.allowed) {
      expect(conflict.reason).toBe("receipt_conflict");
      expect(conflict.httpStatus).toBe(409);
    }
  });

  it("rejects a receipt carrying a prompt key before any persistence", async () => {
    const { store, rows } = createInMemoryPrimaryStore();
    const { queue, entries } = createInMemoryQueue();
    const gate = createCaioAuditGate({ primaryStore: store, emergencyQueue: queue });

    await expect(
      gate.claimDispatch({
        ...receipt("req-1"),
        prompt: "raw prompt",
      } as unknown as CaioMinimalAuditReceipt),
    ).rejects.toThrow();
    expect(rows.size).toBe(0);
    expect(entries.size).toBe(0);
  });

  it("never allows dispatch when the durable write fails: degrades to the queue, then refuses with 503", async () => {
    const { store, rows } = createInMemoryPrimaryStore({
      failWrites: () => true,
    });
    let keyDown = false;
    const { queue, entries } = createInMemoryQueue({
      keyUnavailable: () => keyDown,
    });
    const gate = createCaioAuditGate({
      primaryStore: store,
      emergencyQueue: queue,
      retryAfterSeconds: 17,
    });

    // Primary down, queue writable: allowed only after the queue write.
    const degraded = await gate.claimDispatch(receipt("req-1"));
    expect(degraded).toMatchObject({
      allowed: true,
      persistedVia: "emergency_queue",
    });
    expect(rows.size).toBe(0);
    expect(entries.size).toBe(1);
    expect(gate.getState()).toBe("PRIMARY_DEGRADED");
    expect(await gate.getReadiness()).toBe("degraded");

    // Both unavailable: no durable write anywhere -> refuse, 503 contract.
    keyDown = true;
    const refused = await gate.claimDispatch(receipt("req-2"));
    expect(refused.allowed).toBe(false);
    if (!refused.allowed) {
      expect(refused.errorCode).toBe("caio_audit_unavailable");
      expect(refused.httpStatus).toBe(503);
      expect(refused.retryAfterSeconds).toBe(17);
    }
    expect(gate.getState()).toBe("AUDIT_UNAVAILABLE");
    expect(await gate.getReadiness()).toBe("unavailable");
    // Nothing was persisted for the refused request: no allow without a
    // durable write, so no upstream dispatch may happen for req-2.
    expect(rows.size).toBe(0);
    expect(entries.size).toBe(1);
  });

  it("refuses with 503 when the queue is at its maxEntries cap", async () => {
    const { store } = createInMemoryPrimaryStore({ failWrites: () => true });
    const { queue } = createInMemoryQueue({ maxEntries: 1 });
    const gate = createCaioAuditGate({ primaryStore: store, emergencyQueue: queue });

    expect((await gate.claimDispatch(receipt("req-1"))).allowed).toBe(true);
    const refused = await gate.claimDispatch(receipt("req-2"));
    expect(refused.allowed).toBe(false);
    if (!refused.allowed) {
      expect(refused.errorCode).toBe("caio_audit_unavailable");
      expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("replays queued entries into the primary store as emergency_replay and deletes only after confirmation", async () => {
    let primaryDown = true;
    const { store, rows } = createInMemoryPrimaryStore({
      failWrites: () => primaryDown,
    });
    const { queue, entries } = createInMemoryQueue();
    const gate = createCaioAuditGate({ primaryStore: store, emergencyQueue: queue });

    await gate.claimDispatch(receipt("req-1"));
    await gate.claimDispatch(receipt("req-2"));
    expect(entries.size).toBe(2);

    primaryDown = false;
    const outcome = await gate.recover();
    expect(outcome).toEqual({ replayed: 2, remaining: 0, conflicts: 0 });
    expect(gate.getState()).toBe("NORMAL");
    expect(await gate.getReadiness()).toBe("ready");
    expect(entries.size).toBe(0);
    expect(rows.size).toBe(2);
    for (const row of rows.values()) {
      expect(row.persistedVia).toBe("emergency_replay");
    }
  });

  it("recovers safely from a mid-replay crash: remaining entries intact, second recover completes without duplicates", async () => {
    let primaryDown = true;
    const { store, rows } = createInMemoryPrimaryStore({
      failWrites: () => primaryDown,
    });
    const { queue, entries } = createInMemoryQueue();
    const gate = createCaioAuditGate({ primaryStore: store, emergencyQueue: queue });

    for (const requestId of ["req-1", "req-2", "req-3"]) {
      await gate.claimDispatch(receipt(requestId));
    }
    primaryDown = false;

    // Simulate a crash between primary confirm and queue delete for req-1:
    // the entry is already in the primary store but still queued.
    const req1EntryId = computeEmergencyEntryId(receipt("req-1"));
    expect(entries.has(req1EntryId)).toBe(true);
    await store.persist({
      receipt: receipt("req-1"),
      persistedVia: "emergency_replay",
      now: new Date(),
    });

    // First recover run fails on req-2 (store failure at entry N).
    const failing = createCaioAuditGate({
      primaryStore: {
        async persist(input) {
          if (input.receipt.requestId === "req-2") {
            throw new Error("store failed on entry N");
          }
          return store.persist(input);
        },
      },
      emergencyQueue: queue,
    });
    const interrupted = await failing.recover();
    expect(interrupted.remaining).toBeGreaterThan(0);
    expect(failing.getState()).toBe("PRIMARY_DEGRADED");
    expect(entries.has(computeEmergencyEntryId(receipt("req-2")))).toBe(true);
    expect(entries.has(computeEmergencyEntryId(receipt("req-3")))).toBe(true);

    // Second recover completes; unique [workspace, requestId] prevents dupes.
    const completed = await gate.recover();
    expect(completed.remaining).toBe(0);
    expect(gate.getState()).toBe("NORMAL");
    expect(rows.size).toBe(3);
  });

  it("rate-limits new claims during recovery by the configured concurrent cap", async () => {
    const { queue } = createInMemoryQueue();
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slowStore: CaioAuditPrimaryStorePort = {
      async persist({ receipt: candidate }) {
        await blocked;
        return { outcome: "persisted", receiptId: `receipt-${candidate.requestId}` };
      },
    };
    const gate = createCaioAuditGate({
      primaryStore: slowStore,
      emergencyQueue: queue,
      recoveryConcurrentClaimCap: 1,
    });
    // Enter RECOVERING (empty queue keeps it brief); hold it open by state.
    const recovery = gate.recover();
    // recover() with an empty queue resolves immediately; force the state by
    // starting a claim while recovering is still the observable state.
    await recovery;

    // Re-enter recovery deterministically with a non-empty queue.
    await queue.append({
      entryId: computeEmergencyEntryId(receipt("req-queued")),
      receipt: receipt("req-queued"),
    });
    const secondRecovery = gate.recover();
    const firstClaim = gate.claimDispatch(receipt("req-a"));
    const overCap = await gate.claimDispatch(receipt("req-b"));
    expect(overCap.allowed).toBe(false);
    if (!overCap.allowed) {
      expect(overCap.reason).toBe("recovery_rate_limited");
      expect(overCap.httpStatus).toBe(503);
      expect(overCap.retryAfterSeconds).toBeGreaterThan(0);
    }
    release?.();
    expect((await firstClaim).allowed).toBe(true);
    await secondRecovery;
  });

  it("keeps conflicting queue entries as evidence during recovery", async () => {
    let primaryDown = true;
    const { store, rows } = createInMemoryPrimaryStore({
      failWrites: () => primaryDown,
    });
    const { queue, entries } = createInMemoryQueue();
    const gate = createCaioAuditGate({ primaryStore: store, emergencyQueue: queue });

    await gate.claimDispatch(receipt("req-1"));
    primaryDown = false;
    // Primary now holds different content for the same requestId.
    await store.persist({
      receipt: receipt("req-1", { inputHash: `sha256:${"e".repeat(64)}` }),
      persistedVia: "primary",
      now: new Date(),
    });

    const outcome = await gate.recover();
    expect(outcome.conflicts).toBe(1);
    expect(outcome.remaining).toBe(1);
    expect(gate.getState()).toBe("PRIMARY_DEGRADED");
    expect(entries.size).toBe(1);
    expect(rows.size).toBe(1);
  });
});
