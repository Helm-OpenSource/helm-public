import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  FileText,
  LockKeyhole,
  Network,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { LazyDisclosure } from "@/components/shared/lazy-disclosure";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  OperatingSignalFlowDetailModel,
  OperatingSignalFlowDetailPhase,
  OperatingSignalFlowDetailPhaseStatus,
} from "@/lib/operating-signal-flow/projection";
import { QuoteNote } from "@/features/internal-operating-workspace/operating-signal-flow-quote-note";

const phaseStatusClasses: Record<OperatingSignalFlowDetailPhaseStatus, string> = {
  done: "border-[color:color-mix(in_oklab,var(--accent-success)_36%,var(--border)_64%)] bg-[color:color-mix(in_oklab,var(--surface)_86%,rgb(16,185,129)_14%)]",
  current:
    "border-[color:color-mix(in_oklab,var(--accent)_36%,var(--border)_64%)] bg-[color:color-mix(in_oklab,var(--surface)_86%,rgb(14,165,233)_14%)]",
  blocked:
    "border-[color:color-mix(in_oklab,var(--accent-danger)_44%,var(--border)_56%)] bg-[color:color-mix(in_oklab,var(--surface)_84%,rgb(239,68,68)_16%)]",
  waiting:
    "border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_90%,var(--surface-subtle)_10%)]",
  learned:
    "border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border)_70%)] bg-[color:color-mix(in_oklab,var(--surface)_86%,rgb(99,102,241)_14%)]",
};

const phaseStatusIcons: Record<OperatingSignalFlowDetailPhaseStatus, ReactNode> = {
  done: <CheckCircle2 className="h-4 w-4" />,
  current: <CircleDashed className="h-4 w-4" />,
  blocked: <LockKeyhole className="h-4 w-4" />,
  waiting: <CircleDashed className="h-4 w-4" />,
  learned: <Sparkles className="h-4 w-4" />,
};

