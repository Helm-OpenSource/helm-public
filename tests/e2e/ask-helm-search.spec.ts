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

test("Ask Helm keeps related objects first for object-style asks", async ({
  page,
}) => {
  await openDemoWorkspace(page);

  await page.goto("/search?mode=ask&q=Atlas");
  await waitForWorkspaceUiHydration(page);

  await expect(page.getByTestId("ask-helm-mode")).toBeVisible();
  await expect(page.getByTestId("ask-helm-related-objects")).toContainText(
    "Atlas AI",
  );
  await expect(page.getByTestId("ask-helm-related-object").first()).toBeVisible();
  await expect(page.getByTestId("ask-helm-answer")).toContainText(
    "我会先把这个问题当作工作区对象搜索处理。",
  );
});

test("Ask Helm voice plan keeps boundary note, plan structure, and transcript checked", async ({
  page,
}) => {
  await openDemoWorkspace(page);

  const params = new URLSearchParams({
    mode: "ask",
    input: "voice",
    transcriptConfirmed: "true",
    voiceConfidence: "high",
    q: "帮我把 Atlas 续约拆成三步",
  });

  await page.goto(`/search?${params.toString()}`);
  await waitForWorkspaceUiHydration(page);

  await expect(page.getByTestId("ask-helm-answer")).toContainText(
    "拆出可复核的行动计划",
  );
  await expect(page.getByTestId("ask-helm-boundary-note")).toContainText(
    "行动拆解和交接只是下一步建议或内部准备",
  );
  await expect(page.getByTestId("ask-helm-action-packet")).toBeVisible();
  await expect(page.getByTestId("ask-helm-action-packet")).toContainText(
    "证据化行动包",
  );
  await expect(page.getByTestId("ask-helm-action-packet-evidence")).toHaveCount(8);
  await expect(page.getByTestId("ask-helm-action-plan")).toBeVisible();
  await expect(page.getByTestId("ask-helm-plan-step")).toHaveCount(3);
  await expect(page.getByTestId("ask-helm-plan-step-object-ref").first()).toContainText(
    "对象已落对象",
  );
  await expect(page.getByTestId("ask-helm-plan-step-dri")).toHaveCount(3);
  await expect(page.getByTestId("ask-helm-plan-step-due")).toHaveCount(3);
  await expect(page.getByTestId("ask-helm-voice")).toBeVisible();
  await expect(page.getByTestId("ask-helm-voice-transcript")).toContainText(
    "已核对",
  );
});
