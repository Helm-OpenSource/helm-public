import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settingsClientSource = readFileSync(
  "features/settings/settings-client.tsx",
  "utf8",
);
const accountSettingsTabSource = readFileSync(
  "features/settings/components/account-settings-tab.tsx",
  "utf8",
);
const settingsOverviewPanelsSource = readFileSync(
  "features/settings/components/settings-overview-panels.tsx",
  "utf8",
);

describe("settings member read-only UI contract", () => {
  it("keeps workspace-wide settings actions capability-gated", () => {
    expect(settingsClientSource).toContain(
      "disabled={pending || !canManagePolicies}",
    );
    expect(settingsClientSource).toContain("canManageWorkspaceSetup ? (");
    expect(settingsClientSource).toContain(
      "canApplyRecommendedPilotPreset={canManageOperationalControls}",
    );
    expect(settingsClientSource).toContain(
      "if (!canManageOperationalControls) {",
    );
    expect(settingsOverviewPanelsSource).toContain(
      "disabled={!canApplyRecommendedPilotPreset}",
    );
    expect(settingsOverviewPanelsSource).toContain(
      "当前角色可以查看这些控制；只有工作区运营管理员才能修改推荐预设。",
    );
  });

  it("keeps LLM provider and model switches read-only without setup capability", () => {
    expect(accountSettingsTabSource).toContain(
      "const canManageWorkspaceSetup = data.organizationSummary.canManageWorkspaceSetup;",
    );
    expect(accountSettingsTabSource).toContain(
      "disabled={!canManageWorkspaceSetup}",
    );
    expect(accountSettingsTabSource).toContain(
      "disabled={pending || !canManageWorkspaceSetup}",
    );
    expect(accountSettingsTabSource).toContain(
      "当前角色可以查看服务状态；服务来源和服务选择需要工作区设置管理员修改。",
    );
  });
});
