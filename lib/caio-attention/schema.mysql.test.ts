import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CAIO_ATTENTION_FIXTURE_IDENTITIES, caioAttentionTableGrant, type CaioAttentionFixtureIdentity, type CaioAttentionPrivilege } from "./least-privilege-fixture";
import { CAIO_ATTENTION_TABLES, probeCaioAttentionSchemaReadiness, type CaioAttentionTable } from "./schema-readiness";

/**
 * CAIO attention tables on an isolated MySQL database, exercised through the three least-privilege fixture identities.
 *
 *   CAIO_ATTENTION_DATABASE_URL=<disposable helm_caio_attention_* db, migration identity> DATABASE_URL=<same>
 *   CAIO_ATTENTION_{GENERATOR,WEB,OPS}_DATABASE_URL=<fixture identities on the same db, granted by
 *     scripts/caio-attention-grant-fixture.ts>
 *   npm run test:caio-attention:mysql   (sets CAIO_ATTENTION_MYSQL_REQUIRED=1: a missing URL fails instead of skipping)
 */
const urls = {
  admin: process.env.CAIO_ATTENTION_DATABASE_URL,
  attention_generator: process.env.CAIO_ATTENTION_GENERATOR_DATABASE_URL,
  attention_web: process.env.CAIO_ATTENTION_WEB_DATABASE_URL,
  attention_ops: process.env.CAIO_ATTENTION_OPS_DATABASE_URL,
};
const configured = Object.values(urls).every(Boolean);
if (process.env.CAIO_ATTENTION_MYSQL_REQUIRED === "1" && !configured) {
  throw new Error("CAIO_ATTENTION_MYSQL_REQUIRED=1 but a CAIO_ATTENTION_*_DATABASE_URL is missing.");
}
const describeMysql = configured ? describe.sequential : describe.skip;

function assertDisposableDatabase() {
  const admin = new URL(urls.admin!);
  if (process.env.DATABASE_URL !== urls.admin || !admin.pathname.slice(1).startsWith("helm_caio_attention_")) {
    throw new Error("DATABASE_URL must equal CAIO_ATTENTION_DATABASE_URL and name a disposable helm_caio_attention_* database.");
  }
  for (const identity of CAIO_ATTENTION_FIXTURE_IDENTITIES) {
    const url = new URL(urls[identity]!);
    if (url.host !== admin.host || url.pathname !== admin.pathname || url.username !== identity) {
      throw new Error(`CAIO_ATTENTION ${identity} URL must use user ${identity} on the same database.`);
    }
  }
}

/** MySQL errno of a failed raw query (Prisma reports it as meta.code on P2010), or null when the statement succeeded. */
async function errnoOf(statement: Promise<unknown>): Promise<string | null> {
  try {
    await statement;
    return null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const code = (error.meta as { code?: unknown } | undefined)?.code;
      if (code !== undefined) return String(code);
      if (error.code === "P2002") return "1062";
    }
    return `unclassified: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const PROBES: Record<CaioAttentionPrivilege, (table: string, column: string) => string> = {
  SELECT: (table) => `SELECT COUNT(*) AS n FROM \`${table}\` WHERE 1 = 0`,
  INSERT: (table) => `INSERT INTO \`${table}\` (\`id\`) SELECT 'probe' FROM DUAL WHERE 1 = 0`,
  UPDATE: (table, column) => `UPDATE \`${table}\` SET \`${column}\` = \`${column}\` WHERE 1 = 0`,
  DELETE: (table) => `DELETE FROM \`${table}\` WHERE 1 = 0`,
};

