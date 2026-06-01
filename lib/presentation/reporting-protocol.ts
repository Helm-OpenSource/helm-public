export type PageNextAction = {
  label: string;
  href: string;
  variant?: "default" | "secondary" | "ghost";
};

export type PageDrilldownLink = {
  label: string;
  href: string;
};

export type PageWorkerAssignment = {
  assignmentId: string;
  title: string;
  summary: string;
  items: string[];
  chips?: string[];
};

export const pageReviewStates = [
  "prepared",
  "reviewed",
  "approved",
  "executed",
  "official",
] as const;

export type PageReviewState = (typeof pageReviewStates)[number];

export type PageEvidenceTarget = {
  itemId: string;
  label: string;
  href: string;
  summary?: string;
};

export type PageEvidenceGroup = {
  groupId: string;
  label: string;
  items: Array<string | PageEvidenceTarget>;
};

export type PageReportingProtocol = {
  pageJudgement: string;
  pageJudgementReason: string;
  pageWhyItMatters: string[];
  pageActionSummary: string[];
  pageDecisionRequest: string[];
  pageNextAction: PageNextAction[];
  pageBoundarySummary: string[];
  pageEvidenceSummary: string[];
  pageWorkerSummary: string[];
  pageWorkerAssignments?: PageWorkerAssignment[];
  pageEscalationHint?: string;
  pagePrioritySignal?: string;
  pageEvidenceLinks?: PageDrilldownLink[];
  pageEvidenceGroups?: PageEvidenceGroup[];
  pageReviewState?: PageReviewState;
};

export const reportingPageLayers = [
  {
    layerId: "L1",
    title: "frontstage",
    sections: [
      "pageJudgement",
      "pageJudgementReason",
      "pageDecisionRequest",
      "pageNextAction",
      "pageBoundarySummary",
      "pageEscalationHint",
    ],
  },
  {
    layerId: "L2",
    title: "midstage",
    sections: [
      "pageActionSummary",
      "pagePrioritySignal",
      "pageWorkerSummary",
      "pageWorkerAssignments",
      "pageReviewState",
    ],
  },
  {
    layerId: "L3",
    title: "backstage",
    sections: [
      "pageWhyItMatters",
      "pageEvidenceSummary",
      "pageEvidenceLinks",
      "pageEvidenceGroups",
    ],
  },
] as const;

export const reportingPageSkeleton = [
  "narrativeHeader",
  "currentSummaryCard",
  "decisionRequestCard",
  "actionRail",
  "boundaryNote",
  "reviewSnapshotBlock",
  "whyItMattersBlock",
  "workerSummary",
  "evidenceDrawer",
] as const;

export const reportingDensityLimits = {
  firstScreenBlockMax: 4,
  whyItMattersMin: 2,
  whyItMattersMax: 3,
  reviewSnapshotMax: 5,
  decisionRequestMax: 3,
  nextActionMax: 3,
  nextActionPrimaryCount: 1,
  nextActionSecondaryMax: 2,
  boundaryMax: 3,
} as const;

export const reportingPrimarySections = [
  "pageJudgement",
  "pageJudgementReason",
  "pageDecisionRequest",
  "pageNextAction",
  "pageBoundarySummary",
  "pageEscalationHint",
] as const;

export const reportingSecondarySections = [
  "pageActionSummary",
  "pagePrioritySignal",
  "pageWorkerSummary",
  "pageWorkerAssignments",
  "pageReviewState",
] as const;

export const reportingEvidenceSections = [
  "pageWhyItMatters",
  "pageEvidenceSummary",
  "pageEvidenceLinks",
  "pageEvidenceGroups",
] as const;

function countFirstScreenBlocks(protocol: PageReportingProtocol) {
  return [
    1,
    protocol.pageDecisionRequest.length > 0 ? 1 : 0,
    protocol.pageNextAction.length > 0 ? 1 : 0,
    protocol.pageBoundarySummary.length > 0 || Boolean(protocol.pageEscalationHint?.trim())
      ? 1
      : 0,
  ].reduce((sum, count) => sum + count, 0);
}

export function createPageReportingProtocol(
  protocol: PageReportingProtocol,
): PageReportingProtocol {
  const normalizedProtocol = {
    ...protocol,
    pageReviewState: protocol.pageReviewState ?? "prepared",
  } satisfies PageReportingProtocol;
  validatePageReportingProtocol(normalizedProtocol);
  return normalizedProtocol;
}

export function summarizePageReportingProtocol(
  protocol: PageReportingProtocol,
) {
  return {
    whyCount: protocol.pageWhyItMatters.length,
    actionCount: protocol.pageActionSummary.length,
    decisionCount: protocol.pageDecisionRequest.length,
    nextActionCount: protocol.pageNextAction.length,
    boundaryCount: protocol.pageBoundarySummary.length,
    evidenceCount: protocol.pageEvidenceSummary.length,
    workerCount: protocol.pageWorkerSummary.length,
    workerAssignmentCount: protocol.pageWorkerAssignments?.length ?? 0,
    drilldownCount: protocol.pageEvidenceLinks?.length ?? 0,
    evidenceGroupCount: protocol.pageEvidenceGroups?.length ?? 0,
    reviewState: protocol.pageReviewState ?? "prepared",
  };
}

export function formatPageReviewState(
  state: PageReviewState,
  english: boolean,
) {
  switch (state) {
    case "reviewed":
      return english ? "Reviewed" : "已复核";
    case "approved":
      return english ? "Approved" : "已批准";
    case "executed":
      return english ? "Executed" : "已执行";
    case "official":
      return english ? "Official" : "官方真值";
    default:
      return english ? "Prepared" : "待复核结果";
  }
}

