import { randomUUID } from "node:crypto";

import { PrismaClient, type WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listCaioAttentionCasesForViewer, loadCaioAttentionCaseForViewer } from "./case-loader";
import {
  ackCaioAttentionCase, noteCaioAttentionCase, reviewCaioAttentionDisposition, submitCaioAttentionDisposition,
} from "./disposition.service";
import type { CaioAttentionLifecycleDeps } from "./core";
import { applyCaioAttentionSeverityRaise, cancelCaioAttentionCase, confirmCaioAttentionCase } from "./lifecycle.service";
import { CAIO_ATTENTION_TEST_DEFAULT_POLICY } from "../schedule";

/**
 * Primary / reviewer operations and the authorization loader on an isolated MySQL database, through the
 * least-privilege web identity. Same environment as schema.mysql.test.ts (`npm run test:caio-attention:mysql`).
 */
const urls = { admin: process.env.CAIO_ATTENTION_DATABASE_URL, web: process.env.CAIO_ATTENTION_WEB_DATABASE_URL, ops: process.env.CAIO_ATTENTION_OPS_DATABASE_URL };
const configured = Object.values(urls).every(Boolean);
if (process.env.CAIO_ATTENTION_MYSQL_REQUIRED === "1" && !configured) {
  throw new Error("CAIO_ATTENTION_MYSQL_REQUIRED=1 but a CAIO_ATTENTION_*_DATABASE_URL is missing.");
}
const describeMysql = configured ? describe.sequential : describe.skip;

