export const ASK_HELM_INTENT_TYPES = [
  "object_search",
  "object_recent",
  "current_status",
  "today_priority",
  "why_recommendation",
  "why_blocked",
  "how_to_use",
  "definition_diff",
  "next_step_page",
  "next_step_object",
  "plan_breakdown",
  "prepare_draft",
  "prepare_review_packet",
  "queue_internal_followup",
  "request_handoff",
  "request_execution",
  "review_required_execution",
  "submit_business_signal",
  "unsupported_open_domain",
  "unsupported_chitchat",
  "cross_workspace_denied",
  "out_of_scope",
] as const;

export type AskHelmIntentType = (typeof ASK_HELM_INTENT_TYPES)[number];

export const ASK_HELM_PRIMARY_TARGETS = [
  "search_results",
  "object_timeline",
  "current_object_summary",
  "workspace_priority_queue",
  "recommendation_explanation",
  "blocker_explanation",
  "system_help",
  "definition_help",
  "page_deep_link",
  "object_deep_link",
  "action_plan",
  "draft_artifact",
  "review_packet",
  "internal_followup_queue",
  "handoff_request",
  "execution_request",
  "review_required_gate",
  "signal_intake_form",
  "unsupported_domain_deny",
  "unsupported_chitchat_deny",
  "cross_workspace_deny",
  "deny",
] as const;

export type AskHelmPrimaryTarget = (typeof ASK_HELM_PRIMARY_TARGETS)[number];

export type AskHelmIntentMetadata = {
  needsObjectContext: boolean;
  needsMemory: boolean;
  needsSystemKnowledge: boolean;
  primaryTarget: AskHelmPrimaryTarget;
};

export type AskHelmQueryIntentSample = {
  id: string;
  query: string;
  intentType: AskHelmIntentType;
  needsObjectContext: boolean;
  needsMemory: boolean;
  needsSystemKnowledge: boolean;
  expectedPrimaryTarget: AskHelmPrimaryTarget;
};

export type AskHelmQueryIntentClassification = AskHelmIntentMetadata & {
  intentType: AskHelmIntentType;
  matchedRule: string;
  confidence: "high" | "medium" | "low";
  normalizedQuery: string;
};

export const ASK_HELM_INTENT_METADATA: Record<
  AskHelmIntentType,
  AskHelmIntentMetadata
> = {
  object_search: {
    needsObjectContext: false,
    needsMemory: false,
    needsSystemKnowledge: false,
    primaryTarget: "search_results",
  },
  object_recent: {
    needsObjectContext: true,
    needsMemory: true,
    needsSystemKnowledge: false,
    primaryTarget: "object_timeline",
  },
  current_status: {
    needsObjectContext: true,
    needsMemory: true,
    needsSystemKnowledge: false,
    primaryTarget: "current_object_summary",
  },
  today_priority: {
    needsObjectContext: false,
    needsMemory: true,
    needsSystemKnowledge: false,
    primaryTarget: "workspace_priority_queue",
  },
  why_recommendation: {
    needsObjectContext: true,
    needsMemory: true,
    needsSystemKnowledge: true,
    primaryTarget: "recommendation_explanation",
  },
  why_blocked: {
    needsObjectContext: true,
    needsMemory: true,
    needsSystemKnowledge: true,
    primaryTarget: "blocker_explanation",
  },
  how_to_use: {
    needsObjectContext: false,
    needsMemory: false,
    needsSystemKnowledge: true,
    primaryTarget: "system_help",
  },
  definition_diff: {
    needsObjectContext: false,
    needsMemory: false,
    needsSystemKnowledge: true,
    primaryTarget: "definition_help",
  },
  next_step_page: {
    needsObjectContext: true,
    needsMemory: false,
    needsSystemKnowledge: true,
    primaryTarget: "page_deep_link",
  },
  next_step_object: {
    needsObjectContext: true,
    needsMemory: true,
    needsSystemKnowledge: false,
    primaryTarget: "object_deep_link",
  },
  plan_breakdown: {
    needsObjectContext: true,
    needsMemory: true,
    needsSystemKnowledge: true,
    primaryTarget: "action_plan",
  },
  prepare_draft: {
    needsObjectContext: true,
    needsMemory: true,
    needsSystemKnowledge: true,
    primaryTarget: "draft_artifact",
  },
  prepare_review_packet: {
    needsObjectContext: true,
    needsMemory: true,
    needsSystemKnowledge: true,
    primaryTarget: "review_packet",
  },
  queue_internal_followup: {
    needsObjectContext: true,
    needsMemory: true,
    needsSystemKnowledge: true,
    primaryTarget: "internal_followup_queue",
  },
  request_handoff: {
    needsObjectContext: true,
    needsMemory: true,
    needsSystemKnowledge: true,
    primaryTarget: "handoff_request",
  },
  request_execution: {
    needsObjectContext: true,
    needsMemory: true,
    needsSystemKnowledge: true,
    primaryTarget: "execution_request",
  },
  review_required_execution: {
    needsObjectContext: true,
    needsMemory: true,
    needsSystemKnowledge: true,
    primaryTarget: "review_required_gate",
  },
  submit_business_signal: {
    needsObjectContext: false,
    needsMemory: false,
    needsSystemKnowledge: true,
    primaryTarget: "signal_intake_form",
  },
  unsupported_open_domain: {
    needsObjectContext: false,
    needsMemory: false,
    needsSystemKnowledge: false,
    primaryTarget: "unsupported_domain_deny",
  },
  unsupported_chitchat: {
    needsObjectContext: false,
    needsMemory: false,
    needsSystemKnowledge: false,
    primaryTarget: "unsupported_chitchat_deny",
  },
  cross_workspace_denied: {
    needsObjectContext: false,
    needsMemory: false,
    needsSystemKnowledge: false,
    primaryTarget: "cross_workspace_deny",
  },
  out_of_scope: {
    needsObjectContext: false,
    needsMemory: false,
    needsSystemKnowledge: false,
    primaryTarget: "deny",
  },
};

