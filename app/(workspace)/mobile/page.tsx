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
import type { WorkspaceStatus as WorkspaceStatusType, MobileAskHelmResponse } from "@/features/mobile/types";
import { buildMobileJudgementLoop } from "@/features/mobile/lib/mobile-judgement-loop";
import { searchWorkspaceEntities } from "@/features/search/queries";
import { buildAskHelmRelatedObjectsFromSearchResults } from "@/features/search/ask-helm-search-page-adapter";

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
      {/* Constrain width on desktop for mobile preview */}
      <div className="mx-auto max-w-md pb-4">
        {/* Workspace Status Header */}
        <WorkspaceStatus status={workspaceStatus} english={english} />

        {/* Main Content */}
        <div className="px-4 py-4 space-y-6">
          {/* Hero Card — primary first-screen entry */}
          <MobileHeroCard model={heroModel} english={english} />

          {/* Outcome Ledger — review-safe result recovery, no external write implied. */}
          <OutcomeLedgerPanel ledger={readModel.outcomeLedger} english={english} />

          {/* Ask Helm — unified work question and signal intake area. */}
          <details id="ask-helm" className="group">
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

          <section className="grid grid-cols-3 gap-3" aria-label={english ? "Work handoff" : "工作承接入口"}>
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
          </section>
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
