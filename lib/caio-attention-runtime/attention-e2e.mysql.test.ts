import { randomUUID } from "node:crypto";

import { PrismaClient, type WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CaioAttentionCommandFields, CaioAttentionCommandInput, CaioAttentionViewer } from "@/features/caio-attention/service-contract";
import type { CaioAttentionRouteRule } from "@/lib/caio-attention/contracts";
import { pauseCaioAttentionIntake } from "@/lib/caio-attention/control.service";
import { runCaioAttentionGenerator } from "@/lib/caio-attention/generator.service";
import { resumeDeferredCaioAttentionCase } from "@/lib/caio-attention/lifecycle/lifecycle.service";
import { registerCaioAttentionPack, resetCaioAttentionPackForTests } from "@/lib/caio-attention/registry";
import { runCaioAttentionReminderScan } from "@/lib/caio-attention/reminder-scanner.service";
import { CAIO_ATTENTION_TEST_DEFAULT_POLICY as policy } from "@/lib/caio-attention/schedule";

import { createCaioAttentionPackPageService } from "./bound-page-service";

/**
 * End-to-end attention chain on an isolated MySQL database with the three least-privilege identities only
 * (`npm run test:caio-attention:mysql`): the generator identity turns a quick-check hit into a SUGGESTED case; the web
 * identity runs every human step through the pack-bound page service (policy and enterprise hook from the one
 * registered pack), the reminder scan and the system resume; the operator identity pauses intake. The migration
 * identity only seeds the Core rows the quick check and the overlay would have written (users, memberships, route
 * config, candidates, the evidence audit row) and reads results.
 */
const urls = {
  admin: process.env.CAIO_ATTENTION_DATABASE_URL, generator: process.env.CAIO_ATTENTION_GENERATOR_DATABASE_URL,
  web: process.env.CAIO_ATTENTION_WEB_DATABASE_URL, ops: process.env.CAIO_ATTENTION_OPS_DATABASE_URL,
};
const configured = Object.values(urls).every(Boolean);
if (process.env.CAIO_ATTENTION_MYSQL_REQUIRED === "1" && !configured) {
  throw new Error("CAIO_ATTENTION_MYSQL_REQUIRED=1 but a CAIO_ATTENTION_*_DATABASE_URL is missing.");
}
const describeMysql = configured ? describe.sequential : describe.skip;

const MIN = 60_000;
const BUCKET_MS = 10 * MIN;
const DAY = new Date("2026-11-04T02:05:00.000Z"); // 10:05 at UTC+8, inside the daytime window
const NIGHT = new Date("2026-11-04T14:05:00.000Z"); // 22:05 at UTC+8
const at = (base: Date, minutes: number) => new Date(base.getTime() + minutes * MIN);
const bucketOf = (now: Date) => new Date(Math.floor(now.getTime() / BUCKET_MS) * BUCKET_MS);

