import { mkdir } from "node:fs/promises";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

const SCREENSHOT_DIR = "/tmp/helm-visual-audit";

async function waitForWorkspaceUiHydration(page: Page) {
  await expect(page.locator("html")).toHaveAttribute(
    "data-workspace-density",
    /comfortable|compact/,
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-workspace-guidance",
    /guided|focused/,
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-workspace-form-assist",
    /enabled|disabled/,
  );
}

async function loginViaDemo(page: Page) {
  await page.goto("/demo");
  await waitForWorkspaceUiHydration(page);
  const founderEntry = page.getByTestId("demo-entry-founder");
  await founderEntry.click();
  await expect(page).toHaveURL(/\/dashboard/);
  await waitForWorkspaceUiHydration(page);
}

async function snap(page: Page, name: string) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

test.describe("Visual audit — highest-risk pages before company-wide trial", () => {
  test("public login page (PC)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await snap(page, "login-pc");
  });

  test("public login page (mobile)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/login");
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await snap(page, "login-mobile");
  });

  test("dashboard (PC)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaDemo(page);
    await snap(page, "dashboard-pc");
  });

  test("mobile first screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginViaDemo(page);
    await page.goto("/mobile");
    await waitForWorkspaceUiHydration(page);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await snap(page, "mobile-first-screen");
  });

  test("operating page with new per-item badges (PC, viewport)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaDemo(page);
    await page.goto("/operating");
    await waitForWorkspaceUiHydration(page);
    await expect(page.locator('[data-source-page="/operating"]')).toBeVisible();
    await expect(page.locator("[data-operating-signal-flow-map='true']")).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/operating-pc-expanded.png`,
      fullPage: false,
    });
  });

  test("opportunities page (PC, viewport)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaDemo(page);
    await page.goto("/opportunities");
    await waitForWorkspaceUiHydration(page);
    await expect(page.locator('[data-customer-asset-focus="true"]')).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/opportunities-pc-viewport.png`,
      fullPage: false,
    });
  });

  test("approvals (PC, viewport)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaDemo(page);
    await page.goto("/approvals");
    await waitForWorkspaceUiHydration(page);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/approvals-pc-viewport.png`,
      fullPage: false,
    });
  });

  test("settings — LLM permission notice position fix (PC, viewport)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaDemo(page);
    await page.goto("/settings");
    await waitForWorkspaceUiHydration(page);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const advancedDisclosure = page
      .getByText(/Advanced: judgement service settings|高级：判断服务设置|高级：判断服务/)
      .first();
    await expect(advancedDisclosure).toBeVisible({ timeout: 15000 });
    await advancedDisclosure.click();
    const assistiveServiceSave = page.getByTestId("settings-assistive-service-save");
    await expect(assistiveServiceSave).toBeVisible({ timeout: 10000 });
    await assistiveServiceSave.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/settings-llm-area.png`,
      fullPage: false,
    });
  });

  test("dashboard PC login redirect investigation", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/demo");
    await waitForWorkspaceUiHydration(page);
    await page.getByTestId("demo-entry-founder").click();
    // Don't assert URL — just wait for whatever loads
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/dashboard-pc-actual-landing.png`,
      fullPage: false,
    });
  });

  test("identity-completion page (PC) — first-time user lands here", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Login first to get session, then force-render identity completion via query param
    await loginViaDemo(page);
    await page.goto("/getting-started?mode=identity-completion");
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/identity-completion-pc.png`,
      fullPage: true,
    });
  });

  test("identity-completion page (mobile) — first-time mobile user", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginViaDemo(page);
    await page.goto("/getting-started?mode=identity-completion");
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/identity-completion-mobile.png`,
      fullPage: true,
    });
  });

  test("search ask-helm — empty state with example chips", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaDemo(page);
    await page.goto("/search?mode=ask");
    await waitForWorkspaceUiHydration(page);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await snap(page, "search-ask-empty");
  });

  // ─── Round 2: secondary surfaces (memory / reports / inbox / capture / health / setup) ───

  test("memory page (PC, viewport)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaDemo(page);
    await page.goto("/memory");
    await waitForWorkspaceUiHydration(page);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/memory-pc.png`,
      fullPage: false,
    });
  });

  test("reports page (PC, viewport)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaDemo(page);
    await page.goto("/reports");
    await waitForWorkspaceUiHydration(page);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/reports-pc.png`,
      fullPage: false,
    });
  });

  test("inbox page (PC, viewport)", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaDemo(page);
    await page.goto("/inbox");
    await waitForWorkspaceUiHydration(page);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/inbox-pc.png`,
      fullPage: false,
    });
  });

  test("capture page (PC, viewport)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaDemo(page);
    await page.goto("/capture");
    await waitForWorkspaceUiHydration(page);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/capture-pc.png`,
      fullPage: false,
    });
  });

  test("health page (PC, viewport)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/health");
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/health-pc.png`,
      fullPage: false,
    });
  });

  test("dashboard mobile (375x812)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginViaDemo(page);
    await page.goto("/dashboard");
    await waitForWorkspaceUiHydration(page);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/dashboard-mobile.png`,
      fullPage: false,
    });
  });

  test("approvals mobile (375x812)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginViaDemo(page);
    await page.goto("/approvals");
    await waitForWorkspaceUiHydration(page);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/approvals-mobile.png`,
      fullPage: false,
    });
  });
});
