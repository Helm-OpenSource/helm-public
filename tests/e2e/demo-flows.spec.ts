import { expect, test, type Page } from "@playwright/test";

const founderShellHeadline =
  "给创始人和 COO 看的，是跨销售、合作、内部冲突的一体化经营前台";

const dashboardStoryByDemoMode = {
  founder: "今天必须由创始人拍板的 3 件事：原因、截止时间和下一步动作。",
  sales: "不是又一个销售看板。是「今天必须打的 3 个电话——不打就要凉」。",
  recruiter: "本周哪位终面在降温 / 哪条反馈已逾期 / 哪个职位的压力是真的。",
} as const;

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

async function openDemoWorkspace(
  page: Page,
  email: "founder@demo.com" | "saleslead@demo.com" | "recruiter@demo.com",
) {
  await page.goto("/demo");
  await waitForWorkspaceUiHydration(page);
  await expect(page.getByTestId(demoEntryTestId(email))).toHaveText(demoEntryName(email));
  await page.getByTestId(demoEntryTestId(email)).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await waitForWorkspaceUiHydration(page);
}

test("公开首页采用左侧品牌与三条起始线、右侧手机登录、顶部极简切换", async ({ page }) => {
  await page.goto("/?view=public");

  const hero = page.getByTestId("home-hero");
  const paths = page.getByTestId("home-paths");
  const controls = page.getByTestId("public-landing-controls");
  const thesis = page.getByTestId("home-thesis");
  const boundary = page.getByTestId("home-boundary");
  const scenarios = page.getByTestId("home-scenarios");

  await expect(hero).toBeVisible();
  await expect(paths).toBeVisible();
  await expect(controls).toBeVisible();
  await expect(thesis).toBeVisible();
  await expect(boundary).toBeVisible();
  await expect(scenarios).toBeVisible();

  await expect(page.getByTestId("home-path-demo")).toBeVisible();
  await expect(page.getByTestId("home-path-trial")).toBeVisible();
  await expect(page.getByTestId("home-path-login")).toBeVisible();
  await expect(page.getByTestId("home-scenario-founder")).toBeVisible();
  await expect(page.getByTestId("home-scenario-enter-founder")).toBeVisible();
  await expect(page.getByTestId("home-scenario-enter-sales")).toBeVisible();
  await expect(page.getByTestId("home-scenario-enter-recruiter")).toBeVisible();
  await expect(page.getByTestId("public-landing-locale-switcher")).toBeVisible();
  await expect(page.getByTestId("public-landing-locale-switcher-zh-CN")).toBeVisible();
  await expect(page.getByTestId("public-landing-locale-switcher-en-US")).toBeVisible();
  await expect(page.locator('[data-testid^="home-scenario-enter-"]')).toHaveCount(3);
});

test("登录页手机号下一步会把新手机号直接送入正式注册", async ({ page }) => {
  const phone = `139${String(Date.now()).slice(-8)}`;

  await page.goto("/login?tab=phone");
  await expect(page.getByTestId("login-returning-entry-disclosure")).toHaveAttribute("open", "");
  await page.getByTestId("phone-login-phone").fill(phone);
  await page.getByTestId("phone-login-request").click();

  await expect(page).toHaveURL(/\/login\?tab=signup/);
  await expect(page.getByTestId("verified-trial-phone")).toHaveValue(new RegExp(phone));
});

test("登录页手机号输入会限制为 11 位数字并在无效时禁用下一步", async ({ page }) => {
  await page.goto("/login?tab=phone");
  await expect(page.getByTestId("login-returning-entry-disclosure")).toHaveAttribute("open", "");

  const phoneInput = page.getByTestId("phone-login-phone");
  const nextButton = page.getByTestId("phone-login-request");

  await phoneInput.fill("abc12");
  await expect(phoneInput).toHaveValue("12");
  await expect(page.getByTestId("phone-login-phone-error")).toBeVisible();
  await expect(nextButton).toBeDisabled();

  await phoneInput.fill("138 0013 8000 999");
  await expect(phoneInput).toHaveValue("13800138000");
  await expect(page.getByTestId("phone-login-phone-error")).toHaveCount(0);
  await expect(nextButton).toBeEnabled();
});

