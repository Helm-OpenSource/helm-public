const crmImportChineseReplacements: Array<[RegExp, string]> = [
  [/\bNEEDS_REVIEW\b/g, "待复核"],
  [/\bRESOLVED_LINKED\b/g, "已关联解决"],
  [/\bRESOLVED_CREATED\b/g, "已创建解决"],
  [/\bAUTO_LINKED\b/g, "已自动关联"],
  [/\bCREATE_NEW\b/g, "创建新对象"],
  [/\bEXACT\b/g, "精确匹配"],
  [/\bIGNORED\b/g, "已忽略"],
  [/\bCOMPLETED_WITH_WARNINGS\b/g, "已完成，有警告"],
  [/\bCOMPLETED\b/g, "已完成"],
  [/\bCREATED\b/g, "已创建"],
  [/\bUPDATED\b/g, "已更新"],
  [/\bFAILED\b/g, "失败"],
  [/\bNONE\b/g, "无"],
  [/\bPROCESSING\b/g, "处理中"],
  [/\bRUNNING\b/g, "处理中"],
  [/\bPENDING\b/g, "待处理"],
  [/\bCONNECTED_APP\b/g, "正式应用连接"],
  [/\bCONNECTED\b/g, "已连接"],
  [/\bDISCONNECTED\b/g, "未连接"],
  [/\bERROR\b/g, "异常"],
  [/\bMOCK\b/g, "演示连接"],
  [/\bINITIAL_IMPORT\b/g, "首次导入"],
  [/\bINCREMENTAL_SYNC\b/g, "增量同步"],
  [/connect\s*->\s*preview\s*->\s*import\s*->\s*warmup/gi, "连接 → 预览 → 导入 → 预热"],
  [/\bCRM-first\b/gi, "客户关系系统优先"],
  [/\bCRM\s+ingress\b/gi, "客户关系系统入口"],
  [/\bCRM\s+import\b/gi, "客户关系系统导入"],
  [/\bCRM\s+warmup\b/gi, "客户关系系统预热"],
  [/\bCRM\b/g, "客户关系系统"],
  [/meeting\/note/gi, "会议/笔记"],
  [/\breview-first\b/gi, "先复核"],
  [/\brecommendation-first\b/gi, "建议优先"],
  [/\bingress-first\b/gi, "入口优先"],
  [/\bconnector admin plane\b/gi, "连接器管理面"],
  [/\bexecution surface\b/gi, "执行面"],
  [/\boperator trust\b/gi, "操作信任"],
  [/\bmanual review\b/gi, "人工复核"],
  [/\bread-only ingress\b/gi, "只读入口"],
  [/\bread-only\b/gi, "只读"],
  [/\bingress\b/gi, "入口"],
  [/\bpreview\b/gi, "预览"],
  [/\bwarmup\b/gi, "预热"],
  [/\btoday focus\b/gi, "今日焦点"],
  [/\breadiness\b/gi, "就绪度"],
  [/\bwriteback\b/gi, "回写"],
  [/\brerun\b/gi, "重跑"],
  [/\bconflicts\b/gi, "冲突"],
  [/\bconflict\b/gi, "冲突"],
  [/\brecommendations\b/gi, "判断建议"],
  [/\brecommendation\b/gi, "判断建议"],
  [/\bblockers\b/gi, "阻塞"],
  [/\bblocker\b/gi, "阻塞"],
  [/\bcommitments\b/gi, "承诺"],
  [/\bcommitment\b/gi, "承诺"],
  [/\bmemory\b/gi, "记忆"],
  [/\boperators\b/gi, "操作人"],
  [/\boperator\b/gi, "操作人"],
  [/\bconnector\b/gi, "连接器"],
  [/\bworkflow\b/gi, "工作回路"],
  [/\breview\b/gi, "复核"],
];

