// Operating Signal Quality Scorecard — Helm reserved-tenant 内部经营信号质量评估可视化卡片。
//
// 边界约束：
// - 这个组件本身是 pure render，不读 DB、不持租户字面量；
//   路由 / page-loader 层必须先做 reserved-only gating，再把 readout 传进来；
// - 不做"绩效结算"前置 UI；显式展示 boundary footer 提示这是评估快照，不是合同/工资/分润依据；
// - AI 产出归对应 GitHub 人类账号——subject.githubHandle 显式展示，不创建独立 AI contributor。

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type {
  OperatingSignalQualityReadout,
  OperatingSignalQualityReadoutScoreLine,
} from "@/lib/operating-signal-quality/format-readout";

export type OperatingSignalQualityScorecardProps = {
  readout: OperatingSignalQualityReadout;
  english?: boolean;
  githubHandle?: string | null;
};

function formatBoundRange(line: OperatingSignalQualityReadoutScoreLine) {
  if (line.bound.min === 0) {
    return `${line.score} / ${line.bound.max}`;
  }
  return `${line.score} (${line.bound.min}..${line.bound.max})`;
}

function ToneDot({ tone }: { tone: OperatingSignalQualityReadoutScoreLine["tone"] }) {
  const color =
    tone === "positive"
      ? "var(--accent-success, var(--accent))"
      : tone === "negative"
        ? "var(--accent-danger, var(--accent-warm))"
        : "var(--muted-foreground)";
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function SectionList({
  title,
  items,
  emptyLabel,
  testId,
}: {
  title: string;
  items: string[];
  emptyLabel?: string;
  testId?: string;
}) {
  if (!items.length) {
    if (!emptyLabel) return null;
    return (
      <section className="space-y-2" data-testid={testId}>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
          {title}
        </p>
        <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
          {emptyLabel}
        </p>
      </section>
    );
  }
  return (
    <section className="space-y-2" data-testid={testId}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="text-sm leading-6 text-[color:var(--foreground)]"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OperatingSignalQualityScorecard({
  readout,
  english = false,
  githubHandle = null,
}: OperatingSignalQualityScorecardProps) {
  const positiveTitle = english ? "Positive signals" : "正面信号";
  const noiseTitle = english ? "Noise findings" : "噪声 / 干扰";
  const deliveryTitle = english ? "Delivery evidence" : "交付证据";
  const readinessTitle = english ? "Readiness evidence" : "上线 / 配置证据";
  const recommendationsTitle = english ? "Recommendations" : "改进建议";
  const breakdownTitle = english ? "Score breakdown" : "评分细分";
  const totalScoreLabel = english ? "Total" : "总分";
  const ghLabel = english ? "GitHub" : "GitHub 账号";

  return (
    <Card
      className="space-y-6 px-5 py-5"
      data-testid="operating-signal-quality-scorecard"
    >
      <CardHeader className="flex flex-col gap-2 p-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{readout.subjectKindLabel}</Badge>
          <Badge variant={readout.gradeBadgeVariant}>{readout.gradeLabel}</Badge>
          {githubHandle ? (
            <span
              className="text-xs text-[color:var(--muted-foreground)]"
              data-testid="operating-signal-quality-scorecard-github"
            >
              {ghLabel}: {githubHandle}
            </span>
          ) : null}
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
          {readout.subjectLabel}
        </h2>
        <p
          className="text-sm leading-6 text-[color:var(--muted-foreground)]"
          data-testid="operating-signal-quality-scorecard-headline"
        >
          {readout.headline}
        </p>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-xs uppercase tracking-wide text-[color:var(--muted-foreground)]">
            {totalScoreLabel}
          </span>
          <span
            className="text-3xl font-semibold tracking-tight text-[color:var(--foreground)]"
            data-testid="operating-signal-quality-scorecard-total"
          >
            {readout.totalScore}
          </span>
          <span className="text-sm text-[color:var(--muted-foreground)]">
            / {readout.totalBound.max}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-0">
        <section className="space-y-2" data-testid="operating-signal-quality-scorecard-breakdown">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
            {breakdownTitle}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {readout.scoreLines.map((line) => (
              <li
                key={line.dimension}
                className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <ToneDot tone={line.tone} />
                  <span className="text-sm text-[color:var(--foreground)]">
                    {line.label}
                  </span>
                </span>
                <span className="text-sm font-medium tabular-nums text-[color:var(--foreground)]">
                  {formatBoundRange(line)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <SectionList
          title={positiveTitle}
          items={readout.positiveSignals}
          testId="operating-signal-quality-scorecard-positive"
        />
        <SectionList
          title={noiseTitle}
          items={readout.noiseFindings}
          testId="operating-signal-quality-scorecard-noise"
        />
        <SectionList
          title={deliveryTitle}
          items={readout.deliveryEvidence}
          testId="operating-signal-quality-scorecard-delivery"
        />
        <SectionList
          title={readinessTitle}
          items={readout.readinessEvidence}
          testId="operating-signal-quality-scorecard-readiness"
        />
        <SectionList
          title={recommendationsTitle}
          items={readout.recommendations}
          testId="operating-signal-quality-scorecard-recommendations"
        />

        <p
          className="text-xs italic leading-6 text-[color:var(--muted-foreground)]"
          data-testid="operating-signal-quality-scorecard-boundary"
        >
          {readout.boundaryFooter}
        </p>
      </CardContent>
    </Card>
  );
}