export function describePageReviewState(
  state: PageReviewState,
  english: boolean,
) {
  switch (state) {
    case "reviewed":
      return english
        ? "A human has reviewed the result, but that does not mean it is approved, executed or official."
        : "已经有人类完成复核，但这不等于已批准、已执行或已成为官方真值。";
    case "approved":
      return english
        ? "The next move is approved, but approval still does not mean the action is executed or official."
        : "下一步已经获批，但批准仍不等于动作已执行，也不等于已成为官方真值。";
    case "executed":
      return english
        ? "The action has been executed, but execution still does not imply external official truth unless that write-back is confirmed."
        : "动作已经执行，但除非外部回写被确认，否则执行仍不等于官方真值。";
    case "official":
      return english
        ? "The official system or outward-facing truth has been explicitly updated and acknowledged."
        : "外部系统或对外真值已经被显式更新并确认。";
    default:
      return english
        ? "This is a prepared result waiting for review, not an approved, executed or official action."
        : "当前只是待复核结果，不是已批准、已执行或已成为官方真值的动作。";
  }
}

export function getPageReviewStateLegend(english: boolean) {
  return pageReviewStates.map((state) => ({
    state,
    label: formatPageReviewState(state, english),
    description: describePageReviewState(state, english),
  }));
}

export function validatePageReportingProtocol(
  protocol: PageReportingProtocol,
) {
  if (!protocol.pageJudgement.trim()) {
    throw new Error("pageJudgement must stay present in the reporting layer");
  }

  if (!protocol.pageJudgementReason.trim()) {
    throw new Error(
      "pageJudgementReason must stay present in the reporting layer",
    );
  }

  if (
    countFirstScreenBlocks(protocol) > reportingDensityLimits.firstScreenBlockMax
  ) {
    throw new Error(
      `frontstage cannot exceed ${reportingDensityLimits.firstScreenBlockMax} first-screen blocks`,
    );
  }

  if (
    protocol.pageWhyItMatters.length < reportingDensityLimits.whyItMattersMin ||
    protocol.pageWhyItMatters.length > reportingDensityLimits.whyItMattersMax
  ) {
    throw new Error(
      `pageWhyItMatters must keep ${reportingDensityLimits.whyItMattersMin} to ${reportingDensityLimits.whyItMattersMax} items`,
    );
  }

  if (
    protocol.pageActionSummary.length > reportingDensityLimits.reviewSnapshotMax
  ) {
    throw new Error(
      `pageActionSummary cannot exceed ${reportingDensityLimits.reviewSnapshotMax} items`,
    );
  }

  if (
    protocol.pageDecisionRequest.length >
    reportingDensityLimits.decisionRequestMax
  ) {
    throw new Error(
      `pageDecisionRequest cannot exceed ${reportingDensityLimits.decisionRequestMax} items`,
    );
  }

  if (protocol.pageNextAction.length === 0) {
    throw new Error("pageNextAction must keep at least one visible action");
  }

  if (protocol.pageNextAction.length > reportingDensityLimits.nextActionMax) {
    throw new Error(
      `pageNextAction cannot exceed ${reportingDensityLimits.nextActionMax} items`,
    );
  }

  const primaryActions = protocol.pageNextAction.filter(
    (item) => item.variant === undefined || item.variant === "default",
  );
  const secondaryActions = protocol.pageNextAction.filter(
    (item) => item.variant === "secondary" || item.variant === "ghost",
  );

  if (
    primaryActions.length !== reportingDensityLimits.nextActionPrimaryCount
  ) {
    throw new Error(
      `pageNextAction must keep exactly ${reportingDensityLimits.nextActionPrimaryCount} primary action`,
    );
  }

  if (
    secondaryActions.length > reportingDensityLimits.nextActionSecondaryMax
  ) {
    throw new Error(
      `pageNextAction can only keep ${reportingDensityLimits.nextActionSecondaryMax} secondary actions`,
    );
  }

  if (protocol.pageBoundarySummary.length > reportingDensityLimits.boundaryMax) {
    throw new Error(
      `pageBoundarySummary cannot exceed ${reportingDensityLimits.boundaryMax} items`,
    );
  }

  for (const assignment of protocol.pageWorkerAssignments ?? []) {
    if (!assignment.title.trim()) {
      throw new Error("pageWorkerAssignments must keep a visible title");
    }

    if (!assignment.summary.trim()) {
      throw new Error("pageWorkerAssignments must keep a visible summary");
    }

    if (!assignment.items.length) {
      throw new Error("pageWorkerAssignments must keep at least one detail item");
    }
  }

  for (const group of protocol.pageEvidenceGroups ?? []) {
    if (!group.label.trim()) {
      throw new Error("pageEvidenceGroups must keep a visible label");
    }

    if (!group.items.length) {
      throw new Error("pageEvidenceGroups must keep at least one evidence item");
    }

    for (const item of group.items) {
      if (typeof item === "string") {
        if (!item.trim()) {
          throw new Error(
            "pageEvidenceGroups string items must keep visible evidence copy",
          );
        }
        continue;
      }

      if (!item.itemId.trim()) {
        throw new Error("pageEvidenceGroups target items must keep an itemId");
      }

      if (!item.label.trim()) {
        throw new Error("pageEvidenceGroups target items must keep a label");
      }

      if (!item.href.trim()) {
        throw new Error("pageEvidenceGroups target items must keep an href");
      }
    }
  }
}
