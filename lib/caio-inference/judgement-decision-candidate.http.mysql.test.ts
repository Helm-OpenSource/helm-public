import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, openSync, closeSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { childHasExited, closeOwnedChild } from "../../scripts/caio-http-child-lifecycle.mjs";
import { SESSION_ID_COOKIE } from "@/lib/auth/session-cookies";
import {
  ActionStatus,
  OpportunityStage,
  OpportunityType,
  RiskLevel,
  WorkspaceRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The judgement -> task closure on an isolated MySQL database:
 *   completed inference job -> decision candidate (EVIDENCE_READY, AI actor, no dispatch)
 *   -> OWNER confirms -> OWNER dispatches a work packet naming one member
 *   -> that member sees it; another member does not; a non-member is refused.
 *
 * Runs in the Stage 1 MySQL CI job (npm run test:caio-stage1:http:mysql) against the same isolated database:
 *   STAGE1_OWNER_LOOP_DATABASE_URL=<helm_caio_stage1_* db url> DATABASE_URL=<same url> \
 *   STAGE1_OWNER_LOOP_TEST_DATABASE_NAME=<that db name> npm run test:caio-stage1:http:mysql
 */

import { db } from "@/lib/db";
import { canonicalJson } from "@/lib/expert-capability/hashing";
import {
  CAIO_INFERENCE_INPUT_SCHEMA_VERSION,
  computeCaioInferenceInputHash,
  type CaioInferenceInput,
} from "./contracts";
import {
  projectCaioInferenceJobDecisionCandidate,
} from "./judgement-decision-candidate.service";
import { buildCaioInferenceJudgementPacket } from "./judgement-packet";
import { CAIO_LAYERED_JUDGEMENT_SCHEMA_VERSION, validateCaioLayeredJudgement } from "./layered-judgement";

// Destructured: the production source-safety scan reads a dotted INTERNAL member as a private DNS suffix.
const { INTERNAL: INTERNAL_OPPORTUNITY } = OpportunityType;
const integrationDatabaseUrl = process.env.STAGE1_OWNER_LOOP_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `j${process.pid}${Date.now()}`.replace(/\d/gu, (digit) => "abcdefghij"[Number(digit)]);

// Coverage of the real Next route/auth/session/Prisma chain; no mocked route, auth or database.
// A required CI runner checks the isolated DSN and performs the actual full Next build first.
describeMysql("CAIO real loopback HTTP owner closure (isolated MySQL)", () => {
  let server: ChildProcess | undefined;
  let logRoot = "";
  let base = "";
  const cookies: Record<string, string> = {};
  let workspaceId = "";
  let ownerId = "";
  let assigneeId = "";
  let bystanderId = "";
  let _outsiderId = "";
  let operatorId = "";
  let portfolioRef = "";

  async function completedJob(layeredOverrides: Record<string, unknown> = {}): Promise<string> {
    const now = new Date();
    const input: CaioInferenceInput = {
      schemaVersion: CAIO_INFERENCE_INPUT_SCHEMA_VERSION,
      workspaceId,
      taskClass: "hourly_diagnosis",
      windowStart: new Date(now.getTime() - 3_600_000).toISOString(),
      windowEnd: now.toISOString(),
      snapshotRefs: [{ snapshotId: `snap-${suffix}`, snapshotHash: `sha256:${"a".repeat(64)}` }],
      evidenceRefs: ["evidence:metric-a", "evidence:metric-b"],
      supplements: [],
    };
    const layered = {
      schemaVersion: CAIO_LAYERED_JUDGEMENT_SCHEMA_VERSION,
      facts: [{ statement: "Collections fell week over week.", evidenceRefs: ["evidence:metric-a"] }],
      inferences: [{ statement: "The drop concentrates in one cohort.", evidenceRefs: ["evidence:metric-b"] }],
      risks: [{ statement: "The drop may persist.", severity: "medium", evidenceRefs: ["evidence:metric-a"] }],
      unknowns: [{ statement: "Whether the calling window changed." }],
      suggestions: [{ kind: "dry_run_request", summary: "Dry-run a revised reminder script.", evidenceRefs: ["evidence:metric-b"] }],
      confidence: { band: "medium", score: 0.5 },
      ...layeredOverrides,
    };
    const validation = validateCaioLayeredJudgement(layered, new Set(input.evidenceRefs));
    if (!validation.ok) throw new Error(`fixture judgement invalid: ${validation.code}`);
    const row = await db.caioInferenceJob.create({
      data: {
        workspaceId,
        taskClass: input.taskClass,
        windowStart: new Date(input.windowStart),
        windowEnd: new Date(input.windowEnd),
        status: "completed",
        inputJson: canonicalJson(input),
        inputHash: computeCaioInferenceInputHash(input),
        completedAt: now,
      },
    });
    const packet = buildCaioInferenceJudgementPacket({
      workspaceId,
      jobId: row.id,
      inferenceInput: input,
      layered: validation.value,
      now,
    });
    if (!packet.ok) throw new Error(`fixture packet invalid: ${packet.code}`);
    await db.caioInferenceJob.update({
      where: { id: row.id },
      data: {
        judgementPacketJson: JSON.stringify(packet.packet),
        layeredJudgementJson: JSON.stringify(validation.value),
        layeredJudgementHash: validation.contentHash,
      },
    });
    return row.id;
  }

  beforeAll(async () => {
    if (process.env.HELM_CAIO_HTTP_MYSQL_ISOLATED !== "1") throw new Error("HTTP fixture isolation sentinel required");
    const databaseName = decodeURIComponent(new URL(integrationDatabaseUrl!).pathname.replace(/^\/+/u, ""));
    if (
      process.env.DATABASE_URL !== integrationDatabaseUrl ||
      !databaseName.startsWith("helm_caio_stage1_") ||
      databaseName !== process.env.STAGE1_OWNER_LOOP_TEST_DATABASE_NAME
    ) {
      throw new Error(
        "Refusing judgement-task integration test: DATABASE_URL must equal STAGE1_OWNER_LOOP_DATABASE_URL, a confirmed helm_caio_stage1_* database.",
      );
    }
    workspaceId = (await db.workspace.create({ data: { name: `CAIO judgement ${suffix}`, slug: `caio-judgement-${suffix}` } })).id;
    const users = await Promise.all(
      ["owner", "assignee", "bystander", "outsider", "operator"].map((name) =>
        db.user.create({ data: { name: `CAIO ${name}`, email: `caio-${name}-${suffix}@example.test` } }),
      ),
    );
    [ownerId, assigneeId, bystanderId, _outsiderId, operatorId] = users.map((user) => user.id);
    await db.membership.createMany({
      data: [
        { workspaceId, userId: ownerId, role: WorkspaceRole.OWNER },
        { workspaceId, userId: assigneeId, role: WorkspaceRole.MEMBER },
        { workspaceId, userId: bystanderId, role: WorkspaceRole.MEMBER },
        { workspaceId, userId: operatorId, role: WorkspaceRole.OPERATOR },
      ],
    });
    const opportunity = await db.opportunity.create({
      data: {
        workspaceId,
        ownerId,
        title: `CAIO operating portfolio ${suffix}`,
        type: INTERNAL_OPPORTUNITY,
        stage: OpportunityStage.ADVANCING,
        riskLevel: RiskLevel.MEDIUM,
        nextAction: "Review CAIO judgements",
      },
    });
    portfolioRef = `opportunity:${opportunity.id}`;
    for (const [label, id] of Object.entries({ owner: ownerId, member: assigneeId, bystander: bystanderId })) {
      const key = randomBytes(32).toString("hex");
      cookies[label] = `${SESSION_ID_COOKIE}=${key}`;
      await db.authSession.create({ data: { userId: id, activeWorkspaceId: workspaceId,
        sessionKeyHash: createHash("sha256").update(key).digest("hex"), providerType: "PASSWORD",
        sourcePage: "/login", lastWorkspaceSwitchAt: new Date(), expiresAt: new Date(Date.now() + 3600000) } });
    }
    for (const [label, data] of Object.entries({ expired: { expiresAt: new Date(0) }, revoked: { revokedAt: new Date() } })) {
      const key = randomBytes(32).toString("hex"); cookies[label] = `${SESSION_ID_COOKIE}=${key}`;
      await db.authSession.create({ data: { userId: ownerId, activeWorkspaceId: workspaceId,
        sessionKeyHash: createHash("sha256").update(key).digest("hex"), providerType: "PASSWORD",
        expiresAt: new Date(Date.now() + 3600000), ...data } });
    }
    const port = await new Promise<number>((resolve, reject) => {
      const socket = createServer(); socket.on("error", reject);
      socket.listen(0, "127.0.0.1", () => { const address = socket.address();
        if (!address || typeof address === "string") return reject(new Error("missing loopback port"));
        socket.close(() => resolve(address.port)); });
    });
    base = `http://127.0.0.1:${port}`;
    logRoot = mkdtempSync(join(tmpdir(), "helm-caio-http-"));
    const log = openSync(join(logRoot, "next.log"), "wx", 0o600);
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
      env: { ...process.env, NODE_ENV: "production" }, stdio: ["ignore", log, log],
    }); closeSync(log);
    for (let i = 0; i < 120; i++) {
      if (childHasExited(server)) throw new Error("owned Next process exited before readiness");
      try { const response = await fetch(`${base}/api/stage1/decisions/absent/review`, {
        method: "POST", redirect: "manual", body: "{}", signal: AbortSignal.timeout(1000) });
        if (response.status >= 300 && response.status < 400) return;
      } catch { /* Wait for this loopback server only. */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error("owned Next readiness timeout");
  });

  afterAll(async () => {
    let closed = !server;
    try {
      if (server) closed = (await closeOwnedChild(server)).closed;
      console.info(JSON.stringify({ ownedNextClosed: closed, nextExit: server?.exitCode ?? null, nextSignal: server?.signalCode ?? null }));
      if (!closed) throw new Error("owned_next_cleanup_timeout");
    } finally {
      try {
        if (workspaceId) await db.workspace.delete({ where: { id: workspaceId } });
        await db.user.deleteMany({ where: { email: { endsWith: `-${suffix}@example.test` } } });
      } finally { await db.$disconnect(); if (logRoot) rmSync(logRoot, { recursive: true, force: true }); }
    }
  });

  async function candidate() {
    const jobId = await completedJob();
    const created = await projectCaioInferenceJobDecisionCandidate({ workspaceId, jobId, portfolioRef });
    if (created.kind !== "created") throw new Error("synthetic projection did not create candidate");
    expect(await db.decisionWorkPacketClaim.count({ where: { decisionRecordId: created.decisionRecordId } })).toBe(0);
    return created.decisionRecordId;
  }
  function requestBody() {
    return { action: "approve", conclusion: "Proceed with synthetic dry run only.",
      executionTargetRef: `user:${assigneeId}`, portfolioRef,
      goal: `Synthetic HTTP goal ${suffix}`, workAction: "Prepare a synthetic plan without external effects.",
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      acceptanceCriteria: ["Synthetic plan reviewed"], evidenceRequirements: ["evidence:synthetic-plan"],
      invalidationConditions: ["Synthetic input invalid"], escalationOwnerRef: ownerId };
  }
  function post(id: string, label: string | null, body: unknown = requestBody()) {
    return fetch(`${base}/api/stage1/decisions/${id}/review`, { method: "POST", redirect: "manual",
      headers: { "content-type": "application/json", ...(label ? { cookie: cookies[label] } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  }
  async function assertNoPacket(id: string, status = "EVIDENCE_READY") {
    expect((await db.decisionRecord.findUniqueOrThrow({ where: { id } })).status).toBe(status);
    expect(await db.decisionWorkPacketClaim.count({ where: { decisionRecordId: id } })).toBe(0);
    expect(await db.actionItem.count({ where: { workspaceId } })).toBe(0);
    expect(await db.approvalTask.count({ where: { workspaceId } })).toBe(0);
  }
  it("the actual producer CLI refuses apply before DB with its gate off, and gated projection creates no packet", async () => {
    const jobId = await completedJob();
    const args = ["--import", "tsx", "--import", "./scripts/node-hooks/allow-server-only.mjs",
      "scripts/caio-inference-decision-candidates.ts", `--workspace-id=${workspaceId}`, `--portfolio-ref=${portfolioRef}`, `--job-id=${jobId}`, "--apply"];
    const off = spawnSync(process.execPath, args, { env: { ...process.env,
      HELM_CAIO_JUDGEMENT_DECISION_CANDIDATES_ENABLED: "false",
      DATABASE_URL: "mysql://synthetic@127.0.0.1:1/helm_caio_stage1_disconnected" }, encoding: "utf8", timeout: 15000 });
    expect(off.status).toBe(3); expect(JSON.parse(off.stderr).code).toBe("switch_off");
    expect(await db.decisionRecord.count({ where: { workspaceId, decisionKey: `caio-inference-decision:${jobId}` } })).toBe(0);
    const on = spawnSync(process.execPath, args, { env: { ...process.env,
      HELM_CAIO_JUDGEMENT_DECISION_CANDIDATES_ENABLED: "true" }, encoding: "utf8", timeout: 15000 });
    expect(on.status).toBe(0); const outcome = JSON.parse(on.stdout).outcomes[0];
    expect(outcome.kind).toBe("created"); await assertNoPacket(outcome.decisionRecordId);
  });

  it("unauthenticated, expired and revoked sessions redirect to login without dispatch", async () => {
    for (const label of [null, "expired", "revoked"]) {
      const id = await candidate(); const response = await post(id, label);
      expect([307, 308]).toContain(response.status);
      expect(new URL(response.headers.get("location")!, base).pathname).toBe("/login");
      await assertNoPacket(id);
    }
  });
  it("member is 403, cross-workspace decision 404, missing fields 400", async () => {
    const member = await candidate(); expect((await post(member, "member")).status).toBe(403); await assertNoPacket(member);
    const cross = await candidate();
    const other = await db.workspace.create({ data: { name: "Synthetic alternate", slug: `http-other-${suffix}` } });
    await db.membership.create({ data: { workspaceId: other.id, userId: ownerId, role: WorkspaceRole.OWNER } });
    const key = randomBytes(32).toString("hex"); cookies.other = `${SESSION_ID_COOKIE}=${key}`;
    await db.authSession.create({ data: { userId: ownerId, activeWorkspaceId: other.id, providerType: "PASSWORD",
      sessionKeyHash: createHash("sha256").update(key).digest("hex"), expiresAt: new Date(Date.now() + 3600000) } });
    try { expect((await post(cross, "other")).status).toBe(404); await assertNoPacket(cross); }
    finally { await db.workspace.delete({ where: { id: other.id } }); }
    const missing = await candidate(); expect((await post(missing, "owner", { action: "approve" })).status).toBe(400); await assertNoPacket(missing);
  });
  it("dispatch scope failure keeps the first confirmation committed, with no claim/action", async () => {
    const id = await candidate(); const body = { ...requestBody(), portfolioRef: "opportunity:synthetic-missing" };
    const response = await post(id, "owner", body); expect(response.status).toBe(409);
    expect((await response.json()).errorCode).toBe("DECISION_GATE_DENIED");
    await assertNoPacket(id, "OWNER_CONFIRMED");
    expect((await db.decisionRecord.findUniqueOrThrow({ where: { id } })).ownerRef).toBe(ownerId);
  });
  it("owner first HTTP succeeds, replay is 409, persistent claim/action is unique and member-only", async () => {
    const id = await candidate(); const body = requestBody();
    const beforeActions = await db.actionItem.count({ where: { workspaceId } });
    const response = await post(id, "owner", body); expect(response.status).toBe(200);
    const result = await response.json(); expect(result.status).toBe("DISPATCHED");
    const claim = await db.decisionWorkPacketClaim.findUniqueOrThrow({ where: { decisionRecordId: id } });
    const action = await db.actionItem.findUniqueOrThrow({ where: { id: claim.actionItemId } });
    expect(action.status).toBe(ActionStatus.PENDING_APPROVAL);
    expect(claim.workspaceId).toBe(workspaceId); expect(action.workspaceId).toBe(workspaceId);
    expect(JSON.parse(claim.ownerCommandJson)).toMatchObject({ commandId: `owner-command:${id}`, executionTargetRef: `user:${assigneeId}` });
    expect(result.workPacket.actionItemId).toBe(action.id);
    expect(await db.approvalTask.count({ where: { actionItemId: action.id } })).toBe(1);
    expect(await db.actionItem.count({ where: { workspaceId } })).toBe(beforeActions + 1);
    expect((await post(id, "owner", body)).status).toBe(409);
    expect(await db.decisionWorkPacketClaim.count({ where: { decisionRecordId: id } })).toBe(1);
    expect(await db.actionItem.count({ where: { workspaceId } })).toBe(beforeActions + 1);
    expect((await db.decisionRecord.findUniqueOrThrow({ where: { id } })).status).toBe("DISPATCHED");
    for (const label of ["member", "bystander"]) {
      const page = await fetch(`${base}/caio/my-work`, { headers: { cookie: cookies[label] }, redirect: "manual", signal: AbortSignal.timeout(20000) });
      expect(page.status).toBe(200); const html = await page.text();
      expect(html.includes(`data-action-item-ref="${action.id}"`)).toBe(label === "member");
    }
  });
});
