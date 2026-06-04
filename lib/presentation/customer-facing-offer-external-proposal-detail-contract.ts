import type {
  PageDrilldownLink,
  PageNextAction,
  PageReportingProtocol,
} from "@/lib/presentation/reporting-protocol";
import { createPageReportingProtocol } from "@/lib/presentation/reporting-protocol";

export const customerFacingOfferExternalProposalSendabilityModes = [
  "safe_to_send",
  "safe_with_boundary",
  "safe_with_prerequisite",
  "safe_with_dependency",
  "discussion_only",
  "review_before_send",
  "not_safe_to_send",
] as const;

export const customerFacingOfferExternalProposalRiskSignals = [
  "watch",
  "caution",
  "high",
] as const;

export const customerFacingOfferExternalProposalEvidenceGroupIds = [
  "replay",
  "audit",
  "memory",
  "worker_output",
  "boundary_trace",
  "sendability_trace",
  "historical_changes",
] as const;

export type CustomerFacingOfferExternalProposalSendabilityMode =
  (typeof customerFacingOfferExternalProposalSendabilityModes)[number];
export type CustomerFacingOfferExternalProposalRiskSignal =
  (typeof customerFacingOfferExternalProposalRiskSignals)[number];
export type CustomerFacingOfferExternalProposalEvidenceGroupId =
  (typeof customerFacingOfferExternalProposalEvidenceGroupIds)[number];

export type CustomerFacingOfferExternalProposalEvidenceGroup = {
  groupId: CustomerFacingOfferExternalProposalEvidenceGroupId;
  label: string;
  items: string[];
};

type CustomerFacingOfferExternalProposalSharedContract = {
  pageWhyItMatters: string[];
  pageEvidenceLinks?: PageDrilldownLink[];
  pageEscalationHint?: string;
};

export type CustomerFacingOfferPageDetailReportingContract =
  CustomerFacingOfferExternalProposalSharedContract & {
    customerOfferPageJudgement: string;
    customerOfferPageJudgementReason: string;
    customerOfferPageActionSummary: string[];
    customerOfferPageDecisionRequest: string[];
    customerOfferPageBoundarySummary: string[];
    customerOfferPageEvidenceSummary: string[];
    customerOfferPageWorkerSummary: string[];
    customerOfferPageNextAction: PageNextAction[];
    customerOfferPageRiskSignal: CustomerFacingOfferExternalProposalRiskSignal;
    customerOfferPageSendabilityMode: CustomerFacingOfferExternalProposalSendabilityMode;
    customerOfferPageEvidenceGroups: CustomerFacingOfferExternalProposalEvidenceGroup[];
    customerOfferPageCustomerFacingCue: string;
    customerOfferPageInternalOnlyCue: string;
    customerOfferPageNonCommitmentCue: string;
  };

export type ExternalProposalPageDetailReportingContract =
  CustomerFacingOfferExternalProposalSharedContract & {
    externalProposalPageJudgement: string;
    externalProposalPageJudgementReason: string;
    externalProposalPageActionSummary: string[];
    externalProposalPageDecisionRequest: string[];
    externalProposalPageBoundarySummary: string[];
    externalProposalPageEvidenceSummary: string[];
    externalProposalPageWorkerSummary: string[];
    externalProposalPageNextAction: PageNextAction[];
    externalProposalPageRiskSignal: CustomerFacingOfferExternalProposalRiskSignal;
    externalProposalPageSendabilityMode: CustomerFacingOfferExternalProposalSendabilityMode;
    externalProposalPageEvidenceGroups: CustomerFacingOfferExternalProposalEvidenceGroup[];
    externalProposalPageCustomerFacingCue: string;
    externalProposalPageInternalOnlyCue: string;
    externalProposalPageNonCommitmentCue: string;
    externalProposalPageCollaborationMode:
      | "helm_drives_human_supervises"
      | "helm_prepares_human_decides"
      | "helm_reminds_human_leads";
    externalProposalPageCollaborationSummary: string;
    externalProposalPageCollaborationRequest: string;
    externalProposalPageCollaborationNextStep: string[];
    externalProposalPageCollaborationOwner: string;
  };

export function createCustomerFacingOfferPageDetailReportingContract(
  contract: CustomerFacingOfferPageDetailReportingContract,
): CustomerFacingOfferPageDetailReportingContract {
  validateSharedRules({
    judgement: contract.customerOfferPageJudgement,
    reason: contract.customerOfferPageJudgementReason,
    whyItMatters: contract.pageWhyItMatters,
    actionSummary: contract.customerOfferPageActionSummary,
    decisionRequest: contract.customerOfferPageDecisionRequest,
    boundarySummary: contract.customerOfferPageBoundarySummary,
    evidenceSummary: contract.customerOfferPageEvidenceSummary,
    workerSummary: contract.customerOfferPageWorkerSummary,
    nextAction: contract.customerOfferPageNextAction,
    evidenceGroups: contract.customerOfferPageEvidenceGroups,
  });

  for (const field of [
    contract.customerOfferPageCustomerFacingCue,
    contract.customerOfferPageInternalOnlyCue,
    contract.customerOfferPageNonCommitmentCue,
  ]) {
    if (!field.trim()) {
      throw new Error(
        "customer-facing offer page cues must stay visible in the contract",
      );
    }
  }

  return contract;
}

