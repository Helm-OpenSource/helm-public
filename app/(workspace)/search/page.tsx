import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Handshake,
  ListChecks,
  MessageSquareText,
  Mic,
  Orbit,
  Search,
  ShieldCheck,
  Users,
  Volume2,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { RiskBadge } from "@/components/shared/risk-badge";
import { StageBadge } from "@/components/shared/status-badges";
import { SupportSurfaceNote } from "@/components/shared/support-surface-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatMeetingDisplayText } from "@/features/meetings/display-copy";
import { formatRoleDetailDisplayText } from "@/lib/presentation/role-detail-display-copy";
import { resolveAskHelmAccessScope } from "@/features/search/ask-helm-access-scope";
import { interpretAskHelmQuery } from "@/features/search/ask-helm-interpreter";
import type {
  AskHelmGroundedObject,
  AskHelmResponse,
} from "@/features/search/ask-helm-interpreter";
import {
  assembleAskHelmRuntimeContext,
  type AskHelmRuntimeContextAssembly,
  type AskHelmRuntimeContextLayer,
} from "@/features/search/ask-helm-runtime-context";
import { buildAskHelmRelatedObjectsFromSearchResults } from "@/features/search/ask-helm-search-page-adapter";
import {
  buildAskHelmBusinessSignalsFromRecords,
  buildAskHelmMemorySummariesFromFacts,
  mergeAskHelmGroundedObjects,
  selectAskHelmBusinessSignalsForQuestion,
  type AskHelmBusinessSignalDraft,
} from "@/features/search/ask-helm-business-signals";
import { classifyAskHelmQueryIntent } from "@/features/search/ask-helm-query-intent";
import {
  buildEmptyAskHelmBusinessContextRecords,
  loadAskHelmBusinessContextRecords,
} from "@/features/search/ask-helm-business-context-queries";
import { submitAskHelmSignalCandidateFormAction } from "@/features/search/ask-helm-signal-candidate-actions";
import {
  loadRecentAskHelmSignalCandidatesForWorkspace,
  type AskHelmSignalCandidateAuditEntry,
} from "@/features/search/ask-helm-signal-candidate-queries";
import { resolveOptionalSearchReadModel } from "@/features/search/optional-read-model";
import {
  formatAskHelmBoundaryTypeLabel,
  formatAskHelmIntentTypeLabel,
  formatAskHelmObjectTypeLabel,
  formatAskHelmRelatedObjectStatus,
  formatAskHelmRetrievalSourceLabel,
} from "@/features/search/display-copy";
import {
  buildEmptySearchWorkspaceEntitiesResult,
  searchWorkspaceEntities,
} from "@/features/search/queries";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import { getLocalizedOpportunityTypeLabels } from "@/lib/i18n/labels";
import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";
import { formatDateLabel, trimText } from "@/lib/utils";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    mode?: string;
    input?: string;
    transcriptConfirmed?: string;
    voiceConfidence?: string;
    signalSubmitted?: string;
    signalError?: string;
  }>;
}) {
  const session = await getCurrentWorkspaceSession();
  const { workspace, membership } = session;
  const locale = await resolveWorkspaceUiLocaleForRequest({
    workspaceDefaultLocale: workspace.defaultLocale,
  });
  const english = locale === "en-US";
  const opportunityTypeLabels = getLocalizedOpportunityTypeLabels(locale);
  const {
    q = "",
    mode,
    input,
    transcriptConfirmed,
    voiceConfidence,
    signalSubmitted,
    signalError,
  } = await searchParams;
  const activeMode = mode === "ask" ? "ask" : "object";
  const askMode = activeMode === "ask";
  const inputMode = askMode && input === "voice" ? "voice" : "typed";
  const voiceTranscriptConfidence =
    voiceConfidence === "high" || voiceConfidence === "low"
      ? voiceConfidence
      : "medium";
  const fallbackResults = buildEmptySearchWorkspaceEntitiesResult();
  const searchReadModel = q.trim()
    ? await resolveOptionalSearchReadModel(
        searchWorkspaceEntities(workspace.id, q),
        fallbackResults,
      )
    : { data: fallbackResults, degraded: false, reason: "ready" as const };
  const results = searchReadModel.data;
  const searchRelatedObjects = buildAskHelmRelatedObjectsFromSearchResults(results);
  const focusAreas = parseWorkspaceStringList(workspace.focusAreas);
  const shouldLoadAskBusinessContext = askMode && Boolean(q.trim());
  const businessContextReadModel = shouldLoadAskBusinessContext
    ? await resolveOptionalSearchReadModel(
        loadAskHelmBusinessContextRecords(workspace.id),
        buildEmptyAskHelmBusinessContextRecords(),
      )
    : {
        data: buildEmptyAskHelmBusinessContextRecords(),
        degraded: false,
        reason: "ready" as const,
      };
  const workspaceBusinessSignals = shouldLoadAskBusinessContext
    ? buildAskHelmBusinessSignalsFromRecords({
        workspaceId: workspace.id,
        opportunities: businessContextReadModel.data.opportunities,
        pendingApprovals: businessContextReadModel.data.pendingApprovals,
        memoryFacts: businessContextReadModel.data.memoryFacts,
      })
    : [];
  const askIntent = askMode && q.trim() ? classifyAskHelmQueryIntent(q) : null;
  const businessSignals =
    askIntent && shouldLoadAskBusinessContext
      ? selectAskHelmBusinessSignalsForQuestion({
          intentType: askIntent.intentType,
          signals: workspaceBusinessSignals,
          searchRelatedObjects,
        })
      : [];
  const memorySummaries = shouldLoadAskBusinessContext
    ? buildAskHelmMemorySummariesFromFacts(
        businessContextReadModel.data.memoryFacts,
      )
    : [];
  const recentSignalCandidatesReadModel = askMode
    ? await resolveOptionalSearchReadModel(
        loadRecentAskHelmSignalCandidatesForWorkspace(workspace.id),
        [],
      )
    : { data: [], degraded: false, reason: "ready" as const };
  const signalGroundedObjects = businessSignals
    .map((signal) => signal.object)
    .filter((object): object is AskHelmGroundedObject => Boolean(object));
  const relatedObjects = askMode
    ? mergeAskHelmGroundedObjects([
        ...searchRelatedObjects,
        ...signalGroundedObjects,
      ])
    : searchRelatedObjects;
  const accessScope = resolveAskHelmAccessScope({
    hasWorkspaceMembership: Boolean(membership),
    membershipRole: String(membership.role),
    workspaceProfileType: workspace.profileType,
    focusAreas,
  });
  const askResponse =
    askMode && q
      ? interpretAskHelmQuery({
          rawQuery: q,
          currentPage: "/search",
          relatedObjects,
          memorySummary: memorySummaries
            .filter((memory) => memory.status === "reviewed_active")
            .map((memory) => memory.summaryToken),
          businessSignals,
          inputMode,
          transcriptConfirmed: transcriptConfirmed === "true",
          voiceTranscriptConfidence,
          workspaceContext: {
            workspaceId: workspace.id,
            workspaceSlug: workspace.slug,
            workspaceProfileType: workspace.profileType,
            membershipRole: String(membership.role),
            focusAreas,
            enabledFeatures: accessScope.featureAvailability.enabledFeatures,
            disabledFeatures: accessScope.featureAvailability.disabledFeatures,
          },
        })
      : null;
  const runtimeContext =
    askMode && q && askResponse
      ? assembleAskHelmRuntimeContext({
          rawQuery: q,
          workspace: {
            workspaceId: workspace.id,
            workspaceSlug: workspace.slug,
            membershipRole: String(membership.role),
            focusAreas,
          },
          response: askResponse,
          relatedObjects,
          inputMode,
          transcriptConfirmed: transcriptConfirmed === "true",
          transcriptConfidence: voiceTranscriptConfidence,
          searchDegraded: searchReadModel.degraded,
          businessSignals,
          memoryCandidates: memorySummaries,
        })
      : null;
  const displayText = (value: string | null | undefined) =>
    formatRoleDetailDisplayText(value, english);
  const total =
    results.contacts.length +
    results.companies.length +
    results.opportunities.length +
    results.meetings.length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={english ? "Find or ask" : "搜索 · 直接提问"}
        title={
          q
            ? english
              ? askMode
                ? `Ask about "${q}"`
                : `Search "${q}"`
              : askMode
                ? `提问 “${q}”`
                : `搜索 “${q}”`
            : english
              ? "Find customers, opportunities, meetings, or ask for the next step"
              : "找客户、机会、会议；需要判断就提问"
        }
        description={
          english
            ? "Search opens the source page. Questions return sources and a next step; nothing is sent or changed here."
            : "先定位对象，再进入对应页面处理；提问只返回来源和下一步，不外发、不改状态。"
        }
      />

      <SearchModeForm
        q={q}
        activeMode={activeMode}
        inputMode={inputMode}
        english={english}
      />

      {searchReadModel.degraded ? (
        <SearchReadModelStatus reason={searchReadModel.reason} english={english} />
      ) : null}

      <SupportSurfaceNote
        label={english ? "Path note" : "路径附注"}
        title={
          english
            ? "Pick the path by what you need next."
            : "按你下一步要做什么来选。"
        }
        summary={
          english
            ? "Know the object? Search. Need a judgement? Ask, then open the linked business page."
            : "知道对象就搜索；需要判断就提问，然后进入给出的业务页面。"
        }
        items={[
          {
            label: english ? "Object search" : "对象搜索",
            value: english
              ? "Contacts, companies, opportunities, meetings — straight to the right page."
              : "联系人 · 公司 · 机会 · 会议——一步到达对应页面。",
          },
          {
            label: english ? "Ask" : "提问",
            value: english
              ? "Read-only answers with citations. Never sends, never modifies, never decides for you."
              : "只读回答，附引用来源。绝不发送、绝不改写、绝不替你决策。",
          },
          {
            label: english ? "Where to actually act" : "真正动手在哪",
            value: english
              ? "Search and Ask both end in a link. Click through to the page where the work happens."
              : "搜索和提问最后都会给一个链接。点进去那个页面才是真正做事的地方。",
          },
        ]}
      />

      {askMode ? (
        <AskHelmMode
          q={q}
          response={askResponse}
          relatedObjects={relatedObjects}
          runtimeContext={runtimeContext}
          searchDegraded={searchReadModel.degraded}
          inputMode={inputMode}
          english={english}
          businessSignals={businessSignals}
          businessContextDegraded={businessContextReadModel.degraded}
          recentSignalCandidates={recentSignalCandidatesReadModel.data}
          signalCandidatesDegraded={recentSignalCandidatesReadModel.degraded}
          signalSubmitted={signalSubmitted === "true"}
          signalError={signalError}
        />
      ) : !q ? (
        <EmptyState
          icon={Search}
          title={english ? "Type a name, a deal, or a question" : "输入名字、机会，或者一句问题"}
          description={
            english
              ? "Vivian, Acme renewal, last week's product call — or 'who's gone cold this week?'"
              : "「Vivian」、「Acme 续约」、「上周的产品会」——或者直接问「这周哪些客户在沉默」。"
          }
        />
      ) : total === 0 ? (
        <EmptyState
          icon={Search}
          title={english ? "No matching result" : "没有找到匹配结果"}
          description={
            english
              ? "Try another keyword, or create the object directly from the top quick-create entry."
              : "可以换一个关键词，或者直接用顶部快速创建补齐这个对象。"
          }
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ResultStat
              label={english ? "Contacts" : "联系人"}
              value={results.contacts.length}
              href="#search-contacts"
            />
            <ResultStat
              label={english ? "Companies" : "公司"}
              value={results.companies.length}
              href="#search-companies"
            />
            <ResultStat
              label={english ? "Opportunities" : "机会"}
              value={results.opportunities.length}
              href="#search-opportunities"
            />
            <ResultStat
              label={english ? "Meetings" : "会议"}
              value={results.meetings.length}
              href="#search-meetings"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card id="search-contacts">
              <CardHeader>
                <CardTitle>{english ? "Contacts" : "联系人"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.contacts.length ? (
                  results.contacts.map((contact) => (
                    <Link
                      key={contact.id}
                      href={`/contacts/${contact.id}`}
                      aria-label={
                        english
                          ? `Open contact: ${contact.name}`
                          : `打开联系人：${contact.name}`
                      }
                      className="block rounded-2xl border border-[color:var(--border)] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                        <p className="font-medium text-[color:var(--foreground)]">
                          {contact.name}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                        {displayText(contact.title) ||
                          (english ? "No title" : "未填写职位")}{" "}
                        ·{" "}
                        {contact.company?.name ??
                          (english ? "Independent contact" : "独立联系人")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {contact.opportunities
                          .slice(0, 2)
                          .map((opportunity) => (
                            <Badge key={opportunity.id} variant="info">
                              {opportunity.title}
                            </Badge>
                          ))}
                      </div>
                    </Link>
                  ))
                ) : (
                  <InlineEmpty
                    label={
                      english ? "No matching contacts" : "没有匹配的联系人"
                    }
                  />
                )}
              </CardContent>
            </Card>

            <Card id="search-companies">
              <CardHeader>
                <CardTitle>{english ? "Companies" : "公司"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.companies.length ? (
                  results.companies.map((company) => (
                    <Link
                      key={company.id}
                      href={`/companies/${company.id}`}
                      aria-label={
                        english
                          ? `Open company: ${company.name}`
                          : `打开公司：${company.name}`
                      }
                      className="block rounded-2xl border border-[color:var(--border)] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                        <p className="font-medium text-[color:var(--foreground)]">
                          {company.name}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                        {company.industry ??
                          (english ? "No industry yet" : "未填写行业")}
                      </p>
                      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                        {trimText(
                          formatSeededBusinessCopy(
                            company.description,
                            english,
                          ),
                        )}
                      </p>
                    </Link>
                  ))
                ) : (
                  <InlineEmpty
                    label={english ? "No matching companies" : "没有匹配的公司"}
                  />
                )}
              </CardContent>
            </Card>

            <Card id="search-opportunities">
              <CardHeader>
                <CardTitle>{english ? "Opportunities" : "机会"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.opportunities.length ? (
                  results.opportunities.map((opportunity) => (
                    <Link
                      key={opportunity.id}
                      href={`/opportunities?opportunityId=${opportunity.id}`}
                      aria-label={
                        english
                          ? `Open opportunity: ${opportunity.title}`
                          : `打开机会：${opportunity.title}`
                      }
                      className="block rounded-2xl border border-[color:var(--border)] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Orbit className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                            <p className="font-medium text-[color:var(--foreground)]">
                              {opportunity.title}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="default">
                              {opportunityTypeLabels[opportunity.type]}
                            </Badge>
                            <StageBadge stage={opportunity.stage} />
                          </div>
                        </div>
                        <RiskBadge risk={opportunity.riskLevel} />
                      </div>
                      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                        {trimText(
                          formatSeededBusinessCopy(
                            opportunity.nextAction,
                            english,
                          ),
                        )}
                      </p>
                    </Link>
                  ))
                ) : (
                  <InlineEmpty
                    label={
                      english ? "No matching opportunities" : "没有匹配的机会"
                    }
                  />
                )}
              </CardContent>
            </Card>

            <Card id="search-meetings">
              <CardHeader>
                <CardTitle>{english ? "Meetings" : "会议"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.meetings.length ? (
                  results.meetings.map((meeting) => (
                    <Link
                      key={meeting.id}
                      href={`/meetings/${meeting.id}`}
                      aria-label={
                        english
                          ? `Open meeting: ${meeting.title}`
                          : `打开会议：${meeting.title}`
                      }
                      className="block rounded-2xl border border-[color:var(--border)] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                    >
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                        <p className="font-medium text-[color:var(--foreground)]">
                          {meeting.title}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                        {meeting.agenda
                          ? formatSeededBusinessCopy(
                              formatMeetingDisplayText(meeting.agenda, english),
                              english,
                            )
                          : english
                            ? "Open the meeting for briefing and post-meeting actions"
                            : "查看会前简报与会后行动"}
                      </p>
                      <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                        {formatDateLabel(meeting.startsAt)}
                      </p>
                    </Link>
                  ))
                ) : (
                  <InlineEmpty
                    label={english ? "No matching meetings" : "没有匹配的会议"}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
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

function searchModeHref(
  mode: "object" | "ask",
  q: string,
  inputMode: "typed" | "voice" = "typed",
) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (mode === "ask") params.set("mode", "ask");
  if (mode === "ask" && inputMode === "voice") params.set("input", "voice");
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

function formatActionPacketStatus(status: string, english: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    draft: { zh: "草稿", en: "Draft" },
    review_required: { zh: "需要复核", en: "Review required" },
    blocked: { zh: "已阻塞", en: "Blocked" },
  };
  const label = labels[status];
  return label ? (english ? label.en : label.zh) : status;
}

function formatActionPacketSourceType(sourceType: string, english: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    query_reference: { zh: "问题", en: "Query" },
    object: { zh: "对象", en: "Object" },
    business_signal: { zh: "经营信号", en: "Business signal" },
    memory: { zh: "记忆", en: "Memory" },
    workspace_context: { zh: "工作区", en: "Workspace" },
    helm_semantics: { zh: "Helm 语义", en: "Helm semantics" },
    boundary: { zh: "边界", en: "Boundary" },
  };
  const label = labels[sourceType];
  return label ? (english ? label.en : label.zh) : sourceType;
}

function formatActionPacketStrength(strength: string, english: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    strong: { zh: "强", en: "Strong" },
    medium: { zh: "中", en: "Medium" },
    weak: { zh: "弱", en: "Weak" },
  };
  const label = labels[strength];
  return label ? (english ? label.en : label.zh) : strength;
}

function formatActionPacketSeverity(severity: string, english: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    high: { zh: "高风险", en: "High risk" },
    medium: { zh: "中风险", en: "Medium risk" },
    low: { zh: "低风险", en: "Low risk" },
  };
  const label = labels[severity];
  return label ? (english ? label.en : label.zh) : severity;
}

function SearchReadModelStatus({
  reason,
  english,
}: {
  reason: "ready" | "error" | "timeout";
  english: boolean;
}) {
  return (
    <div
      data-testid="search-read-model-degraded"
      className="rounded-[24px] border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] px-4 py-4 text-sm leading-6 text-[color:var(--status-warning-text)]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">
          {english ? "Degraded search" : "搜索降级"}
        </Badge>
        <span className="font-medium">
          {reason === "timeout"
            ? english
              ? "Object lookup is taking too long."
              : "对象检索响应过慢。"
            : english
              ? "Object lookup is temporarily unavailable."
              : "对象检索暂时不可用。"}
        </span>
      </div>
      <p className="mt-2">
        {english
          ? "The answer still stays read-only. Open the target page again once search recovers for object-level evidence."
          : "回答仍保持只读；对象级证据暂时为空，搜索恢复后再进入对应页面复核。"}
      </p>
    </div>
  );
}

function SearchModeForm({
  q,
  activeMode,
  inputMode,
  english,
}: {
  q: string;
  activeMode: "object" | "ask";
  inputMode: "typed" | "voice";
  english: boolean;
}) {
  return (
    <form
      action="/search"
      data-testid="search-mode-form"
      className="workspace-shell-panel flex flex-col gap-3 rounded-[28px] border px-4 py-4 lg:flex-row lg:items-center"
    >
      <input type="hidden" name="mode" value={activeMode} />
      {activeMode === "ask" && inputMode === "voice" ? (
        <>
          <input type="hidden" name="input" value="voice" />
          <input type="hidden" name="voiceConfidence" value="medium" />
        </>
      ) : null}
      <div
        className="grid shrink-0 grid-cols-2 gap-1 rounded-2xl bg-[color:var(--surface-subtle)] p-1"
        aria-label={english ? "Search mode" : "搜索模式"}
      >
        <Link
          href={searchModeHref("object", q)}
          data-testid="search-mode-object-toggle"
          aria-current={activeMode === "object" ? "page" : undefined}
          className={`flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition ${
            activeMode === "object"
              ? "bg-white text-[color:var(--foreground)] shadow-sm dark:bg-white/10 dark:text-white"
              : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] dark:text-[color:var(--muted-foreground)] dark:hover:text-white"
          }`}
        >
          <Search className="h-4 w-4" />
          {english ? "Objects" : "搜索对象"}
        </Link>
        <Link
          href={searchModeHref("ask", q, inputMode)}
          data-testid="search-mode-ask-toggle"
          aria-current={activeMode === "ask" ? "page" : undefined}
          className={`flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition ${
            activeMode === "ask"
              ? "bg-white text-[color:var(--foreground)] shadow-sm dark:bg-white/10 dark:text-white"
              : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] dark:text-[color:var(--muted-foreground)] dark:hover:text-white"
          }`}
        >
          <MessageSquareText className="h-4 w-4" />
          {english ? "Ask" : "直接提问"}
        </Link>
      </div>
      <div className="relative min-w-0 flex-1">
        {activeMode === "ask" && inputMode === "voice" ? (
          <Mic className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
        ) : activeMode === "ask" ? (
          <MessageSquareText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
        ) : (
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
        )}
        <Input
          name="q"
          data-testid="search-query-input"
          defaultValue={q}
          className="h-11 pl-9"
          placeholder={
            activeMode === "ask" && inputMode === "voice"
              ? english
                ? "Paste or edit a confirmed voice transcript"
                : "粘贴或编辑已确认的语音转写文本"
              : activeMode === "ask"
              ? english
                ? "Ask a work question, or report a customer, meeting, delivery, commitment, or blocker signal"
                : "问经营问题，或上报客户、会议、交付、承诺、阻塞信号"
              : english
                ? "Search contacts, companies, opportunities, meetings"
                : "搜索联系人、公司、机会、会议"
          }
        />
      </div>
      {activeMode === "ask" && inputMode === "voice" ? (
        <label className="flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border border-[color:var(--border)] px-3 text-sm text-[color:var(--muted)]">
          <input
            type="checkbox"
            name="transcriptConfirmed"
            value="true"
            data-testid="ask-helm-transcript-confirmed"
            className="h-4 w-4 rounded border-[color:var(--border-strong)]"
          />
          {english ? "Transcript checked" : "转写已核对"}
        </label>
      ) : null}
      <Button type="submit" data-testid="search-submit" className="h-11 shrink-0">
        {activeMode === "ask"
          ? english
            ? "Ask or submit"
            : "提问 / 上报"
          : english
            ? "Search"
            : "搜索"}
        <ArrowRight className="h-4 w-4" />
      </Button>
      {activeMode === "ask" ? (
        <Button
          asChild
          variant="outline"
          data-testid="search-input-mode-toggle"
          className="h-11 shrink-0"
        >
          <Link
            href={searchModeHref(
              "ask",
              q,
              inputMode === "voice" ? "typed" : "voice",
            )}
          >
            {inputMode === "voice" ? (
              <MessageSquareText className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            {inputMode === "voice"
              ? english
                ? "Typed"
                : "文字"
              : english
                ? "Voice"
                : "语音"}
          </Link>
        </Button>
      ) : null}
    </form>
  );
}

function AskHelmMode({
  q,
  response,
  relatedObjects,
  runtimeContext,
  searchDegraded,
  inputMode,
  english,
  businessSignals,
  businessContextDegraded,
  recentSignalCandidates,
  signalCandidatesDegraded,
  signalSubmitted,
  signalError,
}: {
  q: string;
  response: AskHelmResponse | null;
  relatedObjects: AskHelmGroundedObject[];
  runtimeContext: AskHelmRuntimeContextAssembly | null;
  searchDegraded: boolean;
  inputMode: "typed" | "voice";
  english: boolean;
  businessSignals: AskHelmBusinessSignalDraft[];
  businessContextDegraded: boolean;
  recentSignalCandidates: AskHelmSignalCandidateAuditEntry[];
  signalCandidatesDegraded: boolean;
  signalSubmitted: boolean;
  signalError?: string;
}) {
  if (!q) {
    const exampleQueries = english
      ? [
          "Which customer is waiting for us today?",
          "Report: delivery is blocked by missing proof",
          "What needs my review before we reply?",
          "Which commitment may slip this week?",
        ]
      : [
          "今天哪个客户在等我们回复",
          "上报：交付因为缺凭证被卡住",
          "回复客户前哪些内容需要我复核",
          "本周哪个承诺可能延期",
        ];
    return (
      <div className="space-y-4">
        <EmptyState
          icon={inputMode === "voice" ? Mic : MessageSquareText}
          title={
            inputMode === "voice"
              ? english
                ? "Paste a checked transcript"
                : "粘贴已核对的转写"
              : english
                ? "Ask about work, or submit a signal"
                : "提问，或上报经营信号"
          }
          description={
            inputMode === "voice"
              ? english
                ? "Voice enters the same review path after the transcript is checked."
                : "语音转写经人工核对后，进入同一套复核路径。"
              : english
              ? "Use one box for a work question, customer wait, delivery blocker, commitment risk, or review request. Helm will keep it review-first."
              : "一个入口处理经营问题、客户等待、交付阻塞、承诺风险和复核请求。Helm 会保持先复核后推进。"
          }
        />
        {inputMode === "typed" ? (
          <div
            className="grid gap-2 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:grid-cols-4"
            data-testid="ask-helm-work-intent-shortcuts"
          >
            {(english
              ? [
                  ["Customer waiting", "Tell Helm who is waiting and what proof exists."],
                  ["Meeting promise", "Capture a commitment before it slips."],
                  ["Delivery blocker", "Route a blocker to review, not auto-execution."],
                  ["Manager review", "Prepare the context for a human decision."],
                ]
              : [
                  ["客户在等", "说明谁在等、证据在哪里。"],
                  ["会议承诺", "在承诺延期前先进入复核。"],
                  ["交付阻塞", "阻塞先进入复核，不自动执行。"],
                  ["主管复核", "把上下文准备给人工决策。"],
                ]
            ).map(([title, body]) => (
              <div key={title} className="rounded-2xl bg-[color:var(--surface)] px-3 py-3">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">{body}</p>
              </div>
            ))}
          </div>
        ) : null}
        {inputMode === "typed" ? (
          <div
            className="space-y-2"
            data-testid="ask-helm-example-queries"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted-foreground)]">
              {english ? "Try one of these" : "试试这些问题"}
            </p>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((example) => (
                <Link
                  key={example}
                  href={{ pathname: "/search", query: { mode: "ask", q: example } }}
                  className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                >
                  {example}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        <AskHelmSignalIntakePanel
          sourceQuery=""
          response={null}
          recentSignalCandidates={recentSignalCandidates}
          signalCandidatesDegraded={signalCandidatesDegraded}
          signalSubmitted={signalSubmitted}
          signalError={signalError}
          english={english}
        />
      </div>
    );
  }

  if (!response) return null;

  const displayedObjects = relatedObjects.slice(0, 6);

  return (
    <div data-testid="ask-helm-mode" className="space-y-5">
      <AskHelmLayeredAnswerPanel
        response={response}
        businessSignals={businessSignals}
        businessContextDegraded={businessContextDegraded}
        runtimeContext={runtimeContext}
        english={english}
      />

      <AskHelmSignalIntakePanel
        sourceQuery={q}
        response={response}
        recentSignalCandidates={recentSignalCandidates}
        signalCandidatesDegraded={signalCandidatesDegraded}
        signalSubmitted={signalSubmitted}
        signalError={signalError}
        english={english}
      />

      <section data-testid="ask-helm-related-objects" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Related objects" : "相关对象"}
            </p>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {english
                ? "Objects stay first when the question points to real workspace records."
                : "问题指向真实工作区对象时，对象结果优先展示。"}
            </p>
          </div>
          <Badge variant="neutral">
            {response.relatedObjects?.totalCount ?? 0}
            {english ? " found" : " 个结果"}
          </Badge>
        </div>
        {displayedObjects.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {displayedObjects.map((object) => (
              <Link
                key={`${object.objectType}-${object.objectId}`}
                href={object.deepLink}
                data-testid="ask-helm-related-object"
                aria-label={
                  english
                    ? `Open ${formatAskHelmObjectTypeLabel(
                        object.objectType,
                        english,
                      )}: ${object.displayName}`
                    : `打开${formatAskHelmObjectTypeLabel(
                        object.objectType,
                        english,
                      )}：${object.displayName}`
                }
                className="block rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-[color:var(--foreground)]">
                    {object.displayName}
                  </p>
                  <Badge variant="info">
                    {formatAskHelmObjectTypeLabel(
                      object.objectType,
                      english,
                    )}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  {formatAskHelmRelatedObjectStatus(
                    object.objectType,
                    object.status,
                    english,
                  )}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="workspace-panel-muted rounded-[22px] border-dashed px-4 py-6">
            <p className="font-medium text-[color:var(--foreground)]">
              {searchDegraded
                ? english
                  ? "Object evidence is degraded right now"
                  : "对象证据当前处于降级状态"
                : english
                  ? "No related objects matched this question yet"
                  : "这个问题暂时没有匹配到相关对象"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
              {searchDegraded
                ? english
                  ? "The answer below stays read-only and scoped to the workspace. Use the linked page to verify object evidence after search recovers."
                  : "下面的回答仍保持只读并限制在当前工作区；搜索恢复后，请进入对应页面核对对象证据。"
                : english
                  ? "A bounded answer is still available, but no object-level citation was found."
                  : "仍可给出受控回答，但当前没有找到对象级引用。"}
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div
          data-testid="ask-helm-answer"
          className="workspace-panel rounded-[24px] border px-5 py-5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="approval">
                  {formatAskHelmIntentTypeLabel(
                    response.classification.intentType,
                    english,
                  )}
                </Badge>
                {response.voice ? (
                  <Badge variant="neutral">
                    {english ? "voice transcript" : "语音转写"}
                  </Badge>
                ) : null}
              </div>
              <div>
                <p className="text-lg font-semibold text-[color:var(--foreground)]">
                  {response.answer.summary}
                </p>
                {response.answer.explanation ? (
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {response.answer.explanation}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {response.retrievalPlan.sources.map((source) => (
                  <Badge key={source} variant="neutral">
                    {formatAskHelmRetrievalSourceLabel(source, english)}
                  </Badge>
                ))}
                <Badge variant="neutral">
                  {response.retrievalPlan.readOnly
                    ? english
                      ? "read only"
                      : "只读"
                    : english
                      ? "write path"
                      : "写入路径"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="workspace-panel rounded-[24px] border px-5 py-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Next step" : "下一步"}
            </p>
          </div>
          <Button asChild className="mt-4 w-full justify-between">
            <Link href={response.nextStep.primary.target}>
              {response.nextStep.primary.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          {response.boundaryNote ? (
            <div
              data-testid="ask-helm-boundary-note"
              className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4"
            >
              <Badge variant="neutral">
                {formatAskHelmBoundaryTypeLabel(
                  response.boundaryNote.type,
                  english,
                )}
              </Badge>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {response.boundaryNote.message}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {runtimeContext ? (
        <details
          data-testid="ask-helm-context-audit-toggle"
          className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-5 py-4 text-sm"
        >
          <summary className="cursor-pointer select-none text-sm font-medium text-[color:var(--muted)]">
            {english
              ? "Technical context audit (secondary)"
              : "技术上下文审计（次要信息）"}
          </summary>
          <div className="mt-4">
            <AskHelmContextAuditPanel
              runtimeContext={runtimeContext}
              english={english}
            />
          </div>
        </details>
      ) : null}

      {response.actionPacket ||
      response.plan ||
      response.preparedArtifact ||
      response.actionHandoff ||
      response.voice ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {response.actionPacket ? (
            <AskHelmActionPacketPanel
              packet={response.actionPacket}
              english={english}
            />
          ) : null}

          {response.plan ? (
            <div
              data-testid="ask-helm-action-plan"
              className="workspace-panel rounded-[24px] border px-5 py-5"
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-[var(--accent)]" />
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {english ? "Action plan" : "行动计划"}
                </p>
                <Badge variant="neutral">{response.plan.status}</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                {response.plan.summary}
              </p>
              <div className="mt-4 space-y-3">
                {response.plan.steps.map((step, index) => (
                  <div
                    key={step.id}
                    data-testid="ask-helm-plan-step"
                    className="rounded-2xl border border-[color:var(--border)] px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">
                        {index + 1}. {step.title}
                      </p>
                      {step.reviewRequired ? (
                        <Badge variant="approval">
                          {english ? "review" : "需复核"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {step.detail}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {step.objectRef ? (
                        <PlanStepFact
                          dataTestId="ask-helm-plan-step-object-ref"
                          label={english ? "Object" : "对象"}
                          value={step.objectRef.label}
                          badge={
                            step.objectRef.source === "grounded_object"
                              ? english
                                ? "grounded"
                                : "已落对象"
                              : english
                                ? "query ref"
                                : "query 引用"
                          }
                        />
                      ) : null}
                      <PlanStepFact
                        dataTestId="ask-helm-plan-step-dri"
                        label={english ? "DRI" : "负责人"}
                        value={step.dri.label}
                        badge={step.dri.role}
                      />
                      <PlanStepFact
                        dataTestId="ask-helm-plan-step-due"
                        label={english ? "Due" : "截止"}
                        value={step.due.label}
                        badge={step.due.timing}
                      />
                    </div>
                    {step.target ? (
                      <Button asChild variant="outline" className="mt-3 h-9">
                        <Link href={step.target.target}>
                          {step.target.label}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-[color:var(--muted-foreground)]">
                {response.plan.auditNote}
              </p>
            </div>
          ) : null}

          {response.preparedArtifact ? (
            <div className="workspace-panel rounded-[24px] border px-5 py-5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--accent)]" />
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {english ? "Prepared artifact" : "准备件"}
                </p>
                <Badge variant="neutral">
                  {response.preparedArtifact.status}
                </Badge>
              </div>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {response.preparedArtifact.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {response.preparedArtifact.bodyPreview}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="info">{response.preparedArtifact.type}</Badge>
                <Badge variant="neutral">
                  {response.preparedArtifact.targetSurface}
                </Badge>
                {response.preparedArtifact.reviewRequired ? (
                  <Badge variant="approval">
                    {english ? "review required" : "需要复核"}
                  </Badge>
                ) : null}
              </div>
            </div>
          ) : null}

          {response.actionHandoff ? (
            <div className="workspace-panel rounded-[24px] border px-5 py-5">
              <div className="flex items-center gap-2">
                <Handshake className="h-4 w-4 text-[var(--accent)]" />
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {english ? "Handoff" : "交接"}
                </p>
                <Badge variant="neutral">{response.actionHandoff.mode}</Badge>
              </div>
              <Button asChild className="mt-4 w-full justify-between">
                <Link href={response.actionHandoff.target}>
                  {response.actionHandoff.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4">
                <Badge variant="neutral">
                  {response.actionHandoff.writeEnabled
                    ? english
                      ? "write enabled"
                      : "可写入"
                    : english
                      ? "no write"
                      : "不写入"}
                </Badge>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {response.actionHandoff.auditLabel}
                </p>
              </div>
            </div>
          ) : null}

          {response.voice ? (
            <div
              data-testid="ask-helm-voice"
              className="workspace-panel rounded-[24px] border px-5 py-5"
            >
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-[var(--accent)]" />
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {english ? "Voice" : "语音"}
                </p>
                <Badge variant="neutral">
                  {response.voice.transcriptConfidence}
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <VoiceFact
                  dataTestId="ask-helm-voice-transcript"
                  label={english ? "Transcript" : "转写"}
                  value={
                    response.voice.requiresTranscriptConfirmation
                      ? english
                        ? "check required"
                        : "需要核对"
                      : english
                        ? "checked"
                        : "已核对"
                  }
                />
                <VoiceFact
                  label={english ? "Audio" : "音频"}
                  value={
                    response.voice.rawAudioRetained
                      ? english
                        ? "retained"
                        : "已保留"
                      : english
                        ? "not retained"
                        : "不保留"
                  }
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">
                {response.voice.speakableSummary}
              </p>
              <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                {response.voice.speakableBoundary}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function AskHelmActionPacketPanel({
  packet,
  english,
}: {
  packet: NonNullable<AskHelmResponse["actionPacket"]>;
  english: boolean;
}) {
  const visibleEvidence = packet.evidenceRefs.slice(0, 8);
  const extraEvidenceCount = Math.max(
    0,
    packet.evidenceRefs.length - visibleEvidence.length,
  );

  return (
    <div
      data-testid="ask-helm-action-packet"
      className="workspace-panel rounded-[24px] border px-5 py-5 lg:col-span-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="approval">
          {english ? "Evidence-grounded action packet" : "证据化行动包"}
        </Badge>
        <Badge variant="neutral">
          {formatActionPacketStatus(packet.status, english)}
        </Badge>
        <Badge variant="neutral">
          {english ? "read-only contract" : "只读契约"}
        </Badge>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-7 text-[color:var(--foreground)]">
            {packet.summary}
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
            {english
              ? "This packet shows what the recommendation relies on, what is missing, and what must be reviewed before anyone acts."
              : "这里明确行动建议依赖哪些证据、还缺什么，以及真正推进前必须人工复核什么。"}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {[
              english ? "No official write" : "不写正式状态",
              english ? "No auto-send" : "不自动外发",
              english ? "No auto-approval" : "不自动审批",
              english ? "Evidence refs only" : "只引用证据",
            ].map((label) => (
              <div
                key={label}
                className="flex min-h-12 items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-sm text-[color:var(--foreground)]"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span className="min-w-0 break-words">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Next surface" : "下一步落点"}
            </p>
          </div>
          <Button asChild className="mt-3 w-full justify-between">
            <Link href={packet.nextSurface.target}>
              {packet.nextSurface.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <p className="mt-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
            {packet.auditNote}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.85fr)_minmax(260px,0.85fr)]">
        <div className="min-w-0 rounded-2xl border border-[color:var(--border)] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--accent)]" />
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {english ? "Evidence refs" : "证据引用"}
              </p>
            </div>
            <Badge variant="neutral">
              {packet.evidenceRefs.length}
              {english ? " refs" : " 条"}
            </Badge>
          </div>
          <div className="mt-3 grid gap-2">
            {visibleEvidence.map((ref) => (
              <div
                key={ref.id}
                data-testid="ask-helm-action-packet-evidence"
                className="rounded-2xl bg-[color:var(--surface-subtle)] px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">
                    {formatActionPacketSourceType(ref.sourceType, english)}
                  </Badge>
                  <Badge variant="neutral">
                    {formatActionPacketStrength(ref.strength, english)}
                  </Badge>
                </div>
                <p className="mt-2 break-words text-sm font-medium text-[color:var(--foreground)]">
                  {ref.label}
                </p>
                <p className="mt-1 break-words text-xs leading-5 text-[color:var(--muted-foreground)]">
                  {ref.note}
                </p>
                {ref.target ? (
                  <Link
                    href={ref.target}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)]"
                  >
                    {english ? "Open source" : "打开来源"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
            ))}
            {extraEvidenceCount ? (
              <p className="text-xs text-[color:var(--muted-foreground)]">
                {english
                  ? `${extraEvidenceCount} more refs kept in the packet.`
                  : `还有 ${extraEvidenceCount} 条引用保留在行动包中。`}
              </p>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-[color:var(--border)] px-4 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--accent)]" />
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Risks and gaps" : "风险与缺口"}
            </p>
          </div>
          <div className="mt-3 space-y-3">
            {packet.risks.map((risk) => (
              <div
                key={risk.id}
                className="rounded-2xl bg-[color:var(--surface-subtle)] px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={risk.reviewRequired ? "approval" : "neutral"}>
                    {formatActionPacketSeverity(risk.severity, english)}
                  </Badge>
                  {risk.reviewRequired ? (
                    <Badge variant="neutral">
                      {english ? "review" : "需复核"}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-medium text-[color:var(--foreground)]">
                  {risk.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                  {risk.note}
                </p>
              </div>
            ))}
            {packet.missingInfo.length ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-3 py-3">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Missing" : "缺口"}
                </p>
                <div className="mt-2 space-y-2">
                  {packet.missingInfo.map((item) => (
                    <div key={item.id}>
                      <p className="text-sm font-medium text-[color:var(--foreground)]">
                        {item.label}
                      </p>
                      <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">
                        {item.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-[color:var(--border)] px-4 py-4">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-[var(--accent)]" />
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Review checklist" : "复核清单"}
            </p>
          </div>
          <ol className="mt-3 space-y-2">
            {packet.reviewChecklist.map((item, index) => (
              <li
                key={`${index}-${item}`}
                className="flex gap-2 rounded-2xl bg-[color:var(--surface-subtle)] px-3 py-3 text-sm leading-6 text-[color:var(--muted)]"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface)] text-xs font-semibold text-[color:var(--foreground)]">
                  {index + 1}
                </span>
                <span className="min-w-0 break-words">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function AskHelmSignalIntakePanel({
  sourceQuery,
  response,
  recentSignalCandidates,
  signalCandidatesDegraded,
  signalSubmitted,
  signalError,
  english,
}: {
  sourceQuery: string;
  response: AskHelmResponse | null;
  recentSignalCandidates: AskHelmSignalCandidateAuditEntry[];
  signalCandidatesDegraded: boolean;
  signalSubmitted: boolean;
  signalError?: string;
  english: boolean;
}) {
  const relatedObject = response?.relatedObjects?.objects[0];
  const defaultSummary =
    response?.classification.intentType === "submit_business_signal"
      ? sourceQuery
      : "";
  const errorCopy =
    signalError === "empty_summary"
      ? english
        ? "Please describe the signal before submitting."
        : "请先填写要上报的经营信号内容。"
      : english
        ? "Signal candidate was not submitted. Please retry."
        : "经营信号候选未提交，请重试。";
  const latestCandidate = recentSignalCandidates[0] ?? null;

  return (
    <section
      id="ask-helm-signal-intake"
      data-testid="ask-helm-signal-intake"
      className="workspace-panel rounded-[24px] border px-5 py-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="approval">
          {english ? "Business signal intake" : "上报经营信号"}
        </Badge>
        <Badge variant="neutral">
          {english ? "review candidate" : "复核候选"}
        </Badge>
        {signalCandidatesDegraded ? (
          <Badge variant="warning">
            {english ? "recent list degraded" : "最近列表降级"}
          </Badge>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
        {english
          ? "Use this when the answer points to real work: a customer is waiting, a commitment may slip, delivery is blocked, or a manager needs to review before anyone replies. It creates an audit-backed candidate only."
          : "当问题指向真实工作时，从这里上报：客户在等、承诺可能延期、交付被阻塞，或回复前需要主管复核。这里只创建带审计记录的候选。"}
      </p>

      {signalSubmitted ? (
        <div
          data-testid="ask-helm-signal-submitted"
          className="mt-4 space-y-4 rounded-2xl border border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] px-4 py-4 text-sm leading-6 text-[color:var(--status-success-text)]"
        >
          <p className="font-semibold">
            {english
              ? "Signal candidate submitted for review."
              : "经营信号候选已提交复核。"}
          </p>
          <div
            data-testid="ask-helm-signal-submission-readout"
            className="grid gap-3 md:grid-cols-3"
          >
            <div className="rounded-2xl bg-[color:var(--surface)]/70 px-3 py-3 text-[color:var(--foreground)]">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Lands in" : "落点"}
              </p>
              <p className="mt-1">
                {english
                  ? "Recent submissions and workspace audit trail"
                  : "最近上报列表和审计记录"}
              </p>
              {latestCandidate ? (
                <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                  {english ? "Latest" : "最新"}：{latestCandidate.signalType} ·{" "}
                  {latestCandidate.urgency}
                </p>
              ) : null}
            </div>
            <div className="rounded-2xl bg-[color:var(--surface)]/70 px-3 py-3 text-[color:var(--foreground)]">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Reviewer" : "复核"}
              </p>
              <p className="mt-1">
                {english
                  ? "Workspace owner or members with review permission"
                  : "工作区负责人或具备复核权限的成员"}
              </p>
            </div>
            <div className="rounded-2xl bg-[color:var(--surface)]/70 px-3 py-3 text-[color:var(--foreground)]">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Next" : "后续"}
              </p>
              <p className="mt-1">
                {english
                  ? "Only a human review can promote, downgrade or ignore it."
                  : "人工复核后才可能提升为正式推进项、降级或忽略。"}
              </p>
            </div>
          </div>
          <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">
            {english
              ? "This answer did not send, commit, write CRM status, or create a formal Must Push automatically."
              : "这次回答没有自动外发、自动承诺、自动写客户关系系统状态，也没有自动生成正式必推事项。"}
          </p>
        </div>
      ) : null}

      {signalError ? (
        <div
          data-testid="ask-helm-signal-error"
          className="mt-4 rounded-2xl border border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)] px-4 py-3 text-sm leading-6 text-[color:var(--status-danger-text)]"
        >
          {errorCopy}
        </div>
      ) : null}

      <form
        action={submitAskHelmSignalCandidateFormAction}
        data-testid="ask-helm-signal-intake-form"
        className="mt-5 grid gap-4"
      >
        <input type="hidden" name="sourceQuery" value={sourceQuery} />
        {relatedObject ? (
          <>
            <input
              type="hidden"
              name="relatedObjectType"
              value={relatedObject.objectType}
            />
            <input
              type="hidden"
              name="relatedObjectId"
              value={relatedObject.objectId}
            />
          </>
        ) : null}
        <label className="grid gap-2 text-sm font-medium text-[color:var(--foreground)]">
          {english ? "What happened?" : "发生了什么？"}
          <textarea
            name="summary"
            defaultValue={defaultSummary}
            rows={4}
            placeholder={
              english
                ? "Example: Customer is waiting for the renewal proposal; promised date may slip; sales lead needs review before replying."
                : "例如：客户还在等续约方案；原承诺日期可能延期；回复前需要销售负责人复核。"
            }
            className="min-h-28 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-[color:var(--foreground)]">
            {english ? "Signal type" : "信号类型"}
            <select
              name="signalType"
              defaultValue="risk"
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
            >
              <option value="risk">{english ? "Risk" : "风险"}</option>
              <option value="blocker">{english ? "Blocker" : "阻塞"}</option>
              <option value="opportunity">{english ? "Opportunity" : "机会"}</option>
              <option value="commitment_at_risk">
                {english ? "Commitment at risk" : "承诺风险"}
              </option>
              <option value="customer_waiting">
                {english ? "Customer waiting" : "客户等待"}
              </option>
              <option value="customer_feedback">
                {english ? "Customer feedback" : "客户反馈"}
              </option>
              <option value="delivery_issue">
                {english ? "Delivery issue" : "交付问题"}
              </option>
              <option value="internal_handoff">
                {english ? "Internal handoff" : "内部交接"}
              </option>
              <option value="other">{english ? "Other" : "其他"}</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-[color:var(--foreground)]">
            {english ? "Urgency" : "紧急度"}
            <select
              name="urgency"
              defaultValue="normal"
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
            >
              <option value="normal">{english ? "Normal" : "普通"}</option>
              <option value="high">{english ? "High" : "高"}</option>
              <option value="critical">{english ? "Critical" : "紧急"}</option>
              <option value="low">{english ? "Low" : "低"}</option>
            </select>
          </label>
        </div>
        <label className="grid gap-2 text-sm font-medium text-[color:var(--foreground)]">
          {english ? "Evidence note" : "证据说明"}
          <Input
            name="evidenceNote"
            placeholder={
              english
                ? "Meeting, message, CRM field, screenshot note, or owner note. PII will be redacted."
                : "可写会议、消息、客户关系系统字段、截图说明或负责人说明；邮箱和电话会脱敏。"
            }
          />
        </label>
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
          {english
            ? "Boundary: this candidate is audit-only and review-required. It does not send messages, make commitments, write CRM status, or create a formal Must Push."
            : "边界：这里只写入审计候选且必须复核；不会发消息、不会作承诺、不会写客户关系系统状态、不会创建正式必推事项。"}
        </div>
        <Button
          type="submit"
          data-testid="ask-helm-signal-submit"
          className="h-11 w-full justify-center sm:w-fit"
        >
          {english ? "Submit for review" : "提交为复核候选"}
        </Button>
      </form>

      {recentSignalCandidates.length ? (
        <div className="mt-6">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {english ? "Recently submitted" : "最近上报"}
          </p>
          <div className="mt-3 grid gap-2">
            {recentSignalCandidates.map((candidate) => (
              <div
                key={candidate.candidateId}
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">{candidate.signalType}</Badge>
                  <Badge variant="neutral">{candidate.urgency}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {candidate.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AskHelmLayeredAnswerPanel({
  response,
  businessSignals,
  businessContextDegraded,
  runtimeContext,
  english,
}: {
  response: AskHelmResponse;
  businessSignals: AskHelmBusinessSignalDraft[];
  businessContextDegraded: boolean;
  runtimeContext: AskHelmRuntimeContextAssembly | null;
  english: boolean;
}) {
  const tenantLayer = runtimeContext?.layers.find(
    (layer) => layer.id === "tenant_facts",
  );
  const semanticsLayer = runtimeContext?.layers.find(
    (layer) => layer.id === "helm_semantics",
  );
  const llmLayer = runtimeContext?.layers.find(
    (layer) => layer.id === "llm_reasoning",
  );
  const tenantSummaryItems = tenantLayer?.summaryItems ?? [];
  const semanticsSummaryItems = semanticsLayer?.summaryItems ?? [];
  const llmSummaryItems = llmLayer?.summaryItems ?? [];

  return (
    <section
      data-testid="ask-helm-layered-answer"
      className="workspace-panel rounded-[24px] border px-5 py-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="approval">
          {english ? "Layered answer" : "分层回答"}
        </Badge>
        <Badge variant="neutral">
          {english ? "read-only" : "只读"}
        </Badge>
        {businessContextDegraded ? (
          <Badge variant="warning">
            {english
              ? "Business context degraded"
              : "经营上下文降级"}
          </Badge>
        ) : null}
      </div>
      <p className="mt-3 text-base font-semibold text-[color:var(--foreground)]">
        {response.answer.summary}
      </p>
      {response.answer.explanation ? (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
          {response.answer.explanation}
        </p>
      ) : null}

      <ol
        data-testid="ask-helm-layered-answer-layers"
        className="mt-5 grid gap-3 lg:grid-cols-2"
      >
        <LayeredAnswerLayer
          rank="L1"
          title={english ? "Tenant facts" : "租户事实"}
          description={
            english
              ? "Current-workspace approvals, opportunity risk, reviewed memory — authoritative."
              : "当前工作区的复核任务、机会风险、已复核记忆——最权威。"
          }
          items={tenantSummaryItems}
          fallback={
            english
              ? "No tenant facts surfaced yet for this question."
              : "暂未围绕这个问题命中租户事实。"
          }
          dataTestId="ask-helm-layered-answer-layer-tenant"
        />
        <LayeredAnswerLayer
          rank="L2"
          title={english ? "Helm semantics" : "Helm 语义判断"}
          description={
            english
              ? "Helm routes the answer with page responsibility, review posture and non-commitment boundaries."
              : "Helm 语义负责页面职责、复核姿态和「建议不等于承诺」边界。"
          }
          items={semanticsSummaryItems}
          fallback={
            english
              ? "Helm semantics are reserved for this question."
              : "Helm 语义对此问题暂未生效。"
          }
          dataTestId="ask-helm-layered-answer-layer-semantics"
        />
        <LayeredAnswerLayer
          rank="L3"
          title={english ? "Reviewed memory & experience" : "已复核经营记忆"}
          description={
            english
              ? "Only reviewed-active memory tied to the related objects is used; candidates are excluded."
              : "只使用已复核、与相关对象匹配的记忆；候选记忆不会进入答案。"
          }
          items={
            runtimeContext?.packet.includedContext.memory.map(
              (memory) => memory.summaryToken,
            ) ?? []
          }
          fallback={
            english
              ? "No reviewed memory matched the current objects."
              : "当前对象没有匹配到已复核的经营记忆。"
          }
          dataTestId="ask-helm-layered-answer-layer-memory"
        />
        <LayeredAnswerLayer
          rank="L4"
          title={english ? "Bounded LLM / public assistance" : "受限大模型 / 公共辅助"}
          description={
            english
              ? "LLM only explains, summarizes, routes or prepares drafts from the audited packet. Public knowledge cannot override tenant facts."
              : "大模型仅在已审计上下文范围内解释、总结、路由或起草；公共知识不得覆盖租户事实。"
          }
          items={llmSummaryItems}
          fallback={
            english
              ? "LLM reasoning is bounded — no public knowledge injected."
              : "大模型推理已受限——不注入公共知识。"
          }
          dataTestId="ask-helm-layered-answer-layer-llm"
        />
      </ol>

      <div
        data-testid="ask-helm-business-signals"
        className="mt-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {english
              ? "Follow-up business signal drafts"
              : "建议跟进的经营信号草稿"}
          </p>
          <Badge variant="neutral">
            {businessSignals.length}{" "}
            {english ? "drafts" : "条草稿"}
          </Badge>
        </div>
        <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
          {english
            ? "These are review-first drafts. They are not persisted, sent or committed automatically."
            : "这些是需先复核的信号草稿，不会自动持久化、外发或承诺。"}
        </p>
        {businessSignals.length ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {businessSignals.map((signal) => (
              <BusinessSignalCard
                key={signal.id}
                signal={signal}
                english={english}
              />
            ))}
          </div>
        ) : (
          <div
            data-testid="ask-helm-business-signals-empty"
            className="mt-3 rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]"
          >
            {english
              ? "No follow-up business signal was found right now. This answer remains read-only and will not create a draft."
              : "当前没有发现需要跟进的经营信号，本页保持只读，不会自动建立草稿。"}
          </div>
        )}
      </div>
    </section>
  );
}

function LayeredAnswerLayer({
  rank,
  title,
  description,
  items,
  fallback,
  dataTestId,
}: {
  rank: string;
  title: string;
  description: string;
  items: string[];
  fallback: string;
  dataTestId?: string;
}) {
  const visible = items.slice(0, 4);
  return (
    <li
      data-testid={dataTestId}
      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted-foreground)]">
          {rank}
        </p>
      </div>
      <p className="mt-1 text-sm font-semibold text-[color:var(--foreground)]">
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
        {description}
      </p>
      {visible.length ? (
        <ul className="mt-3 space-y-1 text-sm text-[color:var(--foreground)]">
          {visible.map((item, index) => (
            <li
              key={`${dataTestId ?? rank}-item-${index}`}
              className="rounded-xl bg-[color:var(--surface-subtle)] px-3 py-2 text-xs leading-5"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
          {fallback}
        </p>
      )}
    </li>
  );
}

function BusinessSignalCard({
  signal,
  english,
}: {
  signal: AskHelmBusinessSignalDraft;
  english: boolean;
}) {
  const reviewLabel = (() => {
    if (signal.reviewPosture === "review_required") {
      return english ? "Review required" : "需要复核";
    }
    if (signal.reviewPosture === "draft_only") {
      return english ? "Draft only" : "仅草稿";
    }
    return english ? "Read only" : "只读";
  })();

  return (
    <div
      data-testid="ask-helm-business-signal-card"
      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="approval">{reviewLabel}</Badge>
        <Badge variant="neutral">
          {english ? "score" : "评分"} {signal.score}
        </Badge>
      </div>
      <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
        {signal.title}
      </p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
        {signal.reason}
      </p>
      {signal.evidenceRefs.length ? (
        <div
          data-testid="ask-helm-business-signal-evidence"
          className="mt-3 flex flex-wrap gap-1.5"
        >
          {signal.evidenceRefs.slice(0, 6).map((ref) => (
            <Badge key={ref} variant="neutral">
              {ref}
            </Badge>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
        {signal.boundaryNote}
      </p>
      <Button asChild variant="outline" className="mt-3 h-9 w-full justify-between">
        <Link href={signal.primaryNextStep.target}>
          {signal.primaryNextStep.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function AskHelmContextAuditPanel({
  runtimeContext,
  english,
}: {
  runtimeContext: AskHelmRuntimeContextAssembly;
  english: boolean;
}) {
  const visibleExclusions = runtimeContext.packet.excludedContext.slice(0, 4);

  return (
    <section
      data-testid="ask-helm-context-audit"
      className="workspace-panel rounded-[24px] border px-5 py-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={runtimeContext.audit.passed ? "approval" : "danger"}>
              {runtimeContext.audit.passed
                ? english
                  ? "Context audit passed"
                  : "上下文审计通过"
                : english
                  ? "Context audit needs review"
                  : "上下文审计需复核"}
            </Badge>
            <Badge variant="neutral">
              {english ? "read-only packet" : "只读上下文包"}
            </Badge>
          </div>
          <p className="mt-3 text-sm font-semibold text-[color:var(--foreground)]">
            {english
              ? "Sources used before answering"
              : "回答前实际使用了什么来源"}
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
            {english
              ? "Tenant facts stay authoritative. Helm semantics explain and route. Global patterns and public knowledge are withheld until they are reviewed, redacted, and explicitly allowed."
              : "租户事实权威最高；Helm 语义只负责解释和路由；全局经验与公共知识在未脱敏、未复核、未授权前不会进入答案。"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm md:min-w-56">
          <ContextAuditMetric
            label={english ? "Coverage" : "覆盖率"}
            value={`${runtimeContext.audit.contextCoveragePercent}%`}
          />
          <ContextAuditMetric
            label={english ? "Redaction" : "脱敏"}
            value={`${runtimeContext.audit.redactionCoveragePercent}%`}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-5">
        {runtimeContext.layers.map((layer) => (
          <ContextLayerCard key={layer.id} layer={layer} english={english} />
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted-foreground)]">
            {english ? "Packet" : "上下文包"}
          </p>
          <p className="mt-2 break-all text-sm font-semibold text-[color:var(--foreground)]">
            {runtimeContext.packet.packetId}
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
            {english
              ? "Raw prompt and raw audio are not retained. The packet is eligible for redacted replay only."
              : "不保留原始提示词或原始音频；仅允许脱敏回放复核。"}
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted-foreground)]">
            {english ? "Excluded context" : "已排除上下文"}
          </p>
          <div className="mt-3 space-y-2">
            {visibleExclusions.map((item, index) => (
              <div
                key={`${item.source}-${item.refId ?? index}`}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2"
              >
                <Badge variant="neutral">{item.source}</Badge>
                <p className="mt-2 text-xs leading-5 text-[color:var(--muted)]">
                  {item.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ContextAuditMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3">
      <p className="text-xs text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-base font-semibold text-[color:var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function ContextLayerCard({
  layer,
  english,
}: {
  layer: AskHelmRuntimeContextLayer;
  english: boolean;
}) {
  const label = formatContextLayerLabel(layer.id, english);
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted-foreground)]">
            L{layer.authorityRank}
          </p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--foreground)]">
            {label}
          </p>
        </div>
        <Badge variant={contextLayerBadgeVariant(layer.status)}>
          {formatContextLayerStatus(layer.status, english)}
        </Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
        {formatContextLayerNote(layer, english)}
      </p>
      <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
        {english ? "Items" : "条目"}: {layer.itemCount}
      </p>
    </div>
  );
}

function contextLayerBadgeVariant(status: AskHelmRuntimeContextLayer["status"]) {
  if (status === "included") return "approval";
  if (status === "bounded") return "info";
  if (status === "reserved") return "neutral";
  return "warning";
}

function formatContextLayerLabel(
  layerId: AskHelmRuntimeContextLayer["id"],
  english: boolean,
) {
  const labels: Record<AskHelmRuntimeContextLayer["id"], { zh: string; en: string }> = {
    tenant_facts: { zh: "租户事实", en: "Tenant facts" },
    helm_semantics: { zh: "Helm 语义", en: "Helm semantics" },
    helm_global_patterns: { zh: "Helm 全局经验", en: "Helm global patterns" },
    public_knowledge: { zh: "公共知识", en: "Public knowledge" },
    llm_reasoning: { zh: "大模型推理", en: "LLM reasoning" },
  };
  return english ? labels[layerId].en : labels[layerId].zh;
}

function formatContextLayerStatus(
  status: AskHelmRuntimeContextLayer["status"],
  english: boolean,
) {
  const labels: Record<AskHelmRuntimeContextLayer["status"], { zh: string; en: string }> = {
    included: { zh: "已纳入", en: "Included" },
    bounded: { zh: "受限使用", en: "Bounded" },
    reserved: { zh: "预留", en: "Reserved" },
    excluded: { zh: "已排除", en: "Excluded" },
  };
  return english ? labels[status].en : labels[status].zh;
}

function formatContextLayerNote(
  layer: AskHelmRuntimeContextLayer,
  english: boolean,
) {
  if (english) return layer.note;
  const notes: Record<AskHelmRuntimeContextLayer["id"], string> = {
    tenant_facts: "当前工作区对象、已复核记忆和工作区范围拥有最高权威。",
    helm_semantics: "Helm 语义负责页面职责、复核姿态和建议不等于承诺的边界。",
    helm_global_patterns: "跨租户经验必须先脱敏、复核并批准为可复用知识。",
    public_knowledge: "公共知识不能覆盖租户事实；Ask Helm v1 默认不纳入。",
    llm_reasoning: "大模型只能基于已审计上下文解释、总结、路由或准备草稿。",
  };
  return notes[layer.id];
}

function PlanStepFact({
  label,
  value,
  badge,
  dataTestId,
}: {
  label: string;
  value: string;
  badge?: string;
  dataTestId?: string;
}) {
  return (
    <div
      data-testid={dataTestId}
      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[color:var(--muted-foreground)]">{label}</p>
        {badge ? <Badge variant="neutral">{badge}</Badge> : null}
      </div>
      <p className="mt-1 text-sm font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function VoiceFact({
  label,
  value,
  dataTestId,
}: {
  label: string;
  value: string;
  dataTestId?: string;
}) {
  return (
    <div
      data-testid={dataTestId}
      className="rounded-2xl border border-[color:var(--border)] px-4 py-3"
    >
      <p className="text-xs text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function ResultStat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} aria-label={label} className="block">
      <Card className="transition hover:-translate-y-0.5 hover:border-[#194650]/20 hover:shadow-[0_22px_40px_-26px_rgba(15,23,42,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#194650]/35">
        <CardContent className="space-y-2 py-5">
          <p className="text-sm text-[color:var(--muted-foreground)]">{label}</p>
          <p className="text-3xl font-semibold text-[color:var(--foreground)]">{value}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function InlineEmpty({ label }: { label: string }) {
  return (
    <div className="theme-surface-panel-dashed rounded-2xl px-4 py-6 text-sm text-[color:var(--muted-foreground)]">
      {label}
    </div>
  );
}
