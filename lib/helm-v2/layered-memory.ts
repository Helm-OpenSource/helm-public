import type {
  HelmV2ConnectorIngestionContract,
  HelmV2EventType,
  HelmV2IngestionPromotionEligibility,
  HelmV2IngestionNormalizationStatus,
  HelmV2IngestionScope,
  HelmV2IngestionTrustLevel,
  HelmV2MemoryItem,
  HelmV2MemoryKind,
  HelmV2MemoryNamespace,
  HelmV2MemorySourceRef,
  HelmV2MemoryVerification,
  HelmV2RetrievalBucket,
  HelmV2RetrievalLoadRef,
  HelmV2RetrievalPolicyMode,
  HelmV2SourceType,
  HelmV2TrustPromotionStatus,
  HelmV2TrustClass,
} from "@/lib/helm-v2/contracts";

export const HELM_V2_MEMORY_LAYERS = [
  {
    kind: "policy" as HelmV2MemoryKind,
    label: "Policy Memory",
    purpose: "组织规则、审批阈值、承诺边界和敏感数据约束。",
  },
  {
    kind: "object_fact" as HelmV2MemoryKind,
    label: "Object Memory",
    purpose: "客户、机会、会议、提案、报价、审批、任务和交接的结构化事实。",
  },
  {
    kind: "learned_pattern" as HelmV2MemoryKind,
    label: "Learned Memory",
    purpose: "被验证过的长期偏好和稳定模式，而不是原始对话。",
  },
  {
    kind: "handoff" as HelmV2MemoryKind,
    label: "Handoff / Checkpoint Memory",
    purpose: "长流程交接、恢复点、阶段总结和当前计划。",
  },
  {
    kind: "scratch" as HelmV2MemoryKind,
    label: "Session Scratch",
    purpose: "临时推理和中间状态，默认不自动升级为长期记忆。",
  },
];

export const HELM_V2_MEMORY_LOAD_PLAN: Record<
  "alwaysOn" | "stageTriggered" | "eventTriggered" | "onDemand",
  Array<{ key: string; description: string }>
> = {
  alwaysOn: [
    {
      key: "policy-summary",
      description: "组织政策摘要始终可见。",
    },
    {
      key: "workspace-summary",
      description: "当前 workspace 的经营摘要始终可见。",
    },
    {
      key: "primary-opportunity-summary",
      description: "当前主机会摘要始终可见。",
    },
  ],
  stageTriggered: [
    {
      key: "quote-stage-policy",
      description: "进入报价阶段时自动加载价格边界和审批规则。",
    },
    {
      key: "approval-stage-memory",
      description: "进入审批阶段时自动加载理由链、依赖和最近修正。",
    },
    {
      key: "handoff-stage-summary",
      description: "进入交接阶段时自动加载 promised 范围、open risks 和 first 14 day plan。",
    },
    {
      key: "official-write-stage-policy",
      description: "进入 正式write 意图阶段时自动加载 system-of-record 边界、审批矩阵和最近 acknowledgement。",
    },
  ],
  eventTriggered: [
    {
      key: "meeting.ended",
      description: "会议结束后加载相关 meeting / 机会 / 客户摘要和政策约束。",
    },
    {
      key: "proposal.requested",
      description: "提案请求触发时加载机会判断、相关证据和对外表达边界。",
    },
    {
      key: "handoff.requested",
      description: "交接请求触发时加载交接经营记忆与交付风险上下文。",
    },
    {
      key: "official.write_intent_created",
      description: "正式write 意图创建时加载 受控正式集成 边界、审批和最近执行 proof。",
    },
  ],
  onDemand: [
    {
      key: "historical-meetings",
      description: "历史会议只按需调取，不一次性塞进上下文。",
    },
    {
      key: "historical-proposals",
      description: "历史提案和专题记忆按需拉取。",
    },
    {
      key: "learned-patterns",
      description: "长期偏好和模式通过索引按需注入。",
    },
  ],
};

type HelmV2SourcePolicy = {
  type: HelmV2SourceType;
  label: string;
  defaultTrustLevel: HelmV2IngestionTrustLevel;
  defaultTrustPromotionStatus: HelmV2TrustPromotionStatus;
  normalizationStatus: HelmV2IngestionNormalizationStatus;
  promotionEligibility: HelmV2IngestionPromotionEligibility;
  defaultScope: HelmV2IngestionScope;
  directObjectFactAllowed: boolean;
  requiresHumanConfirm: boolean;
  systemOfRecord: boolean;
  boundaryNote: string;
};

