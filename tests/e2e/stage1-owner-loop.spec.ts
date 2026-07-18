import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

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
