import "server-only";

import {
  ActionExecutionMode,
  ActionStatus,
  ActionType,
  ActorType,
  ApprovalStatus,
  ArtifactBundleStatus,
  ArtifactReviewStatus,
  NotificationType,
  Prisma,
  RiskLevel,
  SourceType,
} from "@prisma/client";

import { getCurrentAuditTraceContext } from "@/lib/audit/trace-context";
import {
  assertWorkspaceGovernedActionReviewServiceAccess,
  assertWorkspaceGovernedCandidatePromotionServiceAccess,
} from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import {
  MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE,
  MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE,
  validateMemberWorkSignalCandidateArtifact,
} from "@/lib/member-gateway/signal-candidate";
import type { MemberWorkSignalCandidateArtifact } from "@/lib/member-gateway/signal-candidate";
import { resolvePolicyDecision } from "@/lib/policies";
import { jsonStringify, safeParseJson } from "@/lib/utils";

// Review and stage-one (task-only) promotion for member work-signal
// candidates (spec §5.1, M2c Task 3, plan Architecture 8/10/11). Shapes
// mirror lib/governed-intelligence/governed-candidate-review.ts's
// review/promote/lister — EXCEPT its CAS transactions are baseline-
// grandfathered non-compliant (db.$transaction with no explicit
// Serializable isolation). Every transaction here is inline, Serializable,
// with lockWorkspace issued first on the tx client
// (lib/member-gateway/prompt-store.service.ts shape).
//
// Fact promotion (MemoryCandidate) is Architecture 6/ruling-6 stage two
// and is DELIBERATELY NOT implemented anywhere in this file — it needs a
// member-gateway session anchor that does not exist yet, and is a
// separate design.

type Tx = Prisma.TransactionClient;
type DbClient = Tx | typeof db;
type CandidateBundleRow = Prisma.ArtifactBundleGetPayload<{
  include: { artifactReview: true };
}>;

const REVIEWED_AUDIT_ACTION = "MEMBER_WORK_SIGNAL_CANDIDATE_REVIEWED" as const;
const PROMOTED_AUDIT_ACTION =
  "MEMBER_WORK_SIGNAL_CANDIDATE_PROMOTED_TO_TASK" as const;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

export type MemberSignalCandidateReviewErrorCode =
  | "invalid_input"
  | "candidate_not_found"
  | "candidate_artifact_corrupt"
  | "candidate_review_conflict"
  | "candidate_promotion_requires_confirmation"
  | "candidate_promotion_policy_forbidden"
  | "candidate_promotion_policy_suggest_only"
  | "candidate_promotion_state_conflict";

export class MemberSignalCandidateReviewError extends Error {
  readonly code: MemberSignalCandidateReviewErrorCode;

  constructor(code: MemberSignalCandidateReviewErrorCode) {
    super(`member_signal_candidate_review:${code}`);
    this.name = "MemberSignalCandidateReviewError";
    this.code = code;
  }
}

// Internal, module-private CAS-loss signal: caught only inside this file
// to fall back to an idempotent re-read, never surfaced to callers.
class MemberSignalCandidatePromotionClaimLostError extends Error {}

function nonEmpty(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new MemberSignalCandidateReviewError("invalid_input");
  return normalized;
}

