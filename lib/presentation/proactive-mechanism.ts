import type {
  PageDrilldownLink,
  PageNextAction,
} from "@/lib/presentation/reporting-protocol";

export const proactiveLayers = [
  "observe",
  "judge",
  "prepare",
  "report",
  "collaborate",
  "controlled_auto_execute",
] as const;

export const activeReportTypes = ["periodic", "event", "request"] as const;
export const activeReportDeliveryModes = [
  "home-brief",
  "event-alert",
  "decision-request",
] as const;
export const activeReportPriorities = [
  "operating",
  "watch",
  "urgent",
] as const;
export const activeReportAudiences = [
  "founder",
  "sales",
  "delivery",
  "customer-success",
  "operator",
] as const;

export const collaborationModes = [
  "helm_drives_human_supervises",
  "helm_prepares_human_decides",
  "helm_reminds_human_leads",
] as const;

export type ActiveReportType = (typeof activeReportTypes)[number];
export type ActiveReportDeliveryMode =
  (typeof activeReportDeliveryModes)[number];
export type ActiveReportPriority = (typeof activeReportPriorities)[number];
export type ActiveReportAudience = (typeof activeReportAudiences)[number];
export type CollaborationMode = (typeof collaborationModes)[number];

export type ActiveReportProtocol = {
  activeReportType: ActiveReportType;
  activeReportSummary: string;
  activeReportReason: string;
  activeReportPriority: ActiveReportPriority;
  activeReportBoundary: string[];
  activeReportDecisionRequest?: string;
  activeReportWorkerSummary: string[];
  activeReportEvidenceSummary: string[];
  activeReportAudience: ActiveReportAudience[];
  activeReportDeliveryMode: ActiveReportDeliveryMode;
  activeReportPreparationSummary: string[];
};

export type ProactiveCollaborationProtocol = {
  collaborationMode: CollaborationMode;
  collaborationRequest: string;
  collaborationSummary: string;
  collaborationReason: string;
  collaborationBoundary: string[];
  collaborationOwner: string;
  collaborationWorkerAssignment: string[];
  collaborationEscalationHint?: string;
  collaborationDecisionRequest?: string;
  collaborationNextStep: string[];
};

export type ProactiveFlow = {
  flowId: string;
  flowTitle: string;
  triggerCondition: string;
  activeReport: ActiveReportProtocol;
  collaboration: ProactiveCollaborationProtocol;
  helmCanDo: string[];
  helmSuggestsOnly: string[];
  humanDecisionRequired: string[];
  humanLeadRequired: string[];
  nextActions: PageNextAction[];
  evidenceLinks?: PageDrilldownLink[];
};

export function createActiveReportProtocol(
  report: ActiveReportProtocol,
): ActiveReportProtocol {
  return report;
}

export function createProactiveCollaborationProtocol(
  protocol: ProactiveCollaborationProtocol,
): ProactiveCollaborationProtocol {
  return protocol;
}

export function createProactiveFlow(flow: ProactiveFlow): ProactiveFlow {
  return flow;
}

export function summarizeProactiveFlow(flow: ProactiveFlow) {
  return {
    preparationCount: flow.activeReport.activeReportPreparationSummary.length,
    boundaryCount:
      flow.activeReport.activeReportBoundary.length +
      flow.collaboration.collaborationBoundary.length,
    workerCount:
      flow.activeReport.activeReportWorkerSummary.length +
      flow.collaboration.collaborationWorkerAssignment.length,
    evidenceCount: flow.activeReport.activeReportEvidenceSummary.length,
    nextActionCount: flow.nextActions.length,
  };
}