export function OperatingSignalDetailPage({
  english,
  model,
}: {
  english: boolean;
  model: OperatingSignalFlowDetailModel;
}) {
  return (
    <div
      className="workspace-surface-stack"
      data-testid="operating-signal-detail"
      data-signal-key={model.signalKey}
      data-data-posture={model.dataPosture}
    >
      <section className="workspace-shell-panel overflow-hidden rounded-lg border border-[color:var(--border-strong)]">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.28fr)_minmax(340px,0.72fr)]">
          <div className="space-y-4 px-5 py-5 md:px-6 md:py-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{model.eyebrow}</Badge>
              <Badge variant={model.blocker === "无阻塞" || model.blocker === "No blocker" ? "success" : "warning"}>
                {model.blocker}
              </Badge>
              <Badge variant="neutral">{english ? "read-only" : "只读"}</Badge>
            </div>

            <div className="max-w-4xl">
              <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-[color:var(--foreground)] md:text-[36px]">
                {model.title}
                <QuoteNote
                  label={english ? "Signal summary" : "信号摘要"}
                  note={model.summary}
                />
              </h1>
              <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-[color:var(--foreground)]">
                {model.family} · {model.state}
              </p>
            </div>

            <div className="flex flex-wrap gap-2" data-testid="operating-signal-actions">
              <Button asChild>
                <Link data-testid="operating-signal-primary-action" href={model.primaryAction.href}>
                  {model.primaryAction.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              {model.secondaryActions.slice(0, 1).map((action) => (
                <Button asChild key={action.href} variant="secondary">
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t border-[color:var(--border)] px-5 py-5 md:px-6 md:py-6 xl:border-l xl:border-t-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {model.quickFacts.map((fact) => (
                <div
                  className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3"
                  key={`${fact.label}-${fact.value}`}
                >
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {fact.label}
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold leading-6 text-[color:var(--foreground)]">
                    {fact.value}
                    <QuoteNote
                      label={english ? `${fact.label} detail` : `${fact.label}明细`}
                      note={fact.detail}
                    />
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="workspace-shell-panel rounded-lg border px-4 py-4 md:px-5 md:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {model.lifecycle.title}
                <QuoteNote
                  label={english ? "Lifecycle note" : "生命周期附注"}
                  note={model.lifecycle.detail}
                />
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                {model.source} → {model.object}
              </p>
            </div>
            <Badge variant="approval">{model.evidence}</Badge>
          </div>

          <div
            className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3"
            data-testid="operating-signal-lifecycle"
          >
            {model.lifecycle.phases.map((phase) => (
              <SignalLifecyclePhase
                english={english}
                key={phase.id}
                phase={phase}
              />
            ))}
          </div>
        </div>

        <aside className="grid gap-4">
          <section className="workspace-shell-panel rounded-lg border px-4 py-4">
            <p className="flex items-center text-sm font-semibold text-[color:var(--foreground)]">
              <LockKeyhole className="mr-2 h-4 w-4 text-[color:var(--accent-warm)]" />
              {model.currentStop.label}
            </p>
            <p className="mt-3 text-xl font-semibold leading-7 text-[color:var(--foreground)]">
              {model.currentStop.title}
            </p>
            <div className="mt-4 grid gap-2">
              <SignalTinyFact
                label={english ? "Blocker" : "阻塞"}
                note={model.currentStop.detail}
                value={model.currentStop.blocker}
              />
              <SignalTinyFact
                label={english ? "Evidence" : "证据"}
                note={model.currentStop.detail}
                value={model.currentStop.evidence}
              />
            </div>
          </section>

          <section className="workspace-shell-panel rounded-lg border px-4 py-4">
            <p className="flex items-center text-sm font-semibold text-[color:var(--foreground)]">
              <ShieldCheck className="mr-2 h-4 w-4 text-[color:var(--accent)]" />
              {english ? "AI work posture" : "AI 工作姿态"}
            </p>
            <div className="mt-3 grid gap-2">
              {model.aiPosture.map((item) => (
                <SignalTinyFact
                  key={`${item.label}-${item.value}`}
                  label={item.label}
                  note={item.detail}
                  value={item.value}
                />
              ))}
            </div>
          </section>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="workspace-shell-panel rounded-lg border px-4 py-4">
          <p className="flex items-center text-sm font-semibold text-[color:var(--foreground)]">
            <FileText className="mr-2 h-4 w-4 text-[color:var(--accent)]" />
            {english ? "Evidence refs" : "依据引用"}
          </p>
          <div className="mt-3 grid gap-2" data-testid="operating-signal-evidence">
            {model.evidenceRefs.length ? (
              model.evidenceRefs.map((item) => (
                <div
                  className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2"
                  key={`${item.label}-${item.value}`}
                >
                  <p className="text-xs text-[color:var(--muted-foreground)]">
                    {item.label}
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-[color:var(--foreground)]">
                    {item.value}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[color:var(--muted-foreground)]">
                {english ? "No reusable evidence reference yet." : "还没有可复用依据引用。"}
              </p>
            )}
          </div>
        </section>

        <section className="workspace-shell-panel rounded-lg border px-4 py-4">
          <p className="flex items-center text-sm font-semibold text-[color:var(--foreground)]">
            <Network className="mr-2 h-4 w-4 text-[color:var(--accent)]" />
            {english ? "Trace" : "处理轨迹"}
          </p>
          <div className="mt-3 grid gap-2" data-testid="operating-signal-event-trail">
            {model.eventTrail.slice(-4).map((event) => (
              <div
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3"
                key={event.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {event.title}
                    <QuoteNote
                      label={english ? `${event.title} trace` : `${event.title}轨迹`}
                      note={`${event.transition} · ${event.trace} · ${event.detail}`}
                    />
                  </p>
                  <span className="shrink-0 text-xs text-[color:var(--muted-foreground)]">
                    {event.timeLabel}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                  {event.source} → {event.object}
                </p>
              </div>
            ))}
          </div>
        </section>
      </section>

      <LazyDisclosure
        data-testid="operating-signal-boundary"
        title={english ? "Quote: boundary and secondary links" : "引用：边界与次级入口"}
      >
        <div className="space-y-4">
          <p className="text-sm leading-7 text-[color:var(--muted)]">
            {model.boundary}
          </p>
          <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">
            {model.fixtureBanner}
          </p>
          <div className="flex flex-wrap gap-2">
            {model.secondaryActions.map((action) => (
              <Button asChild key={action.href} size="sm" variant="secondary">
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </LazyDisclosure>
    </div>
  );
}

function SignalLifecyclePhase({
  english,
  phase,
}: {
  english: boolean;
  phase: OperatingSignalFlowDetailPhase;
}) {
  const primaryEvent = phase.events.at(-1);

  return (
    <div
      className={`min-h-36 rounded-lg border px-3 py-3 ${phaseStatusClasses[phase.status]}`}
      data-phase-status={phase.status}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--accent)]">
          {phaseStatusIcons[phase.status]}
        </span>
        <span className="rounded-full bg-[color:var(--surface)] px-2 py-1 text-[11px] font-semibold text-[color:var(--muted-foreground)]">
          {phase.statusLabel}
        </span>
      </div>
      <p className="mt-3 text-base font-semibold leading-6 text-[color:var(--foreground)]">
        {phase.label}
        <QuoteNote
          label={english ? `${phase.label} detail` : `${phase.label}明细`}
          note={`${phase.detail} ${phase.stateLabels.join(" / ")}`}
        />
      </p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
        {primaryEvent?.title ?? (english ? "Not reached" : "还未进入")}
      </p>
      <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
        {english ? "Events" : "节点"} {phase.count}
      </p>
    </div>
  );
}

function SignalTinyFact({
  label,
  note,
  value,
}: {
  label: string;
  note: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
      <p className="text-xs text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold leading-5 text-[color:var(--foreground)]">
        {value}
        <QuoteNote label={`${label} detail`} note={note} />
      </p>
    </div>
  );
}
