import { randomUUID } from "node:crypto";

import { PrismaClient, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CaioAttentionLifecycleDeps } from "./core";
import {
  assignCaioAttentionReviewers, cancelCaioAttentionCase, confirmCaioAttentionCase, deferCaioAttentionCase,
  applyCaioAttentionSeverityRaise, dismissCaioAttentionCase, reissueCaioAttentionCase, resumeDeferredCaioAttentionCase,
} from "./lifecycle.service";
import type { CaioAttentionSeverity } from "../contracts";
import { CAIO_ATTENTION_TEST_DEFAULT_POLICY, collectDueCaioAttentionReminders } from "../schedule";
import type { CaioAttentionStatus } from "../state-machine";

/**
 * OWNER lifecycle operations on an isolated MySQL database, written through the least-privilege web identity.
 * Same environment as schema.mysql.test.ts (`npm run test:caio-attention:mysql`).
 */
const urls = {
  admin: process.env.CAIO_ATTENTION_DATABASE_URL,
  web: process.env.CAIO_ATTENTION_WEB_DATABASE_URL,
  ops: process.env.CAIO_ATTENTION_OPS_DATABASE_URL,
};
const configured = Object.values(urls).every(Boolean);
if (process.env.CAIO_ATTENTION_MYSQL_REQUIRED === "1" && !configured) {
  throw new Error("CAIO_ATTENTION_MYSQL_REQUIRED=1 but a CAIO_ATTENTION_*_DATABASE_URL is missing.");
}
const describeMysql = configured ? describe.sequential : describe.skip;

