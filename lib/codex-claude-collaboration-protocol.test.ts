import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const PROTOCOL_PATH = "docs/codex/CODEX_CLAUDE_COLLABORATION_PROTOCOL.md";

function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

describe("Codex / Claude collaboration protocol", () => {
  it("keeps role ownership and final validation responsibilities explicit", () => {
    const protocol = readRepoFile(PROTOCOL_PATH);

    expect(protocol).toContain("Codex 是 branch owner / integrator / final validator");
    expect(protocol).toContain("Claude 是 bounded reviewer / explorer / worker");
    expect(protocol).toContain("Owner 做产品、商业、外部副作用和高风险边界最终裁决");
    expect(protocol).toContain("没有 Codex 的最终验证，Claude 的输出只算候选材料");
  });

  it("keeps the handoff packet fields stable", () => {
    const protocol = readRepoFile(PROTOCOL_PATH);
    const requiredFields = [
      "Repo root:",
      "Branch:",
      "Task mode: explorer | reviewer | worker | docs-synthesizer",
      "Goal:",
      "Owned files / read scope:",
      "Non-goals:",
      "Hard boundaries:",
      "Current known facts:",
      "Expected output:",
      "Validation to run:",
      "Do not:",
    ];

    for (const field of requiredFields) {
      expect(protocol).toContain(field);
    }
  });

  it("keeps the Claude absorption states and failure controls visible", () => {
    const protocol = readRepoFile(PROTOCOL_PATH);

    for (const state of ["Accept", "Rewrite", "Reject", "Defer"]) {
      expect(protocol).toContain(state);
    }
    expect(protocol).toContain("两个 agent 同时改同一文件");
    expect(protocol).toContain("public release 误报完成");
    expect(protocol).toContain("Owner 未批准时只允许 read-only、preview-only、suggestion-only");
  });

  it("is linked from the Codex index and the main docs index", () => {
    const codexIndex = readRepoFile("docs/codex/README.md");
    const docsIndex = readRepoFile("docs/README.md");

    expect(codexIndex).toContain(PROTOCOL_PATH.split("/").at(-1));
    expect(docsIndex).toContain("codex/CODEX_CLAUDE_COLLABORATION_PROTOCOL.md");
  });
});
