import {
  classifyAskHelmQueryIntent,
  type AskHelmQueryIntentClassification,
} from "@/features/search/ask-helm-query-intent";
import type {
  AskHelmGroundedObject,
  AskHelmObjectType,
  AskHelmResponseBoundaryType,
  AskHelmRetrievalPlan,
  AskHelmRetrievalSource,
} from "@/features/search/ask-helm-interpreter";

export const ASK_HELM_CONTEXT_PACKET_VERSION = "ask-helm-context-packet-v1" as const;

export type AskHelmContextPacketWorkspaceScope = {
  scope: "current_workspace";
  workspaceId: string;
  workspaceSlug?: string;
  membershipRole?: string;
  focusAreas: string[];
};

export type AskHelmContextPacketInput = {
  rawQueryHash: string;
  redactedQuery?: string;
  inputMode: "typed" | "voice";
  transcriptConfirmed?: boolean;
  transcriptConfidence?: "high" | "medium" | "low";
  currentPage?: string;
  currentObject?: {
    type: AskHelmObjectType;
    id: string;
    displayName?: string;
    status?: string;
  };
  rawQueryRetained: false;
  rawPromptRetained: false;
  rawAudioRetained: false;
};

export type AskHelmContextPacketObjectSummary = AskHelmGroundedObject & {
  workspaceId?: string;
  evidenceRefs: string[];
  summaryToken?: string;
};

export type AskHelmContextPacketMemoryStatus =
  | "reviewed_active"
  | "candidate"
  | "unreviewed"
  | "downgraded"
  | "revoked"
  | "archived";

export type AskHelmContextPacketMemoryAssetType =
  | "fact"
  | "judgement"
  | "boundary"
  | "intent"
  | "decision"
  | "pattern";

export type AskHelmContextPacketMemorySummary = {
  id: string;
  workspaceId?: string;
  assetType: AskHelmContextPacketMemoryAssetType;
  status: AskHelmContextPacketMemoryStatus;
  objectRefs: Array<{ type: AskHelmObjectType | "workspace"; id: string }>;
  evidenceRefs: string[];
  summaryToken: string;
  freshness: "fresh" | "stale" | "unknown";
  sourceStrength: "strong" | "medium" | "weak";
  contradictionStatus: "none" | "suspected" | "confirmed";
};

export type AskHelmContextPacketExcludedContext = {
  source:
    | "raw_query"
    | "raw_prompt"
    | "raw_transcript"
    | "raw_audio"
    | "cross_workspace_context"
    | "open_domain_web"
    | "official_write_path"
    | "memory_candidate"
    | "memory_revoked"
    | "memory_archived"
    | "memory_unreviewed"
    | "memory_unrelated"
    | "memory_stale_or_conflicting"
    | "external_agent_unreviewed";
  reason: string;
  refId?: string;
};

export type AskHelmContextPacketIncludedContext = {
  objects: AskHelmContextPacketObjectSummary[];
  memory: AskHelmContextPacketMemorySummary[];
  workspaceContext: string[];
  knowledgePackLabels: string[];
};

export type AskHelmContextPacketMemoryInjectionPolicy = {
  reviewedActiveOnly: true;
  objectRelevantRequired: true;
  freshnessRequired: true;
  contradictionDowngradeRequired: true;
  candidatesNotInjected: true;
  revokedArchivedExcluded: true;
  injectedMemoryIds: string[];
  excludedMemoryIds: string[];
};

export type AskHelmContextPacketBoundaryContract = {
  boundaryType: AskHelmResponseBoundaryType;
  message: string;
  reviewRequired: boolean;
  suggestionNotCommitment: true;
  officialWriteDenied: true;
  autoSendDenied: true;
  autoApproveDenied: true;
};

export type AskHelmContextPacketPromptContract = {
  promptKey: "ask-helm-answer";
  promptVersion: "offline-context-packet-v1";
  outputMode: "structured_explanation";
  rawPromptRetained: false;
  productionPromptAdoptionAllowed: false;
  llmFinalRankingAllowed: false;
  allowedUse: Array<"explain" | "summarize" | "route" | "prepare_draft">;
  forbiddenUse: Array<
    | "final_ranking"
    | "official_write"
    | "auto_send"
    | "auto_approve"
    | "commitment"
    | "cross_workspace_answer"
    | "canonical_memory_write"
  >;
};

