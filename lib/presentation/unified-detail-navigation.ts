export const unifiedDetailNodeTypes = [
  "proposal",
  "package",
  "package-stage-variants",
  "company-detail",
  "contact-detail",
  "meeting-detail",
  "customer-success",
  "success-check",
  "expansion-review",
  "inbox-detail",
  "follow-up-detail",
  "review-request-detail",
  "conversation",
  "founder-conversation",
  "founder-qa",
  "sales-conversation",
  "sales-objection",
  "sales-follow-up",
  "delivery-conversation",
  "delivery-walkthrough",
  "delivery-review",
  "customer-facing-offer",
  "external-proposal",
  "external-narrative",
  "narrative-fallback",
  "reinforcement",
  "sendability",
  "variants",
  "package-variants",
  "reinforcement-variants",
  "commercial-strengthening",
] as const;

export const unifiedDetailNodePriorities = [
  "watch",
  "important",
  "urgent",
] as const;

export const crossDetailHandoffVisibilityModes = [
  "customer-facing",
  "customer-facing-with-boundary",
  "internal-only",
  "review-before-send",
  "boundary-only",
] as const;

export type UnifiedDetailNodeType = (typeof unifiedDetailNodeTypes)[number];
export type UnifiedDetailNodePriority =
  (typeof unifiedDetailNodePriorities)[number];
export type CrossDetailHandoffVisibilityMode =
  (typeof crossDetailHandoffVisibilityModes)[number];

export type UnifiedDetailNavigationLink = {
  type: UnifiedDetailNodeType;
  href: string;
  label: string;
  summary: string;
};

export type UnifiedDetailNavigationNode = {
  detailNodeType: UnifiedDetailNodeType;
  detailNodeSummary: string;
  detailNodeStage: string;
  detailNodeBoundary: string;
  detailNodeAudienceMode: string;
  detailNodeSendabilityMode: string | null;
  detailNodeStrengthMode: string | null;
  detailNodePrev: UnifiedDetailNavigationLink | null;
  detailNodeNext: UnifiedDetailNavigationLink | null;
  detailNodeCurrentReason: string;
  detailNodePriority: UnifiedDetailNodePriority;
  detailNodeNavigationHint: string;
};

export type CrossDetailHandoff = {
  handoffSource: UnifiedDetailNodeType;
  handoffTarget: UnifiedDetailNodeType;
  handoffReason: string;
  handoffBoundary: string;
  handoffPrerequisite: string | null;
  handoffDependency: string | null;
  handoffRisk: string;
  handoffDecisionRequest: string;
  handoffNextAction: string;
  handoffWorkerSummary: string[];
  handoffEvidenceSummary: string[];
  handoffVisibilityMode: CrossDetailHandoffVisibilityMode;
  handoffHref: string;
};

export type UnifiedDetailNavigationModel = {
  currentNode: UnifiedDetailNavigationNode;
  handoffs: CrossDetailHandoff[];
};

export function createUnifiedDetailNavigationLink(
  link: UnifiedDetailNavigationLink,
): UnifiedDetailNavigationLink {
  validateLink(link, "detail navigation link");
  return link;
}

export function createUnifiedDetailNavigationNode(
  node: UnifiedDetailNavigationNode,
): UnifiedDetailNavigationNode {
  validateRequiredField(node.detailNodeSummary, "detailNodeSummary");
  validateRequiredField(node.detailNodeStage, "detailNodeStage");
  validateRequiredField(node.detailNodeBoundary, "detailNodeBoundary");
  validateRequiredField(node.detailNodeAudienceMode, "detailNodeAudienceMode");
  validateRequiredField(node.detailNodeCurrentReason, "detailNodeCurrentReason");
  validateRequiredField(node.detailNodeNavigationHint, "detailNodeNavigationHint");

  if (node.detailNodePrev) {
    validateLink(node.detailNodePrev, "detailNodePrev");
  }

  if (node.detailNodeNext) {
    validateLink(node.detailNodeNext, "detailNodeNext");
  }

  return node;
}

export function createCrossDetailHandoff(
  handoff: CrossDetailHandoff,
): CrossDetailHandoff {
  validateRequiredField(handoff.handoffReason, "handoffReason");
  validateRequiredField(handoff.handoffBoundary, "handoffBoundary");
  validateRequiredField(handoff.handoffRisk, "handoffRisk");
  validateRequiredField(handoff.handoffDecisionRequest, "handoffDecisionRequest");
  validateRequiredField(handoff.handoffNextAction, "handoffNextAction");
  validateRequiredField(handoff.handoffHref, "handoffHref");

  if (!handoff.handoffWorkerSummary.length) {
    throw new Error("handoffWorkerSummary must keep at least one worker cue");
  }

  if (!handoff.handoffEvidenceSummary.length) {
    throw new Error(
      "handoffEvidenceSummary must keep at least one evidence cue",
    );
  }

  return handoff;
}

export function createUnifiedDetailNavigationModel(
  model: UnifiedDetailNavigationModel,
): UnifiedDetailNavigationModel {
  createUnifiedDetailNavigationNode(model.currentNode);

  if (!model.handoffs.length) {
    throw new Error(
      "unified detail navigation must keep at least one cross-detail handoff",
    );
  }

  for (const handoff of model.handoffs) {
    createCrossDetailHandoff(handoff);
  }

  return model;
}

function validateRequiredField(value: string, fieldName: string) {
  if (!value.trim()) {
    throw new Error(`${fieldName} must stay present`);
  }
}

function validateLink(link: UnifiedDetailNavigationLink, fieldName: string) {
  validateRequiredField(link.href, `${fieldName}.href`);
  validateRequiredField(link.label, `${fieldName}.label`);
  validateRequiredField(link.summary, `${fieldName}.summary`);
}
