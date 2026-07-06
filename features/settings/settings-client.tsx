"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  CustomEngagementStatus,
  CustomEngagementType,
  MembershipStatus,
  PaymentProvider,
  ParticipantPortalAccessStatus,
  PayoutProfileStatus,
  ProgramApplicationStatus,
  PublisherProfileStatus,
  RevenueBeneficiaryType,
  SalesReferralStatus,
  WorkspaceRole,
} from "@prisma/client";
import { toast } from "sonner";
import {
  ACCESS_STATE,
  PAYMENT_PROVIDER,
} from "@/lib/billing/runtime-constants";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { CustomerAssetFocusStrip } from "@/components/shared/customer-asset-focus-strip";
import { EmptyState } from "@/components/shared/empty-state";
import { LazyDisclosure } from "@/components/shared/lazy-disclosure";
import { ObjectContextOperatingSummary } from "@/components/shared/object-context-operating-summary";
import { PageHeader } from "@/components/shared/page-header";
import { ActionModeBadge } from "@/components/shared/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  actionModeLabels,
  actionTypeLabels,
  policyDefaults,
  riskLabels,
  roleLabels,
} from "@/data/constants";
import {
  getLocalizedActionModeLabels,
  getLocalizedActionTypeLabels,
  getLocalizedPolicyGuides,
  getLocalizedRiskLabels,
  getLocalizedRoleLabels,
} from "@/lib/i18n/labels";
import type { ParticipantPortalInviteIssuanceState } from "@/lib/auth/participant-portal-invite-state";
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";
import { safeParseJson } from "@/lib/utils";
import { formatSettingsDateLabel } from "@/features/settings/settings-date-labels";
import {
  connectAliyunFounderDefaultAction,
  connectAliyunMailConnectorAction,
  connectMockGmailAction,
  disconnectConnectorAction,
  inviteDingTalkDirectoryUsersAction,
  sendAliyunMailManualAction,
  syncAndInviteDingTalkDirectoryAction,
  syncDingTalkConnectorAction,
  syncFeishuConnectorAction,
  syncGmailConnectorAction,
  syncWeComConnectorAction,
  validateWeComCalendarRegistryAction,
} from "@/features/connectors/actions";
import {
  issueParticipantPortalAccessAction,
  updateParticipantPortalAccessStatusAction,
} from "@/features/participant-portal/actions";
import {
  issueProgramApplicationInviteAction,
  reviewProgramApplicationAction,
} from "@/features/programs/actions";
import {
  acceptSkillSuggestionAction,
  approveSkillFormalReviewAction,
  createBillingCheckoutAction,
  createBillingPortalAction,
  acceptStrategySuggestionAction,
  addOrganizationMemberAction,
  revokeOrganizationAuthSessionsByScopeAction,
  rotateCurrentOrganizationAuthSessionAction,
  transferOrganizationOwnershipAction,
  approveSettlementBatchAction,
  closeSettlementBatchAction,
  createBeneficiaryPayoutProfileAction,
  createCustomEngagementAction,
  createOrganizationAction,
  createSalesReferralAction,
  createSettlementBatchAction,
  createWorkerPublisherProfileAction,
  dismissSkillSuggestionAction,
  dismissStrategySuggestionAction,
  deferSkillFormalReviewAction,
  exportSettlementBatchCsvAction,
  markSettlementLinePaidAction,
  queueSkillFormalReviewAction,
  refreshBillingStatusAction,
  revokeOrganizationAuthSessionAction,
  restoreDefaultPoliciesAction,
  rejectSkillFormalReviewAction,
  reverseSettlementLineAction,
  returnSkillFormalReviewForHardeningAction,
  switchOrganizationAction,
  updateOrganizationMembershipLifecycleAction,
  updateOrganizationMemberGoalProfileAction,
  updateMemberGroupTagAction,
  updateOrganizationMembershipRoleAction,
  updateBeneficiaryPayoutProfileStatusAction,
  updateCustomEngagementStatusAction,
  updatePolicyRuleAction,
  updateSalesReferralStatusAction,
  updateWorkerPublisherProfileStatusAction,
  updateWorkspaceOperationalControlsAction,
} from "@/features/settings/actions";
import {
  getBillingPortalModeLabel,
  getCheckoutModeLabel,
  getPaymentCallbackModeLabel,
  getPaymentLifecycleMappingModeLabel,
  getPaymentLifecycleSourceLabel,
  getPaymentProviderLabel,
  getPaymentRegionLabel,
  getPaymentSubscriptionLabel,
} from "@/lib/billing/payment-providers";
import { getChinaCheckoutActionLabel } from "@/lib/billing/china-renew-restore";
import { buildWorkspaceOperatingFoundationSummary } from "@/lib/operating-system";
import { buildInviteAcceptanceGuidance } from "@/lib/auth/public-entry";
import { MemberDefinitionCard } from "@/features/settings/member-definition-card";
import {
  formatSourceIntakeLabel,
  getDataIntakeLevels,
  getProofPackageFiles,
  getResourceAccessCatalog,
  isSourceIntakeOptionKey,
} from "@/features/settings/data-intake-ux";
import { CONNECTOR_PERMISSION_SUMMARIES } from "@/features/agentic-governance/connector-permission-summary";
import { pickConnectorForCurrentUser } from "@/features/settings/connector-selection";
import { AccountSettingsTab } from "@/features/settings/components/account-settings-tab";
import { updateWorkspaceLLMConfigAction } from "@/features/settings/llm-config-actions";
import { BillingMetricsPanels } from "@/features/settings/components/billing-metrics-panels";
import { BillingAttributionOverviewPanels } from "@/features/settings/components/billing-attribution-overview-panels";
import { BillingAttributionDetailPanels } from "@/features/settings/components/billing-attribution-detail-panels";
import { BillingManualSettlementWorkflow } from "@/features/settings/components/billing-manual-settlement-workflow";
import { BillingOverviewPanels } from "@/features/settings/components/billing-overview-panels";
import { BillingParticipantPortalPanels } from "@/features/settings/components/billing-participant-portal-panels";
import { BillingPayoutReadinessPanels } from "@/features/settings/components/billing-payout-readiness-panels";
import { BillingProgramCatalogPanels } from "@/features/settings/components/billing-program-catalog-panels";
import { BillingSettlementExceptionPanels } from "@/features/settings/components/billing-settlement-exception-panels";
import {
  OrgAdminGovernanceSupportPack,
  RecentOrgAdminAudit,
} from "@/features/settings/components/org-admin-governance";
import {
  PermissionsRoleGuideCard,
  TeamPermissionsCard,
} from "@/features/settings/components/permissions-settings";
import { PilotSettingsTab } from "@/features/settings/components/pilot-settings-tab";
import { ConnectorPermissionSummaryPanel } from "@/features/settings/components/connector-permission-summary-panel";
import { SettingsOverviewPanels } from "@/features/settings/components/settings-overview-panels";
import { TenantResourceReadinessPanel } from "@/features/settings/components/tenant-resource-readiness-panel";
import { Info } from "@/features/settings/components/settings-display";
import {
  formatSettingsBoundaryNote,
  formatSettingsCapabilityCategory,
  formatSettingsCommercialText,
  formatSettingsConnectorRuntimeText,
  formatSettingsSkillSuggestionText,
} from "@/features/settings/display-copy";
import {
  formatAuthSessionRevokeScope,
  type AuthSessionRevokeScope,
} from "@/features/settings/formatters/auth-session-formatters";
import {
  accessStateLabels,
  customEngagementStatusLabels,
  customEngagementTypeLabels,
  participantPortalStatusLabels,
  payoutProfileStatusLabels,
  programApplicationStatusLabels,
  publisherProfileStatusLabels,
  revenueBeneficiaryLabels,
  revenueSourceLabels,
  salesReferralStatusLabels,
} from "@/features/settings/formatters/labels";
import {
  buildPayoutRailReadinessNarrative,
  buildSettlementExceptionNarrative,
  buildSettlementOpsProofNarrative,
} from "@/features/settings/formatters/billing-readout-narratives";
import {
  formatConnectorBannerMessage,
  formatDingTalkCallbackStatus,
  formatDingTalkFailurePosture,
  formatDingTalkIngestScopeStatus,
  formatDingTalkIngestStatus,
  formatDingTalkReadOnlyScope,
  formatWeComCalendarRegistryReadiness,
  formatWeComCalendarRegistryStatus,
  getWeComCalendarRegistryNextAction,
} from "@/features/settings/formatters/governance-formatters";
import {
  resolveInitialSettingsTab,
  type FormalReviewChecklistState,
} from "@/features/settings/types/settings-types";
import type {
  PayoutProfileBeneficiaryType,
  PortalInviteBeneficiaryType,
  ProgramApplicationBeneficiaryType,
  SettingsClientProps,
  SettingsSummaryConnection,
} from "@/features/settings/types/settings-client-props";
import {
  listRolePresetOptions,
  suggestRolePresetKeyFromText,
} from "@/lib/definitions/role-presets";

const isDefined = <T,>(value: T | undefined): value is T => value !== undefined;

const DEFAULT_GOVERNANCE_SUMMARY: SettingsClientProps["data"]["governanceSummary"] = {
  auditEvents7d: 0,
  pendingApprovals: 0,
  llmFallbacks7d: 0,
  approvalProtectedActions: 0,
  acceptedSkillSuggestionCount: 0,
  acceptedStrategyCount: 0,
  formalReviewQueueCount: 0,
  formalReviewDecisionCount: 0,
};

const DEFAULT_INTEGRATION_SUMMARY: SettingsClientProps["data"]["integrationSummary"] = {
  connectedConnectorCount: 0,
  connectorErrorCount: 0,
  externalThreadCount: 0,
  unboundThreadCount: 0,
  importedSignalCount: 0,
  duplicateEmailCount: 0,
  recentImportFailures: 0,
};

function normalizeSettingsClientData(data: SettingsClientProps["data"]) {
  const maybePartial = data as SettingsClientProps["data"] &
    Partial<Pick<SettingsClientProps["data"], "governanceSummary" | "integrationSummary">>;

  return {
    ...data,
    governanceSummary: maybePartial.governanceSummary ?? DEFAULT_GOVERNANCE_SUMMARY,
    integrationSummary: maybePartial.integrationSummary ?? DEFAULT_INTEGRATION_SUMMARY,
  };
}

function getParticipantPortalAccessIssuedToast(
  issuanceState: ParticipantPortalInviteIssuanceState | undefined,
  english: boolean,
) {
  if (issuanceState === "issue_fresh_access") {
    return english
      ? "Participant portal access issued"
      : "贡献方门户访问已发放";
  }

  if (issuanceState === "reissue_archived_access") {
    return english
      ? "Archived participant portal access reopened with a fresh invite"
      : "已重新启用归档的贡献方门户访问并发放新邀请";
  }

  return english
    ? "Participant portal invite reissued"
    : "贡献方门户邀请已重新发放";
}

function getProgramApplicationInviteToast(
  issuanceState: ParticipantPortalInviteIssuanceState | undefined,
  english: boolean,
) {
  if (issuanceState === "issue_fresh_access") {
    return english ? "Program invite issued" : "合作项目邀请已发放";
  }

  if (issuanceState === "reissue_archived_access") {
    return english
      ? "Archived participant access reopened with a fresh invite"
      : "已重新启用归档的参与访问并发放新邀请";
  }

  return english ? "Program invite reissued" : "合作项目邀请已重新发放";
}

function canIssueProgramApplicationParticipantInvite(
  accessStatus?: ParticipantPortalAccessStatus,
) {
  return (
    !accessStatus || accessStatus === "INVITED" || accessStatus === "ARCHIVED"
  );
}

function getProgramApplicationInviteButtonLabel(
  accessStatus: ParticipantPortalAccessStatus | undefined,
  english: boolean,
) {
  if (accessStatus === "INVITED") {
    return english ? "Reissue invite" : "重新发邀请";
  }

  if (accessStatus === "ARCHIVED") {
    return english ? "Reopen and issue invite" : "重新启用并发邀请";
  }

  if (accessStatus === "ACTIVE") {
    return english ? "Portal access active" : "门户访问已激活";
  }

  if (accessStatus === "SUSPENDED") {
    return english ? "Restore access first" : "请先恢复访问";
  }

  return english ? "Issue invite" : "发放邀请";
}

function getProgramApplicationInviteGuidance(
  accessStatus: ParticipantPortalAccessStatus,
  english: boolean,
) {
  if (accessStatus === "INVITED") {
    return english
      ? "This access is still invited-only. Reissuing will refresh the invite link and email target without activating the portal."
      : "这个访问仍停留在 invited-only 姿态；重新发放只会刷新邀请链接和邮箱目标，不会直接激活门户。";
  }

  if (accessStatus === "ARCHIVED") {
    return english
      ? "Archived access can be reopened by issuing a fresh invite. The new invite will reset the portal back to invited-only posture."
      : "归档访问可以通过重新发放邀请来重新启用；新邀请会把门户重置回 invited-only 姿态。";
  }

  if (accessStatus === "SUSPENDED") {
    return english
      ? "Suspended access must be restored before issuing a new invite."
      : "已暂停的访问必须先恢复，才能重新发放邀请。";
  }

  return english
    ? "This portal access is already active. Use the existing portal access instead of issuing a new invite."
    : "这个门户访问已经激活，请直接使用现有访问，而不是重新发放邀请。";
}

