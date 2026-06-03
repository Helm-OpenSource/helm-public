"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SupportSurfaceNote } from "@/components/shared/support-surface-note";
import { WorkspaceGuidancePanel } from "@/components/shared/workspace-guidance-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCrmImportExternalReference,
  formatCrmImportObjectType,
} from "@/features/imports/display-copy";
import { formatDateLabel } from "@/lib/utils";

export function ImportConflictsClient({
  conflicts,
  canResolveConflicts,
  conflictResolutionDeniedMessage,
}: {
  conflicts: Array<{
    id: string;
    externalType: string;
    externalId: string;
    internalObjectType: string | null;
    internalObjectId: string | null;
    matchScore: number;
    matchReason: string | null;
    createdAt: Date;
  }>;
  canResolveConflicts: boolean;
  conflictResolutionDeniedMessage: string;
}) {
  const [pending, startTransition] = useTransition();
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const topConflict = conflicts[0];

  const conflictGuidanceRecommendations = [
    {
      title:
        conflicts.length > 0
          ? english
            ? "Resolve the highest-score identity split first"
            : "优先处理评分最高的身份分叉"
          : english
            ? "Return to CRM imports after the queue clears"
            : "冲突清空后回到客户关系系统导入面",
      body:
        conflicts.length > 0
          ? english
            ? "One wrong link can pollute downstream memory and object state. Start with the strongest candidate instead of scanning the queue randomly."
            : "一次错误链接就会污染下游记忆和对象状态。先处理置信度最高、影响最大的那条，不要随机扫列表。"
          : english
            ? "No conflicts are waiting now. The next step is to inspect the latest import result or continue CRM ingress."
            : "当前没有待处理冲突，下一步应该回到最近的导入结果或继续客户关系系统接入。",
      meta:
        topConflict
          ? english
            ? `Top score ${topConflict.matchScore}`
            : `最高评分 ${topConflict.matchScore}`
          : undefined,
    },
    {
      title: english
        ? "Keep this page in a manual review posture"
        : "让这页保持人工复核",
      body: english
        ? "Conflict resolution is where a human decides object identity. Do not turn it into a connector settings screen or broad governance center."
        : "冲突处理页的职责是让人判断对象身份，不要把它扩成连接器设置页或更大的治理中心。",
    },
  ];

  const conflictGuidanceReminders = [
    {
      title: english ? "Link, create new, or ignore only" : "这里只做链接、新建或忽略",
      body: english
        ? "The action set stays intentionally narrow so resolution remains auditable and reversible."
        : "动作集合故意保持窄，确保整个处理过程可审计、可回看、可恢复。",
    },
    {
      title: english ? "Recommendation still is not commitment" : "判断建议不等于承诺",
      body: english
        ? "Resolving an identity conflict improves object truth, but it still does not grant external commitment or autonomous execution."
        : "处理身份冲突只是修正对象真值，不会直接产生外部承诺或自动执行。",
    },
  ];

  const resolve = (id: string, resolution: "LINK" | "CREATE_NEW" | "IGNORE") => {
    startTransition(async () => {
      const response = await fetch(`/api/imports/conflicts/${id}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resolution }),
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        toast.error(payload.error ?? (english ? "Conflict resolution failed" : "冲突处理失败"));
        return;
      }

      toast.success(english ? "Conflict resolution saved" : "冲突处理已保存");
      window.location.reload();
    });
  };

  return (
    <div className="workspace-surface-stack">
      <PageHeader
        eyebrow={english ? "Conflict resolution" : "冲突处理"}
        title={english ? "Low-confidence matches to review" : "需要复核的匹配"}
        description={english ? "Link, keep separate, or ignore — one per row." : "合并、保留或忽略——每行选一个。"}
        actions={
          <Button variant="secondary" asChild>
            <Link href="/imports/crm">{english ? "Back to CRM imports" : "返回客户关系系统导入"}</Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <WorkspaceGuidancePanel
          eyebrow={english ? "Identity review" : "身份复核"}
          title={
            english
              ? "Start with the identity split most likely to pollute customer truth."
              : "先处理最可能污染客户真值的身份分叉。"
          }
          summary={
            english
              ? "A wrong merge changes contacts, accounts and opportunities downstream. Clear the biggest split first."
              : "一次误合并会影响联系人、客户和机会，先清掉影响最大的分叉。"
          }
          recommendations={conflictGuidanceRecommendations}
          reminders={conflictGuidanceReminders}
          recommendationsLabel={english ? "Recommended next moves" : "建议先处理"}
          remindersLabel={english ? "Scope reminders" : "范围提醒"}
          boundaryLabel={english ? "Boundary" : "边界"}
          boundary={
            english
              ? "Conflict review can protect object identity and prevent bad merges, but it does not expand connector admin, export governance, or execution authority."
              : "冲突复核可以保护对象身份、阻止错误合并，但不会扩展连接器管理、导出治理或执行权限。"
          }
        />
        <div className="workspace-surface-stack">
          <Card className="workspace-form-assist workspace-panel-muted">
            <CardContent className="space-y-3 py-5">
              <p className="workspace-eyebrow">
                {english ? "Next conflict action" : "下一步冲突动作"}
              </p>
              <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
                {english
                  ? "Clear one high-impact identity split before importing more."
                  : "先清掉一条高影响身份分叉，再继续导入。"}
              </p>
              <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                {english
                  ? "Use the links to return to the import result or the downstream customer pages after review."
                  : "复核后回到导入结果或下游客户页面继续处理。"}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" asChild>
                  <Link href="/imports/crm">
                    {english ? "Back to CRM imports" : "返回客户关系系统导入"}
                  </Link>
                </Button>
                <Button type="button" variant="secondary" asChild>
                  <Link href="/imports">
                    {english ? "Open import workspace" : "打开导入总览"}
                  </Link>
                </Button>
                <Button type="button" variant="secondary" asChild>
                  <Link href="/dashboard">
                    {english ? "Open dashboard judgement" : "查看首页判断"}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <SupportSurfaceNote
        label={english ? "Conflict note" : "冲突附注"}
        title={
          english
            ? "Resolve identity first, then return to the customer record"
              : "先处理身份，再回到客户记录"
        }
        summary={
          english
            ? "Low-confidence matches stop here so customer records do not fork or merge incorrectly."
              : "低置信度匹配先停在这里，避免客户记录分叉或误合并。"
        }
        items={[
          {
            label: english ? "Current role" : "当前职责",
            value: english
              ? "Review object-identity conflicts one item at a time."
              : "逐条复核对象身份冲突。",
          },
          {
            label: english ? "Not for" : "不负责什么",
            value: english
              ? "Connector admin, export governance, or workflow control."
              : "连接器管理、导出治理或流程控制权。",
          },
          {
            label: english ? "Best next move" : "最合适下一步",
            value: english
              ? "Resolve the highest-impact conflicts, then return to CRM imports or the latest import result."
              : "先处理影响最大的冲突，再回到客户关系系统导入或最近一次导入结果。",
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>{english ? "Pending conflicts" : "待处理冲突"}</CardTitle>
          <CardDescription>{english ? "Highest-impact conflicts first." : "影响最大的排在前面。"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {conflicts.length ? conflicts.map((conflict) => (
            <div key={conflict.id} className="theme-surface-panel rounded-[18px] px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-[color:var(--foreground)]">
                    {formatCrmImportObjectType(conflict.externalType, english)}{" "}
                    ·{" "}
                    {formatCrmImportExternalReference(
                      conflict.externalId,
                      english,
                    )}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">{conflict.matchReason ?? (english ? "No conflict reason recorded yet" : "当前未记录冲突原因")}</p>
                  <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                    {english ? "Candidate object:" : "候选对象："}
                    {formatCrmImportObjectType(
                      conflict.internalObjectType,
                      english,
                    )}
                    {conflict.internalObjectId
                      ? english
                        ? ` · ${conflict.internalObjectId}`
                        : ""
                      : ""}{" "}
                    · {formatDateLabel(conflict.createdAt)}
                  </p>
                </div>
                <Badge variant="warning">{english ? "Score" : "评分"} {conflict.matchScore}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => resolve(conflict.id, "LINK")}
                  disabled={pending || !conflict.internalObjectId || !canResolveConflicts}
                >
                  {english ? "Link existing object" : "链接现有对象"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => resolve(conflict.id, "CREATE_NEW")}
                  disabled={pending || !canResolveConflicts}
                >
                  {english ? "Keep as new object" : "保留为新对象"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => resolve(conflict.id, "IGNORE")}
                  disabled={pending || !canResolveConflicts}
                >
                  {english ? "Ignore for now" : "先忽略"}
                </Button>
              </div>
              {!canResolveConflicts ? (
                <p className="mt-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
                  {conflictResolutionDeniedMessage}
                </p>
              ) : null}
            </div>
          )) : (
            <EmptyState
              title={english ? "No pending conflicts" : "当前没有待处理冲突"}
              description={english ? "Recent imports landed clean — or you've already handled everything." : "最近导入挺干净——或者你都处理完了。"}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
