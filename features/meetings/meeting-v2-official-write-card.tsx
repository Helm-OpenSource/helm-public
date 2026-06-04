"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RefreshCcw, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  acknowledgeMeetingOfficialWriteIntentAction,
  attemptMeetingOfficialWriteIntentAction,
  reviewMeetingLimitedAutoIntentAction,
  reviewMeetingOfficialWriteIntentAction,
  runMeetingOfficialFollowThroughRuntimeAction,
  runMeetingLimitedAutoRuntimeAction,
  runMeetingOfficialWriteIntentRuntimeAction,
  updateMeetingOfficialFollowThroughAction,
} from "@/features/meetings/actions";
import { formatMeetingOfficialWriteDateLabel } from "@/features/meetings/meeting-v2-official-write-date-labels";
import type {
  LimitedAutoIntentRuntimeItem,
  LimitedAutoReviewMode,
  OfficialFollowThroughRuntimeItem,
  OfficialFollowThroughUpdateMode,
  OfficialWriteAcknowledgementMode,
  OfficialWriteReviewMode,
  OfficialWriteIntentRuntimeItem,
  OfficialWriteRuntimeSummary,
} from "@/lib/helm-v2/official-system-integration-runtime";
import { formatDateLabel } from "@/lib/utils";

type MeetingV2OfficialWriteCardProps = {
  meetingId: string;
  runtime: OfficialWriteRuntimeSummary | null;
};

function formatOfficialWriteDate(value: Date | string | null | undefined, english: boolean) {
  return formatMeetingOfficialWriteDateLabel(value, english, formatDateLabel);
}

function renderStatusVariant(status: string) {
  if (status.includes("FAILURE") || status.includes("REJECTED") || status.includes("BLOCKED")) return "danger" as const;
  if (status.includes("SUCCESS") || status.includes("APPROVED")) return "success" as const;
  if (status.includes("PENDING") || status.includes("REQUESTED") || status.includes("ATTEMPTED")) return "approval" as const;
  if (status.includes("DEFERRED")) return "warning" as const;
  return "neutral" as const;
}

function reviewSuccessMessage(mode: OfficialWriteReviewMode, english: boolean) {
  if (mode === "approve") return english ? "Official write intent approved" : "正式写入意图已批准";
  if (mode === "reject") return english ? "Official write intent rejected" : "正式写入意图已驳回";
  if (mode === "block_boundary") return english ? "Official write intent blocked by boundary" : "正式写入意图已被边界阻断";
  if (mode === "insufficient_evidence") return english ? "Official write intent marked insufficient evidence" : "正式写入意图已标记证据不足";
  return english ? "Official write intent kept pending" : "正式写入意图已保留待复核";
}

function acknowledgementSuccessMessage(mode: OfficialWriteAcknowledgementMode, english: boolean) {
  if (mode === "ack_success") return english ? "Official write acknowledged success" : "正式写入已确认成功";
  if (mode === "ack_failure") return english ? "Official write acknowledged failure" : "正式写入已确认失败";
  if (mode === "receipt_unknown") return english ? "Unknown / timeout receipt recorded" : "超时 / 未知回执已记录";
  if (mode === "receipt_partial_success") return english ? "Partial success receipt recorded" : "部分成功回执已记录";
  if (mode === "receipt_stale") return english ? "Stale receipt recorded" : "过期回执已记录";
  if (mode === "reconciliation_resolved") return english ? "Manual reconciliation resolved" : "人工对账已收口";
  if (mode === "reconciliation_note") return english ? "Reconciliation note recorded" : "对账备注已记录";
  return english ? "Deferred retry recorded" : "延迟重试已记录";
}

function limitedAutoSuccessMessage(mode: LimitedAutoReviewMode, english: boolean) {
  if (mode === "approve") return english ? "Limited auto approved and executed on the constrained path" : "限定自动执行已批准并进入受约束路径";
  if (mode === "reject") return english ? "Limited auto rejected" : "限定自动执行已驳回";
  if (mode === "block_boundary") return english ? "Limited auto blocked by boundary" : "限定自动执行已被边界阻断";
  if (mode === "force_manual") return english ? "Limited auto forced back to the manual path" : "限定自动执行已回退到人工路径";
  return english ? "Limited auto kept pending" : "限定自动执行已保留待复核";
}

function followThroughSuccessMessage(mode: OfficialFollowThroughUpdateMode, english: boolean) {
  switch (mode) {
    case "assign_owner":
      return english ? "Follow-through owner updated" : "跟进闭环负责人已更新";
    case "mark_next_action":
      return english ? "Follow-through next action updated" : "跟进闭环下一动作已更新";
    case "add_reconciliation_note":
      return english ? "Reconciliation note recorded" : "对账备注已记录";
    case "mark_investigating":
      return english ? "Follow-through marked investigating" : "跟进闭环已标记为正在调查";
    case "mark_awaiting_external_receipt":
      return english ? "Follow-through marked awaiting external receipt" : "跟进闭环已标记为等待外部回执";
    case "resolve":
      return english ? "Follow-through resolved" : "跟进闭环已解决";
    case "close_no_change":
      return english ? "Follow-through closed with no change" : "跟进闭环已关闭且无额外变更";
    case "defer":
      return english ? "Follow-through deferred to manual handling" : "跟进闭环已延后到人工处理";
    case "escalate_manager":
      return english ? "Follow-through escalated to manager" : "跟进闭环已升级到主管";
    case "force_manual_fallback":
      return english ? "Manual fallback enforced" : "已强制回退到人工兜底";
    case "block_boundary":
      return english ? "Follow-through blocked by boundary" : "跟进闭环已被边界阻断";
  }
}