describeMysql("CAIO attention OWNER lifecycle on MySQL (web identity)", () => {
  let admin: PrismaClient, web: PrismaClient, ops: PrismaClient;
  let deps: CaioAttentionLifecycleDeps;
  let workspaceId = "";
  const people = {} as Record<"owner" | "admin" | "primary" | "cc" | "escalation" | "reviewer" | "outsider", string>;
  const roles: Record<keyof typeof people, WorkspaceRole> = {
    owner: "OWNER", admin: "ADMIN", primary: "OPERATOR", cc: "MEMBER", escalation: "OPERATOR", reviewer: "REVIEWER", outsider: "REVIEWER",
  };
  const now = new Date("2026-11-04T02:00:00.000Z"); // 10:00 at the test policy offset
  const due = new Date("2026-11-04T12:00:00.000Z");
  let seq = 0;
  const rid = () => `req-${randomUUID()}`;

  async function seedCase(severity: "warning" | "critical" = "warning", status = "SUGGESTED") {
    seq += 1;
    const id = `case-${seq}-${randomUUID().slice(0, 8)}`;
    await admin.$executeRaw`INSERT INTO CaioAttentionCase (id, workspaceId, shortNo, detectorId, mergeKey, objectKey, category,
      originCandidateId, activeKey, status, primaryUserId, ccUserIdsJson, escalationUserId, reviewerUserIdsJson, severityAtSuggest,
      effectiveSeverity, reminderPolicy)
      VALUES (${id}, ${workspaceId}, ${seq}, 'det', ${`mk-${seq}`}, 'obj', 'business', ${`cand-${id}`}, ${`det:mk-${seq}`}, ${status},
        ${people.primary}, ${JSON.stringify([people.cc])}, ${people.escalation}, ${JSON.stringify([people.reviewer])},
        ${severity}, ${severity}, ${severity})`;
    await admin.caioAttentionCaseEvent.create({ data: { caseId: id, kind: "SUGGESTED", candidateId: `cand-${id}`,
      payloadJson: JSON.stringify({ prefill: { suggestedDueAt: due.toISOString() } }) } });
    return id;
  }
  const command = (overrides: Partial<Record<"primaryUserId" | "escalationUserId", string>> & { reviewerUserIds?: string[]; ccUserIds?: string[] } = {}) => ({
    primaryUserId: `user:${people.primary}`, ccUserIds: [people.cc], escalationUserId: people.escalation,
    reviewerUserIds: [people.reviewer], committedDueAt: due, ...overrides,
  });
  const confirm = (caseId: string, actorUserId = people.owner, extra: Partial<Parameters<typeof confirmCaioAttentionCase>[1]> = {}) =>
    confirmCaioAttentionCase(deps, { workspaceId, caseId, actorUserId, clientRequestId: rid(), expectedCommandVersion: 0, command: command(), ...extra });
  const caseRow = (id: string) => admin.caioAttentionCase.findUniqueOrThrow({ where: { id } });
  const events = (caseId: string) => admin.caioAttentionCaseEvent.findMany({ where: { caseId }, orderBy: { createdAt: "asc" } });
  /**
   * Stands in for the S6 scanner's R0a branch: S1's due rule decides and the Notification unique (workspaceId,
   * dedupeKey) deduplicates, exactly as the scanner's insert does. Admin client: S5a's web identity writes no notices.
   */
  async function scanR0a(caseId: string, at: Date) {
    const row = await caseRow(caseId);
    const { sends, updates } = collectDueCaioAttentionReminders({
      caseId, status: row.status as CaioAttentionStatus, effectiveSeverity: row.effectiveSeverity as CaioAttentionSeverity,
      commandVersion: row.commandVersion, respondedAt: row.respondedAt, ownerUserIds: [people.owner], primaryUserId: row.primaryUserId,
      escalationUserId: row.escalationUserId, reviewerUserIds: [],
    }, { ...row, r2FiredSeverity: row.r2FiredSeverity as CaioAttentionSeverity | null }, at, CAIO_ATTENTION_TEST_DEFAULT_POLICY);
    for (const notice of sends.filter((send) => send.rule === "R0a").flatMap((send) => send.notifications)) {
      await admin.notification.createMany({ skipDuplicates: true, data: [{ workspaceId, userId: notice.userId, type: "REMINDER",
        title: "R0a", body: "", dedupeKey: notice.dedupeKey }] });
    }
    if (updates.r0aSentAt) await admin.caioAttentionCase.update({ where: { id: caseId }, data: { r0aSentAt: updates.r0aSentAt, r0bDueAt: updates.r0bDueAt } });
  }
  const r0aNotices = async () => (await admin.notification.findMany({ where: { workspaceId }, select: { dedupeKey: true } }))
    .map((n) => n.dedupeKey).sort();
  const setGate = (state: "OPEN" | "PAUSED") => ops.$executeRaw`UPDATE CaioAttentionControl SET intakeState = ${state},
    rowVersion = rowVersion + 1, updatedByRef = 'test' WHERE id = 'global'`;

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: urls.admin! } } });
    web = new PrismaClient({ datasources: { db: { url: urls.web! } } });
    ops = new PrismaClient({ datasources: { db: { url: urls.ops! } } });
    deps = { db: web, policy: CAIO_ATTENTION_TEST_DEFAULT_POLICY, now: () => now };
    const suffix = randomUUID().slice(0, 8);
    workspaceId = (await admin.workspace.create({ data: { name: `attention ${suffix}`, slug: `attention-${suffix}` } })).id;
    for (const key of Object.keys(roles) as (keyof typeof people)[]) {
      people[key] = (await admin.user.create({ data: { name: key, email: `attention-${key}-${suffix}@example.test` } })).id;
      await admin.membership.create({ data: { workspaceId, userId: people[key], role: roles[key] } });
    }
  });

  beforeEach(async () => {
    await admin.$executeRaw`DELETE FROM CaioAttentionCaseEvent`;
    await admin.$executeRaw`DELETE FROM CaioAttentionDisposition`;
    await admin.$executeRaw`DELETE FROM CaioAttentionCase`;
    await admin.$executeRaw`DELETE FROM CaioAttentionPauseRequest`;
    await admin.notification.deleteMany({ where: { workspaceId } });
    await admin.membership.updateMany({ where: { workspaceId }, data: { status: "ACTIVE" } });
    await setGate("OPEN");
  });

  afterAll(async () => {
    await setGate("PAUSED");
    await Promise.all([admin, web, ops].map((client) => client.$disconnect()));
  });

  it("confirms only as OWNER behind the intake gate and records the edited prefill on the event", async () => {
    const caseId = await seedCase("critical");
    await setGate("PAUSED");
    expect(await confirm(caseId)).toEqual({ ok: false, reason: "intake_closed" });
    await setGate("OPEN");
    expect(await confirm(caseId, people.admin)).toEqual({ ok: false, reason: "forbidden" });
    // Prefilled people are not participants before confirmation: they cannot even learn the case exists.
    expect(await confirm(caseId, people.primary)).toEqual({ ok: false, reason: "not_found" });
    expect(await confirm(caseId, people.owner, { command: command({ primaryUserId: people.owner }) }))
      .toEqual({ ok: false, reason: "command_invalid", details: ["primary_is_confirmer"] });

    const edited = command({ ccUserIds: [] });
    const result = await confirm(caseId, `user:${people.owner}`, { command: edited, note: "cc not needed" });
    expect(result).toEqual({ ok: true, caseId, status: "DISPATCHED", commandVersion: 1, replayed: false });
    const row = await caseRow(caseId);
    expect(row).toMatchObject({ status: "DISPATCHED", commandVersion: 1, confirmedByUserId: people.owner, primaryUserId: people.primary,
      ccUserIdsJson: "[]", reviewerVersion: 1, dispatchedAt: now, respondedAt: null });
    expect(row.noResponseDueAt).toEqual(new Date(now.getTime() + 120 * 60_000));
    const [, confirmed] = await events(caseId);
    expect(confirmed).toMatchObject({ kind: "CONFIRMED", commandVersion: 1, actorUserId: people.owner });
    // Critical dispatch notice goes to the primary only (cc was removed), in the confirming transaction.
    expect(await admin.notification.findMany({ where: { workspaceId }, select: { userId: true, dedupeKey: true } }))
      .toEqual([{ userId: people.primary, dedupeKey: `ca:${caseId}:D:v1:${people.primary}` }]);
    expect(JSON.parse(confirmed.payloadJson)).toMatchObject({ dispatchNoticeSent: true, changedFields: ["ccUserIds"], previous: { ccUserIds: [people.cc] },
      command: { ccUserIds: [] }, note: "cc not needed", dispatchNoticeAt: now.toISOString() });
  });

  it("sends a warning dispatch notice only inside the daytime window", async () => {
    const day = await seedCase();
    await confirm(day);
    const night = await seedCase();
    await confirmCaioAttentionCase({ ...deps, now: () => new Date("2026-11-04T13:30:00.000Z") }, { workspaceId, caseId: night,
      actorUserId: people.owner, clientRequestId: rid(), expectedCommandVersion: 0, command: { ...command(), committedDueAt: new Date("2026-11-06T00:00:00.000Z") } });
    const notices = await admin.notification.findMany({ where: { workspaceId }, select: { dedupeKey: true } });
    expect(notices.map((n) => n.dedupeKey).sort()).toEqual([`ca:${day}:D:v1:${people.cc}`, `ca:${day}:D:v1:${people.primary}`].sort());
    const [, nightEvent] = await events(night);
    expect(JSON.parse(nightEvent.payloadJson)).toMatchObject({ dispatchNoticeSent: false, dispatchNoticeAt: "2026-11-05T00:00:00.000Z" });
  });

  it("replays a repeated clientRequestId without a second write and refuses a reused id for another operation", async () => {
    const caseId = await seedCase();
    const request = { workspaceId, caseId, actorUserId: people.owner, clientRequestId: rid(), expectedCommandVersion: 0, command: command() };
    expect(await confirmCaioAttentionCase(deps, request)).toMatchObject({ ok: true, replayed: false });
    expect(await confirmCaioAttentionCase(deps, request)).toMatchObject({ ok: true, replayed: true, commandVersion: 1 });
    expect(await cancelCaioAttentionCase(deps, { ...request, expectedCommandVersion: 1 })).toEqual({ ok: false, reason: "client_request_conflict" });
    // Someone who cannot read the case learns nothing from a colliding request id: readability is checked first.
    expect(await cancelCaioAttentionCase(deps, { ...request, actorUserId: people.outsider, expectedCommandVersion: 1 })).toEqual({ ok: false, reason: "not_found" });
    expect((await events(caseId)).map((e) => e.kind)).toEqual(["SUGGESTED", "CONFIRMED"]);
  });

  it("serialises concurrent confirm and dismiss: exactly one wins", async () => {
    for (let round = 0; round < 5; round += 1) {
      const caseId = await seedCase();
      const results = await Promise.all([
        confirm(caseId),
        dismissCaioAttentionCase(deps, { workspaceId, caseId, actorUserId: people.owner, clientRequestId: rid(), expectedCommandVersion: 0 }),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toMatchObject({ reason: "invalid_status" });
      const row = await caseRow(caseId);
      expect(["DISPATCHED", "DISMISSED"]).toContain(row.status);
      expect(row.activeKey === null).toBe(row.status === "DISMISSED");
      expect(await events(caseId)).toHaveLength(2);
    }
  });

  it("serialises concurrent confirm and cancel: a cancel either sees the dispatched command or is refused", async () => {
    for (let round = 0; round < 6; round += 1) {
      const caseId = await seedCase();
      const [confirmed, cancelled] = await Promise.all([
        confirm(caseId),
        cancelCaioAttentionCase(deps, { workspaceId, caseId, actorUserId: people.owner, clientRequestId: rid(), expectedCommandVersion: 1 }),
      ]);
      expect(confirmed.ok).toBe(true);
      const row = await caseRow(caseId);
      if (cancelled.ok) {
        expect(row).toMatchObject({ status: "CANCELLED", activeKey: null, commandVersion: 1 });
        expect((await events(caseId)).map((e) => e.kind)).toEqual(["SUGGESTED", "CONFIRMED", "CANCELLED"]);
      } else {
        expect(cancelled).toEqual({ ok: false, reason: "invalid_status" });
        expect(row).toMatchObject({ status: "DISPATCHED", commandVersion: 1 });
      }
    }
  });

  it("re-reads membership in the transaction: revoked people can neither dispatch nor be dispatched to", async () => {
    const caseId = await seedCase();
    await admin.membership.update({ where: { workspaceId_userId: { workspaceId, userId: people.primary } }, data: { status: "INACTIVE" } });
    expect(await confirm(caseId)).toEqual({ ok: false, reason: "command_invalid", details: ["primary_inactive"] });
    await admin.membership.update({ where: { workspaceId_userId: { workspaceId, userId: people.primary } }, data: { status: "ACTIVE" } });
    await admin.membership.update({ where: { workspaceId_userId: { workspaceId, userId: people.reviewer } }, data: { role: "MEMBER" } });
    expect(await confirm(caseId)).toEqual({ ok: false, reason: "command_invalid", details: ["reviewer_not_capable"] });
    await admin.membership.update({ where: { workspaceId_userId: { workspaceId, userId: people.reviewer } }, data: { role: "REVIEWER" } });
    await admin.membership.update({ where: { workspaceId_userId: { workspaceId, userId: people.owner } }, data: { status: "INACTIVE" } });
    expect(await confirm(caseId)).toEqual({ ok: false, reason: "not_found" });
    expect((await caseRow(caseId)).status).toBe("SUGGESTED");
    expect(await events(caseId)).toHaveLength(1);
  });

  it("reissues as a new command version, supersedes an unreviewed disposition and rejects stale versions", async () => {
    const caseId = await seedCase();
    await confirm(caseId);
    await admin.$executeRaw`UPDATE CaioAttentionCase SET status = 'DISPOSITION_SUBMITTED' WHERE id = ${caseId}`;
    await admin.$executeRaw`INSERT INTO CaioAttentionDisposition (id, workspaceId, caseId, commandVersion, sequence, submittedByUserId,
      disposedAt, outcome, actionTaken, evidenceRefsJson, contentHash)
      VALUES (${`d-${caseId}`}, ${workspaceId}, ${caseId}, 1, 1, ${people.primary}, NOW(3), 'resolved', 'restarted', '[]', 'h')`;
    const reissue = (expectedCommandVersion: number) => reissueCaioAttentionCase(deps, { workspaceId, caseId, actorUserId: people.owner,
      clientRequestId: rid(), expectedCommandVersion, command: command({ primaryUserId: people.escalation, escalationUserId: people.admin }) });
    expect(await reissue(0)).toEqual({ ok: false, reason: "stale_command_version" });
    expect(await reissue(1)).toMatchObject({ ok: true, status: "DISPATCHED", commandVersion: 2 });
    expect(await caseRow(caseId)).toMatchObject({ primaryUserId: people.escalation, commandVersion: 2, reviewerVersion: 2, respondedAt: null });
    const kinds = (await events(caseId)).map((e) => `${e.kind}:${e.dedupeKey ?? ""}`).sort();
    expect(kinds).toEqual(["CONFIRMED:", `DISPOSITION_SUPERSEDED:d-${caseId}`, "REISSUED:", "SUGGESTED:"]);
    expect(await reissue(1)).toEqual({ ok: false, reason: "stale_command_version" });
  });

  it("defers, resumes only when due and behind the gate, and re-arms the pending reminder of a critical case", async () => {
    const caseId = await seedCase("critical");
    await admin.$executeRaw`UPDATE CaioAttentionCase SET r0aDueAt = ${now} WHERE id = ${caseId}`;
    await scanR0a(caseId, now);
    expect(await r0aNotices()).toEqual([`ca:${caseId}:R0a:${now.toISOString()}:${people.owner}`]);
    const until = new Date(now.getTime() + 60 * 60_000);
    const defer = (deferredUntil: Date) => deferCaioAttentionCase(deps, { workspaceId, caseId, actorUserId: people.owner,
      clientRequestId: rid(), expectedCommandVersion: 0, deferredUntil });
    expect(await defer(new Date(now.getTime() - 1))).toEqual({ ok: false, reason: "input_invalid", details: ["deferred_until_invalid"] });
    expect(await defer(until)).toMatchObject({ ok: true, status: "DEFERRED" });
    expect(await caseRow(caseId)).toMatchObject({ r0aDueAt: null, r0aSentAt: null, r0bDueAt: null, r0bSentAt: null });
    expect(await dismissCaioAttentionCase(deps, { workspaceId, caseId, actorUserId: people.owner, clientRequestId: rid(), expectedCommandVersion: 0 }))
      .toEqual({ ok: false, reason: "invalid_status" });
    expect(await resumeDeferredCaioAttentionCase(deps, { workspaceId, caseId })).toEqual({ ok: false, reason: "not_due" });
    const later = { ...deps, now: () => until };
    await setGate("PAUSED");
    expect(await resumeDeferredCaioAttentionCase(later, { workspaceId, caseId })).toEqual({ ok: false, reason: "intake_closed" });
    await setGate("OPEN");
    expect(await resumeDeferredCaioAttentionCase(later, { workspaceId, caseId })).toMatchObject({ ok: true, status: "SUGGESTED" });
    expect(await caseRow(caseId)).toMatchObject({ status: "SUGGESTED", deferredUntil: null, r0aDueAt: until, r0aSentAt: null, r0bDueAt: null });
    expect(await resumeDeferredCaioAttentionCase(later, { workspaceId, caseId })).toEqual({ ok: false, reason: "invalid_status" });
    // The re-armed R0a really lands: its key carries the new due time, so the first round's row cannot swallow it.
    await scanR0a(caseId, until);
    expect(await r0aNotices()).toEqual([
      `ca:${caseId}:R0a:${now.toISOString()}:${people.owner}`, `ca:${caseId}:R0a:${until.toISOString()}:${people.owner}`,
    ].sort());
  });

  it("disarms an unsent pending reminder on defer, so a deferred case is not announced as pending", async () => {
    const caseId = await seedCase("critical");
    await admin.$executeRaw`UPDATE CaioAttentionCase SET r0aDueAt = ${now} WHERE id = ${caseId}`;
    expect(await deferCaioAttentionCase(deps, { workspaceId, caseId, actorUserId: people.owner, clientRequestId: rid(), expectedCommandVersion: 0,
      deferredUntil: new Date(now.getTime() + 60_000) })).toMatchObject({ ok: true, status: "DEFERRED" });
    await scanR0a(caseId, new Date(now.getTime() + 30_000));
    expect(await r0aNotices()).toEqual([]);
  });

  it("arms R0a once when a deferred case is raised to critical, so the OWNER is told while it stays deferred", async () => {
    const caseId = await seedCase("warning", "DEFERRED");
    await admin.$executeRaw`UPDATE CaioAttentionCase SET deferredUntil = ${new Date(now.getTime() + 3_600_000)} WHERE id = ${caseId}`;
    const raisedAt = new Date(now.getTime() + 60_000);
    await admin.caioAttentionCaseEvent.create({ data: { caseId, kind: "SEVERITY_RAISED", dedupeKey: "critical", payloadJson: "{}", createdAt: raisedAt } });
    expect(await applyCaioAttentionSeverityRaise(deps, { workspaceId, caseId })).toMatchObject({ ok: true, status: "DEFERRED", replayed: false });
    expect(await caseRow(caseId)).toMatchObject({ status: "DEFERRED", effectiveSeverity: "critical", r0aDueAt: raisedAt, r0aSentAt: null });
    await scanR0a(caseId, raisedAt);
    await scanR0a(caseId, new Date(raisedAt.getTime() + 45 * 60_000)); // no R0b repeat while deferred
    expect(await r0aNotices()).toEqual([`ca:${caseId}:R0a:${raisedAt.toISOString()}:${people.owner}`]);
  });

  it("records one RESUMED event per defer cycle", async () => {
    const caseId = await seedCase();
    let at = now;
    for (let cycle = 1; cycle <= 2; cycle += 1) {
      const until = new Date(at.getTime() + 60_000);
      const deferAt = at;
      expect(await deferCaioAttentionCase({ ...deps, now: () => deferAt }, { workspaceId, caseId, actorUserId: people.owner,
        clientRequestId: rid(), expectedCommandVersion: 0, deferredUntil: until })).toMatchObject({ ok: true });
      expect(await resumeDeferredCaioAttentionCase({ ...deps, now: () => until }, { workspaceId, caseId })).toMatchObject({ ok: true, status: "SUGGESTED" });
      at = until;
    }
    const resumed = (await events(caseId)).filter((e) => e.kind === "RESUMED").map((e) => e.dedupeKey).sort();
    expect(resumed).toEqual([`resume:1:${new Date(now.getTime() + 60_000).toISOString()}`, `resume:2:${new Date(now.getTime() + 120_000).toISOString()}`]);
  });

  it("assigns reviewers by reviewer version without touching the command, and keeps separation of duties", async () => {
    const caseId = await seedCase();
    await confirm(caseId);
    const assign = (reviewerUserIds: string[], expectedReviewerVersion: number, actorUserId = people.owner) => assignCaioAttentionReviewers(deps,
      { workspaceId, caseId, actorUserId, clientRequestId: rid(), expectedCommandVersion: 1, reviewerUserIds, expectedReviewerVersion });
    expect(await assign([people.outsider], 1, people.admin)).toEqual({ ok: false, reason: "forbidden" });
    expect(await assign([people.primary], 1)).toEqual({ ok: false, reason: "command_invalid", details: ["reviewer_conflict"] });
    expect(await assign([people.cc], 1)).toEqual({ ok: false, reason: "command_invalid", details: ["reviewer_conflict", "reviewer_not_capable"] });
    expect(await assign([people.outsider, people.owner], 1)).toMatchObject({ ok: true, commandVersion: 1 });
    expect(await caseRow(caseId)).toMatchObject({ reviewerVersion: 2, commandVersion: 1,
      reviewerUserIdsJson: JSON.stringify([people.outsider, people.owner]) });
    expect(await assign([people.reviewer], 1)).toEqual({ ok: false, reason: "stale_reviewer_version" });
  });
});
