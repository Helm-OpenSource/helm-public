"use client";

import type { Dispatch, SetStateAction } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { formatShellAlertText } from "@/components/layout/alert-display-copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { formatDateLabel } from "@/lib/utils";
import { accessStateLabels } from "@/features/settings/formatters/labels";
import type { SettingsClientProps } from "@/features/settings/types/settings-client-props";
import {
  formatSettingsConnectorAuthMode,
  formatSettingsConnectorStatus,
  formatSettingsModelProviderDetail,
  formatSettingsModelProviderName,
  formatSettingsModelSelection,
  formatSettingsPromptDescription,
  formatSettingsPromptName,
  formatSettingsPromptTaskType,
  formatSettingsPromptVersion,
} from "@/features/settings/display-copy";
import { Info, StatusHint } from "./settings-display";

type AccountTabData = Pick<
  SettingsClientProps["data"],
  "workspace" | "notifications" | "organizations" | "organizationSummary" | "governanceSummary" | "importSources"
>;

type LlmConfig = SettingsClientProps["llmConfig"];
type LlmDraft = {
  provider: "openai" | "qwen";
  defaultModel: string;
  extractionModel: string;
  briefingModel: string;
  reasoningModel: string;
};

type OrganizationDraft = {
  name: string;
};

type AccountSettingsTabProps = {
  createOrganization: () => void;
  crmSources: SettingsClientProps["data"]["importSources"];
  currentAccessStateLabel: string;
  data: AccountTabData;
  defaultStrategiesSummary: string;
  english: boolean;
  focusAreasSummary: string;
  llmDraft: LlmDraft;
  llmConfig: LlmConfig;
  organizationDraft: OrganizationDraft;
  pending: boolean;
  roleLabelsByLocale: Record<string, string>;
  saveWorkspaceLLMConfig: () => void;
  selectedWorkspaceId: string;
  setLlmDraft: Dispatch<SetStateAction<LlmDraft>>;
  setOrganizationDraft: Dispatch<SetStateAction<OrganizationDraft>>;
  setSelectedWorkspaceId: Dispatch<SetStateAction<string>>;
  switchOrganization: () => void;
};

