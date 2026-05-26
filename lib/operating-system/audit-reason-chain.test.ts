import { describe, expect, it } from "vitest";
import { buildAuditReasonChain } from "@/lib/operating-system/audit-reason-chain";

describe("audit reason chain display copy", () => {
  it("keeps Chinese audit replay free of raw payload/source-page/summary wording", () => {
    const chain = buildAuditReasonChain(
      {
        id: "audit_demo",
        actionType: "RECOMMENDATION_GENERATED",
        summary: "系统为华东智造生成了下一步建议",
        payload: null,
      },
      false,
    );

    const visibleCopy = chain.map((item) => item.summary).join("\n");

    expect(visibleCopy).toContain("这条审计暂未标出具体来源页面。");
    expect(visibleCopy).toContain("这次动作的结果目前主要体现在上方说明里。");
    expect(visibleCopy).toContain("这类审计还值得补更丰富的执行者说明。");
    expect(visibleCopy).not.toMatch(/payload|source page|summary/i);
    expect(visibleCopy).not.toContain("RECOMMENDATION_GENERATED");
  });

  it("keeps populated Chinese result and actor notes out of raw payload wording", () => {
    const chain = buildAuditReasonChain(
      {
        id: "audit_result",
        actionType: "APPROVAL_APPROVED",
        summary: "审批已通过",
        payload: JSON.stringify({ result: "APPROVED", actorName: "周玥" }),
      },
      false,
    );

    const visibleCopy = chain.map((item) => item.summary).join("\n");

    expect(visibleCopy).toContain("记录到的结果状态是 APPROVED。");
    expect(visibleCopy).toContain("记录到的执行者是 周玥。");
    expect(visibleCopy).not.toMatch(/payload|source page|summary/i);
  });
});
