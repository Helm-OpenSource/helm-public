import { expect, test, type Page } from "@playwright/test";

function demoEntryName(email: "founder@demo.com" | "saleslead@demo.com" | "recruiter@demo.com") {
  switch (email) {
    case "founder@demo.com":
      return /进入演示 · 60 秒|Open this · 60 sec/;
    case "saleslead@demo.com":
      return /进入演示 · 60 秒|Open this · 60 sec/;
    default:
      return /进入演示 · 60 秒|Open this · 60 sec/;
  }
}

function demoEntryTestId(email: "founder@demo.com" | "saleslead@demo.com" | "recruiter@demo.com") {
  switch (email) {
    case "founder@demo.com":
      return "demo-entry-founder";
    case "saleslead@demo.com":
      return "demo-entry-sales";
    default:
      return "demo-entry-recruiter";
  }
}

async function waitForWorkspaceUiHydration(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-workspace-density", /comfortable|compact/);
  await expect(page.locator("html")).toHaveAttribute("data-workspace-guidance", /guided|focused/);
  await expect(page.locator("html")).toHaveAttribute("data-workspace-form-assist", /enabled|disabled/);
}

async function loginAs(page: Page, email: "founder@demo.com" | "saleslead@demo.com" | "recruiter@demo.com") {
  await page.goto("/demo");
  await waitForWorkspaceUiHydration(page);
  await expect(page.getByTestId(demoEntryTestId(email))).toHaveText(demoEntryName(email));
  await page.getByTestId(demoEntryTestId(email)).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await waitForWorkspaceUiHydration(page);
}

async function expectBusinessFirstSummaryOnCustomerSuccess(page: Page) {
  const frontstage = page.locator('[data-page-layer="frontstage"]').first();
  await expect(frontstage).toBeVisible();
  await expect(
    frontstage.locator('[data-frontstage-block="current-summary"]'),
  ).toContainText(/当前局面摘要|Current picture/);
  await expect(frontstage).toContainText(/对象状态|Object state/);
  await expect(frontstage).toContainText(/阻塞|Blocker/);
  await expect(frontstage).toContainText(/待决策|Pending decision/);
  await expect(frontstage).toContainText(/下一步动作|Next action/);
  await expect(
    frontstage.locator('[data-frontstage-block="boundary"]'),
  ).toContainText(/边界|Boundary/);
  await expect(frontstage).not.toContainText(/为什么现在需要处理|Why this matters now/);
  await expect(page.locator('[data-narrative-header="true"]')).toHaveCount(0);
}

async function expectBusinessFirstSummaryOnOperatorSurface(page: Page) {
  const main = page.locator("main").first();
  await expect(main).toContainText(/对象状态|Object state/);
  await expect(main).toContainText(/阻塞|Blocker/);
  await expect(main).toContainText(/待决策|Pending decision/);
  await expect(main).toContainText(/下一步动作|Next action/);
  await expect(page.locator('[data-narrative-header="true"]')).toHaveCount(0);
}

async function readFirstLinkedHref(page: Page, routePrefix: string) {
  const links = page.locator(`a[href*="${routePrefix}/"]`);
  const count = await links.count();
  let href: string | null = null;

  for (let i = 0; i < count; i += 1) {
    const candidate = links.nth(i);
    if (await candidate.isVisible()) {
      href = await candidate.getAttribute("href");
      break;
    }
  }

  expect(href).toContain(`${routePrefix}/`);
  return href!;
}

async function openFirstDetailHrefFromList(
  page: Page,
  listRoute: "/companies" | "/contacts" | "/meetings",
) {
  await page.goto(listRoute);
  await expect(page).toHaveURL(new RegExp(`${listRoute}$`));
  await expect(page.locator(`[data-source-page="${listRoute}"]`)).toBeVisible();
  return readFirstLinkedHref(page, listRoute);
}

async function openDashboardWorkEntryRail(page: Page) {
  await page.goto("/dashboard");
  await expect(page.locator('[data-dashboard-work-entry="true"]')).toBeVisible();
  const actionRail = page.locator('[data-dashboard-work-entry-action-rail="true"]');
  await expect(actionRail).toBeVisible();
  await expect(actionRail.getByRole("link", { name: /Open queue|查看队列/ })).toBeVisible();
  await expect(actionRail.getByRole("link", { name: /Open Ask Helm|打开 Ask Helm/ })).toBeVisible();
  await expect(actionRail.getByRole("link", { name: /Open sources|查看数据源/ })).toBeVisible();
  return actionRail;
}

