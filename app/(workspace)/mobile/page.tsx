/**
 * Helm Mobile Command Surface - First Screen
 *
 * Phase 2: Read Model Adapter
 * Reference: docs/product/HELM_MOBILE_COMMAND_SURFACE_REQUIREMENTS_V1.md
 *
 * This page provides a mobile-optimized first screen with:
 * - Workspace status header
 * - Hero judgement card from the top Must Push item
 * - Supplemental Ask Helm entry
 * - Supporting Must Push items from real data sources
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Camera,
  CheckSquare,
  ClipboardList,
  Compass,
  MemoryStick,
  MessageSquareText,
  Mic,
  Network,
} from "lucide-react";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import { interpretAskHelmQuery } from "@/features/search/ask-helm-interpreter";
import { resolveAskHelmAccessScope } from "@/features/search/ask-helm-access-scope";
import {
  adaptAskHelmResponseToMobile,
  getMobileGroundingSummary,
} from "@/features/mobile/lib/adapt-ask-helm-response";
import { getMobileCommandReadModel } from "@/features/mobile/lib/mobile-command-read-model";
import { WorkspaceStatus } from "@/features/mobile/components/workspace-status";
import { AskHelmInput } from "@/features/mobile/components/ask-helm-input";
import { MustPushList } from "@/features/mobile/components/must-push-list";
import { MobileCommandFooter } from "@/features/mobile/components/mobile-command-footer";
import { MobileHeroCard } from "@/features/mobile/components/mobile-hero-card";
import { OutcomeLedgerPanel } from "@/features/mobile/components/outcome-ledger-panel";
import type {
  MobileAskHelmResponse,
  MustPushItem,
  MustPushOutcomeLedgerSummary,
  WorkspaceStatus as WorkspaceStatusType,
} from "@/features/mobile/types";
import { buildMobileJudgementLoop } from "@/features/mobile/lib/mobile-judgement-loop";
import { searchWorkspaceEntities } from "@/features/search/queries";
import { buildAskHelmRelatedObjectsFromSearchResults } from "@/features/search/ask-helm-search-page-adapter";
import { buildOperatingSignalFlowSignalHref } from "@/lib/operating-signal-flow/projection";

interface MobilePageProps {
  searchParams: Promise<{
    q?: string;
  }>;
}

export default async function MobilePage({ searchParams }: MobilePageProps) {
  const session = await getCurrentWorkspaceSession();
  if (!session.workspace) {
    redirect("/login");
  }

  const { workspace, membership, user } = session;
  const { q } = await searchParams;
  const locale = await resolveWorkspaceUiLocaleForRequest({
    workspaceDefaultLocale: workspace.defaultLocale,
  });
  const english = locale === "en-US";
  const focusAreas = parseWorkspaceStringList(workspace.focusAreas);
  const accessScope = resolveAskHelmAccessScope({
    hasWorkspaceMembership: Boolean(membership),
    membershipRole: String(membership.role),
    workspaceProfileType: workspace.profileType,
    focusAreas,
  });

  // Load Must Push items from real data sources
  const readModel = await getMobileCommandReadModel({
    workspaceId: workspace.id,
    actorUserId: user.id,
    membershipRole: membership.role,
    workspaceClass: workspace.workspaceClass,
    english,
  });

  // Build workspace status from read model data
  const workspaceStatus: WorkspaceStatusType = {
    workspaceName: english ? "Today's customer work" : "今天的客户推进",
    todaySummary: readModel.todaySummary,
    topAlert: readModel.mustPushItems.find((i) => i.severity === "critical")
      ? (english ? "1 urgent" : "1 项紧急")
      : null,
    reviewCount: readModel.reviewCount,
    outcomeCheckpointCount: readModel.outcomeCheckpointCount,
  };

  const allItems = readModel.mustPushItems;
  const foldedCount = readModel.foldedCount;
  const hasCriticalFolded = readModel.hasCriticalFolded;
  const heroModel = buildMobileJudgementLoop({ items: allItems, english });
  const supportingItems = allItems.slice(1);
  const hasAskHelmQuery = Boolean(q?.trim());
  const highPressureCount = allItems.filter(
    (item) => item.severity === "critical" || item.severity === "high",
  ).length;
  const visiblePriorityItems = allItems.slice(0, 3);
  const signalLifecycleHref = buildOperatingSignalFlowSignalHref(
    "boundary:alias-f",
    "mobile",
  );

  // Handle Ask Helm query if present
  let askHelmResponse: MobileAskHelmResponse | null = null;
  let askHelmGroundingSummary: string | null = null;
  if (hasAskHelmQuery && q) {
    // Get related objects from search
    const searchResults = await searchWorkspaceEntities(workspace.id, q);
    const relatedObjects = buildAskHelmRelatedObjectsFromSearchResults(searchResults);

    // Interpret query
    const response = interpretAskHelmQuery({
      rawQuery: q,
      english,
      currentPage: "/mobile",
      relatedObjects,
      inputMode: "typed",
      workspaceContext: {
        workspaceId: workspace.id,
        workspaceSlug: workspace.slug,
        workspaceProfileType: workspace.profileType,
        membershipRole: String(membership.role),
        focusAreas,
        enabledFeatures: accessScope.featureAvailability.enabledFeatures,
        disabledFeatures: accessScope.featureAvailability.disabledFeatures,
      },
    });

    // Adapt to mobile format
    askHelmResponse = adaptAskHelmResponseToMobile({ response, english });
    askHelmGroundingSummary = getMobileGroundingSummary(response, english);
  }

  return (
    <div
      className="min-h-screen bg-[color:var(--background)] pb-safe"
      data-testid="mobile-command-surface"
    >
      <h1 className="sr-only">{english ? "Mobile command surface" : "移动工作台"}</h1>
      <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-4 lg:grid-cols-[minmax(0,280px)_minmax(380px,430px)_minmax(0,280px)] lg:items-start lg:px-6 lg:py-7">
        <MobileDesktopPriorityPanel
          english={english}
          items={visiblePriorityItems}
          highPressureCount={highPressureCount}
          reviewCount={readModel.reviewCount}
          foldedCount={foldedCount}
        />

        <div className="mx-auto w-full max-w-md overflow-hidden rounded-none border-0 bg-transparent pb-4 lg:sticky lg:top-5 lg:rounded-[32px] lg:border lg:border-[color:var(--border)] lg:bg-[color:var(--surface)] lg:shadow-[0_26px_80px_-54px_rgba(15,23,42,0.72)]">
        {/* Workspace Status Header */}
        <WorkspaceStatus status={workspaceStatus} english={english} />

        {/* Main Content */}
        <div className="px-4 py-4 space-y-6">
          {/* Hero Card — primary first-screen entry */}
          <MobileHeroCard model={heroModel} english={english} />

          <details
            className="group rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3"
            data-testid="mobile-secondary-work"
            open={hasAskHelmQuery}
          >
            <summary
              className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[color:var(--foreground)] marker:content-none [&::-webkit-details-marker]:hidden"
              data-testid="mobile-secondary-work-toggle"
            >
              <span>{english ? "Open evidence, signal capture and other work" : "展开证据、上报和其他事项"}</span>
              <span className="rounded-full bg-[color:var(--surface-subtle)] px-2.5 py-1 text-xs text-[color:var(--muted-foreground)]">
                {english ? "Details" : "详情"}
              </span>
            </summary>
            <div className="mt-4 space-y-5">
              {/* Outcome Ledger — review-safe result recovery, no external write implied. */}
              <OutcomeLedgerPanel ledger={readModel.outcomeLedger} english={english} />

              {/* Ask Helm — unified work question and signal intake area. */}
              <details id="ask-helm" className="group" open={hasAskHelmQuery}>
                <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[color:var(--muted)] list-none">
                  <span>{english ? "Ask or submit a signal" : "提问 / 上报信号"}</span>
                  <span className="ml-auto text-xs opacity-60 group-open:hidden">{english ? "expand" : "展开"}</span>
                </summary>
                <div className="mt-3">
                  <AskHelmInput
                    defaultValue={q ?? ""}
                    english={english}
                  />
                </div>
              </details>

              {!hasAskHelmQuery ? (
                <section
                  className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4"
                  data-testid="mobile-signal-capture-entry"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">
                        {english ? "Quick signal capture" : "快速上报经营信号"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                        {english
                          ? "Voice, screenshot, pasted notes and forwarded text should become review candidates first."
                          : "语音、截图、粘贴纪要和转发文本都先进入复核候选，不直接生成正式推进。"}
                      </p>
                    </div>
                    <span className="rounded-full bg-[color:var(--status-warning-bg)] px-2.5 py-1 text-xs font-medium text-[color:var(--status-warning-text)]">
                      {english ? "review-first" : "先复核"}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MobileWorkEntry
                      href="/search?mode=ask&input=voice#ask-helm-signal-intake"
                      icon={<Mic className="h-4 w-4" />}
                      label={english ? "Voice note" : "语音"}
                    />
                    <MobileWorkEntry
                      href="/search?mode=ask#ask-helm-signal-intake"
                      icon={<Camera className="h-4 w-4" />}
                      label={english ? "Screenshot" : "截图"}
                    />
                    <MobileWorkEntry
                      href="/search?mode=ask#ask-helm-signal-intake"
                      icon={<ClipboardList className="h-4 w-4" />}
                      label={english ? "Paste notes" : "粘贴纪要"}
                    />
                    <MobileWorkEntry
                      href="/search?mode=ask#ask-helm-signal-intake"
                      icon={<MessageSquareText className="h-4 w-4" />}
                      label={english ? "Forward text" : "转发文本"}
                    />
                  </div>
                </section>
              ) : null}

              {/* Ask Helm Response (if query present) */}
              {askHelmResponse && q && (
                <section
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4"
                  data-testid="mobile-ask-helm-answer"
                >
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <MessageSquareText className="h-4 w-4" />
                </div>
                <h2 className="font-semibold text-[color:var(--foreground)]">
                  {english ? "Helm" : "Helm"}
                </h2>
              </div>

              <p className="text-base font-semibold text-[color:var(--foreground)] mb-2">
                {askHelmResponse.judgement}
              </p>

              {askHelmResponse.reason && (
                <p className="text-sm text-[color:var(--muted)] mb-4">
                  {askHelmResponse.reason}
                </p>
              )}

              <Link
                href={askHelmResponse.primaryAction.href}
                className="theme-primary-action flex items-center justify-between w-full px-4 py-3 rounded-xl bg-[color:var(--accent)] text-[color:var(--accent-foreground)] font-medium"
              >
                <span>{askHelmResponse.primaryAction.label}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              {askHelmResponse.secondaryAction && (
                <Link
                  href={askHelmResponse.secondaryAction.href}
                  className="mt-2 flex items-center justify-center rounded-xl border border-[color:var(--border)] px-4 py-3 text-sm font-medium text-[color:var(--foreground)]"
                >
                  {askHelmResponse.secondaryAction.label}
                </Link>
              )}

              {/* Grounding info */}
              {(askHelmResponse.grounding.objectCount > 0 ||
                askHelmResponse.grounding.memoryUsed ||
                askHelmResponse.grounding.systemKnowledgeUsed) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {askHelmGroundingSummary && (
                    <span className="px-2 py-1 rounded-full bg-[color:var(--surface-subtle)] text-xs text-[color:var(--muted-foreground)]">
                      {askHelmGroundingSummary}
                    </span>
                  )}
                  {askHelmResponse.grounding.sourceLabels.map((label) => (
                    <span
                      key={label}
                      className="px-2 py-1 rounded-full bg-[color:var(--surface-subtle)] text-xs text-[color:var(--muted-foreground)]"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}

              {askHelmResponse.boundaryNote && (
                <div className="mt-3 p-3 rounded-xl bg-[color:var(--status-warning-bg)] border border-[color:var(--status-warning-border)]">
                  <p className="text-xs text-[color:var(--status-warning-text)]">
                    {askHelmResponse.boundaryNote.message}
                  </p>
                </div>
              )}
                </section>
              )}

              {/* Must Push Items — skip first item already shown in Hero */}
              {(supportingItems.length > 0 || foldedCount > 0) && (
                <section>
                  <MustPushList
                    items={supportingItems}
                    totalCount={readModel.totalCount}
                    foldedCount={foldedCount}
                    hasCriticalFolded={hasCriticalFolded}
                    english={english}
                  />
                </section>
              )}

              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={english ? "Work handoff" : "工作承接入口"}>
                <MobileWorkEntry
                  href="/approvals"
                  icon={<CheckSquare className="h-4 w-4" />}
                  label={english ? "Review" : "我的复核"}
                />
                <MobileWorkEntry
                  href="/memory"
                  icon={<MemoryStick className="h-4 w-4" />}
                  label={english ? "Evidence" : "证据"}
                />
                <MobileWorkEntry
                  href="/operating"
                  icon={<BriefcaseBusiness className="h-4 w-4" />}
                  label={english ? "Operate" : "今日推进"}
                />
                <MobileWorkEntry
                  href={signalLifecycleHref}
                  icon={<Network className="h-4 w-4" />}
                  label={english ? "Signal" : "信号链路"}
                />
              </section>
            </div>
          </details>
        </div>

        {/* Bottom spacer for mobile browser chrome */}
        <MobileCommandFooter
          english={english}
          items={[
            {
              href: "/mobile",
              label: english ? "Now" : "现在",
              icon: <Compass className="h-4 w-4" />,
              active: true,
            },
            {
              href: "/approvals",
              label: english ? "Review" : "复核",
              icon: <CheckSquare className="h-4 w-4" />,
            },
            {
              href: "/memory",
              label: english ? "Memory" : "记忆",
              icon: <MemoryStick className="h-4 w-4" />,
            },
            {
              href: "/operating",
              label: english ? "Operate" : "推进",
              icon: <BriefcaseBusiness className="h-4 w-4" />,
            },
          ]}
        />
        </div>

        <MobileDesktopOutcomePanel
          english={english}
          ledger={readModel.outcomeLedger}
        />
      </div>
    </div>
  );
}

function MobileDesktopPriorityPanel({
  english,
  items,
  highPressureCount,
  reviewCount,
  foldedCount,
}: {
  english: boolean;
  items: MustPushItem[];
  highPressureCount: number;
  reviewCount: number;
  foldedCount: number;
}) {
  const secondaryItems = dedupeMobilePriorityItems(items.slice(1)).slice(0, 2);

  return (
    <aside className="hidden space-y-3 lg:block" aria-label={english ? "Today priority" : "今日优先级"}>
      <section className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[0_18px_60px_-46px_rgba(15,23,42,0.5)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--mode-link)]">
          {english ? "Today first" : "今天先看"}
        </p>
        <p className="mt-3 text-2xl font-semibold leading-tight text-[color:var(--foreground)]">
          {items[0]?.title ?? (english ? "No urgent customer work" : "暂无紧急客户推进")}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <MobileDesktopStat
            label={english ? "Pressure" : "高压"}
            value={highPressureCount}
          />
          <MobileDesktopStat
            label={english ? "Review" : "复核"}
            value={reviewCount}
          />
          <MobileDesktopStat
            label={english ? "Folded" : "收起"}
            value={foldedCount}
          />
        </div>
      </section>

      {secondaryItems.length > 0 ? (
        <section className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {english ? "Other pressure" : "其他压力"}
          </p>
          <div className="mt-3 space-y-3">
            {secondaryItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-[color:var(--foreground)]">
                    {item.title}
                  </p>
                  <span className="shrink-0 rounded-full bg-[color:var(--surface-subtle)] px-2 py-1 text-[11px] font-medium text-[color:var(--muted-foreground)]">
                    {formatMobileSeverity(item.severity, english)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                  {item.reason}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function dedupeMobilePriorityItems(items: MustPushItem[]) {
  const seen = new Set<string>();
  const uniqueItems: MustPushItem[] = [];

  for (const item of items) {
    const key = `${item.title}::${item.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

function formatMobileSeverity(
  severity: MustPushItem["severity"],
  english: boolean,
) {
  const labels: Record<MustPushItem["severity"], { zh: string; en: string }> = {
    critical: { zh: "紧急", en: "Urgent" },
    high: { zh: "高压", en: "High" },
    medium: { zh: "需跟进", en: "Follow-up" },
    low: { zh: "观察", en: "Watch" },
  };

  return english ? labels[severity].en : labels[severity].zh;
}

function MobileDesktopOutcomePanel({
  english,
  ledger,
}: {
  english: boolean;
  ledger: MustPushOutcomeLedgerSummary;
}) {
  const nextItem = ledger.items.find((item) => item.reviewHref) ?? ledger.items[0] ?? null;

  return (
    <aside className="hidden space-y-3 lg:block" aria-label={english ? "Outcome recovery" : "结果回收"}>
      <section className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[0_18px_60px_-46px_rgba(15,23,42,0.5)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--mode-link)]">
              {english ? "Outcome" : "结果回收"}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
              {ledger.dueCount}
            </p>
          </div>
          <span className="rounded-full bg-[color:var(--status-warning-bg)] px-2.5 py-1 text-xs font-medium text-[color:var(--status-warning-text)]">
            {english ? "review-safe" : "先人审"}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
          {ledger.summary}
        </p>
      </section>

      {nextItem ? (
        <section className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {english ? "Next check" : "下一条回收"}
          </p>
          <p className="mt-3 text-base font-semibold leading-6 text-[color:var(--foreground)]">
            {nextItem.title}
          </p>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
            <span>{nextItem.dueHint}</span>
            <span>{nextItem.expectedSignal}</span>
          </div>
          {nextItem.reviewHref ? (
            <Link
              href={nextItem.reviewHref}
              className="mt-4 inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm font-medium text-[color:var(--mode-link)]"
            >
              {english ? "Open review" : "进入复核"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </section>
      ) : null}

      <details className="group rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[color:var(--muted-foreground)]">
          <span>{english ? "Boundary" : "边界"}</span>
          <span className="text-lg leading-none">&quot;</span>
        </summary>
        <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
          {ledger.boundaryNote}
        </p>
      </details>
    </aside>
  );
}

function MobileDesktopStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 py-3">
      <p className="text-lg font-semibold text-[color:var(--foreground)]">{value}</p>
      <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">{label}</p>
    </div>
  );
}

function MobileWorkEntry({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4 text-sm font-medium text-[color:var(--foreground)] transition active:scale-[0.98]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-[16px] bg-[color:var(--surface)] text-[color:var(--accent)]">
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}

function parseWorkspaceStringList(value?: string | null) {
  if (!value?.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    }
  } catch {
    // Fall back to plain text parsing for older workspace records.
  }

  return value
    .split(/[,，\n]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}
