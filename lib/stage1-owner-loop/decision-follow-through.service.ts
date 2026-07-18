import "server-only";

import {
  ActionStatus,
  ActionType,
  ActorType,
  ApprovalStatus,
  SourceType,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import {
  assertWorkspaceGovernedActionManagementServiceAccess,
  assertWorkspaceInsightServiceAccess,
} from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import {
  routeSupervisionSignal,
  validateDecisionObject,
} from "@/lib/agentos-decision-supervision/contract";
import type {
  DecisionObject,
  SupervisionSignal,
} from "@/lib/agentos-decision-supervision/types";
import { createGovernedAction } from "@/lib/policies/engine";
import { jsonStringify } from "@/lib/utils";
import {
  validateEvidenceAnswerPacket,
  validateOwnerCommandDraft,
} from "./contracts";
import type {
  EvidenceAnswerPacket,
  EvidenceStatement,
  OwnerCommandDraft,
  OwnerQuestionPacket,
} from "./types";

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

export class Stage1DecisionGateError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`Stage 1 decision gate denied: ${reasons.join(", ")}`);
    this.name = "Stage1DecisionGateError";
    this.reasons = reasons;
  }
}

export async function recordOwnerQuestionAndEvidenceAnswer(input: {
  workspaceId: string;
  question: OwnerQuestionPacket;
  answer: EvidenceAnswerPacket;
  actorName: string;
  actorUserId: string;
  english?: boolean;
}) {
  await assertWorkspaceInsightServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });
  const workspaceRef = `workspace:${input.workspaceId}`;
  const validation = validateEvidenceAnswerPacket(input.answer);
  const reasons = [...validation.errors];
  if (
    input.question.workspaceRef !== workspaceRef ||
    input.answer.workspaceRef !== workspaceRef
  ) {
    reasons.push("workspace_mismatch");
  }
  if (input.answer.questionRef !== input.question.questionId)
    reasons.push("question_ref_mismatch");
  if (input.question.askedByOwnerRef !== input.actorUserId)
    reasons.push("owner_identity_mismatch");
  if (reasons.length > 0) throw new Stage1DecisionGateError(reasons);

  return db.$transaction(async (tx) => {
    const artifact = await tx.artifactBundle.create({
      data: {
        workspaceId: input.workspaceId,
        artifactType: "OWNER_EVIDENCE_ANSWER",
        title: input.question.question,
        status: "DRAFT",
        systemOfRecordWrite: false,
        summary: input.answer.answer,
        artifactsJson: jsonStringify({
          question: input.question,
          answer: input.answer,
        }),
        evidenceRefs: jsonStringify(input.answer.evidenceRefs),
        sourceProvenance: "stage1_owner_question",
        confidence:
          input.answer.confidence === "high"
            ? 90
            : input.answer.confidence === "medium"
              ? 60
              : 30,
        openQuestions:
          input.answer.unknowns.length > 0
            ? jsonStringify(input.answer.unknowns)
            : null,
        reviewPosture: jsonStringify({
          reviewRequired: input.answer.reviewRequired,
          conflicts: input.answer.conflicts,
          refusalReason: input.answer.refusalReason,
        }),
      },
    });
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actor: input.actorName,
        actorType: ActorType.USER,
        actionType: "OWNER_EVIDENCE_ANSWER_RECORDED",
        targetType: "ArtifactBundle",
        targetId: artifact.id,
        summary: input.english
          ? "Owner question and evidence-bounded answer recorded for review"
          : "一把手问题与证据化答案已记录并等待复核",
        payload: {
          questionId: input.question.questionId,
          answerId: input.answer.answerId,
          reviewRequired: input.answer.reviewRequired,
          evidenceRefCount: input.answer.evidenceRefs.length,
        },
      },
      { client: tx },
    );
    return artifact;
  });
}

