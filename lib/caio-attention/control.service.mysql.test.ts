import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  beginCaioAttentionDeployment,
  CaioAttentionControlRefusal,
  downgradeCaioAttentionGuard,
  endCaioAttentionDeployment,
  holdCaioAttentionLease,
  pauseCaioAttentionIntake,
  recoverCaioAttentionDeployment,
  requestCaioAttentionPause,
  resumeCaioAttentionIntake,
  setCaioAttentionExpectedNodes,
} from "./control.service";
import { readCaioAttentionIntakeGate } from "./intake-gate.service";

/**
 * Control service on an isolated MySQL database through the least-privilege fixture identities (same
 * environment as schema.mysql.test.ts; run by `npm run test:caio-attention:mysql`).
 */
const urls = {
  admin: process.env.CAIO_ATTENTION_DATABASE_URL,
  generator: process.env.CAIO_ATTENTION_GENERATOR_DATABASE_URL,
  web: process.env.CAIO_ATTENTION_WEB_DATABASE_URL,
  ops: process.env.CAIO_ATTENTION_OPS_DATABASE_URL,
};
const configured = Object.values(urls).every(Boolean);
if (process.env.CAIO_ATTENTION_MYSQL_REQUIRED === "1" && !configured) {
  throw new Error("CAIO_ATTENTION_MYSQL_REQUIRED=1 but a CAIO_ATTENTION_*_DATABASE_URL is missing.");
}
const describeMysql = configured ? describe.sequential : describe.skip;
const ACTOR = "operator:test";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  return { promise: new Promise<void>((done) => { resolve = done; }), resolve };
}

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ok";
  } catch (error) {
    if (error instanceof CaioAttentionControlRefusal) return `${error.fenced ? "fenced" : "refused"}:${error.code}`;
    if (error instanceof Prisma.PrismaClientKnownRequestError) return `errno:${String((error.meta as { code?: unknown } | undefined)?.code ?? error.code)}`;
    return `unclassified:${error instanceof Error ? error.message : String(error)}`;
  }
}

