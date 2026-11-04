import { randomUUID } from "node:crypto";

import { PrismaClient, type WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { CaioAttentionViewer } from "@/features/caio-attention/service-contract";
import { CAIO_ATTENTION_TEST_DEFAULT_POLICY } from "@/lib/caio-attention/schedule";

import { createCaioAttentionLifecyclePageService } from "./page-service";

/** The bound page service end to end on MySQL through the web identity (`npm run test:caio-attention:mysql`). */
const urls = { admin: process.env.CAIO_ATTENTION_DATABASE_URL, web: process.env.CAIO_ATTENTION_WEB_DATABASE_URL, ops: process.env.CAIO_ATTENTION_OPS_DATABASE_URL };
const configured = Object.values(urls).every(Boolean);
if (process.env.CAIO_ATTENTION_MYSQL_REQUIRED === "1" && !configured) {
  throw new Error("CAIO_ATTENTION_MYSQL_REQUIRED=1 but a CAIO_ATTENTION_*_DATABASE_URL is missing.");
}
const describeMysql = configured ? describe.sequential : describe.skip;

describeMysql("CAIO attention page service bound to the lifecycle (web identity)", () => {
  let admin: PrismaClient, web: PrismaClient, ops: PrismaClient;
  let workspaceId = "";
  const people = {} as Record<"owner" | "primary" | "cc" | "escalation" | "reviewer" | "outsider", string>;
  const roles: Record<keyof typeof people, WorkspaceRole> = {
    owner: "OWNER", primary: "OPERATOR", cc: "MEMBER", escalation: "OPERATOR", reviewer: "REVIEWER", outsider: "REVIEWER",
  };
  const viewer = (key: keyof typeof people): CaioAttentionViewer => ({ workspaceId,
    actor: { userId: people[key], sameWorkspace: true, active: true, role: key === "owner" ? "OWNER" : "OTHER", canReviewGovernedActions: true } });
  const rid = () => `req-${randomUUID()}`;

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: urls.admin! } } });
    web = new PrismaClient({ datasources: { db: { url: urls.web! } } });
    ops = new PrismaClient({ datasources: { db: { url: urls.ops! } } });
    const suffix = randomUUID().slice(0, 8);
    workspaceId = (await admin.workspace.create({ data: { name: `page ${suffix}`, slug: `attention-p-${suffix}` } })).id;
    for (const key of Object.keys(roles) as (keyof typeof people)[]) {
      people[key] = (await admin.user.create({ data: { name: `name-${key}`, email: `attention-p-${key}-${suffix}@example.test` } })).id;
      await admin.membership.create({ data: { workspaceId, userId: people[key], role: roles[key] } });
    }
    await ops.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'OPEN', updatedByRef = 'test' WHERE id = 'global'`;
  });

  afterAll(async () => {
    await ops.$executeRaw`UPDATE CaioAttentionControl SET intakeState = 'PAUSED', updatedByRef = 'test' WHERE id = 'global'`;
    await Promise.all([admin, web, ops].map((client) => client.$disconnect()));
  });

  it("lists, loads and runs the close chain through the contract, and fails closed without a policy", async () => {
    const service = createCaioAttentionLifecyclePageService({ db: web, getPolicy: () => CAIO_ATTENTION_TEST_DEFAULT_POLICY });
    const caseId = `case-p-${randomUUID().slice(0, 8)}`;
    const due = new Date(Date.now() + 2 * 24 * 3600_000);
    await admin.$executeRaw`INSERT INTO CaioAttentionCase (id, workspaceId, shortNo, detectorId, mergeKey, objectKey, category,
      originCandidateId, activeKey, status, primaryUserId, ccUserIdsJson, escalationUserId, reviewerUserIdsJson, severityAtSuggest,
      effectiveSeverity, reminderPolicy) VALUES (${caseId}, ${workspaceId}, 1, 'det', 'mk', 'obj', 'business', ${`cand-${caseId}`}, 'det:mk',
      'SUGGESTED', ${people.primary}, ${JSON.stringify([people.cc])}, ${people.escalation}, ${JSON.stringify([people.reviewer])},
      'critical', 'critical', 'critical')`;
    await admin.caioAttentionCaseEvent.create({ data: { caseId, kind: "SUGGESTED", payloadJson: JSON.stringify({ prefill: {
      primaryUserId: people.primary, ccUserIds: [people.cc], escalationUserId: people.escalation, reviewerUserIds: [people.reviewer],
      suggestedDueAt: due.toISOString() } }) } });

    expect(await service.listCases({ viewer: viewer("outsider"), scope: "queue", page: 1, pageSize: 20 })).toMatchObject({ items: [], total: 0 });
    expect(await service.loadCase({ viewer: viewer("primary"), caseId, sourcePage: "/t" })).toEqual({ ok: false, reason: "not_found" });
    const suggested = await service.loadCase({ viewer: viewer("owner"), caseId, sourcePage: "/t" });
    expect(suggested.ok && suggested.view).toMatchObject({ status: "SUGGESTED", command: null, viewerRoles: ["owner"],
      allowedOperations: ["confirm", "defer", "dismiss"], prefill: { primaryUserId: people.primary, committedDueAt: due } });
    expect(suggested.ok && suggested.view.people[people.primary]).toBe("name-primary");
    expect(suggested.ok && suggested.view.assignableUserIds).toHaveLength(6);

    const unbound = createCaioAttentionLifecyclePageService({ db: web, getPolicy: () => null });
    const confirm = { viewer: viewer("owner"), caseId, op: "confirm" as const, expectedCommandVersion: 0, clientRequestId: rid(),
      command: { primaryUserId: people.primary, ccUserIds: [people.cc], escalationUserId: people.escalation, reviewerUserIds: [people.reviewer], committedDueAt: due } };
    expect(await unbound.runCommand(confirm)).toEqual({ ok: false, reason: "service_unavailable" });
    expect(await service.runCommand(confirm)).toEqual({ ok: true, status: "DISPATCHED" });
    expect(await service.listCases({ viewer: viewer("primary"), scope: "mine", page: 1, pageSize: 20 })).toMatchObject({ total: 1, items: [{ caseId, viewerRoles: ["primary"] }] });
    const dispatched = await service.loadCase({ viewer: viewer("primary"), caseId, sourcePage: "/t" });
    expect(dispatched.ok && dispatched.view.allowedOperations).toEqual(["ack", "note", "submitDisposition"]);
    // A `user:<id>` viewer is the same person as the bare id (canonicalised like the loader).
    const prefixed = { workspaceId, actor: { ...viewer("primary").actor, userId: `user:${people.primary}` } };
    expect(await service.listCases({ viewer: prefixed, scope: "mine", page: 1, pageSize: 20 })).toMatchObject({ items: [{ caseId, viewerRoles: ["primary"] }] });
    // Bound without a policy: reads still work, nothing is offered, every command fails closed.
    const readOnly = await unbound.loadCase({ viewer: viewer("primary"), caseId, sourcePage: "/t" });
    expect(readOnly.ok && readOnly.view).toMatchObject({ status: "DISPATCHED", viewerRoles: ["primary"], allowedOperations: [] });
    expect(await unbound.listCases({ viewer: viewer("primary"), scope: "mine", page: 1, pageSize: 20 })).toMatchObject({ total: 1 });
    expect(await unbound.runCommand({ viewer: viewer("primary"), caseId, op: "ack", expectedCommandVersion: 1, clientRequestId: rid() }))
      .toEqual({ ok: false, reason: "service_unavailable" });

    const submit = { viewer: viewer("primary"), caseId, expectedCommandVersion: 1, clientRequestId: rid(), op: "submitDisposition" as const,
      disposedAt: new Date(), actionTaken: "restarted the job", note: null, evidenceRefs: ["ticket:OPS-9"] };
    expect(await service.runCommand({ ...submit, outcome: "resolved" as never })).toEqual({ ok: false, reason: "validation_failed" });
    expect(await service.runCommand({ ...submit, outcome: "handled" })).toEqual({ ok: true, status: "DISPOSITION_SUBMITTED" });
    const forReview = await service.loadCase({ viewer: viewer("reviewer"), caseId, sourcePage: "/t" });
    if (!forReview.ok || !forReview.view.currentDisposition) throw new Error("expected a current disposition");
    expect(forReview.view.allowedOperations).toEqual(["reviewAccept", "reviewReturn"]);
    const review = { viewer: viewer("reviewer"), caseId, expectedCommandVersion: 1, clientRequestId: rid(), op: "reviewAccept" as const,
      dispositionId: forReview.view.currentDisposition.id, reviewerVersion: forReview.view.reviewerVersion, note: "ticket checked" };
    expect(await service.runCommand({ ...review, attestedExternalRefs: [] })).toEqual({ ok: false, reason: "validation_failed" });
    expect(await service.runCommand({ ...review, clientRequestId: rid(), attestedExternalRefs: ["ticket:OPS-9"] })).toEqual({ ok: true, status: "CLOSED" });
    const closed = await service.loadCase({ viewer: viewer("owner"), caseId, sourcePage: "/t" });
    expect(closed.ok && closed.view).toMatchObject({ status: "CLOSED", currentDisposition: null, allowedOperations: [] });
  });
});
