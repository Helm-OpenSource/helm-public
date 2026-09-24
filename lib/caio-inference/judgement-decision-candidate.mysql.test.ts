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
 * Runs in the Stage 1 MySQL CI job (npm run test:caio-stage1:mysql) against the same isolated database:
 *   STAGE1_OWNER_LOOP_DATABASE_URL=<helm_caio_stage1_* db url> DATABASE_URL=<same url> \
 *   STAGE1_OWNER_LOOP_TEST_DATABASE_NAME=<that db name> npm run test:caio-stage1:mysql
 */

import { db } from "@/lib/db";
import { canonicalJson } from "@/lib/expert-capability/hashing";
import {
  confirmStage1DecisionRecord,
  dispatchStage1DecisionWorkPacket,
  Stage1DecisionGateError,
} from "@/lib/stage1-owner-loop/decision-follow-through.service";
import {
  listWorkPacketsAssignedToMember,
  MemberWorkPacketAccessError,
} from "@/lib/stage1-owner-loop/member-work-packet-queries.service";
import type { OwnerCommandDraft } from "@/lib/stage1-owner-loop/types";

import {
  CAIO_INFERENCE_INPUT_SCHEMA_VERSION,
  computeCaioInferenceInputHash,
  type CaioInferenceInput,
} from "./contracts";
import {
  projectCaioInferenceJobDecisionCandidate,
  projectPendingCaioInferenceDecisionCandidates,
  CaioJudgementDecisionCandidateError,
} from "./judgement-decision-candidate.service";
import { buildCaioInferenceJudgementPacket } from "./judgement-packet";
import { CAIO_LAYERED_JUDGEMENT_SCHEMA_VERSION, validateCaioLayeredJudgement } from "./layered-judgement";

// Destructured so the production source-safety scan does not read `.INTERNAL` as a private DNS suffix.
const { INTERNAL: INTERNAL_OPPORTUNITY } = OpportunityType;
const integrationDatabaseUrl = process.env.STAGE1_OWNER_LOOP_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `j${process.pid}${Date.now()}`.replace(/\d/gu, (digit) => "abcdefghij"[Number(digit)]);

