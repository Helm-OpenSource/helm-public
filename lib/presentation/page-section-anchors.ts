export const APPROVAL_PAGE_ANCHORS = {
  preview: "approval-preview",
  fullActionContent: "approval-full-action-content",
  sourceContext: "approval-source-context",
  aiReasoning: "approval-ai-reasoning",
  supportingEvidence: "approval-supporting-evidence",
  recentOutcomes: "approval-recent-outcomes",
  editableDraft: "approval-editable-draft",
  riskNote: "approval-risk-note",
  resultPreview: "approval-result-preview",
} as const;

export const OPPORTUNITY_PAGE_ANCHORS = {
  workspace: "opportunity-workspace",
  briefing: "opportunity-briefing",
  actionWorkspace: "opportunity-action-workspace",
  judgementWorkspace: "opportunity-judgement-workspace",
  recordSettings: "opportunity-record-settings",
  contextDetails: "opportunity-context-details",
  memorySummary: "opportunity-memory-summary",
  memoryFacts: "opportunity-memory-facts",
  boundarySummary: "opportunity-boundary-summary",
} as const;

export const MEMORY_PAGE_ANCHORS = {
  timeline: "memory-work-timeline",
  auditReplay: "memory-audit-replay",
} as const;

export function buildSectionHref(pathname: string, anchorId: string) {
  const [basePathname] = pathname.split("#");
  const normalizedAnchorId = anchorId.replace(/^#+/, "");
  return `${basePathname}#${normalizedAnchorId}`;
}

export function buildApprovalItemAnchor(
  kind: "blocker" | "commitment" | "fact" | "outcome",
  itemId: string,
) {
  return `approval-${kind}-${itemId}`;
}

export function buildOpportunityItemAnchor(
  kind:
    | "blocker"
    | "commitment"
    | "memory-fact"
    | "briefing-step"
    | "recommendation",
  itemId: string | number,
) {
  return `opportunity-${kind}-${itemId}`;
}

export function buildMemoryItemAnchor(
  kind:
    | "note"
    | "fact"
    | "commitment"
    | "blocker"
    | "correction"
    | "audit",
  itemId: string,
) {
  return `memory-${kind}-${itemId}`;
}

export function scrollToWindowHashTarget(anchorIds: readonly string[]) {
  if (typeof window === "undefined") {
    return;
  }

  const targetId = window.location.hash.replace(/^#/, "");
  if (!targetId || !anchorIds.includes(targetId)) {
    return;
  }

  const scrollToTarget = () => {
    document
      .getElementById(targetId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  window.requestAnimationFrame(() => {
    scrollToTarget();
    window.setTimeout(scrollToTarget, 90);
  });
}
