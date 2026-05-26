export type AskHelmKnowledgePageResponsibility = {
  primaryPurpose: string;
  whatItHandles: string[];
  whatItDoesntHandle: string[];
  canonicalFor: string[];
};

export type AskHelmKnowledgeOperation = {
  steps: string[];
  prerequisites: string[];
  targetPage: string;
};

export type AskHelmKnowledgeDeepLink = {
  page: string;
  anchor?: string;
};

export type AskHelmKnowledgePack = {
  pageResponsibilities: Record<string, AskHelmKnowledgePageResponsibility>;
  boundaries: {
    recommendationVsCommitment: string;
    reviewRequiredVsDirect: string;
    explanationVsApproval: string;
    localSuggestionVsOfficialWrite: string;
  };
  featureAvailability: {
    enabledTenantExtensions: string[];
    enabledFeatures: string[];
    disabledFeatures: string[];
    membershipRole?: string;
    workspaceProfileType?: string;
    focusAreas?: string[];
  };
  commonOperations: Record<string, AskHelmKnowledgeOperation>;
  deepLinkMap: {
    objects: Record<string, string>;
    issues: Record<string, string>;
    help: Record<string, AskHelmKnowledgeDeepLink>;
  };
};

export type AskHelmKnowledgePackContext = {
  enabledTenantExtensions?: string[];
  enabledFeatures?: string[];
  disabledFeatures?: string[];
  membershipRole?: string | null;
  workspaceProfileType?: string | null;
  focusAreas?: string[] | null;
};

export type AskHelmKnowledgePackValidation = {
  ok: boolean;
  requiredPages: string[];
  coveredPages: string[];
  enabledFeatureCount: number;
  disabledFeatureCount: number;
  failures: string[];
};

export const ASK_HELM_REQUIRED_KNOWLEDGE_PAGES = [
  "/search",
  "/memory",
  "/approvals",
  "/operating",
  "/settings",
] as const;

const ASK_HELM_BASE_ENABLED_FEATURES = [
  "object_search",
  "memory_read",
  "approval_review",
  "operating_workspace",
  "settings_definition",
  "reports_read",
  "detail_navigation",
] as const;

const ASK_HELM_BASE_DISABLED_FEATURES = [
  "auto_send",
  "auto_approve",
  "payment_execution",
  "cross_workspace_answering",
  "open_domain_chat",
  "reserved_internal_truth",
] as const;

const ASK_HELM_PROHIBITED_DEFAULT_ENABLED_FEATURES = new Set<string>([
  "auto_send",
  "auto_approve",
  "payment_execution",
  "cross_workspace_answering",
  "open_domain_chat",
  "reserved_internal_truth",
]);

