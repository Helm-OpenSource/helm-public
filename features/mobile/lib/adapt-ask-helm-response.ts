/**
 * Mobile Ask Helm Response Adapter
 *
 * Adapts desktop AskHelmResponse to MobileAskHelmResponse.
 * The mobile version is shorter and action-focused.
 *
 * Phase 3: Enhanced with grounding, intent-aware routing, and capability-aware handling.
 */

import type { AskHelmResponse } from "@/features/search/ask-helm-interpreter";
import type { AskHelmIntentType } from "@/features/search/ask-helm-query-intent";
import type { MobileAskHelmActionMode, MobileAskHelmResponse } from "../types";

/**
 * Truncate text to max sentences.
 * Handles Chinese and English sentence-ending punctuation.
 */
function truncateToSentences(text: string | undefined, maxSentences: number): string {
  if (!text) return "";

  // Split on sentence-ending punctuation, keeping the delimiter
  const parts = text.split(/([.!?。！？])/);
  const result: string[] = [];

  // Reconstruct sentence pairs (content + punctuation)
  for (let i = 0; i < parts.length - 1; i += 2) {
    const content = parts[i];
    const punct = parts[i + 1];
    // Only add if we have both content and punctuation
    if (content && punct && /[.!?。！？]/.test(punct)) {
      result.push(content + punct);
      if (result.length >= maxSentences) break;
    }
  }

  return result.length > 0 ? result.join("") : text;
}

/**
 * Get localized label for retrieval source.
 */
function getSourceLabel(source: string, english: boolean): string {
  const labels: Record<string, { zh: string; en: string }> = {
    object_search: { zh: "对象", en: "Objects" },
    memory_summary: { zh: "记忆", en: "Memory" },
    workspace_context: { zh: "工作区", en: "Workspace" },
    knowledge_pack: { zh: "系统知识", en: "Knowledge" },
  };
  const label = labels[source];
  return label ? (english ? label.en : label.zh) : source;
}

/**
 * Adapt desktop AskHelmResponse to mobile format.
 *
 * Mobile response is shorter and more action-focused:
 * - judgment: 1 sentence summary
 * - reason: 1-2 sentences explanation
 * - primaryAction: main next step (intent-aware routing)
 * - secondaryAction: optional alternative
 * - boundaryNote: inherited, never dropped for high-risk queries
 * - grounding: compressed from response data
 */
export function adaptAskHelmResponseToMobile(input: {
  response: AskHelmResponse;
  inputMode?: "typed" | "voice";
  maxReasonSentences?: number;
  english?: boolean;
}): MobileAskHelmResponse {
  const { response, maxReasonSentences = 2, english = false } = input;

  const judgement = response.answer.summary;
  const reason = truncateToSentences(response.answer.explanation, maxReasonSentences);

  // Intent-aware routing: select the most appropriate action based on intent type
  const primaryAction = selectPrimaryActionForIntent(response, english);

  // Secondary action from alternatives or related objects
  const secondaryAction = selectSecondaryAction(response, english, primaryAction);

  // Boundary note is never silently dropped for high-risk queries
  const boundaryNote = response.boundaryNote
    ? {
        type: response.boundaryNote.type,
        message: response.boundaryNote.message,
      }
    : undefined;

  // Build grounding info
  const grounding = buildMobileGrounding(response, english);

  return {
    judgement,
    reason,
    primaryAction,
    secondaryAction,
    boundaryNote,
    grounding,
  };
}

/**
 * Select primary action based on intent type and available data.
 * Implements intent-aware routing for mobile.
 */
function selectPrimaryActionForIntent(
  response: AskHelmResponse,
  english: boolean,
): { label: string; href: string; mode: MobileAskHelmActionMode } {
  const intent = response.classification.intentType;

  // If response already has a primary next step, use it
  if (response.nextStep.primary?.target) {
    return {
      label: response.nextStep.primary.label,
      href: response.nextStep.primary.target,
      mode: resolvePrimaryActionMode(response),
    };
  }

  // Intent-aware fallback routing
  const fallbackActions: Record<
    AskHelmIntentType,
    { label: string; href: string; mode: MobileAskHelmActionMode }
  > = {
    object_search: {
      label: english ? "View results" : "查看结果",
      href: `/search?q=${encodeURIComponent(response.classification.normalizedQuery)}`,
      mode: "open_page",
    },
    object_recent: {
      label: english ? "View memory" : "查看经营记忆",
      href: "/memory",
      mode: "open_page",
    },
    current_status: {
      label: english ? "Go to operating" : "打开推进",
      href: "/operating",
      mode: "open_page",
    },
    today_priority: {
      label: english ? "Go to operating" : "打开推进",
      href: "/operating",
      mode: "open_page",
    },
    why_recommendation: {
      label: english ? "View details" : "查看详情",
      href: "/operating",
      mode: "open_page",
    },
    why_blocked: {
      label: english ? "Go to approvals" : "进入复核",
      href: "/approvals",
      mode: "open_review",
    },
    how_to_use: {
      label: english ? "Go to search" : "进入搜索",
      href: "/search",
      mode: "open_page",
    },
    definition_diff: {
      label: english ? "Go to settings" : "打开设置",
      href: "/settings",
      mode: "open_page",
    },
    next_step_page: {
      label: english ? "Go to operating" : "打开推进",
      href: "/operating",
      mode: "open_page",
    },
    next_step_object: {
      label: english ? "View object" : "查看对象",
      href: "/search",
      mode: "open_object",
    },
    plan_breakdown: {
      label: english ? "Go to operating" : "打开推进",
      href: "/operating",
      mode: "open_page",
    },
    prepare_draft: {
      label: english ? "Go to approvals" : "进入复核",
      href: "/approvals",
      mode: "prepare_draft",
    },
    prepare_review_packet: {
      label: english ? "Go to approvals" : "进入复核",
      href: "/approvals",
      mode: "open_review",
    },
    queue_internal_followup: {
      label: english ? "Go to operating" : "打开推进",
      href: "/operating",
      mode: "open_page",
    },
    request_handoff: {
      label: english ? "Go to operating" : "打开推进",
      href: "/operating",
      mode: "open_page",
    },
    request_execution: {
      label: english ? "Go to operating" : "打开推进",
      href: "/operating",
      mode: "open_page",
    },
    review_required_execution: {
      label: english ? "Go to approvals" : "进入复核",
      href: "/approvals",
      mode: "open_review",
    },
    submit_business_signal: {
      label: english ? "Submit signal" : "上报信号",
      href: "/search?mode=ask#ask-helm-signal-intake",
      mode: "open_page",
    },
    unsupported_open_domain: {
      label: english ? "Go to search" : "返回搜索",
      href: "/search",
      mode: "open_page",
    },
    unsupported_chitchat: {
      label: english ? "Go to search" : "返回搜索",
      href: "/search",
      mode: "open_page",
    },
    cross_workspace_denied: {
      label: english ? "Go to search" : "返回搜索",
      href: "/search",
      mode: "open_page",
    },
    out_of_scope: {
      label: english ? "Go to search" : "返回搜索",
      href: "/search",
      mode: "open_page",
    },
  };

  return fallbackActions[intent] ?? fallbackActions.out_of_scope;
}

