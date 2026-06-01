import Link from "next/link";
import {
  Bot,
  CircleAlert,
  Gauge,
  LockKeyhole,
  Network,
} from "lucide-react";
import fixturePack from "@/evals/operating-signal-flow/signal-flow-cases.json";
import type { OperatingSignalFlowFixturePack } from "@/lib/operating-signal-flow/contract";
import { isEnglishLocale, type UiLocale } from "@/lib/i18n/config";
import {
  buildOperatingSignalFlowDisplayModel,
  type OperatingSignalFlowStageStatus,
} from "@/lib/operating-signal-flow/projection";
import { QuoteNote } from "@/features/internal-operating-workspace/operating-signal-flow-quote-note";

// Shared with the offline eval: this keeps the UI prototype fixture-backed, not runtime-backed.
const flowFixturePack = fixturePack as OperatingSignalFlowFixturePack;

const statusClasses: Record<OperatingSignalFlowStageStatus, string> = {
  flowing:
    "border-[color:color-mix(in_oklab,var(--accent-success)_38%,var(--border)_62%)] bg-[color:color-mix(in_oklab,var(--surface)_82%,rgb(16,185,129)_18%)]",
  review:
    "border-[color:color-mix(in_oklab,var(--accent-warm)_42%,var(--border)_58%)] bg-[color:color-mix(in_oklab,var(--surface)_82%,rgb(245,158,11)_18%)]",
  blocked:
    "border-[color:color-mix(in_oklab,var(--accent-danger)_46%,var(--border)_54%)] bg-[color:color-mix(in_oklab,var(--surface)_84%,rgb(239,68,68)_16%)]",
  learned:
    "border-[color:color-mix(in_oklab,var(--accent)_34%,var(--border)_66%)] bg-[color:color-mix(in_oklab,var(--surface)_84%,rgb(14,165,233)_16%)]",
};

export function buildOperatingSignalFlowDisplay(locale: UiLocale) {
  return buildOperatingSignalFlowDisplayModel(flowFixturePack, locale);
}

