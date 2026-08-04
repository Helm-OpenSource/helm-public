// Deployment posture behaviour of the audit gate (owner ruling, 2026-07-30).
//
// Two postures ship. This file pins the three properties that make them two
// postures rather than one product with a switch:
//   1. self_service keeps serving through the encrypted emergency queue when
//      the primary store is down, and reports degraded readiness.
//   2. governed_fde refuses instead, and CANNOT write to a queue even when one
//      is smuggled past the type system.
//   3. Neither can impersonate the other: the posture is stamped into every
//      receipt and a claim naming the other posture is refused.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  caioReceiptDigest,
  type CaioMinimalAuditReceipt,
} from "@/lib/caio-audit-state/audit-state-contracts";
import {
  CaioAuditPostureMismatchError,
  createCaioAuditGate,
  type CaioAuditGateDependencies,
  type CaioAuditPrimaryStorePort,
} from "@/lib/caio-audit-state/audit-gate.service";
import { createCaioNoDegradedAdmission } from "@/lib/caio-audit-state/degraded-admission";
import type { CaioEmergencyQueuePort } from "@/lib/caio-audit-state/emergency-queue";

function claim(requestId: string) {
  return {
    requestId,
    client: "codex",
    workspace: "ws-posture",
    modelAlias: "caio-codex-default",
    inputHash: `sha256:${"d".repeat(64)}`,
    policyVersion: "policy-v3",
  };
}

/** Primary store that can be switched off, recording everything it took. */
function createPrimaryStore(options: { failing?: boolean } = {}) {
  let failing = options.failing ?? false;
  const rows: CaioMinimalAuditReceipt[] = [];
  const store: CaioAuditPrimaryStorePort = {
    async persist({ receipt }) {
      if (failing) throw new Error("primary store unreachable");
      rows.push(receipt);
      return { outcome: "persisted", receiptId: `row-${rows.length}` };
    },
  };
  return {
    store,
    rows,
    setFailing(next: boolean) {
      failing = next;
    },
  };
}

function createSpyQueue() {
  const entries = new Map<string, CaioMinimalAuditReceipt>();
  const append = vi.fn(
    async (input: { entryId: string; receipt: CaioMinimalAuditReceipt }) => {
      const deduplicated = entries.has(input.entryId);
      entries.set(input.entryId, input.receipt);
      return { entryId: input.entryId, deduplicated };
    },
  );
  const queue: CaioEmergencyQueuePort = {
    append,
    async list() {
      return [...entries.entries()].map(([entryId, receipt]) => ({
        entryId,
        receipt,
      }));
    },
    async remove(entryId) {
      entries.delete(entryId);
    },
    async size() {
      return entries.size;
    },
  };
  return { queue, append, entries };
}