function renderFollowThroughTypeLabel(type: OfficialFollowThroughRuntimeItem["followThroughType"], english: boolean) {
  switch (type) {
    case "ack_success_followthrough":
      return english ? "ack success" : "回执成功";
    case "failure_followthrough":
      return english ? "failure" : "失败";
    case "unknown_status_followthrough":
      return english ? "unknown status" : "未知状态";
    case "stale_receipt_followthrough":
      return english ? "stale receipt" : "过期回执";
    case "partial_success_followthrough":
      return english ? "partial success" : "部分成功";
    case "manual_reconciliation_followthrough":
      return english ? "manual reconciliation" : "人工对账";
    case "escalation_followthrough":
      return english ? "escalation" : "升级";
    case "resolved_followthrough":
      return english ? "resolved" : "已解决";
  }
}

function OfficialWriteReviewForm({
  english,
  pending,
  onSubmit,
}: {
  english: boolean;
  pending: boolean;
  onSubmit: (mode: OfficialWriteReviewMode, reviewNotes: string) => void;
}) {
  const [reviewNotes, setReviewNotes] = useState("");

  return (
    <div className="mt-4 space-y-3">
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "review notes" : "复核备注"}</p>
        <Textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={3} className="mt-2 text-sm" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => onSubmit("keep_pending", reviewNotes)} disabled={pending}>
          {english ? "Keep pending" : "保留待复核"}
        </Button>
        <Button variant="secondary" onClick={() => onSubmit("reject", reviewNotes)} disabled={pending}>
          <XCircle className="h-4 w-4" />
          {english ? "Reject" : "驳回"}
        </Button>
        <Button variant="secondary" onClick={() => onSubmit("block_boundary", reviewNotes)} disabled={pending}>
          <ShieldAlert className="h-4 w-4" />
          {english ? "Block by boundary" : "标记为边界阻断"}
        </Button>
        <Button variant="secondary" onClick={() => onSubmit("insufficient_evidence", reviewNotes)} disabled={pending}>
          {english ? "Insufficient evidence" : "标记证据不足"}
        </Button>
        <Button onClick={() => onSubmit("approve", reviewNotes)} disabled={pending}>
          <CheckCircle2 className="h-4 w-4" />
          {english ? "Approve guarded write" : "批准受约束写入"}
        </Button>
      </div>
    </div>
  );
}

function OfficialWriteAcknowledgementForm({
  english,
  pending,
  onSubmit,
}: {
  english: boolean;
  pending: boolean;
  onSubmit: (mode: OfficialWriteAcknowledgementMode, note: string, externalSystemReference: string) => void;
}) {
  const [note, setNote] = useState("");
  const [externalSystemReference, setExternalSystemReference] = useState("");

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "acknowledgement note" : "确认备注"}</p>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-2 text-sm" />
        </div>
        <div>
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {english ? "external system reference (optional)" : "外部系统引用（可选）"}
          </p>
          <Input
            value={externalSystemReference}
            onChange={(event) => setExternalSystemReference(event.target.value)}
            className="mt-2 text-sm"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => onSubmit("deferred_retry", note, externalSystemReference)} disabled={pending}>
          {english ? "Deferred retry" : "记录延后重试"}
        </Button>
        <Button variant="secondary" onClick={() => onSubmit("receipt_unknown", note, externalSystemReference)} disabled={pending}>
          {english ? "Timeout / unknown" : "记录超时 / 未知"}
        </Button>
        <Button variant="secondary" onClick={() => onSubmit("receipt_partial_success", note, externalSystemReference)} disabled={pending}>
          {english ? "Partial success" : "记录部分成功"}
        </Button>
        <Button variant="secondary" onClick={() => onSubmit("receipt_stale", note, externalSystemReference)} disabled={pending}>
          {english ? "Stale receipt" : "记录过期回执"}
        </Button>
        <Button variant="secondary" onClick={() => onSubmit("reconciliation_note", note, externalSystemReference)} disabled={pending}>
          {english ? "Reconciliation note" : "记录对账备注"}
        </Button>
        <Button variant="secondary" onClick={() => onSubmit("reconciliation_resolved", note, externalSystemReference)} disabled={pending}>
          {english ? "Resolve reconciliation" : "记录对账已闭合"}
        </Button>
        <Button variant="secondary" onClick={() => onSubmit("ack_failure", note, externalSystemReference)} disabled={pending}>
          {english ? "Acknowledge failure" : "确认失败"}
        </Button>
        <Button onClick={() => onSubmit("ack_success", note, externalSystemReference)} disabled={pending}>
          <CheckCircle2 className="h-4 w-4" />
          {english ? "Acknowledge success" : "确认成功"}
        </Button>
      </div>
    </div>
  );
}

