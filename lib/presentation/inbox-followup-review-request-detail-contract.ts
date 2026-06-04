import type {
  PageDrilldownLink,
  PageNextAction,
  PageReportingProtocol,
} from "@/lib/presentation/reporting-protocol";
import { createPageReportingProtocol } from "@/lib/presentation/reporting-protocol";

export const inboxFollowupReviewRequestAudienceModes = [
  "customer-visible",
  "shared-review",
  "internal-only",
  "account-owner",
] as const;

export const inboxDetailScenes = [
  "inbox-customer-thread",
  "inbox-internal-thread",
] as const;

export const followupDetailScenes = [
  "followup-draft",
  "followup-ready-to-review",
  "followup-review-before-send",
  "internal-prep-only",
] as const;

export const reviewRequestDetailScenes = [
  "review-request-pending",
  "review-request-escalated",
  "review-request-blocked",
  "internal-prep-only",
] as const;

export const inboxFollowupReviewRequestSendabilityModes = [
  "customer-visible",
  "safe-with-boundary",
  "review-before-send",
  "discussion-only",
  "internal-only",
  "boundary-only",
] as const;

export const inboxFollowupReviewRequestRiskSignals = [
  "watch",
  "caution",
  "high",
] as const;

export const inboxFollowupReviewRequestEvidenceGroupIds = [
  "replay",
  "audit",
  "memory",
  "worker_output",
  "boundary_trace",
  "sendability_trace",
  "handoff_trace",
  "historical_changes",
] as const;

export type InboxFollowupReviewRequestAudienceMode =
  (typeof inboxFollowupReviewRequestAudienceModes)[number];
export type InboxDetailScene = (typeof inboxDetailScenes)[number];
export type FollowupDetailScene = (typeof followupDetailScenes)[number];
export type ReviewRequestDetailScene = (typeof reviewRequestDetailScenes)[number];
export type InboxFollowupReviewRequestSendabilityMode =
  (typeof inboxFollowupReviewRequestSendabilityModes)[number];
export type InboxFollowupReviewRequestRiskSignal =
  (typeof inboxFollowupReviewRequestRiskSignals)[number];
export type InboxFollowupReviewRequestEvidenceGroupId =
  (typeof inboxFollowupReviewRequestEvidenceGroupIds)[number];

export type InboxFollowupReviewRequestEvidenceGroup = {
  groupId: InboxFollowupReviewRequestEvidenceGroupId;
  label: string;
  items: string[];
};

type SharedDetailContract = {
  pageWhyItMatters: string[];
  pageEvidenceLinks?: PageDrilldownLink[];
  pageEscalationHint?: string;
};

export type InboxDetailReportingContract = SharedDetailContract & {
  inboxDetailJudgement: string;
  inboxDetailJudgementReason: string;
  inboxDetailActionSummary: string[];
  inboxDetailDecisionRequest: string[];
  inboxDetailBoundarySummary: string[];
  inboxDetailEvidenceSummary: string[];
  inboxDetailWorkerSummary: string[];
  inboxDetailNextAction: PageNextAction[];
  inboxDetailRiskSignal: InboxFollowupReviewRequestRiskSignal;
  inboxDetailAudienceMode: InboxFollowupReviewRequestAudienceMode;
  inboxDetailScene: InboxDetailScene;
  inboxDetailSendabilityMode: InboxFollowupReviewRequestSendabilityMode;
  inboxDetailEvidenceGroups: InboxFollowupReviewRequestEvidenceGroup[];
};

export type FollowupDetailReportingContract = SharedDetailContract & {
  followupDetailJudgement: string;
  followupDetailJudgementReason: string;
  followupDetailActionSummary: string[];
  followupDetailDecisionRequest: string[];
  followupDetailBoundarySummary: string[];
  followupDetailEvidenceSummary: string[];
  followupDetailWorkerSummary: string[];
  followupDetailNextAction: PageNextAction[];
  followupDetailRiskSignal: InboxFollowupReviewRequestRiskSignal;
  followupDetailAudienceMode: InboxFollowupReviewRequestAudienceMode;
  followupDetailScene: FollowupDetailScene;
  followupDetailSendabilityMode: InboxFollowupReviewRequestSendabilityMode;
  followupDetailEvidenceGroups: InboxFollowupReviewRequestEvidenceGroup[];
};