export function createExternalProposalPageDetailReportingContract(
  contract: ExternalProposalPageDetailReportingContract,
): ExternalProposalPageDetailReportingContract {
  validateSharedRules({
    judgement: contract.externalProposalPageJudgement,
    reason: contract.externalProposalPageJudgementReason,
    whyItMatters: contract.pageWhyItMatters,
    actionSummary: contract.externalProposalPageActionSummary,
    decisionRequest: contract.externalProposalPageDecisionRequest,
    boundarySummary: contract.externalProposalPageBoundarySummary,
    evidenceSummary: contract.externalProposalPageEvidenceSummary,
    workerSummary: contract.externalProposalPageWorkerSummary,
    nextAction: contract.externalProposalPageNextAction,
    evidenceGroups: contract.externalProposalPageEvidenceGroups,
  });

  for (const field of [
    contract.externalProposalPageCustomerFacingCue,
    contract.externalProposalPageInternalOnlyCue,
    contract.externalProposalPageNonCommitmentCue,
    contract.externalProposalPageCollaborationSummary,
    contract.externalProposalPageCollaborationRequest,
    contract.externalProposalPageCollaborationOwner,
  ]) {
    if (!field.trim()) {
      throw new Error(
        "external proposal page cues and collaboration summary must stay visible",
      );
    }
  }

  if (!contract.externalProposalPageCollaborationNextStep.length) {
    throw new Error(
      "externalProposalPageCollaborationNextStep must keep at least one item",
    );
  }

  return contract;
}

export function toCustomerFacingOfferPageReportingProtocol(
  contract: CustomerFacingOfferPageDetailReportingContract,
  english = false,
): PageReportingProtocol {
  return createPageReportingProtocol({
    pageJudgement: contract.customerOfferPageJudgement,
    pageJudgementReason: contract.customerOfferPageJudgementReason,
    pageWhyItMatters: contract.pageWhyItMatters,
    pageActionSummary: contract.customerOfferPageActionSummary,
    pageDecisionRequest: contract.customerOfferPageDecisionRequest,
    pageNextAction: contract.customerOfferPageNextAction,
    pageBoundarySummary: contract.customerOfferPageBoundarySummary,
    pageEvidenceSummary: contract.customerOfferPageEvidenceSummary,
    pageWorkerSummary: contract.customerOfferPageWorkerSummary,
    pagePrioritySignal: labelForRiskSignal(
      contract.customerOfferPageRiskSignal,
      english,
    ),
    pageEscalationHint: contract.pageEscalationHint,
    pageEvidenceLinks: contract.pageEvidenceLinks,
  });
}

export function toExternalProposalPageReportingProtocol(
  contract: ExternalProposalPageDetailReportingContract,
  english = false,
): PageReportingProtocol {
  return createPageReportingProtocol({
    pageJudgement: contract.externalProposalPageJudgement,
    pageJudgementReason: contract.externalProposalPageJudgementReason,
    pageWhyItMatters: contract.pageWhyItMatters,
    pageActionSummary: contract.externalProposalPageActionSummary,
    pageDecisionRequest: contract.externalProposalPageDecisionRequest,
    pageNextAction: contract.externalProposalPageNextAction,
    pageBoundarySummary: contract.externalProposalPageBoundarySummary,
    pageEvidenceSummary: contract.externalProposalPageEvidenceSummary,
    pageWorkerSummary: contract.externalProposalPageWorkerSummary,
    pagePrioritySignal: labelForRiskSignal(
      contract.externalProposalPageRiskSignal,
      english,
    ),
    pageEscalationHint: contract.pageEscalationHint,
    pageEvidenceLinks: contract.pageEvidenceLinks,
  });
}

function validateSharedRules({
  judgement,
  reason,
  whyItMatters,
  actionSummary,
  decisionRequest,
  boundarySummary,
  evidenceSummary,
  workerSummary,
  nextAction,
  evidenceGroups,
}: {
  judgement: string;
  reason: string;
  whyItMatters: string[];
  actionSummary: string[];
  decisionRequest: string[];
  boundarySummary: string[];
  evidenceSummary: string[];
  workerSummary: string[];
  nextAction: PageNextAction[];
  evidenceGroups: CustomerFacingOfferExternalProposalEvidenceGroup[];
}) {
  if (!judgement.trim()) {
    throw new Error("page judgement must stay present");
  }

  if (!reason.trim()) {
    throw new Error("page judgement reason must stay present");
  }

  if (whyItMatters.length < 2 || whyItMatters.length > 3) {
    throw new Error("pageWhyItMatters must keep 2 to 3 items");
  }

  if (!actionSummary.length) {
    throw new Error("pageActionSummary must keep at least one item");
  }

  if (!decisionRequest.length) {
    throw new Error("pageDecisionRequest must keep at least one item");
  }

  if (!boundarySummary.length) {
    throw new Error("pageBoundarySummary must stay visible");
  }

  if (!evidenceSummary.length) {
    throw new Error("pageEvidenceSummary must stay visible");
  }

  if (!workerSummary.length) {
    throw new Error("pageWorkerSummary must stay visible");
  }

  if (!nextAction.length) {
    throw new Error("pageNextAction must keep at least one action");
  }

  const groupIds = new Set(evidenceGroups.map((group) => group.groupId));
  for (const groupId of customerFacingOfferExternalProposalEvidenceGroupIds) {
    if (!groupIds.has(groupId)) {
      throw new Error(`evidence group ${groupId} must stay present`);
    }
  }
}

function labelForRiskSignal(
  signal: CustomerFacingOfferExternalProposalRiskSignal,
  english: boolean,
) {
  if (signal === "high") return english ? "High risk" : "高风险";
  if (signal === "caution") return english ? "Send with caution" : "谨慎外发";
  return english ? "Keep watching" : "继续观察";
}