export type AskHelmContextPacketReplayPosture = {
  redactionPosture: "synthetic_redacted" | "redacted_replay_ready";
  rawPromptRetained: false;
  rawPayloadRetained: false;
  redactedReplayAllowed: true;
  retentionMode: "fixture_only" | "review_required";
};

export type AskHelmContextPacketAuthorityFlags = {
  readOnly: true;
  writePath: false;
  officialWriteEnabled: false;
  autoExecutionEnabled: false;
  autoSendEnabled: false;
  autoApproveEnabled: false;
  canonicalMemoryWriteEnabled: false;
  multiTurnPersistenceEnabled: false;
};

export type AskHelmContextPacket = {
  packetId: string;
  version: typeof ASK_HELM_CONTEXT_PACKET_VERSION;
  workspace: AskHelmContextPacketWorkspaceScope;
  input: AskHelmContextPacketInput;
  intent: AskHelmQueryIntentClassification;
  retrievalPlan: AskHelmRetrievalPlan;
  includedContext: AskHelmContextPacketIncludedContext;
  excludedContext: AskHelmContextPacketExcludedContext[];
  memoryInjectionPolicy: AskHelmContextPacketMemoryInjectionPolicy;
  boundaryContract: AskHelmContextPacketBoundaryContract;
  promptContract: AskHelmContextPacketPromptContract;
  replay: AskHelmContextPacketReplayPosture;
  authority: AskHelmContextPacketAuthorityFlags;
};

export type AskHelmContextPacketBuilderInput = {
  packetId?: string;
  workspace: Omit<AskHelmContextPacketWorkspaceScope, "scope">;
  rawQuery: string;
  redactedQuery?: string;
  inputMode?: "typed" | "voice";
  transcriptConfirmed?: boolean;
  transcriptConfidence?: "high" | "medium" | "low";
  currentPage?: string;
  currentObject?: AskHelmContextPacketInput["currentObject"];
  relatedObjects?: AskHelmContextPacketObjectSummary[];
  memoryCandidates?: AskHelmContextPacketMemorySummary[];
  workspaceContext?: string[];
  knowledgePackLabels?: string[];
  excludedContext?: AskHelmContextPacketExcludedContext[];
  boundaryMessage?: string;
  authority?: Partial<AskHelmContextPacketAuthorityFlags>;
  replay?: Partial<AskHelmContextPacketReplayPosture>;
};

export type AskHelmContextPacketAuditFailure =
  | "missing_boundary"
  | "raw_prompt_leak"
  | "secret_pattern"
  | "cross_workspace_leakage"
  | "official_write_enabled"
  | "auto_execution_enabled"
  | "unreviewed_memory_injected"
  | "revoked_archived_memory_injected"
  | "wrong_object_memory_injected"
  | "missing_evidence_refs"
  | "missing_redaction_posture"
  | "too_broad_context"
  | "raw_query_retained"
  | "multiturn_enabled"
  | "llm_final_ranking_enabled";

export type AskHelmContextPacketAuditWarning =
  | "stale_memory_downgraded"
  | "suspected_contradiction_downgraded"
  | "weak_source_memory"
  | "empty_included_context";

export type AskHelmContextPacketAuditSummary = {
  passed: boolean;
  packetId: string;
  version: typeof ASK_HELM_CONTEXT_PACKET_VERSION;
  failureCount: number;
  warningCount: number;
  authorityLeakCount: number;
  rawLeakCount: number;
  memoryPolicyViolationCount: number;
  redactionCoveragePercent: number;
  contextCoveragePercent: number;
  failures: AskHelmContextPacketAuditFailure[];
  warnings: AskHelmContextPacketAuditWarning[];
};

const MAX_INCLUDED_CONTEXT_ITEMS = 12;
const SECRET_PATTERNS = [
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /secret[_-]?key/i,
  /api[_-]?key/i,
  /password/i,
  /mysql:\/\/[^@\s]+@/i,
  /bearer\s+[a-z0-9._-]{12,}/i,
];
const RAW_PROMPT_PATTERNS = [
  /raw prompt\s*:/i,
  /system prompt\s*:/i,
  /user prompt\s*:/i,
  /BEGIN PROMPT/i,
  /ignore previous instructions/i,
];

