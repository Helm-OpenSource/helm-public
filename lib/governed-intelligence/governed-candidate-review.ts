import { createHash } from "node:crypto";
import {
  ActionExecutionMode,
  ActionStatus,
  ActionType,
  ActorType,
  ApprovalStatus,
  ArtifactBundleStatus,
  ArtifactReviewStatus,
  NotificationType,
  RiskLevel,
  SourceType,
} from "@prisma/client";
import { z } from "zod";

import { getCurrentAuditTraceContext } from "@/lib/audit/trace-context";
import {
  assertWorkspaceGovernedActionReviewServiceAccess,
  assertWorkspaceGovernedCandidatePromotionServiceAccess,
} from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import {
  GOVERNED_CANDIDATE_ACTION_KIND,
  GOVERNED_CANDIDATE_ARTIFACT_TYPE,
  GOVERNED_CANDIDATE_REVIEW_POSTURE,
  governedCandidateActionMetadataSchema,
  governedCandidateOpenQuestionsSchema,
  governedCandidateSourceProvenanceSchema,
  governedJudgementArtifactSchema,
  type GovernedJudgementArtifact,
} from "@/lib/governed-intelligence/governed-candidate-artifact";
import { serializeCandidateCanonicalJson } from "@/lib/llm/candidate-canonical-json";
import { resolvePolicyDecision } from "@/lib/policies";
import { jsonStringify, safeParseJson } from "@/lib/utils";

export {
  GOVERNED_CANDIDATE_ACTION_KIND,
  GOVERNED_CANDIDATE_ARTIFACT_TYPE,
  GOVERNED_CANDIDATE_REVIEW_POSTURE,
};

const idSchema = z.string().trim().min(1).max(191);
const actorNameSchema = z.string().trim().min(1).max(191);
const reviewInputSchema = z
  .object({
    workspaceId: idSchema,
    reviewerId: idSchema,
    reviewerName: actorNameSchema,
    artifactBundleId: idSchema,
    decision: z.enum(["confirm", "reject"]),
    notes: z.string().trim().max(2_000).optional(),
  })
  .strict();
const promotionInputSchema = z
  .object({
    workspaceId: idSchema,
    actorUserId: idSchema,
    actorName: actorNameSchema,
    artifactBundleId: idSchema,
    title: z.string().trim().min(1).max(191),
    description: z.string().trim().max(4_000).optional(),
  })
  .strict();

export type GovernedCandidateReviewErrorCode =
  | "invalid_input"
  | "artifact_not_found"
  | "artifact_contract_invalid"
  | "review_state_conflict"
  | "promotion_requires_confirmation"
  | "promotion_policy_forbidden"
  | "promotion_policy_suggest_only"
  | "promotion_state_conflict";

export class GovernedCandidateReviewError extends Error {
  readonly code: GovernedCandidateReviewErrorCode;

  constructor(code: GovernedCandidateReviewErrorCode) {
    super(`governed_candidate_review:${code}`);
    this.name = "GovernedCandidateReviewError";
    this.code = code;
  }
}

class ReviewClaimLostError extends Error {}
class PromotionClaimLostError extends Error {}

type CandidateBundleRow = {
  id: string;
  workspaceId: string;
  artifactType: string;
  title: string;
  status: ArtifactBundleStatus;
  systemOfRecordWrite: boolean;
  artifactsJson: string;
  evidenceRefs: string | null;
  sourceProvenance: string | null;
  confidence: number | null;
  openQuestions: string | null;
  reviewPosture: string | null;
  reviewedAt: Date | null;
  confirmedAt: Date | null;
  consumedAt: Date | null;
  createdAt: Date;
  artifactReview: {
    id: string;
    workspaceId: string;
    status: ArtifactReviewStatus;
    reviewedByUserId: string | null;
    reviewNotes: string | null;
    decisionSummary: string | null;
    reviewedAt: Date | null;
  } | null;
};

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

