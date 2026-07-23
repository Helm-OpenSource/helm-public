import "server-only";

import {
  ActionStatus,
  ActorType,
  ApprovalStatus,
  ExecutionReceiptOutcome,
  ExecutionReceiptVerificationState,
  MemoryFactType,
  MemoryStatus,
  ObjectType,
  SourceType,
  type Prisma,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { assertWorkspaceInsightServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import {
  evaluateDecisionOutcome,
  validateDecisionObject,
  type DecisionOutcomeRecord,
} from "@/lib/agentos-decision-supervision/contract";
import {
  DECISION_ACTION_LEVELS,
  DECISION_CONFIDENCE_LEVELS,
  DECISION_RISK_LEVELS,
  DECISION_TYPES,
  OWNER_GATE_LEVELS,
  type DecisionEvaluation,
  type DecisionObject,
  type DecisionReceiptEvidence,
} from "@/lib/agentos-decision-supervision/types";
import { jsonStringify } from "@/lib/utils";

type DecisionRuntimeRecord = Prisma.DecisionRecordGetPayload<{
  include: {
    workPacketClaim: {
      include: {
        actionItem: {
          include: { approvalTask: true; executionReceipt: true };
        };
      };
    };
  };
}>;

export type EvaluateStage1DecisionRecordInput = {
  workspaceId: string;
  decisionRecordId: string;
  followedAiRecommendation: boolean | null;
  outcome: DecisionOutcomeRecord;
  actorName: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  english?: boolean;
};

export class Stage1DecisionEvaluationError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`Stage 1 decision evaluation denied: ${reasons.join(", ")}`);
    this.name = "Stage1DecisionEvaluationError";
    this.reasons = reasons;
  }
}

function parseStringArray(
  raw: string,
  field: string,
  reasons: string[],
): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (entry) => typeof entry === "string" && entry.trim().length > 0,
      )
    ) {
      reasons.push(`${field}_invalid`);
      return [];
    }
    return parsed;
  } catch {
    reasons.push(`${field}_invalid`);
    return [];
  }
}

function includesLiteral<T extends string>(
  values: readonly T[],
  candidate: string,
): candidate is T {
  return values.includes(candidate as T);
}

function reconstructDecisionObject(
  record: DecisionRuntimeRecord,
): DecisionObject {
  const reasons: string[] = [];
  const contextRefs = parseStringArray(
    record.contextRefs,
    "context_refs",
    reasons,
  );
  const knowledgeRefs = parseStringArray(
    record.knowledgeRefs,
    "knowledge_refs",
    reasons,
  );
  const evidenceRefs = parseStringArray(
    record.evidenceRefs,
    "evidence_refs",
    reasons,
  );
  const policyRefs = parseStringArray(
    record.policyRefs,
    "policy_refs",
    reasons,
  );
  const receiptRefs = parseStringArray(
    record.receiptRefs,
    "receipt_refs",
    reasons,
  );
  const alternatives = parseStringArray(
    record.alternatives,
    "alternatives",
    reasons,
  );

  if (!record.decisionKey.trim()) reasons.push("decision_key_invalid");
  if (!includesLiteral(DECISION_TYPES, record.decisionType)) {
    reasons.push("decision_type_invalid");
  }
  if (!includesLiteral(DECISION_CONFIDENCE_LEVELS, record.confidence)) {
    reasons.push("decision_confidence_invalid");
  }
  if (!includesLiteral(DECISION_RISK_LEVELS, record.riskLevel)) {
    reasons.push("decision_risk_level_invalid");
  }
  if (!includesLiteral(DECISION_ACTION_LEVELS, record.allowedActionLevel)) {
    reasons.push("decision_action_level_invalid");
  }
  if (!includesLiteral(OWNER_GATE_LEVELS, record.ownerGate)) {
    reasons.push("decision_owner_gate_invalid");
  }
  if (reasons.length > 0) {
    throw new Stage1DecisionEvaluationError([...new Set(reasons)]);
  }

  const decision: DecisionObject = {
    decisionId: record.decisionKey.trim(),
    tenantRef: `workspace:${record.workspaceId}`,
    decisionType: record.decisionType as DecisionObject["decisionType"],
    businessQuestion: record.businessQuestion,
    problemCategoryRef: record.problemCategoryRef,
    contextRefs,
    knowledgeRefs,
    evidenceRefs,
    policyRefs,
    receiptRefs,
    alternatives,
    recommendedOption: record.recommendedOption,
    confidence: record.confidence as DecisionObject["confidence"],
    riskLevel: record.riskLevel as DecisionObject["riskLevel"],
    allowedActionLevel:
      record.allowedActionLevel as DecisionObject["allowedActionLevel"],
    ownerGate: record.ownerGate as DecisionObject["ownerGate"],
    expiryOrReviewAt: record.validUntil?.toISOString() ?? null,
    rollbackPath: record.rollbackPath,
  };
  const validation = validateDecisionObject(decision);
  if (!validation.valid) {
    throw new Stage1DecisionEvaluationError([
      "persisted_decision_invalid",
      ...validation.reasons,
    ]);
  }
  return decision;
}

