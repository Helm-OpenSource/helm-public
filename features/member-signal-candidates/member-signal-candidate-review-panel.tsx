"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  projectMemberSignalEvidenceAction,
  promoteMemberSignalCandidateToTaskAction,
  reviewMemberSignalCandidateAction,
} from "@/features/member-signal-candidates/actions";
import type { MemberSignalCandidateReviewListItem } from "@/lib/member-gateway/signal-candidate-review.service";

// Bilingual labels for the seven M1 read-surface dimensions (spec §8.1) —
// only rendered here, in the reviewer-facing evidence projection panel;
// the frozen literal identifiers themselves live in lib/member-gateway/types.ts.
const EVIDENCE_DIMENSION_LABELS: Readonly<Record<string, readonly [string, string]>> = {
  live_membership: ["Live membership", "在职成员资格"],
  tool_scope: ["Tool scope", "工具授权范围"],
  object_relationship_authorization: [
    "Object relationship authorization",
    "对象关联授权",
  ],
  field_purpose_policy: ["Field purpose policy", "字段用途策略"],
  source_authorization: ["Source authorization", "数据来源授权"],
  tenant_provider_egress_policy: [
    "Tenant provider egress policy",
    "租户出站策略",
  ],
  current_classification: ["Current classification", "当前分级"],
};

const EVIDENCE_BLOCK_REASON_LABELS: Readonly<Record<string, readonly [string, string]>> = {
  LOCAL_VIEW_REQUIRED: [
    "This evidence must be viewed locally in the source system.",
    "该证据必须在源系统本地查看。",
  ],
  read_surface_denied: ["The read surface was denied.", "读取面被拒绝。"],
  classification_unknown: [
    "The object's classification is unknown.",
    "该对象的分级未知。",
  ],
  provider_not_approved: [
    "No approved provider for this tenant.",
    "该租户没有已批准的提供方。",
  ],
  purpose_missing: ["The request purpose is missing.", "请求缺少用途标识。"],
};

type EvidenceProjectionViewState =
  | {
      status: "blocked";
      blockReason: string;
      deniedDimensions: readonly string[];
    }
  | { status: "projected"; data: Readonly<Record<string, unknown>> }
  | { status: "error"; message: string };

