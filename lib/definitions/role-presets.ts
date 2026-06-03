import type { UiLocale } from "@/lib/i18n/config";

export const ROLE_PRESET_KEYS = [
  "FOUNDER_CEO",
  "SALES_LEAD",
  "ACCOUNT_EXECUTIVE",
  "RECRUITER",
  "CUSTOMER_SUCCESS",
  "DELIVERY_LEAD",
  "PRODUCT_ENGINEER",
  "OPERATIONS_FINANCE",
  "GENERAL_OPERATOR",
] as const;

export type RolePresetKey = (typeof ROLE_PRESET_KEYS)[number];

type LocalizedText = {
  zh: string;
  en: string;
};

type LocalizedList = {
  zh: string[];
  en: string[];
};

export type RolePresetDefinition = {
  key: RolePresetKey;
  label: LocalizedText;
  summary: LocalizedText;
  mission: LocalizedText;
  ownedOutcomes: LocalizedList;
  mainJudgements: LocalizedList;
  handoffEdges: LocalizedList;
  successSignals: LocalizedList;
  boundaryNotes: LocalizedList;
  defaultWorkspaceProfileType: string;
  matchers: string[];
};

const rolePresets: Record<RolePresetKey, RolePresetDefinition> = {
  FOUNDER_CEO: {
    key: "FOUNDER_CEO",
    label: { zh: "创始人 / CEO", en: "Founder / CEO" },
    summary: {
      zh: "负责收拢经营主线、关键判断和跨角色优先级，不把系统变成松散的活动堆。",
      en: "Keeps the operating line, top decisions, and cross-role priority order coherent.",
    },
    mission: {
      zh: "把公司最重要的经营目标、关键判断和有限资源收成同一条推进主线。",
      en: "Keep the company around one operating line for goals, decisions, and scarce resources.",
    },
    ownedOutcomes: {
      zh: ["明确本阶段最重要的经营目标", "决定资源优先级和关键推进顺序", "把高风险对外表达维持在非承诺边界内"],
      en: ["Clarify the current operating goal", "Set resource priority and momentum order", "Keep external language inside non-commitment boundaries"],
    },
    mainJudgements: {
      zh: ["什么值得继续投入", "什么需要停止或延后", "哪些机会必须升级到明确复核"],
      en: ["What deserves more investment", "What should be stopped or delayed", "Which moves need explicit review"],
    },
    handoffEdges: {
      zh: ["向销售交代推进节奏与边界", "向交付交代承诺与前提", "向运营说明本周主链路"],
      en: ["Handoff tempo and boundary to sales", "Handoff promises and prerequisites to delivery", "Explain this week's main chain to operations"],
    },
    successSignals: {
      zh: ["团队知道本周最该推进什么", "高风险动作没有越权承诺", "经营主线没有被碎片任务冲散"],
      en: ["The team knows the top move this week", "High-risk moves do not become accidental commitments", "The operating line is not fragmented by random tasks"],
    },
    boundaryNotes: {
      zh: ["解释不等于承诺", "提案不等于成交", "主动推进不等于自动替人决策"],
      en: ["Explanation is not commitment", "Proposal is not a closed deal", "Proactivity does not mean automatic decision-making"],
    },
    defaultWorkspaceProfileType: "创始人 / COO",
    matchers: ["founder", "ceo", "coo", "创始", "总经理"],
  },
  SALES_LEAD: {
    key: "SALES_LEAD",
    label: { zh: "销售负责人", en: "Sales lead" },
    summary: {
      zh: "负责把机会推进顺序、跟进质量和复核边界保持一致。",
      en: "Keeps opportunity order, follow-up quality, and review boundaries aligned.",
    },
    mission: {
      zh: "把销售主线稳定推进到下一阶段，而不是只堆更多外联动作。",
      en: "Move the sales line to the next stage instead of piling on more outreach.",
    },
    ownedOutcomes: {
      zh: ["推进关键机会到下一阶段", "让跟进节奏和异议处理更稳定", "把需复核的对外动作留在可见边界内"],
      en: ["Advance key opportunities to the next stage", "Stabilize follow-up tempo and objection handling", "Keep review-required external moves visible"],
    },
    mainJudgements: {
      zh: ["哪条机会最该先推", "当前成交阻力主要来自哪里", "哪些动作需要先内部同步"],
      en: ["Which opportunity should move first", "Where the main closing friction comes from", "Which moves need internal sync first"],
    },
    handoffEdges: {
      zh: ["向创始人汇报关键判断和风险", "向交付说明客户预期与边界", "向 CS 说明续约或扩容线索"],
      en: ["Report key judgement and risk to leadership", "Explain customer expectation and boundary to delivery", "Hand renewal or expansion signals to CS"],
    },
    successSignals: {
      zh: ["主机会没有掉线", "跟进质量在提升", "复核边界没有被销售压力冲掉"],
      en: ["Lead opportunities do not go stale", "Follow-up quality improves", "Sales pressure does not erase review boundaries"],
    },
    boundaryNotes: {
      zh: ["草稿不等于已发送", "报价解释不等于最终承诺", "节奏推进不能越过审批边界"],
      en: ["Draft does not mean sent", "Pricing explanation is not final commitment", "Momentum cannot bypass approval boundaries"],
    },
    defaultWorkspaceProfileType: "销售负责人",
    matchers: ["sales lead", "head of sales", "销售负责人", "销售总监"],
  },
  ACCOUNT_EXECUTIVE: {
    key: "ACCOUNT_EXECUTIVE",
    label: { zh: "客户销售 / AE", en: "Account executive" },
    summary: {
      zh: "负责把单条机会从接触推进到明确下一步，并保持客户上下文连续。",
      en: "Moves individual opportunities forward while keeping customer context continuous.",
    },
    mission: {
      zh: "让关键客户机会持续升温，并把每次互动写回清晰的下一步。",
      en: "Keep key customer opportunities warming and turn each interaction into a clear next step.",
    },
    ownedOutcomes: {
      zh: ["完成高质量客户跟进", "收拢联系人、会议和机会线索", "把下一步动作挂回同一条机会链"],
      en: ["Complete strong customer follow-up", "Keep contacts, meetings, and opportunity signals coherent", "Attach the next move to the same opportunity chain"],
    },
    mainJudgements: {
      zh: ["现在该找谁", "这次互动之后的下一步是什么", "哪些承诺需要先确认前提"],
      en: ["Who to move with now", "What the next step is after this interaction", "Which promises need prerequisites first"],
    },
    handoffEdges: {
      zh: ["向销售负责人升级关键阻塞", "向交付说明客户语境", "向运营说明需要补的上下文"],
      en: ["Escalate major blockers to sales lead", "Explain customer context to delivery", "Tell operations what context is still missing"],
    },
    successSignals: {
      zh: ["没有重要客户被漏跟进", "对话后都能收成下一步", "客户节奏与内部动作保持同步"],
      en: ["No important customer slips through follow-up", "Each thread ends with a next step", "Customer tempo stays aligned with internal action"],
    },
    boundaryNotes: {
      zh: ["跟进建议不等于承诺", "解释方案不等于确认交付", "发送前仍应保留复核优先"],
      en: ["Follow-up advice is not commitment", "Explaining a plan is not confirming delivery", "Review-first still applies before send"],
    },
    defaultWorkspaceProfileType: "销售负责人",
    matchers: ["ae", "account executive", "客户销售", "销售经理"],
  },
  RECRUITER: {
    key: "RECRUITER",
    label: { zh: "招聘顾问", en: "Recruiter" },
    summary: {
      zh: "负责把候选人推进、面试协调和招聘判断收成一条连贯招聘主线。",
      en: "Keeps candidate progress, interview coordination, and hiring judgement coherent.",
    },
    mission: {
      zh: "让候选人和招聘团队的推进节奏连续，不让协调细节吞掉主判断。",
      en: "Keep candidate and hiring-team momentum continuous without losing the main hiring judgement.",
    },
    ownedOutcomes: {
      zh: ["推动候选人到下一个明确阶段", "协调面试和后续跟进", "收拢岗位、候选人和反馈回路"],
      en: ["Move candidates to the next clear stage", "Coordinate interviews and follow-up", "Keep role, candidate, and feedback loops coherent"],
    },
    mainJudgements: {
      zh: ["候选人是否真的在推进", "当前卡点在时间、反馈还是岗位匹配", "哪些沟通要先内部同步"],
      en: ["Whether the candidate is truly advancing", "Whether the blocker is timing, feedback, or fit", "Which comms need internal sync first"],
    },
    handoffEdges: {
      zh: ["向招聘负责人说明候选人节奏", "向创始人升级关键岗位判断", "向运营交代安排与提醒"],
      en: ["Explain candidate tempo to the hiring owner", "Escalate key hiring judgement to leadership", "Handoff scheduling and reminders to operations"],
    },
    successSignals: {
      zh: ["候选人没有失联", "反馈链没有断掉", "面试安排和岗位判断保持同向"],
      en: ["Candidates do not drop off", "The feedback chain stays intact", "Interview scheduling stays aligned with role judgement"],
    },
    boundaryNotes: {
      zh: ["面试安排不等于录用承诺", "候选人简报不等于正式录用通知", "高风险表述仍应保留复核"],
      en: ["Interview scheduling is not a hiring commitment", "Candidate explanation is not a formal offer", "High-risk language still needs review"],
    },
    defaultWorkspaceProfileType: "猎头顾问",
    matchers: ["recruiter", "talent", "招聘", "猎头", "hrbp"],
  },
  CUSTOMER_SUCCESS: {
    key: "CUSTOMER_SUCCESS",
    label: { zh: "客户成功", en: "Customer success" },
    summary: {
      zh: "负责把续约、扩容、风险跟进和问题升级收进同一条客户成功主线。",
      en: "Owns renewal, expansion, risk follow-through, and issue escalation as one CS line.",
    },
    mission: {
      zh: "让客户在交付后仍有连续推进感，而不是只在问题出现时被动响应。",
      en: "Keep post-sale customer momentum continuous instead of reacting only when issues appear.",
    },
    ownedOutcomes: {
      zh: ["推进续约与扩容线索", "处理客户风险和问题升级", "把后续跟进写回客户上下文"],
      en: ["Advance renewal and expansion signals", "Handle customer risk and issue escalation", "Write follow-through back into the customer context"],
    },
    mainJudgements: {
      zh: ["客户当前更像稳定、风险还是扩张窗口", "什么问题需要升级", "哪些承诺必须先闭环"],
      en: ["Whether the customer is stable, at risk, or ready to expand", "Which issues need escalation", "Which commitments must close first"],
    },
    handoffEdges: {
      zh: ["向销售交接扩容机会", "向交付交接风险与依赖", "向创始人升级流失风险"],
      en: ["Handoff expansion signals to sales", "Handoff risk and dependency to delivery", "Escalate churn risk to leadership"],
    },
    successSignals: {
      zh: ["客户问题被及时发现", "续约线索没有被忽略", "风险说明没有被写成承诺"],
      en: ["Customer issues are caught early", "Renewal signals are not ignored", "Risk explanations do not turn into commitments"],
    },
    boundaryNotes: {
      zh: ["客户支持不等于补偿承诺", "扩容建议不等于最终商业条件", "仍需保留非承诺备注"],
      en: ["Support is not compensation commitment", "Expansion advice is not final commercial commitment", "Non-commitment notes must stay explicit"],
    },
    defaultWorkspaceProfileType: "顾问 / 服务商",
    matchers: ["customer success", "csm", "客户成功", "am", "account manager"],
  },
  DELIVERY_LEAD: {
    key: "DELIVERY_LEAD",
    label: { zh: "交付负责人", en: "Delivery lead" },
    summary: {
      zh: "负责把客户预期、内部资源和交付边界读成一条可执行的交付主线。",
      en: "Turns customer expectation, internal capacity, and delivery boundaries into one executable line.",
    },
    mission: {
      zh: "让承诺、依赖和交付节奏保持同向，不让项目在内部失配里掉速。",
      en: "Keep promises, dependencies, and delivery tempo aligned so projects do not slow down internally.",
    },
    ownedOutcomes: {
      zh: ["明确交付下一步和负责人", "识别时间线 / 范围 / 资源风险", "把客户预期翻译成内部执行条件"],
      en: ["Clarify the next delivery step and owner", "Identify timeline, scope, and resourcing risk", "Translate customer expectation into internal execution conditions"],
    },
    mainJudgements: {
      zh: ["当前交付是否可兑现", "最大的交付阻塞在哪里", "哪些表达必须加前置和依赖"],
      en: ["Whether delivery is currently fulfillable", "Where the main delivery blocker is", "Which statements need prerequisite and dependency notes"],
    },
    handoffEdges: {
      zh: ["向销售说明交付前提", "向客户成功说明上线后跟进", "向创始人升级资源风险"],
      en: ["Explain delivery prerequisites to sales", "Explain post-launch follow-through to CS", "Escalate resourcing risk to leadership"],
    },
    successSignals: {
      zh: ["交付边界说得清楚", "时间与资源风险被前置", "客户听到的是边界清晰的话，而不是过度承诺"],
      en: ["Delivery boundaries are clear", "Timeline and resourcing risks are surfaced early", "Customers hear bounded language rather than overpromises"],
    },
    boundaryNotes: {
      zh: ["方案说明不等于实施承诺", "预计时间不等于最终上线日期", "高风险措辞必须带前置 / 依赖"],
      en: ["Solution explanation is not implementation commitment", "Estimated timing is not a final go-live date", "High-risk wording needs prerequisite and dependency notes"],
    },
    defaultWorkspaceProfileType: "顾问 / 服务商",
    matchers: ["delivery", "implementation", "consultant", "交付", "实施", "顾问", "服务商"],
  },
  PRODUCT_ENGINEER: {
    key: "PRODUCT_ENGINEER",
    label: { zh: "产品 / 设计 / 工程", en: "Product / design / engineering" },
    summary: {
      zh: "负责把需求、实现边界和交付时机收成稳定的产品推进回路。",
      en: "Keeps requirements, implementation boundaries, and release timing in one product loop.",
    },
    mission: {
      zh: "让产品问题和实现动作保持清晰因果，而不是被上下文噪音拖散。",
      en: "Keep product problems and implementation moves causally clear instead of fragmented by context noise.",
    },
    ownedOutcomes: {
      zh: ["定义下一步产品/实现动作", "收拢需求、约束和验收标准", "让交接和执行证据更清楚"],
      en: ["Define the next product or implementation move", "Condense requirement, constraint, and acceptance criteria", "Make handoff and execution evidence clearer"],
    },
    mainJudgements: {
      zh: ["当前最值得做的 slice 是什么", "哪些边界还不够清楚", "哪些风险需要先复核或验证"],
      en: ["What the highest-value slice is now", "Which boundaries are still unclear", "Which risks need review or validation first"],
    },
    handoffEdges: {
      zh: ["向创始人说明取舍", "向交付说明范围和前提", "向运营说明发布节奏"],
      en: ["Explain tradeoffs to leadership", "Explain scope and prerequisites to delivery", "Explain rollout tempo to operations"],
    },
    successSignals: {
      zh: ["切片足够小且可验证", "范围没有悄悄膨胀", "实现结果能回写到真实业务语境"],
      en: ["Slices stay small and verifiable", "Scope does not quietly expand", "Implementation can write back into real operating context"],
    },
    boundaryNotes: {
      zh: ["实现说明不等于商业承诺", "内部就绪度不等于对外可用", "仍需保留复核和发布守卫"],
      en: ["Implementation detail is not commercial commitment", "Internal readiness is not external readiness", "Review and rollout guards must remain"],
    },
    defaultWorkspaceProfileType: "顾问 / 服务商",
    matchers: ["product", "designer", "design", "engineer", "产品", "设计", "工程", "研发"],
  },
  OPERATIONS_FINANCE: {
    key: "OPERATIONS_FINANCE",
    label: { zh: "运营 / 财务 / 支持", en: "Operations / finance / support" },
    summary: {
      zh: "负责把内部流程、对账、支持与例外处理收成可见的运营控制面。",
      en: "Keeps internal process, reconciliation, support, and exceptions visible as an operator layer.",
    },
    mission: {
      zh: "让组织内的支持与治理工作保持连续，而不是变成大量隐性补洞。",
      en: "Keep internal support and governance continuous instead of becoming hidden patchwork.",
    },
    ownedOutcomes: {
      zh: ["维护运营节奏与组织可见性", "处理例外、对账与支持包", "把内部状态变化回写到团队可读界面"],
      en: ["Maintain operating tempo and organizational visibility", "Handle exceptions, reconciliation, and support packs", "Write internal state changes back to readable surfaces"],
    },
    mainJudgements: {
      zh: ["当前哪类例外最值得先清", "哪些状态会影响组织运行", "哪些问题必须升级给负责人 / 管理员"],
      en: ["Which exceptions should be cleared first", "Which states affect organization health", "Which issues must be escalated to owner or admin"],
    },
    handoffEdges: {
      zh: ["向负责人 / 管理员升级治理问题", "向业务角色交代支持状态", "向财务 / 结算线交接证据和例外"],
      en: ["Escalate governance issues to owner or admin", "Explain support status to business roles", "Handoff evidence and exceptions to finance or settlement"],
    },
    successSignals: {
      zh: ["组织状态更清楚", "例外被及时发现并收口", "支持动作没有越权改变高风险状态"],
      en: ["Organization state is clearer", "Exceptions are surfaced and closed quickly", "Support actions do not overstep into high-risk state changes"],
    },
    boundaryNotes: {
      zh: ["支持动作不等于越权执行", "内部对账不等于正式财务系统", "高风险状态变更仍需治理边界"],
      en: ["Support action is not unrestricted execution", "Internal reconciliation is not a finance platform", "High-risk state changes still need governance boundaries"],
    },
    defaultWorkspaceProfileType: "顾问 / 服务商",
    matchers: ["ops", "operations", "finance", "support", "运营", "财务", "支持"],
  },
  GENERAL_OPERATOR: {
    key: "GENERAL_OPERATOR",
    label: { zh: "通用运营成员", en: "General operator" },
    summary: {
      zh: "适用于还没收敛到更细角色时的通用执行与协同位。",
      en: "A general execution and coordination role when the team is not ready for a narrower preset.",
    },
    mission: {
      zh: "把当前工作区的主线判断、行动项和上下文衔接得更顺。",
      en: "Keep the workspace's judgement, actions, and context handoff flowing.",
    },
    ownedOutcomes: {
      zh: ["推进当前工作区的关键 下一步", "减少交接丢失和上下文重建", "把高价值事实沉淀成可复用记忆"],
      en: ["Advance the workspace's key next step", "Reduce handoff loss and context rebuilding", "Promote high-value facts into reusable memory"],
    },
    mainJudgements: {
      zh: ["现在最值得先推什么", "哪些线程在等待", "哪些信息还没收齐"],
      en: ["What should move first now", "Which threads are waiting", "Which information is still missing"],
    },
    handoffEdges: {
      zh: ["向负责人 / 管理员升级高风险判断", "向业务角色交代所需上下文", "向复核面补齐证据"],
      en: ["Escalate high-risk judgement to owner or admin", "Explain required context to business roles", "Complete evidence for review surfaces"],
    },
    successSignals: {
      zh: ["团队不再反复重建同样上下文", "关键动作没有掉线", "高风险边界仍清晰可见"],
      en: ["The team does not rebuild the same context repeatedly", "Key actions do not drop", "High-risk boundaries stay visible"],
    },
    boundaryNotes: {
      zh: ["主动协同不等于自动决策", "建议不等于正式承诺", "仍需保持复核优先"],
      en: ["Proactive coordination is not automatic decision-making", "Suggestion is not formal commitment", "Review-first still applies"],
    },
    defaultWorkspaceProfileType: "顾问 / 服务商",
    matchers: ["operator", "member", "运营成员", "通用", "assistant", "协调"],
  },
};

