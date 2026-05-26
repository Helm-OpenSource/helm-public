import { ObjectType } from "@prisma/client";

export const llmPromptRegistry = {
  meetingMemoryExtraction: {
    key: "meeting-memory-extraction",
    version: "meeting-memory-v1",
    taskTypes: ["MEETING_MEMORY_EXTRACTION"],
    description: "把会议纪要提取成结构化记忆对象。",
  },
  briefing: {
    key: "object-briefing",
    version: "briefing-v1",
    taskTypes: [
      "CONTACT_BRIEFING",
      "COMPANY_BRIEFING",
      "OPPORTUNITY_BRIEFING",
      "MEETING_BRIEFING",
    ],
    description: "把对象上下文压缩成会前简报。",
  },
  recommendationExplanation: {
    key: "recommendation-explanation",
    version: "recommendation-explanation-v1",
    taskTypes: ["RECOMMENDATION_EXPLANATION"],
    description: "增强 recommendation 解释，但不改变排序和策略边界。",
  },
  biReportAnalysis: {
    key: "bi-report-analysis",
    version: "bi-report-analysis-v2",
    taskTypes: ["BI_REPORT_ANALYSIS"],
    description:
      "解释 deterministic BI report result，但不重新判级或扩张执行权限。",
  },
  biReportReview: {
    key: "bi-report-review",
    version: "bi-report-review-v1",
    taskTypes: ["BI_REPORT_REVIEW"],
    description:
      "审查 BI report 解释，纠正越权归因和过度动作建议，但不改 deterministic 判断。",
  },
} as const;

export const llmPromptVersions = {
  meetingMemoryExtraction: llmPromptRegistry.meetingMemoryExtraction.version,
  briefing: llmPromptRegistry.briefing.version,
  recommendationExplanation:
    llmPromptRegistry.recommendationExplanation.version,
  biReportAnalysis: llmPromptRegistry.biReportAnalysis.version,
  biReportReview: llmPromptRegistry.biReportReview.version,
} as const;

export function getRegisteredPromptSummaries() {
  return Object.values(llmPromptRegistry).map((item) => ({
    key: item.key,
    version: item.version,
    taskTypes: [...item.taskTypes],
    description: item.description,
  }));
}

export const meetingMemoryExtractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    facts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          objectType: {
            type: "string",
            enum: ["CONTACT", "COMPANY", "OPPORTUNITY", "MEETING"],
          },
          objectId: { type: "string" },
          factType: { type: "string" },
          confidence: { type: "number" },
          importance: { type: "number" },
        },
        required: ["title", "content", "objectType", "objectId", "factType"],
      },
    },
    commitments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          commitmentText: { type: "string" },
          dueHint: { type: ["string", "null"] },
          priority: { type: "number" },
          confidence: { type: "number" },
        },
        required: ["title", "commitmentText"],
      },
    },
    blockers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          blockerText: { type: "string" },
          blockerType: { type: "string" },
          severity: { type: "number" },
        },
        required: ["title", "blockerText", "blockerType"],
      },
    },
    candidateActions: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["summary", "facts", "commitments", "blockers", "candidateActions"],
} as const;

export const briefingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    recommendedQuestions: {
      type: "array",
      items: { type: "string" },
    },
    recommendedNextSteps: {
      type: "array",
      items: { type: "string" },
    },
    importantFactHighlights: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "summary",
    "recommendedQuestions",
    "recommendedNextSteps",
    "importantFactHighlights",
  ],
} as const;

export const recommendationExplanationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    explanation: { type: "string" },
    whyNow: { type: "string" },
    expectedImpact: { type: "string" },
    ifNoAction: { type: "string" },
    currentBlocker: { type: ["string", "null"] },
    currentCommitment: { type: ["string", "null"] },
    personalizationHint: { type: ["string", "null"] },
    supportingHighlights: {
      type: "array",
      items: { type: "string" },
    },
    evidenceSummary: { type: "string" },
  },
  required: [
    "explanation",
    "whyNow",
    "expectedImpact",
    "ifNoAction",
    "currentBlocker",
    "currentCommitment",
    "personalizationHint",
    "supportingHighlights",
    "evidenceSummary",
  ],
} as const;

