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

  it("routes demo choices through a native demo start path from the global fallback", () => {
    const source = readFileSync(
      path.join(process.cwd(), "app/loading.tsx"),
      "utf8",
    );
    const startRouteSource = readFileSync(
      path.join(process.cwd(), "app/demo/start/route.ts"),
      "utf8",
    );

    expect(source).toContain('data-testid="loading-recovery-demo-choices"');
    expect(source).toContain(
      'data-testid="loading-recovery-workspace-shortcuts"',
    );
    expect(source).toContain("getDemoModeProfiles(locale)");
    expect(source).toContain('action="/demo/start"');
    expect(source).toContain('method="post"');
    expect(source).toContain('name="mode"');
    expect(source).toContain("`进入${mode.badge}`");
    expect(source).not.toContain("loginAction(accountEmail)");
    expect(source).not.toContain("action={enterDemoWorkspace}");
    expect(source).not.toContain("withLoadingRecoveryFragmentReset(");
    expect(startRouteSource).toContain("export async function POST");
    expect(startRouteSource).toContain("createSession({");
    expect(startRouteSource).toContain("withLoadingRecoveryFragmentReset(");
    expect(startRouteSource).toContain("function resolveRedirectOrigin");
    expect(startRouteSource).toContain('request.headers.get("host")');
    expect(startRouteSource).toContain(
      "new URL(targetPath, resolveRedirectOrigin(request))",
    );
    expect(source).toContain("/approvals#approval-queue");
    expect(source).toContain("/memory#memory-work-timeline");
    expect(source).toContain(
      "/opportunities?mine=1&action=priority#opportunity-judgement-workspace",
    );
    expect(source).toContain('href: "/search"');
    expect(source).toContain("打开全局搜索");
    expect(source).toContain('const demoRecoveryBaseHref = "/demo"');
    expect(source).toContain("const publicRecoveryHref = copy.publicHref");
    expect(source).toContain('const currentPageRetryHref = ""');
    expect(source).toContain("const dashboardRecoveryHref = copy.dashboardHref || dashboardRecoveryBaseHref");
    expect(source).toContain(
      "const demoRecoveryHref = copy.demoHref || demoRecoveryBaseHref",
    );
    expect(source).toContain('href: "/operating"');
    expect(source).toContain("打开经营总盘");
    expect(source).toContain("href={currentPageRetryHref}");
    expect(source).toContain("aria-label={copy.dashboardCta}");
    expect(source).toContain("href={dashboardRecoveryHref}");
    expect(source).toContain("href={publicRecoveryHref}");
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