export function OperatingSignalFlowMap({ locale }: { locale: UiLocale }) {
  const english = isEnglishLocale(locale);
  const display = buildOperatingSignalFlowDisplay(locale);
  const sourceItem = display.journey.summaryItems[0];
  const nextItem = display.journey.summaryItems.at(-1);
  const primaryTitle = display.selectedPressure?.title ?? display.journey.title;
  const primaryNote = display.selectedPressure?.note ?? display.journey.subtitle;
  const primarySource = display.selectedPressure?.source ?? sourceItem?.value ?? display.windowLabel;
  const primaryBlocker =
    display.selectedPressure?.blocker ?? (english ? "ready for review" : "等待判断");
  const primaryEvidence = display.selectedPressure?.evidence ?? nextItem?.detail ?? display.windowLabel;
  const primaryHref = display.selectedPressure?.href ?? "/approvals";
  const primarySafetyLabels = english
    ? ["For judgement", "Not sent", "Human review required"]
    : ["仅供判断", "未外发", "需人工复核"];
  const otherPressureSignals = display.pressureSignals.slice(1, 4);

  return (
    <section
      aria-label={english ? "Operating signal flow" : "经营信号流"}
      className="signal-flow-map workspace-shell-panel relative overflow-hidden rounded-lg border px-4 py-4 text-[color:var(--foreground)] md:px-5 md:py-5"
      data-operating-signal-flow-map="true"
      data-animation-policy={display.animationPolicy}
      data-fixture-prototype="fixture 原型"
      data-posture={display.dataPosture}
    >
      <div className="signal-flow-map-grid" aria-hidden="true" />
      <div className="relative grid gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-7 items-center rounded-full border border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border)_72%)] bg-[color:color-mix(in_oklab,var(--accent-soft)_62%,var(--surface)_38%)] px-3 text-xs font-semibold text-[color:var(--foreground)]">
              <Network className="mr-1.5 h-3.5 w-3.5 text-[color:var(--accent)]" />
              {english ? "Customer asset" : "客户经营资产"}
            </span>
            <span className="inline-flex min-h-7 items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "read-only review" : "只读复核"}
              <QuoteNote
                label={english ? "Fixture note" : "只读附注"}
                note={display.fixtureBanner}
              />
            </span>
          </div>
          <h2 className="mt-3 max-w-3xl text-2xl font-semibold leading-tight text-[color:var(--foreground)] md:text-3xl">
            {english ? "Judge this customer move first" : "先判断这条客户动作"}
            <QuoteNote label={english ? "Summary note" : "摘要附注"} note={display.summary} />
          </h2>
        </div>

        <div
          className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_94%,var(--surface-subtle)_6%)] px-3 py-3 md:px-4 md:py-4"
          data-testid="signal-flow-lifecycle-graph"
        >
          <div
            aria-label={english ? "Customer signal process" : "客户信号过程"}
            className="signal-flow-track"
            data-testid="signal-flow-visible-track"
          >
            {display.lifecycle.phases.map((phase, index) => {
              const edgePosture = phase.status === "learned" ? "flowing" : phase.status;

              return (
                <div className="signal-flow-track-item" key={phase.id}>
                  <div
                    className={`signal-flow-node rounded-lg border px-3 py-2 ${statusClasses[phase.status]}`}
                    data-status={phase.status}
                  >
                    <p className="text-sm font-semibold leading-5 text-[color:var(--foreground)]">
                      {phase.label}
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                      {phase.count}
                    </p>
                  </div>
                  {index < display.lifecycle.phases.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="signal-flow-edge"
                      data-posture={edgePosture}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          <div
            className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]"
            data-testid="signal-flow-business-summary"
          >
            <div className="min-w-0 rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border)_76%)] bg-[color:color-mix(in_oklab,var(--surface)_88%,var(--accent-soft)_12%)] p-4">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Highest pressure today" : "今天最高压力"}
              </p>
              <h3 className="mt-2 text-2xl font-semibold leading-8 text-[color:var(--foreground)]">
                {primaryTitle}
                <QuoteNote
                  label={english ? "Pressure note" : "判断附注"}
                  note={primaryNote}
                />
              </h3>
              <div
                className="mt-3 flex flex-wrap gap-2"
                data-testid="signal-flow-primary-safety-labels"
              >
                {primarySafetyLabels.map((label) => (
                  <span
                    className="inline-flex min-h-7 items-center rounded-full border border-[color:color-mix(in_oklab,var(--accent-warm)_34%,var(--border)_66%)] bg-[color:color-mix(in_oklab,var(--surface)_78%,rgb(245,158,11)_22%)] px-2.5 text-xs font-semibold text-[color:var(--foreground)]"
                    key={label}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted-foreground)]">
                {primaryBlocker} · {primarySource}
              </p>

              <div className="mt-4 grid gap-2 md:grid-cols-3">
                <SignalFact
                  label={english ? "Customer material" : "客户材料"}
                  note={sourceItem?.detail ?? primarySource}
                  noteLabel={english ? "Customer material detail" : "客户材料明细"}
                  value={primarySource}
                />
                <SignalFact
                  label={english ? "Stop reason" : "停住原因"}
                  note={primaryNote}
                  noteLabel={english ? "Stop reason detail" : "停住原因明细"}
                  value={primaryBlocker}
                />
                <SignalFact
                  label={english ? "Next action" : "下一步"}
                  note={primaryEvidence}
                  noteLabel={english ? "Next action detail" : "下一步明细"}
                  value={nextItem?.value ?? (english ? "open review" : "打开复核")}
                />
              </div>

              <div className="mt-4" data-testid="signal-flow-actions">
                <Link
                  href={primaryHref}
                  className="theme-primary-action inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold"
                >
                  {english ? "Open signal lifecycle" : "查看信号全链路"}
                </Link>
              </div>
            </div>

            <aside
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
              data-testid="signal-flow-control-posture"
            >
              <p className="flex items-center text-sm font-semibold text-[color:var(--foreground)]">
                <Bot className="mr-2 h-4 w-4 text-[color:var(--accent)]" />
                {english ? "AI work posture" : "AI 工作姿态"}
              </p>
              <div className="mt-3 grid gap-2 text-sm">
                <p className="rounded-md border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_88%,var(--surface-subtle)_12%)] px-3 py-2 font-semibold text-[color:var(--foreground)]">
                  {english ? "Evidence ready" : "证据已整理"} · {primaryEvidence}
                </p>
                <p
                  className="rounded-md border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_88%,var(--surface-subtle)_12%)] px-3 py-2 font-semibold text-[color:var(--foreground)]"
                  data-testid="signal-flow-boundary"
                >
                  <LockKeyhole className="mr-1.5 inline h-3.5 w-3.5 text-[color:var(--accent-warm)]" />
                  {english ? "Held for review" : "停在人工复核"}
                  <QuoteNote
                    label={english ? "Guardrail note" : "保护线附注"}
                    note={display.boundary}
                  />
                </p>
              </div>
            </aside>
          </div>

          <div
            className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2 md:grid-cols-3"
            data-testid="signal-flow-control-layer"
          >
            <details
              className="rounded-md border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_90%,var(--surface-subtle)_10%)] px-3 py-3"
              data-testid="signal-flow-process-section"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--foreground)]">
                <Gauge className="mr-2 inline h-4 w-4 text-[color:var(--accent)]" />
                {english ? "Process" : "经营过程"}
                <span className="ml-2 text-xs font-medium text-[color:var(--muted-foreground)]">
                  {display.lifecycle.phases.length}
                </span>
              </summary>
              <div className="mt-3 grid gap-2" data-testid="signal-flow-process-spine">
                {display.lifecycle.phases.map((phase) => (
                  <div
                    className={`rounded-md border px-3 py-2 ${statusClasses[phase.status]}`}
                    data-status={phase.status}
                    key={phase.id}
                  >
                    <span className="text-sm font-semibold text-[color:var(--foreground)]">
                      {phase.label}
                    </span>
                    <span className="ml-2 text-xs text-[color:var(--muted-foreground)]">
                      {phase.count}
                    </span>
                    <QuoteNote
                      label={english ? `${phase.label} note` : `${phase.label}附注`}
                      note={`${phase.detail} ${phase.stateLabels.join(" / ")}`}
                    />
                  </div>
                ))}
              </div>
            </details>

            <details
              className="rounded-md border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_90%,var(--surface-subtle)_10%)] px-3 py-3"
              data-testid="signal-flow-control-paths"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--foreground)]">
                <CircleAlert className="mr-2 inline h-4 w-4 text-[color:var(--accent-danger)]" />
                {english ? "Other pressure" : "其他压力"}
                <span className="ml-2 text-xs font-medium text-[color:var(--muted-foreground)]">
                  {display.pressureSignals.length}
                </span>
              </summary>
              <div className="mt-3 grid gap-2">
                {otherPressureSignals.map((signal) => (
                  <Link
                    href={signal.href}
                    className="signal-flow-pressure-row rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-xs font-medium text-[color:var(--foreground)]"
                    data-status={signal.status}
                    key={signal.id}
                  >
                    {signal.label}
                    <QuoteNote
                      label={english ? `${signal.label} detail` : `${signal.label}明细`}
                      note={`${signal.blocker} · ${signal.source} · ${signal.evidence}`}
                    />
                  </Link>
                ))}
              </div>
            </details>

            <div
              className="rounded-md border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_90%,var(--surface-subtle)_10%)] px-3 py-3"
              data-testid="signal-flow-family-evolution"
            >
              <div className="flex items-start justify-between gap-2">
                <details
                  className="min-w-0 flex-1"
                  data-testid="signal-flow-family-evolution-details"
                >
                  <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--foreground)]">
                    {display.lifecycle.evolutionTitle}
                    <span className="ml-2 text-xs font-medium text-[color:var(--muted-foreground)]">
                      {display.lifecycle.familyEvolution.length}
                    </span>
                  </summary>
                  <div className="mt-3 grid gap-2">
                    {display.lifecycle.familyEvolution.map((row) => (
                      <div
                        className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2"
                        data-testid="signal-flow-family-row"
                        key={row.id}
                      >
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {row.label}
                          <span className="ml-2 text-xs text-[color:var(--muted-foreground)]">
                            {row.count}
                          </span>
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                          {row.objectSummary}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
                <QuoteNote
                  label={english ? "Asset evolution note" : "资产演进附注"}
                  note={display.lifecycle.evolutionDetail}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SignalFact({
  label,
  note,
  noteLabel,
  value,
}: {
  label: string;
  note: string;
  noteLabel: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
      <p className="text-[11px] font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-[color:var(--foreground)]">
        {value}
        <QuoteNote label={noteLabel} note={note} />
      </p>
    </div>
  );
}
