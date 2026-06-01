import { notFound } from "next/navigation";
import Link from "next/link";
import { ConnectorProvider } from "@prisma/client";
import { getInboxData } from "@/features/inbox/queries";
import { logPageViewEvent } from "@/lib/analytics";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import { formatDateLabel } from "@/lib/utils";
import { buildInboxDetailPageModel } from "@/features/inbox-followup-review-request/detail-model";
import { InboxFollowupReviewRequestDetailView } from "@/features/inbox-followup-review-request/detail-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInboxMessageBody } from "@/features/inbox/message-formatting";

export default async function InboxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await getCurrentWorkspace();
  const user = await requireCurrentUser();
  const locale = await resolveWorkspaceUiLocaleForRequest({
    workspaceDefaultLocale: workspace.defaultLocale,
  });
  const english = isEnglishLocale(locale);
  const connector = await db.connector.findUnique({
    where: {
      workspaceId_userId_provider: {
        workspaceId: workspace.id,
        userId: user.id,
        provider: ConnectorProvider.GMAIL,
      },
    },
  });
  const inbox = await getInboxData(workspace.id, {
    selectedThreadId: id,
    viewerEmail: connector?.externalAccountEmail ?? null,
  });
  const thread = inbox.selected?.id === id ? inbox.selected : null;

  if (!thread) return notFound();

  await logPageViewEvent({
    eventName: "inbox_detail_opened",
    sourcePage: `/inbox/${thread.id}`,
    targetType: "EmailThread",
    targetId: thread.id,
    metadata: {
      actor: user.id,
      mode: "inbox-detail",
    },
  });

  const hasReviewRequest = Boolean(
    thread.opportunity?.id &&
      inbox.threads.some(
        (item) =>
          item.opportunity?.id === thread.opportunity?.id &&
          (item.shouldReply || item.status === "WAITING_US"),
      ),
  );

  const model = buildInboxDetailPageModel({
    thread,
    english,
    hasReviewRequest,
  });

  return (
    <div className="workspace-surface-stack">
      <InboxFollowupReviewRequestDetailView model={model} english={english} />
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>
            {english ? "Full email thread content" : "完整邮件线程内容"}
          </CardTitle>
          <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
            {english
              ? "The inbox first screen stays concise. Use this section to read every message in full."
              : "收件箱首屏保持精简，这里用于查看每一封邮件的完整正文。"}
          </p>
          <Link
            href={`/inbox?threadId=${thread.id}`}
            className="text-sm font-medium text-[color:var(--accent)] underline-offset-4 hover:underline"
          >
            {english ? "Back to inbox preview" : "返回收件箱预览"}
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {thread.messages.map((message) => (
            <article
              key={message.id}
              className={`rounded-2xl px-4 py-4 ${message.isInbound ? "border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)]" : "bg-[color:var(--accent)] text-[color:var(--accent-foreground)]"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  className={`text-sm font-semibold ${message.isInbound ? "text-[color:var(--foreground)]" : "text-[color:var(--accent-foreground)]"}`}
                >
                  {message.sender}
                  <span
                    className={`ml-2 text-xs font-normal ${message.isInbound ? "text-[color:var(--muted-foreground)]" : "text-[color:color-mix(in_oklab,var(--accent-foreground)_72%,transparent)]"}`}
                  >
                    {message.senderEmail}
                  </span>
                </p>
                <p
                  className={`text-xs ${message.isInbound ? "text-[color:var(--muted-foreground)]" : "text-[color:color-mix(in_oklab,var(--accent-foreground)_72%,transparent)]"}`}
                >
                  {formatDateLabel(message.sentAt)}
                </p>
              </div>
              <p
                className={`mt-3 whitespace-pre-wrap break-words text-sm leading-7 ${message.isInbound ? "text-[color:var(--foreground)]" : "text-[color:color-mix(in_oklab,var(--accent-foreground)_86%,transparent)]"}`}
              >
                {formatInboxMessageBody(message.body, english)}
              </p>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