export type ReviewRequestDetailReportingContract = SharedDetailContract & {
  reviewRequestDetailJudgement: string;
  reviewRequestDetailJudgementReason: string;
  reviewRequestDetailActionSummary: string[];
  reviewRequestDetailDecisionRequest: string[];
  reviewRequestDetailBoundarySummary: string[];
  reviewRequestDetailEvidenceSummary: string[];
  reviewRequestDetailWorkerSummary: string[];
  reviewRequestDetailNextAction: PageNextAction[];
  reviewRequestDetailRiskSignal: InboxFollowupReviewRequestRiskSignal;
  reviewRequestDetailAudienceMode: InboxFollowupReviewRequestAudienceMode;
  reviewRequestDetailScene: ReviewRequestDetailScene;
  reviewRequestDetailSendabilityMode: InboxFollowupReviewRequestSendabilityMode;
  reviewRequestDetailEvidenceGroups: InboxFollowupReviewRequestEvidenceGroup[];
};

export function createInboxDetailReportingContract(
  contract: InboxDetailReportingContract,
): InboxDetailReportingContract {
  validateContract({
    judgement: contract.inboxDetailJudgement,
    reason: contract.inboxDetailJudgementReason,
    actionSummary: contract.inboxDetailActionSummary,
    decisionRequest: contract.inboxDetailDecisionRequest,
    boundarySummary: contract.inboxDetailBoundarySummary,
    evidenceSummary: contract.inboxDetailEvidenceSummary,
    workerSummary: contract.inboxDetailWorkerSummary,
    nextAction: contract.inboxDetailNextAction,
    evidenceGroups: contract.inboxDetailEvidenceGroups,
    pageWhyItMatters: contract.pageWhyItMatters,
  });
  return contract;
}

export function createFollowupDetailReportingContract(
  contract: FollowupDetailReportingContract,
): FollowupDetailReportingContract {
  validateContract({
    judgement: contract.followupDetailJudgement,
    reason: contract.followupDetailJudgementReason,
    actionSummary: contract.followupDetailActionSummary,
    decisionRequest: contract.followupDetailDecisionRequest,
    boundarySummary: contract.followupDetailBoundarySummary,
    evidenceSummary: contract.followupDetailEvidenceSummary,
    workerSummary: contract.followupDetailWorkerSummary,
    nextAction: contract.followupDetailNextAction,
    evidenceGroups: contract.followupDetailEvidenceGroups,
    pageWhyItMatters: contract.pageWhyItMatters,
  });
  return contract;
}

export function createReviewRequestDetailReportingContract(
  contract: ReviewRequestDetailReportingContract,
): ReviewRequestDetailReportingContract {
  validateContract({
    judgement: contract.reviewRequestDetailJudgement,
    reason: contract.reviewRequestDetailJudgementReason,
    actionSummary: contract.reviewRequestDetailActionSummary,
    decisionRequest: contract.reviewRequestDetailDecisionRequest,
    boundarySummary: contract.reviewRequestDetailBoundarySummary,
    evidenceSummary: contract.reviewRequestDetailEvidenceSummary,
    workerSummary: contract.reviewRequestDetailWorkerSummary,
    nextAction: contract.reviewRequestDetailNextAction,
    evidenceGroups: contract.reviewRequestDetailEvidenceGroups,
    pageWhyItMatters: contract.pageWhyItMatters,
  });
  return contract;
}

export function toInboxDetailPageReportingProtocol(
  contract: InboxDetailReportingContract,
  english = false,
): PageReportingProtocol {
  return createPageReportingProtocol({
    pageJudgement: contract.inboxDetailJudgement,
    pageJudgementReason: contract.inboxDetailJudgementReason,
    pageWhyItMatters: contract.pageWhyItMatters,
    pageActionSummary: contract.inboxDetailActionSummary,
    pageDecisionRequest: contract.inboxDetailDecisionRequest,
    pageNextAction: contract.inboxDetailNextAction,
    pageBoundarySummary: contract.inboxDetailBoundarySummary,
    pageEvidenceSummary: contract.inboxDetailEvidenceSummary,
    pageWorkerSummary: contract.inboxDetailWorkerSummary,
    pagePrioritySignal: labelForRiskSignal(contract.inboxDetailRiskSignal, english),
    pageEscalationHint: contract.pageEscalationHint,
    pageEvidenceLinks: contract.pageEvidenceLinks,
  });
}