export const biReportAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    findings: {
      type: "array",
      items: { type: "string" },
    },
    possibleCauses: {
      type: "array",
      items: { type: "string" },
    },
    recommendedActions: {
      type: "array",
      items: { type: "string" },
    },
    confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
    continuityStatus: {
      type: "string",
      enum: ["first_seen", "recurring", "worsening", "recovering"],
    },
    historicalContext: { type: ["string", "null"] },
    feedbackContext: { type: ["string", "null"] },
    boundaryNote: { type: "string" },
  },
  required: [
    "headline",
    "summary",
    "findings",
    "possibleCauses",
    "recommendedActions",
    "confidence",
    "continuityStatus",
    "historicalContext",
    "feedbackContext",
    "boundaryNote",
  ],
} as const;

export const biReportReviewSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    approved: { type: "boolean" },
    issueCodes: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "SPECULATION_AS_FACT",
          "OUT_OF_EVIDENCE_SCOPE",
          "BOUNDARY_VIOLATION",
          "OVERSTRONG_ACTION",
        ],
      },
    },
    issueNotes: {
      type: ["array", "null"],
      items: { type: "string" },
    },
    rewrittenHeadline: { type: ["string", "null"] },
    rewrittenPossibleCauses: {
      type: ["array", "null"],
      items: { type: "string" },
    },
    rewrittenRecommendedActions: {
      type: ["array", "null"],
      items: { type: "string" },
    },
  },
  required: [
    "approved",
    "issueCodes",
    "issueNotes",
    "rewrittenHeadline",
    "rewrittenPossibleCauses",
    "rewrittenRecommendedActions",
  ],
} as const;

export function buildMeetingMemoryExtractionPrompt(input: {
  title: string;
  companyName?: string | null;
  opportunityTitle?: string | null;
  attendees: string[];
  noteText: string;
}) {
  return {
    promptKey: llmPromptRegistry.meetingMemoryExtraction.key,
    promptVersion: llmPromptVersions.meetingMemoryExtraction,
    systemPrompt:
      "你是 Helm 经营推进控制台的结构化提取引擎。请把会议纪要转成结构化工作记忆。不要闲聊，不要输出解释，只输出符合 schema 的 JSON。重点区分事实、承诺、阻塞和会后动作信号。",
    userPrompt: [
      `会议标题：${input.title}`,
      `相关公司：${input.companyName ?? "未关联"}`,
      `相关机会：${input.opportunityTitle ?? "未关联"}`,
      `参会人：${input.attendees.join("、") || "未记录"}`,
      "请从以下纪要中提取：1) 关键经营事实 2) 明确承诺 3) 当前卡点 4) 会后候选动作。",
      "对于事实，要尽量落到 CONTACT / COMPANY / OPPORTUNITY / MEETING 其中一个对象；对于承诺和阻塞，不要简单复述原文，而要写成能进入工作流的表达。",
      "会议纪要正文：",
      input.noteText,
    ].join("\n"),
  };
}

export function buildBriefingPrompt(input: {
  objectType: ObjectType;
  objectLabel: string;
  currentStage?: string | null;
  recentFacts: string[];
  openCommitments: string[];
  activeBlockers: string[];
  recentMeetings: string[];
  recentThreads: string[];
}) {
  const objectLabel = getObjectTypeLabel(input.objectType);
  return {
    promptKey: llmPromptRegistry.briefing.key,
    promptVersion: llmPromptVersions.briefing,
    systemPrompt: `你是 Helm 经营推进控制台的 ${objectLabel} 简报引擎。请根据结构化记忆生成高密度、可执行、克制的中文简报。不要夸张，不要写成市场文案，只输出符合 schema 的 JSON。`,
    userPrompt: [
      `对象：${input.objectLabel}`,
      `对象类型：${objectLabel}`,
      `当前阶段：${input.currentStage ?? "未标记"}`,
      `关键事实：${input.recentFacts.join("；") || "暂无"}`,
      `未完成承诺：${input.openCommitments.join("；") || "暂无"}`,
      `当前卡点：${input.activeBlockers.join("；") || "暂无"}`,
      `最近会议：${input.recentMeetings.join("；") || "暂无"}`,
      `最近线程：${input.recentThreads.join("；") || "暂无"}`,
      "请生成：1) 一段会前/对象摘要 2) 推荐提问 3) 推荐下一步动作 4) 最重要事实高亮。",
    ].join("\n"),
  };
}

