import fixturePack from "@/evals/intelligence-growth-tenant-signals/tenant-signal-cases.json";
import type {
  BusinessAdvancementPipelineCase,
  BusinessAdvancementPipelineCaseResult,
} from "@/lib/evals/business-advancement-signal-pipeline-evals";
import {
  evaluateIntelligenceGrowthTenantSignalCase,
  isHelmBusinessDevelopmentTenantSignal,
  type IntelligenceGrowthTenantSignalCase,
  type IntelligenceGrowthTenantSignalFixturePack,
} from "@/lib/evals/intelligence-growth-tenant-signal-evals";
import type { IntelligenceDimension } from "@/lib/intelligence-growth/types";

export type IntelligenceGrowthRequiredReviewerRole =
  | "founder_approval"
  | "product_owner"
  | "engineering_reviewer"
  | "data_protection_reviewer"
  | "security_reviewer"
  | "operations_reviewer";

export type IntelligenceGrowthReviewPacketStatus =
  | "ready_for_founder_review"
  | "needs_required_review"
  | "blocked";

export type IntelligenceGrowthReviewPacket = {
  readonly id: string;
  readonly caseId: string;
  readonly dimension: IntelligenceDimension;
  readonly findingType: string;
  readonly tenantKey: string;
  readonly workspaceId: string;
  readonly sourceProvider: string | null;
  readonly status: IntelligenceGrowthReviewPacketStatus;
  readonly requiredReviewers: readonly IntelligenceGrowthRequiredReviewerRole[];
  readonly ownerAlias: string | null;
  readonly proposedNextStep: string;
  readonly evidenceRefs: readonly string[];
  readonly boundaryNote: string;
  readonly goCriteria: readonly string[];
  readonly noGoCriteria: readonly string[];
  readonly allowedWorkerActions: readonly string[];
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly productionPromptChangeAllowed: false;
  readonly ruleAutoUpdateAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly scopeValid: boolean;
  readonly reviewerApprovalRequired: true;
  readonly blockedReasons: readonly string[];
};

export type IntelligenceGrowthReviewPacketEvalSummary = {
  readonly passed: boolean;
  readonly version: string;
  readonly totalPackets: number;
  readonly dimensionCount: number;
  readonly readyForFounderReviewCount: number;
  readonly needsRequiredReviewCount: number;
  readonly blockedCount: number;
  readonly founderApprovalCoveragePercent: number;
  readonly requiredReviewerCoveragePercent: number;
  readonly evidenceCoveragePercent: number;
  readonly scopeViolationCount: number;
  readonly promotionAuthorityLeakCount: number;
  readonly runtimeAuthorityLeakCount: number;
  readonly packetCompletenessPercent: number;
  readonly packets: readonly IntelligenceGrowthReviewPacket[];
  readonly failures: readonly { readonly packetId: string; readonly reason: string }[];
};

const REQUIRED_FOUNDATION_REVIEWERS: readonly IntelligenceGrowthRequiredReviewerRole[] = [
  "founder_approval",
  "product_owner",
  "engineering_reviewer",
];

const DIMENSION_REVIEWERS: Record<IntelligenceDimension, readonly IntelligenceGrowthRequiredReviewerRole[]> = {
  context: ["product_owner", "engineering_reviewer"],
  object_signal: ["product_owner", "engineering_reviewer"],
  memory: ["data_protection_reviewer", "engineering_reviewer"],
  routing: ["product_owner", "engineering_reviewer"],
  action_outcome: ["operations_reviewer", "product_owner"],
  worker_skill: ["security_reviewer", "engineering_reviewer"],
  prompt_policy: ["data_protection_reviewer", "security_reviewer"],
  eval_replay: ["engineering_reviewer", "product_owner"],
  tenant_personalization: ["data_protection_reviewer", "product_owner"],
  cost_model_tool: ["operations_reviewer", "engineering_reviewer"],
};

const REVIEW_PACKET_GO_CRITERIA: readonly string[] = [
  "source_scope_is_helm_business_development",
  "evidence_refs_are_present",
  "boundary_note_is_visible",
  "founder_approval_is_required_before_any_upgrade",
  "required_reviewer_approval_is_required_before_any_upgrade",
];

const REVIEW_PACKET_NO_GO_CRITERIA: readonly string[] = [
  "customer_tenant_scope",
  "tenant_private_app_scope",
  "raw_payload_included",
  "official_write_attempt",
  "auto_execution_attempt",
  "canonical_memory_write_attempt",
  "production_prompt_or_policy_auto_update",
  "skill_auto_promotion",
];

