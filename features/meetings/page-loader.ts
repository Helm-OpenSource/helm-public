import "server-only";

import { db } from "@/lib/db";
import { getCurrentWorkspace, getCurrentWorkspaceSession } from "@/lib/auth/session";
import { logPageViewEvent } from "@/lib/analytics";
import { resolveWorkspaceDemoMode } from "@/lib/demo/demo-modes";
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";
import { normalizeWorkspaceUiConfig } from "@/lib/workspace-ops";
import {
  isEnglishLocale,
  resolveWorkspaceUiLocale,
} from "@/lib/i18n/config";
import {
  getDeploymentProfileDefaultLocaleCandidate,
  getRequestUiLocaleCandidate,
} from "@/lib/i18n/request-locale.server";
import { getLocalizedStageLabels } from "@/lib/i18n/labels";
import { buildMeetingConversationChainExtensionModel } from "@/features/conversation-chain-extension/detail-model";
import { getMeetingDetailData, getMeetingsOverviewData } from "@/features/meetings/queries";
import { generateRecommendationsForObject } from "@/lib/recommendations/recommendation.service";
import { isWorkspaceServiceGovernanceError } from "@/lib/auth/service-governance";
import {
  canManageWorkspaceRuntime,
  canReviewWorkspaceRuntime,
  getRuntimeManagementDeniedMessage,
  getRuntimeReviewDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import {
  canManageWorkspaceGovernedActions,
  canReviewWorkspaceGovernedActions,
  getGovernedActionManagementDeniedMessage,
  getGovernedActionReviewDeniedMessage,
} from "@/lib/auth/action-governance";
import { findMembershipsWithExistingUsers } from "@/lib/auth/membership-with-user";
import { getWorkspaceFirstLoopModel } from "@/lib/operating-system/first-loop-query";

export async function loadMeetingsPageData() {
  const workspace = await getCurrentWorkspace();
  const requestLocale = await getRequestUiLocaleCandidate();
  const { locale } = normalizeWorkspaceUiConfig({
    ...workspace,
    requestLocale,
    deploymentProfileDefaultLocale: getDeploymentProfileDefaultLocaleCandidate(),
  });
  const english = locale === "en-US";
  const demoMode = resolveWorkspaceDemoMode(workspace.configuration);
  const pageStory = getWorkspaceStory("meetings", locale, demoMode);
  const meetings = await getMeetingsOverviewData(workspace.id);

  await logPageViewEvent({
    eventName: "meetings_overview_opened",
    sourcePage: "/meetings",
    targetType: "Page",
    targetId: "/meetings",
  });

  return {
    demoMode,
    english,
    meetings,
    pageStory,
  };
}

export async function loadMeetingDetailPageData(meetingId: string) {
  const session = await getCurrentWorkspaceSession();
  const { membership, user, workspace } = session;
  const requestLocale = await getRequestUiLocaleCandidate();
  const locale = resolveWorkspaceUiLocale({
    requestLocale,
    workspaceDefaultLocale: workspace.defaultLocale,
    deploymentProfileDefaultLocale: getDeploymentProfileDefaultLocaleCandidate(),
  });
  const english = isEnglishLocale(locale);
  const [stageLabels, meeting, firstLoopModel] = await Promise.all([
    getLocalizedStageLabels(locale),
    getMeetingDetailData(workspace.id, meetingId),
    getWorkspaceFirstLoopModel({
      workspaceId: workspace.id,
      currentUserId: user.id,
      locale,
      membershipRole: membership.role,
      profileType: workspace.profileType,
      focusAreasJson: workspace.focusAreas,
    }),
  ]);

  if (!meeting) {
    return null;
  }

  await logPageViewEvent({
    eventName: "meeting_opened",
    sourcePage: `/meetings/${meeting.id}`,
    targetType: "Meeting",
    targetId: meeting.id,
    metadata: {
      opportunityId: meeting.opportunityId,
    },
  });

  await logPageViewEvent({
    eventName: "meeting_briefing_viewed",
    sourcePage: `/meetings/${meeting.id}`,
    targetType: "Meeting",
    targetId: meeting.id,
  });

  const [memberships, auditLogs, recommendations] = await Promise.all([
    findMembershipsWithExistingUsers({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "asc" },
    }),
    db.auditLog.findMany({
      where: {
        workspaceId: workspace.id,
        OR: [
          { targetId: meeting.id },
          ...meeting.actionItems.map((item) => ({ targetId: item.id })),
          ...(meeting.opportunityId ? [{ targetId: meeting.opportunityId }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    generateRecommendationsForObject({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: "USER",
      sourcePage: `/meetings/${meeting.id}`,
      objectType: "MEETING",
      objectId: meeting.id,
      // Keep detail-page SSR responsive even when external/local LLM endpoints are slow.
      llmEnhancement: false,
    }).catch((error) => {
      if (isWorkspaceServiceGovernanceError(error)) {
        return [];
      }
      throw error;
    }),
  ]);

  const chainModel = buildMeetingConversationChainExtensionModel({
    meeting,
    english,
    stageLabels,
  });

  return {
    actionGovernance: {
      canManage: canManageWorkspaceGovernedActions(membership.role),
      canReview: canReviewWorkspaceGovernedActions(membership.role),
      manageDeniedMessage: getGovernedActionManagementDeniedMessage(english),
      reviewDeniedMessage: getGovernedActionReviewDeniedMessage(english),
    },
    runtimeGovernance: {
      canManage: canManageWorkspaceRuntime(membership.role),
      canReview: canReviewWorkspaceRuntime(membership.role),
      manageDeniedMessage: getRuntimeManagementDeniedMessage(english),
      reviewDeniedMessage: getRuntimeReviewDeniedMessage(english),
    },
    auditLogs,
    chainModel,
    english,
    firstLoopModel,
    meeting,
    memberships,
    recommendations,
  };
}
