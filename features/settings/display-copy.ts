import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";

type ProviderSummaryLike = {
  provider: string;
  label: string;
};

const promptNameZh: Record<string, string> = {
  "meeting-memory-extraction": "会议记忆提取",
  "object-briefing": "对象简报整理",
  "recommendation-explanation": "建议说明",
  "bi-report-analysis": "经营报告分析",
  "bi-report-review": "经营报告复核",
};

const promptNameEn: Record<string, string> = {
  "meeting-memory-extraction": "Meeting memory extraction",
  "object-briefing": "Object briefing",
  "recommendation-explanation": "Recommendation explanation",
  "bi-report-analysis": "Business report analysis",
  "bi-report-review": "Business report review",
};

const promptTaskTypeZh: Record<string, string> = {
  MEETING_MEMORY_EXTRACTION: "会议记忆提取",
  CONTACT_BRIEFING: "联系人简报",
  COMPANY_BRIEFING: "公司简报",
  OPPORTUNITY_BRIEFING: "机会简报",
  MEETING_BRIEFING: "会议简报",
  RECOMMENDATION_EXPLANATION: "建议说明",
  BI_REPORT_ANALYSIS: "经营报告分析",
  BI_REPORT_REVIEW: "经营报告复核",
};

const promptTaskTypeEn: Record<string, string> = {
  MEETING_MEMORY_EXTRACTION: "Meeting memory extraction",
  CONTACT_BRIEFING: "Contact briefing",
  COMPANY_BRIEFING: "Company briefing",
  OPPORTUNITY_BRIEFING: "Opportunity briefing",
  MEETING_BRIEFING: "Meeting briefing",
  RECOMMENDATION_EXPLANATION: "Recommendation explanation",
  BI_REPORT_ANALYSIS: "Business report analysis",
  BI_REPORT_REVIEW: "Business report review",
};

function normalizeProviderName(value: string) {
  return value.trim().toLowerCase();
}