type IntentRule = {
  id: string;
  intentType: AskHelmIntentType;
  confidence: "high" | "medium";
  patterns: RegExp[];
};

const OBJECT_CUES = [
  "机会",
  "公司",
  "联系人",
  "客户",
  "会议",
  "atlas",
  "cedar",
  "opportunity",
  "company",
  "contact",
  "customer",
  "meeting",
];

const WORK_CONTEXT_CUES = [
  "经营",
  "推进",
  "阻塞",
  "风险",
  "交付",
  "合同",
  "报价",
  "回款",
  "销售",
  "客服",
  "投诉",
  "承诺",
  "handoff",
  "交接",
  "跟进",
  "上报",
  "反馈",
  "复核",
  "审批",
  "信号",
  "续约",
  "经营记忆",
  "operating",
  "approval",
  "renewal",
  "delivery",
  "blocker",
  "risk",
  "escalation",
];

function hasWorkContextCue(normalizedQuery: string) {
  return WORK_CONTEXT_CUES.some((cue) => normalizedQuery.includes(cue));
}

const INTENT_RULES: IntentRule[] = [
  {
    id: "cross_workspace_denied",
    intentType: "cross_workspace_denied",
    confidence: "high",
    patterns: [
      /跨.*workspace/u,
      /跨.*租户/u,
      /cross[- ]workspace/u,
      /cross[- ]tenant/u,
      /另一个.*(workspace|工作区|租户)/u,
      /两个.*(workspace|工作区|租户)/u,
      /another workspace/u,
      /other workspace/u,
    ],
  },
  {
    id: "unsupported_open_domain",
    intentType: "unsupported_open_domain",
    confidence: "high",
    patterns: [
      /tesla/u,
      /latest earnings/u,
      /latest news/u,
      /stock price/u,
      /open[- ]domain/u,
      /互联网.*最新/u,
      /外部.*新闻/u,
      /最新财报/u,
      /股价/u,
      /(明星|八卦|娱乐圈|gossip|celebrity)/u,
      /(天气|气温|下雨|预报|weather|forecast)/u,
      /(旅游|景点|攻略|哪里好玩|travel|tourism)/u,
      /(菜谱|食谱|recipe|做饭)/u,
      /(电影|剧集|movie|netflix|豆瓣)/u,
      /(翻译.*成|translate.*to)/u,
      /(写.*诗|写一首诗|讲个故事)/u,
    ],
  },
  {
    id: "unsupported_chitchat",
    intentType: "unsupported_chitchat",
    confidence: "high",
    patterns: [
      /(讲个笑话|来个笑话|讲笑话|tell.*joke|tell me a joke)/u,
      /(你好吗|how are you|你叫什么名字|你是谁|你能干啥|聊聊天|陪我聊)/u,
      /(无聊|想休息|猜.*数字|play.*game|玩.*游戏)/u,
      /^(hi|hello|hey|在吗|在不在|早上好|晚上好)\s*[?？!！.。]*$/u,
    ],
  },
  {
    id: "submit_business_signal",
    intentType: "submit_business_signal",
    confidence: "high",
    patterns: [
      /(上报|反馈|报一下|报个|报上来|提报|提交).*?(信号|风险|阻塞|异常|线索|经营|客户|机会|承诺|交付|合同|回款|投诉)/u,
      /(客户|对方|甲方).*?(在等|等着|等回复|催|催着|等我们|等我)/u,
      /(我想|我要|帮我|请).*?(上报|反馈|记一笔|记录一下|登记|备案).*?(信号|经营|风险|异常|阻塞|线索)/u,
      /(report|submit|flag).*?(business signal|risk|blocker|delivery|opportunity|customer issue|escalation)/u,
      /(我发现|发现一个|刚发现|遇到一个|出现.*?(异常|风险|阻塞|预警|苗头))/u,
      /(承诺.*?(可能|有.*?风险|可能违约|风险))/u,
    ],
  },
  {
    id: "review_required_execution",
    intentType: "review_required_execution",
    confidence: "high",
    patterns: [
      /直接.*(发.*邮件|发送|对外发送|审批|批准|承诺|付款|确认付款|写回|改正式状态)/u,
      /帮我.*(发.*邮件|发送|对外发送|审批|批准|承诺|付款|确认付款|写回|改正式状态)/u,
      /send .*email/u,
      /approve .*now/u,
      /pay .*now/u,
      /write .*back/u,
    ],
  },
  {
    id: "prepare_review_packet",
    intentType: "prepare_review_packet",
    confidence: "high",
    patterns: [
      /准备.*(审批|复核|review).*(材料|包|packet)/u,
      /(审批|复核|review).*(材料|包|packet)/u,
      /review packet/u,
      /approval packet/u,
    ],
  },
  {
    id: "prepare_draft",
    intentType: "prepare_draft",
    confidence: "high",
    patterns: [
      /起草/u,
      /草稿/u,
      /准备.*(邮件|话术|说明|回复|follow[- ]?up)/u,
      /draft/u,
      /prepare .*message/u,
      /prepare .*email/u,
    ],
  },
  {
    id: "queue_internal_followup",
    intentType: "queue_internal_followup",
    confidence: "high",
    patterns: [
      /加入.*(队列|待办|follow[- ]?up)/u,
      /放到.*(队列|待办|operating)/u,
      /排进.*(队列|待办)/u,
      /内部跟进/u,
      /提醒.*跟进/u,
      /queue .*follow[- ]?up/u,
      /add .*to .*queue/u,
    ],
  },
  {
    id: "request_handoff",
    intentType: "request_handoff",
    confidence: "high",
    patterns: [
      /交给/u,
      /转给/u,
      /handoff/u,
      /安排给/u,
      /让.*负责人/u,
      /assign .*to/u,
      /pass .*to/u,
    ],
  },
  {
    id: "request_execution",
    intentType: "request_execution",
    confidence: "high",
    patterns: [
      /帮我.*(安排执行|推进下去|开始执行|进入执行)/u,
      /执行这个计划/u,
      /推进这个计划/u,
      /run .*plan/u,
      /move .*forward/u,
    ],
  },
  {
    id: "plan_breakdown",
    intentType: "plan_breakdown",
    confidence: "high",
    patterns: [
      /拆(一下|成|解)/u,
      /分解/u,
      /行动计划/u,
      /计划.*(推进|处理|执行)/u,
      /怎么推进/u,
      /如何推进/u,
      /处理.*风险/u,
      /break .*down/u,
      /make .*plan/u,
    ],
  },
  {
    id: "definition_diff_boundary",
    intentType: "definition_diff",
    confidence: "high",
    patterns: [
      /区别/u,
      /差异/u,
      /分别负责什么/u,
      /difference between/u,
      /what'?s the difference/u,
      /\bcompare\b/u,
    ],
  },
  {
    id: "why_blocked",
    intentType: "why_blocked",
    confidence: "high",
    patterns: [/为什么.*(不能|卡|阻塞)/u, /why .*blocked/u, /what is blocking/u, /还不能/u],
  },
  {
    id: "why_recommendation",
    intentType: "why_recommendation",
    confidence: "high",
    patterns: [/为什么.*建议/u, /why .*recommend/u, /why did helm recommend/u, /为什么优先/u],
  },
  {
    id: "how_to_use_helm",
    intentType: "how_to_use",
    confidence: "high",
    patterns: [
      /(怎么|如何).*(helm|会议|审批|经营记忆|memory|search|搜索)/u,
      /how do i /u,
      /how can i /u,
      /how to use/u,
    ],
  },
  {
    id: "today_priority",
    intentType: "today_priority",
    confidence: "high",
    patterns: [/今天.*(优先|先推进|先处理|最该)/u, /what should i work on first today/u, /today.*priority/u],
  },
  {
    id: "next_step_page",
    intentType: "next_step_page",
    confidence: "high",
    patterns: [/(哪个|什么|在哪个|去哪个)页面/u, /哪里处理/u, /which page/u, /where should i go/u, /what page/u],
  },
  {
    id: "next_step_object",
    intentType: "next_step_object",
    confidence: "high",
    patterns: [/哪个对象/u, /哪条/u, /进哪里/u, /点开哪个/u, /which record/u, /open next/u],
  },
  {
    id: "current_status",
    intentType: "current_status",
    confidence: "high",
    patterns: [
      /现在.*(卡在哪|状态|推进到哪|什么情况)/u,
      /目前.*推进到哪/u,
      /推进到哪一步/u,
      /current status/u,
      /status right now/u,
      /where .* stuck/u,
    ],
  },
  {
    id: "object_recent",
    intentType: "object_recent",
    confidence: "high",
    patterns: [/最近.*(会议|互动|跟进|联系)/u, /(recent|latest).*(meeting|activity|follow[- ]?up)/u],
  },
  {
    id: "object_search",
    intentType: "object_search",
    confidence: "high",
    patterns: [
      /(找到|搜索|搜一下|查一下|看看).*(机会|公司|联系人|客户|会议)?/u,
      /^(find|search|lookup|show me)\b/u,
      /相关的机会/u,
    ],
  },
];

export function normalizeAskHelmIntentQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildClassification(
  intentType: AskHelmIntentType,
  matchedRule: string,
  confidence: AskHelmQueryIntentClassification["confidence"],
  normalizedQuery: string,
): AskHelmQueryIntentClassification {
  return {
    intentType,
    matchedRule,
    confidence,
    normalizedQuery,
    ...ASK_HELM_INTENT_METADATA[intentType],
  };
}

function hasObjectCue(normalizedQuery: string) {
  return OBJECT_CUES.some((cue) => normalizedQuery.includes(cue));
}

export function classifyAskHelmQueryIntent(query: string): AskHelmQueryIntentClassification {
  const normalizedQuery = normalizeAskHelmIntentQuery(query);

  if (!normalizedQuery) {
    return buildClassification("out_of_scope", "empty_query", "low", normalizedQuery);
  }

  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalizedQuery))) {
      return buildClassification(rule.intentType, rule.id, rule.confidence, normalizedQuery);
    }
  }

  if (hasObjectCue(normalizedQuery)) {
    return buildClassification("object_search", "object_cue_fallback", "medium", normalizedQuery);
  }

  if (hasWorkContextCue(normalizedQuery)) {
    return buildClassification(
      "current_status",
      "work_context_cue_fallback",
      "medium",
      normalizedQuery,
    );
  }

  return buildClassification("out_of_scope", "unsupported_fallback", "low", normalizedQuery);
}

export function isAskHelmIntentType(value: string): value is AskHelmIntentType {
  return ASK_HELM_INTENT_TYPES.includes(value as AskHelmIntentType);
}

export function isAskHelmPrimaryTarget(value: string): value is AskHelmPrimaryTarget {
  return ASK_HELM_PRIMARY_TARGETS.includes(value as AskHelmPrimaryTarget);
}