function mapExecutionReceipt(
  record: DecisionRuntimeRecord,
): DecisionReceiptEvidence {
  const claim = record.workPacketClaim;
  const action = claim?.actionItem;
  if (!action) {
    throw new Stage1DecisionEvaluationError(["work_packet_required"]);
  }
  const receipt = action.executionReceipt;
  if (!receipt) {
    throw new Stage1DecisionEvaluationError(["execution_receipt_required"]);
  }
  if (
    claim.workspaceId !== record.workspaceId ||
    action.workspaceId !== record.workspaceId ||
    receipt.workspaceId !== record.workspaceId
  ) {
    throw new Stage1DecisionEvaluationError([
      "work_packet_workspace_mismatch",
    ]);
  }

  const executionOutcomes: ExecutionReceiptOutcome[] = [
    ExecutionReceiptOutcome.SUCCESS,
    ExecutionReceiptOutcome.PARTIAL_SUCCESS,
    ExecutionReceiptOutcome.FAILURE,
  ];
  const closedWithoutExecution: ExecutionReceiptOutcome[] = [
    ExecutionReceiptOutcome.REJECTED,
    ExecutionReceiptOutcome.NOT_EXECUTED,
  ];
  if (action.requiresApproval) {
    const expectedApprovalStatus =
      receipt.outcome === ExecutionReceiptOutcome.REJECTED
        ? ApprovalStatus.REJECTED
        : ApprovalStatus.EXECUTED;
    if (action.approvalTask?.status !== expectedApprovalStatus) {
      throw new Stage1DecisionEvaluationError(["approval_state_mismatch"]);
    }
  }
  if (
    executionOutcomes.includes(receipt.outcome) &&
    action.status !== ActionStatus.EXECUTED
  ) {
    throw new Stage1DecisionEvaluationError([
      "receipt_action_state_mismatch",
    ]);
  }
  if (
    closedWithoutExecution.includes(receipt.outcome) &&
    action.status !== ActionStatus.BLOCKED &&
    action.status !== ActionStatus.REJECTED
  ) {
    throw new Stage1DecisionEvaluationError([
      "receipt_action_state_mismatch",
    ]);
  }

  const receiptRef = `execution-receipt:${receipt.id}`;
  if (receipt.outcome === ExecutionReceiptOutcome.REJECTED) {
    if (!receipt.rejectionReasonCode) {
      throw new Stage1DecisionEvaluationError(["rejection_reason_required"]);
    }
    return {
      receiptRef,
      outcome: "rejected",
      reasonCode: receipt.rejectionReasonCode.toLowerCase(),
    };
  }
  if (receipt.outcome === ExecutionReceiptOutcome.NOT_EXECUTED) {
    return {
      receiptRef,
      outcome: "blocked",
      reasonCode: "not_executed",
    };
  }
  if (
    receipt.verificationState !==
    ExecutionReceiptVerificationState.VERIFIED
  ) {
    throw new Stage1DecisionEvaluationError([
      "receipt_verification_required",
    ]);
  }
  if (!receipt.verifiedByUserId?.trim()) {
    throw new Stage1DecisionEvaluationError([
      "receipt_independent_verifier_required",
    ]);
  }
  if (
    receipt.executedByUserId &&
    receipt.executedByUserId === receipt.verifiedByUserId
  ) {
    throw new Stage1DecisionEvaluationError([
      "receipt_self_verification_detected",
    ]);
  }
  if (receipt.outcome === ExecutionReceiptOutcome.SUCCESS) {
    return { receiptRef, outcome: "verified_success", reasonCode: null };
  }
  if (receipt.outcome === ExecutionReceiptOutcome.PARTIAL_SUCCESS) {
    return {
      receiptRef,
      outcome: "verified_failure",
      reasonCode: "partial_success",
    };
  }
  return {
    receiptRef,
    outcome: "verified_failure",
    reasonCode:
      receipt.rejectionReasonCode?.toLowerCase() ?? "execution_failure",
  };
}

