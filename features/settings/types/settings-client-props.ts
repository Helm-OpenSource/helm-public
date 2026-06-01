import type {
  AccessState,
  CustomEngagementStatus,
  CustomEngagementType,
  ImportSourceStatus,
  ImportSourceType,
  MembershipStatus,
  PartnerProgramStatus,
  PaymentProvider,
  ParticipantPortalAccessStatus,
  PayoutProfileStatus,
  ProgramApplicationStatus,
  ProgramTermsVersionStatus,
  PublisherProfileStatus,
  RevenueBeneficiaryType,
  RevenueLedgerStatus,
  RevenueRuleCadence,
  RevenueRuleStatus,
  RevenueRuleValueType,
  RevenueSourceType,
  SalesReferralStatus,
  SettlementBatchStatus,
  SettlementLineStatus,
  WorkspaceRole,
  WorkerEntitlementStatus,
  WorkerEntitlementType,
} from "@prisma/client";
import type {
  BillingPortalMode,
  CheckoutMode,
  PaymentCallbackMode,
  PaymentIntegrationStage,
  PaymentLifecycleMappingMode,
  PaymentLifecycleSource,
  PaymentRegion,
} from "@/lib/billing/payment-providers";
import type {
  FormalReviewChecklistState,
  OrganizationGovernanceAuditMarker,
  OrganizationIdentityMatchMarker,
  OrganizationWebhookCallbackMarker,
} from "./settings-types";
import type { CapabilityDecisionOperatorReadout } from "@/lib/capability-decision-trace";
import type { TenantResourceEvidenceDetail } from "@/lib/tenant-resources/evidence-detail";
import type {
  TenantResourceGuardedWriteEvaluation,
} from "@/lib/tenant-resources/guarded-write-evaluation";
import type { TenantResourceGuardedWritePilotReadout } from "@/lib/tenant-resources/guarded-write-pilot";
import type { TenantResourcePolicyReadout } from "@/lib/tenant-resources/policy-readout";
import type { TenantResourceReadinessSummary } from "@/lib/tenant-resources/readiness";

type SettingsActionMode = keyof typeof import("@/data/constants").actionModeLabels;
type SettingsActionType = keyof typeof import("@/data/constants").actionTypeLabels;
type SettingsRiskThreshold = keyof typeof import("@/data/constants").riskLabels;
type SettingsRole = keyof typeof import("@/data/constants").roleLabels;

