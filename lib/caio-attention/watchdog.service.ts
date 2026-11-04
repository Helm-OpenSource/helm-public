import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { parseCaioAttentionRouteConfig } from "./contracts";

/**
 * Attention watchdogs W1-W5, run by the web nodes' five-minute scan (design v4 §8.1).
 *
 * W3 evaluation watchdog (v6 §3.5, owner ruling §6.9): a detector that is enabled and routed, in a
 * workspace with an active route config, with no valid evaluation (HIT or NO_HIT) in each of the latest
 * WATCHDOG_BUCKETS quick-check buckets raises one alert per outage. W3a: no evaluation records at all;
 * W3b: records exist but are all SKIPPED / FAILED. Fewer ticks than the window means not enough history yet;
 * a stopped quick check is W2's concern, not this one.
 *
 * Read-only on the CAIO side; the only writes are in-app notifications. The dedupe key names the last valid
 * bucket before the outage, so one outage alerts once and a recovery followed by a new outage alerts again.
 */

export const CAIO_ATTENTION_WATCHDOG_BUCKETS = 3;

export type CaioAttentionWatchdogAlert = { workspaceId: string; detectorId: string; kind: "W3a" | "W3b"; recipients: number; created: number };

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function notifyOnce(client: PrismaClient, workspaceId: string, userId: string, title: string, body: string,
  dedupeKey: string): Promise<number> {
  return client.$executeRaw`
    INSERT INTO Notification (id, workspaceId, userId, type, title, body, url, dedupeKey, createdAt)
    SELECT ${randomUUID()}, ${workspaceId}, ${userId}, 'SYSTEM', ${title}, ${body}, NULL, ${dedupeKey}, NOW(3) FROM DUAL
    WHERE NOT EXISTS (SELECT 1 FROM Notification WHERE workspaceId = ${workspaceId} AND dedupeKey = ${dedupeKey})`;
}

async function recipientsFor(client: PrismaClient, workspaceId: string, roleKey: string | undefined): Promise<string[]> {
  const members = await client.$queryRaw<Array<{ userId: string; role: string }>>`
    SELECT userId, role FROM Membership WHERE workspaceId = ${workspaceId} AND status = 'ACTIVE' ORDER BY joinedAt, userId`;
  const active = new Set(members.map((member) => member.userId));
  if (roleKey) {
    const [config] = await client.$queryRaw<Array<{ configJson: string }>>`
      SELECT c.configJson FROM CaioAttentionRouteConfigHead h
      JOIN CaioAttentionRouteConfig c ON c.workspaceId = h.workspaceId AND c.version = h.activeVersion
      WHERE h.workspaceId = ${workspaceId}`;
    const parsed = config ? parseCaioAttentionRouteConfig(parseJson(config.configJson)) : null;
    const bound = parsed?.ok ? (parsed.config.roleBindings[roleKey] ?? []).filter((id) => active.has(id)) : [];
    if (bound.length > 0) return bound;
  }
  // Unbound or unconfigured: the alert still reaches a human instead of being dropped.
  return members.filter((member) => member.role === "OWNER").map((member) => member.userId);
}

export async function runCaioAttentionEvaluationWatchdog(input: {
  client: PrismaClient;
  now: Date;
  monitoredDetectorIds: readonly string[];
  watchdogRoleKey?: string;
}): Promise<CaioAttentionWatchdogAlert[]> {
  const { client } = input;
  const alerts: CaioAttentionWatchdogAlert[] = [];
  if (input.monitoredDetectorIds.length === 0) return alerts;
  const workspaces = await client.$queryRaw<Array<{ workspaceId: string }>>`
    SELECT workspaceId FROM CaioAttentionRouteConfigHead ORDER BY workspaceId`;
  for (const { workspaceId } of workspaces) {
    const ticks = await client.$queryRaw<Array<{ id: string; bucketStart: Date }>>`
      SELECT id, bucketStart FROM CaioQuickCheckTick WHERE workspaceId = ${workspaceId} AND bucketStart <= ${input.now}
      ORDER BY bucketStart DESC LIMIT ${CAIO_ATTENTION_WATCHDOG_BUCKETS}`;
    if (ticks.length < CAIO_ATTENTION_WATCHDOG_BUCKETS) continue;
    const oldest = ticks[ticks.length - 1].bucketStart;
    for (const detectorId of input.monitoredDetectorIds) {
      const outcomes = await client.$queryRaw<Array<{ outcome: string }>>`
        SELECT outcome FROM CaioDetectorEvaluation
        WHERE workspaceId = ${workspaceId} AND detectorId = ${detectorId} AND bucketStart >= ${oldest} AND bucketStart <= ${input.now}`;
      if (outcomes.some((row) => row.outcome === "HIT" || row.outcome === "NO_HIT")) continue;
      const kind = outcomes.length === 0 ? "W3a" : "W3b";
      const [lastValid] = await client.$queryRaw<Array<{ bucketStart: Date }>>`
        SELECT bucketStart FROM CaioDetectorEvaluation WHERE workspaceId = ${workspaceId} AND detectorId = ${detectorId}
          AND outcome IN ('HIT', 'NO_HIT') AND bucketStart < ${oldest}
        ORDER BY bucketStart DESC LIMIT 1`;
      const since = lastValid ? lastValid.bucketStart.toISOString() : "none";
      const recipients = await recipientsFor(client, workspaceId, input.watchdogRoleKey);
      let created = 0;
      for (const userId of recipients) {
        created += await notifyOnce(client, workspaceId, userId, `CAIO 探测器评估失效 · ${detectorId}`, kind === "W3a"
          ? `最近 ${CAIO_ATTENTION_WATCHDOG_BUCKETS} 个快检桶没有评估记录`
          : `最近 ${CAIO_ATTENTION_WATCHDOG_BUCKETS} 个快检桶评估均为跳过或失败；可能处于不适用时段且输入未知`,
        `ca-w3:${detectorId}:${since}:${userId}`);
      }
      alerts.push({ workspaceId, detectorId, kind, recipients: recipients.length, created });
    }
  }
  return alerts;
}

