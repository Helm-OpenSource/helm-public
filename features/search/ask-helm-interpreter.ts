import {
  classifyAskHelmQueryIntent,
  type AskHelmIntentType,
  type AskHelmQueryIntentClassification,
} from "@/features/search/ask-helm-query-intent";
import {
  loadAskHelmKnowledgePack,
  type AskHelmKnowledgePack,
  type AskHelmKnowledgePackContext,
} from "@/features/search/ask-helm-knowledge-pack";
import type { AskHelmBusinessSignalDraft } from "@/features/search/ask-helm-business-signals";

export type AskHelmObjectType = "contact" | "company" | "opportunity" | "meeting";

export type AskHelmGroundedObject = {
  objectType: AskHelmObjectType;
  objectId: string;
  displayName: string;
  status: string;
  deepLink: string;
};

export type AskHelmResponseBoundaryType =
  | "review_required"
  | "read_only"
  | "draft_only"
  | "execution_denied"
  | "cross_workspace_denied"
  | "transcript_confirmation_required"
  | "suggestion_not_commitment"
  | "out_of_scope";

export type AskHelmNextStepTarget = {
  type: "deep_link" | "page_target" | "object_target";
  target: string;
  label: string;
};

export type AskHelmRetrievalSource =
  | "object_search"
  | "memory_summary"
  | "workspace_context"
  | "knowledge_pack";

export type AskHelmRetrievalPlan = {
  readOnly: true;
  writePath: false;
  sources: AskHelmRetrievalSource[];
  deniedSources: string[];
  reason: string;
};

export type AskHelmActionPlanStepObjectRef = {
  label: string;
  source: "grounded_object" | "query_reference";
  objectType?: AskHelmObjectType;
  objectId?: string;
  deepLink?: string;
};

export type AskHelmActionPlanStepDri = {
  label: string;
  role: "owner" | "reviewer" | "operator";
};

export type AskHelmActionPlanStepDue = {
  label: string;
  timing: "today" | "before_review" | "before_execution" | "this_week";
};

export type AskHelmActionPlan = {
  status: "draft" | "review_required";
  summary: string;
  steps: Array<{
    id: string;
    title: string;
    detail: string;
    objectRef?: AskHelmActionPlanStepObjectRef;
    dri: AskHelmActionPlanStepDri;
    due: AskHelmActionPlanStepDue;
    target?: AskHelmNextStepTarget;
    reviewRequired: boolean;
  }>;
  auditNote: string;
};

export type AskHelmPreparedArtifact = {
  type: "draft_message" | "review_packet" | "internal_note";
  status: "draft_only" | "review_required";
  title: string;
  bodyPreview: string;
  targetSurface: string;
  reviewRequired: boolean;
};

export type AskHelmActionHandoff = {
  mode: "open_page" | "queue_internal" | "request_review";
  target: string;
  label: string;
  auditLabel: string;
  writeEnabled: false;
};

export type AskHelmVoiceMetadata = {
  inputMode: "typed" | "voice";
  transcriptConfirmed: boolean;
  transcriptConfidence: "high" | "medium" | "low";
  requiresTranscriptConfirmation: boolean;
  rawAudioRetained: false;
  voiceOnlyApprovalAllowed: false;
  speakableSummary: string;
  speakableBoundary: string;
};

export type AskHelmActionPacketEvidenceSource =
  | "query_reference"
  | "object"
  | "business_signal"
  | "memory"
  | "workspace_context"
  | "helm_semantics"
  | "boundary";

export type AskHelmActionPacketEvidenceStrength =
  | "strong"
  | "medium"
  | "weak";

export type AskHelmActionPacketEvidenceRef = {
  id: string;
  label: string;
  sourceType: AskHelmActionPacketEvidenceSource;
  strength: AskHelmActionPacketEvidenceStrength;
  note: string;
  target?: string;
};

export type AskHelmActionPacketRisk = {
  id: string;
  label: string;
  severity: "high" | "medium" | "low";
  evidenceRefIds: string[];
  reviewRequired: boolean;
  note: string;
};

export type AskHelmActionPacketMissingInfo = {
  id: string;
  label: string;
  reason: string;
  blocksExecution: boolean;
};

export type AskHelmActionPacket = {
  status: "draft" | "review_required" | "blocked";
  intentType: AskHelmIntentType;
  summary: string;
  nextSurface: AskHelmNextStepTarget;
  evidenceRefs: AskHelmActionPacketEvidenceRef[];
  risks: AskHelmActionPacketRisk[];
  missingInfo: AskHelmActionPacketMissingInfo[];
  reviewChecklist: string[];
  authority: {
    readOnly: true;
    writeEnabled: false;
    autoExecuteEnabled: false;
    formalCommitmentAllowed: false;
    groundingMode: "evidence_refs_only";
  };
  auditNote: string;
};

export type AskHelmResponse = {
  classification: AskHelmQueryIntentClassification;
  retrievalPlan: AskHelmRetrievalPlan;
  answer: {
    summary: string;
    explanation?: string;
    confidence: "high" | "medium" | "low";
  };
  relatedObjects?: {
    objects: AskHelmGroundedObject[];
    totalCount: number;
  };
  nextStep: {
    primary: AskHelmNextStepTarget;
    alternatives?: AskHelmNextStepTarget[];
  };
  actionPacket?: AskHelmActionPacket;
  plan?: AskHelmActionPlan;
  preparedArtifact?: AskHelmPreparedArtifact;
  actionHandoff?: AskHelmActionHandoff;
  voice?: AskHelmVoiceMetadata;
  boundaryNote?: {
    type: AskHelmResponseBoundaryType;
    message: string;
  };
  grounding: {
    currentPage?: string;
    currentObject?: { type: string; id: string };
    workspaceContext: string[];
    memoryUsed: boolean;
    systemKnowledgeUsed: boolean;
  };
};

export type AskHelmInterpreterInput = {
  rawQuery: string;
  currentPage?: string;
  currentObject?: {
    type: AskHelmObjectType;
    id: string;
    displayName?: string;
    status?: string;
  };
  relatedObjects?: AskHelmGroundedObject[];
  memorySummary?: string[];
  businessSignals?: AskHelmBusinessSignalDraft[];
  knowledgePack?: AskHelmKnowledgePack;
  inputMode?: "typed" | "voice";
  voiceTranscriptConfidence?: "high" | "medium" | "low";
  transcriptConfirmed?: boolean;
  workspaceContext?: AskHelmKnowledgePackContext & {
    workspaceId?: string;
    workspaceSlug?: string;
  };
};

