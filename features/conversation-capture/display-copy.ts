const captureChineseReplacements: Array<[RegExp, string]> = [
  [/客户这次更关心付款周期，不是总价/g, "客户这次更关心付款周期，而非总价"],
  [/更关心付款周期，不是总价/g, "更关心付款周期，而非总价"],
  [
    /按当前策略，这类动作可以在阈值内自动执行。/g,
    "按当前规则，这类动作会在条件内准备，并先保留复核。",
  ],
  [/按当前策略/g, "按当前规则"],
  [/审批或自动执行链路/g, "审批或受控路由链路"],
  [/阈值内自动执行/g, "规则内准备"],
  [/策略内准备/g, "规则内准备"],
  [/系统最近确认到的关键信号是/g, "最近确认的关键信号是"],
  [/系统最近还学到/g, "最近还学到"],
  [/给 ([^\\n]+?) 发结构化跟进/g, "给 $1 发清晰跟进"],
  [/结构化跟进/g, "清晰跟进"],
  [/结构化/g, "整理成可用信息"],
  [/DRAFT_EXTERNAL_EMAIL/g, "外发邮件草稿"],
  [/阻碍/g, "阻塞"],
  [/\brecommendation explanation\b/gi, "建议说明"],
  [/\brefreshed recommendation objects\b/gi, "刷新建议对象"],
  [/\bpanel briefing\b/gi, "面试小组简报"],
  [/\bcandidate briefing\b/gi, "候选人简报"],
  [/\bshortlist sync\b/gi, "候选名单同步"],
  [/\bshortlist\b/gi, "候选名单"],
  [/\bshort\.\.\./gi, "候选名单..."],
  [/\bfinalist\b/gi, "终面候选人"],
  [/\bdemo transcript\b/gi, "演示转写"],
  [/\bfallback transcript\b/gi, "兜底转写"],
  [/\bexternal transcript\b/gi, "外部转写"],
  [/\bNEXT_STEP\b/g, "下一步动作"],
  [/\bSUMMARY\b/g, "摘要"],
  [/\bDECISION\b/g, "决策"],
  [/\bRELATIONSHIP\b/g, "关系"],
  [/\bRISK\b/g, "风险"],
  [/\bNOTE\b/g, "备注"],
  [/\bOPEN\b/g, "待处理"],
  [/\bIN_PROGRESS\b/g, "推进中"],
  [/\bOVERDUE\b/g, "已逾期"],
  [/\bFULFILLED\b/g, "已兑现"],
  [/\bRESOLVED\b/g, "已解决"],
  [/\bMONITORING\b/g, "观察中"],
  [/\bIGNORED\b/g, "暂不处理"],
  [/\bCANCELED\b/g, "已取消"],
  [/\btranscript-to-action\b/gi, "转写到行动"],
  [/\btranscript-to-memory\b/gi, "转写到记忆"],
  [/\btranscript\b/gi, "转写文本"],
  [/\brecommendations\b/gi, "建议"],
  [/\brecommendation\b/gi, "建议"],
  [/\bbriefing\b/gi, "简报"],
  [/\bblockers\b/gi, "阻塞"],
  [/\bblocker\b/gi, "阻塞"],
  [/\bapprovals\b/gi, "审批"],
  [/\bapproval\b/gi, "审批"],
  [/\bmeetings\b/gi, "会议"],
  [/\bmeeting\b/gi, "会议"],
  [/\bmemory\b/gi, "经营记忆"],
  [/\breview\b/gi, "复核"],
  [/\bingest\b/gi, "接入"],
  [/\bcapture\b/gi, "现场记录"],
  [/\bASR\b/g, "语音转写"],
];

export function formatCaptureDisplayText(text: string, english: boolean) {
  if (english) return text;

  return captureChineseReplacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
}

export function formatCaptureObjectType(
  type: string | null | undefined,
  english: boolean,
) {
  if (!type) return english ? "object" : "对象";

  const normalizedType = type.trim().replace(/[\s-]+/g, "_").toUpperCase();

  if (english) {
    return normalizedType.replace(/_/g, " ").toLowerCase();
  }

  switch (normalizedType) {
    case "CONTACT":
      return "联系人";
    case "COMPANY":
      return "公司";
    case "OPPORTUNITY":
      return "机会";
    case "MEETING":
      return "会议";
    case "ACTION_ITEM":
      return "动作";
    case "APPROVAL_TASK":
      return "审批任务";
    case "WORKSPACE":
      return "工作区";
    default:
      return formatCaptureDisplayText(normalizedType, english);
  }
}
