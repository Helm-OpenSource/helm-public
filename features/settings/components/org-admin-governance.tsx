"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSettingsBoundaryNote } from "@/features/settings/display-copy";
import { formatSettingsDateLabel } from "@/features/settings/formatters/settings-date-labels";
import {
  formatAuthControlConsistencyOverview,
  formatAuthSessionAnomalyInventorySummary,
  formatAuthSessionAnomalyMarker,
  formatAuthSessionLiveRevokeSummary,
  formatAuthSessionPreviewVsExecutedScopeSummary,
  formatAuthSessionReviewScopeSummary,
  formatAuthSessionRevokeConsistencySummary,
  formatAuthSessionScopeRevokeSummary,
  formatLatestAuthAnomalyFollowThroughSummary,
  formatLatestMarkerCoverageSummary,
  formatRevokeExecutionAggregateSummary,
  type AuthSessionRevokeScope,
} from "@/features/settings/formatters/auth-session-formatters";
import {
  formatAuthSessionProvider,
  formatGovernanceAuditMarker,
  formatGovernanceAuditSummary,
  formatGovernanceAuditTargetType,
  formatIdentityMatchMarker,
  formatWebhookCallbackMarker,
  organizationAuditActionLabels,
} from "@/features/settings/formatters/governance-formatters";
import type { SettingsClientProps } from "@/features/settings/types/settings-client-props";
import { Info } from "./settings-display";

type SettingsOrganizationAudit = SettingsClientProps["data"]["organizationAudit"];
type SettingsOrganizationGovernance = SettingsClientProps["data"]["organizationGovernance"];

type OrgAdminGovernanceCapabilities = {
  canExportOrganizationSupportPack: boolean;
  canManageBilling: boolean;
  canManageConnectors: boolean;
  canManageContributionRegistry: boolean;
  canManageGovernedActions: boolean;
  canManageImports: boolean;
  canManageInsights: boolean;
  canManageInternalActions: boolean;
  canManageManualSettlement: boolean;
  canManageMembers: boolean;
  canManageOperationalControls: boolean;
  canManageParticipantPortal: boolean;
  canManagePolicies: boolean;
  canManageProgramApplications: boolean;
  canManageWorkspaceRecords: boolean;
  canManageWorkspaceSetup: boolean;
  canReadOrganizationAudit: boolean;
  canResolveImportConflicts: boolean;
  canReviewGovernedActions: boolean;
};

type RecentOrgAdminAuditProps = {
  canReadOrganizationAudit: boolean;
  english: boolean;
  organizationAudit: SettingsOrganizationAudit;
};

type OrgAdminGovernanceSupportPackProps = {
  capabilities: OrgAdminGovernanceCapabilities;
  currentAuthSessionId: string | null;
  english: boolean;
  organizationGovernance: SettingsOrganizationGovernance;
  pending: boolean;
  revokeAuthSession: (sessionId: string) => void;
  revokeAuthSessionsByScope: (scope: AuthSessionRevokeScope) => void;
  rotateCurrentAuthSession: () => void;
};

function getOrganizationAuditActionLabel(actionType: string, english: boolean) {
  return (
    organizationAuditActionLabels[
      actionType as keyof typeof organizationAuditActionLabels
    ]?.[english ? "en" : "zh"] ?? actionType
  );
}

