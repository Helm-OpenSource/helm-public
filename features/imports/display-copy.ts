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

export function formatCrmImportDisplayText(text: string, english: boolean) {
  if (english) return text;

  return crmImportChineseReplacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
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
