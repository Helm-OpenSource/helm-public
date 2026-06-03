"use client";

import { DatabaseZap, FolderSearch, ShieldCheck } from "lucide-react";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMeetingDisplayText } from "@/features/meetings/display-copy";
import type { MeetingConnectorIngestionRetrievalSummary } from "@/lib/helm-v2/connector-ingestion-retrieval-runtime";
import { formatDateLabel } from "@/lib/utils";

type MeetingV2IngestionRetrievalCardProps = {
  meetingId: string;
  runtime: MeetingConnectorIngestionRetrievalSummary | null;
};

function renderTrustVariant(value: string) {
  if (value.includes("system_of_record") || value.includes("trusted")) return "success" as const;
  if (value.includes("draft")) return "warning" as const;
  return "danger" as const;
}

function renderModeVariant(value: string) {
  if (value === "always_on") return "info" as const;
  if (value === "event_triggered" || value === "stage_triggered") return "approval" as const;
  return "neutral" as const;
}

function formatIngestionLabel(value: string, english: boolean) {
  if (english) return value.replace(/_/g, " ");

  const labels: Record<string, string> = {
    trusted: "可信",
    untrusted: "未确认",
    draft_only: "仅草稿",
    system_of_record: "正式记录",
    human_confirmed: "人工确认",
    meeting_transcript: "会议转写",
    calendar_event: "日历事件",
    email_thread: "邮件线程",
    always_on: "常驻",
    event_triggered: "事件触发",
    stage_triggered: "阶段触发",
  };

  return labels[value] ?? value.replace(/_/g, " ");
}

