import { EffectModeBadge } from "@/components/shared/effect-mode-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SalesDailyJudgementCard } from "@/lib/sales-process-signal/daily-judgement-card";

/**
 * "我的今日跟进" — the salesperson's daily judgement card over their own
 * captured conversations. Every item is a suggestion pending human review;
 * evidence appears as references only.
 */
export function SalesDailyJudgementCardView({
  card,
  english,
}: {
  card: SalesDailyJudgementCard;
  english: boolean;
}) {
  return (
    <Card data-sales-daily-card={card.decision}>
      <CardHeader>
        <CardTitle>
          {english ? "My follow-ups today" : "我的今日跟进"}
        </CardTitle>
        <CardDescription>
          {english
            ? "Judged from your own recent captures. Suggestions only — nothing here sends or commits anything."
            : "基于你自己最近的录制得出的判断。全部是建议——这里不会发送或承诺任何事。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {card.decision === "Insufficient-Signal" ? (
          <p
            data-sales-daily-empty
            className="rounded-xl border border-dashed border-[color:var(--border)] px-4 py-4 text-sm leading-6 text-[color:var(--muted-foreground)]"
          >
            {card.emptyGuidance}
          </p>
        ) : (
          card.sections.map((section) => (
            <div key={section.key} data-sales-daily-section={section.key}>
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted-foreground)]">
                {section.label}
                {section.droppedCount > 0 ? (
                  <span className="ml-2 normal-case">
                    {english
                      ? `(+${section.droppedCount} more not shown)`
                      : `（另有 ${section.droppedCount} 条未展示）`}
                  </span>
                ) : null}
              </p>
              <div className="mt-2 space-y-2">
                {section.items.map((item) => (
                  <div
                    key={item.signalId}
                    className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-6 text-[color:var(--foreground)]">
                        {item.statement}
                      </p>
                      <EffectModeBadge mode={item.effectMode} english={english} />
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-[color:var(--muted-foreground)]">
                      {item.followUpWindowDays !== undefined
                        ? english
                          ? `window ${item.followUpWindowDays}d · `
                          : `窗口 ${item.followUpWindowDays} 天 · `
                        : ""}
                      {english ? "confidence" : "置信"} {item.confidence} ·{" "}
                      {item.sourceRef}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        <ul className="flex flex-wrap gap-1.5 border-t border-[color:var(--border)] pt-3">
          {card.boundaries.map((boundary) => (
            <li
              key={boundary}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-0.5 text-xs text-[color:var(--muted-foreground)]"
            >
              {boundary}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