export function buildRecommendationExplanationPrompt(input: {
  objectLabel: string;
  recommendationTitle: string;
  recommendationDescription: string;
  deterministicExplanation: string;
  whyNow: string;
  currentBlocker?: string | null;
  currentCommitment?: string | null;
  policyResultLabel: string;
  supportingFacts: string[];
  briefingSummary?: string | null;
}) {
  return {
    promptKey: llmPromptRegistry.recommendationExplanation.key,
    promptVersion: llmPromptVersions.recommendationExplanation,
    systemPrompt:
      "你是 Helm 经营推进控制台的判断解释引擎。你的任务不是重新排序动作，而是把已有 recommendation 的经营判断解释得更清楚、更可信、更适合审批和执行。只输出符合 schema 的 JSON。",
    userPrompt: [
      `对象：${input.objectLabel}`,
      `推荐动作：${input.recommendationTitle}`,
      `动作描述：${input.recommendationDescription}`,
      `当前规则边界：${input.policyResultLabel}`,
      `规则解释基线：${input.deterministicExplanation}`,
      `为什么是现在：${input.whyNow}`,
      `当前卡点：${input.currentBlocker ?? "无"}`,
      `当前承诺：${input.currentCommitment ?? "无"}`,
      `支持性记忆：${input.supportingFacts.join("；") || "暂无"}`,
      `最近简报摘要：${input.briefingSummary ?? "暂无"}`,
      "请强化解释，让它更像经营判断链：说明为什么现在做、预计影响、不做的后果，并保持可审计、可追溯、可执行。",
    ].join("\n"),
  };
}

export function buildBiReportAnalysisPrompt(input: {
  skillName: string;
  severityLabel: string;
  windowLabel: string;
  summaryMetrics: Array<{ label: string; value: string }>;
  matchedRules: string[];
  deterministicFindings: string[];
  recentRunContext?: {
    continuityStatus: string;
    historicalContext: string | null;
  };
  recentFeedbackContext?: {
    feedbackContext: string | null;
  };
  similarCaseContext?: {
    caseContext: string | null;
  };
  odpsKnowledgeContext?: {
    matchedAliases: string[];
    tableAliases: string[];
    fieldConventions: string[];
    enumKnowledge: string[];
    queryConventions: string[];
  } | null;
  boundaries: string[];
  skillPromptTemplate?: string | null;
}) {
  const skillPromptTemplate = input.skillPromptTemplate?.trim();

  return {
    promptKey: llmPromptRegistry.biReportAnalysis.key,
    promptVersion: llmPromptVersions.biReportAnalysis,
    systemPrompt: [
      "你是 Helm 的 BI 报表解释引擎。你的任务不是重新判级，也不是输出自动执行承诺，而是基于 deterministic 指标、命中规则和 top 发现 生成一段克制、可审计、可复盘的中文解释。只输出符合 schema 的 JSON。",
      skillPromptTemplate
        ? `当前 skill 的补充解释约束如下：\n${skillPromptTemplate}`
        : null,
    ]
      .filter((item): item is string => Boolean(item))
      .join("\n\n"),
    userPrompt: [
      `skill：${input.skillName}`,
      `等级：${input.severityLabel}`,
      `时间窗口：${input.windowLabel}`,
      `核心指标：${input.summaryMetrics.map((item) => `${item.label} ${item.value}`).join("；") || "暂无"}`,
      `命中规则：${input.matchedRules.join("；") || "无"}`,
      `deterministic 发现：${input.deterministicFindings.join("；") || "暂无"}`,
      `连续性状态：${input.recentRunContext?.continuityStatus ?? "first_seen"}`,
      `历史运行上下文：${input.recentRunContext?.historicalContext ?? "当前没有可用的历史运行记忆"}`,
      `人工反馈记忆：${input.recentFeedbackContext?.feedbackContext ?? "当前还没有可用的人工复盘反馈记忆"}`,
      `相似案例：${input.similarCaseContext?.caseContext ?? "当前没有可用的相似案例参考"}`,
      input.odpsKnowledgeContext
        ? `相关 ODPS 表：${input.odpsKnowledgeContext.tableAliases.join("；") || "暂无"}`
        : null,
      input.odpsKnowledgeContext
        ? `相关字段口径：${input.odpsKnowledgeContext.fieldConventions.join("；") || "暂无"}`
        : null,
      input.odpsKnowledgeContext
        ? `相关状态/枚举：${input.odpsKnowledgeContext.enumKnowledge.join("；") || "暂无"}`
        : null,
      input.odpsKnowledgeContext
        ? `查询与口径约束：${input.odpsKnowledgeContext.queryConventions.join("；") || "暂无"}`
        : null,
      `边界：${input.boundaries.join("；") || "暂无"}`,
      "请输出：1) headline 2) summary 3) 发现 4) possibleCauses 5) recommendedActions 6) 信心 7) 连续性Status 8) historicalContext 9) feedbackContext 10) boundaryNote。",
      "如果提供了 ODPS 相关知识，优先把它当作硬知识引用，用于约束表名、状态解释、金额单位和分区口径。",
      "不要重新定义 severity，不要编造未证实根因，不要写成自动决策或自动执行。",
    ].join("\n"),
  };
}

