import type {
  PageDrilldownLink,
  PageNextAction,
  PageReportingProtocol,
} from "@/lib/presentation/reporting-protocol";
import {
  createPageReportingProtocol,
  reportingDensityLimits,
} from "@/lib/presentation/reporting-protocol";

export const customerSuccessHandoffStages = [
  "success-follow-through",
  "activation-follow-through",
  "review-follow-through",
  "expansion-review",
  "expansion-ready-but-blocked",
  "issue-follow-through",
  "escalation-follow-through",
  "internal-prep-only",
  "review-before-send",
  "blocked-by-boundary",
] as const;

export const customerSuccessAudienceModes = [
  "customer-success",
  "success-owner",
  "expansion-owner",
  "shared-review",
  "customer-visible",
  "internal-only",
] as const;

export const customerSuccessOwnershipModes = [
  "customer-success",
  "shared-with-sales",
  "shared-with-delivery",
  "shared-with-founder",
] as const;

export const customerSuccessSendabilityModes = [
  "customer-visible-with-boundary",
  "review-before-send",
  "internal-only",
  "boundary-only",
  "discussion-only",
] as const;

export const customerSuccessFallbackModes = [
  "no-fallback",
  "non-commitment-fallback",
  "internal-only",
  "blocked-by-boundary",
  "review-hold",
] as const;

export const customerSuccessRiskSignals = ["watch", "caution", "high"] as const;

export const customerSuccessEvidenceGroupIds = [
  "replay",
  "audit",
  "memory",
  "worker_output",
  "boundary_trace",
  "sendability_trace",
  "handoff_trace",
  "success_trace",
  "historical_changes",
] as const;

export type CustomerSuccessHandoffStage =
  (typeof customerSuccessHandoffStages)[number];
export type CustomerSuccessAudienceMode =
  (typeof customerSuccessAudienceModes)[number];
export type CustomerSuccessOwnershipMode =
  (typeof customerSuccessOwnershipModes)[number];
export type CustomerSuccessSendabilityMode =
  (typeof customerSuccessSendabilityModes)[number];
export type CustomerSuccessFallbackMode =
  (typeof customerSuccessFallbackModes)[number];
export type CustomerSuccessRiskSignal =
  (typeof customerSuccessRiskSignals)[number];
export type CustomerSuccessEvidenceGroupId =
  (typeof customerSuccessEvidenceGroupIds)[number];

export type CustomerSuccessEvidenceGroup = {
  groupId: CustomerSuccessEvidenceGroupId;
  label: string;
  items: string[];
};

type SharedCustomerSuccessDetailFields = {
  pageWhyItMatters: string[];
  pageEvidenceLinks?: PageDrilldownLink[];
  pageEscalationHint?: string;
};

export type CustomerSuccessHandoffSurfaceContract =
  SharedCustomerSuccessDetailFields & {
    customerSuccessHandoffJudgement: string;
    customerSuccessHandoffReason: string;
    customerSuccessHandoffSummary: string[];
    customerSuccessHandoffBoundary: string[];
    customerSuccessHandoffWorkerSummary: string[];
    customerSuccessHandoffEvidenceSummary: string[];
    customerSuccessHandoffDecisionRequest: string[];
    customerSuccessHandoffNextAction: PageNextAction[];
    customerSuccessHandoffRiskSignal: CustomerSuccessRiskSignal;
    customerSuccessHandoffAudienceMode?: CustomerSuccessAudienceMode;
    customerSuccessHandoffOwnership?: CustomerSuccessOwnershipMode;
    customerSuccessHandoffStage: CustomerSuccessHandoffStage;
    customerSuccessHandoffEvidenceGroups?: CustomerSuccessEvidenceGroup[];
  };

