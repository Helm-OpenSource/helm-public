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
  english?: boolean;
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

function buildBusinessAwareLayerExplanation(
  signal: AskHelmBusinessSignalDraft,
  english: boolean,
) {
  const reason =
    signal.reason?.trim() ||
    (english
      ? "The current workspace has an operating signal that needs handling."
      : "当前工作区出现需要承接的经营信号。");
  return english
    ? `Evidence: ${reason} Boundary: ${signal.boundaryNote}`
    : `依据：${reason} 边界：${signal.boundaryNote}`;
}

function buildBusinessAwareNextStep(
  signal: AskHelmBusinessSignalDraft,
  english: boolean,
): AskHelmResponse["nextStep"] {
  return {
    primary: signal.primaryNextStep,
    alternatives: [
      {
        type: "page_target",
        target: "/operating",
        label: english ? "Return to operating queue" : "回到经营总盘队列",
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
  const english = input.english === true;
  if (input.currentObject) {
    return {
      label:
        input.currentObject.displayName ??
        (english ? "Current object" : "当前对象"),
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
  const english = input.english === true;
  if (topSignal) {
    return buildBusinessAwareNextStep(topSignal, english);
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
        label: english
          ? `Open ${relatedObject.displayName}`
          : `打开 ${relatedObject.displayName}`,
      },
      alternatives: [
        {
          type: "page_target",
          target: "/memory",
          label: english ? "View related operating memory" : "查看相关经营记忆",
        },
      ],
    };
  }

  if (classification.intentType === "object_search") {
    return {
      primary: {
        type: "deep_link",
        target: searchTarget(input.rawQuery),
        label: english ? "View matching objects" : "查看匹配对象",
      },
    };
  }

  if (classification.intentType === "how_to_use") {
    const target = resolveHelpPage(input.rawQuery, knowledgePack);
    return {
      primary: {
        type: "page_target",
        target,
        label: english ? "Open the relevant page" : "进入对应页面",
      },
    };
  }

  if (classification.intentType === "definition_diff") {
    return {
      primary: {
        type: "page_target",
        target: "/settings",
        label: english ? "View definitions and boundaries" : "查看定义与边界",
      },
    };
  }

  if (classification.intentType === "submit_business_signal") {
    return {
      primary: {
        type: "page_target",
        target: "#ask-helm-signal-intake",
        label: english
          ? "Fill signal details (review candidate only)"
          : "填写上报内容（仅生成复核候选）",
      },
      alternatives: [
        {
          type: "page_target",
          target: "/operating",
          label: english ? "Return to operating workspace" : "回到经营总盘",
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
            ? english
              ? "Open review page to confirm draft"
              : "打开复核页面确认草稿"
            : english
              ? "Open review page"
              : "打开复核页面",
      },
      alternatives: [
        {
          type: "page_target",
          target: "/operating",
          label: english ? "Return to operating queue" : "回到经营总盘队列",
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
        label: english ? "Open operating workspace" : "打开经营总盘工作面",
      },
      alternatives: [
        {
          type: "page_target",
          target: "/approvals",
          label: english
            ? "Open approvals when review is needed"
            : "需要复核时进入审批",
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
          ? english
            ? "Return to workspace search"
            : "回到工作区搜索"
          : english
            ? "Open next page"
            : "进入下一步页面",
    },
  };
}

function buildBoundaryNote(
  classification: AskHelmQueryIntentClassification,
  english: boolean,
): AskHelmResponse["boundaryNote"] {
  if (classification.intentType === "cross_workspace_denied") {
    return {
      type: "cross_workspace_denied",
      message: english
        ? "Ask Helm can only use the current workspace context; it cannot compare, summarize, or retrieve objects across workspaces or tenants."
        : "问 Helm 只能使用当前工作区的上下文，不能跨工作区或跨租户比较、汇总或调取对象。",
    };
  }
  if (classification.intentType === "unsupported_open_domain") {
    return {
      type: "out_of_scope",
      message: english
        ? "Ask Helm does not handle open-domain news, stock prices, financial reports, or external web search; keep the request inside current workspace objects, memory, or page responsibilities."
        : "问 Helm 不做开放域新闻、股价、财报或外部网页检索；请把问题收回当前工作区的对象、记忆或页面职责。",
    };
  }
  if (classification.intentType === "unsupported_chitchat") {
    return {
      type: "out_of_scope",
      message: english
        ? "Ask Helm is not a chat assistant and does not handle jokes, poems, weather, or games; it only handles current-workspace operating questions, review, and navigation."
        : "问 Helm 不是闲聊助手，也不替你讲笑话、写诗、查天气或玩游戏；只处理当前工作区的经营问题、复核与导航。",
    };
  }
  if (classification.intentType === "submit_business_signal") {
    return {
      type: "review_required",
      message: english
        ? "Business signal submission only creates a draft record that requires review first; it does not notify customers, approve anything, or write official customer-relationship-system state."
        : "经营信号上报只会落成一条需先复核的草稿记录，不会自动通知客户、对接审批，也不写回客户关系系统正式状态。",
    };
  }
  if (classification.intentType === "review_required_execution") {
    return {
      type: "review_required",
      message: english
        ? "This request includes sending, approval, commitment, payment, or official writeback intent; Ask Helm can only prepare a review packet and route you to review, not execute it directly."
        : "这个请求包含发送、审批、承诺、付款或正式写回意图；问 Helm 只能准备复核材料并带你进入复核页面，不能直接执行。",
    };
  }
  if (classification.intentType === "request_execution") {
    return {
      type: "review_required",
      message: english
        ? "Ask Helm can turn an execution request into a reviewable next step, but it will not start high-risk actions or write official systems for you."
        : "问 Helm 可以把执行请求整理成可复核的下一步，但不会替你启动高风险动作或写回正式系统。",
    };
  }
  if (classification.intentType === "prepare_draft") {
    return {
      type: "draft_only",
      message: english
        ? "Generated content is draft-only and must be reviewed on the corresponding page before sending, commitment, or writeback."
        : "生成内容只作为草稿，必须在对应页面复核后才能发送、承诺或写回。",
    };
  }
  if (classification.intentType === "prepare_review_packet") {
    return {
      type: "review_required",
      message: english
        ? "A review packet only organizes evidence, risks, and next steps; it is not approval, a contract, a quote, or a formal commitment."
        : "复核材料只整理依据、风险和下一步，不等于批准、合同、报价或正式承诺。",
    };
  }
  if (
    classification.intentType === "plan_breakdown" ||
    classification.intentType === "queue_internal_followup" ||
    classification.intentType === "request_handoff"
  ) {
    return {
      type: "suggestion_not_commitment",
      message: english
        ? "Action breakdowns and handoffs are only next-step suggestions or internal preparation; they do not commit outcomes or directly change high-risk state."
        : "行动拆解和交接只是下一步建议或内部准备，不自动承诺结果，也不直接修改高风险状态。",
    };
  }
  if (classification.intentType === "out_of_scope") {
    return {
      type: "out_of_scope",
      message: english
        ? "Ask Helm only handles attributable questions inside the current workspace; it cannot cross tenants, search open domains, or execute high-risk actions for you."
        : "问 Helm 只处理当前工作区内可归因的问题，不能跨租户、开放域检索或代替你执行高风险动作。",
    };
  }
  if (classification.intentType === "why_blocked") {
    return {
      type: "review_required",
      message: english
        ? "This kind of question can only explain blockers and review reasons; it cannot approve, send, commit, or write official systems directly."
        : "这类问题只能解释阻塞和复核原因，不能直接批准、发送、承诺或写回正式系统。",
    };
  }
  if (classification.intentType === "why_recommendation") {
    return {
      type: "suggestion_not_commitment",
      message: english
        ? "A recommendation explanation is not a formal commitment to a customer or team; the next step still needs review on the corresponding page."
        : "推荐解释不是对客户或团队的正式承诺，下一步仍需要在对应页面复核。",
    };
  }
  return {
    type: "read_only",
    message: english
      ? "Ask Helm currently only reads, explains, prepares, and navigates; it does not perform official writes."
      : "问 Helm 当前只做读取、解释、准备和导航，不执行正式写操作。",
  };
}

function buildAnswer(
  classification: AskHelmQueryIntentClassification,
  input: AskHelmInterpreterInput,
  knowledgePack: AskHelmKnowledgePack,
  topSignal: AskHelmBusinessSignalDraft | undefined,
): AskHelmResponse["answer"] {
  const english = input.english === true;
  if (classification.intentType === "cross_workspace_denied") {
    return {
      summary: english
        ? "This request is outside the current workspace boundary."
        : "这个请求被限制在当前工作区边界之外。",
      explanation: english
        ? "I cannot retrieve, compare, or merge data across workspaces or tenants. Switch to the relevant workspace, or scope the question to current-workspace objects and memory."
        : "我不能跨工作区或跨租户调取、比较或合并数据。请先切到对应工作区，或把问题限定为当前工作区的对象和记忆。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "unsupported_open_domain") {
    return {
      summary: english
        ? "This question requires open-domain information, which Ask Helm does not handle here."
        : "这个问题需要开放域信息，问 Helm 当前不处理。",
      explanation: english
        ? "Ask Helm only uses current-workspace objects, memory, and system knowledge packs; news, stock prices, financial reports, and external web search do not enter this entry point."
        : "问 Helm 只使用当前工作区的对象、记忆和系统知识包；新闻、股价、财报和外部网页检索不进入这个入口。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "unsupported_chitchat") {
    return {
      summary: english
        ? "Ask Helm does not handle chitchat or open-ended conversation."
        : "问 Helm 不替你做闲聊或开放对话。",
      explanation: english
        ? "Jokes, mood chat, poems, games, and weather are outside workspace responsibilities. Ask about objects, review, blockers, follow-up, or submit an operating signal instead."
        : "讲笑话、聊心情、写诗、玩游戏、查天气这类请求不在工作区职责范围内。请改问对象、复核、阻塞、跟进，或上报一条经营信号。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "submit_business_signal") {
    return {
      summary: english
        ? "I will turn it into a business signal draft that requires review."
        : "我会把它整理成一条待复核的经营信号草稿。",
      explanation: english
        ? "Submission only creates an audited candidate record; it does not write to the customer relationship system, send external messages, or create official tasks. The owner must confirm it in the review entry point before continuing."
        : "上报只会写入一条审计候选记录，不自动写回客户关系系统、不发送外部消息、不创建正式任务；负责人需要在复核入口确认后再继续。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "review_required_execution") {
    if (topSignal) {
      return {
        summary: english
          ? `Review first: ${topSignal.title}. Ask Helm will not execute it directly.`
          : `先复核：${topSignal.title}。这条不会由 问 Helm 直接执行。`,
        explanation: english
          ? `${buildBusinessAwareLayerExplanation(topSignal, english)} Sending, approval, payment, commitment, and official writeback must all be confirmed by a user on the corresponding page.`
          : `${buildBusinessAwareLayerExplanation(topSignal, english)} 发送、批准、付款、承诺和正式写回都必须由用户在对应页面确认。`,
        confidence: classification.confidence,
      };
    }
    return {
      summary: english
        ? "This request requires review and cannot be executed directly by Ask Helm."
        : "这个请求需要复核，不能由 问 Helm 直接执行。",
      explanation: english
        ? "I can organize the context into a review packet and route the next step to approvals or the operating workspace; sending, approval, payment, commitment, and official writeback must all be confirmed by a user on the corresponding page."
        : "我可以把上下文整理成复核材料，并把下一步收口到审批或经营总盘；发送、批准、付款、承诺和正式写回都必须由用户在对应页面确认。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "plan_breakdown") {
    if (topSignal) {
      return {
        summary: english
          ? `First break "${topSignal.title}" into a reviewable action plan.`
          : `先围绕「${topSignal.title}」拆出可复核的行动计划。`,
        explanation: english
          ? `${buildBusinessAwareLayerExplanation(topSignal, english)} The plan is only a next-step suggestion; users confirm ownership after entering the operating workspace.`
          : `${buildBusinessAwareLayerExplanation(topSignal, english)} 计划只作为下一步建议，进入经营总盘后由用户确认承接。`,
        confidence: classification.confidence,
      };
    }
    return {
      summary: english
        ? "I will break this request into a reviewable action plan."
        : "我会把这个需求拆成可复核的行动计划。",
      explanation: english
        ? "The plan first locates objects and facts, then checks memory, blockers, and page responsibilities before continuing in the operating workspace."
        : "计划会先定位对象和事实，再核对记忆、阻塞和页面职责，最后进入经营总盘继续推进。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "prepare_draft") {
    return {
      summary: english
        ? "I will turn this request into a draft, not send it directly."
        : "我会把这个需求整理成草稿，而不是直接发送。",
      explanation: english
        ? "The draft is only an editable preparation artifact; official sending, commitment, or writeback must be reviewed on the corresponding page."
        : "草稿只作为可编辑准备件；正式外发、承诺或写回必须在对应页面复核。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "prepare_review_packet") {
    return {
      summary: english ? "I will prepare a review packet." : "我会准备一份复核材料包。",
      explanation: english
        ? "The packet lists known facts, risks, suggested next steps, and points that need human confirmation; it does not replace an approval decision."
        : "材料包会列出已知事实、风险、建议下一步和需要人工确认的点，不替代审批决定。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "queue_internal_followup") {
    return {
      summary: english
        ? "I will shape it into an internal follow-up queue draft."
        : "我会把它收口成内部跟进队列草稿。",
      explanation: english
        ? "The current implementation only generates an auditable handoff target and does not write directly to the queue; users confirm it after entering the operating workspace."
        : "当前实现只生成可审计的交接目标，不直接写入队列；进入经营总盘后由用户确认。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "request_handoff") {
    return {
      summary: english
        ? "I will organize this request into a reviewable handoff."
        : "我会把这个请求整理成可交接的交接。",
      explanation: english
        ? "The handoff only describes the object, reason, suggested next step, and review boundary; final ownership and execution are still confirmed in the corresponding workspace surface."
        : "交接只说明对象、原因、建议下一步和复核边界；最终归属和执行仍在对应工作面确认。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "request_execution") {
    return {
      summary: english
        ? "I will turn the execution request into a reviewable next step."
        : "我会把执行请求转成可复核的下一步。",
      explanation: english
        ? "Ask Helm does not start execution directly; it routes the execution intent to the operating workspace or approvals page for human confirmation."
        : "问 Helm 不直接启动执行动作；它只把执行意图收口到经营总盘或审批页面，由人确认后继续。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "out_of_scope") {
    return {
      summary: english
        ? "This question is outside Ask Helm's current boundary."
        : "这个问题超出 问 Helm 的当前边界。",
      explanation: english
        ? "It may involve cross-workspace data, open-domain information, or high-risk execution. Return to current-workspace objects, operating memory, approvals, or the operating workspace."
        : "它可能涉及跨工作区、开放域信息或高风险执行。请回到当前工作区对象、经营记忆、审批或经营总盘页面处理。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "object_search") {
    return {
      summary: english
        ? "I will handle this first as a workspace object search."
        : "我会先把这个问题当作工作区对象搜索处理。",
      explanation: english
        ? "Object results are shown first; if explanation or next steps are needed, open the object detail or related work surface."
        : "对象结果优先展示；如果需要解释或下一步，再进入对象详情或相关工作页面。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "how_to_use") {
    const target = resolveHelpPage(input.rawQuery, knowledgePack);
    const page = knowledgePack.pageResponsibilities[target];
    return {
      summary: english
        ? `Start with the page responsibilities for ${target}.`
        : `这个问题应从 ${target} 的页面职责开始看。`,
      explanation: page
        ? english
          ? "Use the mapped Helm page responsibility and boundary note. It does not replace approval, sending, or official writeback."
          : `${page.primaryPurpose} 它不替代审批、发送或正式写回。`
        : english
          ? "Ask Helm will route you back to the authoritative page in the current workspace."
          : "问 Helm 会优先把你带回当前工作区的权威页面。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "definition_diff") {
    return {
      summary: english
        ? "This question is about Helm internal responsibilities and boundaries."
        : "这个问题属于 Helm 内部职责和边界解释。",
      explanation: english
        ? "I will answer using the knowledge pack page responsibilities and boundary notes, then route the next step to settings or the corresponding main page."
        : "我会使用 knowledge 资料 的页面职责和边界说明来回答，并把下一步收口到设置或对应主页面。",
      confidence: classification.confidence,
    };
  }

  if (classification.intentType === "today_priority") {
    if (topSignal) {
      return {
        summary: english
          ? `Top priority in the current workspace: ${topSignal.title}.`
          : `当前工作区最优先该看：${topSignal.title}。`,
        explanation: english
          ? `${buildBusinessAwareLayerExplanation(topSignal, english)} Ranking is only a next-step judgment aid; it does not commit, approve, or send for you.`
          : `${buildBusinessAwareLayerExplanation(topSignal, english)} 排序仅作为下一步判断依据，不替你承诺、审批或发送。`,
        confidence: classification.confidence,
      };
    }
    return {
      summary: english
        ? "This question should read workspace context and operating memory before entering the operating queue."
        : "这个问题应读取工作区上下文和经营记忆后进入经营总盘队列。",
      explanation: english
        ? "Ranking and suggestions are only next-step judgment aids; they do not automatically commit, approve, or send for you."
        : "排序和建议只能作为下一步判断依据，不会自动替你承诺、审批或发送。",
      confidence: classification.confidence,
    };
  }

  if (topSignal && BUSINESS_AWARE_INTENTS.has(classification.intentType)) {
    return {
      summary: english
        ? `Answer around the current workspace signal "${topSignal.title}" first.`
        : `先围绕当前工作区信号「${topSignal.title}」回答。`,
      explanation: english
        ? `${buildBusinessAwareLayerExplanation(topSignal, english)} Current-workspace facts are authoritative; Helm semantics only handle routing and review posture, and the LLM is used only for explanation, organization, or navigation.`
        : `${buildBusinessAwareLayerExplanation(topSignal, english)} 当前工作区事实最权威；Helm 语义只负责路由和复核姿态；LLM 仅用于解释、整理或导航。`,
      confidence: classification.confidence,
    };
  }

  return {
    summary: english
      ? "This question can be explained and routed within the current workspace's read-only context."
      : "这个问题可以在当前工作区的只读上下文内解释并给出下一步。",
    explanation: english
      ? "The interpreter loads objects, operating memory, and system knowledge by intent, then routes you back to the corresponding object or page."
      : "解释器会按意图加载对象、经营记忆和系统知识，再把你带回对应对象或页面。",
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

  const english = input.english === true;
  const objectLabel =
    input.currentObject?.displayName ??
    input.relatedObjects?.[0]?.displayName ??
    (english ? "Current object" : "当前对象");
  const objectRef = buildPlanStepObjectRef(input);
  const reviewRequired =
    classification.intentType === "request_execution" ||
    classification.intentType === "review_required_execution";

  return {
    status: reviewRequired ? "review_required" : "draft",
    summary:
      classification.intentType === "review_required_execution"
        ? english
          ? "Downgrade the high-risk execution request into a review plan."
          : "把高风险执行请求降级为复核计划。"
        : english
          ? "Break the user request into an internal action plan that can continue under review."
          : "把用户需求拆成可继续推进的内部行动计划。",
    steps: [
      {
        id: "confirm-context",
        title: english ? "Confirm object and facts" : "确认对象和事实",
        detail: english
          ? `Use current-workspace search results first to confirm ${objectLabel}, related status, and recent context.`
          : `先用当前工作区的搜索结果确认 ${objectLabel}、相关状态和最近上下文。`,
        objectRef,
        dri: {
          label: english
            ? "Current owner checks the object facts first."
            : "当前负责人先核对对象事实。",
          role: "owner",
        },
        due: {
          label: english
            ? "Complete fact checking today."
            : "今天内完成事实核对。",
          timing: "today",
        },
        target: {
          type: "page_target",
          target: searchTarget(input.rawQuery),
          label: english
            ? "Return to search results to verify objects"
            : "回到搜索结果核对对象",
        },
        reviewRequired: false,
      },
      {
        id: "check-memory-and-risk",
        title: english
          ? "Check memory, blockers, and boundaries"
          : "核对记忆、阻塞和边界",
        detail: english
          ? "Read operating memory, approval reasons, and the system knowledge pack only to form judgment evidence, not to replace approval or commitment."
          : "读取经营记忆、审批原因和系统知识包，只形成判断依据，不替代批准或承诺。",
        objectRef,
        dri: reviewRequired
          ? {
              label: english
                ? "Reviewer checks boundaries, approval reasons, and risks."
                : "复核人检查边界、审批原因和风险。",
              role: "reviewer",
            }
          : {
              label: english
                ? "Current owner fills memory and risk judgment gaps."
                : "当前负责人补齐记忆和风险判断。",
              role: "owner",
            },
        due: reviewRequired
          ? {
              label: english
                ? "Complete boundary checks before entering review."
                : "进入复核前完成边界检查。",
              timing: "before_review",
            }
          : {
              label: english
                ? "Fill memory and risk judgment gaps today."
                : "今天内补齐记忆和风险判断。",
              timing: "today",
            },
        target: {
          type: "page_target",
          target: reviewRequired ? "/approvals" : "/memory",
          label: reviewRequired
            ? english
              ? "Open approval review"
              : "打开审批复核"
            : english
              ? "View operating memory"
              : "查看经营记忆",
        },
        reviewRequired,
      },
      {
        id: "continue-in-operating",
        title: english
          ? "Continue the next step in operating workspace"
          : "进入经营总盘承接下一步",
        detail: english
          ? "Route the next step to the operating workspace so the user confirms owner, cadence, and whether to escalate review."
          : "把下一步收口到经营总盘，由用户确认负责人、节奏和是否继续升级复核。",
        objectRef,
        dri: {
          label: english
            ? "Operating workspace owner confirms owner and escalation cadence."
            : "经营总盘负责人确认承接人与升级节奏。",
          role: "operator",
        },
        due: reviewRequired
          ? {
              label: english
                ? "Do not enter official execution before review passes."
                : "复核通过前不得进入正式执行。",
              timing: "before_execution",
            }
          : {
              label: english
                ? "Confirm operating workspace ownership this week."
                : "本周内确认经营总盘承接。",
              timing: "this_week",
            },
        target: {
          type: "page_target",
          target: "/operating",
          label: english ? "Open operating workspace" : "打开经营总盘工作面",
        },
        reviewRequired,
      },
    ],
    auditNote: english
      ? "Ask Helm only generates reviewable plans; it does not automatically send, approve, pay, commit, or write official systems."
      : "问 Helm 只生成可复核计划，不自动发送、批准、付款、承诺或写回正式系统。",
  };
}

function buildPreparedArtifact(
  classification: AskHelmQueryIntentClassification,
  english: boolean,
): AskHelmPreparedArtifact | undefined {
  if (classification.intentType === "prepare_draft") {
    return {
      type: "draft_message",
      status: "draft_only",
      title: english ? "Editable follow-up draft" : "可编辑跟进草稿",
      bodyPreview: english
        ? "Organizes follow-up points from current-workspace objects, memory, and page responsibilities; facts, recipients, and human confirmation must be completed before sending."
        : "基于当前工作区对象、记忆和页面职责整理跟进要点；发送前必须补齐事实、收件人和人工确认。",
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
      title: english ? "Review packet" : "复核材料包",
      bodyPreview: english
        ? "Organizes known facts, risks, suggested next steps, dependencies, and actions that must not execute automatically for continued review in approvals or the operating workspace."
        : "整理已知事实、风险、建议下一步、依赖项和不得自动执行的动作，供审批或经营总盘页面继续复核。",
      targetSurface: "/approvals",
      reviewRequired: true,
    };
  }

  if (classification.intentType === "queue_internal_followup") {
    return {
      type: "internal_note",
      status: "draft_only",
      title: english ? "Internal follow-up queue draft" : "内部跟进队列草稿",
      bodyPreview: english
        ? "Records follow-up reason, object, suggested owner, and next-step entry point; it does not write directly to the queue and must be confirmed in the operating workspace."
        : "记录跟进原因、对象、建议负责人和下一步入口；当前不直接写入队列，需进入经营总盘确认。",
      targetSurface: "/operating",
      reviewRequired: false,
    };
  }

  return undefined;
}

function buildActionHandoff(
  classification: AskHelmQueryIntentClassification,
  english: boolean,
): AskHelmActionHandoff | undefined {
  if (classification.intentType === "queue_internal_followup") {
    return {
      mode: "queue_internal",
      target: "/operating",
      label: english
        ? "Open operating workspace to confirm queue draft"
        : "打开经营总盘确认队列草稿",
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
      label: english
        ? "Open operating workspace to confirm handoff"
        : "打开经营总盘确认交接",
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
      label: english ? "Open review page" : "打开复核页面",
      auditLabel: `${classification.intentType}_review_required`,
      writeEnabled: false,
    };
  }

  if (classification.intentType === "plan_breakdown") {
    return {
      mode: "open_page",
      target: "/operating",
      label: english
        ? "Open operating workspace to own the plan"
        : "打开经营总盘承接计划",
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
  const english = input.english === true;
  const refs: AskHelmActionPacketEvidenceRef[] = [];

  if (input.currentObject) {
    refs.push({
      id: `object:${input.currentObject.type}:${input.currentObject.id}`,
      label: input.currentObject.displayName ?? input.currentObject.id,
      sourceType: "object",
      strength: "strong",
      note: input.currentObject.status
        ? english
          ? `Current object status: ${input.currentObject.status}`
          : `当前对象状态：${input.currentObject.status}`
        : english
          ? "Current page object context."
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
      note: english
        ? `Workspace object status: ${object.status}`
        : `工作区对象状态：${object.status}`,
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
  const english = interpreterInput.english === true;
  const refs: AskHelmActionPacketEvidenceRef[] = [
    {
      id: "query:current",
      label: english ? "User question" : "用户问题",
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
      label: english ? `Operating memory ${index + 1}` : `经营记忆 ${index + 1}`,
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
      note: english
        ? "Current workspace session and enabled capability context."
        : "来自当前工作区会话和启用能力。",
    });
  }

  if (classification.needsSystemKnowledge) {
    refs.push({
      id: `helm_semantics:${classification.matchedRule}`,
      label: english ? "Helm page responsibilities and boundaries" : "Helm 页面职责和边界",
      sourceType: "helm_semantics",
      strength: "medium",
      note: english
        ? "From the Ask Helm knowledge pack: page responsibilities, routing, and review boundaries."
        : "来自 Ask Helm knowledge pack 的页面职责、路由和复核边界。",
    });
  }

  if (boundaryNote) {
    refs.push({
      id: `boundary:${boundaryNote.type}`,
      label: english ? "Execution boundary" : "执行边界",
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
  const english = input.english === true;
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
      label: english ? "Missing grounded object" : "缺少已落对象",
      reason: english
        ? "This action packet can only reference the user question and workspace context; it is not yet bound to a contact, company, opportunity, or meeting."
        : "当前行动包只能引用用户问题和工作区上下文，尚未绑定联系人、公司、机会或会议。",
      blocksExecution: highRiskAction,
    });
  }

  if (classification.needsMemory && !(input.memorySummary ?? []).length) {
    missingInfo.push({
      id: "missing_reviewed_memory",
      label: english ? "Missing reviewed memory" : "缺少已复核记忆",
      reason: english
        ? "This intent needs operating memory for judgment, but no reviewed active summary is currently available."
        : "这个意图需要经营记忆辅助判断，但当前没有可用的已复核且活跃摘要。",
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
      label: english ? "Voice transcript not confirmed" : "语音转写未确认",
      reason: english
        ? "Voice input must be checked by the user against the transcript before entering review or action ownership."
        : "语音输入必须先由用户核对转写文本，才能进入复核或行动承接。",
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
  english: boolean;
}): AskHelmActionPacketRisk[] {
  const { classification, evidenceRefs, missingInfo, topSignal, english } = input;
  const boundaryEvidence = actionPacketEvidenceIds(evidenceRefs, ["boundary"]);
  const objectEvidence = actionPacketEvidenceIds(evidenceRefs, ["object"]);
  const signalEvidence = actionPacketEvidenceIds(evidenceRefs, [
    "business_signal",
  ]);
  const risks: AskHelmActionPacketRisk[] = [];

  if (classification.intentType === "review_required_execution") {
    risks.push({
      id: "high_risk_execution_denied",
      label: english
        ? "High-risk execution downgraded to review"
        : "高风险执行被降级为复核",
      severity: "high",
      evidenceRefIds: [...objectEvidence, ...signalEvidence, ...boundaryEvidence],
      reviewRequired: true,
      note: english
        ? "Sending, approval, commitment, payment, or official writeback must be confirmed by a human on the corresponding page."
        : "发送、审批、承诺、付款或正式写回必须在对应页面由人确认。",
    });
  } else if (classification.intentType === "request_execution") {
    risks.push({
      id: "execution_request_requires_review",
      label: english
        ? "Execution request requires human review"
        : "执行请求需要人工复核",
      severity: "high",
      evidenceRefIds: [...objectEvidence, ...boundaryEvidence],
      reviewRequired: true,
      note: english
        ? "Ask Helm can only organize execution intent; it does not start the official execution chain."
        : "Ask Helm 只能整理执行意图，不启动正式执行链路。",
    });
  }

  if (classification.intentType === "prepare_draft") {
    risks.push({
      id: "draft_can_be_misread_as_sendable",
      label: english
        ? "Draft may be misread as directly sendable"
        : "草稿可能被误当成可直接外发",
      severity: "medium",
      evidenceRefIds: boundaryEvidence,
      reviewRequired: true,
      note: english
        ? "Drafts must first review recipient, facts, commitment boundary, and sending permission."
        : "草稿必须先复核收件人、事实、承诺边界和发送权限。",
    });
  }

  if (classification.intentType === "prepare_review_packet") {
    risks.push({
      id: "review_packet_not_approval",
      label: english
        ? "Review packet is not an approval conclusion"
        : "复核材料包不是批准结论",
      severity: "medium",
      evidenceRefIds: boundaryEvidence,
      reviewRequired: true,
      note: english
        ? "The packet only organizes evidence, risks, and points to confirm; it does not mean approval passed."
        : "材料包只整理依据、风险和待确认点，不代表审批通过。",
    });
  }

  if (
    classification.intentType === "plan_breakdown" ||
    classification.intentType === "queue_internal_followup" ||
    classification.intentType === "request_handoff"
  ) {
    risks.push({
      id: "suggestion_can_be_misread_as_commitment",
      label: english
        ? "Action suggestion may be misread as a formal commitment"
        : "行动建议可能被误读为正式承诺",
      severity: "low",
      evidenceRefIds: boundaryEvidence,
      reviewRequired: false,
      note: english
        ? "Plans, queue drafts, and handoffs only represent internal preparation; they do not automatically commit outcomes."
        : "计划、队列草稿和交接只代表内部准备，不自动承诺结果。",
    });
  }

  if (topSignal && topSignal.reviewPosture !== "read_only") {
    risks.push({
      id: "business_signal_requires_review",
      label: english
        ? "Business signal still requires human review"
        : "经营信号仍需人工复核",
      severity: topSignal.reviewPosture === "review_required" ? "high" : "medium",
      evidenceRefIds: signalEvidence,
      reviewRequired: true,
      note: topSignal.boundaryNote,
    });
  }

  if (missingInfo.some((item) => item.id === "missing_grounded_object")) {
    risks.push({
      id: "missing_grounded_object_limits_action",
      label: english ? "Object evidence is insufficient" : "对象证据不足",
      severity: "medium",
      evidenceRefIds: actionPacketEvidenceIds(evidenceRefs, [
        "query_reference",
        "workspace_context",
      ]),
      reviewRequired: true,
      note: english
        ? "Without a grounded object, continue searching or adding evidence; do not treat the action packet as official basis."
        : "没有已落对象时，只能继续搜索或补证，不能把行动包当作正式依据。",
    });
  }

  if (
    missingInfo.some((item) => item.id === "transcript_confirmation_required")
  ) {
    risks.push({
      id: "transcript_not_confirmed",
      label: english ? "Voice transcript not confirmed" : "语音转写未确认",
      severity: "high",
      evidenceRefIds: actionPacketEvidenceIds(evidenceRefs, [
        "query_reference",
        "boundary",
      ]),
      reviewRequired: true,
      note: english
        ? "Unconfirmed transcripts cannot trigger review pass, sending, commitment, or writeback."
        : "未确认转写不能触发复核通过、发送、承诺或写回。",
    });
  }

  return risks;
}

function buildActionPacketReviewChecklist(input: {
  classification: AskHelmQueryIntentClassification;
  missingInfo: AskHelmActionPacketMissingInfo[];
  english: boolean;
}) {
  const { classification, missingInfo, english } = input;
  const checklist = english
    ? [
        "Confirm every object, business signal, and memory came from the current workspace.",
        "Check that the suggestion still respects the suggestion-not-commitment boundary.",
        "Confirm owner, reviewer, and deadline before owning it on the corresponding page.",
        "Confirm this entry has no permission to send, approve, pay, commit, or write official state.",
      ]
    : [
        "确认所有对象、经营信号和记忆都来自当前工作区。",
        "核对建议是否仍符合建议不等于承诺的边界。",
        "确认负责人、复核人和截止时间后，再进入对应页面承接。",
        "确认本入口没有发送、审批、付款、承诺或正式写回权限。",
      ];

  if (missingInfo.some((item) => item.id === "missing_grounded_object")) {
    checklist.unshift(
      english
        ? "First add a contact, company, opportunity, or meeting object reference."
        : "先补齐联系人、公司、机会或会议对象引用。",
    );
  }

  if (missingInfo.some((item) => item.id === "missing_reviewed_memory")) {
    checklist.push(
      english
        ? "Add reviewed active operating memory before upgrading it into formal review evidence."
        : "补齐已复核且活跃的经营记忆后再升级为正式复核依据。",
    );
  }

  if (
    missingInfo.some((item) => item.id === "transcript_confirmation_required")
  ) {
    checklist.unshift(
      english
        ? "First manually check the voice transcript text."
        : "先人工核对语音转写文本。",
    );
  }

  if (
    classification.intentType === "review_required_execution" ||
    classification.intentType === "request_execution"
  ) {
    checklist.push(
      english
        ? "After opening approvals or the operating workspace, a human confirms whether execution continues."
        : "进入审批或经营总盘后，由人确认是否继续执行。",
    );
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
  const english = input.english === true;
  const objectLabel =
    input.currentObject?.displayName ??
    input.relatedObjects?.[0]?.displayName ??
    buildQueryReferenceLabel(input.rawQuery);

  if (classification.intentType === "prepare_draft") {
    return english
      ? `Turn "${objectLabel}" into a review-required draft and list the evidence boundary that prevents direct sending.`
      : `把「${objectLabel}」整理为待复核草稿，并列明不能直接外发的证据边界。`;
  }
  if (classification.intentType === "prepare_review_packet") {
    return english
      ? `Turn "${objectLabel}" into a review packet for a human decision on whether to continue.`
      : `把「${objectLabel}」整理为复核材料包，供人工判断是否继续推进。`;
  }
  if (classification.intentType === "review_required_execution") {
    return english
      ? `Downgrade the high-risk execution request into an evidence-backed review packet for "${objectLabel}".`
      : `把高风险执行请求降级为「${objectLabel}」的证据化复核包。`;
  }
  if (classification.intentType === "request_execution") {
    return english
      ? `Turn the execution intent into a reviewable next step for "${objectLabel}".`
      : `把执行意图收口为「${objectLabel}」的可复核下一步。`;
  }
  if (classification.intentType === "queue_internal_followup") {
    return english
      ? `Shape "${objectLabel}" into an internal follow-up candidate without writing directly to the queue.`
      : `把「${objectLabel}」收口为内部跟进候选，不直接写入队列。`;
  }
  if (classification.intentType === "request_handoff") {
    return english
      ? `Organize "${objectLabel}" into a handoff item while preserving boundaries and review conditions.`
      : `把「${objectLabel}」整理为可交接事项，保留边界和复核条件。`;
  }
  return english
    ? `Break "${objectLabel}" into an evidence-backed action plan.`
    : `把「${objectLabel}」拆成证据化行动计划。`;
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

  const english = interpreterInput.english === true;
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
    english,
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
      english,
    }),
    authority: {
      readOnly: true,
      writeEnabled: false,
      autoExecuteEnabled: false,
      formalCommitmentAllowed: false,
      groundingMode: "evidence_refs_only",
    },
    auditNote: english
      ? "Ask Helm action packet is deterministic and evidence-referenced; it does not enqueue work, call external systems, or write official state."
      : "问 Helm 行动包是确定性的证据引用结果；它不会入队、调用外部系统或写入正式状态。",
  };
}

function buildVoiceMetadata(
  input: AskHelmInterpreterInput,
  answer: AskHelmResponse["answer"],
  boundaryNote: AskHelmResponse["boundaryNote"],
): AskHelmVoiceMetadata | undefined {
  if (input.inputMode !== "voice") return undefined;

  const english = input.english === true;
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
      (english
        ? "Ask Helm can only answer, prepare, and navigate from confirmed transcript text."
        : "问 Helm 只能基于确认后的转写文本回答、准备和导航。"),
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
  const english = input.english === true;
  const boundaryNote = buildBoundaryNote(classification, english);
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
    preparedArtifact: buildPreparedArtifact(classification, english),
    actionHandoff: buildActionHandoff(classification, english),
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