export function buildBiReportReviewPrompt(input: {
  skillName: string;
  severityLabel: string;
  windowLabel: string;
  summaryMetrics?: Array<{ label: string; value: string }>;
  matchedRules?: string[];
  boundaries: string[];
  deterministicFindings: string[];
  candidate: {
    headline: string;
    possibleCauses: string[];
    recommendedActions: string[];
  };
}) {
  return {
    promptKey: llmPromptRegistry.biReportReview.key,
    promptVersion: llmPromptVersions.biReportReview,
    systemPrompt:
      "你是 Helm 的 BI 报表解释 reviewer。只检查解释层是否把猜测写成事实、是否超出报表证据范围、是否越过边界、是否给出过强动作建议。不要修改 severity、summary、continuity 或 boundary；也不要改连续性或边界。只输出符合 schema 的 JSON。",
    userPrompt: [
      `skill：${input.skillName}`,
      `等级：${input.severityLabel}`,
      `时间窗口：${input.windowLabel}`,
      `核心指标：${input.summaryMetrics?.map((item) => `${item.label} ${item.value}`).join("；") || "暂无"}`,
      `命中规则：${input.matchedRules?.join("；") || "无"}`,
      `deterministic 发现：${input.deterministicFindings.join("；") || "暂无"}`,
      `边界：${input.boundaries.join("；") || "暂无"}`,
      `候选 headline：${input.candidate.headline}`,
      `候选 possibleCauses：${input.candidate.possibleCauses.join("；") || "暂无"}`,
      `候选 recommendedActions：${input.candidate.recommendedActions.join("；") || "暂无"}`,
      "issueCodes 只能从以下枚举里选：SPECULATION_AS_FACT、OUT_OF_EVIDENCE_SCOPE、BOUNDARY_VIOLATION、OVERSTRONG_ACTION。",
      "issueNotes 可选，用于补充人类可读说明；如果没有额外说明，返回空数组。",
      "如果解释层已经克制且没有越权，approved=true 并保持 rewritten 字段为 null。",
      "候选内容只要没有超出核心指标、命中规则、deterministic 发现和边界，就不应判为 OUT_OF_EVIDENCE_SCOPE。",
      "如果存在问题，只允许保守重写 headline / possibleCauses / recommendedActions，不能引入新的事实，也不能写成自动执行口吻。",
    ].join("\n"),
  };
}

function getObjectTypeLabel(objectType: ObjectType) {
  switch (objectType) {
    case ObjectType.CONTACT:
      return "联系人";
    case ObjectType.COMPANY:
      return "公司";
    case ObjectType.OPPORTUNITY:
      return "机会";
    case ObjectType.MEETING:
      return "会议";
    default:
      return "对象";
  }
}