const BUSINESS_AWARE_INTENTS = new Set<AskHelmIntentType>([
  "today_priority",
  "current_status",
  "why_blocked",
  "why_recommendation",
  "plan_breakdown",
  "prepare_draft",
  "prepare_review_packet",
  "queue_internal_followup",
  "request_handoff",
  "request_execution",
  "review_required_execution",
]);

const ACTION_PACKET_INTENTS = new Set<AskHelmIntentType>([
  "plan_breakdown",
  "prepare_draft",
  "prepare_review_packet",
  "queue_internal_followup",
  "request_handoff",
  "request_execution",
  "review_required_execution",
]);

function pickBusinessAwareSignal(
  classification: AskHelmQueryIntentClassification,
  signals: AskHelmBusinessSignalDraft[] | undefined,
): AskHelmBusinessSignalDraft | undefined {
  if (!signals?.length) return undefined;
  if (!BUSINESS_AWARE_INTENTS.has(classification.intentType)) return undefined;
  return signals[0];
}

function buildBusinessAwareLayerExplanation(signal: AskHelmBusinessSignalDraft) {
  const reason = signal.reason?.trim() || "当前工作区出现需要承接的经营信号。";
  return `依据：${reason} 边界：${signal.boundaryNote}`;
}

function buildBusinessAwareNextStep(
  signal: AskHelmBusinessSignalDraft,
): AskHelmResponse["nextStep"] {
  return {
    primary: signal.primaryNextStep,
    alternatives: [
      {
        type: "page_target",
        target: "/operating",
        label: "回到经营总盘队列",
      },
    ],
  };
}

const INTENT_FALLBACK_PAGE: Record<AskHelmIntentType, string> = {
  object_search: "/search",
  object_recent: "/memory",
  current_status: "/operating",
  today_priority: "/operating",
  why_recommendation: "/operating",
  why_blocked: "/approvals",
  how_to_use: "/search",
  definition_diff: "/settings",
  next_step_page: "/operating",
  next_step_object: "/search",
  plan_breakdown: "/operating",
  prepare_draft: "/approvals",
  prepare_review_packet: "/approvals",
  queue_internal_followup: "/operating",
  request_handoff: "/operating",
  request_execution: "/operating",
  review_required_execution: "/approvals",
  submit_business_signal: "/search?mode=ask&intent=submit_business_signal",
  unsupported_open_domain: "/search",
  unsupported_chitchat: "/search",
  cross_workspace_denied: "/search",
  out_of_scope: "/search",
};

function objectDeepLink(objectType: AskHelmObjectType, objectId: string) {
  switch (objectType) {
    case "contact":
      return `/contacts/${objectId}`;
    case "company":
      return `/companies/${objectId}`;
    case "meeting":
      return `/meetings/${objectId}`;
    case "opportunity":
      return `/opportunities?opportunityId=${objectId}`;
  }
}

function searchTarget(rawQuery: string) {
  const normalized = rawQuery.trim();
  return normalized ? `/search?q=${encodeURIComponent(normalized)}` : "/search";
}

function buildQueryReferenceLabel(rawQuery: string) {
  const trimmed = rawQuery.trim();
  const matched =
    trimmed.match(/(?:帮我|请|麻烦)?把(.+?)(?:拆(?:一下|成|解).*)$/u) ??
    trimmed.match(
      /(?:帮我|请|麻烦)?(.+?)(?:怎么推进|如何推进|安排执行|进入执行|推进下去|开始执行).*/u,
    ) ??
    trimmed.match(
      /(?:帮我|请|麻烦)?(?:准备|起草)(.+?)(?:草稿|材料包|review packet).*/u,
    );

  const label = matched?.[1]?.trim() || trimmed;
  return label.length > 36 ? `${label.slice(0, 36)}…` : label;
}

function buildPlanStepObjectRef(
  input: AskHelmInterpreterInput,
): AskHelmActionPlanStepObjectRef {
  if (input.currentObject) {
    return {
      label: input.currentObject.displayName ?? "当前对象",
      source: "grounded_object",
      objectType: input.currentObject.type,
      objectId: input.currentObject.id,
      deepLink: objectDeepLink(input.currentObject.type, input.currentObject.id),
    };
  }

  const relatedObject = input.relatedObjects?.[0];
  if (relatedObject) {
    return {
      label: relatedObject.displayName,
      source: "grounded_object",
      objectType: relatedObject.objectType,
      objectId: relatedObject.objectId,
      deepLink: relatedObject.deepLink,
    };
  }

  return {
    label: buildQueryReferenceLabel(input.rawQuery),
    source: "query_reference",
  };
}

function workspaceContextLines(input: AskHelmInterpreterInput) {
  const context = input.workspaceContext;
  return [
    context?.workspaceSlug ? `workspace:${context.workspaceSlug}` : undefined,
    context?.workspaceProfileType ? `profile:${context.workspaceProfileType}` : undefined,
    context?.membershipRole ? `role:${context.membershipRole}` : undefined,
    ...(context?.focusAreas ?? []).map((focusArea) => `focus:${focusArea}`),
    ...(context?.enabledTenantExtensions ?? []).map(
      (extension) => `tenant_extension:${extension}`,
    ),
  ].filter((value): value is string => Boolean(value));
}

