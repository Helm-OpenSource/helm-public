import { ActorType } from "@prisma/client";
import { WorkspaceCapability, WORKSPACE_CAPABILITIES, workspaceRoleHasCapability } from "@/lib/auth/authorization";
import {
  getGovernedActionManagementDeniedMessage,
  getGovernedActionReviewDeniedMessage,
  getGovernedCandidatePromotionDeniedMessage,
} from "@/lib/auth/action-governance";
import { getCaptureManagementDeniedMessage } from "@/lib/auth/capture-runtime-governance";
import {
  getBillingManagementDeniedMessage,
  getContributionRegistryManagementDeniedMessage,
  getManualSettlementManagementDeniedMessage,
  getParticipantPortalManagementDeniedMessage,
  getProgramApplicationManagementDeniedMessage,
} from "@/lib/auth/commercial-governance";
import {
  getImportConflictResolutionDeniedMessage,
  getImportManagementDeniedMessage,
  getWorkspaceRoleForUser,
} from "@/lib/auth/import-governance";
import { getInsightGovernanceDeniedMessage } from "@/lib/auth/insight-governance";
import { getWorkspaceGovernanceDeniedMessage } from "@/lib/auth/settings-governance";
import { db } from "@/lib/db";
import { getMemoryManagementDeniedMessage } from "@/lib/memory/permissions";
import {
  getHelmReservedWorkspaceDeniedMessage,
  type HelmReservedWorkspaceSurface,
  isOperationalHelmReservedWorkspace,
} from "@/lib/workspace-reserved";

type AssertWorkspaceUserCapabilityInput = {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  capability: WorkspaceCapability;
  deniedMessage: string;
};

export class WorkspaceServiceGovernanceError extends Error {
  readonly code = "WORKSPACE_SERVICE_GOVERNANCE_REQUIRED";

  constructor(message: string) {
    super(message);
    this.name = "WorkspaceServiceGovernanceError";
  }
}

export function isWorkspaceServiceGovernanceError(error: unknown): error is WorkspaceServiceGovernanceError {
  return error instanceof WorkspaceServiceGovernanceError;
}

export function shouldEnforceWorkspaceServiceGovernance(input: {
  userId?: string | null;
  actorType?: ActorType | null;
}) {
  if (!input.userId) {
    return false;
  }

  return (input.actorType ?? ActorType.USER) === ActorType.USER;
}

async function assertWorkspaceUserCapability(input: AssertWorkspaceUserCapabilityInput) {
  if (
    !shouldEnforceWorkspaceServiceGovernance({
      userId: input.userId,
      actorType: input.actorType,
    })
  ) {
    return null;
  }

  const role = await getWorkspaceRoleForUser({
    workspaceId: input.workspaceId,
    userId: input.userId!,
  });

  if (!role || !workspaceRoleHasCapability(role, input.capability)) {
    throw new WorkspaceServiceGovernanceError(input.deniedMessage);
  }

  return role;
}

async function assertReservedWorkspaceSurfaceAccess(input: {
  workspaceId: string;
  english: boolean;
  surface: HelmReservedWorkspaceSurface;
}) {
  const workspace = await db.workspace.findUnique({
    where: {
      id: input.workspaceId,
    },
    select: {
      status: true,
      workspaceClass: true,
      systemKey: true,
    },
  });

  if (!isOperationalHelmReservedWorkspace(workspace)) {
    throw new WorkspaceServiceGovernanceError(
      getHelmReservedWorkspaceDeniedMessage(input.english, input.surface),
    );
  }
}

export async function assertWorkspaceBillingServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
  scope?: Parameters<typeof getBillingManagementDeniedMessage>[1];
}) {
  return assertWorkspaceUserCapability({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    capability: WORKSPACE_CAPABILITIES.MANAGE_BILLING,
    deniedMessage: getBillingManagementDeniedMessage(input.english, input.scope),
  });
}

export async function assertWorkspaceInsightServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
}) {
  return assertWorkspaceUserCapability({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    capability: WORKSPACE_CAPABILITIES.MANAGE_INSIGHTS,
    deniedMessage: getInsightGovernanceDeniedMessage(input.english),
  });
}

export async function assertWorkspaceCaptureServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
}) {
  return assertWorkspaceUserCapability({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    capability: WORKSPACE_CAPABILITIES.MANAGE_CAPTURE_SESSIONS,
    deniedMessage: getCaptureManagementDeniedMessage(input.english),
  });
}

