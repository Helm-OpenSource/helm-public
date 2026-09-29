// lib/member-mcp/member-mcp-response.mysql.test.ts
// Isolated-MySQL coverage for member MCP P1b (asynchronous registration of
// responses to CAIO prompts) and the P1a candidate gap it closes:
// prepare → submit (inbox) → processor → store receipt / signal + candidate,
// plus tamper, foreign prompt, idempotent reruns, dry run, and protected
// responses that must never be dropped (no mandate → retried and flagged;
// closed prompt → held). Gated on MEMBER_MCP_DATABASE_URL.

import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { decideMemberReadSurface } from "@/lib/member-gateway/contract";
import { createMemberPrompt, transitionMemberPrompt } from "@/lib/member-gateway/prompt-store.service";
import { issueMemberWorkSignalChallenge, submitMemberWorkSignal } from "@/lib/member-gateway/signal-store.service";
import { getMemberPromptResponseReceipt } from "@/lib/member-gateway/prompt-response-store.service";
import { listMemberWorkSignalCandidateReviews } from "@/lib/member-gateway/signal-candidate-review.service";
import {
  authenticateMemberMcpToken,
  claimMemberAgentConnection,
  decideMemberAgentConnection,
  requestMemberAgentConnection,
  type MemberMcpActor,
  type MemberMcpAuthContext,
} from "@/lib/member-mcp/connection-service";
import { memberRefForUser } from "@/lib/member-mcp/contract";
import { memberResponseSignalReceiptId } from "@/lib/member-mcp/response-contract";
import { runMemberPromptResponseProcessor } from "@/lib/member-mcp/response-processor";
import { executeMemberMcpTool } from "@/lib/member-mcp/tool-executor";
import { parseMemberMcpToolCall } from "@/lib/member-mcp/tools";
import { memberMcpPrincipal } from "@/lib/member-mcp/write-executor";

