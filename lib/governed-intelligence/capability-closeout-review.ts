import { createHash } from "node:crypto";
import {
  ActorType,
  ArtifactBundleStatus,
  ArtifactReviewStatus,
  HumanActionExecutionAckStatus,
  HumanActionExecutionStatus,
  HumanActionExecutionType,
  RiskLevel,
  RuntimeMemoryCandidateStatus,
} from "@prisma/client";
import { z } from "zod";

import { getCurrentAuditTraceContext } from "@/lib/audit/trace-context";
import {
  assertWorkspaceGovernedActionManagementServiceAccess,
  assertWorkspaceGovernedActionReviewServiceAccess,
  assertWorkspaceMemoryServiceAccess,
} from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import {
  buildGovernedMemoryCandidateProjectionReceipt,
  governedConnectorScopeCandidateSchema,
  governedExternalSendDraftCandidateSchema,
  type GovernedExternalSendDraftCandidate,
} from "@/lib/governed-intelligence/capability-closeout-contracts";
import {
  GOVERNED_CONNECTOR_SCOPE_ARTIFACT_TYPE,
  GOVERNED_CONNECTOR_SCOPE_REVIEW_POSTURE,
  GOVERNED_EXTERNAL_SEND_ARTIFACT_TYPE,
  GOVERNED_EXTERNAL_SEND_REVIEW_POSTURE,
} from "@/lib/governed-intelligence/capability-closeout-materializer";
import {
  GOVERNED_CANDIDATE_ARTIFACT_TYPE,
  GOVERNED_CANDIDATE_REVIEW_POSTURE,
  governedCandidateSourceProvenanceSchema,
  governedJudgementArtifactSchema,
} from "@/lib/governed-intelligence/governed-candidate-artifact";
import { serializeCandidateCanonicalJson } from "@/lib/llm/candidate-canonical-json";
import { jsonStringify } from "@/lib/utils";

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
const humanHandoffInputSchema = z
  .object({
    workspaceId: idSchema,
    actorUserId: idSchema,
    actorName: actorNameSchema,
    artifactBundleId: idSchema,
  })
  .strict();
const memoryProjectionInputSchema = humanHandoffInputSchema
  .omit({ artifactBundleId: true })
  .extend({
    artifactBundleId: idSchema,
    runtimeSessionId: idSchema,
  })
  .strict();

export type GovernedCapabilityCloseoutReviewErrorCode =
  | "invalid_input"
  | "artifact_not_found"
  | "artifact_contract_invalid"
  | "review_state_conflict"
  | "artifact_not_confirmed"
  | "send_receipt_expired"
  | "meeting_not_found"
  | "human_execution_conflict"
  | "runtime_session_not_found"
  | "memory_candidate_conflict";

export class GovernedCapabilityCloseoutReviewError extends Error {
  readonly code: GovernedCapabilityCloseoutReviewErrorCode;

  constructor(code: GovernedCapabilityCloseoutReviewErrorCode) {
    super(`governed_capability_closeout_review:${code}`);
    this.name = "GovernedCapabilityCloseoutReviewError";
    this.code = code;
  }
}

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];
type CloseoutArtifactRow = {
  id: string;
  workspaceId: string;
  artifactType: string;
  status: ArtifactBundleStatus;
  systemOfRecordWrite: boolean;
  artifactsJson: string;
  reviewPosture: string | null;
  artifactReview: {
    id: string;
    workspaceId: string;
    status: ArtifactReviewStatus;
    reviewedByUserId: string | null;
  } | null;
};

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new GovernedCapabilityCloseoutReviewError(
      "artifact_contract_invalid",
    );
  }
}

