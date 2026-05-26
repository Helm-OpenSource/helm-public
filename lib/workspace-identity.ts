import { WorkspaceClass } from "@prisma/client";

export const HELM_RESERVED_WORKSPACE_SYSTEM_KEY = "helm_reserved_primary" as const;

type ReservedWorkspaceLike = {
  workspaceClass?: WorkspaceClass | null;
  systemKey?: string | null;
};

type EngineeringDeliveryReviewWorkspaceLike = ReservedWorkspaceLike & {
  slug?: string | null;
};

type TenantHealthWorkspaceLike = ReservedWorkspaceLike & {
  slug?: string | null;
};

export function isHelmReservedWorkspace(workspace: ReservedWorkspaceLike | null | undefined) {
  return (
    workspace?.workspaceClass === WorkspaceClass.HELM_RESERVED &&
    workspace.systemKey === HELM_RESERVED_WORKSPACE_SYSTEM_KEY
  );
}

export function canAccessTenantHealthWorkspace(
  workspace: TenantHealthWorkspaceLike | null | undefined,
) {
  return isHelmReservedWorkspace(workspace);
}

export function canViewEngineeringDeliveryReview(
  workspace: EngineeringDeliveryReviewWorkspaceLike | null | undefined,
) {
  return isHelmReservedWorkspace(workspace);
}