/** Same threshold as the /caio readout's stale marker (caio-operating-context/readout.ts). */
export const CAIO_ATTENTION_QUICK_CHECK_STALE_MS = 30 * 60_000;

/**
 * W2 quick-check stall: the latest tick is older than the stale threshold, or the latest three ticks all FAILED.
 * Goes to the watchdog role and the OWNERs. Keyed on the last tick (stale) or the last non-failed tick before the
 * failing run, so each stall alerts once. Workspaces without a route config, or without any tick, are not watched.
 */
export async function runCaioAttentionQuickCheckWatchdog(input: { client: PrismaClient; now: Date; watchdogRoleKey?: string }) {
  const { client } = input;
  const alerts: Array<{ workspaceId: string; kind: "W2_stale" | "W2_failed"; created: number }> = [];
  const workspaces = await client.$queryRaw<Array<{ workspaceId: string }>>`
    SELECT workspaceId FROM CaioAttentionRouteConfigHead ORDER BY workspaceId`;
  for (const { workspaceId } of workspaces) {
    const ticks = await client.$queryRaw<Array<{ bucketStart: Date; status: string }>>`
      SELECT bucketStart, status FROM CaioQuickCheckTick WHERE workspaceId = ${workspaceId} AND bucketStart <= ${input.now}
      ORDER BY bucketStart DESC LIMIT ${CAIO_ATTENTION_WATCHDOG_BUCKETS}`;
    if (ticks.length === 0) continue;
    let key: string | null = null;
    let kind: "W2_stale" | "W2_failed" = "W2_stale";
    if (input.now.getTime() - ticks[0].bucketStart.getTime() > CAIO_ATTENTION_QUICK_CHECK_STALE_MS) {
      key = `ca-w2:stale:${ticks[0].bucketStart.toISOString()}`;
    } else if (ticks.length === CAIO_ATTENTION_WATCHDOG_BUCKETS && ticks.every((tick) => tick.status === "FAILED")) {
      kind = "W2_failed";
      const [lastOk] = await client.$queryRaw<Array<{ bucketStart: Date }>>`
        SELECT bucketStart FROM CaioQuickCheckTick WHERE workspaceId = ${workspaceId} AND status <> 'FAILED'
          AND bucketStart < ${ticks[ticks.length - 1].bucketStart} ORDER BY bucketStart DESC LIMIT 1`;
      key = `ca-w2:failed:${lastOk ? lastOk.bucketStart.toISOString() : "none"}`;
    }
    if (!key) continue;
    const owners = await recipientsFor(client, workspaceId, undefined);
    const recipients = [...new Set([...(await recipientsFor(client, workspaceId, input.watchdogRoleKey)), ...owners])];
    let created = 0;
    for (const userId of recipients) {
      created += await notifyOnce(client, workspaceId, userId, "CAIO 快检停滞",
        kind === "W2_stale" ? "超过 30 分钟没有新的快检记录" : "最近 3 次快检均失败", `${key}:${userId}`);
    }
    alerts.push({ workspaceId, kind, created });
  }
  return alerts;
}

