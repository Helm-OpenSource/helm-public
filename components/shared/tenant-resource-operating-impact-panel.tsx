import Link from "next/link";
import { ArrowRight, DatabaseZap, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  TenantResourceOperatingImpactItem,
  TenantResourceOperatingImpactReadout,
  TenantResourceOperatingImpactSeverity,
} from "@/lib/tenant-resources/operating-impact";
import {
  formatTenantResourceDecision,
  formatTenantResourceDecisionWhy,
  formatTenantResourceDisplayName,
  formatTenantResourceEvidenceToken,
  formatTenantResourceImpactSeverity,
  formatTenantResourceImpactSummary,
  formatTenantResourceMappingDowngrade,
  formatTenantResourceNextActionMode,
  formatTenantResourceObjectType,
  formatTenantResourceProofFollowThrough,
  formatTenantResourceReason,
  formatTenantResourceSourceKind,
} from "@/lib/tenant-resources/operating-impact-display";

export function TenantResourceOperatingImpactPanel({
  readout,
  english,
  surface,
}: {
  readout: TenantResourceOperatingImpactReadout;
  english: boolean;
  surface: "dashboard" | "operating";
}) {
  const summary =
    surface === "dashboard" ? readout.dashboardSummary : readout.operatingSummary;

  return (
    <Card
      className="workspace-shell-panel border-[color:var(--mode-card-border)]"
      data-tenant-resource-operating-impact="true"
      data-tenant-resource-operating-surface={surface}
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={readout.blockedResourceCount > 0 ? "danger" : "info"}>
            {english ? "Resource impact" : "资源影响"}
          </Badge>
          <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-xs font-medium text-[color:var(--muted-foreground)]">
            {english ? "Read-only" : "只读"}
          </span>
        </div>
        <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
          {english
            ? "Customer resources that affect today’s judgement"
            : "影响今日判断的客户资源"}
        </CardTitle>
        <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
          {summary}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-4">
        <ResourceImpactStat
          label={english ? "Actionable" : "可用于判断"}
          value={readout.actionableResourceCount}
          note={english ? "resource-ready" : "资源就绪"}
        />
        <ResourceImpactStat
          label={english ? "Manual proof" : "人工凭证"}
          value={readout.manualProofResourceCount}
          note={english ? "no external write" : "不外部写回"}
        />
        <ResourceImpactStat
          label={english ? "Review queue" : "复核队列"}
          value={readout.reviewQueueResourceCount}
          note={english ? "downgraded" : "已降级"}
        />
        <ResourceImpactStat
          label={english ? "Blocked" : "阻断"}
          value={readout.blockedResourceCount}
          note={english ? "permission or boundary" : "权限或边界"}
        />
      </CardContent>
      {readout.impactItems.length ? (
        <CardContent className="space-y-3 pt-0">
          {readout.impactItems.slice(0, 3).map((item) => (
            <TenantResourceImpactRow key={item.resourceKey} item={item} english={english} />
          ))}
        </CardContent>
      ) : null}
      <CardContent className="flex flex-col gap-3 border-t border-[color:var(--border)] pt-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--mode-link)]" />
          <span>
            {readout.boundaryNotes[0] ??
              (english
                ? "Resource impact does not grant external execution authority."
                : "资源影响读数不会授予外部执行权限。")}
          </span>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/settings?tab=connectors">
            {english ? "Review resources" : "复核资源"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ResourceImpactStat({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3">
      <p className="text-xs text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
        {value}
      </p>
      <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">{note}</p>
    </div>
  );
}

function TenantResourceImpactRow({
  item,
  english,
}: {
  item: TenantResourceOperatingImpactItem;
  english: boolean;
}) {
  const resourceName = formatTenantResourceDisplayName(item, english);
  return (
    <div className="rounded-[22px] border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <DatabaseZap className="h-4 w-4 text-[color:var(--mode-link)]" />
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {resourceName}
            </p>
            <Badge variant={badgeVariantForSeverity(item.severity)}>
              {formatTenantResourceImpactSeverity(item.severity, english)}
            </Badge>
          </div>
          <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
            {formatTenantResourceImpactSummary(item, english)}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={item.href}>{english ? "View evidence" : "查看依据"}</Link>
        </Button>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-[color:var(--muted-foreground)] md:grid-cols-3">
        <span>
          {english ? "Decision" : "决策"}:{" "}
          {formatTenantResourceDecision(item.decision, english)}
        </span>
        <span>
          {english ? "Reason" : "原因"}:{" "}
          {formatTenantResourceReason(item.primaryReasonCode, english)}
        </span>
        <span>
          {english ? "Next" : "下一步"}:{" "}
          {formatTenantResourceNextActionMode(item.nextActionMode, english)}
        </span>
      </div>
      <details className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-[color:var(--foreground)]">
          {english ? item.evidenceDetail.ui.disclosureLabel.en : item.evidenceDetail.ui.disclosureLabel.zh}
        </summary>
        <div className="mt-3 grid gap-3 text-xs leading-6 text-[color:var(--muted-foreground)] md:grid-cols-2">
          <span>
            {english ? "Source" : "来源"}:{" "}
            {formatTenantResourceObjectType(
              item.evidenceDetail.sourceObject.sourceObjectType,
              english,
            )}{" "}
            ·{" "}
            {item.evidenceDetail.sourceObject.sourceRef}
          </span>
          <span>
            {english ? "Freshness" : "新鲜度"}:{" "}
            {formatTenantResourceEvidenceToken(
              item.evidenceDetail.timing.freshnessPosture,
              english,
            )}
          </span>
          <span>
            {english ? "Trust" : "信任"}:{" "}
            {formatTenantResourceEvidenceToken(
              item.evidenceDetail.trust.trustLevel,
              english,
            )}
          </span>
          <span>
            {english ? "Mapping" : "映射"}: {item.evidenceDetail.mapping.mappingCompleteness}% ·{" "}
            {item.evidenceDetail.conflicts.conflictCount} {english ? "conflicts" : "个冲突"}
          </span>
          <span>
            {english ? "Manual proof" : "人工凭证"}:{" "}
            {formatTenantResourceEvidenceToken(
              item.evidenceDetail.manualProof.lifecycle.status,
              english,
            )}
          </span>
          <span>
            {english ? "Field gap" : "字段缺口"}:{" "}
            {formatTenantResourceEvidenceToken(
              item.evidenceDetail.mapping.fieldGaps.summaryStatus,
              english,
            )}
          </span>
          {item.evidenceDetail.extensionAdoption ? (
            <span>
              {english ? "Extension adoption" : "扩展纳管"}:{" "}
              {formatTenantResourceEvidenceToken(
                item.evidenceDetail.extensionAdoption.overallStatus,
                english,
              )}{" "}
              ·{" "}
              {item.evidenceDetail.extensionAdoption.dependencyCount}{" "}
              {english ? "dependencies" : "个依赖"}
            </span>
          ) : null}
          <span className="md:col-span-2">
            {english ? "Why" : "原因"}:{" "}
            {formatTenantResourceDecisionWhy(item.evidenceDetail, english)}
          </span>
          {item.evidenceDetail.mapping.fieldGaps.downgradeReason ? (
            <span className="md:col-span-2">
              {english ? "Mapping downgrade" : "映射降级"}:{" "}
              {formatTenantResourceMappingDowngrade(item.evidenceDetail, english)}
            </span>
          ) : null}
          <span className="md:col-span-2">
            {english ? "Proof follow-through" : "凭证后续"}:{" "}
            {formatTenantResourceProofFollowThrough(
              item.evidenceDetail.manualProof.lifecycle,
              english,
            )}
          </span>
        </div>
        {item.evidenceDetail.extensionAdoption ? (
          <div className="mt-3 space-y-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
            <p className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-3 py-3">
              {english
                ? item.evidenceDetail.extensionAdoption.summary
                : `${item.evidenceDetail.extensionAdoption.extensionDisplayName} 已纳入当前治理循环；依赖仍保持只读与复核优先。`}
            </p>
            {item.evidenceDetail.extensionAdoption.dependencies.length ? (
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-3 py-3">
                <p className="text-xs font-semibold text-[color:var(--foreground)]">
                  {english ? "Declared dependencies" : "已声明依赖"}
                </p>
                <div className="mt-2 space-y-2">
                  {item.evidenceDetail.extensionAdoption.dependencies.map((dependency) => (
                    <p key={dependency.resourceDependencyKey}>
                      {dependency.provider} ·{" "}
                      {formatTenantResourceSourceKind("workspace_solution_extension", english)} ·{" "}
                      {formatTenantResourceEvidenceToken(dependency.adoptionStatus, english)} ·{" "}
                      {dependency.objectBindings.length}{" "}
                      {english ? "object bindings" : "个对象绑定"} ·{" "}
                      {english
                        ? dependency.nextReviewStep
                        : "继续保持复核优先，不扩大执行权限。"}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </details>
    </div>
  );
}

function badgeVariantForSeverity(severity: TenantResourceOperatingImpactSeverity) {
  if (severity === "critical") return "danger" as const;
  if (severity === "high") return "warning" as const;
  return "neutral" as const;
}
