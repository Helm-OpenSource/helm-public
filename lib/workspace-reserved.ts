import { WorkspaceClass, WorkspaceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  HELM_RESERVED_WORKSPACE_SYSTEM_KEY,
  isHelmReservedWorkspace,
} from "@/lib/workspace-identity";

type ReservedWorkspaceLike = {
  status?: WorkspaceStatus | null;
  workspaceClass?: WorkspaceClass | null;
  systemKey?: string | null;
};

export type HelmReservedWorkspaceSurface =
  | "commercial_registry"
  | "participant_portal"
  | "program_applications"
  | "skill_formal_review";

export function isOperationalHelmReservedWorkspace(
  workspace: ReservedWorkspaceLike | null | undefined,
) {
  return Boolean(workspace && workspace.status !== WorkspaceStatus.CANCELED && isHelmReservedWorkspace(workspace));
}

export function getHelmReservedWorkspaceDeniedMessage(
  english: boolean,
  surface: HelmReservedWorkspaceSurface,
) {
  if (surface === "participant_portal") {
    return english
      ? "Participant portal access stays anchored to the Helm reserved host workspace."
      : "贡献方门户访问只锚定在 Helm 自留 host workspace。";
  }

  if (surface === "program_applications") {
    return english
      ? "Program application review and invite issuance stay reserved for the Helm internal operating workspace."
      : "Program 申请审核和 invite 发放只保留给 Helm 自留经营工作区。";
  }

  if (surface === "skill_formal_review") {
    return english
      ? "Formal skill review stays reserved for the Helm internal operating workspace."
      : "正式能力评审只保留给 Helm 自留经营工作区。";
  }

  return english
    ? "Contributor registry, settlement, program host, and participant portal operations stay reserved for the Helm internal operating workspace."
    : "贡献方登记、结算、program host 和参与者门户运营只保留给 Helm 自留经营工作区。";
}

export function assertHelmReservedWorkspaceAccess(
  workspace: ReservedWorkspaceLike | null | undefined,
  english: boolean,
  surface: HelmReservedWorkspaceSurface,
) {
  if (!isOperationalHelmReservedWorkspace(workspace)) {
    throw new Error(getHelmReservedWorkspaceDeniedMessage(english, surface));
  }
}

export async function resolveHelmReservedWorkspace() {
  const workspace = await db.workspace.findUnique({
    where: {
      systemKey: HELM_RESERVED_WORKSPACE_SYSTEM_KEY,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      defaultLocale: true,
      workspaceClass: true,
      systemKey: true,
    },
  });

  if (!isOperationalHelmReservedWorkspace(workspace)) {
    return null;
  }

  return workspace;
}
