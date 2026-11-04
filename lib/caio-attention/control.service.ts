import { randomBytes } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import { evaluateCaioAttentionCapability, type CaioAttentionCapabilityReport } from "./capability";
import {
  caioAttentionDeployBegin,
  caioAttentionRevokeInPlace,
  evaluateCaioAttentionLeaseHold,
  evaluateCaioAttentionRecover,
  evaluateCaioAttentionResume,
  nextCaioAttentionOpenEpoch,
  type CaioAttentionLease,
  type CaioAttentionReadiness,
} from "./control-epoch";
import { appendCaioAttentionControlEvent } from "./control-event.service";

/**
 * Intake-control service of the CAIO attention control plane (design v5 §1, v6 §1–2, REREVIEW5 P2-2).
 *
 * Every write to the Control row runs under `SELECT ... FOR UPDATE` on that row as the operator identity, and
 * applies the numeric rules of control-epoch.ts. Entry points (generator, confirm, resumeDeferred, reissue) call
 * readCaioAttentionIntakeGate (intake-gate.service.ts) in their own transaction; its FOR SHARE lets deploy-begin and
 * resume drain them. The web identity can only append a pause request, never write Control.
 *
 * Times come from the database clock (NOW(3)). Every raw UPDATE of Control sets updatedAt = NOW(3) and bumps
 * rowVersion; updatedByRef records the last actor and op, and every state-changing operation also appends one
 * CaioAttentionControlEvent in the same transaction (control-event.service.ts), so the full trail survives the next
 * write. The read-only hold barrier writes nothing. The host lock and local node identity for recovery are the
 * caller's (overlay deploy script) obligation; this service enforces lease node, expiry and the hold barrier.
 */

export const CAIO_ATTENTION_LEASE_MINUTES = 30;
export const CAIO_ATTENTION_HEARTBEAT_FRESH_MS = 3 * 60_000;
/** Interactive transactions wait for lock holders; a hold barrier spans one link() on the deploy host. */
export const CAIO_ATTENTION_CONTROL_TX = { maxWait: 10_000, timeout: 60_000 } as const;
export const CAIO_ATTENTION_HOLD_TX = { maxWait: 10_000, timeout: 120_000 } as const;
/**
 * attest-node runs after the CLI's 10 s capability fetch; 10 + 5 + 40 = 55 s stays under the deploy script's 60 s call
 * budget, so a slow attest ends as this CLI's own failure (rolled back, no proof) rather than the caller's kill.
 */
export const CAIO_ATTENTION_ATTEST_FETCH_MS = 10_000;
export const CAIO_ATTENTION_ATTEST_TX = { maxWait: 5_000, timeout: 40_000 } as const;
export const CAIO_ATTENTION_NODE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u;
const DEPLOYMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const LEASE_PATTERN = /^[a-f0-9]{48}$/u;
const ACTOR_REF_PATTERN = /^[a-z][a-z0-9_]{0,31}:[A-Za-z0-9][A-Za-z0-9._@:-]{0,127}$/u;
export const CAIO_ATTENTION_PAUSE_REASONS = ["node_heartbeat_stale", "deployment_mismatch", "watchdog", "operator"] as const;
export type CaioAttentionPauseReason = (typeof CAIO_ATTENTION_PAUSE_REASONS)[number];
export const CAIO_ATTENTION_HOLD_PHASES = ["switch", "first_release_remove", "restore"] as const;
const TERMINAL_STATUSES = ["DISMISSED", "CANCELLED", "CLOSED"] as const;
const MAX_EXPECTED_NODES = 20;
/** A refused operation. `fenced` marks a lease that is no longer this caller's (the deploy CLI exits 3). */
export class CaioAttentionControlRefusal extends Error {
  constructor(readonly code: string, readonly fenced = false) {
    super(code);
    this.name = "CaioAttentionControlRefusal";
  }
}

