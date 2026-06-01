import outcomeFixtureData from "@/evals/intelligence-growth-decision-outcomes/decision-outcome-cases.json";
import fixtureData from "@/evals/intelligence-growth-learning-requeue/learning-requeue-cases.json";
import {
  runIntelligenceGrowthDecisionOutcomeEval,
  type IntelligenceGrowthDecisionOutcomeFixture,
  type IntelligenceGrowthDecisionOutcomeRecord,
} from "@/lib/evals/intelligence-growth-decision-outcome-evals";
import type { IntelligenceGrowthTenantSignalFixturePack } from "@/lib/evals/intelligence-growth-tenant-signal-evals";

const TENANT_KEY = "helm-business-development";
const WORKSPACE_ID = "workspace_helm_business_development";
const SOURCE_WINDOW_KEY = "2026-W18";
const NEXT_WINDOW_KEY = "2026-W19";

export type LearningRequeueStatus =
  | "ready_for_founder_review"
  | "needs_required_review"
  | "review_required"
  | "archived";

export type IntelligenceGrowthLearningRequeueCandidate = {
  readonly candidateId: string;
  readonly sourceDecisionPacketId: string;
  readonly tenantKey: string;
  readonly workspaceId: string;
  readonly sourceWindowKey: string;
  readonly nextWindowKey: string;
  readonly status: LearningRequeueStatus;
  readonly decisionOwnerAlias: string;
  readonly evidenceRefs: readonly string[];
  readonly boundaryNote: string;
  readonly productionChangeRequested: boolean;
  readonly officialWriteRequested: boolean;
  readonly autoExecutionRequested: boolean;
  readonly canonicalMemoryWriteRequested: boolean;
  readonly promptOrPolicyUpdateRequested: boolean;
  readonly skillAutoPromotionRequested: boolean;
  readonly rawCustomerDataIncluded: boolean;
};

export type IntelligenceGrowthLearningRequeueFixture = {
  readonly version: string;
  readonly status: string;
  readonly tenantKey: string;
  readonly workspaceId: string;
  readonly sourceWindowKey: string;
  readonly nextWindowKey: string;
  readonly candidates: readonly IntelligenceGrowthLearningRequeueCandidate[];
};

export type IntelligenceGrowthLearningRequeueEvalSummary = {
  readonly tenantKey: string;
  readonly workspaceId: string;
  readonly sourceWindowKey: string;
  readonly nextWindowKey: string;
  readonly totalCandidates: number;
  readonly expectedCandidateCount: number;
  readonly candidateCoveragePercent: number;
  readonly missingCandidateCount: number;
  readonly duplicateCandidateCount: number;
  readonly blockedDecisionCandidateCount: number;
  readonly statusMismatchCount: number;
  readonly scopeMismatchCount: number;
  readonly unauthorizedFlagCount: number;
  readonly rawCustomerDataIncidentCount: number;
  readonly evidenceCoveragePercent: number;
  readonly ownerCoveragePercent: number;
  readonly boundaryNoteCoveragePercent: number;
  readonly unexpectedCandidateCount: number;
  readonly sourcePacketMismatchCount: number;
  readonly invalidStatusCount: number;
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly passed: boolean;
  readonly failures: readonly { readonly candidateId: string; readonly reason: string }[];
};

function derivedPercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 100;
  return Math.round((numerator / denominator) * 100);
}

function expectedStatus(decision: IntelligenceGrowthDecisionOutcomeRecord["decision"]): LearningRequeueStatus {
  switch (decision) {
    case "continue": return "ready_for_founder_review";
    case "revise": return "needs_required_review";
    case "blocked": return "review_required";
    case "stop": return "archived";
  }
}

function pushFailure(
  failures: { candidateId: string; reason: string }[],
  failed: boolean,
  candidateId: string,
  reason: string,
): void {
  if (failed) {
    failures.push({ candidateId, reason });
  }
}