export function buildAskHelmContextPacket(input: AskHelmContextPacketBuilderInput): AskHelmContextPacket {
  const intent = classifyAskHelmQueryIntent(input.rawQuery);
  const retrievalPlan = buildContextPacketRetrievalPlan(intent);
  const boundaryType = resolveBoundaryType(intent.intentType);
  const injectedMemory = (input.memoryCandidates ?? []).filter((item) => isInjectableMemory(item, input));
  const excludedMemory = (input.memoryCandidates ?? []).filter((item) => !isInjectableMemory(item, input));

  return {
    packetId: input.packetId ?? `askhelm_ctx_${hashAskHelmContextText(`${input.workspace.workspaceId}:${input.rawQuery}`)}`,
    version: ASK_HELM_CONTEXT_PACKET_VERSION,
    workspace: {
      scope: "current_workspace",
      workspaceId: input.workspace.workspaceId,
      workspaceSlug: input.workspace.workspaceSlug,
      membershipRole: input.workspace.membershipRole,
      focusAreas: input.workspace.focusAreas ?? [],
    },
    input: {
      rawQueryHash: hashAskHelmContextText(input.rawQuery),
      redactedQuery: input.redactedQuery,
      inputMode: input.inputMode ?? "typed",
      transcriptConfirmed: input.transcriptConfirmed,
      transcriptConfidence: input.transcriptConfidence,
      currentPage: input.currentPage,
      currentObject: input.currentObject,
      rawQueryRetained: false,
      rawPromptRetained: false,
      rawAudioRetained: false,
    },
    intent,
    retrievalPlan,
    includedContext: {
      objects: input.relatedObjects ?? [],
      memory: injectedMemory,
      workspaceContext: input.workspaceContext ?? [],
      knowledgePackLabels: input.knowledgePackLabels ?? [],
    },
    excludedContext: [
      ...buildDeniedSourceExclusions(retrievalPlan),
      ...excludedMemory.map((item) => memoryToExcludedContext(item, input)),
      ...(input.excludedContext ?? []),
    ],
    memoryInjectionPolicy: {
      reviewedActiveOnly: true,
      objectRelevantRequired: true,
      freshnessRequired: true,
      contradictionDowngradeRequired: true,
      candidatesNotInjected: true,
      revokedArchivedExcluded: true,
      injectedMemoryIds: injectedMemory.map((item) => item.id),
      excludedMemoryIds: excludedMemory.map((item) => item.id),
    },
    boundaryContract: {
      boundaryType,
      message: input.boundaryMessage ?? defaultBoundaryMessage(boundaryType),
      reviewRequired: boundaryType === "review_required" || boundaryType === "draft_only",
      suggestionNotCommitment: true,
      officialWriteDenied: true,
      autoSendDenied: true,
      autoApproveDenied: true,
    },
    promptContract: {
      promptKey: "ask-helm-answer",
      promptVersion: "offline-context-packet-v1",
      outputMode: "structured_explanation",
      rawPromptRetained: false,
      productionPromptAdoptionAllowed: false,
      llmFinalRankingAllowed: false,
      allowedUse: ["explain", "summarize", "route", "prepare_draft"],
      forbiddenUse: [
        "final_ranking",
        "official_write",
        "auto_send",
        "auto_approve",
        "commitment",
        "cross_workspace_answer",
        "canonical_memory_write",
      ],
    },
    replay: {
      redactionPosture: input.replay?.redactionPosture ?? "synthetic_redacted",
      rawPromptRetained: false,
      rawPayloadRetained: false,
      redactedReplayAllowed: true,
      retentionMode: input.replay?.retentionMode ?? "fixture_only",
    },
    authority: {
      readOnly: true,
      writePath: false,
      officialWriteEnabled: false,
      autoExecutionEnabled: false,
      autoSendEnabled: false,
      autoApproveEnabled: false,
      canonicalMemoryWriteEnabled: false,
      multiTurnPersistenceEnabled: false,
      ...input.authority,
    } as AskHelmContextPacketAuthorityFlags,
  };
}

