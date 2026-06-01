"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { PageHeader } from "@/components/shared/page-header";
import { SupportSurfaceNote } from "@/components/shared/support-surface-note";
import { WorkspaceGuidancePanel } from "@/components/shared/workspace-guidance-panel";
import { WorkspaceSurfacePreferences } from "@/components/shared/workspace-surface-preferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCrmImportDisplayText,
  formatCrmImportExternalReference,
  formatCrmImportObjectType,
} from "@/features/imports/display-copy";
import { formatDateLabel, safeParseJson } from "@/lib/utils";

export function ImportJobDetailClient({
  job,
  canManageImports,
  importManagementDeniedMessage,
}: {
  job: {
    id: string;
    jobType: string;
    status: string;
    successRecords: number;
    failedRecords: number;
    warningRecords: number;
    startedAt: Date;
    finishedAt: Date | null;
    source: {
      sourceType: string;
      externalAccountLabel: string | null;
    };
    summaryJson: string | null;
    items: Array<{
      id: string;
      externalType: string;
      externalId: string;
      mappedObjectType: string | null;
      mappedObjectId: string | null;
      matchStatus: string;
      conflictStatus: string;
      warningMessage: string | null;
      errorMessage: string | null;
    }>;
  };
  canManageImports: boolean;
  importManagementDeniedMessage: string;
}) {
  const [pending, startTransition] = useTransition();
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const summary = safeParseJson<Record<string, unknown>>(job.summaryJson, {});
  const warmup = safeParseJson<Record<string, unknown>>(JSON.stringify(summary.warmup ?? {}), {});
  const reviewConflictCount = job.items.filter((item) =>
    item.conflictStatus.includes("REVIEW"),
  ).length;
  const warningItemCount = job.items.filter((item) => Boolean(item.warningMessage)).length;
  const errorItemCount = job.items.filter((item) => Boolean(item.errorMessage)).length;

  const importJobGuidanceRecommendations = [
    {
      title:
        reviewConflictCount > 0
          ? english
            ? "Resolve conflicts before trusting the imported object graph"
            : "先处理冲突，再信任导入后的对象图"
          : english
            ? "Read warmup output before rerunning imports"
            : "再次导入前先检查预热输出",
      body:
        reviewConflictCount > 0
          ? english
            ? "Identity splits are still open in this run. Review them before downstream memory and judgement surfaces become the source of truth."
            : "这轮导入里仍有身份分叉没有收口；在下游记忆和判断面变成事实来源前，先把它们复核掉。"
          : english
            ? "Use this page to verify whether the import already warmed memory, blockers, commitments and recommendations instead of immediately rerunning the job."
            : "先确认这轮导入是否已经预热记忆、阻塞、承诺和建议，而不是立刻重跑任务。",
      meta:
        reviewConflictCount > 0
          ? english
            ? `${reviewConflictCount} review conflict(s)`
            : `${reviewConflictCount} 条待复核冲突`
          : undefined,
    },
    {
      title: english
        ? "Treat this page as an inspection surface"
        : "把这页当成检查面",
      body: english
        ? "Import result exists to inspect object quality, warnings and downstream readiness. It is not a connector control plane."
        : "导入结果页的职责是检查对象质量、警告和下游就绪度，不是连接器控制面。",
    },
  ];

  const importJobGuidanceReminders = [
    {
      title: english ? "Warnings and errors need explicit follow-through" : "警告和错误需要显式处理",
      body: english
        ? "Rows with warnings or failures should feed conflict review, cleanup and rerun decisions, not stay buried inside the run summary."
        : "带警告或失败的行应该进入冲突复核、清洗和重跑决策，而不是一直埋在结果摘要里。",
      meta:
        english
          ? `${warningItemCount} warning / ${errorItemCount} error`
          : `${warningItemCount} 条 warning / ${errorItemCount} 条 error`,
    },
    {
      title: english ? "Recommendation still is not commitment" : "建议仍不等于承诺",
      body: english
        ? "Warmup output can sharpen downstream recommendations, but it does not create official writeback or autonomous execution."
        : "预热输出可以让下游建议更清楚，但不会直接生成正式回写或自动执行。",
    },
  ];

  const rerunWarmup = () => {
    startTransition(async () => {
      const response = await fetch(`/api/imports/jobs/${job.id}/warmup`, {
        method: "POST",
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        toast.error(payload.error ?? (english ? "Failed to rerun warmup" : "重新执行预热失败"));
        return;
      }
      toast.success(english ? "Warmup rerun completed" : "已重新执行预热");
      window.location.reload();
    });
  };

  return (
    <div className="workspace-surface-stack">
      <PageHeader
        eyebrow={english ? "Import result" : "导入结果"}
        title={`${job.source.sourceType} · ${job.jobType === "INITIAL_IMPORT" ? (english ? "Initial import" : "首次导入") : (english ? "Incremental sync" : "增量同步")}`}
        description={`${job.source.externalAccountLabel ?? (english ? "Unnamed source" : "未命名来源")} · ${formatDateLabel(job.startedAt)}`}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/imports/conflicts">{english ? "Open conflicts" : "查看冲突"}</Link>
            </Button>
            <Button onClick={rerunWarmup} disabled={pending || !canManageImports}>
              {english ? "Rerun warmup" : "重新执行预热"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <WorkspaceGuidancePanel
          eyebrow={english ? "Import result guidance" : "导入结果引导"}
          title={
            english
              ? "Inspect one run as evidence before you widen ingress or rerun warmup."
              : "把单次导入结果当成证据面，先检查，再决定是否扩大接入或重跑预热。"
          }
          summary={
            english
              ? "This page should tell you whether one import run produced clean objects, manageable conflicts and useful warmup output, and what the safest next move is for the downstream loop."
              : "先说明这轮导入是否产出了干净对象、可控冲突和有价值的预热输出，以及下游闭环当前最安全的下一步动作是什么。"
          }
          recommendations={importJobGuidanceRecommendations}
          reminders={importJobGuidanceReminders}
          recommendationsLabel={english ? "Recommended next moves" : "建议先处理"}
          remindersLabel={english ? "Scope reminders" : "范围提醒"}
          boundaryLabel={english ? "Boundary" : "边界"}
          boundary={
            english
              ? "Import result inspection can verify ingress quality and downstream readiness, but it does not turn a run summary into connector governance or execution authority."
              : "导入结果检查可以确认接入质量和下游就绪度，但不会把单次运行摘要直接扩成连接器治理或执行权限。"
          }
        />
        <div className="workspace-surface-stack">
          <WorkspaceSurfacePreferences />
          <Card className="workspace-form-assist workspace-panel-muted">
            <CardContent className="space-y-3 py-5">
              <p className="workspace-eyebrow">
                {english ? "Import result assist" : "导入结果辅助"}
              </p>
              <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
                {english
                  ? "Move from one run into the safest downstream review."
                  : "从单次导入结果跳到最安全的下游复核。"}
              </p>
              <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                {english
                  ? "Inspect the run first, then choose whether to review conflicts, open dashboard judgement, or rerun warmup with explicit intent."
                  : "先检查这轮结果，再明确选择是去复核冲突、看首页判断，还是带着明确意图重跑预热。"}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" asChild>
                  <Link href="/imports/conflicts">
                    {english ? "Open conflicts" : "查看冲突"}
                  </Link>
                </Button>
                <Button type="button" variant="secondary" asChild>
                  <Link href="/dashboard">
                    {english ? "Open dashboard judgement" : "查看首页判断"}
                  </Link>
                </Button>
                <Button type="button" variant="secondary" asChild>
                  <Link href="/memory">
                    {english ? "Inspect memory downstream" : "检查下游记忆"}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <SupportSurfaceNote
        label={english ? "Import result role" : "导入结果页角色"}
        title={
          english
            ? "Import result is an inspection surface, not a connector control panel"
            : "导入结果页是检查面，不是连接器控制台"
        }
        summary={
          english
            ? "Use this page to verify whether one import run produced clean objects, clear warmup output and manageable conflicts. It should lead back to memory, object pages and conflict review instead of becoming a connector platform."
            : "这页的职责是确认某一次导入是否产出了干净对象、清楚预热和可控冲突；它应把人送回记忆、对象页和冲突处理，而不是演变成连接器平台。"
        }
        items={[
          {
            label: english ? "Current role" : "当前职责",
            value: english
              ? "Inspect one import run, its warmup output and item-level mapping quality."
              : "检查单次导入、预热输出，以及逐项映射质量。",
          },
          {
            label: english ? "Not for" : "不负责什么",
            value: english
              ? "Connector settings, workflow execution, or broader governance control."
              : "连接器设置、流程执行或更大的治理控制。",
          },
          {
            label: english ? "Best next move" : "最合适下一步",
            value: english
              ? "After inspection, move to conflicts, memory or object surfaces to verify the downstream loop."
              : "检查后继续去 conflicts、经营记忆或对象页确认下游闭环是否成立。",
          },
        ]}
      />

      {!canManageImports ? (
        <SupportSurfaceNote
          label={english ? "Warmup posture" : "预热权限状态"}
          title={
            english
              ? "Warmup rerun stays blocked for the current workspace role"
              : "当前工作区角色不能重新执行预热"
          }
          summary={importManagementDeniedMessage}
          items={[
            {
              label: english ? "Still available" : "仍可进行",
              value: english
                ? "Inspect imported objects, warmup output, and downstream gaps."
                : "检查导入对象、预热输出和下游缺口。",
            },
            {
              label: english ? "Blocked here" : "当前被拦截",
              value: english
                ? "Re-running warmup and import-side writeback."
                : "重新执行预热和导入侧写回。",
            },
          ]}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
            <CardHeader>
            <CardTitle>{english ? "Import overview" : "导入总览"}</CardTitle>
            <CardDescription>{english ? "What landed." : "落下来了什么。"}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Metric label={english ? "Status" : "状态"} value={formatCrmImportDisplayText(job.status, english)} />
            <Metric label={english ? "Successful records" : "成功记录"} value={english ? `${job.successRecords}` : `${job.successRecords} 条`} />
            <Metric label={english ? "Failed records" : "失败记录"} value={english ? `${job.failedRecords}` : `${job.failedRecords} 条`} />
            <Metric label={english ? "Warnings" : "警告记录"} value={english ? `${job.warningRecords}` : `${job.warningRecords} 条`} />
            <Metric label={english ? "Started at" : "开始时间"} value={formatDateLabel(job.startedAt)} />
            <Metric label={english ? "Finished at" : "完成时间"} value={job.finishedAt ? formatDateLabel(job.finishedAt) : (english ? "Still running" : "仍在执行")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{english ? "Post-import warmup" : "导入后价值预热"}</CardTitle>
            <CardDescription>{english ? "Memory, suggestions and today's focus that came out of this import." : "由这次导入产生的记忆、建议和今日焦点。"}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Metric label={english ? "Imported contacts" : "导入联系人"} value={english ? `${Number((summary.importedCounts as Record<string, unknown> | undefined)?.contacts ?? 0)}` : `${Number((summary.importedCounts as Record<string, unknown> | undefined)?.contacts ?? 0)} 条`} />
            <Metric label={english ? "Imported companies" : "导入公司"} value={english ? `${Number((summary.importedCounts as Record<string, unknown> | undefined)?.companies ?? 0)}` : `${Number((summary.importedCounts as Record<string, unknown> | undefined)?.companies ?? 0)} 条`} />
            <Metric label={english ? "Imported opportunities" : "导入机会"} value={english ? `${Number((summary.importedCounts as Record<string, unknown> | undefined)?.opportunities ?? 0)}` : `${Number((summary.importedCounts as Record<string, unknown> | undefined)?.opportunities ?? 0)} 条`} />
            <Metric label={english ? "Imported meetings" : "导入会议"} value={english ? `${Number((summary.importedCounts as Record<string, unknown> | undefined)?.meetings ?? 0)}` : `${Number((summary.importedCounts as Record<string, unknown> | undefined)?.meetings ?? 0)} 条`} />
            <Metric label={english ? "Detected blockers" : "识别阻塞"} value={english ? `${Number(warmup.detectedBlockers ?? 0)}` : `${Number(warmup.detectedBlockers ?? 0)} 条`} />
            <Metric label={english ? "Detected commitments" : "识别承诺"} value={english ? `${Number(warmup.detectedCommitments ?? 0)}` : `${Number(warmup.detectedCommitments ?? 0)} 条`} />
            <Metric label={english ? "Refreshed objects" : "刷新对象"} value={english ? `${Number(warmup.refreshedObjects ?? 0)}` : `${Number(warmup.refreshedObjects ?? 0)} 个`} />
            <Metric label={english ? "Generated recommendations" : "生成建议"} value={english ? `${Number(warmup.generatedRecommendations ?? 0)}` : `${Number(warmup.generatedRecommendations ?? 0)} 条`} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
        <CardTitle>{english ? "Import items" : "导入明细"}</CardTitle>
          <CardDescription>{english ? "Per-row mapping, conflicts and errors." : "每行的映射、冲突、错误。"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {job.items.map((item) => (
            <div key={item.id} className="theme-surface-panel rounded-[18px] px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-[color:var(--foreground)]">
                    {formatCrmImportObjectType(item.externalType, english)} ·{" "}
                    {formatCrmImportExternalReference(
                      item.externalId,
                      english,
                    )}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {item.mappedObjectType
                      ? english
                        ? `${formatCrmImportObjectType(
                            item.mappedObjectType,
                            english,
                          )} → ${item.mappedObjectId}`
                        : `已映射到：${formatCrmImportObjectType(
                            item.mappedObjectType,
                            english,
                          )}`
                      : english
                        ? "Not mapped to a Helm object yet"
                        : "当前尚未映射到 Helm 对象"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={item.conflictStatus.includes("REVIEW") ? "warning" : "info"}>
                    {formatCrmImportDisplayText(item.matchStatus, english)}
                  </Badge>
                  <Badge variant={item.conflictStatus.includes("REVIEW") ? "warning" : "neutral"}>
                    {formatCrmImportDisplayText(item.conflictStatus, english)}
                  </Badge>
                </div>
              </div>
              {item.warningMessage ? <p className="mt-3 text-sm text-[color:var(--status-warning-text)]">{item.warningMessage}</p> : null}
              {item.errorMessage ? <p className="mt-3 text-sm text-[color:var(--status-danger-text)]">{item.errorMessage}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="theme-surface-panel-soft rounded-[16px] px-4 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}
