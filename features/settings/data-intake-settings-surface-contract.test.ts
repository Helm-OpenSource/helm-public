import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settingsClientSource = readFileSync(
  "features/settings/settings-client.tsx",
  "utf8",
);
const settingsActionSource = readFileSync("features/settings/actions.ts", "utf8");

describe("settings data intake surface contract", () => {
  it("puts resource access catalog and proof package before live connector operations", () => {
    const catalogIndex = settingsClientSource.indexOf(
      'data-testid="resource-access-catalog"',
    );
    const proofPackageIndex = settingsClientSource.indexOf(
      'data-testid="signal-first-mile-proof-viewer"',
    );
    const connectorIndex = settingsClientSource.indexOf("Read-only connectors");

    expect(catalogIndex).toBeGreaterThan(-1);
    expect(proofPackageIndex).toBeGreaterThan(catalogIndex);
    expect(connectorIndex).toBeGreaterThan(proofPackageIndex);
  });

  it("keeps connector page copy read-only and review-first", () => {
    expect(settingsClientSource).toContain("getResourceAccessCatalog");
    expect(settingsClientSource).toContain("getProofPackageFiles");
    expect(settingsClientSource).toContain(
      "Connecting or syncing does not authorize writeback, external send, approval execution, or customer deployment.",
    );
    expect(settingsClientSource).toContain(
      "连接或同步不授权写回、外发、审批执行或客户部署",
    );
  });

  it("does not persist setup source-intake defaults as connected connectors", () => {
    expect(settingsActionSource).toContain('status: "diagnostic_selected"');
    expect(settingsActionSource).not.toContain('status: "connected",');
    expect(settingsClientSource).toContain("formatSourceIntakeLabel");
    expect(settingsClientSource).toContain(
      "Source intake selection from setup wizard",
    );
    expect(settingsClientSource).toContain("初始化向导中的数据来源诊断选择");
    expect(settingsClientSource).not.toContain(
      "Demo connector state from setup wizard",
    );
    expect(settingsClientSource).not.toContain("初始化向导中的演示连接状态");
  });
});