const BASE_PAGE_RESPONSIBILITIES: AskHelmKnowledgePack["pageResponsibilities"] = {
  "/search": {
    primaryPurpose: "Find workspace objects and enter Ask Helm from the same surface.",
    whatItHandles: [
      "contacts, companies, opportunities, and meetings search",
      "mixed object and help queries",
      "next-step routing from search results",
    ],
    whatItDoesntHandle: [
      "approving work",
      "sending external messages",
      "becoming a chat-first workspace",
    ],
    canonicalFor: ["object_search", "object_recent", "next_step_object"],
  },
  "/memory": {
    primaryPurpose: "Review durable operating memory and object context.",
    whatItHandles: [
      "facts, blockers, commitments, and timeline context",
      "workspace and object memory readout",
      "evidence-backed explanation context",
    ],
    whatItDoesntHandle: [
      "final approval",
      "official writeback",
      "cross-workspace memory lookup",
    ],
    canonicalFor: ["current_status", "why_blocked", "why_recommendation"],
  },
  "/approvals": {
    primaryPurpose: "Review requests that require human confirmation before action.",
    whatItHandles: [
      "review-required tasks",
      "approval evidence",
      "blocked execution handoff",
    ],
    whatItDoesntHandle: [
      "automatic approval",
      "payment execution",
      "silent customer-facing commitment",
    ],
    canonicalFor: ["why_blocked", "next_step_page"],
  },
  "/operating": {
    primaryPurpose: "Work through the current operating queue and daily follow-through.",
    whatItHandles: [
      "today focus",
      "active follow-through",
      "manager attention and next operating step",
    ],
    whatItDoesntHandle: [
      "long-form reporting",
      "role definition editing",
      "open-domain research",
    ],
    canonicalFor: ["today_priority", "current_status", "next_step_page"],
  },
  "/settings": {
    primaryPurpose: "Adjust workspace and member operating definitions.",
    whatItHandles: [
      "role definition",
      "workspace profile and focus areas",
      "controlled configuration",
    ],
    whatItDoesntHandle: [
      "customer-facing send",
      "approval replacement",
      "reserved-only governance truth",
    ],
    canonicalFor: ["definition_diff", "how_to_use"],
  },
  "/reports": {
    primaryPurpose: "Read operating reports and decision-first summaries.",
    whatItHandles: [
      "report review",
      "decision and risk readout",
      "operating synthesis",
    ],
    whatItDoesntHandle: [
      "object search",
      "official write execution",
      "approval override",
    ],
    canonicalFor: ["why_recommendation", "current_status"],
  },
  "/companies/[id]": {
    primaryPurpose: "Inspect one company and its related operating context.",
    whatItHandles: ["company status", "related opportunities", "related contacts"],
    whatItDoesntHandle: ["cross-company ranking", "automatic outreach"],
    canonicalFor: ["object_search", "current_status", "next_step_object"],
  },
  "/contacts/[id]": {
    primaryPurpose: "Inspect one contact and the relationship context around them.",
    whatItHandles: ["contact details", "company relationship", "recent interactions"],
    whatItDoesntHandle: ["automatic external send", "tenant-wide people analytics"],
    canonicalFor: ["object_search", "object_recent", "next_step_object"],
  },
  "/opportunities/[id]": {
    primaryPurpose: "Inspect one opportunity and the next sales or delivery move.",
    whatItHandles: ["opportunity status", "blockers", "next action"],
    whatItDoesntHandle: ["final commitment", "automatic approval", "payment execution"],
    canonicalFor: ["current_status", "why_blocked", "next_step_object"],
  },
  "/meetings/[id]": {
    primaryPurpose: "Inspect one meeting and convert evidence into follow-through.",
    whatItHandles: ["meeting agenda", "participants", "related opportunity"],
    whatItDoesntHandle: ["automatic task execution", "official writeback without review"],
    canonicalFor: ["object_recent", "how_to_use", "next_step_object"],
  },
};

const BASE_COMMON_OPERATIONS: AskHelmKnowledgePack["commonOperations"] = {
  find_object_and_continue: {
    steps: [
      "Search for the object by name or context.",
      "Open the best matching object result.",
      "Continue from the object's canonical detail page.",
    ],
    prerequisites: ["Current workspace membership", "Object read visibility"],
    targetPage: "/search",
  },
  turn_meeting_into_next_step: {
    steps: [
      "Open the meeting detail.",
      "Review evidence and related opportunity context.",
      "Continue to operating follow-through or approvals when review is required.",
    ],
    prerequisites: ["Meeting read visibility", "Related object read visibility"],
    targetPage: "/meetings/[id]",
  },
  review_approval_evidence: {
    steps: [
      "Open approvals.",
      "Review evidence and blocker reason.",
      "Proceed only through the human review path.",
    ],
    prerequisites: ["Workspace membership", "Approval read visibility"],
    targetPage: "/approvals",
  },
  update_role_definition: {
    steps: [
      "Open settings.",
      "Review the current role definition.",
      "Edit through the controlled settings surface.",
    ],
    prerequisites: ["Workspace membership", "Definition edit capability"],
    targetPage: "/settings",
  },
  understand_recommendation: {
    steps: [
      "Load the relevant object and memory context.",
      "Explain evidence and tradeoffs.",
      "Route back to the canonical operating or object page.",
    ],
    prerequisites: ["Workspace membership", "Object and memory read visibility"],
    targetPage: "/operating",
  },
};

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function resolveFeatureAvailability(context: AskHelmKnowledgePackContext) {
  const enabledTenantExtensions = uniqueSorted(context.enabledTenantExtensions ?? []);
  const requestedEnabledFeatures = uniqueSorted(context.enabledFeatures ?? []);
  const requestedDisabledFeatures = uniqueSorted(context.disabledFeatures ?? []);
  const tenantExtensionFeatures = enabledTenantExtensions.map(
    (extension) => `tenant_extension:${extension}`,
  );
  const prohibitedRequests = requestedEnabledFeatures.filter((feature) =>
    ASK_HELM_PROHIBITED_DEFAULT_ENABLED_FEATURES.has(feature),
  );
  const disabledFeatures = uniqueSorted([
    ...ASK_HELM_BASE_DISABLED_FEATURES,
    ...requestedDisabledFeatures,
    ...prohibitedRequests,
  ]);
  const disabledFeatureSet = new Set(disabledFeatures);
  const enabledFeatures = uniqueSorted([
    ...ASK_HELM_BASE_ENABLED_FEATURES,
    ...requestedEnabledFeatures,
    ...tenantExtensionFeatures,
  ]).filter(
    (feature) =>
      !disabledFeatureSet.has(feature) &&
      !ASK_HELM_PROHIBITED_DEFAULT_ENABLED_FEATURES.has(feature),
  );

  return {
    enabledTenantExtensions,
    enabledFeatures,
    disabledFeatures,
    membershipRole: context.membershipRole ?? undefined,
    workspaceProfileType: context.workspaceProfileType ?? undefined,
    focusAreas: uniqueSorted(context.focusAreas ?? []),
  };
}

