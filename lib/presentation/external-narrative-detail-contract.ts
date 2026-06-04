import type {
  PageDrilldownLink,
  PageNextAction,
  PageReportingProtocol,
} from "@/lib/presentation/reporting-protocol";
import { createPageReportingProtocol } from "@/lib/presentation/reporting-protocol";

export const externalNarrativeDetailAudienceModes = [
  "founder-led",
  "sales-led",
  "delivery-led",
  "shared-review",
  "internal-only",
  "customer-visible",
] as const;

export const externalNarrativeDetailIntents = [
  "frame-internally",
  "support-proposal",
  "support-strengthening",
  "warm-up-trust",
  "hold-review-line",
  "fallback-to-boundary",
  "reduce-risk",
] as const;

export const externalNarrativeDetailLevels = [
  "internal-framing",
  "customer-visible-light",
  "customer-visible-structured",
  "exploratory-narrative",
  "proposal-supporting-narrative",
  "strengthening-narrative",
  "review-before-send",
  "boundary-only",
  "non-commitment-fallback",
  "blocked-narrative",
] as const;

export const externalNarrativeDetailFallbackModes = [
  "no-fallback",
  "boundary-only",
  "non-commitment-fallback",
  "review-hold",
  "blocked",
] as const;

export const externalNarrativeDetailSendabilityModes = [
  "safe-to-send",
  "safe-with-boundary",
  "discussion-only",
  "review-before-send",
  "not-safe-to-send",
  "internal-only",
  "non-commitment-fallback",
] as const;

export const externalNarrativeDetailRiskSignals = [
  "watch",
  "caution",
  "high",
] as const;

export const externalNarrativeDetailEvidenceGroupIds = [
  "replay",
  "audit",
  "memory",
  "worker_output",
  "boundary_trace",
  "sendability_trace",
  "narrative_trace",
  "fallback_trace",
  "historical_changes",
] as const;

export type ExternalNarrativeDetailAudienceMode =
  (typeof externalNarrativeDetailAudienceModes)[number];
export type ExternalNarrativeDetailIntent =
  (typeof externalNarrativeDetailIntents)[number];
export type ExternalNarrativeDetailLevel =
  (typeof externalNarrativeDetailLevels)[number];
export type ExternalNarrativeDetailFallbackMode =
  (typeof externalNarrativeDetailFallbackModes)[number];
export type ExternalNarrativeDetailSendabilityMode =
  (typeof externalNarrativeDetailSendabilityModes)[number];
export type ExternalNarrativeDetailRiskSignal =
  (typeof externalNarrativeDetailRiskSignals)[number];
export type ExternalNarrativeDetailEvidenceGroupId =
  (typeof externalNarrativeDetailEvidenceGroupIds)[number];

export type ExternalNarrativeDetailEvidenceGroup = {
  groupId: ExternalNarrativeDetailEvidenceGroupId;
  label: string;
  items: string[];
};

export type ExternalNarrativeDetailReportingContract = {
  externalNarrativeDetailJudgement: string;
  externalNarrativeDetailJudgementReason: string;
  externalNarrativeDetailActionSummary: string[];
  externalNarrativeDetailDecisionRequest: string[];
  externalNarrativeDetailBoundarySummary: string[];
  externalNarrativeDetailEvidenceSummary: string[];
  externalNarrativeDetailWorkerSummary: string[];
  externalNarrativeDetailNextAction: PageNextAction[];
  externalNarrativeDetailRiskSignal: ExternalNarrativeDetailRiskSignal;
  externalNarrativeDetailAudienceMode: ExternalNarrativeDetailAudienceMode;
  externalNarrativeDetailIntent: ExternalNarrativeDetailIntent;
  externalNarrativeDetailLevel: ExternalNarrativeDetailLevel;
  externalNarrativeDetailFallbackMode: ExternalNarrativeDetailFallbackMode;
  externalNarrativeDetailSendabilityMode: ExternalNarrativeDetailSendabilityMode;
  externalNarrativeDetailEvidenceGroups: ExternalNarrativeDetailEvidenceGroup[];
  externalNarrativeDetailFounderCue: string;
  externalNarrativeDetailSalesCue: string;
  externalNarrativeDetailDeliveryCue: string;
  pageWhyItMatters: string[];
  pageEvidenceLinks?: PageDrilldownLink[];
  pageEscalationHint?: string;
};