export const HELM_V2_CONNECTOR_SOURCE_POLICIES: Record<HelmV2SourceType, HelmV2SourcePolicy> = {
  crm: {
    type: "crm",
    label: "CRM",
    defaultTrustLevel: "trusted",
    defaultTrustPromotionStatus: "system_of_record",
    normalizationStatus: "fact_ready",
    promotionEligibility: "system_of_record",
    defaultScope: "object",
    directObjectFactAllowed: true,
    requiresHumanConfirm: false,
    systemOfRecord: true,
    boundaryNote: "CRM source stays the highest-priority system-of-record input for official business state.",
  },
  crm_snapshot: {
    type: "crm_snapshot",
    label: "CRM snapshot",
    defaultTrustLevel: "trusted",
    defaultTrustPromotionStatus: "system_of_record",
    normalizationStatus: "fact_ready",
    promotionEligibility: "system_of_record",
    defaultScope: "object",
    directObjectFactAllowed: true,
    requiresHumanConfirm: false,
    systemOfRecord: true,
    boundaryNote: "CRM snapshot can populate object facts directly because it is a system-of-record read.",
  },
  crm_delta: {
    type: "crm_delta",
    label: "CRM delta",
    defaultTrustLevel: "trusted",
    defaultTrustPromotionStatus: "system_of_record",
    normalizationStatus: "fact_ready",
    promotionEligibility: "system_of_record",
    defaultScope: "object",
    directObjectFactAllowed: true,
    requiresHumanConfirm: false,
    systemOfRecord: true,
    boundaryNote: "CRM delta can update object facts directly because it is a system-of-record delta.",
  },
  meeting: {
    type: "meeting",
    label: "Meeting",
    defaultTrustLevel: "trusted",
    defaultTrustPromotionStatus: "draft_only",
    normalizationStatus: "normalized",
    promotionEligibility: "human_confirmed",
    defaultScope: "object",
    directObjectFactAllowed: false,
    requiresHumanConfirm: true,
    systemOfRecord: false,
    boundaryNote: "Meeting context can feed draft facts, but promotion still depends on human confirmation.",
  },
  meeting_transcript: {
    type: "meeting_transcript",
    label: "Meeting transcript",
    defaultTrustLevel: "untrusted",
    defaultTrustPromotionStatus: "draft_only",
    normalizationStatus: "raw",
    promotionEligibility: "draft_only",
    defaultScope: "object",
    directObjectFactAllowed: false,
    requiresHumanConfirm: true,
    systemOfRecord: false,
    boundaryNote: "Raw transcript stays untrusted and draft-only until facts are confirmed.",
  },
  meeting_note: {
    type: "meeting_note",
    label: "Meeting note",
    defaultTrustLevel: "trusted",
    defaultTrustPromotionStatus: "draft_only",
    normalizationStatus: "draft_layered",
    promotionEligibility: "human_confirmed",
    defaultScope: "object",
    directObjectFactAllowed: false,
    requiresHumanConfirm: true,
    systemOfRecord: false,
    boundaryNote: "Meeting notes can accelerate extraction, but they still require confirm before promotion.",
  },
  calendar: {
    type: "calendar",
    label: "Calendar",
    defaultTrustLevel: "trusted",
    defaultTrustPromotionStatus: "trusted",
    normalizationStatus: "normalized",
    promotionEligibility: "human_confirmed",
    defaultScope: "object",
    directObjectFactAllowed: true,
    requiresHumanConfirm: false,
    systemOfRecord: false,
    boundaryNote: "Calendar metadata is trusted for schedule facts, but it does not create business commitments.",
  },
  calendar_event: {
    type: "calendar_event",
    label: "Calendar event",
    defaultTrustLevel: "trusted",
    defaultTrustPromotionStatus: "trusted",
    normalizationStatus: "normalized",
    promotionEligibility: "human_confirmed",
    defaultScope: "object",
    directObjectFactAllowed: true,
    requiresHumanConfirm: false,
    systemOfRecord: false,
    boundaryNote: "Calendar events can populate schedule context directly, but not opportunity judgement on their own.",
  },
  email: {
    type: "email",
    label: "Email",
    defaultTrustLevel: "untrusted",
    defaultTrustPromotionStatus: "draft_only",
    normalizationStatus: "raw",
    promotionEligibility: "draft_only",
    defaultScope: "object",
    directObjectFactAllowed: false,
    requiresHumanConfirm: true,
    systemOfRecord: false,
    boundaryNote: "Email content is untrusted until reviewed and confirmed.",
  },
  email_thread: {
    type: "email_thread",
    label: "Email thread",
    defaultTrustLevel: "untrusted",
    defaultTrustPromotionStatus: "draft_only",
    normalizationStatus: "raw",
    promotionEligibility: "draft_only",
    defaultScope: "object",
    directObjectFactAllowed: false,
    requiresHumanConfirm: true,
    systemOfRecord: false,
    boundaryNote: "Raw email threads can inform retrieval, but not long-term fact promotion without review.",
  },
  document: {
    type: "document",
    label: "Document",
    defaultTrustLevel: "untrusted",
    defaultTrustPromotionStatus: "draft_only",
    normalizationStatus: "raw",
    promotionEligibility: "draft_only",
    defaultScope: "object",
    directObjectFactAllowed: false,
    requiresHumanConfirm: true,
    systemOfRecord: false,
    boundaryNote: "Documents remain external material until extracted and confirmed.",
  },
  document_attachment: {
    type: "document_attachment",
    label: "Document attachment",
    defaultTrustLevel: "untrusted",
    defaultTrustPromotionStatus: "draft_only",
    normalizationStatus: "raw",
    promotionEligibility: "draft_only",
    defaultScope: "object",
    directObjectFactAllowed: false,
    requiresHumanConfirm: true,
    systemOfRecord: false,
    boundaryNote: "Attachments stay draft-only and cannot directly become long-term memory.",
  },
  external_attachment: {
    type: "external_attachment",
    label: "External attachment",
    defaultTrustLevel: "untrusted",
    defaultTrustPromotionStatus: "draft_only",
    normalizationStatus: "raw",
    promotionEligibility: "draft_only",
    defaultScope: "object",
    directObjectFactAllowed: false,
    requiresHumanConfirm: true,
    systemOfRecord: false,
    boundaryNote: "External attachments are untrusted by default and require confirm before any promotion.",
  },
  web_content: {
    type: "web_content",
    label: "Web content",
    defaultTrustLevel: "untrusted",
    defaultTrustPromotionStatus: "draft_only",
    normalizationStatus: "raw",
    promotionEligibility: "draft_only",
    defaultScope: "workspace",
    directObjectFactAllowed: false,
    requiresHumanConfirm: true,
    systemOfRecord: false,
    boundaryNote: "Web content may inform research, but it never promotes directly into long-term memory.",
  },
  human_edit: {
    type: "human_edit",
    label: "Human edit",
    defaultTrustLevel: "trusted",
    defaultTrustPromotionStatus: "human_confirmed",
    normalizationStatus: "fact_ready",
    promotionEligibility: "human_confirmed",
    defaultScope: "object",
    directObjectFactAllowed: true,
    requiresHumanConfirm: false,
    systemOfRecord: false,
    boundaryNote: "Human edits can promote because a named human has explicitly confirmed the content.",
  },
  agent_inference: {
    type: "agent_inference",
    label: "Agent inference",
    defaultTrustLevel: "untrusted",
    defaultTrustPromotionStatus: "draft_only",
    normalizationStatus: "draft_layered",
    promotionEligibility: "draft_only",
    defaultScope: "session",
    directObjectFactAllowed: false,
    requiresHumanConfirm: true,
    systemOfRecord: false,
    boundaryNote: "Agent inference stays draft-only and can never replace a fact without confirm.",
  },
};