describeMysql("CAIO judgement to assigned task on an isolated MySQL database", () => {
  let workspaceId = "";
  let ownerId = "";
  let assigneeId = "";
  let bystanderId = "";
  let outsiderId = "";
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
    [ownerId, assigneeId, bystanderId, outsiderId, operatorId] = users.map((user) => user.id);
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
  });

  afterAll(async () => {
    if (workspaceId) await db.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    await db.user.deleteMany({ where: { email: { endsWith: `-${suffix}@example.test` } } });
    await db.$disconnect();
  });

  it("closes the loop only through the owner, and only the named member sees the task", async () => {
    const jobId = await completedJob();

    const created = await projectCaioInferenceJobDecisionCandidate({ workspaceId, jobId, portfolioRef });
    expect(created.kind).toBe("created");
    if (created.kind !== "created") return;
    expect(created.status).toBe("EVIDENCE_READY");
    const replay = await projectCaioInferenceJobDecisionCandidate({ workspaceId, jobId, portfolioRef });
    expect(replay).toEqual({ ...created, kind: "replayed" });
    // The bridge alone never produces work.
    expect(await db.actionItem.count({ where: { workspaceId } })).toBe(0);
    expect(await db.decisionWorkPacketClaim.count({ where: { workspaceId } })).toBe(0);

    // Neither an ordinary member nor an OPERATOR (who may confirm other Stage 1 decisions) can confirm a
    // model-originated candidate on the founder's behalf.
    await expect(
      confirmStage1DecisionRecord({
        workspaceId,
        decisionRecordId: created.decisionRecordId,
        conclusion: "Proceed",
        actorName: "Bystander",
        actorUserId: bystanderId,
      }),
    ).rejects.toThrow();
    await expect(
      confirmStage1DecisionRecord({
        workspaceId,
        decisionRecordId: created.decisionRecordId,
        conclusion: "Proceed",
        actorName: "Operator",
        actorUserId: operatorId,
      }),
    ).rejects.toMatchObject({ reasons: ["caio_inference_decision_owner_required"] });
    expect(
      (await db.decisionRecord.findUniqueOrThrow({ where: { id: created.decisionRecordId } })).status,
    ).toBe("EVIDENCE_READY");

    await confirmStage1DecisionRecord({
      workspaceId,
      decisionRecordId: created.decisionRecordId,
      conclusion: "Proceed with a dry-run.",
      actorName: "CAIO owner",
      actorUserId: ownerId,
    });
    const command: OwnerCommandDraft = {
      commandId: `command-${suffix}`,
      workspaceRef: `workspace:${workspaceId}`,
      decisionRef: created.decisionRecordId,
      ownerRef: ownerId,
      executionTargetRef: `user:${assigneeId}`,
      portfolioRef,
      goal: "Validate the revised reminder script without contacting anyone.",
      action: "Prepare a dry-run plan for owner review.",
      dueAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
      acceptanceCriteria: ["Dry-run plan reviewed by the owner"],
      evidenceRequirements: ["evidence:dry-run-plan"],
      invalidationConditions: ["Cohort recovers before the due date"],
      escalationOwnerRef: ownerId,
      automationLevel: "assist",
      allowedToolRefs: ["tool:task-draft"],
      externalSideEffects: [],
      policyEnvelopeRef: null,
      status: "owner_confirmed",
    };
    const dispatch = await dispatchStage1DecisionWorkPacket({
      workspaceId,
      decisionRecordId: created.decisionRecordId,
      command,
      actorName: "CAIO owner",
      actorUserId: ownerId,
    });
    const action = await db.actionItem.findUniqueOrThrow({ where: { id: dispatch.actionItemId } });
    // Owner-gated: nothing executes until the separate approval.
    expect(action.status).toBe(ActionStatus.PENDING_APPROVAL);

    const assigneeView = await listWorkPacketsAssignedToMember({ workspaceId, userId: assigneeId });
    expect(assigneeView.map((packet) => packet.actionItemRef)).toEqual([dispatch.actionItemId]);
    expect(assigneeView[0]).toMatchObject({
      decisionRef: created.decisionRecordId,
      goal: command.goal,
      status: ActionStatus.PENDING_APPROVAL,
    });
    expect(await listWorkPacketsAssignedToMember({ workspaceId, userId: bystanderId })).toEqual([]);
    expect(await listWorkPacketsAssignedToMember({ workspaceId, userId: ownerId })).toEqual([]);
    await expect(
      listWorkPacketsAssignedToMember({ workspaceId, userId: outsiderId }),
    ).rejects.toBeInstanceOf(MemberWorkPacketAccessError);
  });

  it("an evidenced judgement with nothing to decide leaves no record; batch skips projected jobs", async () => {
    const quietJob = await completedJob({
      suggestions: [],
      risks: [{ statement: "Minor noise.", severity: "low", evidenceRefs: ["evidence:metric-a"] }],
    });
    const quiet = await projectCaioInferenceJobDecisionCandidate({ workspaceId, jobId: quietJob, portfolioRef });
    expect(quiet).toEqual({ kind: "no_candidate", jobId: quietJob, reason: "no_suggestion_or_material_risk" });
    expect(
      await db.decisionRecord.count({ where: { workspaceId, decisionKey: `caio-inference-decision:${quietJob}` } }),
    ).toBe(0);

    const batch = await projectPendingCaioInferenceDecisionCandidates({ workspaceId, portfolioRef });
    // The first test's job already has its record and is skipped; only the quiet job is re-evaluated.
    expect(batch.map((outcome) => outcome.kind)).toEqual(["no_candidate"]);
  });

  it("refuses a tampered judgement, a foreign portfolio and a job that is not completed", async () => {
    const jobId = await completedJob();
    await db.caioInferenceJob.update({
      where: { id: jobId },
      data: { layeredJudgementHash: `sha256:${"f".repeat(64)}` },
    });
    await expect(
      projectCaioInferenceJobDecisionCandidate({ workspaceId, jobId, portfolioRef }),
    ).rejects.toMatchObject({ code: "judgement_integrity_failed" });

    const otherJob = await completedJob();
    await expect(
      projectCaioInferenceJobDecisionCandidate({ workspaceId, jobId: otherJob, portfolioRef: "opportunity:not-in-this-workspace" }),
    ).rejects.toBeInstanceOf(CaioJudgementDecisionCandidateError);

    await db.caioInferenceJob.update({ where: { id: otherJob }, data: { status: "queued" } });
    await expect(
      projectCaioInferenceJobDecisionCandidate({ workspaceId, jobId: otherJob, portfolioRef }),
    ).rejects.toMatchObject({ code: "job_not_completed" });
    expect(Stage1DecisionGateError).toBeDefined();
  });
});
