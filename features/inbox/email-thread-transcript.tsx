import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInboxDateLabel } from "@/features/inbox/inbox-date-labels";
import { formatInboxMessageBody } from "@/features/inbox/message-formatting";
import { formatDateLabel } from "@/lib/utils";

type DateValue = Date | string;

export type EmailTranscriptMessage = {
  id: string;
  sender: string;
  senderEmail: string;
  body: string;
  isInbound: boolean;
  sentAt: DateValue;
};

export type EmailTranscriptThread = {
  id: string;
  subject: string;
  counterpart: string;
  status: "OPEN" | "WAITING_US" | "WAITING_THEM" | "CLOSED";
  updatedAt: DateValue;
  messages: readonly EmailTranscriptMessage[];
};

function toTime(value: DateValue) {
  return (typeof value === "string" ? new Date(value) : value).getTime();
}

/**
 * Orders a thread's messages by send time and reads the latest one from the
 * full list, so "who spoke last" never comes from a truncated slice.
 */
export function summarizeEmailThreadLatest<T extends EmailTranscriptMessage>(
  messages: readonly T[],
) {
  const ordered = [...messages].sort((a, b) => toTime(a.sentAt) - toTime(b.sentAt));
  const latest = ordered.length ? ordered[ordered.length - 1] : null;

  return {
    ordered,
    latest,
    total: ordered.length,
    awaitingOurReply: latest?.isInbound ?? false,
  };
}

/** Threads with the most recent message first; threads without messages fall back to updatedAt. */
export function orderEmailThreadsNewestFirst<T extends EmailTranscriptThread>(
  threads: readonly T[],
) {
  const latestTime = (thread: T) => {
    const { latest } = summarizeEmailThreadLatest(thread.messages);
    return latest ? toTime(latest.sentAt) : toTime(thread.updatedAt);
  };
  return [...threads].sort((a, b) => latestTime(b) - latestTime(a));
}

function formatDate(value: DateValue, english: boolean) {
  return formatInboxDateLabel(value, english, formatDateLabel);
}

export function EmailThreadLatestState({
  thread,
  english,
}: {
  thread: EmailTranscriptThread;
  english: boolean;
}) {
  const { latest } = summarizeEmailThreadLatest(thread.messages);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {latest ? (
        <Badge variant={latest.isInbound ? "warning" : "neutral"}>
          {latest.isInbound
            ? english
              ? `Last from ${latest.sender} · ${formatDate(latest.sentAt, english)} · not answered yet`
              : `最新一封来自 ${latest.sender} · ${formatDate(latest.sentAt, false)} · 我方尚未回复`
            : english
              ? `Last is our reply · ${formatDate(latest.sentAt, english)} · waiting on them`
              : `最新一封是我方回复 · ${formatDate(latest.sentAt, false)} · 等对方回复`}
        </Badge>
      ) : (
        <Badge variant="neutral">{english ? "No messages" : "暂无邮件"}</Badge>
      )}
      {thread.status === "CLOSED" ? (
        <Badge variant="neutral">{english ? "Thread closed" : "线程已关闭"}</Badge>
      ) : null}
    </div>
  );
}

