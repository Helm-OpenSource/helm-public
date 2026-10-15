import { expect, test, type Locator, type Page } from "@playwright/test";

// 对象优先第 1 波的浏览器回归：联系人 → 机会 → 复核主路径，以及今天、会议、公司三页的结构。
// Object-first wave 1 browser regression: the contacts → opportunity → approval
// path, plus the dashboard, meetings and companies page structure. Runs in CI
// through `npm run e2e:browser` against a migrated and seeded MySQL.

const judgementPhrases =
  /当前压力|下一步判断|缺结果口径|Helm 提醒|人类主导|依据与来源|为什么现在需要处理|现在先改什么/;

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

async function openFounderDemo(page: Page) {
  await page.goto("/demo");
  await waitForWorkspaceUiHydration(page);
  await page.getByTestId("demo-entry-founder").click();
  await expect(page).toHaveURL(/\/dashboard/);
  await waitForWorkspaceUiHydration(page);
}

async function openSourcePage(page: Page, route: string) {
  await page.goto(route);
  await waitForWorkspaceUiHydration(page);
  const root = page.locator(`[data-source-page="${route}"]`).first();
  await expect(root).toBeVisible();
  return root;
}

async function expectObjectFirstStructure(root: Locator) {
  expect(await root.locator("[data-system-judgement]").count()).toBeLessThanOrEqual(1);
  await expect(root.locator("details[data-system-judgement][open]")).toHaveCount(0);
  const outsideJudgement = await root.evaluate((node) => {
    const clone = node.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll("[data-system-judgement]")
      .forEach((block) => block.remove());
    return clone.textContent ?? "";
  });
  expect(outsideJudgement).not.toMatch(judgementPhrases);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("object-first wave 1", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await openFounderDemo(page);
  });

  test("contacts → opportunity → approval path keeps object-first pages", async ({ page }) => {
    const contacts = await openSourcePage(page, "/contacts");
    await expect(
      page.getByRole("heading", { level: 1, name: /^(联系人|Contacts)$/ }),
    ).toBeVisible();
    await expect(contacts).not.toContainText(
      /沉默最久|gone cold longest|下一步处理关系|Next relationship action/,
    );
    await expectObjectFirstStructure(contacts);

    const firstContact = contacts.locator('a[href^="/contacts/"]').first();
    await expect(firstContact).toBeVisible();
    const contactHref = await firstContact.getAttribute("href");
    expect(contactHref).toMatch(/^\/contacts\/.+/);
    await firstContact.click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(contactHref!)}$`));

    const contactsAgain = await openSourcePage(page, "/contacts");
    await contactsAgain
      .getByRole("link", { name: /打开机会面|Open opportunities/ })
      .click();
    await expect(page).toHaveURL(/\/opportunities/);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    await openSourcePage(page, "/dashboard");
    const rail = page.locator('[data-dashboard-work-entry-action-rail="true"]');
    await expect(rail).toBeVisible();
    await rail.getByRole("link", { name: /Open queue|查看队列/ }).click();
    await expect(page).toHaveURL(/\/approvals/);
    await expect(page.locator("#approval-queue")).toBeVisible();
  });

  test("dashboard drops the fixed headline and folds candidates into one closed block", async ({ page }) => {
    const dashboard = await openSourcePage(page, "/dashboard");
    await expect(
      page.getByRole("heading", { level: 1, name: /今天的工作|Today's work/ }),
    ).toBeVisible();
    await expect(dashboard).not.toContainText(/拍板的 3 件事|3 calls that need you/);
    await expectObjectFirstStructure(dashboard);

    const rail = page.locator('[data-dashboard-work-entry-action-rail="true"]');
    await expect(rail.getByRole("link", { name: /Add a work signal|上报信号/ })).toBeVisible();
    await expect(rail.getByRole("link", { name: /Open sources|查看数据源/ })).toBeVisible();
    await expect(rail).not.toContainText(/真实工作里出现新情况时|If the answer is thin/);
    await expect(
      dashboard.locator('details[data-system-judgement] summary'),
    ).toContainText(/展开候选项与依据|Open ranked candidates and proof/);
  });

  test("meetings and companies lists lead with objects", async ({ page }) => {
    const meetings = await openSourcePage(page, "/meetings");
    await expect(
      page.getByRole("heading", { level: 1, name: /会议清单|Meeting list/ }),
    ).toBeVisible();
    await expect(meetings).not.toContainText(
      /会议推进切片|Meeting OS wedge|当前下一步|边界状态|当前还没收口的地方|Boundary posture/,
    );
    await expectObjectFirstStructure(meetings);

    const companies = await openSourcePage(page, "/companies");
    await expect(
      page.getByRole("heading", { level: 1, name: /^(公司|Companies)$/ }),
    ).toBeVisible();
    await expect(companies).not.toContainText(
      /最需要你介入|needs you most|下一步处理客户|Next account action|成熟度待判断/,
    );
    await expectObjectFirstStructure(companies);
  });
});
