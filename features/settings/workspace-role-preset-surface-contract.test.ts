import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const actionsSource = readFileSync("features/settings/actions.ts", "utf8");
const settingsClientSource = readFileSync("features/settings/settings-client.tsx", "utf8");
const memberDefinitionCardSource = readFileSync(
  "features/settings/member-definition-card.tsx",
  "utf8",
);

describe("workspace role preset settings contract", () => {
  it("uses the workspace catalog for both member creation and definition editing", () => {
    expect(settingsClientSource).toContain("listWorkspaceRolePresetOptions");
    expect(settingsClientSource).toContain("resolveWorkspaceRolePresetKey");
    expect(memberDefinitionCardSource).toContain("listWorkspaceRolePresetOptions");
    expect(memberDefinitionCardSource).toContain("workspace.configuration");
  });

  it("validates arbitrary preset keys against the current workspace on the server", () => {
    expect(actionsSource).toContain("rolePresetKey: z.string().trim().min(1).max(96)");
    expect(actionsSource).toContain("getWorkspaceRolePresetDefinition(");
    expect(actionsSource).toContain("getRolePresetCatalogGuardMessage");
    expect(actionsSource).toContain("workspaceConfigurationJson: workspace.configuration");
  });
});