function buildRetrievalPlan(
  classification: AskHelmQueryIntentClassification,
): AskHelmRetrievalPlan {
  if (
    classification.intentType === "out_of_scope" ||
    classification.intentType === "unsupported_open_domain" ||
    classification.intentType === "unsupported_chitchat" ||
    classification.intentType === "cross_workspace_denied"
  ) {
    return {
      readOnly: true,
      writePath: false,
      sources: [],
      deniedSources: [
        "cross_workspace_context",
        "open_domain_web",
        "official_write_path",
      ],
      reason: "Query is outside Ask Helm supported current-workspace scope.",
    };
  }

  const sources = new Set<AskHelmRetrievalSource>(["workspace_context"]);

  if (
    classification.intentType === "object_search" ||
    classification.needsObjectContext
  ) {
    sources.add("object_search");
  }
  if (classification.needsMemory) {
    sources.add("memory_summary");
  }
  if (classification.needsSystemKnowledge) {
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

function buildRelatedObjects(input: AskHelmInterpreterInput) {
  const objects = input.relatedObjects ?? [];
  if (!objects.length) return undefined;
  return {
    objects,
    totalCount: objects.length,
  };
}

function resolveHelpPage(rawQuery: string, knowledgePack: AskHelmKnowledgePack) {
  const normalized = rawQuery.toLowerCase();
  if (normalized.includes("approval") || normalized.includes("审批")) {
    return knowledgePack.deepLinkMap.help.approvals.page;
  }
  if (normalized.includes("memory") || normalized.includes("经营记忆")) {
    return knowledgePack.deepLinkMap.help.memory.page;
  }
  if (normalized.includes("setting") || normalized.includes("定义")) {
    return knowledgePack.deepLinkMap.help.settings.page;
  }
  if (normalized.includes("operating") || normalized.includes("下一步")) {
    return knowledgePack.deepLinkMap.help.operating.page;
  }
  return knowledgePack.deepLinkMap.help.search.page;
}

function buildNextStep(
  classification: AskHelmQueryIntentClassification,
  input: AskHelmInterpreterInput,
  knowledgePack: AskHelmKnowledgePack,
  topSignal: AskHelmBusinessSignalDraft | undefined,
): AskHelmResponse["nextStep"] {
  if (topSignal) {
    return buildBusinessAwareNextStep(topSignal);
  }
  const relatedObject = input.currentObject
    ? {
        deepLink: objectDeepLink(input.currentObject.type, input.currentObject.id),
        displayName: input.currentObject.displayName ?? input.currentObject.id,
      }
    : input.relatedObjects?.[0];

  if (
    relatedObject &&
    (classification.intentType === "next_step_object" ||
      classification.intentType === "current_status" ||
      classification.intentType === "object_recent")
  ) {
    return {
      primary: {
        type: "object_target",
        target: relatedObject.deepLink,
        label: `打开 ${relatedObject.displayName}`,
      },
      alternatives: [
        {
          type: "page_target",
          target: "/memory",
          label: "查看相关经营记忆",
        },
      ],
    };
  }

  if (classification.intentType === "object_search") {
    return {
      primary: {
        type: "deep_link",
        target: searchTarget(input.rawQuery),
        label: "查看匹配对象",
      },
    };
  }

  if (classification.intentType === "how_to_use") {
    const target = resolveHelpPage(input.rawQuery, knowledgePack);
    return {
      primary: {
        type: "page_target",
        target,
        label: "进入对应页面",
      },
    };
  }

  if (classification.intentType === "definition_diff") {
    return {
      primary: {
        type: "page_target",
        target: "/settings",
        label: "查看定义与边界",
      },
    };
  }

  if (classification.intentType === "submit_business_signal") {
    return {
      primary: {
        type: "page_target",
        target: "#ask-helm-signal-intake",
        label: "填写上报内容（仅生成复核候选）",
      },
      alternatives: [
        {
          type: "page_target",
          target: "/operating",
          label: "回到经营总盘",
        },
      ],
    };
  }

  if (
    classification.intentType === "prepare_review_packet" ||
    classification.intentType === "review_required_execution" ||
    classification.intentType === "prepare_draft"
  ) {
    return {
      primary: {
        type: "page_target",
        target: "/approvals",
        label:
          classification.intentType === "prepare_draft"
            ? "打开复核页面确认草稿"
            : "打开复核页面",
      },
      alternatives: [
        {
          type: "page_target",
          target: "/operating",
          label: "回到经营总盘队列",
        },
      ],
    };
  }

  if (
    classification.intentType === "plan_breakdown" ||
    classification.intentType === "queue_internal_followup" ||
    classification.intentType === "request_handoff" ||
    classification.intentType === "request_execution"
  ) {
    return {
      primary: {
        type: "page_target",
        target: "/operating",
        label: "打开经营总盘工作面",
      },
      alternatives: [
        {
          type: "page_target",
          target: "/approvals",
          label: "需要复核时进入审批",
        },
      ],
    };
  }

  const target = INTENT_FALLBACK_PAGE[classification.intentType];
  return {
    primary: {
      type: "page_target",
      target,
      label:
        classification.intentType === "out_of_scope"
          ? "回到工作区搜索"
          : "进入下一步页面",
    },
  };
}

function buildBoundaryNote(
  classification: AskHelmQueryIntentClassification,
): AskHelmResponse["boundaryNote"] {
  if (classification.intentType === "cross_workspace_denied") {
    return {
      type: "cross_workspace_denied",
      message:
        "问 Helm 只能使用当前工作区的上下文，不能跨工作区或跨租户比较、汇总或调取对象。",
    };
  }
  if (classification.intentType === "unsupported_open_domain") {
    return {
      type: "out_of_scope",
      message:
        "问 Helm 不做开放域新闻、股价、财报或外部网页检索；请把问题收回当前工作区的对象、记忆或页面职责。",
    };
  }
  if (classification.intentType === "unsupported_chitchat") {
    return {
      type: "out_of_scope",
      message:
        "问 Helm 不是闲聊助手，也不替你讲笑话、写诗、查天气或玩游戏；只处理当前工作区的经营问题、复核与导航。",
    };
  }
  if (classification.intentType === "submit_business_signal") {
    return {
      type: "review_required",
      message:
        "经营信号上报只会落成一条需先复核的草稿记录，不会自动通知客户、对接审批，也不写回 CRM 正式状态。",
    };
  }
  if (classification.intentType === "review_required_execution") {
    return {
      type: "review_required",
      message:
        "这个请求包含发送、审批、承诺、付款或正式写回意图；问 Helm 只能准备复核材料并带你进入复核页面，不能直接执行。",
    };
  }
  if (classification.intentType === "request_execution") {
    return {
      type: "review_required",
      message:
        "问 Helm 可以把执行请求整理成可复核的下一步，但不会替你启动高风险动作或写回正式系统。",
    };
  }
  if (classification.intentType === "prepare_draft") {
    return {
      type: "draft_only",
      message:
        "生成内容只作为草稿，必须在对应页面复核后才能发送、承诺或写回。",
    };
  }
  if (classification.intentType === "prepare_review_packet") {
    return {
      type: "review_required",
      message:
        "复核材料只整理依据、风险和下一步，不等于批准、合同、报价或正式承诺。",
    };
  }
  if (
    classification.intentType === "plan_breakdown" ||
    classification.intentType === "queue_internal_followup" ||
    classification.intentType === "request_handoff"
  ) {
    return {
      type: "suggestion_not_commitment",
      message:
        "行动拆解和交接只是下一步建议或内部准备，不自动承诺结果，也不直接修改高风险状态。",
    };
  }
  if (classification.intentType === "out_of_scope") {
    return {
      type: "out_of_scope",
      message:
        "问 Helm 只处理当前工作区内可归因的问题，不能跨租户、开放域检索或代替你执行高风险动作。",
    };
  }
  if (classification.intentType === "why_blocked") {
    return {
      type: "review_required",
      message:
        "这类问题只能解释阻塞和复核原因，不能直接批准、发送、承诺或写回正式系统。",
    };
  }
  if (classification.intentType === "why_recommendation") {
    return {
      type: "suggestion_not_commitment",
      message: "推荐解释不是对客户或团队的正式承诺，下一步仍需要在对应页面复核。",
    };
  }
  return {
    type: "read_only",
    message: "问 Helm 当前只做读取、解释、准备和导航，不执行正式写操作。",
  };
}

function buildAnswer(
  classification: AskHelmQueryIntentClassification,
  input: AskHelmInterpreterInput,
  knowledgePack: AskHelmKnowledgePack,
  topSignal: AskHelmBusinessSignalDraft | undefined,
): AskHelmResponse["answer"] {
  if (classification.intentType === "cross_workspace_denied") {
    return {
      summary: "这个请求被限制在当前工作区边界之外。",
      explanation:
        "我不能跨工作区或跨租户调取、比较或合并数据。请先切到对应工作区，或把问题限定为当前工作区的对象和记忆。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "unsupported_open_domain") {
    return {
      summary: "这个问题需要开放域信息，问 Helm 当前不处理。",
      explanation:
        "问 Helm 只使用当前工作区的对象、记忆和系统知识包；新闻、股价、财报和外部网页检索不进入这个入口。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "unsupported_chitchat") {
    return {
      summary: "问 Helm 不替你做闲聊或开放对话。",
      explanation:
        "讲笑话、聊心情、写诗、玩游戏、查天气这类请求不在工作区职责范围内。请改问对象、复核、阻塞、跟进，或上报一条经营信号。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "submit_business_signal") {
    return {
      summary: "我会把它整理成一条待复核的经营信号草稿。",
      explanation:
        "上报只会写入一条审计候选记录，不自动写回 CRM、不发送外部消息、不创建正式任务；负责人需要在复核入口确认后再继续。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "review_required_execution") {
    if (topSignal) {
      return {
        summary: `先复核：${topSignal.title}。这条不会由 问 Helm 直接执行。`,
        explanation: `${buildBusinessAwareLayerExplanation(topSignal)} 发送、批准、付款、承诺和正式写回都必须由用户在对应页面确认。`,
        confidence: classification.confidence,
      };
    }
    return {
      summary: "这个请求需要复核，不能由 问 Helm 直接执行。",
      explanation:
        "我可以把上下文整理成复核材料，并把下一步收口到审批或经营总盘；发送、批准、付款、承诺和正式写回都必须由用户在对应页面确认。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "plan_breakdown") {
    if (topSignal) {
      return {
        summary: `先围绕「${topSignal.title}」拆出可复核的行动计划。`,
        explanation: `${buildBusinessAwareLayerExplanation(topSignal)} 计划只作为下一步建议，进入经营总盘后由用户确认承接。`,
        confidence: classification.confidence,
      };
    }
    return {
      summary: "我会把这个需求拆成可复核的行动计划。",
      explanation:
        "计划会先定位对象和事实，再核对记忆、阻塞和页面职责，最后进入经营总盘继续推进。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "prepare_draft") {
    return {
      summary: "我会把这个需求整理成草稿，而不是直接发送。",
      explanation:
        "草稿只作为可编辑准备件；正式外发、承诺或写回必须在对应页面复核。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "prepare_review_packet") {
    return {
      summary: "我会准备一份复核材料包。",
      explanation:
        "材料包会列出已知事实、风险、建议下一步和需要人工确认的点，不替代审批决定。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "queue_internal_followup") {
    return {
      summary: "我会把它收口成内部跟进队列草稿。",
      explanation:
        "当前实现只生成可审计的交接目标，不直接写入队列；进入经营总盘后由用户确认。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "request_handoff") {
    return {
      summary: "我会把这个请求整理成可交接的交接。",
      explanation:
        "交接只说明对象、原因、建议下一步和复核边界；最终归属和执行仍在对应工作面确认。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "request_execution") {
    return {
      summary: "我会把执行请求转成可复核的下一步。",
      explanation:
        "问 Helm 不直接启动执行动作；它只把执行意图收口到经营总盘或审批页面，由人确认后继续。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "out_of_scope") {
    return {
      summary: "这个问题超出 问 Helm 的当前边界。",
      explanation:
        "它可能涉及跨工作区、开放域信息或高风险执行。请回到当前工作区对象、经营记忆、审批或经营总盘页面处理。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "object_search") {
    return {
      summary: "我会先把这个问题当作工作区对象搜索处理。",
      explanation: "对象结果优先展示；如果需要解释或下一步，再进入对象详情或相关工作页面。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "how_to_use") {
    const target = resolveHelpPage(input.rawQuery, knowledgePack);
    const page = knowledgePack.pageResponsibilities[target];
    return {
      summary: `这个问题应从 ${target} 的页面职责开始看。`,
      explanation: page
        ? `${page.primaryPurpose} 它不替代审批、发送或正式写回。`
        : "问 Helm 会优先把你带回当前工作区的权威页面。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "definition_diff") {
    return {
      summary: "这个问题属于 Helm 内部职责和边界解释。",
      explanation:
        "我会使用 knowledge 资料 的页面职责和边界说明来回答，并把下一步收口到设置或对应主页面。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "today_priority") {
    if (topSignal) {
      return {
        summary: `当前工作区最优先该看：${topSignal.title}。`,
        explanation: `${buildBusinessAwareLayerExplanation(topSignal)} 排序仅作为下一步判断依据，不替你承诺、审批或发送。`,
        confidence: classification.confidence,
      };
    }
    return {
      summary: "这个问题应读取工作区上下文和经营记忆后进入经营总盘队列。",
      explanation:
        "排序和建议只能作为下一步判断依据，不会自动替你承诺、审批或发送。",
      confidence: classification.confidence,
    };
  }

  if (topSignal && BUSINESS_AWARE_INTENTS.has(classification.intentType)) {
    return {
      summary: `先围绕当前工作区信号「${topSignal.title}」回答。`,
      explanation: `${buildBusinessAwareLayerExplanation(topSignal)} 当前工作区事实最权威；Helm 语义只负责路由和复核姿态；LLM 仅用于解释、整理或导航。`,
      confidence: classification.confidence,
    };
  }

  return {
    summary: "这个问题可以在当前工作区的只读上下文内解释并给出下一步。",
    explanation:
      "解释器会按意图加载对象、经营记忆和系统知识，再把你带回对应对象或页面。",
    confidence: classification.confidence,
  };
}

function buildActionPlan(
  classification: AskHelmQueryIntentClassification,
  input: AskHelmInterpreterInput,
): AskHelmActionPlan | undefined {
  if (
    classification.intentType !== "plan_breakdown" &&
    classification.intentType !== "request_execution" &&
    classification.intentType !== "review_required_execution"
  ) {
    return undefined;
  }

  const objectLabel =
    input.currentObject?.displayName ??
    input.relatedObjects?.[0]?.displayName ??
    "当前对象";
  const objectRef = buildPlanStepObjectRef(input);
  const reviewRequired =
    classification.intentType === "request_execution" ||
    classification.intentType === "review_required_execution";

  return {
    status: reviewRequired ? "review_required" : "draft",
    summary:
      classification.intentType === "review_required_execution"
        ? "把高风险执行请求降级为复核计划。"
        : "把用户需求拆成可继续推进的内部行动计划。",
    steps: [
      {
        id: "confirm-context",
        title: "确认对象和事实",
        detail: `先用当前工作区的搜索结果确认 ${objectLabel}、相关状态和最近上下文。`,
        objectRef,
        dri: {
          label: "当前负责人先核对对象事实。",
          role: "owner",
        },
        due: {
          label: "今天内完成事实核对。",
          timing: "today",
        },
        target: {
          type: "page_target",
          target: searchTarget(input.rawQuery),
          label: "回到搜索结果核对对象",
        },
        reviewRequired: false,
      },
      {
        id: "check-memory-and-risk",
        title: "核对记忆、阻塞和边界",
        detail:
          "读取经营记忆、审批原因和系统知识包，只形成判断依据，不替代批准或承诺。",
        objectRef,
        dri: reviewRequired
          ? {
              label: "复核人检查边界、审批原因和风险。",
              role: "reviewer",
            }
          : {
              label: "当前负责人补齐记忆和风险判断。",
              role: "owner",
            },
        due: reviewRequired
          ? {
              label: "进入复核前完成边界检查。",
              timing: "before_review",
            }
          : {
              label: "今天内补齐记忆和风险判断。",
              timing: "today",
            },
        target: {
          type: "page_target",
          target: reviewRequired ? "/approvals" : "/memory",
          label: reviewRequired ? "打开审批复核" : "查看经营记忆",
        },
        reviewRequired,
      },
      {
        id: "continue-in-operating",
        title: "进入经营总盘承接下一步",
        detail:
          "把下一步收口到经营总盘，由用户确认负责人、节奏和是否继续升级复核。",
        objectRef,
        dri: {
          label: "经营总盘负责人确认承接人与升级节奏。",
          role: "operator",
        },
        due: reviewRequired
          ? {
              label: "复核通过前不得进入正式执行。",
              timing: "before_execution",
            }
          : {
              label: "本周内确认经营总盘承接。",
              timing: "this_week",
            },
        target: {
          type: "page_target",
          target: "/operating",
          label: "打开经营总盘工作面",
        },
        reviewRequired,
      },
    ],
    auditNote:
      "问 Helm 只生成可复核计划，不自动发送、批准、付款、承诺或写回正式系统。",
  };
}

function buildPreparedArtifact(
  classification: AskHelmQueryIntentClassification,
): AskHelmPreparedArtifact | undefined {
  if (classification.intentType === "prepare_draft") {
    return {
      type: "draft_message",
      status: "draft_only",
      title: "可编辑跟进草稿",
      bodyPreview:
        "基于当前工作区对象、记忆和页面职责整理跟进要点；发送前必须补齐事实、收件人和人工确认。",
      targetSurface: "/approvals",
      reviewRequired: true,
    };
  }

  if (
    classification.intentType === "prepare_review_packet" ||
    classification.intentType === "review_required_execution"
  ) {
    return {
      type: "review_packet",
      status: "review_required",
      title: "复核材料包",
      bodyPreview:
        "整理已知事实、风险、建议下一步、依赖项和不得自动执行的动作，供审批或经营总盘页面继续复核。",
      targetSurface: "/approvals",
      reviewRequired: true,
    };
  }

  if (classification.intentType === "queue_internal_followup") {
    return {
      type: "internal_note",
      status: "draft_only",
      title: "内部跟进队列草稿",
      bodyPreview:
        "记录跟进原因、对象、建议负责人和下一步入口；当前不直接写入队列，需进入经营总盘确认。",
      targetSurface: "/operating",
      reviewRequired: false,
    };
  }

  return undefined;
}

function buildActionHandoff(
  classification: AskHelmQueryIntentClassification,
): AskHelmActionHandoff | undefined {
  if (classification.intentType === "queue_internal_followup") {
    return {
      mode: "queue_internal",
      target: "/operating",
      label: "打开经营总盘确认队列草稿",
      auditLabel: "internal_followup_queue_draft_only",
      writeEnabled: false,
    };
  }

  if (
    classification.intentType === "request_handoff" ||
    classification.intentType === "request_execution"
  ) {
    return {
      mode: "request_review",
      target: "/operating",
      label: "打开经营总盘确认交接",
      auditLabel: `${classification.intentType}_review_required`,
      writeEnabled: false,
    };
  }

  if (
    classification.intentType === "prepare_review_packet" ||
    classification.intentType === "review_required_execution" ||
    classification.intentType === "prepare_draft"
  ) {
    return {
      mode: "request_review",
      target: "/approvals",
      label: "打开复核页面",
      auditLabel: `${classification.intentType}_review_required`,
      writeEnabled: false,
    };
  }

  if (classification.intentType === "plan_breakdown") {
    return {
      mode: "open_page",
      target: "/operating",
      label: "打开经营总盘承接计划",
      auditLabel: "plan_breakdown_open_page_only",
      writeEnabled: false,
    };
  }

  return undefined;
}

function truncateActionPacketText(value: string, limit = 140) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > limit
    ? `${normalized.slice(0, Math.max(0, limit - 1))}…`
    : normalized;
}

function actionPacketObjectEvidence(input: AskHelmInterpreterInput) {
  const refs: AskHelmActionPacketEvidenceRef[] = [];

  if (input.currentObject) {
    refs.push({
      id: `object:${input.currentObject.type}:${input.currentObject.id}`,
      label: input.currentObject.displayName ?? input.currentObject.id,
      sourceType: "object",
      strength: "strong",
      note: input.currentObject.status
        ? `当前对象状态：${input.currentObject.status}`
        : "来自当前页面对象上下文。",
      target: objectDeepLink(input.currentObject.type, input.currentObject.id),
    });
  }

  for (const object of input.relatedObjects?.slice(0, 3) ?? []) {
    refs.push({
      id: `object:${object.objectType}:${object.objectId}`,
      label: object.displayName,
      sourceType: "object",
      strength: "strong",
      note: `工作区对象状态：${object.status}`,
      target: object.deepLink,
    });
  }

  return refs;
}

function buildActionPacketEvidenceRefs(input: {
  classification: AskHelmQueryIntentClassification;
  interpreterInput: AskHelmInterpreterInput;
  boundaryNote: AskHelmResponse["boundaryNote"];
  topSignal?: AskHelmBusinessSignalDraft;
}): AskHelmActionPacketEvidenceRef[] {
  const { classification, interpreterInput, boundaryNote, topSignal } = input;
  const refs: AskHelmActionPacketEvidenceRef[] = [
    {
      id: "query:current",
      label: "用户问题",
      sourceType: "query_reference",
      strength: "weak",
      note: truncateActionPacketText(interpreterInput.rawQuery, 120),
    },
    ...actionPacketObjectEvidence(interpreterInput),
  ];

  const signals = [
    ...(topSignal ? [topSignal] : []),
    ...(interpreterInput.businessSignals ?? []),
  ];
  const seenSignals = new Set<string>();
  for (const signal of signals) {
    if (seenSignals.has(signal.id)) continue;
    seenSignals.add(signal.id);
    if (seenSignals.size > 3) break;

    refs.push({
      id: `business_signal:${signal.id}`,
      label: signal.title,
      sourceType: "business_signal",
      strength:
        signal.score >= 90 ? "strong" : signal.score >= 60 ? "medium" : "weak",
      note: truncateActionPacketText(signal.reason, 140),
      target: signal.primaryNextStep.target,
    });
  }

  for (const [index, summary] of (interpreterInput.memorySummary ?? [])
    .slice(0, 3)
    .entries()) {
    refs.push({
      id: `memory:${index + 1}`,
      label: `经营记忆 ${index + 1}`,
      sourceType: "memory",
      strength: "medium",
      note: truncateActionPacketText(summary, 140),
    });
  }

  for (const [index, line] of workspaceContextLines(interpreterInput)
    .slice(0, 5)
    .entries()) {
    refs.push({
      id: `workspace_context:${index + 1}`,
      label: line,
      sourceType: "workspace_context",
      strength: "medium",
      note: "来自当前工作区会话和启用能力。",
    });
  }

  if (classification.needsSystemKnowledge) {
    refs.push({
      id: `helm_semantics:${classification.matchedRule}`,
      label: "Helm 页面职责和边界",
      sourceType: "helm_semantics",
      strength: "medium",
      note: "来自 Ask Helm knowledge pack 的页面职责、路由和复核边界。",
    });
  }

  if (boundaryNote) {
    refs.push({
      id: `boundary:${boundaryNote.type}`,
      label: "执行边界",
      sourceType: "boundary",
      strength: "strong",
      note: boundaryNote.message,
    });
  }

  const uniqueRefs = new Map<string, AskHelmActionPacketEvidenceRef>();
  for (const ref of refs) {
    if (!uniqueRefs.has(ref.id)) uniqueRefs.set(ref.id, ref);
  }
  return Array.from(uniqueRefs.values());
}

function actionPacketEvidenceIds(
  refs: readonly AskHelmActionPacketEvidenceRef[],
  sourceTypes: AskHelmActionPacketEvidenceSource[],
) {
  const acceptedTypes = new Set(sourceTypes);
  return refs
    .filter((ref) => acceptedTypes.has(ref.sourceType))
    .map((ref) => ref.id);
}

function buildActionPacketMissingInfo(
  classification: AskHelmQueryIntentClassification,
  input: AskHelmInterpreterInput,
): AskHelmActionPacketMissingInfo[] {
  const missingInfo: AskHelmActionPacketMissingInfo[] = [];
  const hasGroundedObject =
    Boolean(input.currentObject) || Boolean(input.relatedObjects?.length);
  const highRiskAction =
    classification.intentType === "prepare_draft" ||
    classification.intentType === "prepare_review_packet" ||
    classification.intentType === "request_execution" ||
    classification.intentType === "review_required_execution";

  if (!hasGroundedObject) {
    missingInfo.push({
      id: "missing_grounded_object",
      label: "缺少已落对象",
      reason:
        "当前行动包只能引用用户问题和工作区上下文，尚未绑定联系人、公司、机会或会议。",
      blocksExecution: highRiskAction,
    });
  }

  if (classification.needsMemory && !(input.memorySummary ?? []).length) {
    missingInfo.push({
      id: "missing_reviewed_memory",
      label: "缺少已复核记忆",
      reason:
        "这个意图需要经营记忆辅助判断，但当前没有可用的 reviewed-active 摘要。",
      blocksExecution: false,
    });
  }

  if (
    input.inputMode === "voice" &&
    (input.transcriptConfirmed !== true ||
      (input.voiceTranscriptConfidence ?? "medium") !== "high")
  ) {
    missingInfo.push({
      id: "transcript_confirmation_required",
      label: "语音转写未确认",
      reason: "语音输入必须先由用户核对转写文本，才能进入复核或行动承接。",
      blocksExecution: true,
    });
  }

  return missingInfo;
}

function buildActionPacketRisks(input: {
  classification: AskHelmQueryIntentClassification;
  evidenceRefs: AskHelmActionPacketEvidenceRef[];
  missingInfo: AskHelmActionPacketMissingInfo[];
  topSignal?: AskHelmBusinessSignalDraft;
}): AskHelmActionPacketRisk[] {
  const { classification, evidenceRefs, missingInfo, topSignal } = input;
  const boundaryEvidence = actionPacketEvidenceIds(evidenceRefs, ["boundary"]);
  const objectEvidence = actionPacketEvidenceIds(evidenceRefs, ["object"]);
  const signalEvidence = actionPacketEvidenceIds(evidenceRefs, [
    "business_signal",
  ]);
  const risks: AskHelmActionPacketRisk[] = [];

  if (classification.intentType === "review_required_execution") {
    risks.push({
      id: "high_risk_execution_denied",
      label: "高风险执行被降级为复核",
      severity: "high",
      evidenceRefIds: [...objectEvidence, ...signalEvidence, ...boundaryEvidence],
      reviewRequired: true,
      note: "发送、审批、承诺、付款或正式写回必须在对应页面由人确认。",
    });
  } else if (classification.intentType === "request_execution") {
    risks.push({
      id: "execution_request_requires_review",
      label: "执行请求需要人工复核",
      severity: "high",
      evidenceRefIds: [...objectEvidence, ...boundaryEvidence],
      reviewRequired: true,
      note: "Ask Helm 只能整理执行意图，不启动正式执行链路。",
    });
  }

  if (classification.intentType === "prepare_draft") {
    risks.push({
      id: "draft_can_be_misread_as_sendable",
      label: "草稿可能被误当成可直接外发",
      severity: "medium",
      evidenceRefIds: boundaryEvidence,
      reviewRequired: true,
      note: "草稿必须先复核收件人、事实、承诺边界和发送权限。",
    });
  }

  if (classification.intentType === "prepare_review_packet") {
    risks.push({
      id: "review_packet_not_approval",
      label: "复核材料包不是批准结论",
      severity: "medium",
      evidenceRefIds: boundaryEvidence,
      reviewRequired: true,
      note: "材料包只整理依据、风险和待确认点，不代表审批通过。",
    });
  }

  if (
    classification.intentType === "plan_breakdown" ||
    classification.intentType === "queue_internal_followup" ||
    classification.intentType === "request_handoff"
  ) {
    risks.push({
      id: "suggestion_can_be_misread_as_commitment",
      label: "行动建议可能被误读为正式承诺",
      severity: "low",
      evidenceRefIds: boundaryEvidence,
      reviewRequired: false,
      note: "计划、队列草稿和交接只代表内部准备，不自动承诺结果。",
    });
  }

  if (topSignal && topSignal.reviewPosture !== "read_only") {
    risks.push({
      id: "business_signal_requires_review",
      label: "经营信号仍需人工复核",
      severity: topSignal.reviewPosture === "review_required" ? "high" : "medium",
      evidenceRefIds: signalEvidence,
      reviewRequired: true,
      note: topSignal.boundaryNote,
    });
  }

  if (missingInfo.some((item) => item.id === "missing_grounded_object")) {
    risks.push({
      id: "missing_grounded_object_limits_action",
      label: "对象证据不足",
      severity: "medium",
      evidenceRefIds: actionPacketEvidenceIds(evidenceRefs, [
        "query_reference",
        "workspace_context",
      ]),
      reviewRequired: true,
      note: "没有已落对象时，只能继续搜索或补证，不能把行动包当作正式依据。",
    });
  }

  if (
    missingInfo.some((item) => item.id === "transcript_confirmation_required")
  ) {
    risks.push({
      id: "transcript_not_confirmed",
      label: "语音转写未确认",
      severity: "high",
      evidenceRefIds: actionPacketEvidenceIds(evidenceRefs, [
        "query_reference",
        "boundary",
      ]),
      reviewRequired: true,
      note: "未确认转写不能触发复核通过、发送、承诺或写回。",
    });
  }

  return risks;
}

function buildActionPacketReviewChecklist(input: {
  classification: AskHelmQueryIntentClassification;
  missingInfo: AskHelmActionPacketMissingInfo[];
}) {
  const { classification, missingInfo } = input;
  const checklist = [
    "确认所有对象、经营信号和记忆都来自当前工作区。",
    "核对建议是否仍符合 recommendation 不等于 commitment 的边界。",
    "确认负责人、复核人和截止时间后，再进入对应页面承接。",
    "确认本入口没有发送、审批、付款、承诺或正式写回权限。",
  ];

  if (missingInfo.some((item) => item.id === "missing_grounded_object")) {
    checklist.unshift("先补齐联系人、公司、机会或会议对象引用。");
  }

  if (missingInfo.some((item) => item.id === "missing_reviewed_memory")) {
    checklist.push("补齐 reviewed-active 经营记忆后再升级为正式复核依据。");
  }

  if (
    missingInfo.some((item) => item.id === "transcript_confirmation_required")
  ) {
    checklist.unshift("先人工核对语音转写文本。");
  }

  if (
    classification.intentType === "review_required_execution" ||
    classification.intentType === "request_execution"
  ) {
    checklist.push("进入审批或经营总盘后，由人确认是否继续执行。");
  }

  return checklist;
}

function buildActionPacketStatus(input: {
  classification: AskHelmQueryIntentClassification;
  missingInfo: AskHelmActionPacketMissingInfo[];
}) {
  const { classification, missingInfo } = input;
  const blockingMissingInfo = missingInfo.some((item) => item.blocksExecution);

  if (
    blockingMissingInfo &&
    (classification.intentType === "review_required_execution" ||
      classification.intentType === "request_execution" ||
      missingInfo.some((item) => item.id === "transcript_confirmation_required"))
  ) {
    return "blocked" as const;
  }

  if (
    blockingMissingInfo ||
    classification.intentType === "prepare_draft" ||
    classification.intentType === "prepare_review_packet" ||
    classification.intentType === "request_execution" ||
    classification.intentType === "review_required_execution"
  ) {
    return "review_required" as const;
  }

  return "draft" as const;
}

function buildActionPacketSummary(
  classification: AskHelmQueryIntentClassification,
  input: AskHelmInterpreterInput,
) {
  const objectLabel =
    input.currentObject?.displayName ??
    input.relatedObjects?.[0]?.displayName ??
    buildQueryReferenceLabel(input.rawQuery);

  if (classification.intentType === "prepare_draft") {
    return `把「${objectLabel}」整理为待复核草稿，并列明不能直接外发的证据边界。`;
  }
  if (classification.intentType === "prepare_review_packet") {
    return `把「${objectLabel}」整理为复核材料包，供人工判断是否继续推进。`;
  }
  if (classification.intentType === "review_required_execution") {
    return `把高风险执行请求降级为「${objectLabel}」的证据化复核包。`;
  }
  if (classification.intentType === "request_execution") {
    return `把执行意图收口为「${objectLabel}」的可复核下一步。`;
  }
  if (classification.intentType === "queue_internal_followup") {
    return `把「${objectLabel}」收口为内部跟进候选，不直接写入队列。`;
  }
  if (classification.intentType === "request_handoff") {
    return `把「${objectLabel}」整理为可交接事项，保留边界和复核条件。`;
  }
  return `把「${objectLabel}」拆成证据化行动计划。`;
}

function buildActionPacket(input: {
  classification: AskHelmQueryIntentClassification;
  interpreterInput: AskHelmInterpreterInput;
  nextStep: AskHelmResponse["nextStep"];
  boundaryNote: AskHelmResponse["boundaryNote"];
  topSignal?: AskHelmBusinessSignalDraft;
}): AskHelmActionPacket | undefined {
  const {
    classification,
    interpreterInput,
    nextStep,
    boundaryNote,
    topSignal,
  } = input;

  if (!ACTION_PACKET_INTENTS.has(classification.intentType)) {
    return undefined;
  }

  const evidenceRefs = buildActionPacketEvidenceRefs({
    classification,
    interpreterInput,
    boundaryNote,
    topSignal,
  });
  const missingInfo = buildActionPacketMissingInfo(
    classification,
    interpreterInput,
  );
  const risks = buildActionPacketRisks({
    classification,
    evidenceRefs,
    missingInfo,
    topSignal,
  });

  return {
    status: buildActionPacketStatus({ classification, missingInfo }),
    intentType: classification.intentType,
    summary: buildActionPacketSummary(classification, interpreterInput),
    nextSurface: nextStep.primary,
    evidenceRefs,
    risks,
    missingInfo,
    reviewChecklist: buildActionPacketReviewChecklist({
      classification,
      missingInfo,
    }),
    authority: {
      readOnly: true,
      writeEnabled: false,
      autoExecuteEnabled: false,
      formalCommitmentAllowed: false,
      groundingMode: "evidence_refs_only",
    },
    auditNote:
      "Ask Helm action packet is deterministic and evidence-referenced; it does not enqueue work, call external systems, or write official state.",
  };
}

function buildVoiceMetadata(
  input: AskHelmInterpreterInput,
  answer: AskHelmResponse["answer"],
  boundaryNote: AskHelmResponse["boundaryNote"],
): AskHelmVoiceMetadata | undefined {
  if (input.inputMode !== "voice") return undefined;

  const transcriptConfidence = input.voiceTranscriptConfidence ?? "medium";
  const transcriptConfirmed = input.transcriptConfirmed === true;

  return {
    inputMode: "voice",
    transcriptConfirmed,
    transcriptConfidence,
    requiresTranscriptConfirmation:
      !transcriptConfirmed || transcriptConfidence !== "high",
    rawAudioRetained: false,
    voiceOnlyApprovalAllowed: false,
    speakableSummary: answer.summary,
    speakableBoundary:
      boundaryNote?.message ??
      "问 Helm 只能基于确认后的转写文本回答、准备和导航。",
  };
}

export function interpretAskHelmQuery(input: AskHelmInterpreterInput): AskHelmResponse {
  const classification = classifyAskHelmQueryIntent(input.rawQuery);
  const knowledgePack =
    input.knowledgePack ?? loadAskHelmKnowledgePack(input.workspaceContext);
  const retrievalPlan = buildRetrievalPlan(classification);
  const relatedObjects =
    classification.intentType === "out_of_scope" ||
    classification.intentType === "unsupported_open_domain" ||
    classification.intentType === "unsupported_chitchat" ||
    classification.intentType === "cross_workspace_denied"
      ? undefined
      : buildRelatedObjects(input);
  const topSignal = pickBusinessAwareSignal(classification, input.businessSignals);
  const answer = buildAnswer(classification, input, knowledgePack, topSignal);
  const boundaryNote = buildBoundaryNote(classification);
  const nextStep = buildNextStep(classification, input, knowledgePack, topSignal);
  const voice = buildVoiceMetadata(input, answer, boundaryNote);

  return {
    classification,
    retrievalPlan,
    answer,
    relatedObjects,
    nextStep,
    actionPacket: buildActionPacket({
      classification,
      interpreterInput: input,
      nextStep,
      boundaryNote,
      topSignal,
    }),
    plan: buildActionPlan(classification, input),
    preparedArtifact: buildPreparedArtifact(classification),
    actionHandoff: buildActionHandoff(classification),
    voice,
    boundaryNote,
    grounding: {
      currentPage: input.currentPage,
      currentObject: input.currentObject
        ? { type: input.currentObject.type, id: input.currentObject.id }
        : undefined,
      workspaceContext: workspaceContextLines(input),
      memoryUsed: retrievalPlan.sources.includes("memory_summary"),
      systemKnowledgeUsed: retrievalPlan.sources.includes("knowledge_pack"),
    },
  };
}
