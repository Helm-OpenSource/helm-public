import { MembershipStatus, PrismaClient, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CaioAttentionRouteRule } from "./contracts";
import { runCaioAttentionGenerator } from "./generator.service";
import { registerCaioAttentionPack, resetCaioAttentionPackForTests } from "./registry";
import { CAIO_ATTENTION_TEST_DEFAULT_POLICY as policy } from "./schedule";

/**
 * Suggestion generator on an isolated MySQL database as the least-privilege generator identity (environment as in
 * schema.mysql.test.ts). The migration identity seeds rows and opens / pauses intake in place of the quick check and the
 * operator CLI. T-G1 concurrent generation, T-G2 generation vs clear, T-G4/T-G6 gates, T-G5 recurrence, T-F1/T-F3 prefill.
 */
const urls = { admin: process.env.CAIO_ATTENTION_DATABASE_URL, generator: process.env.CAIO_ATTENTION_GENERATOR_DATABASE_URL };
const configured = Boolean(urls.admin && urls.generator && process.env.CAIO_ATTENTION_WEB_DATABASE_URL && process.env.CAIO_ATTENTION_OPS_DATABASE_URL);
if (process.env.CAIO_ATTENTION_MYSQL_REQUIRED === "1" && !configured) {
  throw new Error("CAIO_ATTENTION_MYSQL_REQUIRED=1 but a CAIO_ATTENTION_*_DATABASE_URL is missing.");
}
const describeMysql = configured ? describe.sequential : describe.skip;

const WS = "ws-gen";
const NOW = new Date("2026-11-04T02:05:00.000Z"); // 10:05 at UTC+8
const LATEST = new Date("2026-11-04T02:00:00.000Z");
const BUCKET_MS = 600_000;
const USERS = ["u-lead", "u-result", "u-helper", "u-owner"];
const rule: CaioAttentionRouteRule = {
  detectorId: "det-a", category: "business", primaryRoleKey: "lead", primaryFallbackRoleKeys: ["result_owner"], ccRoleKeys: ["helper"],
  escalationRoleKey: "result_owner", escalationFallbackRoleKey: "ws_owner", reviewerRoleKey: "result_owner",
  reviewerFallbackRoleKey: "ws_owner", compatibleRuleVersions: ["v1"], committedDue: "suggest",
};

