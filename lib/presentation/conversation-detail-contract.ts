import type {
  PageDrilldownLink,
  PageNextAction,
  PageReportingProtocol,
} from "@/lib/presentation/reporting-protocol";
import { createPageReportingProtocol } from "@/lib/presentation/reporting-protocol";

export const conversationDetailAudienceModes = [
  "founder-led",
  "sales-led",
  "delivery-led",
  "shared-review",
  "internal-only",
  "customer-visible",
] as const;

export const conversationDetailIntents = [
  "warm-up-context",
  "advance-follow-up",
  "handle-objection",
  "walkthrough-package",
  "clarify-boundary",
  "clarify-prerequisite",
  "clarify-dependency",
  "protect-non-commitment",
] as const;

export const conversationDetailModes = [
  "founder-meeting",
  "founder-demo",
  "sales-first-contact",
  "sales-follow-up",
  "objection-handling",
  "proposal-walkthrough",
  "boundary-clarification",
  "prerequisite-clarification",
  "dependency-clarification",
  "non-commitment-clarification",
  "internal-prep-only",
  "review-before-send",
] as const;

export const conversationDetailSendabilityModes = [
  "customer-visible",
  "safe-with-boundary",
  "safe-with-prerequisite",
  "safe-with-dependency",
  "discussion-only",
  "review-before-send",
  "internal-only",
  "not-ready-for-customer",
] as const;

export const conversationDetailRiskSignals = ["watch", "caution", "high"] as const;

export const conversationDetailEvidenceGroupIds = [
  "replay",
  "audit",
  "memory",
  "worker_output",
  "boundary_trace",
  "sendability_trace",
  "conversation_trace",
  "scenario_trace",
  "historical_changes",
] as const;

export type ConversationDetailAudienceMode =
  (typeof conversationDetailAudienceModes)[number];
export type ConversationDetailIntent =
  (typeof conversationDetailIntents)[number];
export type ConversationDetailMode =
  (typeof conversationDetailModes)[number];
export type ConversationDetailSendabilityMode =
  (typeof conversationDetailSendabilityModes)[number];
export type ConversationDetailRiskSignal =
  (typeof conversationDetailRiskSignals)[number];
export type ConversationDetailEvidenceGroupId =
  (typeof conversationDetailEvidenceGroupIds)[number];

export type ConversationDetailEvidenceGroup = {
  groupId: ConversationDetailEvidenceGroupId;
  label: string;
  items: string[];
};

export type ConversationDetailReportingContract = {
  conversationDetailJudgement: string;
  conversationDetailJudgementReason: string;
  conversationDetailActionSummary: string[];
  conversationDetailDecisionRequest: string[];
  conversationDetailBoundarySummary: string[];
  conversationDetailEvidenceSummary: string[];
  conversationDetailWorkerSummary: string[];
  conversationDetailNextAction: PageNextAction[];
  conversationDetailRiskSignal: ConversationDetailRiskSignal;
  conversationDetailAudienceMode: ConversationDetailAudienceMode;
  conversationDetailIntent: ConversationDetailIntent;
  conversationDetailMode: ConversationDetailMode;
  conversationDetailSendabilityMode: ConversationDetailSendabilityMode;
  conversationDetailEvidenceGroups: ConversationDetailEvidenceGroup[];
  conversationDetailFounderCue: string;
  conversationDetailSalesCue: string;
  conversationDetailDeliveryCue: string;
  pageWhyItMatters: string[];
  pageEvidenceLinks?: PageDrilldownLink[];
  pageEscalationHint?: string;
};

export function createConversationDetailReportingContract(
  contract: ConversationDetailReportingContract,
): ConversationDetailReportingContract {
  validateSharedRules(contract);

  for (const field of [
    contract.conversationDetailFounderCue,
    contract.conversationDetailSalesCue,
    contract.conversationDetailDeliveryCue,
  ]) {
    if (!field.trim()) {
      throw new Error("conversation role cues must stay visible in the contract");
    }
  }

  return contract;
}

export function toConversationDetailPageReportingProtocol(
  contract: ConversationDetailReportingContract,
  english = false,
): PageReportingProtocol {
  return createPageReportingProtocol({
    pageJudgement: contract.conversationDetailJudgement,
    pageJudgementReason: contract.conversationDetailJudgementReason,
    pageWhyItMatters: contract.pageWhyItMatters,
    pageActionSummary: contract.conversationDetailActionSummary,
    pageDecisionRequest: contract.conversationDetailDecisionRequest,
    pageNextAction: contract.conversationDetailNextAction,
    pageBoundarySummary: contract.conversationDetailBoundarySummary,
    pageEvidenceSummary: contract.conversationDetailEvidenceSummary,
    pageWorkerSummary: contract.conversationDetailWorkerSummary,
    pagePrioritySignal: labelForRiskSignal(
      contract.conversationDetailRiskSignal,
      english,
    ),
    pageEscalationHint: contract.pageEscalationHint,
    pageEvidenceLinks: contract.pageEvidenceLinks,
  });
}

function validateSharedRules(contract: ConversationDetailReportingContract) {
  if (!contract.conversationDetailJudgement.trim()) {
    throw new Error("conversationDetailJudgement must stay present");
  }

  if (!contract.conversationDetailJudgementReason.trim()) {
    throw new Error("conversationDetailJudgementReason must stay present");
  }

  if (
    contract.pageWhyItMatters.length < 2 ||
    contract.pageWhyItMatters.length > 3
  ) {
    throw new Error("pageWhyItMatters must keep 2 to 3 items");
  }

  if (!contract.conversationDetailActionSummary.length) {
    throw new Error("conversationDetailActionSummary must stay visible");
  }

  if (!contract.conversationDetailDecisionRequest.length) {
    throw new Error("conversationDetailDecisionRequest must stay visible");
  }

  if (!contract.conversationDetailBoundarySummary.length) {
    throw new Error("conversationDetailBoundarySummary must stay visible");
  }

  if (!contract.conversationDetailEvidenceSummary.length) {
    throw new Error("conversationDetailEvidenceSummary must stay visible");
  }

  if (!contract.conversationDetailWorkerSummary.length) {
    throw new Error("conversationDetailWorkerSummary must stay visible");
  }

  if (!contract.conversationDetailNextAction.length) {
    throw new Error("conversationDetailNextAction must keep at least one action");
  }

  const groupIds = new Set(
    contract.conversationDetailEvidenceGroups.map((group) => group.groupId),
  );
  for (const groupId of conversationDetailEvidenceGroupIds) {
    if (!groupIds.has(groupId)) {
      throw new Error(`evidence group ${groupId} must stay present`);
    }
  }
}

function labelForRiskSignal(signal: ConversationDetailRiskSignal, english: boolean) {
  if (signal === "high") return english ? "High risk" : "高风险";
  if (signal === "caution") return english ? "Communicate with caution" : "谨慎沟通";
  return english ? "Keep watching" : "继续观察";
}