function parseJsonUnknown(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function parsePersistedCandidateBundle(row: CandidateBundleRow): {
  artifact: GovernedJudgementArtifact;
  verifiedEvidenceRefs: string[];
} {
  if (
    row.artifactType !== GOVERNED_CANDIDATE_ARTIFACT_TYPE ||
    row.reviewPosture !== GOVERNED_CANDIDATE_REVIEW_POSTURE ||
    row.systemOfRecordWrite ||
    !row.artifactReview ||
    row.artifactReview.workspaceId !== row.workspaceId
  ) {
    throw new GovernedCandidateReviewError("artifact_contract_invalid");
  }

  const artifact = governedJudgementArtifactSchema.safeParse(
    parseJsonUnknown(row.artifactsJson),
  );
  const evidence = z.array(z.string().trim().min(1).max(512)).max(100).safeParse(
    parseJsonUnknown(row.evidenceRefs),
  );
  const provenance = governedCandidateSourceProvenanceSchema.safeParse(
    parseJsonUnknown(row.sourceProvenance),
  );
  const openQuestions = governedCandidateOpenQuestionsSchema.safeParse(
    parseJsonUnknown(row.openQuestions),
  );
  if (
    !artifact.success ||
    !evidence.success ||
    !provenance.success ||
    !openQuestions.success
  ) {
    throw new GovernedCandidateReviewError("artifact_contract_invalid");
  }

  const evidenceSet = new Set(evidence.data);
  const usedEvidenceRefs = [
    ...artifact.data.proposal.evidenceRefs,
    ...artifact.data.roleOutputs.flatMap(({ evidenceRefs }) => evidenceRefs),
  ];
  if (
    row.confidence !== artifact.data.proposal.confidence ||
    evidenceSet.size !== evidence.data.length ||
    usedEvidenceRefs.some((ref) => !evidenceSet.has(ref)) ||
    provenance.data.sourceCandidateRef !== artifact.data.sourceCandidateRef ||
    provenance.data.sourceCandidateContentHash !==
      artifact.data.sourceCandidateContentHash ||
    provenance.data.trajectoryReceiptRef !== artifact.data.trajectoryReceiptRef ||
    provenance.data.candidateContentHash !== artifact.data.contentHash ||
    serializeCandidateCanonicalJson(openQuestions.data) !==
      serializeCandidateCanonicalJson({
        missingEvidence: artifact.data.proposal.missingEvidence,
        counterEvidenceNeeded: artifact.data.proposal.counterEvidenceNeeded,
      })
  ) {
    throw new GovernedCandidateReviewError("artifact_contract_invalid");
  }

  return {
    artifact: artifact.data,
    verifiedEvidenceRefs: evidence.data,
  };
}

async function findCandidateBundle(
  tx: TransactionClient | typeof db,
  workspaceId: string,
  artifactBundleId: string,
): Promise<CandidateBundleRow | null> {
  return tx.artifactBundle.findFirst({
    where: {
      id: artifactBundleId,
      workspaceId,
      artifactType: GOVERNED_CANDIDATE_ARTIFACT_TYPE,
      reviewPosture: GOVERNED_CANDIDATE_REVIEW_POSTURE,
      systemOfRecordWrite: false,
    },
    include: { artifactReview: true },
  }) as Promise<CandidateBundleRow | null>;
}

function reviewOutcome(
  row: CandidateBundleRow,
  decision: "confirm" | "reject",
) {
  const expectedReviewStatus =
    decision === "confirm"
      ? ArtifactReviewStatus.CONFIRMED
      : ArtifactReviewStatus.REJECTED;
  const bundleMatches =
    decision === "confirm"
      ? row.status === ArtifactBundleStatus.CONFIRMED ||
        row.status === ArtifactBundleStatus.CONSUMED
      : row.status === ArtifactBundleStatus.REJECTED;
  if (row.artifactReview?.status !== expectedReviewStatus || !bundleMatches) {
    throw new GovernedCandidateReviewError("review_state_conflict");
  }
  return {
    artifactBundleId: row.id,
    artifactReviewId: row.artifactReview.id,
    reviewStatus: expectedReviewStatus,
    reused: true as const,
  };
}

export async function reviewGovernedJudgementCandidate(input: unknown) {
  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new GovernedCandidateReviewError("invalid_input");
  }
  await assertWorkspaceGovernedActionReviewServiceAccess({
    workspaceId: parsed.data.workspaceId,
    userId: parsed.data.reviewerId,
    actorType: ActorType.USER,
    english: false,
  });

  const reviewedAt = new Date();
  try {
    return await db.$transaction(async (tx) => {
      const row = await findCandidateBundle(
        tx,
        parsed.data.workspaceId,
        parsed.data.artifactBundleId,
      );
      if (!row) {
        throw new GovernedCandidateReviewError("artifact_not_found");
      }
      parsePersistedCandidateBundle(row);
      if (row.artifactReview?.status !== ArtifactReviewStatus.PENDING) {
        return reviewOutcome(row, parsed.data.decision);
      }
      if (row.status !== ArtifactBundleStatus.DRAFT) {
        throw new GovernedCandidateReviewError("review_state_conflict");
      }

      const reviewStatus =
        parsed.data.decision === "confirm"
          ? ArtifactReviewStatus.CONFIRMED
          : ArtifactReviewStatus.REJECTED;
      const bundleStatus =
        parsed.data.decision === "confirm"
          ? ArtifactBundleStatus.CONFIRMED
          : ArtifactBundleStatus.REJECTED;
      const claimedReview = await tx.artifactReview.updateMany({
        where: {
          id: row.artifactReview.id,
          workspaceId: parsed.data.workspaceId,
          status: ArtifactReviewStatus.PENDING,
        },
        data: {
          status: reviewStatus,
          reviewedByUserId: parsed.data.reviewerId,
          reviewNotes: parsed.data.notes ?? null,
          decisionSummary:
            parsed.data.decision === "confirm"
              ? "Confirmed as a review-first governed judgement candidate"
              : "Rejected by human review",
          reviewedAt,
        },
      });
      if (claimedReview.count !== 1) throw new ReviewClaimLostError();

      const claimedBundle = await tx.artifactBundle.updateMany({
        where: {
          id: row.id,
          workspaceId: parsed.data.workspaceId,
          status: ArtifactBundleStatus.DRAFT,
        },
        data: {
          status: bundleStatus,
          reviewedAt,
          confirmedAt:
            parsed.data.decision === "confirm" ? reviewedAt : undefined,
        },
      });
      if (claimedBundle.count !== 1) throw new ReviewClaimLostError();

      const trace = getCurrentAuditTraceContext();
      await tx.auditLog.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          userId: parsed.data.reviewerId,
          actor: parsed.data.reviewerName,
          actorType: ActorType.USER,
          actionType:
            parsed.data.decision === "confirm"
              ? "GOVERNED_INTELLIGENCE_CANDIDATE_CONFIRMED"
              : "GOVERNED_INTELLIGENCE_CANDIDATE_REJECTED",
          targetType: "ArtifactBundle",
          targetId: row.id,
          summary:
            parsed.data.decision === "confirm"
              ? "A human confirmed a governed judgement candidate for optional task promotion."
              : "A human rejected a governed judgement candidate.",
          payload: jsonStringify({
            artifactReviewId: row.artifactReview.id,
            decision: parsed.data.decision,
          }),
          sourcePage: "/approvals",
          traceId: trace?.traceId,
          requestId: trace?.requestId,
          parentEventId: trace?.parentEventId ?? undefined,
        },
      });
      return {
        artifactBundleId: row.id,
        artifactReviewId: row.artifactReview.id,
        reviewStatus,
        reused: false as const,
      };
    });
  } catch (error) {
    if (!(error instanceof ReviewClaimLostError)) throw error;
    const row = await findCandidateBundle(
      db,
      parsed.data.workspaceId,
      parsed.data.artifactBundleId,
    );
    if (!row) throw new GovernedCandidateReviewError("artifact_not_found");
    parsePersistedCandidateBundle(row);
    return reviewOutcome(row, parsed.data.decision);
  }
}