function deduplicateFailures(
  failures: readonly { candidateId: string; reason: string }[],
): readonly { candidateId: string; reason: string }[] {
  const seen = new Set<string>();
  return failures.filter((f) => {
    const key = `${f.candidateId}:${f.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function runIntelligenceGrowthLearningRequeueEval(
  fixture?: IntelligenceGrowthLearningRequeueFixture,
  outcomeFix?: IntelligenceGrowthDecisionOutcomeFixture,
  pack?: IntelligenceGrowthTenantSignalFixturePack,
): IntelligenceGrowthLearningRequeueEvalSummary {
  const outcomeSummary = outcomeFix
    ? runIntelligenceGrowthDecisionOutcomeEval(outcomeFix, pack)
    : runIntelligenceGrowthDecisionOutcomeEval(undefined, pack);

  const outcomeRecords: readonly IntelligenceGrowthDecisionOutcomeRecord[] = outcomeFix
    ? outcomeFix.records
    : (outcomeFixtureData.records as IntelligenceGrowthDecisionOutcomeRecord[]);

  const candidates: readonly IntelligenceGrowthLearningRequeueCandidate[] = fixture
    ? fixture.candidates
    : (fixtureData.candidates as IntelligenceGrowthLearningRequeueCandidate[]);

  // Build map of expected candidates: nextLearningCandidateId -> decision record
  const expectedCandidateMap = new Map<string, IntelligenceGrowthDecisionOutcomeRecord>();
  for (const record of outcomeRecords) {
    if (record.nextLearningCandidateId !== null && record.nextLearningCandidateId !== undefined) {
      expectedCandidateMap.set(record.nextLearningCandidateId, record);
    }
  }
  const expectedCandidateCount = expectedCandidateMap.size;

  // Count duplicates per candidateId
  const candidateIdCounts = new Map<string, number>();
  for (const c of candidates) {
    candidateIdCounts.set(c.candidateId, (candidateIdCounts.get(c.candidateId) ?? 0) + 1);
  }

  const missingCandidateIds = [...expectedCandidateMap.keys()].filter((id) => !candidateIdCounts.has(id));
  const duplicateCandidateIds = [...candidateIdCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  const missingCandidateCount = missingCandidateIds.length;
  const duplicateCandidateCount = duplicateCandidateIds.length;
  const candidateCoveragePercent = derivedPercent(
    [...expectedCandidateMap.keys()].filter((id) => candidateIdCounts.get(id) === 1).length,
    expectedCandidateCount,
  );

  const VALID_STATUSES = new Set<string>([
    "ready_for_founder_review",
    "needs_required_review",
    "review_required",
    "archived",
  ]);

  // Orphan candidates: candidateId not expected from any upstream nextLearningCandidateId
  const unexpectedCandidates = candidates.filter((c) => !expectedCandidateMap.has(c.candidateId));
  const unexpectedCandidateCount = unexpectedCandidates.length;

  // sourceDecisionPacketId must match the upstream packetId for the expected candidate
  const sourcePacketMismatchCandidates = candidates.filter((c) => {
    const record = expectedCandidateMap.get(c.candidateId);
    if (!record) return false;
    return c.sourceDecisionPacketId !== record.packetId;
  });
  const sourcePacketMismatchCount = sourcePacketMismatchCandidates.length;

  // Status must be one of the four valid values, even when cast through unknown
  const invalidStatusCandidates = candidates.filter(
    (c) => !VALID_STATUSES.has(c.status as unknown as string),
  );
  const invalidStatusCount = invalidStatusCandidates.length;

  const scopeMismatchIds = candidates.filter(
    (c) =>
      c.tenantKey !== TENANT_KEY ||
      c.workspaceId !== WORKSPACE_ID ||
      c.sourceWindowKey !== SOURCE_WINDOW_KEY ||
      c.nextWindowKey !== NEXT_WINDOW_KEY,
  ).map((c) => c.candidateId);
  const scopeMismatchCount = scopeMismatchIds.length;

  // Validate status determinism against upstream decision
  const statusMismatchCandidates = candidates.filter((c) => {
    const record = expectedCandidateMap.get(c.candidateId);
    if (!record) return false;
    return c.status !== expectedStatus(record.decision);
  });
  const statusMismatchCount = statusMismatchCandidates.length;

  const blockedDecisionCandidateCount = candidates.filter((c) => c.status === "review_required").length;

  const unauthorizedFlagCount = candidates.filter(
    (c) =>
      c.productionChangeRequested ||
      c.officialWriteRequested ||
      c.autoExecutionRequested ||
      c.canonicalMemoryWriteRequested ||
      c.promptOrPolicyUpdateRequested ||
      c.skillAutoPromotionRequested,
  ).length;

  const rawCustomerDataIncidentCount = candidates.filter((c) => c.rawCustomerDataIncluded).length;

  const evidenceCoveragePercent = derivedPercent(
    candidates.filter((c) => c.evidenceRefs.length >= 2).length,
    candidates.length,
  );

  const ownerCoveragePercent = derivedPercent(
    candidates.filter((c) => typeof c.decisionOwnerAlias === "string" && c.decisionOwnerAlias.trim() !== "").length,
    candidates.length,
  );

  const boundaryNoteCoveragePercent = derivedPercent(
    candidates.filter((c) => typeof c.boundaryNote === "string" && c.boundaryNote.trim() !== "").length,
    candidates.length,
  );

  const failures: { candidateId: string; reason: string }[] = [
    ...outcomeSummary.failures.map((f) => ({ candidateId: f.packetId, reason: `upstream:${f.reason}` })),
  ];

  for (const c of unexpectedCandidates) {
    failures.push({ candidateId: c.candidateId, reason: "unexpected_candidate" });
  }
  for (const c of sourcePacketMismatchCandidates) {
    failures.push({
      candidateId: c.candidateId,
      reason: `source_packet_mismatch:expected_${expectedCandidateMap.get(c.candidateId)!.packetId}_got_${c.sourceDecisionPacketId}`,
    });
  }
  for (const c of invalidStatusCandidates) {
    failures.push({ candidateId: c.candidateId, reason: `invalid_status:${c.status as unknown as string}` });
  }

  for (const id of scopeMismatchIds) {
    failures.push({ candidateId: id, reason: "scope_mismatch" });
  }
  for (const id of missingCandidateIds) {
    failures.push({ candidateId: id, reason: "missing_candidate" });
  }
  for (const id of duplicateCandidateIds) {
    failures.push({ candidateId: id, reason: "duplicate_candidate" });
  }
  for (const c of statusMismatchCandidates) {
    failures.push({ candidateId: c.candidateId, reason: `status_mismatch:expected_${expectedStatus(expectedCandidateMap.get(c.candidateId)!.decision)}_got_${c.status}` });
  }

  pushFailure(failures, candidateCoveragePercent < 100, "__ledger__", `candidate_coverage:${candidateCoveragePercent}`);
  pushFailure(failures, unauthorizedFlagCount > 0, "__ledger__", `unauthorized_flag_count:${unauthorizedFlagCount}`);
  pushFailure(failures, rawCustomerDataIncidentCount > 0, "__ledger__", `raw_customer_data_incident_count:${rawCustomerDataIncidentCount}`);
  pushFailure(failures, evidenceCoveragePercent < 100, "__ledger__", `evidence_coverage:${evidenceCoveragePercent}`);
  pushFailure(failures, ownerCoveragePercent < 100, "__ledger__", `owner_coverage:${ownerCoveragePercent}`);
  pushFailure(failures, boundaryNoteCoveragePercent < 100, "__ledger__", `boundary_note_coverage:${boundaryNoteCoveragePercent}`);

  const uniqueFailures = deduplicateFailures(failures);

  return {
    tenantKey: TENANT_KEY,
    workspaceId: WORKSPACE_ID,
    sourceWindowKey: SOURCE_WINDOW_KEY,
    nextWindowKey: NEXT_WINDOW_KEY,
    totalCandidates: candidates.length,
    expectedCandidateCount,
    candidateCoveragePercent,
    missingCandidateCount,
    duplicateCandidateCount,
    blockedDecisionCandidateCount,
    statusMismatchCount,
    scopeMismatchCount,
    unauthorizedFlagCount,
    rawCustomerDataIncidentCount,
    evidenceCoveragePercent,
    ownerCoveragePercent,
    boundaryNoteCoveragePercent,
    unexpectedCandidateCount,
    sourcePacketMismatchCount,
    invalidStatusCount,
    candidateOnly: true,
    runtimeAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    canonicalMemoryWriteAllowed: false,
    promptOrPolicyUpdateAllowed: false,
    skillAutoPromotionAllowed: false,
    passed: uniqueFailures.length === 0,
    failures: uniqueFailures,
  };
}