const integrationDatabaseUrl = process.env.MEMBER_MCP_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid.toString(36)}-${Date.now().toString(36)}`;

describeMysql("member MCP P1b prompt responses with an isolated MySQL database", () => {
  let workspaceId = "";
  const actors: Record<"owner" | "seat" | "other", MemberMcpActor & { membershipId: string }> = {} as never;
  let seatAuth: MemberMcpAuthContext;
  let promptCounter = 0;
  const previousEnv = process.env.HELM_MEMBER_MCP_ENABLED;

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
      throw new Error("DATABASE_URL must equal MEMBER_MCP_DATABASE_URL for the isolated integration test.");
    }
    process.env.HELM_MEMBER_MCP_ENABLED = "true";
    const workspace = await db.workspace.create({
      data: {
        name: `Member MCP P1b ${suffix}`,
        slug: `member-mcp-p1b-${suffix}`,
        featureFlagsJson: JSON.stringify({ memberMcp: true, memberMcpApprovedClients: ["claude_code"] }),
      },
    });
    workspaceId = workspace.id;
    for (const [key, role] of [
      ["owner", WorkspaceRole.OWNER],
      ["seat", WorkspaceRole.OPERATOR],
      ["other", WorkspaceRole.OPERATOR],
    ] as const) {
      const user = await db.user.create({ data: { email: `mmcp-p1b-${key}-${suffix}@example.com`, name: `p1b ${key}` } });
      const membership = await db.membership.create({
        data: { workspaceId, userId: user.id, role, status: MembershipStatus.ACTIVE },
      });
      actors[key] = { userId: user.id, name: user.name ?? key, role, membershipActive: true, membershipId: membership.id };
    }
    const requested = await requestMemberAgentConnection({
      workspaceId,
      membershipId: actors.seat.membershipId,
      actor: actors.seat,
      clientType: "claude_code",
      deviceLabel: "p1b 的电脑",
      includeWrite: true,
    });
    await decideMemberAgentConnection({ workspaceId, connectionId: requested.id, actor: actors.owner, decision: "approve" });
    const claimed = await claimMemberAgentConnection({ workspaceId, connectionId: requested.id, actor: actors.seat });
    seatAuth = await authenticateMemberMcpToken(claimed.token);
  });

  afterAll(async () => {
    if (previousEnv === undefined) delete process.env.HELM_MEMBER_MCP_ENABLED;
    else process.env.HELM_MEMBER_MCP_ENABLED = previousEnv;
    await db.$disconnect();
  });

  async function prompt(memberRef: string, inWorkspace = workspaceId) {
    promptCounter += 1;
    const promptRef = `p1b-prompt-${suffix}-${promptCounter}`;
    const now = Date.now();
    await createMemberPrompt({
      prompt: {
        promptRef,
        workspaceRef: inWorkspace,
        memberRef,
        severity: "normal",
        severityRuleRef: null,
        subjectObjectRef: `case-${suffix}-${promptCounter}`,
        projectedSummary: "请确认今天的回访安排",
        evidenceRefs: [],
        issuedAt: new Date(now - 60_000).toISOString(),
        expiresAt: new Date(now + 60 * 60_000).toISOString(),
      },
    });
    return promptRef;
  }

  async function call(name: string, args: Record<string, unknown>, auth: MemberMcpAuthContext = seatAuth) {
    const parsed = parseMemberMcpToolCall(name, args);
    if (!parsed.ok) throw new Error(parsed.message);
    return executeMemberMcpTool({ auth, call: parsed.call });
  }

  async function respond(promptRef: string, kind: string, text: string, auth: MemberMcpAuthContext = seatAuth) {
    const prepared = await call("prepare_prompt_response", { promptRef, kind, text }, auth);
    expect(prepared.ok).toBe(true);
    const challengeRef = (prepared.data as { challengeRef: string }).challengeRef;
    const submitted = await call("submit_prompt_response", { promptRef, kind, text, challengeRef }, auth);
    return { challengeRef, submitted };
  }

  // A later run, past the retry backoff (max 30 min) of rows that already tried.
  const later = (minutes = 31) => () => new Date(Date.now() + minutes * 60_000);

  // Seeds the work signal an earlier processor attempt would have recorded for
  // a candidate response, without the prompt transition that should follow it.
  async function seedResponseSignal(inboxRef: string, promptRef: string) {
    const promptRow = await db.memberPrompt.findUniqueOrThrow({ where: { id_workspaceId: { id: promptRef, workspaceId } } });
    const principal = memberMcpPrincipal(seatAuth);
    const payload = { kind: "progress" as const, summary: "回应提问（进展）：已约周五回电", detail: "已约周五回电", relatedEvidenceRefs: [] };
    const challenge = await issueMemberWorkSignalChallenge({
      draft: { principal, objectRef: promptRow.subjectObjectRef, objectVersion: 1, payload },
      ttlMs: 60_000,
    });
    const surface = decideMemberReadSurface({
      workspaceRef: workspaceId,
      memberRef: principal.memberRef,
      objectRef: promptRow.subjectObjectRef,
      tool: "get_my_brief",
      purpose: "test_seed",
      liveMembershipRef: `membership:${actors.seat.membershipId}`,
      toolScopeRef: "test",
      objectRelationshipAuthorizationRef: "test",
      fieldPurposePolicyRef: "test",
      sourceAuthorizationRef: "test",
      tenantProviderEgressPolicyRef: "test",
      classification: { sensitivity: "internal", processingDisposition: "remote_projected", classifiedAt: new Date().toISOString() },
    });
    await submitMemberWorkSignal({
      principal,
      challengeRef: challenge.challengeRef,
      payload,
      surface,
      evidenceSurfaces: new Map(),
      policyRef: "member-mcp:prompt-response",
      policyVersion: 1,
      receiptId: memberResponseSignalReceiptId(inboxRef),
    });
    return memberResponseSignalReceiptId(inboxRef);
  }

  const inbox = (inboxRef: string) => db.memberPromptResponseInbox.findUniqueOrThrow({ where: { id: inboxRef } });

  it("records an acknowledge on a pending prompt, registers it, and is idempotent", async () => {
    const promptRef = await prompt(memberRefForUser(actors.seat.userId));
    const { challengeRef, submitted } = await respond(promptRef, "acknowledge", "");
    expect(submitted.ok).toBe(true);
    const inboxRef = (submitted.data as { inboxRef: string; status: string }).inboxRef;
    expect((submitted.data as { status: string }).status).toBe("received");

    // Same challenge and content again: the same inbox row, flagged as a replay.
    const replay = await call("submit_prompt_response", { promptRef, kind: "acknowledge", text: "", challengeRef });
    expect(replay.data).toMatchObject({ inboxRef, replay: true });

    const dry = await runMemberPromptResponseProcessor({ workspaceId, dryRun: true });
    expect(dry.results).toContainEqual(expect.objectContaining({ inboxRef, status: "would_process" }));
    expect((await inbox(inboxRef)).status).toBe("received");

    const run = await runMemberPromptResponseProcessor({ workspaceId });
    expect(run.results).toContainEqual(expect.objectContaining({ inboxRef, status: "registered" }));
    const row = await inbox(inboxRef);
    expect(row.status).toBe("registered");
    const receipt = await getMemberPromptResponseReceipt(workspaceId, row.responseReceiptRef ?? "");
    expect(receipt).toMatchObject({ responseKind: "acknowledge" });
    // The member pulled a pending prompt: the processor recorded the delivery first.
    expect((await db.memberPrompt.findUniqueOrThrow({ where: { id_workspaceId: { id: promptRef, workspaceId } } })).state).toBe("delivered");

    const rerun = await runMemberPromptResponseProcessor({ workspaceId });
    expect(rerun.results.find((result) => result.inboxRef === inboxRef)).toBeUndefined();
    const status = await call("get_prompt_response_status", { inboxRef });
    expect(status.data).toMatchObject({ status: "registered", responseReceiptRef: row.responseReceiptRef });
  });

  it("rejects tampered content and prompts addressed to someone else", async () => {
    const promptRef = await prompt(memberRefForUser(actors.seat.userId));
    const prepared = await call("prepare_prompt_response", { promptRef, kind: "free_text_answer", text: "明天上午回访" });
    const challengeRef = (prepared.data as { challengeRef: string }).challengeRef;
    const tampered = await call("submit_prompt_response", { promptRef, kind: "free_text_answer", text: "不回访了", challengeRef });
    expect(tampered.ok).toBe(false);
    expect(tampered.error?.code).toBe("challenge_payload_hash_mismatch");
    expect(await db.memberPromptResponseInbox.count({ where: { memberChallengeRef: challengeRef } })).toBe(0);

    const foreign = await prompt(memberRefForUser(actors.other.userId));
    const refused = await call("prepare_prompt_response", { promptRef: foreign, kind: "refuse", text: "不是我的案子" });
    expect(refused.ok).toBe(false);
    expect(refused.error?.code).toBe("prompt_not_found");
  });

  it("keeps a protected response without an active mandate, then registers it once one exists", async () => {
    const promptRef = await prompt(memberRefForUser(actors.seat.userId));
    const { submitted } = await respond(promptRef, "refuse", "这个客户已经在走法务流程，我不应再联系");
    const inboxRef = (submitted.data as { inboxRef: string }).inboxRef;

    await runMemberPromptResponseProcessor({ workspaceId });
    let row = await inbox(inboxRef);
    expect(row.status).toBe("received");
    expect(row.needsHuman).toBe(true);
    expect(row.lastErrorCode).toBe("mandate_missing");

    const now = Date.now();
    const mandate = await db.caioMandateRecord.create({
      data: {
        workspaceId,
        caioRef: "caio:test",
        ceoRef: "ceo:test",
        stage: "advise",
        status: "active",
        objectiveRefs: "[]",
        scopeRefs: "[]",
        grantBasisRefs: "[]",
        reservedMatterRefs: "[]",
        stageDecisionRef: "stage-decision:test",
        policyEnvelopeRefs: "[]",
        humanResponsePolicyRef: "human-response:test",
        accountabilityAnchorRefs: "[]",
        guardianStopRefs: "[]",
        validFrom: new Date(now - 60_000),
        validUntil: new Date(now + 24 * 60 * 60_000),
        inFlightDisposition: "freeze",
        auditRefs: "[]",
      },
    });
    await db.caioActiveMandateClaim.create({ data: { workspaceId, mandateRecordId: mandate.id } });

    // The row backed off after the first attempt; a run before that is not due.
    await runMemberPromptResponseProcessor({ workspaceId });
    expect((await inbox(inboxRef)).status).toBe("received");
    await runMemberPromptResponseProcessor({ workspaceId, now: later() });
    row = await inbox(inboxRef);
    expect(row.status).toBe("registered");
    expect(row.needsHuman).toBe(false);
    const receipt = await getMemberPromptResponseReceipt(workspaceId, row.responseReceiptRef ?? "");
    expect(receipt).toMatchObject({ responseKind: "refuse", mandateRef: mandate.id, routePath: "local_fallback" });
    expect((await db.memberPrompt.findUniqueOrThrow({ where: { id_workspaceId: { id: promptRef, workspaceId } } })).state).toBe("responded");

    // A protected response on a prompt that is already closed is accepted
    // online and held for a human by the processor — never dropped.
    const late = await respond(promptRef, "appeal", "我对这条提问的判断有异议");
    expect(late.submitted.ok).toBe(true);
    const lateRef = (late.submitted.data as { inboxRef: string }).inboxRef;
    await runMemberPromptResponseProcessor({ workspaceId });
    const held = await inbox(lateRef);
    expect(held.status).toBe("held");
    expect(held.needsHuman).toBe(true);
    expect(held.lastErrorCode).toBe("prompt_closed");

    // A non-protected response to a closed prompt is refused online.
    const closed = await call("prepare_prompt_response", { promptRef, kind: "acknowledge" });
    expect(closed.error?.code).toBe("prompt_not_open");
  });

  it("registers a progress report as a work signal and a reviewable candidate", async () => {
    const promptRef = await prompt(memberRefForUser(actors.seat.userId));
    const { submitted } = await respond(promptRef, "progress_report", "已经约好周五回电，客户同意先还一期");
    const inboxRef = (submitted.data as { inboxRef: string }).inboxRef;
    await runMemberPromptResponseProcessor({ workspaceId });
    const row = await inbox(inboxRef);
    expect(row.status).toBe("registered");
    expect(row.signalReceiptRef).toBeTruthy();
    expect(row.candidateBundleRef).toBeTruthy();
    expect((await db.memberPrompt.findUniqueOrThrow({ where: { id_workspaceId: { id: promptRef, workspaceId } } })).responseRef).toBe(row.signalReceiptRef);
    const reviews = await listMemberWorkSignalCandidateReviews(workspaceId);
    expect(reviews.map((review) => review.artifactBundleId)).toContain(row.candidateBundleRef);
  });

  it("materializes a P1a work signal into the /approvals candidate list (P1a gap)", async () => {
    const prepared = await call("prepare_work_signal", { kind: "blocker", summary: "外呼线路今天下午断了两次" });
    const challengeRef = (prepared.data as { challengeRef: string }).challengeRef;
    const submitted = await call("submit_work_signal", { kind: "blocker", summary: "外呼线路今天下午断了两次", challengeRef });
    expect(submitted.data).toMatchObject({ candidateMaterialized: true, candidateCode: null });
    const bundle = (submitted.data as { candidateBundleRef: string }).candidateBundleRef;
    expect((await listMemberWorkSignalCandidateReviews(workspaceId)).map((review) => review.artifactBundleId)).toContain(bundle);
    // A replayed submit reuses the same candidate.
    const replay = await call("submit_work_signal", { kind: "blocker", summary: "外呼线路今天下午断了两次", challengeRef });
    expect(replay.data).toMatchObject({ candidateMaterialized: true, candidateBundleRef: bundle });
  });

  it("skips a workspace whose member MCP switch is off", async () => {
    const promptRef = await prompt(memberRefForUser(actors.seat.userId));
    const { submitted } = await respond(promptRef, "acknowledge", "");
    const inboxRef = (submitted.data as { inboxRef: string }).inboxRef;
    const off = await runMemberPromptResponseProcessor({ workspaceId, env: { HELM_MEMBER_MCP_ENABLED: "false" } });
    expect(off.skippedWorkspaces).toContain(workspaceId);
    expect((await inbox(inboxRef)).status).toBe("received");
    await runMemberPromptResponseProcessor({ workspaceId });
    expect((await inbox(inboxRef)).status).toBe("registered");
  });
  it("does not let protected rows waiting for a mandate block newer responses", async () => {
    // A separate workspace without any CAIO mandate.
    const ws = await db.workspace.create({
      data: {
        name: `Member MCP P1b HOL ${suffix}`,
        slug: `member-mcp-p1b-hol-${suffix}`,
        featureFlagsJson: JSON.stringify({ memberMcp: true, memberMcpApprovedClients: ["claude_code"] }),
      },
    });
    const owner = await db.user.create({ data: { email: `mmcp-p1b-hol-owner-${suffix}@example.com`, name: "hol owner" } });
    const seat = await db.user.create({ data: { email: `mmcp-p1b-hol-seat-${suffix}@example.com`, name: "hol seat" } });
    await db.membership.create({ data: { workspaceId: ws.id, userId: owner.id, role: WorkspaceRole.OWNER, status: MembershipStatus.ACTIVE } });
    const seatMembership = await db.membership.create({
      data: { workspaceId: ws.id, userId: seat.id, role: WorkspaceRole.OPERATOR, status: MembershipStatus.ACTIVE },
    });
    const ownerActor = { userId: owner.id, name: "hol owner", role: WorkspaceRole.OWNER, membershipActive: true };
    const seatActor = { userId: seat.id, name: "hol seat", role: WorkspaceRole.OPERATOR, membershipActive: true };
    const requested = await requestMemberAgentConnection({
      workspaceId: ws.id,
      membershipId: seatMembership.id,
      actor: seatActor,
      clientType: "claude_code",
      deviceLabel: "hol 的电脑",
      includeWrite: true,
    });
    await decideMemberAgentConnection({ workspaceId: ws.id, connectionId: requested.id, actor: ownerActor, decision: "approve" });
    const claimed = await claimMemberAgentConnection({ workspaceId: ws.id, connectionId: requested.id, actor: seatActor });
    const auth = await authenticateMemberMcpToken(claimed.token);

    for (let index = 0; index < 60; index += 1) {
      const promptRef = await prompt(memberRefForUser(seat.id), ws.id);
      const { submitted } = await respond(promptRef, "refuse", `第 ${index} 条：不该再联系这位客户`, auth);
      expect(submitted.ok).toBe(true);
    }
    // Each protected row gets its first attempt (limit 50 per run), then backs off.
    await runMemberPromptResponseProcessor({ workspaceId: ws.id });
    await runMemberPromptResponseProcessor({ workspaceId: ws.id });
    expect(await db.memberPromptResponseInbox.count({ where: { workspaceId: ws.id, status: "received", attempts: 0 } })).toBe(0);
    expect(await db.memberPromptResponseInbox.count({ where: { workspaceId: ws.id, needsHuman: true } })).toBe(60);

    const promptRef = await prompt(memberRefForUser(seat.id), ws.id);
    const { submitted } = await respond(promptRef, "acknowledge", "", auth);
    const ackRef = (submitted.data as { inboxRef: string }).inboxRef;
    const run = await runMemberPromptResponseProcessor({ workspaceId: ws.id });
    expect(run.results).toContainEqual(expect.objectContaining({ inboxRef: ackRef, status: "registered" }));
    // The protected rows are still kept (and still flagged), never dropped.
    expect(await db.memberPromptResponseInbox.count({ where: { workspaceId: ws.id, kind: "refuse", status: "received", needsHuman: true } })).toBe(60);
  }, 120_000);

  it("keeps an already-recorded signal and its candidate when the prompt closed meanwhile", async () => {
    const promptRef = await prompt(memberRefForUser(actors.seat.userId));
    const { submitted } = await respond(promptRef, "progress_report", "已约周五回电");
    const inboxRef = (submitted.data as { inboxRef: string }).inboxRef;
    const signalRef = await seedResponseSignal(inboxRef, promptRef);
    const promptRow = await db.memberPrompt.findUniqueOrThrow({ where: { id_workspaceId: { id: promptRef, workspaceId } } });
    await transitionMemberPrompt({
      workspaceRef: workspaceId,
      promptRef,
      cause: "withdraw",
      expectedVersion: promptRow.version,
      receiptId: `test-withdraw-${suffix}-${promptRef}`,
      now: new Date().toISOString(),
    });
    await runMemberPromptResponseProcessor({ workspaceId });
    const row = await inbox(inboxRef);
    expect(row.status).toBe("rejected");
    expect(row.lastErrorCode).toBe("signal_recorded_prompt_closed");
    expect(row.signalReceiptRef).toBe(signalRef);
    expect(row.candidateBundleRef).toBeTruthy();
    expect((await listMemberWorkSignalCandidateReviews(workspaceId)).map((review) => review.artifactBundleId)).toContain(row.candidateBundleRef);
  });

  it("does not report another response's answer as its own", async () => {
    const promptRef = await prompt(memberRefForUser(actors.seat.userId));
    // A refuse answers the prompt (an acknowledge would not: it is only an
    // interaction receipt). The workspace has an active mandate by now.
    const refuse = await respond(promptRef, "refuse", "这位客户在走法务流程");
    const refuseRef = (refuse.submitted.data as { inboxRef: string }).inboxRef;
    const progress = await respond(promptRef, "progress_report", "已约周五回电");
    const progressRef = (progress.submitted.data as { inboxRef: string }).inboxRef;
    const signalRef = await seedResponseSignal(progressRef, promptRef);
    await runMemberPromptResponseProcessor({ workspaceId });
    expect((await inbox(refuseRef)).status).toBe("registered");
    expect((await db.memberPrompt.findUniqueOrThrow({ where: { id_workspaceId: { id: promptRef, workspaceId } } })).state).toBe("responded");
    const row = await inbox(progressRef);
    expect(row.status).toBe("rejected");
    expect(row.lastErrorCode).toBe("prompt_already_answered");
    expect(row.signalReceiptRef).toBe(signalRef);
    expect(row.candidateBundleRef).toBeTruthy();
  });

});
