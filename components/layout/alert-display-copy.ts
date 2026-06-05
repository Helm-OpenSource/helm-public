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

const ENGLISH_ALERT_REPLACEMENTS: Array<[RegExp, string]> = [
  [
    /策略建议已收敛到系统规则/g,
    "Follow-up rule updates have been folded into workspace rules",
  ],
  [/会后跟进规则已更新/g, "Follow-up rule updates"],
  [/策略建议/g, "rule adjustment"],
  [/系统规则/g, "workspace rules"],
  [/工作区规则/g, "workspace rules"],
  [/meeting_followup/g, "meeting follow-up"],
  [/contact_followup/g, "contact follow-up"],
  [/今日重点/g, "today focus"],
  [/阻塞/g, "blockers"],
  [/机会/g, "opportunities"],
  [/记录/g, "notes"],
  [/判断建议/g, "recommendations"],
  [/复核/g, "review"],
  [/\bblockers\b/gi, "blockers"],
  [/\bblocker\b/gi, "blockers"],
  [/\bdeals\b/gi, "opportunities"],
  [/\bnotes\b/gi, "notes"],
  [/\brecommendations\b/gi, "recommendations"],
  [/\brecommendation\b/gi, "recommendations"],
  [/today focus/gi, "today focus"],
];

const ENGLISH_ALERT_CLEANUPS: Array<[RegExp, string]> = [
  [
    /(.+workspace rules)，(.+) 和 (.+) 进入today focus；(.+)、(.+)、(.+) 和 (.+) 都需要review。/g,
    "$1, $2 and $3 are in today focus; $4, $5, $6, and $7 need review.",
  ],
  [/，/g, ", "],
  [/；/g, "; "],
  [/。/g, "."],
  [/\s+([,.;:])/g, "$1"],
  [/\.(?=\S)/g, ". "],
  [/\s{2,}/g, " "],
];

export function formatShellAlertText(value: string, english: boolean) {
  if (english) {
    if (!/[\u3400-\u9fff]|meeting_followup|contact_followup/.test(value)) {
      return value;
    }

    const formatted = ENGLISH_ALERT_REPLACEMENTS.reduce(
      (current, [pattern, replacement]) => current.replace(pattern, replacement),
      value,
    );

    return ENGLISH_ALERT_CLEANUPS.reduce(
      (current, [pattern, replacement]) => current.replace(pattern, replacement),
      formatted,
    ).trim();
  }

  const formatted = CHINESE_ALERT_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  );

  return formatSeededBusinessCopy(formatted, english);
}