const refuse = (code: string): never => { throw new CaioAttentionControlRefusal(code); };
const fence = (code: string): never => { throw new CaioAttentionControlRefusal(code, true); };
type ControlRow = CaioAttentionLease & Readonly<{ openEpoch: number; requiredCloseCapability: number; minGuardVersion: number;
  expectedNodesJson: string; rowVersion: number; now: Date }>;

const CONTROL_COLUMNS = `intakeState, epoch, openEpoch, leaseToken, leaseNodeId, leaseTargetDeploymentId, leaseExpiresAt,
  requiredCloseCapability, minGuardVersion, expectedNodesJson, rowVersion, NOW(3) AS now`;

async function lockControl(tx: Prisma.TransactionClient, mode: "UPDATE" | "SHARE"): Promise<ControlRow> {
  const sql = mode === "UPDATE"
    ? `SELECT ${CONTROL_COLUMNS} FROM CaioAttentionControl WHERE id = 'global' FOR UPDATE`
    : `SELECT ${CONTROL_COLUMNS} FROM CaioAttentionControl WHERE id = 'global' FOR SHARE`;
  const [row] = await tx.$queryRawUnsafe<ControlRow[]>(sql);
  if (!row) throw new CaioAttentionControlRefusal("control_row_missing");
  return row;
}

function parseExpectedNodes(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json);
    if (Array.isArray(value) && value.every((node) => typeof node === "string" && CAIO_ATTENTION_NODE_ID_PATTERN.test(node))) {
      return value as string[];
    }
  } catch {
    // fall through: a malformed list is treated as empty, so resume fails closed
  }
  return [];
}

const requireMatch = (value: unknown, pattern: RegExp, code: string): string =>
  typeof value === "string" && pattern.test(value) ? value : refuse(code);
const requireCount = (value: unknown, code: string): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1_000_000 ? value : refuse(code);
const auditRef = (actorRef: string, op: string): string => `${actorRef}|${op}`.slice(0, 191);

async function countOpenCases(tx: Prisma.TransactionClient): Promise<number> {
  const [row] = await tx.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*) AS n FROM CaioAttentionCase WHERE status NOT IN (${Prisma.join([...TERMINAL_STATUSES])})`;
  return Number(row?.n ?? 0);
}

async function revokeNodeReadiness(tx: Prisma.TransactionClient, nodeId: string, revokedEpoch: number, ref: string) {
  return tx.$executeRaw`UPDATE CaioAttentionNodeReadiness SET revokedAt = NOW(3), revokedByRef = ${ref}, revokedEpoch = ${revokedEpoch}
    WHERE nodeId = ${nodeId} AND revokedAt IS NULL`;
}

/**
 * Append-only pause (v6 §1.6 with REREVIEW5 P2-2): read the open epoch under FOR SHARE, then INSERT in the same
 * transaction, so a pause serialises against resume's FOR UPDATE and can never land on a superseded epoch.
 * Idempotent per (openEpoch, requestedByRef); requestedByRef carries the dedupe key, e.g. `w4:<reason>:<node>`.
 */
export async function requestCaioAttentionPause(
  client: PrismaClient,
  input: Readonly<{ reasonCode: CaioAttentionPauseReason; requestedByRef: string }>,
): Promise<{ id: string; openEpoch: number; created: boolean }> {
  if (!CAIO_ATTENTION_PAUSE_REASONS.includes(input.reasonCode)) refuse("pause_reason_invalid");
  const ref = requireMatch(input.requestedByRef, ACTOR_REF_PATTERN, "pause_ref_invalid");
  const attempt = () => client.$transaction(async (tx) => {
    const control = await lockControl(tx, "SHARE");
    const [existing] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM CaioAttentionPauseRequest WHERE openEpoch = ${control.openEpoch} AND requestedByRef = ${ref}`;
    if (existing) return { id: existing.id, openEpoch: control.openEpoch, created: false };
    const id = `pr_${randomBytes(12).toString("hex")}`;
    await tx.$executeRaw`INSERT INTO CaioAttentionPauseRequest (id, openEpoch, reasonCode, requestedByRef)
      VALUES (${id}, ${control.openEpoch}, ${input.reasonCode}, ${ref})`;
    return { id, openEpoch: control.openEpoch, created: true };
  }, CAIO_ATTENTION_CONTROL_TX);
  try {
    return await attempt();
  } catch (error) {
    // A concurrent identical request won the unique key; the re-read returns it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || String((error.meta as { code?: unknown } | undefined)?.code) === "1062")) {
      return attempt();
    }
    throw error;
  }
}