export function MeetingV2IngestionRetrievalCard({ meetingId, runtime }: MeetingV2IngestionRetrievalCardProps) {
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";

  return (
    <Card className="workspace-panel" data-helm-v2-ingestion-retrieval="true">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{english ? "Helm v2 · ingestion" : "Helm v2 · 接入"}</Badge>
	          <Badge variant="neutral">{english ? "connector ingestion + retrieval policy" : "连接器接入与检索策略"}</Badge>
          {runtime?.latestRuntimeEvent ? (
            <Badge variant="approval">
	              {english ? "latest runtime" : "最近运行"} · {formatMeetingDisplayText(runtime.latestRuntimeEvent.eventType, english)}
            </Badge>
          ) : null}
        </div>
        <div className="space-y-1">
          <CardTitle>
	            {english ? "Helm v2 richer ingestion and retrieval trace" : "接入与检索记录"}
          </CardTitle>
          <CardDescription>
            {runtime
              ? english
                ? "This trace explains which sources entered the runtime, which inputs remain trusted or untrusted, and why only selected memory was loaded."
	                : "这张记录会说明当前运行链使用了哪些来源、哪些输入仍需复核，以及为什么只加载这部分记忆。"
              : english
                ? "No ingestion / retrieval trace yet."
	                : "当前会议还没有接入与检索记录。"}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {runtime ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
	                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "sources" : "来源"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{runtime.sourceCoverage.total}</p>
	                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "connector inputs normalized" : "已整理连接器输入"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
	                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "trusted / sor" : "可信 / 正式记录"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                  {runtime.sourceCoverage.trusted}/{runtime.sourceCoverage.systemOfRecord}
                </p>
	                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "trusted vs system-of-record posture" : "可信来源与正式记录的比例"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
	                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "draft-only" : "仅草稿"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{runtime.sourceCoverage.draftOnly}</p>
	                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "cannot promote without confirm" : "未经确认不能提升为事实"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
	                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "retrieval traces" : "检索记录"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{runtime.traces.length}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  {runtime.latestRuntimeEvent
                    ? `${english ? "synced" : "同步于"} ${formatDateLabel(runtime.latestRuntimeEvent.createdAt)}`
                    : english
                      ? "trace ready"
	                      : "记录已就绪"}
                </p>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <div className="flex items-center gap-2">
                    <DatabaseZap className="h-4 w-4 text-[color:var(--muted-foreground)]" />
	                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Ingestion sources" : "接入来源"}</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {runtime.sources.map((source) => (
                      <div key={`${meetingId}-${source.id}`} className="rounded-2xl border border-[color:var(--border)] bg-white/90 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
	                          <Badge variant="neutral">{formatIngestionLabel(source.ingestionSourceType, english)}</Badge>
	                          <Badge variant={renderTrustVariant(source.ingestionTrustLevel)}>{formatIngestionLabel(source.ingestionTrustLevel, english)}</Badge>
	                          <Badge variant={renderTrustVariant(source.trustPromotionStatus)}>{formatIngestionLabel(source.trustPromotionStatus, english)}</Badge>
	                          <Badge variant={renderTrustVariant(source.ingestionPromotionEligibility)}>{formatIngestionLabel(source.ingestionPromotionEligibility, english)}</Badge>
	                        </div>
	                        <p className="mt-3 text-sm font-semibold text-[color:var(--foreground)]">{formatMeetingDisplayText(source.ingestionSummary, english)}</p>
	                        <p className="mt-1 text-sm text-[color:var(--muted)]">{formatMeetingDisplayText(source.ingestionBoundaryNote, english)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {source.ingestionExtractedFacts.slice(0, 4).map((item) => (
                            <Badge key={`${source.id}-${item}`} variant="info">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[color:var(--muted-foreground)]" />
	                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Boundary notes" : "边界说明"}</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {runtime.boundaryNotes.map((note) => (
                      <p key={`${meetingId}-${note}`} className="text-sm leading-6 text-[color:var(--muted)]">
	                        {formatMeetingDisplayText(note, english)}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <div className="flex items-center gap-2">
                    <FolderSearch className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Retrieval trace" : "检索轨迹"}</p>
                  </div>
                  <div className="mt-4 space-y-4">
                    {runtime.traces.map((trace) => (
                      <div key={`${meetingId}-${trace.id}`} className="rounded-2xl border border-[color:var(--border)] bg-white/90 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="neutral">{trace.runtimeLabel}</Badge>
                          <Badge variant={renderModeVariant(trace.mode)}>{trace.mode}</Badge>
                          <Badge variant="neutral">{trace.bucket}</Badge>
                        </div>
                        <p className="mt-3 text-sm text-[color:var(--muted)]">{trace.rationale}</p>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "loaded" : "已加载"}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {trace.loadedRefs.length > 0 ? (
                                trace.loadedRefs.map((item) => (
                                  <Badge key={`${trace.id}-${item.key}-loaded`} variant="success">
                                    {item.key}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-[color:var(--muted-foreground)]">{english ? "none" : "暂无"}</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "skipped / on-demand" : "已跳过 / 按需"}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {trace.skippedRefs.length > 0 ? (
                                trace.skippedRefs.map((item) => (
                                  <Badge key={`${trace.id}-${item.key}-skipped`} variant="warning">
                                    {item.key}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-[color:var(--muted-foreground)]">{english ? "none" : "暂无"}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Loading strategy" : "加载策略"}</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "always_on" : "始终加载"}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {runtime.loadingStrategy.alwaysOn.map((item) => (
                          <Badge key={`${meetingId}-always-${item}`} variant="info">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "event_triggered" : "事件触发"}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {runtime.loadingStrategy.eventTriggered.map((item) => (
                          <Badge key={`${meetingId}-event-${item}`} variant="approval">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "stage_triggered" : "阶段触发"}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {runtime.loadingStrategy.stageTriggered.map((item) => (
                          <Badge key={`${meetingId}-stage-${item}`} variant="neutral">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "on_demand" : "按需加载"}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {runtime.loadingStrategy.onDemand.map((item) => (
                          <Badge key={`${meetingId}-demand-${item}`} variant="warning">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-white/80 px-5 py-6 text-sm text-[color:var(--muted-foreground)]">
            {english ? "No connector ingestion / retrieval trace has been generated for this meeting yet." : "当前会议还没有生成 connector ingestion / retrieval 轨迹。"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