function parseCloseoutArtifact(row: CloseoutArtifactRow) {
  if (
    row.systemOfRecordWrite ||
    !row.artifactReview ||
    row.artifactReview.workspaceId !== row.workspaceId
  ) {
    throw new GovernedCapabilityCloseoutReviewError(
      "artifact_contract_invalid",
    );
  }
  if (
    row.artifactType === GOVERNED_EXTERNAL_SEND_ARTIFACT_TYPE &&
    row.reviewPosture === GOVERNED_EXTERNAL_SEND_REVIEW_POSTURE
  ) {
    const candidate = governedExternalSendDraftCandidateSchema.safeParse(
      parseJson(row.artifactsJson),
    );
    if (candidate.success) return candidate.data;
  }
  if (
    row.artifactType === GOVERNED_CONNECTOR_SCOPE_ARTIFACT_TYPE &&
    row.reviewPosture === GOVERNED_CONNECTOR_SCOPE_REVIEW_POSTURE
  ) {
    const candidate = governedConnectorScopeCandidateSchema.safeParse(
      parseJson(row.artifactsJson),
    );
    if (candidate.success) return candidate.data;
  }
  throw new GovernedCapabilityCloseoutReviewError(
    "artifact_contract_invalid",
  );
}

async function findCloseoutArtifact(
  tx: TransactionClient | typeof db,
  workspaceId: string,
  artifactBundleId: string,
) {
  return tx.artifactBundle.findFirst({
    where: {
      id: artifactBundleId,
      workspaceId,
      artifactType: {
        in: [
          GOVERNED_EXTERNAL_SEND_ARTIFACT_TYPE,
          GOVERNED_CONNECTOR_SCOPE_ARTIFACT_TYPE,
        ],
      },
      systemOfRecordWrite: false,
    },
    include: { artifactReview: true },
  }) as Promise<CloseoutArtifactRow | null>;
}

export async function reviewGovernedCapabilityCloseoutCandidate(input: unknown) {
  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new GovernedCapabilityCloseoutReviewError("invalid_input");
  }
  await assertWorkspaceGovernedActionReviewServiceAccess({
    workspaceId: parsed.data.workspaceId,
    userId: parsed.data.reviewerId,
    actorType: ActorType.USER,
    english: false,
  });

  return db.$transaction(async (tx) => {
    const row = await findCloseoutArtifact(
      tx,
      parsed.data.workspaceId,
      parsed.data.artifactBundleId,
    );
    if (!row) {
      throw new GovernedCapabilityCloseoutReviewError("artifact_not_found");
    }
    parseCloseoutArtifact(row);
    const nextReviewStatus =
      parsed.data.decision === "confirm"
        ? ArtifactReviewStatus.CONFIRMED
        : ArtifactReviewStatus.REJECTED;
    const nextArtifactStatus =
      parsed.data.decision === "confirm"
        ? ArtifactBundleStatus.CONFIRMED
        : ArtifactBundleStatus.REJECTED;
    if (
      row.artifactReview?.status === nextReviewStatus &&
      row.status === nextArtifactStatus
    ) {
      return {
        artifactBundleId: row.id,
        artifactReviewId: row.artifactReview.id,
        reviewStatus: nextReviewStatus,
        reused: true as const,
      };
    }
    if (
      row.status !== ArtifactBundleStatus.DRAFT ||
      row.artifactReview?.status !== ArtifactReviewStatus.PENDING
    ) {
      throw new GovernedCapabilityCloseoutReviewError(
        "review_state_conflict",
      );
    }

    const reviewedAt = new Date();
    const reviewClaim = await tx.artifactReview.updateMany({
      where: {
        id: row.artifactReview.id,
        workspaceId: parsed.data.workspaceId,
        status: ArtifactReviewStatus.PENDING,
      },
      data: {
        status: nextReviewStatus,
        reviewedByUserId: parsed.data.reviewerId,
        reviewNotes: parsed.data.notes ?? null,
        decisionSummary:
          parsed.data.decision === "confirm"
            ? "Confirmed as a review-first governed capability candidate"
            : "Rejected by human capability review",
        reviewedAt,
      },
    });
    const artifactClaim = await tx.artifactBundle.updateMany({
      where: {
        id: row.id,
        workspaceId: parsed.data.workspaceId,
        status: ArtifactBundleStatus.DRAFT,
      },
      data: {
        status: nextArtifactStatus,
        reviewedAt,
        confirmedAt:
          parsed.data.decision === "confirm" ? reviewedAt : undefined,
      },
    });
    if (reviewClaim.count !== 1 || artifactClaim.count !== 1) {
      throw new GovernedCapabilityCloseoutReviewError(
        "review_state_conflict",
      );
    }
    const trace = getCurrentAuditTraceContext();
    await tx.auditLog.create({
      data: {
        workspaceId: parsed.data.workspaceId,
        userId: parsed.data.reviewerId,
        actor: parsed.data.reviewerName,
        actorType: ActorType.USER,
        actionType:
          parsed.data.decision === "confirm"
            ? "GOVERNED_CAPABILITY_CANDIDATE_CONFIRMED"
            : "GOVERNED_CAPABILITY_CANDIDATE_REJECTED",
        targetType: "ArtifactBundle",
        targetId: row.id,
        summary:
          parsed.data.decision === "confirm"
            ? "A human confirmed a governed capability candidate without executing it."
            : "A human rejected a governed capability candidate.",
        payload: jsonStringify({
          artifactReviewId: row.artifactReview.id,
          candidateKind: row.artifactType,
          decision: parsed.data.decision,
        }),
        traceId: trace?.traceId,
        requestId: trace?.requestId,
        parentEventId: trace?.parentEventId ?? undefined,
      },
    });
    return {
      artifactBundleId: row.id,
      artifactReviewId: row.artifactReview.id,
      reviewStatus: nextReviewStatus,
      reused: false as const,
    };
  });
}

