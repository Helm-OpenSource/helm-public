import { expect, test, type Page } from "@playwright/test";

function extractCode(value: string | null) {
  const match = value?.match(/\b\d{6}\b/);
  if (!match) {
    throw new Error(`Unable to extract verification code from: ${value}`);
  }
  return match[0];
}

async function completeIdentitySetupIfNeeded(
  page: Page,
  input: { phone: string; password: string },
) {
  await expect(page).toHaveURL(/\/getting-started\?mode=identity-completion/);
  await expect(page.getByTestId("first-login-identity-completion")).toBeVisible();

  const phoneInput = page.locator("#first-login-phone");
  if ((await phoneInput.count()) > 0) {
    await expect(phoneInput).toBeEditable();
    await phoneInput.fill(input.phone);
    await expect(phoneInput).toHaveValue(input.phone);
  }

  const passwordInput = page.locator("#first-login-password");
  if ((await passwordInput.count()) > 0) {
    await expect(passwordInput).toBeEditable();
    await passwordInput.fill(input.password);
    await expect(passwordInput).toHaveValue(input.password);
    const confirmPasswordInput = page.locator("#first-login-confirm-password");
    await expect(confirmPasswordInput).toBeEditable();
    await confirmPasswordInput.fill(input.password);
    await expect(confirmPasswordInput).toHaveValue(input.password);
  }

  await page.getByRole("button", { name: /保存并继续|Save and continue|继续|Continue/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function waitForWorkspaceUiHydration(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-workspace-density", /comfortable|compact/);
  await expect(page.locator("html")).toHaveAttribute("data-workspace-guidance", /guided|focused/);
  await expect(page.locator("html")).toHaveAttribute("data-workspace-form-assist", /enabled|disabled/);
  await expect(page.getByTestId("login-panel-runtime-ready")).toHaveAttribute("data-ready", "true");
}

test("formal verified signup, setup invite, password login, phone login, and invited-member entry all work", async ({
  browser,
}) => {
  test.setTimeout(120_000);

  const unique = Date.now();
  const ownerEmail = `owner+${unique}@example.com`;
  const invitedEmail = `member+${unique}@example.com`;
  const invitedAutoEmail = `member-auto+${unique}@example.com`;
  const ownerPhone = `139${String(unique).slice(-8)}`;
  const invitedPhone = `138${String(unique).slice(-8)}`;
  const invitedAutoPhone = `137${String(unique).slice(-8)}`;
  const ownerPassword = "Helm2026";
  const invitedPassword = "Member2026";
  const organizationName = `Helm 正式试用 ${unique}`;

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();

  await ownerPage.goto("/login?tab=signup");
  await waitForWorkspaceUiHydration(ownerPage);
  await ownerPage.getByTestId("verified-trial-name").fill("张正式");
  await ownerPage.getByTestId("verified-trial-email").fill(ownerEmail);
  await ownerPage.getByTestId("verified-trial-phone").fill(ownerPhone);
  await ownerPage.getByTestId("verified-trial-organization").fill(organizationName);
  await ownerPage.getByTestId("verified-trial-password").fill(ownerPassword);
  await ownerPage.getByTestId("verified-trial-confirm-password").fill(ownerPassword);
  await ownerPage.getByTestId("verified-trial-start").click();

  const signupEmailCode = extractCode(
    await ownerPage.getByTestId("signup-email-code-preview").textContent(),
  );
  const signupPhoneCode = extractCode(
    await ownerPage.getByTestId("signup-phone-code-preview").textContent(),
  );

  await ownerPage.getByTestId("verified-trial-email-code").fill(signupEmailCode);
  await ownerPage.getByTestId("verified-trial-phone-code").fill(signupPhoneCode);
  await ownerPage.getByTestId("verified-trial-complete").click();

  await expect(ownerPage).toHaveURL(/\/setup\?onboarding=trial/);
  await expect(ownerPage.getByText("自助试用已就绪")).toBeVisible();

  for (let index = 0; index < 4; index += 1) {
    await ownerPage.getByTestId("setup-next").click();
  }

  await expect(ownerPage.getByText("邀请团队一起进入正式工作区")).toBeVisible();
  await ownerPage.getByTestId("setup-invite-email").fill(invitedEmail);
  await ownerPage.getByTestId("setup-invite-add").click();
  await expect(ownerPage.getByText(invitedEmail)).toBeVisible();
  await ownerPage.getByTestId("setup-invite-email").fill(invitedAutoEmail);
  await ownerPage.getByTestId("setup-invite-add").click();
  await expect(ownerPage.getByText(invitedAutoEmail)).toBeVisible();

  await ownerPage.getByTestId("setup-next").click();
  await ownerPage.getByTestId("setup-finish").click();
  await expect(ownerPage).toHaveURL(/\/dashboard/);

  await ownerPage.getByTestId("global-logout").click();
  await expect(ownerPage).toHaveURL(/\/login/);

  await ownerPage.getByTestId("password-login-identifier").fill(ownerEmail);
  await ownerPage.getByTestId("password-login-password").fill(ownerPassword);
  await ownerPage.getByTestId("password-login-submit").click();
  await expect(ownerPage).toHaveURL(/\/dashboard/);

  await ownerPage.getByTestId("global-logout").click();
  await expect(ownerPage).toHaveURL(/\/login/);

  await ownerPage.goto("/login?tab=phone");
  await expect(ownerPage.getByTestId("login-returning-entry-disclosure")).toHaveAttribute("open", "");
  await ownerPage.getByTestId("phone-login-phone").fill(ownerPhone);
  await ownerPage.getByTestId("phone-login-request").click();
  const phoneLoginCode = extractCode(
    await ownerPage.getByTestId("phone-login-code-preview").textContent(),
  );
  await ownerPage.getByTestId("phone-login-code").fill(phoneLoginCode);
  await ownerPage.getByTestId("phone-login-submit").click();
  await expect(ownerPage).toHaveURL(/\/dashboard/);

  const invitedContext = await browser.newContext();
  const invitedPage = await invitedContext.newPage();

  await invitedPage.goto(`/login?compat_email=${encodeURIComponent(invitedEmail)}`);
  await waitForWorkspaceUiHydration(invitedPage);
  await expect(invitedPage.getByTestId("public-login-email")).toHaveValue(invitedEmail);
  await invitedPage.getByTestId("public-login-submit").click();
  await completeIdentitySetupIfNeeded(invitedPage, {
    phone: invitedPhone,
    password: invitedPassword,
  });

  const invitedAutoContext = await browser.newContext();
  const invitedAutoPage = await invitedAutoContext.newPage();
  await invitedAutoPage.goto(
    `/login?tab=password&compat_email=${encodeURIComponent(invitedAutoEmail)}&auto_compat=1`,
  );
  await completeIdentitySetupIfNeeded(invitedAutoPage, {
    phone: invitedAutoPhone,
    password: invitedPassword,
  });

  await invitedPage.goto("/settings?tab=permissions");
  const invitedMemberCard = invitedPage
    .locator("div")
    .filter({ hasText: invitedEmail })
    .first();
  await expect(invitedMemberCard).toContainText(/Joined|加入于/);

  await ownerPage.goto("/settings?tab=permissions");
  const ownerMemberCard = ownerPage
    .locator("div")
    .filter({ hasText: invitedEmail })
    .first();
  await ownerMemberCard.locator('[data-testid^="membership-role-select-"]').first().click();
  await ownerPage.getByRole("option", { name: /Billing admin|计费管理员/ }).click();
  await expect(ownerMemberCard).toContainText(/Billing admin|计费管理员/);
  await expect(ownerPage.getByTestId("organization-audit-feed")).toContainText(/role|角色/);
  await expect(ownerPage.getByTestId("organization-support-pack")).toContainText(
    /Retention|保留期/,
  );
  const supportPackDownloadPromise = ownerPage.waitForEvent("download");
  await ownerPage.getByTestId("organization-support-pack-download").click();
  const supportPackDownload = await supportPackDownloadPromise;
  expect(supportPackDownload.suggestedFilename()).toBe("helm-org-admin-support-pack.json");

  await invitedPage.goto("/memory");
  await expect(
    invitedPage.getByRole("link", { name: /Export summary|导出摘要/ }),
  ).toHaveCount(0);
});
