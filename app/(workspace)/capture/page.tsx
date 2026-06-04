import Link from "next/link";
import { ArrowRight, Mic, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SupportSurfaceNote } from "@/components/shared/support-surface-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { logPageViewEvent } from "@/lib/analytics";
import {
  getCaptureSessionDetails,
  getRecentCaptureSessions,
} from "@/lib/conversation-capture/capture-session.service";
import {
  getLocalizedCaptureSourceLabels,
  getLocalizedCaptureStatusLabels,
} from "@/lib/i18n/labels";
import { getUiMessages } from "@/lib/i18n/messages";
import {
  getDeploymentProfileDefaultLocaleCandidate,
  getRequestUiLocaleCandidate,
} from "@/lib/i18n/request-locale.server";
import { formatDateLabel, trimText } from "@/lib/utils";
import { normalizeWorkspaceUiConfig } from "@/lib/workspace-ops";
import { CaptureResultPanel } from "@/features/conversation-capture/capture-result-panel";
import { formatCapturePageDateLabel } from "@/features/conversation-capture/capture-page-date-labels";
import { formatCaptureDisplayText } from "@/features/conversation-capture/display-copy";
import { StartRecordingButton } from "@/features/conversation-capture/start-recording-button";

export default async function CapturePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await getCurrentWorkspace();
  await requireCurrentUser();
  const requestLocale = await getRequestUiLocaleCandidate();
  const uiConfig = normalizeWorkspaceUiConfig({
    ...workspace,
    requestLocale,
    deploymentProfileDefaultLocale: getDeploymentProfileDefaultLocaleCandidate(),
  });
  const messages = getUiMessages(uiConfig.locale);
  const english = uiConfig.locale === "en-US";
  const formatCaptureDate = (value: Date | string | null | undefined) =>
    formatCapturePageDateLabel(value, english, formatDateLabel);
  const captureSourceLabels = getLocalizedCaptureSourceLabels(uiConfig.locale);
  const captureStatusLabels = getLocalizedCaptureStatusLabels(uiConfig.locale);
  const params = (await searchParams) ?? {};
  const requestedSessionId =
    typeof params.sessionId === "string" ? params.sessionId : null;

  const sessions: Awaited<ReturnType<typeof getRecentCaptureSessions>> =
    await getRecentCaptureSessions(workspace.id, 12);
  const selectedSessionId = requestedSessionId ?? sessions[0]?.id ?? null;
  const selectedSession = selectedSessionId
    ? await getCaptureSessionDetails(workspace.id, selectedSessionId)
    : null;

  await logPageViewEvent({
    eventName: "conversation_capture_opened",
    sourcePage: "/capture",
    targetType: "Page",
    targetId: "/capture",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={messages.capture.pageEyebrow}
        title={messages.capture.pageTitle}
        description={messages.capture.pageDescription}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/memory">
                {english ? "Open meeting memory" : "查看会议记忆"}
              </Link>
            </Button>
            <StartRecordingButton />
          </>
        }
      />

      <SupportSurfaceNote
        label={english ? "Capture scope" : "录制范围"}
        title={
          english
            ? "Record now. Leave with facts, commitments and next steps."
            : "现在录制，会后直接拿到事实、承诺和下一步。"
        }
        summary={
          english
            ? "Keep the conversation moving. After the meeting, the customer facts and follow-ups are ready for review."
            : "你继续开会；会后直接看客户事实、承诺、阻塞和待确认动作。"
        }
        items={[
          {
            label: english ? "What it does" : "做什么",
            value: english
              ? "Records, transcribes, and extracts facts / commitments / blockers."
              : "录音、转写、提取事实 / 承诺 / 阻塞。",
          },
          {
            label: english ? "What it never does" : "绝不做什么",
            value: english
              ? "Send messages to your customer. Modify CRM without your click. Decide for you."
              : "向客户发送任何消息。未经你点击就改写客户关系管理系统。替你决策。",
          },
          {
            label: english ? "After the meeting" : "会后",
            value: english
              ? "Open review or memory and decide the next customer move."
              : "打开复核或记忆，决定下一步客户动作。",
          },
        ]}
      />

      <Card>
        <CardContent className="grid gap-4 py-5 md:grid-cols-4">
          <Overview
            label={english ? "Press record" : "按下录制"}
            value={
              english
                ? "Record → Stop → Done"
                : "录制 → 结束 → 处理完成"
            }
            detail={
              english
                ? "Customer calls, interviews, partnership talks and priority meetings."
                : "客户会议、招聘面试、合作沟通、内部优先级会。"
            }
          />
          <Overview
            label={english ? "What you get after the meeting" : "会后拿到什么"}
            value={
              english
                ? "Facts · commitments · blockers"
                : "事实 · 承诺 · 阻塞"
            }
            detail={
              english
                ? "Extracted from the transcript before you clean up notes."
                : "先从转写里提取出来，你不用先整理笔记。"
            }
          />
          <Overview
            label={english ? "Where it is used" : "信息用到哪里"}
            value={
              english
                ? "Memory · dashboard · approvals"
                : "经营记忆 · 仪表盘 · 复核中心"
            }
            detail={
              english
                ? "Today's calls, this week's report, and review queue."
                : "今天要打的电话、本周周报和待确认动作。"
            }
          />
          <Overview
            label={english ? "Recent" : "最近"}
            value={
              english
                ? `${sessions.length} sessions`
                : `${sessions.length} 场`
            }
            detail={
              english
                ? "Open a session to inspect what became facts or next steps."
                : "点开一场，看哪些内容变成事实或下一步。"
            }
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-[var(--accent)]" />
              <CardTitle>{english ? "Recent sessions" : "最近的录制"}</CardTitle>
            </div>
            <CardDescription>
              {english
                ? "Manual recordings and external feeds, all in one place. Click any one to confirm what landed in memory and what didn't."
                : "手动录制 + 外部接入，集中在一处。点开任意一场，可以核对哪些内容写回了经营记忆、哪些没有。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.length ? (
              sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/capture?sessionId=${session.id}`}
                  aria-label={
                    english
                      ? `Open capture result: ${session.title ?? session.linkedMeeting?.title ?? "Untitled live capture"}`
                      : `查看现场记录结果：${session.title ?? session.linkedMeeting?.title ?? "未命名现场记录"}`
                  }
                  className={`block rounded-2xl border px-4 py-4 transition ${
                    session.id === selectedSessionId
                      ? "border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)]"
                      : "border-[color:var(--border)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="approval">
                      {english
                        ? session.sourceType
                        : (captureSourceLabels[
                            session.sourceType as keyof typeof captureSourceLabels
                          ] ?? session.sourceType)}
                    </Badge>
                    <Badge
                      variant={
                        session.status === "FAILED"
                          ? "danger"
                          : session.status === "PROCESSING"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {english
                        ? session.status
                        : (captureStatusLabels[
                            session.status as keyof typeof captureStatusLabels
                          ] ?? session.status)}
                    </Badge>
                    {session.linkedMeeting ? (
                      <Badge variant="info">
                        {english ? "Meeting updated" : "已回写会议"}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 font-medium text-[color:var(--foreground)]">
                    {session.title ??
                      session.linkedMeeting?.title ??
                      (english ? "Untitled live capture" : "未命名现场记录")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                    {trimText(
                      formatCaptureDisplayText(
                        session.transcript?.fullText ??
                          (english
                            ? "After capture stops, the system will generate a transcript and move into the operating-understanding pipeline."
                            : "结束记录后，Helm会在后台生成转写文本并进入经营理解链路。"),
                        english,
                      ),
                      88,
                    )}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[color:var(--muted-foreground)]">
                    <span>{formatCaptureDate(session.startedAt)}</span>
                    <span className="inline-flex items-center gap-1">
                      {english ? "Open result" : "查看结果"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState
                title={
                  english ? "No captured session yet" : "还没有任何现场记录"
                }
                description={
                  english
                    ? "Start from here directly, or enter from a contact, opportunity, company or meeting with context attached."
                    : "可以从这里直接开始记录，也可以从联系人、机会、公司或会议页带着上下文进入。"
                }
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <CaptureResultPanel
            session={selectedSession as never}
            english={english}
          />

          {selectedSession ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                  <CardTitle>
                    {english ? "Session value" : "会话价值"}
                  </CardTitle>
                </div>
                <CardDescription>
                  {english
                    ? "The value is not the full transcript itself, but how quickly the session turns real blockers and next steps into usable customer information."
                    : "现场记录的价值在于更快把真实阻塞和下一步变成可用的客户信息。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-[color:var(--muted)]">
                <p>
                  {english
                    ? "1. The transcript is only a middle layer; Helm first surfaces blockers, commitments and next steps you can act on."
                    : "1. 转写文本只是中间层，Helm会先把会话里的阻塞、承诺和推进动作提出来。"}
                </p>
                <p>
                  {english
                    ? "2. High-risk or external actions still go through review before they affect customers."
                    : "2. 高风险或对外动作仍会先进入复核，不会直接影响客户。"}
                </p>
                <p>
                  {english
                    ? "3. Once processing finishes, meetings, contacts, opportunities, dashboard and approvals all reflect the new information immediately."
                    : "3. 处理完成后，会议页、联系人页、机会页、首页和审批中心都会立刻感知到变化。"}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Overview({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="workspace-panel rounded-2xl px-4 py-4">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">{detail}</p>
    </div>
  );
}
