import "server-only";

import { ActionType } from "@prisma/client";
import { normalizeWorkspaceUiConfig } from "@/lib/workspace-ops";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  getDeploymentProfileDefaultLocaleCandidate,
  getRequestUiLocaleCandidate,
} from "@/lib/i18n/request-locale.server";
import {
  canManageWorkspacePolicies,
  getWorkspaceGovernanceDeniedMessage,
} from "@/lib/auth/settings-governance";
import {
  canReviewWorkspaceGovernedActions,
  getGovernedActionReviewDeniedMessage,
} from "@/lib/auth/action-governance";
import { getApprovalLearningPanels } from "@/lib/evolution/evolution-insights.service";
import { getWorkspaceBusinessLoopGapReadout } from "@/lib/helm-v2/runtime-upgrade";
import type { ResolvedApprovalsExtensions } from "@/lib/extensions/registry";
import { getWorkspaceFirstLoopModel } from "@/lib/operating-system/first-loop-query";
import {
  buildWorkspaceFirstLoopModel,
  type WorkspaceFirstLoopModel,
} from "@/lib/operating-system/first-loop";
import type { BusinessLoopGapSummary } from "@/lib/operating-system/operating-gap";
import { resolveApprovalsExtensions } from "@/lib/extensions/registry";
import { getApprovalTasksData } from "@/features/approvals/queries";
import { resolveOptionalApprovalsReadModel } from "@/features/approvals/optional-read-model";

function buildFallbackBusinessLoopGapSummary(): BusinessLoopGapSummary {
  return {
    totalOpen: 0,
    reviewRequired: 0,
    kindCounts: [],
    primaryGap: null,
  };
}

function buildFallbackFirstLoopModel(english: boolean): WorkspaceFirstLoopModel {
  return buildWorkspaceFirstLoopModel({
    english,
    roleGoal: {
      label: english ? "Workspace role is available" : "工作区角色已确认",
      summary: english
        ? "The approval queue can open even when supporting read models are still catching up."
        : "即使辅助读模型仍在准备，复核队列也应该先打开。",
      href: "/dashboard",
      status: "done",
    },
    firstSignal: null,
    firstSuggestion: null,
    reviewCheckpoint: {
      label: english ? "Open the review queue" : "打开复核队列",
      summary: english
        ? "Review pending actions first; supporting panels can recover without blocking this page."
        : "先复核待处理动作；辅助面板可以稍后恢复，不应阻塞本页。",
      href: "/approvals#approval-queue",
      status: "ready",
    },
    followThrough: null,
    memoryWriteBack: null,
    nextAnchor: null,
    hasExplicitAnchor: false,
  });
}

const emptyApprovalsExtensions: ResolvedApprovalsExtensions = {
  biBoard: null,
};

export async function loadApprovalsPageData(
  searchParams?: Promise<{ approvalId?: string; evidenceOpen?: string }>,
) {
  const { membership, user, workspace } = await getCurrentWorkspaceSession();
  const requestLocale = await getRequestUiLocaleCandidate();
  const { locale } = normalizeWorkspaceUiConfig({
    ...workspace,
    requestLocale,
    deploymentProfileDefaultLocale: getDeploymentProfileDefaultLocaleCandidate(),
  });
  const english = locale === "en-US";
  const { approvalId, evidenceOpen } = (await searchParams) ?? {};
  const tasks = await getApprovalTasksData(workspace.id);
  const actionTypes = tasks.map(
    (task) => task.actionItem.actionType as ActionType,
  );
  const [
    businessLoopGapSummary,
    firstLoopModel,
    approvalsExtensions,
    learningPanels,
  ] = await Promise.all([
    resolveOptionalApprovalsReadModel(
      getWorkspaceBusinessLoopGapReadout(workspace.id).then(
        (readout) => readout.businessLoopGapSummary,
      ),
      buildFallbackBusinessLoopGapSummary(),
    ),
    resolveOptionalApprovalsReadModel(
      getWorkspaceFirstLoopModel({
        workspaceId: workspace.id,
        currentUserId: user.id,
        locale,
        membershipRole: membership.role,
        profileType: workspace.profileType,
        focusAreasJson: workspace.focusAreas,
      }),
      buildFallbackFirstLoopModel(english),
    ),
    resolveOptionalApprovalsReadModel(
      resolveApprovalsExtensions({ workspace }),
      emptyApprovalsExtensions,
    ),
    resolveOptionalApprovalsReadModel(
      getApprovalLearningPanels({
        workspaceId: workspace.id,
        userId: user.id,
        actionTypes,
        locale,
      }),
      {},
    ),
  ]);

  return {
    tasks,
    learningPanels,
    businessLoopGapSummary,
    firstLoopModel,
    biBoardContribution: approvalsExtensions.biBoard,
    approvalId: approvalId ?? null,
    evidenceOpen: evidenceOpen === "1",
    actionGovernance: {
      canReview: canReviewWorkspaceGovernedActions(membership.role),
      canChangePolicy: canManageWorkspacePolicies(membership.role),
      reviewDeniedMessage: getGovernedActionReviewDeniedMessage(english),
      policyDeniedMessage: getWorkspaceGovernanceDeniedMessage(english),
    },
  };
}