export async function pauseCaioAttentionIntake(client: PrismaClient, input: Readonly<{ actorRef: string }>) {
  const actor = requireMatch(input.actorRef, ACTOR_REF_PATTERN, "actor_ref_invalid");
  return client.$transaction(async (tx) => {
    const control = await lockControl(tx, "UPDATE");
    if (control.intakeState !== "OPEN") return { intakeState: control.intakeState, changed: false };
    await tx.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'PAUSED', rowVersion = rowVersion + 1,
      updatedByRef = ${auditRef(actor, "pause")}, updatedAt = NOW(3) WHERE id = 'global'`;
    await appendCaioAttentionControlEvent(tx, { op: "pause", actorRef: actor, epoch: control.epoch, openEpoch: control.openEpoch,
      payload: { fromState: "OPEN" } });
    return { intakeState: "PAUSED", changed: true };
  }, CAIO_ATTENTION_CONTROL_TX);
}

/** Expected nodes may change only while intake is not OPEN (pause first), so a running gate never loses a node. */
export async function setCaioAttentionExpectedNodes(client: PrismaClient, input: Readonly<{ actorRef: string; nodeIds: unknown }>) {
  const actor = requireMatch(input.actorRef, ACTOR_REF_PATTERN, "actor_ref_invalid");
  const nodeIds = Array.isArray(input.nodeIds) ? input.nodeIds : refuse("expected_nodes_invalid");
  const valid = nodeIds.length <= MAX_EXPECTED_NODES && new Set(nodeIds).size === nodeIds.length
    && nodeIds.every((node) => typeof node === "string" && CAIO_ATTENTION_NODE_ID_PATTERN.test(node));
  if (!valid) refuse("expected_nodes_invalid");
  const json = JSON.stringify([...(nodeIds as string[])].sort());
  return client.$transaction(async (tx) => {
    const control = await lockControl(tx, "UPDATE");
    if (control.intakeState === "OPEN") refuse("intake_open");
    await tx.$executeRaw`UPDATE CaioAttentionControl SET expectedNodesJson = ${json}, rowVersion = rowVersion + 1,
      updatedByRef = ${auditRef(actor, "expected-nodes")}, updatedAt = NOW(3) WHERE id = 'global'`;
    const expectedNodes = JSON.parse(json) as string[];
    await appendCaioAttentionControlEvent(tx, { op: "expected-nodes", actorRef: actor, epoch: control.epoch, openEpoch: control.openEpoch,
      payload: { previousNodeIds: parseExpectedNodes(control.expectedNodesJson), nodeIds: expectedNodes } });
    return { expectedNodes };
  }, CAIO_ATTENTION_CONTROL_TX);
}

/**
 * Resume (v5 §1.2, v6 §1.3, §1.6, §2.3–2.4): the full precondition set of evaluateCaioAttentionResume, with every
 * pause request of the current open epoch acknowledged by id; then openEpoch := max(open, max(requests)) + 1.
 */
export async function resumeCaioAttentionIntake(
  client: PrismaClient,
  input: Readonly<{ actorRef: string; ackPauseRequestIds: unknown }>,
) {
  const actor = requireMatch(input.actorRef, ACTOR_REF_PATTERN, "actor_ref_invalid");
  const acks = Array.isArray(input.ackPauseRequestIds) && input.ackPauseRequestIds.length <= 200
    && input.ackPauseRequestIds.every((id) => typeof id === "string" && id.length <= 191)
    ? input.ackPauseRequestIds as string[] : refuse("ack_pause_requests_invalid");
  return client.$transaction(async (tx) => {
    const control = await lockControl(tx, "UPDATE");
    const expectedNodeIds = parseExpectedNodes(control.expectedNodesJson);
    const nodes = expectedNodeIds.length > 0 ? expectedNodeIds : ["\u0000none"];
    const readiness = await tx.$queryRaw<Array<CaioAttentionReadiness & { revokedEpoch: number | null }>>`
      SELECT nodeId, deploymentId, epoch, closeCapabilityVersion, guardVersion, revokedAt, revokedEpoch
      FROM CaioAttentionNodeReadiness WHERE nodeId IN (${Prisma.join(nodes)})`;
    const revokedEpochByNode: Record<string, number> = {};
    for (const proof of readiness) {
      if (proof.revokedEpoch !== null) revokedEpochByNode[proof.nodeId] = Math.max(revokedEpochByNode[proof.nodeId] ?? -1, proof.revokedEpoch);
    }
    const heartbeats = await tx.$queryRaw<Array<{ nodeId: string; deploymentId: string; lastSeenAt: Date; remindersEnabled: boolean | number }>>`
      SELECT nodeId, deploymentId, lastSeenAt, remindersEnabled FROM CaioAttentionRuntimeNode WHERE nodeId IN (${Prisma.join(nodes)})`;
    const pauseRequests = await tx.$queryRaw<Array<{ id: string; openEpoch: number }>>`
      SELECT id, openEpoch FROM CaioAttentionPauseRequest WHERE openEpoch >= ${control.openEpoch}`;
    const blocks = evaluateCaioAttentionResume({
      intakeState: control.intakeState,
      leaseToken: control.leaseToken,
      openEpoch: control.openEpoch,
      requiredCloseCapability: control.requiredCloseCapability,
      minGuardVersion: control.minGuardVersion,
      expectedNodeIds,
      readiness,
      revokedEpochByNode,
      heartbeats: heartbeats.map((beat) => ({ ...beat, remindersEnabled: Boolean(beat.remindersEnabled) })),
      heartbeatFreshMs: CAIO_ATTENTION_HEARTBEAT_FRESH_MS,
      pauseRequests,
      acknowledgedPauseRequestIds: acks,
      now: control.now,
    });
    if (blocks.length > 0) refuse(`resume_blocked:${blocks.join(",")}`);
    const acknowledged = pauseRequests.filter((request) => request.openEpoch === control.openEpoch).map((request) => request.id).sort();
    const openEpoch = nextCaioAttentionOpenEpoch(control.openEpoch, pauseRequests.map((request) => request.openEpoch));
    await tx.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'OPEN', openEpoch = ${openEpoch}, rowVersion = rowVersion + 1,
      updatedByRef = ${auditRef(actor, `resume:ack=${acknowledged.length}`)}, updatedAt = NOW(3)
      WHERE id = 'global' AND rowVersion = ${control.rowVersion}`;
    await appendCaioAttentionControlEvent(tx, { op: "resume", actorRef: actor, epoch: control.epoch, openEpoch,
      payload: { previousOpenEpoch: control.openEpoch, acknowledgedPauseRequestIds: acknowledged, expectedNodeIds } });
    return { intakeState: "OPEN", openEpoch, acknowledgedPauseRequestIds: acknowledged };
  }, CAIO_ATTENTION_CONTROL_TX);
}

