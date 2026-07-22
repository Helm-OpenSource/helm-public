import "server-only";

import type { WorkspaceLike } from "@/lib/extensions/registry-types";
import type { RoleHomeDestination } from "@/lib/shell/role-home-routing";
import {
  buildRoleHomeCandidateKeys,
  resolveRoleHomeDestinationFromCandidates,
} from "@/lib/shell/role-home-routing";
import {
  resolveShellRoleHomeRouting,
  resolveShellWorkstations,
  SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
} from "@/lib/shell/resolve-shell-experience";
import { resolveWorkspaceSurfaceBinding } from "@/lib/shell/surface-binding-store";

export type MemberRoleHomeWorkstation = {
  key: string;
  href: string;
  label: string;
};

export type MemberRoleHomeResolution = {
  destination: RoleHomeDestination;
  workstation: MemberRoleHomeWorkstation | null;
};

/**
 * Resolve one member's bound role-home destination and its registered
 * workstation. This is navigation metadata only and never grants access.
 */
export async function resolveMemberRoleHome(input: {
  workspace: WorkspaceLike;
  membership: {
    role: string;
    rolePresetKey?: string | null;
    persona?: string | null;
    title?: string | null;
  };
  basePresetKey?: string | null;
  english: boolean;
}): Promise<MemberRoleHomeResolution> {
  const binding = await resolveWorkspaceSurfaceBinding(
    input.workspace.id,
    SHELL_ROLE_HOME_ROUTING_SURFACE_KEY,
  );
  const [{ table }, { workstations }] = await Promise.all([
    resolveShellRoleHomeRouting({
      workspace: input.workspace,
      english: input.english,
      binding,
    }),
    resolveShellWorkstations({
      workspace: input.workspace,
      english: input.english,
    }),
  ]);
  const destination = resolveRoleHomeDestinationFromCandidates(
    table,
    buildRoleHomeCandidateKeys({
      persona: input.membership.persona,
      title: input.membership.title,
      rolePresetKey: input.membership.rolePresetKey,
      basePresetKey: input.basePresetKey,
      workspaceRole: input.membership.role,
    }),
  );
  const workstation =
    destination.kind === "workstation"
      ? (workstations.find((item) => item.key === destination.workstationKey) ??
        null)
      : null;

  return {
    destination,
    workstation: workstation?.href
      ? {
          key: workstation.key,
          href: workstation.href,
          label: workstation.label,
        }
      : null,
  };
}
