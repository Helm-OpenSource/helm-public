import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { appendCaioAttentionControlEvent } from "./control-event.service";
import { readCaioAttentionIntakeGate } from "./intake-gate.service";
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

describeMysql("CAIO attention tables on MySQL with least-privilege identities", () => {
  const clients = {} as Record<"admin" | CaioAttentionFixtureIdentity, PrismaClient>;
  let admin: PrismaClient, generator: PrismaClient, web: PrismaClient, ops: PrismaClient;

  /** The intake gate every entry runs (intake-gate.service.ts): FOR SHARE on Control, then no pause request at the open epoch. */
  async function gateOpen(client: PrismaClient) {
    return client.$transaction(async (tx) => (await readCaioAttentionIntakeGate(tx)).open);
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
            c.updatedByRef = 'test:resume', c.updatedAt = NOW(3)
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
    await admin.$executeRaw`DELETE FROM CaioAttentionControlEvent`;
    await admin.$executeRaw`DELETE FROM CaioAttentionPauseRequest`;
    await admin.$executeRaw`DELETE FROM CaioAttentionNodeReadiness`;
    await admin.$executeRaw`DELETE FROM CaioAttentionRuntimeNode`;
    for (const table of ["CaioAttentionCase", "CaioAttentionCaseEvent", "CaioAttentionDisposition", "CaioAttentionReview",
      "CaioAttentionRouteConfig", "CaioAttentionRouteConfigHead", "CaioDetectorEvaluation"]) {
      await admin.$executeRawUnsafe(`DELETE FROM \`${table}\``);
    }
    await admin.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'PAUSED', epoch = 0, openEpoch = 0, leaseToken = NULL,
      leaseNodeId = NULL, leaseTargetDeploymentId = NULL, leaseAcquiredAt = NULL, leaseExpiresAt = NULL, updatedAt = NOW(3)
      WHERE id = 'global'`;
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

  it("keeps the control event trail append-only: operator INSERT only, closed op set, epochs per op kind", async () => {
    const event = { op: "resume", actorRef: "operator:t", epoch: 0, openEpoch: 1, payload: { acknowledgedPauseRequestIds: ["pr-1"] } } as const;
    const id = await ops.$transaction((tx) => appendCaioAttentionControlEvent(tx, event));
    await ops.$transaction((tx) => appendCaioAttentionControlEvent(tx, { ...event, op: "routes-publish", epoch: null, openEpoch: null }));
    expect(await ops.$queryRaw`SELECT op, actorRef, epoch, openEpoch, payloadJson FROM CaioAttentionControlEvent WHERE id = ${id}`)
      .toEqual([{ op: "resume", actorRef: "operator:t", epoch: 0, openEpoch: 1, payloadJson: "{\"acknowledgedPauseRequestIds\":[\"pr-1\"]}" }]);
    expect(await errnoOf(ops.$executeRaw`UPDATE CaioAttentionControlEvent SET op = 'pause' WHERE id = ${id}`)).toBe("1142");
    expect(await errnoOf(ops.$executeRaw`DELETE FROM CaioAttentionControlEvent WHERE id = ${id}`)).toBe("1142");
    for (const client of [web, generator]) {
      expect(await errnoOf(client.$transaction((tx) => appendCaioAttentionControlEvent(tx, event)))).toBe("1142");
    }
    const insert = (op: string, epoch: number | null, payloadJson = "{}") => ops.$executeRaw`INSERT INTO CaioAttentionControlEvent
      (id, op, actorRef, epoch, openEpoch, payloadJson) VALUES (${`ce-${op}-${String(epoch)}`}, ${op}, 'operator:t', ${epoch}, ${epoch}, ${payloadJson})`;
    expect(await errnoOf(insert("bogus", 0))).toBe("3819");
    expect(await errnoOf(insert("guard-downgrade", null))).toBe("3819");
    expect(await errnoOf(insert("routes-activate", 0))).toBe("3819");
    expect(await errnoOf(insert("pause", -1))).toBe("3819");
    expect(await errnoOf(insert("pause", 0, "not json"))).toBe("3819");
    expect(await admin.$queryRaw`SELECT COUNT(*) AS n FROM CaioAttentionControlEvent`).toEqual([{ n: 2n }]);
  });

  it("the web identity cannot reopen intake: any UPDATE of Control is refused with errno 1142", async () => {
    await resume();
    await requestPause(web, "watchdog:1");
    expect(await gateOpen(generator)).toBe(false);
    for (const statement of [
      web.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'OPEN', updatedAt = NOW(3) WHERE id = 'global'`,
      web.$executeRaw`UPDATE CaioAttentionControl SET openEpoch = openEpoch + 1, updatedAt = NOW(3) WHERE id = 'global'`,
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
          leaseNodeId = ${node}, leaseTargetDeploymentId = 'd', leaseAcquiredAt = NOW(3), leaseExpiresAt = NOW(3) + INTERVAL 30 MINUTE,
          updatedAt = NOW(3) WHERE id = 'global'`;
        await tx.$executeRaw`INSERT INTO CaioAttentionNodeReadiness (id, nodeId, deploymentId, closeCapabilityVersion, guardVersion,
          epoch, verifiedAt, verifiedByRef) VALUES (${`${node}-${epoch + 1}`}, ${node}, 'd', 1, 1, ${epoch + 1}, NOW(3), 'test:attest')`;
        await tx.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'PAUSED', leaseToken = NULL, leaseNodeId = NULL,
          leaseTargetDeploymentId = NULL, leaseAcquiredAt = NULL, leaseExpiresAt = NULL, updatedAt = NOW(3) WHERE id = 'global'`;
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
    expect(await errnoOf(ops.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'DEPLOYING', updatedAt = NOW(3) WHERE id = 'global'`)).toBe("3819");
  });

  /** A SUGGESTED case as the generator writes it; ids are synthetic (no foreign keys). */
  function insertCase(client: PrismaClient | Prisma.TransactionClient, id: string, shortNo: number, activeKey: string | null,
    status = "SUGGESTED", origin = `cand-${id}`) {
    return client.$executeRaw`INSERT INTO CaioAttentionCase (id, workspaceId, shortNo, detectorId, mergeKey, objectKey, category,
      originCandidateId, activeKey, status, ccUserIdsJson, reviewerUserIdsJson, severityAtSuggest, effectiveSeverity, reminderPolicy)
      VALUES (${id}, 'ws-a', ${shortNo}, 'det', 'mk', 'obj', 'business', ${origin}, ${activeKey}, ${status}, '[]', '[]',
        'warning', 'warning', 'warning')`;
  }
  const event = (client: PrismaClient, id: string, kind: string, extra: { candidateId?: string; dedupeKey?: string; clientRequestId?: string }) =>
    client.$executeRaw`INSERT INTO CaioAttentionCaseEvent (id, caseId, kind, candidateId, dedupeKey, clientRequestId, payloadJson)
      VALUES (${id}, 'case-1', ${kind}, ${extra.candidateId ?? null}, ${extra.dedupeKey ?? null}, ${extra.clientRequestId ?? null}, '{}')`;

  it("reports tables an identity holds no grant on as missing", async () => {
    await expect(probeCaioAttentionSchemaReadiness(generator)).resolves.toEqual({ ready: false, reason: "schema_incomplete",
      missing: expect.arrayContaining(["CaioAttentionDisposition.id", "CaioAttentionReview.id"]) });
  });

  it("lets the generator suggest under the intake gate and keeps one live case per active key", async () => {
    await generator.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT intakeState FROM CaioAttentionControl WHERE id = 'global' FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM CaioAttentionCase WHERE workspaceId = 'ws-a' AND activeKey = 'det:mk'`;
      await insertCase(tx, "case-1", 1, "det:mk");
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    expect(await errnoOf(insertCase(generator, "case-2", 2, "det:mk"))).toBe("1062");
    expect(await errnoOf(insertCase(generator, "case-9", 9, "det:other", "SUGGESTED", "cand-case-1"))).toBe("1062");
    expect(await errnoOf(insertCase(generator, "case-3", 3, null))).toBe("3819");
    expect(await errnoOf(insertCase(generator, "case-4", 4, "det:mk", "CLOSED"))).toBe("3819");
    expect(await errnoOf(insertCase(generator, "case-5", 5, "det:other", "BOGUS"))).toBe("3819");

    const cas = () => web.$executeRaw`UPDATE CaioAttentionCase SET status = 'CLOSED', activeKey = NULL, closedAt = NOW(3), updatedAt = NOW(3)
      WHERE id = 'case-1' AND status = 'SUGGESTED' AND commandVersion = 0`;
    expect(await cas()).toBe(1);
    expect(await cas()).toBe(0);
    await insertCase(generator, "case-6", 6, "det:mk");
    await insertCase(admin, "case-7", 7, null, "DISMISSED");
    expect(await errnoOf(insertCase(generator, "case-8", 6, "det:x"))).toBe("1062");
  });

  it("deduplicates events, dispositions, reviews and evaluations by their unique keys", async () => {
    await event(generator, "e1", "RECURRED", { candidateId: "c1" });
    expect(await errnoOf(event(generator, "e2", "RECURRED", { candidateId: "c1" }))).toBe("1062");
    await event(generator, "e3", "SEVERITY_RAISED", { dedupeKey: "critical" });
    expect(await errnoOf(event(web, "e4", "SEVERITY_RAISED", { dedupeKey: "critical" }))).toBe("1062");
    await event(web, "e5", "NOTE", { clientRequestId: "req-1" });
    expect(await errnoOf(event(web, "e6", "ACK", { clientRequestId: "req-1" }))).toBe("1062");
    await event(web, "e7", "NOTE", {});
    await event(web, "e8", "NOTE", {});

    const disposition = (id: string, sequence: number) => web.$executeRaw`INSERT INTO CaioAttentionDisposition (id, workspaceId, caseId,
      commandVersion, sequence, submittedByUserId, disposedAt, outcome, actionTaken, evidenceRefsJson, contentHash)
      VALUES (${id}, 'ws-a', 'case-1', 1, ${sequence}, 'u1', NOW(3), 'resolved', 'restarted the job', '[]', 'h')`;
    const review = (id: string, dispositionId: string, decision: string) => web.$executeRaw`INSERT INTO CaioAttentionReview (id, caseId,
      dispositionId, reviewerUserId, reviewerVersion, decision, attestedExternalRefsJson, note)
      VALUES (${id}, 'case-1', ${dispositionId}, 'u2', 0, ${decision}, '[]', 'checked')`;
    await disposition("d1", 1);
    expect(await errnoOf(disposition("d2", 1))).toBe("1062");
    await review("r1", "d1", "RETURN");
    expect(await errnoOf(review("r2", "d1", "ACCEPT"))).toBe("1062");
    expect(await errnoOf(review("r3", "d9", "APPROVE"))).toBe("3819");

    const evaluation = (id: string, outcome: string) => generator.$executeRaw`INSERT INTO CaioDetectorEvaluation (id, workspaceId, tickId,
      bucketStart, detectorId, ruleVersion, outcome, hitMergeKeysJson) VALUES (${id}, 'ws-a', 'tick-1', NOW(3), 'det', 'v1', ${outcome}, '[]')`;
    await evaluation("ev1", "NO_HIT");
    expect(await errnoOf(evaluation("ev2", "HIT"))).toBe("1062");
    expect(await errnoOf(generator.$executeRaw`INSERT INTO CaioDetectorEvaluation (id, workspaceId, tickId, bucketStart, detectorId,
      ruleVersion, outcome, hitMergeKeysJson) VALUES ('ev3', 'ws-a', 'tick-2', NOW(3), 'det', 'v1', 'UNKNOWN', '[]')`)).toBe("3819");
  });

  it("versions route configs append-only and moves the head optimistically, operator identity only", async () => {
    const config = (version: number) => ops.$executeRaw`INSERT INTO CaioAttentionRouteConfig (id, workspaceId, version, schemaVersion,
      configJson, contentHash, createdByRef) VALUES (${`rc-${version}`}, 'ws-a', ${version}, 'caio-attention-routes/v1', '{}', 'h', 'test')`;
    await config(1);
    await config(2);
    expect(await errnoOf(config(2))).toBe("1062");
    await ops.$executeRaw`INSERT INTO CaioAttentionRouteConfigHead (id, workspaceId, activeVersion, updatedByRef) VALUES ('h1', 'ws-a', 1, 'test')`;
    const move = () => ops.$executeRaw`UPDATE CaioAttentionRouteConfigHead SET activeVersion = 2, rowVersion = rowVersion + 1, updatedAt = NOW(3)
      WHERE workspaceId = 'ws-a' AND rowVersion = 0`;
    expect(await move()).toBe(1);
    expect(await move()).toBe(0);
    expect(await errnoOf(web.$executeRaw`UPDATE CaioAttentionRouteConfigHead SET activeVersion = 1, updatedAt = NOW(3) WHERE workspaceId = 'ws-a'`)).toBe("1142");
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
