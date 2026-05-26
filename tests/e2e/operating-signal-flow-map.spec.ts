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

async function loginViaDemo(page: Page) {
  await page.goto("/demo");
  await waitForWorkspaceUiHydration(page);
  await page.getByTestId("demo-entry-founder").click();
  await expect(page).toHaveURL(/\/dashboard/);
  await waitForWorkspaceUiHydration(page);
}

test("operating signal flow fixture map renders static fixture edges", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginViaDemo(page);
  await page.goto("/operating");
  await waitForWorkspaceUiHydration(page);

  const map = page.locator('[data-operating-signal-flow-map="true"]');
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute("data-posture", "fixture");
  await expect(map).toHaveAttribute("data-fixture-prototype", "fixture 原型");
  await expect(map).toHaveAttribute("data-animation-policy", "disabled");
  const animationName = await page
    .locator(".signal-flow-edge")
    .first()
    .evaluate((element) => getComputedStyle(element, "::after").animationName);
  expect(animationName).toBe("none");
  await expect(map).toContainText(/客户经营资产|Customer asset/);
  await expect(map).toContainText(/只读复核|read-only review/);
  await expect(map).toContainText(/下一步先判断这件事|The next customer call/);
  const summaryNote = page.getByLabel(/摘要附注|Summary note/).first();
  await expect(summaryNote).toBeVisible();
  await expect(summaryNote).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByText(/把 Nimbus、Beacon、GreenPeak|Nimbus, Beacon, GreenPeak/),
  ).toHaveCount(0);
  await summaryNote.click();
  await expect(summaryNote).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByText(/Nimbus、Beacon、GreenPeak、Aya、Ben|Nimbus, Beacon, GreenPeak, Aya and Ben/),
  ).toBeVisible();
  await expect(page.getByLabel(/只读附注|Fixture note/)).toBeVisible();
  await expect(page.getByTestId("signal-flow-boundary")).toBeVisible();
  await expect(
    page.getByTestId("signal-flow-boundary").getByRole("button", {
      name: /保护线附注|Guardrail note/,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("signal-flow-business-summary")).toContainText(
    /现在只判断一个问题|Only judgement now/,
  );
  await expect(page.getByTestId("signal-flow-business-summary")).toContainText(
    /Acme 试点承诺型外发草稿|Acme pilot commitment-sensitive send draft/,
  );
  await expect(page.getByTestId("signal-flow-primary-safety-labels")).toContainText(
    /未外发|Not sent/,
  );
  await expect(page.getByTestId("signal-flow-primary-safety-labels")).toContainText(
    /需人工复核|Human review required/,
  );
  await expect(page.getByTestId("signal-flow-business-summary")).toContainText(
    /谨慎动作|Sensitive action/,
  );
  await expect(page.getByTestId("signal-flow-family-evolution")).toContainText(
    /按信号类型看客户资产|Customer assets by signal type/,
  );
  const familyDetails = page.getByTestId("signal-flow-family-evolution-details");
  await expect(familyDetails).not.toHaveAttribute("open", "");
  await expect(page.getByTestId("signal-flow-family-row").first()).toBeHidden();
  const assetEvolutionNote = page.getByLabel(/资产演进附注|Asset evolution note/);
  await assetEvolutionNote.click();
  await expect(assetEvolutionNote).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByText(/把承诺、证据缺口|Commitments, evidence gaps/),
  ).toBeVisible();
  await expect(familyDetails).not.toHaveAttribute("open", "");
  await familyDetails.locator("summary").click();
  await expect(familyDetails).toHaveAttribute("open", "");
  await expect(page.getByTestId("signal-flow-family-evolution")).toContainText(
    /Nimbus|Beacon|Aya Nakamura/,
  );
  await expect(page.locator("[data-testid='signal-flow-process-spine'] > *")).toHaveCount(6);
  await expect(page.getByTestId("signal-flow-control-layer")).toContainText(
    /其他压力|Other pressure/,
  );
  await expect(page.getByTestId("signal-flow-control-paths")).not.toHaveAttribute("open", "");
  await expect(page.getByTestId("signal-flow-process-section")).not.toHaveAttribute("open", "");
  await expect(page.getByTestId("signal-flow-lifecycle-graph")).not.toContainText(
    /第 1 步|Step 1/,
  );
  await expect(map).toContainText(/只停在复核|review only/);
  await expect(map.locator("[data-testid='signal-flow-family-row']")).toHaveCount(7);
});