function EvidenceRefRow({
  artifactBundleId,
  evidenceRef,
  english,
}: {
  artifactBundleId: string;
  evidenceRef: string;
  english: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<EvidenceProjectionViewState | null>(
    null,
  );

  const runProjection = () => {
    startTransition(async () => {
      const response = await projectMemberSignalEvidenceAction({
        artifactBundleId,
        evidenceRef,
      });
      if (!response.ok) {
        setResult({ status: "error", message: response.error });
        return;
      }
      const decision = response.envelope.boundary.decision;
      if (decision.projection === null) {
        setResult({
          status: "blocked",
          blockReason: decision.blockReason ?? "read_surface_denied",
          deniedDimensions: response.deniedDimensions,
        });
      } else {
        setResult({
          status: "projected",
          data: (response.envelope.data ?? {}) as Readonly<
            Record<string, unknown>
          >,
        });
      }
    });
  };

  // The default fail-closed resolver denies all seven dimensions at once —
  // that specific shape gets deployment-attributed copy ("this deployment
  // hasn't connected a resolver") instead of a dimension-by-dimension list,
  // so a reviewer never reads it as their own access problem.
  const isUnconnectedDeployment =
    result?.status === "blocked" &&
    result.blockReason === "read_surface_denied" &&
    result.deniedDimensions.length === 7;

  return (
    <div
      className="rounded-md border border-[color:var(--border)] p-3"
      data-member-signal-evidence-ref={evidenceRef}
    >
      <div className="flex items-center justify-between gap-2">
        <code className="min-w-0 truncate text-xs text-[color:var(--muted)]">
          {evidenceRef}
        </code>
        <Button
          disabled={pending}
          onClick={runProjection}
          size="sm"
          variant="secondary"
        >
          {english ? "View authorization projection" : "查看授权投影"}
        </Button>
      </div>
      {result?.status === "blocked" ? (
        <div
          className="mt-2 text-xs text-[color:var(--muted)]"
          data-member-signal-evidence-result="blocked"
        >
          {isUnconnectedDeployment ? (
            <p>
              {english
                ? "This deployment has not connected an evidence resolver; the request was denied by default."
                : "当前部署未接入证据解析器，按默认拒绝。"}
            </p>
          ) : (
            <>
              <p>
                {(EVIDENCE_BLOCK_REASON_LABELS[result.blockReason]?.[
                  english ? 0 : 1
                ]) ?? result.blockReason}
              </p>
              {result.deniedDimensions.length > 0 ? (
                <ul className="mt-1 list-disc pl-4">
                  {result.deniedDimensions.map((dimension) => (
                    <li key={dimension}>
                      {(EVIDENCE_DIMENSION_LABELS[dimension]?.[
                        english ? 0 : 1
                      ]) ?? dimension}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      {result?.status === "projected" ? (
        <table
          className="mt-2 w-full text-xs"
          data-member-signal-evidence-result="projected"
        >
          <tbody>
            {Object.entries(result.data).map(([field, value]) => (
              <tr key={field}>
                <td className="pr-2 align-top font-medium text-[color:var(--foreground)]">
                  {field}
                </td>
                <td className="align-top text-[color:var(--muted)]">
                  {String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {result?.status === "error" ? (
        <p className="mt-2 text-xs text-[color:var(--danger)]">
          {result.message}
        </p>
      ) : null}
    </div>
  );
}

type MemberSignalCandidateReviewPanelProps = {
  items: MemberSignalCandidateReviewListItem[];
  governance: {
    canReview: boolean;
    canPromote: boolean;
    reviewDeniedMessage: string;
    promotionDeniedMessage: string;
  };
};

function MemberSignalCandidateRow({
  item,
  governance,
  english,
}: {
  item: MemberSignalCandidateReviewListItem;
  governance: MemberSignalCandidateReviewPanelProps["governance"];
  english: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reviewNotes, setReviewNotes] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const runReview = (decision: "confirm" | "reject") => {
    startTransition(async () => {
      const result = await reviewMemberSignalCandidateAction({
        artifactBundleId: item.artifactBundleId,
        decision,
        notes: reviewNotes || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        decision === "confirm"
          ? english
            ? "Candidate confirmed"
            : "候选已确认"
          : english
            ? "Candidate rejected"
            : "候选已拒绝",
      );
      router.refresh();
    });
  };

  const promote = () => {
    startTransition(async () => {
      const result = await promoteMemberSignalCandidateToTaskAction({
        artifactBundleId: item.artifactBundleId,
        title,
        description: description || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        english
          ? "Internal task entered the approval queue"
          : "内部任务已进入审批队列",
      );
      router.refresh();
    });
  };

  if (item.corrupt) {
    return (
      <article
        className="flex items-start gap-3 py-4"
        data-member-signal-candidate-contract="corrupt"
      >
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--danger)]" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {english
              ? "Candidate artifact blocked"
              : "候选产物已阻断"}
          </p>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {english
              ? "This artifact failed validation and no review or promotion command is available."
              : "该产物校验失败，不提供复核或晋级命令。"}
          </p>
        </div>
      </article>
    );
  }

  const showReview = item.reviewStatus === "PENDING";
  const showPromote = item.bundleStatus === "CONFIRMED";
  const isConsumed = item.bundleStatus === "CONSUMED";

  return (
    <article
      className="grid gap-4 py-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]"
      data-member-signal-candidate-id={item.artifactBundleId}
    >
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Taint marker is first-class per spec §5.1 ruling 2: every
              member-upstream candidate renders this outside any collapsed
              disclosure, untruncated, ahead of any other row content. */}
          <Badge variant="danger">
            {english ? "Untrusted · member upstream" : "未信任 · 成员上行"}
          </Badge>
          {item.kind ? <Badge variant="neutral">{item.kind}</Badge> : null}
        </div>
        <div>
          {/* projectedSummary may contain [link-evidence:N] tokens. Render
              them verbatim as plain text — the tokens are not injective, so
              never linkify by matching this text. */}
          <h3 className="text-base font-semibold text-[color:var(--foreground)]">
            {item.projectedSummary ??
              (english
                ? "Member signal candidate"
                : "成员信号候选")}
          </h3>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {item.memberRef ?? (english ? "Unknown member" : "成员未知")}
            {" · "}
            {item.submittedAt ?? (english ? "Submission time unknown" : "提交时间未知")}
          </p>
        </div>
        {item.relatedEvidenceRefs.length > 0 ? (
          <div>
            <Button
              onClick={() => setEvidenceOpen((open) => !open)}
              size="sm"
              variant="ghost"
            >
              {english
                ? `Evidence (${item.relatedEvidenceRefs.length})`
                : `证据(${item.relatedEvidenceRefs.length})`}
            </Button>
            {evidenceOpen ? (
              <div className="mt-2 space-y-2">
                {item.relatedEvidenceRefs.map((evidenceRef) => (
                  <EvidenceRefRow
                    artifactBundleId={item.artifactBundleId}
                    english={english}
                    evidenceRef={evidenceRef}
                    key={evidenceRef}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 border-t border-[color:var(--border)] pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        {showReview ? (
          <div className="space-y-3">
            <label
              className="block text-xs font-medium text-[color:var(--muted)]"
              htmlFor={`member-signal-candidate-review-notes-${item.artifactBundleId}`}
            >
              {english ? "Review note" : "复核备注"}
            </label>
            <Textarea
              id={`member-signal-candidate-review-notes-${item.artifactBundleId}`}
              value={reviewNotes}
              maxLength={2_000}
              onChange={(event) => setReviewNotes(event.target.value)}
              placeholder={english ? "Optional" : "可选"}
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending || !governance.canReview}
                onClick={() => runReview("confirm")}
                size="sm"
              >
                <Check className="h-4 w-4" />
                {english ? "Confirm candidate" : "确认候选"}
              </Button>
              <Button
                disabled={pending || !governance.canReview}
                onClick={() => runReview("reject")}
                size="sm"
                variant="secondary"
              >
                <X className="h-4 w-4" />
                {english ? "Reject" : "拒绝"}
              </Button>
            </div>
            {!governance.canReview ? (
              <p className="text-xs text-[color:var(--muted)]">
                {governance.reviewDeniedMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        {showPromote ? (
          <div className="space-y-3">
            <label
              className="block text-xs font-medium text-[color:var(--muted)]"
              htmlFor={`member-signal-candidate-task-title-${item.artifactBundleId}`}
            >
              {english ? "Internal task title" : "内部任务标题"}
            </label>
            <Input
              id={`member-signal-candidate-task-title-${item.artifactBundleId}`}
              value={title}
              maxLength={175}
              onChange={(event) => setTitle(event.target.value)}
            />
            <label
              className="block text-xs font-medium text-[color:var(--muted)]"
              htmlFor={`member-signal-candidate-task-description-${item.artifactBundleId}`}
            >
              {english ? "Task context" : "任务上下文"}
            </label>
            <Textarea
              id={`member-signal-candidate-task-description-${item.artifactBundleId}`}
              value={description}
              maxLength={191}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
            <Button
              disabled={pending || !governance.canPromote || !title.trim()}
              onClick={promote}
              size="sm"
            >
              <Check className="h-4 w-4" />
              {english ? "Promote to internal task" : "晋级为内部任务"}
            </Button>
            {!governance.canPromote ? (
              <p className="text-xs text-[color:var(--muted)]">
                {governance.promotionDeniedMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        {isConsumed ? (
          <Badge variant="neutral">
            {english ? "Promoted" : "已晋升"}
          </Badge>
        ) : null}

        {!showReview && !showPromote && !isConsumed ? (
          <p className="text-sm text-[color:var(--muted)]">
            {item.reviewStatus === "REJECTED"
              ? english
                ? "This candidate is closed as rejected."
                : "该候选已按拒绝终态关闭。"
              : english
                ? "No command is available in the current state."
                : "当前状态没有可用命令。"}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function MemberSignalCandidateReviewPanel({
  items,
  governance,
}: MemberSignalCandidateReviewPanelProps) {
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";

  return (
    <section
      className="order-5 border-y border-[color:var(--border)] py-5"
      data-member-signal-candidate-review-panel="true"
      id="member-signal-candidate-review"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="workspace-eyebrow">
            {english ? "Member signal candidates" : "成员信号候选"}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
            {english
              ? "Review before task promotion"
              : "先复核，再晋级内部任务"}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
          <ShieldAlert className="h-4 w-4" />
          <span>
            {english
              ? "Untrusted member input, no auto-approval"
              : "成员上行输入未受信，无自动批准"}
          </span>
        </div>
      </div>

      {items.length ? (
        <div className="mt-4 divide-y divide-[color:var(--border)]">
          {items.map((item) => (
            <MemberSignalCandidateRow
              key={item.artifactBundleId}
              item={item}
              governance={governance}
              english={english}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[color:var(--muted)]">
          {english
            ? "No member signal candidate is waiting for review."
            : "当前没有待复核的成员信号候选。"}
        </p>
      )}
    </section>
  );
}