describe("caio audit gate deployment posture", () => {
  it("fails construction when no posture is declared", () => {
    const primary = createPrimaryStore();
    const { queue } = createSpyQueue();
    expect(() =>
      createCaioAuditGate({
        primaryStore: primary.store,
        emergencyQueue: queue,
      } as unknown as CaioAuditGateDependencies),
    ).toThrow(/caio_deployment_posture_invalid/u);
  });

  // "不得从环境推断，不得由请求参数选择" — the posture is a declared deployment
  // property. No source file in the three CAIO gateway modules may read it (or
  // anything else) from the process environment.
  it("is never derivable from the process environment", () => {
    const roots = [
      "lib/caio-audit-state",
      "lib/caio-model-proxy",
      "lib/caio-access-gateway",
    ];
    const offenders: string[] = [];
    for (const root of roots) {
      const stack = [root];
      while (stack.length > 0) {
        const dir = stack.pop();
        if (dir === undefined) break;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            stack.push(full);
            continue;
          }
          if (!entry.name.endsWith(".ts")) continue;
          if (entry.name.endsWith(".test.ts")) continue;
          if (readFileSync(full, "utf8").includes("process.env")) {
            offenders.push(full);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("fails construction when the posture is outside the vocabulary", () => {
    const primary = createPrimaryStore();
    const { queue } = createSpyQueue();
    expect(() =>
      createCaioAuditGate({
        posture: "best_effort",
        primaryStore: primary.store,
        emergencyQueue: queue,
      } as unknown as CaioAuditGateDependencies),
    ).toThrow(/caio_deployment_posture_invalid/u);
  });

  it("fails construction when self_service is wired without a queue", () => {
    const primary = createPrimaryStore();
    expect(() =>
      createCaioAuditGate({
        posture: "self_service",
        primaryStore: primary.store,
      } as unknown as CaioAuditGateDependencies),
    ).toThrow(/caio_deployment_posture_invalid/u);
  });

  // Availability first: the request proceeds, the receipt is durable in the
  // queue, and readiness says degraded rather than ready.
  it("self_service keeps serving through the queue while the primary store is down", async () => {
    const primary = createPrimaryStore({ failing: true });
    const { queue, append } = createSpyQueue();
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: primary.store,
      emergencyQueue: queue,
    });

    const result = await gate.claimDispatch(claim("req-self-1"));
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.persistedVia).toBe("emergency_queue");
      expect(result.receiptId.length).toBeGreaterThan(0);
    }
    expect(append).toHaveBeenCalledTimes(1);
    expect(primary.rows).toEqual([]);
    expect(gate.getState()).toBe("PRIMARY_DEGRADED");
    expect(await gate.getReadiness()).toBe("degraded");
    // The queued receipt names the posture that produced it.
    expect(append.mock.calls[0]?.[0].receipt.posture).toBe("self_service");
  });

  // Safety first: 503, nothing durable, nothing queued — and the queue is not
  // merely unused, it is not reachable.
  it("governed_fde refuses when the primary store is down and writes no queue entry", async () => {
    const primary = createPrimaryStore({ failing: true });
    const { queue, append, entries } = createSpyQueue();
    // A queue smuggled past the type system (`as never` is what a JS caller or
    // a bad merge would produce). The governed admission strategy takes no
    // queue argument at all, so this one can never be consulted.
    const gate = createCaioAuditGate({
      posture: "governed_fde",
      primaryStore: primary.store,
      emergencyQueue: queue,
    } as unknown as CaioAuditGateDependencies);

    const result = await gate.claimDispatch(claim("req-governed-1"));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.errorCode).toBe("caio_audit_unavailable");
      expect(result.httpStatus).toBe(503);
    }
    expect(append).not.toHaveBeenCalled();
    expect(entries.size).toBe(0);
    expect(primary.rows).toEqual([]);
    expect(gate.getState()).toBe("AUDIT_UNAVAILABLE");
    expect(await gate.getReadiness()).toBe("unavailable");
    // There is no backlog to recover: recovery is a no-op, not a queue walk.
    expect(await gate.recover()).toEqual({
      replayed: 0,
      remaining: 0,
      conflicts: 0,
    });
    expect(append).not.toHaveBeenCalled();
  });

  it("governed_fde never reports the degraded (queue-backed) readiness", async () => {
    const primary = createPrimaryStore();
    const gate = createCaioAuditGate({
      posture: "governed_fde",
      primaryStore: primary.store,
    });
    expect(await gate.getReadiness()).toBe("ready");
    primary.setFailing(true);
    await gate.claimDispatch(claim("req-governed-2"));
    expect(await gate.getReadiness()).toBe("unavailable");
  });

  it("has no degraded admission that can succeed under governed_fde", async () => {
    const admission = createCaioNoDegradedAdmission();
    expect(admission.backlog).toBeNull();
    const outcome = await admission.admitWithoutPrimary(
      { ...claim("req-x"), posture: "governed_fde" },
      "entry-id-000001",
    );
    expect(outcome.admitted).toBe(false);
    expect(outcome.reason).toBe("no_degraded_path");
  });

  it("stamps its own posture on every receipt it persists", async () => {
    const primary = createPrimaryStore();
    const gate = createCaioAuditGate({
      posture: "governed_fde",
      primaryStore: primary.store,
    });
    expect(gate.posture).toBe("governed_fde");
    await gate.claimDispatch(claim("req-stamp-1"));
    expect(primary.rows[0]?.posture).toBe("governed_fde");
  });

  // A receipt produced under one posture cannot be read as the other: the gate
  // refuses the claim outright, and the content digests differ, so no store
  // can equate the two either.
  it("refuses a claim that names the other posture, and digests differ", async () => {
    const primary = createPrimaryStore();
    const { queue } = createSpyQueue();
    const gate = createCaioAuditGate({
      posture: "self_service",
      primaryStore: primary.store,
      emergencyQueue: queue,
    });
    await expect(
      gate.claimDispatch({
        ...claim("req-cross-1"),
        posture: "governed_fde",
      }),
    ).rejects.toBeInstanceOf(CaioAuditPostureMismatchError);
    expect(primary.rows).toEqual([]);

    await gate.claimDispatch(claim("req-cross-2"));
    const stored = primary.rows[0];
    expect(stored).toBeDefined();
    if (!stored) return;
    expect(caioReceiptDigest(stored)).not.toBe(
      caioReceiptDigest({ ...stored, posture: "governed_fde" }),
    );
  });
});