export type CustomerSuccessDetailReportingContract =
  SharedCustomerSuccessDetailFields & {
    customerSuccessDetailJudgement: string;
    customerSuccessDetailReason: string;
    customerSuccessDetailActionSummary: string[];
    customerSuccessDetailDecision: string[];
    customerSuccessDetailDecisionRequest: string[];
    customerSuccessDetailBoundarySummary: string[];
    customerSuccessDetailEvidenceSummary: string[];
    customerSuccessDetailWorkerSummary: string[];
    customerSuccessDetailNextAction: PageNextAction[];
    customerSuccessDetailRiskSignal: CustomerSuccessRiskSignal;
    customerSuccessDetailAudienceMode?: CustomerSuccessAudienceMode;
    customerSuccessDetailStage: CustomerSuccessHandoffStage;
    customerSuccessDetailSendabilityMode?: CustomerSuccessSendabilityMode;
    customerSuccessDetailFallbackMode?: CustomerSuccessFallbackMode;
    customerSuccessDetailEvidenceGroups?: CustomerSuccessEvidenceGroup[];
  };

export function createCustomerSuccessHandoffSurfaceContract(
  contract: CustomerSuccessHandoffSurfaceContract,
): CustomerSuccessHandoffSurfaceContract {
  validateSharedFields({
    judgement: contract.customerSuccessHandoffJudgement,
    reason: contract.customerSuccessHandoffReason,
    actionSummary: contract.customerSuccessHandoffSummary,
    decisionRequest: contract.customerSuccessHandoffDecisionRequest,
    boundarySummary: contract.customerSuccessHandoffBoundary,
    evidenceSummary: contract.customerSuccessHandoffEvidenceSummary,
    workerSummary: contract.customerSuccessHandoffWorkerSummary,
    nextAction: contract.customerSuccessHandoffNextAction,
    evidenceGroups: contract.customerSuccessHandoffEvidenceGroups,
    pageWhyItMatters: contract.pageWhyItMatters,
  });
  return contract;
}

export function createCustomerSuccessDetailReportingContract(
  contract: CustomerSuccessDetailReportingContract,
): CustomerSuccessDetailReportingContract {
  validateSharedFields({
    judgement: contract.customerSuccessDetailJudgement,
    reason: contract.customerSuccessDetailReason,
    actionSummary: contract.customerSuccessDetailActionSummary,
    decision: contract.customerSuccessDetailDecision,
    decisionRequest: contract.customerSuccessDetailDecisionRequest,
    boundarySummary: contract.customerSuccessDetailBoundarySummary,
    evidenceSummary: contract.customerSuccessDetailEvidenceSummary,
    workerSummary: contract.customerSuccessDetailWorkerSummary,
    nextAction: contract.customerSuccessDetailNextAction,
    evidenceGroups: contract.customerSuccessDetailEvidenceGroups,
    pageWhyItMatters: contract.pageWhyItMatters,
  });
  return contract;
}

export function toCustomerSuccessHandoffPageReportingProtocol(
  contract: CustomerSuccessHandoffSurfaceContract,
): PageReportingProtocol {
  return createPageReportingProtocol({
    pageJudgement: contract.customerSuccessHandoffJudgement,
    pageJudgementReason: contract.customerSuccessHandoffReason,
    pageWhyItMatters: contract.pageWhyItMatters,
    pageActionSummary: contract.customerSuccessHandoffSummary,
    pageDecisionRequest: contract.customerSuccessHandoffDecisionRequest,
    pageNextAction: contract.customerSuccessHandoffNextAction,
    pageBoundarySummary: contract.customerSuccessHandoffBoundary,
    pageEvidenceSummary: contract.customerSuccessHandoffEvidenceSummary,
    pageWorkerSummary: contract.customerSuccessHandoffWorkerSummary,
    pagePrioritySignal: labelForRiskSignal(
      contract.customerSuccessHandoffRiskSignal,
    ),
    pageEscalationHint: contract.pageEscalationHint,
    pageEvidenceLinks: contract.pageEvidenceLinks,
  });
}