/**
 * W5 people no longer active (design v4 §7): for working cases, a primary, escalation holder or reviewer who is not an
 * ACTIVE member of the workspace is reported to the OWNERs, once per command version and person. The system never
 * reassigns; the OWNER reissues or assigns reviewers.
 */
export async function runCaioAttentionPeopleWatchdog(input: { client: PrismaClient }) {
  const { client } = input;
  const alerts: Array<{ caseId: string; userId: string; created: number }> = [];
  const cases = await client.$queryRaw<Array<{ id: string; workspaceId: string; shortNo: number; commandVersion: number;
    primaryUserId: string | null; escalationUserId: string | null; reviewerUserIdsJson: string }>>`
    SELECT id, workspaceId, shortNo, commandVersion, primaryUserId, escalationUserId, reviewerUserIdsJson FROM CaioAttentionCase
    WHERE status IN ('DISPATCHED', 'DISPOSITION_SUBMITTED') ORDER BY id`;
  for (const row of cases) {
    const members = await client.$queryRaw<Array<{ userId: string; role: string }>>`
      SELECT userId, role FROM Membership WHERE workspaceId = ${row.workspaceId} AND status = 'ACTIVE'`;
    const active = new Set(members.map((member) => member.userId));
    const reviewers = parseJson(row.reviewerUserIdsJson);
    const people = [row.primaryUserId, row.escalationUserId, ...(Array.isArray(reviewers) ? reviewers : [])]
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const owners = members.filter((member) => member.role === "OWNER").map((member) => member.userId);
    for (const userId of [...new Set(people)].filter((id) => !active.has(id))) {
      let created = 0;
      for (const ownerId of owners) {
        created += await notifyOnce(client, row.workspaceId, ownerId, `CAIO 关注事项 #${row.shortNo} · 人员失效`,
          "相关人员已不是有效成员，请重新下达命令或调整复核人", `ca:${row.id}:W5:v${row.commandVersion}:${userId}:${ownerId}`);
      }
      alerts.push({ caseId: row.id, userId, created });
    }
  }
  return alerts;
}

/**
 * W1 generation backlog: with intake OPEN, an OPEN critical candidate first seen more than 20 minutes ago that no case
 * carries (neither as its origin nor through the live case on the same detector and merge key). While intake is
 * paused the generator skips by design, so W1 stays quiet. One alert per candidate, to the watchdog role and OWNERs.
 */
export const CAIO_ATTENTION_GENERATION_BACKLOG_MS = 20 * 60_000;

export async function runCaioAttentionGenerationWatchdog(input: { client: PrismaClient; now: Date; watchdogRoleKey?: string }) {
  const { client } = input;
  const alerts: Array<{ workspaceId: string; candidateId: string; created: number }> = [];
  // The same gate the generator applies: OPEN and no pause request at the current open epoch.
  const [gate] = await client.$queryRaw<Array<{ intakeState: string; paused: bigint }>>`
    SELECT c.intakeState, (SELECT COUNT(*) FROM CaioAttentionPauseRequest p WHERE p.openEpoch = c.openEpoch) AS paused
    FROM CaioAttentionControl c WHERE c.id = 'global'`;
  if (!gate || gate.intakeState !== "OPEN" || Number(gate.paused) > 0) return alerts;
  const cutoff = new Date(input.now.getTime() - CAIO_ATTENTION_GENERATION_BACKLOG_MS);
  const backlog = await client.$queryRaw<Array<{ id: string; workspaceId: string; detectorId: string }>>`
    SELECT a.id, a.workspaceId, a.detectorId FROM CaioAnomalyCandidate a
    JOIN CaioAttentionRouteConfigHead h ON h.workspaceId = a.workspaceId
    WHERE a.status = 'OPEN' AND a.severity = 'critical' AND a.firstSeenAt <= ${cutoff}
      AND NOT EXISTS (SELECT 1 FROM CaioAttentionCase c WHERE c.originCandidateId = a.id)
      AND NOT EXISTS (SELECT 1 FROM CaioAttentionCase c WHERE c.workspaceId = a.workspaceId
        AND c.activeKey = CONCAT(a.detectorId, ':', a.mergeKey))
    ORDER BY a.workspaceId, a.id LIMIT 200`;
  for (const candidate of backlog) {
    const recipients = [...new Set([...(await recipientsFor(client, candidate.workspaceId, input.watchdogRoleKey)),
      ...(await recipientsFor(client, candidate.workspaceId, undefined))])];
    let created = 0;
    for (const userId of recipients) {
      created += await notifyOnce(client, candidate.workspaceId, userId, `CAIO 关注事项生成滞留 · ${candidate.detectorId}`,
        "严重异常超过 20 分钟仍未生成关注事项", `ca-w1:${candidate.id}:${userId}`);
    }
    alerts.push({ workspaceId: candidate.workspaceId, candidateId: candidate.id, created });
  }
  return alerts;
}

