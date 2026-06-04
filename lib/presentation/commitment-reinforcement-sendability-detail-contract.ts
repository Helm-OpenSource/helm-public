import type {
  PageDrilldownLink,
  PageNextAction,
  PageReportingProtocol,
} from "@/lib/presentation/reporting-protocol";
import { createPageReportingProtocol } from "@/lib/presentation/reporting-protocol";

export const commitmentReinforcementStrengthModes = [
  "no-reinforcement",
  "internal-reinforcement-only",
  "customer-visible-reinforcement",
  "reinforcement-after-review",
  "reinforcement-after-risk-reduction",
  "reinforcement-blocked",
  "reinforcement-deferred",
  "boundary-only-reinforcement",
] as const;

export const sendabilityPageModes = [
  "safe-to-send",
  "safe-with-boundary",
  "safe-with-prerequisite",
  "safe-with-dependency",
  "safe-with-risk-note",
  "discussion-only",
  "review-before-send",
  "not-safe-to-send",
  "internal-only",
] as const;

export const commitmentReinforcementSendabilityRiskSignals = [
  "watch",
  "caution",
  "high",
] as const;

export const commitmentReinforcementSendabilityEvidenceGroupIds = [
  "replay",
  "audit",
  "memory",
  "worker_output",
  "boundary_trace",
  "sendability_trace",
  "reinforcement_trace",
  "historical_changes",
] as const;

export type CommitmentReinforcementStrengthMode =
  (typeof commitmentReinforcementStrengthModes)[number];
export type SendabilityPageMode = (typeof sendabilityPageModes)[number];
export type CommitmentReinforcementSendabilityRiskSignal =
  (typeof commitmentReinforcementSendabilityRiskSignals)[number];
export type CommitmentReinforcementSendabilityEvidenceGroupId =
  (typeof commitmentReinforcementSendabilityEvidenceGroupIds)[number];

export type CommitmentReinforcementSendabilityEvidenceGroup = {
  groupId: CommitmentReinforcementSendabilityEvidenceGroupId;
  label: string;
  items: string[];
};

type SharedContract = {
  pageWhyItMatters: string[];
  pageEvidenceLinks?: PageDrilldownLink[];
  pageEscalationHint?: string;
};

export type CommitmentReinforcementPageDetailReportingContract =
  SharedContract & {
    reinforcementPageJudgement: string;
    reinforcementPageJudgementReason: string;
    reinforcementPageActionSummary: string[];
    reinforcementPageDecisionRequest: string[];
    reinforcementPageBoundarySummary: string[];
    reinforcementPageEvidenceSummary: string[];
    reinforcementPageWorkerSummary: string[];
    reinforcementPageNextAction: PageNextAction[];
    reinforcementPageRiskSignal: CommitmentReinforcementSendabilityRiskSignal;
    reinforcementPageStrengthMode: CommitmentReinforcementStrengthMode;
    reinforcementPageSendabilityMode: SendabilityPageMode;
    reinforcementPageEvidenceGroups: CommitmentReinforcementSendabilityEvidenceGroup[];
    reinforcementPageCustomerVisibleCue: string;
    reinforcementPageInternalOnlyCue: string;
    reinforcementPageNonCommitmentCue: string;
  };

export type SendabilityPageDetailReportingContract = SharedContract & {
  sendabilityPageJudgement: string;
  sendabilityPageJudgementReason: string;
  sendabilityPageActionSummary: string[];
  sendabilityPageDecisionRequest: string[];
  sendabilityPageBoundarySummary: string[];
  sendabilityPageEvidenceSummary: string[];
  sendabilityPageWorkerSummary: string[];
  sendabilityPageNextAction: PageNextAction[];
  sendabilityPageRiskSignal: CommitmentReinforcementSendabilityRiskSignal;
  sendabilityPageMode: SendabilityPageMode;
  sendabilityPageStrengthMode: CommitmentReinforcementStrengthMode;
  sendabilityPageEvidenceGroups: CommitmentReinforcementSendabilityEvidenceGroup[];
  sendabilityPageCustomerVisibleCue: string;
  sendabilityPageInternalOnlyCue: string;
  sendabilityPageNonCommitmentCue: string;
};

