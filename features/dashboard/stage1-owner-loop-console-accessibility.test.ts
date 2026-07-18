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
});
