import { expect, test, type Page } from "@playwright/test";

// /operating used to open with a signal flow map drawn from the evals fixture
// pack, not from workspace data. Object first (CLAUDE.md "Object-first"): the
// fixture map is gone, the ranked work list follows the header, and system
// judgement sits in one collapsed block at the end.
//
// /operating 过去以 evals fixture 驱动的信号流图开场，不读工作区数据。对象优先后，
// fixture 图已移除，页头之后先是工作清单，系统判断收在末尾唯一的折叠块里。

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
  await page.getByTestId("demo-entry-founder").click();
  await expect(page).toHaveURL(/\/dashboard/);
  await waitForWorkspaceUiHydration(page);
}

test("operating home leads with the work list instead of the fixture signal flow map", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginViaDemo(page);
  await page.goto("/operating");
  await waitForWorkspaceUiHydration(page);

  const surface = page.locator('[data-source-page="/operating"]');
  await expect(surface).toBeVisible();
  await expect(page.locator('[data-operating-signal-flow-map="true"]')).toHaveCount(0);
  await expect(page.locator("h1")).toHaveCount(1);

  const workList = page.locator('[data-operating-work-list="true"]');
  await expect(workList).toBeVisible();
  await expect(workList.locator("[data-operating-review-actions]")).toBeVisible();

  const order = await surface.evaluate((root) => ({
    afterHeader: root.children[1]?.getAttribute("data-operating-work-list") ?? null,
    last: root.lastElementChild?.matches("details[data-system-judgement]") ?? false,
  }));
  expect(order.afterHeader).toBe("true");
  expect(order.last).toBe(true);

  const judgement = page.locator("details[data-system-judgement]");
  await expect(judgement).toHaveCount(1);
  await expect(judgement).not.toHaveAttribute("open", "");
  await judgement.locator(":scope > summary").click();
  await expect(judgement).toHaveAttribute("open", "");
  await expect(judgement.locator('[data-operating-read-only-note="true"]')).toBeVisible();
  await expect(judgement.locator('[data-operating-runtime-evidence="true"]')).toBeVisible();
});
