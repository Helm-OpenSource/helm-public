import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { getInboxData, getInboxViewerEmail } from "@/features/inbox/queries";
import { logPageViewEvent } from "@/lib/analytics/session-events";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import { buildInboxDetailPageModel } from "@/features/inbox-followup-review-request/detail-model";
import { InboxFollowupReviewRequestDetailView } from "@/features/inbox-followup-review-request/detail-view";
import { parseThreadParticipants } from "@/features/inbox/thread-participants";
import {
  EmailThreadLatestState,
  EmailThreadTranscript,
} from "@/features/inbox/email-thread-transcript";
import { MountWhenOpen } from "@/components/shared/mount-when-open";
import { PageHeader } from "@/components/shared/page-header";
import { RelatedObjectLinks } from "@/components/shared/related-object-links";
import {
  SystemJudgementSummary,
  systemJudgementDetailsClassName,
} from "@/components/shared/system-judgement-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function ThreadFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="workspace-panel rounded-2xl px-4 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{label}</p>
      <div className="mt-2 break-words text-sm font-medium text-[color:var(--foreground)]">
        {children}
      </div>
    </div>
  );
}

const factLinkClassName =
  "text-[color:var(--accent)] underline-offset-4 hover:underline";

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
  const viewerEmail = await getInboxViewerEmail(workspace.id, user.id);
  const inbox = await getInboxData(workspace.id, {
    selectedThreadId: id,
    viewerEmail,
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
  const participants = parseThreadParticipants(thread.participants);
  const notLinked = english ? "Not linked" : "未关联";

  // Object first: the thread, its full messages and the next hops come first;
  // the inbox chain shell folds into the single closing system judgement block.
  return (
    <div className="workspace-surface-stack" data-source-page={`/inbox/${thread.id}`}>
      <PageHeader
        eyebrow={english ? "Inbox" : "收件箱"}
        title={thread.subject}
        english={english}
        actions={
          <Button variant="secondary" asChild>
            <Link href={`/inbox?threadId=${thread.id}`}>
              {english ? "Back to inbox preview" : "返回收件箱预览"}
            </Link>
          </Button>
        }
      />

      <Card data-inbox-thread-facts="true">
        <CardContent className="space-y-4 py-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ThreadFact label={english ? "Counterpart" : "对方"}>
              {thread.counterpart}
            </ThreadFact>
            <ThreadFact label={english ? "Contact" : "联系人"}>
              {thread.contact ? (
                <Link href={`/contacts/${thread.contact.id}`} className={factLinkClassName}>
                  {thread.contact.name}
                </Link>
              ) : (
                notLinked
              )}
            </ThreadFact>
            <ThreadFact label={english ? "Company" : "公司"}>
              {thread.company ? (
                <Link href={`/companies/${thread.company.id}`} className={factLinkClassName}>
                  {thread.company.name}
                </Link>
              ) : (
                notLinked
              )}
            </ThreadFact>
            <ThreadFact label={english ? "Opportunity" : "机会"}>
              {thread.opportunity ? (
                <Link
                  href={`/opportunities?opportunityId=${thread.opportunity.id}`}
                  className={factLinkClassName}
                >
                  {thread.opportunity.title}
                </Link>
              ) : (
                notLinked
              )}
            </ThreadFact>
          </div>
          {participants.length ? (
            <p className="break-words text-sm text-[color:var(--muted-foreground)]">
              {english ? "Participants: " : "参与人："}
              {participants.join(english ? ", " : "、")}
            </p>
          ) : null}
          <EmailThreadLatestState thread={thread} english={english} />
          <RelatedObjectLinks links={model.actions} english={english} />
        </CardContent>
      </Card>

      <Card data-inbox-thread-messages="true">
        <CardHeader>
          <CardTitle>
            {english
              ? `Full email thread content · ${thread.messages.length}`
              : `完整邮件线程内容 · ${thread.messages.length} 封`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {thread.messages.length ? (
            <EmailThreadTranscript thread={thread} english={english} />
          ) : (
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {english ? "This thread has no messages." : "这个线程没有邮件。"}
            </p>
          )}
        </CardContent>
      </Card>

      <details className={systemJudgementDetailsClassName} data-system-judgement>
        <SystemJudgementSummary english={english} />
        <div className="px-4 pb-5">
          <MountWhenOpen>
            <InboxFollowupReviewRequestDetailView model={model} english={english} />
          </MountWhenOpen>
        </div>
      </details>
    </div>
  );
}
