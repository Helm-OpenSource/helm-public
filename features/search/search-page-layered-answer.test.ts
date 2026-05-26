import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const searchPageSource = readFileSync("app/(workspace)/search/page.tsx", "utf8");

describe("Ask Helm search page layered answer contract", () => {
  it("renders the layered answer panel with signal card test ids before the technical audit panel", () => {
    expect(searchPageSource).toContain("ask-helm-layered-answer");
    expect(searchPageSource).toContain("ask-helm-business-signals");
    expect(searchPageSource).toContain("ask-helm-business-signal-card");
    expect(searchPageSource).toContain("ask-helm-signal-intake");
    expect(searchPageSource).toContain("ask-helm-signal-intake-form");
    expect(searchPageSource).toContain("ask-helm-signal-submit");
    expect(searchPageSource).toContain("ask-helm-signal-submitted");
    expect(searchPageSource).toContain("ask-helm-signal-submission-readout");
    expect(searchPageSource).toContain("ask-helm-signal-error");
    expect(searchPageSource).toContain("ask-helm-work-intent-shortcuts");
    expect(searchPageSource).toContain("问经营问题，或上报客户、会议、交付、承诺、阻塞信号");
    expect(searchPageSource).toContain("客户在等、承诺可能延期、交付被阻塞，或回复前需要主管复核");
    expect(searchPageSource).toContain("最近上报列表和审计记录");
    expect(searchPageSource).toContain("工作区负责人或具备复核权限的成员");
    expect(searchPageSource).toContain("人工复核后才可能提升为正式推进项");
    expect(searchPageSource).toContain("submitAskHelmSignalCandidateFormAction");
    expect(searchPageSource).toContain("AskHelmLayeredAnswerPanel");
    expect(searchPageSource).toContain("loadAskHelmBusinessContextRecords");
    expect(searchPageSource).toContain("buildAskHelmBusinessSignalsFromRecords");
    expect(searchPageSource).toContain("ask-helm-context-audit-toggle");
    const layeredUsageIndex = searchPageSource.indexOf("<AskHelmLayeredAnswerPanel");
    const auditUsageIndex = searchPageSource.indexOf("ask-helm-context-audit-toggle");
    expect(layeredUsageIndex).toBeGreaterThan(-1);
    expect(auditUsageIndex).toBeGreaterThan(layeredUsageIndex);
  });
});