function buildEvaluation(
  record: DecisionRuntimeRecord,
  input: EvaluateStage1DecisionRecordInput,
): DecisionEvaluation {
  const decision = reconstructDecisionObject(record);
  const action = record.workPacketClaim?.actionItem;
  const receipt = mapExecutionReceipt(record);
  return evaluateDecisionOutcome(
    decision,
    {
      finalActionRef: action ? `action-item:${action.id}` : null,
      humanDecision: record.ownerConclusion,
      followedAiRecommendation: input.followedAiRecommendation,
    },
    [receipt],
    {
      outcomeRef: input.outcome.outcomeRef?.trim() ?? null,
      result: input.outcome.result,
    },
  );
}

function parsePersistedEvaluation(raw: string): DecisionEvaluation | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DecisionEvaluation>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.evaluationId !== "string" ||
      typeof parsed.decisionRef !== "string" ||
      !Array.isArray(parsed.receiptRefs) ||
      typeof parsed.learnable !== "boolean" ||
      typeof parsed.automationImpact !== "string"
    ) {
      return null;
    }
    return parsed as DecisionEvaluation;
  } catch {
    return null;
  }
}

function sameEvaluation(
  left: DecisionEvaluation,
  right: DecisionEvaluation,
): boolean {
  return jsonStringify(left) === jsonStringify(right);
}

function evaluationSourceId(record: DecisionRuntimeRecord): string {
  const preferred = `evaluation:${record.decisionKey.trim()}`;
  return preferred.length <= 191 ? preferred : `evaluation:${record.id}`;
}

function memoryTitle(
  evaluation: DecisionEvaluation,
  english: boolean,
): string {
  const title = english
    ? `Decision outcome candidate: ${evaluation.decisionRef}`
    : `决策结果候选事实：${evaluation.decisionRef}`;
  return title.length <= 191 ? title : `${title.slice(0, 188)}...`;
}

async function resolveCommittedEvaluation(
  tx: Prisma.TransactionClient,
  record: DecisionRuntimeRecord,
  expected: DecisionEvaluation,
) {
  if (record.status !== "EVALUATED" || !record.evaluationJson) {
    throw new Stage1DecisionEvaluationError([
      "decision_already_claimed_or_not_evaluable",
    ]);
  }
  const persisted = parsePersistedEvaluation(record.evaluationJson);
  if (!persisted) {
    throw new Stage1DecisionEvaluationError([
      "persisted_evaluation_invalid",
    ]);
  }
  if (!sameEvaluation(persisted, expected)) {
    throw new Stage1DecisionEvaluationError([
      "decision_evaluation_conflict",
    ]);
  }
  const action = record.workPacketClaim?.actionItem;
  if (!action) {
    throw new Stage1DecisionEvaluationError(["work_packet_required"]);
  }
  const memoryFact = await tx.memoryFact.findFirst({
    where: {
      workspaceId: record.workspaceId,
      objectType: ObjectType.ACTION_ITEM,
      objectId: action.id,
      factType: MemoryFactType.ACTION_PATTERN,
      sourceType: SourceType.SYSTEM_INFERENCE,
      sourceId: evaluationSourceId(record),
    },
  });
  if (!memoryFact) {
    throw new Stage1DecisionEvaluationError([
      "evaluation_memory_fact_missing",
    ]);
  }
  return { created: false as const, evaluation: persisted, memoryFact };
}

