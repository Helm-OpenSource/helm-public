"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { toast } from "sonner";
import type {
  TenantResourceReadiness,
  TenantResourceReadinessStatus,
  TenantResourceReadinessSummary,
} from "@/lib/tenant-resources/readiness";
import type { CapabilityDecisionOperatorReadout } from "@/lib/capability-decision-trace";
import type { TenantResourceEvidenceDetail } from "@/lib/tenant-resources/evidence-detail";
import type {
  TenantResourcePolicyReadout,
  TenantResourcePolicyReadoutItem,
} from "@/lib/tenant-resources/policy-readout";
import type {
  TenantResourceGuardedWriteEvaluation,
  TenantResourceGuardedWriteEvaluationItem,
} from "@/lib/tenant-resources/guarded-write-evaluation";
import type { TenantResourceGuardedWritePilotReadout } from "@/lib/tenant-resources/guarded-write-pilot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  acknowledgeTenantResourceGuardedWritePilotAction,
  requestTenantResourceGuardedWritePilotAction,
  reviewTenantResourceManualProofAction,
  reviewTenantResourceGuardedWritePilotAction,
  startTenantResourceManualProofReviewAction,
  submitTenantResourceManualProofAction,
  withdrawTenantResourceManualProofAction,
} from "@/features/settings/actions";
import { formatTenantResourceDateLabel } from "@/features/settings/components/tenant-resource-date-labels";
import { Info } from "@/features/settings/components/settings-display";
import {
  formatTenantResourceDisplayName,
  formatTenantResourceGap,
  formatTenantResourceGovernancePosture,
  formatTenantResourceGuardedWriteText,
  formatTenantResourceEvidenceToken,
  formatTenantResourceStatus,
  formatTenantResourceTrust,
  pickTenantResourceReadinessRows,
} from "@/features/settings/tenant-resource-readiness-display";

type TenantResourceReadinessPanelProps = {
  canManageProof: boolean;
  canManageResources: boolean;
  canReviewProof: boolean;
  capabilityReadouts: Array<
    CapabilityDecisionOperatorReadout & {
      resourceKey: string;
    }
  >;
  english: boolean;
  evidenceDetails: TenantResourceEvidenceDetail[];
  guardedWriteEvaluation: TenantResourceGuardedWriteEvaluation;
  guardedWritePilotReadouts: TenantResourceGuardedWritePilotReadout[];
  policyReadout: TenantResourcePolicyReadout;
  summary: TenantResourceReadinessSummary;
};

const statusBadgeVariant: Record<
  TenantResourceReadinessStatus,
  "default" | "success" | "warning" | "danger" | "info" | "neutral"
> = {
  registered: "neutral",
  configured: "neutral",
  connected: "info",
  readable: "info",
  mapped: "default",
  governed: "default",
  actionable: "success",
  write_intent_enabled: "warning",
  paused: "warning",
  error: "danger",
  revoked: "danger",
};

