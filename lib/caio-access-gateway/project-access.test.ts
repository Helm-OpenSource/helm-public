import { describe, expect, it } from "vitest";

import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";
import {
  assertProjectAccess,
  type ProjectMembershipResolver,
} from "@/lib/caio-access-gateway/project-access";

function resolverWith(refs: readonly string[]): ProjectMembershipResolver & {
  calls: Array<{ workspaceId: string; userRef: string }>;
} {
  const calls: Array<{ workspaceId: string; userRef: string }> = [];
  return {
    calls,
    async listAccessibleProjectRefs(workspaceId, userRef) {
      calls.push({ workspaceId, userRef });
      return refs;
    },
  };
}

describe("assertProjectAccess", () => {
  it("passes when the live membership includes the project", async () => {
    const resolver = resolverWith(["project:alpha", "project:beta"]);
    await expect(
      assertProjectAccess(resolver, "ws_1", "user:ceo", "project:alpha"),
    ).resolves.toBeUndefined();
    expect(resolver.calls).toEqual([
      { workspaceId: "ws_1", userRef: "user:ceo" },
    ]);
  });

  it("throws a typed 403 project_access_revoked when absent", async () => {
    const resolver = resolverWith(["project:alpha"]);
    try {
      await assertProjectAccess(resolver, "ws_1", "user:ceo", "project:beta");
      throw new Error("Expected project_access_revoked.");
    } catch (error) {
      expect(error).toBeInstanceOf(CaioAccessGatewayError);
      expect((error as CaioAccessGatewayError).code).toBe(
        "project_access_revoked",
      );
      expect((error as CaioAccessGatewayError).wireStatus).toBe(403);
    }
  });

  it("resolves membership live per request so revocation is immediate", async () => {
    let refs: readonly string[] = ["project:alpha"];
    const resolver: ProjectMembershipResolver = {
      async listAccessibleProjectRefs() {
        return refs;
      },
    };
    await expect(
      assertProjectAccess(resolver, "ws_1", "user:ceo", "project:alpha"),
    ).resolves.toBeUndefined();
    refs = [];
    await expect(
      assertProjectAccess(resolver, "ws_1", "user:ceo", "project:alpha"),
    ).rejects.toMatchObject({ code: "project_access_revoked" });
  });
});
