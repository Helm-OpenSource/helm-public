"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImportSourceType } from "@prisma/client";
import { Building2, Cable, RefreshCcw, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceFormAssistPanel } from "@/components/shared/workspace-form-assist-panel";
import { WorkspaceGuidancePanel } from "@/components/shared/workspace-guidance-panel";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { ObjectContextOperatingSummary } from "@/components/shared/object-context-operating-summary";
import { PageHeader } from "@/components/shared/page-header";
import { SupportSurfaceNote } from "@/components/shared/support-surface-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { connectMockCrmSourceAction, disconnectCrmSourceAction } from "@/features/imports/crm-actions";
import { formatCrmImportDisplayText } from "@/features/imports/display-copy";
import { formatImportDateLabel } from "@/features/imports/import-date-labels";
import { formatDateLabel, safeParseJson } from "@/lib/utils";

type SourceCard = {
  id: string;
  sourceType: ImportSourceType;
  sourceName: string;
  status: string;
  authMode: string | null;
  externalAccountLabel: string | null;
  lastSyncedAt: Date | null;
};

type JobSummary = {
  id: string;
  jobType: string;
  status: string;
  successRecords: number;
  failedRecords: number;
  warningRecords: number;
  startedAt: Date;
  source: {
    id: string;
    sourceType: string;
    externalAccountLabel: string | null;
  };
  summaryJson: string | null;
};

const providerCopy = {
  HUBSPOT: {
    label: "HubSpot",
    description: "优先导入联系人、公司、交易、记录和关联关系，先建立对象关系和会后推进信号。",
    color: "info" as const,
  },
  SALESFORCE: {
    label: "Salesforce",
    description: "优先导入公司、联系人、机会、任务和活动，把客户层与活动层一起接进来。",
    color: "warning" as const,
  },
};

type PreviewState = {
  sourceId: string;
  preview: {
    accountLabel: string;
    objectCounts: Record<string, number>;
    usedMock: boolean;
  };
};

type CrmSummaryConnection = {
  label: string;
  value: string;
  description?: string;
  href?: string;
};

const isDefined = <T,>(value: T | undefined): value is T => value !== undefined;

