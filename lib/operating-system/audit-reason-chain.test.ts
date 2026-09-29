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

  it("falls back to the AuditLog sourcePage / actor / actorType columns when the payload lacks them", () => {
    const chain = buildAuditReasonChain(
      {
        id: "audit_columns",
        actionType: "demo.case.assignment.applied",
        summary: "case assigned",
        payload: JSON.stringify({ caseId: "c1" }),
        sourcePage: "demo/assignment",
        actor: "demo.router.v1",
        actorType: "SYSTEM",
      },
      false,
    );

    const byId = Object.fromEntries(chain.map((item) => [item.id, item.summary]));
    expect(byId["audit_columns-source"]).toBe("这次变化记录的来源是 demo/assignment。");
    expect(byId["audit_columns-actor"]).toBe("记录到的执行者是 demo.router.v1（系统）。");
    // Result has no column; it stays payload-derived.
    expect(byId["audit_columns-result"]).toBe("这次动作的结果目前主要体现在上方说明里。");
    expect(byId["audit_columns-action"]).toBe("case assigned");
  });

  it("prefers payload over columns, and registered labels over raw column codes", () => {
    const labels = {
      action: { zh: "案件分配", en: "Case assignment" },
      actor: { zh: "演示路由", en: "Demo router" },
      sourcePage: { zh: "分配任务", en: "Assignment job" },
    };
    const zh = buildAuditReasonChain(
      {
        id: "audit_labels",
        actionType: "demo.case.assignment.applied",
        summary: "case assigned",
        payload: JSON.stringify({ status: "applied" }),
        sourcePage: "demo/assignment",
        actor: "demo.router.v1",
        actorType: "SYSTEM",
        displayLabels: labels,
      },
      false,
    );
    const zhById = Object.fromEntries(zh.map((item) => [item.id, item.summary]));
    expect(zhById["audit_labels-action"]).toBe("案件分配");
    expect(zhById["audit_labels-source"]).toBe("这次变化记录的来源是 分配任务。");
    expect(zhById["audit_labels-actor"]).toBe("记录到的执行者是 演示路由（系统）。");
    expect(zhById["audit_labels-result"]).toBe("记录到的结果状态是 applied。");

    const en = buildAuditReasonChain(
      {
        id: "audit_labels",
        actionType: "demo.case.assignment.applied",
        summary: "case assigned",
        payload: JSON.stringify({ sourcePage: "/memory", actorName: "Zhou" }),
        sourcePage: "demo/assignment",
        actor: "demo.router.v1",
        actorType: "USER",
        displayLabels: labels,
      },
      true,
    );
    const enById = Object.fromEntries(en.map((item) => [item.id, item.summary]));
    expect(enById["audit_labels-action"]).toBe("case assigned");
    expect(enById["audit_labels-source"]).toBe("This change is recorded as coming from /memory.");
    expect(enById["audit_labels-actor"]).toBe("Zhou (User) is recorded as the actor.");
  });
});