test("钉钉注册预填通过临时 cookie 注入登录页", async ({ page }) => {
  await page.goto("/?view=public");
  const origin = new URL(page.url()).origin;
  const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();
  await page.context().addCookies([
    {
      name: "helm-public-oauth-signup-prefill",
      value: JSON.stringify({
        provider: "dingtalk",
        name: "Test User",
        email: "new-user@helm.so",
        phone: "+8613800138000",
        expiresAt,
      }),
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/login?tab=signup&provider=dingtalk&prefill=1");
  await expect(page.getByTestId("verified-trial-name")).toHaveValue("Test User");
  await expect(page.getByTestId("verified-trial-email")).toHaveValue("new-user@helm.so");
  await expect(page.getByTestId("verified-trial-phone")).toHaveValue("13800138000");
});
async function loginAs(page: Page, email: "founder@demo.com" | "saleslead@demo.com" | "recruiter@demo.com") {
  await openDemoWorkspace(page, email);
}

test("demo 入口可以直接进入三种演示工作区", async ({ page }) => {
  await openDemoWorkspace(page, "founder@demo.com");
  await expect(page.getByText(dashboardStoryByDemoMode.founder)).toBeVisible();

  await openDemoWorkspace(page, "saleslead@demo.com");
  await expect(page.getByText(dashboardStoryByDemoMode.sales)).toBeVisible();

  await openDemoWorkspace(page, "recruiter@demo.com");
  await expect(page.getByText(dashboardStoryByDemoMode.recruiter)).toBeVisible();
});

async function openFirstSuccessCheckFromCustomerSuccessQueue(page: Page) {
  await page.goto("/customer-success");
  await expect(page.locator('[data-customer-success-queue-surface="true"]')).toBeVisible();
  const firstQueueItem = page.locator("[data-customer-success-queue-item]").first();
  await expect(firstQueueItem).toBeVisible();
  const successCheckHref = await firstQueueItem
    .getByRole("link", { name: /打开成功复盘|Open success review/ })
    .getAttribute("href");
  expect(successCheckHref).toMatch(/\/success-checks\//);
  await page.goto(successCheckHref!);
  await expect(page).toHaveURL(/\/success-checks\//);
}

function visibleHeadings(page: Page) {
  return page.locator("h1:visible, h2:visible, h3:visible, h4:visible, h5:visible, h6:visible");
}

async function expectDesktopFirstVisibleHeadingIsPageTitle(page: Page) {
  const pageTitle = page.locator("h1:visible").first();
  const pageTitleText = ((await pageTitle.textContent()) ?? "").trim();

  expect(pageTitleText.length).toBeGreaterThan(0);
  await expect(visibleHeadings(page).first()).toHaveText(pageTitleText);
  await expect(visibleHeadings(page).first()).not.toHaveText(founderShellHeadline);
}

async function countVisibleExactText(page: Page, text: string) {
  return page.evaluate((rawText) => {
    const root = document.querySelector("main") ?? document.body;
    const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
    const expected = normalize(rawText);

    return Array.from(root.querySelectorAll("*")).filter((node) => {
      const element = node as HTMLElement;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        rect.width === 0 ||
        rect.height === 0
      ) {
        return false;
      }

      if (normalize(element.textContent ?? "") !== expected) {
        return false;
      }

      return !Array.from(element.children).some(
        (child) => normalize((child as HTMLElement).textContent ?? "") === expected,
      );
    }).length;
  }, text);
}

async function expectJudgementAppearsOnce(page: Page) {
  const judgement = (
    (await page.locator(".workspace-accent-card .workspace-accent-card-value").first().textContent()) ??
    ""
  ).trim();

  expect(judgement.length).toBeGreaterThan(0);
  expect(await countVisibleExactText(page, judgement)).toBe(1);
  await expect(page.locator('[data-narrative-header="true"]')).toHaveCount(0);
}

async function readFirstLinkedHref(page: Page, routePrefix: string) {
  const link = page.locator(`a[href*="${routePrefix}/"]`).first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");

  expect(href).toContain(`${routePrefix}/`);
  return href!;
}

function collectHydrationWarnings(page: Page) {
  const warnings: Array<{ url: string; text: string }> = [];
  const handler = (message: { text(): string }) => {
    const text = message.text();

    if (
      /hydration|didn't match|server rendered HTML|hydrated but some attributes/i.test(
        text,
      )
    ) {
      warnings.push({
        url: page.url(),
        text,
      });
    }
  };

  page.on("console", handler);

  return {
    warnings,
    dispose() {
      page.off("console", handler);
    },
  };
}

test("founder 主演示链路可以从首页进入会议再到审批", async ({ page }, testInfo) => {
  await loginAs(page, "founder@demo.com");
  const meetingsQuickPath = page.getByRole("link", {
    name: /会议页看会后闭环|See post-meeting loop on the meeting page/,
  });
  await expect(meetingsQuickPath).toBeVisible({ timeout: 20000 });
  const meetingsHref = await meetingsQuickPath.getAttribute("href");
  expect(meetingsHref).toBe("/meetings");
  await page.goto(meetingsHref!);

  await expect(page).toHaveURL(/\/meetings$/);
  const meetingHref = await readFirstLinkedHref(page, "/meetings");
  await page.goto(meetingHref);

  await expect(page).toHaveURL(/\/meetings\//);
  const submitSummaryButton = page.getByRole("button", {
    name: "生成纪要并送审",
  });
  await expect(submitSummaryButton).toBeVisible();
  await submitSummaryButton.click();
  await expect(page).toHaveURL(/\/approvals/);
  await expect(page.locator("[data-page-decision-request]").first()).toBeVisible();
  await expect(page.getByText(/会议会后动作确认|Meeting follow-through review/)).toBeVisible();
  await expect(page.getByRole("button", { name: /打开第一条草稿|Open first draft/ })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("founder-approvals.png"), fullPage: true });
});

test("深色模式和命令面板可用", async ({ page }, testInfo) => {
  await loginAs(page, "saleslead@demo.com");

  await page.getByRole("button", { name: /切换到深色模式|切换到浅色模式/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const commandModifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.press(`${commandModifier}+K`);
  await expect(page.getByRole("heading", { name: "命令面板" })).toBeVisible();
  await page
    .getByPlaceholder("搜索联系人、公司、机会、会议，或直接执行动作")
    .fill("赵敏");
  await expect(page.getByRole("button", { name: "赵敏 联系人 打开" })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("dashboard-dark-command.png"), fullPage: true });
});

test("深色主题和本地页面偏好下关键页面不会触发 hydration mismatch 警报", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("helm-theme", "dark");
    window.localStorage.setItem("helm-workspace-layout-density", "compact");
    window.localStorage.setItem("helm-workspace-guidance-mode", "focused");
    window.localStorage.setItem("helm-workspace-form-assist", "disabled");
  });

  const tracker = collectHydrationWarnings(page);

  try {
    await page.goto("/login");
    await page.waitForTimeout(1200);
    await expect(page.locator("html")).toHaveAttribute(
      "data-workspace-density",
      "compact",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-workspace-guidance",
      "focused",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-workspace-form-assist",
      "disabled",
    );

    expect(tracker.warnings).toEqual([]);
  } finally {
    tracker.dispose();
  }
});

test("机会高级筛选可用", async ({ page }) => {
  await loginAs(page, "saleslead@demo.com");
  await page.goto("/opportunities");
  await waitForWorkspaceUiHydration(page);

  await expect(page.locator('[data-proactive-flow="sales-delivery-package-window"]')).toBeVisible();
  await page.getByTestId("opportunity-risk-filter").click();
  await page.getByRole("option", { name: "高风险" }).click();
  await expect(page.getByText(/系统建议推进顺序|建议推进顺序/, { exact: true })).toBeVisible();
  await expect(page.getByText("高风险机会", { exact: true })).toBeVisible();
});

test("可以载入本地阿里邮箱示例数据并在收件箱看到真实来源标识", async ({ page }) => {
  await loginAs(page, "founder@demo.com");
  await page.goto("/settings?tab=connectors");

  const mockButton = page.getByRole("button", { name: /载入本地.*示例数据|Load local demo data/i }).first();
  if (await mockButton.isVisible().catch(() => false)) {
    await mockButton.click();
    await expect(
      page
        .getByText(/已同步 3 条示例阿里邮箱线程|已接入本地模拟阿里邮箱数据|Local mock Aliyun data connected/)
        .first(),
    ).toBeVisible();
  } else {
    const syncButton = page.getByRole("button", { name: /立即同步|Sync now/i }).first();
    await expect(syncButton).toBeVisible();
    await syncButton.click();
    await expect(
      page.getByText(/已同步 3 条示例阿里邮箱线程|已同步本地 mock 阿里邮箱数据|Aliyun Mail sync completed/).first(),
    ).toBeVisible();
  }

  await page.goto("/inbox");
  await expect(page.getByText("真实邮件数据").first()).toBeVisible();
  await page.getByRole("button", { name: /Acme 采购评估下一步|候选人 Leo 终面协调|Atlas 联合内容合作范围/ }).first().click();
  await expect(page.getByText("只读说明：当前接入阿里邮箱 IMAP/SMTP 权限，不会回写或发送邮件。")).toBeVisible();
});

test("desktop 下首个可见 heading 仍然是页面自己的 h1", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await loginAs(page, "founder@demo.com");

  await page.goto("/dashboard");
  await expectDesktopFirstVisibleHeadingIsPageTitle(page);
  await page.screenshot({
    path: testInfo.outputPath("dashboard-heading-order.png"),
    fullPage: true,
  });

  await page.goto("/customer-success");
  await expect(page.locator('[data-customer-success-queue-surface="true"]')).toBeVisible();
  const customerSuccessDetailHref = await page
    .locator("[data-customer-success-queue-item]")
    .first()
    .getByRole("link", { name: /打开接手页|Open handoff/ })
    .getAttribute("href");
  expect(customerSuccessDetailHref).toMatch(/\/customer-success\//);
  await page.goto(customerSuccessDetailHref!);
  await expect(page).toHaveURL(/\/customer-success\//);
  await expectDesktopFirstVisibleHeadingIsPageTitle(page);
  await page.screenshot({
    path: testInfo.outputPath("customer-success-detail-heading-order.png"),
    fullPage: true,
  });
});

test("联系人 CSV 可以预览并导入", async ({ page }) => {
  await loginAs(page, "founder@demo.com");
  await page.goto("/imports");
  await waitForWorkspaceUiHydration(page);
  await expect(page.getByTestId("import-file-contacts")).toHaveCount(1);

  await page.getByTestId("import-file-contacts").setInputFiles({
    name: "contacts.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("姓名,邮箱,公司名,职位,负责人\n测试联系人,test.import@example.com,Import Labs,运营经理,林舟", "utf8"),
  });

  await page.getByTestId("import-preview-contacts").click();
  await expect(page.getByText("第 2 行")).toBeVisible();
  await page.getByTestId("import-run-contacts").click();
  await expect(page.getByText("导入完成：成功 1 行")).toBeVisible();
  await page.getByTestId("import-results-open-contacts").click();
  await expect(page).toHaveURL(/\/search/);
  await expect(page.getByRole("heading", { name: /找客户、机会、会议；需要判断就提问|Find customers, opportunities, meetings, or ask for the next step/ })).toBeVisible();
});

test("customer-success detail judgement 只在首屏主内容里出现一次", async ({
  page,
}, testInfo) => {
  await loginAs(page, "founder@demo.com");
  await page.goto("/customer-success");

  await expect(page.locator('[data-customer-success-queue-surface="true"]')).toBeVisible();
  const firstQueueItem = page.locator("[data-customer-success-queue-item]").first();
  await expect(firstQueueItem).toBeVisible();
  const customerSuccessDetailHref = await firstQueueItem
    .getByRole("link", { name: /打开接手页|Open handoff/ })
    .getAttribute("href");
  expect(customerSuccessDetailHref).toMatch(/\/customer-success\//);
  await page.goto(customerSuccessDetailHref!);

  await expect(page).toHaveURL(/\/customer-success\//);
  const handoffPage = page.locator('[data-customer-success-handoff-page="true"]');
  await expect(handoffPage).toHaveCount(1);
  await expect(handoffPage).toBeVisible();
  await expectJudgementAppearsOnce(page);
  await expect(
    page.getByRole("heading", { name: /客户成功接手面|Customer success handoff/ }),
  ).toBeVisible();
  await expect(handoffPage.locator('[data-action-rail="true"]')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("customer-success-detail-hierarchy.png"),
    fullPage: true,
  });
});

test("success-check 和 company detail 可以 handoff 回 customer-success，且 company detail 不重复 breadcrumb", async ({
  page,
}) => {
  await loginAs(page, "founder@demo.com");
  await openFirstSuccessCheckFromCustomerSuccessQueue(page);

  const successCheckBreadcrumb = page.locator('[data-breadcrumb-trail="true"]').first();
  await expect(
    successCheckBreadcrumb.getByRole("link", { name: /Success check|Success checks/ }),
  ).toHaveCount(0);

  await page
    .getByRole("link", { name: /打开客户成功交接|打开客户成功接手页|打开 customer success handoff|Open customer success handoff/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/customer-success\//);
  await expect(page.locator('[data-customer-success-handoff-page="true"]').first()).toBeVisible();

  await openFirstSuccessCheckFromCustomerSuccessQueue(page);
  const companyDetailHref = await page
    .getByRole("link", { name: /打开公司详情|打开 company detail|Open company detail/ })
    .first()
    .getAttribute("href");
  expect(companyDetailHref).toMatch(/\/companies\//);
  await page.goto(companyDetailHref!);
  await expect(page).toHaveURL(/\/companies\//);
  await expect(page.locator("h1")).toHaveCount(1);

  const breadcrumbTrail = page.locator('[data-breadcrumb-trail="true"]');
  await expect(breadcrumbTrail).toHaveCount(1);
  await expect(
    breadcrumbTrail.first().getByRole("link", { name: /公司|Companies/ }),
  ).toHaveCount(1);
  await expect(
    breadcrumbTrail.first().getByRole("link", { name: /详情|Detail/ }),
  ).toHaveCount(0);

  await page
    .getByRole("link", { name: /打开客户成功交接|打开客户成功接手页|打开 customer success handoff|Open customer success handoff/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/customer-success\//);
  await expect(page.locator('[data-customer-success-handoff-page="true"]').first()).toBeVisible();
});

test("review-request / success-check / expansion-review 的 judgement 不会在首屏重复讲", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await loginAs(page, "founder@demo.com");
  await openFirstSuccessCheckFromCustomerSuccessQueue(page);

  await expect(page.locator('[data-success-check-agent-surface="true"]').first()).toBeVisible();
  await expectJudgementAppearsOnce(page);
  const reviewRequestHref = await readFirstLinkedHref(page, "/review-requests");
  const expansionReviewHref = await readFirstLinkedHref(page, "/expansion-reviews");

  await page.goto(reviewRequestHref);
  await expect(page).toHaveURL(/\/review-requests\//);
  await expect(page.locator('[data-inbox-followup-review-request-page="true"]').first()).toBeVisible();
  await expectJudgementAppearsOnce(page);
  await page.screenshot({
    path: testInfo.outputPath("review-request-hierarchy.png"),
    fullPage: true,
  });

  await page.goto(expansionReviewHref);
  await expect(page).toHaveURL(/\/expansion-reviews\//);
  await expect(page.locator('[data-expansion-review-agent-surface="true"]').first()).toBeVisible();
  await expectJudgementAppearsOnce(page);
  await page.screenshot({
    path: testInfo.outputPath("expansion-review-hierarchy.png"),
    fullPage: true,
  });
});

test("可以生成并查看管理者周报", async ({ page }) => {
  await loginAs(page, "founder@demo.com");
  await page.goto("/reports");

  const generateButton = page.getByRole("button", {
    name: /重新生成本周周报|生成本周周报/,
  });
  await expect(generateButton).toBeVisible();
  await generateButton.click();
  await expect(page.getByText("周报摘要")).toBeVisible();
  await expect(page.getByText(/本周\s*(AI|智能|协同|经营推进)\s*参与/)).toBeVisible();
});
