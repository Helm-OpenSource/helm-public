import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "features/dashboard/stage1-owner-loop-console.tsx",
  "utf8",
);
const querySource = readFileSync(
  "features/dashboard/stage1-owner-loop-query.ts",
  "utf8",
);

describe("Stage 1 owner-loop console boundaries", () => {
  it("exposes a named owner surface with an explicit review-first boundary", () => {
    expect(source).toContain('aria-labelledby="stage1-owner-loop-title"');
    expect(source).toContain('data-stage1-owner-loop-console="true"');
    expect(source).toContain("本面板不执行、不外发、不产生承诺");
    expect(source).toContain(
      "this surface does not execute, send, or create commitments",
    );
  });

  it("keeps the aggregate owner-only and provides named navigation links", () => {
    expect(querySource).toContain(
      "input.membershipRole !== WorkspaceRole.OWNER",
    );
    expect(source).toContain('href="/approvals"');
    expect(source).toContain('href="/memory"');
  });

  it("projects P1C in read-only mode without exposing selection or dispatch mutations", () => {
    expect(source).toContain(
      'data-caio-operating-question-portfolio="true"',
    );
    expect(source).toContain(
      "本区仅作只读投影，不能选择、确认、派工或创建 Work Packet",
    );
    expect(source).toContain(
      "This is a read-only projection: it cannot select, confirm, dispatch, or create a Work Packet",
    );
    expect(source).not.toContain("selectCaioOperatingQuestions");
    expect(source).not.toContain(
      "bindCurrentCaioQuestionSelectionToDecisionRecords",
    );
    expect(querySource).not.toMatch(/\.(?:create|update|upsert|delete)\(/u);
  });

  it("labels a retained last-valid portfolio with generation and version context", () => {
    expect(source).toContain(
      'data-caio-operating-question-stale-portfolio="true"',
    );
    expect(source).toContain(
      "Latest generation ${operatingQuestions.generationSequence} lacked sufficient evidence",
    );
    expect(source).toContain(
      "最新第 ${operatingQuestions.generationSequence} 次生成证据不足",
    );
    expect(source).toContain(
      "portfolioGeneratedAt",
    );
  });
});