export async function createStage1DecisionRecord(input: {
  workspaceId: string;
  decision: DecisionObject;
  facts: EvidenceStatement[];
  inferences: EvidenceStatement[];
  unknowns: string[];
  risks: string[];
  actorName: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  english?: boolean;
}) {
  await assertWorkspaceInsightServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType ?? ActorType.AI,
    english: input.english ?? false,
  });
  const validation = validateDecisionObject(input.decision);
  const workspaceRef = `workspace:${input.workspaceId}`;
  const reasons = validation.valid ? [] : [...validation.reasons];
  if (input.decision.tenantRef !== workspaceRef)
    reasons.push("workspace_mismatch");
  for (const statement of [...input.facts, ...input.inferences]) {
    if (statement.evidenceRefs.length === 0)
      reasons.push("statement_evidence_required");
  }
  if (reasons.length > 0)
    throw new Stage1DecisionGateError([...new Set(reasons)]);

  const evidenceReady =
    input.decision.evidenceRefs.length > 0 &&
    input.decision.knowledgeRefs.length > 0 &&
    ["draft_task", "shadow", "active_candidate"].includes(
      validation.maxActionLevel,
    );
  return db.$transaction(async (tx) => {
    const record = await tx.decisionRecord.create({
      data: {
        workspaceId: input.workspaceId,
        decisionKey: input.decision.decisionId,
        decisionType: input.decision.decisionType,
        businessQuestion: input.decision.businessQuestion,
        problemCategoryRef: input.decision.problemCategoryRef,
        contextRefs: jsonStringify(input.decision.contextRefs),
        knowledgeRefs: jsonStringify(input.decision.knowledgeRefs),
        evidenceRefs: jsonStringify(input.decision.evidenceRefs),
        policyRefs: jsonStringify(input.decision.policyRefs),
        receiptRefs: jsonStringify(input.decision.receiptRefs),
        alternatives: jsonStringify(input.decision.alternatives),
        recommendedOption: input.decision.recommendedOption,
        confidence: input.decision.confidence,
        riskLevel: input.decision.riskLevel,
        allowedActionLevel: validation.maxActionLevel,
        ownerGate: input.decision.ownerGate,
        rollbackPath: input.decision.rollbackPath,
        factsJson: jsonStringify(input.facts),
        inferencesJson: jsonStringify(input.inferences),
        unknownsJson: jsonStringify(input.unknowns),
        risksJson: jsonStringify(input.risks),
        status: evidenceReady ? "EVIDENCE_READY" : "DRAFT",
        validUntil: input.decision.expiryOrReviewAt
          ? new Date(input.decision.expiryOrReviewAt)
          : null,
      },
    });
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actor: input.actorName,
        actorType: input.actorType ?? ActorType.AI,
        actionType: "STAGE1_DECISION_RECORDED",
        targetType: "DecisionRecord",
        targetId: record.id,
        summary: evidenceReady
          ? "Decision evidence is ready for owner confirmation"
          : "Decision draft recorded but cannot advance beyond observation",
        payload: {
          decisionKey: record.decisionKey,
          status: record.status,
          allowedActionLevel: record.allowedActionLevel,
          validationReasons: validation.reasons,
        },
      },
      { client: tx },
    );
    return record;
  });
}