export type SettingsClientProps = {
  data: {
    workspace: {
      id: string;
      name: string;
      status?: string | null;
      description: string | null;
      profileType: string | null;
      connectedSources: string | null;
      focusAreas: string | null;
      defaultStrategies: string | null;
      defaultLLMProvider?: string | null;
      defaultLLMModel?: string | null;
      extractionModel?: string | null;
      briefingModel?: string | null;
      reasoningModel?: string | null;
      llmEnabled?: boolean | null;
      defaultLocale?: string | null;
      pilotMode?: boolean | null;
      captureConsentRequired?: boolean | null;
      dataRetentionDays?: number | null;
      featureFlagsJson?: string | null;
      billingAccount?: {
        currentPlan: string;
        currency: string;
        baseFeeCents: number;
        activeSeatPriceCents: number;
        includedAdminSeats: number;
      } | null;
      trialState?: {
        trialStartedAt: Date;
        trialEndsAt: Date;
        graceEndsAt: Date;
        status: AccessState;
      } | null;
    } | null;
    policies: Array<{
      id: string;
      name: string;
      actionType: SettingsActionType;
      mode: SettingsActionMode;
      riskThreshold: SettingsRiskThreshold;
      enabled: boolean;
      appliesTo: string | null;
      description: string | null;
    }>;
    budgets: Array<{
      id: string;
      name: string;
      scope: string;
      monthlyLimit: number;
      spent: number;
      warningThreshold: number;
    }>;
    memberships: Array<{
      id: string;
      role: SettingsRole;
      status: MembershipStatus;
      joinedAt: Date;
      title: string | null;
      goalTitle: string | null;
      goalDescription: string | null;
      goalItemsJson: string | null;
      jobResponsibilities: string | null;
      persona: string | null;
      rolePresetKey: string | null;
      definitionDraftJson: string | null;
      definitionAcceptedJson: string | null;
      user: { id: string; name: string; email: string };
    }>;
    organizations: Array<{
      workspaceId: string;
      name: string;
      slug: string;
      role: SettingsRole;
      membershipStatus: MembershipStatus;
      workspaceStatus: string;
      accessState: AccessState;
      memberCount: number;
    }>;
    organizationSummary: {
      activeWorkspaceId: string;
      currentAuthSessionId: string | null;
      currentUserId: string;
      activeMembershipRole: WorkspaceRole;
      canManageMembers: boolean;
      canManageBilling: boolean;
      canManageContributionRegistry: boolean;
      canManageManualSettlement: boolean;
      canManageParticipantPortal: boolean;
      canManagePolicies: boolean;
      canManageWorkspaceSetup: boolean;
      canManageOperationalControls: boolean;
      canManageProgramApplications: boolean;
      canManageConnectors: boolean;
      canManageImports: boolean;
      canResolveImportConflicts: boolean;
      canManageGovernedActions: boolean;
      canReviewGovernedActions: boolean;
      canManageInsights: boolean;
      canManageWorkspaceRecords: boolean;
      canManageInternalActions: boolean;
      canReadOrganizationAudit: boolean;
      canExportOrganizationSupportPack: boolean;
      activeOwnerCount: number;
      reservedWorkspace: boolean;
      reservedCommercialReadable: boolean;
      reservedFormalSkillGovernanceReadable: boolean;
      contributionRegistryReadable: boolean;
      activeSeatCount: number;
      invitedSeatCount: number;
      inactiveSeatCount: number;
      currentState: AccessState;
      workspaceStatus: string;
      selfServeTrialWorkspace: boolean;
    };
    organizationAudit: Array<{
      id: string;
      actor: string;
      actionType: string;
      summary: string;
      targetType: string;
      targetId: string;
      createdAt: Date;
      payload: unknown;
    }>;
    dingtalkDirectoryInviteDryRun?: {
      recordedAt: Date;
      processed: number;
      createdUsers: number;
      reusedUsers: number;
      upsertedMemberships: number;
      sentMessages: number;
      skipped: number;
      skippedNoMobile: number;
      nameCollisionResolved: number;
      errors: string[];
      details: Array<{
        dingtalkUserId: string;
        unionId: string | null;
        name: string;
        mobile: string | null;
        normalizedPhone: string | null;
        title: string | null;
        jobNumber: string | null;
        deptIds: number[];
        isLeader: boolean;
        placeholderEmail: string | null;
        userResolution:
          | "REUSED_BY_PHONE"
          | "REUSED_BY_PLACEHOLDER_EMAIL"
          | "CREATED_PLACEHOLDER_EMAIL"
          | "UNRESOLVED";
        membershipStatus:
          | "ACTIVE_KEPT"
          | "INVITED_UPSERTED"
          | "DRY_RUN_SIMULATED"
          | "SKIPPED";
        messageStatus: "SENT" | "DRY_RUN_SIMULATED" | "FAILED" | "SKIPPED";
        note: string | null;
      }>;
    } | null;
    organizationGovernance: {
      workspace: {
        id: string;
        name: string;
        slug: string;
        status: string;
        defaultLocale: string | null;
        pilotMode: boolean | null;
        captureConsentRequired: boolean | null;
        dataRetentionDays: number | null;
        featureFlagCount: number;
        updatedAt: Date;
      };
      membershipSummary: {
        activeSeatCount: number;
        invitedSeatCount: number;
        inactiveSeatCount: number;
        ownerCount: number;
        billingAdminCount: number;
        adminCount: number;
        operationalReviewerCount: number;
      };
      authSessionSummary: {
        activeSessionCount: number;
        expiringSoonSessionCount: number;
        staleActiveSessionCount: number;
        legacyProviderSessionCount: number;
        missingSourcePageSessionCount: number;
        missingWorkspaceSwitchMarkerSessionCount: number;
        providerSourceMismatchSessionCount: number;
        workspaceMembershipMismatchSessionCount: number;
        rotatedSessionCount30d: number;
        realignedSessionCount30d: number;
        scopeRevokeActionCount30d: number;
        scopeRevokedSessionCount30d: number;
        revokeScopeSummary30d: Array<{
          scope:
            | "STALE_ACTIVE"
            | "LEGACY_PROVIDER"
            | "MISSING_SOURCE_PAGE"
            | "MISSING_WORKSPACE_SWITCH_MARKER"
            | "PROVIDER_SOURCE_MISMATCH"
            | "WORKSPACE_MEMBERSHIP_MISMATCH"
            | "OTHER_ACTIVE";
          actionCount: number;
          revokedSessionCount: number;
        }>;
        liveRevokeScopeSummary: Array<{
          scope:
            | "STALE_ACTIVE"
            | "LEGACY_PROVIDER"
            | "MISSING_SOURCE_PAGE"
            | "MISSING_WORKSPACE_SWITCH_MARKER"
            | "PROVIDER_SOURCE_MISMATCH"
            | "WORKSPACE_MEMBERSHIP_MISMATCH"
            | "OTHER_ACTIVE";
          eligibleSessionCount: number;
          currentSessionProtected: boolean;
        }>;
        anomalyInventorySummary: Array<{
          scope:
            | "EXPIRING_SOON"
            | "STALE_ACTIVE"
            | "LEGACY_PROVIDER"
            | "MISSING_SOURCE_PAGE"
            | "MISSING_WORKSPACE_SWITCH_MARKER"
            | "PROVIDER_SOURCE_MISMATCH"
            | "WORKSPACE_MEMBERSHIP_MISMATCH";
          activeSessionCount: number;
          managementMode: "REVIEW_ONLY" | "BULK_REVOKE";
          revocableSessionCount: number;
          currentSessionProtected: boolean;
          latestDetectedAt: Date | null;
        }>;
        previewVsExecutedScopeSummary: Array<{
          scope:
            | "STALE_ACTIVE"
            | "LEGACY_PROVIDER"
            | "MISSING_SOURCE_PAGE"
            | "MISSING_WORKSPACE_SWITCH_MARKER"
            | "PROVIDER_SOURCE_MISMATCH"
            | "WORKSPACE_MEMBERSHIP_MISMATCH"
            | "OTHER_ACTIVE";
          liveEligibleSessionCount: number;
          currentSessionProtected: boolean;
          lastExecutedAt: Date | null;
          lastExecutedEligibleSessionCount: number | null;
          lastExecutedRevokedSessionCount: number | null;
          lastExecutionShortfallCount: number | null;
          previewEligibleDeltaCount: number | null;
        }>;
        revokeConsistencySummary: Array<{
          scope:
            | "STALE_ACTIVE"
            | "LEGACY_PROVIDER"
            | "MISSING_SOURCE_PAGE"
            | "MISSING_WORKSPACE_SWITCH_MARKER"
            | "PROVIDER_SOURCE_MISMATCH"
            | "WORKSPACE_MEMBERSHIP_MISMATCH"
            | "OTHER_ACTIVE";
          status: "CLEAR" | "REVIEW_ONLY" | "REVOCABLE" | "DRIFT";
          liveEligibleSessionCount: number;
          currentSessionProtected: boolean;
          lastExecutedAt: Date | null;
          previewEligibleDeltaCount: number | null;
          lastExecutionShortfallCount: number | null;
        }>;
        currentSessionReviewScopeSummary: Array<
          | "STALE_ACTIVE"
          | "LEGACY_PROVIDER"
          | "MISSING_SOURCE_PAGE"
          | "MISSING_WORKSPACE_SWITCH_MARKER"
          | "PROVIDER_SOURCE_MISMATCH"
          | "WORKSPACE_MEMBERSHIP_MISMATCH"
          | "OTHER_ACTIVE"
        >;
        authControlConsistencyOverview: {
          consistencyStatus: "CLEAR" | "REVIEW_ONLY" | "ACTIONABLE" | "DRIFT";
          followThroughStatus: "CLEAR" | "PENDING" | "CURRENT" | "STALE";
          reviewOnlyScopeCount: number;
          bulkRevocableScopeCount: number;
          driftScopeCount: number;
          currentSessionProtectedScopeCount: number;
          latestDetectedAt: Date | null;
          latestMarkerScopeCount: number;
          latestFollowThroughActionType: string | null;
          latestFollowThroughRecordedAt: Date | null;
          latestFollowThroughSourcePage: string | null;
        };
        latestAnomalyFollowThroughSummary: {
          status: "CLEAR" | "REVIEW_ONLY" | "ACTIONABLE" | "DRIFT";
          followThroughStatus: "CLEAR" | "PENDING" | "CURRENT" | "STALE";
          reviewOnlyScopeCount: number;
          bulkRevocableScopeCount: number;
          driftScopeCount: number;
          currentSessionProtectedScopeCount: number;
          latestMarkerRecordedAt: Date | null;
          latestMarkerScopeCount: number;
          latestFollowThroughActionType: string | null;
          latestFollowThroughRecordedAt: Date | null;
          latestFollowThroughSourcePage: string | null;
        };
        latestMarkerCoverageSummary: {
          status: "CLEAR" | "REVIEW_ONLY" | "ACTIONABLE" | "DRIFT";
          followThroughStatus: "CLEAR" | "PENDING" | "CURRENT" | "STALE";
          stillDetectedScopeCount: number;
          resolvedScopeCount: number;
          newlyDetectedScopeCount: number;
          reviewOnlyScopeCount: number;
          bulkRevocableScopeCount: number;
          driftScopeCount: number;
          currentSessionProtectedScopeCount: number;
          latestMarkerRecordedAt: Date | null;
          latestMarkerScopeCount: number;
          latestFollowThroughActionType: string | null;
          latestFollowThroughRecordedAt: Date | null;
          latestFollowThroughSourcePage: string | null;
        };
        revokeExecutionAggregateSummary: {
          status: "CLEAR" | "REVIEW_ONLY" | "ACTIONABLE" | "DRIFT";
          liveEligibleSessionCount: number;
          lastExecutedEligibleSessionCount: number;
          lastExecutedRevokedSessionCount: number;
          executionShortfallCount: number;
          previewEligibleDeltaCount: number;
          reviewOnlyScopeCount: number;
          bulkRevocableScopeCount: number;
          driftScopeCount: number;
          currentSessionProtectedScopeCount: number;
          latestExecutedAt: Date | null;
        };
        latestAnomalyMarker: {
          recordedAt: Date;
          sessionId: string;
          activeWorkspaceId: string | null;
          sourcePage: string | null;
          providerType: string | null;
          user: {
            id: string;
            name: string;
            email: string;
          };
          anomalyScopes: Array<
            | "EXPIRING_SOON"
            | "STALE_ACTIVE"
            | "LEGACY_PROVIDER"
            | "MISSING_SOURCE_PAGE"
            | "MISSING_WORKSPACE_SWITCH_MARKER"
            | "PROVIDER_SOURCE_MISMATCH"
            | "WORKSPACE_MEMBERSHIP_MISMATCH"
          >;
        } | null;
        recentActiveSessions: Array<{
          id: string;
          user: {
            id: string;
            name: string;
            email: string;
          };
          sourcePage: string | null;
          providerType: string | null;
          createdAt: Date;
          lastSeenAt: Date;
          lastWorkspaceSwitchAt: Date | null;
          expiresAt: Date;
          isExpiringSoon: boolean;
          isStale: boolean;
          isLegacyProvider: boolean;
          isMissingSourcePage: boolean;
          hasMissingWorkspaceSwitchMarker: boolean;
          hasProviderSourceMismatch: boolean;
          hasWorkspaceMembershipMismatch: boolean;
        }>;
      };
      dataGovernanceSummary: {
        orgAdminAuditCount30d: number;
        dataGovernanceAuditCount30d: number;
        membershipActionCount30d: number;
        workspaceGovernanceActionCount30d: number;
        workspaceDataActionCount30d: number;
        internalActionCount30d: number;
        insightGovernanceActionCount30d: number;
        memoryExportCount30d: number;
        memoryMutationCount30d: number;
        authSessionEventCount30d: number;
        supportPackExportCount30d: number;
        exportActionCount30d: number;
        deleteActionCount30d: number;
        retentionUpdateCount30d: number;
        billingActionCount30d: number;
        billingWebhookResolutionCount30d: number;
        billingWebhookHintFallbackCount30d: number;
        billingWebhookHintMismatchCount30d: number;
        billingWebhookDuplicateChainCount30d: number;
        billingWebhookVerificationFailureHintCount30d: number;
        billingWebhookUnresolvedHintCount30d: number;
        billingWebhookMappedExceptionCount30d: number;
        contributionRegistryActionCount30d: number;
        participantPortalActionCount30d: number;
        programActionCount30d: number;
        settlementActionCount30d: number;
        settlementBatchExportCount30d: number;
        connectorActionCount30d: number;
        connectorConnectionCount30d: number;
        connectorSyncCount30d: number;
        connectorDisconnectCount30d: number;
        importActionCount30d: number;
        csvImportCount30d: number;
        crmImportCount30d: number;
        importWarmupCount30d: number;
        importConflictResolutionCount30d: number;
        importSourceConnectionCount30d: number;
        importSourceDisconnectCount30d: number;
        identityMatchWriteCount30d: number;
        identityMatchNeedsReviewCount30d: number;
        actionGovernanceActionCount30d: number;
        softDeletedMemoryEntryCount: number;
        invalidMemoryFactCount: number;
      };
      governanceFollowThrough: {
        latestMembershipAudit: OrganizationGovernanceAuditMarker;
        latestWorkspaceGovernanceAudit: OrganizationGovernanceAuditMarker;
        latestWorkspaceDataAudit: OrganizationGovernanceAuditMarker;
        latestInternalActionAudit: OrganizationGovernanceAuditMarker;
        latestInsightGovernanceAudit: OrganizationGovernanceAuditMarker;
        latestAuthSessionAudit: OrganizationGovernanceAuditMarker;
        latestSupportPackAudit: OrganizationGovernanceAuditMarker;
        latestExportAudit: OrganizationGovernanceAuditMarker;
        latestDeleteAudit: OrganizationGovernanceAuditMarker;
        latestRetentionAudit: OrganizationGovernanceAuditMarker;
        latestBillingAudit: OrganizationGovernanceAuditMarker;
        latestBillingWebhookGovernanceAudit: OrganizationGovernanceAuditMarker;
        latestBillingWebhookHintFallback: OrganizationWebhookCallbackMarker;
        latestBillingWebhookHintMismatch: OrganizationWebhookCallbackMarker;
        latestBillingWebhookDuplicateCallback: OrganizationWebhookCallbackMarker;
        latestBillingWebhookVerificationFailureHint: OrganizationWebhookCallbackMarker;
        latestBillingWebhookUnresolvedHint: OrganizationWebhookCallbackMarker;
        latestBillingWebhookMappedException: OrganizationWebhookCallbackMarker;
        latestContributionRegistryAudit: OrganizationGovernanceAuditMarker;
        latestParticipantPortalAudit: OrganizationGovernanceAuditMarker;
        latestProgramAudit: OrganizationGovernanceAuditMarker;
        latestSettlementAudit: OrganizationGovernanceAuditMarker;
        latestConnectorAudit: OrganizationGovernanceAuditMarker;
        latestImportAudit: OrganizationGovernanceAuditMarker;
        latestConflictResolutionAudit: OrganizationGovernanceAuditMarker;
        latestIdentityMatch: OrganizationIdentityMatchMarker;
        latestScopedSessionRevokeAudit: OrganizationGovernanceAuditMarker;
        latestWorkspaceRealignmentAudit: OrganizationGovernanceAuditMarker;
        latestAuthSessionAnomalyFollowThroughAudit: OrganizationGovernanceAuditMarker;
        latestActionGovernanceAudit: OrganizationGovernanceAuditMarker;
      };
      dataGovernanceClosure: {
        exportScopedToWorkspace: boolean;
        deleteScopedToWorkspace: boolean;
        retentionScopedToWorkspace: boolean;
        supportPackScopedToWorkspace: boolean;
        sensitiveWriteTenantOwnershipGuarded: boolean;
        latestExportOwner: string | null;
        latestDeleteOwner: string | null;
        latestRetentionOwner: string | null;
        latestSupportPackOwner: string | null;
        latestExportSourcePage: string | null;
        latestDeleteSourcePage: string | null;
        latestRetentionSourcePage: string | null;
        latestSupportPackSourcePage: string | null;
      };
      workspaceIsolationAssertions: {
        memoryExportScopedToWorkspace: boolean;
        supportPackExportScopedToWorkspace: boolean;
        deleteActionsScopedToWorkspace: boolean;
        retentionControlsScopedToWorkspace: boolean;
        sensitiveWriteRoutesRequireTenantOwnership: boolean;
        billingWebhookTenantMappingScopedToWorkspace: boolean;
        unresolvedWebhookCallbacksRemainOutsideWorkspaceAudit: boolean;
      };
      recentOrgAdminAudit: Array<{
        id: string;
        actor: string;
        actionType: string;
        summary: string;
        targetType: string;
        targetId: string;
        createdAt: Date;
        payload: unknown;
        sourcePage: string | null;
      }>;
      recentDataGovernanceAudit: Array<{
        id: string;
        actor: string;
        actionType: string;
        summary: string;
        targetType: string;
        targetId: string;
        createdAt: Date;
        payload: unknown;
        sourcePage: string | null;
      }>;
      boundaryNotes: string[];
    } | null;
    lifecycleBoundarySummary: {
      note: string;
      stillAvailable: string[];
      pausedHighCostProcessing: string[];
      scopeNote: string;
    };
    chinaRenewRestoreSummary: {
      intent: "PURCHASE" | "RENEW" | "RESTORE" | "REACTIVATE" | "HOLD";
      currentAction: string;
      whyThisState: string;
      refreshPath: string;
      currentBoundary: string;
      noPortalNote: string;
    } | null;
    billingOverview: {
      currentPlan: string;
      currency: string;
      baseFeeCents: number;
      activeSeatPriceCents: number;
      includedAdminSeats: number;
      trialStartedAt: Date | null;
      trialEndsAt: Date | null;
      graceEndsAt: Date | null;
      currentState: AccessState;
      activeSeatCount: number;
      trialCollaboratorSeats: number;
      additionalBillableSeats: number;
      paymentConfigured: boolean;
      paymentProvider: PaymentProvider;
      paymentRegion: PaymentRegion;
      checkoutMode: CheckoutMode;
      billingPortalMode: BillingPortalMode;
      callbackMode: PaymentCallbackMode;
      lifecycleMappingMode: PaymentLifecycleMappingMode;
      lifecycleSource: PaymentLifecycleSource;
      paymentRailStage: PaymentIntegrationStage;
      lifecycleSourceConnected: boolean;
      availableProviders: PaymentProvider[];
      providerOptions: Array<{
        provider: PaymentProvider;
        checkoutMode: CheckoutMode;
        integrationStage: PaymentIntegrationStage;
        checkoutReady: boolean;
        lifecycleSourceConnected: boolean;
        current: boolean;
      }>;
      paymentCustomerId: string | null;
      paymentSubscriptionId: string | null;
      paymentSubscriptionStatus: string | null;
      paymentCheckoutCompletedAt: Date | null;
      billingPeriodEndsAt: Date | null;
      lastPaymentSyncAt: Date | null;
      checkoutReady: boolean;
      portalReady: boolean;
      refreshReady: boolean;
    };
    seatSummary: {
      activeSeatCount: number;
      invitedSeatCount: number;
      inactiveSeatCount: number;
      includedAdminSeats: number;
      paidIncludedSeatCount: number;
      paidIncludedSeatUsage: number;
      additionalBillableSeats: number;
      trialCollaboratorSeats: number;
      trialCollaboratorSeatsUsed: number;
      trialCollaboratorSeatsRemaining: number;
      trialSeatCapacity: number;
      trialSeatPressureCount: number;
    };
    workerEntitlements: Array<{
      id: string;
      workerKey: string;
      entitlementType: WorkerEntitlementType;
      status: WorkerEntitlementStatus;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      internalLimit: number | null;
    }>;
    workerEntitlementSummary: {
      includedActiveCount: number;
      addOnMonthlyActiveCount: number;
      addOnPerUseActiveCount: number;
      addOnMonthlyReservedCount: number;
      addOnPerUseReservedCount: number;
      commercialActiveCount: number;
      commercialPathCount: number;
      inactiveEntitlementCount: number;
      futureAddOnReservedCount: number;
      internalLimitCount: number;
      windowedEntitlementCount: number;
    };
    workerCommercialOverview: Array<{
      id: string;
      workerKey: string;
      entitlementType: WorkerEntitlementType;
      status: WorkerEntitlementStatus;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      internalLimit: number | null;
      label: { zh: string; en: string };
      description: { zh: string; en: string };
      commercialMode: { zh: string; en: string };
      commercialTruth: { zh: string; en: string };
      usagePath: { zh: string; en: string };
      futurePath: { zh: string; en: string };
      isIncludedCore: boolean;
      isReservedFuturePath: boolean;
      isCommercialActive: boolean;
      railFamily: "INCLUDED" | "MONTHLY" | "PER_USE";
    }>;
    usageSummary: Array<{
      usageType: string;
      quantity: number;
    }>;
    internalUsageOverview: {
      totalUsageCount: number;
      highCostProcessingCount: number;
      exportCount: number;
      syncCount: number;
      premiumWorkerCount: number;
    };
    workerPublisherProfiles: Array<{
      id: string;
      publisherKey: string;
      displayName: string;
      contactEmail: string | null;
      status: PublisherProfileStatus;
      notes: string | null;
      createdAt: Date;
    }>;
    salesReferrals: Array<{
      id: string;
      referralKey: string;
      beneficiaryLabel: string;
      beneficiaryContact: string | null;
      status: SalesReferralStatus;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      notes: string | null;
      createdAt: Date;
    }>;
    customEngagements: Array<{
      id: string;
      engagementKey: string;
      engagementType: CustomEngagementType;
      label: string;
      beneficiaryLabel: string;
      contractValueCents: number | null;
      currency: string;
      status: CustomEngagementStatus;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      notes: string | null;
      createdAt: Date;
    }>;
    revenueRules: Array<{
      id: string;
      ruleKey: string;
      name: string;
      sourceType: RevenueSourceType;
      beneficiaryType: RevenueBeneficiaryType;
      beneficiaryLabel: string;
      cadence: RevenueRuleCadence;
      valueType: RevenueRuleValueType;
      percentBps: number | null;
      fixedAmountCents: number | null;
      currency: string;
      reverseOnCancel: boolean;
      workerKey: string | null;
      notes: string | null;
      status: RevenueRuleStatus;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      workerPublisherProfileId: string | null;
      salesReferralId: string | null;
      customEngagementId: string | null;
    }>;
    revenueRuleSummary: {
      totalRuleCount: number;
      recurringRuleCount: number;
      oneTimeRuleCount: number;
      percentRuleCount: number;
      fixedAmountRuleCount: number;
      reversalBackedRuleCount: number;
      sourceTypeCount: number;
    };
    revenueAttributionEntries: Array<{
      id: string;
      sourceType: RevenueSourceType;
      beneficiaryType: RevenueBeneficiaryType;
      sourceLabel: string;
      sourceReference: string | null;
      beneficiaryLabel: string;
      grossAmountCents: number;
      attributedAmountCents: number;
      currency: string;
      status: RevenueLedgerStatus;
      recognizedAt: Date;
      reversalReason: string | null;
      revenueRuleId: string | null;
      ruleKey: string | null;
      ruleName: string | null;
      ruleCadence: RevenueRuleCadence | null;
      ruleValueType: RevenueRuleValueType | null;
      ruleReverseOnCancel: boolean | null;
      workerPublisherProfileId: string | null;
      salesReferralId: string | null;
      customEngagementId: string | null;
    }>;
    payoutEntries: Array<{
      id: string;
      beneficiaryType: RevenueBeneficiaryType;
      beneficiaryLabel: string;
      payableAmountCents: number;
      currency: string;
      status: RevenueLedgerStatus;
      payableAfter: Date | null;
      approvedAt: Date | null;
      paidAt: Date | null;
      reversedAt: Date | null;
      notes: string | null;
      revenueAttributionLedgerId: string;
      sourceType: RevenueSourceType;
      revenueRuleId: string | null;
      ruleKey: string | null;
      ruleCadence: RevenueRuleCadence | null;
      ruleReverseOnCancel: boolean | null;
      workerPublisherProfileId: string | null;
      salesReferralId: string | null;
      customEngagementId: string | null;
    }>;
    revenueAttributionSummary: {
      sourceTypeCount: number;
      beneficiaryPendingAmountCents: number;
      pendingCount: number;
      approvedCount: number;
      paidCount: number;
      reversedCount: number;
      pendingPayableAmountCents: number;
      approvedPayableAmountCents: number;
      paidPayableAmountCents: number;
      reversedPayableAmountCents: number;
    };
    beneficiaryPayoutProfiles: Array<{
      id: string;
      beneficiaryType: RevenueBeneficiaryType;
      beneficiaryReference: string;
      displayName: string;
      legalName: string | null;
      contact: string | null;
      payoutMethodLabel: string;
      payoutDetailsReference: string | null;
      invoiceRequired: boolean;
      status: PayoutProfileStatus;
      notes: string | null;
      workerPublisherProfileId: string | null;
      salesReferralId: string | null;
      customEngagementId: string | null;
      createdAt: Date;
    }>;
    participantPortalAccesses: Array<{
      id: string;
      beneficiaryType: RevenueBeneficiaryType;
      beneficiaryReference: string;
      inviteEmail: string;
      displayName: string;
      contact: string | null;
      status: ParticipantPortalAccessStatus;
      termsAcceptedAt: Date | null;
      lastInviteIssuedAt: Date;
      activatedAt: Date | null;
      suspendedAt: Date | null;
      archivedAt: Date | null;
      notes: string | null;
      workerPublisherProfileId: string | null;
      salesReferralId: string | null;
      customEngagementId: string | null;
      user: { id: string; name: string; email: string } | null;
    }>;
    partnerPrograms: Array<{
      id: string;
      programKey: string;
      slug: string;
      title: string;
      summary: string;
      status: PartnerProgramStatus;
      programType: string;
      beneficiaryType: RevenueBeneficiaryType;
      audienceSummary: string;
      contributionSummary: string;
      revenueSummary: string;
      settlementSummary: string;
      boundarySummary: string;
      applicationCount: number;
      activeTermsVersion: {
        id: string;
        versionKey: string;
        title: string;
        effectiveFrom: Date;
        publishedAt: Date | null;
        status: ProgramTermsVersionStatus;
      } | null;
    }>;
    programApplications: Array<{
      id: string;
      applicantName: string;
      applicantEmail: string;
      applicantOrganization: string | null;
      roleTitle: string | null;
      website: string | null;
      regionLabel: string | null;
      background: string | null;
      contributionPlan: string | null;
      status: ProgramApplicationStatus;
      termsAcceptedAt: Date;
      internalNotes: string | null;
      recommendedBeneficiaryType: ProgramApplicationBeneficiaryType | null;
      reviewedAt: Date | null;
      invitedAt: Date | null;
      createdAt: Date;
      workerPublisherProfileId: string | null;
      salesReferralId: string | null;
      customEngagementId: string | null;
      partnerProgram: {
        id: string;
        programKey: string;
        slug: string;
        title: string;
      };
      programTermsVersion: {
        id: string;
        versionKey: string;
        title: string;
      };
      reviewedByUser: {
        id: string;
        name: string;
        email: string;
      } | null;
      participantPortalAccess: {
        id: string;
        status: ParticipantPortalAccessStatus;
        inviteEmail: string;
        lastInviteIssuedAt: Date;
        user: { id: string; name: string; email: string } | null;
      } | null;
      linkedBeneficiary: {
        type: ProgramApplicationBeneficiaryType;
        id: string;
        label: string;
        reference: string;
      } | null;
    }>;
    programApplicationSummary: {
      totalCount: number;
      submittedCount: number;
      acceptedCount: number;
      rejectedCount: number;
      waitlistedCount: number;
      invitedCount: number;
      readyForInviteCount: number;
    };
    settlementBatches: Array<{
      id: string;
      batchKey: string;
      periodLabel: string;
      periodStart: Date;
      periodEnd: Date;
      currency: string;
      status: SettlementBatchStatus;
      notes: string | null;
      approvedAt: Date | null;
      exportedAt: Date | null;
      closedAt: Date | null;
      lineCount: number;
      totalAmountCents: number;
    }>;
    currentSettlementBatch: {
      id: string;
      batchKey: string;
      periodLabel: string;
      periodStart: Date;
      periodEnd: Date;
      currency: string;
      status: SettlementBatchStatus;
      notes: string | null;
      approvedAt: Date | null;
      exportedAt: Date | null;
      closedAt: Date | null;
      lines: Array<{
        id: string;
        payoutLedgerId: string;
        revenueAttributionLedgerId: string;
        beneficiaryType: RevenueBeneficiaryType;
        beneficiaryLabel: string;
        sourceType: RevenueSourceType;
        amountCents: number;
        currency: string;
        status: SettlementLineStatus;
        notes: string | null;
        reference: string | null;
        approvedAt: Date | null;
        exportedAt: Date | null;
        paidAt: Date | null;
        reversedAt: Date | null;
        beneficiaryPayoutProfileId: string | null;
        payoutProfileRequired: boolean;
        payoutProfile: {
          id: string;
          displayName: string;
          status: PayoutProfileStatus;
        } | null;
      }>;
    } | null;
    settlementSummary: {
      totalLineCount: number;
      beneficiaryCount: number;
      sourceTypeCount: number;
      pendingCount: number;
      approvedCount: number;
      exportedCount: number;
      paidCount: number;
      reversedCount: number;
      pendingAmountCents: number;
      approvedAmountCents: number;
      exportedAmountCents: number;
      paidAmountCents: number;
      reversedAmountCents: number;
      missingProfileCount: number;
    };
    payoutRailReadiness: {
      status: "NOT_READY" | "CONDITIONAL_GO" | "READY_FOR_NARROW_PILOT";
      activePayoutProfileCount: number;
      settlementBatchCount: number;
      exportedBatchCount: number;
      closedBatchCount: number;
      exportedOrClosedBatchCount: number;
      manualCompletionCount: number;
      paidWithoutExportCount: number;
      reversalCount: number;
      invitedParticipantCount: number;
      activeParticipantCount: number;
      invitedOrActiveParticipantCount: number;
      currentBatchLineCount: number;
      currentBatchMissingProfileCount: number;
      blockers: Array<
        | "NO_ACTIVE_PAYOUT_PROFILES"
        | "NO_SETTLEMENT_BATCH_HISTORY"
        | "NO_EXPORTED_OR_CLOSED_BATCH_HISTORY"
        | "CURRENT_BATCH_MISSING_PAYOUT_PROFILES"
      >;
      watchpoints: Array<
        | "NO_MANUAL_COMPLETION_EVIDENCE"
        | "NO_INVITED_OR_ACTIVE_PARTICIPANTS"
        | "NO_REVERSAL_EVIDENCE"
        | "PAID_WITHOUT_EXPORT_ANOMALIES"
      >;
    };
    payoutRailPilotCohort: {
      status: "HOLD_MANUAL" | "READY_TO_SELECT_COHORT" | "READY_FOR_OPERATOR_DRY_RUN";
      eligibleCohortCount: number;
      readyCohortCount: number;
      recommendedBeneficiaryType: RevenueBeneficiaryType | null;
      recommendedPayoutMethodLabel: string | null;
      recommendedCurrency: string | null;
      candidateCohorts: Array<{
        beneficiaryType: RevenueBeneficiaryType;
        beneficiaryCount: number;
        payoutEntryCount: number;
        coveredByActivePayoutProfileCount: number;
        missingPayoutProfileCount: number;
        coveredByParticipantAccessCount: number;
        missingParticipantAccessCount: number;
        payoutMethodLabels: string[];
        currencyLabels: string[];
        exportedOrClosedBatchCount: number;
        manualCompletionCount: number;
        reversalCount: number;
        openExceptionCount: number;
        qualifiesForDryRun: boolean;
      }>;
      checklist: Array<{
        key:
          | "READINESS_GATE_GREEN"
          | "CN_ONLY_SCOPE"
          | "SINGLE_BENEFICIARY_CLASS"
          | "SINGLE_PAYOUT_METHOD"
          | "SINGLE_CURRENCY"
          | "FULL_PAYOUT_PROFILE_COVERAGE"
          | "FULL_PARTICIPANT_ACCESS_COVERAGE"
          | "TWO_SETTLEMENT_CYCLES"
          | "COMPLETION_AND_REVERSAL_EVIDENCE"
          | "NO_OPEN_EXCEPTIONS";
        passed: boolean;
      }>;
      nextMoves: Array<
        | "KEEP_MANUAL_SETTLEMENT"
        | "CHOOSE_ONE_BENEFICIARY_CLASS"
        | "NORMALIZE_PAYOUT_METHOD_SCOPE"
        | "CAPTURE_SECOND_SETTLEMENT_CYCLE"
        | "CLEAR_OPEN_EXCEPTIONS"
        | "RUN_OFF_PLATFORM_DRY_RUN"
      >;
      dryRunExportFields: string[];
      noGoTriggers: string[];
    };
    settlementOpsProofPack: {
      requiredBeneficiaryCount: number;
      coveredByActivePayoutProfileCount: number;
      missingPayoutProfileCount: number;
      coveredByParticipantAccessCount: number;
      missingParticipantAccessCount: number;
      settlementBatchCount: number;
      exportedOrClosedBatchCount: number;
      manualCompletionCount: number;
      paidWithoutExportCount: number;
      missingPayoutProfileBeneficiaries: Array<{
        key: string;
        beneficiaryType: RevenueBeneficiaryType;
        beneficiaryLabel: string;
        hasActivePayoutProfile: boolean;
        hasInvitedOrActiveParticipantAccess: boolean;
      }>;
      missingParticipantAccessBeneficiaries: Array<{
        key: string;
        beneficiaryType: RevenueBeneficiaryType;
        beneficiaryLabel: string;
        hasActivePayoutProfile: boolean;
        hasInvitedOrActiveParticipantAccess: boolean;
      }>;
      nextMoves: Array<
        | "ADD_ACTIVE_PAYOUT_PROFILES"
        | "ISSUE_PARTICIPANT_ACCESS"
        | "CREATE_FIRST_SETTLEMENT_BATCH"
        | "EXPORT_FIRST_SETTLEMENT_BATCH"
        | "CAPTURE_MANUAL_COMPLETION_EVIDENCE"
        | "AUDIT_PAID_WITHOUT_EXPORT"
      >;
    };
    settlementExceptionSummary: {
      openExceptionCount: number;
      payoutProfileExceptionCount: number;
      participantAccessExceptionCount: number;
      exportedUnsettledCount: number;
      paidWithoutExportCount: number;
      reversalCount: number;
      openExceptions: Array<{
        key: string;
        type:
          | "MISSING_PAYOUT_PROFILE"
          | "INACTIVE_PAYOUT_PROFILE"
          | "SUSPENDED_PARTICIPANT_ACCESS"
          | "ARCHIVED_PARTICIPANT_ACCESS"
          | "EXPORTED_NOT_SETTLED"
          | "PAID_WITHOUT_EXPORT";
        batchKey: string | null;
        beneficiaryType: RevenueBeneficiaryType;
        beneficiaryLabel: string;
        sourceType: RevenueSourceType | null;
        lineStatus: SettlementLineStatus | null;
        detail: string;
        daysOpen: number | null;
      }>;
      recentReversals: Array<{
        key: string;
        batchKey: string | null;
        beneficiaryType: RevenueBeneficiaryType;
        beneficiaryLabel: string;
        sourceType: RevenueSourceType;
        reversedAt: Date | null;
        reversalReason: string | null;
        notes: string | null;
      }>;
      nextMoves: Array<
        | "ADD_OR_REACTIVATE_PAYOUT_PROFILE"
        | "RESTORE_PARTICIPANT_ACCESS"
        | "COMPLETE_EXPORTED_LINES"
        | "AUDIT_PAID_WITHOUT_EXPORT"
      >;
    };
    notifications: Array<{
      id: string;
      title: string;
      body: string;
      createdAt: Date;
    }>;
    connectors: Array<{
      id: string;
      provider: "GMAIL" | "GOOGLE_CALENDAR" | "DINGTALK" | "WECOM" | "FEISHU";
      status: "PENDING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
      externalAccountEmail: string | null;
      lastSyncedAt: Date | null;
      lastSyncStatus: string | null;
      lastSyncMessage: string | null;
      createdAt: Date;
      user: { id: string; name: string; email: string };
      lastCallbackResult?: {
        status: "SUCCESS" | "FAILURE" | "UNRESOLVED" | "MISMATCH";
        failurePosture: "CLEAR" | "RETRYABLE" | "REVIEW_REQUIRED";
        recordedAt: string;
        message: string | null;
        providerEmail: string | null;
        providerMobile: string | null;
        providerNick: string | null;
        providerAvatarUrl: string | null;
        providerOpenId: string | null;
        providerUnionId: string | null;
        providerUserId: string | null;
        matchedWorkspaceUserEmail: string | null;
        corpId?: string | null;
        tenantKey?: string | null;
      } | null;
      lastIngestResult?: {
        status: "SUCCESS" | "PARTIAL" | "FAILURE" | "UNRESOLVED";
        failurePosture: "CLEAR" | "RETRYABLE" | "REVIEW_REQUIRED";
        recordedAt: string;
        sourcePage: string | null;
        message: string | null;
        runtimeEventId: string | null;
        runtimeSessionId: string | null;
        notebookId: string | null;
        windowStart: string | null;
        windowEnd: string | null;
        persistedPayloadCount: number;
        ingestionRecordCount: number;
        handleCount: number;
        scopeResults: Array<{
          scope:
            | "MEETINGS"
            | "CALENDAR"
            | "BITABLE"
            | "TODO"
            | "PROJECTS"
            | "MANAGEMENT"
            | "WORK"
            | "MESSAGE_NOTIFICATIONS";
          status: "INGESTED" | "UNRESOLVED" | "FAILED";
          message: string | null;
          docUrl: string | null;
          persistedPayloadCount: number;
          ingestionRecordCount: number;
          handleCount: number;
          latestSourceId: string | null;
        }>;
      } | null;
      calendarRegistry?: {
        boundCalendars: Array<{
          calendarId: string;
          calendarName: string | null;
          ownerUserId: string | null;
          recordedAt: string;
          sourcePage: string | null;
          docUrl: string | null;
        }>;
        lastValidationResult: {
          status: "SUCCESS" | "PARTIAL" | "FAILURE" | "UNRESOLVED";
          failurePosture: "CLEAR" | "RETRYABLE" | "REVIEW_REQUIRED";
          recordedAt: string;
          sourcePage: string | null;
          message: string | null;
          requestedCalendarCount: number;
          verifiedCalendarCount: number;
          failedCalendarCount: number;
          latestVerifiedCalendarId: string | null;
          docUrl: string | null;
        } | null;
      } | null;
    }>;
    tenantResourceReadiness: TenantResourceReadinessSummary;
    tenantResourceCapabilityReadouts: Array<
      CapabilityDecisionOperatorReadout & {
        resourceKey: string;
      }
    >;
    tenantResourceEvidenceDetails: TenantResourceEvidenceDetail[];
    tenantResourcePolicyReadout: TenantResourcePolicyReadout;
    tenantResourceGuardedWriteEvaluation: TenantResourceGuardedWriteEvaluation;
    tenantResourceGuardedWritePilotReadouts: TenantResourceGuardedWritePilotReadout[];
    importSources: Array<{
      id: string;
      sourceType: ImportSourceType;
      sourceName: string;
      status: ImportSourceStatus;
      authMode: string | null;
      externalAccountLabel: string | null;
      lastSyncedAt: Date | null;
      createdAt: Date;
    }>;
    skillSuggestions: Array<{
      id: string;
      title: string;
      reason: string;
      confidence: number;
      candidateSkillKey: string;
      candidateSkillName: string;
      candidateCategory: string;
      candidateBoundary: string;
      candidateEffectMode: string;
      candidateDefaultSurface: string;
      nonCommitmentNote: string;
      createdAt: Date;
    }>;
    formalSkillReviewQueue: Array<{
      id: string;
      title: string;
      candidateSkillKey: string;
      candidateSkillName: string;
      appliedEffectSummary: string | null;
      appliedAt: Date | null;
      confirmedAt: Date | null;
      capabilityStage: string;
      formalPromotionReady: boolean;
      formalReviewStatus: string;
      formalReviewQueuedAt: Date | null;
      formalReviewSummary: string | null;
      formalReviewDecision: string;
      formalReviewDecisionByName: string | null;
      formalReviewDecisionAt: Date | null;
      formalReviewDecisionNote: string | null;
      formalReviewChecklist: FormalReviewChecklistState;
      calibrationScore: number;
      evidenceCount: number;
      revalidationCount: number;
      adoptionCount: number;
      dismissalCount: number;
      boundaryIncidentCount: number;
    }>;
    recentFormalReviewDecisions: Array<{
      id: string;
      title: string;
      candidateSkillKey: string;
      candidateSkillName: string;
      appliedEffectSummary: string | null;
      appliedAt: Date | null;
      confirmedAt: Date | null;
      capabilityStage: string;
      formalPromotionReady: boolean;
      formalReviewStatus: string;
      formalReviewQueuedAt: Date | null;
      formalReviewSummary: string | null;
      formalReviewDecision: string;
      formalReviewDecisionByName: string | null;
      formalReviewDecisionAt: Date | null;
      formalReviewDecisionNote: string | null;
      formalReviewChecklist: FormalReviewChecklistState;
      calibrationScore: number;
      evidenceCount: number;
      revalidationCount: number;
      adoptionCount: number;
      dismissalCount: number;
      boundaryIncidentCount: number;
    }>;
    recentSkillAdoptions: Array<{
      id: string;
      title: string;
      candidateSkillKey: string;
      candidateSkillName: string;
      appliedEffectSummary: string | null;
      appliedAt: Date | null;
      confirmedAt: Date | null;
      capabilityStage: string;
      formalPromotionReady: boolean;
      formalReviewStatus: string;
      formalReviewQueuedAt: Date | null;
      formalReviewSummary: string | null;
      formalReviewDecision: string;
      formalReviewDecisionByName: string | null;
      formalReviewDecisionAt: Date | null;
      formalReviewDecisionNote: string | null;
      formalReviewChecklist: FormalReviewChecklistState;
      calibrationScore: number;
      evidenceCount: number;
      revalidationCount: number;
      adoptionCount: number;
      dismissalCount: number;
      boundaryIncidentCount: number;
    }>;
    strategySuggestions: Array<{
      id: string;
      title: string;
      reason: string;
      confidence: number;
      currentValue: string | null;
      suggestedValue: string | null;
      suggestionType: string;
      targetPolicyKey: string;
      createdAt: Date;
    }>;
    recentStrategyAdoptions: Array<{
      id: string;
      title: string;
      targetPolicyKey: string;
      appliedEffectSummary: string | null;
      appliedAt: Date | null;
      confirmedAt: Date | null;
    }>;
    governanceSummary: {
      auditEvents7d: number;
      pendingApprovals: number;
      llmFallbacks7d: number;
      approvalProtectedActions: number;
      acceptedSkillSuggestionCount: number;
      acceptedStrategyCount: number;
      formalReviewQueueCount: number;
      formalReviewDecisionCount: number;
    };
    integrationSummary: {
      connectedConnectorCount: number;
      connectorErrorCount: number;
      externalThreadCount: number;
      unboundThreadCount: number;
      importedSignalCount: number;
      duplicateEmailCount: number;
      recentImportFailures: number;
    };
  };
  connectorState: {
    tab?: string;
    connector?: string;
    status?: string;
    message?: string;
  };
  billingState: {
    status?: string;
    message?: string;
  };
  connectorConfig: {
    gmailOauthReady: boolean;
    dingtalkOauthReady: boolean;
    dingtalkMcpReady: boolean;
    dingtalkDirectorySyncReady: boolean;
    wecomOauthReady: boolean;
    wecomDirectorySyncReady: boolean;
    feishuOauthReady: boolean;
    feishuDirectorySyncReady: boolean;
    feishuBitableReady: boolean;
    secureTokenStorage: boolean;
  };
  llmConfig: {
    enabled: boolean;
    provider: string;
    defaultModel: string;
    extractionModel: string;
    briefingModel: string;
    reasoningModel: string;
    providerReady: boolean;
    baseUrl: string;
    budgetTier: string;
    localGemmaModel: string;
    modelCatalog: Array<{
      vendor: "local" | "openai" | "qwen" | "deepseek" | "anthropic";
      label: string;
      models: Array<{
        id: string;
        label: string;
        vendor: "local" | "openai" | "qwen" | "deepseek" | "anthropic";
      }>;
    }>;
    connectionProbe: {
      baseUrl: string;
      hasCredential: boolean;
      reachable: boolean;
      availableModelIds: string[];
      errorMessage: string | null;
      checkedAt: string;
      probeMode: "healthz" | "chat_completions_options";
    };
    providerSummaries: Array<{
      provider: string;
      label: string;
      configured: boolean;
      capabilities: {
        structuredOutput: boolean;
        configurableBaseUrl: boolean;
        audioTranscription: boolean;
      };
    }>;
    promptSummaries: Array<{
      key: string;
      version: string;
      taskTypes: string[];
      description: string;
    }>;
  };
};

export type SettingsSummaryConnection = {
  label: string;
  value: string;
  description?: string;
  href?: string;
};

export type PayoutProfileBeneficiaryType = "WORKER_PUBLISHER" | "SALES_REFERRAL" | "CUSTOM_SERVICES";
export type PortalInviteBeneficiaryType = "WORKER_PUBLISHER" | "SALES_REFERRAL" | "CUSTOM_SERVICES";
export type ProgramApplicationBeneficiaryType = "WORKER_PUBLISHER" | "SALES_REFERRAL" | "CUSTOM_SERVICES";