describeMysql("CAIO attention disposition, review and read access on MySQL (web identity)", () => {
  let admin: PrismaClient, web: PrismaClient, ops: PrismaClient;
  let deps: CaioAttentionLifecycleDeps;
  let workspaceId = "", otherWorkspaceId = "";
  const people = {} as Record<"owner" | "admin" | "primary" | "cc" | "escalation" | "reviewer" | "outsider", string>;
  const roles: Record<keyof typeof people, WorkspaceRole> = {
    owner: "OWNER", admin: "ADMIN", primary: "OPERATOR", cc: "MEMBER", escalation: "ADMIN", reviewer: "REVIEWER", outsider: "REVIEWER",
  };
  const dispatchedAt = new Date("2026-11-04T02:00:00.000Z");
  const now = new Date("2026-11-04T03:00:00.000Z");
  const disposedAt = new Date("2026-11-04T02:40:00.000Z");
  let seq = 0;
  const rid = () => `req-${randomUUID()}`;
  const base = (caseId: string, actorUserId: string, expectedCommandVersion = 1) =>
    ({ workspaceId, caseId, actorUserId, clientRequestId: rid(), expectedCommandVersion });

  /** A case confirmed by the OWNER at `dispatchedAt` (prefill = command). */
  async function dispatchedCase() {
    seq += 1;
    const id = `case-${seq}-${randomUUID().slice(0, 8)}`;
    await admin.$executeRaw`INSERT INTO CaioAttentionCase (id, workspaceId, shortNo, detectorId, mergeKey, objectKey, category,
      originCandidateId, activeKey, status, ccUserIdsJson, reviewerUserIdsJson, severityAtSuggest, effectiveSeverity, reminderPolicy)
      VALUES (${id}, ${workspaceId}, ${seq}, 'det', ${`mk-${seq}`}, 'obj', 'business', ${`cand-${id}`}, ${`det:mk-${seq}`}, 'SUGGESTED',
        '[]', '[]', 'warning', 'warning', 'warning')`;
    const confirmed = await confirmCaioAttentionCase({ ...deps, now: () => dispatchedAt }, { ...base(id, people.owner, 0), command: {
      primaryUserId: people.primary, ccUserIds: [people.cc], escalationUserId: people.escalation, reviewerUserIds: [people.reviewer],
      committedDueAt: new Date("2026-11-05T02:00:00.000Z") } });
    expect(confirmed.ok).toBe(true);
    return id;
  }
  async function evidence() {
    const audit = await admin.auditLog.create({ data: { workspaceId, actor: "primary", actorType: "USER", actionType: "ops.restart",
      targetType: "job", targetId: "job-1", summary: "restarted", createdAt: new Date("2026-11-04T02:30:00.000Z") } });
    const foreign = await admin.auditLog.create({ data: { workspaceId: otherWorkspaceId, actor: "x", actorType: "USER", actionType: "x",
      targetType: "x", targetId: "x", summary: "x", createdAt: new Date("2026-11-04T02:30:00.000Z") } });
    return { audit: `audit-log:${audit.id}`, foreign: `audit-log:${foreign.id}` };
  }
  const submit = (caseId: string, evidenceRefs: string[], actorUserId = people.primary) => submitCaioAttentionDisposition(deps,
    { ...base(caseId, actorUserId), disposition: { disposedAt, outcome: "resolved", actionTaken: "restarted the job", evidenceRefs } });
  const review = (caseId: string, actorUserId: string, extra: Partial<Parameters<typeof reviewCaioAttentionDisposition>[1]> = {}) =>
    admin.caioAttentionDisposition.findFirstOrThrow({ where: { caseId }, orderBy: { sequence: "desc" } }).then((d) =>
      reviewCaioAttentionDisposition(deps, { ...base(caseId, actorUserId), decision: "ACCEPT", dispositionId: d.id, reviewerVersion: 1,
        attestedExternalRefs: [], note: "checked the audit trail", ...extra }));
  const caseRow = (id: string) => admin.caioAttentionCase.findUniqueOrThrow({ where: { id } });
  const reads = (caseId: string) => admin.caioAttentionCaseEvent.count({ where: { caseId, kind: "READ" } });

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: urls.admin! } } });
    web = new PrismaClient({ datasources: { db: { url: urls.web! } } });
    ops = new PrismaClient({ datasources: { db: { url: urls.ops! } } });
    deps = { db: web, policy: CAIO_ATTENTION_TEST_DEFAULT_POLICY, now: () => now };
    const suffix = randomUUID().slice(0, 8);
    workspaceId = (await admin.workspace.create({ data: { name: `attention ${suffix}`, slug: `attention-d-${suffix}` } })).id;
    otherWorkspaceId = (await admin.workspace.create({ data: { name: `other ${suffix}`, slug: `attention-o-${suffix}` } })).id;
    for (const key of Object.keys(roles) as (keyof typeof people)[]) {
      people[key] = (await admin.user.create({ data: { name: key, email: `attention-d-${key}-${suffix}@example.test` } })).id;
      await admin.membership.create({ data: { workspaceId, userId: people[key], role: roles[key] } });
    }
    await admin.membership.create({ data: { workspaceId: otherWorkspaceId, userId: people.outsider, role: "OWNER" } });
  });

  beforeEach(async () => {
    for (const table of ["CaioAttentionCaseEvent", "CaioAttentionDisposition", "CaioAttentionReview", "CaioAttentionCase", "CaioAttentionPauseRequest"]) {
      await admin.$executeRawUnsafe(`DELETE FROM \`${table}\``);
    }
    await admin.membership.updateMany({ where: { workspaceId }, data: { status: "ACTIVE" } });
    await ops.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'OPEN', updatedByRef = 'test' WHERE id = 'global'`;
  });

  afterAll(async () => {
    await ops.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'PAUSED', updatedByRef = 'test' WHERE id = 'global'`;
    await Promise.all([admin, web, ops].map((client) => client.$disconnect()));
  });

  it("hides cases from unrelated members and audits every ADMIN read, participant or not", async () => {
    const caseId = await dispatchedCase();
    const load = (viewerUserId: string, ws = workspaceId) => loadCaioAttentionCaseForViewer(web, { workspaceId: ws, caseId, viewerUserId });
    for (const viewer of [people.outsider, "user:nobody"]) {
      expect(await load(viewer)).toEqual({ ok: false, reason: "not_found" });
      expect(await listCaioAttentionCasesForViewer(web, { workspaceId, viewerUserId: viewer })).toEqual({ rows: [], total: 0 });
      expect(await ackCaioAttentionCase(deps, base(caseId, viewer))).toEqual({ ok: false, reason: "not_found" });
    }
    expect(await load(people.outsider, otherWorkspaceId)).toEqual({ ok: false, reason: "not_found" });
    expect(await load(people.primary)).toMatchObject({ ok: true });
    expect((await listCaioAttentionCasesForViewer(web, { workspaceId, viewerUserId: `user:${people.cc}` })).rows.map((r) => r.id)).toEqual([caseId]);
    expect(await listCaioAttentionCasesForViewer(web, { workspaceId, viewerUserId: people.owner, scope: "mine" })).toEqual({ rows: [], total: 0 });
    expect(await reads(caseId)).toBe(0);
    expect(await load(people.admin)).toMatchObject({ ok: true });
    expect(await load(people.escalation)).toMatchObject({ ok: true }); // ADMIN who is also the escalation person
    expect((await listCaioAttentionCasesForViewer(web, { workspaceId, viewerUserId: people.admin })).total).toBe(1);
    expect(await reads(caseId)).toBe(3);
    const detail = await load(people.owner);
    expect(detail.ok && detail.detail.events.map((e) => e.kind)).toEqual(["CONFIRMED"]);
    expect(await reads(caseId)).toBe(3);
    await admin.membership.update({ where: { workspaceId_userId: { workspaceId, userId: people.primary } }, data: { status: "INACTIVE" } });
    expect(await load(people.primary)).toEqual({ ok: false, reason: "not_found" });
    expect(await submit(caseId, [])).toEqual({ ok: false, reason: "not_found" });
  });

  it("counts only the current primary's ack / note as a response and checks evidence in the database on submission", async () => {
    const caseId = await dispatchedCase();
    expect(await noteCaioAttentionCase(deps, { ...base(caseId, people.cc), note: "watching" })).toMatchObject({ ok: true });
    expect((await caseRow(caseId)).respondedAt).toBeNull();
    expect(await ackCaioAttentionCase(deps, base(caseId, people.cc))).toEqual({ ok: false, reason: "forbidden" });
    expect(await ackCaioAttentionCase(deps, base(caseId, people.primary))).toMatchObject({ ok: true });
    expect((await caseRow(caseId)).respondedAt).toEqual(now);

    const { audit, foreign } = await evidence();
    expect(await submit(caseId, [audit], people.escalation)).toEqual({ ok: false, reason: "forbidden" });
    expect(await submit(caseId, [foreign])).toMatchObject({ ok: false, reason: "evidence_invalid", details: expect.arrayContaining([`evidence_invalid:${foreign}`]) });
    expect(await submit(caseId, ["audit-log:missing"])).toMatchObject({ ok: false, reason: "evidence_invalid" });
    expect(await submit(caseId, ["caio-anomaly-candidate:x"])).toMatchObject({ ok: false, reason: "evidence_invalid" });
    expect(await submit(caseId, [audit, "ticket:OPS-1"])).toMatchObject({ ok: true, status: "DISPOSITION_SUBMITTED" });
    expect(await admin.caioAttentionDisposition.findFirstOrThrow({ where: { caseId } })).toMatchObject({ sequence: 1, commandVersion: 1, submittedByUserId: people.primary });
  });

  it("enforces separation of duties and the case-bound reviewer set, then closes with the review in the same transaction", async () => {
    const caseId = await dispatchedCase();
    await submit(caseId, [(await evidence()).audit, "ticket:OPS-2"]);
    expect(await review(caseId, people.outsider)).toEqual({ ok: false, reason: "not_found" });
    expect(await review(caseId, people.admin)).toEqual({ ok: false, reason: "forbidden" });
    expect(await review(caseId, people.owner)).toEqual({ ok: false, reason: "forbidden" });
    expect(await review(caseId, people.reviewer, { reviewerVersion: 0 })).toEqual({ ok: false, reason: "stale_reviewer_version" });
    // A reviewer set that drifted to include the primary or a cc person is still refused under the lock.
    await admin.$executeRaw`UPDATE CaioAttentionCase SET reviewerUserIdsJson = ${JSON.stringify([people.reviewer, people.primary, people.cc])} WHERE id = ${caseId}`;
    expect(await review(caseId, people.primary)).toEqual({ ok: false, reason: "separation_of_duties" });
    expect(await review(caseId, people.cc)).toEqual({ ok: false, reason: "forbidden" }); // MEMBER lacks review capability
    await admin.membership.update({ where: { workspaceId_userId: { workspaceId, userId: people.reviewer } }, data: { role: "MEMBER" } });
    expect(await review(caseId, people.reviewer)).toEqual({ ok: false, reason: "forbidden" });
    await admin.membership.update({ where: { workspaceId_userId: { workspaceId, userId: people.reviewer } }, data: { role: "REVIEWER" } });
    expect(await review(caseId, people.reviewer, { note: " " })).toMatchObject({ ok: false, reason: "input_invalid" });
    expect(await review(caseId, people.reviewer, { attestedExternalRefs: ["ticket:OTHER"] })).toMatchObject({ ok: false, reason: "evidence_invalid" });
    expect(await review(caseId, people.reviewer, { attestedExternalRefs: ["ticket:OPS-2"] })).toMatchObject({ ok: true, status: "CLOSED" });
    expect(await caseRow(caseId)).toMatchObject({ status: "CLOSED", activeKey: null, closedAt: now });
    expect(await admin.caioAttentionReview.findMany({ where: { caseId } })).toMatchObject([{ decision: "ACCEPT", reviewerUserId: people.reviewer }]);
  });

  it("returns to the primary and only the newest disposition can be reviewed afterwards", async () => {
    const caseId = await dispatchedCase();
    const { audit } = await evidence();
    await submit(caseId, [audit]);
    const first = await admin.caioAttentionDisposition.findFirstOrThrow({ where: { caseId } });
    expect(await review(caseId, people.reviewer, { decision: "RETURN", note: "needs the root cause" })).toMatchObject({ ok: true, status: "DISPATCHED" });
    expect(await submit(caseId, [audit])).toMatchObject({ ok: true });
    expect(await review(caseId, people.reviewer, { dispositionId: first.id })).toEqual({ ok: false, reason: "disposition_not_current" });
    expect(await review(caseId, people.reviewer)).toMatchObject({ ok: true, status: "CLOSED" });
  });

  it("consumes a severity raise once: escalation times tighten, the owner command and committed due date stay", async () => {
    const caseId = await dispatchedCase();
    expect(await applyCaioAttentionSeverityRaise(deps, { workspaceId, caseId })).toEqual({ ok: false, reason: "not_due" });
    const raisedAt = new Date("2026-11-04T02:30:00.000Z");
    await admin.caioAttentionCaseEvent.create({ data: { caseId, kind: "SEVERITY_RAISED", dedupeKey: "critical", payloadJson: "{}", createdAt: raisedAt } });
    const before = await caseRow(caseId);
    expect(await applyCaioAttentionSeverityRaise(deps, { workspaceId, caseId })).toMatchObject({ ok: true, replayed: false });
    const after = await caseRow(caseId);
    expect(after).toMatchObject({ effectiveSeverity: "critical", reminderPolicy: "critical", commandVersion: 1,
      committedDueAt: before.committedDueAt, ownerCommandHash: before.ownerCommandHash, noResponseDueAt: new Date(raisedAt.getTime() + 120 * 60_000) });
    expect(after.unresolvedEscalateAt!.getTime()).toBeLessThan(before.unresolvedEscalateAt!.getTime());
    expect(await applyCaioAttentionSeverityRaise(deps, { workspaceId, caseId })).toMatchObject({ ok: true, replayed: true });
    expect(await admin.caioAttentionCaseEvent.count({ where: { caseId, kind: "SEVERITY_APPLIED" } })).toBe(1);
  });

  it("serialises a review against an OWNER cancel on the case lock: exactly one wins, and a review exists only if closed", async () => {
    for (let round = 0; round < 5; round += 1) {
      const caseId = await dispatchedCase();
      await submit(caseId, [(await evidence()).audit]);
      const disposition = await admin.caioAttentionDisposition.findFirstOrThrow({ where: { caseId } });
      const [reviewed, cancelled] = await Promise.all([
        reviewCaioAttentionDisposition(deps, { ...base(caseId, people.reviewer), decision: "ACCEPT", dispositionId: disposition.id,
          reviewerVersion: 1, attestedExternalRefs: [], note: "ok" }),
        cancelCaioAttentionCase(deps, base(caseId, people.owner)),
      ]);
      expect([reviewed.ok, cancelled.ok].filter(Boolean)).toHaveLength(1);
      expect((reviewed.ok ? cancelled : reviewed)).toEqual({ ok: false, reason: "invalid_status" });
      const row = await caseRow(caseId);
      expect(row.status).toBe(reviewed.ok ? "CLOSED" : "CANCELLED");
      expect(await admin.caioAttentionReview.count({ where: { caseId } })).toBe(reviewed.ok ? 1 : 0);
    }
  });
});