describeMysql("CAIO attention end to end on MySQL with the three least-privilege identities", () => {
  let admin: PrismaClient, generator: PrismaClient, web: PrismaClient, ops: PrismaClient;
  let workspaceId = "";
  let clock = DAY;
  let mergeSeq = 0;
  const people = {} as Record<"owner" | "primary" | "cc" | "escalation" | "reviewer" | "cc2", string>;
  const roles: Record<keyof typeof people, WorkspaceRole> = {
    owner: "OWNER", primary: "OPERATOR", cc: "MEMBER", escalation: "OPERATOR", reviewer: "REVIEWER", cc2: "MEMBER",
  };
  const rid = () => `req-${randomUUID()}`;
  const viewer = (key: keyof typeof people): CaioAttentionViewer => ({
    workspaceId, actor: { userId: people[key], sameWorkspace: true, active: true, role: key === "owner" ? "OWNER" : "OTHER", canReviewGovernedActions: true },
  });
  const service = () => createCaioAttentionPackPageService(web, () => clock);
  const run = (input: Omit<CaioAttentionCommandInput, "clientRequestId"> & { clientRequestId?: string }) =>
    service().runCommand({ clientRequestId: rid(), ...input } as CaioAttentionCommandInput);
  const caseRow = (id: string) => admin.caioAttentionCase.findUniqueOrThrow({ where: { id } });
  const notices = (userKey: keyof typeof people, stage?: string) => admin.notification.findMany({
    where: { workspaceId, userId: people[userKey], ...(stage ? { dedupeKey: { contains: `:${stage}:` } } : {}) }, orderBy: { createdAt: "asc" },
  }).then((rows) => rows.map((row) => row.dedupeKey));
  const scan = (now: Date) => runCaioAttentionReminderScan({ client: web, now, policy });

  /** A quick-check hit the generator turns into a suggestion: an OPEN candidate plus HIT evaluations up to `now`. */
  async function suggest(now: Date, severity: "critical" | "warning"): Promise<string> {
    mergeSeq += 1;
    const mergeKey = `mk-${mergeSeq}`;
    const latest = bucketOf(now);
    // One open candidate per flow: earlier ones are cleared, as the quick check would once their hit ends.
    await admin.caioAnomalyCandidate.updateMany({ where: { workspaceId, status: "OPEN" }, data: { status: "CLEARED", openKey: null, clearedAt: now } });
    await admin.$executeRaw`INSERT INTO CaioAnomalyCandidate (id, workspaceId, detectorId, mergeKey, openKey, objectKey, severity, reasonCode,
      titleZh, titleEn, status, firstSeenAt, lastSeenAt, lastTickId, evidenceRefsJson) VALUES (${`cand-${randomUUID()}`}, ${workspaceId}, 'det-e2e',
      ${mergeKey}, ${`det-e2e:${mergeKey}`}, 'obj', ${severity}, 'r', 'zh', 'en', 'OPEN', ${now}, ${now}, 't', '[]')`;
    for (const back of severity === "warning" ? [1, 0] : [0]) {
      const bucketStart = new Date(latest.getTime() - back * BUCKET_MS);
      await generator.caioDetectorEvaluation.create({ data: {
        workspaceId, tickId: `tick-${mergeKey}-${back}`, bucketStart, detectorId: "det-e2e", ruleVersion: "v1", outcome: "HIT",
        hitMergeKeysJson: JSON.stringify([mergeKey]),
      } });
    }
    const result = await runCaioAttentionGenerator({ workspaceId, tickId: `tick-${mergeKey}`, latestBucketStart: latest, bucketMinutes: 10, now, client: generator });
    expect(result).toMatchObject({ status: "completed", created: 1 });
    const row = await admin.caioAttentionCase.findFirstOrThrow({ where: { workspaceId, mergeKey } });
    expect(row).toMatchObject({ status: "SUGGESTED", primaryUserId: people.primary, confirmedByUserId: null, commandVersion: 0 });
    return row.id;
  }

  const prefillCommand = (due: Date, overrides: Partial<CaioAttentionCommandFields> = {}): CaioAttentionCommandFields => ({
    primaryUserId: people.primary, ccUserIds: [people.cc], escalationUserId: people.escalation, reviewerUserIds: [people.reviewer],
    committedDueAt: due, ...overrides,
  });

  beforeAll(async () => {
    const adminUrl = new URL(urls.admin!);
    if (process.env.DATABASE_URL !== urls.admin || !adminUrl.pathname.slice(1).startsWith("helm_caio_attention_")
      || new URL(urls.generator!).username !== "attention_generator" || new URL(urls.web!).username !== "attention_web"
      || new URL(urls.ops!).username !== "attention_ops") {
      throw new Error("DATABASE_URL must equal CAIO_ATTENTION_DATABASE_URL on a disposable helm_caio_attention_* database.");
    }
    admin = new PrismaClient({ datasources: { db: { url: urls.admin! } } });
    generator = new PrismaClient({ datasources: { db: { url: urls.generator! } } });
    web = new PrismaClient({ datasources: { db: { url: urls.web! } } });
    ops = new PrismaClient({ datasources: { db: { url: urls.ops! } } });
    const suffix = randomUUID().slice(0, 8);
    workspaceId = (await admin.workspace.create({ data: { name: `e2e ${suffix}`, slug: `attention-e2e-${suffix}` } })).id;
    for (const key of Object.keys(roles) as (keyof typeof people)[]) {
      people[key] = (await admin.user.create({ data: { name: `name-${key}`, email: `attention-e2e-${key}-${suffix}@example.test` } })).id;
      await admin.membership.create({ data: { workspaceId, userId: people[key], role: roles[key] } });
    }
    const config = { schemaVersion: "caio-attention-routes/v1", roleBindings: {
      lead: [`user:${people.primary}`], helper: [`user:${people.cc}`], esc: [`user:${people.escalation}`],
      rev: [`user:${people.reviewer}`], ws_owner: [`user:${people.owner}`],
    } };
    await admin.caioAttentionRouteConfig.create({ data: {
      workspaceId, version: 1, schemaVersion: config.schemaVersion, configJson: JSON.stringify(config), contentHash: "h", createdByRef: "test",
    } });
    await admin.caioAttentionRouteConfigHead.create({ data: { workspaceId, activeVersion: 1, updatedByRef: "test" } });
  });

  beforeEach(async () => {
    resetCaioAttentionPackForTests();
    const rule: CaioAttentionRouteRule = {
      detectorId: "det-e2e", category: "technical", primaryRoleKey: "lead", primaryFallbackRoleKeys: [], ccRoleKeys: ["helper"],
      escalationRoleKey: "esc", escalationFallbackRoleKey: "ws_owner", reviewerRoleKey: "rev", reviewerFallbackRoleKey: "ws_owner",
      compatibleRuleVersions: ["v1"], committedDue: "suggest",
    };
    registerCaioAttentionPack({ packId: "e2e", policy, rules: [rule] });
    for (const table of ["CaioAttentionCaseEvent", "CaioAttentionDisposition", "CaioAttentionReview", "CaioAttentionCase", "CaioAttentionPauseRequest"]) {
      await admin.$executeRawUnsafe(`DELETE FROM \`${table}\``);
    }
    await admin.notification.deleteMany({ where: { workspaceId } });
    await admin.caioDetectorEvaluation.deleteMany({ where: { workspaceId } });
    await admin.caioAnomalyCandidate.deleteMany({ where: { workspaceId } });
    await admin.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'OPEN', openEpoch = 1 WHERE id = 'global'`;
    clock = DAY;
  });

  afterAll(async () => {
    resetCaioAttentionPackForTests();
    if (admin) await admin.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'PAUSED', openEpoch = 0 WHERE id = 'global'`;
    await Promise.all([admin, generator, web, ops].map((client) => client?.$disconnect()));
  });

  it("hit -> SUGGESTED -> OWNER confirms with edits -> escalation -> ack -> receipt -> reviewer closes", async () => {
    const caseId = await suggest(DAY, "critical");
    // R0a: the OWNER is told about the critical suggestion.
    await scan(at(DAY, 1));
    expect(await notices("owner", "R0a")).toHaveLength(1);

    // The OWNER edits the prefill: drops the cc and moves the deadline; the confirm event records both changes.
    clock = at(DAY, 5);
    const due = at(DAY, 24 * 60);
    const confirm = { viewer: viewer("owner"), caseId, expectedCommandVersion: 0, op: "confirm" as const, command: prefillCommand(due, { ccUserIds: [] }) };
    // Server-side checks: a primary and a future committed deadline are required.
    for (const command of [prefillCommand(due, { primaryUserId: null }), prefillCommand(due, { committedDueAt: null }), prefillCommand(at(DAY, 4))]) {
      expect(await run({ ...confirm, command })).toEqual({ ok: false, reason: "validation_failed" });
    }
    const requestId = rid();
    expect(await run({ ...confirm, clientRequestId: requestId })).toEqual({ ok: true, status: "DISPATCHED" });
    // Same request id: a retry with the same inputs replays; different inputs are a conflict.
    expect(await run({ ...confirm, clientRequestId: requestId })).toEqual({ ok: true, status: "DISPATCHED" });
    expect(await run({ ...confirm, clientRequestId: requestId, command: prefillCommand(at(due, 60), { ccUserIds: [] }) }))
      .toEqual({ ok: false, reason: "conflict" });
    const confirmed = await admin.caioAttentionCaseEvent.findFirstOrThrow({ where: { caseId, kind: "CONFIRMED" } });
    expect(JSON.parse(confirmed.payloadJson).changedFields).toEqual(expect.arrayContaining(["ccUserIds", "committedDueAt"]));
    expect(await caseRow(caseId)).toMatchObject({ status: "DISPATCHED", commandVersion: 1, confirmedByUserId: people.owner, committedDueAt: due });
    // Critical dispatch notice D goes out at once to the primary; the dropped cc gets nothing.
    expect(await notices("primary", "D")).toEqual([`ca:${caseId}:D:v1:${people.primary}`]);
    expect(await notices("cc")).toEqual([]);

    // Nobody responds for two hours: R1 escalates to the escalation holder.
    const escalated = await scan(at(clock, 121));
    expect(escalated.sends.R1).toBe(1);
    expect(await notices("escalation", "R1")).toHaveLength(1);

    clock = at(DAY, 130);
    expect(await run({ viewer: viewer("primary"), caseId, expectedCommandVersion: 1, op: "ack" })).toEqual({ ok: true, status: "DISPATCHED" });
    expect((await caseRow(caseId)).respondedAt).toEqual(clock);

    const audit = await admin.auditLog.create({ data: { workspaceId, actor: "primary", actorType: "USER", actionType: "ops.restart",
      targetType: "job", targetId: "job-1", summary: "restarted", createdAt: at(DAY, 135) } });
    clock = at(DAY, 145);
    expect(await run({
      viewer: viewer("primary"), caseId, expectedCommandVersion: 1, op: "submitDisposition", disposedAt: at(DAY, 140), outcome: "handled",
      actionTaken: "restarted the job", note: null, evidenceRefs: [`audit-log:${audit.id}`],
    })).toEqual({ ok: true, status: "DISPOSITION_SUBMITTED" });

    clock = at(DAY, 150);
    const disposition = await admin.caioAttentionDisposition.findFirstOrThrow({ where: { caseId } });
    // The primary can never review their own receipt.
    expect(await run({ viewer: viewer("primary"), caseId, expectedCommandVersion: 1, op: "reviewAccept", dispositionId: disposition.id,
      reviewerVersion: 1, attestedExternalRefs: [], note: "self" })).toMatchObject({ ok: false });
    // Attested external refs must come from the receipt.
    expect(await run({ viewer: viewer("reviewer"), caseId, expectedCommandVersion: 1, op: "reviewAccept", dispositionId: disposition.id,
      reviewerVersion: 1, attestedExternalRefs: ["ticket:not-submitted"], note: "checked" })).toEqual({ ok: false, reason: "validation_failed" });
    expect(await run({ viewer: viewer("reviewer"), caseId, expectedCommandVersion: 1, op: "reviewAccept", dispositionId: disposition.id,
      reviewerVersion: 1, attestedExternalRefs: [], note: "checked the audit trail" })).toEqual({ ok: true, status: "CLOSED" });
    expect(await caseRow(caseId)).toMatchObject({ status: "CLOSED", activeKey: null });
    expect(await admin.caioAttentionReview.count({ where: { caseId, decision: "ACCEPT", reviewerUserId: people.reviewer } })).toBe(1);
  });

  it("OWNER dismisses a suggestion and cancels a dispatched case; both end terminal and free the active key", async () => {
    const dismissed = await suggest(DAY, "critical");
    expect(await run({ viewer: viewer("owner"), caseId: dismissed, expectedCommandVersion: 0, op: "dismiss", reason: "known maintenance" }))
      .toEqual({ ok: true, status: "DISMISSED" });
    expect(await caseRow(dismissed)).toMatchObject({ status: "DISMISSED", activeKey: null });

    const cancelled = await suggest(at(DAY, 20), "critical");
    clock = at(DAY, 21);
    expect(await run({ viewer: viewer("owner"), caseId: cancelled, expectedCommandVersion: 0, op: "confirm", command: prefillCommand(at(DAY, 600)) }))
      .toEqual({ ok: true, status: "DISPATCHED" });
    // ADMIN-free check: a non-OWNER can never cancel.
    expect(await run({ viewer: viewer("primary"), caseId: cancelled, expectedCommandVersion: 1, op: "cancel", reason: "x" })).toMatchObject({ ok: false });
    expect(await run({ viewer: viewer("owner"), caseId: cancelled, expectedCommandVersion: 1, op: "cancel", reason: "duplicate of another case" }))
      .toEqual({ ok: true, status: "CANCELLED" });
    expect(await caseRow(cancelled)).toMatchObject({ status: "CANCELLED", activeKey: null });
  });

  it("a deferred critical suggestion resumes and reminds the OWNER again under a new R0a key", async () => {
    const caseId = await suggest(DAY, "critical");
    await scan(at(DAY, 1));
    const first = await notices("owner", "R0a");
    expect(first).toHaveLength(1);
    clock = at(DAY, 3);
    const until = at(DAY, 60);
    expect(await run({ viewer: viewer("owner"), caseId, expectedCommandVersion: 0, op: "defer", deferredUntil: at(DAY, 2), reason: null }))
      .toEqual({ ok: false, reason: "validation_failed" }); // deferredUntil must be after now
    expect(await run({ viewer: viewer("owner"), caseId, expectedCommandVersion: 0, op: "defer", deferredUntil: until, reason: "after the window" }))
      .toEqual({ ok: true, status: "DEFERRED" });
    const deps = { db: web, policy, now: () => at(DAY, 61) };
    expect(await resumeDeferredCaioAttentionCase({ ...deps, now: () => at(DAY, 30) }, { workspaceId, caseId })).toEqual({ ok: false, reason: "not_due" });
    expect(await resumeDeferredCaioAttentionCase(deps, { workspaceId, caseId })).toMatchObject({ ok: true, status: "SUGGESTED" });
    expect(await caseRow(caseId)).toMatchObject({ status: "SUGGESTED", r0aDueAt: at(DAY, 61), r0aSentAt: null });
    await scan(at(DAY, 62));
    const second = await notices("owner", "R0a");
    expect(second).toHaveLength(2);
    expect(second[1]).toBe(`ca:${caseId}:R0a:${at(DAY, 61).toISOString()}:${people.owner}`);
    expect(second[1]).not.toBe(first[0]);
  });

  it("a warning confirmed at night gets its dispatch notice D at the next window opening, primary and cc, once each", async () => {
    const caseId = await suggest(NIGHT, "warning");
    clock = at(NIGHT, 5);
    expect(await run({ viewer: viewer("owner"), caseId, expectedCommandVersion: 0, op: "confirm",
      command: prefillCommand(at(NIGHT, 3 * 24 * 60), { ccUserIds: [people.cc, people.cc2] }) })).toEqual({ ok: true, status: "DISPATCHED" });
    expect(await notices("primary", "D")).toEqual([]);
    expect((await scan(at(NIGHT, 30))).sends.D).toBeUndefined(); // still night
    const morning = new Date("2026-11-05T00:01:00.000Z"); // 08:01 at UTC+8
    expect((await scan(morning)).sends.D).toBe(1);
    // Same recipients as a daytime D: the primary and every cc person, one notice each under its own per-user key.
    expect(await notices("primary", "D")).toEqual([`ca:${caseId}:D:v1:${people.primary}`]);
    expect(await notices("cc", "D")).toEqual([`ca:${caseId}:D:v1:${people.cc}`]);
    expect(await notices("cc2", "D")).toEqual([`ca:${caseId}:D:v1:${people.cc2}`]);
    expect(await notices("escalation", "D")).toEqual([]);
    expect(await notices("reviewer", "D")).toEqual([]);
    expect((await scan(at(morning, 5))).sends.D).toBeUndefined();
    for (const key of ["primary", "cc", "cc2"] as const) expect(await notices(key, "D")).toHaveLength(1);
  });

  it("after the operator pauses intake the gate refuses generation, confirmation and resume; nothing changes", async () => {
    const caseId = await suggest(DAY, "critical");
    expect(await pauseCaioAttentionIntake(ops, { actorRef: "operator:e2e" })).toMatchObject({ intakeState: "PAUSED", changed: true });
    clock = at(DAY, 5);
    expect(await run({ viewer: viewer("owner"), caseId, expectedCommandVersion: 0, op: "confirm", command: prefillCommand(at(DAY, 600)) }))
      .toEqual({ ok: false, reason: "intake_closed" });
    await admin.$executeRaw`INSERT INTO CaioAnomalyCandidate (id, workspaceId, detectorId, mergeKey, openKey, objectKey, severity, reasonCode,
      titleZh, titleEn, status, firstSeenAt, lastSeenAt, lastTickId, evidenceRefsJson) VALUES (${`cand-${randomUUID()}`}, ${workspaceId}, 'det-e2e',
      'mk-paused', 'det-e2e:mk-paused', 'obj', 'critical', 'r', 'zh', 'en', 'OPEN', ${DAY}, ${DAY}, 't', '[]')`;
    await generator.caioDetectorEvaluation.create({ data: { workspaceId, tickId: "tick-paused", bucketStart: bucketOf(DAY), detectorId: "det-e2e",
      ruleVersion: "v1", outcome: "HIT", hitMergeKeysJson: JSON.stringify(["mk-paused"]) } });
    expect(await runCaioAttentionGenerator({ workspaceId, tickId: "tick-paused", latestBucketStart: bucketOf(DAY), bucketMinutes: 10, now: DAY, client: generator }))
      .toMatchObject({ status: "intake_closed", created: 0 });
    expect(await caseRow(caseId)).toMatchObject({ status: "SUGGESTED", commandVersion: 0 });
    expect(await admin.caioAttentionCase.count({ where: { workspaceId } })).toBe(1);
    // Without a registered pack every command fails closed, whatever the gate says.
    resetCaioAttentionPackForTests();
    expect(await run({ viewer: viewer("owner"), caseId, expectedCommandVersion: 0, op: "dismiss", reason: "x" }))
      .toEqual({ ok: false, reason: "service_unavailable" });
  });
});
