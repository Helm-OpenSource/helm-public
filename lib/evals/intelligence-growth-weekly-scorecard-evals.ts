import {
  runIntelligenceGrowthReviewPacketEval,
  type IntelligenceGrowthReviewPacket,
  type IntelligenceGrowthReviewPacketEvalSummary,
} from "@/lib/evals/intelligence-growth-review-packet-evals";
import type { IntelligenceGrowthTenantSignalFixturePack } from "@/lib/evals/intelligence-growth-tenant-signal-evals";

const TENANT_KEY = "helm-business-development";
const WORKSPACE_ID = "workspace_helm_business_development";
const SOURCE_WINDOW_KEY = "2026-W18";

export type IntelligenceGrowthWeeklyScorecardSummary = {
  readonly tenantKey: string;
  readonly workspaceId: string;
  readonly sourceWindowKey: string;
  readonly totalPackets: number;
  readonly readyForFounderReviewCount: number;
  readonly needsRequiredReviewCount: number;
  readonly blockedCount: number;
  readonly requiredReviewerCoveragePercent: number;
  readonly evidenceCoveragePercent: number;
  readonly boundaryIncidentCount: number;
  readonly promotionAuthorityLeakCount: number;
  readonly runtimeAuthorityLeakCount: number;
  readonly topMustPushIds: readonly string[];
  readonly founderDecisionQueue: readonly string[];
  readonly reviewerLoad: Readonly<Record<string, number>>;
  readonly nextActions: readonly string[];
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly passed: boolean;
  readonly failures: readonly { readonly packetId: string; readonly reason: string }[];
};

function buildTopMustPushIds(packets: readonly IntelligenceGrowthReviewPacket[]): readonly string[] {
  return packets
    .filter((p) => p.status === "ready_for_founder_review")
    .map((p) => p.id);
}

function buildFounderDecisionQueue(packets: readonly IntelligenceGrowthReviewPacket[]): readonly string[] {
  return packets
    .filter((p) => p.requiredReviewers.includes("founder_approval"))
    .map((p) => p.id);
}

function buildReviewerLoad(packets: readonly IntelligenceGrowthReviewPacket[]): Record<string, number> {
  const load: Record<string, number> = {};
  for (const packet of packets) {
    for (const reviewer of packet.requiredReviewers) {
      load[reviewer] = (load[reviewer] ?? 0) + 1;
    }
  }
  return load;
}

function buildNextActions(packets: readonly IntelligenceGrowthReviewPacket[]): readonly string[] {
  const seen = new Set<string>();
  const actions: string[] = [];
  for (const packet of sortedPackets(packets)) {
    if (packet.proposedNextStep && !seen.has(packet.proposedNextStep)) {
      seen.add(packet.proposedNextStep);
      actions.push(packet.proposedNextStep);
    }
  }
  return actions;
}

function sortedPackets(packets: readonly IntelligenceGrowthReviewPacket[]): readonly IntelligenceGrowthReviewPacket[] {
  const statusOrder: Record<string, number> = {
    ready_for_founder_review: 0,
    needs_required_review: 1,
    blocked: 2,
  };
  return [...packets].sort((a, b) => {
    const statusDiff = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
    if (statusDiff !== 0) return statusDiff;
    const dimDiff = a.dimension.localeCompare(b.dimension);
    if (dimDiff !== 0) return dimDiff;
    return a.caseId.localeCompare(b.caseId);
  });
}

function derivedPercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 100;
  return Math.round((numerator / denominator) * 100);
}

