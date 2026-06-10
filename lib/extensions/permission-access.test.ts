import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildPermissionPolicyFromManifest } from "@/lib/extensions/permission-manifest";
import {
  buildPermissionedExtensionAccess,
  type ExtensionAccessContext,
} from "@/lib/extensions/permission-access";
import { resolveWorkspaceNavExtensions } from "@/lib/extensions/registry";
import {
  __resetPackRegistryForTest,
  registerPackContributions,
} from "@/lib/extensions/registry-contract";
import manifest from "@/extensions/case-management-sample/permission.manifest.json";

const workspace = {
  id: "workspace-1",
  slug: "workspace-one",
};

const subject = {
  actorType: "user" as const,
  workspaceId: "workspace-1",
  userId: "user-1",
  membershipId: "membership-1",
  membershipStatus: MembershipStatus.ACTIVE,
  workspaceRole: WorkspaceRole.MEMBER,
  policyVersion: "permission-policy/v1",
  auditSource: "session" as const,
};

const policy = buildPermissionPolicyFromManifest(manifest);

describe("subject-aware extension access", () => {
  it("denies extension access when the caller passes only workspace enablement without a subject", async () => {
    const getAccess = buildPermissionedExtensionAccess({
      actionName: "case.read",
      policy,
      resource: {
        kind: "case_record",
        workspaceId: "workspace-1",
        extensionKey: "case-management-sample",
        packKey: "case-management-sample",
        dataClassifications: ["workspace_internal"],
      },
    });

    await expect(getAccess(workspace)).resolves.toMatchObject({
      ok: false,
      failureCode: "no_session",
    });
  });

  it("allows extension access when the descriptor receives a matching permission subject", async () => {
    const getAccess = buildPermissionedExtensionAccess({
      actionName: "case.read",
      policy,
      resource: {
        kind: "case_record",
        workspaceId: "workspace-1",
        extensionKey: "case-management-sample",
        packKey: "case-management-sample",
        dataClassifications: ["workspace_internal"],
      },
    });
    const context: ExtensionAccessContext = {
      subject,
      traceId: "trace-nav-access",
    };

    await expect(getAccess(workspace, context)).resolves.toMatchObject({
      ok: true,
      decision: {
        effect: "allow",
        traceId: "trace-nav-access",
      },
    });
  });

  it("passes access context through workspace navigation extension resolution", async () => {
    __resetPackRegistryForTest();
    try {
      registerPackContributions("sample", {
        workspaceNavExtensions: [
          {
            id: "case-management-sample-nav",
            getAccess: buildPermissionedExtensionAccess({
              actionName: "case.read",
              policy,
              resource: {
                kind: "case_record",
                workspaceId: "workspace-1",
                extensionKey: "case-management-sample",
                packKey: "case-management-sample",
                dataClassifications: ["workspace_internal"],
              },
            }),
            buildCluster: () => ({
              extensionKey: "case-management-sample",
              label: "Case Management",
              items: [
                {
                  key: "case-day-board",
                  href: "/cases",
                  label: "Cases",
                  iconKey: "shield-check",
                },
              ],
            }),
          },
        ],
      });

      await expect(
        resolveWorkspaceNavExtensions({
          workspace,
          english: true,
          accessContext: { subject, traceId: "trace-nav" },
        }),
      ).resolves.toEqual({
        clusters: [
          {
            extensionKey: "case-management-sample",
            label: "Case Management",
            items: [
              {
                key: "case-day-board",
                href: "/cases",
                label: "Cases",
                iconKey: "shield-check",
              },
            ],
          },
        ],
      });
    } finally {
      __resetPackRegistryForTest();
    }
  });
});
