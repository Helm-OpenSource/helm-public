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
      posture: "self_service",
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
      posture: "self_service",
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

  it("treats the same request recorded under another posture as a conflict, not a replay", async () => {
    // The gate refuses a claim naming a posture other than its own, so this
    // interleaving needs two differently-postured deployments sharing one
    // workspace's rows — which is a deployment topology, not a code path the
    // gate can rule out. The STORE is therefore the last line: posture is the
    // receipt's seventh field and part of its digest, so a duplicate
    // [workspaceId, requestId] carrying a different posture describes a
    // different dispatch and must not resolve as an idempotent replay.
    const store = createPrismaCaioAuditReceiptStore();
    const requestId = `req-posture-${suffix}`;
    const now = new Date();

    const first = await store.persist({
      receipt: receipt(requestId, { posture: "self_service" }),
      persistedVia: "primary",
      now,
    });
    expect(first.outcome).toBe("persisted");

    const crossPosture = await store.persist({
      receipt: receipt(requestId, { posture: "governed_fde" }),
      persistedVia: "primary",
      now,
    });
    expect(crossPosture.outcome).toBe("conflict");

    // An identical re-persist under the ORIGINAL posture must still be a
    // replay: the new column narrows what counts as the same receipt, it does
    // not turn every duplicate into a conflict.
    const samePosture = await store.persist({
      receipt: receipt(requestId, { posture: "self_service" }),
      persistedVia: "primary",
      now,
    });
    expect(samePosture.outcome).toBe("replayed");

    const stored = await db.caioAuditDispatchReceipt.findUniqueOrThrow({
      where: { workspaceId_requestId: { workspaceId, requestId } },
      select: { posture: true },
    });
    expect(stored.posture).toBe("self_service");
  });

  // WHY THIS TEST RUNS SQL RATHER THAN ASSERTING A COMMENT.
  //
  // The first draft of the posture migration added the column `NOT NULL` with
  // no default and asserted, in a comment, that the statement would FAIL if
  // historical rows existed — and therefore that no row could ever be given a
  // posture it did not have. That claim was never executed against a populated
  // table. It is false: on MySQL 8.4 in the default strict mode the ALTER
  // succeeds and silently backfills every existing row with the empty string,
  // which is precisely the "invent a posture for rows whose posture is
  // unknown" outcome the comment claimed to prevent.
  //
  // So both halves are MEASURED here, on a scratch table shaped like the
  // pre-migration receipt table:
  //   (a) the counterfactual — the NOT NULL form really does succeed and
  //       really does write '' — so that if a future MySQL changes this, the
  //       test says so instead of a comment quietly going stale again;
  //   (b) the shipped phase-1 statements, read VERBATIM from migration.sql
  //       rather than paraphrased, leaving legacy rows NULL and refusing any
  //       non-NULL value outside the posture vocabulary.
  it("upgrades a POPULATED table by quarantining legacy rows as NULL, never by inventing a posture", async () => {
    const legacyColumns = `
      \`id\` VARCHAR(191) NOT NULL,
      \`workspaceId\` VARCHAR(191) NOT NULL,
      \`requestId\` VARCHAR(191) NOT NULL,
      \`clientType\` VARCHAR(191) NOT NULL,
      \`modelAlias\` VARCHAR(191) NOT NULL,
      \`inputHash\` VARCHAR(191) NOT NULL,
      \`policyVersion\` VARCHAR(191) NOT NULL,
      \`persistedVia\` VARCHAR(191) NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL,
      PRIMARY KEY (\`id\`)
    `;
    const naive = `caio_posture_naive_${process.pid}`;
    const phase1 = `caio_posture_phase1_${process.pid}`;
    const seed = async (table: string) => {
      await db.$executeRawUnsafe(
        `CREATE TABLE \`${table}\` (${legacyColumns}) DEFAULT CHARACTER SET utf8mb4`,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO \`${table}\` VALUES ` +
          `('r1','ws','req-1','workbuddy','caio-default','sha256:a','policy-v3','primary',UTC_TIMESTAMP(3)),` +
          `('r2','ws','req-2','workbuddy','caio-default','sha256:b','policy-v3','primary',UTC_TIMESTAMP(3))`,
      );
    };

    try {
      // (a) THE COUNTERFACTUAL. This is the statement the old comment said
      // would fail. It does not fail.
      await seed(naive);
      await db.$executeRawUnsafe(
        `ALTER TABLE \`${naive}\` ADD COLUMN \`posture\` VARCHAR(191) NOT NULL`,
      );
      const naiveRows = await db.$queryRawUnsafe<
        { id: string; posture: string | null }[]
      >(`SELECT \`id\`, \`posture\` FROM \`${naive}\` ORDER BY \`id\``);
      expect(naiveRows).toHaveLength(2);
      // Not an endorsement — a record of the behaviour that made the comment
      // false. Every historical row now carries a posture it never had.
      expect(naiveRows.map((row) => row.posture)).toEqual(["", ""]);

      // (b) THE SHIPPED MIGRATION, verbatim. Reading the file keeps this test
      // bound to what actually deploys; a paraphrase could drift from it and
      // still pass.
      await seed(phase1);
      const migrationSql = await fs.readFile(
        path.join(
          process.cwd(),
          "prisma/migrations/20260731120000_caio_audit_receipt_posture/migration.sql",
        ),
        "utf8",
      );
      const statements = migrationSql
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("--"))
        .join("\n")
        .split(";")
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0)
        .map((statement) =>
          statement
            .replaceAll("CaioAuditDispatchReceipt_posture_chk", `${phase1}_chk`)
            .replaceAll("CaioAuditDispatchReceipt", phase1),
        );
      // Two statements: the nullable ADD COLUMN and the closed-set CHECK. If
      // the migration grows a third, this assertion forces a look at it.
      expect(statements).toHaveLength(2);
      for (const statement of statements) {
        await db.$executeRawUnsafe(statement);
      }

      const upgraded = await db.$queryRawUnsafe<
        { id: string; posture: string | null }[]
      >(`SELECT \`id\`, \`posture\` FROM \`${phase1}\` ORDER BY \`id\``);
      expect(upgraded).toHaveLength(2);
      // LEGACY UNKNOWN. Not '', not a default, not a guess.
      expect(upgraded.map((row) => row.posture)).toEqual([null, null]);

      // The closed set is enforced by the database for non-NULL values, so a
      // repair script or manual insert cannot introduce a third posture — or
      // reintroduce the empty string the naive form produced above.
      await expect(
        db.$executeRawUnsafe(
          `INSERT INTO \`${phase1}\` VALUES ('r3','ws','req-3','workbuddy','caio-default','sha256:c','policy-v3','primary',UTC_TIMESTAMP(3),'')`,
        ),
      ).rejects.toThrow();
      await expect(
        db.$executeRawUnsafe(
          `INSERT INTO \`${phase1}\` VALUES ('r4','ws','req-4','workbuddy','caio-default','sha256:d','policy-v3','primary',UTC_TIMESTAMP(3),'lenient')`,
        ),
      ).rejects.toThrow();
      // Both vocabulary members are accepted, so the CHECK is not merely
      // rejecting everything.
      for (const [id, posture] of [
        ["r5", "self_service"],
        ["r6", "governed_fde"],
      ]) {
        await db.$executeRawUnsafe(
          `INSERT INTO \`${phase1}\` VALUES ('${id}','ws','req-${id}','workbuddy','caio-default','sha256:e','policy-v3','primary',UTC_TIMESTAMP(3),'${posture}')`,
        );
      }
      expect(
        await db.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT COUNT(*) AS n FROM \`${phase1}\` WHERE \`posture\` IS NOT NULL`,
        ),
      ).toEqual([{ n: 2n }]);
    } finally {
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${naive}\``);
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${phase1}\``);
    }
  });

  it("never lets a legacy-unknown (NULL) posture certify a new dispatch as a replay", async () => {
    // The row a real upgrade leaves behind: content identical to what a live
    // deployment would write, except its posture is unknown. If NULL compared
    // equal — or were treated as "matches anything" — the store would answer
    // "replayed" for a dispatch it holds no posture evidence about, which is
    // the replay-vs-conflict bug the column was added to close, arriving
    // through the one row that can least afford it.
    const store = createPrismaCaioAuditReceiptStore();
    const requestId = `req-legacy-null-${suffix}`;
    await db.caioAuditDispatchReceipt.create({
      data: {
        id: `legacy-${suffix}`,
        workspaceId,
        requestId,
        clientType: "workbuddy",
        modelAlias: "caio-default",
        inputHash: `sha256:${"a".repeat(64)}`,
        policyVersion: "policy-v3",
        posture: null,
        persistedVia: "primary",
        createdAt: new Date(),
      },
    });

    for (const posture of ["self_service", "governed_fde"] as const) {
      const outcome = await store.persist({
        receipt: receipt(requestId, { posture }),
        persistedVia: "primary",
        now: new Date(),
      });
      expect(outcome.outcome).toBe("conflict");
    }

    // The legacy row is left exactly as it was: resolving a conflict is not a
    // licence to fill in the missing posture.
    const stored = await db.caioAuditDispatchReceipt.findUniqueOrThrow({
      where: { workspaceId_requestId: { workspaceId, requestId } },
      select: { posture: true },
    });
    expect(stored.posture).toBeNull();
  });

  it("degrades to the encrypted queue and recovers with persistedVia=emergency_replay", async () => {
    const primary = createPrismaCaioAuditReceiptStore();
    let primaryDown = true;
    const gate = createCaioAuditGate({
      posture: "self_service",
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