export function buildIntelligenceGrowthWeeklyScorecardFromPacketSummary(
  packetSummary: IntelligenceGrowthReviewPacketEvalSummary,
): IntelligenceGrowthWeeklyScorecardSummary {
  const packets = sortedPackets(packetSummary.packets);

  // Derive all operational metrics from the packet list, not from summary fields.
  const totalPackets = packets.length;
  const readyForFounderReviewCount = packets.filter((p) => p.status === "ready_for_founder_review").length;
  const needsRequiredReviewCount = packets.filter((p) => p.status === "needs_required_review").length;
  const blockedCount = packets.filter((p) => p.status === "blocked").length;
  const scopeViolationCount = packets.filter((p) => !p.scopeValid).length;
  const promotionAuthorityLeakCount = packets.filter(
    (p) =>
      p.productionPromptChangeAllowed ||
      p.ruleAutoUpdateAllowed ||
      p.canonicalMemoryWriteAllowed ||
      p.skillAutoPromotionAllowed ||
      p.officialWriteAllowed ||
      p.blockedReasons.includes("promotion_authority_leak"),
  ).length;
  const runtimeAuthorityLeakCount = packets.filter(
    (p) =>
      p.runtimeAllowed ||
      p.autoExecutionAllowed ||
      p.blockedReasons.includes("runtime_authority_leak"),
  ).length;
  const requiredReviewerCoveragePercent = derivedPercent(
    packets.filter((p) => p.requiredReviewers.includes("founder_approval") && p.requiredReviewers.length >= 3).length,
    totalPackets,
  );
  const evidenceCoveragePercent = derivedPercent(
    packets.filter((p) => p.evidenceRefs.length >= 2).length,
    totalPackets,
  );
  const boundaryIncidentCount = packets.filter((p) => p.blockedReasons.length > 0).length;
  const founderDecisionQueue = buildFounderDecisionQueue(packets);

  // Merge upstream packet-level failures, then add scorecard-level failures derived from packets.
  const failures: { packetId: string; reason: string }[] = [...packetSummary.failures];

  pushScorecardFailure(failures, blockedCount > 0, `blocked_count:${blockedCount}`);
  pushScorecardFailure(failures, scopeViolationCount > 0, `scope_violation_count:${scopeViolationCount}`);
  pushScorecardFailure(failures, boundaryIncidentCount > 0, `boundary_incident_count:${boundaryIncidentCount}`);
  pushScorecardFailure(failures, promotionAuthorityLeakCount > 0, `promotion_authority_leak_count:${promotionAuthorityLeakCount}`);
  pushScorecardFailure(failures, runtimeAuthorityLeakCount > 0, `runtime_authority_leak_count:${runtimeAuthorityLeakCount}`);
  pushScorecardFailure(failures, evidenceCoveragePercent < 100, `evidence_coverage:${evidenceCoveragePercent}`);
  pushScorecardFailure(failures, requiredReviewerCoveragePercent < 100, `required_reviewer_coverage:${requiredReviewerCoveragePercent}`);
  pushScorecardFailure(failures, founderDecisionQueue.length === 0, "no_founder_decision_queue");

  const tenantMismatch = packets.some((p) => p.tenantKey !== TENANT_KEY);
  const workspaceMismatch = packets.some((p) => p.workspaceId !== WORKSPACE_ID);
  pushScorecardFailure(failures, tenantMismatch, `tenant_mismatch:expected_${TENANT_KEY}`);
  pushScorecardFailure(failures, workspaceMismatch, `workspace_mismatch:expected_${WORKSPACE_ID}`);

  const uniqueFailures = deduplicateFailures(failures);

  return {
    tenantKey: TENANT_KEY,
    workspaceId: WORKSPACE_ID,
    sourceWindowKey: SOURCE_WINDOW_KEY,
    totalPackets,
    readyForFounderReviewCount,
    needsRequiredReviewCount,
    blockedCount,
    requiredReviewerCoveragePercent,
    evidenceCoveragePercent,
    boundaryIncidentCount,
    promotionAuthorityLeakCount,
    runtimeAuthorityLeakCount,
    topMustPushIds: buildTopMustPushIds(packets),
    founderDecisionQueue,
    reviewerLoad: buildReviewerLoad(packets),
    nextActions: buildNextActions(packets),
    candidateOnly: true,
    runtimeAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    passed: uniqueFailures.length === 0,
    failures: uniqueFailures,
  };
}

export function runIntelligenceGrowthWeeklyScorecardEval(
  pack?: IntelligenceGrowthTenantSignalFixturePack,
): IntelligenceGrowthWeeklyScorecardSummary {
  const packetSummary: IntelligenceGrowthReviewPacketEvalSummary = pack
    ? runIntelligenceGrowthReviewPacketEval(pack)
    : runIntelligenceGrowthReviewPacketEval();

  return buildIntelligenceGrowthWeeklyScorecardFromPacketSummary(packetSummary);
}

function pushScorecardFailure(
  failures: { packetId: string; reason: string }[],
  failed: boolean,
  reason: string,
): void {
  if (failed) {
    failures.push({ packetId: "__scorecard__", reason });
  }
}

function deduplicateFailures(
  failures: readonly { packetId: string; reason: string }[],
): readonly { packetId: string; reason: string }[] {
  const seen = new Set<string>();
  return failures.filter((f) => {
    const key = `${f.packetId}:${f.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
