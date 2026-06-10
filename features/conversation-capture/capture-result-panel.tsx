import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Mic,
  Sparkles,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ApprovalBadge } from "@/components/shared/status-badges";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  captureSourceLabels,
  captureStatusLabels,
  conversationInsightLabels,
  transcriptSourceLabels,
} from "@/data/constants";
import {
  formatCaptureDisplayText,
  formatCaptureObjectType,
} from "@/features/conversation-capture/display-copy";
import {
  formatCaptureResultDateLabel,
  formatCaptureResultRelativeLabel,
} from "@/features/conversation-capture/capture-result-date-labels";
import { formatDateLabel, formatRelative, trimText } from "@/lib/utils";

type CaptureResultPanelProps = {
  english?: boolean;
  session: {
    id: string;
    title: string | null;
    status: string;
    sourceType: keyof typeof captureSourceLabels;
    startedAt: Date;
    endedAt: Date | null;
    durationSeconds: number | null;
    errorMessage: string | null;
    objectType: string | null;
    objectId: string | null;
    linkedMeeting: {
      id: string;
      title: string;
      company: { id: string; name: string } | null;
      opportunity: { id: string; title: string } | null;
      contacts: Array<{ id: string; name: string }>;
    } | null;
    transcript: {
      fullText: string;
      confidence: number;
      sourceType: keyof typeof transcriptSourceLabels;
      provider: string | null;
      model: string | null;
      segments: Array<{
        speaker: string;
        startedAt: number;
        endedAt: number;
        text: string;
      }>;
    } | null;
    insightsByType: {
      facts: Array<{
        id: string;
        title: string;
        content: string;
        confidence: number;
      }>;
      commitments: Array<{
        id: string;
        title: string;
        content: string;
        confidence: number;
      }>;
      blockers: Array<{
        id: string;
        title: string;
        content: string;
        confidence: number;
      }>;
      risks: Array<{
        id: string;
        title: string;
        content: string;
        confidence: number;
      }>;
      nextActions: Array<{
        id: string;
        title: string;
        content: string;
        confidence: number;
      }>;
    };
    actions: Array<{
      id: string;
      title: string;
      description: string | null;
      executionMode: string;
      status: string;
      approvalTask: { status: string } | null;
      opportunity: { id: string; title: string } | null;
      contact: { id: string; name: string } | null;
      meeting: { id: string; title: string } | null;
    }>;
    approvals: Array<{
      id: string;
      status: string;
      actionItem: { title: string };
    }>;
    memoryWriteback: {
      facts: Array<{
        id: string;
        title: string;
        content: string;
        factType: string;
        confidence: number;
      }>;
      commitments: Array<{
        id: string;
        title: string;
        commitmentText: string;
        status: string;
        dueDate: Date | null;
      }>;
      blockers: Array<{
        id: string;
        title: string;
        blockerText: string;
        status: string;
        severity: number;
      }>;
    };
    refreshedRecommendations: Array<{
      objectType: string;
      objectId: string;
      objectLabel: string;
      recommendations: Array<{
        id: string;
        title: string;
        explanation: string;
        policyResult: string;
        recommendationPayload: Record<string, unknown>;
      }>;
    }>;
  } | null;
};

