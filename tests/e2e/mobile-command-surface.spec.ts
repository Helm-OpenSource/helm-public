import { expect, test, type Page } from "@playwright/test";

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

async function openDemoWorkspace(page: Page) {
  await page.goto("/demo");
  await waitForWorkspaceUiHydration(page);
  await page.getByTestId("demo-entry-founder").click();
  await expect(page).toHaveURL(/\/dashboard/);
  await waitForWorkspaceUiHydration(page);
}

test.describe("Mobile Command Surface", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openDemoWorkspace(page);
  });

  test("loads the mobile first screen without horizontal overflow", async ({ page }) => {
    await page.goto("/mobile");
    await waitForWorkspaceUiHydration(page);

    await expect(page.getByTestId("mobile-command-surface")).toBeVisible();
    await expect(page.getByTestId("mobile-hero-card")).toBeVisible();
    await expect(page.getByTestId("mobile-hero-badge")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Ask Helm|问 Helm/i })).toHaveCount(0);
    await expect(page.getByTestId("mobile-secondary-work-toggle")).toBeVisible();
    await expect(page.locator("#ask-helm summary")).toContainText(
      /Ask or submit a signal|提问 \/ 上报信号/i,
    );
    await expect(page.getByTestId("mobile-command-footer")).toBeVisible();
    await expect(
      page
        .getByTestId("mobile-command-footer")
        .getByRole("link", { name: /Memory|记忆/i }),
    ).toBeVisible();

    const overflow = await page.locator("body").evaluate((body) => ({
      clientWidth: body.clientWidth,
      scrollWidth: body.scrollWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 10);
  });

  test("keeps Ask Helm query handling inside the mobile read-only surface", async ({ page }) => {
    await page.goto("/mobile");
    await waitForWorkspaceUiHydration(page);

    await page.getByTestId("mobile-secondary-work-toggle").click();
    await page.locator("#ask-helm summary").click();
    await page.getByRole("textbox", { name: /Ask Helm query|问 Helm 问题/ }).fill("今天先推进什么？");
    await page.getByRole("button", { name: /ask|提问/i }).click();
    await expect(page).toHaveURL(/\/mobile\?q=/);

    await expect(page.getByTestId("mobile-ask-helm-answer")).toBeVisible();
    await expect(page.getByTestId("mobile-ask-helm-answer")).toContainText(/Helm|推进|复核/);
  });

  test("keeps hero actions review-first and free of unsafe action copy", async ({ page }) => {
    await page.goto("/mobile");
    await waitForWorkspaceUiHydration(page);

    const unsafeWords = [
      "确认",
      "同意",
      "完成",
      "已发送",
      "已答复",
      "批准",
      "承诺",
      "自动发送",
      "自动审批",
      "自动写回",
      "通知客户",
      "发送邮件",
      "搞定",
    ];
    const actionTexts = await page.getByTestId("mobile-hero-actions").locator("a").allTextContents();

    for (const text of actionTexts) {
      for (const word of unsafeWords) {
        expect(text).not.toContain(word);
      }
    }
  });

  test("keeps recommendation and execution boundary copy visible", async ({ page }) => {
    await page.goto("/mobile");
    await waitForWorkspaceUiHydration(page);

    const pageText = await page.locator("body").textContent();
    expect(pageText ?? "").toMatch(/建议|不代表|复核|暂无紧急事项/);
  });
});