/**
 * deploy-begin: no lease (an expired one needs recovery on its host), FOR UPDATE drains in-flight entries, the
 * node's proofs are revoked at the current epoch E, the epoch moves to E+1 and intake is DEPLOYING.
 */
export async function beginCaioAttentionDeployment(client: PrismaClient, input: Readonly<{ nodeId: unknown; targetDeploymentId: unknown }>) {
  const nodeId = requireMatch(input.nodeId, CAIO_ATTENTION_NODE_ID_PATTERN, "node_id_invalid");
  const target = requireMatch(input.targetDeploymentId, DEPLOYMENT_ID_PATTERN, "deployment_id_invalid");
  const ref = auditRef(`host_deploy:${nodeId}`, "deploy-begin");
  return client.$transaction(async (tx) => {
    const control = await lockControl(tx, "UPDATE");
    if (control.leaseToken) {
      refuse(control.leaseExpiresAt && control.leaseExpiresAt.getTime() <= control.now.getTime() ? "lease_expired_recover_on_host" : "lease_present");
    }
    const { revokedEpoch, nextEpoch } = caioAttentionDeployBegin(control.epoch);
    const revokedProofs = await revokeNodeReadiness(tx, nodeId, revokedEpoch, ref);
    const lease = randomBytes(24).toString("hex");
    await tx.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'DEPLOYING', epoch = ${nextEpoch}, leaseToken = ${lease},
      leaseNodeId = ${nodeId}, leaseTargetDeploymentId = ${target}, leaseAcquiredAt = NOW(3),
      leaseExpiresAt = NOW(3) + INTERVAL ${CAIO_ATTENTION_LEASE_MINUTES} MINUTE, rowVersion = rowVersion + 1,
      updatedByRef = ${ref}, updatedAt = NOW(3) WHERE id = 'global'`;
    const openCaseCount = await countOpenCases(tx);
    await appendCaioAttentionControlEvent(tx, { op: "deploy-begin", actorRef: `host_deploy:${nodeId}`, epoch: nextEpoch,
      openEpoch: control.openEpoch, payload: { nodeId, targetDeploymentId: target, revokedEpoch, revokedProofs, openCaseCount } });
    return {
      lease,
      epoch: nextEpoch,
      revokedEpoch,
      openCaseCount,
      requiredCloseCapability: control.requiredCloseCapability,
      minGuardVersion: control.minGuardVersion,
    };
  }, CAIO_ATTENTION_CONTROL_TX);
}

export type CaioAttentionHoldRequest = Readonly<{ lease: unknown; nodeId: unknown; targetDeploymentId: unknown; epoch: unknown; phase: unknown }>;

/**
 * hold barrier (v6 §2.1): FOR SHARE on Control, the (lease, node, target, epoch) tuple must match with intake
 * DEPLOYING; then `onReady` runs and the transaction stays open until `released` settles. Recovery and a new
 * deploy-begin need FOR UPDATE, so they wait for the barrier. A mismatch is fenced and nothing is signalled.
 */
export async function holdCaioAttentionLease(
  client: PrismaClient,
  input: CaioAttentionHoldRequest,
  onReady: () => void,
  released: Promise<void>,
): Promise<void> {
  const request = {
    token: requireMatch(input.lease, LEASE_PATTERN, "lease_invalid"),
    nodeId: requireMatch(input.nodeId, CAIO_ATTENTION_NODE_ID_PATTERN, "node_id_invalid"),
    targetDeploymentId: requireMatch(input.targetDeploymentId, DEPLOYMENT_ID_PATTERN, "deployment_id_invalid"),
    epoch: requireCount(input.epoch, "epoch_invalid"),
  };
  if (!CAIO_ATTENTION_HOLD_PHASES.includes(input.phase as (typeof CAIO_ATTENTION_HOLD_PHASES)[number])) refuse("phase_invalid");
  await client.$transaction(async (tx) => {
    // Fail fast behind a FOR UPDATE holder: the deploy script waits at most 30 s for READY (MySQL default is 50 s).
    await tx.$executeRawUnsafe("SET SESSION innodb_lock_wait_timeout = 10");
    const verdict = evaluateCaioAttentionLeaseHold(await lockControl(tx, "SHARE"), request);
    if (!verdict.ok) fence(verdict.reason);
    onReady();
    await released;
  }, CAIO_ATTENTION_HOLD_TX);
}

/**
 * attest-node (design v5 §1.2, v6 §2.3–2.4): the lease tuple must still be current (else fenced); the deploy guard
 * version must meet minGuardVersion; the node's own loopback capability report (fetched by the caller before this
 * transaction, so no network call runs under the lock) must show this node, the lease target, capability at the
 * floor, the page service and lifecycle routes bound, and the schema ready. Writes one proof at the lease epoch.
 */
export async function attestCaioAttentionNode(
  client: PrismaClient,
  input: Readonly<{ lease: unknown; nodeId: unknown; targetDeploymentId: unknown; epoch: unknown; guardVersion: unknown }>,
  report: CaioAttentionCapabilityReport,
) {
  const request = {
    token: requireMatch(input.lease, LEASE_PATTERN, "lease_invalid"),
    nodeId: requireMatch(input.nodeId, CAIO_ATTENTION_NODE_ID_PATTERN, "node_id_invalid"),
    targetDeploymentId: requireMatch(input.targetDeploymentId, DEPLOYMENT_ID_PATTERN, "deployment_id_invalid"),
    epoch: requireCount(input.epoch, "epoch_invalid"),
  };
  const guardVersion = requireCount(input.guardVersion, "guard_version_invalid");
  return client.$transaction(async (tx) => {
    const control = await lockControl(tx, "UPDATE");
    const verdict = evaluateCaioAttentionLeaseHold(control, request);
    if (!verdict.ok) fence(verdict.reason);
    if (guardVersion < control.minGuardVersion) refuse("guard_too_low");
    const blocks = evaluateCaioAttentionCapability(report, {
      nodeId: request.nodeId, deploymentId: request.targetDeploymentId, requiredCloseCapability: control.requiredCloseCapability,
    });
    if (blocks.length > 0) refuse(`attest_blocked:${blocks.join(",")}`);
    const readinessId = `nr_${randomBytes(12).toString("hex")}`;
    await tx.$executeRaw`INSERT INTO CaioAttentionNodeReadiness (id, nodeId, deploymentId, closeCapabilityVersion, guardVersion, epoch,
      verifiedAt, verifiedByRef) VALUES (${readinessId}, ${request.nodeId}, ${request.targetDeploymentId},
      ${report.closeCapabilityVersion}, ${guardVersion}, ${request.epoch}, NOW(3), ${auditRef(`host_deploy:${request.nodeId}`, "attest-node")})`;
    await appendCaioAttentionControlEvent(tx, { op: "attest-node", actorRef: `host_deploy:${request.nodeId}`, epoch: request.epoch,
      openEpoch: control.openEpoch, payload: { nodeId: request.nodeId, deploymentId: request.targetDeploymentId, readinessId,
        closeCapabilityVersion: report.closeCapabilityVersion, guardVersion } });
    return { attested: true, epoch: request.epoch };
  }, CAIO_ATTENTION_ATTEST_TX);
}

/** deploy-end: only the lease holder ends its lease; intake always returns to PAUSED, never OPEN. */
export async function endCaioAttentionDeployment(client: PrismaClient, input: Readonly<{ lease: unknown }>) {
  const lease = requireMatch(input.lease, LEASE_PATTERN, "lease_invalid");
  return client.$transaction(async (tx) => {
    const control = await lockControl(tx, "UPDATE");
    if (control.leaseToken !== lease) fence("lease_fenced");
    await tx.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'PAUSED', leaseToken = NULL, leaseNodeId = NULL,
      leaseTargetDeploymentId = NULL, leaseAcquiredAt = NULL, leaseExpiresAt = NULL, rowVersion = rowVersion + 1,
      updatedByRef = ${auditRef(`host_deploy:${control.leaseNodeId ?? "unknown"}`, "deploy-end")}, updatedAt = NOW(3)
      WHERE id = 'global'`;
    await appendCaioAttentionControlEvent(tx, { op: "deploy-end", actorRef: `host_deploy:${control.leaseNodeId ?? "unknown"}`,
      epoch: control.epoch, openEpoch: control.openEpoch,
      payload: { nodeId: control.leaseNodeId, targetDeploymentId: control.leaseTargetDeploymentId } });
    return { ended: true };
  }, CAIO_ATTENTION_CONTROL_TX);
}