export async function assertWorkspaceImportServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
}) {
  return assertWorkspaceUserCapability({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    capability: WORKSPACE_CAPABILITIES.MANAGE_IMPORTS,
    deniedMessage: getImportManagementDeniedMessage(input.english),
  });
}

export async function assertWorkspaceImportConflictServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
}) {
  return assertWorkspaceUserCapability({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    capability: WORKSPACE_CAPABILITIES.RESOLVE_IMPORT_CONFLICTS,
    deniedMessage: getImportConflictResolutionDeniedMessage(input.english),
  });
}

export async function assertWorkspaceMemoryServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
}) {
  return assertWorkspaceUserCapability({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    capability: WORKSPACE_CAPABILITIES.MANAGE_MEMORY_FACTS,
    deniedMessage: getMemoryManagementDeniedMessage(input.english),
  });
}

export async function assertWorkspaceManualSettlementServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
}) {
  return assertWorkspaceUserCapability({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    capability: WORKSPACE_CAPABILITIES.MANAGE_MANUAL_SETTLEMENT,
    deniedMessage: getManualSettlementManagementDeniedMessage(input.english),
  });
}

export async function assertWorkspaceContributionRegistryServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
}) {
  return assertWorkspaceUserCapability({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    capability: WORKSPACE_CAPABILITIES.MANAGE_CONTRIBUTION_REGISTRY,
    deniedMessage: getContributionRegistryManagementDeniedMessage(input.english),
  });
}

export async function assertWorkspaceReservedCommercialRegistryServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
}) {
  const role = await assertWorkspaceContributionRegistryServiceAccess(input);
  await assertReservedWorkspaceSurfaceAccess({
    workspaceId: input.workspaceId,
    english: input.english,
    surface: "commercial_registry",
  });
  return role;
}

export async function assertWorkspaceGovernedActionManagementServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
}) {
  return assertWorkspaceUserCapability({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    capability: WORKSPACE_CAPABILITIES.MANAGE_GOVERNED_ACTIONS,
    deniedMessage: getGovernedActionManagementDeniedMessage(input.english),
  });
}

export async function assertWorkspaceGovernedActionReviewServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
}) {
  return assertWorkspaceUserCapability({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    capability: WORKSPACE_CAPABILITIES.REVIEW_GOVERNED_ACTIONS,
    deniedMessage: getGovernedActionReviewDeniedMessage(input.english),
  });
}

export async function assertWorkspaceGovernedCandidatePromotionServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
}) {
  return assertWorkspaceUserCapability({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    capability: WORKSPACE_CAPABILITIES.PROMOTE_GOVERNED_CANDIDATES,
    deniedMessage: getGovernedCandidatePromotionDeniedMessage(input.english),
  });
}

export async function assertWorkspacePolicyServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
}) {
  return assertWorkspaceUserCapability({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    capability: WORKSPACE_CAPABILITIES.MANAGE_POLICIES,
    deniedMessage: getWorkspaceGovernanceDeniedMessage(input.english),
  });
}

export async function assertWorkspaceReservedManualSettlementServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
}) {
  const role = await assertWorkspaceManualSettlementServiceAccess(input);
  await assertReservedWorkspaceSurfaceAccess({
    workspaceId: input.workspaceId,
    english: input.english,
    surface: "commercial_registry",
  });
  return role;
}

export async function assertWorkspaceReservedParticipantPortalServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
}) {
  const role = await assertWorkspaceUserCapability({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    capability: WORKSPACE_CAPABILITIES.MANAGE_PARTICIPANT_PORTAL,
    deniedMessage: getParticipantPortalManagementDeniedMessage(input.english),
  });
  await assertReservedWorkspaceSurfaceAccess({
    workspaceId: input.workspaceId,
    english: input.english,
    surface: "participant_portal",
  });
  return role;
}

export async function assertWorkspaceReservedProgramApplicationServiceAccess(input: {
  workspaceId: string;
  userId?: string | null;
  actorType?: ActorType | null;
  english: boolean;
}) {
  const role = await assertWorkspaceUserCapability({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.actorType,
    capability: WORKSPACE_CAPABILITIES.MANAGE_PROGRAM_APPLICATIONS,
    deniedMessage: getProgramApplicationManagementDeniedMessage(input.english),
  });
  await assertReservedWorkspaceSurfaceAccess({
    workspaceId: input.workspaceId,
    english: input.english,
    surface: "program_applications",
  });
  return role;
}