export function CrmImportClient({
  data,
  config,
  capability,
  connectorState,
}: {
  data: {
    sources: SourceCard[];
    jobs: JobSummary[];
    openConflicts: number;
    summary: {
      totalJobs: number;
      successRecords: number;
      failedRecords: number;
      warningRecords: number;
    };
    latestWarmup: Record<string, unknown> | null;
  };
  config: {
    hubspotReady: boolean;
    salesforceReady: boolean;
  };
  capability: {
    canManageConnectors: boolean;
    canManageImports: boolean;
    canResolveImportConflicts: boolean;
    connectorManagementDeniedMessage: string;
    importManagementDeniedMessage: string;
    importConflictResolutionDeniedMessage: string;
  };
  connectorState: {
    provider?: string;
    status?: string;
    message?: string;
    sourceId?: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const { messages, locale } = useWorkspaceUi();
  const english = locale === "en-US";

  const latestWarmup = data.latestWarmup;
  const latestJob = data.jobs[0] ?? null;
  const activePreview = previewState?.preview ?? null;
  const connectedSourceCount = data.sources.filter(
    (item) => item.status === "CONNECTED",
  ).length;
  const crmOperatingTitle =
    connectedSourceCount > 0
      ? english
        ? "CRM ingress is already shaping which objects, conflicts and warmup outputs matter now."
        : "客户关系系统导入已经开始决定现在哪些对象、冲突和预热结果最值得先看。"
      : english
        ? "Connect the first CRM source so object links, activity history and import pressure can enter Helm together."
        : "先接入第一个客户关系系统来源，把对象关系、活动历史和导入压力一起带进 Helm。";
  const crmOperatingSummary =
    connectedSourceCount > 0
      ? openConflictSummary(data.openConflicts, english)
      : english
        ? "This page stays read-only and ingress-first until at least one CRM source is connected."
        : "在至少接入一个客户关系系统来源之前，这一页都应保持只读和入口优先。";
  const crmOperatingItems = [
    {
      label: english ? "Current ingress focus" : "当前入口焦点",
      value:
        connectedSourceCount > 0
          ? english
            ? "Check which connected source, import result and warmup output should be reviewed first."
            : "先看哪一个已接入来源、哪次导入结果和哪一条预热输出最值得先复核。"
          : english
            ? "Connect the first CRM source."
            : "先接入第一个客户关系系统来源。",
    },
    {
      label: english ? "Object-state impact" : "对象层影响",
      value:
        latestWarmup
          ? english
            ? `${Number((latestWarmup.warmup as Record<string, unknown> | undefined)?.refreshedObjects ?? 0)} refreshed objects · ${Number(latestWarmup.generatedMeetingNotes ?? 0)} meeting/note outputs`
            : `${Number((latestWarmup.warmup as Record<string, unknown> | undefined)?.refreshedObjects ?? 0)} 个刷新对象 · ${Number(latestWarmup.generatedMeetingNotes ?? 0)} 条会议/笔记输出`
          : english
            ? "Object-state warmup is not visible yet."
            : "当前还没有可见的对象层预热结果。",
    },
    {
      label: english ? "Single next step" : "最重要下一步",
      value:
        connectedSourceCount === 0
          ? english
            ? "Connect HubSpot or Salesforce first."
            : "先接入 HubSpot 或 Salesforce。"
          : data.openConflicts > 0
            ? english
              ? "Resolve import conflicts before widening usage."
              : "先处理导入冲突，再继续扩大使用。"
            : latestWarmup
              ? english
              ? "Open the latest import result and verify warmup output."
                : "打开最新导入结果页，确认预热输出是否可信。"
              : english
                ? "Run preview first, then start the initial import."
                : "先做导入预览，再执行首次导入。",
    },
    {
      label: english ? "Boundary posture" : "当前边界姿态",
      value:
        data.openConflicts > 0
          ? english
            ? "Imported conflicts still require manual review."
            : "当前导入冲突仍然需要人工复核。"
          : english
            ? "This page remains read-only ingress. It does not send, schedule or execute external actions."
            : "这页仍然是只读入口，不会发送、排期或执行外部动作。",
    },
  ];
  const crmOperatingConnectionCandidates: Array<CrmSummaryConnection | undefined> = [
    data.sources[0]
      ? {
          label: english ? "Primary source" : "当前主来源",
          value: data.sources[0].sourceName,
          description: english
            ? `${data.sources[0].sourceType} · ${data.sources[0].status}`
            : `${data.sources[0].sourceName} · ${formatCrmImportDisplayText(
                data.sources[0].status,
                english,
              )}`,
        }
      : undefined,
    data.openConflicts > 0
      ? {
          label: english ? "Conflict queue" : "冲突队列",
          value: english
            ? `${data.openConflicts} open conflicts`
            : `${data.openConflicts} 条待处理冲突`,
          description: english
            ? "Resolve identity and object conflicts before trusting downstream warmup."
            : "先处理身份和对象冲突，再信任下游预热与对象状态。",
          href: "/imports/conflicts",
        }
      : undefined,
    latestJob
      ? {
          label: english ? "Latest import run" : "最近导入结果",
          value: latestJob.id,
          description: english
            ? `${latestJob.successRecords} success · ${latestJob.failedRecords} failed`
            : `${latestJob.successRecords} 条成功 · ${latestJob.failedRecords} 条失败`,
          href: `/imports/jobs/${latestJob.id}`,
        }
      : undefined,
    latestWarmup
      ? {
          label: english ? "Warmup writeback" : "预热写回",
          value: english
            ? `${Number(latestWarmup.generatedMeetingNotes ?? 0)} meeting/note outputs`
            : `${Number(latestWarmup.generatedMeetingNotes ?? 0)} 条会议/笔记输出`,
          description: english
            ? "Open memory to verify that ingress is grounding writeback instead of creating detached context."
            : "去经营记忆确认入口是否真的在为写回提供来源依据，而不是制造悬空上下文。",
          href: "/memory",
        }
      : {
          label: english ? "Downstream objects" : "下游对象面",
          value: english ? "Open imported objects" : "查看导入后的对象",
          description: english
            ? "Check the imported opportunities and contacts."
            : "看一眼导入的机会和联系人。",
          href: "/opportunities",
        },
  ];
  const crmOperatingConnections =
    crmOperatingConnectionCandidates.filter(isDefined);
  const primaryConnectedSource =
    data.sources.find((item) => item.status === "CONNECTED") ?? null;
  const crmGuidanceRecommendations = [
    {
      title: english ? "Stabilize one ingress loop first" : "先稳定一条入口回路",
      body:
        connectedSourceCount === 0
          ? english
            ? "Connect one CRM source first so object graph, activity history and warmup output enter Helm together."
            : "先接入一个客户关系系统来源，让对象关系、活动历史和预热输出一起进入 Helm。"
          : english
            ? "Keep the first connected source narrow, then validate preview, import result and warmup before widening the ingress set."
            : "先把已连接的第一个来源跑通，再验证预览、导入结果和预热，之后再扩大入口集合。",
    },
    {
      title: english ? "Review conflicts before trusting downstream objects" : "先处理冲突，再信任下游对象",
      body: data.openConflicts > 0
        ? english
          ? `${data.openConflicts} conflicts still need manual review. Object-state warmup should stay review-first until they are resolved.`
          : `还有 ${data.openConflicts} 条冲突待人工处理；在清掉之前，对象层预热应继续保持先复核。`
        : english
          ? "No open conflicts are blocking this ingress path now."
          : "当前没有打开的冲突阻塞这条入口路径。",
    },
    {
      title: english ? "Use assist to preserve operator order" : "用辅助层守住操作顺序",
      body: english
        ? "The highest-value assist here is to keep connect → preview → import → warmup in one visible order."
        : "这里最有价值的辅助，是把连接、预览、导入、预热收成一条可见顺序。",
    },
  ];
  const crmGuidanceReminders = [
    {
      title: english ? "Current boundary" : "当前边界",
      body: english
        ? "This page remains read-only ingress. It does not send, schedule or execute external actions."
        : "这页继续保持只读入口，不会发送、排期或执行外部动作。",
    },
    {
      title: english ? "Warmup posture" : "预热姿态",
      body: latestWarmup
        ? english
          ? "Warmup already produced downstream objects, but operators still decide whether those outputs are trustworthy."
          : "预热已经生成下游对象，但这些结果是否可信仍由操作人判断。"
        : english
          ? "Warmup is still missing, so preview and initial import remain the narrow next step."
          : "当前还没有预热结果，所以最窄的下一步仍是预览和首次导入。",
    },
  ];
  const connectorMessageTone =
    connectorState.status === "connected"
      ? "border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)]/80 text-[color:var(--status-success-text)]"
      : connectorState.status
        ? "border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)]/80 text-[color:var(--status-warning-text)]"
        : "";

  const runPreview = (sourceId: string) => {
    startTransition(async () => {
      const response = await fetch("/api/imports/crm/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sourceId }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        preview?: {
          accountLabel: string;
          objectCounts: Record<string, number>;
          usedMock: boolean;
        };
      };

      if (!payload.ok || !payload.preview) {
        toast.error(payload.error ?? (english ? "Preview failed" : "预览失败"));
        return;
      }

      setPreviewState({
        sourceId,
        preview: payload.preview,
      });
      toast.success(english ? "CRM preview generated" : "已生成客户关系系统导入预览");
    });
  };

  const runImport = (sourceId: string, incremental = false) => {
    startTransition(async () => {
      const response = await fetch(incremental ? "/api/imports/crm/sync" : "/api/imports/crm/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sourceId, incremental }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        result?: { jobId: string };
      };

      if (!payload.ok || !payload.result) {
        toast.error(payload.error ?? (incremental ? (english ? "Incremental sync failed" : "增量同步失败") : (english ? "Initial import failed" : "首次导入失败")));
        return;
      }

      toast.success(incremental ? (english ? "CRM incremental sync completed" : "客户关系系统增量同步已完成") : (english ? "CRM initial import completed" : "客户关系系统首次导入已完成"));
      router.push(`/imports/jobs/${payload.result.jobId}`);
      router.refresh();
    });
  };

  const connectMock = (sourceType: "HUBSPOT" | "SALESFORCE") => {
    startTransition(async () => {
      const result = await connectMockCrmSourceAction(sourceType);
      if (!result.ok) {
        toast.error(english ? "Failed to connect demo workspace" : "示例工作区接入失败");
        return;
      }
      toast.success(english ? `${providerCopy[sourceType].label} demo workspace connected` : `${providerCopy[sourceType].label} 示例工作区已接入`);
      router.refresh();
    });
  };

  const crmAssistActions = [
    connectedSourceCount === 0
      ? {
          label: english ? "Connect HubSpot demo source" : "接入 HubSpot 示例源",
          onClick: () => connectMock("HUBSPOT"),
          disabled: pending || !capability.canManageConnectors,
        }
      : null,
    primaryConnectedSource
      ? {
          label: english ? "Preview current primary source" : "预览当前主来源",
          onClick: () => runPreview(primaryConnectedSource.id),
          disabled: pending || !capability.canManageImports,
        }
      : null,
    data.openConflicts > 0
      ? {
          label: english ? "Open conflict queue" : "打开冲突队列",
          onClick: () => router.push("/imports/conflicts"),
          disabled: false,
        }
      : latestJob
        ? {
            label: english ? "Open latest import result" : "查看最近导入结果",
            onClick: () => router.push(`/imports/jobs/${latestJob.id}`),
            disabled: false,
          }
        : null,
  ].filter((action): action is NonNullable<typeof action> => action !== null);

  const disconnectSource = (sourceId: string) => {
    startTransition(async () => {
      const result = await disconnectCrmSourceAction(sourceId);
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Disconnect failed" : "断开失败"));
        return;
      }
      toast.success(english ? "CRM source disconnected" : "已断开客户关系系统连接");
      router.refresh();
    });
  };

  const cards = useMemo(() => {
    return (["HUBSPOT", "SALESFORCE"] as const).map((provider) => {
      const source = data.sources.find((item) => item.sourceType === provider) ?? null;
      return {
        provider,
        source,
        oauthReady: provider === "HUBSPOT" ? config.hubspotReady : config.salesforceReady,
      };
    });
  }, [config.hubspotReady, config.salesforceReady, data.sources]);

  return (
    <div className="workspace-surface-stack">
      <PageHeader
        eyebrow={messages.crm.eyebrow}
        title={messages.crm.title}
        description={messages.crm.description}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/imports/conflicts">
                <ShieldAlert className="h-4 w-4" />
                {english ? "Resolve conflicts" : "处理冲突"}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/imports">
                <Cable className="h-4 w-4" />
                {english ? "All import entrypoints" : "查看全部导入入口"}
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_340px]">
        <WorkspaceGuidancePanel
          eyebrow={english ? "Customer ingress" : "客户接入状态"}
          title={
            english
              ? "Check source, conflicts, import result and warmup before widening coverage."
              : "先看来源、冲突、导入结果和预热，再扩大接入。"
          }
          summary={
            english
              ? "A clean import should quickly expose contacts, accounts, opportunities, blockers and commitments."
              : "一次干净接入，应该尽快露出联系人、客户、机会、阻塞和承诺。"
          }
          recommendations={crmGuidanceRecommendations}
          reminders={crmGuidanceReminders}
          boundary={
            english
              ? "CRM ingress remains review-first and read-only. It is not a connector admin plane or an execution surface."
              : "客户关系系统入口继续保持先复核和只读；它不是连接器管理面，也不是执行面。"
          }
          recommendationsLabel={english ? "Recommended next moves" : "建议先处理"}
          remindersLabel={english ? "Context reminders" : "上下文提醒"}
          boundaryLabel={english ? "Boundary" : "边界"}
        />
        <div className="workspace-surface-stack">
          <WorkspaceFormAssistPanel
            eyebrow={english ? "Next import move" : "下一步接入动作"}
            title={
              english
                ? "Keep the order: connect, preview, import, then review the customer facts."
                : "按连接、预览、导入、复核客户事实的顺序来。"
            }
            summary={
              english
                ? "The next move stays narrow: finish one source, inspect conflicts, then trust the downstream customer pages."
                : "下一步保持收窄：先完成一个来源，检查冲突，再信任下游客户页面。"
            }
            bullets={[
              english
                ? `${connectedSourceCount} connected sources · ${data.summary.totalJobs} import runs · ${data.openConflicts} open conflicts`
                : `${connectedSourceCount} 个已连接来源 · ${data.summary.totalJobs} 次导入 · ${data.openConflicts} 条冲突`,
              latestWarmup
                ? english
                  ? "Warmup output is visible. Verify it before widening operator trust."
                  : "预热已可见；先验证它，再扩大操作信任。"
                : english
                  ? "Warmup is missing. Keep the next move inside preview and initial import."
                  : "当前还没有预热；下一步继续收窄在预览和首次导入里。",
              english
                ? "Assist stays recommendation-first and never auto-runs a connector flow."
                : formatCrmImportDisplayText("辅助层继续保持建议优先，不会自动执行连接器流程。", english),
            ]}
            actions={crmAssistActions}
            boundary={
              english
                ? "Form assist can highlight the next connector action, but final operator review still controls every ingress write."
                : formatCrmImportDisplayText("辅助层可以突出下一步连接器动作，但每次入站写入仍由操作人最后确认。", english)
            }
          />
        </div>
      </div>

      <Card className="workspace-panel-muted">
        <CardContent className="grid gap-4 py-5 xl:grid-cols-[1.2fr_repeat(4,minmax(0,0.85fr))]">
          <div className="space-y-2">
            <Badge variant="info">{messages.crm.intelligenceLayer}</Badge>
            <p className="text-lg font-semibold text-[color:var(--foreground)]">
            {english
              ? "Import the CRM object graph first so follow-up gaps, blockers and priority drift surface immediately."
              : "先把客户关系系统里的对象层和关系层接进来，再让会后断链、推进断链和判断断链立刻暴露出来。"}
            </p>
          </div>
          <Metric label={messages.crm.connectedCrmSources} value={english ? `${data.sources.filter((item) => item.status === "CONNECTED").length}` : `${data.sources.filter((item) => item.status === "CONNECTED").length} 个`} />
          <Metric label={messages.crm.importHistory} value={english ? `${data.summary.totalJobs}` : `${data.summary.totalJobs} 次`} />
          <Metric label={messages.crm.openConflicts} value={english ? `${data.openConflicts}` : `${data.openConflicts} 条`} />
          <Metric label={messages.crm.recentSuccessRecords} value={english ? `${data.summary.successRecords}` : `${data.summary.successRecords} 条`} />
        </CardContent>
      </Card>

      <ObjectContextOperatingSummary
        label={english ? "CRM operating summary" : "客户关系系统操作摘要"}
        title={crmOperatingTitle}
        summary={crmOperatingSummary}
        items={crmOperatingItems}
        connectionsLabel={english ? "Connected loop" : "关联对象与回路"}
        connections={crmOperatingConnections}
      />

      {(!capability.canManageConnectors || !capability.canManageImports) ? (
        <SupportSurfaceNote
          label={english ? "Ingress capability posture" : "入口权限姿态"}
          title={
            english
              ? "CRM ingress stays reviewable, but write actions are narrowed for this role"
              : "客户关系系统入口仍可复核，但当前角色的写动作已被收窄"
          }
          summary={
            !capability.canManageConnectors && !capability.canManageImports
              ? `${capability.connectorManagementDeniedMessage} ${capability.importManagementDeniedMessage}`
              : !capability.canManageConnectors
                ? capability.connectorManagementDeniedMessage
                : capability.importManagementDeniedMessage
          }
          items={[
            {
              label: english ? "Connector posture" : "连接器姿态",
              value: capability.canManageConnectors
                ? english
                  ? "Connect and disconnect actions remain available."
                  : "连接与断开动作仍可用。"
                : capability.connectorManagementDeniedMessage,
            },
            {
              label: english ? "Import posture" : "导入姿态",
            value: capability.canManageImports
              ? english
                ? "Preview, initial import, sync, and warmup remain available."
                  : "预览、首次导入、增量同步和预热仍可用。"
                : capability.importManagementDeniedMessage,
            },
            {
              label: english ? "Conflict posture" : "冲突姿态",
              value: capability.canResolveImportConflicts
                ? english
                  ? "Conflict review remains available."
                  : "冲突复核仍可用。"
                : capability.importConflictResolutionDeniedMessage,
            },
          ]}
        />
      ) : null}

      {connectorState.status ? (
        <Card className={connectorMessageTone}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <div>
              <p className="font-semibold">
                {connectorState.provider === "hubspot"
                  ? "HubSpot"
                  : connectorState.provider === "salesforce"
                    ? "Salesforce"
                    : "CRM"}{" "}
                {connectorState.status === "connected" ? (english ? "connected" : "连接成功") : (english ? "status updated" : "连接状态更新")}
              </p>
              <p className="mt-1 opacity-80">
                {connectorState.message ??
                  (connectorState.status === "connected"
                    ? (english ? "You can preview the import first and then run the initial import." : "你现在可以先做导入预览，再执行首次导入。")
                    : (english ? "Check OAuth or connector configuration and try again." : "请检查 OAuth 或连接配置后重试。"))}
              </p>
            </div>
            {connectorState.sourceId ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => runPreview(connectorState.sourceId!)}
                disabled={pending || !capability.canManageImports}
              >
                {messages.crm.directPreview}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {cards.map(({ provider, source, oauthReady }) => (
          <Card key={provider} className="border-[color:var(--border)] dark:border-white/10">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <Badge variant={providerCopy[provider].color}>{providerCopy[provider].label}</Badge>
                  <CardTitle>{providerCopy[provider].label} {english ? "connection wizard" : "连接向导"}</CardTitle>
                  <CardDescription>
                    {english
                      ? provider === "HUBSPOT"
                        ? "Pulls contacts, companies, deals, notes and associations."
                        : "Pulls Accounts, Contacts, Opportunities, Tasks and Events."
                      : providerCopy[provider].description}
                  </CardDescription>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => source ? disconnectSource(source.id) : undefined}
                  disabled={!source || pending || !capability.canManageConnectors}
                >
                  {messages.crm.disconnect}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-[20px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_82%,var(--surface)_18%)] p-4 text-sm text-[color:var(--muted)] sm:grid-cols-2">
                <Info
                  label={english ? "Connection status" : "连接状态"}
                  value={
                    source?.status
                      ? formatCrmImportDisplayText(source.status, english)
                      : english
                        ? "Not connected"
                        : "未连接"
                  }
                />
                <Info
                  label={english ? "Auth mode" : "认证方式"}
                  value={
                    source?.authMode
                      ? formatCrmImportDisplayText(source.authMode, english)
                      : english
                        ? "Not configured"
                        : "未配置"
                  }
                />
                <Info label={english ? "Account label" : "来源账号"} value={source?.externalAccountLabel ?? (english ? "Not connected yet" : "尚未连接")} />
                <Info
                  label={english ? "Last sync" : "最近同步"}
                  value={
                    source?.lastSyncedAt
                      ? formatImportDateLabel(source.lastSyncedAt, english, formatDateLabel)
                      : (english ? "No sync yet" : "还没有同步")
                  }
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    if (oauthReady) {
                      window.location.href = `/api/connectors/${provider.toLowerCase()}/start`;
                      return;
                    }
                    connectMock(provider);
                  }}
                  disabled={pending || !capability.canManageConnectors}
                >
                  <Building2 className="h-4 w-4" />
                  {oauthReady ? `${messages.crm.connect} ${providerCopy[provider].label}` : messages.crm.connectDemo}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => source && runPreview(source.id)}
                  disabled={!source || pending || !capability.canManageImports}
                >
                  {messages.crm.preview}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => source && runImport(source.id, false)}
                  disabled={!source || pending || !capability.canManageImports}
                >
                  {messages.crm.firstImport}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => source && runImport(source.id, true)}
                  disabled={!source || pending || !capability.canManageImports}
                >
                  <RefreshCcw className="h-4 w-4" />
                  {messages.crm.incrementalSync}
                </Button>
              </div>
              {!capability.canManageConnectors || !capability.canManageImports ? (
                <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">
                  {!capability.canManageConnectors && !capability.canManageImports
                    ? `${capability.connectorManagementDeniedMessage} ${capability.importManagementDeniedMessage}`
                    : !capability.canManageConnectors
                      ? capability.connectorManagementDeniedMessage
                      : capability.importManagementDeniedMessage}
                </p>
              ) : null}

              {!oauthReady ? (
                <div className="rounded-[18px] border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] px-4 py-3 text-sm text-[color:var(--status-warning-text)]">
                  {english
                    ? "Real OAuth is not configured yet. Demo CRM data will be used locally so you can still validate mapping, warmup and result-page value."
                    : "当前未配置真实 OAuth，本地会走示例工作区导入，适合演示对象映射、预热和结果页价值。"}
                </div>
              ) : null}

              {previewState?.sourceId === source?.id ? (
                <div className="workspace-panel-muted rounded-[20px] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[color:var(--foreground)]">{english ? "Preview:" : "导入预览："}{activePreview?.accountLabel ?? (english ? "Current source" : "当前来源")}</p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        {activePreview?.usedMock ? messages.crm.usingMock : messages.crm.usingReal}
                      </p>
                    </div>
                    <Badge variant="info">
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      {messages.crm.warmupReady}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {Object.entries(activePreview?.objectCounts ?? {}).map(([key, value]) => (
                      <Metric key={key} label={labelForPreviewKey(key, english)} value={english ? `${value}` : `${value} 条`} />
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>{messages.crm.latestJobs}</CardTitle>
            <CardDescription>{english ? "What each run created — new objects, warnings, warmup output." : "每次导入产生了什么——新对象、警告、预热结果。"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.jobs.length ? (
              data.jobs.map((job) => {
                const summary = safeParseJson<Record<string, unknown>>(job.summaryJson, {});
                return (
                  <div key={job.id} className="theme-surface-panel rounded-[18px] px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[color:var(--foreground)]">{job.source.sourceType === "HUBSPOT" ? "HubSpot" : "Salesforce"} · {job.jobType === "INITIAL_IMPORT" ? (english ? "Initial import" : "首次导入") : (english ? "Incremental sync" : "增量同步")}</p>
                        <p className="mt-1 text-sm text-[color:var(--muted)]">
                          {job.source.externalAccountLabel ?? (english ? "Unnamed source" : "未命名来源")} ·{" "}
                          {formatImportDateLabel(job.startedAt, english, formatDateLabel)}
                        </p>
                      </div>
                      <Badge variant={job.status.includes("FAILED") ? "danger" : job.status.includes("WARNING") ? "warning" : "success"}>
                        {formatCrmImportDisplayText(job.status, english)}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <Metric label={english ? "Success" : "成功"} value={english ? `${job.successRecords}` : `${job.successRecords} 条`} />
                      <Metric label={english ? "Failed" : "失败"} value={english ? `${job.failedRecords}` : `${job.failedRecords} 条`} />
                      <Metric label={english ? "Warnings" : "警告"} value={english ? `${job.warningRecords}` : `${job.warningRecords} 条`} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={`/imports/jobs/${job.id}`}>{english ? "Open result page" : "查看结果页"}</Link>
                      </Button>
                      {summary.warmup ? (
                        <Badge variant="info">{english ? "Warmup ready" : "预热已完成"}</Badge>
                      ) : (
                        <Badge variant="neutral">{english ? "Warmup missing" : "预热未记录"}</Badge>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                title={english ? "No CRM import job yet" : "还没有客户关系系统导入任务"}
                description={english ? "Connect HubSpot or Salesforce, then run the first import." : "先连 HubSpot 或 Salesforce，再跑首次导入。"}
              />
            )}
          </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.crm.warmupValue}</CardTitle>
            <CardDescription>{english ? "Priorities, blockers, commitments and next actions from this import." : "由这次导入得出的今日重点、阻塞、承诺和下一步。"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestWarmup ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric label={english ? "Review conflicts" : "导入后复核冲突"} value={english ? `${Number(latestWarmup.reviewCount ?? 0)}` : `${Number(latestWarmup.reviewCount ?? 0)} 条`} />
                  <Metric label={english ? "Action inputs" : "生成动作输入"} value={english ? `${Number(latestWarmup.createdActionCount ?? 0)}` : `${Number(latestWarmup.createdActionCount ?? 0)} 条`} />
                  <Metric label={english ? "Meeting / note outputs" : "生成会议/笔记"} value={english ? `${Number(latestWarmup.generatedMeetingNotes ?? 0)}` : `${Number(latestWarmup.generatedMeetingNotes ?? 0)} 条`} />
                  <Metric label={english ? "Warmup refreshed objects" : "预热刷新对象"} value={english ? `${Number((latestWarmup.warmup as Record<string, unknown> | undefined)?.refreshedObjects ?? 0)}` : `${Number((latestWarmup.warmup as Record<string, unknown> | undefined)?.refreshedObjects ?? 0)} 个`} />
                </div>
                <div className="workspace-panel-muted rounded-[18px] px-4 py-4 text-sm text-[color:var(--foreground)]">
                  <p className="font-semibold text-[color:var(--foreground)]">{english ? "What warmup already did" : "当前预热已做的事"}</p>
                  <ul className="mt-3 space-y-2 leading-6">
                    <li>{english ? "1. Detect blockers and commitments from CRM notes / events" : "1. 识别客户关系系统笔记与事件里的阻塞与承诺"}</li>
                    <li>{english ? "2. Rebuild recommendations for imported contacts, companies, opportunities and meetings" : "2. 为新导入的联系人、公司、机会和会议重算判断建议"}</li>
                    <li>{english ? "3. Refresh dashboard and object pages so today focus reflects imported value immediately" : "3. 刷新今日工作台与对象详情页，确保今日重点直接看到新导入价值"}</li>
                  </ul>
                </div>
              </>
            ) : (
              <EmptyState
                title={english ? "No warmup output yet" : "还没有预热结果"}
                description={english ? "Run a first import — results will land here." : "跑一次首次导入——结果会出现在这里。"}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function openConflictSummary(count: number, english: boolean) {
  if (count > 0) {
    return english
      ? `${count} import conflicts are still holding the ingress boundary, so this page should stay review-first.`
      : `${count} 条导入冲突仍然卡在入口边界上，所以这里现在应该保持先复核。`;
  }

  return english
    ? "The ingress path is readable now: source connection, preview, import result and warmup output are all visible on one page."
    : "当前入口路径已经可读：来源连接、导入预览、导入结果和预热输出都能在同一页里看清。";
}

function labelForPreviewKey(key: string, english = false) {
  switch (key) {
    case "contacts":
      return english ? "Contacts" : "联系人";
    case "companies":
      return english ? "Companies" : "公司";
    case "opportunities":
      return english ? "Opportunities" : "机会";
    case "meetings":
      return english ? "Meetings" : "会议";
    case "notes":
      return english ? "Notes" : "笔记";
    case "tasks":
      return english ? "Tasks" : "任务";
    case "associations":
      return english ? "Associations" : "关联关系";
    default:
      return key;
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-panel rounded-[16px] px-4 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-1 font-medium text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}