/**
 * deploy-recover (v6 §2.2): only via the overlay's host-locked recovery entry on the lease holder's host (the host
 * lock and the local node identity are that caller's obligation). Here: the lease must be held by this node and
 * have expired; FOR UPDATE waits for any live hold barrier. Revokes the node's proofs in place, clears the lease
 * and pauses; only a later begin -> attest -> end -> resume reopens.
 */
export async function recoverCaioAttentionDeployment(client: PrismaClient, input: Readonly<{ nodeId: unknown }>) {
  const nodeId = requireMatch(input.nodeId, CAIO_ATTENTION_NODE_ID_PATTERN, "node_id_invalid");
  const ref = auditRef(`host_deploy:${nodeId}`, "deploy-recover");
  return client.$transaction(async (tx) => {
    const control = await lockControl(tx, "UPDATE");
    const verdict = evaluateCaioAttentionRecover({ lease: control, requestNodeId: nodeId, localNodeId: nodeId, hostLockAcquired: true, now: control.now });
    if (!verdict.ok) refuse(verdict.reason);
    const { revokedEpoch } = caioAttentionRevokeInPlace(control.epoch);
    const revokedProofs = await revokeNodeReadiness(tx, nodeId, revokedEpoch, ref);
    await tx.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'PAUSED', leaseToken = NULL, leaseNodeId = NULL,
      leaseTargetDeploymentId = NULL, leaseAcquiredAt = NULL, leaseExpiresAt = NULL, rowVersion = rowVersion + 1,
      updatedByRef = ${ref}, updatedAt = NOW(3) WHERE id = 'global'`;
    await appendCaioAttentionControlEvent(tx, { op: "deploy-recover", actorRef: `host_deploy:${nodeId}`, epoch: control.epoch,
      openEpoch: control.openEpoch, payload: { nodeId, targetDeploymentId: control.leaseTargetDeploymentId,
        leaseExpiresAt: control.leaseExpiresAt?.toISOString() ?? null, revokedEpoch, revokedProofs } });
    return { recovered: true, nodeId };
  }, CAIO_ATTENTION_CONTROL_TX);
}

/**
 * guard-downgrade (v6 §2.4): PAUSED, no lease, no open case; revokes the node's proofs in place so resume stays
 * blocked until the guard is restored and the node re-attests. The appended guard-downgrade event is the
 * GUARD_DOWNGRADED record (it survives later writes; updatedByRef only mirrors the last one).
 */
export async function downgradeCaioAttentionGuard(
  client: PrismaClient,
  input: Readonly<{ nodeId: unknown; fromGuardVersion: unknown; toGuardVersion: unknown }>,
) {
  const nodeId = requireMatch(input.nodeId, CAIO_ATTENTION_NODE_ID_PATTERN, "node_id_invalid");
  const from = requireCount(input.fromGuardVersion, "guard_version_invalid");
  const to = requireCount(input.toGuardVersion, "guard_version_invalid");
  if (to >= from) refuse("guard_not_a_downgrade");
  const ref = auditRef(`host_deploy:${nodeId}`, `GUARD_DOWNGRADED:${from}->${to}`);
  return client.$transaction(async (tx) => {
    const control = await lockControl(tx, "UPDATE");
    if (control.intakeState !== "PAUSED") refuse("not_paused");
    if (control.leaseToken) refuse("lease_present");
    if (await countOpenCases(tx) > 0) refuse("open_cases_present");
    const { revokedEpoch } = caioAttentionRevokeInPlace(control.epoch);
    const revokedProofs = await revokeNodeReadiness(tx, nodeId, revokedEpoch, ref);
    await tx.$executeRaw`UPDATE CaioAttentionControl SET rowVersion = rowVersion + 1, updatedByRef = ${ref}, updatedAt = NOW(3)
      WHERE id = 'global'`;
    await appendCaioAttentionControlEvent(tx, { op: "guard-downgrade", actorRef: `host_deploy:${nodeId}`, epoch: control.epoch,
      openEpoch: control.openEpoch, payload: { kind: "GUARD_DOWNGRADED", nodeId, fromGuardVersion: from, toGuardVersion: to,
        revokedEpoch, revokedProofs } });
    return { downgraded: true };
  }, CAIO_ATTENTION_CONTROL_TX);
}
