import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCaioAuditGate } from "@/lib/caio-audit-state/audit-gate.service";
import { createCaioEmergencyQueue } from "@/lib/caio-audit-state/emergency-queue";
import { createPrismaCaioAuditReceiptStore } from "@/lib/caio-audit-state/prisma-audit-receipt-store";
import type { CaioMinimalAuditReceipt } from "@/lib/caio-audit-state/audit-state-contracts";
import { caioReplayMarkerRequestId } from "@/lib/caio-audit-state/receipt-linkage";
import { db } from "@/lib/db";

const integrationDatabaseUrl = process.env.CAIO_AUDIT_STATE_DATABASE_URL;
const confirmedIntegrationDatabaseName =
  process.env.CAIO_AUDIT_STATE_TEST_DATABASE_NAME;
const describeMysql = integrationDatabaseUrl
  ? describe.sequential
  : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;
const ISOLATED_DATABASE_PREFIX = "helm_caio_audit_";

function assertIsolatedDatabaseTarget(): void {
  if (
    !integrationDatabaseUrl ||
    process.env.DATABASE_URL !== integrationDatabaseUrl
  ) {
    throw new Error(
      "DATABASE_URL must equal CAIO_AUDIT_STATE_DATABASE_URL for the isolated integration test.",
    );
  }
  let databaseName = "";
  try {
    const parsed = new URL(integrationDatabaseUrl);
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/u, ""));
  } catch {
    throw new Error(
      "CAIO_AUDIT_STATE_DATABASE_URL must be a valid isolated MySQL URL.",
    );
  }
  if (
    !databaseName.startsWith(ISOLATED_DATABASE_PREFIX) ||
    databaseName !== confirmedIntegrationDatabaseName
  ) {
    throw new Error(
      "Refusing caio-audit-state integration test: confirm the isolated database name and use the helm_caio_audit_ prefix.",
    );
  }
}

describeMysql("caio audit gate with an isolated MySQL primary store", () => {
  let workspaceId = "";
  let sandbox = "";
  const key = randomBytes(32);

  function receipt(
    requestId: string,
    overrides: Partial<CaioMinimalAuditReceipt> = {},
  ): CaioMinimalAuditReceipt {
    return {
      requestId,
      client: "workbuddy",
      workspace: workspaceId,
      modelAlias: "caio-default",
      inputHash: `sha256:${"a".repeat(64)}`,
      policyVersion: "policy-v3",
      ...overrides,
    };
  }

  beforeAll(async () => {
    assertIsolatedDatabaseTarget();
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "caio-audit-mysql-"));
    const workspace = await db.workspace.create({
      data: {
        name: `Caio audit state integration ${suffix}`,
        slug: `caio-audit-state-${suffix}`,
      },
    });
    workspaceId = workspace.id;
  });

  afterAll(async () => {
    await fs.rm(sandbox, { recursive: true, force: true });
    await db.$disconnect();
  });

  it("persists a durable primary receipt before allowing dispatch and replays idempotently", async () => {
    const gate = createCaioAuditGate({
      primaryStore: createPrismaCaioAuditReceiptStore(),
      emergencyQueue: createCaioEmergencyQueue({
        rootDir: path.join(sandbox, "queue-primary"),
        keyProvider: async () => key,
      }),
    });

    const first = await gate.claimDispatch(receipt(`req-primary-${suffix}`));
    expect(first).toMatchObject({ allowed: true, persistedVia: "primary" });
    const stored = await db.caioAuditDispatchReceipt.findUniqueOrThrow({
      where: {
        workspaceId_requestId: {
          workspaceId,
          requestId: `req-primary-${suffix}`,
        },
      },
    });
    expect(stored.persistedVia).toBe("primary");
    expect(stored.clientType).toBe("workbuddy");

    // F6: a repeat dispatch of the same [workspace, requestId] with identical
    // content stays idempotent for the caller (same receipt id, no duplicate
    // receipt row) but is no longer invisible: it is durably recorded as a
    // linked replay marker row and reported with its attempt ordinal.
    const replay = await gate.claimDispatch(receipt(`req-primary-${suffix}`));
    expect(replay.allowed).toBe(true);
    if (replay.allowed && first.allowed) {
      expect(replay.receiptId).toBe(first.receiptId);
      expect(replay.dispatchAttempt).toBe(2);
    }
    expect(
      await db.caioAuditDispatchReceipt.count({
        where: { workspaceId, requestId: `req-primary-${suffix}` },
      }),
    ).toBe(1);
    const replayMarker = await db.caioAuditDispatchReceipt.findUniqueOrThrow({
      where: {
        workspaceId_requestId: {
          workspaceId,
          requestId: caioReplayMarkerRequestId(`req-primary-${suffix}`, 2),
        },
      },
    });
    expect(replayMarker.inputHash).toBe(`sha256:${"a".repeat(64)}`);
    expect(replayMarker.persistedVia).toBe("primary");
    expect(
      await db.caioAuditDispatchReceipt.count({
        where: { workspaceId, requestId: { startsWith: `req-primary-${suffix}` } },
      }),
    ).toBe(2);

    const conflict = await gate.claimDispatch(
      receipt(`req-primary-${suffix}`, {
        inputHash: `sha256:${"b".repeat(64)}`,
      }),
    );
    expect(conflict.allowed).toBe(false);
  });

  it("degrades to the encrypted queue and recovers with persistedVia=emergency_replay", async () => {
    const primary = createPrismaCaioAuditReceiptStore();
    let primaryDown = true;
    const gate = createCaioAuditGate({
      primaryStore: {
        async persist(input) {
          if (primaryDown) {
            throw new Error("synthetic primary outage");
          }
          return primary.persist(input);
        },
      },
      emergencyQueue: createCaioEmergencyQueue({
        rootDir: path.join(sandbox, "queue-degraded"),
        keyProvider: async () => key,
      }),
    });

    const degraded = await gate.claimDispatch(receipt(`req-replay-${suffix}`));
    expect(degraded).toMatchObject({
      allowed: true,
      persistedVia: "emergency_queue",
    });
    expect(await gate.getReadiness()).toBe("degraded");
    expect(
      await db.caioAuditDispatchReceipt.count({
        where: { workspaceId, requestId: `req-replay-${suffix}` },
      }),
    ).toBe(0);

    primaryDown = false;
    const outcome = await gate.recover();
    expect(outcome).toMatchObject({ replayed: 1, remaining: 0 });
    expect(await gate.getReadiness()).toBe("ready");
    const replayedRow = await db.caioAuditDispatchReceipt.findUniqueOrThrow({
      where: {
        workspaceId_requestId: {
          workspaceId,
          requestId: `req-replay-${suffix}`,
        },
      },
    });
    expect(replayedRow.persistedVia).toBe("emergency_replay");

    // A second recover() must not duplicate anything.
    const again = await gate.recover();
    expect(again).toMatchObject({ replayed: 0, remaining: 0 });
    expect(
      await db.caioAuditDispatchReceipt.count({
        where: { workspaceId, requestId: `req-replay-${suffix}` },
      }),
    ).toBe(1);
  });
});
