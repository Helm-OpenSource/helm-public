"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  GovernedActionOutcome,
  OpportunityReplyTarget,
} from "@/features/opportunities/customer-first";

export type OpportunityHandlingDraft = {
  nextAction: string;
  dueDate: string;
  stage: string;
  ownerId: string;
  lossReason: string;
};

export type OpportunityHandlingCardProps = {
  english: boolean;
  anchorId: string;
  ownerSelectId: string;
  draft: OpportunityHandlingDraft;
  onDraftChange: (patch: Partial<OpportunityHandlingDraft>) => void;
  stageOptions: Array<[string, string]>;
  ownerOptions: Array<[string, string]>;
  note: string;
  onNoteChange: (note: string) => void;
  /** Notes are written to the primary contact's memory; null when no contact. */
  noteContactName: string | null;
  pending: boolean;
  onSave: () => void;
  saveLabel: string;
  /** Hidden in create mode. */
  replyTarget?: OpportunityReplyTarget;
  onScheduleMeeting?: () => void;
  meetingDisabled?: boolean;
  /** What the last 安排会议 actually did (from the governed action result). */
  meetingOutcome?: GovernedActionOutcome | null;
  /** Secondary record fields (collapsed), shown after the actions. */
  recordSection?: ReactNode;
  /**
   * The page's single collapsed `<details data-system-judgement>` block,
   * authored by the view; always the last block of the card.
   */
  systemJudgement?: ReactNode;
};

const labelClassName =
  "flex min-w-0 flex-col gap-1 text-xs text-[color:var(--muted-foreground)]";

/** 处理 card: the next step and the buttons that act on it. */
export function OpportunityHandlingCard({
  english,
  anchorId,
  ownerSelectId,
  draft,
  onDraftChange,
  stageOptions,
  ownerOptions,
  note,
  onNoteChange,
  noteContactName,
  pending,
  onSave,
  saveLabel,
  replyTarget,
  onScheduleMeeting,
  meetingDisabled = false,
  meetingOutcome = null,
  recordSection,
  systemJudgement,
}: OpportunityHandlingCardProps) {
  const showActions = replyTarget !== undefined;

  return (
    <section
      id={anchorId}
      data-opportunity-handling-card
      className="space-y-4 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
    >
      <h3 className="text-xs font-medium tracking-[0.04em] text-[color:var(--muted-foreground)]">
        {english ? "Handling" : "处理"}
      </h3>

      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
        <label className={`${labelClassName} sm:col-span-3`}>
          {english ? "Next action" : "下一步动作"}
          <Input
            value={draft.nextAction}
            onChange={(event) => onDraftChange({ nextAction: event.target.value })}
          />
        </label>
        <label className={labelClassName}>
          {english ? "Due" : "截止"}
          <Input
            type="datetime-local"
            aria-label={english ? "Opportunity due date" : "机会截止时间"}
            value={draft.dueDate}
            onChange={(event) => onDraftChange({ dueDate: event.target.value })}
          />
        </label>
        <div className={labelClassName}>
          {english ? "Stage" : "阶段"}
          <Select
            value={draft.stage}
            onValueChange={(value) => onDraftChange({ stage: value })}
          >
            <SelectTrigger aria-label={english ? "Stage" : "阶段"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stageOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={labelClassName}>
          {english ? "Owner" : "负责人"}
          <Select
            value={draft.ownerId}
            onValueChange={(value) => onDraftChange({ ownerId: value })}
          >
            <SelectTrigger id={ownerSelectId} aria-label={english ? "Owner" : "负责人"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ownerOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {draft.stage === "LOST" ? (
          <label className={`${labelClassName} sm:col-span-3`}>
            {english ? "Loss reason" : "丢失原因"}
            <Textarea
              rows={2}
              value={draft.lossReason}
              onChange={(event) => onDraftChange({ lossReason: event.target.value })}
            />
          </label>
        ) : null}
        <label className={`${labelClassName} sm:col-span-3`}>
          {english ? "Note" : "备注"}
          <Textarea
            rows={2}
            value={note}
            disabled={!noteContactName}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder={
              noteContactName
                ? english
                  ? "e.g. Called back, demo booked for next week"
                  : "例如：已电话回复，约好下周演示"
                : english
                  ? "Link a contact to keep notes"
                  : "关联联系人后才能记备注"
            }
          />
          {noteContactName ? (
            <span>
              {english
                ? `Saved to ${noteContactName}'s memory`
                : `保存时记入 ${noteContactName} 的联系人记忆`}
            </span>
          ) : null}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={pending} onClick={onSave}>
          {pending ? (english ? "Saving..." : "保存中...") : saveLabel}
        </Button>
        {showActions ? (
          replyTarget?.kind === "thread" ? (
            <Button asChild variant="secondary">
              <Link href={replyTarget.href}>
                {english ? "Reply by email" : "去回复邮件"}
              </Link>
            </Button>
          ) : replyTarget?.kind === "mailto" ? (
            <span className="inline-flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[color:var(--muted-foreground)]">
                {english ? "Reply to" : "回复邮箱"}
              </span>
              <a
                href={`mailto:${replyTarget.address}`}
                className="break-all font-mono hover:underline"
              >
                {replyTarget.address}
              </a>
            </span>
          ) : (
            <Button type="button" variant="secondary" disabled>
              {english ? "Reply by email" : "去回复邮件"}
            </Button>
          )
        ) : null}
        {showActions && onScheduleMeeting ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending || meetingDisabled}
            onClick={onScheduleMeeting}
          >
            {english ? "Schedule meeting" : "安排会议"}
          </Button>
        ) : null}
      </div>

      {meetingOutcome ? (
        <p
          role="status"
          data-opportunity-meeting-outcome={meetingOutcome.kind}
          className={
            meetingOutcome.kind === "rejected" || meetingOutcome.kind === "failed"
              ? "text-sm text-[color:var(--status-danger-text)]"
              : "text-sm text-[color:var(--muted-foreground)]"
          }
        >
          {meetingOutcome.message}
        </p>
      ) : null}

      {recordSection}
      {systemJudgement}
    </section>
  );
}