export function loadAskHelmKnowledgePack(
  context: AskHelmKnowledgePackContext = {},
): AskHelmKnowledgePack {
  return {
    pageResponsibilities: BASE_PAGE_RESPONSIBILITIES,
    boundaries: {
      recommendationVsCommitment:
        "Recommendations explain a suggested next move; they do not create a customer-facing commitment.",
      reviewRequiredVsDirect:
        "Review-required work must stay on the human review path before any official action.",
      explanationVsApproval:
        "Ask Helm can explain why something is blocked; it cannot approve or override the block.",
      localSuggestionVsOfficialWrite:
        "Local suggestions and drafts are not official writes until the governed write path records them.",
    },
    featureAvailability: resolveFeatureAvailability(context),
    commonOperations: BASE_COMMON_OPERATIONS,
    deepLinkMap: {
      objects: {
        contact: "/contacts/[id]",
        company: "/companies/[id]",
        meeting: "/meetings/[id]",
        opportunity: "/opportunities/[id]",
      },
      issues: {
        blocked_approval: "/approvals",
        current_status: "/operating",
        memory_evidence: "/memory",
        role_definition: "/settings",
        today_focus: "/operating",
      },
      help: {
        approvals: { page: "/approvals" },
        memory: { page: "/memory" },
        operating: { page: "/operating" },
        search: { page: "/search" },
        settings: { page: "/settings" },
      },
    },
  };
}

export function validateAskHelmKnowledgePack(
  pack: AskHelmKnowledgePack,
): AskHelmKnowledgePackValidation {
  const failures: string[] = [];
  const coveredPages = Object.keys(pack.pageResponsibilities).sort();

  for (const pagePath of ASK_HELM_REQUIRED_KNOWLEDGE_PAGES) {
    const page = pack.pageResponsibilities[pagePath];
    if (!page) {
      failures.push(`Missing required page responsibility: ${pagePath}`);
      continue;
    }
    if (!page.primaryPurpose.trim()) {
      failures.push(`Missing primaryPurpose for ${pagePath}`);
    }
    if (!page.whatItHandles.length) {
      failures.push(`Missing whatItHandles for ${pagePath}`);
    }
    if (!page.whatItDoesntHandle.length) {
      failures.push(`Missing whatItDoesntHandle for ${pagePath}`);
    }
    if (!page.canonicalFor.length) {
      failures.push(`Missing canonicalFor for ${pagePath}`);
    }
  }

  for (const [boundaryKey, boundaryValue] of Object.entries(pack.boundaries)) {
    if (!boundaryValue.trim()) {
      failures.push(`Missing boundary: ${boundaryKey}`);
    }
  }

  for (const [operationId, operation] of Object.entries(pack.commonOperations)) {
    if (!operation.steps.length) {
      failures.push(`Missing steps for operation: ${operationId}`);
    }
    if (!operation.prerequisites.length) {
      failures.push(`Missing prerequisites for operation: ${operationId}`);
    }
    if (!pack.pageResponsibilities[operation.targetPage]) {
      failures.push(
        `Operation ${operationId} targets a page without responsibility: ${operation.targetPage}`,
      );
    }
  }

  for (const feature of ASK_HELM_PROHIBITED_DEFAULT_ENABLED_FEATURES) {
    if (pack.featureAvailability.enabledFeatures.includes(feature)) {
      failures.push(`Prohibited feature is enabled by default: ${feature}`);
    }
    if (!pack.featureAvailability.disabledFeatures.includes(feature)) {
      failures.push(`Prohibited feature is not explicitly disabled: ${feature}`);
    }
  }

  return {
    ok: failures.length === 0,
    requiredPages: [...ASK_HELM_REQUIRED_KNOWLEDGE_PAGES],
    coveredPages,
    enabledFeatureCount: pack.featureAvailability.enabledFeatures.length,
    disabledFeatureCount: pack.featureAvailability.disabledFeatures.length,
    failures,
  };
}