function deterministicId(prefix: string, value: unknown) {
  const digest = createHash("sha256")
    .update(serializeCandidateCanonicalJson(value), "utf8")
    .digest("hex");
  return `${prefix}:${digest.slice(0, 32)}`;
}

function assertConfirmedArtifact(row: CloseoutArtifactRow) {
  if (
    (row.status !== ArtifactBundleStatus.CONFIRMED &&
      row.status !== ArtifactBundleStatus.CONSUMED) ||
    row.artifactReview?.status !== ArtifactReviewStatus.CONFIRMED ||
    !row.artifactReview.reviewedByUserId
  ) {
    throw new GovernedCapabilityCloseoutReviewError(
      "artifact_not_confirmed",
    );
  }
}

function isUniqueConflict(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  );
}

async function findExistingHumanHandoff(
  tx: TransactionClient | typeof db,
  input: {
    id: string;
    workspaceId: string;
    artifactBundleId: string;
    candidate: GovernedExternalSendDraftCandidate;
  },
) {
  const existing = await tx.humanActionExecution.findUnique({
    where: { id: input.id },
  });
  if (!existing) return null;
  if (
    existing.workspaceId !== input.workspaceId ||
    existing.sourceArtifactBundleId !== input.artifactBundleId ||
    existing.actionType !== HumanActionExecutionType.MANUAL_EMAIL_SEND ||
    existing.status !== HumanActionExecutionStatus.READY ||
    existing.acknowledgementStatus !==
      HumanActionExecutionAckStatus.PENDING ||
    existing.executedAt !== null ||
    existing.externalReference !== null ||
    !existing.boundaryTrace?.includes(input.candidate.contractHash)
  ) {
    throw new GovernedCapabilityCloseoutReviewError(
      "human_execution_conflict",
    );
  }
  return { humanActionExecutionId: existing.id, reused: true as const };
}