export async function confirmStage1DecisionRecord(input: {
  workspaceId: string;
  decisionRecordId: string;
  conclusion: string;
  actorName: string;
  actorUserId: string;
  english?: boolean;
}) {
  if (!input.actorUserId.trim())
    throw new Stage1DecisionGateError(["owner_identity_required"]);
  if (!input.conclusion.trim())
    throw new Stage1DecisionGateError(["owner_conclusion_required"]);
  await assertWorkspaceGovernedActionManagementServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });
  const now = new Date();
  const outcome = await db.$transaction(async (tx) => {
    const claimed = await tx.decisionRecord.updateMany({
      where: {
        id: input.decisionRecordId,
        workspaceId: input.workspaceId,
        status: "EVIDENCE_READY",
        ownerConfirmedAt: null,
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      data: {
        status: "OWNER_CONFIRMED",
        ownerRef: input.actorUserId,
        ownerConclusion: input.conclusion.trim(),
        ownerConfirmedAt: now,
      },
    });
    let record = await tx.decisionRecord.findFirst({
      where: { id: input.decisionRecordId, workspaceId: input.workspaceId },
    });
    if (!record) return { kind: "not_found" as const };
    if (claimed.count === 0) {
      if (
        record.status === "OWNER_CONFIRMED" &&
        record.ownerRef === input.actorUserId &&
        record.ownerConclusion === input.conclusion.trim()
      ) {
        return { kind: "idempotent" as const, record };
      }
      if (record.validUntil && record.validUntil <= now) {
        const expired = await tx.decisionRecord.updateMany({
          where: {
            id: record.id,
            workspaceId: input.workspaceId,
            status: { in: ["DRAFT", "EVIDENCE_READY"] },
          },
          data: { status: "EXPIRED" },
        });
        if (expired.count === 1) {
          record = await tx.decisionRecord.findUniqueOrThrow({
            where: { id: record.id },
          });
          await writeAuditLog(
            {
              workspaceId: input.workspaceId,
              userId: input.actorUserId,
              actor: input.actorName,
              actorType: ActorType.USER,
              actionType: "STAGE1_DECISION_EXPIRED",
              targetType: "DecisionRecord",
              targetId: record.id,
              summary: input.english
                ? "Decision expired before owner confirmation"
                : "决策在一把手确认前已失效",
              payload: { validUntil: record.validUntil, attemptedAt: now },
            },
            { client: tx },
          );
        }
        return { kind: "expired" as const, record };
      }
      return { kind: "not_ready" as const, record };
    }
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actor: input.actorName,
        actorType: ActorType.USER,
        actionType: "STAGE1_DECISION_OWNER_CONFIRMED",
        targetType: "DecisionRecord",
        targetId: record.id,
        summary: input.english
          ? "Owner confirmed the decision"
          : "一把手已确认决策",
        payload: { conclusion: input.conclusion.trim(), confirmedAt: now },
      },
      { client: tx },
    );
    return { kind: "confirmed" as const, record };
  });
  if (outcome.kind === "not_found") {
    throw new Stage1DecisionGateError(["decision_not_found"]);
  }
  if (outcome.kind === "expired") {
    throw new Stage1DecisionGateError(["decision_expired"]);
  }
  if (outcome.kind === "not_ready") {
    throw new Stage1DecisionGateError([
      "decision_already_claimed_or_not_ready",
    ]);
  }
  return outcome.record;
}

export async function recordStage1SupervisionSignal(input: {
  workspaceId: string;
  signal: SupervisionSignal;
  decisionRecordId?: string | null;
  expectedState?: string | null;
  actualState: string;
  responsibilityScopeRef?: string | null;
  escalationCondition: string;
  actorName?: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  english?: boolean;
}) {
  await assertWorkspaceInsightServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType ?? ActorType.AI,
    english: input.english ?? false,
  });
  const reasons: string[] = [];
  if (input.signal.tenantRef !== `workspace:${input.workspaceId}`) {
    reasons.push("workspace_mismatch");
  }
  if (input.signal.evidenceRefs.length === 0)
    reasons.push("signal_evidence_required");
  if (!input.signal.observedFact.trim()) reasons.push("observed_fact_required");
  if (!input.actualState.trim()) reasons.push("actual_state_required");
  if (!input.escalationCondition.trim())
    reasons.push("escalation_condition_required");
  if (reasons.length > 0) throw new Stage1DecisionGateError(reasons);
  // Resolve the route through the closed contract to prove it can only become
  // a status update or a gated intervention draft. The persisted field remains
  // the signal's declared route; this function never executes the intervention.
  routeSupervisionSignal(input.signal);

  return db.$transaction(async (tx) => {
    const record = await tx.supervisionSignalRecord.create({
      data: {
        workspaceId: input.workspaceId,
        decisionRecordId: input.decisionRecordId ?? null,
        signalKey: input.signal.signalId,
        signalType: input.signal.signalType,
        observedObjectRef: input.signal.observedObjectRef,
        baselineRef: input.signal.baselineRef,
        evidenceRefs: jsonStringify(input.signal.evidenceRefs),
        severity: input.signal.severity,
        confidence: input.signal.confidence,
        recommendedRoute: input.signal.recommendedRoute,
        ownerRef: input.signal.ownerRef,
        deadlineOrSla: input.signal.deadlineOrSla
          ? new Date(input.signal.deadlineOrSla)
          : null,
        status: input.signal.status,
        observedFact: input.signal.observedFact,
        interpretation: input.signal.interpretation,
        expectedState: input.expectedState ?? null,
        actualState: input.actualState.trim(),
        responsibilityScopeRef: input.responsibilityScopeRef ?? null,
        escalationCondition: input.escalationCondition.trim(),
      },
    });
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actor: input.actorName ?? "Helm Supervision Runtime",
        actorType: input.actorType ?? ActorType.AI,
        actionType: "STAGE1_SUPERVISION_SIGNAL_RECORDED",
        targetType: "SupervisionSignalRecord",
        targetId: record.id,
        summary: input.english
          ? "Evidence-bounded supervision signal recorded without execution"
          : "证据化监督信号已记录，未触发自动执行",
        payload: {
          signalKey: record.signalKey,
          severity: record.severity,
          recommendedRoute: record.recommendedRoute,
        },
      },
      { client: tx },
    );
    return record;
  });
}

