import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { parseCaioAttentionRouteRule, type CaioAttentionRouteRule } from "./contracts";
import {
  runCaioAttentionEvaluationWatchdog, runCaioAttentionGenerationWatchdog, runCaioAttentionNodeWatchdog, runCaioAttentionPeopleWatchdog,
  runCaioAttentionQuickCheckWatchdog,
} from "./watchdog.service";

/**
 * W1-W5 watchdogs on an isolated MySQL database, run as the least-privilege web identity. Same environment as
 * schema.mysql.test.ts; `npm run test:caio-attention:mysql` fails instead of skipping.
 */
const urls = { admin: process.env.CAIO_ATTENTION_DATABASE_URL, web: process.env.CAIO_ATTENTION_WEB_DATABASE_URL };
const configured = Boolean(urls.admin && urls.web);
if (process.env.CAIO_ATTENTION_MYSQL_REQUIRED === "1" && !configured) {
  throw new Error("CAIO_ATTENTION_MYSQL_REQUIRED=1 but a CAIO_ATTENTION_*_DATABASE_URL is missing.");
}
const describeMysql = configured ? describe.sequential : describe.skip;

const WS = "ws-watchdog";
const USERS = [["u-w-owner", "OWNER"], ["u-w-tech", "ADMIN"]] as const;
const at = (minute: number) => new Date(Date.UTC(2026, 10, 4, 2, minute));
const rule = (detectorId: string, primaryRoleKey: string): CaioAttentionRouteRule => {
  const parsed = parseCaioAttentionRouteRule({ detectorId, category: "technical", primaryRoleKey, primaryFallbackRoleKeys: [],
    ccRoleKeys: [], escalationRoleKey: "sup", escalationFallbackRoleKey: "sup", reviewerRoleKey: "sup",
    reviewerFallbackRoleKey: "sup", compatibleRuleVersions: ["v1"], committedDue: "suggest" });
  if (!parsed.ok) throw new Error("fixture rule invalid");
  return parsed.rule;
};
// det-d's primary role has no holder in the workspace: not routed there, never watched.
const RULES = [rule("det-a", "sup"), rule("det-b", "sup"), rule("det-c", "sup"), rule("det-d", "unbound")];