export function CaptureResultPanel({
  session,
  english = false,
}: CaptureResultPanelProps) {
  const copy = {
    emptyTitle: english ? "No capture result yet" : "还没有现场记录结果",
    emptyDescription: english
      ? "Start from dashboard, contact, company, opportunity or meeting pages. Helm will turn the transcript into facts, commitments, blockers and follow-up actions."
      : "你可以从首页、联系人、公司、机会或会议页直接开始记录。Helm会把转写文本转成事实、承诺、阻塞和后续动作。",
    resultBadge: english ? "Capture result" : "会话捕获结果",
    durationPrefix: english ? "Duration" : "时长",
    durationPending: english ? "Duration pending" : "时长待计算",
    updatedPrefix: english ? "Updated" : "最近更新",
    facts: english ? "Facts" : "事实",
    commitments: english ? "Commitments" : "承诺",
    blockers: english ? "Blockers" : "阻塞",
    actions: english ? "Actions" : "动作",
    linkedBack: english
      ? "This capture has already been written back into operating objects"
      : "本次现场记录已经回到经营对象里",
    meeting: english ? "Meeting:" : "会议：",
    opportunity: english ? "Opportunity:" : "机会：",
    company: english ? "Company:" : "公司：",
    contact: english ? "Contact:" : "联系人：",
    failedPrefix: english ? "Processing failed:" : "处理失败：",
    writtenFacts: english ? "Written-back facts" : "写回事实",
    refreshedObjects: english
      ? "Refreshed follow-up objects"
      : "刷新跟进对象",
    approvals: english ? "Approvals created" : "进入审批",
    insightsDescription: english
      ? "Helm has already surfaced the most important operating signals from the transcript."
      : "Helm已经把转写文本里最重要的经营信号提出来。",
    confidence: english ? "Confidence" : "置信度",
    noGroupPrefix: english ? "No" : "还没有",
    noGroupSuffix: english ? "yet" : "",
    groupEmptyDescription: english
      ? "This session has not yielded this category yet."
      : "本次现场记录里暂时没有提炼出该类结果。",
    writebackTitle: english
      ? "Usable meeting facts written back"
      : "已写回的会后可用信息",
    writebackDescription: english
      ? "This section shows the facts, commitments and blockers that were actually saved for future work."
      : "这里展示已经保存下来、后续可复用的事实、承诺和阻塞。",
    transcriptTitle: english ? "Transcript preview" : "转写预览",
    transcriptDescription: english
      ? "The transcript is a middle layer. The important part is how it already affects memory, actions and approvals."
      : "转写文本是中间层，重点不是全文，而是它已经如何影响记忆、动作和审批。",
    noTranscriptTitle: english ? "No transcript yet" : "还没有转写文本",
    noTranscriptDescription: english
      ? "Once the session ends, audio or note text will first be turned into a transcript and then move into the understanding chain."
      : "结束记录后，Helm会先把语音或速记转成转写文本，再进入理解链路。",
    actionTitle: english ? "Actions and approvals" : "动作与审批",
    actionDescription: english
      ? "Next steps extracted from the session do not stay as passive suggestions; they flow into the existing policy and approval chain."
      : "会话里识别出的下一步不会停在建议里，会先进入现有复核链路。",
    defaultActionDescription: english
      ? "The system will keep this action inside the governed routing chain."
      : "Helm会把这条动作继续送入受控路由链。",
    affectedObject: english ? "Affected object:" : "影响对象：",
    currentWorkspace: english ? "Current workspace" : "当前工作区",
    noActionTitle: english ? "No action generated yet" : "还没有生成动作",
    noActionDescription: english
      ? "If the transcript contains clear next steps, Helm will route them into suggestions and review."
      : "如果转写文本里出现明确下一步，Helm会把它送进建议和复核。",
    approvalTitle: english ? "Approval results" : "审批结果",
    approvalDescription: english
      ? "External or high-risk actions are routed into the review center first."
      : "对外或高风险动作会先进入复核中心。",
    approvalHint: english
      ? "Continue in the approval center"
      : "继续去审批中心确认",
    recommendationTitle: english
      ? "Recommendations affected by this session"
      : "受本次会话影响的建议",
    recommendationDescription: english
      ? "Capture does not stop at the transcript. Once processing finishes, relevant suggestions are refreshed and reviewed before they move forward."
      : "现场记录不会停在转写文本。处理完成后，相关建议会刷新，并先经过复核再继续推进。",
    noRecommendationTitle: english
      ? "No refreshed recommendation yet"
      : "还没有刷新后的建议",
    noRecommendationDescription: english
      ? "If the session did not materially change object state or memory, Helm will not force new suggestions."
      : "如果这次会话没有明显改变对象状态或记忆，Helm不会强行制造新的建议。",
  };
  if (!session) {
    return (
      <Card>
        <CardContent className="py-10">
          <EmptyState
            title={copy.emptyTitle}
            description={copy.emptyDescription}
          />
        </CardContent>
      </Card>
    );
  }

  const insightCards = [
    {
      key: "facts",
      label: english ? "Facts" : conversationInsightLabels.FACT,
      items: session.insightsByType.facts,
      icon: FileText,
    },
    {
      key: "commitments",
      label: english ? "Commitments" : conversationInsightLabels.COMMITMENT,
      items: session.insightsByType.commitments,
      icon: CheckCircle2,
    },
    {
      key: "blockers",
      label: english ? "Blockers" : conversationInsightLabels.BLOCKER,
      items: session.insightsByType.blockers,
      icon: AlertTriangle,
    },
    {
      key: "nextActions",
      label: english ? "Next actions" : conversationInsightLabels.NEXT_ACTION,
      items: session.insightsByType.nextActions,
      icon: Sparkles,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="approval">{copy.resultBadge}</Badge>
            <Badge variant="info">
              {english
                ? session.sourceType
                : (captureSourceLabels[session.sourceType] ??
                  session.sourceType)}
            </Badge>
            <Badge
              variant={
                session.status === "FAILED"
                  ? "danger"
                  : session.status === "PROCESSING"
                    ? "warning"
                    : "default"
              }
            >
              {english
                ? session.status
                : (captureStatusLabels[
                    session.status as keyof typeof captureStatusLabels
                  ] ?? session.status)}
            </Badge>
          </div>
          <CardTitle>
            {session.title ??
              session.linkedMeeting?.title ??
              (english ? "Untitled live capture" : "未命名现场记录")}
          </CardTitle>
          <CardDescription>
            {formatCaptureResultDateLabel(
              session.startedAt,
              english,
              formatDateLabel,
            )} ·{" "}
            {session.durationSeconds
              ? `${copy.durationPrefix} ${Math.round(session.durationSeconds / 60)} ${english ? "min" : "分钟"}`
              : copy.durationPending}{" "}
            · {copy.updatedPrefix}{" "}
            {formatCaptureResultRelativeLabel(
              session.endedAt ?? session.startedAt,
              english,
              formatRelative,
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Metric
              label={copy.facts}
              value={session.insightsByType.facts.length}
            />
            <Metric
              label={copy.commitments}
              value={session.insightsByType.commitments.length}
            />
            <Metric
              label={copy.blockers}
              value={session.insightsByType.blockers.length}
            />
            <Metric label={copy.actions} value={session.actions.length} />
          </div>

          {session.linkedMeeting ? (
            <div className="workspace-panel-muted rounded-2xl px-4 py-4">
              <p className="text-sm font-medium text-[color:var(--foreground)]">
                {copy.linkedBack}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-[color:var(--muted)]">
                <Link
                  href={`/meetings/${session.linkedMeeting.id}`}
                  className="rounded-xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)] px-3 py-2 shadow-sm transition hover:border-[color:var(--border-strong)]"
                >
                  {copy.meeting}
                  {session.linkedMeeting.title}
                </Link>
                {session.linkedMeeting.opportunity ? (
                  <Link
                    href={`/opportunities?opportunityId=${session.linkedMeeting.opportunity.id}`}
                    className="rounded-xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)] px-3 py-2 shadow-sm transition hover:border-[color:var(--border-strong)]"
                  >
                    {copy.opportunity}
                    {session.linkedMeeting.opportunity.title}
                  </Link>
                ) : null}
                {session.linkedMeeting.company ? (
                  <Link
                    href={`/companies/${session.linkedMeeting.company.id}`}
                    className="rounded-xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)] px-3 py-2 shadow-sm transition hover:border-[color:var(--border-strong)]"
                  >
                    {copy.company}
                    {session.linkedMeeting.company.name}
                  </Link>
                ) : null}
                {session.linkedMeeting.contacts[0] ? (
                  <Link
                    href={`/contacts/${session.linkedMeeting.contacts[0].id}`}
                    className="rounded-xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)] px-3 py-2 shadow-sm transition hover:border-[color:var(--border-strong)]"
                  >
                    {copy.contact}
                    {session.linkedMeeting.contacts[0].name}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {session.errorMessage ? (
            <div className="rounded-2xl border border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)] px-4 py-4 text-sm text-[color:var(--status-danger-text)]">
              {copy.failedPrefix}
              {session.errorMessage}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <Metric
              label={copy.writtenFacts}
              value={session.memoryWriteback.facts.length}
            />
            <Metric
              label={copy.refreshedObjects}
              value={session.refreshedRecommendations.length}
            />
            <Metric label={copy.approvals} value={session.approvals.length} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          {insightCards.map((group) => (
            <Card key={group.key}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <group.icon className="h-4 w-4 text-[var(--accent)]" />
                  <CardTitle>{group.label}</CardTitle>
                </div>
                <CardDescription>{copy.insightsDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {group.items.length ? (
                  group.items.map((item) => (
                    <div
                      key={item.id}
                      className="workspace-panel rounded-2xl px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-[color:var(--foreground)]">
                          {item.title}
                        </p>
                        <Badge variant="neutral">
                          {copy.confidence} {item.confidence}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                        {formatCaptureDisplayText(item.content, english)}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title={
                      english
                        ? `${copy.noGroupPrefix} ${group.label} ${copy.noGroupSuffix}`.trim()
                        : `${copy.noGroupPrefix}${group.label}`
                    }
                    description={copy.groupEmptyDescription}
                  />
                )}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle>{copy.writebackTitle}</CardTitle>
              <CardDescription>{copy.writebackDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <WritebackGroup
                title={english ? "Facts" : "事实"}
                description={
                  english
                    ? "Written to MemoryFact and will affect briefing and recommendation."
                    : "已写回记忆事实，并会影响简报与建议。"
                }
                english={english}
                items={session.memoryWriteback.facts.map((item) => ({
                  id: item.id,
                  title: formatCaptureDisplayText(item.title, english),
                  content: formatCaptureDisplayText(item.content, english),
                  meta: english
                    ? `Type ${item.factType} · Confidence ${item.confidence}`
                    : `类型 ${formatCaptureDisplayText(item.factType, english)} · 置信度 ${item.confidence}`,
                }))}
              />
              <WritebackGroup
                title={english ? "Commitments" : "承诺"}
                description={
                  english
                    ? "Written to Commitment and will affect overdue checks and recommendation ranking."
                    : "已写回承诺，会进入逾期判断和后续建议排序。"
                }
                english={english}
                items={session.memoryWriteback.commitments.map((item) => ({
                  id: item.id,
                  title: formatCaptureDisplayText(item.title, english),
                  content: formatCaptureDisplayText(
                    item.commitmentText,
                    english,
                  ),
                  meta: english
                    ? `Status ${item.status}${
                        item.dueDate
                          ? ` · Due ${formatCaptureResultDateLabel(
                              item.dueDate,
                              english,
                              formatDateLabel,
                            )}`
                          : ""
                      }`
                    : `状态 ${formatCaptureDisplayText(item.status, english)}${item.dueDate ? ` · 截止 ${formatDateLabel(item.dueDate)}` : ""}`,
                }))}
              />
              <WritebackGroup
                title={english ? "Blockers" : "阻塞"}
                description={
                  english
                    ? "Written to Blocker and will affect risk assessment, follow-up and recommendation explanation."
                    : "已写回阻塞，会进入风险判断、会后推进和建议说明。"
                }
                english={english}
                items={session.memoryWriteback.blockers.map((item) => ({
                  id: item.id,
                  title: formatCaptureDisplayText(item.title, english),
                  content: formatCaptureDisplayText(item.blockerText, english),
                  meta: english
                    ? `Status ${item.status} · Severity ${item.severity}`
                    : `状态 ${formatCaptureDisplayText(item.status, english)} · 严重度 ${item.severity}`,
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[var(--accent)]" />
                <CardTitle>{copy.transcriptTitle}</CardTitle>
              </div>
              <CardDescription>{copy.transcriptDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {session.transcript ? (
                <>
                  <div className="workspace-panel-muted rounded-2xl px-4 py-4 text-sm leading-7 text-[color:var(--foreground)]">
                    {trimText(
                      formatCaptureDisplayText(
                        session.transcript.fullText,
                        english,
                      ),
                      420,
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-[color:var(--muted-foreground)]">
                    <span>
                      {copy.confidence} {session.transcript.confidence}
                    </span>
                    <span>·</span>
                    <span>
                      {english
                        ? session.transcript.sourceType
                        : formatCaptureDisplayText(
                            transcriptSourceLabels[
                              session.transcript.sourceType
                            ] ?? session.transcript.sourceType,
                            english,
                          )}
                    </span>
                    {session.transcript.provider ? (
                      <>
                        <span>·</span>
                        <span>
                          {session.transcript.provider}
                          {session.transcript.model
                            ? ` / ${session.transcript.model}`
                            : ""}
                        </span>
                      </>
                    ) : null}
                    <span>·</span>
                    <span>
                      {session.transcript.segments.length}{" "}
                      {english ? "segments" : "个片段"}
                    </span>
                  </div>
                </>
              ) : (
                <EmptyState
                  title={copy.noTranscriptTitle}
                  description={copy.noTranscriptDescription}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-[var(--accent)]" />
                <CardTitle>{copy.actionTitle}</CardTitle>
              </div>
              <CardDescription>{copy.actionDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {session.actions.length ? (
                session.actions.map((item) => (
                  <div
                    key={item.id}
                    className="theme-surface-panel rounded-2xl px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[color:var(--foreground)]">{item.title}</p>
                      <CaptureActionModeBadge
                        mode={item.executionMode}
                        english={english}
                      />
                      {item.approvalTask ? (
                        <ApprovalBadge
                          status={item.approvalTask.status as never}
                        />
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {formatCaptureDisplayText(
                        item.description ?? copy.defaultActionDescription,
                        english,
                      )}
                    </p>
                    <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
                      {copy.affectedObject}
                      {item.contact?.name ??
                        item.opportunity?.title ??
                        item.meeting?.title ??
                        copy.currentWorkspace}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title={copy.noActionTitle}
                  description={copy.noActionDescription}
                />
              )}
            </CardContent>
          </Card>

          {session.approvals.length ? (
            <Card>
              <CardHeader>
                <CardTitle>{copy.approvalTitle}</CardTitle>
                <CardDescription>{copy.approvalDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {session.approvals.map((approval) => (
                  <Link
                    key={approval.id}
                    href="/approvals"
                    className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] px-4 py-3 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                  >
                    <div>
                      <p className="font-medium text-[color:var(--foreground)]">
                        {approval.actionItem.title}
                      </p>
                      <p className="text-sm text-[color:var(--muted-foreground)]">
                        {copy.approvalHint}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <ApprovalBadge status={approval.status as never} />
                      <ArrowRight className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{copy.recommendationTitle}</CardTitle>
              <CardDescription>
                {copy.recommendationDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {session.refreshedRecommendations.length ? (
                session.refreshedRecommendations.map((group) => (
                  <div
                    key={`${group.objectType}:${group.objectId}`}
                    className="workspace-panel rounded-2xl px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info">
                        {formatCaptureObjectType(group.objectType, english)}
                      </Badge>
                      <p className="font-medium text-[color:var(--foreground)]">
                        {group.objectLabel}
                      </p>
                    </div>
                    <div className="mt-3 space-y-3">
                      {group.recommendations.map((item) => (
                        <div
                          key={item.id}
                          className="workspace-panel-muted rounded-2xl px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-[color:var(--foreground)]">
                              {formatCaptureDisplayText(item.title, english)}
                            </p>
                            <CaptureActionModeBadge
                              mode={item.policyResult}
                              english={english}
                            />
                            {typeof item.recommendationPayload.decisionLabel ===
                            "string" ? (
                              <Badge variant="approval">
                                {String(
                                  item.recommendationPayload.decisionLabel,
                                )}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                            {trimText(
                              formatCaptureDisplayText(
                                item.explanation,
                                english,
                              ),
                              180,
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title={copy.noRecommendationTitle}
                  description={copy.noRecommendationDescription}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="workspace-panel rounded-2xl px-4 py-4">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function CaptureActionModeBadge({
  mode,
  english,
}: {
  mode: string;
  english: boolean;
}) {
  const variant =
    mode === "AUTO_WITHIN_THRESHOLD"
      ? "info"
      : mode === "REQUIRES_APPROVAL"
        ? "approval"
        : mode === "FORBIDDEN"
          ? "danger"
          : "neutral";

  return (
    <Badge variant={variant}>
      {formatCaptureActionModeLabel(mode, english)}
    </Badge>
  );
}

function formatCaptureActionModeLabel(mode: string, english: boolean) {
  if (mode === "AUTO_WITHIN_THRESHOLD") {
    return english ? "Prepared inside policy boundary" : "策略内准备";
  }
  if (mode === "REQUIRES_APPROVAL") {
    return english ? "Needs approval" : "需逐条审批";
  }
  if (mode === "SUGGEST_ONLY") {
    return english ? "Suggestion only" : "仅建议";
  }
  if (mode === "FORBIDDEN") {
    return english ? "Blocked by policy" : "策略禁止";
  }

  return english ? mode : formatCaptureDisplayText(mode, english);
}

function WritebackGroup({
  title,
  description,
  items,
  english = false,
}: {
  title: string;
  description: string;
  items: Array<{ id: string; title: string; content: string; meta: string }>;
  english?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium text-[color:var(--foreground)]">{title}</p>
        <p className="text-sm text-[color:var(--muted-foreground)]">{description}</p>
      </div>
      {items.length ? (
        items.map((item) => (
          <div key={item.id} className="workspace-panel rounded-2xl px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-[color:var(--foreground)]">{item.title}</p>
              <Badge variant="neutral">{item.meta}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              {item.content}
            </p>
          </div>
        ))
      ) : (
        <EmptyState
          title={
            english ? `No written-back ${title} yet` : `还没有写回 ${title}`
          }
          description={
            english
              ? "This session has not produced this class of structured output yet."
              : "这次会话暂时没有产出这一类可用信息。"
          }
        />
      )}
    </div>
  );
}