export async function dispatchStage1DecisionWorkPacket(input: {
  workspaceId: string;
  decisionRecordId: string;
  command: OwnerCommandDraft;
  actorName: string;
  actorUserId: string;
  english?: boolean;
}): Promise<{
  actionItemId: string;
  approvalTaskId?: string;
  created: boolean;
}> {
  await assertWorkspaceGovernedActionManagementServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });
  const commandValidation = validateOwnerCommandDraft(input.command);
  if (!commandValidation.valid)
    throw new Stage1DecisionGateError(commandValidation.errors);
  const decision = await db.decisionRecord.findFirst({
    where: { id: input.decisionRecordId, workspaceId: input.workspaceId },
  });
  if (!decision) throw new Stage1DecisionGateError(["decision_not_found"]);
  const reasons: string[] = [];
  if (decision.ownerRef !== input.actorUserId)
    reasons.push("owner_identity_mismatch");
  if (input.command.workspaceRef !== `workspace:${input.workspaceId}`) {
    reasons.push("workspace_mismatch");
  }
  if (input.command.decisionRef !== decision.id)
    reasons.push("decision_ref_mismatch");
  if (input.command.ownerRef !== input.actorUserId)
    reasons.push("command_owner_mismatch");
  if (input.command.status !== "owner_confirmed")
    reasons.push("command_not_confirmed");
  if (reasons.length > 0) throw new Stage1DecisionGateError(reasons);

  const resolveExisting = async (actionItemId: string) => {
    const action = await db.actionItem.findFirst({
      where: { id: actionItemId, workspaceId: input.workspaceId },
      select: { id: true, approvalTask: { select: { id: true } } },
    });
    if (!action)
      throw new Stage1DecisionGateError(["claimed_action_not_found"]);
    return {
      actionItemId: action.id,
      approvalTaskId: action.approvalTask?.id,
      created: false as const,
    };
  };
  const existing = await db.decisionWorkPacketClaim.findUnique({
    where: { decisionRecordId: decision.id },
  });
  if (existing) return resolveExisting(existing.actionItemId);
  if (decision.status !== "OWNER_CONFIRMED") {
    throw new Stage1DecisionGateError(["owner_confirmation_required"]);
  }

  const result = await createGovernedAction({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: ActorType.USER,
    english: input.english,
    actionType: ActionType.CREATE_TASK,
    title: input.english
      ? `Decision follow-through: ${decision.businessQuestion}`
      : `决策督办：${decision.businessQuestion}`,
    description: `${input.command.goal}\n\n${input.command.action}`,
    aiReason: input.english
      ? "The owner confirmed this evidence-bounded decision. The work packet remains review-first and requires an independent execution receipt."
      : "一把手已确认该证据化决策。本 Work Packet 仍走复核优先链，并要求独立执行回执。",
    riskLevel: "HIGH",
    dueDate: new Date(input.command.dueAt),
    sourceType: SourceType.SYSTEM_INFERENCE,
    sourceId: `decision-record:${decision.id}`,
    contentAuthorship: ActorType.AI,
    metadata: {
      generatedFrom: "stage1_decision_follow_through",
      decisionRecordId: decision.id,
      commandId: input.command.commandId,
      executionTargetRef: input.command.executionTargetRef,
      acceptanceCriteria: input.command.acceptanceCriteria,
      evidenceRequirements: input.command.evidenceRequirements,
      invalidationConditions: input.command.invalidationConditions,
      escalationOwnerRef: input.command.escalationOwnerRef,
      automationLevel: input.command.automationLevel,
      allowedToolRefs: input.command.allowedToolRefs,
      externalSideEffects: input.command.externalSideEffects,
    },
    resultPreview: input.command.acceptanceCriteria.join("; "),
  });

  const withdrawContender = async (reason: string) => {
    await db.$transaction(async (tx) => {
      await tx.actionItem.updateMany({
        where: {
          id: result.actionItemId,
          workspaceId: input.workspaceId,
          status: {
            in: [ActionStatus.PENDING_APPROVAL, ActionStatus.SUGGESTED],
          },
        },
        data: {
          status: ActionStatus.WITHDRAWN,
          executionStatus: "withdrawn",
          statusReason: reason,
        },
      });
      if (result.approvalTaskId) {
        await tx.approvalTask.updateMany({
          where: { id: result.approvalTaskId, status: ApprovalStatus.PENDING },
          data: {
            status: ApprovalStatus.WITHDRAWN,
            reviewedAt: new Date(),
            decisionReason: reason,
          },
        });
      }
      await writeAuditLog(
        {
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
          actor: input.actorName,
          actorType: ActorType.USER,
          actionType: "STAGE1_DECISION_PACKET_WITHDRAWN",
          targetType: "ActionItem",
          targetId: result.actionItemId,
          summary: reason,
          payload: { decisionRecordId: decision.id },
        },
        { client: tx },
      );
    });
  };

  try {
    await db.$transaction(async (tx) => {
      await tx.decisionWorkPacketClaim.create({
        data: {
          workspaceId: input.workspaceId,
          decisionRecordId: decision.id,
          actionItemId: result.actionItemId,
          ownerCommandJson: jsonStringify(input.command),
        },
      });
      const advanced = await tx.decisionRecord.updateMany({
        where: {
          id: decision.id,
          workspaceId: input.workspaceId,
          status: "OWNER_CONFIRMED",
          ownerRef: input.actorUserId,
        },
        data: { status: "DISPATCHED" },
      });
      if (advanced.count !== 1) {
        throw new Stage1DecisionGateError(["decision_dispatch_claim_lost"]);
      }
      await writeAuditLog(
        {
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
          actor: input.actorName,
          actorType: ActorType.USER,
          actionType: "STAGE1_DECISION_WORK_PACKET_DISPATCHED",
          targetType: "DecisionRecord",
          targetId: decision.id,
          summary: input.english
            ? "Owner-confirmed decision dispatched as a governed work packet"
            : "一把手确认的决策已派发为治理 Work Packet",
          payload: {
            actionItemId: result.actionItemId,
            approvalTaskId: result.approvalTaskId,
            commandId: input.command.commandId,
          },
        },
        { client: tx },
      );
    });
  } catch (error) {
    const duplicate = isUniqueConstraintViolation(error);
    await withdrawContender(
      duplicate
        ? "Concurrent duplicate decision work packet; existing packet retained"
        : "Decision work packet claim failed; contender withdrawn",
    );
    if (!duplicate) throw error;
    const winner = await db.decisionWorkPacketClaim.findUnique({
      where: { decisionRecordId: decision.id },
    });
    if (!winner) throw error;
    return resolveExisting(winner.actionItemId);
  }
  return {
    actionItemId: result.actionItemId,
    approvalTaskId: result.approvalTaskId,
    created: true,
  };
}
