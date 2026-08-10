import { describe, expect, it, vi } from "vitest";

import { WORKSPACE_CAPABILITIES } from "@/lib/auth/authorization";
import {
  assertWorkspaceOperationCapability,
  type WorkspaceOperationCapabilityResolver,
} from "./operation-access";

describe("workspace operation capability gate", () => {
  it("allows only a live operation grant for the exact workspace and caller", async () => {
    const resolver: WorkspaceOperationCapabilityResolver = {
      hasWorkspaceOperationCapability: vi.fn(async () => true),
    };

    await expect(
      assertWorkspaceOperationCapability(
        resolver,
        "workspace-1",
        "user:executor-1",
        WORKSPACE_CAPABILITIES.SUBMIT_PRIVATE_EXECUTION_RESULT,
      ),
    ).resolves.toBeUndefined();
    expect(resolver.hasWorkspaceOperationCapability).toHaveBeenCalledWith(
      "workspace-1",
      "user:executor-1",
      WORKSPACE_CAPABILITIES.SUBMIT_PRIVATE_EXECUTION_RESULT,
      undefined,
    );
  });

  it("does not treat project visibility as operation permission", async () => {
    const resolver: WorkspaceOperationCapabilityResolver = {
      hasWorkspaceOperationCapability: vi.fn(async () => false),
    };

    await expect(
      assertWorkspaceOperationCapability(
        resolver,
        "workspace-1",
        "user:executor-1",
        WORKSPACE_CAPABILITIES.SUBMIT_PRIVATE_EXECUTION_RESULT,
      ),
    ).rejects.toMatchObject({ code: "operation_access_revoked" });
  });
});