function LimitedAutoReviewForm({
  english,
  pending,
  onSubmit,
}: {
  english: boolean;
  pending: boolean;
  onSubmit: (mode: LimitedAutoReviewMode, reviewNotes: string) => void;
}) {
  const [reviewNotes, setReviewNotes] = useState("");

  return (
    <div className="mt-4 space-y-3">
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "limited auto review note" : "限定自动复核备注"}</p>
        <Textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={3} className="mt-2 text-sm" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => onSubmit("keep_pending", reviewNotes)} disabled={pending}>
          {english ? "Keep pending" : "保留待复核"}
        </Button>
        <Button variant="secondary" onClick={() => onSubmit("reject", reviewNotes)} disabled={pending}>
          {english ? "Reject limited auto" : "驳回限定自动"}
        </Button>
        <Button variant="secondary" onClick={() => onSubmit("force_manual", reviewNotes)} disabled={pending}>
          {english ? "Force manual path" : "强制回退人工路径"}
        </Button>
        <Button variant="secondary" onClick={() => onSubmit("block_boundary", reviewNotes)} disabled={pending}>
          {english ? "Block by boundary" : "标记为边界阻断"}
        </Button>
        <Button onClick={() => onSubmit("approve", reviewNotes)} disabled={pending}>
          <CheckCircle2 className="h-4 w-4" />
          {english ? "Approve limited auto" : "批准限定自动"}
        </Button>
      </div>
    </div>
  );
}

