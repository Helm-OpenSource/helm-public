/**
 * Per-request live project membership gate.
 *
 * Tokens NEVER embed project lists or project claims: a CAIO access token
 * only proves who is calling (workspace/user/client/device binding).
 * Which projects that caller may touch is resolved live on every request
 * through the injected ProjectMembershipResolver, so a membership
 * revocation takes effect immediately — there is no cached or embedded
 * grant that could keep a revoked caller inside a project.
 */

import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";

export type ProjectMembershipResolver = Readonly<{
  listAccessibleProjectRefs(
    workspaceId: string,
    userRef: string,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<readonly string[]>;
}>;

/**
 * Throws a typed 403-class `project_access_revoked` error when the user's
 * live membership does not include the requested project.
 */
export async function assertProjectAccess(
  resolver: ProjectMembershipResolver,
  workspaceId: string,
  userRef: string,
  projectRef: string,
  signal?: AbortSignal,
): Promise<void> {
  const accessible = await resolver.listAccessibleProjectRefs(
    workspaceId,
    userRef,
    signal ? { signal } : undefined,
  );
  if (!accessible.includes(projectRef)) {
    throw new CaioAccessGatewayError("project_access_revoked");
  }
}
