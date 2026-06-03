import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  FileText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { LazyDisclosure } from "@/components/shared/lazy-disclosure";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BusinessAssetDetailModel } from "@/features/business-assets/page-loader";

export function BusinessAssetDetailPage({
  model,
  english,
}: {
  model: BusinessAssetDetailModel;
  english: boolean;
}) {
  const ownerMetric = model.metrics.find((item) =>
    english ? item.label === "Owner" : item.label === "负责人",
  );
  const actionText = model.judgementChain.action.replace(
    english ? "Recommended move: " : "建议动作：",
    "",
  );
  const quickFacts = [
    {
      label: english ? "Current state" : "当前状态",
      value: `${model.statusLabel} · ${model.urgencyLabel}`,
    },
    {
      label: english ? "Why now" : "为什么现在",
      value: model.judgementChain.signal.replace(
        english ? "Signal: " : "信号：",
        "",
      ),
    },
    {
      label: english ? "Next move" : "下一步动作",
      value: actionText,
    },
    {
      label: english ? "Owner" : "负责人",
      value:
        ownerMetric?.value ??
        (english ? "Assign before handoff" : "交接前先指定负责人"),
    },
  ];
  const chainItems = [
    {
      label: english ? "Signal" : "信号",
      value: model.judgementChain.signal,
      icon: <CircleDot className="h-4 w-4" />,
    },
    {
      label: english ? "Judgement" : "判断",
      value: model.judgementChain.judgement,
      icon: <BrainCircuit className="h-4 w-4" />,
    },
    {
      label: english ? "Move" : "动作",
      value: model.judgementChain.action,
      icon: <ArrowRight className="h-4 w-4" />,
    },
    {
      label: english ? "Review" : "复核",
      value: model.judgementChain.review,
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      label: english ? "Memory" : "记忆",
      value: model.judgementChain.learn,
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
  ];

  return (
    <div
      className="workspace-surface-stack"
      data-source-page={`/assets/${model.type}/${model.id}`}
      data-business-asset-detail={model.type}
    >
      <PageHeader
        eyebrow={model.eyebrow}
        title={model.title}
        description={model.question}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={model.primaryAction.href}>
                {model.primaryAction.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {model.secondaryActions.slice(0, 1).map((action) => (
              <Button key={action.href} asChild variant="secondary">
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        }
      />

      <section className="workspace-shell-panel overflow-hidden rounded-[28px] border border-[color:var(--border-strong)]">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
          <div className="space-y-5 px-5 py-5 xl:px-6 xl:py-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{model.statusLabel}</Badge>
              <Badge variant="warning">{model.urgencyLabel}</Badge>
            </div>
            <div className="space-y-3">
              <p className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
                {english ? "Customer asset readout" : "客户资产速读"}
              </p>
              <p className="max-w-3xl text-base leading-8 text-[color:var(--muted)]">
                {model.summary}
              </p>
            </div>
            <div className="rounded-[22px] border border-[color:var(--status-success-border)]/20 bg-[color:var(--accent-success)]/[0.08] px-4 py-4">
              <p className="text-xs font-medium text-[color:var(--status-success-text)]">
                {english ? "Recommended next move" : "建议下一步"}
              </p>
              <p className="mt-2 text-lg font-semibold leading-8 text-[color:var(--foreground)]">
                {actionText}
              </p>
            </div>
          </div>

          <div className="border-t border-[color:var(--border)] px-5 py-5 xl:border-l xl:border-t-0 xl:px-6 xl:py-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {quickFacts.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="workspace-panel rounded-[20px] px-4 py-4"
                >
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {item.label}
                  </p>
                  <p className="mt-2 break-words text-sm font-semibold leading-6 text-[color:var(--foreground)]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="workspace-panel space-y-4 rounded-[28px] px-5 py-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[color:var(--accent)]" />
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              {english ? "Judgement path" : "判断路径"}
            </h2>
          </div>
          <div className="grid gap-3">
            {chainItems.map((item, index) => (
              <div
                key={item.label}
                className="grid gap-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4 md:grid-cols-[40px_minmax(0,1fr)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--surface-subtle)] text-[color:var(--accent)]">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {index + 1}. {item.label}
                  </p>
                  <p className="mt-1 break-words text-sm leading-7 text-[color:var(--foreground)]">
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="workspace-panel space-y-4 rounded-[28px] px-5 py-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[color:var(--accent)]" />
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              {english ? "Business signals" : "经营信号"}
            </h2>
          </div>
          {model.signals.length ? (
            <div className="grid gap-3">
              {model.signals.slice(0, 5).map((signal) => (
                <AssetSignalCard
                  key={`${signal.label}-${signal.title}-${signal.meta}`}
                  signal={signal}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={
                english
                  ? "No urgent signal is attached"
                  : "当前没有挂上紧急信号"
              }
              description={
                english
                  ? "Once meetings, CRM changes, promises, or risks mention this asset, they will appear here first."
                  : "会议、客户关系系统变化、承诺或风险一旦指向这个资产，会先出现在这里。"
              }
              presetTone="judgement"
            />
          )}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="workspace-panel-muted space-y-4 rounded-[28px] px-5 py-5">
          <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
            {english ? "Related business objects" : "关联经营对象"}
          </h2>
          {model.relationships.length ? (
            <div className="grid gap-3">
              {model.relationships.map((item) => (
                <Link
                  key={`${item.href}-${item.value}`}
                  href={item.href}
                  className="workspace-panel rounded-[20px] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                >
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--foreground)]">
                    {item.value}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-[color:var(--muted)]">
                    {item.description}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title={
                english
                  ? "No linked business object yet"
                  : "还没有关联经营对象"
              }
              description={
                english
                  ? "Connect a customer, opportunity, meeting, promise, or risk so this asset can stay readable."
                  : "关联客户、机会、会议、承诺或风险后，这个资产才会更容易判断。"
              }
              presetTone="neutral"
            />
          )}
        </div>

        <div className="workspace-panel-muted space-y-4 rounded-[28px] px-5 py-5">
          <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
            {english ? "Evidence" : "依据"}
          </h2>
          {model.evidence.length ? (
            <div className="grid gap-3">
              {model.evidence.slice(0, 4).map((item) => (
                <div
                  key={`${item.title}-${item.meta}`}
                  className="workspace-panel rounded-[20px] px-4 py-4"
                >
                  <p className="text-sm font-semibold leading-6 text-[color:var(--foreground)]">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                    {item.body}
                  </p>
                  <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                    {item.meta}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={english ? "No reusable evidence yet" : "还没有可复用依据"}
              description={
                english
                  ? "Capture a meeting, import a customer source, or confirm a promise to create evidence."
                  : "记录会议、接入客户来源或确认承诺后，这里会沉淀依据。"
              }
              presetTone="memory"
            />
          )}
        </div>
      </section>

      <LazyDisclosure
        title={english ? "Quote: boundary and secondary links" : "引用：边界与次级入口"}
        data-testid="business-asset-boundary-disclosure"
      >
        <div className="space-y-4">
          <p className="text-sm leading-7 text-[color:var(--muted)]">
            {model.boundary}
          </p>
          <div className="flex flex-wrap gap-2">
            {model.secondaryActions.map((action) => (
              <Button key={action.href} asChild variant="secondary" size="sm">
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </LazyDisclosure>
    </div>
  );
}

function AssetSignalCard({
  signal,
}: {
  signal: BusinessAssetDetailModel["signals"][number];
}) {
  const content = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{signal.label}</Badge>
        <span className="text-xs text-[color:var(--muted-foreground)]">
          {signal.meta}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--foreground)]">
        {signal.title}
      </p>
      <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
        {signal.body}
      </p>
    </>
  );

  if (signal.href) {
    return (
      <Link
        href={signal.href}
        className="workspace-panel rounded-[20px] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
      >
        {content}
      </Link>
    );
  }

  return <div className="workspace-panel rounded-[20px] px-4 py-4">{content}</div>;
}