export async function prepareGovernedExternalSendHumanExecution(
  input: unknown,
) {
  const parsed = humanHandoffInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new GovernedCapabilityCloseoutReviewError("invalid_input");
  }
  await assertWorkspaceGovernedActionManagementServiceAccess({
    workspaceId: parsed.data.workspaceId,
    userId: parsed.data.actorUserId,
    actorType: ActorType.USER,
    english: false,
  });

  const executeOnce = () =>
    db.$transaction(async (tx) => {
      const row = await findCloseoutArtifact(
        tx,
        parsed.data.workspaceId,
        parsed.data.artifactBundleId,
      );
      if (!row || row.artifactType !== GOVERNED_EXTERNAL_SEND_ARTIFACT_TYPE) {
        throw new GovernedCapabilityCloseoutReviewError("artifact_not_found");
      }
      assertConfirmedArtifact(row);
      const candidate = governedExternalSendDraftCandidateSchema.safeParse(
        parseJson(row.artifactsJson),
      );
      if (!candidate.success) {
        throw new GovernedCapabilityCloseoutReviewError(
          "artifact_contract_invalid",
        );
      }
      if (Date.parse(candidate.data.rateLimitReceipt.expiresAt) <= Date.now()) {
        throw new GovernedCapabilityCloseoutReviewError(
          "send_receipt_expired",
        );
      }
      const meeting = await tx.meeting.findFirst({
        where: {
          id: candidate.data.meetingId,
          workspaceId: parsed.data.workspaceId,
        },
        select: {
          id: true,
          workspaceId: true,
          opportunityId: true,
          companyId: true,
        },
      });
      if (!meeting) {
        throw new GovernedCapabilityCloseoutReviewError("meeting_not_found");
      }
      const id = deterministicId("governed-send-handoff", {
        workspaceId: parsed.data.workspaceId,
        artifactBundleId: row.id,
        contractHash: candidate.data.contractHash,
      });
      const existing = await findExistingHumanHandoff(tx, {
        id,
        workspaceId: parsed.data.workspaceId,
        artifactBundleId: row.id,
        candidate: candidate.data,
      });
      if (existing) return existing;

      const execution = await tx.humanActionExecution.create({
        data: {
          id,
          workspaceId: parsed.data.workspaceId,
          meetingId: meeting.id,
          opportunityId: meeting.opportunityId,
          companyId: meeting.companyId,
          sourceArtifactBundleId: row.id,
          sourceArtifactType: GOVERNED_EXTERNAL_SEND_ARTIFACT_TYPE,
          sourceArtifactTitle: "Governed external-send draft",
          sourceArtifactSummary:
            "Fixed recipient and content references passed review; Helm has not sent anything.",
          actionType: HumanActionExecutionType.MANUAL_EMAIL_SEND,
          audience: "customer",
          executionOwnerId: parsed.data.actorUserId,
          executionOwnerName: parsed.data.actorName,
          executionIntent:
            "Open the reviewed fixed-recipient draft and decide whether to send it manually.",
          executionBoundary:
            "This record grants no send authority. It is a human execution handoff only.",
          executionPrerequisite:
            "Re-check DLP, rate-limit, and dedupe receipts at the explicit human click.",
          executionDependency:
            "A separately governed sender outside this public candidate service must bind the same recipient and content hashes.",
          executionRiskLevel: RiskLevel.HIGH,
          approvalContext:
            "The source draft was human-confirmed; confirmation is not external-send approval or proof.",
          riskReviewSummary:
            "Recipient and content are hash-bound; automatic send remains forbidden.",
          acknowledgementStatus: HumanActionExecutionAckStatus.PENDING,
          status: HumanActionExecutionStatus.READY,
          executionProofType: null,
          executionProofPayload: null,
          externalReference: null,
          executedByUserId: null,
          executedByName: null,
          executedAt: null,
          whatWasNotDone:
            "No email was sent, scheduled, or acknowledged by this preparation step.",
          executionWritebackTarget: jsonStringify(["audit_trail"]),
          evidenceRefs: jsonStringify([
            candidate.data.dlpReceipt.receiptRef,
            candidate.data.rateLimitReceipt.receiptRef,
            candidate.data.dedupeReceipt.receiptRef,
          ]),
          sourceProvenance: jsonStringify({
            sourceArtifactBundleId: row.id,
            sourceArtifactReviewId: row.artifactReview?.id,
            candidateId: candidate.data.candidateId,
          }),
          boundaryTrace: jsonStringify([
            candidate.data.contractHash,
            candidate.data.recipientHash,
            candidate.data.messageContentHash,
            "required_human_click",
            "automatic_send_forbidden",
          ]),
        },
      });
      const trace = getCurrentAuditTraceContext();
      await tx.auditLog.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          userId: parsed.data.actorUserId,
          actor: parsed.data.actorName,
          actorType: ActorType.USER,
          actionType: "GOVERNED_EXTERNAL_SEND_HANDOFF_PREPARED",
          targetType: "HumanActionExecution",
          targetId: execution.id,
          summary:
            "A human prepared a reviewed external-send draft for a separate explicit manual click.",
          payload: jsonStringify({
            artifactBundleId: row.id,
            artifactReviewId: row.artifactReview?.id,
            candidateId: candidate.data.candidateId,
            contractHash: candidate.data.contractHash,
            automaticSendAllowed: false,
            sendPerformed: false,
          }),
          traceId: trace?.traceId,
          requestId: trace?.requestId,
          parentEventId: trace?.parentEventId ?? undefined,
        },
      });
      return { humanActionExecutionId: execution.id, reused: false as const };
    });

  try {
    return await executeOnce();
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    try {
      return await executeOnce();
    } catch (retryError) {
      if (isUniqueConflict(retryError)) {
        throw new GovernedCapabilityCloseoutReviewError(
          "human_execution_conflict",
        );
      }
      throw retryError;
    }
  }
}