export const HELM_V2_RETRIEVAL_BUCKET_LABELS: Record<HelmV2RetrievalBucket, string> = {
  policy_memory: "Policy memory",
  object_memory: "Object memory",
  learned_memory: "Learned memory",
  handoff_checkpoint_memory: "Handoff / checkpoint memory",
  session_scratch: "Session scratch",
};

export const HELM_V2_RETRIEVAL_PRIORITY = [
  "system_of_record",
  "human_confirmed",
  "trusted",
  "draft_only",
  "untrusted",
  "deprecated",
] as const satisfies HelmV2TrustPromotionStatus[];

export const HELM_V2_MEMORY_LOADING_PRIORITY = {
  policyOverObjectFact: "policy > object_fact",
  objectFactOverInferred: "object_fact > inferred pattern",
  confirmedCheckpointOverStaleMemory: "confirmed checkpoint > stale memory",
  latestTimelineOverOlderSummary: "latest timeline > older summary",
  systemOfRecordOverHumanConfirmed: "system_of_record > human_confirmed when both describe the same official field",
} as const;

export function resolveSourceTrustClass(sourceType: HelmV2SourceType): HelmV2TrustClass {
  return HELM_V2_CONNECTOR_SOURCE_POLICIES[sourceType].defaultTrustLevel === "trusted" ? "TRUSTED" : "UNTRUSTED";
}

