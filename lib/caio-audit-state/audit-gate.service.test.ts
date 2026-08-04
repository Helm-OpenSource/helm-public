import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
import {
  createCaioEmergencyQueue,
  type CaioEmergencyQueuePort,
} from "@/lib/caio-audit-state/emergency-queue";
import { caioReplayMarkerRequestId } from "@/lib/caio-audit-state/receipt-linkage";

function receipt(requestId: string, overrides: Partial<CaioMinimalAuditReceipt> = {}): CaioMinimalAuditReceipt {
  return {
    requestId,
    client: "workbuddy",
    workspace: "ws-gate",
    modelAlias: "caio-default",
    inputHash: `sha256:${"c".repeat(64)}`,
    policyVersion: "policy-v3",
    posture: "self_service",
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
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: store,
      emergencyQueue: queue,
    });

    const result = await gate.claimDispatch(receipt("req-1"));
    expect(result).toMatchObject({ allowed: true, persistedVia: "primary" });
    expect(rows.size).toBe(1);
    expect([...rows.values()][0]!.persistedVia).toBe("primary");
    expect(await gate.getReadiness()).toBe("ready");
  });

  it("is idempotent for a duplicate requestId with identical content and conflicts on different content", async () => {
    const { store } = createInMemoryPrimaryStore();
    const { queue } = createInMemoryQueue();
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: store,
      emergencyQueue: queue,
    });

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
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: store,
      emergencyQueue: queue,
    });

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
      posture: "self_service",
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
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: store,
      emergencyQueue: queue,
    });

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
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: store,
      emergencyQueue: queue,
    });

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
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: store,
      emergencyQueue: queue,
    });

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
      posture: "self_service",
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
      posture: "self_service",
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

  // F2 regression: persistToPrimary refused only outcome === "conflict" and
  // returned allowed:true for everything else, so an injected store reporting
  // an unknown outcome (or success without a receiptId) allowed dispatch with
  // nothing written anywhere.
  it("F2: refuses when the primary store reports an outcome outside the contract", async () => {
    const { queue, entries } = createInMemoryQueue();
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: {
        persist: async () =>
          ({ outcome: "skipped_noop" }) as unknown as Awaited<
            ReturnType<CaioAuditPrimaryStorePort["persist"]>
          >,
      },
      emergencyQueue: queue,
    });

    const result = await gate.claimDispatch(receipt("req-bogus"));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.errorCode).toBe("caio_audit_unavailable");
      expect(result.httpStatus).toBe(503);
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    }
    // A store that violates its contract must not be masked by the queue:
    // nothing was written, so nothing may dispatch.
    expect(entries.size).toBe(0);
    expect(gate.getState()).toBe("AUDIT_UNAVAILABLE");
    expect(await gate.getReadiness()).toBe("unavailable");
  });

  it("F2: refuses a store success that carries no receiptId", async () => {
    const { queue, entries } = createInMemoryQueue();
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: {
        persist: async () =>
          ({ outcome: "persisted" }) as unknown as Awaited<
            ReturnType<CaioAuditPrimaryStorePort["persist"]>
          >,
      },
      emergencyQueue: queue,
    });

    const result = await gate.claimDispatch(receipt("req-no-id"));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.httpStatus).toBe(503);
    }
    expect(entries.size).toBe(0);
  });

  it("F2: refuses an empty-string receiptId reported as success", async () => {
    const { queue } = createInMemoryQueue();
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: {
        persist: async () => ({ outcome: "persisted", receiptId: "" }) as never,
      },
      emergencyQueue: queue,
    });
    expect((await gate.claimDispatch(receipt("req-empty-id"))).allowed).toBe(
      false,
    );
  });

  // F1 regression at gate level, over the real encrypted file queue: two
  // in-flight claims sharing a client-supplied requestId with different bodies
  // must never produce more allowed dispatches than durable receipts.
  describe("F1: concurrent claims over the real emergency queue", () => {
    let sandbox = "";

    beforeEach(async () => {
      sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "caio-gate-race-"));
    });

    afterEach(async () => {
      await fs.rm(sandbox, { recursive: true, force: true });
    });

    it("never allows more dispatches than durable receipts", async () => {
      const key = randomBytes(32);
      const queue = createCaioEmergencyQueue({
        rootDir: path.join(sandbox, "queue"),
        keyProvider: async () => key,
      });
      const gate = createCaioAuditGate({
      posture: "self_service",
        primaryStore: {
          async persist() {
            throw new Error("primary down");
          },
        },
        emergencyQueue: queue,
      });

      const [a, b] = await Promise.all([
        gate.claimDispatch(receipt("req-shared")),
        gate.claimDispatch(
          receipt("req-shared", { inputHash: `sha256:${"f".repeat(64)}` }),
        ),
      ]);

      const allowed = [a, b].filter((result) => result.allowed);
      const durable = await queue.list();
      expect(allowed).toHaveLength(1);
      expect(durable).toHaveLength(1);
      expect(allowed.length).toBeLessThanOrEqual(durable.length);
      const refused = [a, b].find((result) => !result.allowed);
      expect(refused).toBeDefined();
      if (refused && !refused.allowed) {
        expect(["receipt_conflict", "audit_unavailable"]).toContain(
          refused.reason,
        );
      }
    });

    it("refuses a divergent receipt for an already queued requestId with 409", async () => {
      const key = randomBytes(32);
      const queue = createCaioEmergencyQueue({
        rootDir: path.join(sandbox, "queue-seq"),
        keyProvider: async () => key,
      });
      const gate = createCaioAuditGate({
      posture: "self_service",
        primaryStore: {
          async persist() {
            throw new Error("primary down");
          },
        },
        emergencyQueue: queue,
      });

      expect((await gate.claimDispatch(receipt("req-seq"))).allowed).toBe(true);
      const conflict = await gate.claimDispatch(
        receipt("req-seq", { inputHash: `sha256:${"9".repeat(64)}` }),
      );
      expect(conflict.allowed).toBe(false);
      if (!conflict.allowed) {
        expect(conflict.reason).toBe("receipt_conflict");
        expect(conflict.httpStatus).toBe(409);
        // A conflict is never retryable: the field is defined, never undefined.
        expect(conflict.retryAfterSeconds).toBeNull();
      }
      // The queue is healthy: a content conflict must not claim the audit
      // subsystem is unavailable.
      expect(gate.getState()).toBe("PRIMARY_DEGRADED");
      expect(await queue.size()).toBe(1);
    });
  });

  // F6 regression: an identical replay returned allowed:true with no new
  // durable write and no attempt counter, so N dispatches were invisible.
  it("F6: records a linked, bounded replay marker for every repeat dispatch", async () => {
    const { store, rows } = createInMemoryPrimaryStore();
    const { queue } = createInMemoryQueue();
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: store,
      emergencyQueue: queue,
    });

    const first = await gate.claimDispatch(receipt("req-1"));
    expect(first).toMatchObject({ allowed: true, dispatchAttempt: 1 });
    expect(rows.size).toBe(1);

    const second = await gate.claimDispatch(receipt("req-1"));
    expect(second).toMatchObject({ allowed: true, dispatchAttempt: 2 });
    if (second.allowed && first.allowed) {
      // Idempotent: the caller still sees the original receipt id.
      expect(second.receiptId).toBe(first.receiptId);
    }
    // ...but the dispatch is durably recorded as a linked marker row.
    expect(rows.size).toBe(2);
    expect(
      rows.has(`ws-gate:${caioReplayMarkerRequestId("req-1", 2)}`),
    ).toBe(true);

    const third = await gate.claimDispatch(receipt("req-1"));
    expect(third).toMatchObject({ allowed: true, dispatchAttempt: 3 });
    expect(rows.size).toBe(3);
  });

  it("F6: refuses once the per-receipt replay cap is exhausted", async () => {
    const { store, rows } = createInMemoryPrimaryStore();
    const { queue } = createInMemoryQueue();
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: store,
      emergencyQueue: queue,
      replayDispatchCap: 2,
    });

    expect((await gate.claimDispatch(receipt("req-1"))).allowed).toBe(true);
    expect((await gate.claimDispatch(receipt("req-1"))).allowed).toBe(true);
    expect((await gate.claimDispatch(receipt("req-1"))).allowed).toBe(true);
    const overCap = await gate.claimDispatch(receipt("req-1"));
    expect(overCap.allowed).toBe(false);
    if (!overCap.allowed) {
      expect(overCap.reason).toBe("replay_limit_exceeded");
      expect(overCap.errorCode).toBe("caio_audit_replay_limit_exceeded");
      expect(overCap.httpStatus).toBe(429);
    }
    // 1 original + 2 permitted replays, nothing more.
    expect(rows.size).toBe(3);
  });

  it("F6: rejects a caller-minted replay marker requestId", async () => {
    const { store, rows } = createInMemoryPrimaryStore();
    const { queue } = createInMemoryQueue();
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: store,
      emergencyQueue: queue,
    });
    await expect(
      gate.claimDispatch(receipt(caioReplayMarkerRequestId("req-1", 2))),
    ).rejects.toThrow();
    expect(rows.size).toBe(0);
  });

  // F7 regression: recover() set NORMAL (readiness "ready") whenever the queue
  // happened to be empty, even while the primary store was still down.
  it("F7: does not report ready after recover() when the primary is still down", async () => {
    const { store } = createInMemoryPrimaryStore({ failWrites: () => true });
    const { queue } = createInMemoryQueue();
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: store,
      emergencyQueue: queue,
    });

    // One claim degrades to the queue; the operator then drains it by hand.
    await gate.claimDispatch(receipt("req-1"));
    await queue.remove(computeEmergencyEntryId(receipt("req-1")));
    expect(await queue.size()).toBe(0);

    const outcome = await gate.recover();
    expect(outcome).toEqual({ replayed: 0, remaining: 0, conflicts: 0 });
    expect(gate.getState()).not.toBe("NORMAL");
    expect(await gate.getReadiness()).not.toBe("ready");
  });

  it("F7: NORMAL requires a healthy primary probe, not merely an empty queue", async () => {
    const { store } = createInMemoryPrimaryStore({ failWrites: () => true });
    const { queue } = createInMemoryQueue();
    let primaryHealthy = false;
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: store,
      emergencyQueue: queue,
      primaryHealthProbe: async () => primaryHealthy,
    });

    expect(await gate.recover()).toMatchObject({ remaining: 0 });
    expect(gate.getState()).not.toBe("NORMAL");
    expect(await gate.getReadiness()).toBe("degraded");

    primaryHealthy = true;
    expect(await gate.recover()).toMatchObject({ remaining: 0 });
    expect(gate.getState()).toBe("NORMAL");
    expect(await gate.getReadiness()).toBe("ready");
  });

  it("F7: a NORMAL gate reports degraded while the primary probe fails", async () => {
    const { store } = createInMemoryPrimaryStore();
    const { queue } = createInMemoryQueue();
    let primaryHealthy = true;
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: store,
      emergencyQueue: queue,
      primaryHealthProbe: async () => primaryHealthy,
    });
    expect(await gate.getReadiness()).toBe("ready");
    primaryHealthy = false;
    expect(gate.getState()).toBe("NORMAL");
    expect(await gate.getReadiness()).toBe("degraded");
  });

  // F8 regression: the first claim that fell back to the queue during a replay
  // set state = PRIMARY_DEGRADED, which removed the RECOVERING admission cap
  // for the rest of the replay.
  it("F8: the recovery concurrency cap survives a queue fallback during replay", async () => {
    const { queue } = createInMemoryQueue();
    const replayed = receipt("req-queued");
    await queue.append({
      entryId: computeEmergencyEntryId(replayed),
      receipt: replayed,
    });

    let releaseReplay: (() => void) | undefined;
    const replayBlocked = new Promise<void>((resolve) => {
      releaseReplay = resolve;
    });
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: {
        async persist({ receipt: candidate }) {
          if (candidate.requestId === "req-queued") {
            await replayBlocked;
            return { outcome: "persisted", receiptId: "row-queued" };
          }
          // Every NEW claim fails against the primary and falls to the queue.
          throw new Error("primary down for new claims");
        },
      },
      emergencyQueue: queue,
      recoveryConcurrentClaimCap: 1,
    });

    const recovery = gate.recover();
    expect(gate.getState()).toBe("RECOVERING");

    // This claim degrades to the queue mid-replay. It must NOT clear the cap.
    const degraded = await gate.claimDispatch(receipt("req-d1"));
    expect(degraded.allowed).toBe(true);

    const burst = await Promise.all(
      ["req-d2", "req-d3", "req-d4", "req-d5", "req-d6"].map((requestId) =>
        gate.claimDispatch(receipt(requestId)),
      ),
    );
    const admitted = burst.filter((result) => result.allowed);
    expect(admitted).toHaveLength(1);
    for (const refused of burst.filter((result) => !result.allowed)) {
      if (!refused.allowed) {
        expect(refused.reason).toBe("recovery_rate_limited");
      }
    }

    releaseReplay?.();
    await recovery;
  });

  it("F8: the cap stays armed after an incomplete recovery until the primary is confirmed healthy", async () => {
    const { queue } = createInMemoryQueue();
    const entry = receipt("req-stuck");
    await queue.append({
      entryId: computeEmergencyEntryId(entry),
      receipt: entry,
    });
    let primaryDown = true;
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: {
        async persist({ receipt: candidate }) {
          if (primaryDown) throw new Error("primary down");
          return { outcome: "persisted", receiptId: `row-${candidate.requestId}` };
        },
      },
      emergencyQueue: queue,
      recoveryConcurrentClaimCap: 1,
    });

    await gate.recover();
    expect(gate.getState()).not.toBe("NORMAL");

    // Replay never completed: concurrent admission is still capped.
    primaryDown = false;
    const burst = await Promise.all([
      gate.claimDispatch(receipt("req-p1")),
      gate.claimDispatch(receipt("req-p2")),
      gate.claimDispatch(receipt("req-p3")),
    ]);
    expect(burst.filter((result) => result.allowed)).toHaveLength(1);

    // A completed replay against a healthy primary disarms the cap.
    expect(await gate.recover()).toMatchObject({ remaining: 0 });
    expect(gate.getState()).toBe("NORMAL");
    const after = await Promise.all([
      gate.claimDispatch(receipt("req-q1")),
      gate.claimDispatch(receipt("req-q2")),
      gate.claimDispatch(receipt("req-q3")),
    ]);
    expect(after.every((result) => result.allowed)).toBe(true);
  });

  it("keeps conflicting queue entries as evidence during recovery", async () => {
    let primaryDown = true;
    const { store, rows } = createInMemoryPrimaryStore({
      failWrites: () => primaryDown,
    });
    const { queue, entries } = createInMemoryQueue();
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: store,
      emergencyQueue: queue,
    });

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
