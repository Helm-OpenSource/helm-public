import type { CaioOperatingAttentionReadout } from "@/lib/caio-operating-context/readout";

// Closed labels only; reason codes are overlay-authored refs and render as codes, never as prose.
const SEVERITY_LABELS = {
  critical: { zh: "严重", en: "Critical" },
  warning: { zh: "警告", en: "Warning" },
  info: { zh: "提示", en: "Info" },
} as const;

function formatTime(iso: string, english: boolean): string {
  return new Date(iso).toLocaleString(english ? "en-US" : "zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

export function OperatingAttentionSection({
  readout,
  english,
}: {
  readout: CaioOperatingAttentionReadout;
  english: boolean;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);

  let status: string;
  if (!readout.available) {
    status = t("暂不可读（读取失败，不按空状态显示）", "Unavailable (read failed; not shown as empty)");
  } else if (!readout.lastTick) {
    status = t("快检尚未运行", "The quick check has not run yet");
  } else if (readout.lastTick.stale) {
    status = t("快检未在运行或已停滞，以下内容可能过期", "The quick check is not running or has stalled; items below may be out of date");
  } else if (readout.openCandidates.length === 0 && readout.unknownTemplates.length === 0) {
    status = t("本轮快检未发现待关注项", "The latest quick check found nothing to attend to");
  } else if (readout.openCandidates.length === 0) {
    status = t("本轮快检未发现待关注项，但有指标读取未知", "No attention items, but some readings are unknown");
  } else {
    status = t(`待关注 ${readout.openCandidates.length} 项`, `${readout.openCandidates.length} item(s) need attention`);
  }

  return (
    <section
      aria-labelledby="caio-attention-title"
      className="border-y border-[color:var(--border)] px-5 py-4"
      data-caio-attention="true"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="caio-attention-title" className="text-base font-semibold text-[color:var(--foreground)]">
          {t("待关注", "Needs attention")}
        </h2>
        {readout.available && readout.lastTick ? (
          <span className="text-xs text-[color:var(--muted-foreground)]">
            {t("最近快检", "Last quick check")}：{formatTime(readout.lastTick.bucketStart, english)}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]" data-caio-attention-status="true">
        {status}
      </p>

      {readout.available && readout.openCandidates.length > 0 ? (
        <ul className="mt-3 divide-y divide-[color:var(--border)]">
          {readout.openCandidates.map((candidate) => (
            <li key={`${candidate.detectorId}-${candidate.firstSeenAt}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
              <span className={candidate.severity === "critical" ? "font-semibold text-[color:var(--danger)]" : "font-semibold text-[color:var(--foreground)]"}>
                {english ? SEVERITY_LABELS[candidate.severity].en : SEVERITY_LABELS[candidate.severity].zh}
              </span>
              <span className="text-[color:var(--foreground)]">{english ? candidate.titleEn : candidate.titleZh}</span>
              <code className="text-xs text-[color:var(--muted-foreground)]">{candidate.reasonCode}</code>
              <span className="text-xs text-[color:var(--muted-foreground)]">
                {t(`命中 ${candidate.hitCount} 次，最近 ${formatTime(candidate.lastSeenAt, english)}`,
                  `${candidate.hitCount} hit(s), last ${formatTime(candidate.lastSeenAt, english)}`)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {readout.available && readout.unknownTemplates.length > 0 ? (
        <p className="mt-3 text-xs text-[color:var(--muted-foreground)]" data-caio-attention-unknown="true">
          {t("读取未知（不计为 0，依赖它们的检测本轮未运行）：", "Unknown readings (not counted as zero; dependent checks did not run): ")}
          {readout.unknownTemplates.map((item) => `${item.templateId}${item.errorCode ? `（${item.errorCode}）` : ""}`).join("、")}
        </p>
      ) : null}

      {readout.available && readout.lastSnapshot ? (
        <p className="mt-3 text-xs text-[color:var(--muted-foreground)]" data-caio-attention-snapshot={readout.lastSnapshot.status}>
          {readout.lastSnapshot.status === "PROJECTED"
            ? t(`经营上下文快照已生成（对象 ${readout.lastSnapshot.objectCount}、信号 ${readout.lastSnapshot.signalCount}）`,
              `Operating context snapshot generated (${readout.lastSnapshot.objectCount} object(s), ${readout.lastSnapshot.signalCount} signal(s))`)
            : readout.lastSnapshot.status === "NO_SIGNALS"
              ? t("本轮无命中，未生成快照", "No hits this round; no snapshot generated")
              : t("快照未通过合同校验", "The snapshot did not pass contract validation")}
          {t(`（${formatTime(readout.lastSnapshot.createdAt, english)}）`, ` (${formatTime(readout.lastSnapshot.createdAt, english)})`)}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
        {t("快检只读、不调用模型，不执行、不外发。", "The quick check is read-only and uses no model; it does not execute or send.")}
      </p>
    </section>
  );
}