function LimitedAutoIntentPanel({
  limitedAutoIntent,
  english,
  pending,
  onReview,
}: {
  limitedAutoIntent: LimitedAutoIntentRuntimeItem;
  english: boolean;
  pending: boolean;
  onReview: (limitedAutoIntentId: string, mode: LimitedAutoReviewMode, reviewNotes: string) => void;
}) {
  const canReview = limitedAutoIntent.limitedAutoApprovalStatus === "PENDING_REVIEW";

  return (
    <div className="mt-5 rounded-2xl border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)]/80 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">{english ? "Helm v2 · review gate" : "Helm v2 · 复核门"}</Badge>
        <Badge variant={renderStatusVariant(limitedAutoIntent.limitedAutoEligibilityStatus.toUpperCase())}>
          {limitedAutoIntent.limitedAutoEligibilityStatus}
        </Badge>
        <Badge variant={renderStatusVariant(limitedAutoIntent.limitedAutoApprovalStatus)}>{limitedAutoIntent.limitedAutoApprovalStatus}</Badge>
        <Badge variant={renderStatusVariant(limitedAutoIntent.limitedAutoExecutionStatus)}>{limitedAutoIntent.limitedAutoExecutionStatus}</Badge>
        <Badge variant={renderStatusVariant(limitedAutoIntent.limitedAutoAckStatus)}>{limitedAutoIntent.limitedAutoAckStatus}</Badge>
        <Badge variant="info">{limitedAutoIntent.actionCategory}</Badge>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.06fr_0.94fr]">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "eligibility" : "资格判断"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{limitedAutoIntent.limitedAutoEligibilityReason}</p>
            {limitedAutoIntent.manualOnlyReason ? (
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{limitedAutoIntent.manualOnlyReason}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "coverage posture" : "覆盖姿态"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {limitedAutoIntent.actionDefaultPath} · {limitedAutoIntent.actionRiskClass}
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{limitedAutoIntent.acknowledgmentRequirement}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "what auto path will do" : "自动路径会做什么"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{limitedAutoIntent.whatAutoPathWillDo}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "what it will not do" : "自动路径不会做什么"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{limitedAutoIntent.whatAutoPathWillNotDo}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "risk / boundary" : "风险 / 边界"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{limitedAutoIntent.riskReviewSummary ?? (english ? "No extra risk summary" : "暂无额外风险概要")}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "approval requirements" : "审批要求"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {limitedAutoIntent.approvalRequirements.requiredApprovals.join(", ") || (english ? "no explicit approver" : "无显式审批人")}
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              {english ? "mandatory reviewers" : "强制复核人"}: {limitedAutoIntent.approvalRequirements.mandatoryReviewers.join(", ") || (english ? "none" : "无")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "ack / failure trace" : "回执 / 失败轨迹"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{limitedAutoIntent.receiptSummary}</p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              {limitedAutoIntent.rollbackExpectation}
              {limitedAutoIntent.manualFallbackRequired ? ` ${english ? "Manual follow-up remains required." : "当前仍需要人工跟进。"} ` : " "}
              {limitedAutoIntent.escalationRequired ? (english ? "Escalation is required." : "当前需要升级。") : ""}
            </p>
            {limitedAutoIntent.externalSystemReference ? (
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{limitedAutoIntent.externalSystemReference}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "proposed payload" : "拟写入载荷"}</p>
            <pre className="mt-2 overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--dark-inset-bg)]/95 p-3 text-xs text-white">
              {JSON.stringify(limitedAutoIntent.proposedWritePayload, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {canReview ? (
        <LimitedAutoReviewForm
          english={english}
          pending={pending}
          onSubmit={(mode, reviewNotes) => onReview(limitedAutoIntent.id, mode, reviewNotes)}
        />
      ) : null}

      {(limitedAutoIntent.approvedAt || limitedAutoIntent.attemptedAt || limitedAutoIntent.acknowledgedAt) ? (
        <div className="mt-4 space-y-1 text-xs text-[color:var(--muted-foreground)]">
          {limitedAutoIntent.approvedAt ? <p>{english ? "limited auto approved" : "限定自动已批准"}: {formatOfficialWriteDate(limitedAutoIntent.approvedAt, english)}</p> : null}
          {limitedAutoIntent.attemptedAt ? <p>{english ? "limited auto attempted" : "限定自动已尝试"}: {formatOfficialWriteDate(limitedAutoIntent.attemptedAt, english)}</p> : null}
          {limitedAutoIntent.acknowledgedAt ? <p>{english ? "limited auto acknowledged" : "限定自动已确认"}: {formatOfficialWriteDate(limitedAutoIntent.acknowledgedAt, english)}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function FollowThroughUpdateForm({
  followThrough,
  english,
  pending,
  onSubmit,
}: {
  followThrough: OfficialFollowThroughRuntimeItem;
  english: boolean;
  pending: boolean;
  onSubmit: (input: {
    followThroughId: string;
    mode: OfficialFollowThroughUpdateMode;
    ownerName?: string;
    nextAction?: string;
    note?: string;
  }) => void;
}) {
  const [ownerName, setOwnerName] = useState(followThrough.followThroughOwnerName ?? "");
  const [nextAction, setNextAction] = useState(followThrough.followThroughNextAction);
  const [note, setNote] = useState("");

  const submit = (mode: OfficialFollowThroughUpdateMode) => {
    onSubmit({
      followThroughId: followThrough.id,
      mode,
      ownerName,
      nextAction,
      note,
    });
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "owner" : "负责人"}</p>
          <Input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} className="mt-2 text-sm" />
        </div>
        <div>
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "next action" : "下一动作"}</p>
          <Input value={nextAction} onChange={(event) => setNextAction(event.target.value)} className="mt-2 text-sm" />
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
          {english ? "reconciliation / resolution note" : "对账 / 解决备注"}
        </p>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-2 text-sm" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => submit("assign_owner")} disabled={pending}>
          {english ? "Save owner" : "保存负责人"}
        </Button>
        <Button variant="secondary" onClick={() => submit("mark_next_action")} disabled={pending}>
          {english ? "Save next action" : "保存下一动作"}
        </Button>
        <Button variant="secondary" onClick={() => submit("mark_investigating")} disabled={pending}>
          {english ? "Mark investigating" : "标记为正在调查"}
        </Button>
        <Button variant="secondary" onClick={() => submit("mark_awaiting_external_receipt")} disabled={pending}>
          {english ? "Await external receipt" : "标记为等待外部回执"}
        </Button>
        <Button variant="secondary" onClick={() => submit("add_reconciliation_note")} disabled={pending}>
          {english ? "Add reconciliation note" : "记录对账备注"}
        </Button>
        <Button variant="secondary" onClick={() => submit("defer")} disabled={pending}>
          {english ? "Defer" : "延后"}
        </Button>
        <Button variant="secondary" onClick={() => submit("escalate_manager")} disabled={pending}>
          {english ? "Escalate manager" : "升级给主管"}
        </Button>
        <Button variant="secondary" onClick={() => submit("force_manual_fallback")} disabled={pending}>
          {english ? "Force manual fallback" : "强制人工兜底"}
        </Button>
        <Button variant="secondary" onClick={() => submit("close_no_change")} disabled={pending}>
          {english ? "Close no change" : "关闭且无变更"}
        </Button>
        <Button variant="secondary" onClick={() => submit("block_boundary")} disabled={pending}>
          <ShieldAlert className="h-4 w-4" />
          {english ? "Block by boundary" : "标记为边界阻断"}
        </Button>
        <Button onClick={() => submit("resolve")} disabled={pending}>
          <CheckCircle2 className="h-4 w-4" />
          {english ? "Resolve" : "解决"}
        </Button>
      </div>
    </div>
  );
}

function FollowThroughPanel({
  followThrough,
  sourceIntent,
  sourceLimitedAutoIntent,
  english,
  pending,
  onUpdate,
}: {
  followThrough: OfficialFollowThroughRuntimeItem;
  sourceIntent: OfficialWriteIntentRuntimeItem | null;
  sourceLimitedAutoIntent: LimitedAutoIntentRuntimeItem | null;
  english: boolean;
  pending: boolean;
  onUpdate: (input: {
    followThroughId: string;
    mode: OfficialFollowThroughUpdateMode;
    ownerName?: string;
    nextAction?: string;
    note?: string;
  }) => void;
}) {
  const currentReceiptState = sourceLimitedAutoIntent
    ? `${sourceLimitedAutoIntent.receiptStatus} · ${sourceLimitedAutoIntent.receiptSummary}`
    : sourceIntent
      ? `${sourceIntent.receiptStatus} · ${sourceIntent.receiptSummary}`
      : english
        ? "No linked ack / receipt trace found"
        : "当前没有关联的确认 / 回执轨迹";

  return (
    <div className="rounded-2xl border border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)]/80 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">{english ? "Helm v2 · follow-through" : "Helm v2 · 跟进闭环"}</Badge>
        <Badge variant="neutral">{renderFollowThroughTypeLabel(followThrough.followThroughType, english)}</Badge>
        <Badge variant={renderStatusVariant(followThrough.followThroughStatus.toUpperCase())}>{followThrough.followThroughStatus}</Badge>
        <Badge variant={renderStatusVariant(followThrough.followThroughResolutionStatus.toUpperCase())}>
          {followThrough.followThroughResolutionStatus}
        </Badge>
        <Badge variant={renderStatusVariant(followThrough.reconciliationStatus.toUpperCase())}>{followThrough.reconciliationStatus}</Badge>
        {followThrough.exceptionClass ? <Badge variant="warning">{followThrough.exceptionClass}</Badge> : null}
        <Badge variant={renderStatusVariant(followThrough.exceptionSeverity.toUpperCase())}>{followThrough.exceptionSeverity}</Badge>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.06fr_0.94fr]">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "source official action" : "源正式动作"}</p>
            <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{followThrough.sourceActionType ?? (english ? "manual override" : "人工推翻")}</p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{followThrough.officialObjectRef}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "current owner / due" : "当前负责人 / 截止时间"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {followThrough.followThroughOwnerName ?? (english ? "unassigned" : "未分配")} ·{" "}
              {followThrough.followThroughDeadline ? formatOfficialWriteDate(followThrough.followThroughDeadline, english) : english ? "no deadline" : "暂无截止时间"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "current next action" : "当前下一动作"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{followThrough.followThroughNextAction}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "boundary" : "边界"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{followThrough.followThroughBoundary}</p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              {english
                ? "Resolution does not automatically mean external outcome success. No broad auto-write, no send authority, and no auto-booking."
                : "解决不自动等于外部结果成功。当前仍无广泛自动写入、发送权限或自动预约。"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "role handoff / summary impact" : "角色交接 / 摘要影响"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{followThrough.roleHandoffImpact ?? (english ? "No direct role handoff impact" : "当前没有直接角色交接影响")}</p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{followThrough.summaryWritebackImpact ?? (english ? "No extra summary note" : "当前没有额外摘要备注")}</p>
            {followThrough.blockerSummaryImpact ? <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{followThrough.blockerSummaryImpact}</p> : null}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "ack / receipt state" : "确认 / 回执状态"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{currentReceiptState}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "follow-through summary" : "跟进闭环摘要"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{followThrough.followThroughSummary}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "reconciliation / resolution notes" : "对账 / 解决备注"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{followThrough.reconciliationNote ?? (english ? "No reconciliation note yet" : "当前没有对账备注")}</p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{followThrough.resolutionNote ?? (english ? "No resolution note yet" : "当前没有解决备注")}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "evidence refs" : "证据引用"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {followThrough.followThroughEvidenceRefs.map((item) => (
                <Badge key={`${followThrough.id}-${item}`} variant="info">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "write-back targets" : "回写目标"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {followThrough.followThroughWritebackTargets.map((item) => (
                <Badge key={`${followThrough.id}-writeback-${item}`} variant="neutral">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      <FollowThroughUpdateForm followThrough={followThrough} english={english} pending={pending} onSubmit={onUpdate} />

      {(followThrough.resolvedAt || followThrough.updatedAt) ? (
        <div className="mt-4 space-y-1 text-xs text-[color:var(--muted-foreground)]">
          {followThrough.resolvedAt ? <p>{english ? "resolved at" : "解决时间"}: {formatOfficialWriteDate(followThrough.resolvedAt, english)}</p> : null}
          <p>{english ? "last updated" : "最后更新"}: {formatOfficialWriteDate(followThrough.updatedAt, english)}</p>
          {followThrough.resolvedByName ? <p>{english ? "resolved by" : "解决人"}: {followThrough.resolvedByName}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function IntentCard({
  meetingId,
  intent,
  limitedAutoIntent,
  english,
  pending,
  onReview,
  onAttempt,
  onAcknowledge,
  onLimitedAutoReview,
}: {
  meetingId: string;
  intent: OfficialWriteIntentRuntimeItem;
  limitedAutoIntent?: LimitedAutoIntentRuntimeItem | null;
  english: boolean;
  pending: boolean;
  onReview: (intentId: string, mode: OfficialWriteReviewMode, reviewNotes: string) => void;
  onAttempt: (intentId: string) => void;
  onAcknowledge: (intentId: string, mode: OfficialWriteAcknowledgementMode, note: string, externalSystemReference: string) => void;
  onLimitedAutoReview: (limitedAutoIntentId: string, mode: LimitedAutoReviewMode, reviewNotes: string) => void;
}) {
  const showReviewForm =
    intent.writeApprovalStatus !== "APPROVED" &&
    intent.writeApprovalStatus !== "REJECTED" &&
    intent.writeApprovalStatus !== "BLOCKED";
  const showAttempt = intent.writeApprovalStatus === "APPROVED" && intent.writeExecutionStatus === "REQUESTED";
  const showAcknowledge =
    intent.writeApprovalStatus === "APPROVED" &&
    (intent.writeExecutionStatus === "ATTEMPTED" || intent.writeExecutionStatus === "ACKNOWLEDGED_FAILURE");

  return (
    <div className="theme-surface-panel rounded-2xl px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{intent.writeActionType}</Badge>
        <Badge variant="info">{intent.actionCategory}</Badge>
        <Badge variant={renderStatusVariant(intent.writeApprovalStatus)}>{intent.writeApprovalStatus}</Badge>
        <Badge variant={renderStatusVariant(intent.writeExecutionStatus)}>{intent.writeExecutionStatus}</Badge>
        <Badge variant={renderStatusVariant(intent.writeAcknowledgementStatus)}>{intent.writeAcknowledgementStatus}</Badge>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.06fr_0.94fr]">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "source" : "源头"}</p>
            <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{intent.sourceTitle}</p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{intent.sourceSummary}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "target official object" : "目标正式对象"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{intent.officialObjectRef}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "coverage posture" : "覆盖姿态"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {intent.actionDefaultPath} · {intent.actionRiskClass}
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{intent.acknowledgmentRequirement}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "what this changes" : "本次会改变什么"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{intent.whatThisChanges}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "what this does not change" : "本次不会改变什么"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{intent.whatThisDoesNotMean}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "boundary" : "边界"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{intent.writeBoundary}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "approval requirements" : "审批要求"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {intent.writeApprovalTier} · {intent.approvalRequirements.requiredApprovals.join(", ") || (english ? "no explicit approver" : "无显式审批人")}
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              {english ? "mandatory reviewers" : "强制复核人"}: {intent.approvalRequirements.mandatoryReviewers.join(", ") || (english ? "none" : "无")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "risk review" : "风险复核"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{intent.riskReviewSummary ?? (english ? "No extra risk summary" : "暂无额外风险摘要")}</p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{intent.rollbackExpectation}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "evidence refs" : "证据引用"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {intent.evidenceRefs.map((item) => (
                <Badge key={`${meetingId}-${intent.id}-${item}`} variant="info">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "receipt / reconciliation" : "回执 / 对账"}</p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">{intent.receiptSummary}</p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              {intent.receiptSummaryWritebackMode === "audit_only"
                  ? english
                    ? "This state stays audit-only and will not update the managed official summary."
                    : "当前状态保持仅审计，不会更新受管正式摘要。"
                : intent.receiptSummaryWritebackMode === "reconciliation_note"
                  ? english
                    ? "This state may update summaries only with reconciliation notes and still does not claim official success."
                    : "当前状态只会带对账备注更新摘要，仍不代表正式成功。"
                  : english
                    ? "This state may update summaries because the external system returned a success acknowledgment."
                    : "当前状态可以更新摘要，因为外部系统返回了成功回执。"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "proposed payload" : "拟写入载荷"}</p>
            <pre className="mt-2 overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--dark-inset-bg)]/95 p-3 text-xs text-white">
              {JSON.stringify(intent.writePayloadDraft, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {showReviewForm ? (
        <OfficialWriteReviewForm
          english={english}
          pending={pending}
          onSubmit={(mode, reviewNotes) => onReview(intent.id, mode, reviewNotes)}
        />
      ) : null}

      {showAttempt ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => onAttempt(intent.id)} disabled={pending}>
            {english ? "Record guarded write attempt" : "记录受约束写入尝试"}
          </Button>
        </div>
      ) : null}

      {showAcknowledge ? (
        <OfficialWriteAcknowledgementForm
          english={english}
          pending={pending}
          onSubmit={(mode, note, externalSystemReference) => onAcknowledge(intent.id, mode, note, externalSystemReference)}
        />
      ) : null}

      {(intent.approvedAt || intent.attemptedAt || intent.acknowledgedAt) ? (
        <div className="mt-4 space-y-1 text-xs text-[color:var(--muted-foreground)]">
          {intent.approvedAt ? <p>{english ? "approved" : "已批准"}: {formatOfficialWriteDate(intent.approvedAt, english)}</p> : null}
          {intent.attemptedAt ? <p>{english ? "attempted" : "已尝试"}: {formatOfficialWriteDate(intent.attemptedAt, english)}</p> : null}
          {intent.acknowledgedAt ? <p>{english ? "acknowledged" : "已确认"}: {formatOfficialWriteDate(intent.acknowledgedAt, english)}</p> : null}
        </div>
      ) : null}

      {limitedAutoIntent ? (
        <LimitedAutoIntentPanel
          limitedAutoIntent={limitedAutoIntent}
          english={english}
          pending={pending}
          onReview={onLimitedAutoReview}
        />
      ) : null}
    </div>
  );
}

export function MeetingV2OfficialWriteCard({ meetingId, runtime }: MeetingV2OfficialWriteCardProps) {
  const router = useRouter();
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const [pending, startTransition] = useTransition();

  const runRuntime = (force = true) => {
    startTransition(async () => {
      const result = await runMeetingOfficialWriteIntentRuntimeAction(meetingId, force);
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Official write runtime failed" : "正式写入运行时失败"));
        return;
      }
      toast.success(
        result.intentCount && result.intentCount > 0
          ? english
            ? "Guarded official write intents refreshed"
            : "受约束正式写入意图已刷新"
          : english
            ? "No approved source is ready for guarded official write yet"
            : "当前还没有已通过源头可进入受约束正式写入",
      );
      router.refresh();
    });
  };

  const runLimitedAutoRuntime = (force = true) => {
    startTransition(async () => {
      const result = await runMeetingLimitedAutoRuntimeAction(meetingId, force);
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Limited auto runtime failed" : "限定自动运行时失败"));
        return;
      }
      toast.success(
        result.intentCount && result.intentCount > 0
          ? english
            ? "Limited auto candidates refreshed"
            : "限定自动候选已刷新"
          : english
            ? "No approved guarded write is ready for limited auto review yet"
            : "当前还没有已通过的受约束写入可进入限定自动复核",
      );
      router.refresh();
    });
  };

  const runFollowThroughRuntime = (force = true) => {
    startTransition(async () => {
      const result = await runMeetingOfficialFollowThroughRuntimeAction(meetingId, force);
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Official follow-through runtime failed" : "正式跟进闭环运行时失败"));
        return;
      }
      toast.success(
        result.followThroughCount && result.followThroughCount > 0
          ? english
            ? "Official follow-through refreshed"
            : "正式跟进闭环已刷新"
          : english
            ? "No official follow-through is ready yet"
            : "当前还没有可用的正式跟进闭环",
      );
      router.refresh();
    });
  };

  const reviewIntent = (intentId: string, mode: OfficialWriteReviewMode, reviewNotes: string) => {
    startTransition(async () => {
      const result = await reviewMeetingOfficialWriteIntentAction({
        meetingId,
        intentId,
        mode,
        reviewNotes,
      });
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Official write review failed" : "正式写入复核失败"));
        return;
      }
      toast.success(reviewSuccessMessage(mode, english));
      router.refresh();
    });
  };

  const attemptIntent = (intentId: string) => {
    startTransition(async () => {
      const result = await attemptMeetingOfficialWriteIntentAction({
        meetingId,
        intentId,
      });
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Guarded write attempt failed" : "受约束写入尝试失败"));
        return;
      }
      toast.success(english ? "Guarded write attempt recorded" : "受约束写入尝试已记录");
      router.refresh();
    });
  };

  const acknowledgeIntent = (
    intentId: string,
    mode: OfficialWriteAcknowledgementMode,
    note: string,
    externalSystemReference: string,
  ) => {
    startTransition(async () => {
      const result = await acknowledgeMeetingOfficialWriteIntentAction({
        meetingId,
        intentId,
        mode,
        note,
        externalSystemReference,
      });
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Official write acknowledgement failed" : "正式写入确认失败"));
        return;
      }
      toast.success(acknowledgementSuccessMessage(mode, english));
      router.refresh();
    });
  };

  const reviewLimitedAuto = (limitedAutoIntentId: string, mode: LimitedAutoReviewMode, reviewNotes: string) => {
    startTransition(async () => {
      const result = await reviewMeetingLimitedAutoIntentAction({
        meetingId,
        limitedAutoIntentId,
        mode,
        reviewNotes,
      });
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Limited auto review failed" : "限定自动复核失败"));
        return;
      }
      toast.success(limitedAutoSuccessMessage(mode, english));
      router.refresh();
    });
  };

  const updateFollowThrough = (input: {
    followThroughId: string;
    mode: OfficialFollowThroughUpdateMode;
    ownerName?: string;
    nextAction?: string;
    note?: string;
  }) => {
    startTransition(async () => {
      const result = await updateMeetingOfficialFollowThroughAction({
        meetingId,
        ...input,
      });
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Official follow-through update failed" : "正式跟进闭环更新失败"));
        return;
      }
      toast.success(followThroughSuccessMessage(input.mode, english));
      router.refresh();
    });
  };

  const counts = runtime
    ? {
        pending: runtime.intents.filter((item) => item.writeApprovalStatus === "PENDING_REVIEW").length,
        approved: runtime.intents.filter((item) => item.writeApprovalStatus === "APPROVED").length,
        attempted: runtime.intents.filter((item) => item.writeExecutionStatus === "ATTEMPTED").length,
        success: runtime.intents.filter((item) => item.writeAcknowledgementStatus === "SUCCESS").length,
      }
    : null;
  const limitedAutoCounts = runtime?.limitedAuto?.eligibilityCounts ?? null;
  const limitedAutoBySource = new Map(runtime?.limitedAuto?.intents.map((item) => [item.sourceWriteIntentId, item]) ?? []);
  const followThroughCounts = runtime?.followThrough
    ? {
        open: runtime.followThrough.openCount,
        unresolved: runtime.followThrough.unresolvedCount,
        managerAttention: runtime.followThrough.managerAttentionCount,
      }
    : null;
  const intentById = new Map(runtime?.intents.map((item) => [item.id, item]) ?? []);
  const limitedAutoById = new Map(runtime?.limitedAuto?.intents.map((item) => [item.id, item]) ?? []);

  return (
    <Card className="workspace-panel" data-helm-v2-official-write-runtime="true">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{english ? "Helm v2 · follow-through" : "Helm v2 · 跟进闭环"}</Badge>
          <Badge variant="neutral">
            {english
              ? "approved source → richer official coverage → follow-through / exception handling"
              : "已通过源头 → 扩展正式系统覆盖 → 跟进闭环 / 异常处理"}
          </Badge>
          {runtime?.latestIntentEvent ? (
            <Badge variant={renderStatusVariant(runtime.latestIntentEvent.status)}>{runtime.latestIntentEvent.status}</Badge>
          ) : null}
          {runtime?.followThrough?.latestSyncEvent ? (
            <Badge variant={renderStatusVariant(runtime.followThrough.latestSyncEvent.status)}>
              {runtime.followThrough.latestSyncEvent.status}
            </Badge>
          ) : null}
        </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>{english ? "Helm v2 richer official system coverage" : "Helm v2 更广的正式系统覆盖"}</CardTitle>
            <CardDescription>
              {runtime
                ? english
                  ? "Approval, review/override, narrow-whitelist auto, receipt reconciliation, manual fallback on exceptions."
                  : "审批、复核 / 推翻、白名单内有限自动、回执对账、异常人工兜底。"
                : english
                  ? "Waiting for an approved shadow recommendation or acknowledged execution proof."
                  : "等已通过的阴影建议或已确认的执行证据。"}
            </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => runRuntime(true)} disabled={pending}>
                <RefreshCcw className="h-4 w-4" />
                {english ? "Run / refresh guarded path" : "运行 / 刷新受约束路径"}
              </Button>
              <Button variant="secondary" onClick={() => runLimitedAutoRuntime(true)} disabled={pending}>
                <RefreshCcw className="h-4 w-4" />
                {english ? "Refresh limited auto" : "刷新限定自动"}
              </Button>
              <Button variant="secondary" onClick={() => runFollowThroughRuntime(true)} disabled={pending}>
                <RefreshCcw className="h-4 w-4" />
                {english ? "Refresh follow-through" : "刷新跟进闭环"}
              </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {runtime ? (
          <>
            <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "pending review" : "待复核"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{counts?.pending ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "intent does not equal actual write" : "意图不等于真正写入"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "approved" : "已批准"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{counts?.approved ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "approved still != success" : "已通过仍不等于成功"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "attempted" : "已尝试"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{counts?.attempted ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "guarded path only" : "仅受约束路径"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "ack success" : "回执成功"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{counts?.success ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "system returned success required" : "必须拿到系统返回的成功回执"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "limited auto eligible" : "可进入限定自动"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{limitedAutoCounts?.eligible ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "still narrow, never default" : "仍然极窄，绝不作为默认"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "manual-only" : "仅人工"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{limitedAutoCounts?.manualOnly ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "visible, but kept on manual path" : "可见，但仍停在人工路径"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "blocked" : "已阻断"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{limitedAutoCounts?.blocked ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "boundary still wins" : "边界仍然优先"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "deferred" : "已延后"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{limitedAutoCounts?.deferred ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "needs more proof or clearer posture" : "还需要更多证据或更清楚的姿态"}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "follow-through open" : "跟进待处理"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{followThroughCounts?.open ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "official outcome still needs handling" : "正式结果仍需要处理"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "manager attention" : "主管关注"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{followThroughCounts?.managerAttention ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "attention, not a final decision" : "只是关注，不是最终决定"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "unresolved" : "未解决"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{followThroughCounts?.unresolved ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "resolution != official success" : "解决不等于正式成功"}</p>
              </div>
            </div>

            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "current official posture" : "当前正式姿态"}</p>
                  <p className="mt-2 text-sm text-[color:var(--foreground)]">
                    {runtime.currentOfficial
                      ? `${runtime.currentOfficial.stage ?? "null"} · ${runtime.currentOfficial.nextAction ?? (english ? "no next action" : "暂无下一动作")}`
                      : english
                        ? "No official opportunity object linked"
                        : "当前没有关联的正式机会对象"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "what this does not do" : "它不会做什么"}</p>
                  <p className="mt-2 text-sm text-[color:var(--foreground)]">
                    {english
                      ? "No default auto-write, no send authority, no auto booking, no hidden commit, and no success claim before external acknowledgment."
                      : "没有默认自动写入，没有发送权限，没有自动预约，没有隐式承诺，也不会在对外回执之前宣称成功。"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {runtime.intents.length > 0 ? (
                runtime.intents.map((intent) => (
                  <IntentCard
                    key={intent.id}
                    meetingId={meetingId}
                    intent={intent}
                    limitedAutoIntent={limitedAutoBySource.get(intent.id) ?? null}
                    english={english}
                    pending={pending}
                    onReview={reviewIntent}
                    onAttempt={attemptIntent}
                    onAcknowledge={acknowledgeIntent}
                    onLimitedAutoReview={reviewLimitedAuto}
                  />
                ))
              ) : (
                <div className="theme-surface-panel rounded-2xl px-4 py-6 text-sm text-[color:var(--muted-foreground)]">
                  {english
                    ? "Approved sources exist, but no guarded official write intent is ready yet."
                    : "当前已经有已通过源头，但暂时还没有可用的受约束正式写入意图。"}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "operator / manager follow-through" : "操作员 / 主管跟进闭环"}</p>
                <p className="text-sm text-[color:var(--muted-foreground)]">
                  {english
                    ? "This layer handles post-write follow-through, exception handling, reconciliation, escalation, and resolution write-back. It still does not claim broad auto-write or external success without a strong receipt."
                    : "这一层负责写入后跟进闭环、异常处理、对账、升级和结果回写。它仍然不会宣称大范围自动写入，也不会在拿到强回执之前宣称对外成功。"}
                </p>
              </div>
              {runtime.followThrough?.items.length ? (
                runtime.followThrough.items.map((item) => (
                  <FollowThroughPanel
                    key={item.id}
                    followThrough={item}
                    sourceIntent={item.sourceWriteIntentId ? intentById.get(item.sourceWriteIntentId) ?? null : null}
                    sourceLimitedAutoIntent={
                      item.sourceLimitedAutoIntentId ? limitedAutoById.get(item.sourceLimitedAutoIntentId) ?? null : null
                    }
                    english={english}
                    pending={pending}
                    onUpdate={updateFollowThrough}
                  />
                ))
              ) : (
                <div className="theme-surface-panel rounded-2xl px-4 py-6 text-sm text-[color:var(--muted-foreground)]">
                  {english
                    ? "No follow-through item exists yet. It appears after official outcomes, unknown receipts, partial success, stale receipts, or manual override."
                    : "当前还没有跟进闭环条目。正式结果、未知回执、部分成功、过期回执或人工推翻出现后才会生成。"}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-6 text-sm text-[color:var(--muted-foreground)]">
            {english
              ? "Idle until a reviewed recommendation or confirmed execution proof arrives."
              : "等已复核的建议或已确认的执行证据出现。"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
