import "server-only";

import { ObjectType } from "@prisma/client";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { logEvent } from "@/lib/analytics";
import {
  getDeploymentProfileDefaultLocaleCandidate,
  getRequestUiLocaleCandidate,
} from "@/lib/i18n/request-locale.server";
import { getWorkspaceFirstLoopModel } from "@/lib/operating-system/first-loop-query";
import { getMemoryData } from "@/features/memory/queries";
import {
  canManageWorkspaceRuntime,
  canReviewWorkspaceRuntime,
} from "@/lib/auth/capture-runtime-governance";
import { canExportMemory, canManageMemoryFacts } from "@/lib/memory/permissions";
import { normalizeWorkspaceUiConfig } from "@/lib/workspace-ops";

type MemorySearchParams = Promise<{
  query?: string;
  dimension?: "ALL" | "WORKSPACE" | "CONTACT" | "COMPANY" | "OPPORTUNITY" | "MEETING";
  objectLevel?: "ALL" | "WORKSPACE" | "CONTACT" | "COMPANY" | "OPPORTUNITY" | "MEETING";
  source?: "ALL" | "HELM" | "OPENCLAW";
  objectType?: ObjectType;
  objectId?: string;
  from?: string;
  approvalId?: string;
}>;

export async function loadMemoryPageData(searchParams: MemorySearchParams) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const requestLocale = await getRequestUiLocaleCandidate();
  const { locale } = normalizeWorkspaceUiConfig({
    ...workspace,
    requestLocale,
    deploymentProfileDefaultLocale: getDeploymentProfileDefaultLocaleCandidate(),
  });
  const {
    query,
    dimension,
    objectLevel: rawObjectLevel,
    source: rawSource,
    objectType: rawObjectType,
    objectId,
    from,
    approvalId,
  } = await searchParams;
  const objectLevel = rawObjectLevel ?? dimension ?? "ALL";
  const source = rawSource ?? "ALL";
  const entryContext: "APPROVAL_EVIDENCE" | null =
    from === "approvals" ? "APPROVAL_EVIDENCE" : null;
  const returnToApprovalId =
    entryContext === "APPROVAL_EVIDENCE" && approvalId?.trim()
      ? approvalId.trim()
      : null;
  const objectType =
    rawObjectType === "CONTACT" ||
    rawObjectType === "COMPANY" ||
    rawObjectType === "OPPORTUNITY" ||
    rawObjectType === "MEETING"
      ? rawObjectType
      : null;

  const data = await getMemoryData(workspace.id, {
    query,
    objectLevel,
    source,
    objectType: objectType ?? undefined,
    objectId: objectId ?? undefined,
  });
  const firstLoopModel = await getWorkspaceFirstLoopModel({
    workspaceId: workspace.id,
    currentUserId: user.id,
    locale,
    membershipRole: membership.role,
    profileType: workspace.profileType,
    focusAreasJson: workspace.focusAreas,
  });

  await logEvent({
    workspaceId: workspace.id,
    userId: user.id,
    eventName: "memory_timeline_viewed",
    eventCategory: "memory",
    targetType: objectType ?? "Workspace",
    targetId: objectId ?? workspace.id,
    metadata: {
      query: query ?? null,
      objectLevel,
      source,
      entryContext,
      returnToApprovalId,
      objectType: objectType ?? null,
      objectId: objectId ?? null,
    },
    sourcePage: "/memory",
  });

  if (query) {
    await logEvent({
      workspaceId: workspace.id,
      userId: user.id,
      eventName: "memory_search_performed",
      eventCategory: "memory",
      targetType: objectType ?? "Workspace",
      targetId: objectId ?? workspace.id,
      metadata: {
        query,
        objectLevel,
        source,
        entryContext,
        returnToApprovalId,
        objectType: objectType ?? null,
        objectId: objectId ?? null,
      },
      sourcePage: "/memory",
    });
  }

  return {
    query: query ?? "",
    objectLevel,
    source,
    entryContext,
    returnToApprovalId,
    objectType: objectType ?? null,
    objectId: objectId ?? null,
    permissions: {
      canExportMemory: canExportMemory(membership.role),
      canManageMemoryFacts: canManageMemoryFacts(membership.role),
      canManageRuntime: canManageWorkspaceRuntime(membership.role),
      canReviewRuntime: canReviewWorkspaceRuntime(membership.role),
    },
    firstLoopModel,
    data,
  };
}
