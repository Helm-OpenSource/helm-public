import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mobilePageSource = readFileSync("app/(workspace)/mobile/page.tsx", "utf8");

describe("mobile command page China-first UX contract", () => {
  it("keeps the mobile surface focused on Ask Helm, signal capture, and review-first progression", () => {
    expect(mobilePageSource).toContain("提问 / 上报信号");
    expect(mobilePageSource).toContain("const hasAskHelmQuery = Boolean(q?.trim())");
    expect(mobilePageSource).toContain("{!hasAskHelmQuery ? (");
    expect(mobilePageSource).toContain("mobile-signal-capture-entry");
    expect(mobilePageSource).toContain("<OutcomeLedgerPanel ledger={readModel.outcomeLedger} english={english} />");
    expect(mobilePageSource).toContain("快速上报经营信号");
    expect(mobilePageSource).toContain("先进入复核候选，不直接生成正式推进");
    expect(mobilePageSource).toContain("/search?mode=ask&input=voice#ask-helm-signal-intake");
    expect(mobilePageSource).toContain("/search?mode=ask#ask-helm-signal-intake");
    expect(mobilePageSource).toContain("我的复核");
    expect(mobilePageSource).toContain("今日推进");
  });
});