type ConfirmedJudgementSource = {
  id: string;
  workspaceId: string;
  status: ArtifactBundleStatus;
  artifactsJson: string;
  evidenceRefs: string | null;
  sourceProvenance: string | null;
  confidence: number | null;
  artifactReview: {
    id: string;
    workspaceId: string;
    status: ArtifactReviewStatus;
    reviewedByUserId: string | null;
  } | null;
};

async function findConfirmedJudgementSource(
  tx: TransactionClient | typeof db,
  workspaceId: string,
  artifactBundleId: string,
) {
  return tx.artifactBundle.findFirst({
    where: {
      id: artifactBundleId,
      workspaceId,
      artifactType: GOVERNED_CANDIDATE_ARTIFACT_TYPE,
      reviewPosture: GOVERNED_CANDIDATE_REVIEW_POSTURE,
      systemOfRecordWrite: false,
    },
    include: { artifactReview: true },
  }) as Promise<ConfirmedJudgementSource | null>;
}

function memoryCandidateKey(input: {
  workspaceId: string;
  runtimeSessionId: string;
  artifactBundleId: string;
  candidateContentHash: string;
}) {
  return deterministicId("governed-memory", input);
}

async function findExistingMemoryProjection(
  tx: TransactionClient | typeof db,
  input: {
    workspaceId: string;
    runtimeSessionId: string;
    artifactBundleId: string;
    candidateKey: string;
    projection: {
      summary: string;
      sourceVerification: string;
      sourceStatus: string;
      evidenceRefs: string;
      confidence: number;
    };
  },
) {
  const existing = await tx.memoryCandidate.findUnique({
    where: { candidateKey: input.candidateKey },
  });
  if (!existing) return null;
  const audit = await tx.auditLog.findFirst({
    where: {
      workspaceId: input.workspaceId,
      actionType: "GOVERNED_MEMORY_CANDIDATE_PROJECTED",
      targetType: "MemoryCandidate",
      targetId: existing.id,
    },
    select: { id: true },
  });
  if (
    existing.workspaceId !== input.workspaceId ||
    existing.runtimeSessionId !== input.runtimeSessionId ||
    existing.artifactBundleId !== input.artifactBundleId ||
    existing.status !== RuntimeMemoryCandidateStatus.PENDING_VERIFICATION ||
    existing.summary !== input.projection.summary ||
    existing.sourceVerification !== input.projection.sourceVerification ||
    existing.sourceStatus !== input.projection.sourceStatus ||
    existing.evidenceRefs !== input.projection.evidenceRefs ||
    existing.confidence !== input.projection.confidence ||
    !audit
  ) {
    throw new GovernedCapabilityCloseoutReviewError(
      "memory_candidate_conflict",
    );
  }
  return existing;
}

