import { NextResponse } from "next/server";
import { ActorType } from "@prisma/client";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  buildOrgAdminSupportPack,
  ORGANIZATION_SUPPORT_PACK_EXPORTED,
} from "@/lib/auth/org-admin-governance";
import {
  canExportWorkspaceAdminSupportPack,
  getAdminSupportPackExportDeniedMessage,
} from "@/lib/auth/settings-governance";
import { writeAuditLog } from "@/lib/audit";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { resolveSettingsApiMessage } from "@/lib/i18n/api-settings-messages";

export async function GET() {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  if (!canExportWorkspaceAdminSupportPack(membership.role)) {
    return NextResponse.json(
      { success: false, message: getAdminSupportPackExportDeniedMessage(english) },
      { status: 403 },
    );
  }

  const supportPack = await buildOrgAdminSupportPack(workspace.id, {
    currentAuthSessionId: session.authSessionId,
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: ORGANIZATION_SUPPORT_PACK_EXPORTED,
    targetType: "Workspace",
    targetId: workspace.id,
    summary: resolveSettingsApiMessage(
      workspace.defaultLocale,
      "orgAdminSupportPackExportedAuditSummary",
    ),
    payload: {
      orgAdminAuditCount30d: supportPack.summary.dataGovernanceSummary.orgAdminAuditCount30d,
      dataGovernanceAuditCount30d: supportPack.summary.dataGovernanceSummary.dataGovernanceAuditCount30d,
      membershipActionCount30d: supportPack.summary.dataGovernanceSummary.membershipActionCount30d,
      workspaceGovernanceActionCount30d:
        supportPack.summary.dataGovernanceSummary.workspaceGovernanceActionCount30d,
      activeSessionCount: supportPack.summary.authSessionSummary.activeSessionCount,
      expiringSoonSessionCount: supportPack.summary.authSessionSummary.expiringSoonSessionCount,
      staleActiveSessionCount: supportPack.summary.authSessionSummary.staleActiveSessionCount,
      legacyProviderSessionCount: supportPack.summary.authSessionSummary.legacyProviderSessionCount,
      missingSourcePageSessionCount:
        supportPack.summary.authSessionSummary.missingSourcePageSessionCount,
      missingWorkspaceSwitchMarkerSessionCount:
        supportPack.summary.authSessionSummary.missingWorkspaceSwitchMarkerSessionCount,
      providerSourceMismatchSessionCount:
        supportPack.summary.authSessionSummary.providerSourceMismatchSessionCount,
      workspaceMembershipMismatchSessionCount:
        supportPack.summary.authSessionSummary.workspaceMembershipMismatchSessionCount,
      realignedSessionCount30d: supportPack.summary.authSessionSummary.realignedSessionCount30d,
      authSessionEventCount30d: supportPack.summary.dataGovernanceSummary.authSessionEventCount30d,
      scopeRevokeActionCount30d: supportPack.summary.authSessionSummary.scopeRevokeActionCount30d,
      scopeRevokedSessionCount30d:
        supportPack.summary.authSessionSummary.scopeRevokedSessionCount30d,
      revokeScopeSummary30d: supportPack.summary.authSessionSummary.revokeScopeSummary30d,
      liveRevokeScopeSummary: supportPack.summary.authSessionSummary.liveRevokeScopeSummary,
      anomalyInventorySummary: supportPack.summary.authSessionSummary.anomalyInventorySummary,
      previewVsExecutedScopeSummary:
        supportPack.summary.authSessionSummary.previewVsExecutedScopeSummary,
      revokeConsistencySummary:
        supportPack.summary.authSessionSummary.revokeConsistencySummary,
      currentSessionReviewScopeSummary:
        supportPack.summary.authSessionSummary.currentSessionReviewScopeSummary,
      authControlConsistencyStatus:
        supportPack.summary.authSessionSummary.authControlConsistencyOverview.consistencyStatus,
      authControlFollowThroughStatus:
        supportPack.summary.authSessionSummary.authControlConsistencyOverview.followThroughStatus,
      authControlReviewOnlyScopeCount:
        supportPack.summary.authSessionSummary.authControlConsistencyOverview.reviewOnlyScopeCount,
      authControlBulkRevocableScopeCount:
        supportPack.summary.authSessionSummary.authControlConsistencyOverview.bulkRevocableScopeCount,
      authControlDriftScopeCount:
        supportPack.summary.authSessionSummary.authControlConsistencyOverview.driftScopeCount,
      authControlCurrentSessionProtectedScopeCount:
        supportPack.summary.authSessionSummary.authControlConsistencyOverview.currentSessionProtectedScopeCount,
      authControlLatestDetectedAt:
        supportPack.summary.authSessionSummary.authControlConsistencyOverview.latestDetectedAt,
      authControlLatestMarkerScopeCount:
        supportPack.summary.authSessionSummary.authControlConsistencyOverview.latestMarkerScopeCount,
      authControlLatestFollowThroughActionType:
        supportPack.summary.authSessionSummary.authControlConsistencyOverview.latestFollowThroughActionType,
      authControlLatestFollowThroughRecordedAt:
        supportPack.summary.authSessionSummary.authControlConsistencyOverview.latestFollowThroughRecordedAt,
      authControlLatestFollowThroughSourcePage:
        supportPack.summary.authSessionSummary.authControlConsistencyOverview.latestFollowThroughSourcePage,
      latestAnomalyFollowThroughStatus:
        supportPack.summary.authSessionSummary.latestAnomalyFollowThroughSummary.status,
      latestAnomalyFollowThroughFollowThroughStatus:
        supportPack.summary.authSessionSummary.latestAnomalyFollowThroughSummary.followThroughStatus,
      latestAnomalyFollowThroughReviewOnlyScopeCount:
        supportPack.summary.authSessionSummary.latestAnomalyFollowThroughSummary.reviewOnlyScopeCount,
      latestAnomalyFollowThroughBulkRevocableScopeCount:
        supportPack.summary.authSessionSummary.latestAnomalyFollowThroughSummary.bulkRevocableScopeCount,
      latestAnomalyFollowThroughDriftScopeCount:
        supportPack.summary.authSessionSummary.latestAnomalyFollowThroughSummary.driftScopeCount,
      latestAnomalyFollowThroughCurrentSessionProtectedScopeCount:
        supportPack.summary.authSessionSummary.latestAnomalyFollowThroughSummary.currentSessionProtectedScopeCount,
      latestAnomalyFollowThroughLatestMarkerRecordedAt:
        supportPack.summary.authSessionSummary.latestAnomalyFollowThroughSummary.latestMarkerRecordedAt,
      latestAnomalyFollowThroughLatestMarkerScopeCount:
        supportPack.summary.authSessionSummary.latestAnomalyFollowThroughSummary.latestMarkerScopeCount,
      latestAnomalyFollowThroughLatestFollowThroughActionType:
        supportPack.summary.authSessionSummary.latestAnomalyFollowThroughSummary.latestFollowThroughActionType,
      latestAnomalyFollowThroughLatestFollowThroughRecordedAt:
        supportPack.summary.authSessionSummary.latestAnomalyFollowThroughSummary.latestFollowThroughRecordedAt,
      latestAnomalyFollowThroughLatestFollowThroughSourcePage:
        supportPack.summary.authSessionSummary.latestAnomalyFollowThroughSummary.latestFollowThroughSourcePage,
      latestMarkerCoverageStatus:
        supportPack.summary.authSessionSummary.latestMarkerCoverageSummary.status,
      latestMarkerCoverageFollowThroughStatus:
        supportPack.summary.authSessionSummary.latestMarkerCoverageSummary.followThroughStatus,
      latestMarkerCoverageStillDetectedScopeCount:
        supportPack.summary.authSessionSummary.latestMarkerCoverageSummary.stillDetectedScopeCount,
      latestMarkerCoverageResolvedScopeCount:
        supportPack.summary.authSessionSummary.latestMarkerCoverageSummary.resolvedScopeCount,
      latestMarkerCoverageNewlyDetectedScopeCount:
        supportPack.summary.authSessionSummary.latestMarkerCoverageSummary.newlyDetectedScopeCount,
      latestMarkerCoverageReviewOnlyScopeCount:
        supportPack.summary.authSessionSummary.latestMarkerCoverageSummary.reviewOnlyScopeCount,
      latestMarkerCoverageBulkRevocableScopeCount:
        supportPack.summary.authSessionSummary.latestMarkerCoverageSummary.bulkRevocableScopeCount,
      latestMarkerCoverageDriftScopeCount:
        supportPack.summary.authSessionSummary.latestMarkerCoverageSummary.driftScopeCount,
      latestMarkerCoverageCurrentSessionProtectedScopeCount:
        supportPack.summary.authSessionSummary.latestMarkerCoverageSummary.currentSessionProtectedScopeCount,
      latestMarkerCoverageLatestMarkerRecordedAt:
        supportPack.summary.authSessionSummary.latestMarkerCoverageSummary.latestMarkerRecordedAt,
      latestMarkerCoverageLatestMarkerScopeCount:
        supportPack.summary.authSessionSummary.latestMarkerCoverageSummary.latestMarkerScopeCount,
      latestMarkerCoverageLatestFollowThroughActionType:
        supportPack.summary.authSessionSummary.latestMarkerCoverageSummary.latestFollowThroughActionType,
      latestMarkerCoverageLatestFollowThroughRecordedAt:
        supportPack.summary.authSessionSummary.latestMarkerCoverageSummary.latestFollowThroughRecordedAt,
      latestMarkerCoverageLatestFollowThroughSourcePage:
        supportPack.summary.authSessionSummary.latestMarkerCoverageSummary.latestFollowThroughSourcePage,
      revokeExecutionAggregateStatus:
        supportPack.summary.authSessionSummary.revokeExecutionAggregateSummary.status,
      revokeExecutionAggregateLiveEligibleSessionCount:
        supportPack.summary.authSessionSummary.revokeExecutionAggregateSummary.liveEligibleSessionCount,
      revokeExecutionAggregateLastExecutedEligibleSessionCount:
        supportPack.summary.authSessionSummary.revokeExecutionAggregateSummary.lastExecutedEligibleSessionCount,
      revokeExecutionAggregateLastExecutedRevokedSessionCount:
        supportPack.summary.authSessionSummary.revokeExecutionAggregateSummary.lastExecutedRevokedSessionCount,
      revokeExecutionAggregateExecutionShortfallCount:
        supportPack.summary.authSessionSummary.revokeExecutionAggregateSummary.executionShortfallCount,
      revokeExecutionAggregatePreviewEligibleDeltaCount:
        supportPack.summary.authSessionSummary.revokeExecutionAggregateSummary.previewEligibleDeltaCount,
      revokeExecutionAggregateReviewOnlyScopeCount:
        supportPack.summary.authSessionSummary.revokeExecutionAggregateSummary.reviewOnlyScopeCount,
      revokeExecutionAggregateBulkRevocableScopeCount:
        supportPack.summary.authSessionSummary.revokeExecutionAggregateSummary.bulkRevocableScopeCount,
      revokeExecutionAggregateDriftScopeCount:
        supportPack.summary.authSessionSummary.revokeExecutionAggregateSummary.driftScopeCount,
      revokeExecutionAggregateCurrentSessionProtectedScopeCount:
        supportPack.summary.authSessionSummary.revokeExecutionAggregateSummary.currentSessionProtectedScopeCount,
      revokeExecutionAggregateLatestExecutedAt:
        supportPack.summary.authSessionSummary.revokeExecutionAggregateSummary.latestExecutedAt,
      latestAnomalyMarkerSessionId:
        supportPack.summary.authSessionSummary.latestAnomalyMarker?.sessionId ?? null,
      latestAnomalyMarkerScopes:
        supportPack.summary.authSessionSummary.latestAnomalyMarker?.anomalyScopes ?? [],
      latestAnomalyMarkerSourcePage:
        supportPack.summary.authSessionSummary.latestAnomalyMarker?.sourcePage ?? null,
      latestAnomalyMarkerProviderType:
        supportPack.summary.authSessionSummary.latestAnomalyMarker?.providerType ?? null,
      latestAnomalyMarkerRecordedAt:
        supportPack.summary.authSessionSummary.latestAnomalyMarker?.recordedAt ?? null,
      latestAnomalyFollowThroughSummary:
        supportPack.summary.authSessionSummary.latestAnomalyFollowThroughSummary,
      latestMarkerCoverageSummary:
        supportPack.summary.authSessionSummary.latestMarkerCoverageSummary,
      revokeExecutionAggregateSummary:
        supportPack.summary.authSessionSummary.revokeExecutionAggregateSummary,
      authControlConsistencyOverview:
        supportPack.summary.authSessionSummary.authControlConsistencyOverview,
      supportPackExportCount30d: supportPack.summary.dataGovernanceSummary.supportPackExportCount30d,
      exportActionCount30d: supportPack.summary.dataGovernanceSummary.exportActionCount30d,
      deleteActionCount30d: supportPack.summary.dataGovernanceSummary.deleteActionCount30d,
      retentionUpdateCount30d: supportPack.summary.dataGovernanceSummary.retentionUpdateCount30d,
      billingActionCount30d: supportPack.summary.dataGovernanceSummary.billingActionCount30d,
      billingWebhookResolutionCount30d:
        supportPack.summary.dataGovernanceSummary.billingWebhookResolutionCount30d,
      billingWebhookDuplicateChainCount30d:
        supportPack.summary.dataGovernanceSummary.billingWebhookDuplicateChainCount30d,
      billingWebhookUnresolvedHintCount30d:
        supportPack.summary.dataGovernanceSummary.billingWebhookUnresolvedHintCount30d,
      billingWebhookMappedExceptionCount30d:
        supportPack.summary.dataGovernanceSummary.billingWebhookMappedExceptionCount30d,
      contributionRegistryActionCount30d:
        supportPack.summary.dataGovernanceSummary.contributionRegistryActionCount30d,
      participantPortalActionCount30d:
        supportPack.summary.dataGovernanceSummary.participantPortalActionCount30d,
      programActionCount30d: supportPack.summary.dataGovernanceSummary.programActionCount30d,
      settlementActionCount30d: supportPack.summary.dataGovernanceSummary.settlementActionCount30d,
      importActionCount30d: supportPack.summary.dataGovernanceSummary.importActionCount30d,
      identityMatchWriteCount30d:
        supportPack.summary.dataGovernanceSummary.identityMatchWriteCount30d,
      identityMatchNeedsReviewCount30d:
        supportPack.summary.dataGovernanceSummary.identityMatchNeedsReviewCount30d,
      latestWorkspaceRealignmentAuditActionType:
        supportPack.summary.governanceFollowThrough.latestWorkspaceRealignmentAudit?.actionType ?? null,
      latestScopedSessionRevokeAuditActionType:
        supportPack.summary.governanceFollowThrough.latestScopedSessionRevokeAudit?.actionType ?? null,
      latestAuthSessionAnomalyFollowThroughAuditActionType:
        supportPack.summary.governanceFollowThrough.latestAuthSessionAnomalyFollowThroughAudit
          ?.actionType ?? null,
      exportScopedToWorkspace: supportPack.summary.dataGovernanceClosure.exportScopedToWorkspace,
      deleteScopedToWorkspace: supportPack.summary.dataGovernanceClosure.deleteScopedToWorkspace,
      retentionScopedToWorkspace:
        supportPack.summary.dataGovernanceClosure.retentionScopedToWorkspace,
      supportPackScopedToWorkspace:
        supportPack.summary.dataGovernanceClosure.supportPackScopedToWorkspace,
      sensitiveWriteTenantOwnershipGuarded:
        supportPack.summary.dataGovernanceClosure.sensitiveWriteTenantOwnershipGuarded,
      latestExportOwner: supportPack.summary.dataGovernanceClosure.latestExportOwner,
      latestDeleteOwner: supportPack.summary.dataGovernanceClosure.latestDeleteOwner,
      latestRetentionOwner: supportPack.summary.dataGovernanceClosure.latestRetentionOwner,
      latestSupportPackOwner: supportPack.summary.dataGovernanceClosure.latestSupportPackOwner,
      latestExportSourcePage: supportPack.summary.dataGovernanceClosure.latestExportSourcePage,
      latestDeleteSourcePage: supportPack.summary.dataGovernanceClosure.latestDeleteSourcePage,
      latestRetentionSourcePage:
        supportPack.summary.dataGovernanceClosure.latestRetentionSourcePage,
      latestSupportPackSourcePage:
        supportPack.summary.dataGovernanceClosure.latestSupportPackSourcePage,
    },
    sourcePage: "/settings",
  });

  return new NextResponse(JSON.stringify(supportPack, null, 2), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="helm-org-admin-support-pack.json"',
      Vary: "Cookie",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