export function TenantResourceReadinessPanel({
  canManageProof,
  canManageResources,
  canReviewProof,
  capabilityReadouts,
  english,
  evidenceDetails,
  guardedWriteEvaluation,
  guardedWritePilotReadouts,
  policyReadout,
  summary,
}: TenantResourceReadinessPanelProps) {
  const rows = pickTenantResourceReadinessRows(summary.resources);
  const capabilityReadoutsByResourceKey = new Map(
    capabilityReadouts.map((readout) => [readout.resourceKey, readout]),
  );
  const evidenceDetailsByResourceKey = new Map(
    evidenceDetails.map((detail) => [detail.resource.resourceKey, detail]),
  );
  const policyItemsByResourceKey = new Map(
    policyReadout.items.map((item) => [item.resourceKey, item]),
  );
  const guardedWriteItemsByResourceKey = new Map(
    guardedWriteEvaluation.items.map((item) => [item.resourceKey, item]),
  );
  const guardedWritePilotsByResourceKey = new Map(
    guardedWritePilotReadouts.map((item) => [item.resourceKey, item]),
  );
  const proofSubmittedCount = evidenceDetails.filter((detail) =>
    ["submitted", "under_review"].includes(detail.manualProof.lifecycle.status),
  ).length;
  const proofAcceptedCount = evidenceDetails.filter(
    (detail) => detail.manualProof.lifecycle.status === "accepted",
  ).length;
  const reviewCount =
    summary.statusCounts.error +
    summary.statusCounts.paused +
    summary.statusCounts.revoked;

  return (
    <Card className="workspace-panel-muted">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>
              {english
                ? "Tenant resource governance"
                : "租户已有资源接入治理"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Which resources are ready to back Helm's judgement — read-only."
                : "哪些资源可以支撑 Helm 的判断——只读。"}
            </CardDescription>
          </div>
          <Badge variant={canManageResources ? "info" : "neutral"}>
            {canManageResources
              ? english
                ? "Operator can repair seams"
                : "当前角色可修复接缝"
              : english
                ? "Read-only for this role"
                : "当前角色只读"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Info
            label={english ? "Tracked resources" : "已纳入资源"}
            value={String(summary.totalResources)}
          />
          <Info
            label={english ? "Actionable" : "可用于推进"}
            value={String(summary.actionableResourceKeys.length)}
          />
          <Info
            label={english ? "Needs review" : "需要复核"}
            value={String(reviewCount)}
          />
          <Info
            label={english ? "Generated at" : "生成时间"}
            value={formatTenantResourceDateLabel(summary.generatedAt, english)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Info
            label={english ? "Read-only resources" : "只读资源"}
            value={String(policyReadout.readOnlyResourceKeys.length)}
          />
          <Info
            label={english ? "Draft capable" : "可生成草稿"}
            value={String(policyReadout.draftCapableResourceKeys.length)}
          />
          <Info
            label={english ? "Manual review" : "人工复核"}
            value={String(policyReadout.manualReviewResourceKeys.length)}
          />
          <Info
            label={english ? "Never external write" : "永不外部写回"}
            value={String(policyReadout.neverExternalWriteResourceKeys.length)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Info
            label={english ? "Guarded write design review" : "写回设计评审资格"}
            value={String(guardedWriteEvaluation.eligibleForDesignReviewResourceKeys.length)}
          />
          <Info
            label={english ? "Guarded write review blockers" : "写回复核阻塞"}
            value={String(guardedWriteEvaluation.requiresReviewResourceKeys.length)}
          />
          <Info
            label={english ? "Guarded write blocked" : "写回阻断"}
            value={String(guardedWriteEvaluation.blockedResourceKeys.length)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Info
            label={english ? "Proof pending review" : "待复核证据"}
            value={String(proofSubmittedCount)}
          />
          <Info
            label={english ? "Accepted proof" : "已接受证据"}
            value={String(proofAcceptedCount)}
          />
        </div>

        <div className="grid gap-3">
          {rows.length ? (
            rows.map((resource) => (
              <TenantResourceReadinessRow
                canManageProof={canManageProof}
                key={resource.resourceKey}
                canReviewProof={canReviewProof}
                capabilityReadout={capabilityReadoutsByResourceKey.get(resource.resourceKey) ?? null}
                english={english}
                evidenceDetail={evidenceDetailsByResourceKey.get(resource.resourceKey) ?? null}
                guardedWriteItem={
                  guardedWriteItemsByResourceKey.get(resource.resourceKey) ?? null
                }
                guardedWritePilot={
                  guardedWritePilotsByResourceKey.get(resource.resourceKey) ?? null
                }
                policyItem={policyItemsByResourceKey.get(resource.resourceKey) ?? null}
                resource={resource}
              />
            ))
          ) : (
            <div className="workspace-panel rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted-foreground)]">
              {english
                ? "No tenant resources are registered yet. Connectors, CRM imports, capture sessions and tenant extensions will appear here after their existing source-of-truth records exist."
                : "当前还没有登记的租户资源。已有连接器、客户关系系统导入、现场采集和租户扩展在各自来源记录存在后会出现在这里。"}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
          <p className="font-medium text-[color:var(--foreground)]">
            {english ? "Boundary" : "边界"}
          </p>
          <p className="mt-2">
            {english
              ? "Review-first. Never auto-writes, sends, or executes."
              : "先复核。从不自动写回、发送或执行。"}
          </p>
          {!canManageResources ? (
            <p className="mt-2">
              {english
                ? "Current role may read the posture only. Repairing connectors, imports or governed actions remains behind the existing workspace capability checks."
                : "当前角色只能阅读姿态；修复连接器、导入或受控动作仍然走已有工作区能力检查。"}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function TenantResourceReadinessRow({
  canManageProof,
  canReviewProof,
  capabilityReadout,
  english,
  evidenceDetail,
  guardedWriteItem,
  guardedWritePilot,
  policyItem,
  resource,
}: {
  canManageProof: boolean;
  canReviewProof: boolean;
  capabilityReadout: CapabilityDecisionOperatorReadout | null;
  english: boolean;
  evidenceDetail: TenantResourceEvidenceDetail | null;
  guardedWriteItem: TenantResourceGuardedWriteEvaluationItem | null;
  guardedWritePilot: TenantResourceGuardedWritePilotReadout | null;
  policyItem: TenantResourcePolicyReadoutItem | null;
  resource: TenantResourceReadiness;
}) {
  return (
    <div
      className="workspace-panel rounded-2xl px-4 py-4"
      id={evidenceDetail?.detailKey}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[color:var(--foreground)]">
              {formatTenantResourceDisplayName(resource.resourceName, english)}
            </p>
            <Badge variant={statusBadgeVariant[resource.status]}>
              {formatTenantResourceStatus(resource.status, english)}
            </Badge>
          </div>
          <p className="mt-1 text-xs font-medium text-[color:var(--muted-foreground)]">
            {formatEvidenceToken(resource.provider, english)} ·{" "}
            {formatEvidenceToken(resource.resourceType, english)}
          </p>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[color:var(--muted-foreground)]">
          {formatTenantResourceGuardedWriteText(
            resource.readiness.operatorNextMove,
            english,
          )}
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Info
          label={english ? "Trust" : "信任级别"}
          value={formatTenantResourceTrust(resource.governance.trustLevel, english)}
        />
        <Info
          label={english ? "Primary gap" : "主要缺口"}
          value={formatTenantResourceGap(resource.readiness.primaryGap, english)}
        />
        <Info
          label={english ? "Last sync" : "最近同步"}
          value={
            resource.connection.lastSyncAt
              ? formatTenantResourceDateLabel(resource.connection.lastSyncAt, english)
              : english
                ? "Not recorded"
                : "未记录"
          }
        />
        <Info
          label={english ? "Mapping" : "映射完整度"}
          value={`${resource.mapping.mappingCompleteness}% · ${resource.mapping.conflictCount} ${
            english ? "conflicts" : "个冲突"
          }`}
        />
        <Info
          label={english ? "Governance posture" : "治理姿态"}
          value={formatTenantResourceGovernancePosture(resource, english)}
        />
        <Info
          label={english ? "Decision trace" : "决策痕迹"}
          value={
            capabilityReadout
              ? `${formatTraceToken(capabilityReadout.decision, english)} · ${formatTraceToken(
                  capabilityReadout.primaryReasonCode,
                  english,
                )} · ${formatTraceToken(capabilityReadout.fallbackType, english)}`
              : english
                ? "Not generated"
                : "未生成"
          }
        />
      </div>
      {policyItem ? (
        <p className="mt-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-3 py-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
          {english ? "Tenant policy readout" : "租户策略读数"}:{" "}
          {formatTenantResourceGuardedWriteText(
            policyItem.ownerVisibleSummary,
            english,
          )}
        </p>
      ) : null}
      {evidenceDetail?.extensionAdoption ? (
        <p className="mt-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-3 py-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
          {english ? "Extension adoption" : "扩展纳管姿态"}:{" "}
          {formatEvidenceToken(
            evidenceDetail.extensionAdoption.overallStatus,
            english,
          )}{" "}
          ·{" "}
          {formatTenantResourceGuardedWriteText(
            evidenceDetail.extensionAdoption.summary,
            english,
          )}
        </p>
      ) : null}
      {guardedWriteItem ? (
        <p className="mt-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-3 py-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
          {english ? "Guarded write evaluation" : "受控写回评估"}:{" "}
          {formatTenantResourceEvidenceToken(
            guardedWriteItem.status,
            english,
          )}{" "}
          ·{" "}
          {formatTenantResourceGuardedWriteText(
            guardedWriteItem.nextReviewStep,
            english,
          )}
        </p>
      ) : null}
      {guardedWritePilot ? (
        <p className="mt-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-3 py-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
          {english ? "Guarded write pilot" : "受控写回试点"}:{" "}
          {formatTenantResourceEvidenceToken(
            guardedWritePilot.status,
            english,
          )}{" "}
          ·{" "}
          {formatTenantResourceGuardedWriteText(
            guardedWritePilot.nextAction,
            english,
          )}
        </p>
      ) : null}
      <TenantResourceEvidenceDisclosure
        canManageProof={canManageProof}
        canReviewProof={canReviewProof}
        detail={evidenceDetail}
        english={english}
        guardedWritePilot={guardedWritePilot}
      />
    </div>
  );
}

function TenantResourceEvidenceDisclosure({
  canManageProof,
  canReviewProof,
  detail,
  english,
  guardedWritePilot,
}: {
  canManageProof: boolean;
  canReviewProof: boolean;
  detail: TenantResourceEvidenceDetail | null;
  english: boolean;
  guardedWritePilot: TenantResourceGuardedWritePilotReadout | null;
}) {
  if (!detail) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
        {english
          ? "Evidence detail has not been generated for this resource yet."
          : "这条资源还没有生成证据详情。"}
      </p>
    );
  }

  return (
    <details className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-[color:var(--foreground)]">
        {english ? detail.ui.disclosureLabel.en : detail.ui.disclosureLabel.zh}
      </summary>
      <div className="mt-4 grid gap-4 text-sm leading-6 text-[color:var(--muted-foreground)] lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <EvidenceLine
            label={english ? "Source object" : "来源对象"}
            value={`${formatEvidenceToken(detail.sourceObject.sourceObjectType, english)} · ${formatEvidenceToken(detail.sourceObject.sourceRef, english)}`}
          />
          <EvidenceLine
            label={english ? "Freshness" : "新鲜度"}
            value={`${formatEvidenceToken(detail.timing.freshnessPosture, english)} · ${
              detail.timing.observedAt
                ? formatTenantResourceDateLabel(detail.timing.observedAt, english)
                : english
                  ? "not recorded"
                  : "未记录"
            }`}
          />
          <EvidenceLine
            label={english ? "Trust / review posture" : "信任 / 复核姿态"}
            value={`${formatTenantResourceTrust(detail.trust.trustLevel, english)} · ${
              detail.trust.writeBackAllowed
                ? english
                  ? "write-back guarded"
                  : "写回受控"
                : english
                  ? "write-back blocked"
                  : "写回关闭"
            }`}
          />
          <EvidenceLine
            label={english ? "Mapping / conflicts" : "映射 / 冲突"}
            value={`${detail.mapping.mappingCompleteness}% · ${detail.conflicts.conflictCount} ${
              english ? "conflicts" : "个冲突"
            }`}
          />
          {detail.mapping.missingRequirements.length ? (
            <EvidenceLine
              label={english ? "Missing requirements" : "缺失要求"}
              value={detail.mapping.missingRequirements
                .map((item) => formatEvidenceToken(item, english))
                .join(" / ")}
            />
          ) : null}
          <EvidenceLine
            label={english ? "Field mapping gap" : "字段映射缺口"}
            value={`${formatEvidenceToken(detail.mapping.fieldGaps.summaryStatus, english)} · ${
              formatTenantResourceGuardedWriteText(
                detail.mapping.fieldGaps.downgradeReason ??
                  (english ? "no judgement downgrade" : "未降级判断"),
                english,
              )
            }`}
          />
        </div>
        <div className="space-y-3">
          <EvidenceLine
            label={english ? "Decision" : "决策"}
            value={`${formatEvidenceToken(detail.decision.decision, english)} · ${formatEvidenceToken(
              detail.decision.primaryReasonCode,
              english,
            )} · ${formatEvidenceToken(detail.decision.fallbackType, english)}`}
          />
          <EvidenceLine
            label={english ? "Manual proof" : "人工依据"}
            value={`${formatEvidenceToken(detail.manualProof.lifecycle.status, english)} · ${
              formatEvidenceToken(
                detail.manualProof.lifecycle.followThrough.nextOwner,
                english,
              )
            }`}
          />
          {detail.extensionAdoption ? (
            <EvidenceLine
              label={english ? "Extension adoption" : "扩展纳管"}
              value={`${formatEvidenceToken(detail.extensionAdoption.overallStatus, english)} · ${
                detail.extensionAdoption.dependencyCount
              } ${english ? "dependencies" : "个依赖"}`}
            />
          ) : null}
          <p className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3">
            {formatTenantResourceGuardedWriteText(
              detail.manualProof.lifecycle.followThrough.nextMove,
              english,
            )}
          </p>
          {detail.extensionAdoption ? (
            <p className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3">
              {formatTenantResourceGuardedWriteText(
                detail.extensionAdoption.summary,
                english,
              )}
            </p>
          ) : null}
          <p className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3">
            {english ? "Critical fields" : "关键字段"}:{" "}
            {formatCriticalFieldKeys(detail.mapping.fieldGaps.criticalFieldKeys, english)}
          </p>
          <p className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3">
            {formatTenantResourceGuardedWriteText(detail.decision.why, english)}
          </p>
          <div className="flex flex-wrap gap-2">
            {detail.evidenceItems.slice(0, 6).map((item) => (
              <Badge key={item.evidenceRef} variant="neutral">
                {formatEvidenceToken(item.evidenceRef, english)}
              </Badge>
            ))}
          </div>
          {detail.extensionAdoption?.dependencies.length ? (
            <div className="space-y-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Declared dependencies" : "已声明依赖"}
              </p>
              {detail.extensionAdoption.dependencies.map((dependency) => (
                <p key={dependency.resourceDependencyKey}>
                  {formatEvidenceToken(dependency.provider, english)} ·{" "}
                  {formatEvidenceToken(dependency.resourceDependencyKey, english)} ·{" "}
                  {formatEvidenceToken(dependency.adoptionStatus, english)} ·{" "}
                  {dependency.objectBindings.join(" / ")} ·{" "}
                  {formatTenantResourceGuardedWriteText(
                    dependency.nextReviewStep,
                    english,
                  )}
                </p>
              ))}
            </div>
          ) : null}
          <TenantResourceManualProofControls
            canManageProof={canManageProof}
            canReviewProof={canReviewProof}
            detail={detail}
            english={english}
          />
          <TenantResourceGuardedWritePilotControls
            canManageProof={canManageProof}
            canReviewProof={canReviewProof}
            detail={detail}
            english={english}
            guardedWritePilot={guardedWritePilot}
          />
        </div>
      </div>
    </details>
  );
}

function TenantResourceManualProofControls({
  canManageProof,
  canReviewProof,
  detail,
  english,
}: {
  canManageProof: boolean;
  canReviewProof: boolean;
  detail: TenantResourceEvidenceDetail;
  english: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const lifecycle = detail.manualProof.lifecycle;
  const proofId = lifecycle.proof?.proofId ?? null;
  const status = lifecycle.status;
  const canSubmit = canManageProof && ["awaiting_submission", "rejected", "withdrawn", "expired"].includes(status);
  const canStartReview = canReviewProof && proofId && status === "submitted";
  const canAcceptReject = canReviewProof && proofId && status === "under_review";
  const canWithdraw = canManageProof && proofId && ["submitted", "under_review", "rejected"].includes(status);

  if (!canSubmit && !canStartReview && !canAcceptReject && !canWithdraw) {
    return null;
  }

  async function runAction(
    action: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string,
  ) {
    setPending(true);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Action failed" : "操作失败"));
        return;
      }
      setNote("");
      toast.success(successMessage);
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {english ? "Proof runtime" : "证据运行记录"}
      </p>
      {(canSubmit || canAcceptReject || canWithdraw) ? (
        <Textarea
          className="min-h-[92px]"
          disabled={pending}
          onChange={(event) => setNote(event.target.value)}
          placeholder={
            canSubmit
              ? english
                ? "Describe the manual step completed and the evidence captured."
                : "说明已完成的人工步骤和采集到的证据。"
              : canAcceptReject
                ? english
                  ? "Optional review note. Reject requires a short reason."
                  : "可填写复核备注；拒绝时需要简短原因。"
                : english
                  ? "Optional withdrawal note."
                  : "可填写撤回备注。"
          }
          value={note}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canSubmit ? (
          <Button
            disabled={pending || note.trim().length < 12}
            onClick={() =>
              runAction(
                () =>
                  submitTenantResourceManualProofAction({
                    resourceKey: detail.resource.resourceKey,
                    note,
                  }),
                english ? "Proof submitted for review" : "证据已提交复核",
              )
            }
            size="sm"
            variant="secondary"
          >
            {english ? "Submit proof" : "提交证据"}
          </Button>
        ) : null}
        {canStartReview ? (
          <Button
            disabled={pending}
            onClick={() =>
              runAction(
                () =>
                  startTenantResourceManualProofReviewAction({
                    proofId: proofId!,
                  }),
                english ? "Proof review started" : "已开始证据复核",
              )
            }
            size="sm"
            variant="outline"
          >
            {english ? "Start review" : "开始复核"}
          </Button>
        ) : null}
        {canAcceptReject ? (
          <>
            <Button
              disabled={pending}
              onClick={() =>
                runAction(
                  () =>
                    reviewTenantResourceManualProofAction({
                      proofId: proofId!,
                      mode: "accept",
                      note,
                    }),
                  english ? "Proof accepted" : "证据已接受",
                )
              }
              size="sm"
              variant="secondary"
            >
              {english ? "Accept proof" : "接受证据"}
            </Button>
            <Button
              disabled={pending || note.trim().length < 8}
              onClick={() =>
                runAction(
                  () =>
                    reviewTenantResourceManualProofAction({
                      proofId: proofId!,
                      mode: "reject",
                      note,
                    }),
                  english ? "Proof rejected" : "证据已拒绝",
                )
              }
              size="sm"
              variant="danger"
            >
              {english ? "Reject proof" : "拒绝证据"}
            </Button>
          </>
        ) : null}
        {canWithdraw ? (
          <Button
            disabled={pending}
            onClick={() =>
              runAction(
                () =>
                  withdrawTenantResourceManualProofAction({
                    proofId: proofId!,
                    note,
                  }),
                english ? "Proof withdrawn" : "证据已撤回",
              )
            }
            size="sm"
            variant="ghost"
          >
            {english ? "Withdraw proof" : "撤回证据"}
          </Button>
        ) : null}
      </div>
      <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
        {english
          ? "This runtime stays local-only. Accepted proof may close follow-through evidence, but it still does not claim external write success."
          : "这层运行记录仍然只在本地成立。接受后的证据只能关闭后续证据，不代表外部写回成功。"}
      </p>
    </div>
  );
}

function TenantResourceGuardedWritePilotControls({
  canManageProof,
  canReviewProof,
  detail,
  english,
  guardedWritePilot,
}: {
  canManageProof: boolean;
  canReviewProof: boolean;
  detail: TenantResourceEvidenceDetail;
  english: boolean;
  guardedWritePilot: TenantResourceGuardedWritePilotReadout | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  if (!guardedWritePilot) {
    return null;
  }

  const canRequest =
    canManageProof &&
    (guardedWritePilot.status === "requestable" ||
      guardedWritePilot.status === "rejected");
  const canApproveReject =
    canReviewProof && guardedWritePilot.pilotId && guardedWritePilot.status === "pending_review";
  const canAcknowledge =
    canManageProof && guardedWritePilot.pilotId && guardedWritePilot.status === "approved";

  if (!canRequest && !canApproveReject && !canAcknowledge) {
    return null;
  }

  async function runAction(
    action: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string,
  ) {
    setPending(true);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Action failed" : "操作失败"));
        return;
      }
      setNote("");
      toast.success(successMessage);
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {english ? "Guarded write pilot" : "受控写回试点"}
      </p>
      {(canRequest || canApproveReject || canAcknowledge) ? (
        <Textarea
          className="min-h-[92px]"
          disabled={pending}
          onChange={(event) => setNote(event.target.value)}
          placeholder={
            canRequest
              ? english
                ? "Optional pilot note about why this resource loop is ready for the local guarded-write pilot."
                : "可填写试点备注，说明为什么这条资源闭环已准备进入本地受控写回试点。"
              : canApproveReject
                ? english
                  ? "Optional review note. Reject requires a short reason."
                  : "可填写复核备注；拒绝时需要简短原因。"
                : english
                  ? "Optional acknowledgement note."
                  : "可填写确认备注。"
          }
          value={note}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canRequest ? (
          <Button
            disabled={pending}
            onClick={() =>
              runAction(
                () =>
                  requestTenantResourceGuardedWritePilotAction({
                    resourceKey: detail.resource.resourceKey,
                    note,
                  }),
                english
                  ? "Guarded write pilot requested"
                  : "受控写回试点已发起",
              )
            }
            size="sm"
            variant="outline"
          >
            {english ? "Request pilot" : "发起试点"}
          </Button>
        ) : null}
        {canApproveReject ? (
          <>
            <Button
              disabled={pending}
              onClick={() =>
                runAction(
                  () =>
                    reviewTenantResourceGuardedWritePilotAction({
                      pilotId: guardedWritePilot.pilotId!,
                      mode: "approve",
                      note,
                    }),
                  english ? "Pilot approved" : "试点已批准",
                )
              }
              size="sm"
              variant="secondary"
            >
              {english ? "Approve pilot" : "批准试点"}
            </Button>
            <Button
              disabled={pending || note.trim().length < 8}
              onClick={() =>
                runAction(
                  () =>
                    reviewTenantResourceGuardedWritePilotAction({
                      pilotId: guardedWritePilot.pilotId!,
                      mode: "reject",
                      note,
                    }),
                  english ? "Pilot rejected" : "试点已拒绝",
                )
              }
              size="sm"
              variant="danger"
            >
              {english ? "Reject pilot" : "拒绝试点"}
            </Button>
          </>
        ) : null}
        {canAcknowledge ? (
          <Button
            disabled={pending}
            onClick={() =>
              runAction(
                () =>
                  acknowledgeTenantResourceGuardedWritePilotAction({
                    pilotId: guardedWritePilot.pilotId!,
                    note,
                  }),
                english ? "Pilot acknowledged" : "试点已确认",
              )
            }
            size="sm"
            variant="ghost"
          >
            {english ? "Acknowledge pilot" : "确认试点"}
          </Button>
        ) : null}
      </div>
      <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
        {english
          ? "This pilot never writes to the external system. It only proves that accepted proof plus eligible evaluation can stay reviewable through a local candidate / review / acknowledgement seam."
          : "这个试点不会写入外部系统。它只证明已接受证据与符合条件的评估可以进入本地候选、复核与确认链路，并持续保持可复核。"}
      </p>
    </div>
  );
}

function EvidenceLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 font-medium text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function formatTraceToken(value: string, english: boolean) {
  return formatTenantResourceEvidenceToken(value, english);
}

function formatEvidenceToken(value: string, english: boolean) {
  return formatTenantResourceEvidenceToken(value, english);
}

function formatCriticalFieldKeys(fieldKeys: string[], english: boolean) {
  if (fieldKeys.length === 0) return english ? "none" : "无";

  return fieldKeys
    .slice(0, 4)
    .map((item) => formatEvidenceToken(item, english))
    .join(" / ");
}