async function lockWorkspace(tx: Tx, workspaceId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Workspace WHERE id = ${workspaceId} FOR UPDATE`;
  if (rows.length !== 1) {
    throw new MemberSignalCandidateReviewError("candidate_not_found");
  }
}

// Type-pinned finder: discrimination is artifactType + reviewPosture +
// systemOfRecordWrite:false (Architecture 1) — there is no kind column.
async function findMemberSignalCandidateBundle(
  client: DbClient,
  workspaceId: string,
  artifactBundleId: string,
): Promise<CandidateBundleRow | null> {
  return client.artifactBundle.findFirst({
    where: {
      id: artifactBundleId,
      workspaceId,
      artifactType: MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE,
      reviewPosture: MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE,
      systemOfRecordWrite: false,
    },
    include: { artifactReview: true },
  });
}

// Re-parses and re-validates the artifact on every read (module
// convention, spec §5.1 ruling 2: a corrupt or tampered row must never be
// trusted just because it was accepted once at materialization time). Any
// parse/shape failure — malformed JSON, missing fields, a failed
// invariant — collapses to the single candidate_artifact_corrupt code;
// callers never see raw JSON.parse/TypeError noise.
function parseCandidateArtifact(
  artifactsJson: string,
): MemberWorkSignalCandidateArtifact {
  try {
    const parsed = JSON.parse(artifactsJson) as MemberWorkSignalCandidateArtifact;
    const validation = validateMemberWorkSignalCandidateArtifact(parsed);
    if (!validation.valid) {
      throw new MemberSignalCandidateReviewError("candidate_artifact_corrupt");
    }
    return parsed;
  } catch (error) {
    if (error instanceof MemberSignalCandidateReviewError) throw error;
    throw new MemberSignalCandidateReviewError("candidate_artifact_corrupt");
  }
}

export type ReviewMemberWorkSignalCandidateInput = {
  workspaceId: string;
  reviewerId: string;
  reviewerName: string;
  artifactBundleId: string;
  decision: "confirm" | "reject";
  notes?: string;
};

export type ReviewMemberWorkSignalCandidateResult = {
  artifactBundleId: string;
  artifactReviewId: string;
  reviewStatus: ArtifactReviewStatus;
};

export async function reviewMemberWorkSignalCandidate(
  input: ReviewMemberWorkSignalCandidateInput,
): Promise<ReviewMemberWorkSignalCandidateResult> {
  const workspaceId = nonEmpty(input.workspaceId);
  const reviewerId = nonEmpty(input.reviewerId);
  const reviewerName = nonEmpty(input.reviewerName);
  const artifactBundleId = nonEmpty(input.artifactBundleId);
  const notes = input.notes?.trim() || null;

  await assertWorkspaceGovernedActionReviewServiceAccess({
    workspaceId,
    userId: reviewerId,
    actorType: ActorType.USER,
    english: false,
  });

  const bundle = await findMemberSignalCandidateBundle(
    db,
    workspaceId,
    artifactBundleId,
  );
  if (!bundle) {
    throw new MemberSignalCandidateReviewError("candidate_not_found");
  }
  // Corrupt/taint-missing artifacts are rejected before any state change —
  // review/promote never act on a row that fails re-validation.
  parseCandidateArtifact(bundle.artifactsJson);
  if (bundle.artifactReview?.status !== ArtifactReviewStatus.PENDING) {
    throw new MemberSignalCandidateReviewError("candidate_review_conflict");
  }
  const artifactReviewId = bundle.artifactReview.id;

  const reviewStatus =
    input.decision === "confirm"
      ? ArtifactReviewStatus.CONFIRMED
      : ArtifactReviewStatus.REJECTED;
  const bundleStatus =
    input.decision === "confirm"
      ? ArtifactBundleStatus.CONFIRMED
      : ArtifactBundleStatus.REJECTED;
  const reviewedAt = new Date();

  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, workspaceId);

        // CAS bundle DRAFT -> CONFIRMED|REJECTED.
        const claimedBundle = await tx.artifactBundle.updateMany({
          where: {
            id: artifactBundleId,
            workspaceId,
            status: ArtifactBundleStatus.DRAFT,
          },
          data: {
            status: bundleStatus,
            reviewedAt,
            confirmedAt:
              input.decision === "confirm" ? reviewedAt : undefined,
          },
        });
        if (claimedBundle.count !== 1) {
          throw new MemberSignalCandidateReviewError(
            "candidate_review_conflict",
          );
        }

        // CAS review PENDING -> CONFIRMED|REJECTED.
        const claimedReview = await tx.artifactReview.updateMany({
          where: {
            id: artifactReviewId,
            workspaceId,
            artifactBundleId,
            status: ArtifactReviewStatus.PENDING,
          },
          data: {
            status: reviewStatus,
            reviewedByUserId: reviewerId,
            reviewNotes: notes,
            decisionSummary:
              input.decision === "confirm"
                ? "Confirmed a member work-signal candidate for optional task promotion."
                : "Rejected a member work-signal candidate.",
            reviewedAt,
          },
        });
        if (claimedReview.count !== 1) {
          throw new MemberSignalCandidateReviewError(
            "candidate_review_conflict",
          );
        }

        const trace = getCurrentAuditTraceContext();
        await tx.auditLog.create({
          data: {
            workspaceId,
            userId: reviewerId,
            actor: reviewerName,
            actorType: ActorType.USER,
            actionType: REVIEWED_AUDIT_ACTION,
            targetType: "ArtifactBundle",
            targetId: artifactBundleId,
            summary:
              input.decision === "confirm"
                ? "A human confirmed a member work-signal candidate."
                : "A human rejected a member work-signal candidate.",
            payload: jsonStringify({
              artifactReviewId,
              decision: input.decision,
            }),
            sourcePage: "/approvals",
            traceId: trace?.traceId,
            requestId: trace?.requestId,
            parentEventId: trace?.parentEventId ?? undefined,
          },
        });

        return {
          artifactBundleId,
          artifactReviewId,
          reviewStatus,
        };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

function promotionSourceId(artifactBundleId: string): string {
  return `member-signal-candidate-artifact:${artifactBundleId}`;
}

type ExistingPromotion = Readonly<{
  artifactBundleId: string;
  actionItemId: string;
  approvalTaskId: string;
  reused: true;
}>;

// Promotion idempotency key: sourceType SYSTEM_INFERENCE + sourceId
// member-signal-candidate-artifact:<bundleId> (Architecture 11). No zod
// schema for ActionItem.metadata here (member-gateway stays zero-zod at
// the contract layer, and this metadata is a plain audit-display
// payload, not a re-validated contract) — consistency is a plain
// safeParseJson field check instead.
async function findExistingCandidatePromotion(
  client: DbClient,
  workspaceId: string,
  artifactBundleId: string,
): Promise<ExistingPromotion | null> {
  const action = await client.actionItem.findFirst({
    where: {
      workspaceId,
      actionType: ActionType.CREATE_TASK,
      sourceType: SourceType.SYSTEM_INFERENCE,
      sourceId: promotionSourceId(artifactBundleId),
    },
    include: { approvalTask: true },
  });
  if (!action) return null;
  const metadata = safeParseJson<{ sourceArtifactBundleId?: unknown } | null>(
    action.metadata,
    null,
  );
  if (
    !metadata ||
    metadata.sourceArtifactBundleId !== artifactBundleId ||
    action.executionMode !== ActionExecutionMode.REQUIRES_APPROVAL ||
    !action.requiresApproval ||
    !action.approvalTask ||
    action.approvalTask.autoExecute
  ) {
    throw new MemberSignalCandidateReviewError(
      "candidate_promotion_state_conflict",
    );
  }
  return {
    artifactBundleId,
    actionItemId: action.id,
    approvalTaskId: action.approvalTask.id,
    reused: true,
  };
}

export type PromoteMemberWorkSignalCandidateToTaskInput = {
  workspaceId: string;
  actorUserId: string;
  actorName: string;
  artifactBundleId: string;
  title: string;
  description?: string;
};

export type PromoteMemberWorkSignalCandidateToTaskResult = {
  artifactBundleId: string;
  actionItemId: string;
  approvalTaskId: string;
  reused: boolean;
};

export async function promoteMemberWorkSignalCandidateToTask(
  input: PromoteMemberWorkSignalCandidateToTaskInput,
): Promise<PromoteMemberWorkSignalCandidateToTaskResult> {
  const workspaceId = nonEmpty(input.workspaceId);
  const actorUserId = nonEmpty(input.actorUserId);
  const actorName = nonEmpty(input.actorName);
  const artifactBundleId = nonEmpty(input.artifactBundleId);
  const title = nonEmpty(input.title);
  const description = input.description?.trim() || null;

  await assertWorkspaceGovernedCandidatePromotionServiceAccess({
    workspaceId,
    userId: actorUserId,
    actorType: ActorType.USER,
    english: false,
  });

  const promoteOnce = () =>
    db.$transaction(async (tx) => {
      await lockWorkspace(tx, workspaceId);

      const bundle = await findMemberSignalCandidateBundle(
        tx,
        workspaceId,
        artifactBundleId,
      );
      if (!bundle) {
        throw new MemberSignalCandidateReviewError("candidate_not_found");
      }

      if (bundle.status === ArtifactBundleStatus.CONSUMED) {
        const existing = await findExistingCandidatePromotion(
          tx,
          workspaceId,
          bundle.id,
        );
        if (!existing) {
          throw new MemberSignalCandidateReviewError(
            "candidate_promotion_state_conflict",
          );
        }
        return existing;
      }
      if (
        bundle.status !== ArtifactBundleStatus.CONFIRMED ||
        bundle.artifactReview?.status !== ArtifactReviewStatus.CONFIRMED ||
        !bundle.artifactReview.reviewedByUserId
      ) {
        throw new MemberSignalCandidateReviewError(
          "candidate_promotion_requires_confirmation",
        );
      }
      const artifactReviewId = bundle.artifactReview.id;
      // Corrupt/tampered rows must never reach task promotion.
      const artifact = parseCandidateArtifact(bundle.artifactsJson);

      const policy = await tx.policyRule.findFirst({
        where: { workspaceId, actionType: ActionType.CREATE_TASK },
      });
      const policyDecision = resolvePolicyDecision({
        actionType: ActionType.CREATE_TASK,
        riskLevel: RiskLevel.MEDIUM,
        policy,
      });
      if (policyDecision.mode === ActionExecutionMode.FORBIDDEN) {
        throw new MemberSignalCandidateReviewError(
          "candidate_promotion_policy_forbidden",
        );
      }
      if (policyDecision.mode === ActionExecutionMode.SUGGEST_ONLY) {
        throw new MemberSignalCandidateReviewError(
          "candidate_promotion_policy_suggest_only",
        );
      }

      // CAS bundle CONFIRMED -> CONSUMED.
      const consumedAt = new Date();
      const claimedBundle = await tx.artifactBundle.updateMany({
        where: {
          id: bundle.id,
          workspaceId,
          status: ArtifactBundleStatus.CONFIRMED,
        },
        data: { status: ArtifactBundleStatus.CONSUMED, consumedAt },
      });
      if (claimedBundle.count !== 1) {
        throw new MemberSignalCandidatePromotionClaimLostError();
      }

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
      // contentAuthorship: USER (not AI, unlike the governed-candidate
      // precedent) — the candidate body is member-authored content that
      // passed through de-linked projection, never model-generated.
      // DEVIATION NOTE: the plan text says "ActorType.HUMAN", but the
      // schema's ActorType enum is only USER | SYSTEM | AI — its own
      // comment on ActionItem.contentAuthorship says human-authored
      // content flows must declare USER explicitly (AI is the default).
      // USER is therefore the correct literal for "human-authored, not
      // AI-authored" here.
      //
      // aiReason states the member-signal provenance and its taint
      // (Architecture 11), but MUST stay a fixed, short string: the
      // ActionItem.aiReason column has no @db.LongText/@db.Text
      // annotation (plain Prisma String -> MySQL VARCHAR(191)), and an
      // interpolated signalReceiptRef/kind blew past that limit under
      // the isolated-MySQL suite (measured, not guessed). The variable-
      // length provenance (kind, signalReceiptRef) lives in `metadata`
      // and the promotion AuditLog payload instead, both LongText.
      const action = await tx.actionItem.create({
        data: {
          workspaceId,
          ownerId: actorUserId,
          actionType: ActionType.CREATE_TASK,
          title,
          description,
          aiReason:
            'A human promoted a confirmed member work-signal candidate into the internal task approval chain; the candidate carries taint="untrusted" and is member-authored, not AI-authored.',
          draftContent: description ?? title,
          metadata: jsonStringify({
            kind: "member_signal_candidate_promotion",
            version: 1,
            sourceArtifactBundleId: bundle.id,
            sourceArtifactReviewId: artifactReviewId,
            signalReceiptRef: artifact.signalReceiptRef,
            taint: artifact.taint,
          }),
          sourceType: SourceType.SYSTEM_INFERENCE,
          sourceId: promotionSourceId(bundle.id),
          riskLevel: RiskLevel.MEDIUM,
          executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
          requiresApproval: true,
          status: ActionStatus.PENDING_APPROVAL,
          executionStatus: "member_signal_candidate_promoted_pending_approval",
          statusReason:
            "Human promotion is bounded to a pending internal CREATE_TASK approval.",
          policyName: policyDecision.appliedPolicyName ?? policy?.name ?? null,
          policySnapshot: jsonStringify(policySnapshot),
          createdByUserId: actorUserId,
          contentAuthorship: ActorType.USER,
        },
      });
      const approvalTask = await tx.approvalTask.create({
        data: {
          workspaceId,
          actionItemId: action.id,
          status: ApprovalStatus.PENDING,
          isHighRisk: false,
          autoExecute: false,
          contextSnapshot: description ?? title,
          reasoning:
            "Review the member-signal-promoted internal task against its confirmed candidate evidence before execution.",
          editableContent: description ?? title,
          resultPreview:
            "Approval may execute only the internal CREATE_TASK action; it grants no send, connector, writeback, import, feedback, or memory-promotion authority.",
          decisionReason:
            "The member work-signal candidate was human-confirmed and separately promoted under a required-approval ceiling.",
          channel: "Member signal candidate internal task",
        },
      });
      await tx.notification.create({
        data: {
          workspaceId,
          type: NotificationType.APPROVAL,
          title: `Pending review: ${title}`,
          body: "A confirmed member work-signal candidate was promoted to an internal task and still requires approval.",
          url: `/approvals?approvalId=${approvalTask.id}`,
          dedupeKey: `member-signal-candidate-promotion:${bundle.id}`,
        },
      });
      const trace = getCurrentAuditTraceContext();
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId: actorUserId,
          actor: actorName,
          actorType: ActorType.USER,
          actionType: PROMOTED_AUDIT_ACTION,
          targetType: "ActionItem",
          targetId: action.id,
          summary:
            "A human promoted a confirmed member work-signal candidate to a pending internal CREATE_TASK approval.",
          payload: jsonStringify({
            artifactBundleId: bundle.id,
            artifactReviewId,
            signalReceiptRef: artifact.signalReceiptRef,
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
        artifactBundleId: bundle.id,
        actionItemId: action.id,
        approvalTaskId: approvalTask.id,
        reused: false as const,
      };
    }, TRANSACTION_OPTIONS);

  try {
    return await runWithWriteConflictRetry(promoteOnce, WRITE_RETRY_OPTIONS);
  } catch (error) {
    if (!(error instanceof MemberSignalCandidatePromotionClaimLostError)) {
      throw error;
    }
    const existing = await findExistingCandidatePromotion(
      db,
      workspaceId,
      artifactBundleId,
    );
    if (!existing) {
      throw new MemberSignalCandidateReviewError(
        "candidate_promotion_state_conflict",
      );
    }
    return existing;
  }
}

// Read model item for the M2c-b /approvals lister (spec §5.1 ruling 2: the
// taint field must render first-class, so it is present here even though
// this slice does not wire the UI). NOTE: fact promotion (ruling 6 stage
// two) has no list surface here — this lister only ever reflects the
// stage-one task-promotion state machine.
export type MemberSignalCandidateReviewListItem = Readonly<{
  artifactBundleId: string;
  reviewStatus: ArtifactReviewStatus | null;
  bundleStatus: ArtifactBundleStatus;
  kind: string | null;
  taint: string | null;
  projectedSummary: string | null;
  memberRef: string | null;
  submittedAt: string | null;
  createdAt: string;
  // A corrupt/tampered row is marked, not thrown away — one bad row must
  // never blank a reviewer's whole queue (governed-candidate-review.ts
  // lister precedent, contractStatus:"invalid" branch).
  corrupt: boolean;
}>;

export async function listMemberWorkSignalCandidateReviews(
  workspaceIdInput: string,
): Promise<MemberSignalCandidateReviewListItem[]> {
  const workspaceId = nonEmpty(workspaceIdInput);
  const rows = await db.artifactBundle.findMany({
    where: {
      workspaceId,
      artifactType: MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE,
      reviewPosture: MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE,
      systemOfRecordWrite: false,
    },
    include: { artifactReview: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return rows.map((row) => {
    try {
      const artifact = parseCandidateArtifact(row.artifactsJson);
      return {
        artifactBundleId: row.id,
        reviewStatus: row.artifactReview?.status ?? null,
        bundleStatus: row.status,
        kind: artifact.kind,
        taint: artifact.taint,
        projectedSummary: artifact.projectedSummary,
        memberRef: artifact.memberRef,
        submittedAt: artifact.submittedAt,
        createdAt: row.createdAt.toISOString(),
        corrupt: false,
      };
    } catch {
      return {
        artifactBundleId: row.id,
        reviewStatus: row.artifactReview?.status ?? null,
        bundleStatus: row.status,
        kind: null,
        taint: null,
        projectedSummary: null,
        memberRef: null,
        submittedAt: null,
        createdAt: row.createdAt.toISOString(),
        corrupt: true,
      };
    }
  });
}

// Explicitly NOT implemented in this file (spec §5.1 ruling 6, stage one):
// there is no projectConfirmedMemberSignalCandidateToMemoryCandidate here.
// Fact promotion requires a member-gateway session anchor that does not
// exist yet and is a separate design; stage one stops at ActionItem +
// ApprovalTask.
