import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";

const chineseReviewTextReplacements: Array<[RegExp, string]> = [
  [/系统学到了什么/g, "同类动作参考"],
  [/系统学习结果/g, "同类动作参考"],
  [/系统观察到/g, "从最近记录看"],
  [/系统已经/g, "最近记录已"],
  [/系统会/g, "后续会"],
  [/系统最近识别出/g, "最近沉淀出"],
  [/系统最近记录了/g, "最近记录了"],
  [/contact_followup/g, "关系跟进"],
  [/meeting_followup/g, "会后跟进"],
  [/budget_blocker/g, "预算阻塞"],
  [/stalled_opportunity/g, "停滞机会"],
  [/within_48h_preferred/g, "48 小时内优先跟进"],
  [/approved_after_edit/g, "改写后批准"],
  [/阈值内自动执行/g, "条件内自动处理"],
  [
    /Customer-visible language must remain review-before-send and non-commitment-only/gi,
    "客户可见措辞必须保持发送前复核，并且不能形成承诺",
  ],
  [
    /Recommendation worker keeps the why-now explanation attached/gi,
    "判断建议协作者会保留时机说明",
  ],
  [
    /Approval worker keeps the draft, source context and execution preview current/gi,
    "审批协作者会保持草稿、来源上下文和执行预览最新",
  ],
  [
    /Replay, audit and memory drill-down stay available before anyone lets the action through/gi,
    "放行动作前，回放、审计和记忆下钻都会保持可见",
  ],
  [
    /Write an internal (review note|复核记录) into the (review|复核) queue/gi,
    "把内部复核记录写入复核队列",
  ],
  [
    /Read boundary and policy context while shaping the (review note|复核记录)/gi,
    "成形复核记录前先读取边界与策略上下文",
  ],
  [
    /replay and audit stay available for the owner/gi,
    "回放和审计会继续留给负责人",
  ],
  [/why-now explanation/gi, "时机说明"],
  [/review-before-send/gi, "发送前复核"],
  [/customer-visible/gi, "客户可见"],
  [/customer-facing/gi, "面向客户"],
  [/follow-through/gi, "后续推进"],
  [/owner-level/gi, "负责人层级"],
  [/policy boundary/gi, "策略边界"],
  [/\brecommendations\b/gi, "判断建议"],
  [/\brecommendation\b/gi, "判断建议"],
  [/\bcommitments\b/gi, "承诺"],
  [/\bcommitment\b/gi, "承诺"],
  [/\bblockers\b/gi, "阻塞"],
  [/\bblocker\b/gi, "阻塞"],
  [/\bINTERNAL_SYNC\b/g, "需内部协同"],
  [/\bADVANCING\b/g, "推进中"],
  [/\bCREATE_MEETING\b/g, "创建会议"],
  [/\bActionItem\b/g, "动作项"],
  [/\bApprovalTask\b/g, "审批任务"],
  [/\bworkers\b/gi, "协作者"],
  [/\bworker\b/gi, "协作者"],
  [/\bskills\b/gi, "能力"],
  [/\bskill\b/gi, "能力"],
  [/\bowners\b/gi, "负责人"],
  [/\bowner\b/gi, "负责人"],
  [/\breplay\b/gi, "回放"],
  [/\baudit\b/gi, "审计"],
  [/\bexplanations\b/gi, "解释"],
  [/\bexplanation\b/gi, "解释"],
  [/\bproposal\b/gi, "方案"],
  [/\bdrafts\b/gi, "草稿"],
  [/\bdraft\b/gi, "草稿"],
  [/\bfacts\b/gi, "事实"],
  [/\bfact\b/gi, "事实"],
  [/\bmemory\b/gi, "记忆"],
  [/\breview\b/gi, "复核"],
];

const englishReviewTextReplacements: Array<[RegExp, string]> = [
  [/contact_followup/g, "relationship follow-up"],
  [/meeting_followup/g, "meeting follow-up"],
  [/budget_blocker/g, "budget blocker"],
  [/stalled_opportunity/g, "stalled opportunity"],
  [/within_48h_preferred/g, "48-hour follow-up preference"],
  [/approved_after_edit/g, "approved after edits"],
  [/Auto within threshold/g, "Auto-handle inside agreed conditions"],
];

export function formatApprovalLearningDisplayText(
  text: string,
  english: boolean,
) {
  const replacements = english
    ? englishReviewTextReplacements
    : chineseReviewTextReplacements;

  const formatted = replacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );

  return formatSeededBusinessCopy(formatted, english);
}

export function formatApprovalPolicyModeForReview(input: {
  mode?: string | null;
  modeLabel?: string | null;
  english: boolean;
}) {
  if (input.mode === "AUTO_WITHIN_THRESHOLD") {
    return input.english
      ? "Auto-handle inside agreed conditions"
      : "条件内自动处理";
  }

  if (!input.modeLabel) {
    return input.english ? "Not configured yet" : "尚未配置";
  }

  return formatApprovalLearningDisplayText(input.modeLabel, input.english);
}