function promotionSourceId(artifactBundleId: string) {
  return `governed-candidate-artifact:${artifactBundleId}`;
}

async function findExistingPromotion(
  tx: TransactionClient | typeof db,
  workspaceId: string,
  artifactBundleId: string,
) {
  const action = await tx.actionItem.findFirst({
    where: {
      workspaceId,
      actionType: ActionType.CREATE_TASK,
      sourceType: SourceType.SYSTEM_INFERENCE,
      sourceId: promotionSourceId(artifactBundleId),
    },
    include: { approvalTask: true },
  });
  if (!action) return null;
  const metadata = governedCandidateActionMetadataSchema.safeParse(
    safeParseJson<unknown>(action.metadata, null),
  );
  if (
    !metadata.success ||
    metadata.data.sourceArtifactBundleId !== artifactBundleId ||
    action.executionMode !== ActionExecutionMode.REQUIRES_APPROVAL ||
    !action.requiresApproval ||
    !action.approvalTask ||
    action.approvalTask.autoExecute
  ) {
    throw new GovernedCandidateReviewError("promotion_state_conflict");
  }
  return {
    artifactBundleId,
    actionItemId: action.id,
    approvalTaskId: action.approvalTask.id,
    reused: true as const,
  };
}

function evidenceRefsHash(evidenceRefs: string[]) {
  return `sha256:${createHash("sha256")
    .update(serializeCandidateCanonicalJson(evidenceRefs), "utf8")
    .digest("hex")}`;
}

