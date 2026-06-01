import {
  loadAskHelmKnowledgePack,
  type AskHelmKnowledgePackContext,
} from "@/features/search/ask-helm-knowledge-pack";

export type AskHelmAccessScopeInput = AskHelmKnowledgePackContext & {
  hasWorkspaceMembership: boolean;
  requestedHelpTopics?: string[];
};

export type AskHelmRetrievalSourcePolicy = {
  objectSearch: "current_workspace_only" | "denied";
  memorySummary: "current_workspace_only" | "denied";
  workspaceContext: "current_workspace_only" | "denied";
  knowledgePack: "capability_aware" | "denied";
  officialWritePath: "denied";
};

export type AskHelmAccessScope = {
  canAsk: boolean;
  objectReadScope: "current_workspace" | "none";
  allowedHelpPages: string[];
  deniedHelpTopics: string[];
  retrievalSourcePolicy: AskHelmRetrievalSourcePolicy;
  featureAvailability: {
    enabledTenantExtensions: string[];
    enabledFeatures: string[];
    disabledFeatures: string[];
  };
  boundaryNotes: string[];
};

const ASK_HELM_RESERVED_HELP_TOPIC_PATTERNS = [
  "reserved",
  "reserved_internal_truth",
  "settlement",
  "payment",
  "official_write",
  "auto_send",
  "auto_approve",
  "cross_workspace",
];

function isDeniedHelpTopic(topic: string) {
  const normalized = topic.trim().toLowerCase().replace(/\s+/g, "_");
  return ASK_HELM_RESERVED_HELP_TOPIC_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function resolveAskHelmAccessScope(
  input: AskHelmAccessScopeInput,
): AskHelmAccessScope {
  const knowledgePack = loadAskHelmKnowledgePack(input);
  const requestedDeniedHelpTopics = uniqueSorted(
    (input.requestedHelpTopics ?? []).filter(isDeniedHelpTopic),
  );
  const disabledCapabilityTopics = knowledgePack.featureAvailability.disabledFeatures.filter(
    isDeniedHelpTopic,
  );
  const deniedHelpTopics = uniqueSorted([
    ...requestedDeniedHelpTopics,
    ...disabledCapabilityTopics,
  ]);

  if (!input.hasWorkspaceMembership) {
    return {
      canAsk: false,
      objectReadScope: "none",
      allowedHelpPages: [],
      deniedHelpTopics,
      retrievalSourcePolicy: {
        objectSearch: "denied",
        memorySummary: "denied",
        workspaceContext: "denied",
        knowledgePack: "denied",
        officialWritePath: "denied",
      },
      featureAvailability: knowledgePack.featureAvailability,
      boundaryNotes: [
        "Ask Helm requires an active workspace membership.",
        "Official write paths are never available through Ask Helm v1.",
      ],
    };
  }

  return {
    canAsk: true,
    objectReadScope: "current_workspace",
    allowedHelpPages: uniqueSorted(
      Object.values(knowledgePack.deepLinkMap.help).map((item) => item.page),
    ),
    deniedHelpTopics,
    retrievalSourcePolicy: {
      objectSearch: "current_workspace_only",
      memorySummary: "current_workspace_only",
      workspaceContext: "current_workspace_only",
      knowledgePack: "capability_aware",
      officialWritePath: "denied",
    },
    featureAvailability: knowledgePack.featureAvailability,
    boundaryNotes: [
      "Object and memory retrieval must stay inside the current workspace.",
      "Help scope is capability-aware and excludes reserved-only internal truth.",
      "Official write paths are never available through Ask Helm v1.",
    ],
  };
}