function EmailMessageArticle({
  message,
  english,
}: {
  message: EmailTranscriptMessage;
  english: boolean;
}) {
  const muted = message.isInbound
    ? "text-[color:var(--muted-foreground)]"
    : "text-[color:color-mix(in_oklab,var(--accent-foreground)_72%,transparent)]";

  return (
    <article
      data-email-message={message.isInbound ? "inbound" : "outbound"}
      className={`rounded-2xl px-4 py-4 ${message.isInbound ? "border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)]" : "bg-[color:var(--accent)] text-[color:var(--accent-foreground)]"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={`text-sm font-semibold ${message.isInbound ? "text-[color:var(--foreground)]" : "text-[color:var(--accent-foreground)]"}`}
        >
          {message.sender}
          <span className={`ml-2 text-xs font-normal ${muted}`}>
            {message.senderEmail}
          </span>
        </p>
        <p className={`text-xs ${muted}`}>{formatDate(message.sentAt, english)}</p>
      </div>
      <p
        className={`mt-3 whitespace-pre-wrap break-words text-sm leading-7 ${message.isInbound ? "text-[color:var(--foreground)]" : "text-[color:color-mix(in_oklab,var(--accent-foreground)_86%,transparent)]"}`}
      >
        {formatInboxMessageBody(message.body, english)}
      </p>
    </article>
  );
}

/**
 * Full message bodies in send order. With `maxMessages`, only the latest
 * messages are shown and the omitted count is stated with a link to the full
 * thread; the latest-message state above always reads the full list.
 */
export function EmailThreadTranscript({
  thread,
  english,
  maxMessages,
}: {
  thread: EmailTranscriptThread;
  english: boolean;
  maxMessages?: number;
}) {
  const { ordered } = summarizeEmailThreadLatest(thread.messages);
  const visible =
    maxMessages && ordered.length > maxMessages ? ordered.slice(-maxMessages) : ordered;
  const omitted = ordered.length - visible.length;

  return (
    <div className="space-y-3" data-email-thread-transcript={thread.id}>
      {omitted > 0 ? (
        <p
          data-email-thread-truncated={omitted}
          className="text-xs text-[color:var(--muted-foreground)]"
        >
          {english
            ? `${omitted} earlier ${omitted === 1 ? "message" : "messages"} not shown · `
            : `更早的 ${omitted} 封邮件未显示 · `}
          <Link
            href={`/inbox/${thread.id}`}
            className="font-medium text-[color:var(--accent)] underline-offset-4 hover:underline"
          >
            {english ? "Open the full thread" : "打开完整线程"}
          </Link>
        </p>
      ) : null}
      {visible.map((message) => (
        <EmailMessageArticle key={message.id} message={message} english={english} />
      ))}
    </div>
  );
}

/**
 * The customer's own words on contact and company pages: newest thread first,
 * each with its latest messages in full. Renders nothing when there are no
 * threads; when threads or messages are capped, the cut is stated.
 */
export function CustomerEmailThreadsCard({
  threads,
  english,
  maxThreads = 5,
  maxMessagesPerThread = 3,
}: {
  threads: readonly EmailTranscriptThread[];
  english: boolean;
  maxThreads?: number;
  maxMessagesPerThread?: number;
}) {
  if (!threads.length) return null;

  const ordered = orderEmailThreadsNewestFirst(threads);
  const visible = ordered.slice(0, maxThreads);
  const omittedThreads = ordered.length - visible.length;

  return (
    <Card data-customer-words="email-threads">
      <CardHeader>
        <CardTitle>{english ? "Customer's words" : "客户原话"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {visible.map((thread) => (
          <section key={thread.id} className="space-y-3" data-email-thread={thread.id}>
            <div className="space-y-2">
              <Link
                href={`/inbox/${thread.id}`}
                className="text-base font-semibold text-[color:var(--foreground)] underline-offset-4 hover:underline"
              >
                {thread.subject}
              </Link>
              <p className="text-xs text-[color:var(--muted-foreground)]">
                {thread.counterpart}
                {" · "}
                {english
                  ? `${thread.messages.length} ${thread.messages.length === 1 ? "message" : "messages"}`
                  : `${thread.messages.length} 封邮件`}
              </p>
              <EmailThreadLatestState thread={thread} english={english} />
            </div>
            <EmailThreadTranscript
              thread={thread}
              english={english}
              maxMessages={maxMessagesPerThread}
            />
          </section>
        ))}
        {omittedThreads > 0 ? (
          <p
            data-email-threads-truncated={omittedThreads}
            className="text-xs text-[color:var(--muted-foreground)]"
          >
            {english
              ? `${omittedThreads} older ${omittedThreads === 1 ? "thread" : "threads"} not shown · `
              : `另有 ${omittedThreads} 个较早的邮件线程未显示 · `}
            <Link
              href="/inbox"
              className="font-medium text-[color:var(--accent)] underline-offset-4 hover:underline"
            >
              {english ? "Open inbox" : "打开收件箱"}
            </Link>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
