import Link from "next/link";
import { ArrowRight, Clock3, FileClock, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InternalAttachment, InternalOperatingObjectCard } from "@/lib/internal-operating-workspace";
import { formatOperatingDisplayText } from "@/features/internal-operating-workspace/display-copy";

function AttachmentList({
  title,
  items,
  english,
}: {
  title: string;
  items: InternalAttachment[];
  english: boolean;
}) {
  if (!items.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {title}
      </p>
      <div className="space-y-2">
        {items.map((item, index) => {
          const content = (
            <>
              <p className="text-sm font-medium text-[color:var(--foreground)]">
                {formatOperatingDisplayText(item.label, english)}
              </p>
              <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                {formatOperatingDisplayText(item.hint, english)}
              </p>
            </>
          );

          return item.href ? (
            <Link
              key={attachmentKey(title, item, index)}
              href={item.href}
              aria-label={formatOperatingDisplayText(item.label, english)}
              className="block rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3 transition hover:border-[color:var(--border-strong)] hover:bg-[color:color-mix(in_oklab,var(--surface-subtle)_88%,white_12%)]"
            >
              {content}
            </Link>
          ) : (
            <div
              key={attachmentKey(title, item, index)}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function attachmentKey(
  scope: string,
  item: InternalAttachment,
  index: number,
) {
  return `${scope}-${item.href ?? "static"}-${item.label}-${index}`;
}

export function InternalOperatingObjectCardView({
  card,
  english,
}: {
  card: InternalOperatingObjectCard;
  english: boolean;
}) {
  const copy = (value: string) => formatOperatingDisplayText(value, english);
  return (
    <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{copy(card.kindLabel)}</Badge>
          <Badge variant="neutral">{copy(card.stageLabel)}</Badge>
          <Badge variant={card.riskLabel === "高风险" || card.riskLabel === "关键风险" || card.riskLabel === "High risk" || card.riskLabel === "Critical risk" ? "danger" : "neutral"}>
            {copy(card.riskLabel)}
          </Badge>
        </div>
        <div className="space-y-2">
          <CardTitle className="text-xl tracking-tight text-[color:var(--foreground)]">
            {copy(card.title)}
          </CardTitle>
          <CardDescription className="text-sm leading-6 text-[color:var(--muted-foreground)]">
            {copy(card.subtitle)}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4">
          <p className="text-xs font-medium text-[color:var(--mode-link)]">
            {english ? "Current Judgement" : "当前判断"}
          </p>
          <p className="mt-3 text-sm leading-7 text-[color:var(--foreground)]">
            {copy(card.currentJudgement)}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--border)] px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--muted-foreground)]">
              <Clock3 className="h-3.5 w-3.5" />
              {english ? "Next step" : "当前下一步"}
            </div>
            <p className="mt-3 text-sm leading-7 text-[color:var(--foreground)]">
              {copy(card.nextStep)}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--muted-foreground)]">
              <Sparkles className="h-3.5 w-3.5" />
              {english ? "Owner / handoff" : "当前接手"}
            </div>
            <p className="mt-3 text-sm leading-7 text-[color:var(--foreground)]">
              {copy(card.ownerLabel)} · {copy(card.handoffRole)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--border)] px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--muted-foreground)]">
              <ShieldAlert className="h-3.5 w-3.5" />
              {english ? "Boundary" : "边界与风险"}
            </div>
            <p className="mt-3 text-sm leading-7 text-[color:var(--foreground)]">
              {copy(card.riskBoundary)}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--muted-foreground)]">
              <FileClock className="h-3.5 w-3.5" />
              {english ? "Chain relation" : "经营链关系"}
            </div>
            <p className="mt-3 text-sm leading-7 text-[color:var(--foreground)]">
              {copy(card.chainRelation)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <AttachmentList
            title={english ? "Recent meetings" : "最近会议"}
            items={card.recentMeetings}
            english={english}
          />
          <AttachmentList
            title={english ? "Key decisions" : "关键决策"}
            items={card.keyDecisions}
            english={english}
          />
          <AttachmentList
            title={english ? "Next tasks" : "下一步任务"}
            items={card.nextTasks}
            english={english}
          />
          <AttachmentList
            title={english ? "Retros and memory" : "复盘与记忆"}
            items={card.keyRetros}
            english={english}
          />
        </div>

        <Link
          href={card.href}
          aria-label={copy(card.title)}
          className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--mode-link)] transition hover:brightness-90"
        >
          {english ? "Open operating chain" : "打开经营链"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