describeMysql("CAIO attention Control service on MySQL", () => {
  let admin: PrismaClient, generator: PrismaClient, web: PrismaClient, ops: PrismaClient;

  async function control() {
    const [row] = await admin.$queryRaw<Array<{ intakeState: string; epoch: number; openEpoch: number; leaseToken: string | null; updatedByRef: string }>>`
      SELECT intakeState, epoch, openEpoch, leaseToken, updatedByRef FROM CaioAttentionControl WHERE id = 'global'`;
    return row;
  }
  type EventRow = { op: string; actorRef: string; epoch: number | null; openEpoch: number | null; payload: Record<string, unknown> };
  async function events(op?: string): Promise<EventRow[]> {
    const rows = await admin.$queryRaw<Array<Omit<EventRow, "payload"> & { payloadJson: string }>>`
      SELECT op, actorRef, epoch, openEpoch, payloadJson FROM CaioAttentionControlEvent ORDER BY createdAt, id`;
    return rows.filter((row) => !op || row.op === op).map(({ payloadJson, ...row }) => ({ ...row, payload: JSON.parse(payloadJson) as Record<string, unknown> }));
  }
  const gateOpen = () => generator.$transaction(async (tx) => (await readCaioAttentionIntakeGate(tx)).open);
  /** A readiness proof as attest will write it (attest itself lands with the readiness slice). */
  const prove = (node: string, epoch: number, deploymentId = "dep-1") => admin.$executeRaw`INSERT INTO CaioAttentionNodeReadiness
    (id, nodeId, deploymentId, closeCapabilityVersion, guardVersion, epoch, verifiedAt, verifiedByRef)
    VALUES (${`${node}-${epoch}-${Math.random().toString(36).slice(2, 8)}`}, ${node}, ${deploymentId}, 1, 1, ${epoch}, NOW(3), 'test:attest')`;
  const beat = (node: string, deploymentId = "dep-1") => web.$executeRaw`INSERT INTO CaioAttentionRuntimeNode
    (id, nodeId, role, deploymentId, closeCapabilityVersion, remindersEnabled, lastSeenAt)
    VALUES (${`rn-${node}`}, ${node}, 'web', ${deploymentId}, 1, true, NOW(3))
    ON DUPLICATE KEY UPDATE deploymentId = VALUES(deploymentId), lastSeenAt = VALUES(lastSeenAt), remindersEnabled = true`;
  /** One full deploy cycle on a node: begin -> proof at the new epoch -> end. Returns the new epoch. */
  async function deploy(node: string) {
    const begun = await beginCaioAttentionDeployment(ops, { nodeId: node, targetDeploymentId: "dep-1" });
    await prove(node, begun.epoch);
    await endCaioAttentionDeployment(ops, { lease: begun.lease });
    return begun.epoch;
  }
  const resume = (acks: string[] = []) => resumeCaioAttentionIntake(ops, { actorRef: ACTOR, ackPauseRequestIds: acks });

  beforeAll(() => {
    admin = new PrismaClient({ datasources: { db: { url: urls.admin! } } });
    generator = new PrismaClient({ datasources: { db: { url: urls.generator! } } });
    web = new PrismaClient({ datasources: { db: { url: urls.web! } } });
    ops = new PrismaClient({ datasources: { db: { url: urls.ops! } } });
  });

  /** Empties every table this suite writes; `pristine` also restores the seeded Control row (rollback-ready). */
  async function reset(pristine: boolean) {
    for (const table of ["CaioAttentionControlEvent", "CaioAttentionPauseRequest", "CaioAttentionNodeReadiness", "CaioAttentionRuntimeNode",
      "CaioAttentionCase"]) {
      await admin.$executeRawUnsafe(`DELETE FROM \`${table}\``);
    }
    await admin.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'PAUSED', epoch = 0, openEpoch = 0, leaseToken = NULL,
      leaseNodeId = NULL, leaseTargetDeploymentId = NULL, leaseAcquiredAt = NULL, leaseExpiresAt = NULL, expectedNodesJson = '[]',
      updatedAt = NOW(3) WHERE id = 'global'`;
    if (pristine) {
      await admin.$executeRaw`UPDATE CaioAttentionControl SET rowVersion = 0,
        updatedByRef = 'migration:20261104120000_caio_attention_control_plane', updatedAt = NOW(3) WHERE id = 'global'`;
    }
  }

  beforeEach(async () => {
    await reset(false);
    await setCaioAttentionExpectedNodes(ops, { actorRef: ACTOR, nodeIds: ["node-a"] });
    await beat("node-a");
  });

  afterAll(async () => {
    // Leave every touched table as the migration left it, for the schema suite and the rollback scripts.
    await reset(true);
    await Promise.all([admin, generator, web, ops].map((client) => client.$disconnect()));
  });

  it("resume needs a valid proof per expected node, then advances openEpoch and opens the gate", async () => {
    expect(await refusal(resume())).toBe("refused:resume_blocked:readiness_missing");
    await deploy("node-a");
    expect(await resume()).toEqual({ intakeState: "OPEN", openEpoch: 1, acknowledgedPauseRequestIds: [] });
    expect(await gateOpen()).toBe(true);
    expect((await control()).updatedByRef).toBe("operator:test|resume:ack=0");
    expect(await events("resume")).toEqual([{ op: "resume", actorRef: ACTOR, epoch: 1, openEpoch: 1,
      payload: { previousOpenEpoch: 0, acknowledgedPauseRequestIds: [], expectedNodeIds: ["node-a"] } }]);
    expect(await refusal(setCaioAttentionExpectedNodes(ops, { actorRef: ACTOR, nodeIds: [] }))).toBe("refused:intake_open");
    expect(await pauseCaioAttentionIntake(ops, { actorRef: ACTOR })).toEqual({ intakeState: "PAUSED", changed: true });
    expect(await gateOpen()).toBe(false);
  });

  it("a pause request closes the current epoch and resume must acknowledge each one by id", async () => {
    await deploy("node-a");
    await resume();
    const first = await requestCaioAttentionPause(web, { reasonCode: "node_heartbeat_stale", requestedByRef: "w4:stale:node-a" });
    expect(first).toMatchObject({ openEpoch: 1, created: true });
    expect(await requestCaioAttentionPause(web, { reasonCode: "node_heartbeat_stale", requestedByRef: "w4:stale:node-a" }))
      .toEqual({ ...first, created: false });
    expect(await gateOpen()).toBe(false);
    await pauseCaioAttentionIntake(ops, { actorRef: ACTOR });
    expect(await refusal(resume())).toBe("refused:resume_blocked:pause_request_unacknowledged");
    expect(await resume([first.id])).toEqual({ intakeState: "OPEN", openEpoch: 2, acknowledgedPauseRequestIds: [first.id] });
    expect(await gateOpen()).toBe(true);
    // The acknowledged ids, who acknowledged them and when stay on record after later writes overwrite updatedByRef.
    await pauseCaioAttentionIntake(ops, { actorRef: "operator:other" });
    expect((await events("resume")).map((event) => [event.openEpoch, event.payload.acknowledgedPauseRequestIds])).toEqual([[1, []], [2, [first.id]]]);
    expect((await events("pause")).map((event) => event.actorRef)).toEqual([ACTOR, "operator:other"]);
  });

  it("concurrent pause and resume never lose the pause: either resume is refused or the pause lands on the new epoch", async () => {
    await deploy("node-a");
    for (let round = 0; round < 8; round += 1) {
      const [resumed, paused] = await Promise.all([
        refusal(resume()),
        requestCaioAttentionPause(web, { reasonCode: "watchdog", requestedByRef: `w4:race:${round}` }),
      ]);
      const after = await control();
      if (resumed === "ok") expect(paused.openEpoch).toBe(after.openEpoch);
      else expect(resumed).toBe("refused:resume_blocked:pause_request_unacknowledged");
      expect(await gateOpen()).toBe(false);
      await pauseCaioAttentionIntake(ops, { actorRef: ACTOR });
      const pending = await admin.$queryRaw<Array<{ id: string }>>`SELECT id FROM CaioAttentionPauseRequest WHERE openEpoch = ${after.openEpoch}`;
      await resume(pending.map((row) => row.id));
      await pauseCaioAttentionIntake(ops, { actorRef: ACTOR });
    }
  });

  it("deploy-begin drains an in-flight entry, revokes at E, moves to E+1 and closes the gate", async () => {
    await deploy("node-a");
    await resume();
    const held = deferred();
    const inside = deferred();
    const entry = generator.$transaction(async (tx) => {
      const gate = await readCaioAttentionIntakeGate(tx);
      inside.resolve();
      await held.promise;
      return gate.open;
    }, { timeout: 20_000 });
    await inside.promise;
    let begun = false;
    const begin = beginCaioAttentionDeployment(ops, { nodeId: "node-a", targetDeploymentId: "dep-2" }).finally(() => { begun = true; });
    await sleep(500);
    expect(begun).toBe(false);
    held.resolve();
    expect(await entry).toBe(true);
    expect(await begin).toMatchObject({ epoch: 2, revokedEpoch: 1, openCaseCount: 0, requiredCloseCapability: 1, minGuardVersion: 1 });
    expect(await gateOpen()).toBe(false);
    expect(await refusal(beginCaioAttentionDeployment(ops, { nodeId: "node-a", targetDeploymentId: "dep-2" }))).toBe("refused:lease_present");
  });

  it("revocation epochs: a proof counts only above the node's watermark, across redeploy, recovery and guard downgrade", async () => {
    await deploy("node-a");
    await setCaioAttentionExpectedNodes(ops, { actorRef: ACTOR, nodeIds: ["node-a", "node-b"] });
    await beat("node-b");
    await deploy("node-b");
    expect(await resume()).toMatchObject({ openEpoch: 1 });
    await pauseCaioAttentionIntake(ops, { actorRef: ACTOR });
    // Redeploy node-a without a fresh proof: its old proof (epoch 1) is revoked at 2; node-b's epoch-2 proof stays valid.
    const begun = await beginCaioAttentionDeployment(ops, { nodeId: "node-a", targetDeploymentId: "dep-1" });
    expect(begun).toMatchObject({ epoch: 3, revokedEpoch: 2 });
    await endCaioAttentionDeployment(ops, { lease: begun.lease });
    expect(await refusal(resume())).toBe("refused:resume_blocked:readiness_missing");
    await prove("node-a", 2);
    expect(await refusal(resume())).toBe("refused:resume_blocked:readiness_missing");
    await prove("node-a", 3);
    expect(await resume()).toMatchObject({ openEpoch: 2 });
    await pauseCaioAttentionIntake(ops, { actorRef: ACTOR });

    expect(await downgradeCaioAttentionGuard(ops, { nodeId: "node-b", fromGuardVersion: 2, toGuardVersion: 1 })).toEqual({ downgraded: true });
    expect((await control()).updatedByRef).toBe("host_deploy:node-b|GUARD_DOWNGRADED:2->1");
    expect(await events("guard-downgrade")).toEqual([{ op: "guard-downgrade", actorRef: "host_deploy:node-b", epoch: 3, openEpoch: 2,
      payload: { kind: "GUARD_DOWNGRADED", nodeId: "node-b", fromGuardVersion: 2, toGuardVersion: 1, revokedEpoch: 3, revokedProofs: 1 } }]);
    expect(await refusal(resume())).toBe("refused:resume_blocked:readiness_missing");
    await prove("node-b", 3);
    expect(await refusal(resume())).toBe("refused:resume_blocked:readiness_missing");
    await deploy("node-b");
    expect(await resume()).toMatchObject({ openEpoch: 3 });

    await admin.$executeRaw`INSERT INTO CaioAttentionCase (id, workspaceId, shortNo, detectorId, mergeKey, objectKey, category,
      originCandidateId, activeKey, status, ccUserIdsJson, reviewerUserIdsJson, severityAtSuggest, effectiveSeverity, reminderPolicy)
      VALUES ('case-open', 'ws-a', 1, 'det', 'mk', 'obj', 'business', 'cand-1', 'det:mk', 'SUGGESTED', '[]', '[]', 'warning', 'warning', 'warning')`;
    expect(await refusal(downgradeCaioAttentionGuard(ops, { nodeId: "node-b", fromGuardVersion: 2, toGuardVersion: 1 }))).toBe("refused:not_paused");
    await pauseCaioAttentionIntake(ops, { actorRef: ACTOR });
    expect(await refusal(downgradeCaioAttentionGuard(ops, { nodeId: "node-b", fromGuardVersion: 2, toGuardVersion: 1 }))).toBe("refused:open_cases_present");
    expect((await beginCaioAttentionDeployment(ops, { nodeId: "node-b", targetDeploymentId: "dep-1" })).openCaseCount).toBe(1);
    // A later write overwrites updatedByRef; the downgrade record does not move, and refused attempts left none.
    expect((await control()).updatedByRef).toBe("host_deploy:node-b|deploy-begin");
    expect(await events("guard-downgrade")).toHaveLength(1);
  });

  it("expired-lease recovery: only for the lease's node, only once expired, and only after the hold barrier is released", async () => {
    const begun = await beginCaioAttentionDeployment(ops, { nodeId: "node-a", targetDeploymentId: "dep-1" });
    const tuple = { lease: begun.lease, nodeId: "node-a", targetDeploymentId: "dep-1", epoch: begun.epoch, phase: "switch" };
    expect(await refusal(recoverCaioAttentionDeployment(ops, { nodeId: "node-a" }))).toBe("refused:lease_not_expired");
    await admin.$executeRaw`UPDATE CaioAttentionControl SET leaseExpiresAt = NOW(3) - INTERVAL 1 MINUTE, updatedAt = NOW(3) WHERE id = 'global'`;
    expect(await refusal(beginCaioAttentionDeployment(ops, { nodeId: "node-a", targetDeploymentId: "dep-1" }))).toBe("refused:lease_expired_recover_on_host");
    expect(await refusal(recoverCaioAttentionDeployment(ops, { nodeId: "node-b" }))).toBe("refused:node_mismatch");

    // A deployer still inside its barrier (e.g. suspended mid-link) holds FOR SHARE; recovery waits behind it.
    const released = deferred();
    const ready = deferred();
    const barrier = holdCaioAttentionLease(ops, tuple, ready.resolve, released.promise);
    await ready.promise;
    let recovered = false;
    const recovery = recoverCaioAttentionDeployment(ops, { nodeId: "node-a" }).finally(() => { recovered = true; });
    await sleep(500);
    expect(recovered).toBe(false);
    released.resolve();
    await barrier;
    expect(await recovery).toEqual({ recovered: true, nodeId: "node-a" });
    expect(await control()).toMatchObject({ intakeState: "PAUSED", leaseToken: null, epoch: 1 });
    const [recoverEvent] = await events("deploy-recover");
    expect(recoverEvent).toMatchObject({ actorRef: "host_deploy:node-a", epoch: 1, openEpoch: 0,
      payload: { nodeId: "node-a", targetDeploymentId: "dep-1", revokedEpoch: 1, revokedProofs: 0 } });
    expect(JSON.stringify(await events())).not.toContain(begun.lease);

    // The old deployer resumes: its barrier and its deploy-end are fenced, so it can neither link nor end.
    expect(await refusal(holdCaioAttentionLease(ops, tuple, () => undefined, Promise.resolve()))).toBe("fenced:not_deploying");
    expect(await refusal(endCaioAttentionDeployment(ops, { lease: begun.lease }))).toBe("fenced:lease_fenced");
    const next = await beginCaioAttentionDeployment(ops, { nodeId: "node-a", targetDeploymentId: "dep-2" });
    expect(await refusal(holdCaioAttentionLease(ops, tuple, () => undefined, Promise.resolve()))).toBe("fenced:lease_fenced");
    expect(next).toMatchObject({ epoch: 2, revokedEpoch: 1 });
  });

  it("every state change appends one control event in its own transaction; refused operations append none", async () => {
    const begun = await beginCaioAttentionDeployment(ops, { nodeId: "node-a", targetDeploymentId: "dep-1" });
    expect(await refusal(beginCaioAttentionDeployment(ops, { nodeId: "node-a", targetDeploymentId: "dep-1" }))).toBe("refused:lease_present");
    expect(await refusal(endCaioAttentionDeployment(ops, { lease: "0".repeat(48) }))).toBe("fenced:lease_fenced");
    expect(await refusal(resume())).toBe("refused:resume_blocked:lease_present,not_paused,readiness_missing");
    await endCaioAttentionDeployment(ops, { lease: begun.lease });
    expect(await pauseCaioAttentionIntake(ops, { actorRef: ACTOR })).toEqual({ intakeState: "PAUSED", changed: false });
    expect((await events()).map(({ op, actorRef, epoch, openEpoch }) => [op, actorRef, epoch, openEpoch])).toEqual([
      ["expected-nodes", ACTOR, 0, 0],
      ["deploy-begin", "host_deploy:node-a", 1, 0],
      ["deploy-end", "host_deploy:node-a", 1, 0],
    ]);
    expect((await events("deploy-begin"))[0].payload).toEqual({ nodeId: "node-a", targetDeploymentId: "dep-1", revokedEpoch: 0, revokedProofs: 0, openCaseCount: 0 });
    expect((await events("deploy-end"))[0].payload).toEqual({ nodeId: "node-a", targetDeploymentId: "dep-1" });
    expect((await events("expected-nodes"))[0].payload).toEqual({ previousNodeIds: [], nodeIds: ["node-a"] });
  });

  it("a pause request waits behind a Control FOR UPDATE holder and lands on the open epoch that holder leaves (FOR SHARE)", async () => {
    const locked = deferred();
    const release = deferred();
    const holder = admin.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM CaioAttentionControl WHERE id = 'global' FOR UPDATE`;
      locked.resolve();
      await release.promise;
      await tx.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'OPEN', openEpoch = openEpoch + 1, rowVersion = rowVersion + 1,
        updatedByRef = 'test:resume', updatedAt = NOW(3) WHERE id = 'global'`;
    }, { timeout: 20_000 });
    await locked.promise;
    let settled = false;
    const pause = requestCaioAttentionPause(web, { reasonCode: "watchdog", requestedByRef: "w4:serial" }).finally(() => { settled = true; });
    await sleep(1_000);
    expect(settled).toBe(false);
    release.resolve();
    await holder;
    expect(await pause).toMatchObject({ openEpoch: 1, created: true });
    expect(await gateOpen()).toBe(false);
  });

  it("hold fails within its 10 s lock wait behind a FOR UPDATE holder without signalling READY; pause leaves DEPLOYING alone", async () => {
    const begun = await beginCaioAttentionDeployment(ops, { nodeId: "node-a", targetDeploymentId: "dep-1" });
    expect(await pauseCaioAttentionIntake(ops, { actorRef: ACTOR })).toEqual({ intakeState: "DEPLOYING", changed: false });
    expect(await control()).toMatchObject({ intakeState: "DEPLOYING", leaseToken: begun.lease, epoch: 1 });
    const tuple = { lease: begun.lease, nodeId: "node-a", targetDeploymentId: "dep-1", epoch: begun.epoch, phase: "switch" };
    const locked = deferred();
    const release = deferred();
    const holder = admin.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM CaioAttentionControl WHERE id = 'global' FOR UPDATE`;
      locked.resolve();
      await release.promise;
    }, { timeout: 30_000 });
    await locked.promise;
    let signalled = false;
    const started = Date.now();
    const outcome = await refusal(holdCaioAttentionLease(ops, tuple, () => { signalled = true; }, Promise.resolve()));
    const waited = Date.now() - started;
    release.resolve();
    await holder;
    expect(outcome).toBe("errno:1205");
    expect(signalled).toBe(false);
    expect(waited).toBeGreaterThanOrEqual(9_000);
    expect(waited).toBeLessThan(15_000);
    let ready = false;
    await holdCaioAttentionLease(ops, tuple, () => { ready = true; }, Promise.resolve());
    expect(ready).toBe(true);
    expect(await control()).toMatchObject({ intakeState: "DEPLOYING", leaseToken: begun.lease });
  }, 40_000);

  it("the web and generator identities cannot pause, resume, deploy or recover: Control writes are refused with errno 1142", async () => {
    await deploy("node-a");
    for (const client of [web, generator]) {
      expect(await refusal(pauseCaioAttentionIntake(client, { actorRef: ACTOR }))).toBe("errno:1142");
      expect(await refusal(resumeCaioAttentionIntake(client, { actorRef: ACTOR, ackPauseRequestIds: [] }))).toBe("errno:1142");
      expect(await refusal(beginCaioAttentionDeployment(client, { nodeId: "node-a", targetDeploymentId: "dep-1" }))).toBe("errno:1142");
      expect(await refusal(recoverCaioAttentionDeployment(client, { nodeId: "node-a" }))).toBe("errno:1142");
    }
    expect(await refusal(requestCaioAttentionPause(generator, { reasonCode: "watchdog", requestedByRef: "w4:gen" }))).toBe("errno:1142");
    expect(await control()).toMatchObject({ intakeState: "PAUSED", openEpoch: 0 });
  });

});
