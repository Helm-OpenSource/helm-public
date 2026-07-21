import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const SCREENSHOT_DIR = "/tmp/helm-stage1-owner-loop";

async function openDemoWorkspace(
  page: Page,
  role: "founder" | "sales",
) {
  await page.goto("/demo");
  await page.getByTestId(`demo-entry-${role}`).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator("html")).toHaveAttribute(
    "data-workspace-density",
    /comfortable|compact/,
  );
}

async function expectCaioGovernance(consoleLocator: Locator) {
  await expect(consoleLocator).toContainText("Helm CAIO｜一号位 AI 经营中枢");
  const governance = consoleLocator.locator(
    '[data-caio-console-governance="true"]',
  );
  await expect(governance).toBeVisible();
  await expect(governance).toContainText(
    "直属并只向 CEO 汇报 · 当前为只读、复核优先",
  );
  await expect(
    consoleLocator.locator('[data-caio-console-stage-current="true"]'),
  ).toHaveText("观察（已成形）");
  await expect(
    consoleLocator.locator('[data-caio-console-stage="orchestrate"]'),
  ).toHaveText("编排（路线图·默认关闭）");
  await expect(
    consoleLocator.locator('[data-caio-console-stage="authorized_execute"]'),
  ).toHaveText("授权执行（路线图·未授权·默认关闭·不构成执行许可）");
  await expect(governance).toContainText(
    "CAIO 为产品角色定义，不是法定高管身份，也不改变权限",
  );
  await expect(
    consoleLocator.locator('[data-caio-console-axis="maturity"]'),
  ).toHaveText("能力成熟度（非权限轴）：");
}

async function expectMetric(
  page: Page,
  metricKey: string,
  value: string,
  detail: RegExp,
) {
  const metric = page.locator(
    `[data-stage1-owner-loop-metric="${metricKey}"]`,
  );
  await expect(metric).toBeVisible();
  await expect(metric.getByText(value, { exact: true })).toBeVisible();
  await expect(metric).toContainText(detail);
}

test.describe("Stage 1 owner loop synthetic proof", () => {
  test("OWNER sees the review-first operating loop with truthful evidence", async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemoWorkspace(page, "founder");

    const console = page.locator('[data-stage1-owner-loop-console="true"]');
    await expect(console).toBeVisible();
    await expect(console.getByRole("heading", { level: 2 })).toHaveText(
      "有事项待拍板",
    );
    await expect(console).toContainText(
      "只读经营视图。建议需一把手确认；本面板不执行、不外发、不产生承诺。",
    );
    await expectCaioGovernance(console);
    await expectMetric(page, "source-health", "1/2", /1 个过时 · 0 个异常/);
    await expectMetric(page, "owner-decisions", "1", /1 项跟进中/);
    await expectMetric(page, "open-supervision", "1", /0 个严重 · 1 个警告/);
    await expectMetric(page, "verified-receipts", "1/1", /质量 92\/100 · 0 个缺失/);
    await expect(console).toContainText("synthetic-crm: 健康");
    await expect(console).toContainText("synthetic-finance: 已过时");
    await expect(console.getByRole("link", { name: "审批与验收队列" })).toHaveAttribute(
      "href",
      "/approvals",
    );
    await expect(console.getByRole("link", { name: "候选记忆" })).toHaveAttribute(
      "href",
      "/memory",
    );

    await mkdir(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "owner-loop-desktop.png"),
      fullPage: true,
    });
    expect(browserErrors).toEqual([]);
  });

  test("English locale renders the frozen CAIO wording", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "helm-ui-locale",
        value: "en-US",
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemoWorkspace(page, "founder");
    const console = page.locator('[data-stage1-owner-loop-console="true"]');
    await expect(console).toBeVisible();
    await expect(console).toContainText(
      "Helm CAIO — the AI executive reporting to the CEO",
    );
    await expect(
      console.locator('[data-caio-console-axis="maturity"]'),
    ).toHaveText("Capability maturity (not a permission axis):");
    await expect(
      console.locator('[data-caio-console-stage-current="true"]'),
    ).toHaveText("Observe (formed)");
    await expect(
      console.locator('[data-caio-console-stage="authorized_execute"]'),
    ).toHaveText(
      "Authorized Execute (roadmap · unauthorized · disabled by default · not an execution permit)",
    );
    await expect(console).toContainText(
      "CAIO is a product role definition, not a legal officer or an authorization",
    );
  });

  test("non-OWNER cannot see the owner operating loop", async ({ page }) => {
    await openDemoWorkspace(page, "sales");
    await expect(
      page.locator('[data-stage1-owner-loop-console="true"]'),
    ).toHaveCount(0);
  });

  test("owner operating loop remains readable without horizontal overflow on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDemoWorkspace(page, "founder");

    const console = page.locator('[data-stage1-owner-loop-console="true"]');
    await expect(console).toBeVisible();
    await expectCaioGovernance(console);
    const dimensions = await console.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(
      dimensions.clientWidth + 1,
    );

    await mkdir(SCREENSHOT_DIR, { recursive: true });
    await console.screenshot({
      path: path.join(SCREENSHOT_DIR, "owner-loop-mobile.png"),
    });
  });
});