export async function projectConfirmedArtifactToMemoryCandidate(input: unknown) {
  const parsed = memoryProjectionInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new GovernedCapabilityCloseoutReviewError("invalid_input");
  }
  await assertWorkspaceMemoryServiceAccess({
    workspaceId: parsed.data.workspaceId,
    userId: parsed.data.actorUserId,
    actorType: ActorType.USER,
    english: false,
  });

  const projectOnce = () =>
    db.$transaction(async (tx) => {
      const source = await findConfirmedJudgementSource(
        tx,
        parsed.data.workspaceId,
        parsed.data.artifactBundleId,
      );
      if (!source) {
        throw new GovernedCapabilityCloseoutReviewError("artifact_not_found");
      }
      if (
        (source.status !== ArtifactBundleStatus.CONFIRMED &&
          source.status !== ArtifactBundleStatus.CONSUMED) ||
        source.artifactReview?.status !== ArtifactReviewStatus.CONFIRMED ||
        source.artifactReview.workspaceId !== parsed.data.workspaceId ||
        !source.artifactReview.reviewedByUserId
      ) {
        throw new GovernedCapabilityCloseoutReviewError(
          "artifact_not_confirmed",
        );
      }
      const artifact = governedJudgementArtifactSchema.safeParse(
        parseJson(source.artifactsJson),
      );
      const evidenceRefs = z
        .array(z.string().trim().min(1).max(512))
        .max(100)
        .safeParse(source.evidenceRefs ? parseJson(source.evidenceRefs) : []);
      const provenance = governedCandidateSourceProvenanceSchema.safeParse(
        source.sourceProvenance
          ? parseJson(source.sourceProvenance)
          : null,
      );
      if (!artifact.success || !evidenceRefs.success || !provenance.success) {
        throw new GovernedCapabilityCloseoutReviewError(
          "artifact_contract_invalid",
        );
      }
      const evidenceSet = new Set(evidenceRefs.data);
      const usedEvidenceRefs = [
        ...artifact.data.proposal.evidenceRefs,
        ...artifact.data.roleOutputs.flatMap((output) => output.evidenceRefs),
      ];
      if (
        source.confidence !== artifact.data.proposal.confidence ||
        evidenceSet.size !== evidenceRefs.data.length ||
        usedEvidenceRefs.some((ref) => !evidenceSet.has(ref)) ||
        provenance.data.sourceCandidateRef !==
          artifact.data.sourceCandidateRef ||
        provenance.data.sourceCandidateContentHash !==
          artifact.data.sourceCandidateContentHash ||
        provenance.data.trajectoryReceiptRef !==
          artifact.data.trajectoryReceiptRef ||
        provenance.data.candidateContentHash !== artifact.data.contentHash
      ) {
        throw new GovernedCapabilityCloseoutReviewError(
          "artifact_contract_invalid",
        );
      }
      const runtimeSession = await tx.runtimeSession.findFirst({
        where: {
          id: parsed.data.runtimeSessionId,
          workspaceId: parsed.data.workspaceId,
        },
        select: { id: true, workspaceId: true },
      });
      if (!runtimeSession) {
        throw new GovernedCapabilityCloseoutReviewError(
          "runtime_session_not_found",
        );
      }
      const candidateKey = memoryCandidateKey({
        workspaceId: parsed.data.workspaceId,
        runtimeSessionId: parsed.data.runtimeSessionId,
        artifactBundleId: source.id,
        candidateContentHash: artifact.data.contentHash,
      });
      const summary =
        artifact.data.proposal.nextSafeActions
          .slice(0, 3)
          .join(" ")
          .slice(0, 4_000) ||
        "Human-confirmed governed judgement awaiting memory verification.";
      const projection = {
        summary,
        sourceVerification: jsonStringify({
          artifactReviewId: source.artifactReview.id,
          reviewedByUserId: source.artifactReview.reviewedByUserId,
          reviewStatus: ArtifactReviewStatus.CONFIRMED,
        }),
        sourceStatus: jsonStringify({
          artifactStatus: source.status,
          candidateStatus: "pending_verification",
          officialMemoryPromotionAllowed: false,
        }),
        evidenceRefs: jsonStringify(evidenceRefs.data),
        confidence: artifact.data.proposal.confidence,
      };
      const existing = await findExistingMemoryProjection(tx, {
        workspaceId: parsed.data.workspaceId,
        runtimeSessionId: runtimeSession.id,
        artifactBundleId: source.id,
        candidateKey,
        projection,
      });
      if (existing) {
        const receipt = buildGovernedMemoryCandidateProjectionReceipt({
          receiptId: `receipt:${candidateKey}`,
          workspaceRef: `workspace:${parsed.data.workspaceId}`,
          sourceArtifactBundleId: source.id,
          sourceArtifactReviewId: source.artifactReview.id,
          runtimeSessionId: runtimeSession.id,
          memoryCandidateId: existing.id,
          memoryCandidateKey: candidateKey,
          candidateStatus: "pending_verification",
          projectedAt: existing.createdAt.toISOString(),
          memoryPromotionCreated: false,
          canonicalMemoryWritten: false,
        });
        return { receipt, reused: true as const };
      }

      const projectedAt = new Date();
      const memoryCandidate = await tx.memoryCandidate.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          runtimeSessionId: runtimeSession.id,
          artifactBundleId: source.id,
          candidateKey,
          summary: projection.summary,
          sourceVerification: projection.sourceVerification,
          sourceStatus: projection.sourceStatus,
          status: RuntimeMemoryCandidateStatus.PENDING_VERIFICATION,
          evidenceRefs: projection.evidenceRefs,
          confidence: projection.confidence,
        },
      });
      const receipt = buildGovernedMemoryCandidateProjectionReceipt({
        receiptId: `receipt:${candidateKey}`,
        workspaceRef: `workspace:${parsed.data.workspaceId}`,
        sourceArtifactBundleId: source.id,
        sourceArtifactReviewId: source.artifactReview.id,
        runtimeSessionId: runtimeSession.id,
        memoryCandidateId: memoryCandidate.id,
        memoryCandidateKey: candidateKey,
        candidateStatus: "pending_verification",
        projectedAt: projectedAt.toISOString(),
        memoryPromotionCreated: false,
        canonicalMemoryWritten: false,
      });
      const trace = getCurrentAuditTraceContext();
      await tx.auditLog.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          userId: parsed.data.actorUserId,
          actor: parsed.data.actorName,
          actorType: ActorType.USER,
          actionType: "GOVERNED_MEMORY_CANDIDATE_PROJECTED",
          targetType: "MemoryCandidate",
          targetId: memoryCandidate.id,
          summary:
            "A confirmed Artifact was projected to pending memory verification without promotion.",
          payload: jsonStringify({
            sourceArtifactBundleId: source.id,
            sourceArtifactReviewId: source.artifactReview.id,
            memoryCandidateKey: candidateKey,
            receiptHash: receipt.receiptHash,
            memoryPromotionCreated: false,
            canonicalMemoryWritten: false,
          }),
          traceId: trace?.traceId,
          requestId: trace?.requestId,
          parentEventId: trace?.parentEventId ?? undefined,
        },
      });
      return { receipt, reused: false as const };
    });

  try {
    return await projectOnce();
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    try {
      return await projectOnce();
    } catch (retryError) {
      if (isUniqueConflict(retryError)) {
        throw new GovernedCapabilityCloseoutReviewError(
          "memory_candidate_conflict",
        );
      }
      throw retryError;
    }
  }
}
