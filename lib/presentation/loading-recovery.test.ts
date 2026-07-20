import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLoadingRecoveryCopy,
  withLoadingRecoveryFragmentReset,
} from "@/lib/presentation/loading-recovery";

describe("loading recovery copy", () => {
  it("keeps the Chinese loading state recoverable and non-executing", () => {
    const copy = getLoadingRecoveryCopy(false);

    expect(copy.eyebrow).toBe("入口确认");
    expect(copy.title).toBe("正在准备当前页面");
    expect(copy.primaryCta).toBe("回到登录入口");
    expect(copy.secondaryCta).toBe("重试当前页面");
    expect(copy.dashboardCta).toBe("打开工作台");
    expect(copy.dashboardHref).toBe("/dashboard");
    expect(copy.demoCta).toBe("打开演示入口");
    expect(copy.demoHref).toBe("/demo");
    expect(copy.publicCta).toBe("打开公开首页");
    expect(copy.publicHref).toBe("/?view=public#entry");
    expect(copy.assurance).toContain("不会生成报告");
    expect(copy.assurance).toContain("对外发送");
  });

  it("keeps the English loading state actionable instead of generic", () => {
    const copy = getLoadingRecoveryCopy(true);
    const visibleCopy = Object.values(copy).join(" ");

    expect(copy.primaryCta).toBe("Return to sign in");
    expect(copy.secondaryCta).toBe("Retry current page");
    expect(copy.dashboardCta).toBe("Open workspace");
    expect(copy.dashboardHref).toBe("/dashboard");
    expect(copy.demoCta).toBe("Open demo entry");
    expect(copy.demoHref).toBe("/demo");
    expect(copy.publicCta).toBe("Open public home");
    expect(copy.publicHref).toBe("/?view=public#entry");
    expect(copy.assurance).toContain("No report");
    expect(visibleCopy).not.toContain("Loading Helm operating console");
  });

  it("keeps the global loading boundary neutral and non-interactive", () => {
    const source = readFileSync(
      path.join(process.cwd(), "app/loading.tsx"),
      "utf8",
    );

    expect(source).toContain('data-testid="global-route-loading"');
    expect(source).toContain('aria-busy="true"');
    expect(source).toContain("正在读取当前页面");
    expect(source).toContain("Loading this page");
    expect(source).toContain("不会审批、发送或写入业务数据");
    expect(source).not.toContain("loading-recovery-actions");
    expect(source).not.toContain("loading-recovery-demo-choices");
    expect(source).not.toContain("loading-recovery-workspace-shortcuts");
    expect(source).not.toContain('action="/demo/start"');
    expect(source).not.toContain("getDemoModeProfiles");
    expect(source).not.toContain("getLoadingRecoveryCopy");
  });

  it("prevents stale fragments from carrying into demo recovery redirects", () => {
    expect(withLoadingRecoveryFragmentReset("/dashboard")).toBe("/dashboard#");
    expect(withLoadingRecoveryFragmentReset("/dashboard?view=sales")).toBe(
      "/dashboard?view=sales#",
    );
    expect(withLoadingRecoveryFragmentReset("/approvals#approval-queue")).toBe(
      "/approvals#approval-queue",
    );
  });

  it("keeps slow meeting detail navigation specific, bounded and recoverable", () => {
    const source = readFileSync(
      path.join(process.cwd(), "app/(workspace)/meetings/[id]/loading.tsx"),
      "utf8",
    );

    expect(source).toContain('data-testid="meeting-detail-loading"');
    expect(source).toContain("正在加载会议闭环");
    expect(source).toContain("运行态信号");
    expect(source).toContain("不会审批、发送或对外写入");
    expect(source).toContain('href: "/meetings"');
    expect(source).toContain('href: "/approvals#approval-queue"');
    expect(source).toContain("<PageSkeleton columns={3} rows={3} />");
  });

  it("keeps workspace route loading meaningful instead of a silent skeleton", () => {
    const source = readFileSync(
      path.join(process.cwd(), "app/(workspace)/loading.tsx"),
      "utf8",
    );
    const skeletonSource = readFileSync(
      path.join(process.cwd(), "components/shared/page-skeleton.tsx"),
      "utf8",
    );

    expect(source).toContain('testId="workspace-route-loading"');
    expect(source).toContain("正在打开工作区页面");
    expect(source).toContain("复核姿态");
    expect(source).toContain("不会审批、发送、对外写入或修改高风险状态");
    expect(source).toContain('href: ""');
    expect(source).toContain("重试当前页面");
    expect(source).toContain('href: "/search"');
    expect(source).toContain("打开全局搜索");
    expect(source).toContain('href: "/dashboard"');
    expect(source).toContain('href: "/approvals#approval-queue"');
    expect(skeletonSource).toContain("type PageSkeletonAction");
    expect(skeletonSource).toContain("data-testid={testId}");
    expect(skeletonSource).toContain("actions.map((action)");
  });
});
