import type { CaioInferenceReviewReadout } from "@/lib/caio-inference/readout";

/**
 * Read-only review section for /caio. Judgement text is model-authored data about aggregates: it is rendered
 * as text, it drives nothing, and every item stays advisory until a human acts on it elsewhere.
 */
const WORKER_STATE_LABELS = {
  working: { zh: "现场设备正在处理一轮复盘", en: "The on-premises device is working on a review" },
  idle: { zh: "无待处理复盘", en: "No review is waiting" },
  offline: { zh: "推理离线：有窗口排队或过期却没有设备领取", en: "Inference offline: a window queued or expired with no device claiming it" },
} as const;

const SEVERITY_LABELS: Record<string, { zh: string; en: string }> = {
  high: { zh: "高", en: "High" },
  medium: { zh: "中", en: "Medium" },
  low: { zh: "低", en: "Low" },
};

const CONFIDENCE_LABELS: Record<string, { zh: string; en: string }> = {
  high: { zh: "高", en: "High" },
  medium: { zh: "中", en: "Medium" },
  low: { zh: "低", en: "Low" },
  mixed: { zh: "不一", en: "Mixed" },
  unknown: { zh: "未知", en: "Unknown" },
};

const TASK_CLASS_LABELS: Record<string, { zh: string; en: string }> = {
  hourly_diagnosis: { zh: "小时复盘", en: "Hourly review" },
  daily_review: { zh: "日复盘", en: "Daily review" },
};

const JOB_STATUS_LABELS: Record<string, { zh: string; en: string }> = {
  queued: { zh: "排队中", en: "Queued" },
  claimed: { zh: "处理中", en: "Claimed" },
  completed: { zh: "已完成", en: "Completed" },
  rejected: { zh: "被拒收", en: "Rejected" },
  expired: { zh: "已过期", en: "Expired" },
  dead_letter: { zh: "失败待查", en: "Dead letter" },
};

/**
 * Judgements written before the Chinese-output default (Core #430) are English. They are bound to their content
 * hash, so the text is shown as written, with a note, rather than rewritten.
 */
export function isMostlyNonChinese(texts: readonly string[]): boolean {
  const joined = texts.join("");
  const letters = joined.match(/[\p{L}]/gu)?.length ?? 0;
  if (letters === 0) return false;
  const cjk = joined.match(/[\u4e00-\u9fff]/gu)?.length ?? 0;
  return cjk / letters < 0.3;
}

const SUGGESTION_LABELS: Record<string, { zh: string; en: string }> = {
  rule_draft: { zh: "规则草案", en: "Rule draft" },
  dry_run_request: { zh: "干跑请求", en: "Dry-run request" },
};

function formatTime(iso: string, english: boolean): string {
  return new Date(iso).toLocaleString(english ? "en-US" : "zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

export function InferenceReviewSection({
  readout,
  english,
}: {
  readout: CaioInferenceReviewReadout;
  english: boolean;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const label = (table: Record<string, { zh: string; en: string }>, key: string) =>
    table[key] ? (english ? table[key].en : table[key].zh) : key;

  if (!readout.available) {
    return (
      <section aria-labelledby="caio-review-title" className="border-y border-[color:var(--border)] px-5 py-4" data-caio-review="unavailable">
        <h2 id="caio-review-title" className="text-sm font-semibold text-[color:var(--foreground)]">
          {t("经营复盘", "Operating review")}
        </h2>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
          {t("暂不可读（读取失败，不按无判断显示）", "Unavailable (read failed; not shown as no judgement)")}
        </p>
      </section>
    );
  }

  const judgement = readout.latestJudgement;
  const state = WORKER_STATE_LABELS[readout.workerState];

  return (
    <section
      aria-labelledby="caio-review-title"
      className="border-y border-[color:var(--border)] px-5 py-4"
      data-caio-review={readout.workerState}
    >
      <h2 id="caio-review-title" className="text-sm font-semibold text-[color:var(--foreground)]">
        {t("经营复盘", "Operating review")}
      </h2>
      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{english ? state.en : state.zh}</p>

      {judgement === null ? (
        <p className="mt-3 text-sm text-[color:var(--foreground)]">
          {t("暂无判断。", "No judgement yet.")}
        </p>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-[color:var(--muted-foreground)]">
            {t("窗口", "Window")} {formatTime(judgement.windowStart, english)} – {formatTime(judgement.windowEnd, english)}
            {" · "}
            {t("置信", "Confidence")} {label(CONFIDENCE_LABELS, judgement.confidenceBand)}
            {judgement.completedAt ? ` · ${formatTime(judgement.completedAt, english)}` : ""}
          </p>
          {!english &&
            isMostlyNonChinese([
              ...judgement.facts,
              ...judgement.inferences,
              ...judgement.unknowns,
              ...judgement.risks.map((risk) => risk.statement),
              ...judgement.suggestions.map((suggestion) => suggestion.summary),
            ]) && (
              <p className="text-xs text-[color:var(--muted-foreground)]" data-caio-review-legacy-language="en">
                （英文旧版输出：这轮判断生成于默认中文之前，按原文显示；之后的复盘为中文。）
              </p>
            )}
          <Layer title={t("事实", "Facts")} items={judgement.facts} empty={t("无", "None")} />
          <Layer title={t("推断", "Inferences")} items={judgement.inferences} empty={t("无", "None")} />
          <Layer
            title={t("风险", "Risks")}
            items={judgement.risks.map((risk) => {
              const label = SEVERITY_LABELS[risk.severity];
              return `[${label ? (english ? label.en : label.zh) : risk.severity}] ${risk.statement}`;
            })}
            empty={t("无", "None")}
          />
          <Layer title={t("未知项", "Unknowns")} items={judgement.unknowns} empty={t("无", "None")} />
          <Layer
            title={t("建议", "Suggestions")}
            items={judgement.suggestions.map((suggestion) => {
              const label = SUGGESTION_LABELS[suggestion.kind];
              return `[${label ? (english ? label.en : label.zh) : suggestion.kind}] ${suggestion.summary}`;
            })}
            empty={t("无", "None")}
          />
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {t(
              "以上是建议性判断，需人工复核；系统不会据此派工、执行或外发。",
              "These are advisory judgements for human review; nothing here dispatches work, executes, or sends anything.",
            )}
          </p>
        </div>
      )}

      {readout.jobs.length > 0 && (
        <dl className="mt-3 grid gap-1 text-xs text-[color:var(--muted-foreground)]">
          {readout.jobs.slice(0, 5).map((job) => (
            <div key={`${job.taskClass}-${job.windowStart}`} className="flex gap-2">
              <dt>{formatTime(job.windowStart, english)}</dt>
              <dd>
                {label(TASK_CLASS_LABELS, job.taskClass)} · {label(JOB_STATUS_LABELS, job.status)}
                {job.rejectionCode ? ` · ${job.rejectionCode}` : ""}
                {job.attempt > 1 ? ` · ${t("尝试", "attempt")} ${job.attempt}` : ""}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function Layer({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-[color:var(--foreground)]">{title}</h3>
      {items.length === 0 ? (
        <p className="text-[color:var(--muted-foreground)]">{empty}</p>
      ) : (
        <ul className="list-disc pl-5 text-[color:var(--foreground)]">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