export function auditAskHelmContextPacket(packet: AskHelmContextPacket): AskHelmContextPacketAuditSummary {
  const stringValues = collectStringValues(packet);
  const failures = uniqueFailures([
    ...(!packet.boundaryContract?.message ? ["missing_boundary" as const] : []),
    ...(stringValues.some((value) => RAW_PROMPT_PATTERNS.some((pattern) => pattern.test(value)))
      ? ["raw_prompt_leak" as const]
      : []),
    ...(stringValues.some((value) => SECRET_PATTERNS.some((pattern) => pattern.test(value)))
      ? ["secret_pattern" as const]
      : []),
    ...(hasCrossWorkspaceLeakage(packet) ? ["cross_workspace_leakage" as const] : []),
    ...(!packet.authority.readOnly || packet.authority.writePath || packet.authority.officialWriteEnabled
      ? ["official_write_enabled" as const]
      : []),
    ...(packet.authority.autoExecutionEnabled || packet.authority.autoSendEnabled || packet.authority.autoApproveEnabled
      ? ["auto_execution_enabled" as const]
      : []),
    ...(packet.authority.multiTurnPersistenceEnabled ? ["multiturn_enabled" as const] : []),
    ...(packet.promptContract.llmFinalRankingAllowed ? ["llm_final_ranking_enabled" as const] : []),
    ...(hasUnreviewedMemoryInjected(packet) ? ["unreviewed_memory_injected" as const] : []),
    ...(hasRevokedOrArchivedMemoryInjected(packet) ? ["revoked_archived_memory_injected" as const] : []),
    ...(hasWrongObjectMemoryInjected(packet) ? ["wrong_object_memory_injected" as const] : []),
    ...(hasMissingEvidenceRefs(packet) ? ["missing_evidence_refs" as const] : []),
    ...(hasMissingRedactionPosture(packet) ? ["missing_redaction_posture" as const] : []),
    ...(countIncludedContextItems(packet.includedContext) > MAX_INCLUDED_CONTEXT_ITEMS ? ["too_broad_context" as const] : []),
    ...(packet.input.rawQueryRetained ? ["raw_query_retained" as const] : []),
    ...(packet.input.rawPromptRetained || packet.replay.rawPromptRetained || packet.promptContract.rawPromptRetained
      ? ["raw_prompt_leak" as const]
      : []),
  ]);
  const warnings = uniqueWarnings([
    ...(packet.includedContext.memory.some((item) => item.freshness === "stale")
      ? ["stale_memory_downgraded" as const]
      : []),
    ...(packet.includedContext.memory.some((item) => item.contradictionStatus === "suspected")
      ? ["suspected_contradiction_downgraded" as const]
      : []),
    ...(packet.includedContext.memory.some((item) => item.sourceStrength === "weak")
      ? ["weak_source_memory" as const]
      : []),
    ...(countIncludedContextItems(packet.includedContext) === 0 ? ["empty_included_context" as const] : []),
  ]);
  const authorityLeakCount = failures.filter((item) =>
    ["official_write_enabled", "auto_execution_enabled", "multiturn_enabled", "llm_final_ranking_enabled"].includes(item),
  ).length;
  const rawLeakCount = failures.filter((item) =>
    ["raw_prompt_leak", "secret_pattern", "raw_query_retained"].includes(item),
  ).length;
  const memoryPolicyViolationCount = failures.filter((item) =>
    ["unreviewed_memory_injected", "revoked_archived_memory_injected", "wrong_object_memory_injected"].includes(item),
  ).length;

  return {
    passed: failures.length === 0,
    packetId: packet.packetId,
    version: packet.version,
    failureCount: failures.length,
    warningCount: warnings.length,
    authorityLeakCount,
    rawLeakCount,
    memoryPolicyViolationCount,
    redactionCoveragePercent: scoreRedactionCoverage(packet),
    contextCoveragePercent: scoreContextCoverage(packet),
    failures,
    warnings,
  };
}