export function hasUntrustedSource(sourceRefs: HelmV2MemorySourceRef[]) {
  return sourceRefs.some((source) => resolveSourceTrustClass(source.type) === "UNTRUSTED");
}

export function getConnectorSourcePolicy(sourceType: HelmV2SourceType) {
  return HELM_V2_CONNECTOR_SOURCE_POLICIES[sourceType];
}

export function buildConnectorIngestionContract(input: {
  sourceType: HelmV2SourceType;
  sourceId: string;
  objectRefs: HelmV2ConnectorIngestionContract["ingestionObjectRefs"];
  evidenceRef: string;
  extractedFacts?: string[];
  draftPayload?: Record<string, unknown>;
  summary: string;
}) {
  const policy = getConnectorSourcePolicy(input.sourceType);

  return {
    ingestionSourceType: input.sourceType,
    ingestionSourceId: input.sourceId,
    ingestionScope: policy.defaultScope,
    ingestionTrustLevel: policy.defaultTrustLevel,
    ingestionSensitivity: "internal" as const,
    ingestionNormalizationStatus: policy.normalizationStatus,
    ingestionPromotionEligibility: policy.promotionEligibility,
    ingestionObjectRefs: input.objectRefs,
    ingestionEvidenceRef: input.evidenceRef,
    ingestionExtractedFacts: input.extractedFacts ?? [],
    ingestionDraftPayload: input.draftPayload ?? {},
    ingestionBoundaryNote: policy.boundaryNote,
    ingestionSummary: input.summary,
  } satisfies HelmV2ConnectorIngestionContract;
}

export function buildMemoryItem<TPayload>(
  input: Omit<HelmV2MemoryItem<TPayload>, "confidence"> & {
    confidence?: number;
  },
): HelmV2MemoryItem<TPayload> {
  return {
    ...input,
    confidence: input.confidence ?? 0,
  };
}

type PromotionDecision = {
  promotable: boolean;
  reasons: string[];
};

function verificationAllowsPromotion(verification: HelmV2MemoryVerification) {
  return verification === "human_confirmed" || verification === "system_of_record";
}

export function evaluateMemoryPromotion(item: HelmV2MemoryItem): PromotionDecision {
  const reasons: string[] = [];

  if (item.kind === "scratch") {
    reasons.push("scratch 只用于临时推理，不自动升级为长期记忆。");
  }

  if (item.kind === "learned_pattern" && item.verification !== "human_confirmed") {
    reasons.push("learned pattern 必须先经人工确认，不能直接由推断提升。");
  }

  if (item.promotionRule === "none") {
    reasons.push("晋升 rule 当前是 none。");
  }

  if (hasUntrustedSource(item.sourceRefs) && !verificationAllowsPromotion(item.verification)) {
    reasons.push("来自非可信输入的内容，未经过人工确认或 system-of-record 校验。");
  }

  if (item.confidence < 0.7 && item.verification !== "system_of_record") {
    reasons.push("信心仍不足以进入长期记忆。");
  }

  return {
    promotable: reasons.length === 0,
    reasons,
  };
}

export function getEventTriggeredMemoryKeys(eventType: HelmV2EventType) {
  if (eventType === "meeting.ended") {
    return ["policy-summary", "workspace-summary", "primary-opportunity-summary"];
  }

  if (eventType === "proposal.requested") {
    return ["policy-summary", "workspace-summary", "primary-opportunity-summary"];
  }

  if (eventType === "approval.requested") {
    return ["quote-stage-policy", "approval-stage-memory"];
  }

  if (eventType === "handoff.requested") {
    return ["handoff-stage-summary"];
  }

  if (eventType === "official.write_intent_created") {
    return ["official-write-stage-policy", "handoff-stage-summary"];
  }

  return [];
}

export function getStageTriggeredMemoryKeys(namespace: HelmV2MemoryNamespace) {
  if (namespace === "quote" || namespace === "approval") {
    return ["quote-stage-policy", "approval-stage-memory"];
  }

  if (namespace === "handoff") {
    return ["handoff-stage-summary"];
  }

  if (namespace === "opportunity") {
    return ["primary-opportunity-summary"];
  }

  return [];
}