export function SettingsClient({
  data: rawData,
  connectorState,
  billingState,
  connectorConfig,
  llmConfig,
}: SettingsClientProps) {
  const data = normalizeSettingsClientData(rawData);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dingtalkInvitePending, startDingtalkInviteTransition] =
    useTransition();
  const {
    messages,
    locale,
    pilotMode,
    captureConsentRequired,
    dataRetentionDays,
    featureFlags,
    demoMode,
  } = useWorkspaceUi();
  const currentUserId = data.organizationSummary.currentUserId;
  const gmailConnector = pickConnectorForCurrentUser(data.connectors, {
    currentUserId,
    provider: "GMAIL",
  });
  const dingtalkConnector = pickConnectorForCurrentUser(data.connectors, {
    currentUserId,
    provider: "DINGTALK",
  });
  const feishuConnector = pickConnectorForCurrentUser(data.connectors, {
    currentUserId,
    provider: "FEISHU",
  });
  const wecomConnector = pickConnectorForCurrentUser(data.connectors, {
    currentUserId,
    provider: "WECOM",
  });
  const crmSources = data.importSources;
  // connectedSources is a legacy setup column; render it as source-intake
  // guidance, never as connector authorization.
  const setupSourceSelections = safeParseJson<
    Array<{ name: string; status?: string }>
  >(data.workspace?.connectedSources, []);
  const [wecomCalendarRegistryDraft, setWecomCalendarRegistryDraft] = useState(
    (wecomConnector?.calendarRegistry?.boundCalendars ?? [])
      .map((calendar) => calendar.calendarId)
      .join("\n"),
  );
  const [aliyunCredentialDraft, setAliyunCredentialDraft] = useState({
    email: gmailConnector?.externalAccountEmail ?? "",
    password: "",
    manualSendEnabled: false,
  });
  const [aliyunManualSendDraft, setAliyunManualSendDraft] = useState({
    to: "",
    subject: "",
    body: "",
  });
  const [organizationDraft, setOrganizationDraft] = useState({ name: "" });
  const [memberDraft, setMemberDraft] = useState({
    email: "",
    name: "",
    role: "MEMBER" as keyof typeof roleLabels,
    title: "",
    rolePresetKey: suggestRolePresetKeyFromText(data.workspace?.profileType),
  });
  const [publisherDraft, setPublisherDraft] = useState({
    displayName: "",
    publisherKey: "",
    contactEmail: "",
    notes: "",
  });
  const [salesReferralDraft, setSalesReferralDraft] = useState({
    beneficiaryLabel: "",
    referralKey: "",
    beneficiaryContact: "",
    notes: "",
  });
  const [customEngagementDraft, setCustomEngagementDraft] = useState({
    engagementType: "IMPLEMENTATION" as CustomEngagementType,
    label: "",
    engagementKey: "",
    beneficiaryLabel: "",
    contractValue: "",
    notes: "",
  });
  const [payoutProfileDraft, setPayoutProfileDraft] = useState({
    beneficiaryType: "WORKER_PUBLISHER" as PayoutProfileBeneficiaryType,
    beneficiaryId: "",
    displayName: "",
    legalName: "",
    contact: "",
    payoutMethodLabel: "",
    payoutDetailsReference: "",
    invoiceRequired: false,
    notes: "",
  });
  const [participantPortalDraft, setParticipantPortalDraft] = useState({
    beneficiaryType: "WORKER_PUBLISHER" as PortalInviteBeneficiaryType,
    beneficiaryId: "",
    inviteEmail: "",
    displayName: "",
    notes: "",
  });
  const [programApplicationNotes, setProgramApplicationNotes] = useState<
    Record<string, string>
  >({});
  const [programApplicationStatuses, setProgramApplicationStatuses] = useState<
    Record<string, ProgramApplicationStatus>
  >({});
  const [
    programApplicationBeneficiaryTypes,
    setProgramApplicationBeneficiaryTypes,
  ] = useState<Record<string, ProgramApplicationBeneficiaryType | "NONE">>({});
  const [
    latestParticipantPortalInviteUrl,
    setLatestParticipantPortalInviteUrl,
  ] = useState<string | null>(null);
  const [latestProgramApplicationInvite, setLatestProgramApplicationInvite] =
    useState<{
      applicationId: string;
      inviteUrl: string;
    } | null>(null);
  const [settlementBatchDraft, setSettlementBatchDraft] = useState({
    periodLabel: new Date().toISOString().slice(0, 7),
    notes: "",
  });
  const [settlementLineNotes, setSettlementLineNotes] = useState<
    Record<string, string>
  >({});
  const [settlementLineReverseReasons, setSettlementLineReverseReasons] =
    useState<Record<string, string>>({});
  const [formalReviewNotes, setFormalReviewNotes] = useState<
    Record<string, string>
  >({});
  const [formalReviewChecklists, setFormalReviewChecklists] = useState<
    Record<string, FormalReviewChecklistState>
  >({});
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    data.organizationSummary.activeWorkspaceId,
  );
  const [llmDraft, setLlmDraft] = useState<{
    provider: "openai" | "qwen";
    defaultModel: string;
    extractionModel: string;
    briefingModel: string;
    reasoningModel: string;
  }>({
    provider: llmConfig.provider === "qwen" ? "qwen" : "openai",
    defaultModel: llmConfig.defaultModel,
    extractionModel: llmConfig.extractionModel,
    briefingModel: llmConfig.briefingModel,
    reasoningModel: llmConfig.reasoningModel,
  });
  const [publisherStatusFilter, setPublisherStatusFilter] = useState<
    PublisherProfileStatus | "ALL"
  >("ALL");
  const [salesReferralStatusFilter, setSalesReferralStatusFilter] = useState<
    SalesReferralStatus | "ALL"
  >("ALL");
  const [customEngagementStatusFilter, setCustomEngagementStatusFilter] =
    useState<CustomEngagementStatus | "ALL">("ALL");
  const [customEngagementTypeFilter, setCustomEngagementTypeFilter] = useState<
    CustomEngagementType | "ALL"
  >("ALL");
  const [dingtalkDirectoryInviteSummary, setDingtalkDirectoryInviteSummary] =
    useState<{
      dryRun: boolean;
      processed: number;
      createdUsers: number;
      reusedUsers: number;
      upsertedMemberships: number;
      sentMessages: number;
      skipped: number;
      skippedNoMobile: number;
      nameCollisionResolved: number;
      errors: string[];
      recordedAt: string;
    } | null>(null);
  const [programApplicationStatusFilter, setProgramApplicationStatusFilter] =
    useState<ProgramApplicationStatus | "ALL">("ALL");
  const [programApplicationProgramFilter, setProgramApplicationProgramFilter] =
    useState<string>("ALL");
  const activeTab = resolveInitialSettingsTab(connectorState.tab);
  const [pilotDraft, setPilotDraft] = useState({
    defaultLocale: locale,
    pilotMode,
    captureConsentRequired,
    dataRetentionDays,
    featureFlags,
  });
  const english = locale === "en-US";
  const dataIntakeLevels = getDataIntakeLevels(english);
  const resourceAccessCatalog = getResourceAccessCatalog(english);
  const proofPackageFiles = getProofPackageFiles(english);
  const formatSettingsDate = (value: Date | string | null | undefined) =>
    formatSettingsDateLabel(value, english);

  const navigateSettingsTab = (value: string) => {
    const tab = resolveInitialSettingsTab(value);
    if (tab === activeTab) {
      return;
    }

    if (typeof window !== "undefined") {
      window.location.assign(`/settings?tab=${tab}`);
      return;
    }

    router.push(`/settings?tab=${tab}`, { scroll: false });
  };
  const focusAreas = safeParseJson<string[]>(data.workspace?.focusAreas, []);
  const defaultStrategies = safeParseJson<string[]>(
    data.workspace?.defaultStrategies,
    [],
  );
  const focusAreasSummary =
    focusAreas.join(" · ") || (english ? "Not set" : "未设置");
  const defaultStrategiesSummary =
    defaultStrategies
      .map((strategy) => formatSettingsCommercialText(strategy, english))
      .join(" · ") || (english ? "Not set" : "未设置");
  const pageStory = getWorkspaceStory("settings", locale, demoMode);
  const actionModeLabelsByLocale = getLocalizedActionModeLabels(locale);
  const actionTypeLabelsByLocale = getLocalizedActionTypeLabels(locale);
  const policyGuidesByLocale = getLocalizedPolicyGuides(locale);
  const riskLabelsByLocale = getLocalizedRiskLabels(locale);
  const roleLabelsByLocale = getLocalizedRoleLabels(locale);
  const rolePresetOptions = listRolePresetOptions(locale);
  const skillBoundaryLabels: Record<string, string> = {
    internal_only: english ? "Internal only" : "仅限内部",
    draft_only: english ? "Draft only" : "仅限草稿",
    review_required: english ? "Review required" : "需要复核",
  };
  const skillEffectModeLabels: Record<string, string> = {
    read_only: english ? "Read only" : "只读",
    draft_only: english ? "Draft only" : "草稿层",
    internal_write: english ? "Internal write" : "内部写入",
  };
  const skillSurfaceLabels: Record<string, string> = {
    dashboard: english ? "Dashboard" : "总览",
    meetings: english ? "Meetings" : "会议",
    approvals: english ? "Approvals" : "审批",
    opportunities: english ? "Opportunities" : "机会",
    settings: english ? "Settings" : "设置",
  };
  const skillStageLabels: Record<string, string> = {
    candidate_skill: english ? "Candidate" : "候选层",
    probationary_skill: english ? "Probationary" : "观察层",
  };
  const formalReviewStatusLabels: Record<string, string> = {
    NOT_READY: english ? "Not ready" : "未就绪",
    READY: english ? "Ready" : "待入队",
    QUEUED: english ? "Queued" : "已入队",
    HARDENING_REQUIRED: english ? "Needs hardening" : "待加固",
  };
  const formalReviewDecisionLabels: Record<string, string> = {
    NONE: english ? "Pending review" : "待评审",
    APPROVED_PENDING_PROMOTION: english
      ? "Approved pending promotion"
      : "已通过待晋级",
    DEFERRED: english ? "Deferred" : "暂缓",
    REJECTED: english ? "Rejected" : "已拒绝",
  };
  const formalReviewChecklistLabels: Record<
    keyof FormalReviewChecklistState,
    string
  > = {
    catalogPatchReady: english ? "Catalog patch ready" : "目录补丁已准备",
    testsReady: english ? "Tests ready" : "测试已准备",
    guardsReady: english ? "Guards ready" : "守卫已准备",
    docsReady: english ? "Docs ready" : "文档已准备",
    boundaryConfirmed: english ? "Boundary confirmed" : "边界已确认",
  };
  const createEmptyFormalReviewChecklist = (): FormalReviewChecklistState => ({
    catalogPatchReady: false,
    testsReady: false,
    guardsReady: false,
    docsReady: false,
    boundaryConfirmed: false,
  });
  const getFormalReviewChecklistDraft = (suggestionId: string) =>
    formalReviewChecklists[suggestionId] ?? createEmptyFormalReviewChecklist();
  const currentAccessStateLabel =
    accessStateLabels[data.organizationSummary.currentState][
      english ? "en" : "zh"
    ];
  const canManageMembers = data.organizationSummary.canManageMembers;
  const canManageBilling = data.organizationSummary.canManageBilling;
  const canManageContributionRegistry =
    data.organizationSummary.canManageContributionRegistry;
  const canManageManualSettlement =
    data.organizationSummary.canManageManualSettlement;
  const canManageParticipantPortal =
    data.organizationSummary.canManageParticipantPortal;
  const canManagePolicies = data.organizationSummary.canManagePolicies;
  const canManageWorkspaceSetup =
    data.organizationSummary.canManageWorkspaceSetup;
  const canManageOperationalControls =
    data.organizationSummary.canManageOperationalControls;
  const canManageProgramApplications =
    data.organizationSummary.canManageProgramApplications;
  const canManageConnectors = data.organizationSummary.canManageConnectors;
  const canManageImports = data.organizationSummary.canManageImports;
  const authSessionSummary =
    data.organizationGovernance?.authSessionSummary ?? null;
  const authControlOverview =
    authSessionSummary?.authControlConsistencyOverview ?? null;
  const latestAnomalySummary =
    authSessionSummary?.latestAnomalyFollowThroughSummary ?? null;
  const dataGovernanceClosure =
    data.organizationGovernance?.dataGovernanceClosure ?? null;
  const workspaceIsolationAssertions =
    data.organizationGovernance?.workspaceIsolationAssertions ?? null;
  const settingsGuidanceRecommendations = [
    {
      title:
        latestAnomalySummary && latestAnomalySummary.status !== "CLEAR"
          ? english
            ? "Review auth anomaly follow-through"
            : "检查身份异常后续处理"
          : english
            ? "Keep auth controls in a stable state"
            : "保持身份控制稳定",
      body:
        latestAnomalySummary && latestAnomalySummary.status !== "CLEAR"
          ? english
            ? `${latestAnomalySummary.bulkRevocableScopeCount} scopes are still bulk-revocable and ${latestAnomalySummary.reviewOnlyScopeCount} need review-first handling.`
            : `${latestAnomalySummary.bulkRevocableScopeCount} 个范围仍可批量撤销，另有 ${latestAnomalySummary.reviewOnlyScopeCount} 个范围需要先人工复核。`
          : english
            ? "Auth anomaly follow-through is currently clear enough to keep review-first controls lightweight."
            : "当前身份异常跟进处于可控状态，可以继续保持轻量复核。",
    },
    {
      title: english
        ? "Tighten operating preset before rollout"
        : "上线前先收紧运行预设",
      body: english
        ? "Use the recommended preset to align locale, retention, diagnostics and consent before operators change execution-facing settings."
        : "先套用推荐预设，让语言、保留期、就绪度和授权控制在触达执行面前保持一致。",
    },
    {
      title: english
        ? "Keep tenant-scoped governance visible"
        : "保持租户级治理可见",
      body:
        dataGovernanceClosure && workspaceIsolationAssertions
          ? english
            ? `Export ${dataGovernanceClosure.exportScopedToWorkspace ? "stays" : "does not stay"} scoped to workspace, and sensitive writes are ${workspaceIsolationAssertions.sensitiveWriteRoutesRequireTenantOwnership ? "" : "not "}guarded by tenant ownership.`
            : `导出${dataGovernanceClosure.exportScopedToWorkspace ? "已" : "未"}保持工作区级范围，敏感写路径${workspaceIsolationAssertions.sensitiveWriteRoutesRequireTenantOwnership ? "已" : "未"}接入租户归属断言。`
          : english
            ? "Use this page as the operating boundary for export, delete and retention controls."
            : "把这页当成导出、删除和保留期控制的经营边界入口。",
    },
  ];
  const settingsGuidanceReminders = [
    authControlOverview
      ? {
          title: english ? "Current auth consistency" : "当前身份控制一致性",
          body:
            authControlOverview.consistencyStatus === "CLEAR"
              ? english
                ? "No active consistency drift is currently detected."
                : "当前没有发现新的控制漂移。"
              : english
                ? `${authControlOverview.driftScopeCount} drift scopes and ${authControlOverview.currentSessionProtectedScopeCount} current-session-protected scopes still need operator judgement.`
                : `仍有 ${authControlOverview.driftScopeCount} 个漂移范围与 ${authControlOverview.currentSessionProtectedScopeCount} 个当前会话保护范围需要人工判断。`,
          meta: authControlOverview.latestDetectedAt
            ? `${english ? "Latest detected" : "最近发现"} ${formatSettingsDateLabel(
                authControlOverview.latestDetectedAt,
                english,
              )}`
            : undefined,
        }
      : null,
    data.organizationGovernance?.boundaryNotes?.[0]
      ? {
          title: english ? "Boundary note" : "边界提示",
          body: formatSettingsBoundaryNote(
            data.organizationGovernance.boundaryNotes[0],
            english,
          ),
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; body: string; meta?: string }>;
  const canResolveImportConflicts =
    data.organizationSummary.canResolveImportConflicts;
  const canManageGovernedActions =
    data.organizationSummary.canManageGovernedActions;
  const canReviewGovernedActions =
    data.organizationSummary.canReviewGovernedActions;
  const canManageInsights = data.organizationSummary.canManageInsights;
  const canManageWorkspaceRecords =
    data.organizationSummary.canManageWorkspaceRecords;
  const canManageInternalActions =
    data.organizationSummary.canManageInternalActions;
  const canReadOrganizationAudit =
    data.organizationSummary.canReadOrganizationAudit;
  const canExportOrganizationSupportPack =
    data.organizationSummary.canExportOrganizationSupportPack;
  const orgAdminGovernanceCapabilities = {
    canExportOrganizationSupportPack,
    canManageBilling,
    canManageConnectors,
    canManageContributionRegistry,
    canManageGovernedActions,
    canManageImports,
    canManageInsights,
    canManageInternalActions,
    canManageManualSettlement,
    canManageMembers,
    canManageOperationalControls,
    canManageParticipantPortal,
    canManagePolicies,
    canManageProgramApplications,
    canManageWorkspaceRecords,
    canManageWorkspaceSetup,
    canReadOrganizationAudit,
    canResolveImportConflicts,
    canReviewGovernedActions,
  };
  const activeOwnerCount = data.organizationSummary.activeOwnerCount;
  const reservedWorkspace = data.organizationSummary.reservedWorkspace;
  const reservedCommercialReadable =
    data.organizationSummary.reservedCommercialReadable;
  const reservedFormalSkillGovernanceReadable =
    data.organizationSummary.reservedFormalSkillGovernanceReadable;
  const canManageReservedFormalSkillGovernance =
    reservedWorkspace && canManagePolicies;
  const visibleWorkerPublisherProfiles = data.workerPublisherProfiles.filter(
    (profile) =>
      publisherStatusFilter === "ALL" ||
      profile.status === publisherStatusFilter,
  );
  const visibleSalesReferrals = data.salesReferrals.filter(
    (referral) =>
      salesReferralStatusFilter === "ALL" ||
      referral.status === salesReferralStatusFilter,
  );
  const visibleCustomEngagements = data.customEngagements.filter(
    (engagement) =>
      (customEngagementStatusFilter === "ALL" ||
        engagement.status === customEngagementStatusFilter) &&
      (customEngagementTypeFilter === "ALL" ||
        engagement.engagementType === customEngagementTypeFilter),
  );
  const visibleProgramApplications = [...data.programApplications]
    .filter(
      (application) =>
        (programApplicationStatusFilter === "ALL" ||
          application.status === programApplicationStatusFilter) &&
        (programApplicationProgramFilter === "ALL" ||
          application.partnerProgram.id === programApplicationProgramFilter),
    )
    .sort((left, right) => {
      const queuePriority: Record<ProgramApplicationStatus, number> = {
        SUBMITTED: 0,
        ACCEPTED: 1,
        WAITLISTED: 2,
        INVITED: 3,
        REJECTED: 4,
      };
      const byStatus = queuePriority[left.status] - queuePriority[right.status];
      if (byStatus !== 0) {
        return byStatus;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    });
  const chinaRenewRestoreSummary = data.chinaRenewRestoreSummary;
  const chinaCheckoutButtonsVisible =
    data.billingOverview.paymentRegion === "CN" &&
    chinaRenewRestoreSummary?.intent !== "HOLD";
  const paymentProviderLabel = getPaymentProviderLabel(
    data.billingOverview.paymentProvider,
    english,
  );
  const paymentRegionLabel = getPaymentRegionLabel(
    data.billingOverview.paymentRegion,
    english,
  );
  const paymentCheckoutModeLabel = getCheckoutModeLabel(
    data.billingOverview.checkoutMode,
    english,
  );
  const billingPortalModeLabel = getBillingPortalModeLabel(
    data.billingOverview.billingPortalMode,
    english,
  );
  const paymentLifecycleSourceLabel = getPaymentLifecycleSourceLabel(
    data.billingOverview.lifecycleSource,
    english,
  );
  const paymentCallbackModeLabel = getPaymentCallbackModeLabel(
    data.billingOverview.callbackMode,
    english,
  );
  const paymentLifecycleMappingModeLabel = getPaymentLifecycleMappingModeLabel(
    data.billingOverview.lifecycleMappingMode,
    english,
  );
  const paymentSubscriptionLabel = getPaymentSubscriptionLabel(
    data.billingOverview.paymentProvider,
    data.billingOverview.paymentSubscriptionStatus,
    english,
  );
  const paymentRailStageLabel =
    data.billingOverview.paymentRailStage === "LIVE"
      ? english
        ? "Live integration"
        : "真实接入"
      : english
        ? "Foundation only"
        : "基础层已冻结";
  const paymentLifecycleConnectionLabel = data.billingOverview
    .lifecycleSourceConnected
    ? english
      ? "Connected"
      : "已接 payment"
    : english
      ? "Not connected yet"
      : "当前还没接通";
  const paymentAvailableRailsLabel = data.billingOverview.availableProviders
    .map((provider) => getPaymentProviderLabel(provider, english))
    .join(" / ");
  const workerPublisherBeneficiaryViews = data.workerPublisherProfiles.map(
    (profile) => {
      const attributedEntries = data.revenueAttributionEntries.filter(
        (entry) =>
          entry.workerPublisherProfileId === profile.id ||
          (entry.beneficiaryType === "WORKER_PUBLISHER" &&
            entry.beneficiaryLabel === profile.displayName),
      );
      const payoutEntries = data.payoutEntries.filter(
        (entry) =>
          entry.workerPublisherProfileId === profile.id ||
          (entry.beneficiaryType === "WORKER_PUBLISHER" &&
            entry.beneficiaryLabel === profile.displayName),
      );

      return {
        id: profile.id,
        kind: "WORKER_PUBLISHER" as const,
        label: formatSettingsCommercialText(profile.displayName, english),
        statusLabel:
          publisherProfileStatusLabels[profile.status][english ? "en" : "zh"],
        attributedAmountCents: attributedEntries.reduce(
          (sum, entry) => sum + entry.attributedAmountCents,
          0,
        ),
        payableAmountCents: payoutEntries.reduce(
          (sum, entry) => sum + entry.payableAmountCents,
          0,
        ),
        pendingAmountCents: payoutEntries
          .filter((entry) => entry.status === "PENDING")
          .reduce((sum, entry) => sum + entry.payableAmountCents, 0),
        lineCount: attributedEntries.length,
      };
    },
  );
  const salesReferralBeneficiaryViews = data.salesReferrals.map((referral) => {
    const attributedEntries = data.revenueAttributionEntries.filter(
      (entry) =>
        entry.salesReferralId === referral.id ||
        (entry.beneficiaryType === "SALES_REFERRAL" &&
          entry.beneficiaryLabel === referral.beneficiaryLabel),
    );
    const payoutEntries = data.payoutEntries.filter(
      (entry) =>
        entry.salesReferralId === referral.id ||
        (entry.beneficiaryType === "SALES_REFERRAL" &&
          entry.beneficiaryLabel === referral.beneficiaryLabel),
    );

    return {
      id: referral.id,
      kind: "SALES_REFERRAL" as const,
      label: referral.beneficiaryLabel,
      statusLabel:
        salesReferralStatusLabels[referral.status][english ? "en" : "zh"],
      attributedAmountCents: attributedEntries.reduce(
        (sum, entry) => sum + entry.attributedAmountCents,
        0,
      ),
      payableAmountCents: payoutEntries.reduce(
        (sum, entry) => sum + entry.payableAmountCents,
        0,
      ),
      pendingAmountCents: payoutEntries
        .filter((entry) => entry.status === "PENDING")
        .reduce((sum, entry) => sum + entry.payableAmountCents, 0),
      lineCount: attributedEntries.length,
    };
  });
  const customEngagementBeneficiaryViews = data.customEngagements.map(
    (engagement) => {
      const attributedEntries = data.revenueAttributionEntries.filter(
        (entry) =>
          entry.customEngagementId === engagement.id ||
          (entry.beneficiaryType === "CUSTOM_SERVICES" &&
            entry.beneficiaryLabel === engagement.beneficiaryLabel),
      );
      const payoutEntries = data.payoutEntries.filter(
        (entry) =>
          entry.customEngagementId === engagement.id ||
          (entry.beneficiaryType === "CUSTOM_SERVICES" &&
            entry.beneficiaryLabel === engagement.beneficiaryLabel),
      );

      return {
        id: engagement.id,
        kind: "CUSTOM_SERVICES" as const,
        label: engagement.label,
        statusLabel:
          customEngagementStatusLabels[engagement.status][
            english ? "en" : "zh"
          ],
        attributedAmountCents: attributedEntries.reduce(
          (sum, entry) => sum + entry.attributedAmountCents,
          0,
        ),
        payableAmountCents: payoutEntries.reduce(
          (sum, entry) => sum + entry.payableAmountCents,
          0,
        ),
        pendingAmountCents: payoutEntries
          .filter((entry) => entry.status === "PENDING")
          .reduce((sum, entry) => sum + entry.payableAmountCents, 0),
        lineCount: attributedEntries.length,
      };
    },
  );
  const beneficiaryViews = [
    ...workerPublisherBeneficiaryViews,
    ...salesReferralBeneficiaryViews,
    ...customEngagementBeneficiaryViews,
  ];
  const attributionSourceBreakdown = Object.entries(revenueSourceLabels).map(
    ([sourceType, label]) => {
      const attributedEntries = data.revenueAttributionEntries.filter(
        (entry) => entry.sourceType === sourceType,
      );
      const payoutEntries = data.payoutEntries.filter(
        (entry) => entry.sourceType === sourceType,
      );

      return {
        sourceType,
        label,
        lineCount: attributedEntries.length,
        attributedAmountCents: attributedEntries.reduce(
          (sum, entry) => sum + entry.attributedAmountCents,
          0,
        ),
        pendingAmountCents: payoutEntries
          .filter((entry) => entry.status === "PENDING")
          .reduce((sum, entry) => sum + entry.payableAmountCents, 0),
      };
    },
  );
  const payoutProfileOptions =
    payoutProfileDraft.beneficiaryType === "WORKER_PUBLISHER"
      ? data.workerPublisherProfiles.map((profile) => ({
          id: profile.id,
          label: formatSettingsCommercialText(profile.displayName, english),
        }))
      : payoutProfileDraft.beneficiaryType === "SALES_REFERRAL"
        ? data.salesReferrals.map((referral) => ({
            id: referral.id,
            label: referral.beneficiaryLabel,
          }))
        : data.customEngagements.map((engagement) => ({
            id: engagement.id,
            label: engagement.label,
          }));
  const participantPortalOptions =
    participantPortalDraft.beneficiaryType === "WORKER_PUBLISHER"
      ? data.workerPublisherProfiles.map((profile) => ({
          id: profile.id,
          label: formatSettingsCommercialText(profile.displayName, english),
        }))
      : participantPortalDraft.beneficiaryType === "SALES_REFERRAL"
        ? data.salesReferrals.map((referral) => ({
            id: referral.id,
            label: referral.beneficiaryLabel,
          }))
        : data.customEngagements.map((engagement) => ({
            id: engagement.id,
            label: engagement.label,
          }));
  const currentSettlementBatch = data.currentSettlementBatch;
  const settlementBeneficiaryTotals = currentSettlementBatch
    ? Object.values(
        currentSettlementBatch.lines.reduce<
          Record<
            string,
            {
              beneficiaryType: RevenueBeneficiaryType;
              beneficiaryLabel: string;
              totalAmountCents: number;
              lineCount: number;
              missingProfileCount: number;
            }
          >
        >((acc, line) => {
          const key = `${line.beneficiaryType}:${line.beneficiaryLabel}`;
          const current = acc[key] ?? {
            beneficiaryType: line.beneficiaryType,
            beneficiaryLabel: line.beneficiaryLabel,
            totalAmountCents: 0,
            lineCount: 0,
            missingProfileCount: 0,
          };
          current.totalAmountCents += line.amountCents;
          current.lineCount += 1;
          if (line.payoutProfileRequired && !line.payoutProfile) {
            current.missingProfileCount += 1;
          }
          acc[key] = current;
          return acc;
        }, {}),
      )
    : [];
  const settlementSourceTotals = currentSettlementBatch
    ? Object.entries(revenueSourceLabels).map(([sourceType, label]) => {
        const lines = currentSettlementBatch.lines.filter(
          (line) => line.sourceType === sourceType,
        );
        return {
          sourceType,
          label,
          lineCount: lines.length,
          totalAmountCents: lines.reduce(
            (sum, line) => sum + line.amountCents,
            0,
          ),
        };
      })
    : [];
  const settlementProfileWarnings = currentSettlementBatch
    ? currentSettlementBatch.lines.filter(
        (line) => line.payoutProfileRequired && !line.payoutProfile,
      )
    : [];
  const payoutRailReadinessVariant =
    data.payoutRailReadiness.status === "READY_FOR_NARROW_PILOT"
      ? "success"
      : data.payoutRailReadiness.status === "CONDITIONAL_GO"
        ? "approval"
        : "danger";
  const payoutRailReadinessNarrative = buildPayoutRailReadinessNarrative({
    english,
    status: data.payoutRailReadiness.status,
    paidWithoutExportCount: data.payoutRailReadiness.paidWithoutExportCount,
    watchpoints: data.payoutRailReadiness.watchpoints,
  });
  const payoutRailPilotCohortVariant =
    data.payoutRailPilotCohort.status === "READY_FOR_OPERATOR_DRY_RUN"
      ? "success"
      : data.payoutRailPilotCohort.status === "READY_TO_SELECT_COHORT"
        ? "approval"
        : "danger";
  const payoutRailPilotCohortNarrative =
    data.payoutRailPilotCohort.status === "READY_FOR_OPERATOR_DRY_RUN"
      ? english
        ? "Current-main has one narrow cohort that fits the pilot envelope. Keep manual approval, keep manual fallback, and rehearse the first off-platform dry run before any rail implementation starts."
        : "当前主线已经有一条符合试点边界的窄人群。下一步仍应保留手工批准、手工回退，并先做一次站外试跑，而不是直接开始支付通道实现。"
      : data.payoutRailPilotCohort.status === "READY_TO_SELECT_COHORT"
        ? english
          ? "Current-main has more than one plausible cohort. Do not widen the pilot. Choose one beneficiary class, keep one payout method label, and keep the dry run narrow."
          : "当前主线已经出现不止一条可行人群，但这不代表可以扩大试点。先手工选定一个受益方类别，收敛到一种结算方式标签，再保持试跑足够窄。"
        : english
          ? "Current-main still needs more manual settlement proof, exception cleanup, or scope tightening before operators should rehearse a pilot cohort."
          : "当前主线还需要继续补手工结算证据、清理异常项，或进一步收紧范围，才适合进入运营级别的试点人群演练。";
  const settlementOpsProofNarrative = buildSettlementOpsProofNarrative({
    english,
    requiredBeneficiaryCount:
      data.settlementOpsProofPack.requiredBeneficiaryCount,
    paidWithoutExportCount: data.settlementOpsProofPack.paidWithoutExportCount,
  });
  const settlementExceptionNarrative = buildSettlementExceptionNarrative({
    english,
    openExceptionCount: data.settlementExceptionSummary.openExceptionCount,
    paidWithoutExportCount:
      data.settlementExceptionSummary.paidWithoutExportCount,
    reversalCount: data.settlementExceptionSummary.reversalCount,
  });
  const paymentRailNarrative =
    data.billingOverview.paymentProvider === PAYMENT_PROVIDER.STRIPE
      ? data.billingOverview.paymentConfigured
        ? english
          ? "Global rail is wired narrowly through Stripe: hosted checkout, hosted subscription management, and minimal lifecycle sync."
          : "全球支付通道当前通过 Stripe 以最窄方式接入：托管购买、托管订阅管理，以及最小生命周期同步。"
        : english
          ? "This organization resolves to the Stripe rail, but the hosted checkout env is not fully configured in this environment yet."
          : "当前组织会落到 Stripe 支付通道，但这个环境还没有把托管购买所需环境变量配完整。"
      : data.billingOverview.paymentProvider === PAYMENT_PROVIDER.ALIPAY
        ? data.billingOverview.paymentConfigured
          ? english
            ? "On Alipay. Checkout, notify and lifecycle sync are wired."
            : "走支付宝。已接通支付、通知和生命周期同步。"
          : english
            ? "This organization resolves to the Alipay rail, but the live Alipay env is not fully configured in this environment yet."
            : "当前组织会落到支付宝支付通道，但这个环境还没有把正式支付宝所需环境变量配完整。"
        : english
          ? data.billingOverview.paymentConfigured
            ? "On WeChat Pay. H5 / Native checkout, notify and lifecycle sync are wired."
            : "This organization resolves to the WeChat Pay rail, but the live WeChat Pay env is not fully configured in this environment yet."
          : data.billingOverview.paymentConfigured
            ? "走微信支付。已接通 H5 / 原生支付、通知和生命周期同步。"
            : "当前组织会落到微信支付通道，但这个环境还没有把正式微信支付所需环境变量配完整。";
  const seatSummaryNarrative =
    data.billingOverview.currentState === ACCESS_STATE.TRIALING
      ? english
        ? `Trial keeps ${data.seatSummary.includedAdminSeats} admin seat and ${data.seatSummary.trialCollaboratorSeats} collaborator seats open. Invited members stay visible but do not count as active seats until they enter the organization. If this organization activates today, ${data.seatSummary.additionalBillableSeats} additional active seats would move into paid posture.`
        : `试用期间会保留 ${data.seatSummary.includedAdminSeats} 个管理员席位和 ${data.seatSummary.trialCollaboratorSeats} 个协作席位。已邀请成员会保持可见，但在真正进入组织之前不计入活跃席位。如果今天转成正式激活，当前会有 ${data.seatSummary.additionalBillableSeats} 个额外活跃席位进入付费姿态。`
      : english
        ? `${data.seatSummary.activeSeatCount} active members are currently visible. ${data.seatSummary.paidIncludedSeatUsage} of them sit inside the included admin posture, and ${data.seatSummary.additionalBillableSeats} are currently in additional active-seat posture. Invited and inactive members remain visible for operations, but are not counted as active seats.`
        : `当前有 ${data.seatSummary.activeSeatCount} 位活跃成员可见，其中 ${data.seatSummary.paidIncludedSeatUsage} 位落在包含的管理员席位内，另外 ${data.seatSummary.additionalBillableSeats} 位处于额外活跃席位姿态。已邀请和非活跃成员会保留运营可见性，但都不计入活跃席位。`;
  const workerEntitlementNarrative =
    data.workerEntitlementSummary.commercialPathCount > 0
      ? english
        ? `${data.workerEntitlementSummary.includedActiveCount} included core workers are active now. ${data.workerEntitlementSummary.commercialActiveCount} commercial add-on rails are active today, while ${data.workerEntitlementSummary.addOnMonthlyReservedCount} monthly and ${data.workerEntitlementSummary.addOnPerUseReservedCount} per-use rails stay visible as reserved future paths. This is commercial wiring for later payment expansion, not a worker marketplace.`
        : `当前有 ${data.workerEntitlementSummary.includedActiveCount} 个基础能力已生效，另有 ${data.workerEntitlementSummary.commercialActiveCount} 个增值能力路径正在生效；${data.workerEntitlementSummary.addOnMonthlyReservedCount} 条按月路径和 ${data.workerEntitlementSummary.addOnPerUseReservedCount} 条按次路径仍只作为未来预留。这是一层后续支付可接入的商业接线，不代表能力市场已经开放。`
      : english
        ? `${data.workerEntitlementSummary.includedActiveCount} included core workers are active now. Add-on monthly and per-use rails are still modeled conservatively as future commercial wiring.`
        : `当前有 ${data.workerEntitlementSummary.includedActiveCount} 个基础能力已生效。按月增值与按次增值路径目前仍只以保守的未来商业接线方式存在。`;
  const usageSummaryNarrative =
    data.internalUsageOverview.totalUsageCount > 0
      ? english
        ? `The last 30 days show ${data.internalUsageOverview.highCostProcessingCount} high-cost processing runs, ${data.internalUsageOverview.syncCount} sync operations and ${data.internalUsageOverview.exportCount} exports. This remains product-safe internal usage language, not customer-visible token or storage billing.`
        : `近 30 天共有 ${data.internalUsageOverview.highCostProcessingCount} 次高成本处理、${data.internalUsageOverview.syncCount} 次同步和 ${data.internalUsageOverview.exportCount} 次导出。这里继续只用产品可读的内部用量语言，不会把令牌或存储写成对外计费项。`
      : english
        ? "Internal usage has not accumulated yet. Once meeting processing, imports, exports or recommendation refresh start running, this block will keep the cost posture visible in product-safe terms only."
        : "当前还没有累积出明显的内部用量。一旦会议处理、导入、导出或建议刷新开始运行，这里会继续用产品可读的方式把成本姿态说清楚。";
  const revenueRuleNarrative =
    data.revenueRuleSummary.totalRuleCount > 0
      ? english
        ? `${data.revenueRuleSummary.totalRuleCount} attribution rules are visible now across ${data.revenueRuleSummary.sourceTypeCount} revenue source types. ${data.revenueRuleSummary.recurringRuleCount} recurring rules and ${data.revenueRuleSummary.oneTimeRuleCount} one-time rules are modeled without turning this page into a finance console.`
        : `当前可见 ${data.revenueRuleSummary.totalRuleCount} 条归因规则，覆盖 ${data.revenueRuleSummary.sourceTypeCount} 类收益来源。其中 ${data.revenueRuleSummary.recurringRuleCount} 条是持续分成，${data.revenueRuleSummary.oneTimeRuleCount} 条是一次性分成，但这里仍不会扩成财务控制台。`
      : english
        ? "No attribution rules are visible yet. Once worker, custom or referral paths are configured, the split rules will appear here as internal commercial truth only."
        : "当前还没有可见的归因规则。后续接入能力、定制服务或转介绍路径后，这里会以内部联系真实状态的方式显示分成规则。";
  const revenueAttributionNarrative =
    data.revenueAttributionEntries.length > 0 || data.payoutEntries.length > 0
      ? english
        ? `${data.revenueAttributionSummary.pendingCount} attribution lines are still pending, with ${formatMoney(data.revenueAttributionSummary.pendingPayableAmountCents)} currently sitting in payable-later posture. Manual settlement review can now happen internally, while payout rails and any public portal discovery still stay out of scope.`
        : `当前还有 ${data.revenueAttributionSummary.pendingCount} 条归因条目处于待结算状态，其中 ${formatMoney(data.revenueAttributionSummary.pendingPayableAmountCents)} 落在待后续结算姿态。现在可以做内部手工结算复核，同时继续停在支付通道和公开门户发现之外。`
      : english
        ? "No attribution or payable-later lines are recorded yet. This block stays ready for platform, worker, custom and sales attribution without implying live payout execution."
        : "当前还没有实际记录的归因或待后续结算条目。这里会为平台、能力、定制服务和销售归因保持就绪，但不代表在线支付执行已经存在。";
  const settingsSummaryTitle = english
    ? "What can block today’s operating work"
    : "今天的经营动作哪里可能卡住";
  const settingsSummaryText =
    data.governanceSummary.pendingApprovals > 0
      ? english
        ? `${data.governanceSummary.pendingApprovals} pending reviews are waiting on workspace rules, sources, or owner access.`
        : `${data.governanceSummary.pendingApprovals} 条待复核事项正在等规则、信息来源或负责人权限。`
      : english
        ? "Check sources, seats, assistive service and review rules before changing today's work."
        : "先看入口、席位、复核规则和负责人权限是否支撑今天的工作。";
  const settingsSummaryItems = [
    {
      label: english ? "Organization state" : "组织状态",
      value: english
        ? `${currentAccessStateLabel} · ${data.billingOverview.activeSeatCount} active seats`
        : `${currentAccessStateLabel} · ${data.billingOverview.activeSeatCount} 个活跃席位`,
    },
    {
      label: english ? "Pending review" : "待处理复核",
      value: english
        ? `${data.governanceSummary.pendingApprovals} pending reviews · ${data.governanceSummary.auditEvents7d} recorded actions / 7d`
        : `${data.governanceSummary.pendingApprovals} 条待复核 · 近 7 天 ${data.governanceSummary.auditEvents7d} 条有记录操作`,
    },
    {
      label: english ? "Next step" : "下一步",
      value:
        data.integrationSummary.connectorErrorCount > 0
          ? english
            ? "Resolve connector errors first so ingress does not silently degrade."
            : "先处理连接错误，避免关键信息入口悄悄失效。"
          : !llmConfig.enabled ||
              !llmConfig.providerReady ||
              !llmConfig.connectionProbe.reachable
            ? english
              ? "Confirm the assistive service is usable before widening workspace usage."
              : "先确认今天的关键入口可用，再扩大工作区使用。"
            : english
              ? "Review which action rules should stay strict before widening action coverage."
              : "先检查哪些动作规则仍应保持严格，再扩大动作覆盖。",
    },
    {
      label: english ? "Source assets" : "信息来源",
      value: english
        ? `${data.integrationSummary.connectedConnectorCount} connected sources · ${data.integrationSummary.importedSignalCount} imported signals · ${data.governanceSummary.pendingApprovals} pending reviews`
        : `${data.integrationSummary.connectedConnectorCount} 个已连接入口 · ${data.integrationSummary.importedSignalCount} 条导入信号 · ${data.governanceSummary.pendingApprovals} 条待复核`,
    },
  ];
  const settingsAssetFocusItems = [
    {
      label: english ? "Object state" : "对象状态",
      value: settingsSummaryItems[0]?.value ?? currentAccessStateLabel,
      detail: english
        ? "Seat and access state decide whether today's work can keep moving."
        : "席位和访问状态决定今天的工作能不能继续推进。",
      href: "/settings?tab=permissions",
      tone: "info",
    },
    {
      label: english ? "Blocker" : "阻塞",
      value:
        data.integrationSummary.connectorErrorCount > 0
          ? english
            ? `${data.integrationSummary.connectorErrorCount} source issue(s)`
            : `${data.integrationSummary.connectorErrorCount} 个入口异常`
          : data.governanceSummary.pendingApprovals > 0
            ? english
              ? `${data.governanceSummary.pendingApprovals} pending reviews`
              : `${data.governanceSummary.pendingApprovals} 条待复核`
            : english
              ? "No dominant setting blocker"
              : "没有明显设置阻塞",
      detail:
        data.integrationSummary.connectorErrorCount > 0
          ? english
            ? "A source issue can stop new operating signals from entering."
            : "入口异常会阻断新的经营信号进入。"
          : data.governanceSummary.pendingApprovals > 0
            ? english
              ? "Pending reviews are the first control pressure."
              : "待复核事项是当前最直接的控制压力。"
            : english
              ? "Keep controls stable unless today's work is blocked."
              : "没有卡点时，不要改动稳定控制。",
      href:
        data.integrationSummary.connectorErrorCount > 0
          ? "/settings?tab=connectors"
          : data.governanceSummary.pendingApprovals > 0
            ? "/approvals"
            : undefined,
      tone:
        data.integrationSummary.connectorErrorCount > 0
          ? "danger"
          : data.governanceSummary.pendingApprovals > 0
            ? "warning"
            : "success",
    },
    {
      label: english ? "Pending decision" : "待决策",
      value:
        data.integrationSummary.connectorErrorCount > 0
          ? english
            ? "Which source to fix first"
            : "先修哪条入口"
          : !llmConfig.enabled ||
              !llmConfig.providerReady ||
              !llmConfig.connectionProbe.reachable
            ? english
              ? "Whether assistive service is usable"
              : "辅助服务是否可用"
            : english
              ? "Which rule stays strict"
              : "哪条规则继续收紧",
      detail: english
        ? "Decide which control affects today's work before opening deep settings."
        : "打开深层设置前，先判断哪条控制影响今天的工作。",
      href: "/diagnostics",
      tone: "warning",
    },
    {
      label: english ? "Next action" : "下一步动作",
      value:
        data.integrationSummary.connectorErrorCount > 0
          ? english
            ? "Fix the source entry"
            : "修入口"
          : !llmConfig.enabled ||
              !llmConfig.providerReady ||
              !llmConfig.connectionProbe.reachable
            ? english
              ? "Check assistive service"
              : "检查辅助服务"
            : english
              ? "Review approval rules"
              : "检查审批规则",
      detail: english
        ? "Only change controls that affect today's operating route."
        : "只改影响今天推进路径的控制项。",
      href:
        data.integrationSummary.connectorErrorCount > 0
          ? "/settings?tab=connectors"
          : !llmConfig.enabled ||
              !llmConfig.providerReady ||
              !llmConfig.connectionProbe.reachable
            ? "/settings?tab=account"
            : "/settings?tab=policies",
      tone: "info",
    },
  ] as const;
  const settingsSummaryConnectionCandidates: Array<
    SettingsSummaryConnection | undefined
  > = [
    data.governanceSummary.pendingApprovals > 0
      ? {
          label: english ? "Approval handoff" : "审批接手",
          value: english
            ? `${data.governanceSummary.pendingApprovals} pending approvals`
            : `${data.governanceSummary.pendingApprovals} 条待审批`,
          description: english
            ? "These items need an owner decision before they flow to customers or downstream actions."
            : "这些事项需要负责人先点，才会继续流向客户或下游动作。",
          href: "/approvals",
        }
      : undefined,
    {
      label: english ? "Information ownership" : "信息归属",
      value: english
        ? `${data.integrationSummary.connectedConnectorCount} connected sources · ${data.integrationSummary.unboundThreadCount} unbound threads`
        : `${data.integrationSummary.connectedConnectorCount} 个已连接入口 · ${data.integrationSummary.unboundThreadCount} 条未绑定线程`,
      description: english
        ? "Inbound conversations and imported records need to attach to customers, companies, or opportunities."
        : "接进来的会话和导入记录，需要归到客户、公司或机会。",
      href: "/imports/crm",
    },
    {
      label: english ? "Today readiness" : "今天可推进度",
      value: english
        ? `${data.governanceSummary.acceptedStrategyCount} routing changes · ${data.governanceSummary.acceptedSkillSuggestionCount} reusable patterns · ${data.governanceSummary.formalReviewQueueCount} waiting for owner confirmation`
        : `${data.governanceSummary.acceptedStrategyCount} 条路由调整 · ${data.governanceSummary.acceptedSkillSuggestionCount} 条可沿用经验 · ${data.governanceSummary.formalReviewQueueCount} 条待负责人确认`,
      description: english
        ? "Use diagnostics to see which source, permission, or reusable pattern is blocking today's push."
        : "去就绪度页看哪些入口、权限或经验规则正在卡住今天的推进。",
      href: "/diagnostics",
    },
    {
      label: english ? "Leadership readout" : "经营读数",
      value: english
        ? `${data.governanceSummary.auditEvents7d} recorded actions / 7d`
        : `近 7 天 ${data.governanceSummary.auditEvents7d} 条有记录操作`,
      description: english
        ? "Weekly reports should reflect these source and review choices without turning settings into a dashboard."
        : "周报会反映这些入口和复核选择，不把设置页变成看板。",
      href: "/reports",
    },
  ];
  const settingsSummaryConnections =
    settingsSummaryConnectionCandidates.filter(isDefined);
  const billingOperatingFoundationSummary =
    buildWorkspaceOperatingFoundationSummary({
      locale,
      workspaceName:
        data.workspace?.name ?? (english ? "Current workspace" : "当前工作区"),
      membershipRole: data.organizationSummary.activeMembershipRole,
      accessState: data.billingOverview.currentState,
      profileType: data.workspace?.profileType,
      focusAreasJson: data.workspace?.focusAreas,
      topJudgements: [
        data.lifecycleBoundarySummary.note,
        chinaRenewRestoreSummary?.currentAction ??
          (english
            ? `Current payment rail: ${paymentProviderLabel}`
            : `当前支付通道：${paymentProviderLabel}`),
        english
          ? `Seat posture: ${data.seatSummary.activeSeatCount} active seats, ${data.workerEntitlementSummary.includedActiveCount} included workers visible`
          : `席位姿态：${data.seatSummary.activeSeatCount} 个活跃席位，${data.workerEntitlementSummary.includedActiveCount} 个基础能力可见`,
      ],
      topPriorityHref:
        data.billingOverview.currentState === ACCESS_STATE.TRIALING
          ? "/setup"
          : "/settings?tab=billing",
      currentPage: "settings",
    });
  const inviteGuidance = buildInviteAcceptanceGuidance({
    locale,
    workspaceName:
      data.workspace?.name ?? (english ? "Current workspace" : "当前工作区"),
    activeCount: data.seatSummary.activeSeatCount,
    invitedCount: data.seatSummary.invitedSeatCount,
  });

  const savePolicy = (
    id: string,
    next: {
      mode: keyof typeof actionModeLabels;
      riskThreshold: keyof typeof riskLabels;
      enabled: boolean;
    },
    actionType: keyof typeof actionTypeLabels,
  ) => {
    startTransition(async () => {
      const result = await updatePolicyRuleAction({
        id,
        mode: next.mode,
        riskThreshold: next.riskThreshold,
        enabled: next.enabled,
      });

      if (!result.ok) {
        toast.error(
          result.error ?? (english ? "Policy update failed" : "策略更新失败"),
        );
        return;
      }

      toast.success(
        english
          ? `Policy updated: future ${actionTypeLabelsByLocale[actionType]} actions will follow the new rule.`
          : `策略已更新：后续${actionTypeLabelsByLocale[actionType]}动作会按新规则执行`,
      );
      router.refresh();
    });
  };

  const restoreDefaults = () => {
    if (!canManagePolicies) {
      toast.error(
        english
          ? "Your current role can review policies, but cannot restore defaults."
          : "当前角色可以查看策略，但不能恢复默认策略。",
      );
      return;
    }

    startTransition(async () => {
      const result = await restoreDefaultPoliciesAction();
      if (!result.ok) {
        toast.error(
          english ? "Failed to restore default policies" : "恢复默认策略失败",
        );
        return;
      }

      toast.success(
        english ? "Default policies restored" : "已恢复默认策略配置",
      );
      router.refresh();
    });
  };

  const runConnectorAction = (
    fn: () => Promise<{ ok: boolean; error?: string; message?: string }>,
    success: string,
  ) => {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Connector action failed" : "连接器操作失败"),
        );
        router.refresh();
        return;
      }

      toast.success(result.message ?? success);
      router.refresh();
    });
  };

  const runDingTalkDirectoryInviteSync = (dryRun: boolean) => {
    startTransition(async () => {
      const result = await syncAndInviteDingTalkDirectoryAction({ dryRun });

      if (result.result) {
        setDingtalkDirectoryInviteSummary({
          dryRun,
          processed: result.result.processed,
          createdUsers: result.result.createdUsers,
          reusedUsers: result.result.reusedUsers,
          upsertedMemberships: result.result.upsertedMemberships,
          sentMessages: result.result.sentMessages,
          skipped: result.result.skipped,
          skippedNoMobile: result.result.skippedNoMobile,
          nameCollisionResolved: result.result.nameCollisionResolved,
          errors: result.result.errors,
          recordedAt: new Date().toISOString(),
        });
      }

      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Connector action failed" : "连接器操作失败"),
        );
        router.refresh();
        return;
      }

      toast.success(
        result.message ??
          (dryRun
            ? english
              ? "DingTalk directory invite dry-run completed"
              : "钉钉目录邀请 dry-run 已完成"
            : english
              ? "DingTalk directory invite sync completed"
              : "钉钉目录邀请同步已完成"),
      );
      router.refresh();
    });
  };

  const inviteSelectedDingTalkDirectoryUsers = (dingtalkUserIds: string[]) => {
    startDingtalkInviteTransition(async () => {
      try {
        const result = await inviteDingTalkDirectoryUsersAction({
          dingtalkUserIds,
        });
        if (!result.ok) {
          toast.error(
            result.error ??
              (english ? "Invite action failed" : "邀请发送失败"),
          );
          router.refresh();
          return;
        }
        toast.success(
          result.message ??
            (english ? "DingTalk invite sent" : "钉钉邀请已发送"),
        );
      } catch (error) {
        console.error("[settings] inviteDingTalkDirectoryUsersAction threw", error);
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : english
              ? "Invite action failed"
              : "邀请发送失败",
        );
      } finally {
        router.refresh();
      }
    });
  };

  const runSuggestionAction = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) => {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Suggestion action failed" : "建议处理失败"),
        );
        return;
      }

      toast.success(success);
      router.refresh();
    });
  };

  const runFormalReviewDecisionAction = (
    suggestionId: string,
    fn: (input: {
      id: string;
      note?: string;
      checklist: FormalReviewChecklistState;
    }) => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) => {
    const checklist = getFormalReviewChecklistDraft(suggestionId);
    const note = formalReviewNotes[suggestionId]?.trim();
    runSuggestionAction(
      () =>
        fn({
          id: suggestionId,
          note: note && note.length > 0 ? note : undefined,
          checklist,
        }),
      success,
    );
  };

  const saveOperationalControls = () => {
    startTransition(async () => {
      const result = await updateWorkspaceOperationalControlsAction({
        defaultLocale: pilotDraft.defaultLocale,
        pilotMode: pilotDraft.pilotMode,
        captureConsentRequired: pilotDraft.captureConsentRequired,
        dataRetentionDays: pilotDraft.dataRetentionDays,
        featureFlags: pilotDraft.featureFlags,
      });

      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to save pilot settings" : "保存试点设置失败"),
        );
        return;
      }

      toast.success(english ? "Pilot settings updated" : "试点设置已更新");
      router.refresh();
    });
  };

  const persistWorkspaceLLMConfig = (nextConfig: {
    provider: "openai" | "qwen";
    defaultModel: string;
    extractionModel: string;
    briefingModel: string;
    reasoningModel: string;
  }) => {
    startTransition(async () => {
      const result = await updateWorkspaceLLMConfigAction({
        provider: nextConfig.provider,
        defaultModel: nextConfig.defaultModel,
        extractionModel: nextConfig.extractionModel,
        briefingModel: nextConfig.briefingModel,
        reasoningModel: nextConfig.reasoningModel,
      });

      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to update judgement service" : "更新判断服务配置失败"),
        );
        return;
      }

      if ((result.warnings?.length ?? 0) > 0) {
        toast.warning(result.warnings.slice(0, 2).join(english ? " | " : "；"));
      } else {
        toast.success(english ? "Judgement service updated" : "判断服务配置已更新");
      }

      if (result.config) {
        setLlmDraft({
          provider: result.config.provider === "qwen" ? "qwen" : "openai",
          defaultModel: result.config.defaultModel,
          extractionModel: result.config.extractionModel,
          briefingModel: result.config.briefingModel,
          reasoningModel: result.config.reasoningModel,
        });
      }

      router.refresh();
    });
  };

  const saveWorkspaceLLMConfig = () => {
    persistWorkspaceLLMConfig(llmDraft);
  };

  const createOrganization = () => {
    startTransition(async () => {
      const result = await createOrganizationAction(organizationDraft);
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to create organization" : "创建组织失败"),
        );
        return;
      }

      toast.success(
        english
          ? "Organization created and activated"
          : "组织已创建并切换为当前工作区",
      );
      setOrganizationDraft({ name: "" });
      router.push("/settings?tab=billing");
      router.refresh();
    });
  };

  const addMember = () => {
    startTransition(async () => {
      const result = await addOrganizationMemberAction(memberDraft);
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to add team member" : "添加团队成员失败"),
        );
        return;
      }

      if (result.inviteDispatch?.sent) {
        toast.success(
          english
            ? "Team member invited on DingTalk"
            : "团队成员已通过钉钉邀请",
        );
      } else if (result.inviteDispatch?.reason === "target_unresolved") {
        toast.error(
          english
            ? "Team member added, but DingTalk account was not matched. Invite was not sent."
            : "团队成员已添加，但未匹配到钉钉账号，邀请未发送。",
        );
      } else if (result.inviteDispatch?.reason === "not_configured") {
        toast.error(
          english
            ? "Team member added, but DingTalk app message is not configured."
            : "团队成员已添加，但钉钉应用消息通道未配置。",
        );
      } else {
        toast.success(
          english
            ? "Team member added. DingTalk invite is pending."
            : "团队成员已添加，钉钉邀请待发送。",
        );
      }
      setMemberDraft({
        email: "",
        name: "",
        role: "MEMBER",
        title: "",
        rolePresetKey: suggestRolePresetKeyFromText(
          data.workspace?.profileType,
        ),
      });
      router.refresh();
    });
  };

  const updateMemberLifecycle = (
    membershipId: string,
    nextStatus: MembershipStatus,
  ) => {
    startTransition(async () => {
      const result = await updateOrganizationMembershipLifecycleAction({
        membershipId,
        nextStatus,
      });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to update member posture" : "更新成员状态失败"),
        );
        return;
      }

      const successMessage =
        nextStatus === "ACTIVE"
          ? english
            ? "Member restored to active"
            : "成员已恢复为活跃状态"
          : nextStatus === "INVITED"
            ? english
              ? "Invite posture refreshed"
              : "已刷新邀请姿态"
            : english
              ? "Member moved to inactive"
              : "成员已设为非活跃";
      toast.success(successMessage);
      router.refresh();
    });
  };

  const updateMemberRole = (
    membershipId: string,
    currentRole: WorkspaceRole,
    nextRole: WorkspaceRole,
  ) => {
    if (currentRole === nextRole) {
      return;
    }

    const confirmationMessage = english
      ? `Change this member from ${roleLabelsByLocale[currentRole]} to ${roleLabelsByLocale[nextRole]}?`
      : `确认将该成员从${roleLabelsByLocale[currentRole]}切换为${roleLabelsByLocale[nextRole]}吗？`;

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    startTransition(async () => {
      const result = await updateOrganizationMembershipRoleAction({
        membershipId,
        nextRole,
      });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to update member role" : "更新成员角色失败"),
        );
        return;
      }

      toast.success(english ? "Member role updated" : "成员角色已更新");
      router.refresh();
    });
  };

  const updateMemberGoalProfile = (input: {
    membershipId: string;
    goalTitle: string;
    goalDescription: string;
    goalItems: string[];
    jobResponsibilities: string;
  }) => {
    startTransition(async () => {
      const result = await updateOrganizationMemberGoalProfileAction(input);
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to update member goal profile" : "更新成员目标信息失败"),
        );
        return;
      }

      toast.success(
        english
          ? "Member goal profile updated"
          : "成员目标与职责已更新",
      );
      router.refresh();
    });
  };

  const updateMemberGroupTag = (input: {
    membershipId: string;
    groupTag: string;
  }) => {
    startTransition(async () => {
      const result = await updateMemberGroupTagAction(input);
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to update member group tag" : "更新成员分组标签失败"),
        );
        return;
      }
      toast.success(english ? "Member group tag updated" : "成员分组标签已更新");
      router.refresh();
    });
  };

  const transferOwnership = (membershipId: string) => {
    startTransition(async () => {
      const result = await transferOrganizationOwnershipAction({
        membershipId,
      });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to transfer ownership" : "转移组织所有权失败"),
        );
        return;
      }

      toast.success(
        english ? "Organization ownership transferred" : "组织所有权已转移",
      );
      router.refresh();
    });
  };

  const switchOrganization = () => {
    startTransition(async () => {
      const result = await switchOrganizationAction({
        workspaceId: selectedWorkspaceId,
      });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to switch organization" : "切换组织失败"),
        );
        return;
      }

      toast.success(english ? "Organization switched" : "已切换组织");
      router.push("/dashboard");
      router.refresh();
    });
  };

  const revokeAuthSession = (sessionId: string) => {
    startTransition(async () => {
      const result = await revokeOrganizationAuthSessionAction({ sessionId });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to revoke auth session" : "撤销会话失败"),
        );
        return;
      }

      toast.success(english ? "Auth session revoked" : "会话已撤销");
      router.refresh();
    });
  };

  const revokeAuthSessionsByScope = (scope: AuthSessionRevokeScope) => {
    startTransition(async () => {
      const result = await revokeOrganizationAuthSessionsByScopeAction({
        scope,
      });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to revoke scoped auth sessions"
              : "批量撤销会话失败"),
        );
        return;
      }

      const scopeLabel = formatAuthSessionRevokeScope(scope, english);
      if ((result.revokedCount ?? 0) === 0) {
        toast.success(
          english
            ? `No ${scopeLabel} needed revocation`
            : `没有需要撤销的${scopeLabel}`,
        );
      } else {
        toast.success(
          english
            ? `Revoked ${result.revokedCount} ${scopeLabel}`
            : `已撤销 ${result.revokedCount} 个${scopeLabel}`,
        );
      }
      router.refresh();
    });
  };

  const rotateCurrentAuthSession = () => {
    startTransition(async () => {
      const result = await rotateCurrentOrganizationAuthSessionAction();
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to rotate current auth session"
              : "轮换当前会话失败"),
        );
        return;
      }

      toast.success(
        english ? "Current auth session rotated" : "当前会话已轮换",
      );
      router.refresh();
    });
  };

  const createWorkerPublisherProfile = () => {
    startTransition(async () => {
      const result = await createWorkerPublisherProfileAction(publisherDraft);
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to create worker publisher profile"
              : "创建能力发布方失败"),
        );
        return;
      }

      toast.success(
        english ? "Worker publisher profile created" : "能力发布方已创建",
      );
      setPublisherDraft({
        displayName: "",
        publisherKey: "",
        contactEmail: "",
        notes: "",
      });
      router.refresh();
    });
  };

  const updateWorkerPublisherProfileStatus = (
    id: string,
    status: PublisherProfileStatus,
  ) => {
    startTransition(async () => {
      const result = await updateWorkerPublisherProfileStatusAction({
        id,
        status,
      });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to update publisher status"
              : "更新发布方状态失败"),
        );
        return;
      }

      toast.success(english ? "Publisher status updated" : "发布方状态已更新");
      router.refresh();
    });
  };

  const createSalesReferral = () => {
    startTransition(async () => {
      const result = await createSalesReferralAction(salesReferralDraft);
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to create sales referral"
              : "创建销售转介绍失败"),
        );
        return;
      }

      toast.success(
        english ? "Sales referral created" : "销售转介绍记录已创建",
      );
      setSalesReferralDraft({
        beneficiaryLabel: "",
        referralKey: "",
        beneficiaryContact: "",
        notes: "",
      });
      router.refresh();
    });
  };

  const updateSalesReferralStatus = (
    id: string,
    status: SalesReferralStatus,
  ) => {
    startTransition(async () => {
      const result = await updateSalesReferralStatusAction({ id, status });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to update sales referral status"
              : "更新销售转介绍状态失败"),
        );
        return;
      }

      toast.success(
        english ? "Sales referral status updated" : "销售转介绍状态已更新",
      );
      router.refresh();
    });
  };

  const createCustomEngagement = () => {
    startTransition(async () => {
      const normalizedContractValue =
        customEngagementDraft.contractValue.trim().length === 0
          ? undefined
          : Number(customEngagementDraft.contractValue);
      const result = await createCustomEngagementAction({
        ...customEngagementDraft,
        contractValue: normalizedContractValue,
      });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to create custom engagement"
              : "创建定制合作项目失败"),
        );
        return;
      }

      toast.success(
        english ? "Custom engagement created" : "定制合作项目已创建",
      );
      setCustomEngagementDraft({
        engagementType: "IMPLEMENTATION",
        label: "",
        engagementKey: "",
        beneficiaryLabel: "",
        contractValue: "",
        notes: "",
      });
      router.refresh();
    });
  };

  const updateCustomEngagementStatus = (
    id: string,
    status: CustomEngagementStatus,
  ) => {
    startTransition(async () => {
      const result = await updateCustomEngagementStatusAction({ id, status });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to update custom engagement status"
              : "更新定制合作项目状态失败"),
        );
        return;
      }

      toast.success(
        english ? "Custom engagement status updated" : "定制合作项目状态已更新",
      );
      router.refresh();
    });
  };

  const createBeneficiaryPayoutProfile = () => {
    startTransition(async () => {
      const result =
        await createBeneficiaryPayoutProfileAction(payoutProfileDraft);
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to create payout profile" : "创建结算资料失败"),
        );
        return;
      }

      toast.success(
        english ? "Beneficiary payout profile created" : "受益方结算资料已创建",
      );
      setPayoutProfileDraft({
        beneficiaryType: "WORKER_PUBLISHER",
        beneficiaryId: "",
        displayName: "",
        legalName: "",
        contact: "",
        payoutMethodLabel: "",
        payoutDetailsReference: "",
        invoiceRequired: false,
        notes: "",
      });
      router.refresh();
    });
  };

  const updateBeneficiaryPayoutProfileStatus = (
    id: string,
    status: PayoutProfileStatus,
  ) => {
    startTransition(async () => {
      const result = await updateBeneficiaryPayoutProfileStatusAction({
        id,
        status,
      });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to update payout profile status"
              : "更新结算资料状态失败"),
        );
        return;
      }

      toast.success(
        english ? "Payout profile status updated" : "结算资料状态已更新",
      );
      router.refresh();
    });
  };

  const issueParticipantPortalAccess = () => {
    startTransition(async () => {
      const result = await issueParticipantPortalAccessAction(
        participantPortalDraft,
      );
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to issue participant portal access"
              : "发放贡献方门户访问失败"),
        );
        return;
      }

      toast.success(
        getParticipantPortalAccessIssuedToast(result.issuanceState, english),
      );
      setLatestParticipantPortalInviteUrl(result.inviteUrl ?? null);
      setParticipantPortalDraft({
        beneficiaryType: "WORKER_PUBLISHER",
        beneficiaryId: "",
        inviteEmail: "",
        displayName: "",
        notes: "",
      });
      router.refresh();
    });
  };

  const updateParticipantPortalAccessStatus = (
    accessId: string,
    status: ParticipantPortalAccessStatus,
  ) => {
    startTransition(async () => {
      const result = await updateParticipantPortalAccessStatusAction({
        accessId,
        status,
      });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to update participant portal access"
              : "更新贡献方门户访问失败"),
        );
        return;
      }

      toast.success(
        english ? "Participant portal status updated" : "贡献方门户状态已更新",
      );
      router.refresh();
    });
  };

  const reviewProgramApplication = (
    applicationId: string,
    status: ProgramApplicationStatus,
  ) => {
    startTransition(async () => {
      const result = await reviewProgramApplicationAction({
        applicationId,
        status,
        internalNotes: programApplicationNotes[applicationId]?.trim()
          ? programApplicationNotes[applicationId]
          : undefined,
        recommendedBeneficiaryType:
          programApplicationBeneficiaryTypes[applicationId] &&
          programApplicationBeneficiaryTypes[applicationId] !== "NONE"
            ? programApplicationBeneficiaryTypes[applicationId]
            : null,
        locale,
      });

      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to review application" : "审核申请失败"),
        );
        return;
      }

      toast.success(english ? "Application updated" : "申请状态已更新");
      router.refresh();
    });
  };

  const issueProgramApplicationInvite = (applicationId: string) => {
    startTransition(async () => {
      const result = await issueProgramApplicationInviteAction({
        applicationId,
        internalNotes: programApplicationNotes[applicationId]?.trim()
          ? programApplicationNotes[applicationId]
          : undefined,
        recommendedBeneficiaryType:
          programApplicationBeneficiaryTypes[applicationId] &&
          programApplicationBeneficiaryTypes[applicationId] !== "NONE"
            ? programApplicationBeneficiaryTypes[applicationId]
            : null,
        locale,
      });

      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to issue program invite"
              : "发放合作项目邀请失败"),
        );
        return;
      }

      toast.success(
        getProgramApplicationInviteToast(result.issuanceState, english),
      );
      setLatestProgramApplicationInvite(
        result.inviteUrl
          ? {
              applicationId,
              inviteUrl: result.inviteUrl,
            }
          : null,
      );
      router.refresh();
    });
  };

  const createSettlementBatch = () => {
    startTransition(async () => {
      const result = await createSettlementBatchAction(settlementBatchDraft);
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to create settlement batch"
              : "创建结算批次失败"),
        );
        return;
      }

      toast.success(
        result.message ??
          (english ? "Settlement batch created" : "结算批次已创建"),
      );
      setSettlementBatchDraft((current) => ({
        ...current,
        notes: "",
      }));
      router.refresh();
    });
  };

  const approveCurrentSettlementBatch = (batchId: string) => {
    startTransition(async () => {
      const result = await approveSettlementBatchAction({ batchId });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to approve settlement batch"
              : "批准结算批次失败"),
        );
        return;
      }

      toast.success(
        result.message ??
          (english ? "Settlement batch approved" : "结算批次已批准"),
      );
      router.refresh();
    });
  };

  const exportCurrentSettlementBatch = (batchId: string) => {
    startTransition(async () => {
      const result = await exportSettlementBatchCsvAction({ batchId });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to export settlement batch"
              : "导出结算批次失败"),
        );
        return;
      }

      const blob = new Blob([result.csv ?? ""], {
        type: "text/csv;charset=utf-8",
      });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = result.filename ?? "settlement-batch.csv";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(href);

      toast.success(
        result.message ??
          (english ? "Settlement batch exported" : "结算批次已导出"),
      );
      router.refresh();
    });
  };

  const markSettlementLinePaid = (lineId: string) => {
    startTransition(async () => {
      const result = await markSettlementLinePaidAction({
        lineId,
        notes: settlementLineNotes[lineId]?.trim()
          ? settlementLineNotes[lineId]
          : undefined,
      });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to mark settlement line paid"
              : "标记结算条目为已支付失败"),
        );
        return;
      }

      toast.success(
        result.message ??
          (english ? "Settlement line marked paid" : "结算条目已标记为已支付"),
      );
      setSettlementLineNotes((current) => ({ ...current, [lineId]: "" }));
      router.refresh();
    });
  };

  const reverseSettlementLine = (lineId: string) => {
    startTransition(async () => {
      const reason = settlementLineReverseReasons[lineId]?.trim() ?? "";
      const result = await reverseSettlementLineAction({ lineId, reason });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to reverse settlement line"
              : "冲回结算条目失败"),
        );
        return;
      }

      toast.success(
        result.message ??
          (english ? "Settlement line reversed" : "结算条目已冲回"),
      );
      setSettlementLineReverseReasons((current) => ({
        ...current,
        [lineId]: "",
      }));
      router.refresh();
    });
  };

  const closeCurrentSettlementBatch = (batchId: string) => {
    startTransition(async () => {
      const result = await closeSettlementBatchAction({ batchId });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to close settlement batch" : "关闭结算批次失败"),
        );
        return;
      }

      toast.success(
        result.message ??
          (english ? "Settlement batch closed" : "结算批次已关闭"),
      );
      router.refresh();
    });
  };

  function formatMoney(cents: number) {
    const value = cents / 100;
    return english
      ? `CNY ${value.toFixed(0)} / mo`
      : `¥${value.toFixed(0)} / 月`;
  }

  function formatMoneyAmount(cents: number, currency = "CNY") {
    const value = cents / 100;
    return english ? `${currency} ${value.toFixed(0)}` : `¥${value.toFixed(0)}`;
  }

  const startCheckout = (provider?: PaymentProvider) => {
    startTransition(async () => {
      const result = await createBillingCheckoutAction(
        provider ? { provider } : undefined,
      );
      if (!result.ok || !result.url) {
        toast.error(
          result.error ??
            (english ? "Failed to start checkout" : "启动购买流程失败"),
        );
        return;
      }

      const chinaCheckoutLabel =
        provider === PAYMENT_PROVIDER.ALIPAY ||
        provider === PAYMENT_PROVIDER.WECHAT_PAY
          ? getChinaCheckoutActionLabel({
              accessState: data.billingOverview.currentState,
              provider,
              english,
            })
          : null;

      toast.success(
        chinaCheckoutLabel
          ? english
            ? `Opening ${chinaCheckoutLabel}`
            : `正在进入：${chinaCheckoutLabel}`
          : english
            ? "Redirecting to hosted checkout"
            : "正在跳转到托管购买页",
      );
      window.location.assign(result.url);
    });
  };

  const openBillingPortal = () => {
    startTransition(async () => {
      const result = await createBillingPortalAction();
      if (!result.ok || !result.url) {
        toast.error(
          result.error ??
            (english
              ? "Failed to open the billing portal"
              : "打开订阅管理失败"),
        );
        return;
      }

      toast.success(
        english
          ? "Redirecting to subscription management"
          : "正在跳转到订阅管理",
      );
      window.location.assign(result.url);
    });
  };

  const refreshBilling = () => {
    startTransition(async () => {
      const result = await refreshBillingStatusAction();
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to refresh billing status" : "刷新订阅状态失败"),
        );
        return;
      }

      toast.success(
        result.message ??
          (english
            ? `Billing state refreshed: ${accessStateLabels[result.accessState ?? data.billingOverview.currentState][english ? "en" : "zh"]}`
            : `订阅状态已刷新：${accessStateLabels[result.accessState ?? data.billingOverview.currentState][english ? "en" : "zh"]}`),
      );
      router.refresh();
    });
  };

  const applyRecommendedPilotPreset = () => {
    if (!canManageOperationalControls) {
      toast.error(
        english
          ? "Your current role can review operating presets, but cannot change them."
          : "当前角色可以查看运行预设，但不能修改这些控制。",
      );
      return;
    }

    router.push("/settings?tab=pilot", { scroll: false });
    setPilotDraft((current) => ({
      ...current,
      defaultLocale: locale,
      pilotMode: true,
      captureConsentRequired: true,
      dataRetentionDays: Math.max(current.dataRetentionDays, 90),
      featureFlags: {
        ...current.featureFlags,
        diagnosticsCenter: true,
        multilingualUi: true,
        captureAudio: true,
      },
    }));
    toast.success(
      english
        ? "Recommended preset applied to the draft controls"
        : "已将推荐预设写入当前草稿",
    );
  };

  return (
    <div className="workspace-surface-stack">
      <PageHeader
        eyebrow={pageStory.eyebrow}
        title={messages.settings.title}
        description={
          english
            ? "Sources, seats, review rules and assistive service choices that affect today's work."
            : "入口、席位、复核规则和负责人权限，会直接影响今天的工作。"
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={restoreDefaults}
              disabled={pending || !canManagePolicies}
            >
              {messages.settings.restoreDefaults}
            </Button>
            {canManageWorkspaceSetup ? (
              <Button asChild variant="secondary">
                <Link href="/setup">{messages.settings.rerunSetup}</Link>
              </Button>
            ) : (
              <Button variant="secondary" disabled>
                {messages.settings.rerunSetup}
              </Button>
            )}
          </>
        }
      />

      <CustomerAssetFocusStrip
        eyebrow={english ? "Operating controls" : "经营控制"}
        title={
          english
            ? "Change only the control that blocks today's work."
            : "只改卡住今天工作的那条控制。"
        }
        summary={
          english
            ? "Settings are useful when they reveal source health, owner access, pending review, and the next safe control change."
            : "设置页先告诉你入口是否正常、负责人是否有权限、哪些复核待处理，以及下一步该改哪条控制。"
        }
        items={[...settingsAssetFocusItems]}
        primaryAction={{
          label:
            data.integrationSummary.connectorErrorCount > 0
              ? english
                ? "Fix sources"
                : "修入口"
              : english
                ? "Review controls"
                : "检查控制",
          href:
            data.integrationSummary.connectorErrorCount > 0
              ? "/settings?tab=connectors"
              : "/settings?tab=policies",
        }}
        secondaryAction={{
          label: english ? "Open diagnostics" : "打开就绪度",
          href: "/diagnostics",
        }}
      />

      <LazyDisclosure title={english ? "Reference: settings basis" : "引用：设置依据"}>
        <ObjectContextOperatingSummary
          label={english ? "Settings operating summary" : "设置操作摘要"}
          title={settingsSummaryTitle}
          summary={settingsSummaryText}
          items={settingsSummaryItems}
          connectionsLabel={english ? "Connected loop" : "关联对象与回路"}
          connections={settingsSummaryConnections}
        />
      </LazyDisclosure>

      <SettingsOverviewPanels
        applyRecommendedPilotPreset={applyRecommendedPilotPreset}
        canApplyRecommendedPilotPreset={canManageOperationalControls}
        connectorBannerMessage={
          connectorState.status
            ? formatConnectorBannerMessage(connectorState, english)
            : null
        }
        connectorBannerTone={
          connectorState.status
            ? connectorState.status === "connected"
              ? "success"
              : "warning"
            : null
        }
        diagnosticsEnabled={featureFlags.diagnosticsCenter}
        english={english}
        navLabels={{
          analytics: messages.shell.nav.analytics,
          diagnostics: messages.shell.nav.diagnostics,
          imports: messages.shell.nav.imports,
          inbox: messages.shell.nav.inbox,
        }}
        onReviewAuthControls={() =>
          router.push("/settings?tab=permissions", { scroll: false })
        }
        operatingReadiness={{
          connectedConnectorCount:
            data.integrationSummary.connectedConnectorCount,
          connectorErrorCount: data.integrationSummary.connectorErrorCount,
          importedSignalCount: data.integrationSummary.importedSignalCount,
          pendingApprovals: data.governanceSummary.pendingApprovals,
          approvalProtectedActions:
            data.governanceSummary.approvalProtectedActions,
          budgetCount: data.budgets.length,
          llmFallbacks7d: data.governanceSummary.llmFallbacks7d,
        }}
        recommendations={settingsGuidanceRecommendations}
        reminders={settingsGuidanceReminders}
        stats={{
          policyCount: data.policies.length,
          budgetCount: data.budgets.length,
          teamMemberCount: data.memberships.length,
        }}
      />

      <Tabs defaultValue={activeTab} onValueChange={navigateSettingsTab}>
        <TabsList className="relative z-20 pointer-events-auto">
          <TabsTrigger value="account">
            {messages.settings.tabs.account}
          </TabsTrigger>
          <TabsTrigger value="billing">
            {messages.settings.tabs.billing}
          </TabsTrigger>
          <TabsTrigger value="connectors">
            {messages.settings.tabs.connectors}
          </TabsTrigger>
          <TabsTrigger value="policies">
            {messages.settings.tabs.policies}
          </TabsTrigger>
          <TabsTrigger value="budgets">
            {messages.settings.tabs.budgets}
          </TabsTrigger>
          <TabsTrigger value="permissions">
            {messages.settings.tabs.permissions}
          </TabsTrigger>
          <TabsTrigger value="pilot">
            {messages.settings.tabs.pilot}
          </TabsTrigger>
        </TabsList>

        <AccountSettingsTab
          createOrganization={createOrganization}
          crmSources={crmSources}
          currentAccessStateLabel={currentAccessStateLabel}
          data={data}
          defaultStrategiesSummary={defaultStrategiesSummary}
          english={english}
          focusAreasSummary={focusAreasSummary}
          llmDraft={llmDraft}
          llmConfig={llmConfig}
          organizationDraft={organizationDraft}
          pending={pending}
          roleLabelsByLocale={roleLabelsByLocale}
          saveWorkspaceLLMConfig={saveWorkspaceLLMConfig}
          selectedWorkspaceId={selectedWorkspaceId}
          setLlmDraft={setLlmDraft}
          setOrganizationDraft={setOrganizationDraft}
          setSelectedWorkspaceId={setSelectedWorkspaceId}
          switchOrganization={switchOrganization}
        />

        <TabsContent value="billing">
          <div className="space-y-6">
            <BillingOverviewPanels
              billingOperatingFoundationSummary={
                billingOperatingFoundationSummary
              }
              billingPortalModeLabel={billingPortalModeLabel}
              billingState={billingState}
              canManageBilling={canManageBilling}
              chinaCheckoutButtonsVisible={chinaCheckoutButtonsVisible}
              data={data}
              english={english}
              formatMoney={formatMoney}
              openBillingPortal={openBillingPortal}
              paymentAvailableRailsLabel={paymentAvailableRailsLabel}
              paymentCallbackModeLabel={paymentCallbackModeLabel}
              paymentCheckoutModeLabel={paymentCheckoutModeLabel}
              paymentLifecycleConnectionLabel={paymentLifecycleConnectionLabel}
              paymentLifecycleMappingModeLabel={
                paymentLifecycleMappingModeLabel
              }
              paymentLifecycleSourceLabel={paymentLifecycleSourceLabel}
              paymentProviderLabel={paymentProviderLabel}
              paymentRailNarrative={paymentRailNarrative}
              paymentRailStageLabel={paymentRailStageLabel}
              paymentRegionLabel={paymentRegionLabel}
              paymentSubscriptionLabel={paymentSubscriptionLabel}
              pending={pending}
              refreshBilling={refreshBilling}
              startCheckout={startCheckout}
              workerEntitlementNarrative={workerEntitlementNarrative}
            />

            {reservedCommercialReadable ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {english
                        ? "Contributor / partner registry"
                        : "贡献方 / 伙伴登记册"}
                    </CardTitle>
                    <CardDescription>
                      {english
                        ? "Internal log of worker publishers, sales referrals, custom engagements."
                        : "内部记录：能力发布方、销售转介、定制合作。"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {english
                        ? `Contributor registry management is ${canManageContributionRegistry ? "enabled" : "read-only"} for the current role. Registry creation and status changes remain capability-gated.`
                        : `当前角色的贡献方登记管理为${canManageContributionRegistry ? "可操作" : "只读"}；登记创建和状态变更继续受能力边界控制。`}
                    </div>
                    <div className="grid gap-4 xl:grid-cols-3">
                      <div className="theme-surface-panel rounded-2xl px-4 py-4">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {english
                            ? "Create worker publisher"
                            : "新增能力发布方"}
                        </p>
                        <div className="mt-3 space-y-3">
                          <Input
                            value={publisherDraft.displayName}
                            onChange={(event) =>
                              setPublisherDraft((current) => ({
                                ...current,
                                displayName: event.target.value,
                              }))
                            }
                            placeholder={
                              english ? "Display name" : "发布方名称"
                            }
                          />
                          <Input
                            value={publisherDraft.publisherKey}
                            onChange={(event) =>
                              setPublisherDraft((current) => ({
                                ...current,
                                publisherKey: event.target.value,
                              }))
                            }
                            placeholder={
                              english
                                ? "Optional publisher key"
                                : "可选发布方标识"
                            }
                          />
                          <Input
                            value={publisherDraft.contactEmail}
                            onChange={(event) =>
                              setPublisherDraft((current) => ({
                                ...current,
                                contactEmail: event.target.value,
                              }))
                            }
                            placeholder={english ? "Contact email" : "联系邮箱"}
                          />
                          <Input
                            value={publisherDraft.notes}
                            onChange={(event) =>
                              setPublisherDraft((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                            placeholder={english ? "Notes" : "备注"}
                          />
                          <Button
                            onClick={createWorkerPublisherProfile}
                            disabled={
                              pending ||
                              !canManageContributionRegistry ||
                              publisherDraft.displayName.trim().length < 2
                            }
                          >
                            {english
                              ? "Create publisher profile"
                              : "创建发布方记录"}
                          </Button>
                        </div>
                      </div>

                      <div className="theme-surface-panel rounded-2xl px-4 py-4">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {english ? "Create sales referral" : "新增销售转介绍"}
                        </p>
                        <div className="mt-3 space-y-3">
                          <Input
                            value={salesReferralDraft.beneficiaryLabel}
                            onChange={(event) =>
                              setSalesReferralDraft((current) => ({
                                ...current,
                                beneficiaryLabel: event.target.value,
                              }))
                            }
                            placeholder={
                              english
                                ? "Referral beneficiary label"
                                : "转介绍对象名称"
                            }
                          />
                          <Input
                            value={salesReferralDraft.referralKey}
                            onChange={(event) =>
                              setSalesReferralDraft((current) => ({
                                ...current,
                                referralKey: event.target.value,
                              }))
                            }
                            placeholder={
                              english
                                ? "Optional referral key"
                                : "可选转介绍标识"
                            }
                          />
                          <Input
                            value={salesReferralDraft.beneficiaryContact}
                            onChange={(event) =>
                              setSalesReferralDraft((current) => ({
                                ...current,
                                beneficiaryContact: event.target.value,
                              }))
                            }
                            placeholder={english ? "Contact" : "联系方式"}
                          />
                          <Input
                            value={salesReferralDraft.notes}
                            onChange={(event) =>
                              setSalesReferralDraft((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                            placeholder={english ? "Notes" : "备注"}
                          />
                          <Button
                            onClick={createSalesReferral}
                            disabled={
                              pending ||
                              !canManageContributionRegistry ||
                              salesReferralDraft.beneficiaryLabel.trim()
                                .length < 2
                            }
                          >
                            {english
                              ? "Create sales referral"
                              : "创建销售转介绍"}
                          </Button>
                        </div>
                      </div>

                      <div className="theme-surface-panel rounded-2xl px-4 py-4">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {english
                            ? "Create custom engagement"
                            : "新增定制合作项目"}
                        </p>
                        <div className="mt-3 space-y-3">
                          <Select
                            value={customEngagementDraft.engagementType}
                            onValueChange={(value) =>
                              setCustomEngagementDraft((current) => ({
                                ...current,
                                engagementType: value as CustomEngagementType,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(customEngagementTypeLabels).map(
                                ([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label[english ? "en" : "zh"]}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                          <Input
                            value={customEngagementDraft.label}
                            onChange={(event) =>
                              setCustomEngagementDraft((current) => ({
                                ...current,
                                label: event.target.value,
                              }))
                            }
                            placeholder={
                              english ? "Engagement label" : "项目名称"
                            }
                          />
                          <Input
                            value={customEngagementDraft.engagementKey}
                            onChange={(event) =>
                              setCustomEngagementDraft((current) => ({
                                ...current,
                                engagementKey: event.target.value,
                              }))
                            }
                            placeholder={
                              english
                                ? "Optional engagement key"
                                : "可选项目标识"
                            }
                          />
                          <Input
                            value={customEngagementDraft.beneficiaryLabel}
                            onChange={(event) =>
                              setCustomEngagementDraft((current) => ({
                                ...current,
                                beneficiaryLabel: event.target.value,
                              }))
                            }
                            placeholder={
                              english ? "Beneficiary label" : "受益方名称"
                            }
                          />
                          <Input
                            value={customEngagementDraft.contractValue}
                            onChange={(event) =>
                              setCustomEngagementDraft((current) => ({
                                ...current,
                                contractValue: event.target.value,
                              }))
                            }
                            placeholder={
                              english
                                ? "Contract value (CNY)"
                                : "合同金额（元）"
                            }
                          />
                          <Input
                            value={customEngagementDraft.notes}
                            onChange={(event) =>
                              setCustomEngagementDraft((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                            placeholder={english ? "Notes" : "备注"}
                          />
                          <Button
                            onClick={createCustomEngagement}
                            disabled={
                              pending ||
                              !canManageContributionRegistry ||
                              customEngagementDraft.label.trim().length < 2 ||
                              customEngagementDraft.beneficiaryLabel.trim()
                                .length < 2
                            }
                          >
                            {english
                              ? "Create custom engagement"
                              : "创建定制合作项目"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-3">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[color:var(--foreground)]">
                            {english ? "Worker publishers" : "能力发布方"}
                          </p>
                          <Select
                            value={publisherStatusFilter}
                            onValueChange={(value) =>
                              setPublisherStatusFilter(
                                value as PublisherProfileStatus | "ALL",
                              )
                            }
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ALL">
                                {english ? "All statuses" : "全部状态"}
                              </SelectItem>
                              {Object.entries(publisherProfileStatusLabels).map(
                                ([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label[english ? "en" : "zh"]}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        {visibleWorkerPublisherProfiles.length ? (
                          visibleWorkerPublisherProfiles.map((profile) => (
                            <div
                              key={profile.id}
                              className="theme-surface-panel rounded-2xl px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                                  {formatSettingsCommercialText(
                                    profile.displayName,
                                    english,
                                  )}
                                </p>
                                <Badge
                                  variant={
                                    profile.status === "ACTIVE"
                                      ? "success"
                                      : "neutral"
                                  }
                                >
                                  {
                                    publisherProfileStatusLabels[
                                      profile.status
                                    ][english ? "en" : "zh"]
                                  }
                                </Badge>
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <Info
                                  label={english ? "Registry status" : "登记状态"}
                                  value={english ? "Registered" : "已登记"}
                                />
                                <Info
                                  label={english ? "Contact" : "联系邮箱"}
                                  value={
                                    profile.contactEmail
                                      ? english
                                        ? "Registered"
                                        : "已登记"
                                      : english
                                        ? "Not set"
                                        : "未设置"
                                  }
                                />
                                <Info
                                  label={english ? "Created" : "创建时间"}
                                  value={formatSettingsDateLabel(profile.createdAt, english)}
                                />
                              </div>
                              {profile.notes ? (
                                <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                                  {formatSettingsCommercialText(
                                    profile.notes,
                                    english,
                                  )}
                                </p>
                              ) : null}
                              <div className="mt-3">
                                <Select
                                  value={profile.status}
                                  disabled={
                                    !canManageContributionRegistry || pending
                                  }
                                  onValueChange={(value) =>
                                    updateWorkerPublisherProfileStatus(
                                      profile.id,
                                      value as PublisherProfileStatus,
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(
                                      publisherProfileStatusLabels,
                                    ).map(([value, label]) => (
                                      <SelectItem key={value} value={value}>
                                        {label[english ? "en" : "zh"]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))
                        ) : (
                          <EmptyState
                            title={
                              english
                                ? "No publisher profiles yet"
                                : "当前还没有发布方记录"
                            }
                            description={
                              english
                                ? "Create the first worker publisher profile above."
                                : "先在上方创建第一条能力发布方记录。"
                            }
                          />
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[color:var(--foreground)]">
                            {english ? "Sales referrals" : "销售转介绍"}
                          </p>
                          <Select
                            value={salesReferralStatusFilter}
                            onValueChange={(value) =>
                              setSalesReferralStatusFilter(
                                value as SalesReferralStatus | "ALL",
                              )
                            }
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ALL">
                                {english ? "All statuses" : "全部状态"}
                              </SelectItem>
                              {Object.entries(salesReferralStatusLabels).map(
                                ([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label[english ? "en" : "zh"]}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        {visibleSalesReferrals.length ? (
                          visibleSalesReferrals.map((referral) => (
                            <div
                              key={referral.id}
                              className="theme-surface-panel rounded-2xl px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                                  {referral.beneficiaryLabel}
                                </p>
                                <Badge
                                  variant={
                                    referral.status === "ACTIVE"
                                      ? "success"
                                      : referral.status === "CANCELED"
                                        ? "danger"
                                        : "neutral"
                                  }
                                >
                                  {
                                    salesReferralStatusLabels[referral.status][
                                      english ? "en" : "zh"
                                    ]
                                  }
                                </Badge>
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <Info
                                  label={
                                    english ? "Registry status" : "登记状态"
                                  }
                                  value={english ? "Registered" : "已登记"}
                                />
                                <Info
                                  label={english ? "Contact" : "联系方式"}
                                  value={
                                    referral.beneficiaryContact
                                      ? english
                                        ? "Registered"
                                        : "已登记"
                                      : english
                                        ? "Not set"
                                        : "未设置"
                                  }
                                />
                                <Info
                                  label={
                                    english ? "Effective from" : "生效起点"
                                  }
                                  value={formatSettingsDateLabel(
                                    referral.effectiveFrom,
                                    english,
                                  )}
                                />
                                <Info
                                  label={
                                    english ? "Effective until" : "生效截止"
                                  }
                                  value={formatSettingsDateLabel(referral.effectiveTo, english)}
                                />
                              </div>
                              {referral.notes ? (
                                <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                                  {formatSettingsCommercialText(
                                    referral.notes,
                                    english,
                                  )}
                                </p>
                              ) : null}
                              <div className="mt-3">
                                <Select
                                  value={referral.status}
                                  disabled={
                                    !canManageContributionRegistry || pending
                                  }
                                  onValueChange={(value) =>
                                    updateSalesReferralStatus(
                                      referral.id,
                                      value as SalesReferralStatus,
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(
                                      salesReferralStatusLabels,
                                    ).map(([value, label]) => (
                                      <SelectItem key={value} value={value}>
                                        {label[english ? "en" : "zh"]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))
                        ) : (
                          <EmptyState
                            title={
                              english
                                ? "No sales referrals yet"
                                : "当前还没有销售转介绍"
                            }
                            description={
                              english
                                ? "Create the first referral record above."
                                : "先在上方创建第一条销售转介绍记录。"
                            }
                          />
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[color:var(--foreground)]">
                            {english ? "Custom engagements" : "定制合作项目"}
                          </p>
                          <div className="flex gap-2">
                            <Select
                              value={customEngagementTypeFilter}
                              onValueChange={(value) =>
                                setCustomEngagementTypeFilter(
                                  value as CustomEngagementType | "ALL",
                                )
                              }
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL">
                                  {english ? "All types" : "全部类型"}
                                </SelectItem>
                                {Object.entries(customEngagementTypeLabels).map(
                                  ([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label[english ? "en" : "zh"]}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                            <Select
                              value={customEngagementStatusFilter}
                              onValueChange={(value) =>
                                setCustomEngagementStatusFilter(
                                  value as CustomEngagementStatus | "ALL",
                                )
                              }
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL">
                                  {english ? "All statuses" : "全部状态"}
                                </SelectItem>
                                {Object.entries(
                                  customEngagementStatusLabels,
                                ).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label[english ? "en" : "zh"]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {visibleCustomEngagements.length ? (
                          visibleCustomEngagements.map((engagement) => (
                            <div
                              key={engagement.id}
                              className="theme-surface-panel rounded-2xl px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                                  {engagement.label}
                                </p>
                                <Badge variant="info">
                                  {
                                    customEngagementTypeLabels[
                                      engagement.engagementType
                                    ][english ? "en" : "zh"]
                                  }
                                </Badge>
                                <Badge
                                  variant={
                                    engagement.status === "ACTIVE"
                                      ? "success"
                                      : engagement.status === "COMPLETED"
                                        ? "info"
                                        : "danger"
                                  }
                                >
                                  {
                                    customEngagementStatusLabels[
                                      engagement.status
                                    ][english ? "en" : "zh"]
                                  }
                                </Badge>
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <Info
                                  label={
                                    english
                                      ? "Registry status"
                                      : "登记状态"
                                  }
                                  value={english ? "Registered" : "已登记"}
                                />
                                <Info
                                  label={english ? "Beneficiary" : "受益方"}
                                  value={engagement.beneficiaryLabel}
                                />
                                <Info
                                  label={
                                    english ? "Contract value" : "合同金额"
                                  }
                                  value={
                                    engagement.contractValueCents === null
                                      ? english
                                        ? "Not set"
                                        : "未设置"
                                      : formatMoneyAmount(
                                          engagement.contractValueCents,
                                          engagement.currency,
                                        )
                                  }
                                />
                                <Info
                                  label={
                                    english ? "Effective from" : "生效起点"
                                  }
                                  value={formatSettingsDateLabel(
                                    engagement.effectiveFrom,
                                    english,
                                  )}
                                />
                              </div>
                              {engagement.notes ? (
                                <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                                  {formatSettingsCommercialText(
                                    engagement.notes,
                                    english,
                                  )}
                                </p>
                              ) : null}
                              <div className="mt-3">
                                <Select
                                  value={engagement.status}
                                  disabled={
                                    !canManageContributionRegistry || pending
                                  }
                                  onValueChange={(value) =>
                                    updateCustomEngagementStatus(
                                      engagement.id,
                                      value as CustomEngagementStatus,
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(
                                      customEngagementStatusLabels,
                                    ).map(([value, label]) => (
                                      <SelectItem key={value} value={value}>
                                        {label[english ? "en" : "zh"]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))
                        ) : (
                          <EmptyState
                            title={
                              english
                                ? "No custom engagements yet"
                                : "当前还没有定制合作项目"
                            }
                            description={
                              english
                                ? "Create the first implementation or maintenance record above."
                                : "先在上方创建第一条实施或维护记录。"
                            }
                          />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>
                      {english
                        ? "Beneficiary payout profiles"
                        : "受益方结算资料"}
                    </CardTitle>
                    <CardDescription>
                      {english
                        ? "Beneficiary payout details for review. Not connected to a payout rail."
                        : "受益方结算资料，供复核。不接打款通道。"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {english
                        ? `Manual settlement registry management is ${canManageManualSettlement ? "enabled" : "read-only"} for the current role. Payout profile writes remain capability-gated.`
                        : `当前角色的手工结算资料管理为${canManageManualSettlement ? "可操作" : "只读"}；结算资料写入继续受能力边界控制。`}
                    </div>
                    <div className="grid gap-4 xl:grid-cols-[1.1fr_1.4fr]">
                      <div className="theme-surface-panel rounded-2xl px-4 py-4">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {english ? "Create payout profile" : "新增结算资料"}
                        </p>
                        <div className="mt-3 space-y-3">
                          <Select
                            value={payoutProfileDraft.beneficiaryType}
                            onValueChange={(value) =>
                              setPayoutProfileDraft((current) => ({
                                ...current,
                                beneficiaryType:
                                  value as PayoutProfileBeneficiaryType,
                                beneficiaryId: "",
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="WORKER_PUBLISHER">
                                {
                                  revenueBeneficiaryLabels.WORKER_PUBLISHER[
                                    english ? "en" : "zh"
                                  ]
                                }
                              </SelectItem>
                              <SelectItem value="SALES_REFERRAL">
                                {
                                  revenueBeneficiaryLabels.SALES_REFERRAL[
                                    english ? "en" : "zh"
                                  ]
                                }
                              </SelectItem>
                              <SelectItem value="CUSTOM_SERVICES">
                                {
                                  revenueBeneficiaryLabels.CUSTOM_SERVICES[
                                    english ? "en" : "zh"
                                  ]
                                }
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={payoutProfileDraft.beneficiaryId}
                            onValueChange={(value) =>
                              setPayoutProfileDraft((current) => ({
                                ...current,
                                beneficiaryId: value,
                                displayName:
                                  current.displayName.trim().length > 0
                                    ? current.displayName
                                    : (payoutProfileOptions.find(
                                        (option) => option.id === value,
                                      )?.label ?? current.displayName),
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  english ? "Select beneficiary" : "选择受益方"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {payoutProfileOptions.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={payoutProfileDraft.displayName}
                            onChange={(event) =>
                              setPayoutProfileDraft((current) => ({
                                ...current,
                                displayName: event.target.value,
                              }))
                            }
                            placeholder={english ? "Display name" : "显示名称"}
                          />
                          <Input
                            value={payoutProfileDraft.legalName}
                            onChange={(event) =>
                              setPayoutProfileDraft((current) => ({
                                ...current,
                                legalName: event.target.value,
                              }))
                            }
                            placeholder={
                              english ? "Legal name" : "法定主体名称"
                            }
                          />
                          <Input
                            value={payoutProfileDraft.contact}
                            onChange={(event) =>
                              setPayoutProfileDraft((current) => ({
                                ...current,
                                contact: event.target.value,
                              }))
                            }
                            placeholder={english ? "Contact" : "联系方式"}
                          />
                          <Input
                            value={payoutProfileDraft.payoutMethodLabel}
                            onChange={(event) =>
                              setPayoutProfileDraft((current) => ({
                                ...current,
                                payoutMethodLabel: event.target.value,
                              }))
                            }
                            placeholder={
                              english ? "Payout method label" : "结算方式说明"
                            }
                          />
                          <Input
                            value={payoutProfileDraft.payoutDetailsReference}
                            onChange={(event) =>
                              setPayoutProfileDraft((current) => ({
                                ...current,
                                payoutDetailsReference: event.target.value,
                              }))
                            }
                            placeholder={
                              english
                                ? "Payout details reference"
                                : "结算资料引用 / 备注"
                            }
                          />
                          <div className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] px-3 py-3">
                            <div>
                              <p className="text-sm font-medium text-[color:var(--foreground)]">
                                {english ? "Invoice required" : "需要发票"}
                              </p>
                              <p className="text-xs text-[color:var(--muted-foreground)]">
                                {english
                                  ? "Track invoice expectation only. No invoice/tax engine is added here."
                                  : "这里只记录是否需要发票，不会新增发票 / 税务引擎。"}
                              </p>
                            </div>
                            <Switch
                              checked={payoutProfileDraft.invoiceRequired}
                              onCheckedChange={(checked) =>
                                setPayoutProfileDraft((current) => ({
                                  ...current,
                                  invoiceRequired: checked,
                                }))
                              }
                            />
                          </div>
                          <Input
                            value={payoutProfileDraft.notes}
                            onChange={(event) =>
                              setPayoutProfileDraft((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                            placeholder={english ? "Notes" : "备注"}
                          />
                          <Button
                            onClick={createBeneficiaryPayoutProfile}
                            disabled={
                              pending ||
                              !canManageManualSettlement ||
                              payoutProfileDraft.beneficiaryId.trim().length ===
                                0 ||
                              payoutProfileDraft.displayName.trim().length <
                                2 ||
                              payoutProfileDraft.payoutMethodLabel.trim()
                                .length < 2
                            }
                          >
                            {english ? "Create payout profile" : "创建结算资料"}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {data.beneficiaryPayoutProfiles.length ? (
                          data.beneficiaryPayoutProfiles.map((profile) => (
                            <div
                              key={profile.id}
                              className="theme-surface-panel rounded-2xl px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                                  {formatSettingsCommercialText(
                                    profile.displayName,
                                    english,
                                  )}
                                </p>
                                <Badge variant="approval">
                                  {
                                    revenueBeneficiaryLabels[
                                      profile.beneficiaryType
                                    ][english ? "en" : "zh"]
                                  }
                                </Badge>
                                <Badge
                                  variant={
                                    profile.status === "ACTIVE"
                                      ? "success"
                                      : "neutral"
                                  }
                                >
                                  {
                                    payoutProfileStatusLabels[profile.status][
                                      english ? "en" : "zh"
                                    ]
                                  }
                                </Badge>
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <Info
                                  label={
                                    english ? "Beneficiary registry" : "受益方登记"
                                  }
                                  value={english ? "Registered" : "已登记"}
                                />
                                <Info
                                  label={english ? "Legal name" : "法定名称"}
                                  value={
                                    profile.legalName
                                      ? formatSettingsCommercialText(
                                          profile.legalName,
                                          english,
                                        )
                                      : english
                                        ? "Not set"
                                        : "未设置"
                                  }
                                />
                                <Info
                                  label={english ? "Contact" : "联系方式"}
                                  value={
                                    profile.contact
                                      ? english
                                        ? profile.contact
                                        : "已登记联系方式"
                                      : english
                                        ? "Not set"
                                        : "未设置"
                                  }
                                />
                                <Info
                                  label={english ? "Payout method" : "结算方式"}
                                  value={formatSettingsCommercialText(
                                    profile.payoutMethodLabel,
                                    english,
                                  )}
                                />
                                <Info
                                  label={
                                    english
                                      ? "Payout reference"
                                      : "结算资料引用"
                                  }
                                  value={
                                    profile.payoutDetailsReference
                                      ? english
                                        ? profile.payoutDetailsReference
                                        : "已登记资料"
                                      : english
                                        ? "Not set"
                                        : "未设置"
                                  }
                                />
                                <Info
                                  label={english ? "Invoice" : "发票要求"}
                                  value={
                                    profile.invoiceRequired
                                      ? english
                                        ? "Required"
                                        : "需要"
                                      : english
                                        ? "Not required"
                                        : "不需要"
                                  }
                                />
                              </div>
                              {profile.notes ? (
                                <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                                  {formatSettingsCommercialText(
                                    profile.notes,
                                    english,
                                  )}
                                </p>
                              ) : null}
                              <div className="mt-3">
                                <Select
                                  value={profile.status}
                                  disabled={
                                    !canManageManualSettlement || pending
                                  }
                                  onValueChange={(value) =>
                                    updateBeneficiaryPayoutProfileStatus(
                                      profile.id,
                                      value as PayoutProfileStatus,
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(
                                      payoutProfileStatusLabels,
                                    ).map(([value, label]) => (
                                      <SelectItem key={value} value={value}>
                                        {label[english ? "en" : "zh"]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))
                        ) : (
                          <EmptyState
                            title={
                              english
                                ? "No payout profiles yet"
                                : "当前还没有结算资料"
                            }
                            description={
                              english
                                ? "Add beneficiary payout details above before manual settlement reaches export posture."
                                : "先在上方补齐受益方结算资料，再进入手工结算导出姿态。"
                            }
                          />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <BillingParticipantPortalPanels
                  canManageParticipantPortal={canManageParticipantPortal}
                  data={data}
                  english={english}
                  formatDateLabel={formatSettingsDate}
                  issueParticipantPortalAccess={issueParticipantPortalAccess}
                  latestParticipantPortalInviteUrl={
                    latestParticipantPortalInviteUrl
                  }
                  participantPortalDraft={participantPortalDraft}
                  participantPortalOptions={participantPortalOptions}
                  pending={pending}
                  setParticipantPortalDraft={setParticipantPortalDraft}
                  updateParticipantPortalAccessStatus={
                    updateParticipantPortalAccessStatus
                  }
                />

                <BillingProgramCatalogPanels
                  canManageManualSettlement={canManageManualSettlement}
                  data={data}
                  english={english}
                  formatDateLabel={formatSettingsDate}
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {english
                            ? "Application review queue"
                            : "申请审核队列"}
                        </p>
                        <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                          {english
                            ? `${data.programApplicationSummary.readyForInviteCount} accepted applications are ready for manual invite issuance.`
                            : `当前有 ${data.programApplicationSummary.readyForInviteCount} 条已接受申请已经进入可手动发邀请的姿态。`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Select
                          value={programApplicationProgramFilter}
                          onValueChange={setProgramApplicationProgramFilter}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">
                              {english ? "All programs" : "全部合作项目"}
                            </SelectItem>
                            {data.partnerPrograms.map((program) => (
                              <SelectItem key={program.id} value={program.id}>
                                {program.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={programApplicationStatusFilter}
                          onValueChange={(value) =>
                            setProgramApplicationStatusFilter(
                              value as ProgramApplicationStatus | "ALL",
                            )
                          }
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">
                              {english ? "All statuses" : "全部状态"}
                            </SelectItem>
                            {Object.entries(programApplicationStatusLabels).map(
                              ([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label[english ? "en" : "zh"]}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {!canManageProgramApplications ? (
                      <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
                        {english
                          ? "Program review and invite issuance stay limited to owner, billing admin, and admin. This queue remains readable, but review writes are capability-gated."
                          : "合作项目审核与邀请发放仅开放给负责人、计费管理员和管理员。这个队列仍可读，但审核写操作会经过能力守卫。"}
                      </div>
                    ) : null}
                    {visibleProgramApplications.length ? (
                      visibleProgramApplications.map((application) => {
                        const reviewedStatus =
                          programApplicationStatuses[application.id] ??
                          application.status;
                        const recommendedBeneficiaryType =
                          programApplicationBeneficiaryTypes[application.id] ??
                          application.recommendedBeneficiaryType ??
                          "NONE";

                        return (
                          <div
                            key={application.id}
                            className="theme-surface-panel rounded-2xl px-4 py-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                                {application.applicantName}
                              </p>
                              <Badge variant="approval">
                                {
                                  programApplicationStatusLabels[
                                    application.status
                                  ][english ? "en" : "zh"]
                                }
                              </Badge>
                              <Badge variant="neutral">
                                {application.partnerProgram.title}
                              </Badge>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                              <Info
                                label={english ? "Email" : "邮箱"}
                                value={application.applicantEmail}
                              />
                              <Info
                                label={english ? "Organization" : "机构 / 公司"}
                                value={
                                  application.applicantOrganization ??
                                  (english ? "Not set" : "未填写")
                                }
                              />
                              <Info
                                label={english ? "Role" : "角色"}
                                value={
                                  application.roleTitle ??
                                  (english ? "Not set" : "未填写")
                                }
                              />
                              <Info
                                label={english ? "Region" : "区域"}
                                value={
                                  application.regionLabel ??
                                  (english ? "Not set" : "未填写")
                                }
                              />
                              <Info
                                label={english ? "Terms version" : "条款版本"}
                                value={
                                  application.programTermsVersion.versionKey
                                }
                              />
                              <Info
                                label={english ? "Submitted at" : "提交时间"}
                                value={formatSettingsDateLabel(application.createdAt, english)}
                              />
                            </div>
                            {application.background ? (
                              <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                                <span className="font-semibold text-[color:var(--foreground)]">
                                  {english ? "Background: " : "背景： "}
                                </span>
                                {application.background}
                              </p>
                            ) : null}
                            {application.contributionPlan ? (
                              <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                                <span className="font-semibold text-[color:var(--foreground)]">
                                  {english
                                    ? "Contribution plan: "
                                    : "贡献计划： "}
                                </span>
                                {application.contributionPlan}
                              </p>
                            ) : null}
                            {application.reviewedByUser ? (
                              <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                                {english
                                  ? `Last reviewed by ${application.reviewedByUser.name} on ${formatSettingsDateLabel(application.reviewedAt, english)}`
                                  : `最近由 ${application.reviewedByUser.name} 于 ${formatSettingsDateLabel(application.reviewedAt, english)} 审核`}
                              </p>
                            ) : null}
                            {application.linkedBeneficiary ? (
                              <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                                {english
                                  ? `Linked beneficiary: ${application.linkedBeneficiary.label} · ${application.linkedBeneficiary.reference}`
                                  : `已关联收益对象：${formatSettingsCommercialText(application.linkedBeneficiary.label, english)} · ${formatSettingsCommercialText(application.linkedBeneficiary.reference, english)}`}
                              </p>
                            ) : null}
                            {application.participantPortalAccess ? (
                              <div className="mt-2 rounded-2xl border border-[color:var(--border)] px-3 py-3 text-xs leading-6 text-[color:var(--muted)]">
                                <p className="font-semibold text-[color:var(--foreground)]">
                                  {english
                                    ? "Invite already issued"
                                    : "邀请已发放"}
                                </p>
                                <p>
                                  {english
                                    ? `Portal access is ${participantPortalStatusLabels[application.participantPortalAccess.status][english ? "en" : "zh"]} for ${application.participantPortalAccess.inviteEmail}.`
                                    : `当前门户访问状态为 ${participantPortalStatusLabels[application.participantPortalAccess.status][english ? "en" : "zh"]}，邀请邮箱已登记。`}
                                </p>
                                <p>
                                  {english
                                    ? `Last invite issued on ${formatSettingsDateLabel(application.participantPortalAccess.lastInviteIssuedAt, english)}.`
                                    : `最近一次邀请发放时间：${formatSettingsDateLabel(application.participantPortalAccess.lastInviteIssuedAt, english)}。`}
                                </p>
                                <p>
                                  {getProgramApplicationInviteGuidance(
                                    application.participantPortalAccess.status,
                                    english,
                                  )}
                                </p>
                              </div>
                            ) : null}
                            <div className="mt-3 grid gap-3 md:grid-cols-[180px_220px_1fr_160px_180px]">
                              <Select
                                disabled={
                                  !canManageProgramApplications || pending
                                }
                                value={reviewedStatus}
                                onValueChange={(value) =>
                                  setProgramApplicationStatuses((current) => ({
                                    ...current,
                                    [application.id]:
                                      value as ProgramApplicationStatus,
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(
                                    programApplicationStatusLabels,
                                  )
                                    .filter(([value]) => value !== "INVITED")
                                    .map(([value, label]) => (
                                      <SelectItem key={value} value={value}>
                                        {label[english ? "en" : "zh"]}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <Select
                                disabled={
                                  !canManageProgramApplications || pending
                                }
                                value={recommendedBeneficiaryType}
                                onValueChange={(value) =>
                                  setProgramApplicationBeneficiaryTypes(
                                    (current) => ({
                                      ...current,
                                      [application.id]: value as
                                        | ProgramApplicationBeneficiaryType
                                        | "NONE",
                                    }),
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="NONE">
                                    {english
                                      ? "No recommendation"
                                      : "暂无推荐收益线"}
                                  </SelectItem>
                                  <SelectItem value="WORKER_PUBLISHER">
                                    {
                                      revenueBeneficiaryLabels.WORKER_PUBLISHER[
                                        english ? "en" : "zh"
                                      ]
                                    }
                                  </SelectItem>
                                  <SelectItem value="SALES_REFERRAL">
                                    {
                                      revenueBeneficiaryLabels.SALES_REFERRAL[
                                        english ? "en" : "zh"
                                      ]
                                    }
                                  </SelectItem>
                                  <SelectItem value="CUSTOM_SERVICES">
                                    {
                                      revenueBeneficiaryLabels.CUSTOM_SERVICES[
                                        english ? "en" : "zh"
                                      ]
                                    }
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                disabled={
                                  !canManageProgramApplications || pending
                                }
                                value={
                                  programApplicationNotes[application.id] ??
                                  application.internalNotes ??
                                  ""
                                }
                                onChange={(event) =>
                                  setProgramApplicationNotes((current) => ({
                                    ...current,
                                    [application.id]: event.target.value,
                                  }))
                                }
                                placeholder={
                                  english
                                    ? "Internal review note"
                                    : "内部审核备注"
                                }
                              />
                              <Button
                                variant="secondary"
                                onClick={() =>
                                  reviewProgramApplication(
                                    application.id,
                                    reviewedStatus,
                                  )
                                }
                                disabled={
                                  !canManageProgramApplications || pending
                                }
                              >
                                {english ? "Save review" : "保存审核"}
                              </Button>
                              <Button
                                onClick={() =>
                                  issueProgramApplicationInvite(application.id)
                                }
                                disabled={
                                  !canManageProgramApplications ||
                                  pending ||
                                  (reviewedStatus !== "ACCEPTED" &&
                                    reviewedStatus !== "INVITED") ||
                                  recommendedBeneficiaryType === "NONE" ||
                                  !canIssueProgramApplicationParticipantInvite(
                                    application.participantPortalAccess?.status,
                                  )
                                }
                              >
                                {getProgramApplicationInviteButtonLabel(
                                  application.participantPortalAccess?.status,
                                  english,
                                )}
                              </Button>
                            </div>
                            {latestProgramApplicationInvite?.applicationId ===
                            application.id ? (
                              <div className="mt-3 rounded-2xl border border-[color:var(--border)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
                                <p className="font-medium text-[color:var(--foreground)]">
                                  {english
                                    ? "Latest invite link"
                                    : "最近生成的邀请链接"}
                                </p>
                                <Link
                                  href={
                                    latestProgramApplicationInvite.inviteUrl
                                  }
                                  className="mt-2 block break-all text-[var(--accent)] hover:underline"
                                >
                                  {latestProgramApplicationInvite.inviteUrl}
                                </Link>
                                <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                                  {english
                                    ? "This invite is still narrow, manual, and self-only. It does not create public discovery, marketplace behavior, or payout execution."
                                    : "这个邀请仍然是窄的、手工的、仅本人可见的，不会产生公开发现、市场行为或支付执行。"}
                                </p>
                              </div>
                            ) : (
                              <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                                {english
                                  ? "Accepted applications can issue a real participant portal invite from this queue. `Invited` now means the invite was actually issued."
                                  : "已接受的申请可以直接在这条队列里发出真实的贡献方门户邀请。现在的“已邀请”表示邀请已经实际发出。"}
                              </p>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <EmptyState
                        title={
                          english ? "No applications yet" : "当前还没有申请"
                        }
                        description={
                          english
                            ? "Public applications will appear here after someone submits a program application."
                            : "外部申请提交后，会在这里进入内部审核列表。"
                        }
                      />
                    )}
                  </div>
                </BillingProgramCatalogPanels>

                <BillingAttributionOverviewPanels
                  attributionSourceBreakdown={attributionSourceBreakdown}
                  beneficiaryViews={beneficiaryViews}
                  english={english}
                  formatMoneyAmount={formatMoneyAmount}
                />

                <BillingAttributionDetailPanels
                  data={data}
                  english={english}
                  formatDateLabel={formatSettingsDate}
                  formatMoneyAmount={formatMoneyAmount}
                  revenueAttributionNarrative={revenueAttributionNarrative}
                  revenueRuleNarrative={revenueRuleNarrative}
                />

                <BillingManualSettlementWorkflow
                  approveCurrentSettlementBatch={approveCurrentSettlementBatch}
                  canManageManualSettlement={canManageManualSettlement}
                  closeCurrentSettlementBatch={closeCurrentSettlementBatch}
                  createSettlementBatch={createSettlementBatch}
                  data={data}
                  english={english}
                  exportCurrentSettlementBatch={exportCurrentSettlementBatch}
                  formatDateLabel={formatSettingsDate}
                  formatMoneyAmount={formatMoneyAmount}
                  markSettlementLinePaid={markSettlementLinePaid}
                  pending={pending}
                  reverseSettlementLine={reverseSettlementLine}
                  setSettlementBatchDraft={setSettlementBatchDraft}
                  setSettlementLineNotes={setSettlementLineNotes}
                  setSettlementLineReverseReasons={
                    setSettlementLineReverseReasons
                  }
                  settlementBatchDraft={settlementBatchDraft}
                  settlementBeneficiaryTotals={settlementBeneficiaryTotals}
                  settlementLineNotes={settlementLineNotes}
                  settlementLineReverseReasons={settlementLineReverseReasons}
                  settlementProfileWarnings={settlementProfileWarnings}
                  settlementSourceTotals={settlementSourceTotals}
                />

                <BillingSettlementExceptionPanels
                  data={data}
                  english={english}
                  settlementExceptionNarrative={settlementExceptionNarrative}
                />

                <BillingPayoutReadinessPanels
                  data={data}
                  english={english}
                  payoutRailPilotCohortNarrative={
                    payoutRailPilotCohortNarrative
                  }
                  payoutRailPilotCohortVariant={payoutRailPilotCohortVariant}
                  payoutRailReadinessNarrative={payoutRailReadinessNarrative}
                  payoutRailReadinessVariant={payoutRailReadinessVariant}
                  settlementOpsProofNarrative={settlementOpsProofNarrative}
                />
              </>
            ) : reservedWorkspace ? (
              <Card className="workspace-panel-muted">
                <CardHeader>
                  <CardTitle>
                    {english
                      ? "Contributor / partner registry"
                      : "贡献方 / 伙伴登记册"}
                  </CardTitle>
                  <CardDescription>
                    {english
                      ? "Owner, billing admin, admin only."
                      : "仅负责人、计费管理员、管理员可见。"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-[color:var(--muted)]">
                  {english
                    ? "Internal review of attribution and settlement — not a payout rail or marketplace."
                    : "用于内部复核归因和结算——不是打款通道，也不是市场。"}
                </CardContent>
              </Card>
            ) : null}

            <BillingMetricsPanels
              data={data}
              english={english}
              seatSummaryNarrative={seatSummaryNarrative}
              usageSummaryNarrative={usageSummaryNarrative}
            />
          </div>
        </TabsContent>

        <TabsContent value="connectors">
          <div className="space-y-6">
            <Card className="workspace-panel-muted" data-testid="resource-access-catalog">
              <CardHeader>
                <CardTitle>
                  {english ? "Source intake before connectors" : "先做数据来源诊断，再接连接器"}
                </CardTitle>
                <CardDescription>
                  {english
                    ? "Use L0 diagnostic material and L1 fixtures before any L2 read-only connector. This is a proof path, not writeback or deployment authorization."
                    : "先用 L0 诊断材料和 L1 fixture 证明信号链，再进入 L2 只读接入。这是证据路径，不是写回或部署授权。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  {dataIntakeLevels.map((level) => (
                    <div
                      key={level.key}
                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3"
                    >
                      <p className="text-xs font-semibold text-[var(--accent)]">
                        {level.key}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
                        {level.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                        {level.summary}
                      </p>
                      <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                        {english ? "Evidence" : "证据"} · {level.output}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {resourceAccessCatalog.map((resource) => (
                    <div
                      key={resource.key}
                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {resource.title}
                        </p>
                        <span className="rounded-full bg-[color:var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[color:var(--foreground)] ring-1 ring-[color:var(--border)]">
                          {resource.level}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Info
                          label={english ? "Minimum permission" : "最小权限"}
                          value={resource.permissionSummary}
                        />
                        <Info
                          label={english ? "Dry-run evidence" : "预演证据"}
                          value={resource.dryRunEvidence}
                        />
                        <Info
                          label={english ? "Read-only status" : "只读状态"}
                          value={resource.readOnlyStatus}
                        />
                        <Info
                          label={english ? "Failure posture" : "失败姿态"}
                          value={resource.failurePosture}
                        />
                      </div>
                      <p className="mt-3 rounded-2xl bg-[color:var(--surface-subtle)] px-3 py-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                        {resource.forbiddenAction}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="workspace-panel-muted" data-testid="signal-first-mile-proof-viewer">
              <CardHeader>
                <CardTitle>
                  {english ? "Signal First Mile proof package" : "经营信号首公里 proof package"}
                </CardTitle>
                <CardDescription>
                  {english
                    ? "First version is read-only: inspect generated files and run the recorded eval command. It does not upload materials, open a hosted endpoint, or call a connector."
                    : "第一版保持只读：查看生成文件并运行记录的 eval 命令。它不上传材料、不开放托管端点、不调用连接器。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 font-mono text-xs leading-6 text-[color:var(--muted)]">
                  node templates/signal-first-mile/run-first-change-proof.js{" \\"}
                  <br />
                  &nbsp;&nbsp;templates/signal-first-mile/selector-input.sample.json{" \\"}
                  <br />
                  &nbsp;&nbsp;/tmp/helm-sfm-first-change-proof
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {proofPackageFiles.map((file) => (
                    <div
                      key={file.file}
                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">
                        {file.file}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                        {file.purpose}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Missing files mean the proof package has not been generated yet; that is a setup state, not a connector failure or deployment blocker."
                    : "文件缺失只说明 proof package 尚未生成；这是初始化状态，不是连接器失败或部署阻塞。"}
                </p>
              </CardContent>
            </Card>

            <Card className="workspace-panel-muted">
              <CardHeader>
                <CardTitle>
                  {english
                    ? "Enterprise integration readiness"
                    : "企业接入准备度"}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Info
                  label={english ? "Connected connectors" : "已连接连接器"}
                  value={
                    english
                      ? `${data.integrationSummary.connectedConnectorCount}`
                      : `${data.integrationSummary.connectedConnectorCount} 个`
                  }
                />
                <Info
                  label={english ? "Connector errors" : "同步异常连接器"}
                  value={
                    english
                      ? `${data.integrationSummary.connectorErrorCount}`
                      : `${data.integrationSummary.connectorErrorCount} 个`
                  }
                />
                <Info
                  label={
                    english ? "Real / imported threads" : "真实 / 导入线程"
                  }
                  value={
                    english
                      ? `${data.integrationSummary.externalThreadCount}`
                      : `${data.integrationSummary.externalThreadCount} 条`
                  }
                />
                <Info
                  label={english ? "Unbound threads" : "待绑定线程"}
                  value={
                    english
                      ? `${data.integrationSummary.unboundThreadCount}`
                      : `${data.integrationSummary.unboundThreadCount} 条`
                  }
                />
                <Info
                  label={english ? "Imported signals" : "导入工作信号"}
                  value={
                    english
                      ? `${data.integrationSummary.importedSignalCount}`
                      : `${data.integrationSummary.importedSignalCount} 条`
                  }
                />
                <Info
                  label={english ? "Duplicate email groups" : "重复邮箱线索"}
                  value={
                    english
                      ? `${data.integrationSummary.duplicateEmailCount}`
                      : `${data.integrationSummary.duplicateEmailCount} 组`
                  }
                />
                <Info
                  label={english ? "Import failures (7d)" : "近 7 天导入失败行"}
                  value={
                    english
                      ? `${data.integrationSummary.recentImportFailures}`
                      : `${data.integrationSummary.recentImportFailures} 行`
                  }
                />
              </CardContent>
            </Card>

            <TenantResourceReadinessPanel
              canManageProof={data.organizationSummary.canManageGovernedActions}
              canManageResources={canManageConnectors || canManageImports}
              canReviewProof={data.organizationSummary.canReviewGovernedActions}
              capabilityReadouts={data.tenantResourceCapabilityReadouts}
              english={english}
              evidenceDetails={data.tenantResourceEvidenceDetails}
              guardedWriteEvaluation={data.tenantResourceGuardedWriteEvaluation}
              guardedWritePilotReadouts={data.tenantResourceGuardedWritePilotReadouts}
              policyReadout={data.tenantResourcePolicyReadout}
              summary={data.tenantResourceReadiness}
            />

            <ConnectorPermissionSummaryPanel
              english={english}
              summaries={CONNECTOR_PERMISSION_SUMMARIES}
            />

            <Card>
              <CardHeader>
                <CardTitle>
                  {english ? "Read-only connectors" : "只读连接器"}
                </CardTitle>
                <CardDescription>
                  {english
                    ? "Connector actions below keep the current read-only / review-first boundary. Connecting or syncing does not authorize writeback, external send, approval execution, or customer deployment."
                    : "下方连接器操作继续保持只读 / 先复核边界。连接或同步不授权写回、外发、审批执行或客户部署。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {english ? "Aliyun Mail connector" : "阿里邮箱连接器"}
                    </p>
                    <div
                      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${gmailConnector?.status === "CONNECTED" ? "bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)] ring-[color:var(--status-success-border)]" : gmailConnector?.status === "ERROR" ? "bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)] ring-[color:var(--status-danger-border)]" : "theme-surface-chip text-[color:var(--foreground)] ring-[color:var(--border)]"}`}
                    >
                      {gmailConnector?.status === "CONNECTED"
                        ? english
                          ? "Connected"
                          : "已连接"
                        : gmailConnector?.status === "ERROR"
                          ? english
                            ? "Sync error"
                            : "同步异常"
                          : english
                            ? "Not connected"
                            : "未连接"}
                    </div>
                    {connectorConfig.gmailOauthReady ? (
                      <div className="rounded-full bg-[color:var(--status-info-bg)] px-3 py-1 text-xs font-medium text-[color:var(--status-info-text)] ring-1 ring-[color:var(--status-info-border)]">
                        {english
                          ? "IMAP/SMTP defaults ready"
                          : "IMAP/SMTP 默认参数已就绪"}
                      </div>
                    ) : (
                      <div className="rounded-full bg-[color:var(--status-warning-bg)] px-3 py-1 text-xs font-medium text-[color:var(--status-warning-text)] ring-1 ring-[color:var(--status-warning-border)]">
                        {english ? "Config missing" : "连接参数缺失"}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Info
                      label={english ? "Connected account" : "连接账号"}
                      value={
                        gmailConnector?.externalAccountEmail ??
                        (english ? "Not connected yet" : "尚未连接")
                      }
                    />
                    <Info
                      label={english ? "Last sync" : "最近同步"}
                      value={formatSettingsDateLabel(gmailConnector?.lastSyncedAt, english)}
                    />
                    <Info
                      label={english ? "Sync status" : "同步状态"}
                      value={
                        gmailConnector?.lastSyncStatus ??
                        (english ? "Waiting to connect" : "等待连接")
                      }
                    />
                    <Info
                      label={english ? "Token storage" : "令牌存储"}
                      value={
                        connectorConfig.secureTokenStorage
                          ? english
                            ? "Secure storage enabled"
                            : "已启用安全存储"
                          : english
                            ? "Local placeholder storage"
                            : "当前为本地占位存储"
                      }
                    />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[color:var(--muted-foreground)]">
                    {english
                      ? "Current scope uses Aliyun IMAP for read sync and supports explicit manual SMTP send only. No automatic external send is allowed."
                      : "当前使用阿里 IMAP 做读取同步，并支持手动显式 SMTP 发送；默认不允许自动对外发送。"}
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Input
                      placeholder={
                        english ? "Aliyun mail account" : "阿里邮箱账号"
                      }
                      value={aliyunCredentialDraft.email}
                      onChange={(event) =>
                        setAliyunCredentialDraft((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                    <Input
                      type="password"
                      placeholder={
                        english
                          ? "Aliyun client password"
                          : "阿里邮箱客户端专用密码"
                      }
                      value={aliyunCredentialDraft.password}
                      onChange={(event) =>
                        setAliyunCredentialDraft((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-[color:var(--muted)]">
                    <Switch
                      checked={aliyunCredentialDraft.manualSendEnabled}
                      onCheckedChange={(checked) =>
                        setAliyunCredentialDraft((current) => ({
                          ...current,
                          manualSendEnabled: checked,
                        }))
                      }
                    />
                    <span>
                      {english
                        ? "Allow explicit manual SMTP send"
                        : "允许手动显式 SMTP 发送"}
                    </span>
                  </div>
                  {gmailConnector?.lastSyncMessage ? (
                    <div className="workspace-panel-muted mt-4 rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                      {gmailConnector.lastSyncMessage}
                    </div>
                  ) : null}
                  {!canManageConnectors ? (
                    <div className="workspace-panel-muted mt-4 rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                      {english
                        ? "Connector writes are narrowed to owner, admin, or operator. This surface stays readable, but connect, sync, and disconnect remain blocked for the current role."
                        : "连接器写动作仅开放给负责人、管理员或运营。当前页面保持可读，但连接、同步和断开动作对当前角色保持拦截。"}
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      data-testid="gmail-connector-primary-action"
                      disabled={pending || !canManageConnectors}
                      onClick={() =>
                        runConnectorAction(
                          () =>
                            connectAliyunMailConnectorAction(
                              aliyunCredentialDraft,
                            ),
                          english ? "Aliyun Mail connected" : "阿里邮箱已连接",
                        )
                      }
                    >
                      {english ? "Save account credentials" : "保存账号凭据"}
                    </Button>
                    <Button
                      disabled={pending || !canManageConnectors}
                      variant="secondary"
                      onClick={() =>
                        runConnectorAction(
                          () => connectAliyunFounderDefaultAction({ locale }),
                          english
                            ? "Founder default account applied"
                            : "已应用创始人默认账号",
                        )
                      }
                    >
                      {english ? "Use founder default" : "使用创始人默认账号"}
                    </Button>
                    <Button
                      disabled={pending || !canManageConnectors}
                      variant="secondary"
                      onClick={() =>
                        runConnectorAction(
                          () => syncGmailConnectorAction(),
                          english
                            ? "Aliyun Mail sync completed"
                            : "阿里邮箱已完成同步",
                        )
                      }
                    >
                      {english ? "Sync now" : "立即同步"}
                    </Button>
                    <Button
                      disabled={pending || !canManageConnectors}
                      variant="secondary"
                      onClick={() =>
                        runConnectorAction(
                          () => connectMockGmailAction(),
                          english
                            ? "Local mock Aliyun data connected"
                            : "已接入本地模拟阿里邮箱数据",
                        )
                      }
                    >
                      {english ? "Load local demo data" : "载入本地示例数据"}
                    </Button>
                    <Button
                      disabled={pending || !canManageConnectors}
                      variant="secondary"
                      onClick={() =>
                        runConnectorAction(
                          () => disconnectConnectorAction("GMAIL"),
                          english
                            ? "Aliyun Mail disconnected"
                            : "阿里邮箱已断开连接",
                        )
                      }
                    >
                      {english ? "Disconnect" : "断开连接"}
                    </Button>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <Input
                      placeholder={
                        english ? "Manual send to" : "手动发送收件人"
                      }
                      value={aliyunManualSendDraft.to}
                      onChange={(event) =>
                        setAliyunManualSendDraft((current) => ({
                          ...current,
                          to: event.target.value,
                        }))
                      }
                    />
                    <Input
                      placeholder={english ? "Subject" : "主题"}
                      value={aliyunManualSendDraft.subject}
                      onChange={(event) =>
                        setAliyunManualSendDraft((current) => ({
                          ...current,
                          subject: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <Textarea
                    className="mt-3"
                    rows={4}
                    placeholder={english ? "Manual send body" : "手动发送正文"}
                    value={aliyunManualSendDraft.body}
                    onChange={(event) =>
                      setAliyunManualSendDraft((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                  />
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button
                      disabled={pending || !canManageConnectors}
                      onClick={() =>
                        runConnectorAction(
                          () =>
                            sendAliyunMailManualAction({
                              to: aliyunManualSendDraft.to,
                              subject: aliyunManualSendDraft.subject,
                              text: aliyunManualSendDraft.body,
                            }),
                          english ? "Manual send completed" : "手动发送完成",
                        )
                      }
                    >
                      {english ? "Send manual email" : "手动发送邮件"}
                    </Button>
                    <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {english
                        ? "Boundary: this action sends only after explicit user click. No automatic send path is enabled."
                        : "边界说明：此动作仅在用户显式点击后发送，不启用无人确认的发送路径。"}
                    </p>
                  </div>
                </div>

                <div className="workspace-panel-muted space-y-3 rounded-2xl px-4 py-4">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {english ? "China ecosystem connectors" : "中国生态连接器"}
                  </p>
                  <div className="workspace-panel rounded-2xl px-4 py-3">
                    <div className="space-y-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-[color:var(--foreground)]">
                            {english
                              ? "DingTalk OAuth callback foundation"
                              : "钉钉授权回调基础链路"}
                          </p>
                          {connectorConfig.dingtalkOauthReady ? (
                            <div className="rounded-full bg-[color:var(--status-info-bg)] px-3 py-1 text-xs font-medium text-[color:var(--status-info-text)] ring-1 ring-[color:var(--status-info-border)]">
                              {english ? "OAuth ready" : "授权已就绪"}
                            </div>
                          ) : (
                            <div className="rounded-full bg-[color:var(--status-warning-bg)] px-3 py-1 text-xs font-medium text-[color:var(--status-warning-text)] ring-1 ring-[color:var(--status-warning-border)]">
                              {english ? "OAuth pending" : "授权待配置"}
                            </div>
                          )}
                          {connectorConfig.dingtalkDirectorySyncReady ? (
                            <div className="rounded-full bg-[color:var(--status-success-bg)] px-3 py-1 text-xs font-medium text-[color:var(--status-success-text)] ring-1 ring-[color:var(--status-success-border)]">
                              {english
                                ? "Directory-sync seam ready"
                                : "目录同步接缝已就绪"}
                            </div>
                          ) : (
                            <div className="rounded-full bg-[color:var(--surface-subtle)] px-3 py-1 text-xs font-medium text-[color:var(--foreground)] ring-1 ring-[color:var(--border)]">
                              {english
                                ? "Directory-sync seam pending"
                                : "目录同步接缝待配置"}
                            </div>
                          )}
                          {connectorConfig.dingtalkMcpReady ? (
                            <div className="rounded-full bg-[color:var(--status-success-bg)] px-3 py-1 text-xs font-medium text-[color:var(--status-success-text)] ring-1 ring-[color:var(--status-success-border)]">
                              {english ? "MCP gateway ready" : "MCP 网关已就绪"}
                            </div>
                          ) : (
                            <div className="rounded-full bg-[color:var(--status-warning-bg)] px-3 py-1 text-xs font-medium text-[color:var(--status-warning-text)] ring-1 ring-[color:var(--status-warning-border)]">
                              {english
                                ? "MCP gateway pending env config"
                                : "MCP 网关待环境变量配置"}
                            </div>
                          )}
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <Info
                            label={
                              english
                                ? "Current connector state"
                                : "当前连接状态"
                            }
                            value={
                              dingtalkConnector?.status === "CONNECTED"
                                ? english
                                  ? "Callback connected"
                                  : "回调已连接"
                                : dingtalkConnector?.status === "ERROR"
                                  ? english
                                    ? "Callback failure"
                                    : "回调异常"
                                  : connectorConfig.dingtalkOauthReady
                                    ? english
                                      ? "Callback ready / waiting to connect"
                                      : "回调已就绪 / 等待连接"
                                    : english
                                      ? "Callback config pending"
                                      : "回调配置待完成"
                            }
                          />
                          <Info
                            label={
                              english ? "Last callback status" : "最近回调状态"
                            }
                            value={formatDingTalkCallbackStatus(
                              dingtalkConnector?.lastCallbackResult?.status,
                              english,
                            )}
                          />
                          <Info
                            label={english ? "Failure posture" : "失败姿态"}
                            value={formatDingTalkFailurePosture(
                              dingtalkConnector?.lastCallbackResult
                                ?.failurePosture,
                              english,
                            )}
                          />
                          <Info
                            label={
                              english ? "Last callback at" : "最近回调时间"
                            }
                            value={formatSettingsDateLabel(
                              dingtalkConnector?.lastCallbackResult?.recordedAt
                                ? new Date(
                                    dingtalkConnector.lastCallbackResult
                                      .recordedAt,
                                  )
                                : null,
                              english,
                            )}
                          />
                          <Info
                            label={
                              english
                                ? "Resolved provider email"
                                : "解析到的服务商邮箱"
                            }
                            value={
                              dingtalkConnector?.lastCallbackResult
                                ?.providerEmail ??
                              (english ? "Not recorded" : "未记录")
                            }
                          />
                          <Info
                            label={
                              english
                                ? "Matched workspace user"
                                : "绑定的工作区用户"
                            }
                            value={
                              dingtalkConnector?.lastCallbackResult
                                ?.matchedWorkspaceUserEmail ??
                              (english ? "Not resolved" : "未解析")
                            }
                          />
                          <Info
                            label={english ? "Coverage target" : "目标覆盖"}
                            value={
                              english
                                ? "Meetings, calendar, message notifications"
                                : "会议、日程、消息通知"
                            }
                          />
                          <Info
                            label={
                              english ? "Provisioning path" : "目录同步路径"
                            }
                            value={
                              english
                                ? "Helm directory-sync adapter seam"
                                : "Helm 内部目录同步适配接缝"
                            }
                          />
                          <Info
                            label={
                              english ? "Last ingest status" : "最近采集状态"
                            }
                            value={formatDingTalkIngestStatus(
                              dingtalkConnector?.lastIngestResult?.status,
                              english,
                            )}
                          />
                          <Info
                            label={
                              english
                                ? "Ingest failure posture"
                                : "采集失败姿态"
                            }
                            value={formatDingTalkFailurePosture(
                              dingtalkConnector?.lastIngestResult
                                ?.failurePosture,
                              english,
                            )}
                          />
                          <Info
                            label={english ? "Last ingest at" : "最近采集时间"}
                            value={formatSettingsDateLabel(
                              dingtalkConnector?.lastIngestResult?.recordedAt
                                ? new Date(
                                    dingtalkConnector.lastIngestResult
                                      .recordedAt,
                                  )
                                : null,
                              english,
                            )}
                          />
                          <Info
                            label={
                              english ? "Persisted payloads" : "已保存采集资料"
                            }
                            value={String(
                              dingtalkConnector?.lastIngestResult
                                ?.persistedPayloadCount ?? 0,
                            )}
                          />
                          <Info
                            label={
                              english
                                ? "Runtime-established scope"
                                : "已成立的运行范围"
                            }
                            value={
                              dingtalkConnector?.lastIngestResult?.scopeResults
                                ?.filter((scope) => scope.status === "INGESTED")
                                .map((scope) =>
                                  formatDingTalkReadOnlyScope(
                                    scope.scope,
                                    english,
                                  ),
                                )
                                .join(" · ") ||
                              (english ? "Not recorded" : "未记录")
                            }
                          />
                          <Info
                            label={
                              english
                                ? "Pending runtime scope"
                                : "待补的运行范围"
                            }
                            value={
                              dingtalkConnector?.lastIngestResult?.scopeResults
                                ?.filter((scope) => scope.status !== "INGESTED")
                                .map((scope) =>
                                  formatDingTalkReadOnlyScope(
                                    scope.scope,
                                    english,
                                  ),
                                )
                                .join(" · ") ||
                              (english ? "Not recorded" : "未记录")
                            }
                          />
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {english
                            ? "This slice establishes a runnable DingTalk OAuth callback foundation: code -> token exchange, provider profile fetch, workspace-scoped identity binding, providerType session write, and tenant-scoped callback audit truth."
                            : "这一层把钉钉推进到真实可运行的授权回调基础链路：完成授权码到令牌兑换、来源资料拉取、工作区范围身份绑定、来源类型会话写入和租户范围回调审计真值。"}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {english
                            ? "Current repo truth now establishes verified read-only runtime for both meetings and calendar. Message notifications still remain unresolved because a read-side provider contract is not verified."
                            : "当前仓库真实状态已经把会议和日程两条只读运行链路都落成到经验证范围；消息通知仍因读取侧来源契约未证实而保持未决。"}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {english
                            ? "MCP credentials are currently read from system env variables (DINGTALK_*). There is no per-workspace MCP form yet, so new organizations reuse the same configured gateway by default."
                            : "当前 MCP 凭据默认读取系统环境变量（DINGTALK_*）。页面暂未开放按组织单独填写 MCP 参数，所以新组织会默认复用同一套已配置网关。"}
                        </p>
                        {dingtalkConnector?.lastIngestResult?.scopeResults
                          ?.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {dingtalkConnector.lastIngestResult.scopeResults.map(
                              (scope) => (
                                <div
                                  key={scope.scope}
                                  className="rounded-full bg-[color:var(--surface-subtle)] px-3 py-1 text-xs font-medium text-[color:var(--foreground)] ring-1 ring-[color:var(--border)]"
                                >
                                  {formatDingTalkReadOnlyScope(
                                    scope.scope,
                                    english,
                                  )}{" "}
                                  ·{" "}
                                  {formatDingTalkIngestScopeStatus(
                                    scope.status,
                                    english,
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        ) : null}
                        {dingtalkConnector?.lastIngestResult?.message ? (
                          <div className="workspace-panel-muted mt-4 rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                            {formatSettingsConnectorRuntimeText(
                              dingtalkConnector.lastIngestResult.message,
                              english,
                            )}
                          </div>
                        ) : null}
                        {dingtalkConnector?.lastSyncMessage ? (
                          <div className="workspace-panel-muted mt-4 rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                            {formatSettingsConnectorRuntimeText(
                              dingtalkConnector.lastSyncMessage,
                              english,
                            )}
                          </div>
                        ) : null}
                        {!canManageConnectors ? (
                          <div className="workspace-panel-muted mt-4 rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                            {english
                              ? "Connector writes remain narrowed to owner, admin, or operator. This surface stays readable, but connect and disconnect remain blocked for the current role."
                              : "连接器写动作仍只开放给负责人、管理员或运营。当前页面保持可读，但连接和断开动作对当前角色继续拦截。"}
                          </div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-3">
                          {connectorConfig.dingtalkOauthReady &&
                          canManageConnectors ? (
                            <Button
                              data-testid="dingtalk-connector-primary-action"
                              asChild
                            >
                              <a href="/api/auth/dingtalk/start">
                                {dingtalkConnector?.status === "CONNECTED"
                                  ? english
                                    ? "Reconnect DingTalk"
                                    : "重新连接钉钉"
                                  : dingtalkConnector?.status === "ERROR"
                                    ? english
                                      ? "Retry DingTalk callback"
                                      : "重试钉钉回调"
                                    : english
                                      ? "Connect DingTalk"
                                      : "连接钉钉"}
                              </a>
                            </Button>
                          ) : connectorConfig.dingtalkOauthReady ? (
                            <Button
                              data-testid="dingtalk-connector-primary-action"
                              disabled
                            >
                              {english
                                ? "Connector permission required"
                                : "需要连接器操作权限"}
                            </Button>
                          ) : (
                            <Button disabled variant="secondary">
                              {english
                                ? "DingTalk OAuth pending config"
                                : "钉钉授权待配置"}
                            </Button>
                          )}
                          {canManageConnectors &&
                          connectorConfig.dingtalkMcpReady ? (
                            <Button
                              data-testid="dingtalk-connector-sync-action"
                              disabled={pending}
                              variant="secondary"
                              onClick={() =>
                                runConnectorAction(
                                  () => syncDingTalkConnectorAction(),
                                  english
                                    ? "DingTalk MCP sync completed"
                                    : "钉钉 MCP 同步已完成",
                                )
                              }
                            >
                              {english
                                ? "Run MCP sync now"
                                : "立即执行 MCP 同步"}
                            </Button>
                          ) : canManageConnectors ? (
                            <Button
                              data-testid="dingtalk-connector-sync-action"
                              disabled
                              variant="secondary"
                            >
                              {english
                                ? "DingTalk MCP pending config"
                                : "钉钉 MCP 待配置"}
                            </Button>
                          ) : (
                            <Button
                              data-testid="dingtalk-connector-sync-action"
                              disabled
                              variant="secondary"
                            >
                              {english
                                ? "Connector permission required"
                                : "需要连接器操作权限"}
                            </Button>
                          )}
                          {canManageConnectors &&
                          connectorConfig.dingtalkMcpReady ? (
                            <>
                              <Button
                                data-testid="dingtalk-directory-invite-sync-dryrun-action"
                                disabled={pending}
                                variant="secondary"
                                onClick={() =>
                                  runDingTalkDirectoryInviteSync(true)
                                }
                              >
                                {english
                                  ? "Dry-run directory invite sync"
                                  : "目录邀请同步（Dry-run）"}
                              </Button>
                              <Button
                                data-testid="dingtalk-directory-invite-sync-review-action"
                                disabled
                                variant="secondary"
                              >
                                {english
                                  ? "Live invite sync requires review"
                                  : "正式同步邀请需要复核"}
                              </Button>
                              <p className="w-full text-xs text-[color:var(--muted-foreground)]">
                                {english
                                  ? "Settings exposes dry-run evidence only here; real DingTalk invite sending stays behind connector/security review."
                                  : "这里仅提供 dry-run 依据；真正发送钉钉邀请仍需经过连接器/安全复核。"}
                              </p>
                            </>
                          ) : null}
                          {dingtalkDirectoryInviteSummary ? (
                            <div className="workspace-panel-muted mt-3 w-full rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                              <div className="font-medium text-[color:var(--foreground)]">
                                {english
                                  ? `Directory invite ${dingtalkDirectoryInviteSummary.dryRun ? "dry-run" : "run"} summary`
                                  : `目录邀请${dingtalkDirectoryInviteSummary.dryRun ? " dry-run" : ""}结果`}
                              </div>
                              <p className="mt-1">
                                {english
                                  ? `Processed ${dingtalkDirectoryInviteSummary.processed}, created ${dingtalkDirectoryInviteSummary.createdUsers}, reused ${dingtalkDirectoryInviteSummary.reusedUsers}, membership upserts ${dingtalkDirectoryInviteSummary.upsertedMemberships}, messages ${dingtalkDirectoryInviteSummary.sentMessages}, skipped ${dingtalkDirectoryInviteSummary.skipped} (no mobile ${dingtalkDirectoryInviteSummary.skippedNoMobile}), collisions ${dingtalkDirectoryInviteSummary.nameCollisionResolved}, errors ${dingtalkDirectoryInviteSummary.errors.length}.`
                                  : `处理 ${dingtalkDirectoryInviteSummary.processed} 人，新增 ${dingtalkDirectoryInviteSummary.createdUsers}，复用 ${dingtalkDirectoryInviteSummary.reusedUsers}，成员写入 ${dingtalkDirectoryInviteSummary.upsertedMemberships}，消息 ${dingtalkDirectoryInviteSummary.sentMessages}，跳过 ${dingtalkDirectoryInviteSummary.skipped}（缺手机号 ${dingtalkDirectoryInviteSummary.skippedNoMobile}），同名冲突 ${dingtalkDirectoryInviteSummary.nameCollisionResolved}，错误 ${dingtalkDirectoryInviteSummary.errors.length}。`}
                              </p>
                              {dingtalkDirectoryInviteSummary.errors.length > 0 ? (
                                <p className="mt-1 text-xs text-[color:var(--status-warning-text)]">
                                  {(english
                                    ? "Latest error"
                                    : "最近错误") +
                                    `: ${dingtalkDirectoryInviteSummary.errors[0]}`}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          {dingtalkConnector ? (
                            <Button
                              disabled={pending || !canManageConnectors}
                              variant="secondary"
                              onClick={() =>
                                runConnectorAction(
                                  () => disconnectConnectorAction("DINGTALK"),
                                  english
                                    ? "DingTalk disconnected"
                                    : "钉钉已断开连接",
                                )
                              }
                            >
                              {english ? "Disconnect" : "断开连接"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div className="border-t border-[color:var(--border)]/70 pt-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-[color:var(--foreground)]">
                            {english
                              ? "Feishu identity and Bitable read-only connector"
                              : "飞书身份接入与多维表格只读连接器"}
                          </p>
                          {connectorConfig.feishuOauthReady ? (
                            <div className="rounded-full bg-[color:var(--status-info-bg)] px-3 py-1 text-xs font-medium text-[color:var(--status-info-text)] ring-1 ring-[color:var(--status-info-border)]">
                              {english ? "OAuth ready" : "授权已就绪"}
                            </div>
                          ) : (
                            <div className="rounded-full bg-[color:var(--status-warning-bg)] px-3 py-1 text-xs font-medium text-[color:var(--status-warning-text)] ring-1 ring-[color:var(--status-warning-border)]">
                              {english ? "OAuth pending" : "授权待配置"}
                            </div>
                          )}
                          {connectorConfig.feishuDirectorySyncReady ? (
                            <div className="rounded-full bg-[color:var(--status-success-bg)] px-3 py-1 text-xs font-medium text-[color:var(--status-success-text)] ring-1 ring-[color:var(--status-success-border)]">
                              {english
                                ? "Directory-sync seam ready"
                                : "目录同步接缝已就绪"}
                            </div>
                          ) : (
                            <div className="rounded-full bg-[color:var(--surface-subtle)] px-3 py-1 text-xs font-medium text-[color:var(--foreground)] ring-1 ring-[color:var(--border)]">
                              {english
                                ? "Directory-sync seam pending"
                                : "目录同步接缝待配置"}
                            </div>
                          )}
                          {connectorConfig.feishuBitableReady ? (
                            <div className="rounded-full bg-[color:var(--status-success-bg)] px-3 py-1 text-xs font-medium text-[color:var(--status-success-text)] ring-1 ring-[color:var(--status-success-border)]">
                              {english
                                ? "Bitable binding ready"
                                : "多维表格绑定已就绪"}
                            </div>
                          ) : (
                            <div className="rounded-full bg-[color:var(--surface-subtle)] px-3 py-1 text-xs font-medium text-[color:var(--foreground)] ring-1 ring-[color:var(--border)]">
                              {english
                                ? "Bitable binding pending"
                                : "多维表格绑定待配置"}
                            </div>
                          )}
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <Info
                            label={english ? "Current connector state" : "当前连接状态"}
                            value={
                              feishuConnector?.status === "CONNECTED"
                                ? english
                                  ? "Read-only connector connected"
                                  : "只读连接器已连接"
                                : feishuConnector?.status === "ERROR"
                                  ? english
                                    ? "Read-only connector needs review"
                                    : "只读连接器待复核"
                                  : connectorConfig.feishuOauthReady
                                    ? english
                                      ? "Callback ready / waiting to connect"
                                      : "回调已就绪 / 等待连接"
                                    : english
                                      ? "Callback config pending"
                                      : "回调配置待完成"
                            }
                          />
                          <Info
                            label={english ? "Last callback status" : "最近回调状态"}
                            value={formatDingTalkCallbackStatus(
                              feishuConnector?.lastCallbackResult?.status,
                              english,
                            )}
                          />
                          <Info
                            label={english ? "Failure posture" : "失败姿态"}
                            value={formatDingTalkFailurePosture(
                              feishuConnector?.lastCallbackResult?.failurePosture,
                              english,
                            )}
                          />
                          <Info
                            label={english ? "Last callback at" : "最近回调时间"}
                            value={formatSettingsDateLabel(
                              feishuConnector?.lastCallbackResult?.recordedAt
                                ? new Date(feishuConnector.lastCallbackResult.recordedAt)
                                : null,
                              english,
                            )}
                          />
                          <Info
                            label={
                              english ? "Resolved provider email" : "解析到的服务商邮箱"
                            }
                            value={
                              feishuConnector?.lastCallbackResult?.providerEmail ??
                              (english ? "Not recorded" : "未记录")
                            }
                          />
                          <Info
                            label={
                              english ? "Matched workspace user" : "绑定的工作区用户"
                            }
                            value={
                              feishuConnector?.lastCallbackResult?.matchedWorkspaceUserEmail ??
                              (english ? "Not resolved" : "未解析")
                            }
                          />
                          <Info
                            label={
                              english
                                ? "Last read-only ingest status"
                                : "最近只读采集状态"
                            }
                            value={formatDingTalkIngestStatus(
                              feishuConnector?.lastIngestResult?.status,
                              english,
                            )}
                          />
                          <Info
                            label={
                              english
                                ? "Read-only failure posture"
                                : "只读采集失败姿态"
                            }
                            value={formatDingTalkFailurePosture(
                              feishuConnector?.lastIngestResult?.failurePosture,
                              english,
                            )}
                          />
                          <Info
                            label={
                              english
                                ? "Last read-only ingest at"
                                : "最近只读采集时间"
                            }
                            value={formatSettingsDateLabel(
                              feishuConnector?.lastIngestResult?.recordedAt
                                ? new Date(feishuConnector.lastIngestResult.recordedAt)
                                : null,
                              english,
                            )}
                          />
                          <Info
                            label={
                              english ? "Persisted payloads" : "已保存采集资料"
                            }
                            value={String(
                              feishuConnector?.lastIngestResult?.persistedPayloadCount ??
                                0,
                            )}
                          />
                          <Info
                            label={english ? "Bitable binding" : "多维表格绑定"}
                            value={
                              english
                                ? connectorConfig.feishuBitableReady
                                  ? "Env-backed app_token/table_id binding ready"
                                  : "Env-backed app_token/table_id binding pending"
                                : connectorConfig.feishuBitableReady
                                  ? "env-backed 的 app_token/table_id 绑定已就绪"
                                  : "env-backed 的 app_token/table_id 绑定待配置"
                            }
                          />
                          <Info
                            label={english ? "Outbound path" : "外发路径"}
                            value={
                              english
                                ? "Message draft(review-first) pending"
                                : "消息草稿（先复核）待落地"
                            }
                          />
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {english
                            ? "This slice lands workspace-scoped Feishu OAuth callback plus an env-backed Bitable read-only ingest seam. It still does not claim workspace-managed binding UI, message send, auto-send, directory platformization, or broader connector control-plane authority."
                            : "这一层当前落地工作区范围的飞书 OAuth 回调，以及 env-backed 的多维表格只读采集接缝。它仍不宣称工作区内可管理绑定 UI、消息发送、自动外发、目录平台化或更宽的连接器控制面权限。"}
                        </p>
                        {feishuConnector?.lastIngestResult?.scopeResults?.length ? (
                          <div className="mt-4 space-y-2 rounded-2xl border border-[color:var(--border)]/70 bg-[color:var(--surface-subtle)]/80 px-4 py-3 text-sm text-[color:var(--muted)]">
                            {feishuConnector.lastIngestResult.scopeResults.map((scope) => (
                              <div
                                key={scope.scope}
                                className="flex flex-wrap items-start justify-between gap-2"
                              >
                                <div>
                                  <p className="font-medium text-[color:var(--foreground)]">
                                    {formatDingTalkReadOnlyScope(scope.scope, english)} ·{" "}
                                    {formatDingTalkIngestScopeStatus(
                                      scope.status,
                                      english,
                                    )}
                                  </p>
                                  {scope.message ? (
                                    <p className="mt-1 text-[color:var(--muted-foreground)]">
                                      {formatSettingsConnectorRuntimeText(
                                        scope.message,
                                        english,
                                      )}
                                    </p>
                                  ) : null}
                                </div>
                                {scope.docUrl ? (
                                  <a
                                    className="text-[color:var(--status-info-text)] underline underline-offset-2"
                                    href={scope.docUrl}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    {english ? "Contract" : "合同"}
                                  </a>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {feishuConnector?.lastIngestResult?.message ? (
                          <div className="workspace-panel-muted mt-4 rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                            {feishuConnector.lastIngestResult.message}
                          </div>
                        ) : null}
                        {feishuConnector?.lastSyncMessage ? (
                          <div className="workspace-panel-muted mt-4 rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                            {feishuConnector.lastSyncMessage}
                          </div>
                        ) : null}
                        {!canManageConnectors ? (
                          <div className="workspace-panel-muted mt-4 rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                            {english
                              ? "Connector writes remain narrowed to owner, admin, or operator. This surface stays readable, but connect and disconnect remain blocked for the current role."
                              : "连接器写动作仍只开放给负责人、管理员或运营。当前页面保持可读，但连接和断开动作对当前角色继续拦截。"}
                          </div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-3">
                          {connectorConfig.feishuOauthReady ? (
                            <Button
                              data-testid="feishu-connector-primary-action"
                              disabled={pending || !canManageConnectors}
                              onClick={() =>
                                window.location.assign("/api/auth/feishu/start")
                              }
                            >
                              {feishuConnector?.status === "CONNECTED"
                                ? english
                                  ? "Reconnect Feishu"
                                  : "重新连接飞书"
                                : feishuConnector?.status === "ERROR"
                                  ? english
                                    ? "Retry Feishu callback"
                                    : "重试飞书回调"
                                  : english
                                    ? "Connect Feishu"
                                    : "连接飞书"}
                            </Button>
                          ) : (
                            <Button disabled variant="secondary">
                              {english ? "Feishu OAuth pending config" : "飞书授权待配置"}
                            </Button>
                          )}
                          {feishuConnector ? (
                            <Button
                              disabled={
                                pending ||
                                !canManageConnectors ||
                                !connectorConfig.feishuBitableReady ||
                                feishuConnector.lastCallbackResult?.status !== "SUCCESS"
                              }
                              variant="secondary"
                              onClick={() =>
                                runConnectorAction(
                                  () => syncFeishuConnectorAction(),
                                  english
                                    ? "Feishu Bitable read-only ingest completed"
                                    : "飞书多维表格只读采集已完成",
                                )
                              }
                            >
                              {english ? "Run read-only ingest" : "执行只读采集"}
                            </Button>
                          ) : null}
                          {feishuConnector ? (
                            <Button
                              disabled={pending || !canManageConnectors}
                              variant="secondary"
                              onClick={() =>
                                runConnectorAction(
                                  () => disconnectConnectorAction("FEISHU"),
                                  english ? "Feishu disconnected" : "飞书已断开连接",
                                )
                              }
                            >
                              {english ? "Disconnect" : "断开连接"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div className="border-t border-[color:var(--border)]/70 pt-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-[color:var(--foreground)]">
                            {english
                              ? "WeCom identity and read-only connector"
                              : "企业微信身份接入与只读连接器"}
                          </p>
                          {connectorConfig.wecomOauthReady ? (
                            <div className="rounded-full bg-[color:var(--status-info-bg)] px-3 py-1 text-xs font-medium text-[color:var(--status-info-text)] ring-1 ring-[color:var(--status-info-border)]">
                              {english ? "OAuth ready" : "授权已就绪"}
                            </div>
                          ) : (
                            <div className="rounded-full bg-[color:var(--status-warning-bg)] px-3 py-1 text-xs font-medium text-[color:var(--status-warning-text)] ring-1 ring-[color:var(--status-warning-border)]">
                              {english ? "OAuth pending" : "授权待配置"}
                            </div>
                          )}
                          {connectorConfig.wecomDirectorySyncReady ? (
                            <div className="rounded-full bg-[color:var(--status-success-bg)] px-3 py-1 text-xs font-medium text-[color:var(--status-success-text)] ring-1 ring-[color:var(--status-success-border)]">
                              {english
                                ? "Directory-sync seam ready"
                                : "目录同步接缝已就绪"}
                            </div>
                          ) : (
                            <div className="rounded-full bg-[color:var(--surface-subtle)] px-3 py-1 text-xs font-medium text-[color:var(--foreground)] ring-1 ring-[color:var(--border)]">
                              {english
                                ? "Directory-sync seam pending"
                                : "目录同步接缝待配置"}
                            </div>
                          )}
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <Info
                            label={
                              english
                                ? "Calendar registry readiness"
                                : "日历注册表就绪度"
                            }
                            value={formatWeComCalendarRegistryReadiness(
                              wecomConnector,
                              english,
                            )}
                          />
                          <Info
                            label={
                              english ? "Bound calendar count" : "已绑定日历数"
                            }
                            value={String(
                              wecomConnector?.calendarRegistry?.boundCalendars
                                .length ?? 0,
                            )}
                          />
                          <Info
                            label={
                              english
                                ? "Last validation result"
                                : "最近校验结果"
                            }
                            value={formatWeComCalendarRegistryStatus(
                              wecomConnector?.calendarRegistry
                                ?.lastValidationResult?.status,
                              english,
                            )}
                          />
                          <Info
                            label={
                              english ? "Next required action" : "下一步动作"
                            }
                            value={getWeComCalendarRegistryNextAction(
                              wecomConnector,
                              connectorConfig.wecomOauthReady,
                              english,
                            )}
                          />
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {english
                            ? "This slice establishes a workspace-scoped WeCom calendar registry seam. The business-critical question on this surface is whether the workspace has validated calendar ids that later runtime can bind to."
                            : "这一层建立的是工作区范围的企业微信日历注册表接缝。当前页面只优先回答一件经营相关的事：这个工作区是否已经校验出后续运行时可以绑定的日历 ID。"}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {english
                            ? "Current repo truth still does not claim native WeCom SCIM, send/write-back, broader connector platformization, or calendar runtime. Meetings runtime is established. Calendar remains runtime pending until this registry-backed ingest slice lands. Message notifications remain unresolved."
                            : "当前仓库真实状态仍不宣称原生企业微信目录同步（SCIM）、发送 / 回写、更宽的连接器平台化或日历运行时已成立。会议运行时已成立；日历在注册表支撑的采集切片落地前继续保持运行待定；消息通知继续保持未决。"}
                        </p>
                        <div className="mt-4 rounded-2xl border border-[color:var(--border)]/70 bg-white/80 px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-[color:var(--foreground)]">
                                {english
                                  ? "Workspace calendar registry"
                                  : "工作区日历注册表"}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
                                {english
                                  ? "Enter one WeCom calendar ID per line. This only validates and stores the registry. It does not claim calendar runtime, write back to WeCom, or widen execution authority."
                                  : "每行填写一个企业微信日历 ID。当前动作只做注册表校验与保存，不宣称日历运行时，不会向企业微信回写，也不会扩大执行权限。"}
                              </p>
                            </div>
                            {wecomConnector?.calendarRegistry
                              ?.lastValidationResult?.recordedAt ? (
                              <p className="text-xs text-[color:var(--muted-foreground)]">
                                {english ? "Last checked" : "最近校验"}：
                                {formatSettingsDateLabel(
                                  new Date(
                                    wecomConnector.calendarRegistry
                                      .lastValidationResult.recordedAt,
                                  ),
                                  english,
                                )}
                              </p>
                            ) : null}
                          </div>
                          <div className="mt-4 space-y-3">
                            <Textarea
                              rows={6}
                              value={wecomCalendarRegistryDraft}
                              onChange={(event) =>
                                setWecomCalendarRegistryDraft(
                                  event.target.value,
                                )
                              }
                              placeholder={
                                english
                                  ? "calendar-id-1\ncalendar-id-2\ncalendar-id-3"
                                  : "每行一个日历 ID"
                              }
                              className="font-mono text-sm"
                            />
                            <div className="flex flex-wrap gap-3">
                              <Button
                                disabled={
                                  pending ||
                                  !canManageConnectors ||
                                  !connectorConfig.wecomOauthReady ||
                                  !wecomConnector ||
                                  wecomConnector.lastCallbackResult?.status !==
                                    "SUCCESS"
                                }
                                onClick={() =>
                                  runConnectorAction(
                                    () =>
                                      validateWeComCalendarRegistryAction(
                                        wecomCalendarRegistryDraft,
                                      ),
                                    english
                                      ? "WeCom calendar registry validated"
                                      : "企业微信日历注册表已校验",
                                  )
                                }
                              >
                                {english ? "Validate registry" : "校验注册表"}
                              </Button>
                              <Button
                                disabled={pending}
                                variant="secondary"
                                onClick={() =>
                                  setWecomCalendarRegistryDraft(
                                    (
                                      wecomConnector?.calendarRegistry
                                        ?.boundCalendars ?? []
                                    )
                                      .map((calendar) => calendar.calendarId)
                                      .join("\n"),
                                  )
                                }
                              >
                                {english
                                  ? "Reset to saved registry"
                                  : "重置为已保存注册表"}
                              </Button>
                            </div>
                          </div>
                        </div>
                        {wecomConnector?.calendarRegistry?.boundCalendars
                          .length ? (
                          <div className="mt-4 rounded-2xl border border-[color:var(--border)]/70 bg-[color:var(--surface-subtle)]/80 px-4 py-3 text-sm text-[color:var(--muted)]">
                            <p className="font-medium text-[color:var(--foreground)]">
                              {english ? "Bound calendars" : "已绑定日历"}
                            </p>
                            <div className="mt-3 space-y-2">
                              {wecomConnector.calendarRegistry.boundCalendars.map(
                                (calendar) => (
                                  <div
                                    key={calendar.calendarId}
                                    className="flex flex-wrap items-start justify-between gap-2"
                                  >
                                    <div>
                                      <p className="font-medium text-[color:var(--foreground)]">
                                        {calendar.calendarName ??
                                          calendar.calendarId}
                                      </p>
                                      <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                                        {calendar.calendarId}
                                        {calendar.ownerUserId
                                          ? ` · ${calendar.ownerUserId}`
                                          : ""}
                                      </p>
                                    </div>
                                    <p className="text-xs text-[color:var(--muted-foreground)]">
                                      {formatSettingsDateLabel(
                                        new Date(calendar.recordedAt),
                                        english,
                                      )}
                                    </p>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        ) : null}
                        <div className="mt-4 rounded-2xl border border-[color:var(--border)]/70 bg-[color:var(--surface-subtle)]/80 px-4 py-3 text-sm text-[color:var(--muted)]">
                          <p className="font-medium text-[color:var(--foreground)]">
                            {english ? "Operator detail" : "操作面细节"}
                          </p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <Info
                              label={
                                english
                                  ? "Current connector state"
                                  : "当前连接状态"
                              }
                              value={
                                wecomConnector?.status === "CONNECTED"
                                  ? english
                                    ? "Callback connected"
                                    : "回调已连接"
                                  : wecomConnector?.status === "ERROR"
                                    ? english
                                      ? "Callback failure"
                                      : "回调异常"
                                    : connectorConfig.wecomOauthReady
                                      ? english
                                        ? "Callback ready / waiting to connect"
                                        : "回调已就绪 / 等待连接"
                                      : english
                                        ? "Callback config pending"
                                        : "回调配置待完成"
                              }
                            />
                            <Info
                              label={
                                english
                                  ? "Last callback status"
                                  : "最近回调状态"
                              }
                              value={formatDingTalkCallbackStatus(
                                wecomConnector?.lastCallbackResult?.status,
                                english,
                              )}
                            />
                            <Info
                              label={english ? "Failure posture" : "失败姿态"}
                              value={formatDingTalkFailurePosture(
                                wecomConnector?.lastCallbackResult
                                  ?.failurePosture,
                                english,
                              )}
                            />
                            <Info
                              label={
                                english ? "Last callback at" : "最近回调时间"
                              }
                              value={formatSettingsDateLabel(
                                wecomConnector?.lastCallbackResult?.recordedAt
                                  ? new Date(
                                      wecomConnector.lastCallbackResult
                                        .recordedAt,
                                    )
                                  : null,
                                english,
                              )}
                            />
                            <Info
                              label={
                                english
                                  ? "Resolved provider email"
                                  : "解析到的服务商邮箱"
                              }
                              value={
                                wecomConnector?.lastCallbackResult
                                  ?.providerEmail ??
                                (english ? "Not recorded" : "未记录")
                              }
                            />
                            <Info
                              label={
                                english
                                  ? "Matched workspace user"
                                  : "绑定的工作区用户"
                              }
                              value={
                                wecomConnector?.lastCallbackResult
                                  ?.matchedWorkspaceUserEmail ??
                                (english ? "Not resolved" : "未解析")
                              }
                            />
                            <Info
                              label={
                                english
                                  ? "Last read-only ingest status"
                                  : "最近只读采集状态"
                              }
                              value={formatDingTalkIngestStatus(
                                wecomConnector?.lastIngestResult?.status,
                                english,
                              )}
                            />
                            <Info
                              label={
                                english
                                  ? "Read-only failure posture"
                                  : "只读采集失败姿态"
                              }
                              value={formatDingTalkFailurePosture(
                                wecomConnector?.lastIngestResult
                                  ?.failurePosture,
                                english,
                              )}
                            />
                            <Info
                              label={
                                english
                                  ? "Last read-only ingest at"
                                  : "最近只读采集时间"
                              }
                              value={formatSettingsDateLabel(
                                wecomConnector?.lastIngestResult?.recordedAt
                                  ? new Date(
                                      wecomConnector.lastIngestResult
                                        .recordedAt,
                                    )
                                  : null,
                                english,
                              )}
                            />
                            <Info
                              label={
                                english
                                  ? "Persisted payloads"
                                  : "已保存采集资料"
                              }
                              value={String(
                                wecomConnector?.lastIngestResult
                                  ?.persistedPayloadCount ?? 0,
                              )}
                            />
                            <Info
                              label={english ? "Identity path" : "身份接入路径"}
                              value={
                                english
                                  ? "OAuth callback + profile sync"
                                  : "授权回调 + 用户资料同步"
                              }
                            />
                            <Info
                              label={
                                english ? "Provisioning path" : "目录同步路径"
                              }
                              value={
                                english
                                  ? "Helm directory-sync adapter seam"
                                  : "Helm 内部目录同步适配接缝"
                              }
                            />
                          </div>
                        </div>
                        {wecomConnector?.lastIngestResult?.scopeResults
                          ?.length ? (
                          <div className="mt-4 space-y-2 rounded-2xl border border-[color:var(--border)]/70 bg-[color:var(--surface-subtle)]/80 px-4 py-3 text-sm text-[color:var(--muted)]">
                            {wecomConnector.lastIngestResult.scopeResults.map(
                              (scope) => (
                                <div
                                  key={scope.scope}
                                  className="flex flex-wrap items-start justify-between gap-2"
                                >
                                  <div>
                                    <p className="font-medium text-[color:var(--foreground)]">
                                      {formatDingTalkReadOnlyScope(
                                        scope.scope,
                                        english,
                                      )}{" "}
                                      ·{" "}
                                      {formatDingTalkIngestScopeStatus(
                                        scope.status,
                                        english,
                                      )}
                                    </p>
                                    {scope.message ? (
                                      <p className="mt-1 text-[color:var(--muted-foreground)]">
                                        {formatSettingsConnectorRuntimeText(
                                          scope.message,
                                          english,
                                        )}
                                      </p>
                                    ) : null}
                                  </div>
                                  {scope.docUrl ? (
                                    <a
                                      className="text-[color:var(--status-info-text)] underline underline-offset-2"
                                      href={scope.docUrl}
                                      rel="noreferrer"
                                      target="_blank"
                                    >
                                      {english ? "Contract" : "合同"}
                                    </a>
                                  ) : null}
                                </div>
                              ),
                            )}
                          </div>
                        ) : null}
                        {wecomConnector?.lastIngestResult?.message ? (
                          <div className="workspace-panel-muted mt-4 rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                            {wecomConnector.lastIngestResult.message}
                          </div>
                        ) : null}
                        {wecomConnector?.lastSyncMessage ? (
                          <div className="workspace-panel-muted mt-4 rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                            {wecomConnector.lastSyncMessage}
                          </div>
                        ) : null}
                        {!canManageConnectors ? (
                          <div className="workspace-panel-muted mt-4 rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                            {english
                              ? "Connector writes remain narrowed to owner, admin, or operator. This surface stays readable, but connect and disconnect remain blocked for the current role."
                              : "连接器写动作仍只开放给负责人、管理员或运营。当前页面保持可读，但连接和断开动作对当前角色继续拦截。"}
                          </div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-3">
                          {connectorConfig.wecomOauthReady ? (
                            <Button
                              data-testid="wecom-connector-primary-action"
                              disabled={pending || !canManageConnectors}
                              onClick={() =>
                                window.location.assign("/api/auth/wecom/start")
                              }
                            >
                              {wecomConnector?.status === "CONNECTED"
                                ? english
                                  ? "Reconnect WeCom"
                                  : "重新连接企业微信"
                                : wecomConnector?.status === "ERROR"
                                  ? english
                                    ? "Retry WeCom callback"
                                    : "重试企业微信回调"
                                  : english
                                    ? "Connect WeCom"
                                    : "连接企业微信"}
                            </Button>
                          ) : (
                            <Button disabled variant="secondary">
                              {english
                                ? "WeCom OAuth pending config"
                                : "企业微信授权待配置"}
                            </Button>
                          )}
                          {wecomConnector ? (
                            <Button
                              disabled={
                                pending ||
                                !canManageConnectors ||
                                wecomConnector.lastCallbackResult?.status !==
                                  "SUCCESS"
                              }
                              variant="secondary"
                              onClick={() =>
                                runConnectorAction(
                                  () => syncWeComConnectorAction(),
                                  english
                                    ? "WeCom read-only ingest completed"
                                    : "企业微信只读采集已完成",
                                )
                              }
                            >
                              {english
                                ? "Run read-only ingest"
                                : "执行只读采集"}
                            </Button>
                          ) : null}
                          {wecomConnector ? (
                            <Button
                              disabled={pending || !canManageConnectors}
                              variant="secondary"
                              onClick={() =>
                                runConnectorAction(
                                  () => disconnectConnectorAction("WECOM"),
                                  english
                                    ? "WeCom disconnected"
                                    : "企业微信已断开连接",
                                )
                              }
                            >
                              {english ? "Disconnect" : "断开连接"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                    {english
                      ? "The current China-connector priority is DingTalk runtime complete first, then WeCom runtime callback and read-only ingestion slices. Google Calendar stays reserved at the provider boundary for now."
                      : "当前中国连接器优先级是：先把钉钉运行链路跑完整，再推进企业微信回调与只读采集切片。Google Calendar 目前仍停留在来源边界预留层。"}
                  </p>
                  <div className="workspace-panel rounded-2xl px-4 py-3 text-sm leading-6 text-[color:var(--muted)]">
                    {english
                      ? "The key thing to watch during pilot is not only whether a connector attached, but whether imported objects were bound correctly. If unbound threads or import failures keep rising, clean data quality first before widening the pilot."
                      : "当前试点期最值得盯的不是“接没接上”，而是“接进来的对象有没有被绑定对”。如果待绑定线程或导入失败行持续升高，建议先清数据质量，再扩大试点范围。"}
                  </div>
                  {setupSourceSelections.length ? (
                    setupSourceSelections.map((selection) => {
                      const sourceIntakeSelection = isSourceIntakeOptionKey(
                        selection.name,
                      );
                      return (
                        <div
                          key={selection.name}
                          className="workspace-panel rounded-2xl px-4 py-3"
                        >
                          <p className="font-medium text-[color:var(--foreground)]">
                            {formatSourceIntakeLabel(selection.name, locale)}
                          </p>
                          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                            {sourceIntakeSelection ||
                            selection.status === "diagnostic_selected"
                              ? english
                                ? "Source intake selection from setup wizard; not connector authorization."
                                : "初始化向导中的数据来源诊断选择；不是连接器授权。"
                              : english
                                ? "Legacy setup note; not connector authorization."
                                : "历史初始化说明；不是连接器授权。"}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <EmptyState
                      title={
                        english
                          ? "No setup source-intake notes yet"
                          : "还没有初始化数据来源诊断说明"
                      }
                      description={
                        english
                          ? "Source-intake defaults from setup appear here as guidance, not connector state."
                          : "初始化向导里的数据来源默认项会作为引导显示在这里，不作为连接器状态。"
                      }
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="policies">
          <div className="space-y-4">
            {!canManagePolicies ? (
              <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
                {english
                  ? "Policy and strategy adjustments stay limited to owner or admin. You can still read the current posture here, but changing system rules requires a higher workspace capability."
                  : "策略和系统规则调整仅开放给负责人或管理员。你仍然可以在这里阅读当前姿态，但修改系统规则需要更高的工作区能力。"}
              </div>
            ) : null}
            <Card className="workspace-panel-muted">
              <CardHeader>
                <CardTitle>
                  {english ? "Reusable work suggestions" : "系统最近建议沉淀的做法"}
                </CardTitle>
                <CardDescription>
                  {english
                    ? "Accepting creates a candidate. Nothing here registers a formal skill."
                    : "采纳只生成候选；不会自动注册成正式能力。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.skillSuggestions.length ? (
                  data.skillSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="workspace-panel rounded-2xl px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[color:var(--foreground)]">
                              {formatSettingsSkillSuggestionText(
                                suggestion.candidateSkillName,
                                english,
                              )}
                            </p>
                            <Badge variant="approval">
                              {formatSettingsCapabilityCategory(
                                suggestion.candidateCategory,
                                english,
                              )}
                            </Badge>
                            <Badge variant="neutral">
                              {skillBoundaryLabels[
                                suggestion.candidateBoundary
                              ] ?? suggestion.candidateBoundary}
                            </Badge>
                            <Badge variant="info">
                              {skillEffectModeLabels[
                                suggestion.candidateEffectMode
                              ] ?? suggestion.candidateEffectMode}
                            </Badge>
                          </div>
                          <p className="text-sm leading-6 text-[color:var(--muted)]">
                            {formatSettingsSkillSuggestionText(
                              suggestion.reason,
                              english,
                            )}
                          </p>
                          <div className="flex flex-wrap gap-3 text-xs text-[color:var(--muted-foreground)]">
                            <span>
                              {english ? "Surface" : "默认呈现层"}：
                              {skillSurfaceLabels[
                                suggestion.candidateDefaultSurface
                              ] ?? suggestion.candidateDefaultSurface}
                            </span>
                            <span>
                              {english ? "Confidence" : "置信度"}：
                              {suggestion.confidence}
                            </span>
                            <span>
                              {english ? "Created" : "创建时间"}：
                              {formatSettingsDateLabel(suggestion.createdAt, english)}
                            </span>
                          </div>
                          <div className="theme-surface-panel-soft rounded-2xl px-3 py-3 text-xs leading-6 text-[color:var(--muted)]">
                            {formatSettingsSkillSuggestionText(
                              suggestion.nonCommitmentNote,
                              english,
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={pending || !canManagePolicies}
                            onClick={() =>
                              runSuggestionAction(
                                () =>
                                  acceptSkillSuggestionAction({
                                    id: suggestion.id,
                                  }),
                                english
                                  ? "Work suggestion accepted"
                                  : "已采纳可复用做法建议",
                              )
                            }
                          >
                            {english ? "Accept as reusable practice" : "采纳为可复用做法"}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={pending || !canManagePolicies}
                            onClick={() =>
                              runSuggestionAction(
                                () =>
                                  dismissSkillSuggestionAction({
                                    id: suggestion.id,
                                  }),
                                english
                                  ? "Work suggestion dismissed"
                                  : "已忽略可复用做法建议",
                              )
                            }
                          >
                            {english ? "Dismiss for now" : "先忽略"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title={
                      english
                        ? "No new reusable practice recently"
                        : "系统最近没有新的可复用做法建议"
                    }
                    description={
                      english
                        ? "When stable operating patterns become reusable but still need review, they will appear here."
                        : "当稳定推进规律开始可复用、但仍需要人工复核时，会在这里出现。"
                    }
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {english
                    ? "Recently adopted reusable practices"
                    : "最近已收敛的可复用做法"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentSkillAdoptions.length ? (
                  data.recentSkillAdoptions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="theme-surface-panel rounded-2xl px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {formatSettingsSkillSuggestionText(
                            suggestion.candidateSkillName,
                            english,
                          )}
                        </p>
                        <Badge
                          variant={
                            suggestion.capabilityStage === "probationary_skill"
                              ? "success"
                              : "approval"
                          }
                        >
                          {skillStageLabels[suggestion.capabilityStage] ??
                            suggestion.capabilityStage}
                        </Badge>
                        <Badge
                          variant={
                            suggestion.formalReviewStatus ===
                            "HARDENING_REQUIRED"
                              ? "danger"
                              : suggestion.formalReviewStatus === "QUEUED"
                                ? "success"
                                : "info"
                          }
                        >
                          {formalReviewStatusLabels[
                            suggestion.formalReviewStatus
                          ] ?? suggestion.formalReviewStatus}
                        </Badge>
                        {suggestion.formalReviewDecision !== "NONE" ? (
                          <Badge
                            variant={
                              suggestion.formalReviewDecision ===
                              "APPROVED_PENDING_PROMOTION"
                                ? "success"
                                : suggestion.formalReviewDecision === "REJECTED"
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            {formalReviewDecisionLabels[
                              suggestion.formalReviewDecision
                            ] ?? suggestion.formalReviewDecision}
                          </Badge>
                        ) : null}
                        {suggestion.formalPromotionReady ? (
                          <Badge variant="warning">
                            {english
                              ? "Ready for manual confirmation"
                              : "已达人工确认条件"}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                        {formatSettingsSkillSuggestionText(
                          suggestion.appliedEffectSummary ??
                            (english
                              ? "It has been adopted as a review-first practice and is still waiting for later evidence."
                              : "已作为先复核的可复用做法收敛，仍会继续等待后续证据。"),
                          english,
                        )}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-[color:var(--muted-foreground)]">
                        <span>
                          {english ? "Effective at" : "生效时间"}：
                          {formatSettingsDateLabel(
                            suggestion.appliedAt ?? suggestion.confirmedAt,
                            english,
                          )}
                        </span>
                        <span>
                          {english ? "Calibration" : "校准分"}：
                          {suggestion.calibrationScore}
                        </span>
                        <span>
                          {english ? "Evidence" : "证据"}：
                          {suggestion.evidenceCount}
                        </span>
                        <span>
                          {english ? "Revalidations" : "持续复现"}：
                          {suggestion.revalidationCount}
                        </span>
                        <span>
                          {english ? "Adoptions" : "采纳次数"}：
                          {suggestion.adoptionCount}
                        </span>
                        <span>
                          {english ? "Dismissals" : "忽略次数"}：
                          {suggestion.dismissalCount}
                        </span>
                        <span>
                          {english ? "Boundary incidents" : "边界事件"}：
                          {suggestion.boundaryIncidentCount}
                        </span>
                      </div>
                      {suggestion.formalReviewSummary ? (
                        <div className="mt-2 theme-surface-panel-soft rounded-2xl px-3 py-3 text-xs leading-6 text-[color:var(--muted)]">
                          {formatSettingsSkillSuggestionText(
                            suggestion.formalReviewSummary,
                            english,
                          )}
                        </div>
                      ) : null}
                      {suggestion.formalReviewDecision !== "NONE" ? (
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-[color:var(--muted-foreground)]">
                          <span>
                            {english ? "Decision at" : "决定时间"}：
                            {formatSettingsDateLabel(suggestion.formalReviewDecisionAt, english)}
                          </span>
                          <span>
                            {english ? "Reviewer" : "评审人"}：
                            {suggestion.formalReviewDecisionByName ??
                              (english ? "Unknown" : "未知")}
                          </span>
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {reservedFormalSkillGovernanceReadable &&
                        suggestion.formalPromotionReady &&
                        suggestion.formalReviewStatus !== "QUEUED" &&
                        suggestion.formalReviewDecision !==
                          "APPROVED_PENDING_PROMOTION" ? (
                          <Button
                            size="sm"
                            disabled={
                              pending || !canManageReservedFormalSkillGovernance
                            }
                            onClick={() =>
                              runSuggestionAction(
                                () =>
                                  queueSkillFormalReviewAction({
                                    id: suggestion.id,
                                  }),
                                english
                                  ? "Queued for manual confirmation"
                                  : "已加入人工确认队列",
                              )
                            }
                          >
                            {suggestion.formalReviewDecision === "DEFERRED" ||
                            suggestion.formalReviewDecision === "REJECTED" ||
                            suggestion.formalReviewStatus ===
                              "HARDENING_REQUIRED"
                              ? english
                                ? "Queue again"
                                : "重新入队"
                              : english
                                ? "Queue for manual confirmation"
                                : "加入人工确认队列"}
                          </Button>
                        ) : null}
                        {reservedFormalSkillGovernanceReadable &&
                        suggestion.formalReviewStatus === "QUEUED" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={
                              pending || !canManageReservedFormalSkillGovernance
                            }
                            onClick={() =>
                              runSuggestionAction(
                                () =>
                                  returnSkillFormalReviewForHardeningAction({
                                    id: suggestion.id,
                                  }),
                                english
                                  ? "Returned for hardening"
                                  : "已退回加固",
                              )
                            }
                          >
                            {english ? "Return for hardening" : "退回加固"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title={
                      english
                        ? "No adopted reusable practice yet"
                        : "还没有收敛完成的可复用做法"
                    }
                    description={
                      english
                        ? "Once you accept a work suggestion, this section will show whether it is still candidate-only, under trial, or ready for manual confirmation."
                        : "当你采纳可复用做法后，这里会显示它仍在候选层、已经进入试运行，还是已经达到人工确认条件。"
                    }
                  />
                )}
              </CardContent>
            </Card>

            {reservedFormalSkillGovernanceReadable ? (
              <>
                <Card className="workspace-panel-muted">
                  <CardHeader>
                    <CardTitle>
                      {english
                        ? "Manual practice confirmation queue"
                        : "可复用做法人工确认队列"}
                    </CardTitle>
                    <CardDescription>
                      {english
                        ? "Manual review only — no auto-promotion."
                        : "只走人工评审，不自动晋级。"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.formalSkillReviewQueue.length ? (
                      data.formalSkillReviewQueue.map((item) => (
                        <div
                          key={item.id}
                          className="workspace-panel rounded-2xl px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[color:var(--foreground)]">
                              {formatSettingsSkillSuggestionText(
                                item.candidateSkillName,
                                english,
                              )}
                            </p>
                            <Badge
                              variant={
                                item.capabilityStage === "probationary_skill"
                                  ? "success"
                                  : "approval"
                              }
                            >
                              {skillStageLabels[item.capabilityStage] ??
                                item.capabilityStage}
                            </Badge>
                            <Badge
                              variant={
                                item.formalReviewStatus === "HARDENING_REQUIRED"
                                  ? "danger"
                                  : item.formalReviewStatus === "QUEUED"
                                    ? "success"
                                    : "info"
                              }
                            >
                              {formalReviewStatusLabels[
                                item.formalReviewStatus
                              ] ?? item.formalReviewStatus}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                            {formatSettingsSkillSuggestionText(
                              item.formalReviewSummary ??
                                item.appliedEffectSummary ??
                                (english
                                  ? "This practice is waiting for manual confirmation."
                                  : "这条做法正在等待人工确认。"),
                              english,
                            )}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-[color:var(--muted-foreground)]">
                            <span>
                              {english ? "Calibration" : "校准分"}：
                              {item.calibrationScore}
                            </span>
                            <span>
                              {english ? "Evidence" : "证据"}：
                              {item.evidenceCount}
                            </span>
                            <span>
                              {english ? "Revalidations" : "持续复现"}：
                              {item.revalidationCount}
                            </span>
                            <span>
                              {english ? "Adoptions" : "采纳次数"}：
                              {item.adoptionCount}
                            </span>
                            <span>
                              {english ? "Dismissals" : "忽略次数"}：
                              {item.dismissalCount}
                            </span>
                            <span>
                              {english ? "Boundary incidents" : "边界事件"}：
                              {item.boundaryIncidentCount}
                            </span>
                            <span>
                              {english ? "Queued at" : "入队时间"}：
                              {formatSettingsDateLabel(
                                item.formalReviewQueuedAt ??
                                  item.appliedAt ??
                                  item.confirmedAt,
                                english,
                              )}
                            </span>
                          </div>
                          {item.formalReviewStatus === "QUEUED" ? (
                            <div className="mt-3 space-y-3 rounded-2xl border border-[color:var(--border)]/80 px-4 py-4">
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                                  {english ? "Review note" : "评审说明"}
                                </p>
                                <Textarea
                                  value={formalReviewNotes[item.id] ?? ""}
                                  onChange={(event) =>
                                    setFormalReviewNotes((current) => ({
                                      ...current,
                                      [item.id]: event.target.value,
                                    }))
                                  }
                                  placeholder={
                                    english
                                      ? "Summarize why this should be approved, deferred, or rejected."
                                      : "写下为什么应该批准、暂缓或拒绝。"
                                  }
                                  rows={3}
                                />
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                {(
                                  Object.keys(
                                    formalReviewChecklistLabels,
                                  ) as Array<keyof FormalReviewChecklistState>
                                ).map((key) => (
                                  <div
                                    key={key}
                                    className="flex items-center justify-between rounded-2xl bg-[color:var(--surface-subtle)] px-3 py-3"
                                  >
                                    <span className="text-xs leading-6 text-[color:var(--muted)]">
                                      {formalReviewChecklistLabels[key]}
                                    </span>
                                    <Switch
                                      checked={
                                        getFormalReviewChecklistDraft(item.id)[
                                          key
                                        ]
                                      }
                                      disabled={pending || !canManagePolicies}
                                      onCheckedChange={(checked) =>
                                        setFormalReviewChecklists(
                                          (current) => ({
                                            ...current,
                                            [item.id]: {
                                              ...getFormalReviewChecklistDraft(
                                                item.id,
                                              ),
                                              [key]: checked,
                                            },
                                          }),
                                        )
                                      }
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.formalReviewStatus !== "QUEUED" &&
                            item.formalPromotionReady ? (
                              <Button
                                size="sm"
                                disabled={pending || !canManagePolicies}
                                onClick={() =>
                                  runSuggestionAction(
                                    () =>
                                      queueSkillFormalReviewAction({
                                        id: item.id,
                                      }),
                                    english
                                      ? "Queued for manual confirmation"
                                      : "已加入人工确认队列",
                                  )
                                }
                              >
                                {english
                                  ? "Queue for manual confirmation"
                                  : "加入人工确认队列"}
                              </Button>
                            ) : null}
                            {item.formalReviewStatus === "QUEUED" ? (
                              <Button
                                size="sm"
                                disabled={pending || !canManagePolicies}
                                onClick={() =>
                                  runFormalReviewDecisionAction(
                                    item.id,
                                    approveSkillFormalReviewAction,
                                    english
                                      ? "Manual confirmation approved"
                                      : "已通过人工确认",
                                  )
                                }
                              >
                                {english ? "Approve" : "批准"}
                              </Button>
                            ) : null}
                            {item.formalReviewStatus === "QUEUED" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={pending || !canManagePolicies}
                                onClick={() =>
                                  runFormalReviewDecisionAction(
                                    item.id,
                                    deferSkillFormalReviewAction,
                                    english
                                      ? "Manual confirmation deferred"
                                      : "已暂缓人工确认",
                                  )
                                }
                              >
                                {english ? "Defer" : "暂缓"}
                              </Button>
                            ) : null}
                            {item.formalReviewStatus === "QUEUED" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={pending || !canManagePolicies}
                                onClick={() =>
                                  runFormalReviewDecisionAction(
                                    item.id,
                                    rejectSkillFormalReviewAction,
                                    english
                                      ? "Manual confirmation rejected"
                                      : "已拒绝人工确认",
                                  )
                                }
                              >
                                {english ? "Reject" : "拒绝"}
                              </Button>
                            ) : null}
                            {item.formalReviewStatus === "QUEUED" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={pending || !canManagePolicies}
                                onClick={() =>
                                  runSuggestionAction(
                                    () =>
                                      returnSkillFormalReviewForHardeningAction(
                                        { id: item.id },
                                      ),
                                    english
                                      ? "Returned for hardening"
                                      : "已退回加固",
                                  )
                                }
                              >
                                {english ? "Return for hardening" : "退回加固"}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title={
                          english
                            ? "No manual confirmation item yet"
                            : "还没有人工确认项"
                        }
                        description={
                          english
                            ? "Once a trial practice becomes ready, it will appear here as a manual queue item instead of auto-promoting."
                            : "当试运行做法达到人工确认条件后，它会作为人工队列项出现在这里，而不是自动晋级。"
                        }
                      />
                    )}
                  </CardContent>
                </Card>

                <Card className="workspace-panel-muted">
                  <CardHeader>
                    <CardTitle>
                      {english
                        ? "Recent manual confirmation decisions"
                        : "最近人工确认决定"}
                    </CardTitle>
                    <CardDescription>
                      {english
                        ? "Manual review outcomes. Approved still needs the explicit promotion step."
                        : "人工评审结果。通过之后仍需显式晋级。"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.recentFormalReviewDecisions.length ? (
                      data.recentFormalReviewDecisions.map((item) => (
                        <div
                          key={item.id}
                          className="workspace-panel rounded-2xl px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[color:var(--foreground)]">
                              {formatSettingsSkillSuggestionText(
                                item.candidateSkillName,
                                english,
                              )}
                            </p>
                            <Badge
                              variant={
                                item.capabilityStage === "probationary_skill"
                                  ? "success"
                                  : "approval"
                              }
                            >
                              {skillStageLabels[item.capabilityStage] ??
                                item.capabilityStage}
                            </Badge>
                            <Badge
                              variant={
                                item.formalReviewDecision ===
                                "APPROVED_PENDING_PROMOTION"
                                  ? "success"
                                  : item.formalReviewDecision === "REJECTED"
                                    ? "danger"
                                    : "warning"
                              }
                            >
                              {formalReviewDecisionLabels[
                                item.formalReviewDecision
                              ] ?? item.formalReviewDecision}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                            {formatSettingsSkillSuggestionText(
                              item.formalReviewSummary ??
                                item.appliedEffectSummary ??
                                (english
                                  ? "A manual confirmation decision was recorded for this practice."
                                  : "这条做法已经记录了一次人工确认决定。"),
                              english,
                            )}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-[color:var(--muted-foreground)]">
                            <span>
                              {english ? "Decision at" : "决定时间"}：
                              {formatSettingsDateLabel(item.formalReviewDecisionAt, english)}
                            </span>
                            <span>
                              {english ? "Reviewer" : "评审人"}：
                              {item.formalReviewDecisionByName ??
                                (english ? "Unknown" : "未知")}
                            </span>
                            <span>
                              {english ? "Calibration" : "校准分"}：
                              {item.calibrationScore}
                            </span>
                            <span>
                              {english ? "Boundary incidents" : "边界事件"}：
                              {item.boundaryIncidentCount}
                            </span>
                          </div>
                          {item.formalReviewDecisionNote ? (
                            <div className="mt-2 theme-surface-panel-soft rounded-2xl px-3 py-3 text-xs leading-6 text-[color:var(--muted)]">
                              {formatSettingsSkillSuggestionText(
                                item.formalReviewDecisionNote,
                                english,
                              )}
                            </div>
                          ) : null}
                          <div className="mt-2 grid gap-3 md:grid-cols-2">
                            {(
                              Object.keys(formalReviewChecklistLabels) as Array<
                                keyof FormalReviewChecklistState
                              >
                            ).map((key) => (
                              <div
                                key={key}
                                className="flex items-center justify-between rounded-2xl bg-[color:var(--surface-subtle)] px-3 py-3"
                              >
                                <span className="text-xs leading-6 text-[color:var(--muted)]">
                                  {formalReviewChecklistLabels[key]}
                                </span>
                                <Badge
                                  variant={
                                    item.formalReviewChecklist[key]
                                      ? "success"
                                      : "neutral"
                                  }
                                >
                                  {item.formalReviewChecklist[key]
                                    ? english
                                      ? "Done"
                                      : "完成"
                                    : english
                                      ? "Open"
                                      : "未完成"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(item.formalReviewDecision === "DEFERRED" ||
                              item.formalReviewDecision === "REJECTED") &&
                            item.formalPromotionReady ? (
                              <Button
                                size="sm"
                                disabled={pending || !canManagePolicies}
                                onClick={() =>
                                  runSuggestionAction(
                                    () =>
                                      queueSkillFormalReviewAction({
                                        id: item.id,
                                      }),
                                    english
                                      ? "Queued for manual confirmation"
                                      : "已加入人工确认队列",
                                  )
                                }
                              >
                                {english ? "Queue again" : "重新入队"}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title={
                          english
                            ? "No manual confirmation decision yet"
                            : "还没有人工确认决定"
                        }
                        description={
                          english
                            ? "Once a queued item is approved, deferred, or rejected, the manual decision trail will appear here."
                            : "当入队项被批准、暂缓或拒绝后，人工评审轨迹会显示在这里。"
                        }
                      />
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
                {english
                  ? "Manual confirmation queue and decision ledger stay reserved for the Helm internal operating workspace. Customer workspaces can still review reusable-practice suggestions and local policy posture here."
                  : "人工确认队列和决定台账只保留给 Helm 自留经营工作区。客户工作区仍可在这里处理可复用做法建议和本租户的策略姿态。"}
              </div>
            )}

            <Card className="workspace-panel-muted">
              <CardHeader>
                <CardTitle>
                  {english
                    ? "System-suggested policy changes"
                    : "系统最近建议调整的策略"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.strategySuggestions.length ? (
                  data.strategySuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="workspace-panel rounded-2xl px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[color:var(--foreground)]">
                              {formatSettingsSkillSuggestionText(
                                suggestion.title,
                                english,
                              )}
                            </p>
                            {suggestion.suggestedValue &&
                            suggestion.suggestedValue in actionModeLabels ? (
                              <ActionModeBadge
                                mode={
                                  suggestion.suggestedValue as keyof typeof actionModeLabels
                                }
                              />
                            ) : null}
                          </div>
                          <p className="text-sm leading-6 text-[color:var(--muted)]">
                            {formatSettingsSkillSuggestionText(
                              suggestion.reason,
                              english,
                            )}
                          </p>
                          <div className="flex flex-wrap gap-3 text-xs text-[color:var(--muted-foreground)]">
                            <span>
                              {english ? "Current value" : "当前值"}：
                              {formatSettingsSkillSuggestionText(
                                suggestion.currentValue ??
                                  (english ? "Not set" : "未设置"),
                                english,
                              )}
                            </span>
                            <span>
                              {english ? "Suggested value" : "建议值"}：
                              {formatSettingsSkillSuggestionText(
                                suggestion.suggestedValue ??
                                  (english ? "Not set" : "未设置"),
                                english,
                              )}
                            </span>
                            <span>
                              {english ? "Confidence" : "置信度"}：
                              {suggestion.confidence}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={pending || !canManagePolicies}
                            onClick={() =>
                              runSuggestionAction(
                                () =>
                                  acceptStrategySuggestionAction({
                                    id: suggestion.id,
                                  }),
                                english
                                  ? "Strategy suggestion accepted"
                                  : "已采纳策略建议",
                              )
                            }
                          >
                            {english ? "Accept" : "采纳建议"}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={pending || !canManagePolicies}
                            onClick={() =>
                              runSuggestionAction(
                                () =>
                                  dismissStrategySuggestionAction({
                                    id: suggestion.id,
                                  }),
                                english
                                  ? "Strategy suggestion dismissed"
                                  : "已忽略策略建议",
                              )
                            }
                          >
                            {english ? "Dismiss for now" : "先忽略"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title={
                      english
                        ? "No new policy suggestion recently"
                        : "系统最近没有新的策略建议"
                    }
                    description={
                      english
                        ? "When the system observes stable approval preferences, budget blockers or follow-up timing patterns, it will suggest whether to adjust policy here."
                        : "当系统观察到稳定审批偏好、预算阻塞或会后跟进规律时，会在这里提示你是否调整策略。"
                    }
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {english
                    ? "Recently adopted system-rule suggestions"
                    : "最近已收敛到系统规则的建议"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentStrategyAdoptions.length ? (
                  data.recentStrategyAdoptions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="theme-surface-panel rounded-2xl px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {formatSettingsSkillSuggestionText(
                            suggestion.title,
                            english,
                          )}
                        </p>
                        <Badge variant="approval">
                          {english ? "Adopted" : "已收敛"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                        {formatSettingsSkillSuggestionText(
                          suggestion.appliedEffectSummary ??
                            (english
                              ? "It has been adopted and is now affecting later actions of the same kind."
                              : "已被采纳并开始影响后续同类动作。"),
                          english,
                        )}
                      </p>
                      <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                        {english ? "Effective at" : "生效时间"}：
                        {formatSettingsDateLabel(
                          suggestion.appliedAt ?? suggestion.confirmedAt,
                          english,
                        )}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title={
                      english
                        ? "No adopted strategy suggestion yet"
                        : "还没有收敛完成的策略建议"
                    }
                    description={
                      english
                        ? "Once you accept system suggestions, this section will show which boundaries have turned into real rules."
                        : "当你采纳系统建议后，这里会显示哪些边界已经真正变成了规则。"
                    }
                  />
                )}
              </CardContent>
            </Card>

            {data.policies.map((policy) => {
              const guide = policyGuidesByLocale[policy.actionType];
              const defaults = policyDefaults[policy.actionType];
              const policyName = formatSettingsCommercialText(
                policy.name,
                english,
              );
              return (
                <Card key={policy.id}>
                  <CardContent className="space-y-4 py-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {policyName}
                        </p>
                        <p className="text-sm text-[color:var(--muted-foreground)]">
                          {guide.summary}
                        </p>
                      </div>
                      <ActionModeBadge mode={policy.mode} />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px_120px]">
                      <div className="theme-surface-panel rounded-2xl px-4 py-3">
                        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                          {english ? "Action type" : "动作类型"}
                        </p>
                        <p className="mt-2 text-sm font-medium text-[color:var(--foreground)]">
                          {actionTypeLabels[policy.actionType]}
                        </p>
                        <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                          {guide.example}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[color:var(--foreground)]">
                          {english ? "Default mode" : "默认行为"}
                        </label>
                        <Select
                          disabled={!canManagePolicies || pending}
                          defaultValue={policy.mode}
                          onValueChange={(value) =>
                            savePolicy(
                              policy.id,
                              {
                                mode: value as typeof policy.mode,
                                riskThreshold: policy.riskThreshold,
                                enabled: policy.enabled,
                              },
                              policy.actionType,
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(actionModeLabelsByLocale).map(
                              ([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-[color:var(--muted-foreground)]">
                          {english ? "Recommended" : "推荐"}：
                          {actionModeLabelsByLocale[defaults.mode]}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[color:var(--foreground)]">
                          {english
                            ? "Auto-execution threshold"
                            : "自动执行阈值"}
                        </label>
                        <Select
                          disabled={!canManagePolicies || pending}
                          defaultValue={policy.riskThreshold}
                          onValueChange={(value) =>
                            savePolicy(
                              policy.id,
                              {
                                mode: policy.mode,
                                riskThreshold:
                                  value as typeof policy.riskThreshold,
                                enabled: policy.enabled,
                              },
                              policy.actionType,
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(riskLabelsByLocale).map(
                              ([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-[color:var(--muted-foreground)]">
                          {english ? "Recommended" : "推荐"}：
                          {riskLabelsByLocale[defaults.riskThreshold]}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[color:var(--foreground)]">
                          {english ? "Enabled" : "启用"}
                        </label>
                        <div className="theme-surface-panel flex h-11 items-center rounded-2xl px-4">
                          <Switch
                            disabled={!canManagePolicies || pending}
                            checked={policy.enabled}
                            onCheckedChange={(checked) =>
                              savePolicy(
                                policy.id,
                                {
                                  mode: policy.mode,
                                  riskThreshold: policy.riskThreshold,
                                  enabled: checked,
                                },
                                policy.actionType,
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="workspace-panel-muted rounded-2xl px-4 py-3 text-sm text-[color:var(--foreground)]">
                      <p className="font-medium text-[color:var(--foreground)]">
                        {guide.recommended}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                        {english
                          ? `Example after taking effect: newly generated ${actionTypeLabelsByLocale[policy.actionType]} actions will follow the current policy to decide whether they need approval, while high-risk actions are still force-blocked.`
                          : `生效示例：后续新生成的 ${actionTypeLabelsByLocale[policy.actionType]} 动作会按照当前策略判断是否需要审批；高风险动作仍会被系统强制拦截。`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="budgets">
          <div className="grid gap-4 md:grid-cols-2">
            {data.budgets.length ? (
              data.budgets.map((budget) => {
                const usage = Math.round(
                  (budget.spent / budget.monthlyLimit) * 100,
                );
                return (
                  <Card key={budget.id}>
                    <CardContent className="space-y-4 py-5">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {budget.name}
                        </p>
                        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                          {budget.scope}
                        </p>
                      </div>
                      <div className="theme-surface-track rounded-full">
                        <div
                          className="h-3 rounded-full bg-[color:var(--accent)]"
                          style={{ width: `${Math.min(usage, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[color:var(--muted-foreground)]">
                          {english
                            ? `Used ${budget.spent} / ${budget.monthlyLimit}`
                            : `已使用 ${budget.spent} / ${budget.monthlyLimit}`}
                        </span>
                        <span
                          className={
                            usage >= budget.warningThreshold
                              ? "text-[color:var(--accent-danger)]"
                              : "text-[color:var(--foreground)]"
                          }
                        >
                          {usage}%
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                        {english
                          ? "Budget controls currently act as reminder and demo structure. They can later connect to real billing, budget vaults and automatic thresholds."
                          : "预算策略当前只作为提醒与演示结构，后续可接入真实支付、预算金库与自动阈值控制。"}
                      </p>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <EmptyState
                title={english ? "No budget policy yet" : "还没有预算策略"}
                description={
                  english
                    ? "Later you can extend budget and usage control by action type, team or connector."
                    : "后续可以按动作类型、团队或连接器维度扩展预算与用量控制。"
                }
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          <div className="space-y-4">
            {(() => {
              const currentMembership =
                data.memberships.find(
                  (membership) => membership.user.id === currentUserId,
                ) ?? null;

              return currentMembership ? (
                <MemberDefinitionCard
                  locale={locale}
                  workspace={{
                    name:
                      data.workspace?.name ??
                      (english ? "Current workspace" : "当前工作区"),
                    profileType: data.workspace?.profileType ?? null,
                    focusAreas: data.workspace?.focusAreas ?? null,
                  }}
                  currentMembership={currentMembership}
                />
              ) : null;
            })()}
            <TeamPermissionsCard
              activeMembershipRole={data.organizationSummary.activeMembershipRole}
              activeOwnerCount={activeOwnerCount}
              addMember={addMember}
              canManageConnectors={canManageConnectors}
              canManageMembers={canManageMembers}
              dingtalkDirectoryInviteDryRun={data.dingtalkDirectoryInviteDryRun}
              currentUserId={currentUserId}
              english={english}
              inviteGuidance={inviteGuidance}
              inviteSelectedDingTalkDirectoryUsers={
                inviteSelectedDingTalkDirectoryUsers
              }
              dingtalkInvitePending={dingtalkInvitePending}
              memberDraft={memberDraft}
              memberships={data.memberships}
              pending={pending}
              roleLabelsByLocale={roleLabelsByLocale}
              rolePresetOptions={rolePresetOptions}
              seatSummary={data.seatSummary}
              setMemberDraft={setMemberDraft}
              transferOwnership={transferOwnership}
              updateMemberGoalProfile={updateMemberGoalProfile}
              updateMemberGroupTag={updateMemberGroupTag}
              updateMemberLifecycle={updateMemberLifecycle}
              updateMemberRole={updateMemberRole}
            />
            <PermissionsRoleGuideCard english={english} />
            <RecentOrgAdminAudit
              canReadOrganizationAudit={canReadOrganizationAudit}
              english={english}
              organizationAudit={data.organizationAudit}
            />
            <OrgAdminGovernanceSupportPack
              capabilities={orgAdminGovernanceCapabilities}
              currentAuthSessionId={
                data.organizationSummary.currentAuthSessionId
              }
              english={english}
              organizationGovernance={data.organizationGovernance}
              pending={pending}
              revokeAuthSession={revokeAuthSession}
              revokeAuthSessionsByScope={revokeAuthSessionsByScope}
              rotateCurrentAuthSession={rotateCurrentAuthSession}
            />
          </div>
        </TabsContent>

        <PilotSettingsTab
          canManageOperationalControls={canManageOperationalControls}
          english={english}
          pending={pending}
          pilotDraft={pilotDraft}
          pilotMessages={messages.settings.pilot}
          saveOperationalControls={saveOperationalControls}
          setPilotDraft={setPilotDraft}
        />
      </Tabs>
    </div>
  );
}