function buildHomeSurfaceEntryHref(href: string, focus: string) {
  const url = new URL(href, "http://localhost");
  url.searchParams.set("entry", "home-surface-detail");
  url.searchParams.set("focus", focus);
  return `${url.pathname}${url.search}${url.hash}`;
}

test("customer-success queue 首屏只保留 business-first 四类信息", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await loginAs(page, "founder@demo.com");
  await page.goto("/customer-success");

  await expect(page.locator('[data-customer-success-queue-surface="true"]')).toBeVisible();
  await expectBusinessFirstSummaryOnCustomerSuccess(page);
  await page.screenshot({
    path: testInfo.outputPath("customer-success-queue-hierarchy.png"),
    fullPage: true,
  });
});

test("contact 与 company detail 只保留一个主标题", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await loginAs(page, "founder@demo.com");

  const companyDetailHref = await openFirstDetailHrefFromList(page, "/companies");
  await page.goto(companyDetailHref);
  await expect(page).toHaveURL(/\/companies\//);
  await expect(page.locator("h1:visible")).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath("company-detail-single-h1.png"),
    fullPage: true,
  });

  const contactDetailHref = await openFirstDetailHrefFromList(page, "/contacts");
  await page.goto(contactDetailHref);
  await expect(page).toHaveURL(/\/contacts\//);
  await expect(page.locator("h1:visible")).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath("contact-detail-single-h1.png"),
    fullPage: true,
  });
});

test("imports 首屏只保留 business-first 四类信息", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await loginAs(page, "founder@demo.com");
  await page.goto("/imports");

  await expect(page).toHaveURL(/\/imports/);
  await expectBusinessFirstSummaryOnOperatorSurface(page);
  await page.screenshot({
    path: testInfo.outputPath("imports-business-first-hierarchy.png"),
    fullPage: true,
  });
});

test("reports/imports/settings/diagnostics/analytics 首屏先暴露用户资产读数", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await loginAs(page, "founder@demo.com");

  const targets = [
    {
      route: "/reports",
      labels: [/当前资产|Current asset/, /当前压力|Pressure/, /待决策|Decision/, /下一步动作|Next action/],
      reference: /引用：洞察权限|Reference: insight permission|引用：交付评审|Reference: delivery review/,
    },
    {
      route: "/imports",
      labels: [/对象状态|Object state/, /阻塞|Blocker/, /待决策|Pending decision/, /下一步动作|Next action/],
      reference: /引用：接入判断|Reference: intake judgement/,
    },
    {
      route: "/settings",
      labels: [/对象状态|Object state/, /阻塞|Blocker/, /待决策|Pending decision/, /下一步动作|Next action/],
      reference: /引用：设置依据|Reference: settings basis/,
    },
    {
      route: "/diagnostics",
      labels: [/对象状态|Object state/, /阻塞|Blocker/, /待决策|Pending decision/, /下一步动作|Next action/],
      reference: /引用：会议回路就绪度|Reference: meeting loop readiness/,
    },
    {
      route: "/analytics",
      labels: [/对象状态|Object state/, /阻塞|Blocker/, /待决策|Pending decision/, /AI 工作姿态|AI work posture/],
      reference: null,
    },
  ] as const;

  for (const target of targets) {
    await page.goto(target.route);
    await expect(page).toHaveURL(new RegExp(target.route));

    const focusStrip = page.locator('[data-customer-asset-focus="true"]').first();
    await expect(focusStrip).toBeVisible();
    await expect(focusStrip.locator("a, button").first()).toBeVisible();

    for (const label of target.labels) {
      await expect(focusStrip).toContainText(label);
    }

    if (target.reference) {
      await expect(page.locator("details").filter({ hasText: target.reference }).first()).toBeVisible();
    }
  }

  await page.screenshot({
    path: testInfo.outputPath("sitewide-customer-asset-focus.png"),
    fullPage: false,
  });
});