export function toFollowupDetailPageReportingProtocol(
  contract: FollowupDetailReportingContract,
  english = false,
): PageReportingProtocol {
  return createPageReportingProtocol({
    pageJudgement: contract.followupDetailJudgement,
    pageJudgementReason: contract.followupDetailJudgementReason,
    pageWhyItMatters: contract.pageWhyItMatters,
    pageActionSummary: contract.followupDetailActionSummary,
    pageDecisionRequest: contract.followupDetailDecisionRequest,
    pageNextAction: contract.followupDetailNextAction,
    pageBoundarySummary: contract.followupDetailBoundarySummary,
    pageEvidenceSummary: contract.followupDetailEvidenceSummary,
    pageWorkerSummary: contract.followupDetailWorkerSummary,
    pagePrioritySignal: labelForRiskSignal(contract.followupDetailRiskSignal, english),
    pageEscalationHint: contract.pageEscalationHint,
    pageEvidenceLinks: contract.pageEvidenceLinks,
  });
}

export function toReviewRequestDetailPageReportingProtocol(
  contract: ReviewRequestDetailReportingContract,
  english = false,
): PageReportingProtocol {
  return createPageReportingProtocol({
    pageJudgement: contract.reviewRequestDetailJudgement,
    pageJudgementReason: contract.reviewRequestDetailJudgementReason,
    pageWhyItMatters: contract.pageWhyItMatters,
    pageActionSummary: contract.reviewRequestDetailActionSummary,
    pageDecisionRequest: contract.reviewRequestDetailDecisionRequest,
    pageNextAction: contract.reviewRequestDetailNextAction,
    pageBoundarySummary: contract.reviewRequestDetailBoundarySummary,
    pageEvidenceSummary: contract.reviewRequestDetailEvidenceSummary,
    pageWorkerSummary: contract.reviewRequestDetailWorkerSummary,
    pagePrioritySignal: labelForRiskSignal(
      contract.reviewRequestDetailRiskSignal,
      english,
    ),
    pageEscalationHint: contract.pageEscalationHint,
    pageEvidenceLinks: contract.pageEvidenceLinks,
  });
}

function validateContract({
  judgement,
  reason,
  actionSummary,
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
  decisionRequest: string[];
  boundarySummary: string[];
  evidenceSummary: string[];
  workerSummary: string[];
  nextAction: PageNextAction[];
  evidenceGroups: InboxFollowupReviewRequestEvidenceGroup[];
  pageWhyItMatters: string[];
}) {
  if (!judgement.trim()) {
    throw new Error("detail judgement must stay present");
  }
  if (!reason.trim()) {
    throw new Error("detail judgement reason must stay present");
  }
  if (pageWhyItMatters.length < 2 || pageWhyItMatters.length > 3) {
    throw new Error("pageWhyItMatters must keep 2 to 3 items");
  }
  if (!actionSummary.length) {
    throw new Error("detail action summary must stay visible");
  }
  if (!decisionRequest.length) {
    throw new Error("detail decision request must stay visible");
  }
  if (!boundarySummary.length) {
    throw new Error("detail boundary summary must stay visible");
  }
  if (!evidenceSummary.length) {
    throw new Error("detail evidence summary must stay visible");
  }
  if (!workerSummary.length) {
    throw new Error("detail worker summary must stay visible");
  }
  if (!nextAction.length) {
    throw new Error("detail next action must keep at least one action");
  }

  const groupIds = new Set(evidenceGroups.map((group) => group.groupId));
  for (const groupId of inboxFollowupReviewRequestEvidenceGroupIds) {
    if (!groupIds.has(groupId)) {
      throw new Error(`evidence group ${groupId} must stay present`);
    }
  }
}

function labelForRiskSignal(
  signal: InboxFollowupReviewRequestRiskSignal,
  english: boolean,
) {
  if (signal === "high") return english ? "High risk" : "高风险";
  if (signal === "caution") return english ? "Handle with caution" : "谨慎处理";
  return english ? "Keep watching" : "继续观察";
}