/**
 * W4 runtime nodes (design v5 §1.5, v6 §1.6): with intake OPEN, an expected node whose heartbeat is older than three
 * minutes, whose heartbeat deployment differs from its latest valid readiness proof, or whose close capability is
 * below the requirement, gets a pause request at the current open epoch and an alert to the watchdog role and
 * OWNERs. The web identity can only append pause requests, so this can close intake but never reopen it. The open
 * epoch is read under FOR SHARE in the same transaction as the insert, so it serialises with resume (REREVIEW5 P2-2).
 */
export const CAIO_ATTENTION_HEARTBEAT_STALE_MS = 3 * 60_000;
type PauseReason = "node_heartbeat_stale" | "deployment_mismatch" | "watchdog";

export async function runCaioAttentionNodeWatchdog(input: { client: PrismaClient; now: Date; watchdogRoleKey?: string }) {
  const { client } = input;
  const findings: Array<{ nodeId: string; reason: PauseReason; paused: boolean }> = [];
  const [control] = await client.$queryRaw<Array<{ intakeState: string; openEpoch: number; requiredCloseCapability: number;
    expectedNodesJson: string }>>`
    SELECT intakeState, openEpoch, requiredCloseCapability, expectedNodesJson FROM CaioAttentionControl WHERE id = 'global'`;
  if (!control || control.intakeState !== "OPEN") return findings;
  const expected = parseJson(control.expectedNodesJson);
  const nodeIds = Array.isArray(expected) ? expected.filter((id): id is string => typeof id === "string") : [];
  for (const nodeId of nodeIds) {
    const [beat] = await client.$queryRaw<Array<{ deploymentId: string; closeCapabilityVersion: number; lastSeenAt: Date }>>`
      SELECT deploymentId, closeCapabilityVersion, lastSeenAt FROM CaioAttentionRuntimeNode WHERE nodeId = ${nodeId}`;
    const [proof] = await client.$queryRaw<Array<{ deploymentId: string }>>`
      SELECT r.deploymentId FROM CaioAttentionNodeReadiness r WHERE r.nodeId = ${nodeId} AND r.revokedAt IS NULL
        AND r.epoch > COALESCE((SELECT MAX(x.revokedEpoch) FROM CaioAttentionNodeReadiness x WHERE x.nodeId = r.nodeId), -1)
      ORDER BY r.epoch DESC LIMIT 1`;
    let reason: PauseReason | null = null;
    if (!beat || input.now.getTime() - beat.lastSeenAt.getTime() > CAIO_ATTENTION_HEARTBEAT_STALE_MS) reason = "node_heartbeat_stale";
    else if (!proof || proof.deploymentId !== beat.deploymentId) reason = "deployment_mismatch";
    else if (beat.closeCapabilityVersion < control.requiredCloseCapability) reason = "watchdog";
    if (!reason) continue;
    const requestedByRef = `w4:${reason}:${nodeId}`.slice(0, 191);
    const paused = await client.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<Array<{ openEpoch: number }>>`
        SELECT openEpoch FROM CaioAttentionControl WHERE id = 'global' FOR SHARE`;
      const inserted = await tx.$executeRaw`
        INSERT INTO CaioAttentionPauseRequest (id, openEpoch, reasonCode, requestedByRef, createdAt)
        SELECT ${randomUUID()}, ${row.openEpoch}, ${reason}, ${requestedByRef}, NOW(3) FROM DUAL
        WHERE NOT EXISTS (SELECT 1 FROM CaioAttentionPauseRequest WHERE openEpoch = ${row.openEpoch} AND requestedByRef = ${requestedByRef})`;
      return { inserted: inserted === 1, openEpoch: row.openEpoch };
    });
    const workspaces = await client.$queryRaw<Array<{ workspaceId: string }>>`
      SELECT workspaceId FROM CaioAttentionRouteConfigHead ORDER BY workspaceId`;
    for (const { workspaceId } of workspaces) {
      const recipients = [...new Set([...(await recipientsFor(client, workspaceId, input.watchdogRoleKey)),
        ...(await recipientsFor(client, workspaceId, undefined))])];
      for (const userId of recipients) {
        await notifyOnce(client, workspaceId, userId, "CAIO 关注事项运行节点异常", `节点 ${nodeId}：${reason}；入口已请求暂停`,
          `ca-w4:${paused.openEpoch}:${reason}:${nodeId}:${userId}`.slice(0, 191));
      }
    }
    findings.push({ nodeId, reason, paused: paused.inserted });
  }
  return findings;
}
