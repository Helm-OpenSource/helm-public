import { spawn } from "node:child_process";
import path from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CaioAttentionCapabilityReport } from "./capability";
import {
  attestCaioAttentionNode,
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
import { recordCaioAttentionHeartbeat } from "./heartbeat.service";
import { readCaioAttentionIntakeGate } from "./intake-gate.service";

/**
 * Control service and CLI on an isolated MySQL database through the least-privilege fixture identities (same
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

async function errnoOf(promise: Promise<unknown>): Promise<string | null> {
  const result = await refusal(promise);
  return result === "ok" ? null : result.replace(/^errno:/u, "");
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

function runCli(op: string, input: string, opts: { closeAfterReady?: boolean } = {}) {
  return new Promise<{ code: number | null; stdout: string }>((resolve) => {
    const child = spawn(path.resolve("node_modules/.bin/tsx"), ["scripts/caio-attention-control.ts", op], {
      env: { PATH: process.env.PATH ?? "", DATABASE_URL: urls.ops!, PORT: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (opts.closeAfterReady && stdout.includes("READY\n")) child.stdin.end();
    });
    child.on("close", (code) => resolve({ code, stdout }));
    child.stdin.write(`${input}\n`);
    if (!opts.closeAfterReady) child.stdin.end();
  });
}

describeMysql("CAIO attention Control service and CLI on MySQL", () => {
  let admin: PrismaClient, generator: PrismaClient, web: PrismaClient, ops: PrismaClient;

  async function control() {
    const [row] = await admin.$queryRaw<Array<{ intakeState: string; epoch: number; openEpoch: number; leaseToken: string | null; updatedByRef: string }>>`
      SELECT intakeState, epoch, openEpoch, leaseToken, updatedByRef FROM CaioAttentionControl WHERE id = 'global'`;
    return row;
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

  beforeEach(async () => {
    for (const table of ["CaioAttentionPauseRequest", "CaioAttentionNodeReadiness", "CaioAttentionRuntimeNode", "CaioAttentionCase"]) {
      await admin.$executeRawUnsafe(`DELETE FROM \`${table}\``);
    }
    await admin.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'PAUSED', epoch = 0, openEpoch = 0, leaseToken = NULL,
      leaseNodeId = NULL, leaseTargetDeploymentId = NULL, leaseAcquiredAt = NULL, leaseExpiresAt = NULL, expectedNodesJson = '[]',
      updatedAt = NOW(3) WHERE id = 'global'`;
    await setCaioAttentionExpectedNodes(ops, { actorRef: ACTOR, nodeIds: ["node-a"] });
    await beat("node-a");
  });

  afterAll(async () => {
    // Leave the seeded fail-closed row for the schema suite that shares this database.
    await admin.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'PAUSED', epoch = 0, openEpoch = 0, leaseToken = NULL,
      leaseNodeId = NULL, leaseTargetDeploymentId = NULL, leaseAcquiredAt = NULL, leaseExpiresAt = NULL, expectedNodesJson = '[]',
      rowVersion = 0, updatedByRef = 'migration:20261104120000_caio_attention_control_plane', updatedAt = NOW(3) WHERE id = 'global'`;
    await Promise.all([admin, generator, web, ops].map((client) => client.$disconnect()));
  });

  it("resume needs a valid proof per expected node, then advances openEpoch and opens the gate", async () => {
    expect(await refusal(resume())).toBe("refused:resume_blocked:readiness_missing");
    await deploy("node-a");
    expect(await resume()).toEqual({ intakeState: "OPEN", openEpoch: 1, acknowledgedPauseRequestIds: [] });
    expect(await gateOpen()).toBe(true);
    expect((await control()).updatedByRef).toBe("operator:test|resume:ack=0");
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

    // The old deployer resumes: its barrier and its deploy-end are fenced, so it can neither link nor end.
    expect(await refusal(holdCaioAttentionLease(ops, tuple, () => undefined, Promise.resolve()))).toBe("fenced:not_deploying");
    expect(await refusal(endCaioAttentionDeployment(ops, { lease: begun.lease }))).toBe("fenced:lease_fenced");
    const next = await beginCaioAttentionDeployment(ops, { nodeId: "node-a", targetDeploymentId: "dep-2" });
    expect(await refusal(holdCaioAttentionLease(ops, tuple, () => undefined, Promise.resolve()))).toBe("fenced:lease_fenced");
    expect(next).toMatchObject({ epoch: 2, revokedEpoch: 1 });
  });

  it("attest-node: fenced on a stale tuple, refused below the guard floor or on any probe gap, else one proof at the lease epoch", async () => {
    const begun = await beginCaioAttentionDeployment(ops, { nodeId: "node-a", targetDeploymentId: "dep-1" });
    const request = { lease: begun.lease, nodeId: "node-a", targetDeploymentId: "dep-1", epoch: begun.epoch, guardVersion: 1 };
    const report: CaioAttentionCapabilityReport = {
      nodeId: "node-a", deploymentId: "dep-1", closeCapabilityVersion: 1, pageServiceBound: true, lifecycleRoutes: true, migrationReady: true,
    };
    const attest = (patch: Partial<typeof request>, reportPatch: Partial<CaioAttentionCapabilityReport> = {}) =>
      refusal(attestCaioAttentionNode(ops, { ...request, ...patch }, { ...report, ...reportPatch }));
    expect(await attest({ epoch: begun.epoch + 1 })).toBe("fenced:lease_fenced");
    expect(await attest({ guardVersion: 0 })).toBe("refused:guard_too_low");
    expect(await attest({}, { pageServiceBound: false })).toBe("refused:attest_blocked:page_service_unbound");
    expect(await attest({}, { deploymentId: "dep-0", closeCapabilityVersion: 0 })).toBe("refused:attest_blocked:deployment_mismatch,capability_too_low");
    expect(await attest({}, { nodeId: "node-b", lifecycleRoutes: false, migrationReady: false }))
      .toBe("refused:attest_blocked:node_mismatch,lifecycle_routes_missing,migration_not_ready");
    expect(await attestCaioAttentionNode(generator, request, report).then(() => "ok", () => "denied")).toBe("denied");
    expect(await attestCaioAttentionNode(ops, request, report)).toEqual({ attested: true, epoch: 1 });
    await endCaioAttentionDeployment(ops, { lease: begun.lease });
    expect(await refusal(attestCaioAttentionNode(ops, request, report))).toBe("fenced:not_deploying");
    const proofs = await admin.$queryRaw<Array<{ epoch: number; guardVersion: number }>>`
      SELECT epoch, guardVersion FROM CaioAttentionNodeReadiness WHERE nodeId = 'node-a'`;
    expect(proofs).toEqual([{ epoch: 1, guardVersion: 1 }]);

    // Heartbeat fallback: a mismatching deployment id blocks resume until the node reports the attested one.
    const beat = { nodeId: "node-a", role: "http", deploymentId: "dep-0", closeCapabilityVersion: 1, remindersEnabled: true };
    await recordCaioAttentionHeartbeat(web, beat);
    expect(await refusal(resume())).toBe("refused:resume_blocked:heartbeat_mismatch");
    await recordCaioAttentionHeartbeat(generator, { ...beat, remindersEnabled: false, deploymentId: "dep-1" });
    expect(await refusal(resume())).toBe("refused:resume_blocked:reminders_disabled");
    await recordCaioAttentionHeartbeat(web, { ...beat, deploymentId: "dep-1" });
    expect(await resume()).toMatchObject({ intakeState: "OPEN", openEpoch: 1 });
    expect(await errnoOf(recordCaioAttentionHeartbeat(ops, beat))).toBe("1142");
  });

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

  it("CLI: exact input keys, one JSON line out, READY barrier released on EOF, exit 3 when fenced and 4 when refused", async () => {
    expect(await runCli("deploy-begin", JSON.stringify({ nodeId: "node-a" }))).toEqual({ code: 4, stdout: "" });
    expect((await runCli("deploy-begin", JSON.stringify({ nodeId: "node-a", targetDeploymentId: "dep-1", extra: 1 }))).code).toBe(4);
    const begin = await runCli("deploy-begin", JSON.stringify({ nodeId: "node-a", targetDeploymentId: "dep-1" }));
    expect(begin.code).toBe(0);
    expect(begin.stdout.split("\n")).toHaveLength(2);
    const result = JSON.parse(begin.stdout) as { lease: string; epoch: number; revokedEpoch: number };
    expect(result).toMatchObject({ epoch: 1, revokedEpoch: 0, openCaseCount: 0 });
    const hold = { lease: result.lease, nodeId: "node-a", targetDeploymentId: "dep-1", epoch: 1, phase: "switch" };
    expect(await runCli("hold", JSON.stringify(hold), { closeAfterReady: true })).toEqual({ code: 0, stdout: "READY\n" });
    expect(await runCli("hold", JSON.stringify({ ...hold, epoch: 2 }), { closeAfterReady: true })).toEqual({ code: 3, stdout: "" });
    expect((await runCli("attest-node", JSON.stringify({ ...hold, phase: undefined, guardVersion: 1 }))).code).toBe(4);
    expect(await runCli("deploy-end", JSON.stringify({ lease: "0".repeat(48) }))).toEqual({ code: 3, stdout: "" });
    expect(await runCli("deploy-end", JSON.stringify({ lease: result.lease }))).toEqual({ code: 0, stdout: "{\"ended\":true}\n" });
    expect(await runCli("resume", JSON.stringify({ actorRef: ACTOR, ackPauseRequestIds: [] }))).toEqual({ code: 4, stdout: "" });
  }, 60_000);
});
