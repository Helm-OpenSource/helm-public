import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Stage 1 terminal result production entry", () => {
  it("loads the Stage 1 claim into the existing approvals read model", () => {
    const source = read("features/approvals/queries.ts");

    expect(source).toContain("decisionWorkPacketClaim");
    expect(source).toContain("decisionRecordId: true");
  });

  it("publishes the existing insight permission to the terminal result control", () => {
    const source = read("features/approvals/page-loader.ts");

    expect(source).toContain("canManageWorkspaceInsights");
    expect(source).toContain("canFinalizeStage1Result");
    expect(source).toContain("stage1ResultDeniedMessage");
  });

  it("requires an explicit final result and outcome reference before invoking the server action", () => {
    const source = read("features/approvals/approvals-client.tsx");

    expect(source).toContain("stage1BusinessResult");
    expect(source).toContain("stage1OutcomeRef");
    expect(source).toContain("stage1FollowedRecommendation");
    expect(source).toContain("stage1TerminalResult:");
    expect(source).toContain("verifyExecutedTaskReceiptAction({");
  });
});