describeMysql("CAIO attention watchdogs on MySQL as the web identity", () => {
  let admin: PrismaClient, web: PrismaClient;

  beforeAll(async () => {
    if (!new URL(urls.admin!).pathname.slice(1).startsWith("helm_caio_attention_") || new URL(urls.web!).username !== "attention_web") {
      throw new Error("watchdog tests need a disposable helm_caio_attention_* database and the attention_web identity.");
    }
    admin = new PrismaClient({ datasources: { db: { url: urls.admin! } } });
    web = new PrismaClient({ datasources: { db: { url: urls.web! } } });
    await admin.workspace.upsert({ where: { id: WS }, update: {}, create: { id: WS, name: "Watchdog", slug: WS } });
    for (const [id, role] of USERS) {
      await admin.user.upsert({ where: { id }, update: {}, create: { id, name: id, email: `${id}@example.test` } });
      await admin.membership.upsert({ where: { workspaceId_userId: { workspaceId: WS, userId: id } }, update: {},
        create: { workspaceId: WS, userId: id, role } });
    }
  });

  beforeEach(async () => {
    for (const table of ["CaioAttentionCase", "CaioAttentionRouteConfig", "CaioAttentionRouteConfigHead", "CaioDetectorEvaluation"]) {
      await admin.$executeRawUnsafe(`DELETE FROM \`${table}\``);
    }
    await admin.$executeRaw`DELETE FROM Notification WHERE workspaceId = ${WS}`;
    await admin.$executeRaw`DELETE FROM CaioQuickCheckTick WHERE workspaceId = ${WS}`;
    await admin.$executeRaw`DELETE FROM CaioAnomalyCandidate WHERE workspaceId = ${WS}`;
    for (const table of ["CaioAttentionPauseRequest", "CaioAttentionNodeReadiness", "CaioAttentionRuntimeNode"]) {
      await admin.$executeRawUnsafe(`DELETE FROM \`${table}\``);
    }
    await admin.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'PAUSED', openEpoch = 0, expectedNodesJson = '[]'
      WHERE id = 'global'`;
  });
  const openIntake = (nodes: string[] = []) => admin.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'OPEN', openEpoch = 4,
    expectedNodesJson = ${JSON.stringify(nodes)} WHERE id = 'global'`;

  afterAll(async () => {
    await admin?.workspace.deleteMany({ where: { id: WS } });
    await admin?.user.deleteMany({ where: { id: { in: USERS.map(([id]) => id) } } });
    await Promise.all([admin, web].map((client) => client?.$disconnect()));
  });

  async function seed(bindTech: boolean) {
    const config = { schemaVersion: "caio-attention-routes/v1",
      roleBindings: { sup: ["user:u-w-owner"], ...(bindTech ? { tech: ["user:u-w-tech"] } : {}) } };
    await admin.$executeRaw`INSERT INTO CaioAttentionRouteConfig (id, workspaceId, version, schemaVersion, configJson, contentHash,
      createdByRef) VALUES ('rc-w', ${WS}, 1, 'caio-attention-routes/v1', ${JSON.stringify(config)}, 'h', 'test')`;
    await admin.$executeRaw`INSERT INTO CaioAttentionRouteConfigHead (id, workspaceId, activeVersion, updatedByRef) VALUES ('h-w', ${WS}, 1, 't')`;
    for (const minute of [0, 10, 20, 30]) {
      await admin.$executeRaw`INSERT INTO CaioQuickCheckTick (id, workspaceId, bucketStart, status)
        VALUES (${`t-w-${minute}`}, ${WS}, ${at(minute)}, 'COMPLETED')`;
    }
  }
  const evaluation = (detectorId: string, minute: number, outcome: string) => admin.$executeRaw`INSERT INTO CaioDetectorEvaluation
    (id, workspaceId, tickId, bucketStart, detectorId, ruleVersion, outcome, hitMergeKeysJson)
    VALUES (${`ev-${detectorId}-${minute}`}, ${WS}, ${`t-w-${minute}`}, ${at(minute)}, ${detectorId}, 'v1', ${outcome}, '[]')`;
  const run = () => runCaioAttentionEvaluationWatchdog({ client: web, now: at(35),
    routeRules: RULES, watchdogRoleKey: "tech" });
  const notices = () => admin.$queryRaw<Array<{ userId: string; type: string; dedupeKey: string }>>`
    SELECT userId, type, dedupeKey FROM Notification WHERE workspaceId = ${WS} ORDER BY dedupeKey`;

  it("alerts once per outage when a routed detector has no valid evaluation in the last three buckets (T-W3, T-W5)", async () => {
    await seed(true);
    await evaluation("det-a", 0, "NO_HIT");
    for (const minute of [10, 20, 30]) await evaluation("det-a", minute, "SKIPPED"); // W3b, even if not applicable
    await evaluation("det-b", 20, "NO_HIT"); // one valid evaluation in the window: healthy
    // det-c: no records at all -> W3a
    expect((await run()).map((a) => [a.detectorId, a.kind, a.created])).toEqual([["det-a", "W3b", 1], ["det-c", "W3a", 1]]);
    expect((await run()).map((a) => a.created)).toEqual([0, 0]);
    // A tick still RUNNING has no evaluations yet and does not count as an empty bucket.
    await admin.$executeRaw`INSERT INTO CaioQuickCheckTick (id, workspaceId, bucketStart, status) VALUES ('t-w-40', ${WS}, ${at(40)}, 'RUNNING')`;
    await evaluation("det-b", 30, "HIT");
    const later = await runCaioAttentionEvaluationWatchdog({ client: web, now: at(45), routeRules: RULES, watchdogRoleKey: "tech" });
    expect(later.map((a) => [a.detectorId, a.created])).toEqual([["det-a", 0], ["det-c", 0]]);
    expect((await notices()).map((n) => `${n.userId} ${n.type} ${n.dedupeKey}`)).toEqual([
      `u-w-tech SYSTEM ca-w3:det-a:${at(0).toISOString()}:u-w-tech`, "u-w-tech SYSTEM ca-w3:det-c:none:u-w-tech",
    ]);
  });

  it("falls back to the OWNER when the watchdog role is unbound, and waits for three buckets of history", async () => {
    await seed(false);
    expect((await run()).map((a) => [a.detectorId, a.kind])).toEqual([["det-a", "W3a"], ["det-b", "W3a"], ["det-c", "W3a"]]);
    expect(new Set((await notices()).map((n) => n.userId))).toEqual(new Set(["u-w-owner"]));
    await admin.$executeRaw`DELETE FROM CaioQuickCheckTick WHERE workspaceId = ${WS} AND bucketStart >= ${at(10)}`;
    await admin.$executeRaw`DELETE FROM Notification WHERE workspaceId = ${WS}`;
    expect(await run()).toEqual([]);
  });

  it("W2 alerts once on a stale quick check and once on three consecutive failures", async () => {
    await seed(true);
    const w2 = (minute: number) => runCaioAttentionQuickCheckWatchdog({ client: web, now: at(minute), watchdogRoleKey: "tech" });
    expect(await w2(35)).toEqual([]);
    expect((await w2(61)).map((a) => [a.kind, a.created])).toEqual([["W2_stale", 2]]);
    expect((await w2(70)).map((a) => a.created)).toEqual([0]);
    await admin.$executeRaw`UPDATE CaioQuickCheckTick SET status = 'FAILED' WHERE workspaceId = ${WS} AND bucketStart >= ${at(10)}`;
    expect((await w2(35)).map((a) => [a.kind, a.created])).toEqual([["W2_failed", 2]]);
    expect((await w2(36)).map((a) => a.created)).toEqual([0]);
    expect((await notices()).map((n) => n.dedupeKey)).toEqual(expect.arrayContaining([
      `ca-w2:stale:${at(30).toISOString()}:u-w-tech`, `ca-w2:failed:${at(0).toISOString()}:u-w-owner`]));
  });

  it("W1 alerts once per critical candidate left uncarried for 20 minutes, only while intake is open", async () => {
    await seed(true);
    const candidate = (id: string, severity: string, firstSeenMinute: number, mergeKey = id) => admin.$executeRaw`
      INSERT INTO CaioAnomalyCandidate (id, workspaceId, detectorId, mergeKey, openKey, objectKey, severity, reasonCode, titleZh,
        titleEn, status, firstSeenAt, lastSeenAt, lastTickId, evidenceRefsJson)
      VALUES (${id}, ${WS}, 'det', ${mergeKey}, ${`det:${mergeKey}`}, 'obj', ${severity}, 'r', 't', 't', 'OPEN', ${at(firstSeenMinute)},
        ${at(30)}, 't-w-30', '[]')`;
    await candidate("cand-old", "critical", 0);
    await candidate("cand-young", "critical", 20);
    await candidate("cand-warn", "warning", 0);
    await candidate("cand-carried", "critical", 0, "mk-carried");
    await admin.$executeRaw`INSERT INTO CaioAttentionCase (id, workspaceId, shortNo, detectorId, mergeKey, objectKey, category,
      originCandidateId, activeKey, status, ccUserIdsJson, reviewerUserIdsJson, severityAtSuggest, effectiveSeverity, reminderPolicy)
      VALUES ('carrier', ${WS}, 7, 'det', 'mk-carried', 'obj', 'business', 'cand-earlier', 'det:mk-carried', 'SUGGESTED', '[]', '[]',
        'critical', 'critical', 'critical')`;
    const w1 = () => runCaioAttentionGenerationWatchdog({ client: web, now: at(35), watchdogRoleKey: "tech" });
    expect(await w1()).toEqual([]); // paused: the generator skips by design
    await openIntake();
    expect((await w1()).map((a) => [a.candidateId, a.created])).toEqual([["cand-old", 2]]);
    expect((await w1()).map((a) => a.created)).toEqual([0]);
    await admin.$executeRaw`INSERT INTO CaioAttentionPauseRequest (id, openEpoch, reasonCode, requestedByRef) VALUES ('p', 4, 'operator', 'o')`;
    expect(await w1()).toEqual([]);
  });

  it("W4 requests a pause at the open epoch and alerts for stale, mismatched or under-capable nodes", async () => {
    await seed(true);
    await openIntake(["web-a", "web-b", "web-c", "web-d"]);
    const beat = (nodeId: string, deploymentId: string, minute: number, capability = 1) => admin.$executeRaw`
      INSERT INTO CaioAttentionRuntimeNode (id, nodeId, role, deploymentId, closeCapabilityVersion, remindersEnabled, lastSeenAt)
      VALUES (${`rn-${nodeId}`}, ${nodeId}, 'web', ${deploymentId}, ${capability}, true, ${at(minute)})`;
    const proof = (nodeId: string, deploymentId: string) => admin.$executeRaw`INSERT INTO CaioAttentionNodeReadiness
      (id, nodeId, deploymentId, closeCapabilityVersion, guardVersion, epoch, verifiedAt, verifiedByRef)
      VALUES (${`rd-${nodeId}`}, ${nodeId}, ${deploymentId}, 1, 1, 1, ${at(0)}, 'test')`;
    for (const node of ["web-a", "web-b", "web-c", "web-d"]) await proof(node, "d1");
    await beat("web-a", "d1", 34); // healthy
    await beat("web-b", "d1", 30); // 5 minutes old
    await beat("web-c", "d0", 34); // rolled back under a live proof
    await beat("web-d", "d1", 34, 0); // capability below the requirement
    const w4 = () => runCaioAttentionNodeWatchdog({ client: web, now: at(35), watchdogRoleKey: "tech" });
    expect((await w4()).map((f) => [f.nodeId, f.reason, f.paused])).toEqual([
      ["web-b", "node_heartbeat_stale", true], ["web-c", "deployment_mismatch", true], ["web-d", "watchdog", true]]);
    expect((await w4()).map((f) => f.paused)).toEqual([false, false, false]);
    const requests = await admin.$queryRaw<Array<{ openEpoch: number; requestedByRef: string }>>`
      SELECT openEpoch, requestedByRef FROM CaioAttentionPauseRequest ORDER BY requestedByRef`;
    expect(requests).toEqual([{ openEpoch: 4, requestedByRef: "w4:deployment_mismatch:web-c" },
      { openEpoch: 4, requestedByRef: "w4:node_heartbeat_stale:web-b" }, { openEpoch: 4, requestedByRef: "w4:watchdog:web-d" }]);
    expect((await notices()).filter((n) => n.dedupeKey.startsWith("ca-w4:"))).toHaveLength(6);
  });

  it("W5 tells the OWNER, once per command version, that a working case's person is no longer active", async () => {
    await admin.$executeRaw`INSERT INTO CaioAttentionCase (id, workspaceId, shortNo, detectorId, mergeKey, objectKey, category,
      originCandidateId, activeKey, status, commandVersion, primaryUserId, ccUserIdsJson, escalationUserId, reviewerUserIdsJson,
      severityAtSuggest, effectiveSeverity, reminderPolicy)
      VALUES ('w5', ${WS}, 1, 'det', 'mk', 'obj', 'business', 'cand-w5', 'det:mk', 'DISPATCHED', 3, 'u-gone', '[]', 'u-w-tech',
        '["u-w-tech","u-left"]', 'warning', 'warning', 'warning')`;
    expect((await runCaioAttentionPeopleWatchdog({ client: web })).map((a) => [a.userId, a.created]))
      .toEqual([["u-gone", 1], ["u-left", 1]]);
    expect((await runCaioAttentionPeopleWatchdog({ client: web })).map((a) => a.created)).toEqual([0, 0]);
    expect((await notices()).map((n) => `${n.userId} ${n.dedupeKey}`)).toEqual([
      "u-w-owner ca:w5:W5:v3:u-gone:u-w-owner", "u-w-owner ca:w5:W5:v3:u-left:u-w-owner"]);
  });
});
