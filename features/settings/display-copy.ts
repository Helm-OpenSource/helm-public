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

function normalizeProviderName(value: string) {
  return value.trim().toLowerCase();
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
  if (english) return key;

  return promptNameZh[key] ?? "说明模板";
}

export function formatSettingsPromptVersion(version: string, english: boolean) {
  if (english) return version;

  const match = version.match(/v(\d+)/i);
  return match ? `版本 ${match[1]}` : "当前版本";
}

export function formatSettingsPromptTaskType(
  taskType: string,
  english: boolean,
) {
  if (english) return taskType;

  return promptTaskTypeZh[taskType] ?? "经营说明";
}

export function formatSettingsPromptDescription(
  description: string,
  english: boolean,
) {
  if (english) return description;

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

export function formatSettingsSkillSuggestionText(
  text: string | null | undefined,
  english: boolean,
) {
  if (!text || english) return text ?? "";

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