export function hashAskHelmContextText(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function buildContextPacketRetrievalPlan(intent: AskHelmQueryIntentClassification): AskHelmRetrievalPlan {
  if (
    intent.intentType === "out_of_scope" ||
    intent.intentType === "unsupported_open_domain" ||
    intent.intentType === "unsupported_chitchat" ||
    intent.intentType === "cross_workspace_denied"
  ) {
    return {
      readOnly: true,
      writePath: false,
      sources: [],
      deniedSources: ["cross_workspace_context", "open_domain_web", "official_write_path"],
      reason: "Query is outside Ask Helm supported current-workspace scope.",
    };
  }

  const sources = new Set<AskHelmRetrievalSource>(["workspace_context"]);
  if (intent.intentType === "object_search" || intent.needsObjectContext) {
    sources.add("object_search");
  }
  if (intent.needsMemory) {
    sources.add("memory_summary");
  }
  if (intent.needsSystemKnowledge) {
    sources.add("knowledge_pack");
  }

  return {
    readOnly: true,
    writePath: false,
    sources: Array.from(sources),
    deniedSources: ["official_write_path"],
    reason: "Read-only workspace retrieval only.",
  };
}

function resolveBoundaryType(intentType: AskHelmQueryIntentClassification["intentType"]): AskHelmResponseBoundaryType {
  if (intentType === "cross_workspace_denied") return "cross_workspace_denied";
  if (
    intentType === "unsupported_open_domain" ||
    intentType === "unsupported_chitchat" ||
    intentType === "out_of_scope"
  ) return "out_of_scope";
  if (intentType === "review_required_execution" || intentType === "request_execution" || intentType === "why_blocked") {
    return "review_required";
  }
  if (intentType === "prepare_draft") return "draft_only";
  if (intentType === "plan_breakdown" || intentType === "queue_internal_followup" || intentType === "request_handoff") {
    return "suggestion_not_commitment";
  }
  return "read_only";
}

function defaultBoundaryMessage(boundaryType: AskHelmResponseBoundaryType) {
  if (boundaryType === "cross_workspace_denied") return "Ask Helm context packet is limited to the current workspace.";
  if (boundaryType === "out_of_scope") return "Ask Helm context packet excludes open-domain or unsupported context.";
  if (boundaryType === "review_required") return "Ask Helm can prepare review context only; it cannot execute or commit.";
  if (boundaryType === "draft_only") return "Draft context must be reviewed before any send, write or commitment.";
  if (boundaryType === "suggestion_not_commitment") return "Suggested next steps are not commitments or official writes.";
  return "Ask Helm context packet is read-only and evidence-scoped.";
}

function isInjectableMemory(item: AskHelmContextPacketMemorySummary, input: AskHelmContextPacketBuilderInput) {
  return (
    item.status === "reviewed_active" &&
    item.freshness === "fresh" &&
    item.contradictionStatus === "none" &&
    item.evidenceRefs.length > 0 &&
    isObjectRelevantMemory(item, input)
  );
}

function memoryToExcludedContext(
  item: AskHelmContextPacketMemorySummary,
  input: AskHelmContextPacketBuilderInput,
): AskHelmContextPacketExcludedContext {
  if (item.status === "candidate") {
    return { source: "memory_candidate", reason: "Candidate memory is not injected into Ask Helm context.", refId: item.id };
  }
  if (item.status === "revoked") {
    return { source: "memory_revoked", reason: "Revoked memory is excluded from Ask Helm context.", refId: item.id };
  }
  if (item.status === "archived") {
    return { source: "memory_archived", reason: "Archived memory is excluded from Ask Helm context.", refId: item.id };
  }
  if (item.status === "unreviewed") {
    return { source: "memory_unreviewed", reason: "Unreviewed memory is not injected.", refId: item.id };
  }
  if (!isObjectRelevantMemory(item, input)) {
    return {
      source: "memory_unrelated",
      reason: "Reviewed memory is not relevant to the current workspace object anchors.",
      refId: item.id,
    };
  }
  return { source: "memory_stale_or_conflicting", reason: "Memory freshness or contradiction status requires downgrade.", refId: item.id };
}

function isObjectRelevantMemory(item: AskHelmContextPacketMemorySummary, input: AskHelmContextPacketBuilderInput) {
  if (item.objectRefs.length === 0) return false;

  const anchors = buildObjectAnchorSet(input.workspace.workspaceId, input.currentObject, input.relatedObjects ?? []);
  return item.objectRefs.some((ref) => anchors.has(`${ref.type}:${ref.id}`));
}

function buildDeniedSourceExclusions(retrievalPlan: AskHelmRetrievalPlan): AskHelmContextPacketExcludedContext[] {
  return retrievalPlan.deniedSources.map((source) => ({
    source: sourceToExcludedContextSource(source),
    reason: `Retrieval source denied by Ask Helm read-only context packet: ${source}.`,
  }));
}

function sourceToExcludedContextSource(source: string): AskHelmContextPacketExcludedContext["source"] {
  if (source === "cross_workspace_context") return "cross_workspace_context";
  if (source === "open_domain_web") return "open_domain_web";
  if (source === "official_write_path") return "official_write_path";
  return "external_agent_unreviewed";
}

function hasCrossWorkspaceLeakage(packet: AskHelmContextPacket) {
  const workspaceId = packet.workspace.workspaceId;
  return (
    packet.workspace.scope !== "current_workspace" ||
    packet.includedContext.objects.some((item) => item.workspaceId && item.workspaceId !== workspaceId) ||
    packet.includedContext.memory.some((item) => item.workspaceId && item.workspaceId !== workspaceId)
  );
}

function hasUnreviewedMemoryInjected(packet: AskHelmContextPacket) {
  return packet.includedContext.memory.some((item) => item.status !== "reviewed_active");
}

function hasRevokedOrArchivedMemoryInjected(packet: AskHelmContextPacket) {
  return packet.includedContext.memory.some((item) => item.status === "revoked" || item.status === "archived");
}

function hasWrongObjectMemoryInjected(packet: AskHelmContextPacket) {
  const anchors = buildObjectAnchorSet(packet.workspace.workspaceId, packet.input.currentObject, packet.includedContext.objects);
  return packet.includedContext.memory.some(
    (item) => item.objectRefs.length === 0 || !item.objectRefs.some((ref) => anchors.has(`${ref.type}:${ref.id}`)),
  );
}

function hasMissingEvidenceRefs(packet: AskHelmContextPacket) {
  return (
    packet.includedContext.objects.some((item) => item.evidenceRefs.length === 0) ||
    packet.includedContext.memory.some((item) => item.evidenceRefs.length === 0)
  );
}

function hasMissingRedactionPosture(packet: AskHelmContextPacket) {
  return (
    !packet.replay.redactionPosture ||
    packet.replay.rawPayloadRetained ||
    packet.replay.rawPromptRetained ||
    packet.input.rawPromptRetained ||
    packet.input.rawAudioRetained
  );
}

function countIncludedContextItems(context: AskHelmContextPacketIncludedContext) {
  return context.objects.length + context.memory.length + context.workspaceContext.length + context.knowledgePackLabels.length;
}

function buildObjectAnchorSet(
  workspaceId: string,
  currentObject: AskHelmContextPacketInput["currentObject"],
  relatedObjects: AskHelmContextPacketObjectSummary[],
) {
  const anchors = new Set<string>([`workspace:${workspaceId}`]);
  if (currentObject) {
    anchors.add(`${currentObject.type}:${currentObject.id}`);
  }
  for (const object of relatedObjects) {
    anchors.add(`${object.objectType}:${object.objectId}`);
  }
  return anchors;
}

function scoreRedactionCoverage(packet: AskHelmContextPacket) {
  const checks = [
    Boolean(packet.replay.redactionPosture),
    packet.replay.rawPromptRetained === false,
    packet.replay.rawPayloadRetained === false,
    packet.input.rawPromptRetained === false,
    packet.input.rawQueryRetained === false,
    packet.input.rawAudioRetained === false,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function scoreContextCoverage(packet: AskHelmContextPacket) {
  const checks = [
    Boolean(packet.intent.intentType),
    Boolean(packet.retrievalPlan.reason),
    Boolean(packet.boundaryContract.message),
    Boolean(packet.promptContract.promptKey),
    Boolean(packet.replay.redactionPosture),
    Boolean(packet.authority.readOnly),
    packet.excludedContext.length > 0,
    countIncludedContextItems(packet.includedContext) > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function collectStringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStringValues);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStringValues);
  }
  return [];
}

function uniqueFailures(values: AskHelmContextPacketAuditFailure[]) {
  return Array.from(new Set(values));
}

function uniqueWarnings(values: AskHelmContextPacketAuditWarning[]) {
  return Array.from(new Set(values));
}
