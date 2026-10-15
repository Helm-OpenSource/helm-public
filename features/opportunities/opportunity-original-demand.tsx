"use client";

import {
  formatTimestamp,
  type OriginalDemandSource,
  type OriginalDemandThread,
} from "@/features/opportunities/customer-first";
import { formatInboxMessageBody } from "@/features/inbox/message-formatting";

export type OpportunityOriginalDemandProps = {
  english: boolean;
  threads: OriginalDemandThread[];
  /** Used only when no email thread is linked. */
  fallback: { text: string | null; source: OriginalDemandSource };
};

const bodyClassName =
  "max-w-[68ch] whitespace-pre-wrap break-words rounded-[12px] bg-[color:var(--surface-subtle)] px-4 py-3 text-sm leading-7 text-[color:var(--foreground)]";

/** 客户原话 card: what the customer actually wrote, in order, with our replies. */
export function OpportunityOriginalDemand({
  english,
  threads,
  fallback,
}: OpportunityOriginalDemandProps) {
  return (
    <section
      data-opportunity-original-demand
      className="space-y-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
    >
      <h3 className="text-xs font-medium tracking-[0.04em] text-[color:var(--muted-foreground)]">
        {english ? "What the customer said" : "客户原话"}
      </h3>

      {threads.length ? (
        threads.map((thread) => (
          <div key={thread.id} className="space-y-3">
            {thread.entries.map((entry, index) => (
              <div key={entry.id} className="space-y-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--muted-foreground)]">
                  {index === 0 ? (
                    <span>
                      <b className="font-medium">{english ? "Subject" : "主题"}</b>{" "}
                      {thread.subject}
                    </span>
                  ) : (
                    <span className="font-medium">
                      {entry.isInbound
                        ? english
                          ? "Customer follow-up"
                          : "客户来信"
                        : english
                          ? "Our reply"
                          : "我方回复"}
                    </span>
                  )}
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
        ))
      ) : fallback.text ? (
        <div className="space-y-2">
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {fallback.source === "description"
              ? english
                ? "From the opportunity description"
                : "来自机会描述"
              : english
                ? "Full inbound mail"
                : "来信全文"}
          </p>
          <div className={bodyClassName}>
            {formatInboxMessageBody(fallback.text, english)}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[color:var(--muted-foreground)]">
          {english ? "No customer words recorded yet." : "还没有记录客户原话。"}
        </p>
      )}
    </section>
  );
}
