import type {
  PageDrilldownLink,
  PageNextAction,
  PageReportingProtocol,
} from "@/lib/presentation/reporting-protocol";
import { createPageReportingProtocol } from "@/lib/presentation/reporting-protocol";

export const proposalPackageAudienceModes = [
  "internal_review",
  "customer_safe_review",
  "non_commitment_window",
] as const;

export const proposalPackageRiskSignals = [
  "watch",
  "caution",
  "high",
] as const;

export const proposalPackageEvidenceGroupIds = [
  "replay",
  "audit",
  "memory",
  "worker_output",
  "boundary_trace",
  "historical_changes",
] as const;

export type ProposalPackageAudienceMode =
  (typeof proposalPackageAudienceModes)[number];
export type ProposalPackageRiskSignal =
  (typeof proposalPackageRiskSignals)[number];
export type ProposalPackageEvidenceGroupId =
  (typeof proposalPackageEvidenceGroupIds)[number];

export type ProposalPackageEvidenceGroup = {
  groupId: ProposalPackageEvidenceGroupId;
  label: string;
  items: string[];
};

type ProposalPackageSharedContract = {
  pageWhyItMatters: string[];
  pageEvidenceLinks?: PageDrilldownLink[];
  pageEscalationHint?: string;
};

export type ProposalPageDetailReportingContract =
  ProposalPackageSharedContract & {
    proposalPageJudgement: string;
    proposalPageJudgementReason: string;
    proposalPageActionSummary: string[];
    proposalPageDecisionRequest: string[];
    proposalPageBoundarySummary: string[];
    proposalPageEvidenceSummary: string[];
    proposalPageWorkerSummary: string[];
    proposalPageNextAction: PageNextAction[];
    proposalPageRiskSignal: ProposalPackageRiskSignal;
    proposalPageAudienceMode: ProposalPackageAudienceMode;
    proposalPageEvidenceGroups: ProposalPackageEvidenceGroup[];
  };

export type PackagePageDetailReportingContract =
  ProposalPackageSharedContract & {
    packagePageJudgement: string;
    packagePageJudgementReason: string;
    packagePageActionSummary: string[];
    packagePageDecisionRequest: string[];
    packagePageBoundarySummary: string[];
    packagePageEvidenceSummary: string[];
    packagePageWorkerSummary: string[];
    packagePageNextAction: PageNextAction[];
    packagePageRiskSignal: ProposalPackageRiskSignal;
    packagePageAudienceMode: ProposalPackageAudienceMode;
    packagePageEvidenceGroups: ProposalPackageEvidenceGroup[];
    packagePageCollaborationMode:
      | "helm_drives_human_supervises"
      | "helm_prepares_human_decides"
      | "helm_reminds_human_leads";
    packagePageCollaborationSummary: string;
    packagePageCollaborationRequest: string;
    packagePageCollaborationNextStep: string[];
    packagePageCollaborationOwner: string;
  };

export function createProposalPageDetailReportingContract(
  contract: ProposalPageDetailReportingContract,
): ProposalPageDetailReportingContract {
  validateProposalPackageSharedRules({
    judgement: contract.proposalPageJudgement,
    reason: contract.proposalPageJudgementReason,
    whyItMatters: contract.pageWhyItMatters,
    actionSummary: contract.proposalPageActionSummary,
    decisionRequest: contract.proposalPageDecisionRequest,
    boundarySummary: contract.proposalPageBoundarySummary,
    evidenceSummary: contract.proposalPageEvidenceSummary,
    workerSummary: contract.proposalPageWorkerSummary,
    nextAction: contract.proposalPageNextAction,
    evidenceGroups: contract.proposalPageEvidenceGroups,
  });
  return contract;
}

export function createPackagePageDetailReportingContract(
  contract: PackagePageDetailReportingContract,
): PackagePageDetailReportingContract {
  validateProposalPackageSharedRules({
    judgement: contract.packagePageJudgement,
    reason: contract.packagePageJudgementReason,
    whyItMatters: contract.pageWhyItMatters,
    actionSummary: contract.packagePageActionSummary,
    decisionRequest: contract.packagePageDecisionRequest,
    boundarySummary: contract.packagePageBoundarySummary,
    evidenceSummary: contract.packagePageEvidenceSummary,
    workerSummary: contract.packagePageWorkerSummary,
    nextAction: contract.packagePageNextAction,
    evidenceGroups: contract.packagePageEvidenceGroups,
  });

  if (!contract.packagePageCollaborationSummary.trim()) {
    throw new Error("packagePageCollaborationSummary must stay present");
  }

  if (!contract.packagePageCollaborationRequest.trim()) {
    throw new Error("packagePageCollaborationRequest must stay present");
  }

  if (!contract.packagePageCollaborationOwner.trim()) {
    throw new Error("packagePageCollaborationOwner must stay present");
  }

  if (!contract.packagePageCollaborationNextStep.length) {
    throw new Error("packagePageCollaborationNextStep must keep at least one item");
  }

  return contract;
}

export function toProposalPageReportingProtocol(
  contract: ProposalPageDetailReportingContract,
  english = false,
): PageReportingProtocol {
  return createPageReportingProtocol({
    pageJudgement: contract.proposalPageJudgement,
    pageJudgementReason: contract.proposalPageJudgementReason,
    pageWhyItMatters: contract.pageWhyItMatters,
    pageActionSummary: contract.proposalPageActionSummary,
    pageDecisionRequest: contract.proposalPageDecisionRequest,
    pageNextAction: contract.proposalPageNextAction,
    pageBoundarySummary: contract.proposalPageBoundarySummary,
    pageEvidenceSummary: contract.proposalPageEvidenceSummary,
    pageWorkerSummary: contract.proposalPageWorkerSummary,
    pagePrioritySignal: labelForRiskSignal(contract.proposalPageRiskSignal, english),
    pageEscalationHint: contract.pageEscalationHint,
    pageEvidenceLinks: contract.pageEvidenceLinks,
  });
}

export function toPackagePageReportingProtocol(
  contract: PackagePageDetailReportingContract,
  english = false,
): PageReportingProtocol {
  return createPageReportingProtocol({
    pageJudgement: contract.packagePageJudgement,
    pageJudgementReason: contract.packagePageJudgementReason,
    pageWhyItMatters: contract.pageWhyItMatters,
    pageActionSummary: contract.packagePageActionSummary,
    pageDecisionRequest: contract.packagePageDecisionRequest,
    pageNextAction: contract.packagePageNextAction,
    pageBoundarySummary: contract.packagePageBoundarySummary,
    pageEvidenceSummary: contract.packagePageEvidenceSummary,
    pageWorkerSummary: contract.packagePageWorkerSummary,
    pagePrioritySignal: labelForRiskSignal(contract.packagePageRiskSignal, english),
    pageEscalationHint: contract.pageEscalationHint,
    pageEvidenceLinks: contract.pageEvidenceLinks,
  });
}

function validateProposalPackageSharedRules({
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
  evidenceGroups: ProposalPackageEvidenceGroup[];
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
  for (const groupId of proposalPackageEvidenceGroupIds) {
    if (!groupIds.has(groupId)) {
      throw new Error(`evidence group ${groupId} must stay present`);
    }
  }
}

function labelForRiskSignal(signal: ProposalPackageRiskSignal, english: boolean) {
  if (signal === "high") return english ? "High risk" : "高风险";
  if (signal === "caution") return english ? "Proceed with caution" : "谨慎推进";
  return english ? "Keep watching" : "继续观察";
}