export function getWorkerDefaultRetrievalModes(workerId: string): HelmV2RetrievalPolicyMode[] {
  if (workerId === "meeting-analyst") {
    return ["always_on", "event_triggered", "on_demand"];
  }

  if (workerId === "opportunity-judge") {
    return ["always_on", "stage_triggered", "event_triggered", "on_demand"];
  }

  if (workerId === "proposal-composer" || workerId === "comms-scheduler") {
    return ["always_on", "stage_triggered", "event_triggered", "on_demand"];
  }

  if (workerId === "handoff-manager") {
    return ["always_on", "stage_triggered", "event_triggered"];
  }

  return ["always_on", "event_triggered"];
}

export function resolveRetrievalPlan(input: {
  workerId: string;
  eventType?: HelmV2EventType | null;
  namespace?: HelmV2MemoryNamespace | null;
}) {
  const modes = getWorkerDefaultRetrievalModes(input.workerId);
  const alwaysOn: HelmV2RetrievalLoadRef[] = HELM_V2_MEMORY_LOAD_PLAN.alwaysOn.map((item) => ({
    key: item.key,
    label: item.key,
    reason: item.description,
    loaded: true,
    sourceType: item.key.includes("policy") ? "policy" : "summary",
    trustPromotionStatus: item.key.includes("policy") ? "system_of_record" : "trusted",
  }));
  const stageTriggeredKeys = [
    ...(input.namespace ? getStageTriggeredMemoryKeys(input.namespace) : []),
    ...(input.eventType === "official.write_intent_created" ? ["official-write-stage-policy"] : []),
  ].filter((key, index, list) => list.indexOf(key) === index);
  const stageTriggered = stageTriggeredKeys.map((key) => {
    const item = HELM_V2_MEMORY_LOAD_PLAN.stageTriggered.find((candidate) => candidate.key === key);
    return {
      key,
      label: key,
      reason: item?.description ?? "Stage-triggered retrieval candidate.",
      loaded: true,
      sourceType: "summary" as const,
      trustPromotionStatus: "trusted" as const,
    };
  });
  const eventTriggered = (input.eventType ? getEventTriggeredMemoryKeys(input.eventType) : []).map((key) => {
    const item = HELM_V2_MEMORY_LOAD_PLAN.eventTriggered.find((candidate) => candidate.key === key);
    return {
      key,
      label: key,
      reason: item?.description ?? "Event-triggered retrieval candidate.",
      loaded: true,
      sourceType: "summary" as const,
      trustPromotionStatus: key === "official.write_intent_created" ? ("system_of_record" as const) : ("trusted" as const),
    };
  });
  const onDemand = HELM_V2_MEMORY_LOAD_PLAN.onDemand.map((item) => ({
    key: item.key,
    label: item.key,
    reason: item.description,
    loaded: false,
    sourceType: item.key.includes("learned") ? ("memory_item" as const) : ("summary" as const),
    trustPromotionStatus: item.key.includes("learned") ? ("human_confirmed" as const) : ("draft_only" as const),
  }));

  return {
    modes,
    buckets: {
      always_on: alwaysOn,
      stage_triggered: modes.includes("stage_triggered") ? stageTriggered : [],
      event_triggered: modes.includes("event_triggered") ? eventTriggered : [],
      on_demand: modes.includes("on_demand") ? onDemand : [],
    },
  };
}

export function resolveMemoryConflict(input: {
  field: string;
  currentStatus: HelmV2TrustPromotionStatus;
  incomingStatus: HelmV2TrustPromotionStatus;
}) {
  const currentPriority = HELM_V2_RETRIEVAL_PRIORITY.indexOf(input.currentStatus);
  const incomingPriority = HELM_V2_RETRIEVAL_PRIORITY.indexOf(input.incomingStatus);

  if (input.currentStatus === "deprecated") {
    return {
      winner: "incoming" as const,
      reason: `${input.field}: deprecated memory yields to newer non-deprecated input.`,
    };
  }

  if (currentPriority <= incomingPriority) {
    return {
      winner: "current" as const,
      reason: `${input.field}: keep the current source because ${input.currentStatus} outranks or equals ${input.incomingStatus}.`,
    };
  }

  return {
    winner: "incoming" as const,
    reason: `${input.field}: accept incoming source because ${input.incomingStatus} outranks ${input.currentStatus}.`,
  };
}
