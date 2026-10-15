import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSettingsTabForView } from "@/features/settings/types/settings-types";

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
const settingsPageSource = readFileSync("app/(workspace)/settings/page.tsx", "utf8");
const settingsQueriesSource = readFileSync("features/settings/queries.ts", "utf8");
const setupPageSource = readFileSync("app/setup/page.tsx", "utf8");

describe("settings member read-only UI contract", () => {
  it("renders header actions only for viewers who can use them (no disabled buttons)", () => {
    expect(settingsClientSource).toContain(
      "canManagePolicies || canManageWorkspaceSetup ? (",
    );
    expect(settingsClientSource).toMatch(
      /\{canManagePolicies \? \(\s*<Button\s+variant="secondary"\s+onClick=\{restoreDefaults\}\s+disabled=\{pending\}/,
    );
    expect(settingsClientSource).toContain("{canManageWorkspaceSetup ? (");
    expect(settingsClientSource).not.toMatch(
      /<Button variant="secondary" disabled>\s*\{messages\.settings\.rerunSetup\}/,
    );
  });

  it("keeps workspace-wide settings actions capability-gated", () => {
    expect(settingsClientSource).toContain(
      "disabled={pending || !canManagePolicies}",
    );
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

  it("gives members the light view and reviewers a read-only rules tab on top of it", () => {
    expect(settingsClientSource).toContain(
      "settingsAdminView || (data.organizationSummary.policyRulesReadable ?? false);",
    );
    // The rules tab trigger follows policyRulesReadable; budgets/billing/connectors/pilot stay admin-only.
    expect(settingsClientSource).toMatch(
      /\{policyRulesReadable \? \(\s*<TabsTrigger value="policies">/,
    );
    expect(settingsClientSource).toMatch(
      /\{settingsAdminView \? \(\s*<TabsTrigger value="budgets">/,
    );
    // Reviewers see each rule as read-only values, never as disabled controls,
    // and none of the suggestion / adoption / formal-review sections.
    expect(settingsClientSource).toContain('data-settings-policy-readonly="true"');
    expect(settingsClientSource).toMatch(
      /\{settingsAdminView \? \(\s*<>\s*<Card className="workspace-panel-muted">\s*<CardHeader>\s*<CardTitle>\s*\{english \? "Reusable work suggestions"/,
    );
  });

  it("gives members and reviewers the light view: no service section, no walkthrough prompts", () => {
    expect(settingsClientSource).toContain(
      "const settingsAdminView = data.organizationSummary.settingsAdminView ?? true;",
    );
    expect(settingsClientSource).toContain("resolveSettingsTabForView(");
    expect(settingsClientSource).not.toContain("resolveInitialSettingsTab(");
    expect(accountSettingsTabSource).toContain(
      "const settingsAdminView = data.organizationSummary.settingsAdminView ?? true;",
    );
    expect(accountSettingsTabSource).not.toContain("Walkthrough readiness prompts");
    expect(accountSettingsTabSource).not.toContain("走查前提醒");
  });

  it("puts the organisation and the viewer's identity first", () => {
    const organizationCardIndex = settingsClientSource.indexOf("<SettingsOrganizationCard");
    expect(organizationCardIndex).toBeGreaterThan(-1);
    expect(organizationCardIndex).toBeLessThan(settingsClientSource.indexOf("<Tabs "));
    expect(accountSettingsTabSource).toContain('data-settings-organization-facts="true"');
    expect(accountSettingsTabSource).toContain('data-settings-viewer-identity="true"');
    expect(accountSettingsTabSource).toContain('english ? "Your role" : "你的角色"');
  });
});

describe("settings member-side load contract", () => {
  it("gates the workspace-wide loads and the live LLM probe behind settings administration", () => {
    expect(settingsPageSource).toContain(
      "const settingsAdminView = canAdministerWorkspaceSettings(input.viewerRole);",
    );
    expect(settingsPageSource).toMatch(
      /const connectionProbe = settingsAdminView\s*\?\s*await probeOpenAICompatibleModels\(/,
    );
    expect(settingsPageSource).toContain(": buildSkippedConnectionProbe();");
    expect(settingsPageSource).toMatch(
      /getSettingsData\(input\.workspaceId, input\.userId, \{\s*role: input\.viewerRole,/,
    );
    expect(settingsQueriesSource).toContain(
      "const settingsAdminView = viewer ? canAdministerWorkspaceSettings(viewer.role) : true;",
    );
    expect(settingsQueriesSource).toContain(
      ": buildLightViewBillingSnapshot(viewer?.accessState);",
    );
    // 21 Promise.all loads are admin-only; the policy rows load for reviewers
    // too; the light view keeps workspace, memberships, notifications and the
    // viewer's organisations (see settings-viewer-loads.test.ts).
    expect(settingsQueriesSource.match(/adminOnly\(/g)?.length ?? 0).toBeGreaterThanOrEqual(21);
    expect(settingsQueriesSource).toContain(
      "const policyRulesReadable = viewer ? canReadWorkspacePolicyRules(viewer.role) : true;",
    );
    expect(settingsQueriesSource).toMatch(
      /policyRulesReadable\s*\?\s*db\.policyRule\.findMany\(/,
    );
  });

  it("never hands full User rows (passwordHash) to client components", () => {
    expect(settingsQueriesSource).toContain(
      "const memberships = membershipRows.map(({ user, ...membership }) => ({",
    );
    expect(settingsQueriesSource).toContain(
      "user: { id: user.id, name: user.name, email: user.email },",
    );
    expect(setupPageSource).toContain(
      "user: { id: member.user.id, name: member.user.name, email: member.user.email },",
    );
  });
});

describe("settings tab resolution by view", () => {
  it("keeps every tab for viewers who administer settings", () => {
    for (const tab of ["account", "billing", "connectors", "policies", "budgets", "permissions", "pilot"]) {
      expect(resolveSettingsTabForView(tab, true)).toBe(tab);
    }
  });

  it("falls back to the account tab for admin-only deep links in the member view", () => {
    expect(resolveSettingsTabForView("permissions", false)).toBe("permissions");
    expect(resolveSettingsTabForView("account", false)).toBe("account");
    for (const tab of ["billing", "connectors", "policies", "budgets", "pilot", "unknown", null]) {
      expect(resolveSettingsTabForView(tab, false)).toBe("account");
      expect(resolveSettingsTabForView(tab, false, false)).toBe("account");
    }
  });

  it("lets reviewers open the rules tab and nothing else beyond the light view", () => {
    expect(resolveSettingsTabForView("policies", false, true)).toBe("policies");
    expect(resolveSettingsTabForView("permissions", false, true)).toBe("permissions");
    for (const tab of ["billing", "connectors", "budgets", "pilot"]) {
      expect(resolveSettingsTabForView(tab, false, true)).toBe("account");
    }
  });
});