export function getRolePresetDefinition(key: RolePresetKey) {
  return rolePresets[key];
}

export function listRolePresetDefinitions() {
  return ROLE_PRESET_KEYS.map((key) => rolePresets[key]);
}

export function localizeRolePreset(
  preset: RolePresetDefinition,
  locale: UiLocale,
) {
  const english = locale === "en-US";
  return {
    key: preset.key,
    label: english ? preset.label.en : preset.label.zh,
    summary: english ? preset.summary.en : preset.summary.zh,
    mission: english ? preset.mission.en : preset.mission.zh,
    ownedOutcomes: english ? preset.ownedOutcomes.en : preset.ownedOutcomes.zh,
    mainJudgements: english ? preset.mainJudgements.en : preset.mainJudgements.zh,
    handoffEdges: english ? preset.handoffEdges.en : preset.handoffEdges.zh,
    successSignals: english ? preset.successSignals.en : preset.successSignals.zh,
    boundaryNotes: english ? preset.boundaryNotes.en : preset.boundaryNotes.zh,
    defaultWorkspaceProfileType: preset.defaultWorkspaceProfileType,
  };
}

export function listRolePresetOptions(locale: UiLocale) {
  return listRolePresetDefinitions().map((preset) => {
    const localized = localizeRolePreset(preset, locale);
    return {
      key: localized.key,
      label: localized.label,
      summary: localized.summary,
    };
  });
}

export function suggestRolePresetKeyFromText(...values: Array<string | null | undefined>): RolePresetKey {
  const text = values
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");

  for (const key of ROLE_PRESET_KEYS) {
    const preset = rolePresets[key];
    if (preset.matchers.some((matcher) => text.includes(matcher.toLowerCase()))) {
      return key;
    }
  }

  return "GENERAL_OPERATOR";
}