function resolvePrimaryActionMode(response: AskHelmResponse): MobileAskHelmActionMode {
  const intent = response.classification.intentType;
  const target = response.nextStep.primary.target;

  if (intent === "prepare_draft") return "prepare_draft";
  if (
    intent === "why_blocked" ||
    intent === "prepare_review_packet" ||
    intent === "review_required_execution" ||
    target.startsWith("/approvals")
  ) {
    return "open_review";
  }
  if (response.nextStep.primary.type === "object_target") return "open_object";

  return "open_page";
}

/**
 * Select secondary action from alternatives or related objects.
 */
function selectSecondaryAction(
  response: AskHelmResponse,
  english: boolean,
  primaryAction: { label: string; href: string },
): { label: string; href: string } | undefined {
  if (
    response.classification.intentType === "out_of_scope" ||
    response.classification.intentType === "cross_workspace_denied" ||
    response.classification.intentType === "unsupported_open_domain" ||
    response.classification.intentType === "unsupported_chitchat"
  ) {
    return undefined;
  }

  // Use first alternative if different from primary
  if (response.nextStep.alternatives?.[0]) {
    const alt = response.nextStep.alternatives[0];
    if (alt.target !== primaryAction.href) {
      return {
        label: alt.label,
        href: alt.target,
      };
    }
  }

  // Use first related object if available
  if (response.relatedObjects?.objects[0]) {
    const obj = response.relatedObjects.objects[0];
    return {
      label: english ? `Open ${obj.objectType}` : `打开${obj.displayName}`,
      href: obj.deepLink,
    };
  }

  return undefined;
}

/**
 * Build mobile-friendly grounding summary.
 */
function buildMobileGrounding(
  response: AskHelmResponse,
  english: boolean,
): MobileAskHelmResponse["grounding"] {
  const objectCount = response.relatedObjects?.totalCount ?? 0;
  const memoryUsed = response.grounding.memoryUsed;
  const systemKnowledgeUsed = response.grounding.systemKnowledgeUsed;

  const sourceLabels = response.retrievalPlan.sources.map((s) =>
    getSourceLabel(s, english),
  );

  return {
    objectCount,
    memoryUsed,
    systemKnowledgeUsed,
    sourceLabels,
  };
}

/**
 * Check if a mobile response should show a compact view (no explanation).
 * Used for very simple queries where the summary is sufficient.
 */
export function shouldShowCompactMobileResponse(response: AskHelmResponse): boolean {
  // Show compact for simple object search with high confidence
  return (
    response.classification.intentType === "object_search" &&
    response.classification.confidence === "high" &&
    response.relatedObjects?.totalCount === 1
  );
}

/**
 * Get mobile-friendly grounding summary.
 * Returns a short string like "3 objects · memory · knowledge"
 */
export function getMobileGroundingSummary(response: AskHelmResponse, english = false): string {
  const parts: string[] = [];

  if (response.relatedObjects?.totalCount) {
    parts.push(`${response.relatedObjects.totalCount} ${english ? "objects" : "对象"}`);
  }

  if (response.grounding.memoryUsed) {
    parts.push(english ? "memory" : "记忆");
  }

  if (response.grounding.systemKnowledgeUsed) {
    parts.push(english ? "knowledge" : "系统知识");
  }

  return parts.length > 0 ? parts.join(" · ") : english ? "Workspace context" : "工作区上下文";
}

/**
 * Check if an intent type is capability-sensitive and may be denied.
 */
export function isCapabilitySensitiveIntent(intentType: AskHelmIntentType): boolean {
  const sensitiveIntents: Set<AskHelmIntentType> = new Set([
    "review_required_execution",
    "prepare_draft",
    "prepare_review_packet",
    "queue_internal_followup",
    "submit_business_signal",
  ]);
  return sensitiveIntents.has(intentType);
}

/**
 * Check if a query requires transcript confirmation (for voice input).
 */
export function requiresTranscriptConfirmation(response: AskHelmResponse): boolean {
  // Require confirmation for voice input on execution-related intents
  const executionIntents: Set<AskHelmIntentType> = new Set([
    "review_required_execution",
    "request_execution",
    "prepare_draft",
    "prepare_review_packet",
    "submit_business_signal",
  ]);

  return executionIntents.has(response.classification.intentType);
}