const crmImportEnglishReplacements: Array<[RegExp, string]> = [
  [/辅助层继续保持建议优先，不会自动执行连接器流程。/g, "Assist stays recommendation-first and never auto-runs a connector flow."],
  [/辅助层可以突出下一步连接器动作，但每次入站写入仍由操作人最后确认。/g, "Form assist can highlight the next connector action, but final operator review still controls every ingress write."],
  [/连接\s*→\s*预览\s*→\s*导入\s*→\s*预热/g, "connect -> preview -> import -> warmup"],
  [/已完成，有警告/g, "completed with warnings"],
  [/已关联解决/g, "resolved linked"],
  [/已创建解决/g, "resolved created"],
  [/已自动关联/g, "auto linked"],
  [/创建新对象/g, "create new object"],
  [/正式应用连接/g, "connected app"],
  [/演示连接/g, "mock connection"],
  [/首次导入/g, "initial import"],
  [/增量同步/g, "incremental sync"],
  [/客户关系系统优先/g, "CRM-first"],
  [/客户关系系统入口/g, "CRM ingress"],
  [/客户关系系统导入/g, "CRM import"],
  [/客户关系系统预热/g, "CRM warmup"],
  [/客户关系系统/g, "CRM"],
  [/会议\/笔记/g, "meeting/note"],
  [/必须显式复核/g, " require explicit review"],
  [/对操作人可见/g, " visible to the operator"],
  [/每次入站写入/g, "every ingress write"],
  [/最后确认/g, "final confirmation"],
  [/下一步连接器动作/g, "next connector action"],
  [/先复核/g, "review-first"],
  [/建议优先/g, "recommendation-first"],
  [/入口优先/g, "ingress-first"],
  [/连接器管理面/g, "connector admin plane"],
  [/执行面/g, "execution surface"],
  [/操作信任/g, "operator trust"],
  [/人工复核/g, "manual review"],
  [/只读入口/g, "read-only ingress"],
  [/只读/g, "read-only"],
  [/待复核/g, "needs review"],
  [/精确匹配/g, "exact match"],
  [/已忽略/g, "ignored"],
  [/已完成/g, "completed"],
  [/已创建/g, "created"],
  [/已更新/g, "updated"],
  [/失败/g, "failed"],
  [/处理中/g, "processing"],
  [/待处理/g, "pending"],
  [/已连接/g, "connected"],
  [/未连接/g, "disconnected"],
  [/异常/g, "error"],
  [/入口/g, "ingress"],
  [/预览/g, "preview"],
  [/预热/g, "warmup"],
  [/今日焦点/g, "today focus"],
  [/就绪度/g, "readiness"],
  [/回写/g, "writeback"],
  [/重跑/g, "rerun"],
  [/冲突/g, "conflicts"],
  [/判断建议/g, "recommendations"],
  [/阻塞/g, "blockers"],
  [/承诺/g, "commitments"],
  [/记忆/g, "memory"],
  [/操作人/g, "operator"],
  [/连接器/g, "connector"],
  [/工作回路/g, "workflow"],
  [/复核/g, "review"],
  [/保持/g, " remains "],
  [/突出/g, "highlight"],
  [/不会自动执行/g, "never auto-runs"],
  [/流程/g, "flow"],
  [/可见/g, " visible"],
  [/无/g, "none"],
  [/，/g, ", "],
  [/。/g, ". "],
  [/；/g, "; "],
  [/、/g, ", "],
  [/：/g, ": "],
  [/但/g, " but "],
  [/和/g, " and "],
  [/由/g, " by "],
];

export function formatCrmImportDisplayText(text: string, english: boolean) {
  if (english) {
    return normalizeCrmImportDisplayText(
      crmImportEnglishReplacements.reduce(
        (current, [pattern, replacement]) => current.replace(pattern, replacement),
        text,
      ),
    );
  }

  return crmImportChineseReplacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
}

function normalizeCrmImportDisplayText(text: string) {
  return text
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,.;:])(?=\S)/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatCrmImportObjectType(
  type: string | null | undefined,
  english: boolean,
) {
  if (!type) return english ? "none" : "无";

  const normalizedType = type.trim().replace(/[\s-]+/g, "_").toUpperCase();

  if (english) {
    return normalizedType.replace(/_/g, " ").toLowerCase();
  }

  switch (normalizedType) {
    case "CONTACT":
      return "联系人";
    case "COMPANY":
    case "ACCOUNT":
      return "公司";
    case "OPPORTUNITY":
    case "DEAL":
      return "机会";
    case "MEETING":
    case "EVENT":
      return "会议";
    case "TASK":
      return "任务";
    case "ACTIONITEM":
    case "ACTION_ITEM":
      return "动作项";
    case "NOTE":
      return "笔记";
    case "HUB_COMPANY":
      return "来源公司";
    case "WORKSPACE":
      return "工作区";
    default:
      return formatCrmImportDisplayText(type, english);
  }
}

export function formatCrmImportExternalReference(
  externalId: string | null | undefined,
  english: boolean,
) {
  const value = externalId?.trim();
  if (!value) return english ? "external record" : "外部记录";

  const tokens = value
    .split(/[-_\s]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
  const businessTokens = tokens.filter(
    (token) =>
      !/^(hubspot|salesforce|contact|contacts|company|companies|account|accounts|opportunity|opportunities|deal|deals|task|tasks|event|events|note|notes)$/i.test(
        token,
      ),
  );

  if (!businessTokens.length) {
    return english ? "external record" : "外部记录";
  }

  return businessTokens
    .map((token) =>
      token.length <= 2
        ? token.toUpperCase()
        : token.charAt(0).toUpperCase() + token.slice(1),
    )
    .join(" ");
}