export function buildIntelligenceGrowthReviewPacket(
  item: IntelligenceGrowthTenantSignalCase,
): IntelligenceGrowthReviewPacket {
  const evaluated = evaluateIntelligenceGrowthTenantSignalCase(item);
  return buildIntelligenceGrowthReviewPacketFromPipeline(
    item,
    evaluated.pipelineCase,
    evaluated.pipelineResult,
  );
}

export function buildIntelligenceGrowthReviewPacketFromPipeline(
  item: IntelligenceGrowthTenantSignalCase,
  pipelineCase: BusinessAdvancementPipelineCase,
  pipelineResult: BusinessAdvancementPipelineCaseResult,
): IntelligenceGrowthReviewPacket {
  const scopeValid = isHelmBusinessDevelopmentTenantSignal(pipelineCase);
  const promotionAuthorityLeak =
    pipelineResult.audience.learning.autoPromoted ||
    pipelineResult.audience.learning.canonicalMemoryWriteAttempted ||
    pipelineResult.officialWriteAttemptCount > 0;
  const runtimeAuthorityLeak =
    pipelineResult.audience.worker.autoExecutionAttempted ||
    pipelineResult.audience.workerForbiddenActionLeakCount > 0 ||
    pipelineResult.rawPayloadEchoCount > 0;
  const blockedReasons = [
    ...pipelineResult.failures,
    ...(!scopeValid ? ["scope_violation"] : []),
    ...(promotionAuthorityLeak ? ["promotion_authority_leak"] : []),
    ...(runtimeAuthorityLeak ? ["runtime_authority_leak"] : []),
  ];

  return {
    id: `igs-review-packet:${item.dimension}:${item.id}`,
    caseId: item.id,
    dimension: item.dimension,
    findingType: item.findingType,
    tenantKey: pipelineCase.object.tenantKey,
    workspaceId: pipelineCase.object.workspaceId,
    sourceProvider: pipelineCase.source.provider ?? null,
    status: resolvePacketStatus(pipelineResult, blockedReasons),
    requiredReviewers: resolveRequiredReviewers(item.dimension),
    ownerAlias: item.ownerAlias,
    proposedNextStep: item.nextAction ?? "open_review_packet",
    evidenceRefs: [...item.evidenceRefs],
    boundaryNote: item.boundaryNote ?? "No production change is authorized by this review packet.",
    goCriteria: REVIEW_PACKET_GO_CRITERIA,
    noGoCriteria: REVIEW_PACKET_NO_GO_CRITERIA,
    allowedWorkerActions: pipelineResult.audience.worker.allowedActions,
    candidateOnly: true,
    runtimeAllowed: false,
    productionPromptChangeAllowed: false,
    ruleAutoUpdateAllowed: false,
    canonicalMemoryWriteAllowed: false,
    skillAutoPromotionAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    scopeValid,
    reviewerApprovalRequired: true,
    blockedReasons,
  };
}