export function toCustomerSuccessDetailPageReportingProtocol(
  contract: CustomerSuccessDetailReportingContract,
): PageReportingProtocol {
  return createPageReportingProtocol({
    pageJudgement: contract.customerSuccessDetailJudgement,
    pageJudgementReason: contract.customerSuccessDetailReason,
    pageWhyItMatters: contract.pageWhyItMatters,
    pageActionSummary: contract.customerSuccessDetailActionSummary,
    pageDecisionRequest: contract.customerSuccessDetailDecisionRequest,
    pageNextAction: contract.customerSuccessDetailNextAction,
    pageBoundarySummary: contract.customerSuccessDetailBoundarySummary,
    pageEvidenceSummary: contract.customerSuccessDetailEvidenceSummary,
    pageWorkerSummary: contract.customerSuccessDetailWorkerSummary,
    pagePrioritySignal: labelForRiskSignal(
      contract.customerSuccessDetailRiskSignal,
    ),
    pageEscalationHint: contract.pageEscalationHint,
    pageEvidenceLinks: contract.pageEvidenceLinks,
  });
}

function validateSharedFields({
  judgement,
  reason,
  actionSummary,
  decision,
  decisionRequest,
  boundarySummary,
  evidenceSummary,
  workerSummary,
  nextAction,
  evidenceGroups,
  pageWhyItMatters,
}: {
  judgement: string;
  reason: string;
  actionSummary: string[];
  decision?: string[];
  decisionRequest: string[];
  boundarySummary: string[];
  evidenceSummary: string[];
  workerSummary: string[];
  nextAction: PageNextAction[];
  evidenceGroups?: CustomerSuccessEvidenceGroup[];
  pageWhyItMatters: string[];
}) {
  if (!judgement.trim()) {
    throw new Error("customer success judgement must stay present");
  }

  if (!reason.trim()) {
    throw new Error("customer success reason must stay present");
  }

  if (pageWhyItMatters.length < 2 || pageWhyItMatters.length > 3) {
    throw new Error("pageWhyItMatters must keep 2 to 3 items");
  }

  if (!actionSummary.length) {
    throw new Error("customer success action summary must stay visible");
  }

  if (decision && !decision.length) {
    throw new Error("customer success decision framing must stay visible");
  }

  if (!decisionRequest.length) {
    throw new Error("customer success decision request must stay visible");
  }

  if (!boundarySummary.length) {
    throw new Error("customer success boundary summary must stay visible");
  }

  if (boundarySummary.length > reportingDensityLimits.boundaryMax) {
    throw new Error(
      `customer success boundary summary cannot exceed ${reportingDensityLimits.boundaryMax} items`,
    );
  }

  if (!evidenceSummary.length) {
    throw new Error("customer success evidence summary must stay visible");
  }

  if (!workerSummary.length) {
    throw new Error("customer success worker summary must stay visible");
  }

  if (!nextAction.length) {
    throw new Error("customer success next action must keep at least one action");
  }

  if (nextAction.length > reportingDensityLimits.nextActionMax) {
    throw new Error(
      `customer success next action cannot exceed ${reportingDensityLimits.nextActionMax} items`,
    );
  }

  const primaryActions = nextAction.filter(
    (item) => item.variant === undefined || item.variant === "default",
  );
  const secondaryActions = nextAction.filter(
    (item) => item.variant === "secondary" || item.variant === "ghost",
  );

  if (primaryActions.length !== reportingDensityLimits.nextActionPrimaryCount) {
    throw new Error(
      `customer success next action must keep exactly ${reportingDensityLimits.nextActionPrimaryCount} primary action`,
    );
  }

  if (
    secondaryActions.length > reportingDensityLimits.nextActionSecondaryMax
  ) {
    throw new Error(
      `customer success next action can only keep ${reportingDensityLimits.nextActionSecondaryMax} secondary actions`,
    );
  }

  for (const group of evidenceGroups ?? []) {
    if (!group.label.trim()) {
      throw new Error("customer success evidence groups must keep a visible label");
    }

    if (!group.items.length) {
      throw new Error("customer success evidence groups must keep visible items");
    }
  }
}

function labelForRiskSignal(signal: CustomerSuccessRiskSignal) {
  if (signal === "high") return "高风险接手";
  if (signal === "caution") return "谨慎跟进";
  return "继续观察";
}
