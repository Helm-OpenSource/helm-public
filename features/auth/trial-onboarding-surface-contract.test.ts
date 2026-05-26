import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const trialOnboardingSurfaceSource = readFileSync(
  "features/auth/trial-onboarding-surface.tsx",
  "utf8",
);
const trialOnboardingHelperSource = readFileSync(
  "lib/auth/trial-onboarding.ts",
  "utf8",
);

describe("trial onboarding surface contract", () => {
  it("routes new trial users toward setup before advanced controls", () => {
    expect(trialOnboardingSurfaceSource).toContain(
      "先完成三件用户任务，再碰详细控制项。",
    );
    expect(trialOnboardingSurfaceSource).toContain('href="#setup-wizard"');
    expect(trialOnboardingSurfaceSource).toContain("继续初始化");
    expect(trialOnboardingSurfaceSource).toContain("团队访问与试用状态");
  });

  it("keeps Chinese onboarding copy away from raw seat and processing jargon", () => {
    expect(trialOnboardingHelperSource).toContain("位活跃成员");
    expect(trialOnboardingHelperSource).toContain("团队访问和购买 / 恢复路径");
    expect(trialOnboardingHelperSource).toContain("高成本智能生成");
    expect(trialOnboardingHelperSource).not.toContain("seat姿态");
    expect(trialOnboardingHelperSource).not.toContain("高成本 processing");
    expect(trialOnboardingHelperSource).not.toContain("active seat");
  });
});
