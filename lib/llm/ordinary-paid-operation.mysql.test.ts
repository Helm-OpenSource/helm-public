import { lstatSync, statSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prepareOrdinaryPaidOperation, prepareOrdinaryPaidOperationOrFallback } from "./ordinary-paid-operation.service";
import { bindOrdinaryPaidProjection, verifyOrdinaryPaidOperationInTransaction } from "./ordinary-paid-operation.service";
import type { ModelRouteDecision } from "./model-egress-contracts";

const url = process.env.ORDINARY_PAID_OPERATION_MYSQL_URL;
if (process.env.ORDINARY_PAID_OPERATION_MYSQL_REQUIRED === "1" && !url) {
  throw new Error("isolated_ordinary_paid_operation_database_required");
}

describe.skipIf(!url)("ordinary paid operation uses a private synthetic MySQL source", () => {
  if (!url) { it.skip("needs an explicit private socket target", () => {}); return; }
  const target = new URL(url);
  const socket = target.searchParams.get("socket");
  const database = target.pathname.slice(1);
  const ownedSocket = target.hostname === "localhost" && target.username === "root" &&
    target.password === "" && !!socket && isAbsolute(socket) && lstatSync(socket).isSocket() &&
    statSync(dirname(socket)).uid === process.getuid?.() &&
    (statSync(dirname(socket)).mode & 0o077) === 0 &&
    /^helm_c5_synth_[0-9]+$/u.test(database);
  const ownedCi = process.env.GITHUB_ACTIONS === "true" &&
    process.env.HELM_CI_MYSQL_DATABASE === "helm_caio_p1d_ci" &&
    target.hostname === "127.0.0.1" && target.port === "3306" &&
    target.username === "helm_ci" && !socket && database === "helm_caio_p1d_ci" &&
    /^[a-f0-9]{12,64}$/u.test(process.env.ORDINARY_PAID_OPERATION_CI_CONTAINER ?? "");
  if (target.protocol !== "mysql:" ||
      database !== process.env.ORDINARY_PAID_OPERATION_DATABASE_NAME ||
      (!ownedSocket && !ownedCi)) {
    throw new Error("ordinary_paid_operation_private_target_invalid");
  }
  const a = new PrismaClient({ datasources: { db: { url } } });
  const b = new PrismaClient({ datasources: { db: { url } } });
  afterAll(async () => { await Promise.all([a.$disconnect(), b.$disconnect()]); });

  async function fixture() {
    const id = `synth-${randomUUID()}`;
    const userId = `synth-user-${randomUUID()}`;
    const subscriptionId = `synth-sub-${randomUUID()}`;
    const runId = `synth-run-${randomUUID()}`;
    await a.user.create({ data: { id: userId, email: `${userId}@example.test`, name: "Synthetic Actor" } });
    await a.workspace.create({ data: { id, name: "Synthetic Workspace", slug: id } });
    await a.membership.create({ data: { workspaceId: id, userId, role: "OWNER", status: "ACTIVE" } });
    await a.biReportSubscription.create({ data: {
      id: subscriptionId, workspaceId: id, createdByUserId: userId,
      name: "Synthetic BI", skillKey: "synthetic", skillVersion: "v1",
      scheduleCron: "0 0 * * *", deliveryTargetsJson: "[]",
    } });
    await a.biReportRun.create({ data: {
      id: runId, workspaceId: id, subscriptionId,
      scheduledFor: new Date("2026-10-03T00:00:00.000Z"), dedupeKey: runId,
    } });
    const input = { workspaceId: id, actorUserId: userId, kind: "bi_analysis" as const,
      sourceType: "bi_run" as const, sourceId: runId, slot: "analysis" };
    return { id, userId, runId, input };
  }

  it("admits one row for concurrent clients and separates a review slot", async () => {
    const f = await fixture();
    const results = await Promise.allSettled([a, b].map((client) =>
      prepareOrdinaryPaidOperation({ ...f.input, client })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    const ids = results.map((result) => result.status === "fulfilled" ? result.value.id : null);
    expect(new Set(ids).size).toBe(1);
    expect(await a.lLMWorkflowOperation.count({ where: { workspaceId: f.id } })).toBe(1);
    const review = await prepareOrdinaryPaidOperation({ ...f.input, client: b,
      kind: "bi_review", slot: "review" });
    expect(review.id).not.toBe(ids[0]);
  });

  it("does not let a caller mint another attempt by changing the slot on the same source", async () => {
    const f = await fixture();
    await prepareOrdinaryPaidOperation({ ...f.input, client: a });
    await expect(prepareOrdinaryPaidOperation({ ...f.input, client: b,
      slot: "analysis-2" })).rejects.toThrow("operation_slot_invalid");
    await expect(prepareOrdinaryPaidOperation({ ...f.input, client: b,
      kind: "bi_review", slot: "review-2" })).rejects.toThrow("operation_slot_invalid");
    expect(await a.lLMWorkflowOperation.count({ where: { workspaceId: f.id } })).toBe(1);
  });

  it("binds counterfactual and each ordered review role to one real business source", async () => {
    const f = await fixture();
    const counterfactual = await prepareOrdinaryPaidOperation({ client: a,
      workspaceId: f.id, actorUserId: f.userId, kind: "counterfactual_review",
      sourceType: "bi_run", sourceId: f.runId, slot: "counterfactual" });
    const roles = [];
    for (const slot of ["generator", "critic", "adversary"] as const) {
      roles.push(await prepareOrdinaryPaidOperation({ client: b,
        workspaceId: f.id, actorUserId: f.userId, kind: "multi_pass_review",
        sourceType: "bi_run", sourceId: f.runId, slot }));
    }
    expect(new Set([counterfactual.id, ...roles.map((row) => row.id)]).size).toBe(4);
    expect((await prepareOrdinaryPaidOperation({ client: a,
      workspaceId: f.id, actorUserId: f.userId, kind: "multi_pass_review",
      sourceType: "bi_run", sourceId: f.runId, slot: "generator" })).id).toBe(roles[0].id);
    await expect(prepareOrdinaryPaidOperation({ client: a,
      workspaceId: f.id, actorUserId: f.userId, kind: "multi_pass_review",
      sourceType: "bi_run", sourceId: f.runId, slot: "generator-2" }))
      .rejects.toThrow("operation_slot_invalid");
    await expect(prepareOrdinaryPaidOperation({ client: a,
      workspaceId: f.id, actorUserId: f.userId, kind: "counterfactual_review",
      sourceType: "bi_run", sourceId: f.runId, slot: "counterfactual-2" }))
      .rejects.toThrow("operation_slot_invalid");
    expect(await a.lLMWorkflowOperation.count({ where: { workspaceId: f.id } })).toBe(4);
  });

  it("derives a stable request and refuses a new charge from an unaudited source revision", async () => {
    const f = await fixture();
    const first = await prepareOrdinaryPaidOperation({ ...f.input, client: a });
    const replay = await prepareOrdinaryPaidOperation({ ...f.input, client: b });
    expect(replay.id).toBe(first.id);
    const secondUserId = `synth-user-${randomUUID()}`;
    await a.user.create({ data: { id: secondUserId, email: `${secondUserId}@example.test`, name: "Second Synthetic Actor" } });
    await a.membership.create({ data: { workspaceId: f.id, userId: secondUserId,
      role: "MEMBER", status: "ACTIVE" } });
    await expect(prepareOrdinaryPaidOperation({ ...f.input, client: b,
      actorUserId: secondUserId })).rejects.toThrow("operation_replay_conflict");
    expect("force" in f.input).toBe(false);
    await a.biReportRun.update({ where: { id: f.runId }, data: { querySummaryJson: "synthetic-changed" } });
    await expect(prepareOrdinaryPaidOperation({ ...f.input, client: a }))
      .rejects.toThrow("operation_source_revision_unapproved");
    expect(await a.lLMWorkflowOperation.count({ where: { workspaceId: f.id } })).toBe(1);
  });

  it("rejects a cross-workspace source and an actor without active membership", async () => {
    const f = await fixture();
    await expect(prepareOrdinaryPaidOperation({ ...f.input, client: a,
      actorUserId: null })).rejects.toThrow("operation_actor_required");
    await expect(prepareOrdinaryPaidOperation({ ...f.input, client: a,
      workspaceId: f.id.toUpperCase() })).rejects.toThrow("operation_workspace_unavailable");
    await expect(prepareOrdinaryPaidOperation({ ...f.input, client: a,
      sourceId: f.runId.toUpperCase() })).rejects.toThrow("operation_source_unavailable");
    await expect(prepareOrdinaryPaidOperation({ ...f.input, client: a,
      actorUserId: f.userId.toUpperCase() })).rejects.toThrow("operation_actor_unauthorized");
    await expect(prepareOrdinaryPaidOperation({ ...f.input, client: a, workspaceId: "nonexistent" }))
      .rejects.toThrow("operation_workspace_unavailable");
    await a.membership.updateMany({ where: { workspaceId: f.id, userId: f.userId }, data: { status: "INACTIVE" } });
    await expect(prepareOrdinaryPaidOperation({ ...f.input, client: b }))
      .rejects.toThrow("operation_actor_unauthorized");
    expect(await a.lLMWorkflowOperation.count({ where: { workspaceId: f.id } })).toBe(0);
  });

  it("binds a briefing to a real locked resource without automatic paid regeneration", async () => {
    const f = await fixture();
    const companyId = `synth-company-${randomUUID()}`;
    await a.company.create({ data: { id: companyId, workspaceId: f.id, name: "Synthetic Company" } });
    const request = { client: a, workspaceId: f.id, actorUserId: f.userId,
      kind: "briefing" as const, sourceType: "company" as const,
      sourceId: companyId, slot: "object_brief" };
    const first = await prepareOrdinaryPaidOperation(request);
    expect((await prepareOrdinaryPaidOperation({ ...request, client: b })).id).toBe(first.id);
    await a.company.update({ where: { id: companyId }, data: { name: "Synthetic Revised" } });
    await expect(prepareOrdinaryPaidOperation(request))
      .rejects.toThrow("operation_source_revision_unapproved");
    expect(await prepareOrdinaryPaidOperationOrFallback(request)).toBeNull();
  });

  it("requires an existing recommendation log before its paid explanation", async () => {
    const f = await fixture();
    const logId = `synth-rec-${randomUUID()}`;
    const request = { client: a, workspaceId: f.id, actorUserId: f.userId,
      kind: "recommendation_explanation" as const,
      sourceType: "recommendation_log" as const,
      sourceId: logId, slot: "explanation" };
    await expect(prepareOrdinaryPaidOperation(request))
      .rejects.toThrow("operation_source_unavailable");
    await a.recommendationLog.create({ data: {
      id: logId, workspaceId: f.id, userId: f.userId,
      objectType: "COMPANY", objectId: `synth-company-${randomUUID()}`,
      actionType: "CREATE_TASK", title: "Synthetic recommendation",
      description: "Synthetic deterministic candidate",
      policyResult: "SUGGEST_ONLY", explanation: "Deterministic explanation",
      recommendationPayload: '{"synthetic":true}',
    } });
    const operation = await prepareOrdinaryPaidOperation(request);
    expect((await prepareOrdinaryPaidOperation({ ...request, client: b })).id).toBe(operation.id);
    const critic = await prepareOrdinaryPaidOperation({ client: b,
      workspaceId: f.id, actorUserId: f.userId, kind: "judgement_review",
      sourceType: "recommendation_log", sourceId: logId, slot: "critique" });
    expect(critic.id).not.toBe(operation.id);
    await expect(prepareOrdinaryPaidOperation({ client: a,
      workspaceId: f.id, actorUserId: f.userId, kind: "judgement_review",
      sourceType: "recommendation_log", sourceId: logId, slot: "critique-2" }))
      .rejects.toThrow("operation_slot_invalid");
    await a.recommendationLog.update({ where: { id: logId }, data: {
      explanation: "Different deterministic source",
    } });
    await expect(prepareOrdinaryPaidOperation(request))
      .rejects.toThrow("operation_source_revision_unapproved");
  });

  it("binds meeting extraction to a persisted note and its same-workspace meeting", async () => {
    const f = await fixture();
    const meetingId = `synth-meeting-${randomUUID()}`;
    const noteId = `synth-note-${randomUUID()}`;
    const request = { client: a, workspaceId: f.id, actorUserId: f.userId,
      kind: "meeting_extraction" as const, sourceType: "meeting_note" as const,
      sourceId: noteId, slot: "extraction" };
    await a.meeting.create({ data: {
      id: meetingId, workspaceId: f.id, title: "Synthetic Meeting",
      startsAt: new Date("2026-10-03T10:00:00.000Z"),
      endsAt: new Date("2026-10-03T11:00:00.000Z"),
    } });
    await expect(prepareOrdinaryPaidOperation(request))
      .rejects.toThrow("operation_source_unavailable");
    await a.meetingNote.create({ data: {
      id: noteId, workspaceId: f.id, meetingId, summary: "Synthetic note",
    } });
    const first = await prepareOrdinaryPaidOperation(request);
    expect((await prepareOrdinaryPaidOperation({ ...request, client: b })).id).toBe(first.id);
  });

  it("binds only a present projection and rechecks source and actor in the claim transaction", async () => {
    const f = await fixture();
    const op = await prepareOrdinaryPaidOperation({ ...f.input, client: a });
    const projectionRef = `projection-${randomUUID()}`;
    const payloadHash = `sha256:${"a".repeat(64)}`;
    await expect(bindOrdinaryPaidProjection({ client: a, workspaceId: f.id,
      operationId: op.id, projectionReceiptRef: projectionRef, projectedPayloadHash: payloadHash }))
      .rejects.toThrow("operation_projection_unavailable");
    await a.governedModelProjectionReceipt.create({ data: {
      id: projectionRef, workspaceId: f.id, idempotencyKey: projectionRef,
      sourceAssetRefs: "[]", sourceAssetBindingsJson: "[]", candidateEvidenceRefs: "[]",
      selectedEvidenceRefs: "[]", droppedEvidenceRefs: "[]",
      projectedPayloadHash: payloadHash, projectedPayloadBytes: 10, maxInputTokens: 100,
      maxOutputTokens: 10, remoteSafe: false, redactionStatus: "synthetic",
      promptInjectionScanStatus: "passed", projectorRegistrationRef: "projector:synthetic",
      projectorRegistrationHash: payloadHash, projectorVersion: "v1",
      scannerRegistrationRef: "scanner:synthetic", scannerRegistrationHash: payloadHash,
      scannerVersion: "v1", validUntil: new Date(Date.now() + 60000), receiptJson: "{}",
      contentHash: `sha256:${"b".repeat(64)}`, createdAt: new Date(),
    } });
    await bindOrdinaryPaidProjection({ client: a, workspaceId: f.id,
      operationId: op.id, projectionReceiptRef: projectionRef, projectedPayloadHash: payloadHash });
    const decision = { workspaceRef: `workspace:${f.id}`, taskRef: `ordinary:${op.id}`,
      taskClass: "summary_briefing", projectionReceiptRef: projectionRef,
      projectedPayloadHash: payloadHash, requestKey: op.requestKey, attemptOrdinal: 0 } as ModelRouteDecision;
    await a.$transaction(async (tx) => {
      const found = await verifyOrdinaryPaidOperationInTransaction(tx, {
        workspaceId: f.id, operationId: op.id, decision });
      expect(found.id).toBe(op.id);
    });
    for (const corrupt of [
      { generation: 2 },
      { operationKey: "f".repeat(64) },
      { requestKey: `ordinary:${"e".repeat(64)}` },
    ]) {
      await a.lLMWorkflowOperation.update({ where: { id: op.id }, data: corrupt });
      await expect(a.$transaction((tx) => verifyOrdinaryPaidOperationInTransaction(tx, {
        workspaceId: f.id, operationId: op.id, decision: {
          ...decision,
          requestKey: corrupt.requestKey ?? decision.requestKey,
        },
      }))).rejects.toThrow("operation_identity_invalid");
      await a.lLMWorkflowOperation.update({ where: { id: op.id }, data: {
        generation: op.generation, operationKey: op.operationKey, requestKey: op.requestKey,
      } });
    }
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const ready = new Promise<void>((resolve) => { entered = resolve; });
    const heldRead = a.$transaction(async (tx) => {
      await verifyOrdinaryPaidOperationInTransaction(tx, {
        workspaceId: f.id, operationId: op.id, decision });
      entered();
      await gate;
    }, { timeout: 10_000 });
    await ready;
    let mutationCompleted = false;
    const mutation = b.biReportRun.update({ where: { id: f.runId },
      data: { querySummaryJson: "source-drift" } })
      .then((result) => { mutationCompleted = true; return result; });
    try {
      let sourceLockObserved = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const [row] = await a.$queryRaw<Array<{ waits: bigint }>>`
          SELECT COUNT(*) AS waits FROM performance_schema.data_lock_waits`;
        if (Number(row?.waits ?? 0) > 0) { sourceLockObserved = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect(sourceLockObserved).toBe(true);
      expect(mutationCompleted).toBe(false);
    } finally {
      release();
      await heldRead;
    }
    await mutation;
    await expect(a.$transaction((tx) => verifyOrdinaryPaidOperationInTransaction(tx, {
      workspaceId: f.id, operationId: op.id, decision }))).rejects.toThrow("operation_source_changed");
  });
});
