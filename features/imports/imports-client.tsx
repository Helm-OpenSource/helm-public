"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { Download, FileUp, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { CustomerAssetFocusStrip } from "@/components/shared/customer-asset-focus-strip";
import { EmptyState } from "@/components/shared/empty-state";
import { LazyDisclosure } from "@/components/shared/lazy-disclosure";
import { ObjectContextOperatingSummary } from "@/components/shared/object-context-operating-summary";
import { PageHeader } from "@/components/shared/page-header";
import { SupportSurfaceNote } from "@/components/shared/support-surface-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BusinessLoopGapSummary } from "@/lib/operating-system/operating-gap";
import { buildBusinessFirstSummaryItems } from "@/lib/presentation/business-first-surface-contract";
import { buildBusinessLoopGapReadout } from "@/lib/presentation/business-loop-gap-readout";
import { previewCsvImportAction, runCsvImportAction } from "@/features/imports/actions";

type ImportType = "contacts" | "opportunities" | "meetings";

type ImportsClientProps = {
  crmSummary: {
    sourceCount: number;
    connectedCount: number;
    openConflicts: number;
    latestJobId: string | null;
  };
  configs: Record<
    ImportType,
    {
      fields: Array<{
        key: string;
        label: string;
        description: string;
        required?: boolean;
      }>;
      template: string;
    }
  >;
  capability: {
    canManageImports: boolean;
    importManagementDeniedMessage: string;
  };
  /**
   * Server-rendered slot for tenant-extension account binding entry button.
   * Pre-resolved by `lib/extensions/registry.ts`; null when no enabled
   * extension contributes one for the current workspace.
   */
  accountBindingSlot: ReactNode;
  businessLoopGapSummary: BusinessLoopGapSummary;
};

type PreviewState = {
  headers: string[];
  mapping: Record<string, string>;
  sampleRows: Array<{
    rowNumber: number;
    raw: Record<string, string>;
    mapped: Record<string, string>;
  }>;
  totalRows: number;
  validation: string[];
  insights: string[];
};

type ImportsSummaryConnection = {
  label: string;
  value: string;
  description?: string;
  href?: string;
};

const isDefined = <T,>(value: T | undefined): value is T => value !== undefined;

