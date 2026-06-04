import type {
  PageDrilldownLink,
  PageNextAction,
  PageReportingProtocol,
} from "@/lib/presentation/reporting-protocol";
import { createPageReportingProtocol } from "@/lib/presentation/reporting-protocol";

export const commercialNarrativeStrengtheningLevels = [
  "recommendation-only",
  "exploratory-strengthening",
  "pilot-strengthening",
  "customer-visible-light",
  "customer-visible-structured",
  "review-before-send",
  "risk-reduction-required",
  "boundary-only",
  "non-commitment-fallback",
  "blocked-strengthening",
] as const;

export const commercialNarrativeStrengtheningIntents = [
  "clarify-fit",
  "warm-up-trust",
  "advance-pilot-story",
  "build-customer-confidence",
  "hold-review-line",
  "fallback-to-boundary",
  "reduce-risk",
] as const;

export const commercialNarrativeStrengtheningAudienceModes = [
  "customer-visible",
  "internal-only",
  "shared-review",
] as const;

export const commercialNarrativeStrengtheningFallbackModes = [
  "no-fallback",
  "boundary-only",
  "non-commitment-fallback",
  "review-hold",
  "blocked",
] as const;

export const commercialNarrativeStrengtheningSendabilityModes = [
  "safe-to-send",
  "safe-with-boundary",
  "discussion-only",
  "review-before-send",
  "not-safe-to-send",
  "internal-only",
  "non-commitment-fallback",
] as const;

export const commercialNarrativeStrengtheningRiskSignals = [
  "watch",
  "caution",
  "high",
] as const;

export const commercialNarrativeStrengtheningEvidenceGroupIds = [
  "replay",
  "audit",
  "memory",
  "worker_output",
  "boundary_trace",
  "sendability_trace",
  "strengthening_trace",
  "fallback_trace",
  "historical_changes",
] as const;

export type CommercialNarrativeStrengtheningLevel =
  (typeof commercialNarrativeStrengtheningLevels)[number];
export type CommercialNarrativeStrengtheningIntent =
  (typeof commercialNarrativeStrengtheningIntents)[number];
export type CommercialNarrativeStrengtheningAudienceMode =
  (typeof commercialNarrativeStrengtheningAudienceModes)[number];
export type CommercialNarrativeStrengtheningFallbackMode =
  (typeof commercialNarrativeStrengtheningFallbackModes)[number];
export type CommercialNarrativeStrengtheningSendabilityMode =
  (typeof commercialNarrativeStrengtheningSendabilityModes)[number];
export type CommercialNarrativeStrengtheningRiskSignal =
  (typeof commercialNarrativeStrengtheningRiskSignals)[number];
export type CommercialNarrativeStrengtheningEvidenceGroupId =
  (typeof commercialNarrativeStrengtheningEvidenceGroupIds)[number];

export type CommercialNarrativeStrengtheningEvidenceGroup = {
  groupId: CommercialNarrativeStrengtheningEvidenceGroupId;
  label: string;
  items: string[];
};

export type CommercialNarrativeStrengtheningDetailReportingContract = {
  strengtheningJudgement: string;
  strengtheningJudgementReason: string;
  strengtheningActionSummary: string[];
  strengtheningDecisionRequest: string[];
  strengtheningBoundarySummary: string[];
  strengtheningEvidenceSummary: string[];
  strengtheningWorkerSummary: string[];
  strengtheningNextAction: PageNextAction[];
  strengtheningRiskSignal: CommercialNarrativeStrengtheningRiskSignal;
  strengtheningLevel: CommercialNarrativeStrengtheningLevel;
  strengtheningIntent: CommercialNarrativeStrengtheningIntent;
  strengtheningAudienceMode: CommercialNarrativeStrengtheningAudienceMode;
  strengtheningFallbackMode: CommercialNarrativeStrengtheningFallbackMode;
  strengtheningSendabilityMode: CommercialNarrativeStrengtheningSendabilityMode;
  strengtheningEvidenceGroups: CommercialNarrativeStrengtheningEvidenceGroup[];
  strengtheningCustomerVisibleCue: string;
  strengtheningInternalOnlyCue: string;
  strengtheningFallbackCue: string;
  pageWhyItMatters: string[];
  pageEvidenceLinks?: PageDrilldownLink[];
  pageEscalationHint?: string;
};