function humanizeKey(value: string) {
  const normalized = value
    .replace(/^prompt[-_.]?/i, "")
    .replace(/[-_]+v\d+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return normalized ? normalized[0].toUpperCase() + normalized.slice(1).toLowerCase() : value;
}

export function formatSettingsModelProviderName(
  provider: ProviderSummaryLike,
  english: boolean,
) {
  if (english) return provider.label;

  const normalized = normalizeProviderName(provider.provider || provider.label);
  if (normalized.includes("openai")) {
    return "主判断服务";
  }

  return provider.label && !/[A-Z]{2,}|openai|gpt/i.test(provider.label)
    ? provider.label
    : "判断服务";
}

export function formatSettingsModelProviderDetail(
  provider: string,
  english: boolean,
) {
  if (english) return provider;

  return provider ? "已登记服务" : "未登记服务";
}

export function formatSettingsCurrentModelProvider(
  provider: string,
  enabled: boolean,
  english: boolean,
) {
  if (english) return provider;

  if (!provider) return "未指定判断服务";
  return enabled ? "判断服务已启用" : "判断服务未启用";
}

export function formatSettingsModelSelection(
  value: string | null | undefined,
  english: boolean,
) {
  if (english) return value || "Not configured";

  return value ? "已指定" : "未指定";
}

export function formatSettingsPromptName(key: string, english: boolean) {
  if (english) return promptNameEn[key] ?? humanizeKey(key);

  return promptNameZh[key] ?? "说明模板";
}

export function formatSettingsPromptVersion(version: string, english: boolean) {
  const match = version.match(/v(\d+)/i);
  if (english) return match ? `Version ${match[1]}` : "Current version";

  return match ? `版本 ${match[1]}` : "当前版本";
}

export function formatSettingsPromptTaskType(
  taskType: string,
  english: boolean,
) {
  if (english) return promptTaskTypeEn[taskType] ?? humanizeKey(taskType);

  return promptTaskTypeZh[taskType] ?? "经营说明";
}

export function formatSettingsPromptDescription(
  description: string,
  english: boolean,
) {
  if (english) {
    return description
      .replace(/增强 recommendation explanation，但不改变排序和策略边界。/g, "Enhance recommendation explanation without changing ranking or review rules.")
      .replace(/把会议纪要提取成结构化记忆对象。/g, "Extract meeting notes into reusable memory objects.")
      .replace(/结构化记忆对象/g, "reusable memory objects")
      .replace(/结构化/g, "structured")
      .replace(/策略边界/g, "review rules")
      .replace(/经营报告/g, "business report")
      .replace(/建议说明/g, "recommendation explanation")
      .replace(/简报/g, "briefing")
      .replace(/复核/g, "review")
      .replace(/建议/g, "recommendation")
      .replace(/说明/g, "explanation")
      .replace(/判断/g, "judgement")
      .replace(/会议信息/g, "meeting information")
      .replace(/会议纪要/g, "meeting notes")
      .replace(/对象/g, "object")
      .replace(/联系人/g, "contact")
      .replace(/公司/g, "company")
      .replace(/机会/g, "opportunity")
      .replace(/会议/g, "meeting");
  }

  const formatted = description
    .replace(/把会议纪要提取成结构化记忆对象。/g, "把会议纪要整理成可复用的事实、承诺和阻塞。")
    .replace(/结构化记忆对象/g, "可复用会议信息")
    .replace(/结构化/g, "可复用")
    .replace(/策略边界/g, "复核规则")
    .replace(/briefing/gi, "简报")
    .replace(/recommendation explanation/gi, "建议说明")
    .replace(/recommendation/gi, "建议")
    .replace(/deterministic BI report result/gi, "已计算报告结果")
    .replace(/BI report explanation/gi, "经营报告说明")
    .replace(/BI report/gi, "经营报告")
    .replace(/deterministic judgement/gi, "既定判断");

  return formatSeededBusinessCopy(formatted, english);
}

export function formatSettingsCapabilityCategory(
  category: string,
  english: boolean,
) {
  if (english) return category;

  const normalized = category.trim().toLowerCase();
  if (normalized === "execution") return "执行辅助";
  if (normalized === "analysis") return "分析辅助";
  if (normalized === "governance") return "治理辅助";
  return category;
}

const skillSuggestionCapabilityNameEn: Record<string, string> = {
  外部承诺复核缓冲包: "External commitment review buffer",
  简洁外发语气包: "Concise outbound tone pack",
  会后跟进窗口包: "Post-meeting follow-up window pack",
  预算阻塞澄清包: "Budget blocker clarification pack",
  预算阻碍澄清包: "Budget blocker clarification pack",
  停滞机会恢复包: "Stalled opportunity recovery pack",
  关系回温包: "Relationship re-warm pack",
};

function translateSkillSuggestionCapabilityNames(text: string) {
  let formatted = text;
  for (const [zh, en] of Object.entries(skillSuggestionCapabilityNameEn)) {
    formatted = formatted.replace(new RegExp(zh, "g"), en);
  }
  return formatted;
}

function formatSettingsSkillSuggestionEnglishText(text: string) {
  const formatted = translateSkillSuggestionCapabilityNames(text)
    .replace(/建议把“([^”]+)”收成候选能力/g, 'Suggest turning "$1" into a candidate capability')
    .replace(/“([^”]+)”已通过正式复核，当前只进入待晋升批准状态，仍需人工补静态能力目录、测试、守卫和文档。/g, '"$1" passed formal review and is only pending promotion approval; a human still needs to add the static capability catalog entry, tests, guards and docs.')
    .replace(/“([^”]+)”已被正式复核暂缓，当前保留在人工治理层，等待复核人重新入队或补充说明。/g, '"$1" was deferred in formal review and remains under human governance until a reviewer requeues it or adds prerequisite context.')
    .replace(/“([^”]+)”已被正式复核拒绝，当前不会进入正式能力晋升，需要后续重新判断是否值得再入队。/g, '"$1" was rejected in formal review and will not be promoted unless it is reassessed later.')
    .replace(/“([^”]+)”已进入正式复核队列，下一步仍是人工决定是否补能力目录、测试、守卫和文档。/g, '"$1" entered the formal review queue; the next step is still a human decision about catalog, tests, guards and docs.')
    .replace(/“([^”]+)”已从正式复核返回加固，会继续记录边界事件并在证据更稳后重新进入队列。/g, '"$1" was returned from formal review for hardening; boundary events will keep being recorded before it can re-enter the queue.')
    .replace(/“([^”]+)”已达到 formal review ready，可以进入人工正式复核队列，但仍不是正式能力。/g, '"$1" reached formal review ready and can enter the human formal review queue, but it is still not a formal capability.')
    .replace(/“([^”]+)”当前仍在候选能力校准期，暂未进入正式复核队列。/g, '"$1" is still calibrating as a candidate capability and has not entered formal review.')
    .replace(/已把“([^”]+)”提升为观察期能力，会继续积累证据但仍不进入正式能力目录或执行路由。/g, 'Promoted "$1" to probationary capability; it will keep accumulating evidence but still does not enter the formal capability catalog or execution routing.')
    .replace(/已把“([^”]+)”收口为复核优先的候选能力，会继续积累证据但不会自动变成正式能力。/g, 'Captured "$1" as a review-first candidate capability; it will keep accumulating evidence but will not automatically become a formal capability.')
    .replace(/当前校准分 (\d+)，复现 (\d+) 次，边界事件 (\d+) 次。/g, "Current calibration score $1, reproduced $2 time(s), boundary events $3.")
    .replace(/当前校准信号：采纳 (\d+)、驳回 (\d+)、边界事件 (\d+)。/g, "Current calibration signal: accepted $1, dismissed $2, boundary events $3.")
    .replace(/当前已达到 formal review ready 状态，但仍需要人工写入静态能力目录、测试和文档。/g, "It has reached formal review ready, but a human still needs to add the static capability catalog entry, tests and docs.")
    .replace(/当前已达到 formal review ready 判断阈值。/g, "It has reached the formal review ready threshold.")
    .replace(/当前仍未达到正式复核就绪阈值。/g, "It has not reached the formal review readiness threshold.")
    .replace(/这条能力已经进入观察期能力层，会继续积累证据和复核备注。/g, "This capability has entered the probationary layer and will keep accumulating evidence and review notes.")
    .replace(/这条能力目前仍停留在候选能力层，只作为复核优先的候选能力观察。/g, "This capability remains in the candidate layer and is only observed as a review-first candidate capability.")
    .replace(/它已经通过正式复核，但仍只是待晋升批准状态，必须人工补静态能力目录、测试、守卫和文档后才可能成为正式能力。/g, "It passed formal review but is still only pending promotion approval; it can become formal only after a human adds the static catalog entry, tests, guards and docs.")
    .replace(/它已被正式复核暂缓，当前仍停留在人工治理层，等待复核人重新入队或补充前置材料。/g, "It was deferred in formal review and remains under human governance until a reviewer requeues it or adds prerequisites.")
    .replace(/它已被正式复核拒绝，当前不会自动进入正式晋升，也不会因此获得任何执行权限。/g, "It was rejected in formal review; it will not be promoted automatically and gains no execution authority.")
    .replace(/它已经进入正式复核队列，但仍然只是人工评审项，不代表已经成为正式系统能力。/g, "It has entered the formal review queue, but it is still a human review item and not a formal system capability.")
    .replace(/它曾被正式复核退回加固，会继续在候选\/观察层积累证据与边界说明。/g, "It was returned from formal review for hardening and will keep accumulating evidence and boundary notes in the candidate or probationary layer.")
    .replace(/它已达到正式复核就绪状态，但仍需要人工补静态能力目录、测试、守卫和文档后才能成为正式系统能力。/g, "It is formal-review ready, but a human still needs to add the static capability catalog entry, tests, guards and docs before it can become a formal system capability.")
    .replace(/它还没有进入正式复核队列，也不会自动获得路由、发送、承诺或正式写入权限。/g, "It has not entered the formal review queue and does not automatically gain routing, send, commitment, or formal write authority.")
    .replace(/这只是一条复核优先 的候选能力，用来帮助人更稳地复核外部承诺类草稿，不代表 Helm 获得自动对外发送或自动承诺权限。/g, "This is a review-first candidate capability for safer human review of external-commitment drafts. It does not grant Helm automatic external-send or automatic-commitment authority.")
    .replace(/这只是一条仅草稿的候选能力，用来偏向更简洁的外发草稿，不代表 Helm 可以绕过复核或直接替人发出外部消息。/g, "This is a draft-only candidate capability for more concise outbound drafts. It does not let Helm bypass review or send external messages for people.")
    .replace(/这只是一条复核优先 的候选能力，用来把会后 24 小时窗口内更有效的推进姿态沉淀出来，不代表 Helm 自动生成外部承诺或替人决定下一步。/g, "This is a review-first candidate capability for post-meeting follow-up within the 24-hour window. It does not let Helm create external commitments or decide the next step for people.")
    .replace(/这只是一条仅草稿的候选能力，用来把预算阻塞澄清、补材料和下一步建议写成可复核草稿，不代表 Helm 获得报价承诺或付款承诺权限。/g, "This is a draft-only candidate capability for budget-blocker clarification, supplemental material and reviewed next-step drafts. It does not grant quoting or payment-commitment authority.")
    .replace(/这只是一条复核优先 的候选能力，用来恢复停滞机会的内部推进，不代表 Helm 可以自动改阶段、自动承诺对外结果或自动写回高风险状态。/g, "This is a review-first candidate capability for internal stalled-opportunity recovery. It does not let Helm auto-change stages, commit external outcomes, or write high-risk states.")
    .replace(/这只是一条仅草稿的候选能力，用来帮助关系回温和低阻力恢复触达，不代表 Helm 获得对外发送权限或替人决定承诺内容。/g, "This is a draft-only candidate capability for relationship re-warm and low-friction outreach. It does not grant external-send authority or decide commitment content for people.")
    .replace(/类别 ([a-z_]+)，默认面为 ([a-z_]+)。/g, "Category $1, default surface $2.")
    .replace(/校准分 (\d+)，证据 (\d+)，持续复现 (\d+)。/g, "Calibration score $1, evidence $2, repeated signal $3.")
    .replace(/\bADVANCING\b/g, "Advancing")
    .replace(/\bINTERNAL_SYNC\b/g, "Internal sync")
    .replace(/\bWAITING_THEM\b/g, "Waiting on them")
    .replace(/\bNEEDS_REVIEW\b/g, "Needs review")
    .replace(/\bAUTO_WITHIN_THRESHOLD\b/g, "Auto within threshold")
    .replace(/\bREQUIRES_APPROVAL\b/g, "Requires approval")
    .replace(/\bSUGGEST_ONLY\b/g, "Suggest only")
    .replace(/\bFORBIDDEN\b/g, "Forbidden")
    .replace(/\bwithin_48h_preferred\b/g, "within 48 hours preferred")
    .replace(/\bmeeting_followup\b/g, "meeting follow-up")
    .replace(/\bcontact_followup\b/g, "contact follow-up")
    .replace(/预算阻碍/g, "budget blocker")
    .replace(/预算阻塞/g, "budget blocker")
    .replace(/阻碍/g, "blocker")
    .replace(/阻塞/g, "blocker")
    .replace(/draft-only/gi, "draft-only")
    .replace(/review-first/gi, "review-first")
    .replace(/review-before-send/gi, "review before send")
    .replace(/approved-pending-promotion/gi, "approved pending promotion")
    .replace(/probationary capability/gi, "probationary capability")
    .replace(/candidate capability/gi, "candidate capability")
    .replace(/candidate-only/gi, "candidate-only")
    .replace(/formal review ready/gi, "formal review ready")
    .replace(/formal review/gi, "formal review")
    .replace(/formal skill/gi, "formal capability")
    .replace(/skill catalog/gi, "capability catalog");

  return formatSeededBusinessCopy(formatted, true);
}

export function formatSettingsSkillSuggestionText(
  text: string | null | undefined,
  english: boolean,
) {
  if (!text) return "";
  if (english) return formatSettingsSkillSuggestionEnglishText(text);

  const formatted = text
    .replace(/\bADVANCING\b/g, "推进中")
    .replace(/\bINTERNAL_SYNC\b/g, "需内部协同")
    .replace(/\bWAITING_THEM\b/g, "等待对方")
    .replace(/\bNEEDS_REVIEW\b/g, "需要复核")
    .replace(/\bAUTO_WITHIN_THRESHOLD\b/g, "低风险可自动")
    .replace(/\bREQUIRES_APPROVAL\b/g, "需逐条审批")
    .replace(/\bSUGGEST_ONLY\b/g, "只给建议")
    .replace(/\bFORBIDDEN\b/g, "禁止执行")
    .replace(/\bwithin_48h_preferred\b/g, "48 小时内优先跟进")
    .replace(/\bmeeting_followup\b/g, "会后跟进")
    .replace(/\bcontact_followup\b/g, "关系跟进")
    .replace(/预算阻碍/g, "预算阻塞")
    .replace(/阻碍/g, "阻塞")
    .replace(/draft-only/gi, "仅草稿")
    .replace(/review-first/gi, "先复核")
    .replace(/review-before-send/gi, "发送前复核")
    .replace(/自动发送外部消息/g, "获得对外发送权限")
    .replace(/approved-pending-promotion/gi, "已通过但待晋级")
    .replace(/probationary capability/gi, "试运行做法")
    .replace(/candidate capability/gi, "可复用做法")
    .replace(/candidate-only/gi, "仅候选")
    .replace(/formal review ready/gi, "达到人工确认条件")
    .replace(/formal review/gi, "人工确认")
    .replace(/formal skill/gi, "正式做法")
    .replace(/skill catalog/gi, "能力目录")
    .replace(/\bcatalog\b/gi, "目录")
    .replace(/\btests\b/gi, "测试")
    .replace(/\bguards\b/gi, "守卫")
    .replace(/\bdocs\b/gi, "文档")
    .replace(/boundary incident/gi, "边界事件")
    .replace(/\bboundary\b/gi, "边界")
    .replace(/\bexecution routing\b/gi, "执行路由")
    .replace(/\bexecution\b/gi, "执行")
    .replace(/\breview\b/gi, "复核");

  return formatSeededBusinessCopy(formatted, english);
}

export function formatSettingsBoundaryNote(text: string, english: boolean) {
  if (english) return text;

  const formatted = text
    .replace(
      /Support pack is tenant-scoped to the active workspace only\./gi,
      "支持包只限定在当前工作区。",
    )
    .replace(
      /This export is audit-oriented and does not expand execution authority\./gi,
      "这次导出只用于审计查看，不扩大执行权限。",
    )
    .replace(
      /Retention, export, delete, and session posture remain review-first governance controls\./gi,
      "保留期、导出、删除和会话状态都继续保持先复核的治理控制。",
    )
    .replace(
      /Auth-session anomaly readout is operator-facing review truth, not an enterprise IAM or security platform\./gi,
      "认证会话异常只作为运营复核读数，不是企业级身份安全平台。",
    )
    .replace(
      /Entry-source truth stays on the auth session record; action-source truth for rotate\/revoke audits is tracked separately for operator review\./gi,
      "入口来源真实状态保留在认证会话记录上；轮换和撤销的动作来源真实状态会单独记录为运营复核审计信息。",
    )
    .replace(
      /Workspace-switch marker gaps are session-governance anomalies, not implicit proof of tenant isolation failure\./gi,
      "工作区切换标记缺口是会话治理异常，不等同于租户隔离失败的证据。",
    )
    .replace(
      /Webhook duplicate chains and mapped callback exceptions are tenant-scoped follow-through signals; hinted unresolved callbacks remain external boundary signals, not workspace audit truth\./gi,
      "支付回调重复链路和已映射回调异常只是租户范围内的后续治理信号；仍未解析的提示继续停在外部边界，不进入工作区审计事实。",
    )
    .replace(
      /Membership, workspace governance, auth-session, and support-pack follow-through remain tenant-scoped audit truth, not a broader tenant-admin platform\./gi,
      "成员、工作区治理、认证会话和支持包后续治理仍是租户范围内的审计事实，不是更宽的租户管理平台。",
    )
    .replace(
      /Workspace record writes and internal customer-success actions remain tenant-scoped governance signals, not execution-authority expansion\./gi,
      "工作区记录写入和内部客户成功动作仍是租户范围内的治理信号，不扩大执行权限。",
    )
    .replace(
      /Governed action generation, approval review, official follow-through, and action execution remain tenant-scoped audit signals under review-first controls; they do not expand execution authority\./gi,
      "受控动作生成、审批复核、正式跟进和动作执行仍是先复核控制下的租户审计信号，不扩大执行权限。",
    )
    .replace(
      /Connector and import ingress remain tenant-scoped and review-first; they do not imply workflow or execution authority\./gi,
      "连接器和导入入口仍限定在租户范围并保持先复核，不代表流程控制或执行权限。",
    )
    .replace(
      /Sensitive write routes are expected to assert workspace ownership before execution; provider webhooks remain external callback exceptions\./gi,
      "敏感写入路径应先确认工作区归属再执行；支付渠道回调仍属于外部回调例外。",
    )
    .replace(
      /Identity-match records remain tenant-scoped import follow-through truth and do not broaden execution or tenant-admin authority\./gi,
      "身份匹配记录仍只是租户范围内的导入跟进读数，不扩大执行权限或租户管理权限。",
    )
    .replace(
      /Billing, registry, participant-portal, program-governance, and settlement follow-through remain tenant-scoped governance readouts, not a finance or marketplace platform\./gi,
      "计费、登记、贡献方门户、合作计划治理和结算跟进仍是租户范围内的治理读数，不是财务或公开市场平台。",
    )
    .replace(/finance or marketplace platform/gi, "财务或公开市场平台")
    .replace(/marketplace platform/gi, "公开市场平台")
    .replace(/execution authority/gi, "执行权限")
    .replace(/tenant-scoped/gi, "租户范围")
    .replace(/tenant-admin authority/gi, "租户管理权限")
    .replace(/review-first/gi, "先复核")
    .replace(/follow-through/gi, "后续治理")
    .replace(/\bproof\b/gi, "证据")
    .replace(/marketplace/gi, "公开市场")
    .replace(/finance/gi, "财务")
    .replace(/\bworkflow\b/gi, "流程")
    .replace(/\bposture\b/gi, "状态")
    .replace(/\breview\b/gi, "复核");

  return formatted;
}

export function formatSettingsConnectorRuntimeText(
  text: string | null | undefined,
  english: boolean,
) {
  if (!text) return "";
  if (english) return text;

  return text
    .replace(
      /Helm v2 ingested ([^.。]+) into the meeting-to-action runtime\./gi,
      "会议推进链路已接入：$1。",
    )
    .replace(/persisted payloads/gi, "已保存采集资料")
    .replace(/persisted payload/gi, "已保存采集资料")
    .replace(/payloads/gi, "资料")
    .replace(/payload/gi, "资料")
    .replace(/current repo truth/gi, "当前仓库真实状态")
    .replace(/repo truth/gi, "仓库真实状态")
    .replace(/workspace-scoped/gi, "工作区范围")
    .replace(/provider contract/gi, "来源契约")
    .replace(/read-side/gi, "读取侧")
    .replace(/registry-backed ingest slice/gi, "注册表支撑的采集切片")
    .replace(/runtime ingest seam/gi, "运行采集接缝")
    .replace(/calendar runtime/gi, "日历运行链路")
    .replace(/meetings runtime/gi, "会议运行链路")
    .replace(/\bMANUAL_CAPTURE\b/g, "人工记录")
    .replace(/\bHUMAN INPUT\b/g, "人工录入")
    .replace(/\bHUMAN\b/g, "人工")
    .replace(/\bINPUT\b/g, "录入")
    .replace(/\bPROOF\b/g, "证据")
    .replace(/\bCONNECTED\b/g, "已连接")
    .replace(/\bDISCONNECTED\b/g, "未连接")
    .replace(/\bERROR\b/g, "异常")
    .replace(/\bMOCK\b/g, "演示连接")
    .replace(/\bCOLLABORATION\b/g, "协作")
    .replace(/Review captured evidence before use/gi, "使用前先复核采集依据")
    .replace(/runtime/gi, "运行链路")
    .replace(/scope/gi, "范围")
    .replace(/unresolved/gi, "未解析")
    .replace(/failed/gi, "失败")
    .replace(/review-first/gi, "先复核")
    .replace(/follow-through/gi, "后续推进")
    .replace(/permission/gi, "权限")
    .replace(/contract/gi, "契约")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function formatSettingsConnectorStatus(
  status: string | null | undefined,
  english: boolean,
) {
  if (!status) return english ? "Not connected" : "未连接";
  if (english) return status;
  return formatSettingsConnectorRuntimeText(status, english);
}

export function formatSettingsConnectorAuthMode(
  authMode: string | null | undefined,
  english: boolean,
) {
  if (!authMode) return english ? "Not recorded" : "未记录";
  if (english) return authMode;
  return formatSettingsConnectorRuntimeText(authMode, english);
}

export function formatSettingsCommercialText(
  text: string | null | undefined,
  english: boolean,
) {
  if (!text) return "";
  if (english) return text;

  const formatted = text
    .replace(/内部纪要可自动发送/g, "内部纪要按规则发送")
    .replace(/内部纪要自动发送/g, "内部纪要按规则发送")
    .replace(/自动发送路径/g, "无人确认的发送路径")
    .replace(/Helm first-party worker publisher/gi, "Helm 内部能力发布方")
    .replace(
      /Internal first-party publisher profile for add-on worker revenue attribution\./gi,
      "内部贡献方资料，用于扩展能力结算归因。",
    )
    .replace(
      /First-party add-on worker monthly split/gi,
      "内部扩展能力月度分成",
    )
    .replace(
      /First-party add-on worker per-use split/gi,
      "内部扩展能力按次分成",
    )
    .replace(
      /Default recurring attribution for additional active seats\./gi,
      "默认席位持续归因。",
    )
    .replace(
      /Default recurring attribution for future monthly worker add-ons\./gi,
      "默认月度扩展能力持续归因。",
    )
    .replace(
      /Default one-time attribution for future per-use worker add-ons\./gi,
      "默认按次扩展能力一次性归因。",
    )
    .replace(/deal_desk_worker/gi, "交易支持能力")
    .replace(/Worker Studio/gi, "能力工作室")
    .replace(/Bank transfer \(manual\)/gi, "银行转账（人工）")
    .replace(/helm_first_party/gi, "已登记")
    .replace(
      /Seeded sales referral proof line for manual settlement readiness\./gi,
      "已放入销售转介绍结算演示线，用于验证人工结算准备度。",
    )
    .replace(
      /Seeded custom implementation proof line for manual settlement readiness\./gi,
      "已放入定制实施结算演示线，用于验证人工结算准备度。",
    )
    .replace(
      /Seeded sales referral split for settlement proof pack\./gi,
      "已放入销售转介绍分成演示规则。",
    )
    .replace(
      /Seeded custom implementation split for settlement proof pack\./gi,
      "已放入定制实施分成演示规则。",
    )
    .replace(
      /Seeded active payout profile for worker beneficiary readiness\./gi,
      "已放入能力贡献方结算资料演示记录。",
    )
    .replace(
      /Seeded active payout profile for sales referral readiness\./gi,
      "已放入销售转介绍结算资料演示记录。",
    )
    .replace(
      /Seeded active payout profile for custom engagement readiness\./gi,
      "已放入定制合作结算资料演示记录。",
    )
    .replace(
      /Seeded invited worker participant access for settlement proof readiness\./gi,
      "已放入能力贡献方门户邀请演示记录。",
    )
    .replace(
      /Seeded invited sales referral participant access for settlement proof readiness\./gi,
      "已放入销售转介绍门户邀请演示记录。",
    )
    .replace(
      /Seeded invited custom-services participant access for settlement proof readiness\./gi,
      "已放入定制服务门户邀请演示记录。",
    )
    .replace(
      /Seeded proof batch with exported \/ paid \/ reversed evidence\./gi,
      "已放入带导出、已支付和已冲回依据的演示批次。",
    )
    .replace(/custom implementation proof batch/gi, "定制实施证明批次")
    .replace(/sales referral proof batch/gi, "销售转介绍证明批次")
    .replace(/worker proof batch/gi, "能力贡献证明批次")
    .replace(/proof batch/gi, "证明批次")
    .replace(
      /Seeded paid evidence for settlement readiness\./gi,
      "已放入已支付演示依据，用于验证结算准备度。",
    )
    .replace(
      /Seeded reversal evidence for readiness gate\./gi,
      "已放入冲回演示依据，用于验证结算准备度。",
    )
    .replace(/worker publisher program terms v1/gi, "能力贡献者计划条款 v1")
    .replace(/sales referral program terms v1/gi, "销售转介绍计划条款 v1")
    .replace(/custom partner program terms v1/gi, "定制交付伙伴计划条款 v1")
    .replace(/worker publisher program/gi, "能力贡献者计划")
    .replace(/sales referral program/gi, "销售转介绍计划")
    .replace(/custom partner program/gi, "定制交付伙伴计划")
    .replace(/terms v1/gi, "条款 v1")
    .replace(/custom integration/gi, "定制集成")
    .replace(/custom implementation/gi, "定制实施")
    .replace(/custom maintenance/gi, "定制维护")
    .replace(/sales referral/gi, "销售转介绍")
    .replace(/specialist contribution/gi, "专业能力贡献")
    .replace(/specialist review/gi, "专业复核")
    .replace(/worker 能力/gi, "工作流能力")
    .replace(/worker contributions/gi, "能力贡献")
    .replace(/worker contribution/gi, "能力贡献")
    .replace(/worker marketplace/gi, "能力市场")
    .replace(/worker add-on/gi, "扩展能力")
    .replace(/add-on worker/gi, "扩展能力")
    .replace(/\bworker\b/gi, "能力贡献")
    .replace(/first-party/gi, "内部一方")
    .replace(/publisher profile/gi, "发布方资料")
    .replace(/\bpublisher\b/gi, "发布方")
    .replace(/revenue attribution/gi, "结算归因")
    .replace(/manual settlement readiness/gi, "人工结算准备度")
    .replace(/manual settlement/gi, "人工结算")
    .replace(/off-platform/gi, "线下")
    .replace(/payable-later/gi, "待结算")
    .replace(/referral marketplace/gi, "转介绍市场")
    .replace(/public marketplace/gi, "公开市场")
    .replace(/marketplace/gi, "市场")
    .replace(/finance console/gi, "财务控制台")
    .replace(/finance-console/gi, "财务控制台")
    .replace(/public discovery/gi, "公开发现")
    .replace(/reversal/gi, "冲回")
    .replace(/RevenueRule/g, "收益规则")
    .replace(/invite/gi, "邀请")
    .replace(/review/gi, "审核")
    .replace(/readiness/gi, "准备度")
    .replace(/payout/gi, "打款")
    .replace(/participant/gi, "贡献方")
    .replace(/beneficiary/gi, "受益方")
    .replace(/\bscope\b/gi, "范围")
    .replace(/\bactive\b/gi, "生效");

  return formatSeededBusinessCopy(formatted, english).trim();
}