test("dashboard 把 explanation / review / memory replay 继续后置到 dedicated surfaces", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await loginAs(page, "founder@demo.com");
  const actionRail = await openDashboardWorkEntryRail(page);
  await expect(page.getByText(/Operating overview|经营概览/)).toHaveCount(0);
  await expect(
    page.locator('[data-dashboard-home-secondary-kind="detailed-readouts"]'),
  ).toHaveCount(0);

  await expect(page.locator('[data-dashboard-home-surface-routing="true"]')).toHaveCount(0);
  await expect(actionRail.getByRole("link", { name: /Open queue|查看队列/ })).toBeVisible();
  await expect(actionRail.getByRole("link", { name: /Open Ask Helm|打开 Ask Helm/ })).toBeVisible();
  await expect(actionRail.getByRole("link", { name: /Open sources|查看数据源/ })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("dashboard-home-work-entry-action-rail.png"),
    fullPage: true,
  });
});

test("dashboard work-entry action rail lands on dedicated work surfaces", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await loginAs(page, "founder@demo.com");

  let actionRail = await openDashboardWorkEntryRail(page);
  await actionRail.getByRole("link", { name: /Open queue|查看队列/ }).click();
  await expect(page).toHaveURL(/\/approvals/);
  await expect(page.locator("#approval-queue")).toBeVisible();

  actionRail = await openDashboardWorkEntryRail(page);
  await actionRail.getByRole("link", { name: /Open Ask Helm|打开 Ask Helm/ }).click();
  await expect(page).toHaveURL(/\/search/);
  await expect(page).toHaveURL(/mode=ask/);
  await expect(page.locator("#ask-helm-signal-intake")).toBeVisible();

  actionRail = await openDashboardWorkEntryRail(page);
  await actionRail.getByRole("link", { name: /Open sources|查看数据源/ }).click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(page).toHaveURL(/tab=connectors/);

  await page.screenshot({
    path: testInfo.outputPath("dashboard-home-work-entry-action-routing.png"),
    fullPage: true,
  });
});

test("contact / company / meeting detail home-entry keep guidance behind dedicated next-layer disclosure", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await loginAs(page, "founder@demo.com");

  const companyDetailHref = await openFirstDetailHrefFromList(page, "/companies");
  await page.goto(buildHomeSurfaceEntryHref(companyDetailHref, "Company account"));
  await expect(page).toHaveURL(/entry=home-surface-detail/);
  await expect(page.locator('[data-home-surface-arrival="detail"]')).toBeVisible();
  await expect(page.locator('[data-home-surface-secondary="detail"]')).toHaveCount(0);
  await expect(page.locator('[data-home-surface-arrival-cta="detail"]')).toHaveCount(0);
  const companyGuidanceEyebrow = page
    .locator(".workspace-eyebrow")
    .filter({ hasText: /Account guidance|账户引导/ });
  await expect(companyGuidanceEyebrow).toBeVisible();

  const contactDetailHref = await openFirstDetailHrefFromList(page, "/contacts");
  await page.goto(buildHomeSurfaceEntryHref(contactDetailHref, "Relationship state"));
  await expect(page).toHaveURL(/entry=home-surface-detail/);
  await expect(page.locator('[data-home-surface-arrival="detail"]')).toBeVisible();
  await expect(page.locator('[data-home-surface-secondary="detail"]')).toHaveCount(0);
  await expect(page.locator('[data-home-surface-arrival-cta="detail"]')).toHaveCount(0);
  const contactGuidanceEyebrow = page
    .locator(".workspace-eyebrow")
    .filter({ hasText: /Relationship guidance|关系引导/ });
  await expect(contactGuidanceEyebrow).toBeVisible();

  const meetingDetailHref = await openFirstDetailHrefFromList(page, "/meetings");
  await page.goto(buildHomeSurfaceEntryHref(meetingDetailHref, "Meeting follow-through"));
  await expect(page).toHaveURL(/entry=home-surface-detail/);
  await expect(page.locator('[data-home-surface-arrival="detail"]')).toBeVisible();
  await expect(page.locator('[data-home-surface-secondary="detail"]')).toHaveCount(0);
  await expect(page.locator('[data-home-surface-arrival-cta="detail"]')).toHaveCount(0);
  const meetingGuidanceEyebrow = page
    .locator(".workspace-eyebrow")
    .filter({ hasText: /Meeting guidance|会议引导/ });
  await expect(meetingGuidanceEyebrow).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("detail-home-entry-next-layer-disclosures.png"),
    fullPage: true,
  });
});
