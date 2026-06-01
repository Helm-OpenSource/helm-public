import { describe, expect, it } from "vitest";
import { WorkspaceRole } from "@prisma/client";
import {
  canExportMemory,
  canManageMemoryFacts,
  canManageWorkspaceMemory,
  getMemoryExportDeniedMessage,
  getMemoryManagementDeniedMessage,
  getMemoryFactManagementDeniedMessage,
} from "@/lib/memory/permissions";

describe("memory permission helpers", () => {
  it("keeps export on owner/admin/operator/reviewer only", () => {
    for (const role of [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OPERATOR,
      WorkspaceRole.REVIEWER,
    ]) {
      expect(canExportMemory(role)).toBe(true);
    }

    for (const role of [WorkspaceRole.BILLING_ADMIN, WorkspaceRole.MEMBER]) {
      expect(canExportMemory(role)).toBe(false);
    }
  });

  it("keeps fact management on the same operational review surface", () => {
    for (const role of [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OPERATOR,
      WorkspaceRole.REVIEWER,
    ]) {
      expect(canManageWorkspaceMemory(role)).toBe(true);
      expect(canManageMemoryFacts(role)).toBe(true);
    }

    for (const role of [WorkspaceRole.BILLING_ADMIN, WorkspaceRole.MEMBER]) {
      expect(canManageWorkspaceMemory(role)).toBe(false);
      expect(canManageMemoryFacts(role)).toBe(false);
    }
  });

  it("returns localized denial copy", () => {
    expect(getMemoryExportDeniedMessage(true)).toContain("export");
    expect(getMemoryExportDeniedMessage(false)).toContain("导出");
    expect(getMemoryManagementDeniedMessage(true)).toContain("manage workspace memory");
    expect(getMemoryManagementDeniedMessage(false)).toContain("管理工作区记忆记录");
    expect(getMemoryFactManagementDeniedMessage(true)).toContain("manage workspace memory");
    expect(getMemoryFactManagementDeniedMessage(false)).toContain("管理工作区记忆记录");
  });
});