export async function promoteGovernedJudgementCandidateToTask(input: unknown) {
  const parsed = promotionInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new GovernedCandidateReviewError("invalid_input");
  }
  await assertWorkspaceGovernedCandidatePromotionServiceAccess({
    workspaceId: parsed.data.workspaceId,
    userId: parsed.data.actorUserId,
    actorType: ActorType.USER,
    english: false,
  });

  try {
    return await db.$transaction(async (tx) => {
      const row = await findCandidateBundle(
        tx,
        parsed.data.workspaceId,
        parsed.data.artifactBundleId,
      );
      if (!row) {
        throw new GovernedCandidateReviewError("artifact_not_found");
      }
      const persisted = parsePersistedCandidateBundle(row);
      if (row.status === ArtifactBundleStatus.CONSUMED) {
        const existing = await findExistingPromotion(
          tx,
          parsed.data.workspaceId,
          row.id,
        );
        if (!existing) {
          throw new GovernedCandidateReviewError("promotion_state_conflict");
        }
        return existing;
      }
      if (
        row.status !== ArtifactBundleStatus.CONFIRMED ||
        row.artifactReview?.status !== ArtifactReviewStatus.CONFIRMED
      ) {
        throw new GovernedCandidateReviewError(
          "promotion_requires_confirmation",
        );
      }

      const policy = await tx.policyRule.findFirst({
        where: {
          workspaceId: parsed.data.workspaceId,
          actionType: ActionType.CREATE_TASK,
        },
      });
      const policyDecision = resolvePolicyDecision({
        actionType: ActionType.CREATE_TASK,
        riskLevel: RiskLevel.MEDIUM,
        policy,
      });
      if (policyDecision.mode === ActionExecutionMode.FORBIDDEN) {
        throw new GovernedCandidateReviewError("promotion_policy_forbidden");
      }
      if (policyDecision.mode === ActionExecutionMode.SUGGEST_ONLY) {
        throw new GovernedCandidateReviewError("promotion_policy_suggest_only");
      }

      const consumedAt = new Date();
      const claimed = await tx.artifactBundle.updateMany({
        where: {
          id: row.id,
          workspaceId: parsed.data.workspaceId,
          status: ArtifactBundleStatus.CONFIRMED,
        },
        data: {
          status: ArtifactBundleStatus.CONSUMED,
          consumedAt,
        },
      });
      if (claimed.count !== 1) throw new PromotionClaimLostError();

      const metadata = governedCandidateActionMetadataSchema.parse({
        kind: GOVERNED_CANDIDATE_ACTION_KIND,
        version: 1,
        sourceArtifactBundleId: row.id,
        sourceArtifactReviewId: row.artifactReview.id,
        candidateId: persisted.artifact.candidateId,
        candidateContentHash: persisted.artifact.contentHash,
        sourceCandidateRef: persisted.artifact.sourceCandidateRef,
        evidenceRefCount: persisted.verifiedEvidenceRefs.length,
        evidenceRefsHash: evidenceRefsHash(persisted.verifiedEvidenceRefs),
        boundary: "human_promoted_review_first",
        externalEffectAllowed: false,
      });
      const policySnapshot = {
        policyId: policy?.id ?? null,
        policyName: policyDecision.appliedPolicyName,
        configuredMode: policyDecision.appliedPolicyMode,
        configuredRiskThreshold: policyDecision.appliedRiskThreshold,
        resolvedMode: policyDecision.mode,
        effectiveMode: ActionExecutionMode.REQUIRES_APPROVAL,
        ceilingApplied:
          policyDecision.mode === ActionExecutionMode.AUTO_WITHIN_THRESHOLD,
        resolvedBy: policyDecision.resolvedBy,
        reason: policyDecision.reason,
      };
      const action = await tx.actionItem.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          ownerId: parsed.data.actorUserId,
          actionType: ActionType.CREATE_TASK,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          aiReason:
            "A human promoted a confirmed governed judgement candidate into the internal task approval chain.",
          draftContent: parsed.data.description ?? parsed.data.title,
          metadata: jsonStringify(metadata),
          sourceType: SourceType.SYSTEM_INFERENCE,
          sourceId: promotionSourceId(row.id),
          riskLevel: RiskLevel.MEDIUM,
          executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
          requiresApproval: true,
          status: ActionStatus.PENDING_APPROVAL,
          executionStatus: "governed_candidate_promoted_pending_approval",
          statusReason:
            "Human promotion is bounded to a pending internal CREATE_TASK approval.",
          policyName: policyDecision.appliedPolicyName ?? policy?.name ?? null,
          policySnapshot: jsonStringify(policySnapshot),
          createdByUserId: parsed.data.actorUserId,
          contentAuthorship: ActorType.AI,
        },
      });
      const approvalTask = await tx.approvalTask.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          actionItemId: action.id,
          status: ApprovalStatus.PENDING,
          isHighRisk: false,
          autoExecute: false,
          contextSnapshot: parsed.data.description ?? parsed.data.title,
          reasoning:
            "Review the human-promoted internal task against its confirmed candidate evidence before execution.",
          editableContent: parsed.data.description ?? parsed.data.title,
          resultPreview:
            "Approval may execute only the internal CREATE_TASK action; it grants no send, connector, writeback, import, feedback, or memory-promotion authority.",
          decisionReason:
            "The governed candidate was human-confirmed and separately promoted under a required-approval ceiling.",
          channel: "Governed intelligence internal task",
        },
      });
      await tx.notification.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          type: NotificationType.APPROVAL,
          title: `Pending review: ${parsed.data.title}`,
          body:
            "A confirmed governed candidate was promoted to an internal task and still requires approval.",
          url: `/approvals?approvalId=${approvalTask.id}`,
          dedupeKey: `governed-candidate-promotion:${row.id}`,
        },
      });
      const trace = getCurrentAuditTraceContext();
      await tx.auditLog.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          userId: parsed.data.actorUserId,
          actor: parsed.data.actorName,
          actorType: ActorType.USER,
          actionType: "GOVERNED_INTELLIGENCE_CANDIDATE_PROMOTED_TO_TASK",
          targetType: "ActionItem",
          targetId: action.id,
          summary:
            "A human promoted a confirmed candidate to a pending internal CREATE_TASK approval.",
          payload: jsonStringify({
            artifactBundleId: row.id,
            artifactReviewId: row.artifactReview.id,
            candidateId: persisted.artifact.candidateId,
            candidateContentHash: persisted.artifact.contentHash,
            approvalTaskId: approvalTask.id,
            effectiveMode: ActionExecutionMode.REQUIRES_APPROVAL,
          }),
          sourcePage: "/approvals",
          traceId: trace?.traceId,
          requestId: trace?.requestId,
          parentEventId: trace?.parentEventId ?? undefined,
        },
      });
      return {
        artifactBundleId: row.id,
        actionItemId: action.id,
        approvalTaskId: approvalTask.id,
        reused: false as const,
      };
    });
  } catch (error) {
    if (!(error instanceof PromotionClaimLostError)) throw error;
    const existing = await findExistingPromotion(
      db,
      parsed.data.workspaceId,
      parsed.data.artifactBundleId,
    );
    if (!existing) {
      throw new GovernedCandidateReviewError("promotion_state_conflict");
    }
    return existing;
  }
}