export function createCommitmentReinforcementPageDetailReportingContract(
  contract: CommitmentReinforcementPageDetailReportingContract,
): CommitmentReinforcementPageDetailReportingContract {
  validateSharedRules({
    judgement: contract.reinforcementPageJudgement,
    reason: contract.reinforcementPageJudgementReason,
    whyItMatters: contract.pageWhyItMatters,
    actionSummary: contract.reinforcementPageActionSummary,
    decisionRequest: contract.reinforcementPageDecisionRequest,
    boundarySummary: contract.reinforcementPageBoundarySummary,
    evidenceSummary: contract.reinforcementPageEvidenceSummary,
    workerSummary: contract.reinforcementPageWorkerSummary,
    nextAction: contract.reinforcementPageNextAction,
    evidenceGroups: contract.reinforcementPageEvidenceGroups,
  });

  for (const field of [
    contract.reinforcementPageCustomerVisibleCue,
    contract.reinforcementPageInternalOnlyCue,
    contract.reinforcementPageNonCommitmentCue,
  ]) {
    if (!field.trim()) {
      throw new Error(
        "commitment reinforcement page cues must stay visible in the contract",
      );
    }
  }

  return contract;
}

export function createSendabilityPageDetailReportingContract(
  contract: SendabilityPageDetailReportingContract,
): SendabilityPageDetailReportingContract {
  validateSharedRules({
    judgement: contract.sendabilityPageJudgement,
    reason: contract.sendabilityPageJudgementReason,
    whyItMatters: contract.pageWhyItMatters,
    actionSummary: contract.sendabilityPageActionSummary,
    decisionRequest: contract.sendabilityPageDecisionRequest,
    boundarySummary: contract.sendabilityPageBoundarySummary,
    evidenceSummary: contract.sendabilityPageEvidenceSummary,
    workerSummary: contract.sendabilityPageWorkerSummary,
    nextAction: contract.sendabilityPageNextAction,
    evidenceGroups: contract.sendabilityPageEvidenceGroups,
  });

  for (const field of [
    contract.sendabilityPageCustomerVisibleCue,
    contract.sendabilityPageInternalOnlyCue,
    contract.sendabilityPageNonCommitmentCue,
  ]) {
    if (!field.trim()) {
      throw new Error(
        "sendability page cues must stay visible in the contract",
      );
    }
  }

  return contract;
}

export function toCommitmentReinforcementPageReportingProtocol(
  contract: CommitmentReinforcementPageDetailReportingContract,
  english = false,
): PageReportingProtocol {
  return createPageReportingProtocol({
    pageJudgement: contract.reinforcementPageJudgement,
    pageJudgementReason: contract.reinforcementPageJudgementReason,
    pageWhyItMatters: contract.pageWhyItMatters,
    pageActionSummary: contract.reinforcementPageActionSummary,
    pageDecisionRequest: contract.reinforcementPageDecisionRequest,
    pageNextAction: contract.reinforcementPageNextAction,
    pageBoundarySummary: contract.reinforcementPageBoundarySummary,
    pageEvidenceSummary: contract.reinforcementPageEvidenceSummary,
    pageWorkerSummary: contract.reinforcementPageWorkerSummary,
    pagePrioritySignal: labelForRiskSignal(
      contract.reinforcementPageRiskSignal,
      english,
    ),
    pageEscalationHint: contract.pageEscalationHint,
    pageEvidenceLinks: contract.pageEvidenceLinks,
  });
}

export function toSendabilityPageReportingProtocol(
  contract: SendabilityPageDetailReportingContract,
  english = false,
): PageReportingProtocol {
  return createPageReportingProtocol({
    pageJudgement: contract.sendabilityPageJudgement,
    pageJudgementReason: contract.sendabilityPageJudgementReason,
    pageWhyItMatters: contract.pageWhyItMatters,
    pageActionSummary: contract.sendabilityPageActionSummary,
    pageDecisionRequest: contract.sendabilityPageDecisionRequest,
    pageNextAction: contract.sendabilityPageNextAction,
    pageBoundarySummary: contract.sendabilityPageBoundarySummary,
    pageEvidenceSummary: contract.sendabilityPageEvidenceSummary,
    pageWorkerSummary: contract.sendabilityPageWorkerSummary,
    pagePrioritySignal: labelForRiskSignal(
      contract.sendabilityPageRiskSignal,
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
  evidenceGroups: CommitmentReinforcementSendabilityEvidenceGroup[];
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
  for (const groupId of commitmentReinforcementSendabilityEvidenceGroupIds) {
    if (!groupIds.has(groupId)) {
      throw new Error(`evidence group ${groupId} must stay present`);
    }
  }
}

function labelForRiskSignal(
  signal: CommitmentReinforcementSendabilityRiskSignal,
  english: boolean,
) {
  if (signal === "high") return english ? "High risk" : "高风险";
  if (signal === "caution") return english ? "Strengthen with caution" : "谨慎强化";
  return english ? "Keep watching" : "继续观察";
}
