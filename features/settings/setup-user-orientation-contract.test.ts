import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const setupWizardSource = readFileSync(
  "features/settings/setup-wizard.tsx",
  "utf8",
);

describe("setup user orientation contract", () => {
  it("frames first-time setup around user jobs rather than engineering concepts", () => {
    expect(setupWizardSource).toContain('data-testid="setup-user-orientation"');
    expect(setupWizardSource).toContain("确定操盘身份");
    expect(setupWizardSource).toContain("数据来源诊断");
    expect(setupWizardSource).toContain("让该复核的人进来");
    expect(setupWizardSource).toContain("Diagnose source intake");
    expect(setupWizardSource).not.toContain("2 · Signals");
    expect(setupWizardSource).not.toContain("2 · 再接入信号");
    expect(setupWizardSource).not.toContain("Choose the first signal sources");
    expect(setupWizardSource).not.toContain("选择第一批信号来源");
    expect(setupWizardSource).toContain(
      "这个工作区由谁操盘、优先看哪些经营信号、哪些同事需要参与复核",
    );
  });

  it("frames source intake as L0/L1/L2 diagnosis rather than connector authorization", () => {
    expect(setupWizardSource).toContain('data-testid="setup-source-intake"');
    expect(setupWizardSource).toContain("getSourceIntakeOptions");
    expect(setupWizardSource).toContain("getDataIntakeLevels");
    expect(setupWizardSource).toContain("它不授权连接器、生产采集、写回、外发、审批执行或客户部署");
    expect(setupWizardSource).toContain("Available");
    expect(setupWizardSource).toContain("可选");
    expect(setupWizardSource).not.toContain("Connected");
    expect(setupWizardSource).not.toContain("已连接");
    expect(setupWizardSource).not.toContain("Not connected");
    expect(setupWizardSource).not.toContain("未连接");
  });

  it("does not describe setup as granting automatic commitment authority", () => {
    expect(setupWizardSource).not.toContain("auto-do");
    expect(setupWizardSource).not.toContain("自动做什么");
    expect(setupWizardSource).toContain("不自动产生对外承诺");
  });
});
