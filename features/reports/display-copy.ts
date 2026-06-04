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

const enReportDisplayReplacements: Array<[RegExp, string]> = [
  [
    /过去一周系统识别出\s+(\d+)\s+次机会推进动作。/g,
    "Over the past week, Helm identified $1 opportunity-advancement actions. ",
  ],
  [
    /过去一周识别出\s+(\d+)\s+次机会推进动作。/g,
    "Over the past week, Helm identified $1 opportunity-advancement actions. ",
  ],
  [
    /AI 共生成\s+(\d+)\s+条\s+AI 建议，AI 建议质量稳定。/g,
    "This week generated $1 recommended actions, and recommendation quality stayed stable. ",
  ],
  [
    /本周生成\s+(\d+)\s+条建议动作，建议质量稳定。/g,
    "This week generated $1 recommended actions, and recommendation quality stayed stable. ",
  ],
  [
    /系统观察显示没有系统想到什么。/g,
    "Operating patterns show no generic speculation. ",
  ],
  [
    /推进规律显示没有泛泛猜测。/g,
    "Operating patterns show no generic speculation. ",
  ],
  [
    /数据来源包括事件埋点、deals、notes 和 today focus。/g,
    "Data sources include usage signals, opportunities, notes, and today focus.",
  ],
  [
    /数据来源包括使用信号、机会、记录和今日重点。/g,
    "Data sources include usage signals, opportunities, notes, and today focus.",
  ],
  [
    /本周主要阻塞包括 payment_cycle、legal_review 和 resource_conflict；一般阻塞仍集中在 budget 与 response_delay。/g,
    "This week's main blockers include payment cycle, legal review, and resource conflict; general blockers are still concentrated around budget and response delay.",
  ],
  [/AI 共生成/g, "This week generated"],
  [/AI 建议质量/g, "recommendation quality"],
  [/条\s+AI 建议/g, "recommended actions"],
  [/AI 建议/g, "recommended actions"],
  [/AI 执行/g, "execution closure"],
  [/AI 参与/g, "collaboration participation"],
  [/系统观察/g, "operating patterns"],
  [/系统想到什么/g, "generic speculation"],
  [/事件埋点/g, "usage signals"],
  [/机会推进动作/g, "opportunity-advancement actions"],
  [/阻塞/g, "blockers"],
  [/今日重点/g, "today focus"],
  [/机会/g, "opportunities"],
  [/记录/g, "notes"],
  [/一般/g, "general"],
  [/付款节奏/g, "payment cycle"],
  [/法务复核/g, "legal review"],
  [/资源冲突/g, "resource conflict"],
  [/薪酬差距/g, "salary gap"],
  [/响应延迟/g, "response delay"],
  [/预算/g, "budget"],
  [/payment_cycle/gi, "payment cycle"],
  [/legal_review/gi, "legal review"],
  [/resource_conflict/gi, "resource conflict"],
  [/salary_gap/gi, "salary gap"],
  [/response_delay/gi, "response delay"],
  [/_/g, " "],
];

const enReportDisplayCleanups: Array<[RegExp, string]> = [
  [/\s+([,.;:])/g, "$1"],
  [/\.(?=\S)/g, ". "],
  [/\s{2,}/g, " "],
];

export function formatReportDisplayText(
  value: string | null | undefined,
  english: boolean,
) {
  const text = value?.trim() ?? "";

  if (!text) return text;

  if (english) {
    const formatted = enReportDisplayReplacements.reduce(
      (current, [pattern, replacement]) =>
        current.replace(pattern, replacement),
      text,
    );

    return enReportDisplayCleanups
      .reduce(
        (current, [pattern, replacement]) =>
          current.replace(pattern, replacement),
        formatted,
      )
      .trim();
  }

  const formatted = zhReportDisplayReplacements
    .reduce(
      (current, [pattern, replacement]) =>
        current.replace(pattern, replacement),
      text,
    )
    .replace(/\s+和\s+/g, "和");

  return formatSeededBusinessCopy(formatted, english);
}
