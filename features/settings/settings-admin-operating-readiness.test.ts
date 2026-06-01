import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settingsClientSource = readFileSync(
  "features/settings/settings-client.tsx",
  "utf8",
);
const settingsOverviewPanelsSource = readFileSync(
  "features/settings/components/settings-overview-panels.tsx",
  "utf8",
);

describe("settings admin operating readiness contract", () => {
  it("surfaces tenant admin readiness before detailed configuration", () => {
    expect(settingsOverviewPanelsSource).toContain(
      'data-testid="settings-admin-operating-readiness"',
    );
    expect(settingsOverviewPanelsSource).toContain("经营可推进性");
    expect(settingsOverviewPanelsSource).toContain("入口在线");
    expect(settingsOverviewPanelsSource).toContain("可用信号");
    expect(settingsOverviewPanelsSource).toContain("人工复核");
    expect(settingsOverviewPanelsSource).toContain("成本姿态");
    expect(settingsOverviewPanelsSource).toContain(
      "今天的事，在当前控制下能不能推进？",
    );
  });

  it("keeps the simplified admin surface grounded in existing tenant signals", () => {
    expect(settingsClientSource).toMatch(
      /connectedConnectorCount:\s*data\.integrationSummary\.connectedConnectorCount/,
    );
    expect(settingsClientSource).toContain(
      "connectorErrorCount: data.integrationSummary.connectorErrorCount",
    );
    expect(settingsClientSource).toContain(
      "importedSignalCount: data.integrationSummary.importedSignalCount",
    );
    expect(settingsClientSource).toContain(
      "pendingApprovals: data.governanceSummary.pendingApprovals",
    );
    expect(settingsClientSource).toMatch(
      /approvalProtectedActions:\s*data\.governanceSummary\.approvalProtectedActions/,
    );
    expect(settingsClientSource).toContain(
      "llmFallbacks7d: data.governanceSummary.llmFallbacks7d",
    );
  });

  it("preserves review-first boundaries and concrete work entries", () => {
    expect(settingsOverviewPanelsSource).toContain(
      "不自动改规则、不自动提交审批、不自动发送消息。",
    );
    expect(settingsOverviewPanelsSource).toContain('href: "/settings?tab=connectors"');
    expect(settingsOverviewPanelsSource).toContain('href: "/imports"');
    expect(settingsOverviewPanelsSource).toContain('href: "/approvals"');
    expect(settingsOverviewPanelsSource).toContain('href: "/settings?tab=budgets"');
  });
});
