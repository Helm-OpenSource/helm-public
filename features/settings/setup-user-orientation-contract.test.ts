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
    expect(setupWizardSource).toContain("选择第一批信号来源");
    expect(setupWizardSource).toContain("让该复核的人进来");
    expect(setupWizardSource).toContain(
      "这个工作区由谁操盘、优先看哪些经营信号、哪些同事需要参与复核",
    );
  });

  it("does not describe setup as granting automatic commitment authority", () => {
    expect(setupWizardSource).not.toContain("auto-do");
    expect(setupWizardSource).not.toContain("自动做什么");
    expect(setupWizardSource).toContain("不自动产生对外承诺");
  });
});