describeMysql("CAIO attention control plane on MySQL with least-privilege identities", () => {
  const clients = {} as Record<"admin" | CaioAttentionFixtureIdentity, PrismaClient>;
  let admin: PrismaClient, generator: PrismaClient, web: PrismaClient, ops: PrismaClient;

  /** The intake gate every entry runs: FOR SHARE on Control, then no pause request at the open epoch. */
  async function gateOpen(client: PrismaClient) {
    return client.$transaction(async (tx) => {
      const [control] = await tx.$queryRaw<Array<{ intakeState: string; openEpoch: number }>>`
        SELECT intakeState, openEpoch FROM CaioAttentionControl WHERE id = 'global' FOR SHARE`;
      const [pending] = await tx.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(*) AS n FROM CaioAttentionPauseRequest WHERE openEpoch = ${control.openEpoch}`;
      return control.intakeState === "OPEN" && Number(pending.n) === 0;
    });
  }

  /** Pause write path (REREVIEW5 P2-2): read the open epoch under FOR SHARE, then INSERT, in one transaction. */
  async function requestPause(client: PrismaClient, ref: string, beforeLock?: () => void) {
    return client.$transaction(async (tx) => {
      beforeLock?.();
      const [control] = await tx.$queryRaw<Array<{ openEpoch: number }>>`
        SELECT openEpoch FROM CaioAttentionControl WHERE id = 'global' FOR SHARE`;
      await tx.$executeRaw`INSERT INTO CaioAttentionPauseRequest (id, openEpoch, reasonCode, requestedByRef)
        VALUES (${`pr-${ref}`}, ${control.openEpoch}, 'node_heartbeat_stale', ${ref})`;
      return control.openEpoch;
    }, { timeout: 20_000 });
  }

  /** Operator resume: openEpoch := max(openEpoch, max(PauseRequest.openEpoch)) + 1, under FOR UPDATE. */
  async function resume(hold?: Promise<void>, locked?: () => void) {
    return ops.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM CaioAttentionControl WHERE id = 'global' FOR UPDATE`;
      locked?.();
      await tx.$executeRaw`UPDATE CaioAttentionControl c
        JOIN (SELECT COALESCE(MAX(openEpoch), -1) AS m FROM CaioAttentionPauseRequest) p
        SET c.intakeState = 'OPEN', c.openEpoch = GREATEST(c.openEpoch, p.m) + 1, c.rowVersion = c.rowVersion + 1,
            c.updatedByRef = 'test:resume'
        WHERE c.id = 'global'`;
      await hold;
      const [row] = await tx.$queryRaw<Array<{ openEpoch: number }>>`SELECT openEpoch FROM CaioAttentionControl WHERE id = 'global'`;
      return row.openEpoch;
    }, { timeout: 20_000 });
  }

  beforeAll(async () => {
    assertDisposableDatabase();
    for (const key of ["admin", ...CAIO_ATTENTION_FIXTURE_IDENTITIES] as const) {
      clients[key] = new PrismaClient({ datasources: { db: { url: urls[key]! } } });
    }
    ({ admin, attention_generator: generator, attention_web: web, attention_ops: ops } = clients);
  });

  beforeEach(async () => {
    await admin.$executeRaw`DELETE FROM CaioAttentionPauseRequest`;
    await admin.$executeRaw`DELETE FROM CaioAttentionNodeReadiness`;
    await admin.$executeRaw`DELETE FROM CaioAttentionRuntimeNode`;
    await admin.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'PAUSED', epoch = 0, openEpoch = 0, leaseToken = NULL,
      leaseNodeId = NULL, leaseTargetDeploymentId = NULL, leaseAcquiredAt = NULL, leaseExpiresAt = NULL WHERE id = 'global'`;
  });

  afterAll(async () => {
    await Promise.all(Object.values(clients).map((client) => client.$disconnect()));
  });

  it("seeds exactly one fail-closed Control row and every identity sees a ready schema", async () => {
    const rows = await admin.$queryRaw<Array<Record<string, unknown>>>`
      SELECT id, intakeState, requiredCloseCapability, minGuardVersion, expectedNodesJson FROM CaioAttentionControl`;
    expect(rows).toEqual([{ id: "global", intakeState: "PAUSED", requiredCloseCapability: 1, minGuardVersion: 1, expectedNodesJson: "[]" }]);
    expect(await errnoOf(admin.$executeRaw`INSERT INTO CaioAttentionControl (id, expectedNodesJson, updatedByRef) VALUES ('second', '[]', 't')`)).toBe("3819");
    for (const key of ["admin", ...CAIO_ATTENTION_FIXTURE_IDENTITIES] as const) {
      const visible = key === "admin" ? CAIO_ATTENTION_TABLES : CAIO_ATTENTION_TABLES.filter((table) => caioAttentionTableGrant(key, table));
      await expect(probeCaioAttentionSchemaReadiness(clients[key], visible)).resolves.toEqual({ ready: true, tables: visible });
    }
  });

  it("enforces the grant matrix exactly: every unlisted privilege is refused with errno 1142", async () => {
    const failures: string[] = [];
    for (const identity of CAIO_ATTENTION_FIXTURE_IDENTITIES) {
      for (const table of CAIO_ATTENTION_TABLES as CaioAttentionTable[]) {
        const grant = caioAttentionTableGrant(identity, table);
        for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"] as const) {
          const allowed = grant?.privileges.includes(privilege) ?? false;
          const column = privilege === "UPDATE" && grant?.updateColumns ? grant.updateColumns[0] : "id";
          const got = await errnoOf(clients[identity].$executeRawUnsafe(PROBES[privilege](table, column)));
          if (got !== (allowed ? null : "1142")) failures.push(`${identity} ${privilege} ${table}: ${got ?? "allowed"}`);
          if (privilege === "UPDATE" && grant?.updateColumns) {
            const other = await errnoOf(clients[identity].$executeRawUnsafe(PROBES.UPDATE(table, "epoch")));
            if (other !== "1143") failures.push(`${identity} UPDATE ${table}.epoch: ${other ?? "allowed"}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("the web identity cannot reopen intake: any UPDATE of Control is refused with errno 1142", async () => {
    await resume();
    await requestPause(web, "watchdog:1");
    expect(await gateOpen(generator)).toBe(false);
    for (const statement of [
      web.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'OPEN' WHERE id = 'global'`,
      web.$executeRaw`UPDATE CaioAttentionControl SET openEpoch = openEpoch + 1 WHERE id = 'global'`,
      web.$queryRaw`SELECT id FROM CaioAttentionControl WHERE id = 'global' FOR UPDATE`,
      web.$executeRaw`UPDATE CaioAttentionPauseRequest SET openEpoch = 99`,
      web.$executeRaw`DELETE FROM CaioAttentionPauseRequest`,
    ]) {
      expect(await errnoOf(statement)).toBe("1142");
    }
    expect(await gateOpen(generator)).toBe(false);
  });

  it("serialises a pause against resume, so a pause can never land on a superseded epoch", async () => {
    expect(await resume()).toBe(1);
    expect(await gateOpen(generator)).toBe(true);
    expect(await requestPause(web, "node:a")).toBe(1);
    expect(await gateOpen(generator)).toBe(false);
    expect(await errnoOf(requestPause(web, "node:a"))).toBe("1062");
    expect(await errnoOf(web.$executeRaw`INSERT INTO CaioAttentionPauseRequest (id, openEpoch, reasonCode, requestedByRef)
      VALUES ('pr-bad', 1, 'reopen', 'x')`)).toBe("3819");

    let release!: () => void;
    let locked!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const isLocked = new Promise<void>((resolve) => { locked = resolve; });
    const resumed = resume(hold, locked);
    await isLocked;
    let pauseSettled = false;
    const pause = requestPause(web, "node:b").finally(() => { pauseSettled = true; });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(pauseSettled).toBe(false);
    release();
    const newEpoch = await resumed;
    expect(newEpoch).toBe(2);
    expect(await pause).toBe(newEpoch);
    expect(await gateOpen(generator)).toBe(false);

    await web.$executeRaw`INSERT INTO CaioAttentionPauseRequest (id, openEpoch, reasonCode, requestedByRef)
      VALUES ('pr-forged', 1000, 'watchdog', 'forged')`;
    expect(await resume()).toBe(1001);
    expect(await gateOpen(generator)).toBe(true);
  });

  it("numbers readiness proofs so a revocation at epoch E only invalidates proofs up to E", async () => {
    async function deployCycle(node: string) {
      await ops.$transaction(async (tx) => {
        const [{ epoch }] = await tx.$queryRaw<Array<{ epoch: number }>>`SELECT epoch FROM CaioAttentionControl WHERE id = 'global' FOR UPDATE`;
        await tx.$executeRaw`UPDATE CaioAttentionNodeReadiness SET revokedAt = NOW(3), revokedByRef = 'test:begin', revokedEpoch = ${epoch}
          WHERE nodeId = ${node} AND revokedAt IS NULL`;
        await tx.$executeRaw`UPDATE CaioAttentionControl SET epoch = epoch + 1, intakeState = 'DEPLOYING', leaseToken = 't',
          leaseNodeId = ${node}, leaseTargetDeploymentId = 'd', leaseAcquiredAt = NOW(3), leaseExpiresAt = NOW(3) + INTERVAL 30 MINUTE
          WHERE id = 'global'`;
        await tx.$executeRaw`INSERT INTO CaioAttentionNodeReadiness (id, nodeId, deploymentId, closeCapabilityVersion, guardVersion,
          epoch, verifiedAt, verifiedByRef) VALUES (${`${node}-${epoch + 1}`}, ${node}, 'd', 1, 1, ${epoch + 1}, NOW(3), 'test:attest')`;
        await tx.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'PAUSED', leaseToken = NULL, leaseNodeId = NULL,
          leaseTargetDeploymentId = NULL, leaseAcquiredAt = NULL, leaseExpiresAt = NULL WHERE id = 'global'`;
      });
    }
    const valid = () => ops.$queryRaw<Array<{ id: string }>>`SELECT r.id FROM CaioAttentionNodeReadiness r
      WHERE r.revokedAt IS NULL AND r.epoch > COALESCE((SELECT MAX(x.revokedEpoch) FROM CaioAttentionNodeReadiness x
        WHERE x.nodeId = r.nodeId), -1) ORDER BY r.id`;
    await deployCycle("node-x");
    await deployCycle("node-y");
    await deployCycle("node-x");
    expect(await valid()).toEqual([{ id: "node-x-3" }, { id: "node-y-2" }]);
    expect(await errnoOf(ops.$executeRaw`UPDATE CaioAttentionNodeReadiness SET revokedAt = NOW(3), revokedByRef = 'x', revokedEpoch = 0
      WHERE id = 'node-x-3'`)).toBe("3819");
    expect(await errnoOf(ops.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'DEPLOYING' WHERE id = 'global'`)).toBe("3819");
  });

  it("lets generator and web upsert their own heartbeat while the operator cannot write one", async () => {
    for (const [client, node] of [[generator, "caio-1"], [web, "web-1"], [web, "web-1"]] as const) {
      await client.$executeRaw`INSERT INTO CaioAttentionRuntimeNode (id, nodeId, role, deploymentId, closeCapabilityVersion, lastSeenAt)
        VALUES (${`rn-${node}`}, ${node}, 'r', 'd', 1, NOW(3))
        ON DUPLICATE KEY UPDATE deploymentId = VALUES(deploymentId), lastSeenAt = VALUES(lastSeenAt)`;
    }
    const [count] = await admin.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(*) AS n FROM CaioAttentionRuntimeNode`;
    expect(Number(count.n)).toBe(2);
    expect(await errnoOf(ops.$executeRaw`INSERT INTO CaioAttentionRuntimeNode (id, nodeId, role, deploymentId, closeCapabilityVersion,
      lastSeenAt) VALUES ('rn-ops', 'ops', 'r', 'd', 1, NOW(3))`)).toBe("1142");
  });
});
