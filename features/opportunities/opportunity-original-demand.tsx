"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatTimestamp,
  getReplyStatusLabel,
  type OriginalDemandSource,
  type OriginalDemandThread,
  type ReplyStatus,
} from "@/features/opportunities/customer-first";
import { formatInboxMessageBody } from "@/features/inbox/message-formatting";

export type OpportunityOriginalDemandProps = {
  english: boolean;
  /** Latest-active threads first; messages chronological. */
  threads: OriginalDemandThread[];
  /** Total visible threads linked to the opportunity. */
  threadTotal: number;
  /** Demand text chosen by the selection rule (来信全文 / thread / description). */
  fallback: { text: string | null; source: OriginalDemandSource };
  /** From the aggregate over all messages, not the loaded slice. */
  replyStatus: ReplyStatus;
  /** Key of the page currently loading ("thread:<id>" or "threads"). */
  loadingKey?: string | null;
  onLoadEarlierMessages?: (threadId: string, beforeMessageId: string) => void;
  onLoadMoreThreads?: () => void;
};

const bodyClassName =
  "max-w-[68ch] whitespace-pre-wrap break-words rounded-[12px] bg-[color:var(--surface-subtle)] px-4 py-3 text-sm leading-7 text-[color:var(--foreground)]";

function TruncationMarker({
  english,
  label,
  actionLabel,
  loading,
  onLoad,
}: {
  english: boolean;
  label: string;
  actionLabel: string;
  loading: boolean;
  onLoad?: () => void;
}) {
  return (
    <div
      data-opportunity-truncation
      className="flex flex-wrap items-center gap-2 rounded-[10px] border border-dashed border-[color:var(--border)] px-3 py-2 text-xs text-[color:var(--muted-foreground)]"
    >
      <span>{label}</span>
      {onLoad ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          disabled={loading}
          onClick={onLoad}
        >
          {loading ? (english ? "Loading..." : "加载中...") : actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** 客户原话 card: what the customer actually wrote, in order, with our replies. */
export function OpportunityOriginalDemand({
  english,
  threads,
  threadTotal,
  fallback,
  replyStatus,
  loadingKey = null,
  onLoadEarlierMessages,
  onLoadMoreThreads,
}: OpportunityOriginalDemandProps) {
  const replyStatusLabel = getReplyStatusLabel(replyStatus, english);
  const fullTextPlaced = threads.some((thread) =>
    thread.entries.some((entry) => entry.fromFullText),
  );
  // Show the chosen text on its own when there is no thread, or when the
  // 来信全文 could not be matched to a loaded message (truncated thread).
  const showFallback =
    Boolean(fallback.text) &&
    (threads.length === 0 || (fallback.source === "full-text" && !fullTextPlaced));

  return (
    <section
      data-opportunity-original-demand
      className="space-y-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-medium tracking-[0.04em] text-[color:var(--muted-foreground)]">
          {english ? "What the customer said" : "客户原话"}
        </h3>
        {replyStatusLabel ? (
          <Badge
            data-opportunity-reply-status={replyStatus ?? undefined}
            variant={replyStatus === "awaiting" ? "warning" : "neutral"}
          >
            {replyStatusLabel}
          </Badge>
        ) : null}
      </div>

      {showFallback && fallback.text ? (
        <div className="space-y-2">
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {fallback.source === "description"
              ? english
                ? "From the opportunity description"
                : "来自机会描述"
              : fallback.source === "full-text"
                ? english
                  ? "Full inbound mail"
                  : "来信全文"
                : english
                  ? "Customer mail"
                  : "客户来信"}
          </p>
          <div className={bodyClassName}>
            {formatInboxMessageBody(fallback.text, english)}
          </div>
        </div>
      ) : null}

      {threads.map((thread) => (
        <div key={thread.id} className="space-y-3" data-opportunity-thread={thread.id}>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            <b className="font-medium">{english ? "Subject" : "主题"}</b> {thread.subject}
          </p>
          {thread.loadedCount < thread.messageCount ? (
            <TruncationMarker
              english={english}
              label={
                english
                  ? `Truncated: ${thread.messageCount} messages, showing the latest ${thread.loadedCount}`
                  : `已截断，共 ${thread.messageCount} 封，显示最近 ${thread.loadedCount} 封`
              }
              actionLabel={english ? "Load earlier" : "加载更早"}
              loading={loadingKey === `thread:${thread.id}`}
              onLoad={
                onLoadEarlierMessages && thread.oldestLoadedMessageId
                  ? () =>
                      onLoadEarlierMessages(thread.id, thread.oldestLoadedMessageId!)
                  : undefined
              }
            />
          ) : null}
          {thread.entries.map((entry) => (
            <div key={entry.id} className="space-y-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--muted-foreground)]">
                <span className="font-medium">
                  {entry.isInbound
                    ? english
                      ? "Customer"
                      : "客户来信"
                    : english
                      ? "Our reply"
                      : "我方回复"}
                </span>
                <span>
                  <b className="font-medium">{english ? "From" : "发件人"}</b>{" "}
                  {entry.sender}
                </span>
                <span>
                  <b className="font-medium">{english ? "Time" : "时间"}</b>{" "}
                  {formatTimestamp(entry.sentAt)}
                </span>
              </div>
              <div className={bodyClassName}>
                {formatInboxMessageBody(entry.body, english)}
              </div>
            </div>
          ))}
        </div>
      ))}

      {threads.length && threads.length < threadTotal ? (
        <TruncationMarker
          english={english}
          label={
            english
              ? `${threadTotal} email threads, showing the ${threads.length} most recently active`
              : `共 ${threadTotal} 个邮件线程，显示最近活跃的 ${threads.length} 个`
          }
          actionLabel={english ? "Load earlier threads" : "加载更早的线程"}
          loading={loadingKey === "threads"}
          onLoad={onLoadMoreThreads}
        />
      ) : null}

      {!threads.length && !showFallback ? (
        <p className="text-sm text-[color:var(--muted-foreground)]">
          {english ? "No customer words recorded yet." : "还没有记录客户原话。"}
        </p>
      ) : null}
    </section>
  );
}