export function createExternalNarrativeDetailReportingContract(
  contract: ExternalNarrativeDetailReportingContract,
): ExternalNarrativeDetailReportingContract {
  validateSharedRules(contract);

  for (const field of [
    contract.externalNarrativeDetailFounderCue,
    contract.externalNarrativeDetailSalesCue,
    contract.externalNarrativeDetailDeliveryCue,
  ]) {
    if (!field.trim()) {
      throw new Error(
        "external narrative role cues must stay visible in the contract",
      );
    }
  }

  return contract;
}

export function toExternalNarrativeDetailPageReportingProtocol(
  contract: ExternalNarrativeDetailReportingContract,
  english = false,
): PageReportingProtocol {
  return createPageReportingProtocol({
    pageJudgement: contract.externalNarrativeDetailJudgement,
    pageJudgementReason: contract.externalNarrativeDetailJudgementReason,
    pageWhyItMatters: contract.pageWhyItMatters,
    pageActionSummary: contract.externalNarrativeDetailActionSummary,
    pageDecisionRequest: contract.externalNarrativeDetailDecisionRequest,
    pageNextAction: contract.externalNarrativeDetailNextAction,
    pageBoundarySummary: contract.externalNarrativeDetailBoundarySummary,
    pageEvidenceSummary: contract.externalNarrativeDetailEvidenceSummary,
    pageWorkerSummary: contract.externalNarrativeDetailWorkerSummary,
    pagePrioritySignal: labelForRiskSignal(
      contract.externalNarrativeDetailRiskSignal,
      english,
    ),
    pageEscalationHint: contract.pageEscalationHint,
    pageEvidenceLinks: contract.pageEvidenceLinks,
  });
}

function validateSharedRules(contract: ExternalNarrativeDetailReportingContract) {
  if (!contract.externalNarrativeDetailJudgement.trim()) {
    throw new Error("externalNarrativeDetailJudgement must stay present");
  }

  if (!contract.externalNarrativeDetailJudgementReason.trim()) {
    throw new Error("externalNarrativeDetailJudgementReason must stay present");
  }

  if (
    contract.pageWhyItMatters.length < 2 ||
    contract.pageWhyItMatters.length > 3
  ) {
    throw new Error("pageWhyItMatters must keep 2 to 3 items");
  }

  if (!contract.externalNarrativeDetailActionSummary.length) {
    throw new Error("externalNarrativeDetailActionSummary must stay visible");
  }

  if (!contract.externalNarrativeDetailDecisionRequest.length) {
    throw new Error("externalNarrativeDetailDecisionRequest must stay visible");
  }

  if (!contract.externalNarrativeDetailBoundarySummary.length) {
    throw new Error("externalNarrativeDetailBoundarySummary must stay visible");
  }

  if (!contract.externalNarrativeDetailEvidenceSummary.length) {
    throw new Error("externalNarrativeDetailEvidenceSummary must stay visible");
  }

  if (!contract.externalNarrativeDetailWorkerSummary.length) {
    throw new Error("externalNarrativeDetailWorkerSummary must stay visible");
  }

  if (!contract.externalNarrativeDetailNextAction.length) {
    throw new Error(
      "externalNarrativeDetailNextAction must keep at least one action",
    );
  }

  const groupIds = new Set(
    contract.externalNarrativeDetailEvidenceGroups.map((group) => group.groupId),
  );
  for (const groupId of externalNarrativeDetailEvidenceGroupIds) {
    if (!groupIds.has(groupId)) {
      throw new Error(`evidence group ${groupId} must stay present`);
    }
  }
}

function labelForRiskSignal(
  signal: ExternalNarrativeDetailRiskSignal,
  english: boolean,
) {
  if (signal === "high") return english ? "High risk" : "高风险";
  if (signal === "caution") return english ? "Express with caution" : "谨慎表达";
  return english ? "Keep watching" : "继续观察";
}
