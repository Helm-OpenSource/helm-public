import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";

const zhReportDisplayReplacements: Array<[RegExp, string]> = [
  [/过去一周系统识别出/g, "过去一周识别出"],
  [/AI 共生成/g, "本周生成"],
  [/AI 建议质量/g, "建议质量"],
  [/条\s+AI 建议/g, "条建议动作"],
  [/AI 建议/g, "建议动作"],
  [/AI 执行/g, "执行闭环"],
  [/AI 参与/g, "协同参与"],
  [/系统观察/g, "推进规律"],
  [/系统想到什么/g, "泛泛猜测"],
  [/事件埋点/g, "使用信号"],
  [/\bblockers\b/gi, "阻塞"],
  [/\bblocker\b/gi, "阻塞"],
  [/\brecommendations\b/gi, "判断建议"],
  [/\brecommendation\b/gi, "判断建议"],
  [/today focus/gi, "今日重点"],
  [/\bdeals\b/gi, "机会"],
  [/\bnotes\b/gi, "记录"],
  [/payment_cycle/gi, "付款节奏"],
  [/legal_review/gi, "法务复核"],
  [/resource_conflict/gi, "资源冲突"],
  [/salary_gap/gi, "薪酬差距"],
  [/response_delay/gi, "响应延迟"],
  [/\bbudget\b/gi, "预算"],
  [/\bgeneral\b/gi, "一般阻塞"],
  [/_/g, " "],
];

export function formatReportDisplayText(
  value: string | null | undefined,
  english: boolean,
) {
  const text = value?.trim() ?? "";

  if (!text || english) return text;

  const formatted = zhReportDisplayReplacements
    .reduce(
      (current, [pattern, replacement]) =>
        current.replace(pattern, replacement),
      text,
    )
    .replace(/\s+和\s+/g, "和");

  return formatSeededBusinessCopy(formatted, english);
}
