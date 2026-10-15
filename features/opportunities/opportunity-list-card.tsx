"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  CustomerFirstContact,
  OpportunityReplyTarget,
} from "@/features/opportunities/customer-first";
import { cn } from "@/lib/utils";

export type OpportunityListCardProps = {
  english: boolean;
  title: string;
  stageLabel: string;
  sourceLabel: string;
  dueChip: { label: string; overdue: boolean } | null;
  receivedAt: string | null;
  contact: CustomerFirstContact | null;
  companyName: string | null;
  demandExcerpt: string | null;
  nextAction: string | null;
  ownerName: string | null;
  replyTarget: OpportunityReplyTarget;
  onOpen: () => void;
  /** Drag handle / selection checkbox owned by the page. */
  leading?: ReactNode;
  className?: string;
};

/**
 * One opportunity in the customer-first list: who the customer is, a short
 * excerpt of what they said, and the next step. Nothing else.
 */
export function OpportunityListCard({
  english,
  title,
  stageLabel,
  sourceLabel,
  dueChip,
  receivedAt,
  contact,
  companyName,
  demandExcerpt,
  nextAction,
  ownerName,
  replyTarget,
  onOpen,
  leading,
  className,
}: OpportunityListCardProps) {
  return (
    <article
      data-opportunity-list-card
      className={cn(
        "min-w-0 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {leading ? (
          <div className="flex shrink-0 items-center gap-2">{leading}</div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{stageLabel}</Badge>
            <Badge variant="success">{sourceLabel}</Badge>
            {dueChip ? (
              <Badge variant={dueChip.overdue ? "danger" : "warning"}>
                {dueChip.label}
              </Badge>
            ) : null}
            {receivedAt ? (
              <span className="text-xs text-[color:var(--muted-foreground)]">
                {english ? `Received ${receivedAt}` : `收到于 ${receivedAt}`}
              </span>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-base font-semibold text-[color:var(--foreground)]">
              {contact?.name ?? title}
            </p>
            {contact?.phone ? (
              <span className="font-mono text-xs text-[color:var(--muted-foreground)]">
                {contact.phone}
              </span>
            ) : null}
            {contact?.email ? (
              <span className="break-all font-mono text-xs text-[color:var(--muted-foreground)]">
                {contact.email}
              </span>
            ) : null}
            <span className="text-xs text-[color:var(--muted-foreground)]">
              {companyName ?? (english ? "No linked company" : "未关联公司")}
            </span>
          </div>

          {demandExcerpt ? (
            <p className="line-clamp-2 whitespace-normal break-words border-l-2 border-[color:var(--border)] pl-3 text-sm leading-6 text-[color:var(--foreground)]">
              {demandExcerpt}
            </p>
          ) : contact ? (
            <p className="line-clamp-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
              {title}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="min-w-0 break-words">
              <span className="text-[color:var(--muted-foreground)]">
                {english ? "Next" : "下一步"}
              </span>{" "}
              {nextAction || (english ? "Not set" : "未填写")}
            </span>
            <span>
              <span className="text-[color:var(--muted-foreground)]">
                {english ? "Owner" : "负责人"}
              </span>{" "}
              {ownerName ?? (english ? "Unassigned" : "未分配")}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={onOpen}
              aria-label={english ? `Open opportunity: ${title}` : `打开机会：${title}`}
            >
              {english ? "Open" : "打开"}
            </Button>
            {replyTarget?.kind === "thread" ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={replyTarget.href}>{english ? "Reply" : "去回复"}</Link>
              </Button>
            ) : replyTarget?.kind === "mailto" ? (
              <Button asChild size="sm" variant="secondary">
                <a href={`mailto:${replyTarget.address}`}>
                  {english ? "Reply" : "去回复"}
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