export function AccountSettingsTab({
  createOrganization,
  crmSources,
  currentAccessStateLabel,
  data,
  defaultStrategiesSummary,
  english,
  focusAreasSummary,
  llmDraft,
  llmConfig,
  organizationDraft,
  pending,
  roleLabelsByLocale,
  saveWorkspaceLLMConfig,
  selectedWorkspaceId,
  setLlmDraft,
  setOrganizationDraft,
  setSelectedWorkspaceId,
  switchOrganization,
}: AccountSettingsTabProps) {
  const canManageWorkspaceSetup = data.organizationSummary.canManageWorkspaceSetup;
  const selectedModelIds = [
    llmDraft.defaultModel,
    llmDraft.extractionModel,
    llmDraft.briefingModel,
    llmDraft.reasoningModel,
  ];
  const rawModelOptions = llmConfig.modelCatalog.flatMap((group) =>
    group.models.map((model) => ({
      value: model.id,
      label: `${group.label} · ${model.label}`,
    })),
  );
  const mergedModelOptions = Array.from(
    new Map(
      [...rawModelOptions, ...selectedModelIds.map((modelId) => ({ value: modelId, label: modelId }))].map(
        (item) => [item.value, item],
      ),
    ).values(),
  );

  return (
    <TabsContent value="account">
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{english ? "Organization info" : "组织信息"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Info
              label={english ? "Workspace name" : "工作区名称"}
              value={data.workspace?.name ?? (english ? "Not set" : "未设置")}
            />
            <Info label={english ? "Current state" : "当前状态"} value={currentAccessStateLabel} />
            <Info
              label={english ? "Default persona" : "默认身份"}
              value={data.workspace?.profileType ?? (english ? "Not set" : "未设置")}
            />
            <Info
              label={english ? "Focus areas" : "关注目标"}
              value={focusAreasSummary}
            />
            <Info
              label={english ? "Default strategies" : "默认策略"}
              value={defaultStrategiesSummary}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{english ? "Recent notifications" : "最近通知"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.notifications.length ? (
              data.notifications.map((notification) => (
                <div key={notification.id} className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="font-medium text-[color:var(--foreground)]">
                    {formatShellAlertText(notification.title, english)}
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                    {formatShellAlertText(notification.body, english)}
                  </p>
                  <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">{formatDateLabel(notification.createdAt)}</p>
                </div>
              ))
            ) : (
              <EmptyState
                title={english ? "No notifications yet" : "还没有通知"}
                description={
                  english
                    ? "Approval reminders, high-risk opportunities and meeting prompts will accumulate here."
                    : "审批提醒、高风险机会和会议提醒会在这里沉淀。"
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{english ? "Organization switching" : "组织切换"}</CardTitle>
            <CardDescription>
              {english
                ? "Switch which organization you're working in."
                : "切换当前在哪个组织里工作。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
              <SelectTrigger
                aria-label={english ? "Active organization" : "当前组织"}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.organizations.map((organization) => (
                  <SelectItem key={organization.workspaceId} value={organization.workspaceId}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid gap-3 md:grid-cols-2">
              {data.organizations.map((organization) => (
                <div
                  key={organization.workspaceId}
                  className={`theme-surface-panel rounded-2xl px-4 py-4 ${
                    organization.workspaceId === data.organizationSummary.activeWorkspaceId
                      ? "ring-1 ring-[color:var(--border-strong)]"
                      : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{organization.name}</p>
                    <Badge
                      variant={
                        organization.workspaceId === data.organizationSummary.activeWorkspaceId
                          ? "approval"
                          : "neutral"
                      }
                    >
                      {organization.workspaceId === data.organizationSummary.activeWorkspaceId
                        ? english
                          ? "Active"
                          : "当前组织"
                        : english
                          ? "Available"
                          : "可切换"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                    {roleLabelsByLocale[organization.role]} ·{" "}
                    {accessStateLabels[organization.accessState][english ? "en" : "zh"]} ·{" "}
                    {english ? `${organization.memberCount} members` : `${organization.memberCount} 位成员`}
                  </p>
                </div>
              ))}
            </div>
            <Button
              onClick={switchOrganization}
              disabled={pending || selectedWorkspaceId === data.organizationSummary.activeWorkspaceId}
            >
              {english ? "Switch active organization" : "切换当前组织"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{english ? "Create another organization" : "创建新组织"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={organizationDraft.name}
              onChange={(event) => setOrganizationDraft({ name: event.target.value })}
              placeholder={english ? "For example: Helm China team" : "例如：Helm 中国团队"}
            />
            <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "A new organization immediately gets a 30-day trial, one included admin seat, two collaborator seats and the current first-party core workers. This PR does not start payment collection."
                : "新组织会立即拿到 30 天试用、1 个包含的管理员席位、2 个协作席位，以及当前的一方基础能力。本轮不会开始扣费。"}
            </div>
            <Button
              onClick={createOrganization}
              disabled={pending || organizationDraft.name.trim().length < 2}
            >
              {english ? "Create organization" : "创建组织"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{english ? "Governance and compliance boundary" : "治理与合规边界"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Info
                label={english ? "Audit events (7d)" : "近 7 天审计事件"}
                value={english ? `${data.governanceSummary.auditEvents7d}` : `${data.governanceSummary.auditEvents7d} 条`}
              />
              <Info
                label={english ? "Pending approvals" : "当前待审批"}
                value={english ? `${data.governanceSummary.pendingApprovals}` : `${data.governanceSummary.pendingApprovals} 条`}
              />
              <Info
                label={english ? "Approval-protected action types" : "受审批保护动作"}
                value={
                  english
                    ? `${data.governanceSummary.approvalProtectedActions}`
                    : `${data.governanceSummary.approvalProtectedActions} 类`
                }
              />
              <Info
                label={english ? "Safe fallback" : "安全兜底"}
                value={english ? `${data.governanceSummary.llmFallbacks7d}` : `${data.governanceSummary.llmFallbacks7d} 次`}
              />
              <Info
                label={english ? "Reusable practices" : "可复用做法"}
                value={
                  english
                    ? `${data.governanceSummary.acceptedSkillSuggestionCount}`
                    : `${data.governanceSummary.acceptedSkillSuggestionCount} 条`
                }
              />
              <Info
                label={english ? "Manual confirmation queue" : "待人工确认"}
                value={
                  english
                    ? `${data.governanceSummary.formalReviewQueueCount}`
                    : `${data.governanceSummary.formalReviewQueueCount} 条`
                }
              />
              <Info
                label={english ? "Review decisions" : "评审决定"}
                value={
                  english
                    ? `${data.governanceSummary.formalReviewDecisionCount}`
                    : `${data.governanceSummary.formalReviewDecisionCount} 条`
                }
              />
              <Info
                label={english ? "Accepted strategy suggestions" : "已收敛建议"}
                value={
                  english
                    ? `${data.governanceSummary.acceptedStrategyCount}`
                    : `${data.governanceSummary.acceptedStrategyCount} 条`
                }
              />
            </div>
            <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "High-risk actions wait for review, rule changes leave records, service failures fall back safely, and accepted adjustments become workspace rules or signals."
                : "高风险动作先等复核，规则变更会留记录，服务不可用时会安全兜底，已采纳调整会写成工作区规则或信号。"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{english ? "Walkthrough readiness prompts" : "走查前提醒"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusHint
              tone={data.governanceSummary.pendingApprovals > 0 ? "warning" : "success"}
              title={
                data.governanceSummary.pendingApprovals > 0
                  ? english
                    ? "The approval queue still has waiting actions"
                    : "复核队列里还有待处理动作"
                  : english
                    ? "The approval queue is currently clean"
                    : "复核队列当前干净"
              }
              body={
                data.governanceSummary.pendingApprovals > 0
                  ? english
                    ? "Before a live walkthrough, clear high-risk pending reviews so the dashboard and review center do not show unexpected red items."
                    : "现场走查前建议先清掉高风险待复核项，避免首页和复核中心出现未预期的红点。"
                  : english
                    ? "The current approval boundary looks stable enough for a live demo or pilot walkthrough."
                    : "当前复核边界比较稳定，适合直接进入演示或现场走查。"
              }
            />
            <StatusHint
              tone={data.governanceSummary.llmFallbacks7d > 0 ? "warning" : "success"}
              title={
                data.governanceSummary.llmFallbacks7d > 0
                  ? english
                    ? "Recent safe fallback occurred"
                    : "最近出现过安全兜底"
                  : english
                    ? "No recent safe fallback"
                    : "最近没有新的安全兜底"
              }
              body={
                data.governanceSummary.llmFallbacks7d > 0
                  ? english
                    ? "This does not mean the whole chain failed, but service configuration and quota should be checked before a live walkthrough."
                    : "这不代表链路失败，但现场走查前最好确认判断服务配置与调用额度。"
                  : english
                    ? "In the most recent data, the assisted flow has largely stayed usable."
                    : "说明最近一轮数据里，辅助判断链路基本可用。"
              }
            />
          </CardContent>
        </Card>
      </div>

      <details className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[color:var(--foreground)] marker:content-none [&::-webkit-details-marker]:hidden">
          <span>
            {english ? "Advanced: judgement service settings" : "高级：判断服务设置"}
          </span>
          <span className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-xs font-medium text-[color:var(--muted-foreground)]">
            {english ? "Open when configuring" : "配置时展开"}
          </span>
        </summary>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{english ? "Judgement service status" : "判断服务状态"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Info
              label={english ? "Status" : "接入状态"}
              value={llmConfig.enabled ? (english ? "Enabled" : "已启用") : (english ? "Disabled" : "已关闭")}
            />
            <Info
              label={english ? "Service source" : "服务来源"}
              value={formatSettingsModelProviderDetail(llmConfig.provider, english)}
            />
            <Info
              label={english ? "Default service" : "默认服务"}
              value={formatSettingsModelSelection(llmConfig.defaultModel, english)}
            />
            <Info
              label={english ? "Service credential" : "服务凭据"}
              value={
                llmConfig.providerReady
                  ? english
                    ? "Configured"
                    : "已配置"
                  : english
                    ? "Not configured, conservative fallback"
                  : "未配置，保守处理"
              }
            />
            <Info
              label={english ? "Meeting-fact service" : "会议事实服务"}
              value={formatSettingsModelSelection(llmConfig.extractionModel, english)}
            />
            <Info
              label={english ? "Briefing service" : "简报服务"}
              value={formatSettingsModelSelection(llmConfig.briefingModel, english)}
            />
            <Info
              label={english ? "Reasoning service" : "判断服务"}
              value={formatSettingsModelSelection(llmConfig.reasoningModel, english)}
            />
            <Info label={english ? "Budget tier" : "预算层"} value={llmConfig.budgetTier} />
            <Info label="Base URL" value={llmConfig.baseUrl} />
            <Info
              label={english ? "Endpoint reachability" : "端点连通性"}
              value={
                llmConfig.connectionProbe.reachable
                  ? english
                    ? llmConfig.connectionProbe.probeMode === "chat_completions_options"
                      ? "Endpoint reachable"
                      : "Endpoint reachable (healthz)"
                    : llmConfig.connectionProbe.probeMode === "chat_completions_options"
                      ? "端点可达"
                      : "端点可达（healthz）"
                  : english
                    ? `Unavailable: ${llmConfig.connectionProbe.errorMessage ?? "unknown"}`
                    : `不可用：${llmConfig.connectionProbe.errorMessage ?? "未知错误"}`
              }
            />
            <Info
              label={english ? "Default service availability" : "默认服务可用性"}
              value={
                english
                  ? "Skipped (model list probe not required)"
                  : "已跳过（不要求服务清单探测）"
              }
            />
            <Info
              label={english ? "Local default" : "本地默认值"}
              value={llmConfig.localGemmaModel}
            />
          </div>
          <div className="theme-surface-panel rounded-2xl px-4 py-4">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Service switch" : "判断服务切换"}
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs text-[color:var(--muted-foreground)]">{english ? "Service source" : "服务来源"}</p>
                <Select
                  value={llmDraft.provider}
                  disabled={!canManageWorkspaceSetup}
                  onValueChange={(value) =>
                    setLlmDraft((previous) => ({
                      ...previous,
                      provider: value === "qwen" ? "qwen" : "openai",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI Compatible (Local / OpenAI)</SelectItem>
                    <SelectItem value="qwen">Qwen (DashScope)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-[color:var(--muted-foreground)]">{english ? "Default service" : "默认服务"}</p>
                <Select
                  value={llmDraft.defaultModel}
                  disabled={!canManageWorkspaceSetup}
                  onValueChange={(value) => setLlmDraft((previous) => ({ ...previous, defaultModel: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mergedModelOptions.map((option) => (
                      <SelectItem key={`default-${option.value}`} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-[color:var(--muted-foreground)]">{english ? "Meeting-fact service" : "会议事实服务"}</p>
                <Select
                  value={llmDraft.extractionModel}
                  disabled={!canManageWorkspaceSetup}
                  onValueChange={(value) => setLlmDraft((previous) => ({ ...previous, extractionModel: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mergedModelOptions.map((option) => (
                      <SelectItem key={`extraction-${option.value}`} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-[color:var(--muted-foreground)]">{english ? "Briefing service" : "简报服务"}</p>
                <Select
                  value={llmDraft.briefingModel}
                  disabled={!canManageWorkspaceSetup}
                  onValueChange={(value) => setLlmDraft((previous) => ({ ...previous, briefingModel: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mergedModelOptions.map((option) => (
                      <SelectItem key={`briefing-${option.value}`} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-[color:var(--muted-foreground)]">{english ? "Reasoning service" : "判断服务"}</p>
                <Select
                  value={llmDraft.reasoningModel}
                  disabled={!canManageWorkspaceSetup}
                  onValueChange={(value) => setLlmDraft((previous) => ({ ...previous, reasoningModel: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mergedModelOptions.map((option) => (
                      <SelectItem key={`reasoning-${option.value}`} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!canManageWorkspaceSetup ? (
              <p className="mt-4 text-xs leading-6 text-[color:var(--muted-foreground)]">
                {english
                  ? "Your current role can inspect the service posture, but workspace setup managers must change service source or service selections."
                  : "当前角色可以查看服务状态；服务来源和服务选择需要工作区设置管理员修改。"}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                data-testid="settings-assistive-service-save"
                onClick={saveWorkspaceLLMConfig}
                disabled={pending || !canManageWorkspaceSetup}
                variant="outline"
              >
                {english ? "Save judgement service" : "保存判断服务配置"}
              </Button>
            </div>
            <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
              {english
                ? "Saving uses your selected service values directly. Helm only checks endpoint health and does not require /models probing."
                : "保存时按你选择的服务值直接写入；这里只检查服务是否可用，不要求额外探测。"}
            </p>
          </div>
          <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
            {english
              ? "Ranking, reviews and rules still follow workspace controls. The service only helps organize meeting facts, briefings and explanations. If it is not configured or fails, Helm keeps the rule-based result and records the safe fallback."
              : "排序、复核和规则仍按工作区控制走；判断服务只帮助整理会议事实、简报和说明。若未配置或调用失败，Helm 会保留规则结果，并记录安全兜底原因。"}
          </div>
          <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="theme-surface-panel space-y-3 rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {english ? "Service capabilities" : "服务能力"}
              </p>
              {llmConfig.providerSummaries.map((provider) => (
                <div key={provider.provider} className="workspace-panel rounded-2xl px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[color:var(--foreground)]">
                      {formatSettingsModelProviderName(provider, english)}
                    </p>
                    <Badge variant={provider.configured ? "success" : "warning"}>
                      {provider.configured
                        ? english
                          ? "Configured"
                          : "已配置"
                        : english
                          ? "Not configured"
                        : "未配置"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                    {formatSettingsModelProviderDetail(provider.provider, english)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {provider.capabilities.structuredOutput ? (
                      <Badge variant="info">{english ? "Stable field output" : "稳定字段输出"}</Badge>
                    ) : null}
                    {provider.capabilities.configurableBaseUrl ? (
                      <Badge variant="neutral">{english ? "Configurable base URL" : "可自定义 Base URL"}</Badge>
                    ) : null}
                    {provider.capabilities.audioTranscription ? (
                      <Badge variant="approval">{english ? "Audio transcription" : "支持音频转写"}</Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="theme-surface-panel space-y-3 rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {english ? "Current prompt registry" : "当前说明模板"}
              </p>
              {llmConfig.promptSummaries.map((prompt) => (
                <div key={prompt.key} className="workspace-panel rounded-2xl px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[color:var(--foreground)]">
                      {formatSettingsPromptName(prompt.key, english)}
                    </p>
                    <Badge variant="info">{formatSettingsPromptVersion(prompt.version, english)}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {formatSettingsPromptDescription(prompt.description, english)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {prompt.taskTypes.map((taskType) => (
                      <Badge key={taskType} variant="neutral">
                        {formatSettingsPromptTaskType(taskType, english)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {crmSources.length ? (
              crmSources.map((source) => (
                <div key={source.id} className="theme-surface-panel-soft rounded-[20px] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[color:var(--foreground)]">
                        {source.sourceType === "HUBSPOT" ? "HubSpot" : "Salesforce"}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        {source.externalAccountLabel ?? (english ? "Unnamed CRM source" : "未命名客户关系系统来源")}
                      </p>
                    </div>
                    <Badge
                      variant={
                        source.status === "CONNECTED"
                          ? "success"
                          : source.status === "ERROR"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {formatSettingsConnectorStatus(source.status, english)}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Info
                      label={english ? "Auth mode" : "认证方式"}
                      value={formatSettingsConnectorAuthMode(source.authMode, english)}
                    />
                    <Info
                      label={english ? "Last sync" : "最近同步"}
                      value={
                        source.lastSyncedAt
                          ? formatDateLabel(source.lastSyncedAt)
                          : english
                            ? "No sync yet"
                            : "还没有同步"
                      }
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="theme-surface-panel-dashed rounded-[20px] p-4 text-sm text-[color:var(--muted-foreground)]">
                {english
                  ? "There is no CRM import source yet. If a pilot customer already has HubSpot or Salesforce, connect it first from `/imports/crm`."
                  : "还没有客户关系系统导入来源。试点客户如果已有 HubSpot / Salesforce，建议先去 `/imports/crm` 接入。"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </details>
    </TabsContent>
  );
}
