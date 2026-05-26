import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";

const CHINESE_ALERT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bblocker\b/gi, "阻塞"],
  [/\bblockers\b/gi, "阻塞"],
  [/\bdeals\b/gi, "机会"],
  [/\bnotes\b/gi, "记录"],
  [/\brecommendations\b/gi, "判断建议"],
  [/\brecommendation\b/gi, "判断建议"],
  [/today focus/gi, "今日重点"],
  [/meeting_followup/g, "会后跟进"],
  [/contact_followup/g, "关系跟进"],
  [/策略建议已收敛到系统规则/g, "会后跟进规则已更新"],
  [/策略建议/g, "规则调整"],
  [/系统规则/g, "工作区规则"],
];

export function formatShellAlertText(value: string, english: boolean) {
  if (english) return value;

  const formatted = CHINESE_ALERT_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  );

  return formatSeededBusinessCopy(formatted, english);
}
