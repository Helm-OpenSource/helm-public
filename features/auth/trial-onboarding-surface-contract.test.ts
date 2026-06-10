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

  it("keeps trial date labels bilingual instead of using Chinese dates in English mode", () => {
    expect(trialOnboardingSurfaceSource).toContain(
      'return locale === "en-US" ? "Not set yet" : "尚未设置";',
    );
    expect(trialOnboardingSurfaceSource).toContain(
      'return format(value, "MMM d, yyyy");',
    );
    expect(trialOnboardingSurfaceSource).toContain(
      'return format(value, "yyyy年M月d日", { locale: zhCN });',
    );
    expect(trialOnboardingSurfaceSource).toContain(
      "{english ? \"Trial ends\" : \"试用结束\"}：{formatDateLabel(data.trialEndsAt, locale)}",
    );
    expect(trialOnboardingSurfaceSource).toContain(
      "{english ? \"Grace ends\" : \"宽限期结束\"}：{formatDateLabel(data.graceEndsAt, locale)}",
    );
  });
});