export function RecentOrgAdminAudit({
  canReadOrganizationAudit,
  english,
  organizationAudit,
}: RecentOrgAdminAuditProps) {
  return (
    <div className="space-y-3 border-t border-[color:var(--border)] pt-4">
      <div>
        <p className="text-sm font-semibold text-[color:var(--foreground)]">
          {english ? "Recent org-admin audit" : "最近的组织管理员审计"}
        </p>
        <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
          {english
            ? "Key member and ownership actions stay readable here so org-admin changes do not disappear into aggregate counts only."
            : "这里会保留关键成员和负责人动作的最近回放，避免组织管理员操作只剩聚合数量。"}
        </p>
      </div>
      {canReadOrganizationAudit ? (
        organizationAudit.length ? (
          <div data-testid="organization-audit-feed" className="space-y-3">
            {organizationAudit.map((item) => (
              <div key={item.id} className="theme-surface-panel-soft rounded-2xl px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">
                    {getOrganizationAuditActionLabel(item.actionType, english)}
                  </Badge>
                  <span className="text-xs text-[color:var(--muted-foreground)]">
                    {formatSettingsDateLabel(item.createdAt, english)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-[color:var(--foreground)]">
                  {formatGovernanceAuditSummary(item.summary, english)}
                </p>
                <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                  {english ? "Actor" : "操作者"}：{item.actor} · {english ? "Target" : "目标"}：
                  {formatGovernanceAuditTargetType(item.targetType, english)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title={english ? "No recent org-admin audit yet" : "最近还没有新的组织管理员审计"}
            description={
              english
                ? "Once member or ownership actions happen, the latest audit replay will appear here."
                : "一旦发生成员或负责人动作，最近的审计回放会显示在这里。"
            }
          />
        )
      ) : (
        <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
          {english
            ? "Recent org-admin audit stays visible only to owner, billing admin and admin."
            : "最近的组织管理员审计只对负责人、计费管理员和管理员可见。"}
        </div>
      )}
    </div>
  );
}

export function OrgAdminGovernanceSupportPack({
  capabilities,
  currentAuthSessionId,
  english,
  organizationGovernance,
  pending,
  revokeAuthSession,
  revokeAuthSessionsByScope,
  rotateCurrentAuthSession,
}: OrgAdminGovernanceSupportPackProps) {
  return (
    <div className="space-y-3 border-t border-[color:var(--border)] pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {english ? "Org-admin governance support pack" : "组织治理支持包"}
          </p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
            {english
              ? "This pack keeps retention, auth-session, export/delete, and audit posture tenant-scoped and reviewable. Export remains a read-first governance move, not a new execution path."
              : "这份支持包把保留期、认证会话、导出/删除和审计姿态收成租户范围内的治理快照。导出仍然是只读优先的治理动作，不是新的执行路径。"}
          </p>
        </div>
        {capabilities.canReadOrganizationAudit && capabilities.canExportOrganizationSupportPack ? (
          <Button variant="secondary" size="sm" asChild>
            <a
              href="/api/settings/org-admin/support-pack"
              data-testid="organization-support-pack-download"
            >
              {english ? "Download support pack" : "下载支持包"}
            </a>
          </Button>
        ) : null}
      </div>
      {capabilities.canReadOrganizationAudit && organizationGovernance ? (
        <div data-testid="organization-support-pack" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Info
              label={english ? "Retention" : "保留期"}
              value={
                english
                  ? `${organizationGovernance.workspace.dataRetentionDays ?? 0} days`
                  : `${organizationGovernance.workspace.dataRetentionDays ?? 0} 天`
              }
            />
            <Info
              label={english ? "Active auth sessions" : "当前活跃会话"}
              value={
                english
                  ? `${organizationGovernance.authSessionSummary.activeSessionCount}`
                  : `${organizationGovernance.authSessionSummary.activeSessionCount} 个`
              }
            />
            <Info
              label={english ? "Expiring soon auth sessions" : "即将过期会话"}
              value={
                english
                  ? `${organizationGovernance.authSessionSummary.expiringSoonSessionCount}`
                  : `${organizationGovernance.authSessionSummary.expiringSoonSessionCount} 个`
              }
            />
            <Info
              label={english ? "Stale active sessions" : "陈旧活跃会话"}
              value={
                english
                  ? `${organizationGovernance.authSessionSummary.staleActiveSessionCount}`
                  : `${organizationGovernance.authSessionSummary.staleActiveSessionCount} 个`
              }
            />
            <Info
              label={english ? "Legacy provider sessions" : "旧来源服务商会话"}
              value={
                english
                  ? `${organizationGovernance.authSessionSummary.legacyProviderSessionCount}`
                  : `${organizationGovernance.authSessionSummary.legacyProviderSessionCount} 个`
              }
            />
            <Info
              label={english ? "Missing source-page sessions" : "缺少来源页会话"}
              value={
                english
                  ? `${organizationGovernance.authSessionSummary.missingSourcePageSessionCount}`
                  : `${organizationGovernance.authSessionSummary.missingSourcePageSessionCount} 个`
              }
            />
            <Info
              label={english ? "Provider/source mismatches" : "来源服务商 / 来源页不一致"}
              value={
                english
                  ? `${organizationGovernance.authSessionSummary.providerSourceMismatchSessionCount}`
                  : `${organizationGovernance.authSessionSummary.providerSourceMismatchSessionCount} 个`
              }
            />
            <Info
              label={english ? "Membership mismatches" : "成员归属不一致"}
              value={
                english
                  ? `${organizationGovernance.authSessionSummary.workspaceMembershipMismatchSessionCount}`
                  : `${organizationGovernance.authSessionSummary.workspaceMembershipMismatchSessionCount} 个`
              }
            />
            <Info
              label={english ? "Rotated sessions / 30d" : "30 天轮换会话"}
              value={
                english
                  ? `${organizationGovernance.authSessionSummary.rotatedSessionCount30d}`
                  : `${organizationGovernance.authSessionSummary.rotatedSessionCount30d} 次`
              }
            />
            <Info
              label={english ? "Realigned sessions / 30d" : "30 天纠偏会话"}
              value={
                english
                  ? `${organizationGovernance.authSessionSummary.realignedSessionCount30d}`
                  : `${organizationGovernance.authSessionSummary.realignedSessionCount30d} 次`
              }
            />
            <Info
              label={english ? "Scoped revoke actions / 30d" : "30 天范围级撤销动作"}
              value={
                english
                  ? `${organizationGovernance.authSessionSummary.scopeRevokeActionCount30d}`
                  : `${organizationGovernance.authSessionSummary.scopeRevokeActionCount30d} 次`
              }
            />
            <Info
              label={english ? "Scoped revoked sessions / 30d" : "30 天范围级撤销会话"}
              value={
                english
                  ? `${organizationGovernance.authSessionSummary.scopeRevokedSessionCount30d}`
                  : `${organizationGovernance.authSessionSummary.scopeRevokedSessionCount30d} 个`
              }
            />
            <Info
              label={english ? "Org-admin audit / 30d" : "30 天组织审计"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.orgAdminAuditCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.orgAdminAuditCount30d} 条`
              }
            />
            <Info
              label={english ? "Governance audit / 30d" : "30 天治理审计"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.dataGovernanceAuditCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.dataGovernanceAuditCount30d} 条`
              }
            />
            <Info
              label={english ? "Member actions / 30d" : "30 天成员动作"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.membershipActionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.membershipActionCount30d} 次`
              }
            />
            <Info
              label={english ? "Workspace governance / 30d" : "30 天工作区治理"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.workspaceGovernanceActionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.workspaceGovernanceActionCount30d} 次`
              }
            />
            <Info
              label={english ? "Workspace record writes / 30d" : "30 天工作区记录写入"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.workspaceDataActionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.workspaceDataActionCount30d} 次`
              }
            />
            <Info
              label={english ? "Internal actions / 30d" : "30 天内部动作"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.internalActionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.internalActionCount30d} 次`
              }
            />
            <Info
              label={english ? "Insight governance / 30d" : "30 天洞察治理"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.insightGovernanceActionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.insightGovernanceActionCount30d} 次`
              }
            />
            <Info
              label={english ? "Auth-session events / 30d" : "30 天会话事件"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.authSessionEventCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.authSessionEventCount30d} 次`
              }
            />
            <Info
              label={english ? "Support-pack exports / 30d" : "30 天支持包导出"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.supportPackExportCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.supportPackExportCount30d} 次`
              }
            />
            <Info
              label={english ? "Data exports / 30d" : "30 天数据导出"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.exportActionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.exportActionCount30d} 次`
              }
            />
            <Info
              label={english ? "Delete actions / 30d" : "30 天删除动作"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.deleteActionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.deleteActionCount30d} 次`
              }
            />
            <Info
              label={english ? "Retention updates / 30d" : "30 天保留更新"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.retentionUpdateCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.retentionUpdateCount30d} 次`
              }
            />
            <Info
              label={english ? "Billing actions / 30d" : "30 天订阅动作"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.billingActionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.billingActionCount30d} 次`
              }
            />
            <Info
              label={english ? "Webhook tenancy mappings / 30d" : "30 天计费回调租户映射"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.billingWebhookResolutionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.billingWebhookResolutionCount30d} 次`
              }
            />
            <Info
              label={english ? "Webhook hint fallbacks / 30d" : "30 天计费回调提示回退"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.billingWebhookHintFallbackCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.billingWebhookHintFallbackCount30d} 次`
              }
            />
            <Info
              label={english ? "Webhook hint mismatches / 30d" : "30 天计费回调提示不匹配"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.billingWebhookHintMismatchCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.billingWebhookHintMismatchCount30d} 次`
              }
            />
            <Info
              label={english ? "Webhook duplicate chains / 30d" : "30 天计费回调重复链路"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.billingWebhookDuplicateChainCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.billingWebhookDuplicateChainCount30d} 次`
              }
            />
            <Info
              label={english ? "Webhook hinted verification failures / 30d" : "30 天计费回调提示验签失败"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.billingWebhookVerificationFailureHintCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.billingWebhookVerificationFailureHintCount30d} 次`
              }
            />
            <Info
              label={english ? "Webhook unresolved hints / 30d" : "30 天计费回调未决提示"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.billingWebhookUnresolvedHintCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.billingWebhookUnresolvedHintCount30d} 次`
              }
            />
            <Info
              label={english ? "Webhook mapped exceptions / 30d" : "30 天计费回调映射后异常"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.billingWebhookMappedExceptionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.billingWebhookMappedExceptionCount30d} 次`
              }
            />
            <Info
              label={english ? "Registry actions / 30d" : "30 天登记动作"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.contributionRegistryActionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.contributionRegistryActionCount30d} 次`
              }
            />
            <Info
              label={english ? "Portal actions / 30d" : "30 天门户动作"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.participantPortalActionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.participantPortalActionCount30d} 次`
              }
            />
            <Info
              label={english ? "Program actions / 30d" : "30 天合作项目动作"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.programActionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.programActionCount30d} 次`
              }
            />
            <Info
              label={english ? "Settlement actions / 30d" : "30 天结算动作"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.settlementActionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.settlementActionCount30d} 次`
              }
            />
            <Info
              label={english ? "Settlement exports / 30d" : "30 天结算导出"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.settlementBatchExportCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.settlementBatchExportCount30d} 次`
              }
            />
            <Info
              label={english ? "Memory exports / 30d" : "30 天记忆导出"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.memoryExportCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.memoryExportCount30d} 次`
              }
            />
            <Info
              label={english ? "Memory mutations / 30d" : "30 天记忆改动"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.memoryMutationCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.memoryMutationCount30d} 次`
              }
            />
            <Info
              label={english ? "Deleted entries" : "已删除条目"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.softDeletedMemoryEntryCount}`
                  : `${organizationGovernance.dataGovernanceSummary.softDeletedMemoryEntryCount} 条`
              }
            />
            <Info
              label={english ? "Invalid facts" : "失效事实"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.invalidMemoryFactCount}`
                  : `${organizationGovernance.dataGovernanceSummary.invalidMemoryFactCount} 条`
              }
            />
            <Info
              label={english ? "Connector actions / 30d" : "30 天连接器动作"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.connectorActionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.connectorActionCount30d} 次`
              }
            />
            <Info
              label={english ? "Import actions / 30d" : "30 天导入动作"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.importActionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.importActionCount30d} 次`
              }
            />
            <Info
              label={english ? "Conflict resolutions / 30d" : "30 天冲突处理"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.importConflictResolutionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.importConflictResolutionCount30d} 次`
              }
            />
            <Info
              label={english ? "CRM imports / 30d" : "30 天客户关系系统导入"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.crmImportCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.crmImportCount30d} 次`
              }
            />
            <Info
              label={english ? "Identity matches / 30d" : "30 天身份匹配"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.identityMatchWriteCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.identityMatchWriteCount30d} 次`
              }
            />
            <Info
              label={english ? "Identity matches needing review / 30d" : "30 天待复核身份匹配"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.identityMatchNeedsReviewCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.identityMatchNeedsReviewCount30d} 次`
              }
            />
            <Info
              label={english ? "Governed action audits / 30d" : "30 天受控动作审计"}
              value={
                english
                  ? `${organizationGovernance.dataGovernanceSummary.actionGovernanceActionCount30d}`
                  : `${organizationGovernance.dataGovernanceSummary.actionGovernanceActionCount30d} 次`
              }
            />
          </div>
          <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
            <p className="font-medium text-[color:var(--foreground)]">
              {english ? "Current governance posture" : "当前治理姿态"}
            </p>
            <p className="mt-2">
              {english
                ? `Active seats ${organizationGovernance.membershipSummary.activeSeatCount}, invited seats ${organizationGovernance.membershipSummary.invitedSeatCount}, owners ${organizationGovernance.membershipSummary.ownerCount}, billing admins ${organizationGovernance.membershipSummary.billingAdminCount}, admins ${organizationGovernance.membershipSummary.adminCount}.`
                : `活跃席位 ${organizationGovernance.membershipSummary.activeSeatCount} 个、邀请中 ${organizationGovernance.membershipSummary.invitedSeatCount} 个、负责人 ${organizationGovernance.membershipSummary.ownerCount} 个、计费管理员 ${organizationGovernance.membershipSummary.billingAdminCount} 个、管理员 ${organizationGovernance.membershipSummary.adminCount} 个。`}
            </p>
            <p className="mt-2">
              {english
                ? `Support pack exports in the last 30 days: ${organizationGovernance.dataGovernanceSummary.supportPackExportCount30d}. Enabled feature flags: ${organizationGovernance.workspace.featureFlagCount}.`
                : `近 30 天支持包导出 ${organizationGovernance.dataGovernanceSummary.supportPackExportCount30d} 次；当前启用功能开关 ${organizationGovernance.workspace.featureFlagCount} 个。`}
            </p>
            <p className="mt-2">
              {english
                ? `Billing is ${capabilities.canManageBilling ? "enabled" : "read-only"} · registry is ${capabilities.canManageContributionRegistry ? "enabled" : "read-only"} · participant portal is ${capabilities.canManageParticipantPortal ? "enabled" : "read-only"} · program governance is ${capabilities.canManageProgramApplications ? "enabled" : "read-only"} · manual settlement is ${capabilities.canManageManualSettlement ? "enabled" : "read-only"}.`
                : `订阅管理当前为${capabilities.canManageBilling ? "可操作" : "只读"} · 登记管理当前为${capabilities.canManageContributionRegistry ? "可操作" : "只读"} · 贡献方门户当前为${capabilities.canManageParticipantPortal ? "可操作" : "只读"} · 合作项目治理当前为${capabilities.canManageProgramApplications ? "可操作" : "只读"} · 手工结算当前为${capabilities.canManageManualSettlement ? "可操作" : "只读"}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Member lifecycle is ${capabilities.canManageMembers ? "enabled" : "read-only"} · workspace setup is ${capabilities.canManageWorkspaceSetup ? "enabled" : "read-only"} · policies are ${capabilities.canManagePolicies ? "enabled" : "read-only"} · operational controls are ${capabilities.canManageOperationalControls ? "enabled" : "read-only"} · support-pack export is ${capabilities.canExportOrganizationSupportPack ? "enabled" : "read-only"}.`
                : `成员生命周期当前为${capabilities.canManageMembers ? "可操作" : "只读"} · 工作区初始化当前为${capabilities.canManageWorkspaceSetup ? "可操作" : "只读"} · 策略当前为${capabilities.canManagePolicies ? "可操作" : "只读"} · 运营控制当前为${capabilities.canManageOperationalControls ? "可操作" : "只读"} · 支持包导出当前为${capabilities.canExportOrganizationSupportPack ? "可操作" : "只读"}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Connector management is ${capabilities.canManageConnectors ? "enabled" : "read-only"} · import management is ${capabilities.canManageImports ? "enabled" : "read-only"} · conflict resolution is ${capabilities.canResolveImportConflicts ? "enabled" : "read-only"}.`
                : `连接器管理当前为${capabilities.canManageConnectors ? "可操作" : "只读"} · 导入管理当前为${capabilities.canManageImports ? "可操作" : "只读"} · 冲突处理当前为${capabilities.canResolveImportConflicts ? "可操作" : "只读"}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Workspace record writes are ${capabilities.canManageWorkspaceRecords ? "enabled" : "read-only"} · internal action approve/execute is ${capabilities.canManageInternalActions ? "enabled" : "read-only"}.`
                : `工作区记录写入当前为${capabilities.canManageWorkspaceRecords ? "可操作" : "只读"} · 内部动作批准/执行当前为${capabilities.canManageInternalActions ? "可操作" : "只读"}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Governed action creation is ${capabilities.canManageGovernedActions ? "enabled" : "read-only"} · governed action review is ${capabilities.canReviewGovernedActions ? "enabled" : "read-only"}.`
                : `受控动作创建当前为${capabilities.canManageGovernedActions ? "可操作" : "只读"} · 受控动作复核当前为${capabilities.canReviewGovernedActions ? "可操作" : "只读"}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Weekly reports and recommendation feedback are ${capabilities.canManageInsights ? "enabled" : "read-only"} · strategy suggestion adoption stays ${capabilities.canManagePolicies ? "enabled" : "read-only"} under workspace policy controls.`
                : `周报生成和建议反馈当前为${capabilities.canManageInsights ? "可操作" : "只读"} · 策略建议采纳仍由工作区策略控制，当前为${capabilities.canManagePolicies ? "可操作" : "只读"}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Latest membership activity: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestMembershipAudit, true)} · latest workspace governance activity: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestWorkspaceGovernanceAudit, true)} · latest auth-session activity: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestAuthSessionAudit, true)} · latest support-pack export: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestSupportPackAudit, true)}.`
                : `最近一次成员治理动作：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestMembershipAudit, false)} · 最近一次工作区治理动作：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestWorkspaceGovernanceAudit, false)} · 最近一次会话动作：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestAuthSessionAudit, false)} · 最近一次支持包导出：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestSupportPackAudit, false)}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Auth-session anomaly review: ${organizationGovernance.authSessionSummary.expiringSoonSessionCount} expiring soon, ${organizationGovernance.authSessionSummary.staleActiveSessionCount} stale active, ${organizationGovernance.authSessionSummary.legacyProviderSessionCount} legacy-provider sessions, ${organizationGovernance.authSessionSummary.missingSourcePageSessionCount} missing source-page sessions, ${organizationGovernance.authSessionSummary.missingWorkspaceSwitchMarkerSessionCount} missing workspace-switch markers, ${organizationGovernance.authSessionSummary.providerSourceMismatchSessionCount} provider/source mismatches, ${organizationGovernance.authSessionSummary.workspaceMembershipMismatchSessionCount} workspace-membership mismatches, ${organizationGovernance.authSessionSummary.rotatedSessionCount30d} rotations, and ${organizationGovernance.authSessionSummary.realignedSessionCount30d} membership-driven realignments in the last 30 days.`
                : `认证会话异常复核：即将过期 ${organizationGovernance.authSessionSummary.expiringSoonSessionCount} 个，陈旧活跃 ${organizationGovernance.authSessionSummary.staleActiveSessionCount} 个，旧来源服务商 ${organizationGovernance.authSessionSummary.legacyProviderSessionCount} 个，缺少来源页 ${organizationGovernance.authSessionSummary.missingSourcePageSessionCount} 个，缺少工作区切换标记 ${organizationGovernance.authSessionSummary.missingWorkspaceSwitchMarkerSessionCount} 个，来源服务商 / 来源页不一致 ${organizationGovernance.authSessionSummary.providerSourceMismatchSessionCount} 个，工作区成员归属不一致 ${organizationGovernance.authSessionSummary.workspaceMembershipMismatchSessionCount} 个，近 30 天轮换 ${organizationGovernance.authSessionSummary.rotatedSessionCount30d} 次，基于成员归属的纠偏 ${organizationGovernance.authSessionSummary.realignedSessionCount30d} 次。`}
            </p>
            <p className="mt-2">
              {english
                ? "Entry-source truth stays on the auth session record; action-source truth for rotate and revoke audits is tracked separately for operator review."
                : "入口来源真实状态保留在认证会话记录上；轮换和撤销的动作来源真实状态会单独记录为运营复核审计信息。"}
            </p>
            <p className="mt-2">
              {english
                ? `Live anomaly inventory: ${formatAuthSessionAnomalyInventorySummary(organizationGovernance.authSessionSummary.anomalyInventorySummary, true)}`
                : `当前异常清单：${formatAuthSessionAnomalyInventorySummary(organizationGovernance.authSessionSummary.anomalyInventorySummary, false)}`}
            </p>
            <p className="mt-2">
              {english
                ? `Scoped revoke follow-through: ${organizationGovernance.authSessionSummary.scopeRevokeActionCount30d} bulk revoke actions covering ${organizationGovernance.authSessionSummary.scopeRevokedSessionCount30d} sessions in the last 30 days. ${formatAuthSessionScopeRevokeSummary(organizationGovernance.authSessionSummary.revokeScopeSummary30d, true)}`
                : `范围级批量撤销跟进：近 30 天执行 ${organizationGovernance.authSessionSummary.scopeRevokeActionCount30d} 次，覆盖 ${organizationGovernance.authSessionSummary.scopeRevokedSessionCount30d} 个会话。${formatAuthSessionScopeRevokeSummary(organizationGovernance.authSessionSummary.revokeScopeSummary30d, false)}`}
            </p>
            <p className="mt-2">
              {english
                ? `Live revoke review: ${formatAuthSessionLiveRevokeSummary(organizationGovernance.authSessionSummary.liveRevokeScopeSummary, true)}`
                : `当前撤销候选复核：${formatAuthSessionLiveRevokeSummary(organizationGovernance.authSessionSummary.liveRevokeScopeSummary, false)}`}
            </p>
            <p className="mt-2">
              {english
                ? `Scoped revoke consistency: ${formatAuthSessionRevokeConsistencySummary(organizationGovernance.authSessionSummary.revokeConsistencySummary, true)}`
                : `范围级撤销一致性：${formatAuthSessionRevokeConsistencySummary(organizationGovernance.authSessionSummary.revokeConsistencySummary, false)}`}
            </p>
            <p className="mt-2">
              {english
                ? `Auth-control consistency overview: ${formatAuthControlConsistencyOverview(organizationGovernance.authSessionSummary.authControlConsistencyOverview, true)}`
                : `身份控制一致性总览：${formatAuthControlConsistencyOverview(organizationGovernance.authSessionSummary.authControlConsistencyOverview, false)}`}
            </p>
            <p className="mt-2">
              {english
                ? `Latest anomaly follow-through: ${formatLatestAuthAnomalyFollowThroughSummary(organizationGovernance.authSessionSummary.latestAnomalyFollowThroughSummary, true)}`
                : `最近一次异常跟进：${formatLatestAuthAnomalyFollowThroughSummary(organizationGovernance.authSessionSummary.latestAnomalyFollowThroughSummary, false)}`}
            </p>
            <p className="mt-2">
              {english
                ? `Latest marker coverage: ${formatLatestMarkerCoverageSummary(organizationGovernance.authSessionSummary.latestMarkerCoverageSummary, true)}`
                : `最近标记覆盖率：${formatLatestMarkerCoverageSummary(organizationGovernance.authSessionSummary.latestMarkerCoverageSummary, false)}`}
            </p>
            <p className="mt-2">
              {english
                ? `Aggregate revoke execution: ${formatRevokeExecutionAggregateSummary(organizationGovernance.authSessionSummary.revokeExecutionAggregateSummary, true)}`
                : `聚合撤销执行概览：${formatRevokeExecutionAggregateSummary(organizationGovernance.authSessionSummary.revokeExecutionAggregateSummary, false)}`}
            </p>
            <p className="mt-2">
              {english
                ? `Current-session review-only anomaly scopes: ${formatAuthSessionReviewScopeSummary(organizationGovernance.authSessionSummary.currentSessionReviewScopeSummary, true)}`
                : `当前会话仅供复核的异常范围：${formatAuthSessionReviewScopeSummary(organizationGovernance.authSessionSummary.currentSessionReviewScopeSummary, false)}`}
            </p>
            <p className="mt-2">
              {english
                ? `Preview-vs-executed revoke delta: ${formatAuthSessionPreviewVsExecutedScopeSummary(organizationGovernance.authSessionSummary.previewVsExecutedScopeSummary, true)}`
                : `预估与实际执行的撤销差异：${formatAuthSessionPreviewVsExecutedScopeSummary(organizationGovernance.authSessionSummary.previewVsExecutedScopeSummary, false)}`}
            </p>
            <p className="mt-2">
              {english
                ? `Latest auth-session anomaly marker: ${formatAuthSessionAnomalyMarker(organizationGovernance.authSessionSummary.latestAnomalyMarker, true)}.`
                : `最近一次认证会话异常标记：${formatAuthSessionAnomalyMarker(organizationGovernance.authSessionSummary.latestAnomalyMarker, false)}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Latest workspace realignment: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestWorkspaceRealignmentAudit, true)}.`
                : `最近一次会话工作区纠偏：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestWorkspaceRealignmentAudit, false)}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Latest scoped revoke activity: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestScopedSessionRevokeAudit, true)}.`
                : `最近一次范围级批量撤销：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestScopedSessionRevokeAudit, false)}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Latest auth-session anomaly follow-through: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestAuthSessionAnomalyFollowThroughAudit, true)}.`
                : `最近一次认证会话异常跟进：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestAuthSessionAnomalyFollowThroughAudit, false)}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Latest workspace record activity: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestWorkspaceDataAudit, true)} · latest internal action activity: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestInternalActionAudit, true)}.`
                : `最近一次工作区记录动作：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestWorkspaceDataAudit, false)} · 最近一次内部动作：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestInternalActionAudit, false)}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Latest export: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestExportAudit, true)} · latest delete: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestDeleteAudit, true)} · latest retention update: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestRetentionAudit, true)}.`
                : `最近一次导出：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestExportAudit, false)} · 最近一次删除：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestDeleteAudit, false)} · 最近一次保留更新：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestRetentionAudit, false)}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Data-governance closure: export ${organizationGovernance.dataGovernanceClosure.exportScopedToWorkspace ? "scoped" : "missing scope"} (owner ${organizationGovernance.dataGovernanceClosure.latestExportOwner ?? "unknown"}, source ${organizationGovernance.dataGovernanceClosure.latestExportSourcePage ?? "n/a"}) · delete ${organizationGovernance.dataGovernanceClosure.deleteScopedToWorkspace ? "scoped" : "missing scope"} (owner ${organizationGovernance.dataGovernanceClosure.latestDeleteOwner ?? "unknown"}, source ${organizationGovernance.dataGovernanceClosure.latestDeleteSourcePage ?? "n/a"}) · retention ${organizationGovernance.dataGovernanceClosure.retentionScopedToWorkspace ? "scoped" : "missing scope"} (owner ${organizationGovernance.dataGovernanceClosure.latestRetentionOwner ?? "unknown"}, source ${organizationGovernance.dataGovernanceClosure.latestRetentionSourcePage ?? "n/a"}) · support-pack ${organizationGovernance.dataGovernanceClosure.supportPackScopedToWorkspace ? "scoped" : "missing scope"} (owner ${organizationGovernance.dataGovernanceClosure.latestSupportPackOwner ?? "unknown"}, source ${organizationGovernance.dataGovernanceClosure.latestSupportPackSourcePage ?? "n/a"}) · sensitive writes ${organizationGovernance.dataGovernanceClosure.sensitiveWriteTenantOwnershipGuarded ? "tenant-guarded" : "missing guard"}.`
                : `数据治理闭环：导出 ${organizationGovernance.dataGovernanceClosure.exportScopedToWorkspace ? "已限定到工作区" : "缺少范围"}（负责人 ${organizationGovernance.dataGovernanceClosure.latestExportOwner ?? "未知"}，来源 ${organizationGovernance.dataGovernanceClosure.latestExportSourcePage ?? "无"}）· 删除 ${organizationGovernance.dataGovernanceClosure.deleteScopedToWorkspace ? "已限定到工作区" : "缺少范围"}（负责人 ${organizationGovernance.dataGovernanceClosure.latestDeleteOwner ?? "未知"}，来源 ${organizationGovernance.dataGovernanceClosure.latestDeleteSourcePage ?? "无"}）· 保留 ${organizationGovernance.dataGovernanceClosure.retentionScopedToWorkspace ? "已限定到工作区" : "缺少范围"}（负责人 ${organizationGovernance.dataGovernanceClosure.latestRetentionOwner ?? "未知"}，来源 ${organizationGovernance.dataGovernanceClosure.latestRetentionSourcePage ?? "无"}）· 支持包 ${organizationGovernance.dataGovernanceClosure.supportPackScopedToWorkspace ? "已限定到工作区" : "缺少范围"}（负责人 ${organizationGovernance.dataGovernanceClosure.latestSupportPackOwner ?? "未知"}，来源 ${organizationGovernance.dataGovernanceClosure.latestSupportPackSourcePage ?? "无"}）· 敏感写入 ${organizationGovernance.dataGovernanceClosure.sensitiveWriteTenantOwnershipGuarded ? "已加租户归属守卫" : "缺少守卫"}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Workspace isolation assertions: memory export ${organizationGovernance.workspaceIsolationAssertions.memoryExportScopedToWorkspace ? "confirmed" : "missing"} · support-pack export ${organizationGovernance.workspaceIsolationAssertions.supportPackExportScopedToWorkspace ? "confirmed" : "missing"} · delete ${organizationGovernance.workspaceIsolationAssertions.deleteActionsScopedToWorkspace ? "confirmed" : "missing"} · retention ${organizationGovernance.workspaceIsolationAssertions.retentionControlsScopedToWorkspace ? "confirmed" : "missing"} · sensitive writes ${organizationGovernance.workspaceIsolationAssertions.sensitiveWriteRoutesRequireTenantOwnership ? "guarded" : "missing guard"} · billing webhook mapping ${organizationGovernance.workspaceIsolationAssertions.billingWebhookTenantMappingScopedToWorkspace ? "confirmed" : "missing"} · unresolved callbacks ${organizationGovernance.workspaceIsolationAssertions.unresolvedWebhookCallbacksRemainOutsideWorkspaceAudit ? "stay outside workspace audit" : "not bounded"}.`
                : `工作区隔离断言：记忆导出 ${organizationGovernance.workspaceIsolationAssertions.memoryExportScopedToWorkspace ? "已确认" : "缺失"} · 支持包导出 ${organizationGovernance.workspaceIsolationAssertions.supportPackExportScopedToWorkspace ? "已确认" : "缺失"} · 删除 ${organizationGovernance.workspaceIsolationAssertions.deleteActionsScopedToWorkspace ? "已确认" : "缺失"} · 保留策略 ${organizationGovernance.workspaceIsolationAssertions.retentionControlsScopedToWorkspace ? "已确认" : "缺失"} · 敏感写入 ${organizationGovernance.workspaceIsolationAssertions.sensitiveWriteRoutesRequireTenantOwnership ? "已加租户归属守卫" : "缺少守卫"} · 计费回调映射 ${organizationGovernance.workspaceIsolationAssertions.billingWebhookTenantMappingScopedToWorkspace ? "已确认" : "缺失"} · 未解析回调 ${organizationGovernance.workspaceIsolationAssertions.unresolvedWebhookCallbacksRemainOutsideWorkspaceAudit ? "保持在工作区审计之外" : "缺少边界"}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Webhook follow-through: ${organizationGovernance.dataGovernanceSummary.billingWebhookResolutionCount30d} tenant mappings, ${organizationGovernance.dataGovernanceSummary.billingWebhookDuplicateChainCount30d} duplicate callback chains, ${organizationGovernance.dataGovernanceSummary.billingWebhookVerificationFailureHintCount30d} hinted verification failures, ${organizationGovernance.dataGovernanceSummary.billingWebhookMappedExceptionCount30d} mapped callback exceptions, and ${organizationGovernance.dataGovernanceSummary.billingWebhookUnresolvedHintCount30d} hinted unresolved callbacks kept outside workspace audit truth.`
                : `计费回调跟进：近 30 天租户映射 ${organizationGovernance.dataGovernanceSummary.billingWebhookResolutionCount30d} 次、重复回调链路 ${organizationGovernance.dataGovernanceSummary.billingWebhookDuplicateChainCount30d} 次、提示验签失败 ${organizationGovernance.dataGovernanceSummary.billingWebhookVerificationFailureHintCount30d} 次、映射后异常 ${organizationGovernance.dataGovernanceSummary.billingWebhookMappedExceptionCount30d} 次、保持在工作区审计之外的未决提示回调 ${organizationGovernance.dataGovernanceSummary.billingWebhookUnresolvedHintCount30d} 次。`}
            </p>
            <p className="mt-2">
              {english
                ? `Latest webhook hint fallback: ${formatWebhookCallbackMarker(organizationGovernance.governanceFollowThrough.latestBillingWebhookHintFallback, true)} · latest hint mismatch: ${formatWebhookCallbackMarker(organizationGovernance.governanceFollowThrough.latestBillingWebhookHintMismatch, true)} · latest webhook duplicate chain: ${formatWebhookCallbackMarker(organizationGovernance.governanceFollowThrough.latestBillingWebhookDuplicateCallback, true)} · latest hinted verification failure: ${formatWebhookCallbackMarker(organizationGovernance.governanceFollowThrough.latestBillingWebhookVerificationFailureHint, true)} · latest hinted unresolved callback: ${formatWebhookCallbackMarker(organizationGovernance.governanceFollowThrough.latestBillingWebhookUnresolvedHint, true)} · latest mapped callback exception: ${formatWebhookCallbackMarker(organizationGovernance.governanceFollowThrough.latestBillingWebhookMappedException, true)}.`
                : `最近一次回调提示回退：${formatWebhookCallbackMarker(organizationGovernance.governanceFollowThrough.latestBillingWebhookHintFallback, false)} · 最近一次回调提示不匹配：${formatWebhookCallbackMarker(organizationGovernance.governanceFollowThrough.latestBillingWebhookHintMismatch, false)} · 最近一次回调重复链路：${formatWebhookCallbackMarker(organizationGovernance.governanceFollowThrough.latestBillingWebhookDuplicateCallback, false)} · 最近一次带提示的验签失败：${formatWebhookCallbackMarker(organizationGovernance.governanceFollowThrough.latestBillingWebhookVerificationFailureHint, false)} · 最近一次带提示的未决回调：${formatWebhookCallbackMarker(organizationGovernance.governanceFollowThrough.latestBillingWebhookUnresolvedHint, false)} · 最近一次映射后的回调异常：${formatWebhookCallbackMarker(organizationGovernance.governanceFollowThrough.latestBillingWebhookMappedException, false)}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Latest billing activity: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestBillingAudit, true)} · latest webhook governance: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestBillingWebhookGovernanceAudit, true)} · latest registry activity: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestContributionRegistryAudit, true)} · latest participant portal activity: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestParticipantPortalAudit, true)} · latest program activity: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestProgramAudit, true)} · latest settlement activity: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestSettlementAudit, true)}.`
                : `最近一次订阅动作：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestBillingAudit, false)} · 最近一次计费回调治理动作：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestBillingWebhookGovernanceAudit, false)} · 最近一次登记动作：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestContributionRegistryAudit, false)} · 最近一次门户动作：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestParticipantPortalAudit, false)} · 最近一次合作项目动作：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestProgramAudit, false)} · 最近一次结算动作：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestSettlementAudit, false)}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Latest connector activity: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestConnectorAudit, true)} · latest import activity: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestImportAudit, true)} · latest conflict resolution: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestConflictResolutionAudit, true)}.`
                : `最近一次连接器动作：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestConnectorAudit, false)} · 最近一次导入动作：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestImportAudit, false)} · 最近一次冲突处理：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestConflictResolutionAudit, false)}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Import identity follow-through: ${organizationGovernance.dataGovernanceSummary.identityMatchWriteCount30d} identity matches in the last 30 days, ${organizationGovernance.dataGovernanceSummary.identityMatchNeedsReviewCount30d} still needing review · latest identity match: ${formatIdentityMatchMarker(organizationGovernance.governanceFollowThrough.latestIdentityMatch, true)}.`
                : `导入身份跟进：近 30 天身份匹配 ${organizationGovernance.dataGovernanceSummary.identityMatchWriteCount30d} 次，其中待复核 ${organizationGovernance.dataGovernanceSummary.identityMatchNeedsReviewCount30d} 次 · 最近一次身份匹配：${formatIdentityMatchMarker(organizationGovernance.governanceFollowThrough.latestIdentityMatch, false)}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Latest governed action activity: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestActionGovernanceAudit, true)}.`
                : `最近一次受控动作：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestActionGovernanceAudit, false)}。`}
            </p>
            <p className="mt-2">
              {english
                ? `Latest insight-governance activity: ${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestInsightGovernanceAudit, true)}.`
                : `最近一次洞察治理动作：${formatGovernanceAuditMarker(organizationGovernance.governanceFollowThrough.latestInsightGovernanceAudit, false)}。`}
            </p>
            {organizationGovernance.boundaryNotes.map((note) => (
              <p key={note} className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                {formatSettingsBoundaryNote(note, english)}
              </p>
            ))}
          </div>
          {organizationGovernance.authSessionSummary.recentActiveSessions.length ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {english ? "Recent active auth sessions" : "最近活跃会话"}
                </p>
                {capabilities.canManageMembers ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => revokeAuthSessionsByScope("STALE_ACTIVE")}
                    >
                      {english ? "Revoke stale" : "撤销陈旧会话"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => revokeAuthSessionsByScope("LEGACY_PROVIDER")}
                    >
                      {english ? "Revoke legacy" : "撤销旧来源会话"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => revokeAuthSessionsByScope("MISSING_SOURCE_PAGE")}
                    >
                      {english ? "Revoke missing source" : "撤销缺少来源页会话"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => revokeAuthSessionsByScope("MISSING_WORKSPACE_SWITCH_MARKER")}
                    >
                      {english ? "Revoke missing switch marker" : "撤销缺少切换标记会话"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => revokeAuthSessionsByScope("PROVIDER_SOURCE_MISMATCH")}
                    >
                      {english ? "Revoke source mismatch" : "撤销来源不一致会话"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => revokeAuthSessionsByScope("WORKSPACE_MEMBERSHIP_MISMATCH")}
                    >
                      {english ? "Revoke membership mismatch" : "撤销成员归属不一致会话"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => revokeAuthSessionsByScope("OTHER_ACTIVE")}
                    >
                      {english ? "Revoke other active" : "撤销其他活跃会话"}
                    </Button>
                  </div>
                ) : null}
              </div>
              {organizationGovernance.authSessionSummary.recentActiveSessions.map((session) => (
                <div key={session.id} className="theme-surface-panel-soft rounded-2xl px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[color:var(--foreground)]">
                        {session.user.name} · {session.user.email}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                        {english ? "Provider" : "来源认证"}：
                        {formatAuthSessionProvider(session.providerType, english)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {session.id === currentAuthSessionId ? (
                        <Badge variant="approval">{english ? "Current" : "当前会话"}</Badge>
                      ) : null}
                      {session.isExpiringSoon ? (
                        <Badge variant="neutral">{english ? "Expiring soon" : "即将过期"}</Badge>
                      ) : null}
                      {session.isStale ? (
                        <Badge variant="neutral">{english ? "Stale" : "陈旧"}</Badge>
                      ) : null}
                      {session.isLegacyProvider ? (
                        <Badge variant="neutral">
                          {english ? "Legacy provider" : "旧来源服务商"}
                        </Badge>
                      ) : null}
                      {session.isMissingSourcePage ? (
                        <Badge variant="neutral">
                          {english ? "Missing source page" : "缺少来源页"}
                        </Badge>
                      ) : null}
                      {session.hasMissingWorkspaceSwitchMarker ? (
                        <Badge variant="neutral">
                          {english ? "Missing switch marker" : "缺少切换标记"}
                        </Badge>
                      ) : null}
                      {session.hasProviderSourceMismatch ? (
                        <Badge variant="neutral">
                          {english ? "Provider/source mismatch" : "来源服务商 / 来源页不一致"}
                        </Badge>
                      ) : null}
                      {session.hasWorkspaceMembershipMismatch ? (
                        <Badge variant="neutral">
                          {english ? "Membership mismatch" : "成员归属不一致"}
                        </Badge>
                      ) : null}
                      {session.id === currentAuthSessionId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={rotateCurrentAuthSession}
                        >
                          {english ? "Rotate" : "轮换"}
                        </Button>
                      ) : null}
                      {capabilities.canManageMembers && session.id !== currentAuthSessionId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => revokeAuthSession(session.id)}
                        >
                          {english ? "Revoke" : "撤销"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                    {english
                      ? `Last seen ${formatSettingsDateLabel(session.lastSeenAt, english)} · created ${formatSettingsDateLabel(session.createdAt, english)} · expires ${formatSettingsDateLabel(session.expiresAt, english)}`
                      : `最近活跃 ${formatSettingsDateLabel(session.lastSeenAt, english)} · 创建于 ${formatSettingsDateLabel(session.createdAt, english)} · 过期于 ${formatSettingsDateLabel(session.expiresAt, english)}`}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                    {english ? "Source page" : "来源页面"}：
                    {session.sourcePage ?? (english ? "Not recorded" : "未记录")}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                    {english ? "Last workspace switch marker" : "最近一次工作区切换标记"}：
                    {session.lastWorkspaceSwitchAt
                      ? formatSettingsDateLabel(
                          session.lastWorkspaceSwitchAt,
                          english,
                        )
                      : english
                        ? "Not recorded"
                        : "未记录"}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Recent data-governance audit" : "最近的数据治理审计"}
            </p>
            {organizationGovernance.recentDataGovernanceAudit.length ? (
              <div data-testid="organization-governance-audit-feed" className="space-y-3">
                {organizationGovernance.recentDataGovernanceAudit.map((item) => (
                  <div key={item.id} className="theme-surface-panel-soft rounded-2xl px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="neutral">
                        {getOrganizationAuditActionLabel(item.actionType, english)}
                      </Badge>
                      <span className="text-xs text-[color:var(--muted-foreground)]">
                        {formatSettingsDateLabel(item.createdAt, english)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-[color:var(--foreground)]">
                      {formatGovernanceAuditSummary(item.summary, english)}
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                      {english ? "Actor" : "操作者"}：{item.actor} · {english ? "Target" : "目标"}：
                      {formatGovernanceAuditTargetType(item.targetType, english)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title={english ? "No recent governance audit yet" : "最近还没有新的治理审计"}
                description={
                  english
                    ? "Once session, retention, export, delete, or program-governance actions happen, the latest governance replay will appear here."
                    : "一旦发生会话、保留期、导出、删除或合作项目治理动作，这里会显示最新回放。"
                }
              />
            )}
          </div>
        </div>
      ) : (
        <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
          {english
            ? "Governance support pack stays visible only to owner, billing admin and admin."
            : "治理支持包只对负责人、计费管理员和管理员可见。"}
        </div>
      )}
    </div>
  );
}