export function runIntelligenceGrowthReviewPacketEval(
  pack: IntelligenceGrowthTenantSignalFixturePack =
    fixturePack as IntelligenceGrowthTenantSignalFixturePack,
): IntelligenceGrowthReviewPacketEvalSummary {
  const packets = pack.cases.map(buildIntelligenceGrowthReviewPacket);
  const blockedCount = packets.filter((packet) => packet.status === "blocked").length;
  const scopeViolationCount = packets.filter((packet) => !packet.scopeValid).length;
  const promotionAuthorityLeakCount = packets.filter(
    (packet) =>
      packet.productionPromptChangeAllowed ||
      packet.ruleAutoUpdateAllowed ||
      packet.canonicalMemoryWriteAllowed ||
      packet.skillAutoPromotionAllowed ||
      packet.officialWriteAllowed ||
      packet.blockedReasons.includes("promotion_authority_leak"),
  ).length;
  const runtimeAuthorityLeakCount = packets.filter(
    (packet) =>
      packet.runtimeAllowed ||
      packet.autoExecutionAllowed ||
      packet.blockedReasons.includes("runtime_authority_leak"),
  ).length;
  const founderApprovalCoveragePercent = percent(
    packets.filter((packet) => packet.requiredReviewers.includes("founder_approval")).length,
    packets.length,
  );
  const requiredReviewerCoveragePercent = percent(
    packets.filter((packet) => packet.requiredReviewers.length >= 3).length,
    packets.length,
  );
  const evidenceCoveragePercent = percent(
    packets.filter((packet) => packet.evidenceRefs.length >= 2).length,
    packets.length,
  );
  const packetCompletenessPercent = percent(
    packets.filter(isCompleteReviewPacket).length,
    packets.length,
  );

  const failures: { packetId: string; reason: string }[] = [];
  pushSummaryFailure(failures, packets.length < 10, `packet_count:${packets.length}`);
  pushSummaryFailure(failures, new Set(packets.map((packet) => packet.dimension)).size < 10, "dimension_coverage");
  pushSummaryFailure(failures, blockedCount > 0, `blocked_packet_count:${blockedCount}`);
  pushSummaryFailure(failures, scopeViolationCount > 0, `scope_violation_count:${scopeViolationCount}`);
  pushSummaryFailure(
    failures,
    promotionAuthorityLeakCount > 0,
    `promotion_authority_leak_count:${promotionAuthorityLeakCount}`,
  );
  pushSummaryFailure(
    failures,
    runtimeAuthorityLeakCount > 0,
    `runtime_authority_leak_count:${runtimeAuthorityLeakCount}`,
  );
  pushSummaryFailure(
    failures,
    founderApprovalCoveragePercent < 100,
    `founder_approval_coverage:${founderApprovalCoveragePercent}`,
  );
  pushSummaryFailure(
    failures,
    requiredReviewerCoveragePercent < 100,
    `required_reviewer_coverage:${requiredReviewerCoveragePercent}`,
  );
  pushSummaryFailure(
    failures,
    evidenceCoveragePercent < 100,
    `evidence_coverage:${evidenceCoveragePercent}`,
  );
  pushSummaryFailure(
    failures,
    packetCompletenessPercent < 100,
    `packet_completeness:${packetCompletenessPercent}`,
  );

  return {
    passed: failures.length === 0,
    version: "intelligence-growth-review-packets-phase0",
    totalPackets: packets.length,
    dimensionCount: new Set(packets.map((packet) => packet.dimension)).size,
    readyForFounderReviewCount: packets.filter(
      (packet) => packet.status === "ready_for_founder_review",
    ).length,
    needsRequiredReviewCount: packets.filter(
      (packet) => packet.status === "needs_required_review",
    ).length,
    blockedCount,
    founderApprovalCoveragePercent,
    requiredReviewerCoveragePercent,
    evidenceCoveragePercent,
    scopeViolationCount,
    promotionAuthorityLeakCount,
    runtimeAuthorityLeakCount,
    packetCompletenessPercent,
    packets,
    failures,
  };
}

function resolvePacketStatus(
  pipelineResult: BusinessAdvancementPipelineCaseResult,
  blockedReasons: readonly string[],
): IntelligenceGrowthReviewPacketStatus {
  if (blockedReasons.length > 0 || pipelineResult.finalDisposition === "rejected") {
    return "blocked";
  }
  if (pipelineResult.finalDisposition === "must_push_ready") {
    return "ready_for_founder_review";
  }
  return "needs_required_review";
}

function resolveRequiredReviewers(
  dimension: IntelligenceDimension,
): readonly IntelligenceGrowthRequiredReviewerRole[] {
  return Array.from(
    new Set([...REQUIRED_FOUNDATION_REVIEWERS, ...DIMENSION_REVIEWERS[dimension]]),
  );
}

function isCompleteReviewPacket(packet: IntelligenceGrowthReviewPacket): boolean {
  return (
    packet.scopeValid &&
    packet.status !== "blocked" &&
    packet.blockedReasons.length === 0 &&
    packet.candidateOnly &&
    packet.reviewerApprovalRequired &&
    packet.requiredReviewers.includes("founder_approval") &&
    packet.requiredReviewers.length >= 3 &&
    packet.evidenceRefs.length >= 2 &&
    packet.boundaryNote.length > 0 &&
    packet.goCriteria.includes("founder_approval_is_required_before_any_upgrade") &&
    packet.noGoCriteria.includes("customer_tenant_scope") &&
    packet.noGoCriteria.includes("tenant_private_app_scope") &&
    !packet.runtimeAllowed &&
    !packet.productionPromptChangeAllowed &&
    !packet.ruleAutoUpdateAllowed &&
    !packet.canonicalMemoryWriteAllowed &&
    !packet.skillAutoPromotionAllowed &&
    !packet.officialWriteAllowed &&
    !packet.autoExecutionAllowed
  );
}

function pushSummaryFailure(
  failures: { packetId: string; reason: string }[],
  failed: boolean,
  reason: string,
): void {
  if (failed) {
    failures.push({ packetId: "__summary__", reason });
  }
}

function percent(numerator: number, denominator: number): number {
  if (denominator === 0) return 100;
  return Math.round((numerator / denominator) * 100);
}
