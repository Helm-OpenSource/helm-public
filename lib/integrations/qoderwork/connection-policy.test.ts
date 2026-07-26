import { WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  canManageExternalAgentConnections,
  validateExternalAgentObservationBinding,
  validateExternalAgentScopeClassification,
} from "./connection-policy";

describe("external agent connection policy", () => {
  it("allows only OWNER and ADMIN to manage device credentials", () => {
    expect(canManageExternalAgentConnections(WorkspaceRole.OWNER)).toBe(true);
    expect(canManageExternalAgentConnections(WorkspaceRole.ADMIN)).toBe(true);
    for (const role of [
      WorkspaceRole.OPERATOR,
      WorkspaceRole.REVIEWER,
      WorkspaceRole.BILLING_ADMIN,
      WorkspaceRole.MEMBER,
    ]) {
      expect(canManageExternalAgentConnections(role)).toBe(false);
    }
  });

  it("requires an active, unexpired program and active read-only sources", () => {
    expect(
      validateExternalAgentObservationBinding({
        now: new Date("2026-07-20T00:00:00.000Z"),
        workspaceId: "workspace-1",
        program: {
          id: "program-1",
          workspaceId: "workspace-1",
          status: "ACTIVE",
          expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        },
        requestedSourceIds: ["source-1", "source-2"],
        sources: [
          { id: "source-1", workspaceId: "workspace-1", programId: "program-1", status: "ACTIVE", accessMode: "file_snapshot" },
          { id: "source-2", workspaceId: "workspace-1", programId: "program-1", status: "ACTIVE", accessMode: "read_only_api" },
        ],
      }),
    ).toEqual([]);
  });

  it("fails closed on cross-workspace, missing, write-capable, or expired bindings", () => {
    const blockers = validateExternalAgentObservationBinding({
      now: new Date("2026-07-20T00:00:00.000Z"),
      workspaceId: "workspace-1",
      program: {
        id: "program-1",
        workspaceId: "workspace-2",
        status: "ACTIVE",
        expiresAt: new Date("2026-07-19T00:00:00.000Z"),
      },
      requestedSourceIds: ["source-1", "source-missing"],
      sources: [
        { id: "source-1", workspaceId: "workspace-1", programId: "program-1", status: "ACTIVE", accessMode: "write_api" },
      ],
    });

    expect(blockers).toEqual(
      expect.arrayContaining([
        "program_workspace_mismatch",
        "program_expired",
        "source_missing_or_out_of_scope",
        "source_access_mode_not_read_only",
      ]),
    );
  });

  it("does not grant internal read projections to a public-only connection", () => {
    expect(validateExternalAgentScopeClassification({
      scopes: ["evidence:propose", "draft:propose"],
      maxDataClassification: "public",
    })).toEqual([]);
    expect(validateExternalAgentScopeClassification({
      scopes: ["context:read", "evidence:propose"],
      maxDataClassification: "public",
    })).toEqual(["internal_read_projection_not_authorized"]);
  });
});
