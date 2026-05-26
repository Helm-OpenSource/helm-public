import { WorkspaceClass, WorkspaceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  getHelmReservedWorkspaceDeniedMessage,
  isOperationalHelmReservedWorkspace,
} from "@/lib/workspace-reserved";

describe("workspace reserved helpers", () => {
  it("requires the reserved class, system key and a non-canceled workspace", () => {
    expect(
      isOperationalHelmReservedWorkspace({
        status: WorkspaceStatus.ACTIVE,
        workspaceClass: WorkspaceClass.HELM_RESERVED,
        systemKey: "helm_reserved_primary",
      }),
    ).toBe(true);

    expect(
      isOperationalHelmReservedWorkspace({
        status: WorkspaceStatus.ACTIVE,
        workspaceClass: WorkspaceClass.CUSTOMER,
        systemKey: "helm_reserved_primary",
      }),
    ).toBe(false);

    expect(
      isOperationalHelmReservedWorkspace({
        status: WorkspaceStatus.CANCELED,
        workspaceClass: WorkspaceClass.HELM_RESERVED,
        systemKey: "helm_reserved_primary",
      }),
    ).toBe(false);
  });

  it("returns surface-specific denied messages", () => {
    expect(getHelmReservedWorkspaceDeniedMessage(true, "program_applications")).toContain(
      "Program application review and invite issuance stay reserved",
    );
    expect(getHelmReservedWorkspaceDeniedMessage(true, "participant_portal")).toContain(
      "Participant portal access stays anchored",
    );
    expect(getHelmReservedWorkspaceDeniedMessage(false, "skill_formal_review")).toContain(
      "正式能力评审只保留给 Helm 自留经营工作区",
    );
  });
});