export function createCommercialNarrativeStrengtheningDetailReportingContract(
  contract: CommercialNarrativeStrengtheningDetailReportingContract,
): CommercialNarrativeStrengtheningDetailReportingContract {
  validateSharedRules(contract);

  for (const field of [
    contract.strengtheningCustomerVisibleCue,
    contract.strengtheningInternalOnlyCue,
    contract.strengtheningFallbackCue,
  ]) {
    if (!field.trim()) {
      throw new Error(
        "commercial narrative strengthening cues must stay visible in the contract",
      );
    }
  }

  return contract;
}

export function toCommercialNarrativeStrengtheningPageReportingProtocol(
  contract: CommercialNarrativeStrengtheningDetailReportingContract,
  english = false,
): PageReportingProtocol {
  return createPageReportingProtocol({
    pageJudgement: contract.strengtheningJudgement,
    pageJudgementReason: contract.strengtheningJudgementReason,
    pageWhyItMatters: contract.pageWhyItMatters,
    pageActionSummary: contract.strengtheningActionSummary,
    pageDecisionRequest: contract.strengtheningDecisionRequest,
    pageNextAction: contract.strengtheningNextAction,
    pageBoundarySummary: contract.strengtheningBoundarySummary,
    pageEvidenceSummary: contract.strengtheningEvidenceSummary,
    pageWorkerSummary: contract.strengtheningWorkerSummary,
    pagePrioritySignal: labelForRiskSignal(
      contract.strengtheningRiskSignal,
      english,
    ),
    pageEscalationHint: contract.pageEscalationHint,
    pageEvidenceLinks: contract.pageEvidenceLinks,
  });
}

function validateSharedRules(
  contract: CommercialNarrativeStrengtheningDetailReportingContract,
) {
  if (!contract.strengtheningJudgement.trim()) {
    throw new Error("strengtheningJudgement must stay present");
  }

  if (!contract.strengtheningJudgementReason.trim()) {
    throw new Error("strengtheningJudgementReason must stay present");
  }

  if (
    contract.pageWhyItMatters.length < 2 ||
    contract.pageWhyItMatters.length > 3
  ) {
    throw new Error("pageWhyItMatters must keep 2 to 3 items");
  }

  if (!contract.strengtheningActionSummary.length) {
    throw new Error("strengtheningActionSummary must stay visible");
  }

  if (!contract.strengtheningDecisionRequest.length) {
    throw new Error("strengtheningDecisionRequest must stay visible");
  }

  if (!contract.strengtheningBoundarySummary.length) {
    throw new Error("strengtheningBoundarySummary must stay visible");
  }

  if (!contract.strengtheningEvidenceSummary.length) {
    throw new Error("strengtheningEvidenceSummary must stay visible");
  }

  if (!contract.strengtheningWorkerSummary.length) {
    throw new Error("strengtheningWorkerSummary must stay visible");
  }

  if (!contract.strengtheningNextAction.length) {
    throw new Error("strengtheningNextAction must keep at least one action");
  }

  const groupIds = new Set(
    contract.strengtheningEvidenceGroups.map((group) => group.groupId),
  );
  for (const groupId of commercialNarrativeStrengtheningEvidenceGroupIds) {
    if (!groupIds.has(groupId)) {
      throw new Error(`evidence group ${groupId} must stay present`);
    }
  }
}

function labelForRiskSignal(
  signal: CommercialNarrativeStrengtheningRiskSignal,
  english: boolean,
) {
  if (signal === "high") return english ? "High risk" : "高风险";
  if (signal === "caution") return english ? "Strengthen with caution" : "谨慎强化";
  return english ? "Keep watching" : "继续观察";
}