// Lock first, then reconstruct the decision and inspect its evaluation
// status. This keeps concurrent replays out of separate REPEATABLE READ
// snapshots where both callers could otherwise report themselves as the
// creator even though the persisted decision is singular.
async function lockDecisionRecord(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; decisionRecordId: string },
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM DecisionRecord
    WHERE id = ${input.decisionRecordId}
      AND workspaceId = ${input.workspaceId}
    FOR UPDATE`;
  if (rows.length !== 1) {
    throw new Stage1DecisionEvaluationError(["decision_not_found"]);
  }
}

export async function evaluateStage1DecisionRecord(
  input: EvaluateStage1DecisionRecordInput,
) {
  const reasons: string[] = [];
  if (!input.workspaceId.trim()) reasons.push("workspace_required");
  if (!input.decisionRecordId.trim()) reasons.push("decision_record_required");
  if (!input.actorName.trim()) reasons.push("actor_name_required");
  if (
    (input.actorType ?? ActorType.AI) === ActorType.USER &&
    !input.actorUserId?.trim()
  ) {
    reasons.push("actor_user_identity_required");
  }
  if (input.outcome.result === "unknown") {
    reasons.push("business_outcome_not_final");
  }
  if (!["success", "failure", "unknown"].includes(input.outcome.result)) {
    reasons.push("business_outcome_invalid");
  }
  if (!input.outcome.outcomeRef?.trim()) {
    reasons.push("business_outcome_ref_required");
  }
  if (reasons.length > 0) {
    throw new Stage1DecisionEvaluationError(reasons);
  }

  const actorType = input.actorType ?? ActorType.AI;
  await assertWorkspaceInsightServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType,
    english: input.english ?? false,
  });

  return runWithWriteConflictRetry(() =>
    db.$transaction(async (tx) => {
      await lockDecisionRecord(tx, {
        workspaceId: input.workspaceId,
        decisionRecordId: input.decisionRecordId,
      });
      const record = await tx.decisionRecord.findFirst({
        where: {
          id: input.decisionRecordId,
          workspaceId: input.workspaceId,
        },
        include: {
          workPacketClaim: {
            include: {
              actionItem: {
                include: { approvalTask: true, executionReceipt: true },
              },
            },
          },
        },
      });
      if (!record) {
        throw new Stage1DecisionEvaluationError(["decision_not_found"]);
      }
      const evaluation = buildEvaluation(record, input);
      if (record.status === "EVALUATED" || record.evaluationJson) {
        return resolveCommittedEvaluation(tx, record, evaluation);
      }
      if (record.status !== "DISPATCHED") {
        throw new Stage1DecisionEvaluationError([
          "decision_not_dispatched",
        ]);
      }
      const action = record.workPacketClaim?.actionItem;
      if (!action) {
        throw new Stage1DecisionEvaluationError(["work_packet_required"]);
      }
      const evaluatedAt = new Date();
      const sourceId = evaluationSourceId(record);
      const claimed = await tx.decisionRecord.updateMany({
        where: {
          id: record.id,
          workspaceId: input.workspaceId,
          status: "DISPATCHED",
          evaluationJson: null,
        },
        data: {
          status: "EVALUATED",
          evaluationJson: jsonStringify(evaluation),
          evaluatedAt,
        },
      });
      if (claimed.count !== 1) {
        throw new Stage1DecisionEvaluationError([
          "decision_evaluation_claim_lost",
        ]);
      }

      const memoryFact = await tx.memoryFact.create({
        data: {
          workspaceId: input.workspaceId,
          objectType: ObjectType.ACTION_ITEM,
          objectId: action.id,
          factType: MemoryFactType.ACTION_PATTERN,
          title: memoryTitle(evaluation, input.english ?? false),
          content: input.english
            ? "Observed decision-outcome evidence. It remains a review candidate and cannot promote automation by itself."
            : "已观察到决策结果证据。该事实仍是待复核候选，不能单独提升自动化等级。",
          normalizedValue: jsonStringify({
            evaluation,
            governancePosture: {
              status: "observed",
              ownerReviewRequired: true,
              automationPromotionAuthorized: false,
            },
          }),
          sourceType: SourceType.SYSTEM_INFERENCE,
          sourceId,
          confidence: 70,
          importance: 70,
          freshnessScore: 80,
          status: MemoryStatus.OBSERVED,
          confirmedByUser: false,
          createdBySystem: true,
        },
      });
      await writeAuditLog(
        {
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
          actor: input.actorName.trim(),
          actorType,
          actionType: "STAGE1_DECISION_EVALUATED",
          targetType: "DecisionRecord",
          targetId: record.id,
          summary: input.english
            ? "Decision outcome evaluated and recorded as an observed memory candidate"
            : "决策结果已评估并写入待复核的观察记忆",
          payload: {
            evaluationId: evaluation.evaluationId,
            actionItemId: action.id,
            receiptRefs: evaluation.receiptRefs,
            automationImpact: evaluation.automationImpact,
            memoryFactId: memoryFact.id,
            automationPromotionAuthorized: false,
          },
        },
        { client: tx },
      );
      return { created: true as const, evaluation, memoryFact };
    }),
  );
}
