/**
 * Per-request live workspace operation gate.
 *
 * Project visibility answers which business object a caller may see. It never
 * grants a mutation. Mutating gateway routes must additionally resolve the
 * dedicated workspace capability on every request.
 */

import type { WorkspaceCapability } from "@/lib/auth/authorization";
import { CaioAccessGatewayError } from "./gateway-error-contract";

export type WorkspaceOperationCapabilityResolver = Readonly<{
  hasWorkspaceOperationCapability(
    workspaceId: string,
    userRef: string,
    capability: WorkspaceCapability,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<boolean>;
}>;

export async function assertWorkspaceOperationCapability(
  resolver: WorkspaceOperationCapabilityResolver,
  workspaceId: string,
  userRef: string,
  capability: WorkspaceCapability,
  signal?: AbortSignal,
): Promise<void> {
  const allowed = await resolver.hasWorkspaceOperationCapability(
    workspaceId,
    userRef,
    capability,
    signal ? { signal } : undefined,
  );
  if (!allowed) {
    throw new CaioAccessGatewayError("operation_access_revoked");
  }
}
