import Link from "next/link";
import type { ReactNode } from "react";
import {
  Bolt,
  CircleAlert,
  Route,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import { ObjectContextOperatingSummary } from "@/components/shared/object-context-operating-summary";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildBusinessLoopGapReadout } from "@/lib/presentation/business-loop-gap-readout";
import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";
import type { GoalDrivenHomeModel } from "@/lib/operating-system/goal-driven-home";
import type { BusinessLoopGapSummary } from "@/lib/operating-system/operating-gap";

function HomeList({
  title,
  items,
  icon,
}: {
  title: string;
  items: GoalDrivenHomeModel["topJudgements"];
  icon: ReactNode;
}) {
  return (
    <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
          {icon}
          {title}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <Link
            key={`${title}-${item.label}`}
            href={item.href}
            aria-label={item.label}
            className="block rounded-[20px] border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
          >
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {item.label}
            </p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">
              {item.hint}
            </p>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function formatHomeLinks(
  items: GoalDrivenHomeModel["topJudgements"],
  english: boolean,
) {
  return items.map((item) => ({
    ...item,
    label: formatSeededBusinessCopy(item.label, english),
    hint: formatSeededBusinessCopy(item.hint, english),
  }));
}

export function GoalDrivenHomeSurface({
  model,
  businessLoopGapSummary,
  english,
}: {
  model: GoalDrivenHomeModel;
  businessLoopGapSummary: BusinessLoopGapSummary;
  english: boolean;
}) {
  const firstMove = model.immediateActions[0] ?? model.topJudgements[0] ?? null;
  const businessLoopGapReadout = buildBusinessLoopGapReadout({
    english,
    businessLoopGapSummary,
  });
  const dashboardOperatingItems = [
    {
      label: english ? "First move" : "第一推进动作",
      value: firstMove
        ? `${formatSeededBusinessCopy(firstMove.label, english)} · ${formatSeededBusinessCopy(firstMove.hint, english)}`
        : english
          ? "No ranked move is ready yet."
          : "当前还没有排好序的首个动作。",
    },
    {
      label: english ? "Current blocker" : "当前卡点",
      value: businessLoopGapReadout.blocker
        ? businessLoopGapReadout.blocker
        : model.topBlockers[0]
          ? `${formatSeededBusinessCopy(model.topBlockers[0].label, english)} · ${formatSeededBusinessCopy(model.topBlockers[0].hint, english)}`
          : english
            ? "No visible blocker is outranking the main move."
            : "当前没有比主动作更优先的显性卡点。",
    },
    {
      label: english ? "Current decision" : "当前拍板点",
      value:
        businessLoopGapReadout.pendingDecision ??
        (model.topDecisionRequests[0]
          ? `${model.topDecisionRequests[0].label} · ${model.topDecisionRequests[0].hint}`
          : model.topJudgements[0]
            ? `${formatSeededBusinessCopy(model.topJudgements[0].label, english)} · ${formatSeededBusinessCopy(model.topJudgements[0].hint, english)}`
            : english
              ? "No decision is waiting yet."
              : "当前还没有等待拍板的事项。"),
    },
    {
      label: english ? "Next action" : "下一步动作",
      value:
        businessLoopGapReadout.nextAction ??
        (firstMove
          ? `${formatSeededBusinessCopy(firstMove.label, english)} · ${formatSeededBusinessCopy(firstMove.hint, english)}`
          : english
            ? "No ranked move is ready yet."
            : "当前还没有排好序的首个动作。"),
    },
    {
      label: english ? "Current boundary" : "当前边界",
      value: formatSeededBusinessCopy(
        model.currentCampaign.boundary ?? model.note,
        english,
      ),
    },
  ];
  const dashboardOperatingConnections = [
    businessLoopGapReadout.connection,
    {
      label: english ? "Current campaign" : "当前主战场",
      value: formatSeededBusinessCopy(model.currentCampaign.title, english),
      description: formatSeededBusinessCopy(
        model.currentCampaign.summary,
        english,
      ),
      href: model.currentCampaign.href,
    },
    model.topJudgements[1]
      ? {
          label: english ? "Next ranked move" : "下一条排序动作",
          value: formatSeededBusinessCopy(
            model.topJudgements[1].label,
            english,
          ),
          description: formatSeededBusinessCopy(
            model.topJudgements[1].hint,
            english,
          ),
          href: model.topJudgements[1].href,
        }
      : undefined,
    model.topDecisionRequests[0]
      ? {
          label: english ? "Decision waiting" : "待拍板事项",
          value: formatSeededBusinessCopy(
            model.topDecisionRequests[0].label,
            english,
          ),
          description: formatSeededBusinessCopy(
            model.topDecisionRequests[0].hint,
            english,
          ),
          href: model.topDecisionRequests[0].href,
        }
      : undefined,
    model.roleHandoffs[0]
      ? {
          label: english ? "Handoff now" : "当前接手点",
          value: formatSeededBusinessCopy(model.roleHandoffs[0].label, english),
          description: formatSeededBusinessCopy(
            model.roleHandoffs[0].hint,
            english,
          ),
          href: model.roleHandoffs[0].href,
        }
      : undefined,
  ].filter(
    (
      item,
    ): item is {
      label: string;
      value: string;
      description: string;
      href: string;
    } => Boolean(item),
  );

  return (
    <section className="workspace-surface-stack" data-goal-driven-home="true">
      <ObjectContextOperatingSummary
        label={english ? "Business-first home" : "经营优先首页"}
        title={formatSeededBusinessCopy(model.currentCampaign.title, english)}
        summary={formatSeededBusinessCopy(
          model.currentCampaign.summary,
          english,
        )}
        items={dashboardOperatingItems}
        connectionsLabel={english ? "Connected chain" : "关联对象与推进链"}
        connections={dashboardOperatingConnections}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <HomeList
          title={english ? "Top 3 immediate moves" : "现在就能推进的 3 步"}
          items={formatHomeLinks(model.immediateActions, english)}
          icon={<Bolt className="h-3.5 w-3.5" />}
        />
        <HomeList
          title={english ? "Top 3 blockers" : "最重要的 3 个阻塞"}
          items={formatHomeLinks(model.topBlockers, english)}
          icon={<CircleAlert className="h-3.5 w-3.5" />}
        />
        <HomeList
          title={english ? "Top 3 decisions waiting" : "最值得拍板的 3 件事"}
          items={formatHomeLinks(model.topDecisionRequests, english)}
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
        />
        <HomeList
          title={
            english ? "Who should take over now" : "当前最应该由谁接手什么"
          }
          items={formatHomeLinks(model.roleHandoffs, english)}
          icon={<Target className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <HomeList
          title={english ? "Top 3 chain moves" : "最重要的 3 条推进链"}
          items={formatHomeLinks(model.topChains, english)}
          icon={<Route className="h-3.5 w-3.5" />}
        />
        <HomeList
          title={english ? "Common action templates" : "常用动作模板"}
          items={formatHomeLinks(model.actionTemplates, english)}
          icon={<Sparkles className="h-3.5 w-3.5" />}
        />
        <HomeList
          title={
            english
              ? "Write-back from review and follow-through"
              : "复盘和跟进结果如何回写"
          }
          items={formatHomeLinks(model.retroFeedback, english)}
          icon={<Sparkles className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <HomeList
          title={english ? "Top 3 priorities" : "现在最值得处理的 3 件事"}
          items={formatHomeLinks(model.topJudgements, english)}
          icon={<Target className="h-3.5 w-3.5" />}
        />

        <Card className="workspace-panel-muted border-[color:var(--border)]">
          <CardHeader>
            <CardTitle className="text-xl tracking-tight text-[color:var(--foreground)]">
              {english ? "Supporting context" : "依据与来龙去脉"}
            </CardTitle>
            <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
              {formatSeededBusinessCopy(model.note, english)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {formatHomeLinks(model.evidenceEntries, english).map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
              >
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {item.label}
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {item.hint}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
