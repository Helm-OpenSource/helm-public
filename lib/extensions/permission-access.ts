import {
  evaluatePermission,
  type PermissionPolicy,
  type PermissionResource,
} from "@/lib/auth/permission-policy";
import type {
  ExtensionAccessContext,
  ExtensionAccessProbe,
  ExtensionAccessResult,
  WorkspaceLike,
} from "@/lib/extensions/registry-types";

export function buildPermissionedExtensionAccess(input: {
  actionName: string;
  policy: PermissionPolicy;
  resource:
    | PermissionResource
    | ((workspace: WorkspaceLike, context?: ExtensionAccessContext) => PermissionResource);
}): ExtensionAccessProbe {
  return async (workspace, context): Promise<ExtensionAccessResult> => {
    const resource =
      typeof input.resource === "function"
        ? input.resource(workspace, context)
        : input.resource;
    const decision = evaluatePermission({
      subject: context?.subject ?? null,
      resource,
      actionName: input.actionName,
      policy: input.policy,
      traceId: context?.traceId ?? `extension-access:${input.actionName}`,
    });

    return {
      ok: decision.effect === "allow",
      reason: decision.reason,
      failureCode: decision.failureCode,
      decision,
    };
  };
}
