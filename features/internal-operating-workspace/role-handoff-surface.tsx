import Link from "next/link";
import { ArrowRight, ShieldAlert, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { WorkspaceGuidancePanel } from "@/components/shared/workspace-guidance-panel";
import { WorkspaceSurfacePreferences } from "@/components/shared/workspace-surface-preferences";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InternalRoleSurfaceModel } from "@/lib/internal-operating-workspace";
import { formatOperatingDisplayText } from "@/features/internal-operating-workspace/display-copy";
import { InternalOperatingObjectCardView } from "@/features/internal-operating-workspace/object-card";

function SimpleAttachmentList({
  title,
  items,
  english,
}: {
  title: string;
  items: Array<{ label: string; hint: string; href?: string }>;
  english: boolean;
}) {
  if (!items.length) return null;
  const copy = (value: string) => formatOperatingDisplayText(value, english);

  return (
    <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]">
      <CardHeader>
        <CardTitle className="text-base tracking-tight text-[color:var(--foreground)]">
          {copy(title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => {
          const body = (
            <>
              <p className="text-sm font-medium text-[color:var(--foreground)]">
                {copy(item.label)}
              </p>
              <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                {copy(item.hint)}
              </p>
            </>
          );

          return item.href ? (
            <Link
              key={attachmentKey(title, item, index)}
              href={item.href}
              aria-label={copy(item.label)}
              className="block rounded-2xl border border-[color:var(--border)] px-3 py-3 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
            >
              {body}
            </Link>
          ) : (
            <div
              key={attachmentKey(title, item, index)}
              className="rounded-2xl border border-[color:var(--border)] px-3 py-3"
            >
              {body}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function InternalOperatingRoleHandoffSurface({
  model,
  english,
}: {
  model: InternalRoleSurfaceModel;
  english: boolean;
}) {
  const copy = (value: string) => formatOperatingDisplayText(value, english);
  const handoffRecommendations = model.topJudgements.slice(0, 3).map((item) => ({
    title: copy(item.label),
    body: copy(item.hint),
    href: item.href,
  }));
  const handoffReminders = [
    ...model.immediateActions.slice(0, 2).map((item) => ({
      title: copy(item.label),
      body: copy(item.hint),
      href: item.href,
    })),
    ...model.decisionsWaiting.slice(0, 1).map((item) => ({
      title: copy(item.label),
      body: copy(item.hint),
      href: item.href,
    })),
  ];
  const boundarySummary =
    model.risks[0]?.hint ??
    (english
      ? "For handoff and judgement — not for executing."
      : "用于交接和判断——不负责执行。");

  return (
    <div className="workspace-surface-stack" data-source-page={`/operating/roles/${model.role}`}>
      <PageHeader
        eyebrow={copy(model.eyebrow)}
        title={copy(model.title)}
        description={copy(model.description)}
        briefing={{
          label: english ? "Role brief" : "角色接手简报",
          headline: copy(model.headline),
          summary: copy(model.summary),
          operatorLabel: english ? "Act next" : "现在最该做的",
          operatorPrompt: english
            ? "Accept the handoff here without re-reading the whole workspace."
            : "在这里接手，不必把整个工作区翻一遍。",
          decisionsLabel: english ? "Judge first" : "先判断",
          decisions: model.topJudgements.map((item) => copy(item.label)),
        }}
        actions={
          <>
            <ButtonLink href="/operating" label={english ? "Back to operating home" : "回经营总盘"} variant="secondary" />
            <ButtonLink href="/dashboard" label={english ? "Open dashboard" : "去首页"} />
          </>
        }
      />

      <WorkspaceGuidancePanel
        eyebrow={english ? "Handoff guidance" : "交接引导"}
        title={english ? "Accept the role handoff without rebuilding the whole workspace" : "不重翻整个工作区，也能把这个角色接稳"}
        summary={english ? "Read the state, pick the next move, review before acting." : "看状态、定下一步、行动前先复核。"}
        recommendations={handoffRecommendations}
        reminders={handoffReminders}
        boundary={boundarySummary}
        recommendationsLabel={english ? "Top judgements" : "优先判断"}
        remindersLabel={english ? "Immediate handoff cues" : "交接提示"}
      />

      <div className="workspace-surface-stack">
        <WorkspaceSurfacePreferences showFormAssist={false} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        <SimpleAttachmentList
          title={english ? "Top priorities" : "当前最重要的 3 个判断"}
          items={model.topJudgements}
          english={english}
        />
        <SimpleAttachmentList
          title={
            english
              ? "Immediate actions"
              : "当前最重要的 3 个下一步动作"
          }
          items={model.immediateActions}
          english={english}
        />
        <SimpleAttachmentList
          title={english ? "Decisions waiting" : "当前最需要拍板的 3 件事"}
          items={model.decisionsWaiting}
          english={english}
        />
        <SimpleAttachmentList
          title={english ? "Blockers to clear" : "当前最该清掉的 3 个阻塞"}
          items={model.blockersToClear}
          english={english}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SimpleAttachmentList
          title={english ? "Boundaries and risks" : "当前边界与风险"}
          items={model.risks}
          english={english}
        />
        <SimpleAttachmentList
          title={english ? "Common action templates" : "常用动作模板"}
          items={model.actionTemplates}
          english={english}
        />
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
          <Sparkles className="h-3.5 w-3.5" />
          {english ? "Common role scenes" : "常见接手场景"}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {model.sceneSections.map((scene) => (
            <Card
              key={scene.id}
              className="workspace-shell-panel border-[color:var(--mode-card-border)]"
            >
              <CardHeader>
                <CardTitle className="text-base tracking-tight text-[color:var(--foreground)]">
                  {copy(scene.title)}
                </CardTitle>
                <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {copy(scene.summary)}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scene.items.map((item, index) =>
                    item.href ? (
                      <Link
                        key={attachmentKey(scene.id, item, index)}
                        href={item.href}
                        aria-label={copy(item.label)}
                        className="block rounded-2xl border border-[color:var(--border)] px-3 py-3 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                      >
                        <p className="text-sm font-medium text-[color:var(--foreground)]">
                          {copy(item.label)}
                        </p>
                        <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                          {copy(item.hint)}
                        </p>
                      </Link>
                    ) : (
                      <div
                        key={attachmentKey(scene.id, item, index)}
                        className="rounded-2xl border border-[color:var(--border)] px-3 py-3"
                      >
                        <p className="text-sm font-medium text-[color:var(--foreground)]">
                          {copy(item.label)}
                        </p>
                        <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                          {copy(item.hint)}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card className="workspace-panel-muted border-[color:var(--border)]">
        <CardContent className="grid gap-4 py-5 md:grid-cols-2 xl:grid-cols-3">
          {model.topHandoffs.slice(0, 3).map((item, index) => (
            <div
              key={`handoff-summary-${item.id}-${index}`}
              className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4"
            >
              <div className="flex items-center gap-2">
                <Badge variant="info">{copy(item.kindLabel)}</Badge>
                <Badge variant="neutral">{copy(item.stageLabel)}</Badge>
              </div>
              <p className="mt-3 text-base font-semibold text-[color:var(--foreground)]">
                {copy(item.title)}
              </p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">
                {copy(item.currentJudgement)}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[color:var(--mode-link)]">
                <Sparkles className="h-4 w-4" />
                {copy(item.handoffRole)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
          <ShieldAlert className="h-3.5 w-3.5" />
          {english ? "Current handoff items" : "当前接手事项清单"}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {model.topHandoffs.map((card, index) => (
            <InternalOperatingObjectCardView
              key={`handoff-card-${card.id}-${index}`}
              card={card}
              english={english}
            />
          ))}
        </div>
      </section>

      <SimpleAttachmentList
        title={
          english
            ? "Write-back from review and follow-through"
            : "复盘与推进结果回写"
        }
        items={model.retroFeedback}
        english={english}
      />

      <SimpleAttachmentList
        title={english ? "Supporting context and handoff trace" : "依据与交接来龙去脉"}
        items={model.evidence}
        english={english}
      />
    </div>
  );
}

function ButtonLink({
  href,
  label,
  variant = "default",
}: {
  href: string;
  label: string;
  variant?: "default" | "secondary";
}) {
  const classes =
    variant === "secondary"
      ? "inline-flex items-center rounded-xl border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-subtle)]"
      : "inline-flex items-center rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-[color:var(--accent-foreground)] transition hover:brightness-95";

  return (
    <Link href={href} className={classes}>
      <span>{label}</span>
      <ArrowRight className="ml-2 h-4 w-4" />
    </Link>
  );
}

function attachmentKey(
  scope: string,
  item: { label: string; hint: string; href?: string },
  index: number,
) {
  return `${scope}-${item.href ?? "static"}-${item.label}-${index}`;
}