export type GovernedCandidateReviewListItem = Readonly<{
  artifactBundleId: string;
  artifactReviewId: string | null;
  bundleStatus: ArtifactBundleStatus;
  reviewStatus: ArtifactReviewStatus | null;
  createdAt: string;
  contractStatus: "valid" | "invalid";
  canReview: boolean;
  canPromote: boolean;
  candidate: null | Readonly<{
    candidateId: string;
    objectType: string;
    objectId: string;
    confidence: number;
    reviewState: string;
    boundaryDecision: string;
    evidenceRefs: string[];
    missingEvidence: Array<{ gapId: string; missingSignalNote: string }>;
    counterEvidenceNeeded: string[];
    nextSafeActions: string[];
  }>;
  promotion: null | Readonly<{
    actionItemId: string;
    approvalTaskId: string;
    approvalStatus: ApprovalStatus;
  }>;
}>;

export async function listGovernedJudgementCandidateReviews(
  workspaceIdInput: string,
): Promise<GovernedCandidateReviewListItem[]> {
  const parsedWorkspaceId = idSchema.safeParse(workspaceIdInput);
  if (!parsedWorkspaceId.success) {
    throw new GovernedCandidateReviewError("invalid_input");
  }
  const rows = (await db.artifactBundle.findMany({
    where: {
      workspaceId: parsedWorkspaceId.data,
      artifactType: GOVERNED_CANDIDATE_ARTIFACT_TYPE,
      reviewPosture: GOVERNED_CANDIDATE_REVIEW_POSTURE,
      systemOfRecordWrite: false,
    },
    include: { artifactReview: true },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  })) as CandidateBundleRow[];
  const sourceIds = rows.map((row) => promotionSourceId(row.id));
  const promotions = sourceIds.length
    ? await db.actionItem.findMany({
        where: {
          workspaceId: parsedWorkspaceId.data,
          actionType: ActionType.CREATE_TASK,
          sourceType: SourceType.SYSTEM_INFERENCE,
          sourceId: { in: sourceIds },
        },
        include: { approvalTask: true },
      })
    : [];
  const promotionBySourceId = new Map(
    promotions
      .filter((action) => action.sourceId && action.approvalTask)
      .map((action) => [action.sourceId!, action]),
  );

  return rows.map((row) => {
    try {
      const persisted = parsePersistedCandidateBundle(row);
      const promotion = promotionBySourceId.get(promotionSourceId(row.id));
      return {
        artifactBundleId: row.id,
        artifactReviewId: row.artifactReview?.id ?? null,
        bundleStatus: row.status,
        reviewStatus: row.artifactReview?.status ?? null,
        createdAt: row.createdAt.toISOString(),
        contractStatus: "valid" as const,
        canReview:
          row.status === ArtifactBundleStatus.DRAFT &&
          row.artifactReview?.status === ArtifactReviewStatus.PENDING,
        canPromote:
          row.status === ArtifactBundleStatus.CONFIRMED &&
          row.artifactReview?.status === ArtifactReviewStatus.CONFIRMED &&
          !promotion,
        candidate: {
          candidateId: persisted.artifact.candidateId,
          objectType: persisted.artifact.proposal.objectRef.objectType,
          objectId: persisted.artifact.proposal.objectRef.objectId,
          confidence: persisted.artifact.proposal.confidence,
          reviewState: persisted.artifact.proposal.reviewState,
          boundaryDecision: persisted.artifact.boundaryDecision,
          evidenceRefs: persisted.verifiedEvidenceRefs,
          missingEvidence: persisted.artifact.proposal.missingEvidence,
          counterEvidenceNeeded:
            persisted.artifact.proposal.counterEvidenceNeeded,
          nextSafeActions: persisted.artifact.proposal.nextSafeActions,
        },
        promotion: promotion?.approvalTask
          ? {
              actionItemId: promotion.id,
              approvalTaskId: promotion.approvalTask.id,
              approvalStatus: promotion.approvalTask.status,
            }
          : null,
      };
    } catch {
      return {
        artifactBundleId: row.id,
        artifactReviewId: row.artifactReview?.id ?? null,
        bundleStatus: row.status,
        reviewStatus: row.artifactReview?.status ?? null,
        createdAt: row.createdAt.toISOString(),
        contractStatus: "invalid" as const,
        canReview: false,
        canPromote: false,
        candidate: null,
        promotion: null,
      };
    }
  });
}
