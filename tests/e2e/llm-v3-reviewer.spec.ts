import { expect, test, type Page, type TestInfo } from "@playwright/test";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const FORBIDDEN_ACTION_NAME =
  /(?:approve|reject|apply|import|send|write\s*back|promote|activate|批准|拒绝|应用|导入|发送|写回|晋级|激活)/iu;

const TABS = [
  { tab: "judgement", panel: "judgement" },
  { tab: "source", panel: "source" },
  { tab: "trajectory", panel: "trajectory" },
  { tab: "boundary", panel: "boundary" },
] as const;

function trackRuntimeFailures(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return { consoleErrors, pageErrors };
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const visible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;

        return visible && (rect.left < -1 || rect.right > viewportWidth + 1);
      })
      .slice(0, 10)
      .map((element) => ({
        tag: element.tagName,
        testId: element.dataset.testid ?? null,
        className: element.className,
      }));

    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth,
      offenders,
    };
  });

  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1);
  expect(overflow.offenders).toEqual([]);
}

async function verifyReadOnlyReview(
  page: Page,
  testInfo: TestInfo,
  screenshotName: string,
) {
  const mutationRequests: string[] = [];
  page.on("request", (request) => {
    if (MUTATION_METHODS.has(request.method())) {
      mutationRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  const runtimeFailures = trackRuntimeFailures(page);

  await page.goto("/demo/llm-review");
  await expect(page).toHaveURL(/\/demo\/llm-review$/u);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    /Helm LLM V3/u,
  );
  await expect(page.getByTestId("llm-v3-review-panel")).toHaveAttribute(
    "data-llm-review-readonly",
    "true",
  );
  await expect(page.getByTestId("llm-v3-review-panel")).toHaveAttribute(
    "data-llm-review-candidate-authority",
    "candidate_only",
  );
  await expect(page.getByTestId("llm-v3-review-error")).toHaveCount(0);
  await expect(page.getByTestId("llm-review-candidate-boundary")).toContainText(
    /allow_candidate/u,
  );
  await expect(page.getByTestId("llm-review-candidate-boundary")).toContainText(
    /不等于已批准|does not mean approved/iu,
  );

  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(page.locator("button:not([role='tab'])")).toHaveCount(0);
  await expect(page.locator("form")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: FORBIDDEN_ACTION_NAME }),
  ).toHaveCount(0);

  mutationRequests.length = 0;

  for (const item of TABS) {
    const tab = page.getByTestId(`llm-review-tab-${item.tab}`);
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByTestId(`llm-review-panel-${item.panel}`),
    ).toBeVisible();
  }

  const firstTab = page.getByTestId("llm-review-tab-judgement");
  const secondTab = page.getByTestId("llm-review-tab-source");
  await firstTab.focus();
  await expect(firstTab).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(secondTab).toBeFocused();
  await expect(secondTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("llm-review-panel-source")).toBeVisible();

  for (const item of TABS) {
    await page.getByTestId(`llm-review-tab-${item.tab}`).click();
    const disclosure = page.getByTestId(`llm-review-disclosure-${item.tab}`);
    await disclosure.locator("summary").click();
    await expect(disclosure).toHaveAttribute("open", "");
  }

  await page.getByRole("link", { name: /演示首页|Demo index/u }).focus();
  await expect(page.getByRole("link", { name: /演示首页|Demo index/u })).toBeFocused();

  await expectNoHorizontalOverflow(page);
  expect(mutationRequests).toEqual([]);
  expect(runtimeFailures.consoleErrors).toEqual([]);
  expect(runtimeFailures.pageErrors).toEqual([]);

  await page.screenshot({
    path: testInfo.outputPath(screenshotName),
    fullPage: true,
  });
}

test.describe("LLM V3 reviewer · desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("stays public synthetic, read-only, keyboard reachable, and mutation free", async ({
    page,
  }, testInfo) => {
    await verifyReadOnlyReview(page, testInfo, "llm-v3-review-desktop.png");
  });
});

test.describe("LLM V3 reviewer · mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("keeps four evidence tabs readable without overlap or overflow", async ({
    page,
  }, testInfo) => {
    await verifyReadOnlyReview(page, testInfo, "llm-v3-review-mobile.png");
  });
});