export function ImportsClient({
  configs,
  crmSummary,
  capability,
  accountBindingSlot: _accountBindingSlot,
  businessLoopGapSummary,
}: ImportsClientProps) {
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [activeType, setActiveType] = useState<ImportType>("contacts");
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [result, setResult] = useState<{
    importedCount: number;
    failedCount: number;
    errors: Array<{ rowNumber: number; message: string }>;
    stats: {
      createdCount: number;
      updatedCount: number;
      autoCreatedCompanies: number;
      linkedContacts: number;
      linkedCompanies: number;
      linkedOpportunities: number;
      generatedMeetingActions: number;
      hydratedMeetings: number;
    };
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const activeConfig = configs[activeType];
  const mapping = preview?.mapping ?? {};

  const handleFileChange = async (file?: File | null) => {
    if (!file) return;
    setSelectedFile(file);
    setFileName(file.name);
    setCsvText("");
    setPreview(null);
    setResult(null);
    const text = await file.text();
    setCsvText(text);
  };

  const resolveCsvText = async () => {
    if (csvText.trim()) return csvText;
    if (!selectedFile) return "";

    const text = await selectedFile.text();
    setCsvText(text);
    return text;
  };

  const runPreview = () => {
    startTransition(async () => {
      const resolvedCsvText = await resolveCsvText();
      const response = await previewCsvImportAction({
        type: activeType,
        csvText: resolvedCsvText,
        mapping: preview?.mapping,
        locale,
      });

      if (!response.ok || !response.preview) {
        toast.error(response.error ?? (english ? "CSV preview failed" : "CSV 预览失败"));
        return;
      }

      setPreview(response.preview);
      toast.success(english ? `Preview generated: ${response.preview.totalRows} rows` : `已生成预览，共 ${response.preview.totalRows} 行`);
    });
  };

  const runImport = () => {
    startTransition(async () => {
      const resolvedCsvText = await resolveCsvText();
      const response = await runCsvImportAction({
        type: activeType,
        csvText: resolvedCsvText,
        mapping,
      });

      if (!response.ok || !response.result) {
        toast.error(response.error ?? (english ? "Import failed" : "导入失败"));
        return;
      }

      setResult(response.result);
      toast.success(english ? `Import complete: ${response.result.importedCount} rows succeeded` : `导入完成：成功 ${response.result.importedCount} 行`);
    });
  };

  const resetCurrent = () => {
    setFileName("");
    setSelectedFile(null);
    setCsvText("");
    setPreview(null);
    setResult(null);
  };

  const canPreview = isHydrated && Boolean(selectedFile || csvText.trim());
  const canImport =
    isHydrated && capability.canManageImports && Boolean(preview && (selectedFile || csvText.trim()));
  const headerOptions = preview?.headers ?? [];

  const statusSummary = useMemo(() => {
    if (!result) return null;
    if (!result.failedCount) return english ? "All rows imported successfully" : "全部导入成功";
    if (!result.importedCount) return english ? "No row was imported successfully this time" : "本次没有成功导入任何数据";
    return english ? `${result.importedCount} rows imported, ${result.failedCount} rows failed` : `成功 ${result.importedCount} 行，失败 ${result.failedCount} 行`;
  }, [english, result]);

  const importResultsHref =
    activeType === "contacts"
      ? "/search"
      : activeType === "opportunities"
        ? "/opportunities"
        : "/memory";
  const importResultsLabel =
    activeType === "contacts"
      ? english
        ? "Open imported contacts in search"
        : "去全局搜索看联系人"
      : english
        ? "Open imported results"
        : "去看导入结果";
  const importsSummaryTitle = english
    ? "Are customer objects and relationships clean enough to work from"
    : "客户对象和关系信息是否足够干净";
  const importsSummaryText =
    crmSummary.connectedCount > 0
      ? english
        ? `There are already ${crmSummary.connectedCount} connected sources, so this page now decides whether CRM ingress is clean enough to trust downstream surfaces.`
        : `当前已有 ${crmSummary.connectedCount} 个已连接来源，先判断客户台账接入是否足够干净。`
      : english
        ? "Start with the customer system that already holds accounts, contacts and activity."
        : "先接入已有客户、联系人和活动记录。";
  const businessLoopGapReadout = buildBusinessLoopGapReadout({
    english,
    businessLoopGapSummary,
  });
  const importsSummarySnapshot = {
    objectState: english
      ? `${crmSummary.connectedCount}/${crmSummary.sourceCount} sources connected · ${crmSummary.openConflicts} open conflicts`
      : `${crmSummary.connectedCount}/${crmSummary.sourceCount} 个来源已连接 · ${crmSummary.openConflicts} 条冲突待处理`,
    blocker: businessLoopGapReadout.blocker
      ? businessLoopGapReadout.blocker
      : crmSummary.openConflicts > 0
        ? english
          ? "Resolve import conflicts first so object state does not fork."
          : "先处理导入冲突，避免对象状态分叉。"
        : english
          ? "No dominant ingress blocker is visible beyond review discipline."
          : "当前除了复核纪律之外，没有更强的接入阻塞。",
    pendingDecision:
      businessLoopGapReadout.pendingDecision ??
      (crmSummary.openConflicts > 0
        ? english
          ? "Decide which conflict should be cleared before trusting downstream memory."
          : "先决定哪条冲突要优先清掉，再信任下游记忆。"
        : crmSummary.connectedCount > 0
          ? english
            ? "Decide whether the next step belongs in CRM-first migration or a targeted CSV fallback."
            : "判断下一步该继续客户台账迁移，还是只走一次定向 CSV 兜底。"
          : english
            ? "Decide which CRM source should become the first ingress path."
            : "先决定哪一个客户来源作为第一条接入路径。"),
    nextAction:
      businessLoopGapReadout.nextAction ??
      (crmSummary.openConflicts > 0
        ? english
          ? "Open conflicts and clear identity debt before importing again."
          : "先打开冲突队列，清理身份债，再继续导入。"
        : crmSummary.connectedCount > 0
          ? english
            ? "Open the CRM wizard and continue warming object, relationship and activity context."
            : "继续打开客户台账向导，把对象、关系和活动信息继续暖起来。"
          : english
            ? "Start with CRM connection before falling back to CSV."
            : "优先走客户台账连接，再考虑回退到 CSV。"),
  };
  const importsSummaryConnectionCandidates: Array<
    ImportsSummaryConnection | undefined
  > = [
    businessLoopGapReadout.connection,
    {
      label: english ? "CRM-first entry" : "客户台账优先入口",
      value: english ? "Open CRM connection wizard" : "打开客户台账连接向导",
      description: english
        ? "Prefer HubSpot / Salesforce when relationship and activity context already exists."
        : "如果关系层和活动层已经在 HubSpot / Salesforce，优先从那里进入。",
      href: "/imports/crm",
    },
    crmSummary.openConflicts > 0
      ? {
          label: english ? "Conflict queue" : "冲突队列",
          value: english
            ? `${crmSummary.openConflicts} open conflicts`
            : `${crmSummary.openConflicts} 条待处理冲突`,
          description: english
            ? "Resolve identity and object conflicts before trusting downstream memory."
            : "先处理身份与对象冲突，再信任下游记忆与对象状态。",
          href: "/imports/conflicts",
        }
      : undefined,
    crmSummary.latestJobId
      ? {
          label: english ? "Latest import result" : "最近一次导入结果",
          value: english ? "Review impact before widening" : "先看影响，再扩大接入",
          description: english
            ? "Inspect the latest run before widening CRM ingress coverage."
            : "扩大客户台账接入前，先检查最近一次导入结果。",
          href: `/imports/jobs/${crmSummary.latestJobId}`,
        }
      : undefined,
    {
      label: english ? "Downstream surface" : "下游工作面",
      value: importResultsLabel,
      description:
        activeType === "contacts"
          ? english
            ? "Use imported contacts to bind threads and warm relationship context."
            : "用导入后的联系人完成线程绑定并暖起关系信息。"
          : activeType === "opportunities"
            ? english
              ? "Use imported opportunities to restore operating focus and next steps."
              : "用导入后的机会恢复经营焦点和下一步。"
            : english
              ? "Use imported meeting notes to ground memory writeback."
              : "用导入后的会议纪要给记忆写回提供来源依据。",
      href: importResultsHref,
    },
  ];
  const importsSummaryConnections =
    importsSummaryConnectionCandidates.filter(isDefined);
  const importAssetFocusItems = [
    {
      label: english ? "Object state" : "对象状态",
      value: importsSummarySnapshot.objectState,
      detail: importsSummaryText,
      href: crmSummary.connectedCount > 0 ? "/imports/crm" : undefined,
      tone: crmSummary.connectedCount > 0 ? "success" : "warning",
    },
    {
      label: english ? "Blocker" : "阻塞",
      value: importsSummarySnapshot.blocker,
      detail:
        crmSummary.openConflicts > 0
          ? english
            ? "Identity debt is the first thing to clear."
            : "身份债是第一优先级。"
          : english
            ? "No visible conflict queue pressure."
            : "当前没有明显冲突队列压力。",
      href: crmSummary.openConflicts > 0 ? "/imports/conflicts" : undefined,
      tone: crmSummary.openConflicts > 0 ? "danger" : "success",
    },
    {
      label: english ? "Pending decision" : "待决策",
      value: importsSummarySnapshot.pendingDecision,
      detail: english
        ? "Choose CRM-first migration or a narrow CSV fallback."
        : "判断继续走客户台账迁移，还是一次性 CSV 兜底。",
      href: "/imports/crm",
      tone: "info",
    },
    {
      label: english ? "Next action" : "下一步动作",
      value: importsSummarySnapshot.nextAction,
      detail: english
        ? "Keep relationship and activity context attached to customer objects."
        : "让关系和活动信息继续归到客户对象上。",
      href: crmSummary.latestJobId ? `/imports/jobs/${crmSummary.latestJobId}` : "/imports/crm",
      tone: "info",
    },
  ] as const;

  const _importGuidanceRecommendations = [
    {
      title: english ? "Prefer CRM ingress before manual CSV" : "优先接客户台账，不要先走手工 CSV",
      body:
        crmSummary.connectedCount > 0
          ? english
            ? "Connected CRM sources already exist. Keep CSV as a targeted fallback for cold-start gaps or one-off corrections."
            : "当前已经有客户来源接入，CSV 更适合作为冷启动缺口或一次性修正的兜底路径。"
          : english
            ? "Start with the CRM wizard first so relationship and activity context arrive together instead of fragmenting across spreadsheets."
            : "先走客户台账向导，把关系层和活动层一起接进来，避免上下文继续分散在表格里。",
      href: "/imports/crm",
      meta:
        crmSummary.connectedCount > 0
          ? english
            ? `${crmSummary.connectedCount} source(s) connected`
            : `已连接 ${crmSummary.connectedCount} 个来源`
          : english
            ? `${crmSummary.sourceCount} source(s) detectable`
            : `当前可检测 ${crmSummary.sourceCount} 个来源`,
    },
    {
      title:
        crmSummary.openConflicts > 0
          ? english
            ? "Resolve identity conflicts before trusting downstream memory"
            : "先处理身份冲突，再信任下游记忆与对象状态"
          : english
            ? "Preview mapped rows before writing objects"
            : "写对象前先看映射后的预览",
      body:
        crmSummary.openConflicts > 0
          ? english
            ? "Open conflicts first when object identity is still forked. Imports should not quietly create parallel records."
            : "对象身份还在分叉时，先去处理冲突；不要让导入静默生成平行对象。"
          : english
            ? "Use preview, validation and mapping as the review layer. Import should only run after the object shape is understandable."
            : "把预览、校验和映射当作复核层；只有对象形态已经说清楚后，再执行导入。",
      href: crmSummary.openConflicts > 0 ? "/imports/conflicts" : undefined,
      meta:
        crmSummary.openConflicts > 0
          ? english
            ? `${crmSummary.openConflicts} open conflict(s)`
            : `${crmSummary.openConflicts} 条待处理冲突`
          : english
            ? `Current tab: ${activeType}`
            : `当前标签：${activeType === "contacts" ? "联系人" : activeType === "opportunities" ? "机会" : "会议纪要"}`,
    },
    crmSummary.latestJobId
        ? {
          title: english
            ? "Inspect the latest import result before widening coverage"
            : "扩大覆盖前先检查最近一次导入结果",
          body: english
            ? "Failures, warnings and warmup output before the next upload."
            : "下次上传前，先看这一轮的失败项、警告和预热输出。",
          href: `/imports/jobs/${crmSummary.latestJobId}`,
          meta: english ? "Latest result" : "最近一次结果",
        }
      : undefined,
  ].filter(isDefined);

  const _importGuidanceReminders = [
    {
      title: english ? "This surface is for ingress review" : "这页的职责是接入复核",
      body: english
        ? "Use imports to warm object, relationship and activity context. Do not treat it like connector admin or workflow control."
        : "导入页用于暖起对象、关系和活动上下文，不是连接器管理台或流程控制。",
    },
    {
      title: english ? "Recommendation still is not commitment" : "建议仍不等于承诺",
      body: english
        ? "Imported records can sharpen judgement and downstream recommendations, but they do not create external commitment or execution authority."
        : "导入记录可以让判断和下游建议更清楚，但不会直接生成对外承诺或执行权。",
    },
  ];

  return (
    <div className="workspace-surface-stack">
      <PageHeader
        eyebrow={english ? "Customer records" : "客户台账"}
        title={english ? "Bring in accounts, contacts, deals and meetings first" : "先接入客户、联系人、机会和会议"}
        description={english ? "CRM first; CSV is a one-time fallback." : "优先接 CRM；CSV 只做一次性补救。"}
        actions={
          <>
            <Button variant="secondary" onClick={resetCurrent}>
              <RefreshCcw className="h-4 w-4" />
              {english ? "Reset current import" : "重置当前导入"}
            </Button>
            <Button asChild>
              <Link href={`/api/imports/template/${activeType}`}>
                <Download className="h-4 w-4" />
                {english ? "Download template" : "下载模板"}
              </Link>
            </Button>
          </>
        }
      />

      <CustomerAssetFocusStrip
        eyebrow={english ? "Customer asset intake" : "客户资产接入"}
        title={
          crmSummary.connectedCount > 0
            ? english
              ? "Start from the customer ledger already in motion."
              : "先看已经进入流转的客户台账。"
            : english
              ? "Choose the first customer source before uploading more files."
              : "先选第一条客户来源，再继续上传文件。"
        }
        summary={
          english
            ? "This page should expose customer objects, relationship debt, and the next clean ingress action before explaining import mechanics."
            : "这页先暴露客户对象、关系债和下一步接入动作，再解释导入机制。"
        }
        items={[...importAssetFocusItems]}
        primaryAction={{
          label: english ? "Open CRM connection" : "打开客户台账连接",
          href: "/imports/crm",
        }}
        secondaryAction={
          crmSummary.openConflicts > 0
            ? {
                label: english ? "Resolve conflicts" : "处理冲突",
                href: "/imports/conflicts",
              }
            : crmSummary.latestJobId
              ? {
                  label: english ? "Latest result" : "最近导入结果",
                  href: `/imports/jobs/${crmSummary.latestJobId}`,
                }
              : null
        }
      />

      <LazyDisclosure title={english ? "Reference: intake judgement" : "引用：接入判断"}>
        <ObjectContextOperatingSummary
          label={english ? "Ingress posture" : "接入态势"}
          title={importsSummaryTitle}
          summary={importsSummaryText}
          items={buildBusinessFirstSummaryItems({
            english,
            snapshot: importsSummarySnapshot,
          })}
          connectionsLabel={english ? "Where to act next" : "下一步去哪里处理"}
          connections={importsSummaryConnections}
        />
      </LazyDisclosure>

      {!capability.canManageImports ? (
        <SupportSurfaceNote
          label={english ? "Import posture" : "导入权限姿态"}
          title={
            english
              ? "CSV import stays read-only for the current workspace role"
              : "当前工作区角色对 CSV 导入保持只读"
          }
          summary={capability.importManagementDeniedMessage}
          items={[
            {
              label: english ? "Still available" : "仍可进行",
              value: english
                ? "Upload CSV files, inspect field mapping, and generate a local preview."
                : "上传 CSV、检查字段映射，并生成本地预览。",
            },
            {
              label: english ? "Blocked here" : "当前被拦截",
              value: english
                ? "Writing imported records, warmup output, and downstream object changes."
                : "写入导入记录、预热输出以及下游对象变更。",
            },
          ]}
        />
      ) : null}

      <Card className="workspace-panel-muted">
        <CardContent className="grid gap-4 py-5 xl:grid-cols-[1.2fr_repeat(3,minmax(0,0.9fr))]">
          <div className="space-y-2">
            <Badge variant="info">{english ? "Trial onboarding" : "试点接入"}</Badge>
            <p className="text-lg font-semibold text-[color:var(--foreground)]">{english ? "HubSpot / Salesforce should now be the default path. CSV remains the fallback for cold start and edge cases." : "现在优先走 HubSpot / Salesforce，把客户、联系人、机会和活动直接接进来；CSV 作为冷启动补充和兜底入口。"}</p>
          </div>
          <ImportMetric label={english ? "Detected CRM sources" : "已发现客户来源"} value={english ? `${crmSummary.sourceCount}` : `${crmSummary.sourceCount} 个`} />
          <ImportMetric label={english ? "Connected sources" : "已连接来源"} value={english ? `${crmSummary.connectedCount}` : `${crmSummary.connectedCount} 个`} />
          <ImportMetric label={english ? "Open conflicts" : "待处理冲突"} value={english ? `${crmSummary.openConflicts}` : `${crmSummary.openConflicts} 条`} />
        </CardContent>
      </Card>

      <LazyDisclosure title={english ? "Reference: connection entries" : "引用：接入入口"}>
        <Card>
          <CardHeader>
            <CardTitle>{english ? "CRM connection" : "客户台账连接"}</CardTitle>
            <CardDescription>{english ? "Pull accounts, contacts, deals and activity from HubSpot or Salesforce." : "从 HubSpot 或 Salesforce 拉客户、联系人、机会和活动记录。"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/imports/crm">{english ? "Open CRM connection wizard" : "打开客户台账连接向导"}</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/imports/conflicts">{english ? "Resolve conflicts" : "处理冲突"}</Link>
            </Button>
            {crmSummary.latestJobId ? (
              <Button variant="secondary" asChild>
                <Link href={`/imports/jobs/${crmSummary.latestJobId}`}>{english ? "Open latest import result" : "查看最近导入结果"}</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </LazyDisclosure>

      <Tabs value={activeType} onValueChange={(value) => {
        setActiveType(value as ImportType);
        resetCurrent();
      }}>
        <TabsList>
          <TabsTrigger value="contacts">{english ? "Contacts" : "联系人"}</TabsTrigger>
          <TabsTrigger value="opportunities">{english ? "Opportunities" : "机会"}</TabsTrigger>
          <TabsTrigger value="meetings">{english ? "Meeting notes" : "会议纪要"}</TabsTrigger>
        </TabsList>

        {(["contacts", "opportunities", "meetings"] as ImportType[]).map((type) => (
          <TabsContent key={type} value={type} className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <Card>
                <CardHeader>
                  <CardTitle>{english ? "Upload file" : "上传文件"}</CardTitle>
                  <CardDescription>{english ? "Upload first, then preview before confirming the mapping." : "先上传，预览之后再确认映射。"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="workspace-panel-muted flex cursor-pointer flex-col items-center justify-center rounded-[24px] border-dashed px-6 py-10 text-center transition hover:border-[color:var(--border-strong)]">
                    <FileUp className="h-8 w-8 text-[color:var(--muted-foreground)]" />
                    <p className="mt-4 font-medium text-[color:var(--foreground)]">{english ? `Upload ${type === "contacts" ? "contacts" : type === "opportunities" ? "opportunities" : "meeting notes"} CSV` : `上传 ${type === "contacts" ? "联系人" : type === "opportunities" ? "机会" : "会议纪要"} CSV`}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">{english ? "Local CSV files are supported. The system shows field mapping and validation before importing." : "支持本地 CSV 文件。导入前会先展示列映射和校验结果。"}</p>
                    {isHydrated ? (
                      <input
                        data-testid={`import-file-${type}`}
                        aria-label={
                          english
                            ? `Upload ${type === "contacts" ? "contacts" : type === "opportunities" ? "opportunities" : "meeting notes"} CSV`
                            : `上传 ${type === "contacts" ? "联系人" : type === "opportunities" ? "机会" : "会议纪要"} CSV`
                        }
                        className="hidden"
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(event) => handleFileChange(event.target.files?.[0])}
                      />
                    ) : null}
                  </label>
                  <div className="workspace-panel rounded-2xl px-4 py-4">
                    <p className="text-sm font-medium text-[color:var(--foreground)]">{english ? "Current file" : "当前文件"}</p>
                    <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{fileName || (english ? "No file uploaded yet" : "尚未上传文件")}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button data-testid={`import-preview-${type}`} disabled={!canPreview || pending} onClick={runPreview}>
                      {english ? "Generate preview" : "生成预览"}
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href={`/api/imports/template/${type}`}>{english ? "Download template" : "下载模板"}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <LazyDisclosure title={english ? "Reference: field guide" : "引用：字段说明"}>
                <Card>
                  <CardHeader>
                    <CardTitle>{english ? "Field guide" : "字段说明"}</CardTitle>
                    <CardDescription>{english ? "What each column will become after import." : "每一列导入后会变成什么。"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {configs[type].fields.map((field) => (
                      <div key={field.key} className="theme-surface-panel rounded-2xl px-4 py-4">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[color:var(--foreground)]">{field.label}</p>
                          {field.required ? <Badge variant="danger">{english ? "Required" : "必填"}</Badge> : <Badge variant="neutral">{english ? "Optional" : "可选"}</Badge>}
                        </div>
                        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{field.description}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </LazyDisclosure>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{english ? "Column mapping" : "列映射"}</CardTitle>
                <CardDescription>{english ? "Adjust which column maps to which field." : "调整每个字段对应哪一列。"}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {activeConfig.fields.map((field) => (
                    <div key={field.key} className="workspace-panel space-y-2 rounded-2xl p-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[color:var(--foreground)]">{field.label}</p>
                      {field.required ? <Badge variant="danger">{english ? "Required" : "必填"}</Badge> : null}
                    </div>
                    <Select
                      value={mapping[field.key] ?? "__ignore__"}
                      onValueChange={(value) =>
                        setPreview((current) =>
                          current
                            ? {
                                ...current,
                                mapping: {
                                  ...current.mapping,
                                  [field.key]: value,
                                },
                              }
                            : current,
                        )
                      }
                      disabled={!preview}
                    >
                      <SelectTrigger
                        aria-label={
                          english
                            ? `CSV column for ${field.label}`
                            : `${field.label}对应的文件列`
                        }
                      >
                        <SelectValue
                          placeholder={english ? "Choose CSV column" : "选择文件列"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__ignore__">{english ? "Ignore this field" : "忽略此字段"}</SelectItem>
                        {headerOptions.map((header) => (
                          <SelectItem key={header} value={header}>{header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardHeader>
                  <CardTitle>{english ? "Import preview" : "导入预览"}</CardTitle>
                  <CardDescription>{english ? "First 5 rows, mapped." : "前 5 行映射后的样子。"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {preview?.sampleRows.length ? preview.sampleRows.map((row) => (
                    <div key={row.rowNumber} className="workspace-panel rounded-2xl px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-[color:var(--foreground)]">{english ? `Row ${row.rowNumber}` : `第 ${row.rowNumber} 行`}</p>
                        <Badge variant="neutral">{english ? "Preview" : "预览"}</Badge>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {activeConfig.fields.map((field) => (
                          <div key={field.key} className="workspace-panel-muted rounded-2xl px-3 py-3">
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{field.label}</p>
                            <p className="mt-2 text-sm text-[color:var(--foreground)]">{row.mapped[field.key] || (english ? "Unmapped" : "未映射")}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )) : (
                    <EmptyState title={english ? "Upload the CSV and generate preview first" : "先上传 CSV 并生成预览"} description={english ? "Preview shows the first 5 mapped rows and points out obvious issues ahead of import." : "预览会展示映射后的前 5 行数据，并提前指出明显错误。"} />
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{english ? "Validation results" : "校验结果"}</CardTitle>
                  <CardDescription>{english ? "Fix these before importing." : "导入前先处理。"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {preview?.insights.length ? preview.insights.map((item) => (
                    <div key={item} className="rounded-2xl border border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] px-4 py-3 text-sm text-[color:var(--status-info-text)]">
                      {item}
                    </div>
                  )) : null}
                  {preview?.validation.length ? preview.validation.map((item) => (
                    <div key={item} className="rounded-2xl border border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)] px-4 py-3 text-sm text-[color:var(--status-danger-text)]">
                      {item}
                      </div>
                    )) : (
                      <EmptyState title={english ? "No obvious validation issues" : "当前没有明显校验错误"} description={english ? "Base fields are recognized. You can import." : "基础字段都能识别，可以继续导入。"} />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{english ? "Run import" : "开始导入"}</CardTitle>
                    <CardDescription>{english ? "Writes objects, timelines, audit logs and usage events." : "会写入对象、时间线、审计日志和使用信号。"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="theme-surface-panel rounded-2xl px-4 py-4">
                      <p className="text-sm font-medium text-[color:var(--foreground)]">{english ? "Total rows" : "总行数"}</p>
                      <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{preview?.totalRows ?? 0}</p>
                    </div>
                    <Button data-testid={`import-run-${type}`} className="w-full" disabled={!canImport || pending} onClick={runImport}>
                      {english ? "Start import" : "开始导入"}
                    </Button>
                    {!capability.canManageImports ? (
                      <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">
                        {capability.importManagementDeniedMessage}
                      </p>
                    ) : null}
                    {statusSummary ? (
                      <div className="rounded-2xl border border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] px-4 py-3 text-sm text-[color:var(--status-success-text)]">
                        {statusSummary}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{english ? "Import results" : "导入结果"}</CardTitle>
                    <CardDescription>{english ? "Each failed row keeps its reason — fix and re-import." : "失败行保留原因，修了重导即可。"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {result ? (
                      <>
                        <div className="grid gap-3 md:grid-cols-2">
                          <ResultCell label={english ? "Imported rows" : "成功导入"} value={result.importedCount} />
                          <ResultCell label={english ? "Failed rows" : "失败行数"} value={result.failedCount} />
                          <ResultCell label={english ? "Created objects" : "新建对象"} value={result.stats.createdCount} />
                          <ResultCell label={english ? "Updated objects" : "更新对象"} value={result.stats.updatedCount} />
                        </div>
                        <div className="workspace-panel-muted rounded-2xl px-4 py-4">
                          <p className="text-sm font-medium text-[color:var(--foreground)]">{english ? "The value to inspect right after import" : "导入后最值得立刻去看的价值"}</p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <ResultHint label={english ? "Auto-created companies" : "自动补建公司"} value={result.stats.autoCreatedCompanies} />
                            <ResultHint label={english ? "Linked contacts" : "成功绑定联系人"} value={result.stats.linkedContacts} />
                            <ResultHint label={english ? "Linked companies" : "成功绑定公司"} value={result.stats.linkedCompanies} />
                            <ResultHint label={english ? "Linked opportunities" : "成功绑定机会"} value={result.stats.linkedOpportunities} />
                            {activeType === "meetings" ? <ResultHint label={english ? "Generated post-meeting actions" : "生成会后动作"} value={result.stats.generatedMeetingActions} /> : null}
                            {activeType === "meetings" ? <ResultHint label={english ? "Triggered meeting memory processing" : "触发会议记忆处理"} value={result.stats.hydratedMeetings} /> : null}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" asChild>
                              <Link
                                href={importResultsHref}
                                data-testid={`import-results-open-${activeType}`}
                              >
                                {importResultsLabel}
                              </Link>
                            </Button>
                            <Button size="sm" variant="ghost" asChild>
                              <Link href={activeType === "meetings" ? "/dashboard" : "/dashboard"}>{english ? "Open dashboard judgement" : "去首页看新判断"}</Link>
                            </Button>
                          </div>
                        </div>
                        {result.errors.length ? result.errors.map((error) => (
                          <div key={`${error.rowNumber}-${error.message}`} className="rounded-2xl border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] px-4 py-3 text-sm text-[color:var(--status-warning-text)]">
                            {english ? `Row ${error.rowNumber}: ${error.message}` : `第 ${error.rowNumber} 行：${error.message}`}
                          </div>
                        )) : (
                          <div className="rounded-2xl border border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] px-4 py-3 text-sm text-[color:var(--status-success-text)]">
                            {english ? "This import completed without row-level errors." : "本次导入全部成功。"}
                          </div>
                        )}
                      </>
                    ) : (
                      <EmptyState title={english ? "No import result yet" : "还没有导入结果"} description={english ? "After import finishes, this area will show successful rows, failed rows and exact reasons." : "完成导入后，这里会显示成功数量、失败行和错误原因。"} />
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ImportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-panel rounded-[24px] px-4 py-4">
      <p className="text-sm text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-3 text-base font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function ResultCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="theme-surface-panel rounded-2xl px-4 py-4">
      <p className="text-sm text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function ResultHint({ label, value }: { label: string; value: number }) {
  return (
    <div className="workspace-panel rounded-2xl px-4 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}