describeMysql("CAIO attention suggestion generator on MySQL as the generator identity", () => {
  let admin: PrismaClient, generator: PrismaClient, generator2: PrismaClient;
  const run = (client = generator, now = NOW, latest = LATEST) =>
    runCaioAttentionGenerator({ workspaceId: WS, tickId: `tick-${latest.getTime()}`, latestBucketStart: latest, bucketMinutes: 10, now, client });

  async function candidate(id: string, severity = "critical", mergeKey = "mk", lastSeenAt = NOW) {
    await admin.$executeRaw`INSERT INTO CaioAnomalyCandidate (id, workspaceId, detectorId, mergeKey, openKey, objectKey, severity, reasonCode,
      titleZh, titleEn, status, firstSeenAt, lastSeenAt, lastTickId, evidenceRefsJson) VALUES (${id}, ${WS}, 'det-a', ${mergeKey},
      ${`det-a:${mergeKey}`}, 'obj', ${severity}, 'r', 'zh', 'en', 'OPEN', ${lastSeenAt}, ${lastSeenAt}, 't', '[]')`;
  }
  const clear = (id: string) => admin.caioAnomalyCandidate.update({ where: { id }, data: { status: "CLEARED", openKey: null, clearedAt: NOW } });
  async function hit(bucketsBack: number, mergeKeys = ["mk"], ruleVersion = "v1", outcome = "HIT") {
    const bucketStart = new Date(LATEST.getTime() - bucketsBack * BUCKET_MS);
    await generator.caioDetectorEvaluation.create({ data: {
      workspaceId: WS, tickId: `tick-${bucketStart.getTime()}`, bucketStart, detectorId: "det-a", ruleVersion, outcome,
      hitMergeKeysJson: JSON.stringify(mergeKeys),
    } });
  }
  const setIntake = (state: string) => admin.$executeRaw`UPDATE CaioAttentionControl SET intakeState = ${state} WHERE id = 'global'`;
  const cases = () => admin.caioAttentionCase.findMany({ where: { workspaceId: WS }, orderBy: { shortNo: "asc" } });
  const events = (kind?: string) => admin.caioAttentionCaseEvent.findMany({ where: kind ? { kind } : {}, orderBy: { createdAt: "asc" } });

  beforeAll(async () => {
    const adminUrl = new URL(urls.admin!);
    if (process.env.DATABASE_URL !== urls.admin || !adminUrl.pathname.slice(1).startsWith("helm_caio_attention_")
      || new URL(urls.generator!).username !== "attention_generator") {
      throw new Error("DATABASE_URL must equal CAIO_ATTENTION_DATABASE_URL on a disposable helm_caio_attention_* database.");
    }
    admin = new PrismaClient({ datasources: { db: { url: urls.admin! } } });
    generator = new PrismaClient({ datasources: { db: { url: urls.generator! } } });
    generator2 = new PrismaClient({ datasources: { db: { url: urls.generator! } } });
    await admin.workspace.upsert({ where: { id: WS }, update: {}, create: { id: WS, name: "Attention generator test", slug: "caio-attention-generator-test" } });
    for (const userId of USERS) {
      await admin.user.upsert({ where: { id: userId }, update: {}, create: { id: userId, name: userId, email: `${userId}@example.test` } });
    }
    resetCaioAttentionPackForTests();
    registerCaioAttentionPack({
      packId: "test", policy, rules: [rule],
      verifyEnterpriseScope: async ({ slug }) => slug === "ent-ok",
    });
  });

  beforeEach(async () => {
    for (const table of ["CaioAttentionCase", "CaioAttentionCaseEvent", "CaioAttentionRouteConfig", "CaioAttentionRouteConfigHead",
      "CaioDetectorEvaluation", "CaioAttentionPauseRequest", "CaioAnomalyCandidate", "Membership"]) {
      await admin.$executeRawUnsafe(`DELETE FROM \`${table}\` WHERE ${table === "CaioAttentionCaseEvent" || table === "CaioAttentionPauseRequest" ? "1 = 1" : `workspaceId = '${WS}'`}`);
    }
    await admin.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'OPEN', openEpoch = 1 WHERE id = 'global'`;
    const config = { schemaVersion: "caio-attention-routes/v1", roleBindings: {
      lead: ["user:u-lead"], result_owner: ["user:u-result"], helper: ["user:u-helper"], ws_owner: ["user:u-owner"],
    } };
    await admin.caioAttentionRouteConfig.create({ data: {
      workspaceId: WS, version: 1, schemaVersion: config.schemaVersion, configJson: JSON.stringify(config), contentHash: "h", createdByRef: "test",
    } });
    await admin.caioAttentionRouteConfigHead.create({ data: { workspaceId: WS, activeVersion: 1, updatedByRef: "test" } });
    for (const userId of USERS) {
      await admin.membership.create({ data: { workspaceId: WS, userId, role: WorkspaceRole.MEMBER, status: MembershipStatus.ACTIVE } });
    }
  });

  afterAll(async () => {
    resetCaioAttentionPackForTests();
    if (admin) await admin.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'PAUSED', openEpoch = 0 WHERE id = 'global'`;
    await Promise.all([admin, generator, generator2].map((client) => client?.$disconnect()));
  });

  it("T-G6: writes nothing while intake is PAUSED or a pause request names the open epoch", async () => {
    await Promise.all([candidate("cand-1"), hit(0), setIntake("PAUSED")]);
    expect(await run()).toMatchObject({ status: "intake_closed", created: 0 });
    await setIntake("OPEN");
    await admin.$executeRaw`INSERT INTO CaioAttentionPauseRequest (id, openEpoch, reasonCode, requestedByRef) VALUES ('pr', 1, 'watchdog', 'w')`;
    expect(await run()).toMatchObject({ status: "intake_closed", created: 0 });
    expect(await cases()).toEqual([]);
  });

  it("suggests a critical case with the prefill, the suggested deadline and an immediate OWNER reminder due", async () => {
    await candidate("cand-1");
    await hit(0);
    expect(await run()).toEqual({ status: "completed", created: 1, recurred: 0, severityRaised: 0, skipped: {} });
    const [row] = await cases();
    expect(row).toMatchObject({
      shortNo: 1, status: "SUGGESTED", activeKey: "det-a:mk", originCandidateId: "cand-1", category: "business", routingBlocked: false,
      primaryUserId: "u-lead", ccUserIdsJson: "[\"u-helper\"]", escalationUserId: "u-result", reviewerUserIdsJson: "[\"u-result\"]",
      reviewerSuggestedUserId: "u-result", confirmedByUserId: null, committedDueAt: null, commandVersion: 0, routeConfigVersion: 1,
      severityAtSuggest: "critical", effectiveSeverity: "critical", r0aDueAt: NOW, dispatchedAt: null,
    });
    const [suggested] = await events("SUGGESTED");
    expect(JSON.parse(suggested.payloadJson)).toMatchObject({ prefill: { suggestedDueAt: "2026-11-04T12:00:00.000Z" }, blocks: [] });
    expect(await run()).toMatchObject({ created: 0, skipped: { already_attached: 1 } });
  });

  it("T-G3/T-G4: warning needs two adjacent HIT buckets; stale evidence and incompatible versions never suggest", async () => {
    await candidate("cand-1", "warning");
    await hit(0);
    expect(await run()).toMatchObject({ created: 0, skipped: { bucket_missing: 1 } });
    await hit(1, ["mk"], "v0");
    expect(await run()).toMatchObject({ created: 0, skipped: { rule_version_incompatible: 1 } });
    await clear("cand-1");
    await candidate("cand-2", "critical", "mk", new Date(NOW.getTime() - 16 * 60_000));
    expect(await run()).toMatchObject({ created: 0, skipped: { evidence_stale: 1 } });
    expect(await cases()).toEqual([]);
  });

  it("T-F1/T-F3: falls back along the primary chain only, and blocks an unverified enterprise without people", async () => {
    await admin.membership.updateMany({ where: { workspaceId: WS, userId: "u-lead" }, data: { status: MembershipStatus.INACTIVE } });
    await candidate("cand-1");
    await candidate("cand-2", "critical", "m:enterprise:ent-unknown");
    await hit(0, ["mk", "m:enterprise:ent-unknown"]);
    expect(await run()).toMatchObject({ created: 2 });
    const [fallback, blocked] = await cases();
    expect(fallback).toMatchObject({ primaryUserId: "u-result", escalationUserId: "u-owner", reviewerUserIdsJson: "[\"u-owner\"]", routingBlocked: false });
    expect(blocked).toMatchObject({ enterpriseSlug: "ent-unknown", primaryUserId: null, routingBlocked: true,
      routingBlockedReasonsJson: "[\"enterprise_unverified\"]", ccUserIdsJson: "[]" });
  });

  it("T-G1: two generators racing on the same candidate leave exactly one case and one SUGGESTED event", async () => {
    await hit(0, [0, 1, 2, 3, 4].map((round) => `mk-${round}`));
    for (let round = 0; round < 5; round += 1) {
      await candidate(`cand-${round}`, "critical", `mk-${round}`);
      const results = await Promise.all([run(generator), run(generator2)]);
      expect(results.map((r) => ("created" in r ? r.created : -1)).sort()).toEqual([0, 1]);
    }
    expect((await cases()).map((c) => c.shortNo)).toEqual([1, 2, 3, 4, 5]);
    expect(await events("SUGGESTED")).toHaveLength(5);
  });

  it("T-G2: a clear holding the candidate lock wins, and a committed suggestion survives a later clear", async () => {
    await candidate("cand-1");
    await hit(0);
    let release!: () => void, locked!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const isLocked = new Promise<void>((resolve) => { locked = resolve; });
    const clearing = generator2.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE CaioAnomalyCandidate SET status = 'CLEARED', openKey = NULL, clearedAt = NOW(3) WHERE id = 'cand-1'`;
      locked();
      await hold;
    }, { timeout: 20_000 });
    await isLocked;
    let settled = false;
    const generating = run(generator).finally(() => { settled = true; });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(settled).toBe(false);
    release();
    await clearing;
    expect(await generating).toMatchObject({ created: 0, skipped: { candidate_not_open: 1 } });
    expect(await cases()).toEqual([]);

    await candidate("cand-2");
    expect(await run()).toMatchObject({ created: 1 });
    await clear("cand-2");
    expect(await cases()).toMatchObject([{ status: "SUGGESTED", originCandidateId: "cand-2" }]);
  });

  it("T-G5: recurrence appends once per candidate, raises severity once, and never rebuilds a terminal case", async () => {
    await candidate("cand-1", "warning");
    await hit(0);
    await hit(1);
    expect(await run()).toMatchObject({ created: 1 });
    await clear("cand-1");
    await candidate("cand-2", "warning");
    const racing = await Promise.all([run(generator), run(generator2)]);
    expect(racing.map((r) => ("recurred" in r ? r.recurred : -1)).sort()).toEqual([0, 1]);
    await admin.caioAnomalyCandidate.update({ where: { id: "cand-2" }, data: { severity: "critical" } });
    expect(await run()).toMatchObject({ created: 0, recurred: 0, severityRaised: 1 });
    expect(await run()).toMatchObject({ created: 0, recurred: 0, severityRaised: 0, skipped: { already_attached: 1 } });
    expect((await events()).map((e) => [e.kind, e.candidateId, e.dedupeKey])).toEqual([
      ["SUGGESTED", "cand-1", null], ["RECURRED", "cand-2", null], ["SEVERITY_RAISED", null, "critical"],
    ]);

    const [first] = await cases();
    await admin.caioAttentionCase.update({ where: { id: first.id }, data: { status: "DISMISSED", activeKey: null } });
    expect(await run()).toMatchObject({ created: 0, skipped: { candidate_consumed: 1 } });
    await clear("cand-2");
    await candidate("cand-3");
    expect(await run()).toMatchObject({ created: 1 });
    expect((await cases()).map((c) => [c.shortNo, c.originCandidateId, c.previousCaseId, c.status])).toEqual([
      [1, "cand-1", null, "DISMISSED"], [2, "cand-3", first.id, "SUGGESTED"],
    ]);
  });
});
